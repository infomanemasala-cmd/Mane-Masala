-- Reconciles the Phase 4 runtime objects used by the current application.
-- Idempotent runtime layer for orders, inventory stock movements, operational list views,
-- and purchase attachments.

alter table public.orders
  add column if not exists order_party_type text not null default 'direct',
  add column if not exists sub_agent_id uuid references public.sub_agents(id),
  add column if not exists end_customer_customer_id uuid references public.customers(id),
  add column if not exists end_customer_name text,
  add column if not exists end_customer_phone text,
  add column if not exists end_customer_is_anonymous boolean not null default false;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='orders_order_party_type_check' and conrelid='public.orders'::regclass) then
    alter table public.orders add constraint orders_order_party_type_check check (order_party_type in ('direct','sub_agent'));
  end if;
end $$;

create index if not exists idx_orders_sub_agent_id on public.orders(sub_agent_id);
create index if not exists idx_orders_end_customer_customer_id on public.orders(end_customer_customer_id);
create index if not exists idx_orders_order_party_type on public.orders(order_party_type);

create or replace view public.v_purchases_list as
select p.id,p.business_code,p.purchase_date,p.entry_date,p.supplier_invoice_number,
       p.financial_status,p.workflow_status,p.purchase_source,
       s.business_code as supplier_code,s.business_name as supplier_name
from public.purchases p join public.suppliers s on s.id=p.supplier_id;

create or replace view public.v_orders_list as
select o.id,o.business_code,o.order_date,o.estimated_dispatch_date,o.source,o.status,
       o.order_party_type,o.advance_amount,
       c.business_code as billing_customer_code,c.name as billing_customer_name,
       sa.business_code as sub_agent_code,sa.name as sub_agent_name,
       case when o.end_customer_is_anonymous then 'Anonymous'
            when o.end_customer_customer_id is not null then ec.name
            when o.end_customer_name is not null then o.end_customer_name
            else null end as end_customer
from public.orders o join public.customers c on c.id=o.customer_id
left join public.sub_agents sa on sa.id=o.sub_agent_id
left join public.customers ec on ec.id=o.end_customer_customer_id;

create or replace view public.v_production_batches_list as
select pb.id,pb.business_code,pb.production_date,pb.planned_output_quantity,pb.actual_output_quantity,
       pb.status,pb.wife_approval_status,i.item_code as output_item_code,i.name as output_item_name
from public.production_batches pb join public.items i on i.id=pb.output_item_id;

create or replace function public.record_stock_out(p_item_id uuid,p_quantity numeric,p_unit_id uuid,p_stock_out_date date,p_reason text,p_notes text default null)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_stock_out_id uuid:=gen_random_uuid(); r record; v_need numeric:=p_quantity; v_take numeric;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_quantity is null or p_quantity<=0 then raise exception 'Stock-out quantity must be greater than zero'; end if;
 if p_reason is null or btrim(p_reason)='' then raise exception 'Stock-out reason is required'; end if;
 perform 1 from public.items where id=p_item_id and is_active=true; if not found then raise exception 'Item not found or inactive'; end if;
 insert into public.stock_outs(id,item_id,quantity,unit_id,stock_out_date,reason,notes,created_by) values(v_stock_out_id,p_item_id,p_quantity,p_unit_id,p_stock_out_date,p_reason,p_notes,v_user);
 for r in select id,quantity_remaining,unit_id,unit_cost from public.inventory_batches where item_id=p_item_id and status='active' and quantity_remaining>0 order by batch_date,created_at,id for update loop
   exit when v_need<=0; if r.unit_id<>p_unit_id then raise exception 'Unit mismatch for stock-out item'; end if; v_take:=least(v_need,r.quantity_remaining);
   update public.inventory_batches set quantity_remaining=quantity_remaining-v_take,status=case when quantity_remaining-v_take<=0 then 'depleted' else status end,updated_at=now() where id=r.id;
   insert into public.inventory_transactions(item_id,batch_id,transaction_type,quantity,unit_id,occurred_at,reference_type,reference_id,unit_cost,notes,created_by) values(p_item_id,r.id,'stock_out',-v_take,r.unit_id,p_stock_out_date,'stock_out',v_stock_out_id,r.unit_cost,'FIFO stock-out: '||p_reason,v_user);
   v_need:=v_need-v_take;
 end loop;
 if v_need>0 then raise exception 'Insufficient stock; short by %',v_need; end if;
 perform public.record_audit_event('stock_out.completed','stock_out',v_stock_out_id,jsonb_build_object('item_id',p_item_id,'quantity',p_quantity,'reason',p_reason),'application');
 return jsonb_build_object('stock_out_id',v_stock_out_id,'status','completed');
end;
$$;
grant execute on function public.record_stock_out(uuid,numeric,uuid,date,text,text) to authenticated;

