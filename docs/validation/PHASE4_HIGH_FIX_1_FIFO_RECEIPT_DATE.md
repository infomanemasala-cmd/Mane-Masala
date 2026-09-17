# Phase 4 High Fix 1 — F-02 FIFO Receipt-Date Fidelity

**Repository:** `infomanemasala-cmd/Mane-Masala`  
**Baseline:** `f45db1d344d483c2c83267eee12fea71d5666cc8`  
**Fix commit:** `a89f0fb01c3dda288d97a05c1d627f0a52b32ace`

## Finding

`receive_purchase(...)` already persisted the line-level `received_batch_date` in `purchase_receipt_lines`, but populated `inventory_batches.batch_date` from `p_received_at::date`.

## Correction

The receiving workflow now resolves one `v_received_batch_date` per receipt line:

`coalesce(line.received_batch_date, p_received_at::date)`

That value is used for both the stored `purchase_receipt_lines.received_batch_date` and the created `inventory_batches.batch_date`.

Therefore, when the physical receipt date is supplied on the line, that physical date is the FIFO batch date. The function-level receive timestamp is retained for the receipt/transaction event timestamp and only remains the fallback when no physical batch date is supplied.

## Preserved behaviour

- Accepted quantity remains the only quantity inserted into usable `inventory_batches`.
- Received/rejected/replacement quantity calculations are unchanged.
- Purchase inspection and workflow status handling are unchanged.
- No unit conversion, reservation, dispatch, production, return, or RLS logic was changed.
- No schema redesign was introduced.

## Validation performed

Static source inspection only, as requested:

1. Inspected the existing `receive_purchase(...)` implementation.
2. Confirmed `received_batch_date` was stored in `purchase_receipt_lines`.
3. Confirmed the prior `inventory_batches.batch_date` source was `p_received_at::date`.
4. Inspected the replacement SQL and confirmed `inventory_batches.batch_date` now receives `v_received_batch_date`.
5. Checked the affected receiving workflow's `batch_date` references: the inventory batch uses the physical line date; `inventory_transactions.occurred_at` continues to use `p_received_at` as the event timestamp.
6. Confirmed no billed/document date was introduced as the FIFO date.

## Runtime verification still required

A live receiving test must verify that a receipt supplied with a physical `received_batch_date` produces an inventory batch with exactly that date and that subsequent FIFO consumption orders that batch by physical batch date. No runtime database test was performed in this change.

## Remaining findings

F-03 through F-12 remain intentionally untouched. F-01/F-11 blocker policies were not modified.
