# MANE MASALA — PHASE 4 CONTROLLED RUNTIME TEST REPORT

**Date:** 2026-09-17  
**Environment:** Live Supabase project `fogdwzpfudbktncajesk`  
**Repository:** `infomanemasala-cmd/Mane-Masala`  
**Repository commit used for this runtime pass:** `48f86c311e3201aeb974c0c1e7d2fad21caf19c8` (`docs: record Phase 4 F-12 runtime validation`)  
**Cleanup:** NOT PERFORMED, by explicit instruction.  
**Real business data imported:** NO  
**Real business records intentionally modified:** NO

## 1. Live migration versions

The live migration registry was verified before runtime testing and included exactly these Phase 4 migrations relevant to this pass:

- `20260917110740` — `phase4_f12_permanent_human_readable_ids`
- `20260917114257` — `phase4_combined_fix_f03_f08_f10`
- `20260917114909` — `phase4_f08_dispatch_idempotency_aggregation_correction`

The source migrations used for the two controlled deployment steps were applied through the supported Supabase migration mechanism. No migration was reapplied or manually edited during runtime testing.

## 2. Runtime test summary

| Test ID | Test | Result | Evidence | Affected records | Important observations | Cleanup status |
|---|---|---|---|---|---|---|
| 1 | Inventory + FIFO | **PASS** | Controlled isolated lots and FIFO consumption executed at runtime; oldest lot consumed first; closing stock reconciled | Controlled inventory item/lots and inventory transactions | FIFO consumption split correctly across eligible lots. A separate purchase-receipt setup exposed the UUID defect recorded below and was not silently retried. | Not cleaned |
| 2 | Reservations | **PASS** | Controlled reservation changed available stock while physical stock stayed unchanged; active/issued states observed | Controlled order/reservation and inventory item | Reservation did not create inventory depletion. Physical 10.000, reserved 6.000, available 4.000 after reservation. | Not cleaned |
| 3 | Partial Dispatch | **PASS** | Controlled order dispatched partially; runtime state and inventory transaction verified | Controlled order `ORD-000007`, dispatch and line(s) | Ordered 6.000; first dispatch 2.000; physical stock decreased only by dispatched quantity; order became `partially_dispatched`. | Not cleaned |
| 4 | Dispatch Idempotency | **PASS** | Identical retry returned existing dispatch with `idempotent_retry=true`; no second movement; different partial dispatch accepted | Controlled dispatch `12380b3f-e19e-4936-a7a7-e058fafa30ad` and order `ORD-000007` | First 2.000 dispatch was not duplicated. A distinct 1.000 partial dispatch was accepted and reduced stock only by 1.000. | Not cleaned |
| 5 | FIFO-Split Dispatch Retry | **FAIL / BLOCKED** | Runtime FIFO-split dispatch failed with `duplicate key value violates unique constraint "dispatch_lines_pkey"` | Controlled FIFO-split order/dispatch attempt | Failure occurred before a completed FIFO-split dispatch existed, so migration 2's aggregated retry behavior could not be certified. Transactional failure left no partial business mutation. | Not cleaned |
| 6 | Sale + Invoice | **PASS** | Controlled dispatched order created sale and invoice; physical stock did not decrease again | Sale `SAL-000002`, invoice `INV-000002`, controlled dispatch | Sale quantity 2.000 and invoice total 400.00 matched the dispatch. No second inventory depletion was observed. | Not cleaned |
| 7 | Supplier Return | **PASS** | Accepted-stock return reduced stock and produced return transaction; rejected/non-stock return produced no stock reduction | Controlled purchase/return records including `RET-000002` and rejected-return record | Accepted return created the expected inventory reduction and supplier adjustment. Rejected quantity did not incorrectly reduce stock. | Not cleaned |
| 8 | Customer Return | **PASS** | Both positive-refund and zero-refund lifecycles executed Received → Inspected → Approved → Completed | Positive-refund return `bd43690b-0d99-4496-ba24-18d65b240128`; zero-refund return `2b24842a-4033-41bb-a605-50ebfe1e95e3`; refund adjustment `92b60b26-0df8-4394-9641-dad42da22862` | Positive refund 200.00 created exactly one adjustment and restored 1.000 saleable quantity. Zero refund created no adjustment and no restoration transaction. Duplicate approval/completion did not duplicate effects. | Not cleaned |
| 9 | Unit Conversion | **FAIL** | Controlled 250g purchase runtime stored 250.000 instead of expected 0.250 base-unit Kg; supplied batch date was also not preserved | Controlled purchase/receipt for `RM-003` | Approved F-07 conversion and F-02 receipt-date behavior were not active in the live purchase path. 250g became 250Kg; supplied `received_batch_date` 2026-09-10 resulted in batch date 2026-09-17. | Not cleaned |
| 10 | Atomicity / Rollback | **PASS** | Controlled invalid operation rejected; no test-marker partial stock adjustment or inventory transaction remained | Controlled failed stock-adjustment operation | No partial inventory mutation was observed after the controlled failure. | Not cleaned |
| 11 | RLS / Write Boundary | **PASS** | Authenticated direct insert into protected history table rejected; canonical SECURITY DEFINER RPC succeeded | `inventory_transactions` plus canonical stock-adjustment RPC | Protected history-sensitive writes remained behind intended business paths. RLS/policies were not weakened. | Not cleaned |
| 12 | Permanent Business IDs | **PASS** | Runtime-generated ITX/RET business IDs verified; no NULL/duplicate groups observed in affected tables | Runtime inventory transactions and supplier/customer returns | Examples included `ITX-000024` and `RET-000002`; UUID primary keys remained intact. | Not cleaned |
| 13 | Inventory Reconciliation | **BLOCKED** | Individual controlled flows reconciled, but full equation could not be certified | All controlled test items | Complete certification is blocked by failed FIFO-split dispatch, failed purchase-unit conversion, and lack of complete production output/consumption execution in this pass. | Not cleaned |
| 14 | Financial Reconciliation | **FAIL / PARTIAL** | Controlled sale/invoice/payment/refund/supplier-return records compared; supplier financial-status difference found | Sale/invoice, customer refund adjustment, supplier purchase/return/payment records | Customer side reconciled for tested transaction. Supplier purchase remained `financial_status='unpaid'` with credit/refund/dispute fields at 0 despite a supplier adjustment credit existing separately. | Not cleaned |

