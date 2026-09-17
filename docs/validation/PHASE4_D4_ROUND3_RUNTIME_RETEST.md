# MANE MASALA — PHASE 4 D4 ROUND 3 RUNTIME RETEST
## Supplier Financial Reconciliation / Supplier Outstanding

**Test date:** 2026-09-17  
**Database test timestamp:** 2026-09-17 15:56:02.22086+00  
**Repository:** `infomanemasala-cmd/Mane-Masala`  
**Repository HEAD at validation:** `23cc37955cbff0b1d8d99c94c4ccf7214c0de5e2`  
**LIVE Supabase project:** `fogdwzpfudbktncajesk`  
**Migration under test:** `20260917135835 — phase4_d4_supplier_outstanding_partial_returned`  
**View under test:** `public.v_supplier_outstanding`

## 1. Scope

This was a runtime validation task only.

No application code, migration, migration history, RLS/security policy, historical business record, or existing test record was modified. No test data was cleaned up.

The Round 3 correction was already LIVE before this retest. No migration was reapplied.

## 2. Controlled Test Records

### Test 1 / Test 3

- Purchase: `PUR-000013`
- Purchase UUID: `b2092674-a6e5-485e-b006-576e81dddcb1`
- Supplier: `SUP-P4-RT-001`
- Supplier name: `MM_PHASE4_TEST_20260917_SUPPLIER_E`
- Workflow: `partial_returned`
- Financial status: `paid`
- Purchase line total: `200.00`
- Supplier credit/refund adjustment: `10.00`
- Supplier payment allocation: `190.00`
- Completed purchase-return credit amount: `10.00`

### Test 2 / Test 4

- Purchase: `PUR-000012`
- Purchase UUID: `14930b5e-ddd4-43ef-9e81-337ffc0ad035`
- Supplier: `SUP-001`
- Supplier name: `MM_PHASE4_TEST_20260917_SUPPLIER`
- Workflow: `partial_returned`
- Financial status: `partially_paid`
- Purchase line total: `200.00`
- Supplier credit/refund adjustment: `10.00`
- Supplier payment allocation: `100.00`
- Completed purchase-return credit amount: `10.00`

Both records and their related rows are identifiable as controlled `MM_PHASE4_TEST_` records.

## 3. Test 1 — Full Payment After Supplier Credit

**Required calculation:**

`200.00 - 10.00 - 190.00 = 0.00`

### Result: PASS

Database inspection showed:

- Purchase `PUR-000013` exists with `financial_status = paid`.
- Payment allocation row: `32aafebf-d51d-43e9-a79e-dfe9f3d756ca`, amount `190.00`.
- Payment header: `ee633623-24e4-44b4-8a0c-ece4002ce91e`, amount `190.00`, method `bank_transfer`, payment date `2026-09-17`.
- Supplier credit/refund adjustment row: `d9a08228-649b-4bad-b162-aba2a65295d6`, type `credit`, amount `10.00`.
- Completed supplier return: `db350372-9ec9-4d6b-8136-36656262f2b9`, credit amount `10.00`.
- Independently computed remaining balance: `0.00`.
- `v_supplier_outstanding` for supplier `SUP-P4-RT-001`: `0.00`.
- This supplier has only this one purchase, so the supplier-level view result is unambiguous.

The return credit appears once through the supplier adjustment used by the view; the `purchase_returns.credit_amount` is not separately added by the view. The payment is represented once through the payment allocation.

## 4. Test 2 — Partial Payment After Supplier Credit

**Required calculation:**

`200.00 - 10.00 - 100.00 = 90.00`

### Result: PASS

Database inspection showed:

- Purchase `PUR-000012` has `workflow_status = partial_returned`.
- Purchase `PUR-000012` has `financial_status = partially_paid`.
- Payment allocation row: `c3867d44-2742-4652-a220-22ffc8a5be6e`, amount `100.00`.
- Payment header: `68a1221a-ebac-47bb-b72a-9173d73c1000`, amount `100.00`, method `bank_transfer`, payment date `2026-09-17`.
- Supplier credit/refund adjustment row: `14115773-1f34-413d-b2e0-0e948ba56442`, type `credit`, amount `10.00`.
- Completed supplier return: `3e07ec09-6d32-4f07-af70-b5b628819b3f`, credit amount `10.00`.
- Independently computed purchase-level remaining balance: `90.00`.

`v_supplier_outstanding` is supplier-level, not purchase-level. `SUP-001` also has other controlled outstanding purchases, so its direct view total is `8790.00`, not `90.00`. This is not a view defect: the independently computed total for all financially outstanding purchases of `SUP-001` is also `8790.00`.

