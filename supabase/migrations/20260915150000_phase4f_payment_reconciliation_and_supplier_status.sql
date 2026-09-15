CREATE TABLE IF NOT EXISTS public.payment_references (
  id uuid primary key default gen_random_uuid(),
  payment_side text not null check (payment_side in ('customer','supplier')),
  payment_id uuid not null,
  reference_type text not null check (reference_type in ('invoice','receipt','auto')),
  reference_id uuid null,
  reference_number text not null unique,
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS payment_references_payment_idx ON public.payment_references(payment_side,payment_id);
ALTER TABLE public.payment_references ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_read_only ON public.payment_references;
CREATE POLICY authenticated_read_only ON public.payment_references FOR SELECT TO authenticated USING (true);
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.payment_references FROM authenticated;
DROP FUNCTION IF EXISTS public.record_supplier_payment_allocated(uuid,numeric,date,text,jsonb,text,text);
CREATE OR REPLACE FUNCTION public.record_supplier_payment_allocated(p_supplier_id uuid, p_amount numeric, p_payment_date date, p_method text, p_allocations jsonb DEFAULT '[]'::jsonb, p_upi_reference text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare v_user uuid:=auth.uid();v_payment_id uuid:=gen_random_uuid();a jsonb;v_purchase_id uuid;v_req numeric;v_due numeric;v_alloc numeric;v_total numeric:=0;v_advance numeric:=0;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_supplier_id is null then raise exception 'Supplier is required'; end if;
 if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be positive'; end if;
 if jsonb_typeof(p_allocations)<>'array' then raise exception 'Allocations must be an array'; end if;
 insert into public.supplier_payments(id,supplier_id,payment_date,amount,payment_method,upi_reference,notes,created_by) values(v_payment_id,p_supplier_id,p_payment_date,p_amount,p_method,p_upi_reference,p_notes,v_user);
 for a in select value from jsonb_array_elements(p_allocations) loop
   v_purchase_id:=nullif(a->>'purchase_id','')::uuid; v_req:=(a->>'amount')::numeric;
   if v_purchase_id is null or v_req is null or v_req<=0 then raise exception 'Each payment allocation requires a valid purchase and positive amount'; end if;
   if not exists(select 1 from public.purchases pu where pu.id=v_purchase_id and pu.supplier_id=p_supplier_id) then raise exception 'Purchase not found for selected supplier'; end if;
   select greatest(0,coalesce(sum(coalesce(l.line_total,l.billed_quantity*coalesce(l.unit_rate,0))),0)-coalesce((select sum(spa.amount) from public.supplier_payment_allocations spa where spa.purchase_id=v_purchase_id),0)) into v_due from public.purchase_lines l where l.purchase_id=v_purchase_id;
   v_alloc:=least(v_req,v_due,p_amount-v_total);
   if v_alloc>0 then
     insert into public.supplier_payment_allocations(payment_id,purchase_id,amount) values(v_payment_id,v_purchase_id,v_alloc);
     v_total:=v_total+v_alloc;
     update public.purchases pu set financial_status=case when greatest(0,coalesce((select sum(coalesce(l2.line_total,l2.billed_quantity*coalesce(l2.unit_rate,0))) from public.purchase_lines l2 where l2.purchase_id=pu.id),0)-coalesce((select sum(spa2.amount) from public.supplier_payment_allocations spa2 where spa2.purchase_id=pu.id),0))=0 then 'paid' else 'partially_paid' end, updated_at=now() where pu.id=v_purchase_id;
   end if;
 end loop;
 v_advance:=greatest(0,p_amount-v_total);
 if v_advance>0 then insert into public.supplier_advances(supplier_id,payment_id,amount,advance_date,status,notes) values(p_supplier_id,v_payment_id,v_advance,p_payment_date,'open',coalesce(p_notes,'Unallocated supplier payment')); end if;
 perform public.record_audit_event('supplier.payment.recorded','supplier_payment',v_payment_id,jsonb_build_object('supplier_id',p_supplier_id,'amount',p_amount,'allocated',v_total,'advance',v_advance),'application');
 return jsonb_build_object('payment_id',v_payment_id,'allocated',v_total,'advance',v_advance);
end;
$function$;
GRANT EXECUTE ON FUNCTION public.record_supplier_payment_allocated(uuid,numeric,date,text,jsonb,text,text) TO authenticated;
