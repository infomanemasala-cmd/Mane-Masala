create or replace function public.set_order_estimated_dispatch_date(p_order_id uuid, p_estimated_dispatch_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_order_date date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_order_id is null then
    raise exception 'Order is required';
  end if;
  if p_estimated_dispatch_date is null then
    raise exception 'Estimated dispatch date is required';
  end if;

  select status, order_date into v_status, v_order_date
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;
  if v_status in ('cancelled','dispatched','closed') then
    raise exception 'Estimated dispatch date cannot be changed for an order in status %', v_status;
  end if;
  if p_estimated_dispatch_date < v_order_date then
    raise exception 'Estimated dispatch date cannot be before the order date';
  end if;

  update public.orders
  set estimated_dispatch_date = p_estimated_dispatch_date,
      updated_at = now()
  where id = p_order_id;

  return jsonb_build_object('order_id', p_order_id, 'estimated_dispatch_date', p_estimated_dispatch_date);
end;
$$;

revoke all on function public.set_order_estimated_dispatch_date(uuid,date) from public;
revoke all on function public.set_order_estimated_dispatch_date(uuid,date) from anon;
grant execute on function public.set_order_estimated_dispatch_date(uuid,date) to authenticated;
