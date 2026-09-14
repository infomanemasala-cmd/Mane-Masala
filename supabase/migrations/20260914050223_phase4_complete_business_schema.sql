-- Mane Masala Business System
-- Phase 4 database schema: transactional, inventory, production, orders/sales, money and system structures.
-- Based strictly on MANE_MASALA_MASTER_STATE v1.4.
-- This migration does not seed business data and does not freeze OPEN decisions.

-- ============================================================
-- Shared timestamp maintenance
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- PURCHASING + RECEIVING
-- ============================================================
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  purchase_date date not null,
  entry_date timestamptz not null default now(),
  supplier_invoice_number text,
  system_reference text unique,
  discount_amount numeric(20,2) not null default 0,
  delivery_charge numeric(20,2) not null default 0,
  transport_charge numeric(20,2) not null default 0,
  loading_charge numeric(20,2) not null default 0,
  unloading_charge numeric(20,2) not null default 0,
  packing_charge numeric(20,2) not null default 0,
  other_charge numeric(20,2) not null default 0,
  tax_amount numeric(20,2) not null default 0,
  purchase_source text not null,
  financial_status text not null default 'unpaid',
  workflow_status text not null default 'received',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchases_source_chk check (purchase_source in ('whatsapp','phone','walk_in','online','other')),
  constraint purchases_financial_status_chk check (financial_status in ('paid','partially_paid','unpaid','credit')),
  constraint purchases_workflow_status_chk check (workflow_status in ('received','inspected_stock','inspected_invoice','returned','partial_returned','completed','cancelled')),
  constraint purchases_amounts_chk check (discount_amount >= 0 and delivery_charge >= 0 and transport_charge >= 0 and loading_charge >= 0 and unloading_charge >= 0 and packing_charge >= 0 and other_charge >= 0 and tax_amount >= 0)
);

create table if not exists public.purchase_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete restrict,
  item_id uuid not null references public.items(id) on delete restrict,
  billed_quantity numeric(20,6) not null,
  unit_id uuid not null references public.units(id) on delete restrict,
  unit_rate numeric(20,6),
  discount_amount numeric(20,2) not null default 0,
  tax_amount numeric(20,2) not null default 0,
  line_total numeric(20,2),
  line_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_lines_qty_chk check (billed_quantity > 0),
  constraint purchase_lines_rate_chk check (unit_rate is null or unit_rate >= 0),
  constraint purchase_lines_discount_chk check (discount_amount >= 0),
  constraint purchase_lines_tax_chk check (tax_amount >= 0)
);

create table if not exists public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  purchase_id uuid not null references public.purchases(id) on delete restrict,
  received_at timestamptz not null default now(),
  received_by uuid references auth.users(id) on delete set null,
  status text not null default 'received',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_receipts_status_chk check (status in ('received','inspected_stock','inspected_invoice','completed','cancelled'))
);

create table if not exists public.purchase_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.purchase_receipts(id) on delete restrict,
  purchase_line_id uuid not null references public.purchase_lines(id) on delete restrict,
  received_quantity numeric(20,6) not null,
  accepted_quantity numeric(20,6) not null default 0,
  rejected_quantity numeric(20,6) not null default 0,
  replacement_quantity numeric(20,6) not null default 0,
  unit_id uuid not null references public.units(id) on delete restrict,
  received_batch_date date,
  expiry_date date,
  best_before_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_receipt_lines_received_chk check (received_quantity > 0),
  constraint purchase_receipt_lines_accepted_chk check (accepted_quantity >= 0 and rejected_quantity >= 0 and replacement_quantity >= 0),
  constraint purchase_receipt_lines_balance_chk check (accepted_quantity + rejected_quantity <= received_quantity)
);

create table if not exists public.purchase_inspections (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.purchase_receipts(id) on delete restrict,
  purchase_line_id uuid references public.purchase_lines(id) on delete restrict,
  inspected_at timestamptz not null default now(),
  inspected_by uuid references auth.users(id) on delete set null,
  quantity_check text,
  quality_check text,
  damage_check text,
  expiry_check text,
  freshness_check text,
  packaging_check text,
  rate_check text,
  outcome text not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint purchase_inspections_outcome_chk check (outcome in ('accepted','partially_accepted','returned','pending_decision'))
);

