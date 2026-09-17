-- Phase 4 High Fix 1: FIFO receipt-date fidelity.
-- Scope: receive_purchase only. The physical received batch date stored on
-- purchase_receipt_lines is now the inventory FIFO batch_date.

create or replace function public.receive_purchase(p_purchase_id uuid,p_lines jsonb,p_received_at timestamptz default now()) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
 v_receipt_id uuid:=public.gen_random_uuid();
 v_user uuid:=auth.uid();
 v_line jsonb;
 v_purchase_line public.purchase_lines%rowtype;
 v_received numeric;
 v_accepted numeric;
 v_rejected numeric;
 v_replacement numeric;
 v_batch_id uuid;
 v_outcome text;
 v_count int:=0;
 v_workflow text;
 v_received_batch_date date;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select workflow_status into v_workflow from public.purchases where id=p_purchase_id for update;
 if v_workflow is null then raise exception 'Purchase not found'; end if;
 if exists(select 1 from public.purchase_receipts where purchase_id=p_purchase_id and status not in ('cancelled')) then raise exception 'Purchase already has a receipt'; end if;

 insert into public.purchase_receipts(id,purchase_id,received_at,received_by,status) values(v_receipt_id,p_purchase_id,coalesce(p_received_at,now()),v_user,'received');

 for v_line in select * from jsonb_array_elements(p_lines) loop
  select * into v_purchase_line from public.purchase_lines where id=(v_line->>'purchase_line_id')::uuid and purchase_id=p_purchase_id;
  if not found then raise exception 'Purchase line not found: %',v_line->>'purchase_line_id'; end if;

  v_received:=greatest(0,coalesce((v_line->>'received_quantity')::numeric,0));
  v_accepted:=greatest(0,coalesce((v_line->>'accepted_quantity')::numeric,0));
  v_rejected:=greatest(0,coalesce((v_line->>'rejected_quantity')::numeric,v_received-v_accepted));
  v_replacement:=greatest(0,coalesce((v_line->>'replacement_quantity')::numeric,0));
  v_received_batch_date:=coalesce((v_line->>'received_batch_date')::date,coalesce(p_received_at,now())::date);
  if v_received<=0 then raise exception 'Received quantity must be greater than zero for purchase line %',v_purchase_line.id; end if;
  if v_received<v_accepted+v_rejected then raise exception 'Accepted + rejected exceeds received for purchase line %',v_purchase_line.id; end if;

  insert into public.purchase_receipt_lines(id,receipt_id,purchase_line_id,received_quantity,accepted_quantity,rejected_quantity,replacement_quantity,unit_id,received_batch_date,expiry_date,best_before_date,notes)
  values(public.gen_random_uuid(),v_receipt_id,v_purchase_line.id,v_received,v_accepted,v_rejected,v_replacement,v_purchase_line.unit_id,v_received_batch_date,(v_line->>'expiry_date')::date,(v_line->>'best_before_date')::date,v_line->>'notes');

  if v_accepted>0 then
   v_batch_id:=public.gen_random_uuid();
   insert into public.inventory_batches(id,item_id,source_type,source_id,source_line_id,batch_date,quantity_received,quantity_remaining,unit_id,unit_cost,expiry_date,best_before_date,status)
   values(v_batch_id,v_purchase_line.item_id,'purchase_receipt',v_receipt_id,v_purchase_line.id,v_received_batch_date,v_accepted,v_accepted,v_purchase_line.unit_id,v_purchase_line.unit_rate,(v_line->>'expiry_date')::date,(v_line->>'best_before_date')::date,'active');
   insert into public.inventory_transactions(item_id,batch_id,transaction_type,quantity,unit_id,occurred_at,reference_type,reference_id,reference_line_id,unit_cost,notes,created_by)
   values(v_purchase_line.item_id,v_batch_id,'purchase_receipt',v_accepted,v_purchase_line.unit_id,coalesce(p_received_at,now()),'purchase_receipt',v_receipt_id,v_purchase_line.id,v_purchase_line.unit_rate,'Accepted purchase receipt',v_user);
  end if;

  v_count:=v_count+1;
  v_outcome:=case when v_accepted=0 then 'returned' when v_accepted<v_received then 'partially_accepted' else 'accepted' end;
  insert into public.purchase_inspections(receipt_id,purchase_line_id,inspected_at,inspected_by,outcome,notes)
  values(v_receipt_id,v_purchase_line.id,coalesce(p_received_at,now()),v_user,v_outcome,v_line->>'inspection_notes');
 end loop;

 if v_count=0 then raise exception 'At least one receipt line is required'; end if;
 update public.purchase_receipts set status='inspected_stock' where id=v_receipt_id;
 update public.purchases set workflow_status='inspected_stock',updated_at=now() where id=p_purchase_id;
 perform public.record_audit_event('purchase.received','purchase',p_purchase_id,jsonb_build_object('receipt_id',v_receipt_id,'lines',v_count),'application');
 return jsonb_build_object('receipt_id',v_receipt_id,'purchase_id',p_purchase_id,'status','inspected_stock');
end;
$$;

revoke all on function public.receive_purchase(uuid,jsonb,timestamptz) from public,anon;
grant execute on function public.receive_purchase(uuid,jsonb,timestamptz) to authenticated;
