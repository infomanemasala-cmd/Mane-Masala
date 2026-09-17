# MANE MASALA — Phase 4 Runtime Defect Correction Round 2

**Date:** 2026-09-17  
**Environment:** LIVE Supabase project `fogdwzpfudbktncajesk`  
**Repository:** `infomanemasala-cmd/Mane-Masala`  
**Implementation commit:** `b4aac276440d38610e4d919a505318578d4c7724`  
**Live migration version:** `20260917133521`  
**Live migration name:** `phase4_runtime_defect_fix_round2`

## Scope

This round corrects only the two runtime defects identified by the post-D1–D4 retest:

1. F-08 completed-dispatch idempotency ordering.
2. D4 supplier-payment SQL grouping error.

No real Mane Masala business data was imported. No existing Phase 4 controlled test data was deleted or cleaned. No historical business transaction was rewritten. No migration history was manually edited.

## 1. F-08 — Completed-dispatch idempotency

### Runtime defect

The completed FIFO-split dispatch had two dispatch lines for one order line. An identical retry returned `Order is not ready for dispatch` instead of `idempotent_retry=true`.

### Root cause

The live `dispatch_order(uuid,date,text,jsonb)` function performed the normal order-status rejection before constructing/comparing the normalized request against existing completed dispatches.

Because a completed dispatch changes the order status to `dispatched`, the retry could never reach the existing idempotency branch.

### Exact affected function

`public.dispatch_order(uuid,date,text,jsonb)`

### Correction

The function now performs the following sequence after safely locking the order:

1. Validate dispatch method normalization.
2. Lock/read the order.
3. Validate the incoming lines are a JSON array with at least one line.
4. Normalize the incoming request into order-line/quantity pairs.
5. Search completed dispatches for the same order, dispatch date and normalized method.
6. Aggregate existing dispatch lines by `order_line_id` using `sum(quantity)` before comparison.
7. Return the existing dispatch with `idempotent_retry=true` when the request is identical.
8. Only if no exact retry exists, apply the normal order-status/readiness validation.
9. Continue with the existing FIFO and partial-dispatch movement logic.

The normal validation for new/different dispatch requests was not weakened.

The authoritative identity comparison remains:

- same order
- same dispatch date
- normalized dispatch method
- same requested order-line quantities
- existing completed dispatch
- FIFO-split lines aggregated by `order_line_id`

No new idempotency key or alternate identity model was introduced.

## 2. D4 — Supplier payment SQL/grouping error

### Runtime defect

The corrected supplier payment path failed with:

`column "p.discount_amount" must appear in the GROUP BY clause or be used in an aggregate function`

### Root cause

The Round 1 D4 correction calculated an aggregate of `purchase_lines` while simultaneously selecting purchase-level columns (`discount_amount`, charges and tax) from the joined `purchases` row without grouping those purchase-level columns.

The failing pattern was present in all three corrected supplier payment RPCs:

- `record_supplier_payment`
- `record_supplier_payment_allocated`
- `record_supplier_payment_allocations`

### Correction

The payment calculation now reads the purchase-level fields from exactly one `purchases` row and calculates line totals, supplier credit/refund adjustments, and prior payment allocations through scalar correlated aggregate subqueries.

The authoritative financial equation is preserved:

`purchase payable - supplier credit/refund adjustments - supplier payment allocations = supplier outstanding`

Purchase-level discount and charges remain part of the payable calculation. Supplier credits/refunds remain deductions. Existing payment allocations remain deductions.

No financial transaction was deleted or rewritten.

### Other supplier-payment functions inspected

The live database was inspected for supplier-payment RPCs using the same `discount_amount` + joined-purchase grouping pattern.

The old grouping pattern is no longer present in the supplier payment RPCs.

The three affected functions are now using the scalar purchase-row calculation described above.

## 3. Master State alignment

The correction remains aligned with `MM-BUSINESS-SPEC-1.6` and the supporting Business Rules Reference:

- Dispatch owns finished-stock reduction exactly once.
- Partial dispatch remains allowed.
- FIFO physical consumption remains batch-date based.
- Payment transactions remain separate from allocation records.
- Supplier credit/refund adjustments reduce the authoritative payable.
- Outstanding is calculated from payable/receivable values and allocations.
- Historical transactions are preserved and corrected through auditable workflow rather than deletion.

No Master State business rule was changed by this round.

## 4. Exact files changed

Repository file added:

`supabase/migrations/20260917190000_phase4_runtime_defect_fix_round2.sql`

Repository validation document added:

`docs/validation/PHASE4_RUNTIME_DEFECT_FIX_ROUND2.md`

Implementation commit:

`b4aac276440d38610e4d919a505318578d4c7724`

## 5. Live application

The exact Round 2 migration was applied to LIVE Supabase through the supported migration mechanism.

Live registry version assigned by Supabase:

`20260917133521`

Live migration name:

`phase4_runtime_defect_fix_round2`

Existing migrations were not reapplied.

Migration history was not manually edited.

## 6. Post-application verification

Read-only verification confirmed:

- `dispatch_order(uuid,date,text,jsonb)` contains the idempotency lookup before normal readiness rejection.
- Existing FIFO-split dispatch lines are aggregated by `order_line_id` with `sum(quantity)` for retry comparison.
- The function still contains the normal readiness check after the retry branch.
- All three supplier payment RPCs contain the corrected scalar purchase-row payable calculation.
- No supplier payment RPC retains the prior `join public.purchases p` + aggregate + ungrouped purchase-column pattern.
- No unexpected migration was applied during this correction.

This is implementation/live-definition verification only, not runtime certification.

## 7. Safety assessment

**Non-destructive:** Yes.

The migration only replaces the two affected workflow function definitions. It does not delete, rewrite, backfill, or alter historical transaction rows.

Existing controlled Phase 4 test data remains present.

No real business data was imported or intentionally modified.

No unrelated module or business rule was changed.

## 8. Runtime tests still required

The following must still be executed before either defect can be declared runtime-fixed:

### F-08

- Repeat the identical completed FIFO-split dispatch request.
- Confirm `idempotent_retry=true`.
- Confirm the original dispatch ID is returned.
- Confirm no new dispatch, dispatch lines or inventory transactions are created.
- Confirm no additional stock depletion occurs.
- Confirm reservations are not consumed again.
- Submit a genuinely different legitimate partial dispatch where applicable and confirm it remains accepted.
- Submit a different/invalid request against a completed order and confirm it is not incorrectly treated as an idempotent retry.

### D4

- Re-run the controlled `200.00 - 10.00 - 190.00 = 0.00` scenario using the canonical supplier payment RPC.
- Confirm supplier credit is included.
- Confirm payment allocation is created once.
- Confirm supplier outstanding is `0.00`.
- Confirm purchase financial status is `paid`.
- Confirm no duplicate/orphan financial records.
- Run the controlled partial scenario `200.00 - 10.00 - 100.00 = 90.00` if safely possible.
- Confirm `partially_paid` status and remaining outstanding are consistent.
- Verify discount handling with a controlled discount-bearing purchase when included in the runtime validation scope.

## 9. Final status

**NOT READY FOR NEXT VALIDATION**

This status is mandatory until the corrected F-08 and D4 runtime tests have actually passed. It does not represent a real-data readiness decision.
