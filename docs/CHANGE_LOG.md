# Mane Masala — Change Log

## Historical record
The exact Master State v1.4 is preserved in the persistent Project Library as `MANE_MASALA_MASTER_STATE_v1.4.md`. The existing v1.5 is also preserved there. These historical documents are not rewritten.

### v1.4
- 3C-8 approved and Phase 3C planning completed.
- State moved from approved Phase 3B/application architecture to MVP Blueprint Approved — Ready for Phase 4 Implementation.
- Technical stack resolved.
- 3C-1 through 3C-8 recorded as APPROVED.

### v1.5
- Phase 4 implementation and deep UX/workflow audit state recorded.
- Preserved the v1.4 rules while carrying implementation status forward.

### v1.6
- Created as the current continuity Master State for the new chat.
- Added the authoritative order timing clarification: order creation starts planning before final wife confirmation.
- Added explicit recipe-version choice when multiple applicable versions exist.
- Clarified reservation as commitment, not physical stock movement.
- Clarified wife review/approval before final order confirmation/execution.
- Clarified production demand linkage to Order/Order Line.
- Clarified mixed fulfillment using existing reserved stock and production.
- Clarified Dispatch → Sale + Invoice user experience while preserving separate database ownership.
- Expanded permutation testing and Phase 4 gap register.

## Phase 4 implementation history recovered from repository/project context
- Established Next.js/React/TypeScript application shell, Supabase clients/auth foundation, shared DataTable foundation and master management.
- Added permanent Item Code behaviour and in-context master creation patterns.
- Built purchasing, receiving/inspection, inventory, stock-out/adjustment, recipes/production, orders, dispatch/sale/invoice, payments/allocations and reports foundations.
- Added order partial approval/procurement workflow, Urgent Procurement dashboard support and related database hardening.
- Fixed a partial-approval reservation scaling defect so an existing capped reservation is not scaled down a second time.
- Fixed a MutationObserver loop that could freeze the production-plan wife-review form.
- Improved dropdown search so item/product name and code can both be searched while display remains `CODE — Name`.
- User visually reviewed the partial-order review route and said it looked good to start; this is not equivalent to full authenticated E2E.
- User requested purchase-flow refinement: supplier/user forms must show business names and user-relevant fields, not raw database IDs; system generates the Purchase No.; supplier slip/bill reference is a separate optional physical-document reference.
- User requested line-level purchase receiving decisions: Received, Accepted, Rejected/Damaged, automatic shortage calculation, supplier response, credit/refund/dispute treatment and a complete breakdown summary.

## 2026-09-16 integrated revalidation corrections
- Rechecked the current production Orders screen against Master State v1.6 rather than treating the previous active component as authoritative.
- Replaced the active `/orders` page's reduced operational console with a unified Order Intake + Planning screen implementing Direct/Sub-Agent entry, named/existing/anonymous end-customer traceability, multi-order entry sessions, multi-line orders, sellable product grouping, stock/reservation/available/shortfall planning, explicit recipe selection and wife-approved confirmation.
- Preserved `/orders-partial` as the dedicated Order Fulfilment path for production, partial/mixed fulfilment and dispatch rather than deleting that workflow.
- Added explicit `Products for Sale` tabs in Masters & Settings for Finished Products and Purchased Finished Products, backed by the live Item Master and the shared DataTable.
- Extended the shared DataTable with typed server-side filters so operational filter controls actually filter the table/list itself rather than only a modal selector.
- Applied those filters to Production for date range, batch, product, status and wife approval.
- Re-ran the Supabase security advisor. Closed the safe anonymous-execution finding for `save_recipe_version` and changed `v_supplier_outstanding` to security-invoker because authenticated read policies already cover its source tables.
- Recorded the remaining security findings as explicit release gates rather than blindly revoking intentionally used authenticated SECURITY DEFINER business RPCs.
- Recorded the system-wide UI law and sellable-product separation as durable decisions in the Decision Register.

## Continuity package
- Added `/AGENTS.md` for future coding agents.
- Added `/VALIDATION_PROTOCOL.md` for independent technical/business validation.
- Added `/docs/decisions/DECISION_REGISTER.md`.
- Added `/docs/handover/HANDOVER_TO_NEXT_CHAT.md`.
- Added `/docs/handover/IMPLEMENTATION_GAP_REPORT.md`.
- Added this change log.

## Important version-control note
A new v1.5 was not manufactured after v1.6 existed. The project already contains a historical v1.5 and the authoritative current state is v1.6. Creating a second document also named v1.5 with later v1.6 decisions would corrupt version history. The exact historical v1.4/v1.5 files remain preserved in the Project Library; v1.6 remains the current source of truth.
