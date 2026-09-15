-- Canonical payment allocation RPCs remain available to authenticated users.
grant execute on function public.record_customer_payment_allocated(uuid,numeric,date,text,jsonb,text,text) to authenticated;
grant execute on function public.record_supplier_payment_allocated(uuid,numeric,date,text,jsonb,text,text) to authenticated;
-- Retire legacy payment mutation entry points.
revoke execute on function public.record_customer_payment(uuid,numeric,date,text,uuid,text,text) from public,anon,authenticated;
revoke execute on function public.record_supplier_payment(uuid,numeric,date,text,uuid,text,text) from public,anon,authenticated;
revoke execute on function public.record_customer_payment_allocations(uuid,numeric,date,text,jsonb,text,text) from public,anon,authenticated;
revoke execute on function public.record_supplier_payment_allocations(uuid,numeric,date,text,jsonb,text,text) from public,anon,authenticated;