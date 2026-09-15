-- Phase 4 backend security hardening.
-- Keep business RPCs available to authenticated application users only.
-- SECURITY DEFINER is retained only where required for internal code generation/audit.

alter view public.v_purchases_list set (security_invoker = true);

revoke all on function public.assign_category_business_code() from public, anon;
revoke all on function public.assign_customer_business_code() from public, anon;
revoke all on function public.assign_item_business_code() from public, anon;
revoke all on function public.assign_sub_agent_business_code() from public, anon;
revoke all on function public.assign_supplier_business_code() from public, anon;
revoke all on function public.assign_unit_business_code() from public, anon;

revoke all on function public.complete_purchase_inspection(uuid) from public, anon;
revoke all on function public.confirm_order(uuid) from public, anon;
revoke all on function public.create_purchase_entry(uuid,date,text,text,jsonb,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text) from public, anon;
revoke all on function public.dispatch_and_invoice_order(uuid,date,text,jsonb) from public, anon;
revoke all on function public.prepare_order_plan(uuid,jsonb) from public, anon;
revoke all on function public.record_customer_payment_allocated(uuid,numeric,date,text,jsonb,text,text) from public, anon;
revoke all on function public.record_customer_payment_allocations(uuid,numeric,date,text,jsonb,text,text) from public, anon;
revoke all on function public.record_supplier_payment_allocated(uuid,numeric,date,text,jsonb,text,text) from public, anon;
revoke all on function public.record_supplier_payment_allocations(uuid,numeric,date,text,jsonb,text,text) from public, anon;
revoke all on function public.start_production_batch(uuid) from public, anon;

-- Explicit authenticated grants make the intended API surface unambiguous.
grant execute on function public.complete_purchase_inspection(uuid) to authenticated;
grant execute on function public.confirm_order(uuid) to authenticated;
grant execute on function public.create_purchase_entry(uuid,date,text,text,jsonb,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text) to authenticated;
grant execute on function public.dispatch_and_invoice_order(uuid,date,text,jsonb) to authenticated;
grant execute on function public.prepare_order_plan(uuid,jsonb) to authenticated;
grant execute on function public.record_customer_payment_allocated(uuid,numeric,date,text,jsonb,text,text) to authenticated;
grant execute on function public.record_customer_payment_allocations(uuid,numeric,date,text,jsonb,text,text) to authenticated;
grant execute on function public.record_supplier_payment_allocated(uuid,numeric,date,text,jsonb,text,text) to authenticated;
grant execute on function public.record_supplier_payment_allocations(uuid,numeric,date,text,jsonb,text,text) to authenticated;
grant execute on function public.start_production_batch(uuid) to authenticated;

-- Internal audit and business-code functions remain non-public APIs.
revoke all on function public.generate_business_code(text) from public, anon, authenticated;
revoke all on function public.record_audit_event(text,text,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.record_audit_event(text,text,uuid,jsonb,text) from public, anon, authenticated;
