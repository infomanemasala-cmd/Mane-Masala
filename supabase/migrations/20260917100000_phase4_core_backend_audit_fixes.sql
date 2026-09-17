-- Phase 4 core implementation audit fixes.
-- Scope: reservation lifecycle correctness, production chronology, FIFO protection,
-- supplier refund type compatibility, and the missing customer-return backend workflow.

ALTER TABLE public.supplier_adjustments
  DROP CONSTRAINT IF EXISTS supplier_adjustments_adjustment_type_check;
ALTER TABLE public.supplier_adjustments
  ADD CONSTRAINT supplier_adjustments_adjustment_type_check
  CHECK (adjustment_type = ANY (ARRAY['credit'::text,'refund'::text,'debit'::text,'shortage_credit'::text,'other'::text]));

CREATE OR REPLACE VIEW public.v_inventory_current
WITH (security_invoker=true)
AS
SELECT i.id AS item_id, i.business_code, i.name, i.base_unit_id,
       COALESCE(sum(b.quantity_remaining),0) AS current_stock,
       COALESCE((SELECT sum(r.quantity_reserved) FROM public.stock_reservations r WHERE r.item_id=i.id AND r.status IN ('active','issued')),0) AS reserved_stock,
       COALESCE(sum(b.quantity_remaining),0) - COALESCE((SELECT sum(r.quantity_reserved) FROM public.stock_reservations r WHERE r.item_id=i.id AND r.status IN ('active','issued')),0) AS available_stock,
       i.minimum_stock, i.is_active
FROM public.items i LEFT JOIN public.inventory_batches b ON b.item_id=i.id AND b.status='active'
GROUP BY i.id,i.business_code,i.name,i.base_unit_id,i.minimum_stock,i.is_active;