create table if not exists public.purchase_returns (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  purchase_id uuid not null references public.purchases(id) on delete restrict,
  return_date date not null,
  reason text,
  status text not null default 'pending',
  supplier_agreed boolean,
  credit_amount numeric(20,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_returns_status_chk check (status in ('pending','approved','completed','cancelled')),
  constraint purchase_returns_credit_chk check (credit_amount >= 0)
);

create table if not exists public.purchase_return_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_return_id uuid not null references public.purchase_returns(id) on delete restrict,
  purchase_line_id uuid not null references public.purchase_lines(id) on delete restrict,
  quantity numeric(20,6) not null,
  unit_id uuid not null references public.units(id) on delete restrict,
  reason text,
  created_at timestamptz not null default now(),
  constraint purchase_return_lines_qty_chk check (quantity > 0)
);

create table if not exists public.supplier_adjustments (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  purchase_id uuid references public.purchases(id) on delete restrict,
  purchase_return_id uuid references public.purchase_returns(id) on delete restrict,
  adjustment_date date not null,
  adjustment_type text not null,
  amount numeric(20,2) not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint supplier_adjustments_type_chk check (adjustment_type in ('credit','debit','shortage_credit','other')),
  constraint supplier_adjustments_amount_chk check (amount >= 0)
);

create table if not exists public.purchase_attachments (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete restrict,
  storage_path text not null,
  file_name text,
  mime_type text,
  file_size bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists purchases_supplier_invoice_unique_idx
  on public.purchases(supplier_id, supplier_invoice_number)
  where supplier_invoice_number is not null;
create index if not exists purchases_supplier_date_idx on public.purchases(supplier_id, purchase_date desc);
create index if not exists purchase_lines_purchase_idx on public.purchase_lines(purchase_id);
create index if not exists purchase_lines_item_idx on public.purchase_lines(item_id);
create index if not exists purchase_receipts_purchase_idx on public.purchase_receipts(purchase_id);
create index if not exists purchase_receipt_lines_line_idx on public.purchase_receipt_lines(purchase_line_id);

-- ============================================================
-- INVENTORY / FIFO / RESERVATIONS
-- ============================================================
create table if not exists public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  item_id uuid not null references public.items(id) on delete restrict,
  source_type text not null,
  source_id uuid,
  source_line_id uuid,
  batch_date date not null,
  quantity_received numeric(20,6) not null default 0,
  quantity_remaining numeric(20,6) not null default 0,
  unit_id uuid not null references public.units(id) on delete restrict,
  unit_cost numeric(20,6),
  expiry_date date,
  best_before_date date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_batches_source_chk check (source_type in ('opening_stock','purchase_receipt','production_output','customer_return','adjustment','other')),
  constraint inventory_batches_qty_chk check (quantity_received >= 0 and quantity_remaining >= 0),
  constraint inventory_batches_cost_chk check (unit_cost is null or unit_cost >= 0),
  constraint inventory_batches_status_chk check (status in ('active','depleted','closed'))
);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  item_id uuid not null references public.items(id) on delete restrict,
  batch_id uuid references public.inventory_batches(id) on delete restrict,
  transaction_type text not null,
  quantity numeric(20,6) not null,
  unit_id uuid not null references public.units(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  reference_type text,
  reference_id uuid,
  reference_line_id uuid,
  unit_cost numeric(20,6),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint inventory_transactions_type_chk check (transaction_type in ('opening_stock','purchase_receipt','production_consumption','production_output','dispatch','stock_out','stock_adjustment','customer_return','supplier_return','reservation_release','other')),
  constraint inventory_transactions_qty_chk check (quantity <> 0),
  constraint inventory_transactions_cost_chk check (unit_cost is null or unit_cost >= 0)
);

