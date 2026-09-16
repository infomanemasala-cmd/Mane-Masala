# Mane Masala — Agent Instructions

## Source of truth
- Read the current `MANE_MASALA_MASTER_STATE` before major work. The current authoritative state is **MM-BUSINESS-SPEC-1.6**.
- Historical v1.4 and v1.5 remain archives/reference; do not rewrite history.
- Approved decisions are binding unless a later decision explicitly supersedes them.
- OPEN decisions stay OPEN until their implementation dependency is reached and the user approves the decision.
- Proposed ideas are not requirements. Never silently promote them.

## Business rules
1. Preserve historical transactions and permanent IDs.
2. Inventory is transaction based; never manually overwrite current stock.
3. FIFO uses actual physical receipt/production dates, not invoice dates merely for convenience.
4. Reservations are commitments, not physical stock movements.
5. Accepted purchase receipt creates inventory only for accepted physical quantity.
6. Production consumption reduces ingredient/intermediate stock; production output creates inventory.
7. Dispatch owns physical finished-product stock reduction exactly once.
8. Sale must not reduce the same stock again.
9. Invoice must not reduce the same stock again.
10. Stock-outs explicitly reduce inventory.
11. Approved supplier returns reduce stock; approved customer returns add stock only after inspection/approval.
12. Supplier/customer payments are separate transactions with allocation records; advances must remain explicit when unallocated.
13. Critical stock/financial actions should be atomic and protected against duplicate/double-click execution.
14. Important stock/financial actions require the specified wife/admin approval.
15. Corrections use returns, adjustments, reversals, revisions or linked correction records; never delete history.

## UX
- The wife is the primary operational user and is essentially a zero-computer user.
- Use plain business language, minimal fields, one obvious next action, clear confirmation and useful error messages.
- Do not expose unnecessary technical IDs in forms. Permanent business codes are system generated and shown where useful.
- Tables must use the shared DataTable standard: search, result count, pagination and sortable headers.
- Mobile/tablet first; do not merely shrink desktop UI.
- Preserve entered context when opening in-context master creation.

## Architecture
Approved stack: Next.js + React + TypeScript, Supabase PostgreSQL, Supabase Auth, Supabase Storage, GitHub, Vercel, Figma. The application + Supabase are the business source of truth.

## Development discipline
- Inspect actual Supabase schema/functions/views and current GitHub `main` before changing code. Never guess function parameters or database columns.
- Prefer the smallest safe change. Do not rebuild working components unnecessarily.
- Backend/business-operation correctness comes before visual polish.
- Run build/lint and relevant tests after implementation changes.
- Validate cross-module effects, not only the edited screen.
- Do not declare a milestone complete because code exists. Completion requires implementation, tests, reconciliation and release-gate evidence.
- Do not send the user to test a known-broken deployment.
- Do not create fake production/business data merely to make a screen look populated.

## Required workflow for changes
**Read Master State → inspect schema/source → identify approved rule → implement smallest safe change → build/lint → business-rule test → cross-module reconciliation → runtime/deployment check → document change.**

## Phase discipline
Approved build order:
0. Project Foundation
1. Masters
2. Purchasing + Receiving
3. Inventory + FIFO
4. Recipes + Production
5. Orders
6. Dispatch → Sale → Invoice
7. Payments + Returns
8. Reports
9. Dashboard + Wife-Friendly UX
10. Full MVP Integration Testing

Phase 5 must not begin until the Phase 4 release gate passes.

## Documentation
- Significant decisions go in `docs/decisions/DECISION_REGISTER.md`.
- Significant implementation changes go in `docs/CHANGE_LOG.md`.
- Validation follows `VALIDATION_PROTOCOL.md`.
- Current implementation gaps belong in `docs/handover/IMPLEMENTATION_GAP_REPORT.md`.
- At milestone completion produce a structured implementation report.
