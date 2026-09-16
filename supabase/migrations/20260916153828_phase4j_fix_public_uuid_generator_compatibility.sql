create or replace function public.gen_random_uuid()
returns uuid
language sql
immutable
security invoker
set search_path = pg_catalog, extensions
as $$
  select extensions.gen_random_uuid();
$$;

revoke all on function public.gen_random_uuid() from public;
grant execute on function public.gen_random_uuid() to authenticated, service_role;
