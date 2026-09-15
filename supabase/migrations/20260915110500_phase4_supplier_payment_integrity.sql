create or replace function public.record_supplier_payment(p_supplier_id uuid, p_amount numeric, p_payment_date date, p_method text, p_purchase_id uuid default null, p_upi_reference text default null, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_user uuid:=auth.uid(); v_payment_id uuid:=gen_random_uuid(); v_due numeric; v_alloc numeric;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_amount<=0 then raise exception 'Payment amount must be positive'; end if;
 insert into public.supplier_payments(id,supplier_id,payment_date,amount,payment_method,upi_reference,notes,created_by) values(v_payment_id,p_supplier_id,p_payment_date,p_amount,p_method,p_upi_reference,p_notes,v_user);
 if p_purchase_id is not null then
   if not exists(select 1 from public.purchases pu where pu.id=p_purchase_id and pu.supplier_id=p_supplier_id) then raise exception 'Purchase not found for selected supplier'; end if;
   select greatest(0,coalesce(sum(coalesce(l.line_total,l.billed_quantity*coalesce(l.unit_rate,0))),0)-coalesce((select sum(spa.amount) from public.supplier_payment_allocations spa where spa.purchase_id=p_purchase_id),0)) into v_due from public.purchase_lines l where l.purchase_id=p_purchase_id;
   v_alloc:=least(p_amount,v_due);
   if v_alloc>0 then insert into public.supplier_payment_allocations(payment_id,purchase_id,amount) values(v_payment_id,p_purchase_id,v_alloc); end if;
 end if;
 perform public.record_audit_event('supplier.payment.recorded','supplier_payment',v_payment_id,jsonb_build_object('supplier_id',p_supplier_id,'purchase_id',p_purchase_id,'amount',p_amount),'application');
 return jsonb_build_object('payment_id',v_payment_id,'allocated',coalesce(v_alloc,0));
end; $$;

create or replace function public.record_supplier_payment_allocated(p_supplier_id uuid, p_amount numeric, p_payment_date date, p_method text, p_allocations jsonb default '[]', p_upi_reference text default null, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_user uuid:=auth.uid();v_payment_id uuid:=gen_random_uuid();a jsonb;v_purchase_id uuid;v_req numeric;v_due numeric;v_alloc numeric;v_total numeric:=0;v_advance numeric:=0;
begin
 if v_user is null then raise exception 'Authentication required';end if;if p_amount<=0 then raise exception 'Payment amount must be positive';end if;if jsonb_typeof(p_allocations)<>'array' then raise exception 'Allocations must be an array';end if;
 insert into public.supplier_payments(id,supplier_id,payment_date,amount,payment_method,upi_reference,notes,created_by) values(v_payment_id,p_supplier_id,p_payment_date,p_amount,p_method,p_upi_reference,p_notes,v_user);
 for a in select value from jsonb_array_elements(p_allocations) loop
   v_purchase_id:=nullif(a->>'purchase_id','')::uuid;v_req:=coalesce((a->>'amount')::numeric,0);if v_req<=0 then continue;end if;
   if not exists(select 1 from public.purchases pu where pu.id=v_purchase_id and pu.supplier_id=p_supplier_id) then raise exception 'Purchase not found for selected supplier'; end if;
   select greatest(0,coalesce(sum(coalesce(l.line_total,l.billed_quantity*coalesce(l.unit_rate,0))),0)-coalesce((select sum(spa.amount) from public.supplier_payment_allocations spa where spa.purchase_id=v_purchase_id),0)) into v_due from public.purchase_lines l where l.purchase_id=v_purchase_id;
   v_alloc:=least(v_req,v_due,p_amount-v_total);if v_alloc>0 then insert into public.supplier_payment_allocations(payment_id,purchase_id,amount) values(v_payment_id,v_purchase_id,v_alloc);v_total:=v_total+v_alloc;end if;
 end loop;
 v_advance:=greatest(0,p_amount-v_total);if v_advance>0 then insert into public.supplier_advances(supplier_id,payment_id,amount,advance_date,status,notes) values(p_supplier_id,v_payment_id,v_advance,p_payment_date,'open',coalesce(p_notes,'Unallocated supplier payment'));end if;
 perform public.record_audit_event('supplier.payment.recorded','supplier_payment',v_payment_id,jsonb_build_object('supplier_id',p_supplier_id,'amount',p_amount,'allocated',v_total,'advance',v_advance),'application');return jsonb_build_object('payment_id',v_payment_id,'allocated',v_total,'advance',v_advance);
end; $$;