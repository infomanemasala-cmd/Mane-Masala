-- Pack-aware create_order_entry_session
-- Accepts pack_qty; stores ordered_quantity in kg; normalizes pack rate to per-kg; snapshots pack_label.

create or replace function public.create_order_entry_session(p_orders jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order jsonb; v_line jsonb; v_order_id uuid; v_billing_customer_id uuid;
  v_item record; v_party text; v_source text; v_end_mode text; v_results jsonb:='[]'::jsonb;
  v_line_count integer; v_order_number integer:=0; v_advance numeric; v_payment_id uuid;
  v_advance_method text;
  v_pack_qty numeric; v_pack_size numeric; v_pack_label text; v_qty_kg numeric;
  v_rate numeric; v_rate_basis text; v_tax numeric; v_resolved numeric;
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
      select it.id, it.base_unit_id, it.can_be_sold, it.is_active,
             it.selling_pack_size_kg, it.selling_pack_label, it.selling_pack_type, it.default_selling_rate
        into v_item
        from public.items it where it.id=nullif(v_line->>'item_id','')::uuid;
      if not found or not v_item.is_active or not v_item.can_be_sold then raise exception 'Order % line %: selected item cannot be sold.',v_order_number,v_line_count; end if;

      v_pack_qty := nullif(v_line->>'pack_qty','')::numeric;
      v_pack_size := coalesce(nullif(v_line->>'pack_size_kg','')::numeric, v_item.selling_pack_size_kg);
      v_pack_label := coalesce(nullif(trim(v_line->>'pack_label'),''), v_item.selling_pack_label);
      if v_pack_label is null and coalesce(v_pack_size,0) > 0 then
        v_pack_label := trim(coalesce(v_item.selling_pack_type,'') || ' ' ||
          case when v_pack_size < 1 then (round(v_pack_size*1000)::text || ' g') else (v_pack_size::text || ' kg') end);
      end if;

      if coalesce(v_pack_qty,0) > 0 and coalesce(v_pack_size,0) > 0 then
        v_qty_kg := round(v_pack_qty * v_pack_size, 6);
        v_rate_basis := 'pack';
      else
        v_qty_kg := coalesce((v_line->>'ordered_quantity')::numeric, 0);
        v_pack_qty := null;
        v_pack_size := null;
        v_pack_label := null;
        v_rate_basis := 'kg';
      end if;
      if v_qty_kg <= 0 then raise exception 'Order % line %: quantity must be greater than zero.',v_order_number,v_line_count; end if;

      v_rate := nullif(v_line->>'selling_rate','')::numeric;
      if v_rate is null then
        v_resolved := public.resolve_item_selling_price(v_item.id, v_billing_customer_id);
        v_rate := coalesce(v_resolved, 0);
      elsif v_rate_basis = 'pack' and coalesce(v_pack_size,0) > 0 and coalesce((v_line->>'rate_is_per_pack')::boolean, true) then
        v_rate := round(v_rate / v_pack_size, 6);
      end if;
      if v_rate < 0 then raise exception 'Order % line %: selling rate cannot be negative.',v_order_number,v_line_count; end if;

      v_tax := greatest(coalesce((v_line->>'tax_rate')::numeric, 0), 0);

      insert into public.order_lines(
        order_id, item_id, ordered_quantity, unit_id, selling_rate,
        pack_qty, pack_size_kg, pack_label, rate_basis, tax_rate
      ) values (
        v_order_id, v_item.id, v_qty_kg, v_item.base_unit_id, v_rate,
        v_pack_qty, v_pack_size, v_pack_label, v_rate_basis, v_tax
      );
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

grant execute on function public.create_order_entry_session(jsonb) to authenticated;
