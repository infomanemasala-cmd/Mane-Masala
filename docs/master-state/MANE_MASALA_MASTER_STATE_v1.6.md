# MANE MASALA BUSINESS SYSTEM — MASTER STATE v1.6

**Version:** MM-BUSINESS-SPEC-1.6
**Status:** PHASE 4 — FLOW/CONSISTENCY AUDIT AND CORRECTION IN PROGRESS. NOT CLEARED.

The full authoritative v1.6 Master State is preserved in the Mane Masala Project Library as `MANE_MASALA_MASTER_STATE_v1.6.md`.

This repository index exists so future coding agents can discover the authoritative state immediately. It intentionally does not create a second divergent copy that could drift from the Project Library source.

## Core current flow
Customer calls → Order raised → Order Plan prepared → stock/reservations checked → recipe version explicitly selected when required → production requirement calculated → wife reviews/approves → Order Confirmed → existing reserved stock and/or production → production actuals → Ready → Dispatch → Sale + Invoice → Payment/Outstanding → Reports.

Purchase → Receive → Inspect → Accept / Shortage / Return → Inventory → Supplier Payable → Payment.

## Non-negotiable ownership
Dispatch owns physical finished-product stock reduction exactly once. Sale and Invoice do not reduce stock. Reservations are commitments only. Production Consumption reduces ingredient/intermediate stock; Production Output creates stock. Purchase receipt creates stock only for accepted physical quantity.

## Current release state
Phase 4 is not cleared. The v1.6 Definition of Done requires functional consistency, business-rule tests, cross-module reconciliation, build/lint, READY production deployment, no critical runtime errors, authenticated E2E, mobile E2E, branding validation and no fake production records before Phase 5.

## Required reading
Read the exact v1.6 Project Library document first, then `/AGENTS.md`, `/VALIDATION_PROTOCOL.md`, `/docs/decisions/DECISION_REGISTER.md`, `/docs/handover/HANDOVER_TO_NEXT_CHAT.md`, `/docs/handover/IMPLEMENTATION_GAP_REPORT.md` and `/docs/UI_STANDARD.md` before major implementation.
