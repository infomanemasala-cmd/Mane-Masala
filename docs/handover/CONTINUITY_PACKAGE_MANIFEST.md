# Mane Masala — Continuity Package Manifest

**Capture date:** 2026-09-16

This repository now contains the durable continuity structure for continuing Mane Masala without relying on chat memory.

## Source-of-truth order
1. Project Library: `MANE_MASALA_MASTER_STATE_v1.6.md` — authoritative current state.
2. `/AGENTS.md` — coding-agent operating rules.
3. `/VALIDATION_PROTOCOL.md` — independent technical/business validation protocol.
4. `/docs/decisions/DECISION_REGISTER.md` — approved/open/proposed decision register.
5. `/docs/CHANGE_LOG.md` — chronological change record.
6. `/docs/handover/HANDOVER_TO_NEXT_CHAT.md` — next-chat starting instructions.
7. `/docs/handover/IMPLEMENTATION_GAP_REPORT.md` — current implementation classification.
8. `/docs/master-state/ARCHIVE_AND_VERSION_POLICY.md` — version/history rules.
9. `/docs/UI_STANDARD.md` — system-wide UI requirements.
10. Relevant architecture, business-rule, database, workflow, testing, migration and UX documents under `/docs/` plus the actual source/migrations.

## Historical state preservation
Exact v1.4 and v1.5 historical Master State files are preserved in the Project Library. They must not be rewritten to include later v1.6 decisions.

## Current repository observation
Repository: `infomanemasala-cmd/Mane-Masala`, branch `main`.
The latest captured repository commit before this manifest update was `368594faa85b6894f5f15175c8f87d8830446e96` (`docs: record current continuity status`).

## Current phase
**Phase 4 — integrated flow/consistency audit and correction. NOT CLEARED.**

## Current priority
Continue the integrated Phase 4 release audit. Do not start Phase 5. Verify current main source against Supabase schema/functions/views, verify the current production deployment, run authenticated browser and mobile E2E, reconcile stock/FIFO/financial values, fix defects, redeploy and retest.

## Evidence rule
Repository code, CI success, or Vercel READY status alone is not Phase 4 approval. Release requires business-rule evidence and reconciliation.