The Round 3 target purchase contributes exactly `90.00` to that view total. The independently computed baseline excluding `PUR-000012` is `8700.00`; adding the Test 2 purchase contribution gives `8700.00 + 90.00 = 8790.00`, exactly matching the LIVE view.

Therefore the critical Round 3 behavior is runtime-confirmed: the `partial_returned` purchase was not excluded from supplier outstanding merely because of its workflow state.

## 5. Test 3 — Fully Paid Partial-Returned Purchase

**Required boundary:**

- `workflow_status = partial_returned`
- `financial_status = paid`
- remaining financial balance `0.00`

### Result: PASS

`PUR-000013` satisfies the required state and has independently computed remaining balance `0.00`.

`v_supplier_outstanding` for its supplier `SUP-P4-RT-001` reports `0.00`.

The supplier has no other purchase, so this confirms that a fully paid `partial_returned` purchase does not create a false outstanding balance.

## 6. Test 4 — Double-Counting Protection

### Result: PASS

For both controlled purchases:

| Purchase | Payable basis | Credit/refund adjustment | Payment allocation | Computed outstanding | Return credit_amount |
|---|---:|---:|---:|---:|---:|
| `PUR-000013` | `200.00` | `10.00` | `190.00` | `0.00` | `10.00` |
| `PUR-000012` | `200.00` | `10.00` | `100.00` | `90.00` | `10.00` |

Each purchase has exactly:

- one credit/refund adjustment row;
- one payment allocation row;
- one completed supplier-return row.

The view's runtime result agrees with an independent calculation using purchase lines, purchase-level charges/discounts, supplier credit/refund adjustments, and payment allocations.

`purchase_returns.credit_amount` is present as `10.00` for each return but is not separately added to the outstanding equation. If it were double-counted, Test 2 would produce `80.00` rather than the observed `90.00` contribution, and Test 1 would remain zero only because of flooring; the independently computed Test 2 result and supplier aggregate both confirm the credit is counted once.

Payment allocations are also counted exactly once: `100.00` for Test 2 and `190.00` for Test 1.

## 7. Test 5 — Discount / Purchase Charges

### Result: NOT TESTED

The selected controlled records have zero values for:

- discount;
- delivery charge;
- transport charge;
- loading charge;
- unloading charge;
- packing charge;
- other charge;
- tax.

The current controlled setup therefore does not exercise non-zero discount/charge components without introducing an additional scenario. Per the test instructions, no additional pricing scenario was created.

The LIVE view definition was previously confirmed to retain these payable components, but this runtime task does not certify them with non-zero test values.

## 8. LIVE View / Migration Evidence

The LIVE migration registry contains:

`20260917135835 — phase4_d4_supplier_outstanding_partial_returned`

The LIVE `v_supplier_outstanding` definition selects purchases by financial state `unpaid` / `partially_paid`, rather than requiring `workflow_status = completed`.

Runtime results are consistent with that definition:

- `PUR-000013` is `partial_returned / paid` and contributes `0.00`.
- `PUR-000012` is `partial_returned / partially_paid` and contributes `90.00`.
- `SUP-001` view total is `8790.00`, matching the independent purchase-level sum.

## 9. Errors / Failures

No application/runtime test failed.

During read-only inspection, the first diagnostic SQL query contained an inspection-only column-name typo (`sp.payment_id` instead of the payment header's `id`). Supabase rejected that diagnostic query before execution. It caused no database mutation and was corrected in the subsequent read-only query. This is recorded for transparency and is not a product/runtime test failure.

## 10. Safety Confirmation

Confirmed for this runtime retest:

- No application code changed.
- No migration applied.
- No migration history edited.
- No RLS/security changed.
- No historical business data modified.
- No real Mane Masala business data modified.
- No test data cleaned up.
- No payment records rewritten.
- No supplier-return records rewritten.
- No supplier credit/refund records rewritten.
- No supplier payment allocation records rewritten.
- All inspected records remain controlled `MM_PHASE4_TEST_` records.

## 11. Final D4 Assessment

### D4 = RUNTIME VERIFIED

Tests 1–4 passed based on resulting LIVE database state and independent calculations.

Test 5 is explicitly **NOT TESTED** because the existing controlled records contain no non-zero discount/charge components and no additional pricing scenario was created.

The specific Round 3 defect is runtime-verified: a financially outstanding purchase in `partial_returned` workflow state remains visible through `v_supplier_outstanding` and contributes its correct `90.00` balance rather than being excluded.

## 12. Phase 4 Validation Status

- **F-08:** RUNTIME VERIFIED
- **D4:** RUNTIME VERIFIED
- **Phase 4 D4 validation gate:** PASSED

This does not by itself approve the overall MVP. Remaining launch/integration gates from the authoritative Master State still apply.
