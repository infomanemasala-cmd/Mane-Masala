-- ONE-SHOT fix for the full purchase write path.
-- Root cause: purchases table allows authenticated SELECT only.
-- Writes must go through SECURITY DEFINER RPCs. Some were left as INVOKER
-- by later migrations, causing: permission denied for table purchases
-- on Receive and Complete.

-- 1) Ensure complete_purchase_inspection exists and is correct
create or replace function public.complete_purchase_inspection(p_purchase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_workflow text;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select workflow_status into v_workflow
  from public.purchases
  where id = p_purchase_id
  for update;

  if v_workflow is null then
    raise exception 'Purchase not found';
  end if;

  if v_workflow not in ('inspected_stock', 'inspected_invoice', 'partial_returned', 'returned') then
    raise exception 'Purchase cannot be completed from status %', v_workflow;
  end if;

  update public.purchases
  set workflow_status = 'completed',
      updated_at = now()
  where id = p_purchase_id;

  begin
    perform public.record_audit_event(
      'purchase.completed',
      'purchase',
      p_purchase_id::text,
      jsonb_build_object('status', 'completed'),
      'application'
    );
  exception when others then
    null;
  end;

  return jsonb_build_object('purchase_id', p_purchase_id, 'status', 'completed');
end;
$$;

-- 2) Force SECURITY DEFINER + execute grants on every purchase write RPC that exists
do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name,
           p.proname as func_name,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'receive_purchase',
        'complete_purchase_inspection',
        'finalize_purchase_review',
        'create_purchase_entry',
        'record_supplier_return',
        'record_supplier_payment',
        'record_supplier_payment_allocated'
      )
  loop
    execute format(
      'alter function %I.%I(%s) security definer',
      r.schema_name, r.func_name, r.args
    );
    execute format(
      'revoke all on function %I.%I(%s) from public, anon',
      r.schema_name, r.func_name, r.args
    );
    execute format(
      'grant execute on function %I.%I(%s) to authenticated, service_role',
      r.schema_name, r.func_name, r.args
    );
  end loop;
end;
$$;

-- 3) Keep receive_purchase definer (idempotent — body already on LIVE from prior fix)
alter function public.receive_purchase(uuid, jsonb, timestamptz) security definer;

-- 4) Verification helper (run manually if needed):
-- select proname, prosecdef
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and proname in ('receive_purchase','complete_purchase_inspection','finalize_purchase_review','create_purchase_entry','record_supplier_return');
