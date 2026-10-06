# Mane Masala Project Bible — Forensic Archive

**Archive date:** 2026-10-06. Documentation-only forensic recovery; secrets excluded.

## Customers
Customers have permanent business codes, types, contact/business fields and archive lifecycle. Orders/sales/invoices form the financial relationship; payments/allocations/advances reconcile it. Customer returns are inspection-controlled and do not automatically become saleable. LIVE has customer_returns, customer_return_lines and customer_adjustments, but no dedicated customer-return RPC was found in the public routine inventory, leaving a write-path gap.