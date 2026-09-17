# Mane Masala — Change Log

This is an append-oriented history. Do not rewrite old entries to hide later corrections.

## Historical record
The exact Master State v1.4 and v1.5 are preserved in the Mane Masala Project Library. The current authoritative state is MM-BUSINESS-SPEC-1.6.

### v1.4
- 3C-8 approved and Phase 3C planning completed.
- State moved from approved Phase 3B/application architecture to MVP Blueprint Approved — Ready for Phase 4 Implementation.
- Technical stack resolved.
- 3C-1 through 3C-8 recorded as APPROVED.

### v1.5
- Phase 4 implementation and deep UX/workflow audit state recorded.
- Preserved v1.4 rules while carrying implementation status forward.
- Added multi-customer order-entry session, multi-line order refinement, order-party/end-customer traceability, transactional Stock Adjustment, shared sortable DataTable standard, mobile-first validation gate and fixed-logo direction.

### v1.6
- Created as the current continuity Master State for moving to a new chat.
- Added authoritative order timing clarification: order creation starts planning before final wife confirmation.
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
- Fixed partial-approval reservation scaling so an existing capped reservation is not scaled down a second time.
- Fixed a MutationObserver loop that could freeze the production-plan wife-review form.
- Improved dropdown search so item/product name and code can both be searched while display remains `CODE — Name`.
- User visually reviewed the partial-order review route and said it looked good to start; this is not equivalent to authenticated E2E.
- Refined Purchase UX: supplier/business name rather than raw technical ID, system-generated Purchase No., separate optional supplier slip/bill reference, multi-line entry and guided Receive → Review → Complete flow.
- Added line-level purchase receiving decisions: Received, Accepted, Rejected/Damaged, automatic shortage calculation, supplier response, credit/refund/dispute treatment and complete breakdown summary.

## Phase 4 runtime correction round — 2026-09-17
- Corrected UUID wrapper volatility so random UUID generation is VOLATILE rather than IMMUTABLE.
- Applied controlled purchase-unit-to-base-unit conversion and physical receipt-date FIFO handling where repository migrations had not yet been active in the live database.
- Corrected supplier payment allocation due calculations to account for supplier credit/refund adjustments and synchronize purchase financial status.
- Runtime verification of these targeted corrections remains a required gate; source/migration application alone is not treated as PASS.

## Continuity documentation package — 2026-09-17
- Strengthened `/AGENTS.md` with the complete continuity, business-integrity, purchase-claim and phase-discipline rules.
- Strengthened `/VALIDATION_PROTOCOL.md` with technical/business release evidence requirements.
- Consolidated `/docs/decisions/DECISION_REGISTER.md` with approved, open and historical/superseded decisions.
- Added `/docs/architecture/ARCHITECTURE_REFERENCE.md`.
- Added `/docs/business-rules/BUSINESS_RULES_REFERENCE.md`.
- Added `/docs/database/DATABASE_REFERENCE.md`.
- Added `/docs/workflows/WORKFLOW_REFERENCE.md`.
- Updated `/docs/handover/HANDOVER_TO_NEXT_CHAT.md` and `/docs/handover/IMPLEMENTATION_GAP_REPORT.md` for current state.

## Current repository/deployment state
- Current `main` commit observed: `90bf801861606e4a40481be7e9bbf4efc2fc7dae` — `docs: record Phase 4 runtime defect correction round 1`.
- Vercel has a READY production deployment for that exact commit: `dpl_8jxxBptefoJyVPaZcHEZrXXPwc1M`.
- GitHub combined status for the commit reports Vercel `success`.
- Production runtime error query for the latest deployment over the last 6 hours returned no error/fatal route entries.
- These facts do not clear Phase 4; authenticated E2E, mobile E2E and the remaining business/reconciliation gates still require evidence.

## Version-control note
Do not create a second v1.5 containing later v1.6 decisions. The historical v1.5 already exists in the Project Library. v1.6 remains the current source of truth. If a future state change warrants a new Master State, increment the version normally.