## 3. Detailed runtime evidence

### Test 1 — Inventory + FIFO

An isolated test item was used rather than existing production inventory. Controlled lots were created with different batch dates and quantities. A controlled FIFO consumption was then executed.

Observed runtime result:

- Opening stock: 2.000
- Controlled receipt/lots: 1.000 dated 2026-09-10 and 2.000 dated 2026-09-12
- Consumption: 1.500
- Oldest lot was consumed first: 1.000 from 2026-09-10, then 0.500 from the next eligible lot
- Closing stock: 3.500
- Reconciliation: `2.000 + 3.000 - 1.500 = 3.500`
- Inventory transactions corresponding to the movements were present.

A separate controlled purchase-receipt setup hit a `purchase_receipts_pkey` UUID collision. That failure was preserved as a defect; no workaround was used.

### Test 2 — Reservations

Controlled reservation state was observed without physical stock depletion.

Before reservation:

- Physical: 10.000
- Reserved: 0.000
- Available: 10.000

After reservation:

- Physical: 10.000
- Reserved: 6.000
- Available: 4.000

The controlled reservation was then represented as `issued`; the inventory availability view continued to include it in reserved quantity. No inventory depletion transaction was created merely by reservation.

### Test 3 — Partial Dispatch

Controlled order `ORD-000007` had ordered quantity 6.000. A first dispatch of 2.000 was executed.

Observed:

- dispatch status: `dispatched`
- order status: `partially_dispatched`
- ordered quantity: 6.000
- reserved quantity: 6.000
- dispatched quantity: 2.000
- physical stock decreased only by 2.000
- dispatch inventory transaction was created.

No double reduction was observed.

### Test 4 — Dispatch Idempotency

The exact same completed dispatch request was submitted again.

The retry returned the existing logical dispatch with `idempotent_retry=true` and did not create a second dispatch movement or second inventory depletion.

