create or replace function public.approve_production_batch(p_production_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_status text;
  v_approval text;
  v_order_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select status, wife_approval_status, order_id into v_status, v_approval, v_order_id
  from public.production_batches where id=p_production_batch_id for update;
  if v_status is null then raise exception 'Production batch not found'; end if;
  if v_status <> 'planned' then raise exception 'Only Planned production batches can be approved'; end if;
  if v_approval = 'approved' then return jsonb_build_object('production_batch_id',p_production_batch_id,'status',v_status,'wife_approval_status','approved'); end if;
  if v_approval <> 'pending' then raise exception 'Production batch is not awaiting approval'; end if;
  update public.production_batches set wife_approval_status='approved', approved_by=v_user, approved_at=now(), updated_at=now() where id=p_production_batch_id;
  perform public.record_audit_event('production.approved','production_batch',p_production_batch_id,jsonb_build_object('order_id',v_order_id),'application');
  return jsonb_build_object('production_batch_id',p_production_batch_id,'status','planned','wife_approval_status','approved');
end;
$function$;

create or replace function public.confirm_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_user uuid:=auth.uid();v_status text;v_line_count int;v_reserved numeric;v_required numeric;v_production_count int;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select status into v_status from public.orders where id=p_order_id for update;
 if v_status is null then raise exception 'Order not found'; end if;
 if v_status<>'production_planned' then raise exception 'Order must have its plan and inventory reservations prepared before confirmation'; end if;
 if exists(select 1 from public.order_lines where order_id=p_order_id and coalesce(reserved_quantity,0)>ordered_quantity) then raise exception 'Invalid reservation quantity'; end if;
 select count(*),coalesce(sum(ordered_quantity),0),coalesce(sum(reserved_quantity),0) into v_line_count,v_required,v_reserved from public.order_lines where order_id=p_order_id;
 select count(*) into v_production_count from public.production_batches where order_id=p_order_id and status<>'cancelled';
 if exists(select 1 from public.production_batches where order_id=p_order_id and status<>'cancelled' and wife_approval_status<>'approved') then raise exception 'Wife approval is required for every production plan before order confirmation'; end if;
 if exists(select 1 from public.order_lines ol where ol.order_id=p_order_id and coalesce(ol.reserved_quantity,0)<ol.ordered_quantity and not exists(select 1 from public.production_batches pb where pb.order_line_id=ol.id and pb.status<>'cancelled')) then raise exception 'Every stock shortfall must have a production plan'; end if;
 update public.orders set status='confirmed',confirmed_at=now(),confirmed_by=v_user,updated_at=now() where id=p_order_id;
 perform public.record_audit_event('order.confirmed','order',p_order_id,jsonb_build_object('line_count',v_line_count,'reserved',v_reserved,'required',v_required,'production_batches',v_production_count),'application');
 return jsonb_build_object('order_id',p_order_id,'status','confirmed','production_batches',v_production_count);
end;
$function$;

grant execute on function public.approve_production_batch(uuid) to authenticated;
grant execute on function public.confirm_order(uuid) to authenticated;
