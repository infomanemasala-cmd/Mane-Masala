-- Phase 4A/4B combined backend integrity hardening.
-- Disable legacy mutation entry points so canonical workflows cannot be bypassed.
revoke execute on function public.confirm_order_reserve(uuid) from public, anon, authenticated;
revoke execute on function public.record_customer_payment(uuid,numeric,date,text,uuid,text,text) from public, anon, authenticated;
revoke execute on function public.record_customer_payment_allocated(uuid,numeric,date,text,jsonb,text,text) from public, anon, authenticated;
revoke execute on function public.record_customer_payment_allocations(uuid,numeric,date,text,jsonb,text,text) from public, anon, authenticated;
revoke execute on function public.record_supplier_payment(uuid,numeric,date,text,uuid,text,text) from public, anon, authenticated;
revoke execute on function public.record_supplier_payment_allocated(uuid,numeric,date,text,jsonb,text,text) from public, anon, authenticated;
revoke execute on function public.record_supplier_payment_allocations(uuid,numeric,date,text,jsonb,text,text) from public, anon, authenticated;
revoke execute on function public.record_stock_adjustment(uuid,numeric,uuid,date,text,text) from public, anon;
grant execute on function public.record_stock_adjustment(uuid,numeric,uuid,date,text,text) to authenticated;

