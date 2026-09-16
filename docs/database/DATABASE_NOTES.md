# Mane Masala — Database Continuity Notes

## Logical groups
Masters: id_sequences, units, categories, items, item_types, suppliers, customers, sub_agents, business_settings.

Purchasing: purchases, purchase_lines, purchase_receipts, purchase_receipt_lines, purchase_inspections, purchase_returns, purchase_return_lines, supplier_adjustments, purchase_attachments.

Inventory: inventory_batches, inventory_transactions, stock_reservations, stock_outs, stock_adjustments, opening_stock.

Recipes/Production: recipes, recipe_versions, recipe_lines, production_batches, production_batch_plan_lines, production_consumption, production_outputs, production_wastage.

Orders/Sales: orders, order_lines, order_revisions, dispatches, dispatch_lines, sales, sale_lines, invoices, invoice_lines, customer_returns, customer_return_lines.

Money: supplier_payments, supplier_payment_allocations, supplier_advances, customer_payments, customer_payment_allocations, customer_advances.

System: audit_logs and related application/audit infrastructure.

## Integrity rules
Use stable internal PKs, permanent human-readable business IDs, FKs, controlled statuses, centralized reference generation, database transactions for stock/financial operations and audit history.

Core relationships:
Business event → stock movement → inventory batch.
Recipe Version → Production Batch → Consumption → Output → Inventory Batch.
Customer → Order → Order Lines → Reservation/Production → Dispatch → Sale → Invoice → Payment.

Payments use allocation records because one payment can cover multiple documents and one document can have multiple payments.

## Security
RLS is enabled across public business tables according to the current Master State. Authentication is through Supabase Auth. Critical workflows use controlled database/server operations where designed.

## Migration discipline
Migrations are append-only corrections. Never rewrite historical production/purchase data to hide an error. Use a new migration, reversal, return, adjustment or correction record.
