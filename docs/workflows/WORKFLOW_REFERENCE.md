# Mane Masala — Workflow Reference

Supporting workflow reference. Current authoritative state remains MM-BUSINESS-SPEC-1.6.

## Customer
Customer calls → Order raised → Order Plan prepared → stock/reservations checked → recipe version selected when required → production requirement calculated → wife reviews/approves → Order Confirmed → reserved stock and/or production → actual production → Ready → Dispatch → Sale + Invoice → Payment/Outstanding → Reports.

One entry session may capture multiple separate orders. Each order remains a permanent transaction. One order may contain multiple item lines.

## Purchase
**Purchase → Receive → Inspect → Accept / Shortage / Reject-Damage / Return → Inventory → Supplier Payable → Payment.**

### Step 1 — Purchase entry
Select supplier once. System generates Purchase No. Record supplier/shopkeeper slip/bill reference separately when available. Enter many purchased item lines. Show user-relevant supplier/business information; do not make technical UUIDs the primary user-facing field.

### Step 2 — Receive & inspect
For each line enter what physically arrived:
- Billed
- Received
- Accepted
- Rejected / Damaged

The system calculates shortage = Billed − Received. Accepted enters usable stock. Rejected/damaged does not become usable stock automatically.

### Step 3 — Resolve the line discrepancy
For every affected line, record supplier response:
- Waiting for supplier
- Supplier will honour
- Supplier will not honour

If honoured: choose Credit or Refund. System calculates affected value and records the supplier adjustment, reducing payable by the agreed amount.

If refused: preserve the original payable and mark the affected amount Disputed/Pending. Do not silently reduce the bill.

If replacement is promised and later supplied: receive it as a linked replacement against the original purchase/purchase line. Do not create an unrelated purchase merely to make stock appear.

If goods are physically returned: use linked supplier-return/purchase-return records; multiple returns are allowed.

### Step 4 — Complete purchase
Show a complete summary: original bill, accepted stock, rejected/damaged, shortage, agreed credit/refund, disputed/pending amount and resulting payable. Then provide one clear next action to supplier payment.

## Production
Order production requirement → Recipe Version → Batch → Ingredient Requirement → FIFO/availability → Wife Approval → Start → Actual Consumption → Actual Output → Wastage → Inventory.

## Dispatch / finance
Ready → Dispatch actual quantity → physical stock reduced once → Sale derived from Dispatch → Invoice derived from Sale → Payment/allocation. Sale and Invoice do not reduce stock again.

## Returns
Customer: Return Received → Inspect → Approve → Stock/Financial Adjustment.
Supplier: linked return against original purchase/purchase line; accepted supplier return removes stock and preserves the original purchase.

## Navigation principle
Operational pages should show the current document, what has already happened, what remains to be done and exactly one obvious next action. Do not force the wife to understand database statuses to proceed.
