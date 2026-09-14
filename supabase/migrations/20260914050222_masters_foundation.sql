-- Mane Masala Business System
-- Phase 4 / Milestone 1: Master-data database foundation
-- Based strictly on MANE_MASALA_MASTER_STATE v1.4.
-- This migration creates master structures only. No business transactions or stock are created.

create table if not exists public.id_sequences (
  id uuid primary key default gen_random_uuid(),
  sequence_key text not null unique,
  prefix text,
  next_number bigint not null default 1,
  width integer,
  financial_year text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint id_sequences_next_number_chk check (next_number >= 1),
  constraint id_sequences_width_chk check (width is null or width between 1 and 20)
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null unique,
  symbol text not null unique,
  base_unit_id uuid references public.units(id) on delete restrict,
  conversion_to_base numeric(20,8),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint units_conversion_chk check (conversion_to_base is null or conversion_to_base > 0)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null unique,
  parent_category_id uuid references public.categories(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  name text not null,
  item_type text not null,
  category_id uuid references public.categories(id) on delete restrict,
  subcategory text,
  product_family text,
  purchase_unit_id uuid references public.units(id) on delete restrict,
  base_unit_id uuid not null references public.units(id) on delete restrict,
  selling_unit_id uuid references public.units(id) on delete restrict,
  minimum_stock numeric(20,6) not null default 0,
  is_perishable boolean not null default false,
  expiry_tracking_enabled boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint items_type_chk check (item_type in ('raw_material','intermediate','finished_product','purchased_finished_product')),
  constraint items_minimum_stock_chk check (minimum_stock >= 0)
);

create unique index if not exists items_name_active_unique_idx
  on public.items (lower(name))
  where is_active = true;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  business_name text not null,
  contact_person text,
  supplier_type text not null,
  phone text,
  whatsapp text,
  order_call_number text,
  upi_id text,
  gpay_phonepe text,
  address text,
  gst_number text,
  email text,
  bank_details text,
  preferred_payment_method text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_type_chk check (supplier_type in ('wholesaler','retailer','individual','farmer_producer','online_marketplace','manufacturer','other')),
  constraint suppliers_payment_method_chk check (preferred_payment_method is null or preferred_payment_method in ('cash','upi','other'))
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  name text not null,
  customer_type text not null,
  phone text,
  whatsapp text,
  email text,
  address text,
  gst_number text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_type_chk check (customer_type in ('individual','retail_shop','restaurant','caterer','online_customer','sub_agent'))
);

create table if not exists public.sub_agents (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  customer_id uuid not null unique references public.customers(id) on delete restrict,
  name text not null,
  phone text,
  whatsapp text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_settings (
  id uuid primary key default gen_random_uuid(),
  business_name text not null default 'Mane Masala',
  phone text,
  whatsapp text,
  email text,
  address text,
  gst_number text,
  financial_year_start_month integer,
  financial_year_start_day integer,
  currency_code text not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_settings_singleton unique (business_name),
  constraint business_settings_fy_month_chk check (financial_year_start_month is null or financial_year_start_month between 1 and 12),
  constraint business_settings_fy_day_chk check (financial_year_start_day is null or financial_year_start_day between 1 and 31)
);

create index if not exists items_category_idx on public.items(category_id);
create index if not exists items_type_idx on public.items(item_type);
create index if not exists suppliers_active_idx on public.suppliers(is_active);
create index if not exists customers_active_idx on public.customers(is_active);

-- RLS: authenticated operational users can manage master data for the MVP.
-- More granular permissions remain an approved OPEN decision and can be tightened later.
alter table public.id_sequences enable row level security;
alter table public.units enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.suppliers enable row level security;
alter table public.customers enable row level security;
alter table public.sub_agents enable row level security;
alter table public.business_settings enable row level security;

create policy "authenticated manage id sequences" on public.id_sequences for all to authenticated using (true) with check (true);
create policy "authenticated manage units" on public.units for all to authenticated using (true) with check (true);
create policy "authenticated manage categories" on public.categories for all to authenticated using (true) with check (true);
create policy "authenticated manage items" on public.items for all to authenticated using (true) with check (true);
create policy "authenticated manage suppliers" on public.suppliers for all to authenticated using (true) with check (true);
create policy "authenticated manage customers" on public.customers for all to authenticated using (true) with check (true);
create policy "authenticated manage sub agents" on public.sub_agents for all to authenticated using (true) with check (true);
create policy "authenticated manage business settings" on public.business_settings for all to authenticated using (true) with check (true);

comment on table public.items is 'Permanent stock/operational item master. Supports raw material, intermediate, finished product, purchased finished product.';
comment on column public.items.business_code is 'System-generated permanent human-readable ID. Exact prefix/width remains OPEN in Master State v1.4, so production numbering is not frozen here.';
comment on table public.id_sequences is 'Central numbering infrastructure; exact prefixes, widths and financial-year reset rules remain OPEN until approved.';
