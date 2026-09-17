-- Phase 4 revalidation: a supplier invoice/slip reference must not be entered twice for the same supplier.
-- Different suppliers may legitimately use the same invoice number, so the guard is supplier-scoped.
create unique index if not exists purchases_supplier_invoice_number_unique
  on public.purchases (supplier_id, supplier_invoice_number)
  where supplier_invoice_number is not null
    and btrim(supplier_invoice_number) <> '';
