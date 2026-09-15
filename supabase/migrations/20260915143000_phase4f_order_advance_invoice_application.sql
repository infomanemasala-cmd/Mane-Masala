CREATE OR REPLACE FUNCTION public.create_order_entry_session(p_orders jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_order jsonb; v_line jsonb; v_order_id uuid; v_billing_customer_id uuid;
  v_item record; v_party text; v_source text; v_end_mode text; v_results jsonb:='[]'::jsonb;
  v_line_count integer; v_order_number integer:=0; v_advance numeric; v_payment_id uuid;
  v_advance_method text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
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
    v_advance:=greatest(coalesce((v_order->>'advance_amount')::numeric,0),0);
    v_advance_method:=coalesce(nullif(v_order->>'advance_payment_method',''),'other');
    if v_advance_method not in ('cash','upi','other') then raise exception 'Order %: invalid advance payment method.',v_order_number; end if;
    insert into public.orders(customer_id,order_party_type,sub_agent_id,end_customer_customer_id,end_customer_name,end_customer_phone,end_customer_is_anonymous,order_date,estimated_dispatch_date,source,status,advance_amount,requests,notes,created_by)
    values(v_billing_customer_id,v_party,case when v_party='sub_agent' then nullif(v_order->>'sub_agent_id','')::uuid else null end,case when v_party='sub_agent' and v_end_mode='existing' then nullif(v_order->>'end_customer_customer_id','')::uuid else null end,case when v_party='sub_agent' and v_end_mode='named' then nullif(trim(v_order->>'end_customer_name'),'') else null end,case when v_party='sub_agent' then nullif(trim(v_order->>'end_customer_phone'),'') else null end,case when v_party='sub_agent' then v_end_mode='anonymous' else false end,(v_order->>'order_date')::date,nullif(v_order->>'estimated_dispatch_date','')::date,v_source,'received',v_advance,nullif(trim(v_order->>'requests'),''),nullif(trim(v_order->>'notes'),''),auth.uid()) returning id into v_order_id;
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
    if v_advance>0 then
      v_payment_id:=gen_random_uuid();
      insert into public.customer_payments(id,customer_id,payment_date,amount,payment_method,notes,created_by) values(v_payment_id,v_billing_customer_id,(v_order->>'order_date')::date,v_advance,v_advance_method,'Order advance recorded at order entry',auth.uid());
      insert into public.customer_advances(customer_id,order_id,payment_id,amount,advance_date,status,notes) values(v_billing_customer_id,v_order_id,v_payment_id,v_advance,(v_order->>'order_date')::date,'open','Advance received against order');
      perform public.record_audit_event('customer.advance.recorded','customer_advance',v_payment_id,jsonb_build_object('order_id',v_order_id,'amount',v_advance),'application');
    end if;
    perform public.record_audit_event('created','order',v_order_id::text,jsonb_build_object('order_party_type',v_party,'source','order_entry_session','line_count',v_line_count,'advance',v_advance),'application');
    v_results:=v_results||jsonb_build_array(jsonb_build_object('order_id',v_order_id,'business_code',(select o.business_code from public.orders o where o.id=v_order_id),'advance',v_advance));
  end loop;
  return jsonb_build_object('orders',v_results,'count',v_order_number);
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_sale_invoice(p_dispatch_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare v_user uuid:=auth.uid(); v_sale_id uuid:=gen_random_uuid(); v_invoice_id uuid:=gen_random_uuid(); v_order_id uuid; v_customer_id uuid; r record; v_subtotal numeric:=0; v_total numeric:=0; v_advance numeric:=0; v_apply numeric:=0; v_adv record;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select order_id into v_order_id from public.dispatches where id=p_dispatch_id and status='dispatched';
  if v_order_id is null then raise exception 'Dispatch not found or not completed'; end if;
  if exists(select 1 from public.sales where dispatch_id=p_dispatch_id) then raise exception 'Sale already exists for dispatch'; end if;
  select customer_id into v_customer_id from public.orders where id=v_order_id;
  insert into public.sales(id,order_id,dispatch_id,customer_id,sale_date,created_by) values(v_sale_id,v_order_id,p_dispatch_id,v_customer_id,current_date,v_user);
  for r in select dl.id dispatch_line_id,dl.item_id,dl.quantity,dl.unit_id,ol.selling_rate,coalesce(ol.discount_amount,0) discount_amount,coalesce(ol.tax_amount,0) tax_amount from public.dispatch_lines dl join public.order_lines ol on ol.id=dl.order_line_id where dl.dispatch_id=p_dispatch_id loop
    insert into public.sale_lines(sale_id,dispatch_line_id,item_id,quantity,unit_id,selling_rate,discount_amount,tax_amount,line_total) values(v_sale_id,r.dispatch_line_id,r.item_id,r.quantity,r.unit_id,r.selling_rate,r.discount_amount,r.tax_amount,(r.quantity*r.selling_rate)-r.discount_amount+r.tax_amount);
    v_subtotal:=v_subtotal+(r.quantity*r.selling_rate); v_total:=v_total+((r.quantity*r.selling_rate)-r.discount_amount+r.tax_amount);
  end loop;
  select coalesce(sum(ca.amount),0) into v_advance from public.customer_advances ca where ca.order_id=v_order_id and ca.status in ('open','partially_applied');
  v_apply:=least(v_total,v_advance);
  update public.sales set subtotal=v_subtotal,total_amount=v_total,advance_applied=v_apply,amount_due=greatest(0,v_total-v_apply),status='approved',updated_at=now() where id=v_sale_id;
  insert into public.invoices(id,sale_id,invoice_date,billing_customer_id,subtotal,total_amount,advance_applied,amount_due,status,created_by) values(v_invoice_id,v_sale_id,current_date,v_customer_id,v_subtotal,v_total,v_apply,greatest(0,v_total-v_apply),case when greatest(0,v_total-v_apply)=0 then 'paid' else 'issued' end,v_user);
  for r in select sl.* from public.sale_lines sl where sl.sale_id=v_sale_id loop
    insert into public.invoice_lines(invoice_id,sale_line_id,item_id,quantity,unit_id,rate,discount_amount,tax_amount,line_total) values(v_invoice_id,r.id,r.item_id,r.quantity,r.unit_id,r.selling_rate,r.discount_amount,r.tax_amount,r.line_total);
  end loop;
  if v_apply>0 then
    for v_adv in select ca.id,ca.payment_id,ca.amount from public.customer_advances ca where ca.order_id=v_order_id and ca.status in ('open','partially_applied') and ca.amount>0 order by ca.advance_date,ca.created_at,ca.id for update loop
      exit when v_apply<=0;
      v_advance:=least(v_adv.amount,v_apply);
      insert into public.customer_payment_allocations(payment_id,invoice_id,amount) values(v_adv.payment_id,v_invoice_id,v_advance);
      if v_advance>=v_adv.amount then update public.customer_advances set amount=0,status='applied' where id=v_adv.id; else update public.customer_advances set amount=amount-v_advance,status='partially_applied' where id=v_adv.id; end if;
      v_apply:=v_apply-v_advance;
    end loop;
  end if;
  perform public.record_audit_event('sale.invoice.created','sale',v_sale_id,jsonb_build_object('invoice_id',v_invoice_id,'dispatch_id',p_dispatch_id,'advance_applied',least(v_total,v_advance)),'application');
  return jsonb_build_object('sale_id',v_sale_id,'invoice_id',v_invoice_id,'total_amount',v_total,'advance_applied',least(v_total,v_advance),'amount_due',greatest(0,v_total-least(v_total,v_advance)));
end;
$function$;
