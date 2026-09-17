# Mane Masala — Validation Protocol

## Purpose
Use **BUILDER → VALIDATION → FIX → RETEST → APPROVAL**. Validation must prove both technical correctness and business correctness. A successful build or READY deployment is not, by itself, release approval.

## Source discipline
- Read the current authoritative Master State before testing.
- Inspect the actual Supabase schema, function signatures, views, constraints and status values before exercising a workflow.
- Do not treat commit messages, UI appearance, a deployment URL or a successful SQL statement as proof of full business correctness.
- Record evidence for every release-gate item.

## A. Architecture
Verify implementation against approved: Next.js, React, TypeScript, Supabase PostgreSQL, Supabase Auth, Supabase Storage, GitHub, Vercel, Figma, mobile/tablet-first responsive design. Confirm core operation works without ChatGPT, plugins, WhatsApp or OCR.

## B. Database
Check tables, relationships, PK/FK integrity, indexes, constraints, migrations, transaction boundaries, audit/history, permanent business IDs, controlled statuses, RLS/security policies, client/server boundaries and critical RPC signatures. Repository migration presence does not prove live Supabase application; verify the live migration registry where relevant.

## C. Inventory
Reconcile:
**Opening Stock + Receipts + Production In − Dispatch − Production Consumption − Stock-outs − Returns ± Adjustments = Current Stock**.

Test that reservation does not reduce physical stock; available = current − active reservations; dispatch reduces physical stock; sale/invoice do not reduce it again; production consumption reduces ingredients/intermediates; production output adds stock; stock-out and approved supplier return reduce stock; approved customer return adds stock only after inspection/approval. No direct balance editing.

## D. FIFO
Use actual physical receipt/production dates and inventory batches. Test purchase receipts, production outputs, consumption, dispatch, stock-outs and other physical consumption. Do not substitute invoice date for physical date. Test multiple batches and partial consumption.

## E. Purchasing
Test:
**Purchase → Receive → Inspect → Accept / Partial / Shortage / Reject-Damage / Return → Inventory → Supplier Payable → Payment**.

Cover one/many items, system-generated Purchase No., optional supplier slip/bill reference, supplier name rather than raw UUID in user-facing fields, duplicate supplier invoice warning, missing rate, attachments, billed vs physically received quantity, rejected/damaged quantity, shortage, supplier return, supplier credit/refund, supplier refusal/dispute, later replacement receipt, payment allocation and advances.

For each received line the user records **Received, Accepted, Rejected/Damaged**. Shortage is **Billed − Received**. Validate `Accepted + Rejected/Damaged = Received` and normal `Received <= Billed`. Only Accepted enters usable stock.

Supplier claim rule: response is recorded per affected line. If honoured, the agreed credit/refund is calculated from the affected value and reduces payable. If refused, the original payable is not silently reduced; the amount remains disputed/pending. Later replacement is linked to the original purchase/line. Physical supplier returns are linked to the original purchase/line.

## F. Production
Test Recipe Version → Production Batch → Requirement → FIFO/Stock Check → Wife Approval → Actual Consumption → Actual Output → Wastage → Inventory. Test partial production, actual yield, one-time variance, standard recipe versioning, intermediate stock, demand linkage to Order/Order Line and prevention of consuming another order's reserved stock.

Recipe rule: formulation inputs define the recipe; expected finished output is independent. Scale ingredient requirements by required output / recipe expected output. Do not assume ingredient input weight equals finished output. Actual consumption/output are authoritative.

## G. Orders
Test Draft/Received/Production Planned/Confirmed/In Production/Ready/Partially Dispatched/Dispatched/Completed and appropriate cancellation. Order creation begins planning; planning checks current/reserved/available stock, shortfall, recipe version and production requirement before final wife confirmation. Test multi-line orders, independent line approval where permitted, partial production, mixed stock + production, partial dispatch, revisions, cancellation, customer-specific pricing and advances.

## H. Dispatch → Sale → Invoice
Dispatch owns physical stock reduction exactly once. Sale derives from actual approved Dispatch and Invoice derives from Sale. Sale and Invoice never reduce inventory again. Test full/partial/multiple dispatches, one-time sale/invoice creation and customer return linkage.

## I. Payments
Test customer/supplier direction separation, Cash/UPI, actual payment date, UPI reference, notes, one payment to multiple documents, multiple payments to one document, advances, partial payments and outstanding reconciliation. Allocation records are mandatory for document linking.

## J. Returns / Corrections
Never delete historical transactions. Supplier returns link to original purchase/purchase line; multiple returns are allowed. Customer return is **Return Received → Inspect → Approve → Stock/Financial Adjustment**; returned goods do not automatically become saleable stock. Corrections use reversal, return, adjustment, revision or linked correction.

## K. Security
Check authentication, authorization, RLS, server/client separation, exposed secrets, environment variables, controlled RPC execution and unauthorized data access. Review SECURITY DEFINER functions individually by purpose; do not blindly revoke authenticated business operations merely to silence a warning.

## L. Wife Usability
The wife is essentially a zero-computer user. Validate plain language, minimal fields, one obvious next action, safe confirmations, readable tables/forms, useful business names, no unnecessary technical IDs, mobile/tablet usability and clear errors. The user must not need to understand database terminology to complete a normal task.

## M. Upload Foundation
Verify foundations for Excel/CSV, PDF, images/photos, purchase documents, sales documents, customer/supplier information and opening stock. Conversational ChatGPT entry and OCR automation are future scope unless explicitly approved for the current milestone.

## N. Testing matrix
Require, where appropriate:
- unit tests
- integration/database tests
- business-rule tests
- inventory reconciliation
- FIFO tests
- negative/edge cases
- duplicate submission/double-click tests
- partial transaction tests
- supplier/customer return tests
- correction/reversal tests
- cross-module tests
- report-to-transaction reconciliation
- realistic business simulations
- controlled test-data cleanup

## O. Release gate
Do not approve MVP/Phase 4 until:
- major modules work
- all relevant tables use the shared sortable/search/count/pagination standard
- purchase and customer loops work end-to-end
- stock and financial values reconcile
- no duplicate stock reduction exists
- no duplicate financial transaction exists
- reservations cannot be double-consumed
- FIFO uses physical dates
- customer and supplier outstanding reconcile
- migration/data classification reconciles
- wife can perform core workflows
- build/lint pass
- verified current production deployment is READY
- current production runtime has no critical errors
- authenticated E2E passes
- mobile operational create flows pass
- branding/logo is present in approved prominent locations
- no fake business records remain in production

## Evidence rule
Every PASS must identify the tested scenario, expected result, observed result and evidence source. If evidence is unavailable, mark the item **UNKNOWN/OPEN**, not PASS.
