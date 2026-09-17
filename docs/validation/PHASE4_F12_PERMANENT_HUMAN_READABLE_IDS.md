# Phase 4 F-12 — Permanent Human-Readable IDs

**Status:** STATIC IMPLEMENTATION COMPLETE — RUNTIME VERIFICATION PENDING  
**Scope:** F-12 only.

## Baseline inspected

The approved transaction-code implementation uses the central `generate_business_code(text)` function backed by `id_sequences`, with the established human-readable pattern `PREFIX-000001` (six-digit zero-padded number). Existing transaction families are `ORD-`, `PUR-`, `PB-`, `DSP-`, `SAL-`, `INV-`, `CPY-`, and `SPY-`.

The core schema already provides `business_code` on `inventory_transactions`, `purchase_returns`, and `customer_returns`, but the common transaction trigger did not assign a sequence for these tables. Supplier/customer return creation paths could therefore persist NULL business codes; inventory transaction inserts generally omitted the column and likewise depended on no applicable trigger family.

## Smallest correction

Added two necessary sequence families while preserving the existing code-generation pattern:

- `ITX-000001`, `ITX-000002`, ... for `inventory_transactions`.
- `RET-000001`, `RET-000002`, ... for both `purchase_returns` and `customer_returns`.

The existing central `assign_transaction_business_code()` trigger function was extended only with these table-to-sequence mappings, and BEFORE INSERT triggers were installed on the three affected tables.

Existing rows with NULL codes are backfilled using the same central generator. Rows that already have a business code are not updated.

The shared `RET` sequence makes purchase-return and customer-return codes distinct and permanent across the two return record families without creating separate return numbering formats.

## Identity preservation

- UUID primary keys are unchanged.
- Existing non-NULL business codes are not renumbered or rewritten.
- Backfill occurs only where `business_code IS NULL`.
- Business-code columns retain their existing uniqueness guarantees; explicit unique indexes are present for the three affected tables.
- No transaction type, quantity, FIFO, reservation, dispatch, sale/invoice, purchasing, production, payment, RLS, report, or UI logic was changed.

## Return-function boundary

The existing supplier/customer return functions are not rewritten because the database INSERT boundary is now authoritative: a NULL/blank business code presented by an existing return workflow is replaced by the F-12 trigger before the row is stored. Thus a completed return record cannot intentionally persist a NULL business code. This avoids duplicating code-generation logic inside return workflows and preserves their existing business logic.

## Static checks performed

1. Inspected the original central generator and transaction-code trigger implementation.
2. Confirmed the approved `PREFIX-000001` pattern and existing families.
3. Confirmed the affected schema columns already exist.
4. Confirmed the F-12 migration adds mappings only for the missing inventory/return tables.
5. Confirmed triggers are BEFORE INSERT and use the central generator.
6. Confirmed backfill predicates update only NULL business codes.
7. Confirmed existing codes are not touched.
8. Confirmed unique indexes exist for all three affected tables.
9. Inspected the committed migration after creation.

## Runtime verification still required

Not performed in this pass. Runtime tests must verify:

- existing business codes remain byte-for-byte unchanged;
- all pre-existing NULL codes receive unique permanent codes after migration;
- a new inventory transaction receives an `ITX-######` code;
- a new supplier return receives a `RET-######` code;
- a new customer return receives a `RET-######` code;
- purchase and customer return codes do not collide because they share the same sequence;
- retry/concurrent inserts cannot duplicate business codes;
- generated codes remain unchanged on subsequent updates.

## Remaining findings

F-12 static correction is implemented. Other Phase 4 findings remain outside this pass and are not altered by this change.

**Runtime status:** UNVERIFIED.
