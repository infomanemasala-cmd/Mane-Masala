# Mane Masala — Phase 4 Release Test Matrix

Status: **OPEN / NOT CLEARED** until evidence is recorded.

## Customer loop
- [ ] Direct customer, one item, existing finished stock
- [ ] Multi-line order with mixed stock availability
- [ ] Production required
- [ ] Mixed existing stock + production
- [ ] Direct customer
- [ ] Sub-Agent with existing end customer
- [ ] Sub-Agent with named unregistered end customer
- [ ] Sub-Agent anonymous end customer
- [ ] One session containing multiple separate orders
- [ ] Partial production
- [ ] Partial dispatch
- [ ] Customer change after production begins → revision
- [ ] Cancellation after planning/production preserves history
- [ ] Multiple recipe versions → explicit selection
- [ ] No applicable recipe → blocking warning, no guessing
- [ ] Ingredient shortage → purchase requirement
- [ ] Reserved stock cannot be consumed by another order
- [ ] Partial approval Case 1: 1 kg need / 0.6 kg supported → 0.6 approved, 0.4 remaining
- [ ] Partial approval Case 2: one ingredient short → Purchase Required until inward

## Purchase loop
- [ ] One bill / one item
- [ ] One bill / many items
- [ ] System-generated Purchase No.
- [ ] Optional supplier slip/bill reference
- [ ] Supplier name shown; no raw UUID as primary field
- [ ] Missing supplier invoice/reference
- [ ] Duplicate supplier invoice warning
- [ ] Missing rate handling
- [ ] Full receipt
- [ ] Partial receipt / shortage
- [ ] Rejected/damaged quantity
- [ ] Supplier honours → credit
- [ ] Supplier honours → refund
- [ ] Supplier refuses → dispute; payable not silently reduced
- [ ] Later linked replacement receipt
- [ ] Partial supplier return
- [ ] Attachment
- [ ] Multiple supplier payments against one purchase
- [ ] One supplier payment across multiple purchases
- [ ] Supplier advance

## Inventory/FIFO
- [ ] Reservation does not change physical stock
- [ ] Available = current − active reservations
- [ ] Purchase accepted quantity enters stock only once
- [ ] Unit conversion occurs exactly once
- [ ] Physical receipt date controls FIFO batch date
- [ ] FIFO across multiple receipt batches
- [ ] Production consumption FIFO
- [ ] Production output batch
- [ ] Dispatch consumes stock once
- [ ] Sale does not reduce stock
- [ ] Invoice does not reduce stock
- [ ] Stock-out
- [ ] Positive adjustment
- [ ] Negative adjustment without unexplained negative stock
- [ ] Supplier return reduces stock
- [ ] Approved customer return adds stock only after inspection/approval

## Production
- [ ] Recipe version selected and preserved
- [ ] Recipe scaled to demand
- [ ] Actual consumption differs from recipe
- [ ] One-time variance
- [ ] Standard recipe change creates new version
- [ ] Partial production
- [ ] Intermediate consumption
- [ ] Wastage
- [ ] Production remains demand-linked to Order/Order Line

## Dispatch / finance
- [ ] Full dispatch
- [ ] Partial dispatch
- [ ] Multiple dispatches for one order
- [ ] Sale created once
- [ ] Invoice created once
- [ ] No second inventory reduction
- [ ] Customer return linkage
- [ ] One invoice / one payment
- [ ] One invoice / multiple payments
- [ ] One payment / multiple invoices
- [ ] Customer advance
- [ ] Supplier equivalents
- [ ] Outstanding reconciliation

## Technical/release
- [ ] Build
- [ ] Lint
- [ ] Current production deployment READY
- [ ] No critical runtime errors
- [ ] Authenticated browser E2E
- [ ] Mobile operational E2E
- [ ] Shared DataTable page-by-page compliance
- [ ] Atomicity/idempotency
- [ ] Security/RLS review
- [ ] Report-to-transaction reconciliation
- [ ] Branding/logo verification
- [ ] No fake production records
