-- Phase 4 High Fix 2: controlled purchase-unit -> base-unit conversion.
-- Scope: purchase creation and receiving only. Historical purchase/receipt
-- quantities remain in their transaction unit; usable inventory is base-unit.

create or replace function public.purchase_to_base_factor(p_item_id uuid,p_unit_id uuid)
returns numeric language plpgsql security invoker set search_path = '' as $$
declare v_base_unit_id uuid; v_purchase_unit_id uuid; v_unit_base_id uuid; v_factor numeric;
begin
  select base_unit_id,purchase_unit_id into v_base_unit_id,v_purchase_unit_id from public.items where id=p_item_id and is_active=true;
  if v_base_unit_id is null then raise exception 'Item not found or base unit is missing'; end if;
  if p_unit_id is null then raise exception 'Purchase unit is required'; end if;
  if p_unit_id=v_base_unit_id then return 1; end if;
  if v_purchase_unit_id is null or p_unit_id<>v_purchase_unit_id then raise exception 'Purchase quantity unit must be the configured purchase unit or the item base unit'; end if;
  select base_unit_id,conversion_to_base into v_unit_base_id,v_factor from public.units where id=p_unit_id and is_active=true;
  if v_unit_base_id<>v_base_unit_id or v_factor is null or v_factor<=0 then raise exception 'Invalid purchase-unit conversion for item'; end if;
  return v_factor;
end; $$;

