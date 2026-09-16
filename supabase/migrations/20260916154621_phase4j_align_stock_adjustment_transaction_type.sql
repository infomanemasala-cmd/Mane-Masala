do $$
declare
  src text;
begin
  select pg_get_functiondef(p.oid)
  into src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'record_stock_adjustment'
    and pg_get_function_identity_arguments(p.oid) = 'p_item_id uuid, p_quantity_delta numeric, p_unit_id uuid, p_adjustment_date date, p_reason text, p_notes text';

  if src is null then
    raise exception 'record_stock_adjustment not found';
  end if;

  src := replace(src, '''adjustment'',p_quantity_delta', '''stock_adjustment'',p_quantity_delta');
  execute src;
end $$;