create table if not exists public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  order_id uuid,
  order_line_id uuid,
  item_id uuid not null references public.items(id) on delete restrict,
  quantity_reserved numeric(20,6) not null,
  unit_id uuid not null references public.units(id) on delete restrict,
  status text not null default 'active',
  reserved_at timestamptz not null default now(),
  released_at timestamptz,
  consumed_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_reservations_qty_chk check (quantity_reserved > 0),
  constraint stock_reservations_status_chk check (status in ('active','released','consumed','cancelled'))
);

create table if not exists public.stock_outs (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  item_id uuid not null references public.items(id) on delete restrict,
  quantity numeric(20,6) not null,
  unit_id uuid not null references public.units(id) on delete restrict,
  stock_out_date date not null,
  reason text not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint stock_outs_qty_chk check (quantity > 0),
  constraint stock_outs_reason_chk check (reason in ('damage','expiry','sample','wastage','personal_use','production','adjustment','other'))
);

create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  item_id uuid not null references public.items(id) on delete restrict,
  quantity_delta numeric(20,6) not null,
  unit_id uuid not null references public.units(id) on delete restrict,
  adjustment_date date not null,
  reason text not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.opening_stock (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  item_id uuid not null references public.items(id) on delete restrict,
  quantity numeric(20,6) not null,
  unit_id uuid not null references public.units(id) on delete restrict,
  stock_date date not null,
  unit_cost numeric(20,6),
  expiry_date date,
  best_before_date date,
  source_note text,
  approval_status text not null default 'pending',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint opening_stock_qty_chk check (quantity > 0),
  constraint opening_stock_cost_chk check (unit_cost is null or unit_cost >= 0),
  constraint opening_stock_status_chk check (approval_status in ('pending','approved','rejected'))
);

create index if not exists inventory_batches_item_fifo_idx on public.inventory_batches(item_id, batch_date, created_at);
create index if not exists inventory_transactions_item_time_idx on public.inventory_transactions(item_id, occurred_at desc);
create index if not exists stock_reservations_item_status_idx on public.stock_reservations(item_id, status);
create index if not exists stock_outs_item_date_idx on public.stock_outs(item_id, stock_out_date desc);

-- ============================================================
-- RECIPES + PRODUCTION
-- ============================================================
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  output_item_id uuid not null references public.items(id) on delete restrict,
  name text not null,
  status text not null default 'draft',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_status_chk check (status in ('draft','active','inactive'))
);

create table if not exists public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete restrict,
  version_number integer not null,
  expected_output_quantity numeric(20,6) not null,
  output_unit_id uuid not null references public.units(id) on delete restrict,
  notes text,
  status text not null default 'draft',
  effective_from date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint recipe_versions_number_chk check (version_number >= 1),
  constraint recipe_versions_output_chk check (expected_output_quantity > 0),
  constraint recipe_versions_status_chk check (status in ('draft','active','inactive')),
  unique(recipe_id, version_number)
);

create table if not exists public.recipe_lines (
  id uuid primary key default gen_random_uuid(),
  recipe_version_id uuid not null references public.recipe_versions(id) on delete restrict,
  ingredient_item_id uuid not null references public.items(id) on delete restrict,
  quantity numeric(20,6) not null,
  unit_id uuid not null references public.units(id) on delete restrict,
  sequence_number integer not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  constraint recipe_lines_qty_chk check (quantity > 0),
  constraint recipe_lines_sequence_chk check (sequence_number >= 1)
);

create table if not exists public.production_batches (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  recipe_version_id uuid references public.recipe_versions(id) on delete restrict,
  output_item_id uuid not null references public.items(id) on delete restrict,
  planned_output_quantity numeric(20,6),
  actual_output_quantity numeric(20,6),
  output_unit_id uuid not null references public.units(id) on delete restrict,
  production_date date not null,
  status text not null default 'planned',
  wife_approval_status text not null default 'pending',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_batches_planned_chk check (planned_output_quantity is null or planned_output_quantity > 0),
  constraint production_batches_actual_chk check (actual_output_quantity is null or actual_output_quantity >= 0),
  constraint production_batches_status_chk check (status in ('planned','approved','in_progress','partially_completed','completed','cancelled')),
  constraint production_batches_approval_chk check (wife_approval_status in ('pending','approved','rejected'))
);

