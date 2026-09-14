alter view public.v_inventory_current set (security_invoker = true);
alter view public.v_supplier_outstanding set (security_invoker = true);
alter view public.v_customer_outstanding set (security_invoker = true);

create or replace function public.record_audit_event(p_action text,p_entity_type text default null,p_entity_id text default null,p_metadata jsonb default '{}'::jsonb,p_source text default 'application') returns uuid language plpgsql security definer set search_path = '' as $$ declare v_id uuid; begin insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata,source) values(auth.uid(),p_action,p_entity_type,p_entity_id,coalesce(p_metadata,'{}'::jsonb),coalesce(p_source,'application')) returning id into v_id; return v_id; end; $$;
revoke all on function public.record_audit_event(text,text,text,jsonb,text) from public,anon;
grant execute on function public.record_audit_event(text,text,text,jsonb,text) to authenticated;