A genuinely different partial dispatch of 1.000 was then accepted. Physical stock decreased only by that additional 1.000 and dispatched quantity became 3.000. This demonstrated that a legitimate different partial dispatch remained possible.

### Test 5 — FIFO-Split Dispatch Retry

This test could not reach the retry assertion. A single order line was constructed so that fulfillment needed more than one FIFO batch. The dispatch failed with:

`duplicate key value violates unique constraint "dispatch_lines_pkey"`

The failure is attributable to the live `public.gen_random_uuid()` wrapper being declared `IMMUTABLE` even though it delegates to the random UUID generator. Multiple UUID evaluations in the same execution context therefore produced a collision.

Because the dispatch transaction failed atomically, no partial completed dispatch was certified and no additional stock movement was intentionally introduced. Migration 2's FIFO-split aggregation comparison remains runtime-unverified.

### Test 6 — Sale + Invoice

Controlled dispatched quantity 2.000 was converted to:

- Sale: `SAL-000002`, quantity 2.000, total 400.00, amount due 400.00
- Invoice: `INV-000002`, quantity 2.000, total 400.00, amount due 400.00

Physical stock remained unchanged by sale/invoice creation after the dispatch movement. No second inventory depletion transaction was observed.

### Test 7 — Supplier Return

The accepted-stock supplier-return path was executed against controlled inventory. The accepted returned quantity reduced physical stock and produced an inventory transaction linked to the supplier return. Supplier adjustment credit was also created.

A separate rejected/non-stock receipt path recorded 1.000 received, 0.000 accepted, 1.000 rejected. The corresponding rejected return completed without creating a stock-reduction transaction for the rejected quantity.

### Test 8 — Customer Return

#### Positive refund

Return `bd43690b-0d99-4496-ba24-18d65b240128` completed:

`Received → Inspected → Approved → Completed`

Runtime evidence:

- approved saleable quantity: 1.000
- stock increased by 1.000
- customer adjustment: exactly one
- refund amount: 200.00
- customer linkage present
- invoice linkage present
- inventory transaction: `ITX-000024`, quantity +1.000, reference `customer_return`

Duplicate approval/completion did not create a second refund adjustment or second stock restoration.

#### Zero refund

Return `2b24842a-4033-41bb-a605-50ebfe1e95e3` completed through the same lifecycle with refund 0.00. No customer adjustment and no inventory restoration transaction were created.

### Test 9 — Unit Conversion

The controlled conversion item uses Kg as the base unit and grams as the purchase unit with a 0.001 conversion factor.

The required runtime conversions were therefore expected to be:

- 250g → 0.250Kg
- 500g → 0.500Kg
- 750g → 0.750Kg
- 2Kg → 2.000Kg

Runtime purchase/receipt evidence instead showed a 250g purchase represented as 250.000 in the base-unit field and the resulting inventory batch also at 250.000, rather than 0.250.

The same receipt exposed the separate receipt-date fidelity failure: supplied physical `received_batch_date` 2026-09-10 did not become the inventory batch date; the observed batch date was 2026-09-17.

No additional fixes were made during this validation pass.

### Test 10 — Atomicity / Rollback

A controlled invalid stock adjustment exceeding available stock was intentionally attempted. The operation failed as expected. Post-failure checks showed no surviving test-marker stock adjustment or inventory transaction from the failed operation.

No real data was used for the intentional failure.

### Test 11 — RLS / Write Boundary

Under authenticated user context, direct insert into `public.inventory_transactions` was rejected with permission denied. The canonical `record_stock_adjustment` SECURITY DEFINER business RPC succeeded under the same authenticated context.

The protected write boundary remained intact and was not weakened for testing.

### Test 12 — Permanent Business IDs

Runtime-generated transaction/return records received permanent human-readable IDs. Observed inventory transaction IDs included `ITX-000024`; supplier/customer return families used `RET-` IDs.

Read-only checks found zero NULL business codes and no duplicate groups in the affected tables during the validation state. UUID primary keys remained intact.

The historical pre-F-12 NULL count was not independently available, so this report does not claim a historical backfill count.

### Test 13 — Inventory Reconciliation

Individual controlled movements were checked, including FIFO consumption, reservation neutrality, dispatch, sale/invoice neutrality, supplier return, customer return, and stock adjustment behavior.