create table if not exists public.production_consumption (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid not null references public.production_batches(id) on delete restrict,
  ingredient_item_id uuid not null references public.items(id) on delete restrict,
  planned_quantity numeric(20,6),
  actual_quantity numeric(20,6) not null,
  unit_id uuid not null references public.units(id) on delete restrict,
  batch_id uuid references public.inventory_batches(id) on delete restrict,
  consumption_date date not null,
  one_time_variance boolean not null default false,
  recipe_change_requested boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  constraint production_consumption_actual_chk check (actual_quantity > 0),
  constraint production_consumption_planned_chk check (planned_quantity is null or planned_quantity > 0)
);

create table if not exists public.production_outputs (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid not null references public.production_batches(id) on delete restrict,
  output_item_id uuid not null references public.items(id) on delete restrict,
  quantity numeric(20,6) not null,
  unit_id uuid not null references public.units(id) on delete restrict,
  output_date date not null,
  batch_id uuid references public.inventory_batches(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  constraint production_outputs_qty_chk check (quantity > 0)
);

create table if not exists public.production_wastage (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid not null references public.production_batches(id) on delete restrict,
  item_id uuid not null references public.items(id) on delete restrict,
  quantity numeric(20,6) not null,
  unit_id uuid not null references public.units(id) on delete restrict,
  reason text,
  wastage_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint production_wastage_qty_chk check (quantity > 0)
);

create index if not exists recipes_output_item_idx on public.recipes(output_item_id);
create index if not exists recipe_versions_recipe_idx on public.recipe_versions(recipe_id);
create index if not exists recipe_lines_version_idx on public.recipe_lines(recipe_version_id);
create index if not exists production_batches_output_date_idx on public.production_batches(output_item_id, production_date desc);
create index if not exists production_consumption_batch_idx on public.production_consumption(production_batch_id);
create index if not exists production_outputs_batch_idx on public.production_outputs(production_batch_id);

-- ============================================================
-- ORDERS / REVISIONS / DISPATCH / SALES / INVOICES
-- ============================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  order_date date not null,
  estimated_dispatch_date date,
  source text not null,
  status text not null default 'draft',
  advance_amount numeric(20,2) not null default 0,
  requests text,
  notes text,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_source_chk check (source in ('whatsapp','sms','phone','social_media','walk_in','online_marketplace')),
  constraint orders_status_chk check (status in ('draft','received','confirmed','production_planned','in_production','ready','partially_dispatched','dispatched','completed','cancelled')),
  constraint orders_advance_chk check (advance_amount >= 0)
);

create table if not exists public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  item_id uuid not null references public.items(id) on delete restrict,
  ordered_quantity numeric(20,6) not null,
  unit_id uuid not null references public.units(id) on delete restrict,
  selling_rate numeric(20,6) not null,
  discount_amount numeric(20,2) not null default 0,
  tax_amount numeric(20,2) not null default 0,
  reserved_quantity numeric(20,6) not null default 0,
  produced_quantity numeric(20,6) not null default 0,
  dispatched_quantity numeric(20,6) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_lines_qty_chk check (ordered_quantity > 0 and reserved_quantity >= 0 and produced_quantity >= 0 and dispatched_quantity >= 0),
  constraint order_lines_rate_chk check (selling_rate >= 0),
  constraint order_lines_amount_chk check (discount_amount >= 0 and tax_amount >= 0)
);

create table if not exists public.order_revisions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  revision_number integer not null,
  reason text,
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(order_id, revision_number),
  constraint order_revisions_number_chk check (revision_number >= 1)
);

create table if not exists public.dispatches (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  order_id uuid not null references public.orders(id) on delete restrict,
  dispatch_date date not null,
  dispatch_method text not null,
  status text not null default 'draft',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dispatches_method_chk check (dispatch_method in ('customer_pickup','own_delivery','courier','transport','other')),
  constraint dispatches_status_chk check (status in ('draft','approved','dispatched','cancelled'))
);