create or replace function public.record_stock_adjustment(p_item_id uuid,p_quantity_delta numeric,p_unit_id uuid,p_adjustment_date date,p_reason text,p_notes text default null)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_adjustment_id uuid:=gen_random_uuid(); v_batch_id uuid; r record; v_need numeric:=abs(p_quantity_delta); v_take numeric;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_quantity_delta is null or p_quantity_delta=0 then raise exception 'Adjustment quantity must not be zero'; end if;
 if p_reason is null or btrim(p_reason)='' then raise exception 'Adjustment reason is required'; end if;
 perform 1 from public.items where id=p_item_id and is_active=true; if not found then raise exception 'Item not found or inactive'; end if;
 insert into public.stock_adjustments(id,item_id,quantity_delta,unit_id,adjustment_date,reason,notes,created_by) values(v_adjustment_id,p_item_id,p_quantity_delta,p_unit_id,p_adjustment_date,p_reason,p_notes,v_user);
 if p_quantity_delta>0 then
   v_batch_id:=gen_random_uuid();
   insert into public.inventory_batches(id,item_id,source_type,source_id,batch_date,quantity_received,quantity_remaining,unit_id,unit_cost,status,created_at,updated_at) values(v_batch_id,p_item_id,'stock_adjustment',v_adjustment_id,p_adjustment_date,p_quantity_delta,p_quantity_delta,p_unit_id,null,'active',now(),now());
   insert into public.inventory_transactions(item_id,batch_id,transaction_type,quantity,unit_id,occurred_at,reference_type,reference_id,unit_cost,notes,created_by) values(p_item_id,v_batch_id,'stock_adjustment',p_quantity_delta,p_unit_id,p_adjustment_date,'stock_adjustment',v_adjustment_id,null,'Positive stock adjustment: '||p_reason,v_user);
 else
   for r in select id,quantity_remaining,unit_id,unit_cost from public.inventory_batches where item_id=p_item_id and status='active' and quantity_remaining>0 order by batch_date,created_at,id for update loop
     exit when v_need<=0; if r.unit_id<>p_unit_id then raise exception 'Unit mismatch for stock adjustment'; end if; v_take:=least(v_need,r.quantity_remaining);
     update public.inventory_batches set quantity_remaining=quantity_remaining-v_take,status=case when quantity_remaining-v_take<=0 then 'depleted' else status end,updated_at=now() where id=r.id;
     insert into public.inventory_transactions(item_id,batch_id,transaction_type,quantity,unit_id,occurred_at,reference_type,reference_id,unit_cost,notes,created_by) values(p_item_id,r.id,'stock_adjustment',-v_take,r.unit_id,p_adjustment_date,'stock_adjustment',v_adjustment_id,r.unit_cost,'Negative stock adjustment: '||p_reason,v_user);
     v_need:=v_need-v_take;
   end loop;
   if v_need>0 then raise exception 'Insufficient stock; short by %',v_need; end if;
 end if;
 perform public.record_audit_event('stock_adjustment.completed','stock_adjustment',v_adjustment_id,jsonb_build_object('item_id',p_item_id,'quantity_delta',p_quantity_delta,'reason',p_reason),'application');
 return jsonb_build_object('stock_adjustment_id',v_adjustment_id,'status','completed');
end;
$$;
grant execute on function public.record_stock_adjustment(uuid,numeric,uuid,date,text,text) to authenticated;

