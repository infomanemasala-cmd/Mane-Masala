-- MANE MASALA — Phase 4 Runtime Defect Round 1 — D4
-- Authoritative supplier outstanding remains the existing model:
-- purchase payable - supplier credit/refund adjustments - payment allocations.
-- Purchase financial_status mirrors the resulting purchase balance.

create or replace function public.record_supplier_payment(p_supplier_id uuid,p_amount numeric,p_payment_date date,p_method text,p_purchase_id uuid default null,p_upi_reference text default null,p_notes text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid();v_payment_id uuid:=public.gen_random_uuid();v_due numeric;v_alloc numeric;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_amount<=0 then raise exception 'Payment amount must be positive'; end if;
 insert into public.supplier_payments(id,supplier_id,payment_date,amount,payment_method,upi_reference,notes,created_by) values(v_payment_id,p_supplier_id,p_payment_date,p_amount,p_method,p_upi_reference,p_notes,v_user);
 if p_purchase_id is not null then
  if not exists(select 1 from public.purchases pu where pu.id=p_purchase_id and pu.supplier_id=p_supplier_id) then raise exception 'Purchase not found for selected supplier'; end if;
  select greatest(0,coalesce(sum(coalesce(l.line_total,l.billed_quantity*coalesce(l.unit_rate,0))),0)-coalesce(p.discount_amount,0)+coalesce(p.delivery_charge,0)+coalesce(p.transport_charge,0)+coalesce(p.loading_charge,0)+coalesce(p.unloading_charge,0)+coalesce(p.packing_charge,0)+coalesce(p.other_charge,0)+coalesce(p.tax_amount,0)-coalesce((select sum(sa.amount) from public.supplier_adjustments sa where sa.purchase_id=p.id and sa.adjustment_type in ('credit','refund')),0)-coalesce((select sum(spa.amount) from public.supplier_payment_allocations spa where spa.purchase_id=p.id),0)) into v_due from public.purchase_lines l join public.purchases p on p.id=l.purchase_id where l.purchase_id=p_purchase_id;
  v_alloc:=least(p_amount,v_due);
  if v_alloc>0 then insert into public.supplier_payment_allocations(payment_id,purchase_id,amount) values(v_payment_id,p_purchase_id,v_alloc); end if;
  update public.purchases set financial_status=case when v_due-v_alloc<=0 then 'paid' else 'partially_paid' end,updated_at=now() where id=p_purchase_id;
 end if;
 perform public.record_audit_event('supplier.payment.recorded','supplier_payment',v_payment_id,jsonb_build_object('supplier_id',p_supplier_id,'purchase_id',p_purchase_id,'amount',p_amount,'allocated',coalesce(v_alloc,0)),'application');
 return jsonb_build_object('payment_id',v_payment_id,'allocated',coalesce(v_alloc,0));
end; $$;

create or replace function public.record_supplier_payment_allocated(p_supplier_id uuid,p_amount numeric,p_payment_date date,p_method text,p_allocations jsonb default '[]',p_upi_reference text default null,p_notes text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid();v_payment_id uuid:=public.gen_random_uuid();a jsonb;v_purchase_id uuid;v_req numeric;v_due numeric;v_alloc numeric;v_total numeric:=0;v_advance numeric:=0;
begin
 if v_user is null then raise exception 'Authentication required'; end if;if p_supplier_id is null then raise exception 'Supplier is required'; end if;if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be positive'; end if;if jsonb_typeof(p_allocations)<>'array' then raise exception 'Allocations must be an array'; end if;
 insert into public.supplier_payments(id,supplier_id,payment_date,amount,payment_method,upi_reference,notes,created_by) values(v_payment_id,p_supplier_id,p_payment_date,p_amount,p_method,p_upi_reference,p_notes,v_user);
 for a in select value from jsonb_array_elements(p_allocations) loop
  v_purchase_id:=nullif(a->>'purchase_id','')::uuid;v_req:=(a->>'amount')::numeric;
  if v_purchase_id is null or v_req is null or v_req<=0 then raise exception 'Each payment allocation requires a valid purchase and positive amount'; end if;
  if not exists(select 1 from public.purchases pu where pu.id=v_purchase_id and pu.supplier_id=p_supplier_id) then raise exception 'Purchase not found for selected supplier'; end if;
  select greatest(0,coalesce(sum(coalesce(l.line_total,l.billed_quantity*coalesce(l.unit_rate,0))),0)-coalesce(p.discount_amount,0)+coalesce(p.delivery_charge,0)+coalesce(p.transport_charge,0)+coalesce(p.loading_charge,0)+coalesce(p.unloading_charge,0)+coalesce(p.packing_charge,0)+coalesce(p.other_charge,0)+coalesce(p.tax_amount,0)-coalesce((select sum(sa.amount) from public.supplier_adjustments sa where sa.purchase_id=p.id and sa.adjustment_type in ('credit','refund')),0)-coalesce((select sum(spa.amount) from public.supplier_payment_allocations spa where spa.purchase_id=p.id),0)) into v_due from public.purchase_lines l join public.purchases p on p.id=l.purchase_id where l.purchase_id=v_purchase_id;
  v_alloc:=least(v_req,v_due,p_amount-v_total);
  if v_alloc>0 then insert into public.supplier_payment_allocations(payment_id,purchase_id,amount) values(v_payment_id,v_purchase_id,v_alloc);v_total:=v_total+v_alloc;update public.purchases set financial_status=case when v_due-v_alloc<=0 then 'paid' else 'partially_paid' end,updated_at=now() where id=v_purchase_id;end if;
 end loop;
 v_advance:=greatest(0,p_amount-v_total);if v_advance>0 then insert into public.supplier_advances(supplier_id,payment_id,amount,advance_date,status,notes) values(p_supplier_id,v_payment_id,v_advance,p_payment_date,'open',coalesce(p_notes,'Unallocated supplier payment'));end if;
 perform public.record_audit_event('supplier.payment.recorded','supplier_payment',v_payment_id,jsonb_build_object('supplier_id',p_supplier_id,'amount',p_amount,'allocated',v_total,'advance',v_advance),'application');
 return jsonb_build_object('payment_id',v_payment_id,'allocated',v_total,'advance',v_advance);
end; $$;

create or replace function public.record_supplier_payment_allocations(p_supplier_id uuid,p_amount numeric,p_payment_date date,p_method text,p_allocations jsonb default '[]',p_upi_reference text default null,p_notes text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid();v_payment_id uuid:=public.gen_random_uuid();v_remaining numeric:=p_amount;a record;v_due numeric;
begin
 if v_user is null then raise exception 'Authentication required'; end if;if p_amount<=0 then raise exception 'Payment amount must be positive'; end if;if jsonb_typeof(p_allocations)<>'array' then raise exception 'Payment allocations must be an array'; end if;
 insert into public.supplier_payments(id,supplier_id,payment_date,amount,payment_method,upi_reference,notes,created_by) values(v_payment_id,p_supplier_id,p_payment_date,p_amount,p_method,p_upi_reference,p_notes,v_user);
 for a in select * from jsonb_to_recordset(p_allocations) as x(purchase_id uuid,amount numeric) loop
  if a.amount<=0 then raise exception 'Allocation amount must be positive'; end if;
  select greatest(0,coalesce(sum(coalesce(l.line_total,l.billed_quantity*coalesce(l.unit_rate,0))),0)-coalesce(p.discount_amount,0)+coalesce(p.delivery_charge,0)+coalesce(p.transport_charge,0)+coalesce(p.loading_charge,0)+coalesce(p.unloading_charge,0)+coalesce(p.packing_charge,0)+coalesce(p.other_charge,0)+coalesce(p.tax_amount,0)-coalesce((select sum(sa.amount) from public.supplier_adjustments sa where sa.purchase_id=p.id and sa.adjustment_type in ('credit','refund')),0)-coalesce((select sum(spa.amount) from public.supplier_payment_allocations spa where spa.purchase_id=p.id),0)) into v_due from public.purchase_lines l join public.purchases p on p.id=l.purchase_id where l.purchase_id=a.purchase_id and p.supplier_id=p_supplier_id;
  if v_due is null then raise exception 'Purchase % not found for supplier',a.purchase_id; end if;if a.amount>v_due then raise exception 'Allocation exceeds purchase outstanding for %',a.purchase_id; end if;if a.amount>v_remaining then raise exception 'Allocations exceed payment amount'; end if;
  insert into public.supplier_payment_allocations(payment_id,purchase_id,amount) values(v_payment_id,a.purchase_id,a.amount);v_remaining:=v_remaining-a.amount;
  update public.purchases set financial_status=case when v_due-a.amount<=0 then 'paid' else 'partially_paid' end,updated_at=now() where id=a.purchase_id;
 end loop;
 if v_remaining>0 then insert into public.supplier_advances(supplier_id,payment_id,amount,advance_date,status,notes) values(p_supplier_id,v_payment_id,v_remaining,p_payment_date,'open',p_notes);end if;
 perform public.record_audit_event('supplier.payment.recorded','supplier_payment',v_payment_id,jsonb_build_object('supplier_id',p_supplier_id,'amount',p_amount,'advance',v_remaining),'application');
 return jsonb_build_object('payment_id',v_payment_id,'allocated',p_amount-v_remaining,'advance',v_remaining);
end; $$;

revoke all on function public.record_supplier_payment(uuid,numeric,date,text,uuid,text,text) from public,anon;
grant execute on function public.record_supplier_payment(uuid,numeric,date,text,uuid,text,text) to authenticated,service_role;
revoke all on function public.record_supplier_payment_allocated(uuid,numeric,date,text,jsonb,text,text) from public,anon;
grant execute on function public.record_supplier_payment_allocated(uuid,numeric,date,text,jsonb,text,text) to authenticated,service_role;
revoke all on function public.record_supplier_payment_allocations(uuid,numeric,date,text,jsonb,text,text) from public,anon;
grant execute on function public.record_supplier_payment_allocations(uuid,numeric,date,text,jsonb,text,text) to authenticated,service_role;