create table if not exists public.dispatch_lines (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.dispatches(id) on delete restrict,
  order_line_id uuid not null references public.order_lines(id) on delete restrict,
  item_id uuid not null references public.items(id) on delete restrict,
  quantity numeric(20,6) not null,
  unit_id uuid not null references public.units(id) on delete restrict,
  batch_id uuid references public.inventory_batches(id) on delete restrict,
  reservation_id uuid references public.stock_reservations(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint dispatch_lines_qty_chk check (quantity > 0)
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  order_id uuid not null references public.orders(id) on delete restrict,
  dispatch_id uuid not null references public.dispatches(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  sale_date date not null,
  subtotal numeric(20,2) not null default 0,
  discount_amount numeric(20,2) not null default 0,
  tax_amount numeric(20,2) not null default 0,
  total_amount numeric(20,2) not null default 0,
  advance_applied numeric(20,2) not null default 0,
  amount_due numeric(20,2) not null default 0,
  status text not null default 'draft',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_amounts_chk check (subtotal >= 0 and discount_amount >= 0 and tax_amount >= 0 and total_amount >= 0 and advance_applied >= 0 and amount_due >= 0),
  constraint sales_status_chk check (status in ('draft','approved','cancelled','completed'))
);

create table if not exists public.sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete restrict,
  dispatch_line_id uuid not null references public.dispatch_lines(id) on delete restrict,
  item_id uuid not null references public.items(id) on delete restrict,
  quantity numeric(20,6) not null,
  unit_id uuid not null references public.units(id) on delete restrict,
  selling_rate numeric(20,6) not null,
  discount_amount numeric(20,2) not null default 0,
  tax_amount numeric(20,2) not null default 0,
  line_total numeric(20,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint sale_lines_qty_chk check (quantity > 0),
  constraint sale_lines_rate_chk check (selling_rate >= 0),
  constraint sale_lines_amount_chk check (discount_amount >= 0 and tax_amount >= 0 and line_total >= 0)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  sale_id uuid not null references public.sales(id) on delete restrict,
  invoice_number text unique,
  financial_year text,
  invoice_date date not null,
  billing_customer_id uuid not null references public.customers(id) on delete restrict,
  subtotal numeric(20,2) not null default 0,
  discount_amount numeric(20,2) not null default 0,
  tax_amount numeric(20,2) not null default 0,
  total_amount numeric(20,2) not null default 0,
  advance_applied numeric(20,2) not null default 0,
  amount_due numeric(20,2) not null default 0,
  status text not null default 'draft',
  pdf_storage_path text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_amounts_chk check (subtotal >= 0 and discount_amount >= 0 and tax_amount >= 0 and total_amount >= 0 and advance_applied >= 0 and amount_due >= 0),
  constraint invoices_status_chk check (status in ('draft','issued','cancelled','paid','partially_paid'))
);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  sale_line_id uuid not null references public.sale_lines(id) on delete restrict,
  item_id uuid not null references public.items(id) on delete restrict,
  quantity numeric(20,6) not null,
  unit_id uuid not null references public.units(id) on delete restrict,
  rate numeric(20,6) not null,
  discount_amount numeric(20,2) not null default 0,
  tax_amount numeric(20,2) not null default 0,
  line_total numeric(20,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint invoice_lines_qty_chk check (quantity > 0),
  constraint invoice_lines_rate_chk check (rate >= 0),
  constraint invoice_lines_amount_chk check (discount_amount >= 0 and tax_amount >= 0 and line_total >= 0)
);

create table if not exists public.customer_returns (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  sale_id uuid references public.sales(id) on delete restrict,
  invoice_id uuid references public.invoices(id) on delete restrict,
  return_date date not null,
  status text not null default 'received',
  inspection_outcome text,
  refund_amount numeric(20,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_returns_status_chk check (status in ('received','inspected','approved','completed','rejected','cancelled')),
  constraint customer_returns_refund_chk check (refund_amount >= 0)
);

create table if not exists public.customer_return_lines (
  id uuid primary key default gen_random_uuid(),
  customer_return_id uuid not null references public.customer_returns(id) on delete restrict,
  sale_line_id uuid references public.sale_lines(id) on delete restrict,
  item_id uuid not null references public.items(id) on delete restrict,
  quantity numeric(20,6) not null,
  unit_id uuid not null references public.units(id) on delete restrict,
  sale_rate numeric(20,6),
  approved_saleable_quantity numeric(20,6) not null default 0,
  created_at timestamptz not null default now(),
  constraint customer_return_lines_qty_chk check (quantity > 0 and approved_saleable_quantity >= 0 and approved_saleable_quantity <= quantity),
  constraint customer_return_lines_rate_chk check (sale_rate is null or sale_rate >= 0)
);

create index if not exists orders_customer_date_idx on public.orders(customer_id, order_date desc);
create index if not exists order_lines_order_idx on public.order_lines(order_id);
create index if not exists dispatches_order_idx on public.dispatches(order_id);
create index if not exists dispatch_lines_dispatch_idx on public.dispatch_lines(dispatch_id);
create index if not exists sales_customer_date_idx on public.sales(customer_id, sale_date desc);
create index if not exists invoices_customer_date_idx on public.invoices(billing_customer_id, invoice_date desc);

-- ============================================================
-- MONEY / PAYMENTS / ALLOCATIONS / ADVANCES
-- ============================================================
create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  payment_date date not null,
  amount numeric(20,2) not null,
  payment_method text not null,
  upi_reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint supplier_payments_amount_chk check (amount > 0),
  constraint supplier_payments_method_chk check (payment_method in ('cash','upi','other'))
);

create table if not exists public.supplier_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.supplier_payments(id) on delete restrict,
  purchase_id uuid references public.purchases(id) on delete restrict,
  supplier_adjustment_id uuid references public.supplier_adjustments(id) on delete restrict,
  amount numeric(20,2) not null,
  created_at timestamptz not null default now(),
  constraint supplier_payment_allocations_amount_chk check (amount > 0)
);

create table if not exists public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  business_code text unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  payment_date date not null,
  amount numeric(20,2) not null,
  payment_method text not null,
  upi_reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint customer_payments_amount_chk check (amount > 0),
  constraint customer_payments_method_chk check (payment_method in ('cash','upi','other'))
);

