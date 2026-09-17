# Mane Masala — Business Rules Reference

This is a supporting reference. `MM-BUSINESS-SPEC-1.6` remains authoritative.

## 1. Inventory equation
**Opening Stock + Receipts + Production In − Dispatch − Production Consumption − Stock-outs − Returns ± Adjustments = Current Stock**.

**Available Stock = Current Stock − Active Reservations.** Reservation never moves physical stock.

## 2. FIFO
FIFO uses the actual physical receipt/production date and inventory batches. It applies to dispatch, production consumption, stock-outs and other physical consumption. Invoice date must not replace physical receipt date.

## 3. Purchase vs receipt
A Purchase is the business document. Receiving is the physical event. One supplier bill is one Purchase and may contain many lines. The system generates the permanent Purchase No.; a supplier/shopkeeper slip or bill reference is a separate optional physical-document reference.

## 4. Purchase receiving per line
For each purchase line record:
- Billed quantity
- Received quantity
- Accepted quantity
- Rejected/Damaged quantity

Validation: `Accepted + Rejected/Damaged = Received` and `Received <= Billed` for the normal receipt case. Shortage is calculated as `Billed - Received`. Only Accepted quantity enters usable inventory.

## 5. Shortage / damage / supplier response
The original bill and its billed quantity remain historically preserved. A shortage or rejected/damaged quantity creates a discrepancy record.

For every affected line, record the supplier response:
- Pending / waiting for supplier
- Supplier will honour
- Supplier will not honour

If the supplier honours the claim, record the agreed settlement as **credit** or **refund**. The system calculates the affected value from the purchase line and records the supplier adjustment; payable is reduced only by the agreed adjustment.

If the supplier refuses to honour the claim, the original payable is **not** silently reduced. The affected value remains **Disputed** and traceable. This preserves the financial dispute without pretending that the supplier accepted the claim.

If a replacement quantity is supplied later, it is a **linked replacement receipt against the original purchase/purchase line**, not a new unrelated purchase.

If goods are physically returned to the supplier, use the linked supplier return/purchase return workflow. Multiple returns may be linked to one purchase line.

## 6. Purchase summary
The review must preserve a complete line-level and document-level breakdown showing billed, received, accepted, shortage, rejected/damaged, supplier response, agreed credit/refund, disputed/pending amount and resulting payable. The wife should not calculate refund/credit values manually.

## 7. Recipes
Recipe input quantities define formulation. Expected finished output is independent. Scale ingredients by:
`required finished output / recipe expected output`.

Do not assume ingredient weight equals finished output weight. Actual ingredient consumption and actual finished output are authoritative. Standard recipe changes create a new version; one-time variance affects only the batch.

## 8. Orders
Order creation starts planning. Planning checks current/reserved/available finished stock, calculates shortfall, selects recipe version explicitly when needed, calculates production requirements and allows wife review before final confirmation.

One order may contain many lines. One entry session may contain multiple separate orders. Multi-line production approval may be independent where business conditions permit. Partial production, partial dispatch and mixed existing-stock + production fulfillment are allowed.

## 9. Dispatch / Sale / Invoice
Dispatch owns finished-stock reduction exactly once. Sale is derived from the actual approved Dispatch and Invoice is derived from Sale. Sale and Invoice must not reduce inventory again.

## 10. Payments
Customer and supplier payment directions are separate. Payments are independent transactions connected by allocation records. One payment may cover multiple documents and multiple payments may cover one document. Unallocated money is an explicit advance. Outstanding is calculated from authoritative payable/receivable values and allocations.

## 11. History
Never delete historical transactions to correct mistakes. Use returns, adjustments, reversals, revisions and linked corrections. Permanent business IDs remain stable.
