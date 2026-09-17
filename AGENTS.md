# Mane Masala — Agent Instructions

## 1. Authority and continuity
- Read the current `MANE_MASALA_MASTER_STATE` before major work. The current authoritative state is **MM-BUSINESS-SPEC-1.6**.
- Historical v1.4 and v1.5 are preserved as references. Do not rewrite history to make an older version appear current.
- Approved decisions are binding unless a later decision explicitly supersedes them.
- OPEN decisions remain OPEN until their implementation dependency is reached and the user approves the decision.
- Proposed ideas are not requirements. Never silently promote them.
- Never guess missing business rules, quantities, rates, tax, dates, IDs, status meanings or accounting treatment.

## 2. Business integrity rules
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
12. Supplier/customer payments are separate transactions with allocation records; unallocated amounts remain explicit advances.
13. Critical stock/financial actions must be atomic and protected against duplicate/double-click execution.
14. Important stock/financial actions require the specified wife/admin approval.
15. Corrections use returns, adjustments, reversals, revisions or linked correction records; never delete history.
16. Low stock does not silently create a purchase or production order.
17. One permanent item identity may have multiple business roles; do not duplicate identities merely to change role.

## 3. Authoritative customer flow
**Customer calls → Order raised → Order Plan prepared → stock/reservations checked → recipe version explicitly selected when required → production requirement calculated → wife reviews/approves → Order Confirmed → existing reserved stock and/or production → actual production → Ready → Dispatch → Sale + Invoice → Payment/Outstanding → Reports.**

Order creation starts planning. One order can contain many item lines. One entry session can contain multiple separate orders, each with its own permanent Order transaction.

## 4. Purchasing rules
**Purchase → Receive → Inspect → Accept / Shortage / Reject-Damage / Return → Inventory → Supplier Payable → Payment.**

- Mane Masala generates the permanent Purchase No.
- Supplier/shopkeeper slip/bill reference is a separate optional physical-document reference.
- Do not expose technical supplier UUIDs as the user's primary supplier field.
- One purchase may contain many item lines.
- Per line: Billed, Received, Accepted, Rejected/Damaged.
- Shortage = Billed − Received.
- Only Accepted enters usable stock.
- Supplier response is recorded per affected line.
- Supplier honours → agreed credit/refund is calculated and reduces payable.
- Supplier refuses → original payable is preserved; affected value remains Disputed/Pending.
- Later replacement is linked to the original purchase/purchase line, not a new unrelated purchase.
- Supplier returns are linked to the original purchase/purchase line.

## 5. Recipe/production rules
Recipe input quantities define formulation; expected finished output is independent. Scale ingredients by required finished output / recipe expected output. Actual output may differ from total ingredient input weight. Actual consumption/output are authoritative.

Recipe versions are preserved. Standard recipe changes create a new version after approval. One-time batch variance affects only that batch. Intermediate/prepared material is real FIFO inventory.

## 6. Orders / partial approval
- Wife may approve one line, several lines or leave others pending where business conditions permit.
- A line may be partially approved if available raw material supports only part of the required output.
- Example: 1 kg required and 0.6 kg supported → approve 0.6 kg and leave 0.4 kg remaining.
- If an ingredient is short, mark the line Purchase Required; it is not fully approved/startable until procurement is resolved.
- Other order lines may proceed independently.
- Urgent Procurement shows raw material, immediate quantity and order.
- Partial approval must not scale an already-capped reservation a second time.

## 7. UX law
- The wife is the primary operational user and is essentially a zero-computer user.
- Use plain language, minimal fields, one obvious next action, strong confirmation for important stock/financial actions and useful error messages.
- Do not make the wife understand database concepts to complete a normal task.
- Forms should show business names/meaning, not raw technical IDs.
- Tables must use the shared DataTable standard: server-backed search, result count, pagination and sortable headers, with useful business fields and permanent codes where relevant.
- Related-master creation should preserve the parent form and select the new master after creation where practical.
- Mobile/tablet first; use responsive reflow rather than a shrunken desktop layout.
- Do not add a checkbox when the action button itself is the confirmation unless a separately approved business reason exists.

## 8. Architecture
Approved stack: Next.js + React + TypeScript, Supabase PostgreSQL, Supabase Auth, Supabase Storage, GitHub, Vercel, Figma. The application + Supabase are the business source of truth.

## 9. Development discipline
- Before major implementation read the current Master State and relevant supporting docs.
- Inspect actual GitHub `main` and live Supabase schema/functions/views/statuses before changing implementation.
- Use exact live function signatures; never invent RPC parameters.
- Prefer the smallest safe change. Do not rebuild working components unnecessarily.
- Backend/business correctness comes before visual polish.
- Run build/lint and relevant tests after implementation changes.
- Validate cross-module effects, not only the edited screen.
- Do not declare a milestone complete because code exists. Completion requires implementation, tests, reconciliation and release-gate evidence.
- Do not send the user to test a known-broken deployment.
- Do not create fake production/business data merely to populate a screen.

## 10. Migration and history discipline
- Migration files are append-only corrections; do not rewrite old migrations to hide defects.
- Repository migration presence does not prove the migration is active in Supabase; inspect the live migration registry.
- Preserve physical receipt dates for FIFO.
- Unit conversion must be explicit and controlled; convert accepted purchase quantity exactly once into base-unit inventory.
- Never delete historical transactions or replace permanent UUID/business IDs to repair a defect.

## 11. Required workflow for changes
**Read Master State → inspect repository/schema → identify approved rule → implement smallest safe change → build/lint → business-rule test → cross-module reconciliation → runtime/deployment check → document change.**

## 12. Phase / milestone discipline
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

## 13. Documentation
- Current authority: `docs/master-state/MANE_MASALA_MASTER_STATE_v1.6.md` index plus exact Project Library v1.6.
- Historical: `docs/master-state/MANE_MASALA_MASTER_STATE_v1.5.md` and Project Library v1.4/v1.5.
- Significant decisions: `docs/decisions/DECISION_REGISTER.md`.
- Significant implementation changes: `docs/CHANGE_LOG.md`.
- Validation: `/VALIDATION_PROTOCOL.md`.
- Gap tracking: `docs/handover/IMPLEMENTATION_GAP_REPORT.md`.
- Workflow/architecture/business rules: `docs/workflows/`, `docs/architecture/`, `docs/business-rules/`, `docs/database/`.
- At milestone completion produce a structured implementation report.

## 14. Completion rule
A milestone or Phase 4 may be marked complete only when the approved Definition of Done has actual evidence. A READY Vercel deployment is not equivalent to Phase 4 approval.
