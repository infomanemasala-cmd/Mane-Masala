-- Order pack entry + differential pricing (customer_type)
-- Internal ops (plan/stock/production) stay in kg via order_lines.ordered_quantity.
-- UI may enter pack qty; RPC converts packs → kg and stores pack snapshot.

-- 1) Item pack + default rate (idempotent)
alter table public.items
  add column if not exists selling_pack_size_kg numeric(20,6),
  add column if not exists selling_pack_type text,
  add column if not exists selling_pack_label text,
  add column if not exists default_selling_rate numeric(20,6);

comment on column public.items.selling_pack_size_kg is 'Retail pack size in kg (e.g. 0.25 for 250g). Null = order in kg only.';
comment on column public.items.default_selling_rate is 'Default price: per pack if selling_pack_size_kg set, else per kg.';

-- 2) Differential price list by customer_type
create table if not exists public.item_customer_type_prices (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  customer_type text not null,
  unit_price numeric(20,6) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint item_customer_type_prices_type_chk
    check (customer_type in ('individual','retail_shop','restaurant','caterer','online_customer','sub_agent')),
  constraint item_customer_type_prices_price_chk check (unit_price >= 0),
  constraint item_customer_type_prices_unique unique (item_id, customer_type)
);

create index if not exists item_customer_type_prices_item_idx
  on public.item_customer_type_prices(item_id);

alter table public.item_customer_type_prices enable row level security;
drop policy if exists item_customer_type_prices_read on public.item_customer_type_prices;
create policy item_customer_type_prices_read on public.item_customer_type_prices
  for select to authenticated using (true);

grant select on public.item_customer_type_prices to authenticated;
grant all on public.item_customer_type_prices to service_role;

comment on table public.item_customer_type_prices is
  'Differential selling price by customer_type. unit_price is per pack when item has selling_pack_size_kg, else per kg.';

-- 3) Order line pack snapshot
alter table public.order_lines
  add column if not exists pack_qty numeric(20,6),
  add column if not exists pack_size_kg numeric(20,6),
  add column if not exists pack_label text,
  add column if not exists rate_basis text default 'kg';

comment on column public.order_lines.ordered_quantity is 'Always kg (base). Source of truth for plan/stock/production.';
comment on column public.order_lines.pack_qty is 'Customer-facing pack count when ordered in packs.';
comment on column public.order_lines.selling_rate is 'Always rate per kg (for line math with ordered_quantity).';

-- 4) Sale / invoice pack snapshot for display
alter table public.sale_lines
  add column if not exists pack_qty numeric(20,6),
  add column if not exists pack_size_kg numeric(20,6),
  add column if not exists pack_label text,
  add column if not exists rate_basis text;

alter table public.invoice_lines
  add column if not exists pack_qty numeric(20,6),
  add column if not exists pack_size_kg numeric(20,6),
  add column if not exists pack_label text,
  add column if not exists rate_basis text;

-- 5) Helper: resolve unit price for item + customer_type
create or replace function public.resolve_item_selling_price(
  p_item_id uuid,
  p_customer_type text default null
) returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_price numeric;
  v_default numeric;
begin
  if p_customer_type is not null then
    select unit_price into v_price
    from public.item_customer_type_prices
    where item_id = p_item_id and customer_type = p_customer_type;
    if v_price is not null then
      return v_price;
    end if;
  end if;

  select default_selling_rate into v_default
  from public.items where id = p_item_id;

  return coalesce(v_default, 0);
end;
$$;

revoke all on function public.resolve_item_selling_price(uuid, text) from public, anon;
grant execute on function public.resolve_item_selling_price(uuid, text) to authenticated, service_role;

