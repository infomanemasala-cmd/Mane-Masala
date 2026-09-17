-- MANE MASALA — Phase 4 Runtime Defect Correction Round 2
-- Scope: F-08 completed-dispatch idempotency ordering and D4 supplier-payment
-- SQL grouping correction only. No unrelated workflow or data changes.

-- F-08: identify an exact retry before rejecting an already-dispatched order.
-- Normal readiness validation remains unchanged for new/different requests.
CREATE OR REPLACE FUNCTION public.dispatch_order(p_order_id uuid,p_dispatch_date date,p_method text,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
declare v_user uuid:=auth.uid();v_dispatch_id uuid:=public.gen_random_uuid();r record;b record;res record;v_need numeric;v_take numeric;v_line_id uuid;v_order_status text;v_available numeric;v_other_reserved numeric;v_unreserved_remaining numeric;v_remaining numeric;v_method text;v_final_status text;v_request_lines jsonb;v_existing_dispatch_id uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 v_method:=case p_method when 'delivery' then 'own_delivery' when 'pickup' then 'customer_pickup' else p_method end;
 if v_method not in ('customer_pickup','own_delivery','courier','transport','other') then raise exception 'Invalid dispatch method'; end if;
 select status into v_order_status from public.orders where id=p_order_id for update;
 if v_order_status is null then raise exception 'Order not found'; end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'At least one dispatch line is required'; end if;
 select jsonb_agg(jsonb_build_object('order_line_id',x.order_line_id,'quantity',x.quantity) order by x.order_line_id,x.quantity) into v_request_lines from jsonb_to_recordset(p_lines) as x(order_line_id uuid,quantity numeric);
 select d.id into v_existing_dispatch_id
 from public.dispatches d
 where d.order_id=p_order_id and d.dispatch_date=p_dispatch_date and d.dispatch_method=v_method and d.status='dispatched'
   and (select jsonb_agg(jsonb_build_object('order_line_id',q.order_line_id,'quantity',q.quantity) order by q.order_line_id,q.quantity)
        from (select dl.order_line_id,sum(dl.quantity) quantity from public.dispatch_lines dl where dl.dispatch_id=d.id group by dl.order_line_id) q)=v_request_lines
 order by d.created_at,d.id limit 1;
 if v_existing_dispatch_id is not null then
   return jsonb_build_object('dispatch_id',v_existing_dispatch_id,'order_id',p_order_id,'status',v_order_status,'idempotent_retry',true);
 end if;
 if v_order_status not in ('confirmed','in_production','ready','partially_dispatched') then raise exception 'Order is not ready for dispatch'; end if;
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

-- D4: preserve the existing supplier payable model while avoiding aggregate
-- grouping of purchase-level columns. The purchase-level values are read from
-- one purchase row; line totals, adjustment totals and allocation totals are
-- scalar correlated aggregates. This matches v_supplier_outstanding.
CREATE OR REPLACE FUNCTION public.record_supplier_payment(p_supplier_id uuid,p_amount numeric,p_payment_date date,p_method text,p_purchase_id uuid default null,p_upi_reference text default null,p_notes text default null)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
declare v_user uuid:=auth.uid();v_payment_id uuid:=public.gen_random_uuid();v_due numeric;v_alloc numeric;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_amount<=0 then raise exception 'Payment amount must be positive'; end if;
 insert into public.supplier_payments(id,supplier_id,payment_date,amount,payment_method,upi_reference,notes,created_by) values(v_payment_id,p_supplier_id,p_payment_date,p_amount,p_method,p_upi_reference,p_notes,v_user);
 if p_purchase_id is not null then
  if not exists(select 1 from public.purchases pu where pu.id=p_purchase_id and pu.supplier_id=p_supplier_id) then raise exception 'Purchase not found for selected supplier'; end if;
  select greatest(0,
    coalesce((select sum(coalesce(l.line_total,l.billed_quantity*coalesce(l.unit_rate,0))) from public.purchase_lines l where l.purchase_id=p.id),0)
    -coalesce(p.discount_amount,0)
    +coalesce(p.delivery_charge,0)+coalesce(p.transport_charge,0)+coalesce(p.loading_charge,0)+coalesce(p.unloading_charge,0)+coalesce(p.packing_charge,0)+coalesce(p.other_charge,0)+coalesce(p.tax_amount,0)
    -coalesce((select sum(sa.amount) from public.supplier_adjustments sa where sa.purchase_id=p.id and sa.adjustment_type in ('credit','refund')),0)
    -coalesce((select sum(spa.amount) from public.supplier_payment_allocations spa where spa.purchase_id=p.id),0)
  ) into v_due from public.purchases p where p.id=p_purchase_id;
  v_alloc:=least(p_amount,v_due);
  if v_alloc>0 then insert into public.supplier_payment_allocations(payment_id,purchase_id,amount) values(v_payment_id,p_purchase_id,v_alloc); end if;
  update public.purchases set financial_status=case when v_due-v_alloc<=0 then 'paid' else 'partially_paid' end,updated_at=now() where id=p_purchase_id;
 end if;
 perform public.record_audit_event('supplier.payment.recorded','supplier_payment',v_payment_id,jsonb_build_object('supplier_id',p_supplier_id,'purchase_id',p_purchase_id,'amount',p_amount,'allocated',coalesce(v_alloc,0)),'application');
 return jsonb_build_object('payment_id',v_payment_id,'allocated',coalesce(v_alloc,0));
end; $$;

CREATE OR REPLACE FUNCTION public.record_supplier_payment_allocated(p_supplier_id uuid,p_amount numeric,p_payment_date date,p_method text,p_allocations jsonb default '[]',p_upi_reference text default null,p_notes text default null)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
declare v_user uuid:=auth.uid();v_payment_id uuid:=public.gen_random_uuid();a jsonb;v_purchase_id uuid;v_req numeric;v_due numeric;v_alloc numeric;v_total numeric:=0;v_advance numeric:=0;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_supplier_id is null then raise exception 'Supplier is required'; end if;
 if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be positive'; end if;
 if jsonb_typeof(p_allocations)<>'array' then raise exception 'Allocations must be an array'; end if;
 insert into public.supplier_payments(id,supplier_id,payment_date,amount,payment_method,upi_reference,notes,created_by) values(v_payment_id,p_supplier_id,p_payment_date,p_amount,p_method,p_upi_reference,p_notes,v_user);
 for a in select value from jsonb_array_elements(p_allocations) loop
  v_purchase_id:=nullif(a->>'purchase_id','')::uuid;v_req:=(a->>'amount')::numeric;
  if v_purchase_id is null or v_req is null or v_req<=0 then raise exception 'Each payment allocation requires a valid purchase and positive amount'; end if;
  if not exists(select 1 from public.purchases pu where pu.id=v_purchase_id and pu.supplier_id=p_supplier_id) then raise exception 'Purchase not found for selected supplier'; end if;
  select greatest(0,
    coalesce((select sum(coalesce(l.line_total,l.billed_quantity*coalesce(l.unit_rate,0))) from public.purchase_lines l where l.purchase_id=p.id),0)
    -coalesce(p.discount_amount,0)
    +coalesce(p.delivery_charge,0)+coalesce(p.transport_charge,0)+coalesce(p.loading_charge,0)+coalesce(p.unloading_charge,0)+coalesce(p.packing_charge,0)+coalesce(p.other_charge,0)+coalesce(p.tax_amount,0)
    -coalesce((select sum(sa.amount) from public.supplier_adjustments sa where sa.purchase_id=p.id and sa.adjustment_type in ('credit','refund')),0)
    -coalesce((select sum(spa.amount) from public.supplier_payment_allocations spa where spa.purchase_id=p.id),0)
  ) into v_due from public.purchases p where p.id=v_purchase_id;
  v_alloc:=least(v_req,v_due,p_amount-v_total);
  if v_alloc>0 then insert into public.supplier_payment_allocations(payment_id,purchase_id,amount) values(v_payment_id,v_purchase_id,v_alloc);v_total:=v_total+v_alloc;update public.purchases set financial_status=case when v_due-v_alloc<=0 then 'paid' else 'partially_paid' end,updated_at=now() where id=v_purchase_id;end if;
 end loop;
 v_advance:=greatest(0,p_amount-v_total);
 if v_advance>0 then insert into public.supplier_advances(supplier_id,payment_id,amount,advance_date,status,notes) values(p_supplier_id,v_payment_id,v_advance,p_payment_date,'open',coalesce(p_notes,'Unallocated supplier payment'));end if;
 perform public.record_audit_event('supplier.payment.recorded','supplier_payment',v_payment_id,jsonb_build_object('supplier_id',p_supplier_id,'amount',p_amount,'allocated',v_total,'advance',v_advance),'application');
 return jsonb_build_object('payment_id',v_payment_id,'allocated',v_total,'advance',v_advance);
end; $$;

CREATE OR REPLACE FUNCTION public.record_supplier_payment_allocations(p_supplier_id uuid,p_amount numeric,p_payment_date date,p_method text,p_allocations jsonb default '[]',p_upi_reference text default null,p_notes text default null)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
declare v_user uuid:=auth.uid();v_payment_id uuid:=public.gen_random_uuid();v_remaining numeric:=p_amount;a record;v_due numeric;
begin
 if v_user is null then raise exception 'Authentication required'; end if;if p_amount<=0 then raise exception 'Payment amount must be positive'; end if;if jsonb_typeof(p_allocations)<>'array' then raise exception 'Payment allocations must be an array'; end if;
 insert into public.supplier_payments(id,supplier_id,payment_date,amount,payment_method,upi_reference,notes,created_by) values(v_payment_id,p_supplier_id,p_payment_date,p_amount,p_method,p_upi_reference,p_notes,v_user);
 for a in select * from jsonb_to_recordset(p_allocations) as x(purchase_id uuid,amount numeric) loop
  if a.amount<=0 then raise exception 'Allocation amount must be positive'; end if;
  select greatest(0,
    coalesce((select sum(coalesce(l.line_total,l.billed_quantity*coalesce(l.unit_rate,0))) from public.purchase_lines l where l.purchase_id=p.id),0)
    -coalesce(p.discount_amount,0)
    +coalesce(p.delivery_charge,0)+coalesce(p.transport_charge,0)+coalesce(p.loading_charge,0)+coalesce(p.unloading_charge,0)+coalesce(p.packing_charge,0)+coalesce(p.other_charge,0)+coalesce(p.tax_amount,0)
    -coalesce((select sum(sa.amount) from public.supplier_adjustments sa where sa.purchase_id=p.id and sa.adjustment_type in ('credit','refund')),0)
    -coalesce((select sum(spa.amount) from public.supplier_payment_allocations spa where spa.purchase_id=p.id),0)
  ) into v_due from public.purchases p where p.id=a.purchase_id and p.supplier_id=p_supplier_id;
  if v_due is null then raise exception 'Purchase % not found for supplier',a.purchase_id; end if;if a.amount>v_due then raise exception 'Allocation exceeds purchase outstanding for %',a.purchase_id; end if;if a.amount>v_remaining then raise exception 'Allocations exceed payment amount'; end if;
  insert into public.supplier_payment_allocations(payment_id,purchase_id,amount) values(v_payment_id,a.purchase_id,a.amount);v_remaining:=v_remaining-a.amount;
  update public.purchases set financial_status=case when v_due-a.amount<=0 then 'paid' else 'partially_paid' end,updated_at=now() where id=a.purchase_id;
 end loop;
 if v_remaining>0 then insert into public.supplier_advances(supplier_id,payment_id,amount,advance_date,status,notes) values(p_supplier_id,v_payment_id,v_remaining,p_payment_date,'open',p_notes);end if;
 perform public.record_audit_event('supplier.payment.recorded','supplier_payment',v_payment_id,jsonb_build_object('supplier_id',p_supplier_id,'amount',p_amount,'advance',v_remaining),'application');
 return jsonb_build_object('payment_id',v_payment_id,'allocated',p_amount-v_remaining,'advance',v_remaining);
end; $$;

revoke all on function public.dispatch_order(uuid,date,text,jsonb) from public,anon;
grant execute on function public.dispatch_order(uuid,date,text,jsonb) to authenticated,service_role;
revoke all on function public.record_supplier_payment(uuid,numeric,date,text,uuid,text,text) from public,anon;
grant execute on function public.record_supplier_payment(uuid,numeric,date,text,uuid,text,text) to authenticated,service_role;
revoke all on function public.record_supplier_payment_allocated(uuid,numeric,date,text,jsonb,text,text) from public,anon;
grant execute on function public.record_supplier_payment_allocated(uuid,numeric,date,text,jsonb,text,text) to authenticated,service_role;
revoke all on function public.record_supplier_payment_allocations(uuid,numeric,date,text,jsonb,text,text) from public,anon;
grant execute on function public.record_supplier_payment_allocations(uuid,numeric,date,text,jsonb,text,text) to authenticated,service_role;
