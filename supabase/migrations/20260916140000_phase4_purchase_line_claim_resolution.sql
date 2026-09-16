alter table public.purchase_receipt_lines add column if not exists shortage_resolution text not null default 'not_applicable';
alter table public.purchase_receipt_lines add column if not exists rejection_resolution text not null default 'not_applicable';
alter table public.purchase_receipt_lines add column if not exists resolution_notes text;
alter table public.purchase_receipt_lines drop constraint if exists purchase_receipt_lines_shortage_resolution_chk;
alter table public.purchase_receipt_lines add constraint purchase_receipt_lines_shortage_resolution_chk check (shortage_resolution in ('not_applicable','pending','credit','replacement','not_honored'));
alter table public.purchase_receipt_lines drop constraint if exists purchase_receipt_lines_rejection_resolution_chk;
alter table public.purchase_receipt_lines add constraint purchase_receipt_lines_rejection_resolution_chk check (rejection_resolution in ('not_applicable','pending','credit','replacement','not_honored'));
alter table public.supplier_adjustments add column if not exists purchase_line_id uuid references public.purchase_lines(id);
create index if not exists supplier_adjustments_purchase_line_idx on public.supplier_adjustments(purchase_line_id);

-- create_purchase_entry: system_reference is generated from the system Purchase No.
create or replace function public.create_purchase_entry(p_supplier_id uuid,p_purchase_date date,p_supplier_invoice_number text,p_purchase_source text,p_lines jsonb,p_discount_amount numeric default 0,p_delivery_charge numeric default 0,p_transport_charge numeric default 0,p_loading_charge numeric default 0,p_unloading_charge numeric default 0,p_packing_charge numeric default 0,p_other_charge numeric default 0,p_tax_amount numeric default 0,p_notes text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid();v_purchase_id uuid;v_business_code text;v_line jsonb;v_item record;v_line_count int:=0;v_subtotal numeric:=0;v_total numeric:=0;v_rate numeric;v_qty numeric;v_line_total numeric;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 if p_supplier_id is null then raise exception 'Supplier is required';end if;
 if p_purchase_source not in ('whatsapp','phone','walk_in','online','other','delivery') then raise exception 'Invalid purchase source';end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'At least one purchase line is required';end if;
 insert into public.purchases(supplier_id,purchase_date,supplier_invoice_number,purchase_source,financial_status,workflow_status,discount_amount,delivery_charge,transport_charge,loading_charge,unloading_charge,packing_charge,other_charge,tax_amount,notes,created_by) values(p_supplier_id,p_purchase_date,nullif(trim(p_supplier_invoice_number),''),p_purchase_source,'unpaid','received',greatest(0,coalesce(p_discount_amount,0)),greatest(0,coalesce(p_delivery_charge,0)),greatest(0,coalesce(p_transport_charge,0)),greatest(0,coalesce(p_loading_charge,0)),greatest(0,coalesce(p_unloading_charge,0)),greatest(0,coalesce(p_packing_charge,0)),greatest(0,coalesce(p_other_charge,0)),greatest(0,coalesce(p_tax_amount,0)),nullif(trim(p_notes),''),v_user) returning id,business_code into v_purchase_id,v_business_code;
 update public.purchases set system_reference=coalesce(system_reference,v_business_code) where id=v_purchase_id;
 for v_line in select value from jsonb_array_elements(p_lines) loop
  v_line_count:=v_line_count+1;select it.id,it.base_unit_id,it.is_active into v_item from public.items it where it.id=nullif(v_line->>'item_id','')::uuid;
  if not found or not v_item.is_active then raise exception 'Purchase line %: selected item is not active',v_line_count;end if;
  v_qty:=coalesce((v_line->>'billed_quantity')::numeric,0);if v_qty<=0 then raise exception 'Purchase line %: quantity must be greater than zero',v_line_count;end if;
  if nullif(v_line->>'unit_rate','') is null then v_rate:=null;else v_rate:=(v_line->>'unit_rate')::numeric;if v_rate<0 then raise exception 'Purchase line %: rate cannot be negative',v_line_count;end if;end if;
  v_line_total:=case when v_rate is null then null else v_qty*v_rate end;
  insert into public.purchase_lines(purchase_id,item_id,billed_quantity,unit_id,unit_rate,line_total,discount_amount,tax_amount,notes) values(v_purchase_id,v_item.id,v_qty,v_item.base_unit_id,v_rate,v_line_total,greatest(0,coalesce((v_line->>'discount_amount')::numeric,0)),greatest(0,coalesce((v_line->>'tax_amount')::numeric,0)),nullif(trim(v_line->>'notes'),''));
  if v_line_total is not null then v_subtotal:=v_subtotal+v_line_total;v_total:=v_total+v_line_total-greatest(0,coalesce((v_line->>'discount_amount')::numeric,0))+greatest(0,coalesce((v_line->>'tax_amount')::numeric,0));end if;
 end loop;
 v_total:=greatest(0,v_total-greatest(0,coalesce(p_discount_amount,0))+greatest(0,coalesce(p_delivery_charge,0))+greatest(0,coalesce(p_transport_charge,0))+greatest(0,coalesce(p_loading_charge,0))+greatest(0,coalesce(p_unloading_charge,0))+greatest(0,coalesce(p_packing_charge,0))+greatest(0,coalesce(p_other_charge,0))+greatest(0,coalesce(p_tax_amount,0)));
 perform public.record_audit_event('purchase.created','purchase',v_purchase_id,jsonb_build_object('line_count',v_line_count,'subtotal',v_subtotal,'total',v_total,'system_reference',v_business_code),'application');
 return jsonb_build_object('purchase_id',v_purchase_id,'business_code',v_business_code,'system_reference',v_business_code,'line_count',v_line_count,'subtotal',v_subtotal,'total',v_total);
end;$$;

-- Final supplier response is recorded after inspection. Accepted claims create linked credit/refund adjustments; replacement and disputes do not reduce the original payable.
create or replace function public.finalize_purchase_review(p_purchase_id uuid,p_lines jsonb) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_user uuid:=auth.uid();v_purchase public.purchases%rowtype;v_receipt_id uuid;v_rl public.purchase_receipt_lines%rowtype;v_pl public.purchase_lines%rowtype;v_line jsonb;v_response text;v_settlement text;v_affected numeric;v_unit_value numeric;v_adjustment numeric;v_credit numeric:=0;v_refund numeric:=0;v_disputed numeric:=0;v_count int:=0;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 select * into v_purchase from public.purchases where id=p_purchase_id for update;if not found then raise exception 'Purchase not found';end if;
 select id into v_receipt_id from public.purchase_receipts where purchase_id=p_purchase_id and status in ('inspected_stock','inspected_invoice') order by received_at desc limit 1 for update;if v_receipt_id is null then raise exception 'Receive and inspect the purchase before reviewing supplier adjustments';end if;
 delete from public.supplier_adjustments where purchase_id=p_purchase_id and purchase_return_id is null and notes in ('Supplier credit for shortage','Supplier refund for shortage','Supplier credit for rejected / damaged goods','Supplier refund for rejected / damaged goods','Supplier credit for shortage / rejected goods','Supplier refund for shortage / rejected goods');
 for v_line in select * from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) loop
  select * into v_rl from public.purchase_receipt_lines where id=(v_line->>'receipt_line_id')::uuid and receipt_id=v_receipt_id for update;if not found then raise exception 'Receipt line not found';end if;
  select * into v_pl from public.purchase_lines where id=v_rl.purchase_line_id for update;
  v_affected:=greatest(0,v_pl.billed_quantity-v_rl.received_quantity)+greatest(0,v_rl.rejected_quantity);v_response:=coalesce(v_line->>'supplier_response','pending');v_settlement:=nullif(v_line->>'supplier_settlement','');
  if v_affected=0 then v_response:='not_required';v_settlement:=null;elsif v_response not in ('pending','accepted','refused') then raise exception 'Invalid supplier response';elsif v_response='accepted' and v_settlement not in ('credit','refund') then raise exception 'Choose credit or refund when supplier agrees to the claim';end if;
  v_unit_value:=case when v_pl.billed_quantity>0 then greatest(0,coalesce(v_pl.line_total,v_pl.billed_quantity*coalesce(v_pl.unit_rate,0)))/v_pl.billed_quantity else 0 end;v_adjustment:=round(v_affected*v_unit_value,2);
  update public.purchase_receipt_lines set supplier_response=v_response,supplier_settlement=v_settlement,supplier_adjustment_amount=case when v_response='accepted' then v_adjustment else 0 end,supplier_response_notes=nullif(trim(coalesce(v_line->>'supplier_response_notes','')),''),shortage_resolution=case when v_affected=0 then 'not_applicable' when v_response='accepted' then 'credit' when v_response='refused' then 'not_honored' else 'pending' end,rejection_resolution=case when v_affected=0 then 'not_applicable' when v_response='accepted' then 'credit' when v_response='refused' then 'not_honored' else 'pending' end,resolution_notes=nullif(trim(coalesce(v_line->>'supplier_response_notes','')),''),updated_at=now() where id=v_rl.id;
  if v_response='accepted' and v_settlement='credit' then v_credit:=v_credit+v_adjustment;insert into public.supplier_adjustments(id,business_code,supplier_id,purchase_id,purchase_line_id,adjustment_date,adjustment_type,amount,notes,created_by) values(public.gen_random_uuid(),null,v_purchase.supplier_id,p_purchase_id,v_pl.id,current_date,'credit',v_adjustment,'Supplier credit for shortage / rejected goods',v_user);
  elsif v_response='accepted' and v_settlement='refund' then v_refund:=v_refund+v_adjustment;insert into public.supplier_adjustments(id,business_code,supplier_id,purchase_id,purchase_line_id,adjustment_date,adjustment_type,amount,notes,created_by) values(public.gen_random_uuid(),null,v_purchase.supplier_id,p_purchase_id,v_pl.id,current_date,'refund',v_adjustment,'Supplier refund for shortage / rejected goods',v_user);
  elsif v_response in ('pending','refused') then v_disputed:=v_disputed+v_adjustment;end if;
  v_count:=v_count+1;
 end loop;
 update public.purchases set supplier_credit_amount=v_credit,supplier_refund_amount=v_refund,supplier_disputed_amount=v_disputed,workflow_status='completed',updated_at=now() where id=p_purchase_id;
 update public.purchase_receipts set status='inspected_invoice',updated_at=now() where id=v_receipt_id;
 perform public.record_audit_event('purchase.review.finalized','purchase',p_purchase_id,jsonb_build_object('receipt_id',v_receipt_id,'lines',v_count,'supplier_credit_amount',v_credit,'supplier_refund_amount',v_refund,'supplier_disputed_amount',v_disputed),'application');
 return jsonb_build_object('purchase_id',p_purchase_id,'supplier_credit_amount',v_credit,'supplier_refund_amount',v_refund,'supplier_disputed_amount',v_disputed,'status','completed');
