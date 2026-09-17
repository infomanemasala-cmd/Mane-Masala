# Phase 4 F-12 Runtime Validation

**Validation date:** 2026-09-17  
**Migration:** `20260917160000` — `phase4_f12_permanent_human_readable_ids`  
**Source commit:** `253ab5294b135d3a3ece7afb53b23ce498cbfeb7`  
**Live project:** `fogdwzpfudbktncajesk`

## Scope

Runtime validation only for F-12 permanent human-readable IDs. No application code, migration, unrelated business logic, or historical production records were changed.

## Results

| Test | Result | Evidence / limitation |
|---|---|---|
| 1. Existing codes | **PASS (available records); NOT TESTABLE for customer returns** | Existing `inventory_transactions` and `purchase_returns` codes were read before the isolated test and remained unchanged after the test. Representative existing codes: `ITX-000004`, `RET-000001`. `customer_returns` currently has no existing record, so there is no representative historical customer-return code to compare. |
| 2. Historical NULL backfill | **NOT TESTABLE** | Current live state has zero NULL codes in all three affected tables. The runtime session did not have a pre-F-12 database snapshot establishing the exact number of NULL records before migration, so no historical count is asserted. |
| 3. New inventory transaction | **PASS** | Canonical `record_stock_adjustment(...)` path created an inventory transaction inside a rollbackable isolated transaction. Generated UUID: `ad8ff25f-6d05-4f9a-8771-fcc54321af5b`; generated code: `ITX-000007`. Format matched `ITX-######`; UUID remained intact; uniqueness checks passed. All test changes were rolled back. |
| 4. New supplier return | **PASS** | Canonical `record_supplier_return(...)` path created a controlled supplier return inside the same rollbackable transaction. Generated UUID: `41b6aecf-a161-48c2-9da0-9a3bf6ee6dd5`; generated code: `RET-000002`. Format matched `RET-######`; no NULL or duplicate code. Inventory effects and return record were rolled back. |
| 5. New customer return | **PASS for F-12 trigger generation; NOT TESTABLE for full canonical return workflow** | A controlled `customer_returns` insert through the database trigger path generated UUID `3c8cde13-da66-4909-9bb4-9d2955190969` and code `RET-000003`. Full `receive_customer_return(...)` workflow could not be exercised because the live database currently has no sales/sale lines, and the canonical function requires an existing sale. The controlled trigger-path record was rolled back. |
| 6. Shared RET sequence | **PASS** | Controlled supplier return generated `RET-000002`; controlled customer-return insert generated `RET-000003`. Existing live supplier return is `RET-000001`. No cross-table RET duplicate exists. The shared `RET` sequence currently reports `next_number=2` after rollback, as expected from the persistent pre-test state; test-generated numbers were transactional and rolled back. |
| 7. Concurrent generation | **NOT TESTABLE** | Available Supabase SQL tooling provides sequential SQL execution but no supported mechanism in this validation session to establish true simultaneous independent database sessions. No concurrency result is claimed. |
| 8. Immutability after update | **PASS** | For each controlled test record, a permitted non-identity `notes` update was performed and `business_code` was re-read; each code remained unchanged. Entire transaction was rolled back. |
| 9. Global uniqueness | **PASS for intended static/runtime observable constraints** | No duplicate business codes within `inventory_transactions`, `purchase_returns`, or `customer_returns`. No cross-table duplicate among `RET` codes. Unique indexes confirmed: `inventory_transactions_business_code_uidx`, `purchase_returns_business_code_uidx`, `customer_returns_business_code_uidx`. |
| 10. Final database check | **PASS** | Live state: zero NULL `business_code` values in all three affected tables; zero duplicate groups in each affected table; zero cross-table RET duplicates; zero format violations. Current sequence configuration: `ITX-`, width 6, next number 7; `RET-`, width 6, next number 2. |

## Isolation / rollback

Tests 3–8 were executed in one controlled PL/pgSQL block with an explicit terminal exception carrying the validation result. The exception rolled the entire test transaction back. No test record, inventory quantity change, return record, or other test-side database mutation remained after validation.

The rollback validation produced these controlled IDs/codes before rollback:

- Inventory transaction: `ad8ff25f-6d05-4f9a-8771-fcc54321af5b` → `ITX-000007`
- Supplier return: `41b6aecf-a161-48c2-9da0-9a3bf6ee6dd5` → `RET-000002`
- Customer return: `3c8cde13-da66-4909-9bb4-9d2955190969` → `RET-000003`

## Final live-state checks

- `inventory_transactions.business_code IS NULL`: **0**
- `purchase_returns.business_code IS NULL`: **0**
- `customer_returns.business_code IS NULL`: **0**
- Inventory duplicate-code groups: **0**
- Supplier-return duplicate-code groups: **0**
- Customer-return duplicate-code groups: **0**
- Cross-table `RET` duplicates: **0**
- Inventory format violations: **0**
- Supplier-return format violations: **0**
- Customer-return format violations: **0**
- Required F-12 unique indexes: **confirmed**
- Required F-12 triggers: **confirmed**
- `assign_transaction_business_code()`: **confirmed**

## Defects discovered

**None discovered in the tested F-12 behaviour.**

The only limitations are test-environment/data limitations: no pre-F-12 snapshot for exact historical NULL count, no existing customer-return record for an existing-code comparison, no existing sales/sale lines for the full canonical customer-return workflow, and no true multi-session concurrency facility in the available tooling.

## Status

**F-12: RUNTIME VERIFIED / PASSED** for the tested and observable scope, with the limitations explicitly recorded above.

This document does **not** assert overall Phase 4 readiness. Other Phase 4 findings remain outside this validation.
