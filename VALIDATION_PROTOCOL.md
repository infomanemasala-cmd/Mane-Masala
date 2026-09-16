# Mane Masala — Validation Protocol

## Purpose
Use **BUILDER → VALIDATION → FIX → RETEST → APPROVAL**. Validation must prove both technical correctness and business correctness. A successful build or READY deployment is not, by itself, release approval.

## A. Architecture
Verify implementation against approved: Next.js, React, TypeScript, Supabase PostgreSQL, Supabase Auth, Supabase Storage, GitHub, Vercel, Figma, mobile/tablet-first responsive design.

## B. Database
Check tables, relationships, PK/FK integrity, indexes, constraints, migrations, transaction boundaries, audit/history, permanent business IDs, controlled statuses and RLS/security policies. Inspect actual schema and function signatures before testing or changing UI.

## C. Inventory
Reconcile:
**Opening Stock + Receipts + Production In − Dispatch − Production Consumption − Stock-outs − Returns ± Adjustments = Current Stock**.
Test that reservation does not reduce physical stock; dispatch reduces physical stock; sale/invoice do not reduce it again; production consumption reduces ingredients/intermediates; production output adds stock; stock-out and supplier return reduce stock; approved customer return adds stock only after inspection/approval.

## D. FIFO
Use actual physical receipt/production dates and batches. Test purchase receipts, production outputs, consumption, dispatch, stock-outs and other physical consumption. Do not substitute invoice date for physical date.

## E. Purchasing
Test:
Purchase → Receive → Inspect → Accept / Partial / Return → Inventory → Supplier Payable → Payment.
Cover one/many items, system-generated Purchase No., supplier slip/bill reference, duplicate supplier invoice/reference warning where applicable, missing rate, attachments, billed vs physically accepted quantity, shortage, damage/rejection, supplier return, supplier credit/refund, replacement receipt, payment allocation and advances.

For each received line, the user should be able to record **Received, Accepted, Rejected/Damaged**. Shortage is calculated as **Billed − Received**. Only Accepted enters usable stock. Supplier response is recorded per affected line. If the supplier honours the claim, agreed credit/refund reduces payable by the calculated affected value. If the supplier refuses, the amount remains **Disputed/Pending** and the original payable is not silently reduced. A later replacement must be linked to the original purchase/line, not created as an unrelated purchase.

## F. Production
Test Recipe Version → Production Batch → Requirement → FIFO/Stock Check → Wife Approval → Actual Consumption → Actual Output → Wastage → Inventory. Test partial production, actual yield, one-time variance, standard recipe versioning, intermediate stock and demand linkage to Order/Order Line.

## G. Orders
Test Draft/Received/Production Planned/Confirmed/In Production/Ready/Partially Dispatched/Dispatched/Completed and appropriate cancellation. Order creation begins planning; planning checks current/reserved/available stock, shortfall, recipe version and production requirement before final wife confirmation. Test multi-line orders, partial approval, mixed stock + production, revisions, cancellation and customer-specific pricing/advance.

## H. Dispatch → Sale → Invoice
Dispatch owns physical stock reduction exactly once. Sale and Invoice derive from actual approved Dispatch and never reduce inventory again. Test full/partial/multiple dispatches, one-time sale/invoice creation and customer return linkage.

## I. Payments
Test customer/supplier direction separation, Cash/UPI, actual payment date, UPI reference, notes, one payment to multiple documents, multiple payments to one document, advances and outstanding reconciliation. Allocation records are mandatory for document linking.

## J. Returns / Corrections
Never delete historical transactions. Supplier returns link to original purchase/purchase line; multiple returns are allowed. Customer return is **Return Received → Inspect → Approve → Stock/Financial Adjustment**; returned goods do not automatically become saleable stock.

## K. Security
Check authentication, authorization, RLS, server/client separation, exposed secrets, environment variables, controlled RPCs and unauthorized access. Critical stock/financial operations should be atomic and idempotent.

## L. Wife Usability
Use plain language, minimal fields, obvious next action, safe confirmations, readable tables/forms, mobile/tablet usability and clear errors. Avoid unnecessary technical IDs. Do not make the wife understand database concepts to complete a normal business task.

## M. Upload Foundation
Verify foundations for Excel/CSV, PDF, images/photos, purchase documents, sales documents, customer/supplier information and opening stock. Conversational ChatGPT entry and OCR automation are future scope unless explicitly approved for the current milestone.

## N. Testing
Require unit tests where appropriate, integration/database tests, business-rule tests, reconciliation, FIFO, negative cases, duplicate/double-click protection, partial transactions, corrections/returns, cross-module tests and realistic business simulations. Test with controlled data and clean up test-only records.

## O. Release Gate
Do not approve MVP/Phase 4 until major modules work; stock and financial values reconcile; no duplicate stock reduction or duplicate financial transactions exist; customer and purchasing loops pass; migration reconciles; wife can perform core workflows; build/lint pass; production deployment is READY; no critical runtime errors; authenticated E2E passes; mobile operational create flows pass; branding is present; and no fake business records remain.
