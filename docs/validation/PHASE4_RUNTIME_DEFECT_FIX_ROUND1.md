# MANE MASALA — PHASE 4 RUNTIME DEFECT CORRECTION ROUND 1

**Date:** 2026-09-17  
**Scope:** D1 UUID volatility, D2 F-07 purchase-unit conversion, D3 F-02 receipt-date fidelity, D4 supplier financial reconciliation only.  
**Real business data:** Not imported.  
**Existing Phase 4 test data:** Not cleaned or deleted.  
**Runtime readiness:** NOT READY FOR REAL DATA IMPORT.

## 1. Baseline and root-cause method

The correction was compared against the authoritative `MM-BUSINESS-SPEC-1.6` baseline and the repository's database continuity notes. The Master State requires transaction-based inventory, physical-date FIFO, explicit controlled units/conversions, preservation of historical purchase/receipt distinctions, allocation-based payments, explicit supplier claim/credit handling, and append-only corrections.

The live migration registry was inspected before correction. The relevant earlier migrations included the UUID wrapper compatibility migration, purchase write hardening, purchase settlement/outstanding corrections, the Phase 4 core backend audit fixes, F-12, F-03/F-08/F-10, and the F-08 aggregation correction. The live registry did **not** contain the repository's unregistered F-07 migration or the F-02 migration at the time of diagnosis.

## 2. D1 — UUID generator

### Root cause
**Classification:** incorrect function definition.

The live `public.gen_random_uuid()` wrapper was declared `IMMUTABLE` even though its body delegates to `extensions.gen_random_uuid()`, a random UUID generator. The live catalog confirmed `provolatile='i'` before correction. This is incompatible with the function's actual semantics and caused the observed primary-key collisions in multi-row operations such as `purchase_receipts` and FIFO-split `dispatch_lines`.

Repository inspection also identified the earlier migration `20260916153828_phase4j_fix_public_uuid_generator_compatibility.sql` as the source of the incorrect `IMMUTABLE` declaration. There was no later repository migration intentionally restoring correct volatility before this correction.

### Fix
Minimal DDL-only correction:

`alter function public.gen_random_uuid() volatile;`

No UUID primary keys were changed and no existing UUID values were replaced.

### Live verification
The corrected live catalog now reports `provolatile='v'`. Three successive evaluations returned three distinct UUID values in one SQL statement, demonstrating that the wrapper is no longer treated as immutable/constant.

## 3. D2 — F-07 purchase-unit conversion

### Root cause
**Classification:** missing/unapplied migration in the live database.

The live `create_purchase_entry` accepted a line but stored the selected unit as the item's `base_unit_id`; it did not expose the approved controlled purchase-unit factor. The live `receive_purchase` then used the purchase-line quantity directly for inventory. Consequently the controlled 250g example was stored as 250 base-unit Kg.

The repository already contained the approved F-07 implementation in `20260917140000_phase4_high_fix_2_unit_conversion.sql` from commit `92917adb0fca98952f6b261947956d78bc6f4f69`, but that migration was absent from the live migration registry during diagnosis. The live path therefore diverged because the approved migration had not been applied, not because an additional conversion was required.

### Fix
Applied the approved conversion implementation to the live path as migration `phase4_high_fix_2_unit_conversion`.

It installs `purchase_to_base_factor(item_id, unit_id)` and updates the existing `create_purchase_entry` and `receive_purchase` functions so that:

- purchase-line quantity remains in the selected purchase/transaction unit;
- the configured item purchase unit or item base unit is accepted;
- unrelated units are rejected;
- missing/invalid conversion is rejected;
- accepted quantity is converted exactly once at receipt;
- inventory batch quantity is base-unit quantity;
- inventory transaction quantity is base-unit quantity;
- unit cost is adjusted consistently when a non-base purchase unit is converted.

Recipe formulation logic was not changed.

## 4. D3 — F-02 receipt-date fidelity

### Root cause
**Classification:** missing/unapplied migration in the live database, compounded by the same live receiving function being an older definition.

The live `receive_purchase` stored the line's `received_batch_date` in `purchase_receipt_lines`, but populated `inventory_batches.batch_date` from `p_received_at::date`. Thus a supplied physical receipt date such as 2026-09-10 was replaced by the runtime receipt date 2026-09-17.

The repository already contained the approved F-02 correction in `20260917130000_phase4_high_fix_1_fifo_receipt_date.sql`, which explicitly resolves `coalesce(received_batch_date, p_received_at::date)` for the inventory batch date. That migration was absent from the live migration registry during diagnosis.

### Fix
The applied live F-07 migration contains the same approved physical-date logic in the active `receive_purchase` function:

`v_received_batch_date := coalesce(line received_batch_date, receipt timestamp date)`

and uses `v_received_batch_date` for the inventory batch's FIFO `batch_date`. `inventory_transactions.occurred_at` continues to use the receipt event timestamp. No historical batches were modified.

## 5. D4 — Supplier financial reconciliation

### Root cause
**Classification:** existing RPC/model synchronization defect.

The authoritative supplier outstanding view already deducts supplier `credit`/`refund` adjustments and supplier payment allocations from the purchase payable. Therefore the intended model is:

**purchase payable − supplier credit/refund adjustments − supplier payment allocations = supplier outstanding**

The defect was that the canonical supplier payment RPCs calculated allocation due using purchase totals minus prior payment allocations only; they ignored supplier adjustment credits/refunds. In addition, the basic `record_supplier_payment` path did not update `purchases.financial_status` after allocation. This produced the observed case where a 200 purchase with a 10 supplier credit and a 190 payment remained `unpaid` even though the authoritative outstanding view was designed to deduct the credit.