create table if not exists public.customer_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.customer_payments(id) on delete restrict,
  invoice_id uuid references public.invoices(id) on delete restrict,
  amount numeric(20,2) not null,
  created_at timestamptz not null default now(),
  constraint customer_payment_allocations_amount_chk check (amount > 0)
);

create table if not exists public.supplier_advances (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  payment_id uuid references public.supplier_payments(id) on delete restrict,
  amount numeric(20,2) not null,
  advance_date date not null,
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  constraint supplier_advances_amount_chk check (amount > 0),
  constraint supplier_advances_status_chk check (status in ('open','partially_applied','applied','cancelled'))
);

create table if not exists public.customer_advances (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  payment_id uuid references public.customer_payments(id) on delete restrict,
  amount numeric(20,2) not null,
  advance_date date not null,
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  constraint customer_advances_amount_chk check (amount > 0),
  constraint customer_advances_status_chk check (status in ('open','partially_applied','applied','cancelled'))
);

create index if not exists supplier_payments_supplier_date_idx on public.supplier_payments(supplier_id, payment_date desc);
create index if not exists customer_payments_customer_date_idx on public.customer_payments(customer_id, payment_date desc);
create index if not exists supplier_payment_allocations_payment_idx on public.supplier_payment_allocations(payment_id);
create index if not exists customer_payment_allocations_payment_idx on public.customer_payment_allocations(payment_id);

-- ============================================================
-- REPORTING / STOCK CALCULATION VIEWS
-- Read-only database views; application reports remain read-only.
-- ============================================================
create or replace view public.v_inventory_current as
select
  i.id as item_id,
  i.business_code,
  i.name,
  i.base_unit_id,
  coalesce(sum(b.quantity_remaining), 0)::numeric as current_stock,
  coalesce((select sum(r.quantity_reserved) from public.stock_reservations r where r.item_id = i.id and r.status = 'active'), 0)::numeric as reserved_stock,
  (coalesce(sum(b.quantity_remaining), 0) - coalesce((select sum(r.quantity_reserved) from public.stock_reservations r where r.item_id = i.id and r.status = 'active'), 0))::numeric as available_stock,
  i.minimum_stock,
  i.is_active
