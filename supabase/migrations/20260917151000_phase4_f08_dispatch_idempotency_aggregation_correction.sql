-- F-08 correction: compare dispatch requests by aggregated order-line quantity,
-- because one dispatch line can be split across multiple FIFO inventory batches.
-- This follow-up only corrects the idempotency comparison introduced by the
-- combined F-03/F-08/F-10 migration.

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
   and (select jsonb_agg(jsonb_build_object('order_line_id',q.order_line_id,'quantity',q.quantity) order by q.order_line_id,q.quantity)
        from (select dl.order_line_id,sum(dl.quantity) quantity from public.dispatch_lines dl where dl.dispatch_id=d.id group by dl.order_line_id) q)=v_request_lines
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

REVOKE ALL ON FUNCTION public.dispatch_order(uuid,date,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dispatch_order(uuid,date,text,jsonb) TO authenticated,service_role;
