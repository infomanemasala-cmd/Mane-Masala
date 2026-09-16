# Mane Masala — Handover to Next Chat

## START HERE
1. Read the current authoritative Master State **MM-BUSINESS-SPEC-1.6** in the Project Library.
2. Read `/AGENTS.md` and `/VALIDATION_PROTOCOL.md`.
3. Read `/docs/decisions/DECISION_REGISTER.md` and `/docs/handover/IMPLEMENTATION_GAP_REPORT.md`.
4. Inspect the actual GitHub `main` source and current Supabase schema/functions/views before coding.
5. Treat Phase 4 as **NOT CLEARED** until every release gate has evidence.

## Project
Mane Masala Business System is a persistent business-management application for a small food business. The wife is the primary operational user and is essentially a zero-computer user, so the application must be simple, action-oriented and safe.

## Authoritative state
- Current Master State: **MM-BUSINESS-SPEC-1.6**.
- v1.4 and v1.5 are historical archives preserved in the Project Library.
- Do not create another Master State merely because the chat changed. A new version is justified only by a meaningful project state change.

## Current phase/milestone
- Phase 4 — implementation, flow/consistency audit and correction.
- Phase 4 is NOT cleared.
- Build order was approved as Milestones 0–10, ending in Full MVP Integration Testing.
- Current work is late Phase 4 integrated release audit/correction, not Phase 5.

## Repository / architecture
- GitHub: `infomanemasala-cmd/Mane-Masala`
- Default branch: `main`
- Next.js + React + TypeScript
- Supabase PostgreSQL/Auth/Storage
- GitHub source control
- Vercel hosting
- Figma design
- Mobile/tablet-first responsive target
- Supabase project ID: `fogdwzpfudbktncajesk`

## Core business flow
Customer calls → Order raised → Order Plan prepared → stock/reservations checked → recipe version explicitly selected when required → production requirement calculated → wife reviews/approves → Order Confirmed → existing reserved stock and/or production → actual production → Ready → Dispatch → Sale + Invoice → Payment/Outstanding → Reports.

Purchase → Receive → Inspect → Accept / Shortage / Return → Inventory → Supplier Payable → Payment.

## Critical ownership rules
- Reservation is not physical stock movement.
- Purchase receipt creates stock only for accepted physical quantity.
- Production consumption reduces input stock; production output creates stock.
- Dispatch owns finished-stock reduction exactly once.
- Sale and Invoice do not reduce stock again.
- Supplier return removes stock; approved customer return adds stock only after inspection/approval.
- FIFO uses actual physical receipt/production dates.
- History and permanent IDs are never deleted/rewritten to hide corrections.

## Purchase-specific current decisions
- System generates the permanent Purchase No.; the supplier/shopkeeper slip/bill reference is a separate optional reference captured from the physical document.
- Purchase is multi-line and supplier is selected once.
- User should see supplier name/business information, not raw UUIDs as the primary field.
- Receiving is separate from the purchase document.
- Per line: record Billed, Received, Accepted and Rejected/Damaged. Shortage = Billed − Received.
- Only Accepted enters usable inventory.
- Supplier response is recorded for affected lines.
- Supplier honours → system calculates affected value and records credit/refund, reducing payable by the agreed amount.
- Supplier refuses → original payable is not silently reduced; amount remains disputed and traceable.
- Later replacement must link to the original purchase/purchase line.
- Complete review must retain a line-level and document-level breakdown.

## Order/partial approval current decisions
- Multi-line orders are line-independent for production approval where business conditions permit.
- A line can be partially approved if raw-material availability supports only part of required output.
- Example: 1 kg required, 0.6 kg supported → approve 0.6 kg, leave 0.4 kg remaining.
- If an ingredient is short, the line can be marked Purchase Required; it is not startable/fully approved until procurement is resolved.
- Other lines can proceed independently.
- Urgent Procurement must show raw material, quantity needed immediately and order.
- Partial approval must not scale an existing capped reservation a second time.

## Recipe rule
Recipe inputs define formulation; expected finished output is independent. Scale ingredients by required output / recipe expected output. Actual finished output may differ from total ingredient input weight. Actual consumption and output are authoritative. Standard recipe changes create new versions; one-time batch variance affects only that batch.

## Known validated items
Database-level transactional tests have covered customer order → recipe selection → planning → reservation → approval → production → FIFO dispatch → sale → invoice and purchase → receipt → inspection → accepted stock → purchase completion → supplier payment allocation. These are not substitutes for full authenticated browser E2E.

The user has visually reviewed the partial-order review route and said it looked good to start. Do not treat this as full E2E evidence.

## Current known issues / release gates
- Full authenticated browser E2E remains open unless freshly evidenced.
- Mobile E2E remains open.
- Page-by-page DataTable compliance remains open until verified.
- Atomicity/idempotency needs evidence across critical actions.
- Report reconciliation needs evidence against transaction tables/views.
- Production demand linkage and order planning clarity need final verification.
- Final logo/branding visibility needs verification.
- Final production runtime-error check must be performed on the current deployment.
- Exact financial-year numbering, GST details, packaging conversion mechanics, detailed permissions, invoice visual design, expiry threshold, negative-stock exceptions and intermediate classification remain OPEN unless separately approved.

## Do not redesign
Do not casually redesign approved business logic, stock ownership, FIFO, reservation semantics, order timing, recipe versioning, permanent IDs, historical preservation, payment allocations or the Dispatch → Sale → Invoice ownership model.

## Immediate next action
Perform the final integrated Phase 4 audit using current `main` + current READY production deployment: inspect actual schema/functions/source, verify the purchase flow and current Orders flow, execute controlled authenticated E2E scenarios, verify mobile operational flows, reconcile stock/FIFO/financial values, fix defects, rebuild/redeploy, retest, then only if all gates pass mark Phase 4 cleared.
