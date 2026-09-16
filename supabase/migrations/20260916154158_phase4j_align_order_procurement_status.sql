do $$
declare
  src text;
begin
  select pg_get_functiondef(p.oid)
  into src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'prepare_order_plan'
    and pg_get_function_identity_arguments(p.oid) = 'p_order_id uuid, p_recipe_selections jsonb';

  if src is null then
    raise exception 'prepare_order_plan not found';
  end if;

  src := replace(
    src,
    'greatest(0,ing_need-ing_avail),rl.unit_id,''active''::text,''urgent''',
    'greatest(0,ing_need-ing_avail),rl.unit_id,''open''::text,''urgent'''
  );
  execute src;
end $$;
