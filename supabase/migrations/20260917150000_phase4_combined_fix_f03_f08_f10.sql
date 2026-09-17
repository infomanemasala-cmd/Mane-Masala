-- Phase 4 combined fixes: F-03 reservation lifecycle consistency,
-- F-08 dispatch retry idempotency, F-10 customer-return financial adjustment.
-- Scope deliberately excludes F-01/F-02/F-07 and all unrelated workflows.

-- F-03: reservation lifecycle uses active + issued consistently wherever
-- committed reservation stock must be considered or consumed/released.

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
  if exists(select 1 from public.stock_reservations where order_id=p_order_id and status in ('active','issued')) then raise exception 'This order already has active or issued reservations'; end if;
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

CREATE OR REPLACE FUNCTION public.dispatch_order(p_order_id uuid,p_dispatch_date date,p_method text,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
declare v_user uuid:=auth.uid();v_dispatch_id uuid:=public.gen_random_uuid();r record;b record;res record;v_need numeric;v_take numeric;v_line_id uuid;v_order_status text;v_available numeric;v_other_reserved numeric;v_unreserved_remaining numeric;v_remaining numeric;v_method text;v_final_status text;v_request_lines jsonb;v_existing_dispatch_id uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 v_method:=case p_method when 'delivery' then 'own_delivery' when 'pickup' then 'customer_pickup' else p_method end;
 if v_method not in ('customer_pickup','own_delivery','courier','transport','other') then raise exception 'Invalid dispatch method'; end if;
 select status into v_order_status from public.orders where id=p_order_id for update;
 if v_order_status is null then raise exception 'Order not found'; end if;
 if v_order_status not in ('confirmed','in_production','ready','partially_dispatched') then raise exception 'Order is not ready for dispatch'; end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'At least one dispatch line is required'; end if;
 select jsonb_agg(jsonb_build_object('order_line_id',x.order_line_id,'quantity',x.quantity) order by x.order_line_id,x.quantity) into v_request_lines from jsonb_to_recordset(p_lines) as x(order_line_id uuid,quantity numeric);
 select d.id into v_existing_dispatch_id
 from public.dispatches d
 where d.order_id=p_order_id and d.dispatch_date=p_dispatch_date and d.dispatch_method=v_method and d.status='dispatched'
   and (select jsonb_agg(jsonb_build_object('order_line_id',dl.order_line_id,'quantity',dl.quantity) order by dl.order_line_id,dl.quantity) from public.dispatch_lines dl where dl.dispatch_id=d.id)=v_request_lines
 order by d.created_at,d.id limit 1;
 if v_existing_dispatch_id is not null then
   return jsonb_build_object('dispatch_id',v_existing_dispatch_id,'order_id',p_order_id,'status',v_order_status,'idempotent_retry',true);
 end if;
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
  for res in select id,quantity_reserved from public.stock_reservations where order_line_id=r.order_line_id and status in ('active','issued') order by reserved_at,id for update loop
    exit when v_remaining<=0; v_take:=least(v_remaining,res.quantity_reserved);
    if v_take>=res.quantity_reserved then update public.stock_reservations set status='consumed',consumed_at=now(),updated_at=now() where id=res.id; else update public.stock_reservations set quantity_reserved=quantity_reserved-v_take,updated_at=now() where id=res.id; end if;
    v_remaining:=v_remaining-v_take;
  end loop;
  update public.order_lines set dispatched_quantity=coalesce(dispatched_quantity,0)+r.quantity,updated_at=now() where id=r.order_line_id;
 end loop;
 select case when not exists(select 1 from public.order_lines where order_id=p_order_id and coalesce(dispatched_quantity,0)<ordered_quantity) then 'dispatched' else 'partially_dispatched' end into v_final_status;
 update public.orders set status=v_final_status,updated_at=now() where id=p_order_id;
 perform public.record_audit_event('dispatch.completed','dispatch',v_dispatch_id,jsonb_build_object('order_id',p_order_id,'method',v_method,'order_status',v_final_status),'application');
 return jsonb_build_object('dispatch_id',v_dispatch_id,'order_id',p_order_id,'status',v_final_status,'idempotent_retry',false);
end; $$;

-- F-10: represent an approved customer-return refund in the existing financial
-- domain. One return can create at most one refund adjustment.
CREATE TABLE IF NOT EXISTS public.customer_adjustments (
  id uuid PRIMARY KEY DEFAULT public.gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  customer_return_id uuid NOT NULL UNIQUE REFERENCES public.customer_returns(id) ON DELETE RESTRICT,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE RESTRICT,
  adjustment_date date NOT NULL,
  adjustment_type text NOT NULL,
  amount numeric(20,2) NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_adjustments_type_chk CHECK (adjustment_type IN ('refund','credit','debit','other')),
  CONSTRAINT customer_adjustments_amount_chk CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS customer_adjustments_customer_date_idx ON public.customer_adjustments(customer_id,adjustment_date DESC);

CREATE OR REPLACE FUNCTION public.approve_customer_return(p_customer_return_id uuid,p_line_approvals jsonb,p_refund_amount numeric DEFAULT 0,p_notes text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
declare v_user uuid:=auth.uid();v_line jsonb;v_return_line record;v_approved numeric;v_batch_id uuid;v_count int:=0;v_total_saleable numeric:=0;v_return_date date;v_customer_id uuid;v_invoice_id uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if coalesce(p_refund_amount,0)<0 then raise exception 'Refund amount cannot be negative'; end if;
 if jsonb_typeof(p_line_approvals)<>'array' then raise exception 'Line approvals must be an array'; end if;
 select return_date,customer_id,invoice_id into v_return_date,v_customer_id,v_invoice_id from public.customer_returns where id=p_customer_return_id and status='inspected' for update;
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
 if coalesce(p_refund_amount,0)>0 then
   insert into public.customer_adjustments(customer_id,customer_return_id,invoice_id,adjustment_date,adjustment_type,amount,notes,created_by)
   values(v_customer_id,p_customer_return_id,v_invoice_id,coalesce(v_return_date,current_date),'refund',p_refund_amount,'Customer refund for approved return',v_user);
 end if;
 update public.customer_returns set status='approved',refund_amount=coalesce(p_refund_amount,0),notes=coalesce(p_notes,notes),updated_at=now() where id=p_customer_return_id;
 perform public.record_audit_event('customer.return.approved','customer_return',p_customer_return_id,jsonb_build_object('lines',v_count,'saleable_quantity',v_total_saleable,'refund_amount',coalesce(p_refund_amount,0),'financial_adjustment_created',coalesce(p_refund_amount,0)>0),'application');
 return jsonb_build_object('customer_return_id',p_customer_return_id,'status','approved','saleable_quantity',v_total_saleable,'refund_amount',coalesce(p_refund_amount,0));
end; $$;

REVOKE ALL ON FUNCTION public.prepare_order_plan(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.dispatch_order(uuid,date,text,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.approve_customer_return(uuid,jsonb,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prepare_order_plan(uuid,jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.dispatch_order(uuid,date,text,jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.approve_customer_return(uuid,jsonb,numeric,text) TO authenticated,service_role;
