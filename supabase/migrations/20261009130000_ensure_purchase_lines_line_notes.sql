-- LIVE drift: purchase_lines.line_notes missing on some environments.
-- Ensure column exists, then keep create_purchase_entry aligned.

alter table public.purchase_lines
  add column if not exists line_notes text;

-- Optional: if a legacy "notes" column was added by hand, leave it; UI no longer selects it.

create or replace function public.create_purchase_entry(
  p_supplier_id uuid,
  p_purchase_date date,
  p_supplier_invoice_number text,
  p_purchase_source text,
  p_lines jsonb,
  p_discount_amount numeric default 0,
  p_delivery_charge numeric default 0,
  p_transport_charge numeric default 0,
  p_loading_charge numeric default 0,
  p_unloading_charge numeric default 0,
  p_packing_charge numeric default 0,
  p_other_charge numeric default 0,
  p_tax_amount numeric default 0,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_purchase_id uuid;
  v_business_code text;
  v_line jsonb;
  v_item_id uuid;
  v_unit_id uuid;
  v_is_active boolean;
  v_line_count int := 0;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_rate numeric;
  v_qty numeric;
  v_line_total numeric;
  v_disc numeric;
  v_tax numeric;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_supplier_id is null then raise exception 'Supplier is required'; end if;
  if p_purchase_source not in ('whatsapp','phone','walk_in','online','other','delivery') then
    raise exception 'Invalid purchase source';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one purchase line is required';
  end if;

  insert into public.purchases(
    supplier_id, purchase_date, supplier_invoice_number, purchase_source,
    financial_status, workflow_status,
    discount_amount, delivery_charge, transport_charge, loading_charge,
    unloading_charge, packing_charge, other_charge, tax_amount, notes, created_by
  ) values (
    p_supplier_id, p_purchase_date, nullif(trim(p_supplier_invoice_number),''), p_purchase_source,
    'unpaid', 'received',
    greatest(0, coalesce(p_discount_amount,0)),
    greatest(0, coalesce(p_delivery_charge,0)),
    greatest(0, coalesce(p_transport_charge,0)),
    greatest(0, coalesce(p_loading_charge,0)),
    greatest(0, coalesce(p_unloading_charge,0)),
    greatest(0, coalesce(p_packing_charge,0)),
    greatest(0, coalesce(p_other_charge,0)),
    greatest(0, coalesce(p_tax_amount,0)),
    nullif(trim(p_notes),''),
    v_user
  ) returning id, business_code into v_purchase_id, v_business_code;

  update public.purchases
  set system_reference = coalesce(system_reference, v_business_code)
  where id = v_purchase_id;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_line_count := v_line_count + 1;
    select it.id, it.is_active,
           coalesce(
             nullif(v_line->>'unit_id','')::uuid,
             it.purchase_unit_id,
             it.base_unit_id
           )
      into v_item_id, v_is_active, v_unit_id
    from public.items it
    where it.id = nullif(v_line->>'item_id','')::uuid;

    if v_item_id is null or not coalesce(v_is_active, false) then
      raise exception 'Purchase line %: selected item is not active', v_line_count;
    end if;
    if v_unit_id is null then
      raise exception 'Purchase line %: item has no unit configured (set purchase unit or base unit on Item Master)', v_line_count;
    end if;

    v_qty := coalesce((v_line->>'billed_quantity')::numeric, 0);
    if v_qty <= 0 then
      raise exception 'Purchase line %: quantity must be greater than zero', v_line_count;
    end if;

    if nullif(v_line->>'unit_rate','') is null then
      v_rate := null;
    else
      v_rate := (v_line->>'unit_rate')::numeric;
      if v_rate < 0 then
        raise exception 'Purchase line %: rate cannot be negative', v_line_count;
      end if;
    end if;

    v_disc := greatest(0, coalesce((v_line->>'discount_amount')::numeric, 0));
    v_tax := greatest(0, coalesce((v_line->>'tax_amount')::numeric, 0));
    v_line_total := case when v_rate is null then null else round((v_qty * v_rate)::numeric, 2) end;

    insert into public.purchase_lines(
      purchase_id, item_id, billed_quantity, unit_id, unit_rate,
      line_total, discount_amount, tax_amount, line_notes
    ) values (
      v_purchase_id, v_item_id, v_qty, v_unit_id, v_rate,
      v_line_total, v_disc, v_tax,
      nullif(trim(coalesce(v_line->>'notes', v_line->>'line_notes')), '')
    );

    if v_line_total is not null then
      v_subtotal := v_subtotal + v_line_total;
      v_total := v_total + v_line_total - v_disc + v_tax;
    end if;
  end loop;

  if v_line_count = 0 then
    raise exception 'At least one purchase line is required';
  end if;

  v_total := greatest(0,
    coalesce(v_subtotal,0)
    - greatest(0, coalesce(p_discount_amount,0))
    + greatest(0, coalesce(p_tax_amount,0))
    + greatest(0, coalesce(p_delivery_charge,0))
    + greatest(0, coalesce(p_transport_charge,0))
    + greatest(0, coalesce(p_loading_charge,0))
    + greatest(0, coalesce(p_unloading_charge,0))
    + greatest(0, coalesce(p_packing_charge,0))
    + greatest(0, coalesce(p_other_charge,0))
  );

  return jsonb_build_object(
    'purchase_id', v_purchase_id,
    'business_code', v_business_code,
    'line_count', v_line_count,
    'subtotal', v_subtotal,
    'total', v_total
  );
end;
$$;

revoke all on function public.create_purchase_entry(uuid,date,text,text,jsonb,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text) from public, anon;
grant execute on function public.create_purchase_entry(uuid,date,text,text,jsonb,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text) to authenticated, service_role;