-- Protect stock reserved for other orders/batches while consuming FIFO stock.
create or replace function public.dispatch_order(p_order_id uuid, p_dispatch_date date, p_method text, p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid();v_dispatch_id uuid:=gen_random_uuid();r record;b record;res record;v_need numeric;v_take numeric;v_line_id uuid;v_order_status text;v_available numeric;v_other_reserved numeric;v_unreserved_remaining numeric;v_remaining numeric;v_method text;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 v_method:=case p_method when 'delivery' then 'own_delivery' when 'pickup' then 'customer_pickup' else p_method end;
 if v_method not in ('customer_pickup','own_delivery','courier','transport','other') then raise exception 'Invalid dispatch method';end if;
 select status into v_order_status from public.orders where id=p_order_id for update;
 if v_order_status is null then raise exception 'Order not found';end if;
 if v_order_status not in ('confirmed','in_production','ready','partially_dispatched') then raise exception 'Order is not ready for dispatch';end if;
 insert into public.dispatches(id,order_id,dispatch_date,dispatch_method,status,created_by) values(v_dispatch_id,p_order_id,p_dispatch_date,v_method,'dispatched',v_user);
 for r in select * from jsonb_to_recordset(p_lines) as x(order_line_id uuid,quantity numeric) loop
  v_need:=r.quantity;if v_need<=0 then continue;end if;
  if not exists(select 1 from public.order_lines where id=r.order_line_id and order_id=p_order_id) then raise exception 'Order line does not belong to this order';end if;
  if v_need>(select ordered_quantity-coalesce(dispatched_quantity,0) from public.order_lines where id=r.order_line_id) then raise exception 'Dispatch quantity exceeds remaining order quantity';end if;
  select coalesce(sum(ib.quantity_remaining),0) into v_available from public.inventory_batches ib where ib.item_id=(select item_id from public.order_lines where id=r.order_line_id) and ib.status='active' and ib.quantity_remaining>0;
  select coalesce(sum(sr.quantity_reserved),0) into v_other_reserved from public.stock_reservations sr where sr.item_id=(select item_id from public.order_lines where id=r.order_line_id) and sr.status='active' and sr.order_id<>p_order_id;
  v_unreserved_remaining:=greatest(0,v_available-v_other_reserved);
  if v_need>v_unreserved_remaining then raise exception 'Insufficient available stock for order line %; requested %, available %',r.order_line_id,v_need,v_unreserved_remaining;end if;
  for b in select ib.id,ib.item_id,ib.quantity_remaining,ib.unit_id,ib.unit_cost from public.inventory_batches ib where ib.item_id=(select item_id from public.order_lines where id=r.order_line_id) and ib.status='active' and ib.quantity_remaining>0 order by ib.batch_date,ib.created_at,ib.id for update loop
   exit when v_need<=0 or v_unreserved_remaining<=0;
   v_take:=least(v_need,b.quantity_remaining,v_unreserved_remaining);
   v_line_id:=gen_random_uuid();
   insert into public.dispatch_lines(id,dispatch_id,order_line_id,item_id,quantity,unit_id,batch_id) values(v_line_id,v_dispatch_id,r.order_line_id,b.item_id,v_take,b.unit_id,b.id);
   update public.inventory_batches set quantity_remaining=quantity_remaining-v_take,status=case when quantity_remaining-v_take<=0 then 'depleted' else status end,updated_at=now() where id=b.id;
   insert into public.inventory_transactions(item_id,batch_id,transaction_type,quantity,unit_id,occurred_at,reference_type,reference_id,reference_line_id,unit_cost,notes,created_by) values(b.item_id,b.id,'dispatch',-v_take,b.unit_id,p_dispatch_date,'dispatch',v_dispatch_id,v_line_id,b.unit_cost,'FIFO dispatch',v_user);
   v_need:=v_need-v_take;v_unreserved_remaining:=v_unreserved_remaining-v_take;
  end loop;
  if v_need>0 then raise exception 'Insufficient stock after FIFO dispatch for order line %; short by %',r.order_line_id,v_need;end if;
  v_remaining:=r.quantity;
  for res in select id,quantity_reserved from public.stock_reservations where order_line_id=r.order_line_id and status='active' order by reserved_at,id for update loop
   exit when v_remaining<=0;v_take:=least(v_remaining,res.quantity_reserved);
   if v_take>=res.quantity_reserved then update public.stock_reservations set status='consumed',consumed_at=now(),updated_at=now() where id=res.id;else update public.stock_reservations set quantity_reserved=quantity_reserved-v_take,updated_at=now() where id=res.id;end if;
   v_remaining:=v_remaining-v_take;
  end loop;
  update public.order_lines set dispatched_quantity=coalesce(dispatched_quantity,0)+r.quantity,updated_at=now() where id=r.order_line_id;
 end loop;
 update public.orders set status=case when not exists(select 1 from public.order_lines where order_id=p_order_id and coalesce(dispatched_quantity,0)<ordered_quantity) then 'dispatched' else 'partially_dispatched' end,updated_at=now() where id=p_order_id;
 perform public.record_audit_event('dispatch.completed','dispatch',v_dispatch_id,jsonb_build_object('order_id',p_order_id,'method',v_method),'application');
 return jsonb_build_object('dispatch_id',v_dispatch_id,'order_id',p_order_id,'status','dispatched');
end;$$;

-- Protect stock reserved for other orders/batches during production FIFO consumption.
create or replace function public.complete_production(p_production_batch_id uuid, p_consumptions jsonb, p_outputs jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid();r record;b record;v_need numeric;v_take numeric;v_batch_id uuid;v_order_id uuid;v_order_line_id uuid;v_planned numeric;v_status text;v_approval text;v_available numeric;v_other_reserved numeric;v_unreserved_remaining numeric;v_consumed numeric;v_res record;v_output_item_id uuid;v_output_unit_id uuid;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 select status,wife_approval_status,order_id,order_line_id,output_item_id,output_unit_id into v_status,v_approval,v_order_id,v_order_line_id,v_output_item_id,v_output_unit_id from public.production_batches where id=p_production_batch_id for update;
 if v_status is null then raise exception 'Production batch not found';end if;
 if v_status='completed' then raise exception 'Production batch already completed';end if;
 if v_approval<>'approved' then raise exception 'Production batch not approved';end if;
 if v_status not in ('planned','in_progress') then raise exception 'Production batch cannot be completed from status %',v_status;end if;
 if jsonb_typeof(p_consumptions)<>'array' then raise exception 'Production consumptions must be an array';end if;
 if jsonb_typeof(p_outputs)<>'array' then raise exception 'Production outputs must be an array';end if;
 for r in select * from jsonb_to_recordset(p_consumptions) as x(ingredient_item_id uuid,actual_quantity numeric,unit_id uuid) loop
  v_need:=r.actual_quantity;if v_need is null or v_need<=0 then continue;end if;
  select coalesce(sum(ib.quantity_remaining),0) into v_available from public.inventory_batches ib where ib.item_id=r.ingredient_item_id and ib.status='active' and ib.quantity_remaining>0;
  select coalesce(sum(sr.quantity_reserved),0) into v_other_reserved from public.stock_reservations sr where sr.item_id=r.ingredient_item_id and sr.status='active' and sr.production_batch_id<>p_production_batch_id;
  v_unreserved_remaining:=greatest(0,v_available-v_other_reserved);
  if v_need>v_unreserved_remaining then raise exception 'Insufficient available ingredient stock for %; requested %, available %',r.ingredient_item_id,v_need,v_unreserved_remaining;end if;
  select coalesce(sum(pl.planned_quantity),0) into v_planned from public.production_batch_plan_lines pl where pl.production_batch_id=p_production_batch_id and pl.ingredient_item_id=r.ingredient_item_id;
  v_consumed:=0;
  for b in select ib.id,ib.quantity_remaining,ib.unit_id,ib.unit_cost from public.inventory_batches ib where ib.item_id=r.ingredient_item_id and ib.status='active' and ib.quantity_remaining>0 order by ib.batch_date,ib.created_at,ib.id for update loop
   exit when v_need<=0 or v_unreserved_remaining<=0;
   if b.unit_id<>r.unit_id then raise exception 'Unit mismatch for ingredient %',r.ingredient_item_id;end if;
   v_take:=least(v_need,b.quantity_remaining,v_unreserved_remaining);
   update public.inventory_batches set quantity_remaining=quantity_remaining-v_take,status=case when quantity_remaining-v_take<=0 then 'depleted' else status end,updated_at=now() where id=b.id;
   insert into public.inventory_transactions(item_id,batch_id,transaction_type,quantity,unit_id,occurred_at,reference_type,reference_id,unit_cost,notes,created_by) values(r.ingredient_item_id,b.id,'production_consumption',-v_take,r.unit_id,current_date,'production_batch',p_production_batch_id,b.unit_cost,'Production consumption',v_user);
   insert into public.production_consumption(production_batch_id,ingredient_item_id,planned_quantity,actual_quantity,unit_id,batch_id,consumption_date,one_time_variance,recipe_change_requested) values(p_production_batch_id,r.ingredient_item_id,nullif(v_planned,0),v_take,r.unit_id,b.id,current_date,(v_planned>0 and abs(v_take-v_planned)>0.000001),false);
   v_need:=v_need-v_take;v_consumed:=v_consumed+v_take;v_unreserved_remaining:=v_unreserved_remaining-v_take;
  end loop;
  if v_need>0 then raise exception 'Insufficient stock after FIFO consumption for ingredient %; short by %',r.ingredient_item_id,v_need;end if;
  for v_res in select id,quantity_reserved from public.stock_reservations where production_batch_id=p_production_batch_id and item_id=r.ingredient_item_id and status='active' order by reserved_at,id for update loop
   exit when v_consumed<=0;v_take:=least(v_consumed,v_res.quantity_reserved);
   if v_take>=v_res.quantity_reserved then update public.stock_reservations set status='consumed',consumed_at=now(),updated_at=now() where id=v_res.id;else update public.stock_reservations set quantity_reserved=quantity_reserved-v_take,updated_at=now() where id=v_res.id;end if;
   v_consumed:=v_consumed-v_take;
  end loop;
 end loop;
 update public.stock_reservations set status='released',updated_at=now() where production_batch_id=p_production_batch_id and status='active';
 for r in select * from jsonb_to_recordset(p_outputs) as x(output_item_id uuid,quantity numeric,unit_id uuid,unit_cost numeric) loop
  if r.quantity is null or r.quantity<=0 then continue;end if;
  if r.output_item_id<>v_output_item_id then raise exception 'Production output item must match the production batch output item';end if;
  if r.unit_id<>v_output_unit_id then raise exception 'Production output unit must match the production batch output unit';end if;
  v_batch_id:=gen_random_uuid();
  insert into public.inventory_batches(id,item_id,source_type,source_id,source_line_id,batch_date,quantity_received,quantity_remaining,unit_id,unit_cost,status) values(v_batch_id,r.output_item_id,'production_output',p_production_batch_id,v_order_line_id,current_date,r.quantity,r.quantity,r.unit_id,r.unit_cost,'active');
  insert into public.production_outputs(production_batch_id,output_item_id,quantity,unit_id,output_date,batch_id) values(p_production_batch_id,r.output_item_id,r.quantity,r.unit_id,current_date,v_batch_id);
  insert into public.inventory_transactions(item_id,batch_id,transaction_type,quantity,unit_id,occurred_at,reference_type,reference_id,unit_cost,notes,created_by) values(r.output_item_id,v_batch_id,'production_output',r.quantity,r.unit_id,current_date,'production_batch',p_production_batch_id,r.unit_cost,'Production output',v_user);
 end loop;
 update public.production_batches set status='completed',actual_output_quantity=coalesce((select sum(quantity) from public.production_outputs where production_batch_id=p_production_batch_id),0),updated_at=now() where id=p_production_batch_id;
 if v_order_line_id is not null then update public.order_lines set produced_quantity=coalesce(produced_quantity,0)+coalesce((select sum(quantity) from public.production_outputs where production_batch_id=p_production_batch_id),0),updated_at=now() where id=v_order_line_id;end if;
 if v_order_id is not null and not exists(select 1 from public.production_batches pb where pb.order_id=v_order_id and pb.status not in ('completed','cancelled')) and not exists(select 1 from public.order_lines ol where ol.order_id=v_order_id and coalesce(ol.reserved_quantity,0)+coalesce(ol.produced_quantity,0)<ol.ordered_quantity) then update public.orders set status='ready',updated_at=now() where id=v_order_id and status in ('confirmed','in_production');end if;
 perform public.record_audit_event('production.completed','production_batch',p_production_batch_id,jsonb_build_object('order_id',v_order_id,'order_line_id',v_order_line_id),'application');
 return jsonb_build_object('production_batch_id',p_production_batch_id,'status','completed');
end;$$;

-- Recipe output unit must match the order line unit before a production plan is created.
create or replace function public.prepare_order_plan(p_order_id uuid,p_recipe_selections jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid();v_status text;v_reserved numeric:=0;v_shortfall numeric:=0;v_plan_count int:=0;v_result jsonb:='[]'::jsonb;ol record;sel jsonb;rec record;rl record;pb_id uuid;avail numeric;reserve_qty numeric;plan_qty numeric;ing_need numeric;ing_avail numeric;ing_reserved numeric;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 select status into v_status from public.orders where id=p_order_id for update;
 if v_status is null then raise exception 'Order not found';end if;
 if v_status not in ('received','draft') then raise exception 'Order must be in Received status before planning';end if;
 if jsonb_typeof(p_recipe_selections)<>'array' then raise exception 'Recipe selections must be an array';end if;
 if exists(select 1 from public.production_batches pb where pb.order_id=p_order_id and pb.status not in ('completed','cancelled')) then raise exception 'This order already has an active production plan';end if;
 if exists(select 1 from public.stock_reservations sr where sr.order_id=p_order_id and sr.status='active') then raise exception 'This order already has active reservations';end if;
 for ol in select id,item_id,ordered_quantity,unit_id from public.order_lines where order_id=p_order_id order by id loop
  select greatest(0,coalesce(v.current_stock,0)-coalesce((select sum(r.quantity_reserved) from public.stock_reservations r where r.item_id=ol.item_id and r.status='active' and r.order_id<>p_order_id),0)) into avail from public.v_inventory_current v where v.item_id=ol.item_id;
  avail:=greatest(coalesce(avail,0),0);reserve_qty:=least(ol.ordered_quantity,avail);
  if reserve_qty>0 then insert into public.stock_reservations(order_id,order_line_id,item_id,quantity_reserved,unit_id,status,reserved_at,created_by) values(p_order_id,ol.id,ol.item_id,reserve_qty,ol.unit_id,'active',now(),v_user);update public.order_lines set reserved_quantity=reserve_qty,updated_at=now() where id=ol.id;v_reserved:=v_reserved+reserve_qty;else update public.order_lines set reserved_quantity=0,updated_at=now() where id=ol.id;end if;
  plan_qty:=ol.ordered_quantity-reserve_qty;
  if plan_qty>0 then
   v_shortfall:=v_shortfall+plan_qty;
   select value into sel from jsonb_array_elements(p_recipe_selections) where value->>'order_line_id'=ol.id::text limit 1;
   if sel is null or nullif(sel->>'recipe_version_id','') is null then raise exception 'Order line % needs production. Select a recipe version before planning.',ol.id;end if;
   select r.id recipe_id,r.output_item_id,rv.id recipe_version_id,rv.expected_output_quantity,rv.output_unit_id into rec from public.recipe_versions rv join public.recipes r on r.id=rv.recipe_id where rv.id=(sel->>'recipe_version_id')::uuid and rv.status='active' and r.status='active' and r.output_item_id=ol.item_id;
   if not found then raise exception 'Selected recipe version is not active or does not belong to the ordered item.';end if;
   if rec.output_unit_id<>ol.unit_id then raise exception 'Selected recipe output unit must match the order line unit.';end if;
   if rec.expected_output_quantity<=0 then raise exception 'Recipe expected output must be greater than zero.';end if;
   pb_id:=gen_random_uuid();
   insert into public.production_batches(id,order_id,order_line_id,recipe_version_id,output_item_id,planned_output_quantity,output_unit_id,production_date,status,wife_approval_status,created_by) values(pb_id,p_order_id,ol.id,rec.recipe_version_id,ol.item_id,plan_qty,ol.unit_id,current_date,'planned','pending',v_user);
   for rl in select id,ingredient_item_id,quantity,unit_id from public.recipe_lines where recipe_version_id=rec.recipe_version_id order by sequence_number,id loop
    ing_need:=rl.quantity*(plan_qty/rec.expected_output_quantity);
    insert into public.production_batch_plan_lines(production_batch_id,recipe_line_id,ingredient_item_id,planned_quantity,unit_id) values(pb_id,rl.id,rl.ingredient_item_id,ing_need,rl.unit_id);
    select greatest(0,coalesce(sum(b.quantity_remaining),0)-coalesce((select sum(sr.quantity_reserved) from public.stock_reservations sr where sr.item_id=rl.ingredient_item_id and sr.status='active'),0)) into ing_avail from public.inventory_batches b where b.item_id=rl.ingredient_item_id and b.status='active' and b.quantity_remaining>0;
    if ing_avail<ing_need then raise exception 'Insufficient ingredient stock for %; need %, available %',rl.ingredient_item_id,ing_need,ing_avail;end if;
    ing_reserved:=ing_need;
    insert into public.stock_reservations(order_id,item_id,quantity_reserved,unit_id,status,reserved_at,created_by,production_batch_id) values(p_order_id,rl.ingredient_item_id,ing_reserved,rl.unit_id,'active',now(),v_user,pb_id);
   end loop;
   v_plan_count:=v_plan_count+1;v_result:=v_result||jsonb_build_array(jsonb_build_object('order_line_id',ol.id,'production_batch_id',pb_id,'shortfall',plan_qty,'recipe_version_id',rec.recipe_version_id));
  end if;
 end loop;
 update public.orders set status='production_planned',updated_at=now() where id=p_order_id;
 perform public.record_audit_event('order.planned','order',p_order_id,jsonb_build_object('reserved',v_reserved,'shortfall',v_shortfall,'production_batches',v_plan_count),'application');
 return jsonb_build_object('order_id',p_order_id,'reserved',v_reserved,'shortfall',v_shortfall,'production_batches',v_plan_count,'status','production_planned','details',v_result);
end;$$;

-- Receipt validation: a single receipt cannot exceed its billed quantity.
create or replace function public.receive_purchase(p_purchase_id uuid,p_lines jsonb,p_received_at timestamptz default now())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_receipt_id uuid:=gen_random_uuid();v_user uuid:=auth.uid();v_line jsonb;v_purchase_line public.purchase_lines%rowtype;v_received numeric;v_accepted numeric;v_rejected numeric;v_replacement numeric;v_batch_id uuid;v_count int:=0;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 if not exists(select 1 from public.purchases where id=p_purchase_id) then raise exception 'Purchase not found';end if;
 if not exists(select 1 from public.purchases where id=p_purchase_id and workflow_status='received') then raise exception 'Purchase must be in Received status before physical receipt inspection';end if;
 if exists(select 1 from public.purchase_receipts where purchase_id=p_purchase_id and status<>'cancelled') then raise exception 'Purchase already has a receipt';end if;
 insert into public.purchase_receipts(id,purchase_id,received_at,received_by,status) values(v_receipt_id,p_purchase_id,p_received_at,v_user,'received');
 for v_line in select value from jsonb_array_elements(p_lines) loop
  select * into v_purchase_line from public.purchase_lines where id=(v_line->>'purchase_line_id')::uuid and purchase_id=p_purchase_id;if not found then raise exception 'Purchase line not found: %',v_line->>'purchase_line_id';end if;
  v_received:=greatest(0,coalesce((v_line->>'received_quantity')::numeric,0));v_accepted:=greatest(0,coalesce((v_line->>'accepted_quantity')::numeric,0));v_rejected:=greatest(0,coalesce((v_line->>'rejected_quantity')::numeric,0));v_replacement:=greatest(0,coalesce((v_line->>'replacement_quantity')::numeric,0));
  if v_received<=0 then raise exception 'Received quantity must be greater than zero for purchase line %',v_purchase_line.id;end if;
  if v_received>v_purchase_line.billed_quantity then raise exception 'Received quantity cannot exceed billed quantity for purchase line %',v_purchase_line.id;end if;
  if abs((v_accepted+v_rejected)-v_received)>0.000001 then raise exception 'Accepted + rejected must equal received for purchase line %',v_purchase_line.id;end if;
  insert into public.purchase_receipt_lines(receipt_id,purchase_line_id,received_quantity,accepted_quantity,rejected_quantity,replacement_quantity,unit_id,received_batch_date,expiry_date,best_before_date,notes) values(v_receipt_id,v_purchase_line.id,v_received,v_accepted,v_rejected,v_replacement,v_purchase_line.unit_id,coalesce((v_line->>'received_batch_date')::date,p_received_at::date),(v_line->>'expiry_date')::date,(v_line->>'best_before_date')::date,v_line->>'notes');
  if v_accepted>0 then v_batch_id:=gen_random_uuid();insert into public.inventory_batches(id,item_id,source_type,source_id,source_line_id,batch_date,quantity_received,quantity_remaining,unit_id,unit_cost,expiry_date,best_before_date,status) values(v_batch_id,v_purchase_line.item_id,'purchase_receipt',v_receipt_id,v_purchase_line.id,p_received_at::date,v_accepted,v_accepted,v_purchase_line.unit_id,v_purchase_line.unit_rate,(v_line->>'expiry_date')::date,(v_line->>'best_before_date')::date,'active');insert into public.inventory_transactions(item_id,batch_id,transaction_type,quantity,unit_id,occurred_at,reference_type,reference_id,reference_line_id,unit_cost,notes,created_by) values(v_purchase_line.item_id,v_batch_id,'purchase_receipt',v_accepted,v_purchase_line.unit_id,p_received_at,'purchase_receipt',v_receipt_id,v_purchase_line.id,v_purchase_line.unit_rate,'Accepted purchase receipt',v_user);end if;
  v_count:=v_count+1;insert into public.purchase_inspections(receipt_id,purchase_line_id,inspected_at,inspected_by,outcome,notes) values(v_receipt_id,v_purchase_line.id,p_received_at,v_user,case when v_accepted=0 then 'returned' when v_accepted<v_received then 'partially_accepted' else 'accepted' end,v_line->>'inspection_notes');
 end loop;if v_count=0 then raise exception 'At least one receipt line is required';end if;
 update public.purchase_receipts set status='inspected_stock',updated_at=now() where id=v_receipt_id;
 update public.purchases set workflow_status=case when exists(select 1 from public.purchase_receipt_lines prl join public.purchase_lines pl on pl.id=prl.purchase_line_id where prl.receipt_id=v_receipt_id and prl.accepted_quantity<pl.billed_quantity) then 'partial_returned' else 'inspected_stock' end,updated_at=now() where id=p_purchase_id;
 perform public.record_audit_event('purchase.received','purchase',p_purchase_id,jsonb_build_object('receipt_id',v_receipt_id,'lines',v_count),'application');
 return jsonb_build_object('receipt_id',v_receipt_id,'purchase_id',p_purchase_id,'status',(select workflow_status from public.purchases where id=p_purchase_id));
end;$$;