end;$$;

create or replace view public.v_supplier_outstanding as
with purchase_totals as (
 select p.id purchase_id,p.supplier_id,greatest(0,coalesce(sum(coalesce(l.line_total,l.billed_quantity*coalesce(l.unit_rate,0))),0)-coalesce(p.discount_amount,0)+coalesce(p.delivery_charge,0)+coalesce(p.transport_charge,0)+coalesce(p.loading_charge,0)+coalesce(p.unloading_charge,0)+coalesce(p.packing_charge,0)+coalesce(p.other_charge,0)+coalesce(p.tax_amount,0)-coalesce(adj.credits,0)) payable,coalesce(pay.allocated,0) allocated
 from public.purchases p left join public.purchase_lines l on l.purchase_id=p.id left join (select purchase_id,sum(amount) credits from public.supplier_adjustments where adjustment_type in ('credit','refund') group by purchase_id) adj on adj.purchase_id=p.id left join (select purchase_id,sum(amount) allocated from public.supplier_payment_allocations group by purchase_id) pay on pay.purchase_id=p.id where p.workflow_status='completed'
 group by p.id,p.supplier_id,p.discount_amount,p.delivery_charge,p.transport_charge,p.loading_charge,p.unloading_charge,p.packing_charge,p.other_charge,p.tax_amount,adj.credits,pay.allocated)
select s.id supplier_id,s.business_code,s.business_name,coalesce(sum(greatest(0,pt.payable-pt.allocated)),0) outstanding from public.suppliers s left join purchase_totals pt on pt.supplier_id=s.id group by s.id,s.business_code,s.business_name;
