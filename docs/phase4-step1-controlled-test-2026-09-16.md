# Phase 4 Step 1 — Controlled Test Evidence — 2026-09-16

## Scope
Controlled synthetic-data validation before the clean go-live reset. The database records used here are disposable test records only.

## Runtime fixes discovered and applied
- Added compatibility for `public.gen_random_uuid()` used by existing workflow functions.
- Hardened purchase receiving/review write RPCs as `SECURITY DEFINER`.
- Aligned production plan lines with the `sequence_number` field expected by the workflow function.
- Aligned order procurement requirement insert with its required `unit_id` field.
- Aligned procurement requirement status with the workflow (`open` rather than `active`).
- Restored authenticated execution access to customer/supplier payment RPCs.
- Hardened stock-out and stock-adjustment write RPCs.
- Aligned stock-adjustment inventory transaction type with the schema (`stock_adjustment`).
- Hardened supplier-return write RPC access.
- Existing inventory UI RPC payload correction remains in main from commit `745acc178947a30a6ba054b94c033193938ae7a7`.

## Controlled flow executed
1. Created one test supplier, one test customer, one test category, two test raw-material items and one test finished product.
2. Created and activated one recipe/version for the finished product.
3. Created and received two purchases of raw material A at different unit costs to exercise FIFO.
4. Created a third purchase of raw material B to resolve the production procurement shortfall.
5. Created an order for the finished product.
6. Prepared the order plan; production was correctly blocked while ingredient B was unavailable.
7. Resolved procurement, approved the production batch, started production, and completed production with actual consumption/output.
8. Confirmed the order, dispatched the finished product, and created the sale/invoice.
9. Recorded the customer payment and verified invoice amount due became zero.
10. Executed stock-out and positive/negative stock-adjustment workflows.
11. Executed a supplier return with supplier credit and a supplier payment.
12. Verified FIFO crossed from the earlier A batch into the later A batch when a 9.9-unit stock-out was performed.
13. Verified invoice creation did not create another inventory transaction.
14. Verified duplicate purchase receiving was rejected and duplicate dispatch was rejected by order state.

## Key observed results
- Purchase receipt workflow completed successfully after RPC hardening.
- Production planning correctly produced a procurement shortfall when ingredient B was absent.
- Procurement resolution and wife-approval path completed successfully.
- Production completion consumed ingredients and produced finished stock atomically.
- Dispatch reduced finished stock once.
- Invoice creation did not reduce inventory a second time.
- Customer invoice: total 200, payment 200, amount due 0.
- FIFO batch test depleted the earlier 100-cost A batch before consuming the later 120-cost A batch.
- Stock-out and both positive/negative adjustment paths completed after schema alignment.
- Supplier return completed and supplier payment allocated successfully.
- Duplicate receipt/dispatch protections rejected repeat operations as expected.

## Step 1 gate status
**Controlled backend/business-flow execution: PASS for the scenarios listed above.**

This document is evidence of controlled execution, not an independent final release approval. Browser/UI E2E, customer-return workflow coverage, and final release reconciliation remain separate validation items unless independently evidenced.