CREATE OR REPLACE FUNCTION public.resolve_order_procurement_requirements(p_order_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
declare r record; v_available numeric; v_count int:=0;
begin
  for r in select * from public.order_line_procurement_requirements where order_id=p_order_id and status='open' for update loop
    select greatest(0,coalesce(sum(ib.quantity_remaining),0)-coalesce((select sum(sr.quantity_reserved) from public.stock_reservations sr where sr.item_id=r.ingredient_item_id and sr.status in ('active','issued') and sr.order_id<>r.order_id),0)) into v_available
    from public.inventory_batches ib where ib.item_id=r.ingredient_item_id and ib.status='active' and ib.quantity_remaining>0;
    update public.order_line_procurement_requirements set available_quantity=v_available,shortfall_quantity=greatest(0,required_quantity-v_available),status=case when v_available>=required_quantity then 'resolved' else 'open' end,resolved_at=case when v_available>=required_quantity then now() else null end where id=r.id;
    if v_available>=r.required_quantity then v_count:=v_count+1; end if;
  end loop; return v_count;
end; $$;

CREATE OR REPLACE FUNCTION public.prepare_order_plan(p_order_id uuid,p_recipe_selections jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
declare v_user uuid:=auth.uid(); v_status text; v_reserved numeric:=0; v_shortfall numeric:=0; v_plan_count int:=0; v_result jsonb:='[]'::jsonb; ol record; sel jsonb; rec record; rl record; pb_id uuid; avail numeric; reserve_qty numeric; plan_qty numeric; ing_need numeric; ing_avail numeric;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select status into v_status from public.orders where id=p_order_id for update;
  if v_status is null then raise exception 'Order not found'; end if;
  if v_status not in ('received','draft') then raise exception 'Order must be in Received status before planning'; end if;
  if jsonb_typeof(p_recipe_selections)<>'array' then raise exception 'Recipe selections must be an array'; end if;
  if exists(select 1 from public.production_batches where order_id=p_order_id and status not in ('completed','cancelled')) then raise exception 'This order already has an active production plan'; end if;
  if exists(select 1 from public.stock_reservations where order_id=p_order_id and status='active') then raise exception 'This order already has active reservations'; end if;
  for ol in select id,item_id,ordered_quantity,unit_id,coalesce(reserved_quantity,0) reserved_quantity,coalesce(produced_quantity,0) produced_quantity from public.order_lines where order_id=p_order_id order by id loop
    select greatest(0,coalesce(v.current_stock,0)-coalesce((select sum(r.quantity_reserved) from public.stock_reservations r where r.item_id=ol.item_id and r.status in ('active','issued') and r.order_id<>p_order_id),0)) into avail from public.v_inventory_current v where v.item_id=ol.item_id;
    avail:=greatest(coalesce(avail,0),0); reserve_qty:=least(greatest(0,ol.ordered_quantity-ol.produced_quantity),avail);
    if reserve_qty>0 then
      insert into public.stock_reservations(order_id,order_line_id,item_id,quantity_reserved,unit_id,status,reserved_at,created_by) values(p_order_id,ol.id,ol.item_id,reserve_qty,ol.unit_id,'active',now(),v_user);
      update public.order_lines set reserved_quantity=reserve_qty,production_pending_quantity=greatest(0,ordered_quantity-reserve_qty-coalesce(produced_quantity,0)),updated_at=now() where id=ol.id; v_reserved:=v_reserved+reserve_qty;
    else
      update public.order_lines set reserved_quantity=0,production_pending_quantity=greatest(0,ordered_quantity-coalesce(produced_quantity,0)),updated_at=now() where id=ol.id;
    end if;
    plan_qty:=greatest(0,ol.ordered_quantity-ol.produced_quantity-reserve_qty);
    if plan_qty>0 then
      v_shortfall:=v_shortfall+plan_qty;
      select value into sel from jsonb_array_elements(p_recipe_selections) where value->>'order_line_id'=ol.id::text limit 1;
      if sel is null or nullif(sel->>'recipe_version_id','') is null then raise exception 'Order line % needs production. Select a recipe version before planning.',ol.id; end if;
      select r.id recipe_id,r.output_item_id,rv.id recipe_version_id,rv.expected_output_quantity,rv.output_unit_id into rec from public.recipe_versions rv join public.recipes r on r.id=rv.recipe_id where rv.id=(sel->>'recipe_version_id')::uuid and rv.status='active' and r.status='active' and r.output_item_id=ol.item_id;
      if not found then raise exception 'Selected recipe version is not active or does not belong to the ordered item.'; end if;
      if rec.output_unit_id<>ol.unit_id then raise exception 'Selected recipe output unit must match the order line unit.'; end if;
      pb_id:=public.gen_random_uuid();
      insert into public.production_batches(id,order_id,order_line_id,recipe_version_id,output_item_id,planned_output_quantity,output_unit_id,production_date,status,wife_approval_status,created_by) values(pb_id,p_order_id,ol.id,rec.recipe_version_id,ol.item_id,plan_qty,ol.unit_id,current_date,'planned','pending',v_user);
      for rl in select id,ingredient_item_id,quantity,unit_id,sequence_number from public.recipe_lines where recipe_version_id=rec.recipe_version_id order by sequence_number,id loop
        ing_need:=rl.quantity*(plan_qty/rec.expected_output_quantity);
        insert into public.production_batch_plan_lines(production_batch_id,recipe_line_id,ingredient_item_id,planned_quantity,unit_id,sequence_number) values(pb_id,rl.id,rl.ingredient_item_id,ing_need,rl.unit_id,rl.sequence_number);
        select greatest(0,coalesce(sum(b.quantity_remaining),0)-coalesce((select sum(sr.quantity_reserved) from public.stock_reservations sr where sr.item_id=rl.ingredient_item_id and sr.status in ('active','issued') and sr.order_id<>p_order_id),0)) into ing_avail from public.inventory_batches b where b.item_id=rl.ingredient_item_id and b.status='active' and b.quantity_remaining>0;
        if ing_avail>=ing_need then
          insert into public.stock_reservations(order_id,order_line_id,item_id,quantity_reserved,unit_id,status,reserved_at,created_by,production_batch_id) values(p_order_id,ol.id,rl.ingredient_item_id,ing_need,rl.unit_id,'active',now(),v_user,pb_id);
        else
          if ing_avail>0 then insert into public.stock_reservations(order_id,order_line_id,item_id,quantity_reserved,unit_id,status,reserved_at,created_by,production_batch_id) values(p_order_id,ol.id,rl.ingredient_item_id,ing_avail,rl.unit_id,'active',now(),v_user,pb_id); end if;
          insert into public.order_line_procurement_requirements(order_id,order_line_id,production_batch_id,ingredient_item_id,required_quantity,available_quantity,shortfall_quantity,unit_id,status,priority,notes) values(p_order_id,ol.id,pb_id,rl.ingredient_item_id,ing_need,ing_avail,greatest(0,ing_need-ing_avail),rl.unit_id,'open','urgent','Open procurement requirement for this order line');
          update public.production_batches set wife_approval_status='pending_procurement',updated_at=now() where id=pb_id;
        end if;
      end loop;
      update public.order_lines set production_pending_quantity=plan_qty,production_approval_status=case when exists(select 1 from public.order_line_procurement_requirements q where q.production_batch_id=pb_id and q.status='open') then 'pending_procurement' else 'pending' end,production_block_reason=case when exists(select 1 from public.order_line_procurement_requirements q where q.production_batch_id=pb_id and q.status='open') then 'Purchase required before production can start' else null end,updated_at=now() where id=ol.id;
      v_plan_count:=v_plan_count+1; v_result:=v_result||jsonb_build_array(jsonb_build_object('order_line_id',ol.id,'production_batch_id',pb_id,'shortfall',plan_qty,'recipe_version_id',rec.recipe_version_id));
    end if;
  end loop;
  update public.orders set status='production_planned',updated_at=now() where id=p_order_id;
  perform public.record_audit_event('order.planned','order',p_order_id,jsonb_build_object('reserved',v_reserved,'shortfall',v_shortfall,'production_batches',v_plan_count,'line_independent',true),'application');
  return jsonb_build_object('order_id',p_order_id,'reserved',v_reserved,'shortfall',v_shortfall,'production_batches',v_plan_count,'status','production_planned','details',v_result);
end; $$;

CREATE OR REPLACE FUNCTION public.complete_production(p_production_batch_id uuid,p_consumptions jsonb,p_outputs jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
declare v_user uuid:=auth.uid(); r record; b record; v_need numeric; v_take numeric; v_batch_id uuid; v_order_id uuid; v_order_line_id uuid; v_planned numeric; v_status text; v_approval text; v_available numeric; v_other_reserved numeric; v_unreserved_remaining numeric; v_consumed numeric; v_res record; v_output_item_id uuid; v_output_unit_id uuid; v_output_total numeric:=0; v_production_date date; v_planned_recorded boolean;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select status,wife_approval_status,order_id,order_line_id,output_item_id,output_unit_id,planned_output_quantity,production_date into v_status,v_approval,v_order_id,v_order_line_id,v_output_item_id,v_output_unit_id,v_planned,v_production_date from public.production_batches where id=p_production_batch_id for update;
 if v_status is null then raise exception 'Production batch not found'; end if;
 if v_status='completed' then raise exception 'Production batch already completed'; end if;
 if v_approval<>'approved' then raise exception 'Production batch not approved'; end if;
 if v_status not in ('planned','in_progress') then raise exception 'Production batch cannot be completed from status %',v_status; end if;
 if jsonb_typeof(p_consumptions)<>'array' then raise exception 'Production consumptions must be an array'; end if;
 if jsonb_typeof(p_outputs)<>'array' then raise exception 'Production outputs must be an array'; end if;
 select coalesce(sum(coalesce((x.value->>'quantity')::numeric,0)),0) into v_output_total from jsonb_array_elements(p_outputs) x;
 if v_output_total<=0 then raise exception 'Production output quantity must be greater than zero'; end if;
 for r in select * from jsonb_to_recordset(p_consumptions) as x(ingredient_item_id uuid,actual_quantity numeric,unit_id uuid) loop
   v_need:=r.actual_quantity; if v_need is null or v_need<=0 then continue; end if;
   select coalesce(sum(ib.quantity_remaining),0) into v_available from public.inventory_batches ib where ib.item_id=r.ingredient_item_id and ib.status='active' and ib.quantity_remaining>0;
   select coalesce(sum(sr.quantity_reserved),0) into v_other_reserved from public.stock_reservations sr where sr.item_id=r.ingredient_item_id and sr.status in ('active','issued') and sr.production_batch_id<>p_production_batch_id;
   v_unreserved_remaining:=greatest(0,v_available-v_other_reserved);
   if v_need>v_unreserved_remaining then raise exception 'Insufficient available ingredient stock for %; requested %, available %',r.ingredient_item_id,v_need,v_unreserved_remaining; end if;
   select coalesce(sum(pl.planned_quantity),0) into v_planned from public.production_batch_plan_lines pl where pl.production_batch_id=p_production_batch_id and pl.ingredient_item_id=r.ingredient_item_id;
   v_consumed:=0; v_planned_recorded:=false;
   for b in select ib.id,ib.quantity_remaining,ib.unit_id,ib.unit_cost from public.inventory_batches ib where ib.item_id=r.ingredient_item_id and ib.status='active' and ib.quantity_remaining>0 order by ib.batch_date,ib.created_at,ib.id for update loop
     exit when v_need<=0 or v_unreserved_remaining<=0;
     if b.unit_id<>r.unit_id then raise exception 'Unit mismatch for ingredient %',r.ingredient_item_id; end if;
     v_take:=least(v_need,b.quantity_remaining,v_unreserved_remaining);
     update public.inventory_batches set quantity_remaining=quantity_remaining-v_take,status=case when quantity_remaining-v_take<=0 then 'depleted' else status end,updated_at=now() where id=b.id;
     insert into public.inventory_transactions(item_id,batch_id,transaction_type,quantity,unit_id,occurred_at,reference_type,reference_id,unit_cost,notes,created_by) values(r.ingredient_item_id,b.id,'production_consumption',-v_take,r.unit_id,v_production_date,'production_batch',p_production_batch_id,b.unit_cost,'Production consumption',v_user);
     insert into public.production_consumption(production_batch_id,ingredient_item_id,planned_quantity,actual_quantity,unit_id,batch_id,consumption_date,one_time_variance,recipe_change_requested) values(p_production_batch_id,r.ingredient_item_id,case when v_planned_recorded then null else nullif(v_planned,0) end,v_take,r.unit_id,b.id,v_production_date,(v_planned>0 and not v_planned_recorded and abs(v_take-v_planned)>0.000001),false);
     v_planned_recorded:=true; v_need:=v_need-v_take; v_consumed:=v_consumed+v_take; v_unreserved_remaining:=v_unreserved_remaining-v_take;
   end loop;
   if v_need>0 then raise exception 'Insufficient stock after FIFO consumption for ingredient %; short by %',r.ingredient_item_id,v_need; end if;
   for v_res in select id,quantity_reserved from public.stock_reservations where production_batch_id=p_production_batch_id and item_id=r.ingredient_item_id and status in ('active','issued') order by reserved_at,id for update loop
     exit when v_consumed<=0; v_take:=least(v_consumed,v_res.quantity_reserved);
     if v_take>=v_res.quantity_reserved then update public.stock_reservations set status='consumed',consumed_at=now(),updated_at=now() where id=v_res.id; else update public.stock_reservations set quantity_reserved=quantity_reserved-v_take,updated_at=now() where id=v_res.id; end if;
     v_consumed:=v_consumed-v_take;
   end loop;
 end loop;
 update public.stock_reservations set status='released',updated_at=now() where production_batch_id=p_production_batch_id and status in ('active','issued');
 for r in select * from jsonb_to_recordset(p_outputs) as x(output_item_id uuid,quantity numeric,unit_id uuid,unit_cost numeric) loop
   if r.quantity is null or r.quantity<=0 then continue; end if;
   if r.output_item_id<>v_output_item_id then raise exception 'Production output item must match the production batch output item'; end if;
   if r.unit_id<>v_output_unit_id then raise exception 'Production output unit must match the production batch output unit'; end if;
   v_batch_id:=public.gen_random_uuid();
   insert into public.inventory_batches(id,item_id,source_type,source_id,source_line_id,batch_date,quantity_received,quantity_remaining,unit_id,unit_cost,status) values(v_batch_id,r.output_item_id,'production_output',p_production_batch_id,v_order_line_id,v_production_date,r.quantity,r.quantity,r.unit_id,r.unit_cost,'active');
   insert into public.production_outputs(production_batch_id,output_item_id,quantity,unit_id,output_date,batch_id) values(p_production_batch_id,r.output_item_id,r.quantity,r.unit_id,v_production_date,v_batch_id);
   insert into public.inventory_transactions(item_id,batch_id,transaction_type,quantity,unit_id,occurred_at,reference_type,reference_id,unit_cost,notes,created_by) values(r.output_item_id,v_batch_id,'production_output',r.quantity,r.unit_id,v_production_date,'production_batch',p_production_batch_id,r.unit_cost,'Production output',v_user);
 end loop;
 update public.production_batches set status='completed',actual_output_quantity=v_output_total,updated_at=now() where id=p_production_batch_id;
 if v_order_line_id is not null then update public.order_lines set produced_quantity=coalesce(produced_quantity,0)+v_output_total,updated_at=now() where id=v_order_line_id; end if;
 if v_order_id is not null and not exists(select 1 from public.production_batches pb where pb.order_id=v_order_id and pb.status not in ('completed','cancelled')) and not exists(select 1 from public.order_lines ol where ol.order_id=v_order_id and coalesce(ol.reserved_quantity,0)+coalesce(ol.produced_quantity,0)<ol.ordered_quantity) then update public.orders set status='ready',updated_at=now() where id=v_order_id and status in ('confirmed','in_production'); end if;
 perform public.record_audit_event('production.completed','production_batch',p_production_batch_id,jsonb_build_object('order_id',v_order_id,'order_line_id',v_order_line_id,'output_quantity',v_output_total,'production_date',v_production_date),'application');
 return jsonb_build_object('production_batch_id',p_production_batch_id,'status','completed','output_quantity',v_output_total);
end; $$;

CREATE OR REPLACE FUNCTION public.dispatch_order(p_order_id uuid,p_dispatch_date date,p_method text,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
declare v_user uuid:=auth.uid();v_dispatch_id uuid:=public.gen_random_uuid();r record;b record;res record;v_need numeric;v_take numeric;v_line_id uuid;v_order_status text;v_available numeric;v_other_reserved numeric;v_unreserved_remaining numeric;v_remaining numeric;v_method text;v_final_status text;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 v_method:=case p_method when 'delivery' then 'own_delivery' when 'pickup' then 'customer_pickup' else p_method end;
 if v_method not in ('customer_pickup','own_delivery','courier','transport','other') then raise exception 'Invalid dispatch method'; end if;
 select status into v_order_status from public.orders where id=p_order_id for update;
 if v_order_status is null then raise exception 'Order not found'; end if;
 if v_order_status not in ('confirmed','in_production','ready','partially_dispatched') then raise exception 'Order is not ready for dispatch'; end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'At least one dispatch line is required'; end if;
 insert into public.dispatches(id,order_id,dispatch_date,dispatch_method,status,created_by) values(v_dispatch_id,p_order_id,p_dispatch_date,v_method,'dispatched',v_user);
 for r in select * from jsonb_to_recordset(p_lines) as x(order_line_id uuid,quantity numeric) loop
  v_need:=r.quantity; if v_need is null or v_need<=0 then raise exception 'Dispatch quantity must be greater than zero'; end if;
  if not exists(select 1 from public.order_lines where id=r.order_line_id and order_id=p_order_id) then raise exception 'Order line does not belong to this order'; end if;
  if v_need>(select ordered_quantity-coalesce(dispatched_quantity,0) from public.order_lines where id=r.order_line_id) then raise exception 'Dispatch quantity exceeds remaining order quantity'; end if;
  select coalesce(sum(ib.quantity_remaining),0) into v_available from public.inventory_batches ib where ib.item_id=(select item_id from public.order_lines where id=r.order_line_id) and ib.status='active' and ib.quantity_remaining>0;
  select coalesce(sum(sr.quantity_reserved),0) into v_other_reserved from public.stock_reservations sr where sr.item_id=(select item_id from public.order_lines where id=r.order_line_id) and sr.status in ('active','issued') and sr.order_id<>p_order_id;
  v_unreserved_remaining:=greatest(0,v_available-v_other_reserved);
  if v_need>v_unreserved_remaining then raise exception 'Insufficient available stock for order line %; requested %, available %',r.order_line_id,v_need,v_unreserved_remaining; end if;
  for b in select ib.id,ib.item_id,ib.quantity_remaining,ib.unit_id,ib.unit_cost from public.inventory_batches ib where ib.item_id=(select item_id from public.order_lines where id=r.order_line_id) and ib.status='active' and ib.quantity_remaining>0 order by ib.batch_date,ib.created_at,ib.id for update loop
    exit when v_need<=0 or v_unreserved_remaining<=0; v_take:=least(v_need,b.quantity_remaining,v_unreserved_remaining); v_line_id:=public.gen_random_uuid();
    insert into public.dispatch_lines(id,dispatch_id,order_line_id,item_id,quantity,unit_id,batch_id) values(v_line_id,v_dispatch_id,r.order_line_id,b.item_id,v_take,b.unit_id,b.id);
    update public.inventory_batches set quantity_remaining=quantity_remaining-v_take,status=case when quantity_remaining-v_take<=0 then 'depleted' else status end,updated_at=now() where id=b.id;
    insert into public.inventory_transactions(item_id,batch_id,transaction_type,quantity,unit_id,occurred_at,reference_type,reference_id,reference_line_id,unit_cost,notes,created_by) values(b.item_id,b.id,'dispatch',-v_take,b.unit_id,p_dispatch_date,'dispatch',v_dispatch_id,v_line_id,b.unit_cost,'FIFO dispatch',v_user);
    v_need:=v_need-v_take; v_unreserved_remaining:=v_unreserved_remaining-v_take;
  end loop;
  if v_need>0 then raise exception 'Insufficient stock after FIFO dispatch for order line %; short by %',r.order_line_id,v_need; end if;
  v_remaining:=r.quantity;
  for res in select id,quantity_reserved from public.stock_reservations where order_line_id=r.order_line_id and status='active' order by reserved_at,id for update loop
    exit when v_remaining<=0; v_take:=least(v_remaining,res.quantity_reserved);
    if v_take>=res.quantity_reserved then update public.stock_reservations set status='consumed',consumed_at=now(),updated_at=now() where id=res.id; else update public.stock_reservations set quantity_reserved=quantity_reserved-v_take,updated_at=now() where id=res.id; end if;
    v_remaining:=v_remaining-v_take;
  end loop;
  update public.order_lines set dispatched_quantity=coalesce(dispatched_quantity,0)+r.quantity,updated_at=now() where id=r.order_line_id;
 end loop;
 select case when not exists(select 1 from public.order_lines where order_id=p_order_id and coalesce(dispatched_quantity,0)<ordered_quantity) then 'dispatched' else 'partially_dispatched' end into v_final_status;
 update public.orders set status=v_final_status,updated_at=now() where id=p_order_id;
 perform public.record_audit_event('dispatch.completed','dispatch',v_dispatch_id,jsonb_build_object('order_id',p_order_id,'method',v_method,'order_status',v_final_status),'application');
 return jsonb_build_object('dispatch_id',v_dispatch_id,'order_id',p_order_id,'status',v_final_status);
end; $$;

CREATE OR REPLACE FUNCTION public.record_supplier_return(p_purchase_id uuid,p_return_date date,p_reason text,p_lines jsonb,p_credit_amount numeric DEFAULT 0,p_supplier_agreed boolean DEFAULT true,p_notes text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
declare v_user uuid:=auth.uid();v_return_id uuid:=public.gen_random_uuid();v_supplier_id uuid;v_line jsonb;v_purchase_line public.purchase_lines%rowtype;v_qty numeric;v_source text;v_available numeric;v_remaining numeric;v_batch public.inventory_batches%rowtype;v_take numeric;v_count int:=0;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if coalesce(jsonb_array_length(p_lines),0)=0 then raise exception 'At least one return item is required'; end if;
 if coalesce(p_credit_amount,0)<0 then raise exception 'Credit amount cannot be negative'; end if;
 select supplier_id into v_supplier_id from public.purchases where id=p_purchase_id for update;
 if v_supplier_id is null then raise exception 'Purchase not found'; end if;
 insert into public.purchase_returns(id,business_code,purchase_id,return_date,reason,status,supplier_agreed,credit_amount,notes,created_by) values(v_return_id,null,p_purchase_id,coalesce(p_return_date,current_date),nullif(trim(coalesce(p_reason,'')),''),'completed',p_supplier_agreed,coalesce(p_credit_amount,0),nullif(trim(coalesce(p_notes,'')),''),v_user);
 for v_line in select * from jsonb_array_elements(p_lines) loop
  select * into v_purchase_line from public.purchase_lines where id=(v_line->>'purchase_line_id')::uuid and purchase_id=p_purchase_id for update;
  if not found then raise exception 'Purchase line not found'; end if;
  v_qty:=greatest(0,coalesce((v_line->>'quantity')::numeric,0));v_source:=coalesce(v_line->>'return_source','accepted_stock');
  if v_qty<=0 then raise exception 'Return quantity must be greater than zero'; end if;
  if v_source not in ('rejected_receipt','accepted_stock') then raise exception 'Invalid return source'; end if;
  if v_source='rejected_receipt' then
   select greatest(0,coalesce(sum(rl.rejected_quantity),0)-coalesce((select sum(prl.quantity) from public.purchase_return_lines prl join public.purchase_returns pr on pr.id=prl.purchase_return_id where prl.purchase_line_id=v_purchase_line.id and pr.status<>'cancelled' and prl.return_source='rejected_receipt'),0)) into v_available from public.purchase_receipt_lines rl where rl.purchase_line_id=v_purchase_line.id;
  else
   select greatest(0,coalesce(sum(b.quantity_remaining),0)) into v_available from public.inventory_batches b where b.item_id=v_purchase_line.item_id and b.status='active' and b.unit_id=v_purchase_line.unit_id;
  end if;
  if v_qty>coalesce(v_available,0) then raise exception 'Return quantity for this item exceeds the quantity available to return'; end if;
  insert into public.purchase_return_lines(id,purchase_return_id,purchase_line_id,quantity,unit_id,reason,return_source) values(public.gen_random_uuid(),v_return_id,v_purchase_line.id,v_qty,v_purchase_line.unit_id,nullif(trim(coalesce(v_line->>'reason','')),''),v_source);
  if v_source='accepted_stock' then
   v_remaining:=v_qty;
   for v_batch in select * from public.inventory_batches where item_id=v_purchase_line.item_id and status='active' and quantity_remaining>0 and unit_id=v_purchase_line.unit_id order by batch_date,created_at,id for update loop
    exit when v_remaining<=0;v_take:=least(v_remaining,v_batch.quantity_remaining);
    update public.inventory_batches set quantity_remaining=quantity_remaining-v_take,status=case when quantity_remaining-v_take=0 then 'depleted' else status end,updated_at=now() where id=v_batch.id;
    insert into public.inventory_transactions(item_id,batch_id,transaction_type,quantity,unit_id,occurred_at,reference_type,reference_id,reference_line_id,unit_cost,notes,created_by) values(v_purchase_line.item_id,v_batch.id,'supplier_return',-v_take,v_batch.unit_id,coalesce(p_return_date,current_date),'purchase_return',v_return_id,v_purchase_line.id,v_batch.unit_cost,'Supplier return',v_user);
    v_remaining:=v_remaining-v_take;
   end loop;
   if v_remaining>0 then raise exception 'Unable to complete supplier return from available stock'; end if;
  end if;
  v_count:=v_count+1;
 end loop;
 update public.purchases set workflow_status='partial_returned',updated_at=now() where id=p_purchase_id;
 if coalesce(p_credit_amount,0)>0 then insert into public.supplier_adjustments(id,supplier_id,purchase_id,purchase_return_id,adjustment_date,adjustment_type,amount,notes,created_by) values(public.gen_random_uuid(),v_supplier_id,p_purchase_id,v_return_id,coalesce(p_return_date,current_date),'credit',p_credit_amount,'Supplier credit for purchase return',v_user); end if;
 perform public.record_audit_event('purchase.return.completed','purchase',p_purchase_id,jsonb_build_object('purchase_return_id',v_return_id,'lines',v_count,'credit_amount',coalesce(p_credit_amount,0)),'application');
 return jsonb_build_object('purchase_return_id',v_return_id,'purchase_id',p_purchase_id,'lines',v_count,'credit_amount',coalesce(p_credit_amount,0),'status','completed');
end; $$;

CREATE OR REPLACE FUNCTION public.receive_customer_return(p_customer_id uuid,p_sale_id uuid,p_invoice_id uuid,p_return_date date,p_lines jsonb,p_notes text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
declare v_user uuid:=auth.uid();v_return_id uuid:=public.gen_random_uuid();v_line jsonb;v_sale_line record;v_qty numeric;v_already numeric;v_count int:=0;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_customer_id is null then raise exception 'Customer is required'; end if;
 if p_sale_id is null then raise exception 'Original sale is required'; end if;
 if coalesce(jsonb_array_length(p_lines),0)=0 then raise exception 'At least one returned item is required'; end if;
 if not exists(select 1 from public.sales where id=p_sale_id and customer_id=p_customer_id) then raise exception 'Original sale does not belong to the selected customer'; end if;
 if p_invoice_id is not null and not exists(select 1 from public.invoices where id=p_invoice_id and sale_id=p_sale_id) then raise exception 'Invoice does not belong to the original sale'; end if;
 insert into public.customer_returns(id,business_code,customer_id,sale_id,invoice_id,return_date,status,notes,created_by) values(v_return_id,null,p_customer_id,p_sale_id,p_invoice_id,coalesce(p_return_date,current_date),'received',nullif(trim(coalesce(p_notes,'')),''),v_user);
 for v_line in select * from jsonb_array_elements(p_lines) loop
   select sl.id,sl.item_id,sl.quantity,sl.unit_id,sl.selling_rate into v_sale_line from public.sale_lines sl where sl.id=(v_line->>'sale_line_id')::uuid and sl.sale_id=p_sale_id for update;
   if not found then raise exception 'Sale line not found'; end if;
   v_qty:=coalesce((v_line->>'quantity')::numeric,0); if v_qty<=0 then raise exception 'Return quantity must be greater than zero'; end if;
   select coalesce(sum(crl.quantity),0) into v_already from public.customer_return_lines crl join public.customer_returns cr on cr.id=crl.customer_return_id where crl.sale_line_id=v_sale_line.id and cr.status not in ('cancelled','rejected');
   if v_qty+v_already>v_sale_line.quantity then raise exception 'Return quantity exceeds the quantity sold on this line'; end if;
   insert into public.customer_return_lines(customer_return_id,sale_line_id,item_id,quantity,unit_id,sale_rate,approved_saleable_quantity) values(v_return_id,v_sale_line.id,v_sale_line.item_id,v_qty,v_sale_line.unit_id,v_sale_line.selling_rate,0);
   v_count:=v_count+1;
 end loop;
 perform public.record_audit_event('customer.return.received','customer_return',v_return_id,jsonb_build_object('sale_id',p_sale_id,'invoice_id',p_invoice_id,'lines',v_count),'application');
 return jsonb_build_object('customer_return_id',v_return_id,'status','received','lines',v_count);
end; $$;

CREATE OR REPLACE FUNCTION public.inspect_customer_return(p_customer_return_id uuid,p_inspection_outcome text,p_notes text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_inspection_outcome is null or btrim(p_inspection_outcome)='' then raise exception 'Inspection outcome is required'; end if;
 update public.customer_returns set status='inspected',inspection_outcome=p_inspection_outcome,notes=case when p_notes is null then notes else p_notes end,updated_at=now() where id=p_customer_return_id and status='received';
 if not found then raise exception 'Customer return must be in Received status'; end if;
 perform public.record_audit_event('customer.return.inspected','customer_return',p_customer_return_id,jsonb_build_object('inspection_outcome',p_inspection_outcome),'application');
 return jsonb_build_object('customer_return_id',p_customer_return_id,'status','inspected');
end; $$;

CREATE OR REPLACE FUNCTION public.approve_customer_return(p_customer_return_id uuid,p_line_approvals jsonb,p_refund_amount numeric DEFAULT 0,p_notes text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
declare v_user uuid:=auth.uid();v_line jsonb;v_return_line record;v_approved numeric;v_batch_id uuid;v_count int:=0;v_total_saleable numeric:=0;v_return_date date;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if coalesce(p_refund_amount,0)<0 then raise exception 'Refund amount cannot be negative'; end if;
 if jsonb_typeof(p_line_approvals)<>'array' then raise exception 'Line approvals must be an array'; end if;
 select return_date into v_return_date from public.customer_returns where id=p_customer_return_id and status='inspected' for update;
 if v_return_date is null then raise exception 'Customer return must be inspected before approval'; end if;
 for v_line in select * from jsonb_array_elements(p_line_approvals) loop
   select * into v_return_line from public.customer_return_lines where id=(v_line->>'customer_return_line_id')::uuid and customer_return_id=p_customer_return_id for update;
   if not found then raise exception 'Customer return line not found'; end if;
   v_approved:=greatest(0,coalesce((v_line->>'approved_saleable_quantity')::numeric,0));
   if v_approved>v_return_line.quantity then raise exception 'Approved saleable quantity cannot exceed returned quantity'; end if;
   update public.customer_return_lines set approved_saleable_quantity=v_approved where id=v_return_line.id;
   if v_approved>0 then
     v_batch_id:=public.gen_random_uuid();
     insert into public.inventory_batches(id,item_id,source_type,source_id,source_line_id,batch_date,quantity_received,quantity_remaining,unit_id,unit_cost,status) values(v_batch_id,v_return_line.item_id,'customer_return',p_customer_return_id,v_return_line.id,v_return_date,v_approved,v_approved,v_return_line.unit_id,null,'active');
     insert into public.inventory_transactions(item_id,batch_id,transaction_type,quantity,unit_id,occurred_at,reference_type,reference_id,reference_line_id,notes,created_by) values(v_return_line.item_id,v_batch_id,'customer_return',v_approved,v_return_line.unit_id,v_return_date,'customer_return',p_customer_return_id,v_return_line.id,'Approved customer return stock restoration',v_user);
   end if;
   v_total_saleable:=v_total_saleable+v_approved;v_count:=v_count+1;
 end loop;
 update public.customer_returns set status='approved',refund_amount=coalesce(p_refund_amount,0),notes=coalesce(p_notes,notes),updated_at=now() where id=p_customer_return_id;
 perform public.record_audit_event('customer.return.approved','customer_return',p_customer_return_id,jsonb_build_object('lines',v_count,'saleable_quantity',v_total_saleable,'refund_amount',coalesce(p_refund_amount,0)),'application');
 return jsonb_build_object('customer_return_id',p_customer_return_id,'status','approved','saleable_quantity',v_total_saleable,'refund_amount',coalesce(p_refund_amount,0));
end; $$;

CREATE OR REPLACE FUNCTION public.complete_customer_return(p_customer_return_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 update public.customer_returns set status='completed',updated_at=now() where id=p_customer_return_id and status='approved';
 if not found then raise exception 'Customer return must be Approved before completion'; end if;
 perform public.record_audit_event('customer.return.completed','customer_return',p_customer_return_id,'{}'::jsonb,'application');
 return jsonb_build_object('customer_return_id',p_customer_return_id,'status','completed');
end; $$;

REVOKE ALL ON FUNCTION public.receive_customer_return(uuid,uuid,uuid,date,jsonb,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.inspect_customer_return(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.approve_customer_return(uuid,jsonb,numeric,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.complete_customer_return(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.receive_customer_return(uuid,uuid,uuid,date,jsonb,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.inspect_customer_return(uuid,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.approve_customer_return(uuid,jsonb,numeric,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.complete_customer_return(uuid) TO authenticated,service_role;
