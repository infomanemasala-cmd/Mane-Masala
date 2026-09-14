-- Mane Masala Business Management System
-- Foundation migration: audit logging only.
-- No business tables are introduced here.

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  source text not null default 'application',
  created_at timestamptz not null default now()
);

create index audit_logs_occurred_at_idx
  on public.audit_logs (occurred_at desc);

create index audit_logs_actor_user_id_idx
  on public.audit_logs (actor_user_id);

create index audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id);

alter table public.audit_logs enable row level security;

create function public.record_audit_event(
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_source text default 'application'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    source
  )
  values (
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_source, 'application')
  )
  returning id into v_id;

  return v_id;
end
$$;

revoke all on public.audit_logs from anon, authenticated;
revoke execute on function public.record_audit_event(text, text, text, jsonb, text) from public;
grant execute on function public.record_audit_event(text, text, text, jsonb, text) to authenticated;
