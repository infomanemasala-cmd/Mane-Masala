# Mane Masala — Integrated Test Matrix

## Customer permutations
1. Direct customer, one item, existing finished stock.
2. Direct customer, many items, mixed stock availability.
3. Direct customer, production required.
4. Direct customer, mixed existing stock + production.
5. Sub-Agent with existing end customer.
6. Sub-Agent with named unregistered end customer.
7. Sub-Agent with anonymous end customer.
8. One entry session containing multiple separate orders.
9. One order with multiple item lines.
10. Partial production.
11. Partial dispatch.
12. Customer change after production starts → revision.
13. Cancellation after planning/production with history preserved.
14. Multiple recipe versions → explicit selection.
15. No recipe → clear blocking warning, no guessing.
16. Insufficient ingredient stock → shortage/need to purchase.
17. Reserved stock cannot be consumed by another order.

## Purchase permutations
1. One bill/one item; one bill/many items.
2. Missing supplier invoice/slip reference; system-generated Purchase No.
3. Duplicate invoice/reference warning where applicable.
4. Missing rate calculated only from reliable data and shown/confirmed.
5. Full receipt.
6. Partial receipt/shortage.
7. Supplier rejects shortage/damage.
8. Supplier gives credit/refund.
9. Replacement later received and linked to original purchase/line.
10. Partial supplier return.
11. Multiple supplier payments against one purchase.
12. One supplier payment across multiple purchases.
13. Supplier advance.
14. Attachment added after manual/Excel import.

## Inventory/FIFO
- FIFO across multiple physical receipt batches.
- Reserved vs available stock.
- Stock out.
- Positive/negative adjustment.
- Negative stock safeguards.
- Expiry/low-stock visibility.
- Production consumption FIFO.
- Production output batch.
- Dispatch consumes reserved/FIFO stock exactly once.

## Production
- Recipe version selected and preserved.
- Recipe scaled to demand.
- Actual consumption differs from standard.
- One-time variance.
- Standard recipe change creates new version.
- Partial production.
- Intermediate consumption.
- Wastage.
- Cannot consume stock reserved for another order.

## Dispatch/Sale/Invoice
- Full/partial/multiple dispatches.
- Financial creation derives from actual approved dispatch.
- Sale once, invoice once.
- No second inventory reduction.
- Customer return after sale.

## Payments
- One invoice/purchase, one payment.
- Multiple payments to one document.
- One payment across multiple documents.
- Customer/supplier advances.
- Partial payment.
- Outstanding reconciliation.

## Evidence required
For each realistic scenario record stock, reserved, available, FIFO batches, consumption, output, dispatch, sale, invoice, outstanding, allocations, advances and audit evidence. A build pass is not business-flow evidence.
