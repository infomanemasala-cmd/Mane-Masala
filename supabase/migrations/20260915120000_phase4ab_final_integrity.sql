-- MANE MASALA Phase 4A/4B final integrity migration.
-- This migration documents and reproduces the final backend hardening applied to production.
-- Critical operational ledgers are read-only to authenticated clients; workflow RPCs own mutations.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'orders','order_lines','order_revisions',
    'production_batches','production_batch_plan_lines','production_consumption','production_outputs','production_wastage',
    'stock_reservations','inventory_batches','inventory_transactions',
    'dispatches','dispatch_lines','sales','sale_lines','invoices','invoice_lines',
    'purchases','purchase_lines','purchase_receipts','purchase_receipt_lines','purchase_inspections',
    'customer_payments','customer_payment_allocations','customer_advances',
    'supplier_payments','supplier_payment_allocations','supplier_advances'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS authenticated_manage ON public.%I',t);
    EXECUTE format('DROP POLICY IF EXISTS authenticated_read ON public.%I',t);
    EXECUTE format('DROP POLICY IF EXISTS authenticated_read_only ON public.%I',t);
    EXECUTE format('CREATE POLICY authenticated_read_only ON public.%I FOR SELECT TO authenticated USING (true)',t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM authenticated',t);
  END LOOP;
END $$;

ALTER TABLE public.purchase_receipt_lines DROP CONSTRAINT IF EXISTS purchase_receipt_lines_check1;
ALTER TABLE public.purchase_receipt_lines ADD CONSTRAINT purchase_receipt_lines_check1
  CHECK (accepted_quantity + rejected_quantity = received_quantity);
ALTER TABLE public.purchase_receipt_lines DROP CONSTRAINT IF EXISTS purchase_receipt_lines_replacement_le_rejected;
ALTER TABLE public.purchase_receipt_lines ADD CONSTRAINT purchase_receipt_lines_replacement_le_rejected
  CHECK (replacement_quantity <= rejected_quantity);

ALTER TABLE public.order_lines DROP CONSTRAINT IF EXISTS order_lines_fulfilment_quantity_check;
ALTER TABLE public.order_lines ADD CONSTRAINT order_lines_fulfilment_quantity_check CHECK (
  COALESCE(reserved_quantity,0) >= 0 AND
  COALESCE(produced_quantity,0) >= 0 AND
  COALESCE(dispatched_quantity,0) >= 0 AND
  COALESCE(dispatched_quantity,0) <= ordered_quantity
);

CREATE UNIQUE INDEX IF NOT EXISTS sales_dispatch_id_unique ON public.sales(dispatch_id);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_sale_id_unique ON public.invoices(sale_id);

-- Canonical payment allocation RPCs are intentionally exposed only to authenticated users.
REVOKE EXECUTE ON FUNCTION public.record_customer_payment_allocated(uuid,numeric,date,text,jsonb,text,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.record_customer_payment_allocated(uuid,numeric,date,text,jsonb,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_supplier_payment_allocated(uuid,numeric,date,text,jsonb,text,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.record_supplier_payment_allocated(uuid,numeric,date,text,jsonb,text,text) TO authenticated;

-- Legacy mutation paths remain disabled.
REVOKE EXECUTE ON FUNCTION public.confirm_order_reserve(uuid) FROM public,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.record_customer_payment(uuid,numeric,date,text,uuid,text,text) FROM public,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.record_customer_payment_allocations(uuid,numeric,date,text,jsonb,text,text) FROM public,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.record_supplier_payment(uuid,numeric,date,text,uuid,text,text) FROM public,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.record_supplier_payment_allocations(uuid,numeric,date,text,jsonb,text,text) FROM public,anon,authenticated;