create or replace function public.create_order_entry_session(p_orders jsonb)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_order jsonb; v_line jsonb; v_order_id uuid; v_billing_customer_id uuid; v_item record; v_party text; v_source text; v_end_mode text; v_results jsonb:='[]'::jsonb; v_line_count integer; v_order_number integer:=0;
begin
 if p_orders is null or jsonb_typeof(p_orders)<>'array' or jsonb_array_length(p_orders)=0 then raise exception 'At least one customer order is required.'; end if;
 for v_order in select value from jsonb_array_elements(p_orders) loop
   v_order_number:=v_order_number+1; v_party:=coalesce(v_order->>'order_party_type','direct'); v_source:=v_order->>'source';
   if v_party not in ('direct','sub_agent') then raise exception 'Order %: invalid order type.',v_order_number; end if;
   if v_source not in ('whatsapp','sms','phone','social_media','walk_in','online_marketplace') then raise exception 'Order %: invalid order source.',v_order_number; end if;
   if coalesce(v_order->>'order_date','')='' then raise exception 'Order %: order date is required.',v_order_number; end if;
   if jsonb_typeof(v_order->'lines')<>'array' or jsonb_array_length(v_order->'lines')=0 then raise exception 'Order %: at least one item line is required.',v_order_number; end if;
   if v_party='direct' then
     v_billing_customer_id:=nullif(v_order->>'customer_id','')::uuid;
     if v_billing_customer_id is null then raise exception 'Order %: billing customer is required.',v_order_number; end if;
     if not exists(select 1 from public.customers c where c.id=v_billing_customer_id and c.is_active) then raise exception 'Order %: selected billing customer is not active.',v_order_number; end if;
     v_end_mode:=null;
   else
     if nullif(v_order->>'sub_agent_id','') is null then raise exception 'Order %: Sub-Agent is required.',v_order_number; end if;
     select sa.customer_id into v_billing_customer_id from public.sub_agents sa where sa.id=nullif(v_order->>'sub_agent_id','')::uuid and sa.is_active;
     if v_billing_customer_id is null then raise exception 'Order %: selected Sub-Agent is not active or has no billing customer.',v_order_number; end if;
     v_end_mode:=case when coalesce((v_order->>'end_customer_is_anonymous')::boolean,false) then 'anonymous' when nullif(v_order->>'end_customer_customer_id','') is not null then 'existing' when length(trim(coalesce(v_order->>'end_customer_name','')))>0 then 'named' else 'anonymous' end;
     if v_end_mode='existing' and not exists(select 1 from public.customers c where c.id=nullif(v_order->>'end_customer_customer_id','')::uuid and c.is_active) then raise exception 'Order %: selected end customer is not active.',v_order_number; end if;
     if v_end_mode='named' and length(trim(coalesce(v_order->>'end_customer_name','')))=0 then raise exception 'Order %: named end customer is required.',v_order_number; end if;
   end if;
   insert into public.orders(customer_id,order_party_type,sub_agent_id,end_customer_customer_id,end_customer_name,end_customer_phone,end_customer_is_anonymous,order_date,estimated_dispatch_date,source,status,advance_amount,requests,notes,created_by)
   values(v_billing_customer_id,v_party,case when v_party='sub_agent' then nullif(v_order->>'sub_agent_id','')::uuid else null end,case when v_party='sub_agent' and v_end_mode='existing' then nullif(v_order->>'end_customer_customer_id','')::uuid else null end,case when v_party='sub_agent' and v_end_mode='named' then nullif(trim(v_order->>'end_customer_name'),'') else null end,case when v_party='sub_agent' then nullif(trim(v_order->>'end_customer_phone'),'') else null end,case when v_party='sub_agent' then v_end_mode='anonymous' else false end,(v_order->>'order_date')::date,nullif(v_order->>'estimated_dispatch_date','')::date,v_source,'received',greatest(coalesce((v_order->>'advance_amount')::numeric,0),0),nullif(trim(v_order->>'requests'),''),nullif(trim(v_order->>'notes'),''),auth.uid()) returning id into v_order_id;
   v_line_count:=0;
   for v_line in select value from jsonb_array_elements(v_order->'lines') loop
     v_line_count:=v_line_count+1;
     if nullif(v_line->>'item_id','') is null then raise exception 'Order % line %: item is required.',v_order_number,v_line_count; end if;
     select it.id,it.base_unit_id,it.can_be_sold,it.is_active into v_item from public.items it where it.id=nullif(v_line->>'item_id','')::uuid;
     if not found or not v_item.is_active or not v_item.can_be_sold then raise exception 'Order % line %: selected item cannot be sold.',v_order_number,v_line_count; end if;
     if coalesce((v_line->>'ordered_quantity')::numeric,0)<=0 then raise exception 'Order % line %: quantity must be greater than zero.',v_order_number,v_line_count; end if;
     if coalesce((v_line->>'selling_rate')::numeric,0)<0 then raise exception 'Order % line %: selling rate cannot be negative.',v_order_number,v_line_count; end if;
     insert into public.order_lines(order_id,item_id,ordered_quantity,unit_id,selling_rate) values(v_order_id,v_item.id,(v_line->>'ordered_quantity')::numeric,v_item.base_unit_id,coalesce((v_line->>'selling_rate')::numeric,0));
   end loop;
   perform public.record_audit_event('created','order',v_order_id::text,jsonb_build_object('order_party_type',v_party,'source','order_entry_session','line_count',v_line_count),'application');
   v_results:=v_results||jsonb_build_array(jsonb_build_object('order_id',v_order_id,'business_code',(select o.business_code from public.orders o where o.id=v_order_id)));
 end loop;
 return jsonb_build_object('orders',v_results,'count',v_order_number);
end;
$$;
grant execute on function public.create_order_entry_session(jsonb) to authenticated;

insert into storage.buckets(id,name,public) values('purchase-attachments','purchase-attachments',false) on conflict(id) do update set public=false;

do $$ begin
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='authenticated can upload purchase attachments') then create policy "authenticated can upload purchase attachments" on storage.objects for insert to authenticated with check(bucket_id='purchase-attachments'); end if;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='authenticated can read purchase attachments') then create policy "authenticated can read purchase attachments" on storage.objects for select to authenticated using(bucket_id='purchase-attachments'); end if;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='authenticated can update purchase attachments') then create policy "authenticated can update purchase attachments" on storage.objects for update to authenticated using(bucket_id='purchase-attachments') with check(bucket_id='purchase-attachments'); end if;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='authenticated can delete purchase attachments') then create policy "authenticated can delete purchase attachments" on storage.objects for delete to authenticated using(bucket_id='purchase-attachments'); end if;
end $$;