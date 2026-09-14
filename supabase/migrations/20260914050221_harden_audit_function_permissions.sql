-- Mane Masala Business Management System
-- Foundation migration: harden audit function permissions.
-- No business tables are introduced here.

revoke execute on function public.record_audit_event(text, text, text, jsonb, text) from public;
revoke execute on function public.record_audit_event(text, text, text, jsonb, text) from anon;
grant execute on function public.record_audit_event(text, text, text, jsonb, text) to authenticated;
