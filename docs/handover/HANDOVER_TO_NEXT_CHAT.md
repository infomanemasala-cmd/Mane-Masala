# Mane Masala — Handover to Next Chat

# START HERE
1. Read the current authoritative Master State **MM-BUSINESS-SPEC-1.6** in the Project Library.
2. Read `/AGENTS.md` and `/VALIDATION_PROTOCOL.md`.
3. Read `/docs/decisions/DECISION_REGISTER.md`, `/docs/CHANGE_LOG.md`, `/docs/phase4-integrated-revalidation-2026-09-16.md`, `/docs/handover/IMPLEMENTATION_GAP_REPORT.md`, `/docs/UI_STANDARD.md`, `/docs/architecture/ARCHITECTURE_REFERENCE.md`, `/docs/business-rules/BUSINESS_RULES_REFERENCE.md`, `/docs/database/DATABASE_REFERENCE.md` and `/docs/workflows/WORKFLOW_REFERENCE.md`.
4. Inspect actual GitHub `main` source and current Supabase schema/functions/views before coding.
5. Treat Phase 4 as **NOT CLEARED** until every release gate has evidence.

## Project
Mane Masala Business System is a persistent business-management application for a small food business. The wife is the primary operational user and is essentially a zero-computer user, so the application must be simple, action-oriented and safe.

## Authority/versioning
- Current authoritative Master State: **MM-BUSINESS-SPEC-1.6**.
- Exact historical v1.4 and v1.5 are preserved in the Project Library.
- Repository `docs/master-state/MANE_MASALA_MASTER_STATE_v1.5.md` is an historical archive representation, not current authority.
- Do not manufacture a second v1.5 containing later v1.6 decisions. The next genuine state change should increment from v1.6.

## Current phase
- **Phase 4 — implementation, flow/consistency audit and correction.**
- Phase 4 is **NOT CLEARED**.
- Approved build order: Milestones 0–10, ending in Full MVP Integration Testing.
- Current work is final integrated release audit/correction, not Phase 5.

## Repository / architecture
- GitHub: `infomanemasala-cmd/Mane-Masala`
- Default branch: `main`
- Current main commit observed: `90bf801861606e4a40481be7e9bbf4efc2fc7dae`.
- Next.js + React + TypeScript
- Supabase PostgreSQL/Auth/Storage
- GitHub source control
- Vercel hosting
- Figma design
- Mobile/tablet-first responsive target
- Supabase project: `fogdwzpfudbktncajesk`

## Core customer flow
Customer calls → Order raised → Order Plan prepared → stock/reservations checked → recipe version explicitly selected when required → production requirement calculated → wife reviews/approves → Order Confirmed → existing reserved stock and/or production → actual production → Ready → Dispatch → Sale + Invoice → Payment/Outstanding → Reports.

## Core purchase flow
Purchase → Receive → Inspect → Accept / Shortage / Reject-Damage / Return → Inventory → Supplier Payable → Payment.

### Purchase rules that must not be lost
- System generates permanent Purchase No.
- Supplier/shopkeeper slip/bill reference is separate and optional.
- Supplier is selected once; one bill may contain many lines.
- User-facing forms show supplier/business names, not raw UUIDs.
- For each line: Billed, Received, Accepted, Rejected/Damaged.
- Shortage = Billed − Received.
- Only Accepted enters usable inventory.
- Supplier response is recorded per affected line.
- Supplier honours → choose Credit or Refund; system calculates affected value and reduces payable by the agreed adjustment.
- Supplier refuses → original payable is preserved; affected amount remains Disputed/Pending.
- Later replacement is a linked receipt against the original purchase/purchase line.
- Physical supplier return is linked to the original purchase/purchase line.
- Complete review shows line-level and document-level breakdown.

## Critical stock/finance ownership
- Reservation is not physical stock movement.
- Accepted purchase receipt creates stock only for accepted physical quantity.
- Production consumption reduces input stock; production output creates stock.
- Dispatch owns finished-stock reduction exactly once.
- Sale and Invoice do not reduce stock again.
- FIFO uses physical receipt/production dates.
- Payments are separate transactions with allocation records; unallocated amounts remain explicit advances.
- History and permanent IDs are never deleted/rewritten to hide corrections.

## Orders / partial approval
- Order creation starts planning before final wife confirmation.
- One order may contain many item lines; one entry session may contain multiple separate orders.
- Multi-line approval may be independent where conditions permit.
- 1 kg required with 0.6 kg supported → approve 0.6 kg, leave 0.4 kg remaining.
- Ingredient shortage can mark a line Purchase Required; it is not fully approved/startable until procurement resolves.
- Other order lines may proceed independently.
- Urgent Procurement shows raw material, immediate quantity and order.
- Partial approval must not scale an already-capped reservation a second time.

## Recipe rule
Recipe inputs define formulation; expected finished output is independent. Scale ingredient quantities by required finished output / recipe expected output. Actual finished output may differ from total raw-material input weight. Actual consumption/output are authoritative. Standard recipe changes create new versions; one-time batch variance affects only that batch.

## Current implementation highlights
- `/orders` is wired to `components/orders-console-unified-v6.tsx` and implements unified order intake/planning.
- `/orders-partial` remains the dedicated production/partial/mixed fulfilment/dispatch path.
- `/purchases` is wired to `PurchaseConsoleV3` plus purchase history.
- Purchase UI includes guided Purchase → Receive & inspect → Review shortages/damage/supplier response → Complete → Supplier Payment flow.
- Shared DataTable standard and operational filters exist, but page-by-page release verification remains required.
- Supabase runtime corrections include UUID volatility, purchase unit conversion, physical receipt-date FIFO, supplier credit/refund payment reconciliation and other Phase 4 hardening.

## Current deployment evidence
- Vercel production deployment for current main commit: `dpl_8jxxBptefoJyVPaZcHEZrXXPwc1M`, state READY.
- GitHub combined Vercel status for current main commit: success.
- Runtime error/fatal query for this deployment over the latest 6 hours returned no entries.
- This is deployment/runtime evidence only, not full authenticated E2E proof.

## Known open release gates
- Full authenticated browser E2E.
- Mobile E2E for every operational create flow.
- Page-by-page shared DataTable compliance.
- Atomicity/idempotency evidence across all critical operations.
- Report-to-transaction reconciliation.
- Customer-return end-to-end workflow; current repository/live routine inventory still requires explicit validation of a dedicated customer-return operation.
- Final logo/branding visibility.
- Realistic business simulation with clean test-data handling.
- Remaining security-advisor findings require purpose-by-purpose review, not blanket disabling of legitimate authenticated business RPCs.

## Open business decisions
Exact financial-year numbering/reset; detailed GST/tax rules; bulk-to-pack operating method; detailed permissions; final dashboard arrangement; exact invoice visual design; expiry threshold; negative-stock exceptions; intermediate classification; exact restoration/classification of historical master/opening-stock data. Do not guess.

## Do not redesign
Do not casually redesign approved business logic, stock ownership, FIFO, reservation semantics, order timing, recipe versioning, permanent IDs, historical preservation, payment allocations or Dispatch → Sale → Invoice ownership.

## Immediate next action
Perform the final integrated Phase 4 release audit using current `main` and its current READY production deployment: validate the current Purchase/Receiving/Shortage/Damage/Supplier-response flow, Order/Partial Approval flow, customer-return path, payments/allocations, all relevant tables, mobile create flows, security findings and report reconciliation. Fix only evidenced defects, rebuild/redeploy, retest, and only then decide Phase 4 clearance from the Definition of Done.
