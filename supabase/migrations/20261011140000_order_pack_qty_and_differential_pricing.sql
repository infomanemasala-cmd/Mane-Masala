-- Pack-based order entry + differential pricing by customer_type
-- Internal quantities remain kg. Pack fields are for entry UI and invoice display only.

-- 1) Item master: selling pack definition (idempotent)
alter table public.items
  add column if not exists selling_pack_size_kg numeric,
  add column if not exists selling_pack_type text,
  add column if not exists selling_pack_label text,
  add column if not exists default_selling_rate numeric;

comment on column public.items.selling_pack_size_kg is 'Sellable pack size in kg (e.g. 0.250). Null = order by kg only.';
comment on column public.items.selling_pack_type is 'Pack type label e.g. pouch, jar, box';
comment on column public.items.selling_pack_label is 'Display label e.g. 250 g pouch';
comment on column public.items.default_selling_rate is 'Fallback unit price (per kg) when no customer-type price exists';

-- 2) Differential price list by customer type
create table if not exists public.item_customer_type_prices (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  customer_type text not null,
  unit_price numeric not null check (unit_price >= 0),
  rate_basis text not null default 'kg' check (rate_basis in ('kg','pack')),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, customer_type)
);

comment on table public.item_customer_type_prices is 'Differential selling prices by customer_type. unit_price is per kg when rate_basis=kg, per pack when rate_basis=pack.';

create index if not exists idx_item_customer_type_prices_item on public.item_customer_type_prices(item_id);

alter table public.item_customer_type_prices enable row level security;
drop policy if exists item_customer_type_prices_select on public.item_customer_type_prices;
create policy item_customer_type_prices_select on public.item_customer_type_prices for select to authenticated using (true);
drop policy if exists item_customer_type_prices_write on public.item_customer_type_prices;
create policy item_customer_type_prices_write on public.item_customer_type_prices for all to authenticated using (true) with check (true);

-- 3) Order / sale / invoice line pack snapshot columns
alter table public.order_lines
  add column if not exists pack_qty numeric,
  add column if not exists pack_size_kg numeric,
  add column if not exists pack_label text,
  add column if not exists rate_basis text default 'kg',
  add column if not exists tax_rate numeric default 0;

alter table public.sale_lines
  add column if not exists pack_qty numeric,
  add column if not exists pack_size_kg numeric,
  add column if not exists pack_label text,
  add column if not exists rate_basis text default 'kg',
  add column if not exists tax_rate numeric default 0;

alter table public.invoice_lines
  add column if not exists pack_qty numeric,
  add column if not exists pack_size_kg numeric,
  add column if not exists pack_label text,
  add column if not exists rate_basis text default 'kg',
  add column if not exists tax_rate numeric default 0;

-- 4) Resolve selling price (always returns per-kg)
create or replace function public.resolve_item_selling_price(
  p_item_id uuid,
  p_customer_id uuid
) returns numeric
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_ct text;
  v_price numeric;
  v_basis text;
  v_pack numeric;
  v_default numeric;
begin
  select c.customer_type into v_ct from public.customers c where c.id = p_customer_id;
  select ict.unit_price, ict.rate_basis into v_price, v_basis
  from public.item_customer_type_prices ict
  where ict.item_id = p_item_id and ict.customer_type = v_ct and ict.is_active
  limit 1;
  if v_price is not null then
    if coalesce(v_basis,'kg') = 'pack' then
      select i.selling_pack_size_kg into v_pack from public.items i where i.id = p_item_id;
      if coalesce(v_pack,0) > 0 then
        return round(v_price / v_pack, 6);
      end if;
    end if;
    return v_price;
  end if;
  select i.default_selling_rate into v_default from public.items i where i.id = p_item_id;
  return v_default;
end;
$$;

grant execute on function public.resolve_item_selling_price(uuid, uuid) to authenticated;

-- NOTE: Full create_order_entry_session and create_sale_invoice bodies are in the complete migration file on disk.
-- This push is partial due to size; applying complete version next.
select 'pack_columns_and_price_table_ready' as status;
