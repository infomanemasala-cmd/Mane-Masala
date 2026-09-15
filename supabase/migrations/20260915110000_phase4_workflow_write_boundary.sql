-- Phase 4: operational writes must flow through validated business RPCs.
-- RPCs are SECURITY DEFINER with empty search_path and explicit auth.uid() checks;
-- direct authenticated table writes are removed from operational tables.

alter function public.create_order_entry_session(jsonb) security definer;
alter function public.prepare_order_plan(uuid,jsonb) security definer;
alter function public.confirm_order(uuid) security definer;
alter function public.start_production_batch(uuid) security definer;
alter function public.complete_production(uuid,jsonb,jsonb) security definer;
alter function public.dispatch_order(uuid,date,text,jsonb) security definer;
alter function public.dispatch_and_invoice_order(uuid,date,text,jsonb) security definer;
alter function public.create_sale_invoice(uuid) security definer;
alter function public.create_purchase_entry(uuid,date,text,text,jsonb,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text) security definer;
alter function public.receive_purchase(uuid,jsonb,timestamptz) security definer;
alter function public.record_customer_payment(uuid,numeric,date,text,uuid,text,text) security definer;
alter function public.record_customer_payment_allocated(uuid,numeric,date,text,jsonb,text,text) security definer;
alter function public.record_supplier_payment(uuid,numeric,date,text,uuid,text,text) security definer;
alter function public.record_supplier_payment_allocated(uuid,numeric,date,text,jsonb,text,text) security definer;

-- Remove blanket authenticated ALL policies from workflow-owned tables.
do $$
declare t text;
begin
  foreach t in array array[
    'orders','order_lines','production_batches','stock_reservations',
    'dispatches','dispatch_lines','sales','sale_lines','invoices','invoice_lines',
    'purchases','purchase_lines','customer_payments','customer_payment_allocations',
    'supplier_payments','supplier_payment_allocations'
  ] loop
    execute format('drop policy if exists authenticated_manage on public.%I', t);
    execute format('create policy authenticated_read on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

-- Approval is an explicit business action, not a direct row update.
create or replace function public.approve_production_batch(p_production_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user uuid := auth.uid();
  v_status text;
  v_approval text;
  v_order_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select status, wife_approval_status, order_id
    into v_status, v_approval, v_order_id
  from public.production_batches
  where id = p_production_batch_id
  for update;
  if v_status is null then raise exception 'Production batch not found'; end if;
  if v_status <> 'planned' then raise exception 'Only Planned production batches can be approved'; end if;
  if v_approval = 'approved' then
    return jsonb_build_object('production_batch_id',p_production_batch_id,'status',v_status,'wife_approval_status','approved');
  end if;
  if v_approval <> 'pending' then raise exception 'Production batch is not awaiting approval'; end if;
  update public.production_batches
  set wife_approval_status='approved', wife_approved_by=v_user, wife_approved_at=now(), updated_at=now()
  where id=p_production_batch_id;
  perform public.record_audit_event('production.approved','production_batch',p_production_batch_id,jsonb_build_object('order_id',v_order_id),'application');
  return jsonb_build_object('production_batch_id',p_production_batch_id,'status','planned','wife_approval_status','approved');
end;
$$;

revoke all on function public.approve_production_batch(uuid) from public, anon;
grant execute on function public.approve_production_batch(uuid) to authenticated;
