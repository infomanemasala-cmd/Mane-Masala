# Phase 4 Combined Fix — F-03 + F-08 + F-10

**Scope:** reservation lifecycle consistency, dispatch retry/idempotency, customer-return financial adjustment only.

**Baseline preserved:** F-01/F-11 blocker fix `f45db1d344d483c2c83267eee12fea71d5666cc8`; F-02 `1bca1cc07b73c2b87993cbc8a6ad12761047764`; F-07 `92917adb0fca98952f6b261947956d78bc6f4f69`.

## Before / gap

### F-03
`v_inventory_current` and availability logic treated both `active` and `issued` reservations as committed stock, while duplicate-planning protection and dispatch reservation consumption used only `active` in key paths. This allowed lifecycle state treatment to diverge.

### F-08
`dispatch_order` generated a new dispatch ID on every call. There was no request token. A retry of a partial dispatch could therefore create another physical dispatch if quantity remained.

### F-10
Customer returns already implemented Received → Inspected → Approved → Completed and approved-saleable stock restoration, but `refund_amount` was only stored on `customer_returns`; no corresponding customer financial record was created.

## Corrections

### F-03
`prepare_order_plan` now treats `active` and `issued` consistently for duplicate planning protection. `dispatch_order` now consumes reservations in either `active` or `issued` state. Existing availability calculations and production reservation handling already used both states and were preserved. No new status was introduced.

Reservations remain commitments only; physical inventory is still reduced by dispatch/production workflows, not by reservation creation.

### F-08
`dispatch_order` now derives a deterministic request representation from order-line quantities and checks existing dispatched records for the same order, dispatch date, normalized method, and aggregated order-line quantities. If an identical completed request already exists, it returns that dispatch ID without creating another dispatch or moving stock.

The comparison aggregates existing dispatch lines by `order_line_id`, because one physical dispatch can legitimately span multiple FIFO batches. Different partial quantities remain eligible for separate dispatches.

The order row is locked before the duplicate check, so concurrent identical submissions serialize through the same order lock.

### F-10
Added `customer_adjustments` as the customer-side financial adjustment record linked directly to `customer_returns`, with a unique `customer_return_id`. `approve_customer_return` now creates one `refund` adjustment when `refund_amount > 0` in the same transaction as approval/stock restoration.

This preserves the existing return lifecycle and prevents a second refund for the same return through the unique link plus the existing `status='inspected'` approval gate.

Returned goods are not automatically saleable; only `approved_saleable_quantity` creates restored stock, as before.

## Static validation performed

- Re-read all changed SQL after commit.
- Checked all reservation state references in the corrected planning/dispatch paths.
- Confirmed no new reservation status was introduced.
- Confirmed dispatch duplicate comparison is based on requested order-line quantities, not individual FIFO-split dispatch rows.
- Confirmed partial dispatch remains possible because only an identical request is treated as an idempotent retry.
- Confirmed physical dispatch inventory writes occur only after the idempotency check and remain inside the existing transactional function.
- Confirmed customer-return refund is linked to customer, return, and optional invoice.
- Confirmed one-to-one `customer_return_id` uniqueness prevents duplicate financial adjustment records.
- Confirmed the customer-return stock restoration remains limited to approved-saleable quantity.
- Confirmed F-01/F-11, F-02, and F-07 migration logic was not modified by these fixes.
- Confirmed no production, recipe, unit-conversion, FIFO receipt-date, supplier-return, reporting, or UI logic was changed by these fixes.

## Runtime verification required

Not performed and not claimed.

Required live tests:

1. Create/issue a reservation and verify availability, planning protection, production/dispatch consumption, and release/consumption state transitions.
2. Perform a partial dispatch, repeat the exact same submission, and verify exactly one physical stock movement/dispatch record.
3. Perform a second legitimate partial dispatch with a different quantity and verify it remains possible.
4. Test concurrent identical dispatch submissions against the same order.
5. Complete a customer return with zero refund and with a positive refund; verify stock and financial effects.
6. Retry/attempt duplicate customer-return approval and verify no second refund or second stock restoration.
7. Reconcile customer return, adjustment, inventory, sale/invoice, and audit history.

## Status

Static implementation correction complete. Runtime verification remains pending. No final release/readiness approval is implied.

## Implementation commits

- `aac7c0e43beb82807b0156833c0b245ec75dc742` — combined F-03/F-08/F-10 implementation.
- `f2cf124e1e3b04c3bdbf14528833332490078f81` — F-08 aggregation correction identified during static inspection.
- Documentation commit follows this report.