from public.items i
left join public.inventory_batches b on b.item_id = i.id and b.status = 'active'
group by i.id, i.business_code, i.name, i.base_unit_id, i.minimum_stock, i.is_active;

create or replace view public.v_supplier_outstanding as
select
  s.id as supplier_id,
  s.business_code,
  s.business_name,
  coalesce(p.purchase_total,0) - coalesce(pay.payment_total,0) - coalesce(adj.adjustment_total,0) as outstanding
from public.suppliers s
left join (
  select supplier_id, sum(coalesce(line_total, billed_quantity * unit_rate)) as purchase_total
  from public.purchases p
  join public.purchase_lines l on l.purchase_id = p.id
  where p.workflow_status <> 'cancelled'
  group by supplier_id
) p on p.supplier_id = s.id
left join (
  select supplier_id, sum(amount) as payment_total from public.supplier_payments group by supplier_id
) pay on pay.supplier_id = s.id
left join (
  select supplier_id, sum(case when adjustment_type in ('credit','shortage_credit') then amount else -amount end) as adjustment_total
  from public.supplier_adjustments group by supplier_id
) adj on adj.supplier_id = s.id;

create or replace view public.v_customer_outstanding as
select
  c.id as customer_id,
  c.business_code,
  c.name,
  coalesce(inv.invoice_total,0) - coalesce(pay.payment_total,0) as outstanding
from public.customers c
left join (
  select billing_customer_id as customer_id, sum(amount_due + advance_applied) as invoice_total
  from public.invoices where status <> 'cancelled' group by billing_customer_id
) inv on inv.customer_id = c.id
left join (
  select customer_id, sum(amount) as payment_total from public.customer_payments group by customer_id
) pay on pay.customer_id = c.id;

-- ============================================================
-- Updated-at triggers
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'purchases','purchase_lines','purchase_receipts','purchase_receipt_lines','purchase_returns',
    'orders','order_lines','dispatches','sales','invoices','customer_returns',
    'inventory_batches','stock_reservations','recipes','production_batches','supplier_adjustments'
  ] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ============================================================
-- RLS
-- MVP foundation: authenticated users can operate approved business data.
-- Detailed role/permission matrix remains OPEN in v1.4 and is not guessed here.
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'purchases','purchase_lines','purchase_receipts','purchase_receipt_lines','purchase_inspections','purchase_returns','purchase_return_lines','supplier_adjustments','purchase_attachments',
    'inventory_batches','inventory_transactions','stock_reservations','stock_outs','stock_adjustments','opening_stock',
    'recipes','recipe_versions','recipe_lines','production_batches','production_consumption','production_outputs','production_wastage',
    'orders','order_lines','order_revisions','dispatches','dispatch_lines','sales','sale_lines','invoices','invoice_lines','customer_returns','customer_return_lines',
    'supplier_payments','supplier_payment_allocations','customer_payments','customer_payment_allocations','supplier_advances','customer_advances'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'authenticated_manage_' || t, t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', 'authenticated_manage_' || t, t);
  end loop;
end $$;

-- Views inherit underlying-table RLS for direct access; no write policies are created.

comment on table public.inventory_batches is 'FIFO inventory batches. Physical stock is reduced by explicit inventory transactions such as dispatch, production consumption and stock-out.';
comment on table public.inventory_transactions is 'Authoritative stock movement ledger. Reservations are commitments and are not inventory movements.';
comment on table public.dispatches is 'Physical dispatch event; this is the single approved finished-product stock reduction point in the Dispatch -> Sale -> Invoice flow.';
comment on table public.sales is 'Financial sale created from approved order/dispatch. It must not independently reduce inventory.';
comment on table public.invoices is 'Invoice generated from Sale; no duplicate business-data entry and no independent stock reduction.';
comment on table public.purchase_receipt_lines is 'Physical receipt quantities are separate from billed purchase quantities; only accepted quantity becomes usable inventory.';
