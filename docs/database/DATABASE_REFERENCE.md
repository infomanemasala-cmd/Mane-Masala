# Mane Masala — Database Reference

Supporting reference; verify live schema before implementation.

## Logical groups
### Masters
`id_sequences`, `units`, `categories`, `items`, `item_types`, `suppliers`, `customers`, `sub_agents`, `business_settings`.

### Purchasing
`purchases`, `purchase_lines`, `purchase_receipts`, `purchase_receipt_lines`, `purchase_inspections`, `purchase_returns`, `purchase_return_lines`, `supplier_adjustments`, `purchase_attachments`.

### Inventory
`inventory_batches`, `inventory_transactions`, `stock_reservations`, `stock_outs`, `stock_adjustments`, `opening_stock`.

### Recipes / Production
`recipes`, `recipe_versions`, `recipe_lines`, `production_batches`, `production_batch_plan_lines`, `production_consumption`, `production_outputs`, `production_wastage`.

### Orders / Sales
`orders`, `order_lines`, `order_revisions`, `dispatches`, `dispatch_lines`, `sales`, `sale_lines`, `invoices`, `invoice_lines`, `customer_returns`, `customer_return_lines`.

### Money
`supplier_payments`, `supplier_payment_allocations`, `supplier_advances`, `customer_payments`, `customer_payment_allocations`, `customer_advances`.

### System
`audit_logs` and attachment/audit infrastructure.

## Important views / read models
Known project views include inventory-current, supplier-outstanding, customer-outstanding, operational order/production/purchase lists and Urgent Procurement support.

## Critical functions / business operations
The project contains controlled operations for order entry/planning/confirmation, production approval/start/completion, dispatch/sale/invoice, purchase entry/receipt, stock-out/adjustment, supplier/customer payments and allocations, returns/adjustments and recipe versioning. Exact live signatures must always be inspected before calls.

## Integrity rules
- Stable UUID primary keys plus permanent human-readable business codes.
- Foreign keys and controlled status values.
- Critical operations are transactional and should be idempotent.
- Audit events record important business actions.
- No direct current-stock editing.
- FIFO is batch/date based.
- Payment allocations connect payments to purchases/invoices.

## Important Phase 4 corrections recorded in repository
- UUID wrapper volatility corrected from an incorrect immutable declaration to volatile.
- Purchase-to-base-unit conversion was installed so transaction quantity and base-unit inventory are distinct and conversion occurs once.
- Physical receipt date is preserved for FIFO batch date; receipt event timestamp remains the event timestamp.
- Supplier payment allocation due now accounts for supplier credit/refund adjustments and synchronizes purchase financial status.
- Partial-approval reservation scaling was corrected so an existing capped reservation is not scaled a second time.
- Purchase claim/settlement fields support supplier response and credit/refund/dispute recording.

## Migration discipline
Migration files are append-only. Do not rewrite historical migrations to hide a defect. If a correction is needed, add a new migration. Confirm the live migration registry because repository presence does not prove that a migration is active in Supabase.
