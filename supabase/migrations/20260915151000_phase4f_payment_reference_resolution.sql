CREATE SEQUENCE IF NOT EXISTS public.payment_auto_ref_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.payment_receipt_ref_seq START 1;
CREATE OR REPLACE FUNCTION public.resolve_unreferenced_payment(p_payment_side text,p_payment_id uuid,p_reference_type text,p_reference_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare v_user uuid:=auth.uid(); v_customer_id uuid; v_supplier_id uuid; v_amount numeric; v_allocated numeric; v_ref text; v_year text:=to_char(current_date,'YYYY'); v_need numeric; v_take numeric;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_payment_side not in ('customer','supplier') then raise exception 'Invalid payment side'; end if;
 if p_reference_type not in ('invoice','receipt','auto') then raise exception 'Invalid reference type'; end if;
 if exists(select 1 from public.payment_references where payment_id=p_payment_id and payment_side=p_payment_side) then raise exception 'This payment already has a reconciliation reference'; end if;
 if p_payment_side='customer' then
   select customer_id,amount into v_customer_id,v_amount from public.customer_payments where id=p_payment_id;
   if v_amount is null then raise exception 'Customer payment not found'; end if;
   select coalesce(sum(cpa.amount),0) into v_allocated from public.customer_payment_allocations cpa where cpa.payment_id=p_payment_id;
   v_need:=greatest(0,v_amount-v_allocated);
   if p_reference_type='invoice' then
     if p_reference_id is null then raise exception 'Invoice is required'; end if;
     select greatest(0,coalesce(i.amount_due,0)) into v_take from public.invoices i where i.id=p_reference_id and i.billing_customer_id=v_customer_id and i.status<>'cancelled';
     if v_take is null then raise exception 'Invoice not found for this customer'; end if;
     v_take:=least(v_need,v_take);
     if v_take<=0 then raise exception 'No unallocated payment amount or invoice balance remains'; end if;
     insert into public.customer_payment_allocations(payment_id,invoice_id,amount) values(p_payment_id,p_reference_id,v_take);
     update public.invoices set advance_applied=coalesce(advance_applied,0)+v_take,amount_due=greatest(0,coalesce(amount_due,0)-v_take),status=case when greatest(0,coalesce(amount_due,0)-v_take)=0 then 'paid' else 'partially_paid' end,updated_at=now() where id=p_reference_id;
     v_ref:=(select coalesce(invoice_number,business_code) from public.invoices where id=p_reference_id);
   elsif p_reference_type='receipt' then
     v_ref:='MM-RCP-'||v_year||'-'||lpad(nextval('public.payment_receipt_ref_seq')::text,6,'0');
   else
     v_ref:='MM-REF-'||v_year||'-'||lpad(nextval('public.payment_auto_ref_seq')::text,6,'0');
   end if;
 else
   select supplier_id,amount into v_supplier_id,v_amount from public.supplier_payments where id=p_payment_id;
   if v_amount is null then raise exception 'Supplier payment not found'; end if;
   select coalesce(sum(spa.amount),0) into v_allocated from public.supplier_payment_allocations spa where spa.payment_id=p_payment_id;
   v_need:=greatest(0,v_amount-v_allocated);
   if p_reference_type='invoice' then
     if p_reference_id is null then raise exception 'Purchase is required'; end if;
     select greatest(0,coalesce(sum(coalesce(pl.line_total,pl.billed_quantity*coalesce(pl.unit_rate,0))),0)-coalesce((select sum(spa2.amount) from public.supplier_payment_allocations spa2 where spa2.purchase_id=p_reference_id),0)) into v_take from public.purchase_lines pl where pl.purchase_id=p_reference_id and exists(select 1 from public.purchases pu where pu.id=p_reference_id and pu.supplier_id=v_supplier_id);
     if v_take is null then raise exception 'Purchase not found for this supplier'; end if;
     v_take:=least(v_need,v_take);
     if v_take<=0 then raise exception 'No unallocated payment amount or purchase balance remains'; end if;
     insert into public.supplier_payment_allocations(payment_id,purchase_id,amount) values(p_payment_id,p_reference_id,v_take);
     update public.purchases pu set financial_status=case when greatest(0,coalesce((select sum(coalesce(pl2.line_total,pl2.billed_quantity*coalesce(pl2.unit_rate,0))) from public.purchase_lines pl2 where pl2.purchase_id=pu.id),0)-coalesce((select sum(spa3.amount) from public.supplier_payment_allocations spa3 where spa3.purchase_id=pu.id),0))=0 then 'paid' else 'partially_paid' end,updated_at=now() where pu.id=p_reference_id;
     v_ref:=(select coalesce(supplier_invoice_number,business_code) from public.purchases where id=p_reference_id);
   elsif p_reference_type='receipt' then
     v_ref:='MM-RCP-'||v_year||'-'||lpad(nextval('public.payment_receipt_ref_seq')::text,6,'0');
   else
     v_ref:='MM-REF-'||v_year||'-'||lpad(nextval('public.payment_auto_ref_seq')::text,6,'0');
   end if;
 end if;
 insert into public.payment_references(payment_side,payment_id,reference_type,reference_id,reference_number,created_by) values(p_payment_side,p_payment_id,p_reference_type,p_reference_id,v_ref,v_user);
 perform public.record_audit_event('payment.reference.resolved','payment_reference',p_payment_id,jsonb_build_object('side',p_payment_side,'reference_type',p_reference_type,'reference_id',p_reference_id,'reference_number',v_ref),'application');
 return jsonb_build_object('payment_id',p_payment_id,'reference_type',p_reference_type,'reference_number',v_ref,'allocated',case when p_reference_type='invoice' then v_take else 0 end);
end;
$function$;
GRANT EXECUTE ON FUNCTION public.resolve_unreferenced_payment(text,uuid,text,uuid) TO authenticated;