-- 6) create_order_entry_session: pack conversion + differential rate
create or replace function public.create_order_entry_session(p_orders jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order jsonb;
  v_line jsonb;
  v_order_id uuid;
  v_billing_customer_id uuid;
  v_item record;
  v_party text;
  v_source text;
  v_end_mode text;
  v_results jsonb := '[]'::jsonb;
  v_line_count integer;
  v_order_number integer := 0;
  v_customer_type text;
  v_pack_size numeric;
  v_pack_qty numeric;
  v_qty_kg numeric;
  v_rate_input numeric;
  v_rate_per_kg numeric;
  v_rate_basis text;
  v_pack_label text;
  v_resolved_price numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_orders is null or jsonb_typeof(p_orders) <> 'array' or jsonb_array_length(p_orders) = 0 then
    raise exception 'At least one customer order is required.';
  end if;

  for v_order in select value from jsonb_array_elements(p_orders) loop
    v_order_number := v_order_number + 1;
    v_party := coalesce(v_order->>'order_party_type', 'direct');
    v_source := v_order->>'source';

    if v_party not in ('direct', 'sub_agent') then
      raise exception 'Order %: invalid order type.', v_order_number;
    end if;
    if v_source not in ('whatsapp', 'sms', 'phone', 'social_media', 'walk_in', 'online_marketplace') then
      raise exception 'Order %: invalid order source.', v_order_number;
    end if;
    if coalesce(v_order->>'order_date', '') = '' then
      raise exception 'Order %: order date is required.', v_order_number;
    end if;
    if jsonb_typeof(v_order->'lines') <> 'array' or jsonb_array_length(v_order->'lines') = 0 then
      raise exception 'Order %: at least one item line is required.', v_order_number;
    end if;

    if v_party = 'direct' then
      v_billing_customer_id := nullif(v_order->>'customer_id', '')::uuid;
      if v_billing_customer_id is null then
        raise exception 'Order %: billing customer is required.', v_order_number;
      end if;
      if not exists (select 1 from public.customers c where c.id = v_billing_customer_id and c.is_active) then
        raise exception 'Order %: selected billing customer is not active.', v_order_number;
      end if;
      v_end_mode := null;
    else
      if nullif(v_order->>'sub_agent_id', '') is null then
        raise exception 'Order %: Sub-Agent is required.', v_order_number;
      end if;
      select sa.customer_id into v_billing_customer_id
      from public.sub_agents sa
      where sa.id = nullif(v_order->>'sub_agent_id', '')::uuid and sa.is_active;
      if v_billing_customer_id is null then
        raise exception 'Order %: selected Sub-Agent is not active or has no billing customer.', v_order_number;
      end if;
      v_end_mode := case
        when coalesce((v_order->>'end_customer_is_anonymous')::boolean, false) then 'anonymous'
        when nullif(v_order->>'end_customer_customer_id', '') is not null then 'existing'
        when length(trim(coalesce(v_order->>'end_customer_name', ''))) > 0 then 'named'
        else 'anonymous'
      end;
    end if;

    select customer_type into v_customer_type
    from public.customers where id = v_billing_customer_id;

    v_order_id := public.gen_random_uuid();

    insert into public.orders (
      id, customer_id, order_party_type, sub_agent_id,
      end_customer_customer_id, end_customer_name, end_customer_phone, end_customer_is_anonymous,
      order_date, estimated_dispatch_date, source,
      advance_amount, advance_payment_method, requests, notes, status, created_by
    ) values (
      v_order_id,
      v_billing_customer_id,
      v_party,
      nullif(v_order->>'sub_agent_id', '')::uuid,
      nullif(v_order->>'end_customer_customer_id', '')::uuid,
      nullif(trim(coalesce(v_order->>'end_customer_name', '')), ''),
      nullif(trim(coalesce(v_order->>'end_customer_phone', '')), ''),
      coalesce((v_order->>'end_customer_is_anonymous')::boolean, false),
      (v_order->>'order_date')::date,
      nullif(v_order->>'estimated_dispatch_date', '')::date,
      v_source,
      coalesce((v_order->>'advance_amount')::numeric, 0),
      nullif(v_order->>'advance_payment_method', ''),
      nullif(trim(coalesce(v_order->>'requests', '')), ''),
      nullif(trim(coalesce(v_order->>'notes', '')), ''),
      'received',
      auth.uid()
    );

    v_line_count := 0;
    for v_line in select value from jsonb_array_elements(v_order->'lines') loop
      v_line_count := v_line_count + 1;

      select * into v_item
      from public.items
      where id = nullif(v_line->>'item_id', '')::uuid and is_active = true;

      if not found then
        raise exception 'Order % line %: item not found or inactive.', v_order_number, v_line_count;
      end if;

      v_pack_size := v_item.selling_pack_size_kg;
      v_pack_label := coalesce(nullif(trim(coalesce(v_line->>'pack_label', '')), ''), v_item.selling_pack_label,
        case when v_pack_size is not null then
          trim(both ' ' from coalesce(v_item.selling_pack_type, '') || ' ' ||
            case when v_pack_size < 1 then (v_pack_size * 1000)::int::text || ' g' else v_pack_size::text || ' kg' end)
        else null end);

      v_pack_qty := nullif(v_line->>'pack_qty', '')::numeric;
      v_qty_kg := nullif(v_line->>'ordered_quantity', '')::numeric;

      -- Prefer pack_qty when item has pack size
      if v_pack_size is not null and v_pack_size > 0 and v_pack_qty is not null and v_pack_qty > 0 then
        v_qty_kg := v_pack_qty * v_pack_size;
        v_rate_basis := 'pack';
      else
        v_pack_qty := null;
        v_rate_basis := 'kg';
        if v_qty_kg is null or v_qty_kg <= 0 then
          raise exception 'Order % line %: quantity must be greater than zero.', v_order_number, v_line_count;
        end if;
      end if;

      if v_qty_kg is null or v_qty_kg <= 0 then
        raise exception 'Order % line %: quantity must be greater than zero.', v_order_number, v_line_count;
      end if;

      -- Rate: explicit from UI, else differential / default
      v_rate_input := nullif(v_line->>'selling_rate', '')::numeric;
      if v_rate_input is null then
        v_resolved_price := public.resolve_item_selling_price(v_item.id, v_customer_type);
        v_rate_input := v_resolved_price;
      end if;

      if v_rate_input < 0 then
        raise exception 'Order % line %: selling rate cannot be negative.', v_order_number, v_line_count;
      end if;

      -- Normalize to rate per kg for ordered_quantity math
      if v_rate_basis = 'pack' and v_pack_size is not null and v_pack_size > 0 then
        v_rate_per_kg := v_rate_input / v_pack_size;
      else
        v_rate_per_kg := v_rate_input;
      end if;

      insert into public.order_lines (
        order_id, item_id, ordered_quantity, unit_id, selling_rate,
        pack_qty, pack_size_kg, pack_label, rate_basis,
        tax_rate
      ) values (
        v_order_id,
        v_item.id,
        v_qty_kg,
        v_item.base_unit_id,
        coalesce(v_rate_per_kg, 0),
        v_pack_qty,
        case when v_rate_basis = 'pack' then v_pack_size else null end,
        case when v_rate_basis = 'pack' then v_pack_label else null end,
        v_rate_basis,
        coalesce(nullif(v_line->>'tax_rate', '')::numeric, 0)
      );
    end loop;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'order_id', v_order_id,
      'line_count', v_line_count
    ));
  end loop;

  return jsonb_build_object('orders', v_results, 'count', v_order_number);
