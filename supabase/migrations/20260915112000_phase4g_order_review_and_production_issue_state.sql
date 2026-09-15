alter table public.stock_reservations drop constraint if exists stock_reservations_status_check;
alter table public.stock_reservations add constraint stock_reservations_status_check check (status = any (array['active'::text,'issued'::text,'released'::text,'consumed'::text,'cancelled'::text]));

do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='start_production_batch' and pg_get_function_identity_arguments(p.oid)='p_production_batch_id uuid';
  if v_def is null then raise exception 'start_production_batch function not found'; end if;
  v_def := replace(v_def,
    'update public.production_batches set status=''in_progress'',updated_at=now() where id=p_production_batch_id;',
    'update public.production_batches set status=''in_progress'',updated_at=now() where id=p_production_batch_id; update public.stock_reservations set status=''issued'',updated_at=now() where production_batch_id=p_production_batch_id and status=''active'';');
  execute v_def;
end $$;

do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='complete_production' and pg_get_function_identity_arguments(p.oid)='p_production_batch_id uuid, p_consumptions jsonb, p_outputs jsonb';
  if v_def is null then raise exception 'complete_production function not found'; end if;
  v_def := replace(v_def,
    'where production_batch_id=p_production_batch_id and item_id=r.ingredient_item_id and status=''active'' order by reserved_at,id for update loop',
    'where production_batch_id=p_production_batch_id and item_id=r.ingredient_item_id and status in (''active'',''issued'') order by reserved_at,id for update loop');
  execute v_def;
end $$;