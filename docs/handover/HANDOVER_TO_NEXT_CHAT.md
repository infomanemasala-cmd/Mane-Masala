# Mane Masala — Handover to Next Chat

## START HERE
1. Read the current authoritative Master State **MM-BUSINESS-SPEC-1.6** in the Project Library.
2. Read `/AGENTS.md` and `/VALIDATION_PROTOCOL.md`.
3. Read `/docs/decisions/DECISION_REGISTER.md`, `/docs/phase4-integrated-revalidation-2026-09-16.md` and `/docs/handover/IMPLEMENTATION_GAP_REPORT.md`.
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

## System-wide UI law
- Every list/table page uses the shared DataTable behaviour: server-backed search, count, pagination, sortable headers, useful business fields, permanent business codes, consistent search reset and consistent search interaction.
- Forms use one clear primary action, plain language, safe defaults only, no unnecessary technical IDs, strong confirmation for important stock/financial actions and preserved context for nested master creation.
- An approved rule for one page is a system-wide standard unless a documented business reason requires otherwise.
- Production filters must filter the actual shared table, not merely a modal dropdown.

## Product catalogue law
- Controlled item types include Finished Product and Purchased Finished Product.
- The previously verified master state contained 22 listed finished/purchased-finished products: 16 `finished_product` and 6 `purchased_finished_product`.
- Product identity remains permanent; do not duplicate an item merely because it can be sold and/or used in production.
- The application now exposes explicit Products for Sale tabs for Finished Products and Purchased Finished Products.
- The live database is currently clean after disposable test-data cleanup; do not invent replacement master rows or classifications.

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

## Order screen correction now in main
- Active `/orders` is now `components/orders-console-unified.tsx`, not the previously reduced `OperationsConsoleFinal2` screen.
- It implements Direct/Sub-Agent order party, existing/named/anonymous end-customer traceability, multi-order entry sessions, multi-line orders, sellable product grouping, stock/reserved/available/shortfall planning, explicit recipe version selection and wife-approved confirmation.
- `/orders-partial` remains the dedicated fulfilment path for production, partial/mixed fulfilment and dispatch.
- Do not revert `/orders` to the reduced console merely because it is shorter/easier.

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

## Latest revalidation corrections
- Shared DataTable now supports typed server-side filters.
- Production date/batch/product/status/wife-approval filters now apply to the actual production table.
- Products for Sale tabs were added to Masters & Settings.
- Active Orders screen was replaced with the unified intake/planning flow described above.
- Safe Supabase security-lint corrections were applied: `v_supplier_outstanding` is now security-invoker and anonymous execution of `save_recipe_version` is revoked.
- Durable revalidation record: `/docs/phase4-integrated-revalidation-2026-09-16.md`.

## Current known issues / release gates
- Full authenticated browser E2E remains open unless freshly evidenced.
- Mobile E2E remains open.
- Page-by-page DataTable compliance remains open until verified.
- Atomicity/idempotency needs evidence across critical actions.
- Report reconciliation needs evidence against transaction tables/views.
- Customer-return workflow remains a gap: customer return tables exist, but no dedicated customer-return RPC was found in the live public routine inventory.
- Final logo/branding visibility needs verification.
- Final production runtime-error check must be performed on the current deployment.
- Exact financial-year numbering, GST details, packaging conversion mechanics, detailed permissions, invoice visual design, expiry threshold, negative-stock exceptions and intermediate classification remain OPEN unless separately approved.
- Supabase security advisor still reports 40 authenticated SECURITY DEFINER functions for grouped authorization review and leaked-password protection is disabled.
- Exact restoration of the previously verified 105 master records remains pending; do not guess the 16 FP / 6 PFP mapping or opening stock.

## Do not redesign
Do not casually redesign approved business logic, stock ownership, FIFO, reservation semantics, order timing, recipe versioning, permanent IDs, historical preservation, payment allocations or the Dispatch → Sale → Invoice ownership model.

## Immediate next action
Perform the final integrated Phase 4 audit using current `main` + current READY production deployment: authenticate through the real browser/UI, restore only exact approved master data, execute the full order/purchase/customer-return/payment/reconciliation scenarios, verify mobile flows, review remaining security findings, fix defects, rebuild/redeploy, retest, then only if every gate passes mark Phase 4 cleared.