end;
$$;

revoke all on function public.create_order_entry_session(jsonb) from public, anon;
grant execute on function public.create_order_entry_session(jsonb) to authenticated, service_role;

-- 7) create_sale_invoice: copy pack snapshot from order_lines
create or replace function public.create_sale_invoice(p_dispatch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_sale_id uuid := public.gen_random_uuid();
  v_invoice_id uuid := public.gen_random_uuid();
  v_order_id uuid;
  v_customer_id uuid;
  r record;
  v_subtotal numeric := 0;
  v_total numeric := 0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select order_id into v_order_id
  from public.dispatches
  where id = p_dispatch_id and status = 'dispatched';

  if v_order_id is null then
    raise exception 'Dispatch not found or not completed';
  end if;

  if exists (select 1 from public.sales where dispatch_id = p_dispatch_id) then
    raise exception 'Sale already exists for dispatch';
  end if;

  select customer_id into v_customer_id from public.orders where id = v_order_id;

  insert into public.sales (id, order_id, dispatch_id, customer_id, sale_date, created_by)
  values (v_sale_id, v_order_id, p_dispatch_id, v_customer_id, current_date, v_user);

  for r in
    select
      dl.id as dispatch_line_id,
      dl.item_id,
      dl.quantity,
      dl.unit_id,
      ol.selling_rate,
      coalesce(ol.discount_amount, 0) as discount_amount,
      coalesce(ol.tax_amount, 0) as tax_amount,
      ol.pack_qty,
      ol.pack_size_kg,
      ol.pack_label,
      ol.rate_basis
    from public.dispatch_lines dl
    join public.order_lines ol on ol.id = dl.order_line_id
    where dl.dispatch_id = p_dispatch_id
  loop
    insert into public.sale_lines (
      sale_id, dispatch_line_id, item_id, quantity, unit_id, selling_rate,
      discount_amount, tax_amount, line_total,
      pack_qty, pack_size_kg, pack_label, rate_basis
    ) values (
      v_sale_id, r.dispatch_line_id, r.item_id, r.quantity, r.unit_id, r.selling_rate,
      r.discount_amount, r.tax_amount,
      (r.quantity * r.selling_rate) - r.discount_amount + r.tax_amount,
      r.pack_qty, r.pack_size_kg, r.pack_label, r.rate_basis
    );
    v_subtotal := v_subtotal + (r.quantity * r.selling_rate);
    v_total := v_total + ((r.quantity * r.selling_rate) - r.discount_amount + r.tax_amount);
  end loop;

  update public.sales
  set subtotal = v_subtotal, total_amount = v_total, amount_due = v_total,
      status = 'approved', updated_at = now()
  where id = v_sale_id;

  insert into public.invoices (
    id, sale_id, invoice_date, billing_customer_id,
    subtotal, total_amount, amount_due, status, created_by
  ) values (
    v_invoice_id, v_sale_id, current_date, v_customer_id,
    v_subtotal, v_total, v_total, 'issued', v_user
  );

  for r in
    select * from public.sale_lines where sale_id = v_sale_id
  loop
    insert into public.invoice_lines (
      invoice_id, sale_line_id, item_id, quantity, unit_id, rate,
      discount_amount, tax_amount, line_total,
      pack_qty, pack_size_kg, pack_label, rate_basis
    ) values (
      v_invoice_id, r.id, r.item_id, r.quantity, r.unit_id, r.selling_rate,
      r.discount_amount, r.tax_amount, r.line_total,
      r.pack_qty, r.pack_size_kg, r.pack_label, r.rate_basis
    );
  end loop;

  begin
    perform public.record_audit_event(
      'sale.invoice.created', 'sale', v_sale_id::text,
      jsonb_build_object('invoice_id', v_invoice_id, 'dispatch_id', p_dispatch_id),
      'application'
    );
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'sale_id', v_sale_id,
    'invoice_id', v_invoice_id,
    'total_amount', v_total,
    'amount_due', v_total
  );
end;
$$;

revoke all on function public.create_sale_invoice(uuid) from public, anon;
grant execute on function public.create_sale_invoice(uuid) to authenticated, service_role;