No new financial ledger was invented. `supplier_adjustments` remains the adjustment ledger; payment allocations remain payment allocation records; `purchases.financial_status` is the purchase-level status mirror.

### Fix
Updated the three existing supplier payment allocation RPCs:

- `record_supplier_payment`
- `record_supplier_payment_allocated`
- `record_supplier_payment_allocations`

Their due calculation now deducts approved `credit`/`refund` supplier adjustments as well as existing payment allocations. They also update `purchases.financial_status` to `paid` or `partially_paid` from the resulting purchase balance.

No supplier transactions were deleted or rewritten. Existing adjustment records remain authoritative ledger entries.

## 6. Files changed

Repository files added:

- `supabase/migrations/20260917180000_phase4_runtime_defect_d1_uuid_volatility.sql`
- `supabase/migrations/20260917180100_phase4_runtime_defect_d4_supplier_financial_reconciliation.sql`
- `docs/validation/PHASE4_RUNTIME_DEFECT_FIX_ROUND1.md`

Existing approved repository migration used for D2/D3:

- `supabase/migrations/20260917140000_phase4_high_fix_2_unit_conversion.sql`

Existing approved F-02 source inspected:

- `supabase/migrations/20260917130000_phase4_high_fix_1_fifo_receipt_date.sql`

## 7. Live migrations applied

The live Supabase migration mechanism assigned these versions:

- `20260917125130` — `phase4_runtime_defect_d1_uuid_volatility`
- `20260917125234` — `phase4_high_fix_2_unit_conversion`
- `20260917125329` — `phase4_runtime_defect_d4_supplier_financial_reconciliation`

Earlier Phase 4 migrations relevant to this round remain present; no migration was removed, rewritten, or reapplied.

## 8. Migration safety

- No `DELETE`, `TRUNCATE`, or destructive historical-data rewrite was introduced.
- No UUID primary keys were replaced.
- No historical inventory batches or transactions were rewritten.
- No real Mane Masala business data was imported.
- Existing Phase 4 test data was not cleaned up.
- D1 is metadata/function volatility only.
- D2/D3 replace the active purchase/receipt function definitions without modifying existing rows.
- D4 replaces existing RPC definitions without deleting financial records.

The failed first D2/D3 application attempt rolled back because of a grant signature mismatch; it did not partially install the migration. The corrected application then succeeded.

## 9. Active-function verification

Post-application live catalog inspection confirmed:

- `public.gen_random_uuid()` is VOLATILE.
- `create_purchase_entry` contains `purchase_to_base_factor`.
- `receive_purchase` contains purchase conversion and physical receipt-date handling.
- the supplier payment RPCs are the corrected definitions.

The live migration registry was re-read after application and showed the three new corrective migrations after the previously deployed F-12/F-03/F-08/F-10 migrations. No later migration was present that would override these function definitions.

## 10. Runtime verification still required

The corrections are **not** declared runtime-fixed merely because their migrations applied.

Required next runtime tests:

1. D1: execute multi-row purchase receipt and FIFO-split dispatch workflows and prove distinct UUIDs throughout.
2. D2: runtime verify exactly 250g→0.250Kg, 500g→0.500Kg, 750g→0.750Kg, and 2Kg→2.000Kg; verify transaction units, base-unit inventory, and invalid-unit rejection.
3. D3: runtime verify an explicit physical receipt date becomes the FIFO batch date and fallback works only when absent.
4. D4: runtime verify purchase 200 − credit 10 − payment 190 = zero outstanding and purchase status `paid`; also verify partial-payment and credit sequencing cases.
5. Re-run the previously blocked FIFO-split dispatch retry test after D1.
6. Re-run complete inventory and financial reconciliation after D2/D3/D4.

## 11. Final state

### 1. ROOT CAUSES IDENTIFIED

- **D1:** incorrect function volatility declaration in an earlier UUID compatibility migration.
- **D2:** approved F-07 migration existed in repository but was not applied to the live database; live purchase/receipt path was an older definition.
- **D3:** approved F-02 physical-date correction existed in repository but was not active in the live receiving function.
- **D4:** supplier payment RPCs did not deduct supplier adjustment credits/refunds when calculating purchase due, and one canonical payment path did not synchronize purchase financial status.

### 2. FIXES IMPLEMENTED

- D1 corrected to VOLATILE.
- D2 controlled purchase-unit→base-unit conversion installed.
- D3 physical receipt-date→FIFO batch-date behavior installed.
- D4 supplier adjustment credits/refunds incorporated into payment allocation due and purchase financial status synchronization.

### 3. MIGRATIONS CREATED/APPLIED

Applied live:

- `20260917125130 phase4_runtime_defect_d1_uuid_volatility`
- `20260917125234 phase4_high_fix_2_unit_conversion`
- `20260917125329 phase4_runtime_defect_d4_supplier_financial_reconciliation`

Repository documentation/migration files recorded in the Mane Masala repository as listed above.

### 4. RUNTIME VERIFICATION STILL REQUIRED

All four corrected defects require targeted runtime retesting. No runtime PASS is claimed from migration/source inspection alone.

### 5. TEST DATA CLEANUP STATUS

**NOT CLEANED.** Existing Phase 4 controlled test data remains in the live database pending separate cleanup instruction.

### 6. REAL DATA IMPORT STATUS

**NO REAL MANE MASALA BUSINESS DATA IMPORTED.**

**NOT READY FOR REAL DATA IMPORT**