A complete Phase 4 reconciliation covering all requested equation components cannot be certified because production output/consumption was not fully executed in this runtime pass and the failed FIFO-split dispatch and unit-conversion defect affect the controlled inventory ledger.

### Test 14 — Financial Reconciliation

Controlled financial evidence included:

- Sale: 400.00
- Invoice: 400.00
- Customer payment allocation: 200.00; invoice became partially paid with 200.00 due
- Customer refund adjustment: 200.00
- Supplier purchase: 200.00
- Supplier return credit: 10.00
- Supplier payment allocation: 190.00

A supplier-side reconciliation difference remained: the purchase record showed `financial_status='unpaid'` with supplier credit/refund/dispute fields at 0 even though a supplier adjustment credit existed separately. Therefore full financial reconciliation is not certified.

## 4. Defect register

### D1 — Critical: UUID generator volatility

`public.gen_random_uuid()` is declared `IMMUTABLE` while delegating to the random UUID generator. Runtime consequences included primary-key collisions in controlled multi-row workflows:

- `purchase_receipts_pkey`
- `dispatch_lines_pkey`

This blocks reliable runtime execution of multi-row/multi-lot paths and prevented Test 5 from completing.

### D2 — Critical: F-07 purchase-unit conversion not active in live purchase path

A controlled 250g purchase resulted in 250.000 base-unit Kg instead of 0.250 Kg. The required conversion behavior from the approved F-07 implementation is therefore not runtime-verified as active.

### D3 — High: F-02 receipt-date fidelity not active in live purchase path

A controlled receipt supplied `received_batch_date=2026-09-10`, but the resulting inventory batch date was 2026-09-17.

### D4 — High: Supplier financial reconciliation remains inconsistent

Supplier return credit and supplier payment allocation did not reconcile the purchase's financial-status/credit fields. The credit existed as a supplier adjustment, while the purchase remained financially unpaid with credit/refund/dispute fields at zero.

## 5. Data-integrity concerns

- Test 5 demonstrated a real primary-key collision risk in a multi-row/multi-lot operation.
- Test 9 demonstrated a material unit-of-measure integrity risk: purchase quantity can be represented as the wrong base-unit quantity in the live path.
- Test 9 also demonstrated that physical receipt date can be lost for FIFO batch dating in the live path.
- Supplier financial status does not fully reconcile with supplier adjustment credit in the tested scenario.
- Full inventory and financial reconciliation therefore remain uncertified.

## 6. Tests actually executed

Executed at runtime: **Tests 1 through 12 and the available portions of Tests 13 and 14**.

Tests 13 and 14 were not certified as complete because their required complete-system reconciliation depends on flows that were not all successfully executable in this controlled dataset.

No test was marked PASS solely from source inspection.

## 7. Tests not fully executable

- **Test 5:** blocked by the live UUID primary-key collision before a FIFO-split dispatch could complete.
- **Test 13:** complete reconciliation blocked by Test 5, Test 9, and incomplete production runtime coverage.
- **Test 14:** full reconciliation failed/partial because supplier financial status and supplier adjustment credit did not reconcile.

## 8. Cleanup and real-data safety

- Test data was **not rolled back or deleted** at the end of the complete pass, because the explicit instruction was to defer cleanup until a separate cleanup instruction.
- Controlled test records remain in the live database and are not to be mistaken for real business data.
- No real Mane Masala business data was imported.
- No existing real business records were intentionally deleted, overwritten, or modified as part of this runtime validation.
- No unrelated code or schema changes were made during runtime testing.
- No corrective migration was applied after a runtime failure.

## 9. Overall runtime conclusion

The controlled runtime pass produced real evidence for successful reservation, partial dispatch, primary dispatch idempotency, sale/invoice non-double-depletion, supplier return behavior, customer-return refund behavior, atomicity, RLS/write boundary, and permanent business IDs.

However, the runtime pass also exposed critical defects and left required reconciliation and FIFO-split retry coverage incomplete. The defects were preserved and documented rather than hidden with workarounds.

**PHASE 4 RUNTIME TESTING — IN PROGRESS**

**NOT READY FOR REAL DATA IMPORT**