create or replace function public.create_purchase_entry(p_supplier_id uuid,p_purchase_date date,p_supplier_invoice_number text,p_purchase_source text,p_lines jsonb,p_discount_amount numeric default 0,p_delivery_charge numeric default 0,p_transport_charge numeric default 0,p_loading_charge numeric default 0,p_unloading_charge numeric default 0,p_packing_charge numeric default 0,p_other_charge numeric default 0,p_tax_amount numeric default 0,p_notes text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid();v_purchase_id uuid;v_business_code text;v_line jsonb;v_item record;v_line_count int:=0;v_subtotal numeric:=0;v_total numeric:=0;v_rate numeric;v_qty numeric;v_line_total numeric;v_unit_id uuid;v_factor numeric;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 if p_supplier_id is null then raise exception 'Supplier is required';end if;
 if p_purchase_source not in ('whatsapp','phone','walk_in','online','other','delivery') then raise exception 'Invalid purchase source';end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'At least one purchase line is required';end if;
 insert into public.purchases(supplier_id,purchase_date,supplier_invoice_number,purchase_source,financial_status,workflow_status,discount_amount,delivery_charge,transport_charge,loading_charge,unloading_charge,packing_charge,other_charge,tax_amount,notes,created_by) values(p_supplier_id,p_purchase_date,nullif(trim(p_supplier_invoice_number),''),p_purchase_source,'unpaid','received',greatest(0,coalesce(p_discount_amount,0)),greatest(0,coalesce(p_delivery_charge,0)),greatest(0,coalesce(p_transport_charge,0)),greatest(0,coalesce(p_loading_charge,0)),greatest(0,coalesce(p_unloading_charge,0)),greatest(0,coalesce(p_packing_charge,0)),greatest(0,coalesce(p_other_charge,0)),greatest(0,coalesce(p_tax_amount,0)),nullif(trim(p_notes),''),v_user) returning id,business_code into v_purchase_id,v_business_code;
 update public.purchases set system_reference=coalesce(system_reference,v_business_code) where id=v_purchase_id;
 for v_line in select value from jsonb_array_elements(p_lines) loop
  v_line_count:=v_line_count+1;
  select it.id,it.base_unit_id,it.purchase_unit_id,it.is_active into v_item from public.items it where it.id=nullif(v_line->>'item_id','')::uuid;
  if not found or not v_item.is_active then raise exception 'Purchase line %: selected item is not active',v_line_count;end if;
  v_qty:=coalesce((v_line->>'billed_quantity')::numeric,0);if v_qty<=0 then raise exception 'Purchase line %: quantity must be greater than zero',v_line_count;end if;
  v_unit_id:=coalesce(nullif(v_line->>'unit_id','')::uuid,v_item.purchase_unit_id,v_item.base_unit_id);
  v_factor:=public.purchase_to_base_factor(v_item.id,v_unit_id);
  if nullif(v_line->>'unit_rate','') is null then v_rate:=null;else v_rate:=(v_line->>'unit_rate')::numeric;if v_rate<0 then raise exception 'Purchase line %: rate cannot be negative',v_line_count;end if;end if;
  v_line_total:=case when v_rate is null then null else v_qty*v_rate end;
  insert into public.purchase_lines(purchase_id,item_id,billed_quantity,unit_id,unit_rate,line_total,discount_amount,tax_amount,notes) values(v_purchase_id,v_item.id,v_qty,v_unit_id,v_rate,v_line_total,greatest(0,coalesce((v_line->>'discount_amount')::numeric,0)),greatest(0,coalesce((v_line->>'tax_amount')::numeric,0)),nullif(trim(v_line->>'notes'),''));
  if v_line_total is not null then v_subtotal:=v_subtotal+v_line_total;v_total:=v_total+v_line_total-greatest(0,coalesce((v_line->>'discount_amount')::numeric,0))+greatest(0,coalesce((v_line->>'tax_amount')::numeric,0));end if;
 end loop;
 v_total:=greatest(0,v_total-greatest(0,coalesce(p_discount_amount,0))+greatest(0,coalesce(p_delivery_charge,0))+greatest(0,coalesce(p_transport_charge,0))+greatest(0,coalesce(p_loading_charge,0))+greatest(0,coalesce(p_unloading_charge,0))+greatest(0,coalesce(p_packing_charge,0))+greatest(0,coalesce(p_other_charge,0))+greatest(0,coalesce(p_tax_amount,0)));
 perform public.record_audit_event('purchase.created','purchase',v_purchase_id,jsonb_build_object('line_count',v_line_count,'subtotal',v_subtotal,'total',v_total,'system_reference',v_business_code),'application');
 return jsonb_build_object('purchase_id',v_purchase_id,'business_code',v_business_code,'system_reference',v_business_code,'line_count',v_line_count,'subtotal',v_subtotal,'total',v_total);
end; $$;

create or replace function public.receive_purchase(p_purchase_id uuid,p_lines jsonb,p_received_at timestamptz default now()) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_receipt_id uuid:=public.gen_random_uuid();v_user uuid:=auth.uid();v_line jsonb;v_purchase_line public.purchase_lines%rowtype;v_received numeric;v_accepted numeric;v_rejected numeric;v_replacement numeric;v_batch_id uuid;v_outcome text;v_count int:=0;v_workflow text;v_received_batch_date date;v_factor numeric;v_inventory_accepted numeric;v_base_unit_id uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select workflow_status into v_workflow from public.purchases where id=p_purchase_id for update;
 if v_workflow is null then raise exception 'Purchase not found'; end if;
 if exists(select 1 from public.purchase_receipts where purchase_id=p_purchase_id and status not in ('cancelled')) then raise exception 'Purchase already has a receipt'; end if;
 insert into public.purchase_receipts(id,purchase_id,received_at,received_by,status) values(v_receipt_id,p_purchase_id,coalesce(p_received_at,now()),v_user,'received');
 for v_line in select * from jsonb_array_elements(p_lines) loop
  select * into v_purchase_line from public.purchase_lines where id=(v_line->>'purchase_line_id')::uuid and purchase_id=p_purchase_id;
  if not found then raise exception 'Purchase line not found: %',v_line->>'purchase_line_id'; end if;
  select base_unit_id into v_base_unit_id from public.items where id=v_purchase_line.item_id and is_active=true;
  v_factor:=public.purchase_to_base_factor(v_purchase_line.item_id,v_purchase_line.unit_id);
  v_received:=greatest(0,coalesce((v_line->>'received_quantity')::numeric,0));
  v_accepted:=greatest(0,coalesce((v_line->>'accepted_quantity')::numeric,0));
  v_rejected:=greatest(0,coalesce((v_line->>'rejected_quantity')::numeric,v_received-v_accepted));
  v_replacement:=greatest(0,coalesce((v_line->>'replacement_quantity')::numeric,0));
  v_received_batch_date:=coalesce((v_line->>'received_batch_date')::date,coalesce(p_received_at,now())::date);
  if v_received<=0 then raise exception 'Received quantity must be greater than zero for purchase line %',v_purchase_line.id; end if;
  if v_received<v_accepted+v_rejected then raise exception 'Accepted + rejected exceeds received for purchase line %',v_purchase_line.id; end if;
  insert into public.purchase_receipt_lines(id,receipt_id,purchase_line_id,received_quantity,accepted_quantity,rejected_quantity,replacement_quantity,unit_id,received_batch_date,expiry_date,best_before_date,notes) values(public.gen_random_uuid(),v_receipt_id,v_purchase_line.id,v_received,v_accepted,v_rejected,v_replacement,v_purchase_line.unit_id,v_received_batch_date,(v_line->>'expiry_date')::date,(v_line->>'best_before_date')::date,v_line->>'notes');
  if v_accepted>0 then
   v_inventory_accepted:=v_accepted*v_factor;
   if v_inventory_accepted<=0 then raise exception 'Converted accepted quantity must be greater than zero'; end if;
   v_batch_id:=public.gen_random_uuid();
   insert into public.inventory_batches(id,item_id,source_type,source_id,source_line_id,batch_date,quantity_received,quantity_remaining,unit_id,unit_cost,expiry_date,best_before_date,status) values(v_batch_id,v_purchase_line.item_id,'purchase_receipt',v_receipt_id,v_purchase_line.id,v_received_batch_date,v_inventory_accepted,v_inventory_accepted,v_base_unit_id,case when v_factor=1 then v_purchase_line.unit_rate else v_purchase_line.unit_rate/v_factor end,(v_line->>'expiry_date')::date,(v_line->>'best_before_date')::date,'active');
   insert into public.inventory_transactions(item_id,batch_id,transaction_type,quantity,unit_id,occurred_at,reference_type,reference_id,reference_line_id,unit_cost,notes,created_by) values(v_purchase_line.item_id,v_batch_id,'purchase_receipt',v_inventory_accepted,v_base_unit_id,coalesce(p_received_at,now()),'purchase_receipt',v_receipt_id,v_purchase_line.id,case when v_factor=1 then v_purchase_line.unit_rate else v_purchase_line.unit_rate/v_factor end,'Accepted purchase receipt',v_user);
  end if;
  v_count:=v_count+1;v_outcome:=case when v_accepted=0 then 'returned' when v_accepted<v_received then 'partially_accepted' else 'accepted' end;
  insert into public.purchase_inspections(receipt_id,purchase_line_id,inspected_at,inspected_by,outcome,notes) values(v_receipt_id,v_purchase_line.id,coalesce(p_received_at,now()),v_user,v_outcome,v_line->>'inspection_notes');
 end loop;
 if v_count=0 then raise exception 'At least one receipt line is required'; end if;
 update public.purchase_receipts set status='inspected_stock' where id=v_receipt_id;
 update public.purchases set workflow_status='inspected_stock',updated_at=now() where id=p_purchase_id;
 perform public.record_audit_event('purchase.received','purchase',p_purchase_id,jsonb_build_object('receipt_id',v_receipt_id,'lines',v_count),'application');
 return jsonb_build_object('receipt_id',v_receipt_id,'purchase_id',p_purchase_id,'status','inspected_stock');
end; $$;

revoke all on function public.purchase_to_base_factor(uuid,uuid) from public,anon;
grant execute on function public.purchase_to_base_factor(uuid,uuid) to authenticated;
revoke all on function public.receive_purchase(uuid,jsonb,timestamptz) from public,anon;
grant execute on function public.receive_purchase(uuid,jsonb,timestamptz) to authenticated;
revoke all on function public.create_purchase_entry(uuid,date,text,text,jsonb,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.create_purchase_entry(uuid,date,text,text,jsonb,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text) to authenticated;
