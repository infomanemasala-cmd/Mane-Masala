-- Pack-aware create_sale_invoice: carry pack snapshot; totals always qty_kg * rate_per_kg
create or replace function public.create_sale_invoice(p_dispatch_id uuid)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_user uuid:=auth.uid(); v_sale_id uuid:=gen_random_uuid(); v_invoice_id uuid:=gen_random_uuid();
  v_order_id uuid; v_customer_id uuid; r record;
  v_subtotal numeric:=0; v_total numeric:=0; v_advance numeric:=0; v_apply numeric:=0; v_adv record;
  v_line_total numeric; v_tax_amt numeric; v_pack_qty_disp numeric;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select order_id into v_order_id from public.dispatches where id=p_dispatch_id and status='dispatched';
  if v_order_id is null then raise exception 'Dispatch not found or not completed'; end if;
  if exists(select 1 from public.sales where dispatch_id=p_dispatch_id) then raise exception 'Sale already exists for dispatch'; end if;
  select customer_id into v_customer_id from public.orders where id=v_order_id;
  insert into public.sales(id,order_id,dispatch_id,customer_id,sale_date,created_by)
  values(v_sale_id,v_order_id,p_dispatch_id,v_customer_id,current_date,v_user);

  for r in
    select dl.id dispatch_line_id, dl.item_id, dl.quantity, dl.unit_id,
           ol.selling_rate,
           coalesce(ol.discount_amount,0) discount_amount,
           coalesce(ol.tax_rate,0) tax_rate,
           ol.pack_qty, ol.pack_size_kg, ol.pack_label, coalesce(ol.rate_basis,'kg') rate_basis,
           ol.ordered_quantity
    from public.dispatch_lines dl
    join public.order_lines ol on ol.id = dl.order_line_id
    where dl.dispatch_id = p_dispatch_id
  loop
    if coalesce(r.pack_qty,0) > 0 and coalesce(r.ordered_quantity,0) > 0 and coalesce(r.pack_size_kg,0) > 0 then
      v_pack_qty_disp := round((r.quantity / r.ordered_quantity) * r.pack_qty, 4);
    else
      v_pack_qty_disp := r.pack_qty;
    end if;

    v_line_total := (r.quantity * r.selling_rate) - r.discount_amount;
    v_tax_amt := case when r.tax_rate > 0 then round(v_line_total * r.tax_rate / 100.0, 2) else 0 end;
    v_line_total := v_line_total + v_tax_amt;

    insert into public.sale_lines(
      sale_id, dispatch_line_id, item_id, quantity, unit_id, selling_rate,
      discount_amount, tax_amount, line_total,
      pack_qty, pack_size_kg, pack_label, rate_basis, tax_rate
    ) values (
      v_sale_id, r.dispatch_line_id, r.item_id, r.quantity, r.unit_id, r.selling_rate,
      r.discount_amount, v_tax_amt, v_line_total,
      v_pack_qty_disp, r.pack_size_kg, r.pack_label, r.rate_basis, r.tax_rate
    );
    v_subtotal := v_subtotal + (r.quantity * r.selling_rate);
    v_total := v_total + v_line_total;
  end loop;

  select coalesce(sum(ca.amount),0) into v_advance
  from public.customer_advances ca
  where ca.order_id=v_order_id and ca.status in ('open','partially_applied');
  v_apply:=least(v_total,v_advance);
  update public.sales set subtotal=v_subtotal,total_amount=v_total,advance_applied=v_apply,
    amount_due=greatest(0,v_total-v_apply),status='approved',updated_at=now() where id=v_sale_id;

  insert into public.invoices(id,sale_id,invoice_date,billing_customer_id,subtotal,total_amount,advance_applied,amount_due,status,created_by)
  values(v_invoice_id,v_sale_id,current_date,v_customer_id,v_subtotal,v_total,v_apply,greatest(0,v_total-v_apply),
    case when greatest(0,v_total-v_apply)=0 then 'paid' else 'issued' end,v_user);

  for r in select sl.* from public.sale_lines sl where sl.sale_id=v_sale_id loop
    insert into public.invoice_lines(
      invoice_id, sale_line_id, item_id, quantity, unit_id, rate,
      discount_amount, tax_amount, line_total,
      pack_qty, pack_size_kg, pack_label, rate_basis, tax_rate
    ) values (
      v_invoice_id, r.id, r.item_id, r.quantity, r.unit_id, r.selling_rate,
      r.discount_amount, r.tax_amount, r.line_total,
      r.pack_qty, r.pack_size_kg, r.pack_label, r.rate_basis, r.tax_rate
    );
  end loop;

  if v_apply>0 then
    for v_adv in
      select ca.id, ca.payment_id, ca.amount
      from public.customer_advances ca
      where ca.order_id=v_order_id and ca.status in ('open','partially_applied') and ca.amount>0
      order by ca.advance_date, ca.created_at, ca.id
      for update
    loop
      exit when v_apply<=0;
      v_advance:=least(v_adv.amount,v_apply);
      insert into public.customer_payment_allocations(payment_id,invoice_id,amount) values(v_adv.payment_id,v_invoice_id,v_advance);
      if v_advance>=v_adv.amount then
        update public.customer_advances set amount=0,status='applied' where id=v_adv.id;
      else
        update public.customer_advances set amount=amount-v_advance,status='partially_applied' where id=v_adv.id;
      end if;
      v_apply:=v_apply-v_advance;
    end loop;
  end if;

  perform public.record_audit_event('sale.invoice.created','sale',v_sale_id,
    jsonb_build_object('invoice_id',v_invoice_id,'dispatch_id',p_dispatch_id),'application');
  return jsonb_build_object('sale_id',v_sale_id,'invoice_id',v_invoice_id,'total_amount',v_total);
end;
$function$;

grant execute on function public.create_sale_invoice(uuid) to authenticated;
