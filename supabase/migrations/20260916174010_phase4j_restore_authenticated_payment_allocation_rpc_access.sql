alter function public.record_customer_payment_allocations(uuid,numeric,date,text,jsonb,text,text) security definer;
alter function public.record_supplier_payment_allocations(uuid,numeric,date,text,jsonb,text,text) security definer;
revoke all on function public.record_customer_payment_allocations(uuid,numeric,date,text,jsonb,text,text) from public;
revoke all on function public.record_supplier_payment_allocations(uuid,numeric,date,text,jsonb,text,text) from public;
grant execute on function public.record_customer_payment_allocations(uuid,numeric,date,text,jsonb,text,text) to authenticated,service_role;
grant execute on function public.record_supplier_payment_allocations(uuid,numeric,date,text,jsonb,text,text) to authenticated,service_role;
