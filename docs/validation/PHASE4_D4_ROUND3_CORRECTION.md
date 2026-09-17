# MANE MASALA — PHASE 4 D4 ROUND 3 CORRECTION
## Supplier Outstanding View — Partial-Returned Purchase

**Date:** 2026-09-17  
**Scope:** Investigation and narrowly scoped SQL/view correction only.  
**Runtime retest after correction:** Explicitly NOT performed.

## 1. Executive Result

The D4 discrepancy was confirmed as a supplier-outstanding reporting defect in the prior runtime evidence: a purchase with payable 200.00, supplier credit 10.00 and payment 100.00 had a real remaining supplier balance of 90.00, but the prior `v_supplier_outstanding` logic excluded the purchase while its `workflow_status` was `partial_returned`.

The underlying business model remains:

> Purchase payable − supplier credit/refund adjustments − payment allocations = supplier outstanding

The investigation confirmed that supplier-return workflow state and supplier financial state are separate concerns. A completed supplier return moves the purchase workflow to `partial_returned`, while the purchase can still have `financial_status = partially_paid` and a genuine outstanding balance.

## 2. Investigation Findings

### 2.1 Purchase workflow states

The live `purchases.workflow_status` constraint contains:

- `received`
- `inspected_stock`
- `inspected_invoice`
- `returned`
- `partial_returned`
- `completed`
- `cancelled`

The live supplier-return status constraint contains:

- `pending`
- `approved`
- `completed`
- `cancelled`

`record_supplier_return` creates a completed supplier return and sets the related purchase to `partial_returned`. `complete_purchase_inspection` explicitly accepts `partial_returned` and can subsequently move the purchase to `completed`. Therefore `partial_returned` is a legitimate transitional purchase workflow state after a supplier return; it is not a financial settlement state.

### 2.2 Financial state is authoritative for outstanding

`purchases.financial_status` remains the financial state used by the supplier payment RPCs. The corrected payment RPCs calculate purchase due using purchase payable less approved supplier credit/refund adjustments and prior supplier payment allocations.

The investigation therefore found no basis for treating `partial_returned` as financially settled.

### 2.3 Historical restriction

An earlier migration was named `restrict_supplier_outstanding_to_completed_purchases`, establishing the historical implementation choice that caused the discrepancy. That restriction is incompatible with the later approved Phase 4 supplier-credit/payment reconciliation rule when a legitimately outstanding purchase is in `partial_returned` state.

The current live `v_supplier_outstanding` definition no longer uses `workflow_status = 'completed'` as its inclusion condition. It selects purchases by financial state (`unpaid` or `partially_paid`) and calculates the outstanding amount from the authoritative payable, supplier credit/refund adjustments and payment allocations.

### 2.4 Double-counting check

The corrected view uses one aggregated supplier-adjustment subquery per purchase for adjustment types `credit` and `refund`, and one aggregated supplier-payment-allocation subquery per purchase. The purchase-line aggregation remains grouped by purchase. This preserves the existing equation without adding supplier-return `credit_amount` separately on top of the corresponding `supplier_adjustments` row.

Payments are taken from `supplier_payment_allocations`, not from the supplier payment header, so payment amounts are not double-counted.

### 2.5 Fully paid partial returns

A `partial_returned` purchase with `financial_status = paid` is excluded from the purchase-level outstanding calculation. This preserves the required result that a fully paid supplier-returned purchase does not appear as outstanding merely because of its workflow state.

## 3. Master State / Business-Rule Alignment

The correction aligns with the current authoritative Master State v1.6 and approved Decision Register, especially:

- Supplier claim settlement: honoured supplier claims reduce payable only through explicit credit/refund/adjustment.
- Supplier returns: returns link to the original purchase/purchase line and are separate auditable transactions.
- Payments and allocations: supplier payments are separate transactions with allocation records.
- Supplier credit/refund reconciliation: supplier outstanding follows purchase payable − supplier credit/refund adjustments − supplier payment allocations.

The correction does not introduce a new financial model, change payable calculation, change payment allocation logic, or redesign supplier returns.

## 4. Exact Correction

The relevant view is defined as a purchase-level financial calculation using:

1. purchase line totals;
2. purchase-level discount and charges/tax;
3. approved supplier `credit` / `refund` adjustments;
4. supplier payment allocations;
5. financial-status eligibility of `unpaid` / `partially_paid`.

The view no longer requires `workflow_status = 'completed'` for an outstanding purchase.

The corrected SQL is limited to `public.v_supplier_outstanding`.

## 5. Live Environment Evidence

**Supabase project:** `fogdwzpfudbktncajesk`  
**Live migration registry entry:** `20260917135835 — phase4_d4_supplier_outstanding_partial_returned`

The live registry already contained this exact narrowly scoped D4 correction before this correction task began. Read-only inspection confirmed the live `v_supplier_outstanding` definition is the corrected financial-state-based definition.

Because the correction was already present in LIVE, no second migration was applied. Reapplying the same logical correction would have created an unnecessary duplicate migration and would not have been a safe minimum-change action.

## 6. Repository Synchronization

The repository did not contain the live migration source file even though LIVE already registered migration version `20260917135835`.

A source-of-truth migration file has therefore been added to the repository:

`supabase/migrations/20260917135835_phase4_d4_supplier_outstanding_partial_returned.sql`

This records the exact live view correction and is a repository synchronization of the already-applied migration, not a second database correction.

**Repository migration commit:** `9a83447456954e67f94f50152df5e588c9007de6`

Documentation is committed separately after the migration source.

## 7. Safety Confirmation

During this task:

- No real business data was modified.
- No historical business data was modified.
- No Phase 4 test data was cleaned up.
- No migration history was edited.
- No unrelated schema was changed.
- No RLS or security policy was changed.
- No payment records were rewritten.
- No supplier-return records were rewritten.
- No supplier-return workflow was redesigned.
- No payment allocation logic was changed.
- No purchase payable calculation was changed.

## 8. Runtime Retest Status

**NO D4 RUNTIME RETEST WAS PERFORMED AFTER THE CORRECTION.**

The live state was inspected read-only to determine whether the correction was already present. That inspection is not treated as runtime certification.

Therefore:

- D4 is **NOT runtime-verified** by this task.
- `v_supplier_outstanding` is **NOT runtime-verified** by this task.
- The existing controlled Phase 4 test records remain available for the next separate runtime validation.

## 9. Next Required Validation

The next separate task must runtime-test at minimum:

1. Full-payment-after-credit scenario: 200.00 payable − 10.00 credit − 190.00 payment = 0.00.
2. Partial-payment-after-credit scenario: 200.00 payable − 10.00 credit − 100.00 payment = 90.00, with `partial_returned` workflow state visible in supplier outstanding.
3. Fully paid `partial_returned` purchase remains at zero outstanding.
4. Supplier-return credit/refund is not double-counted.
5. Payment allocation is not double-counted.
6. Existing discount and purchase-charge components remain part of payable.

No such runtime test was performed in this correction task.

## 10. Final Status

# NOT READY FOR NEXT VALIDATION

This correction addresses the identified D4 supplier-outstanding view defect at the SQL definition level, but runtime verification remains a separate required step.
