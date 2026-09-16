# Mane Masala — Implementation Notes

## Current source
Current GitHub default branch is `main`. Inspect source rather than relying on commit messages. The repository contains the Next.js application shell, `app/`, `components/`, `lib/`, `public/`, Supabase migrations, CI configuration and shared UI documentation.

Known operational routes/components include:
- `/purchases`
- `/orders`
- `/orders-partial`
- `/inventory`
- `/production`
- `/payments`
- `/dashboard`
- `/masters`
- `/masters-settings`
- `/transactions`
- `components/purchase-console-v3.tsx`
- `components/orders-partial-review-v3.tsx`
- `components/urgent-procurement-card.tsx`

## Recent important implementation corrections
- Partial approval reservation scaling was corrected so an existing capped reservation is not scaled a second time.
- A MutationObserver loop in form guidance that could freeze the production-plan wife-review form was fixed by avoiding identical label rewrites.
- Dropdown search was improved to find by both business code and name while retaining `CODE — Name` display.
- Purchase flow was expanded toward a multi-stage business workflow: Record Purchase → Receive & Inspect → Review shortage/damage/supplier response → Complete → Supplier payment.
- Purchase UI was refined so the user sees supplier name/business information and system-generated Purchase No., while supplier slip/bill reference is separate.

## Purchase flow currently represented in source
The purchase console records supplier, date, optional supplier slip/bill reference, source and multiple item lines. It then records physically received/accepted/rejected quantities, calculates shortage and presents supplier response/settlement before completion.

This implementation must still be authenticated-browser tested against the current live schema and production deployment. Do not infer that source presence means the workflow is release-ready.

## Test-only history
Controlled transactional tests were previously used for order/production/dispatch and purchasing/payment validation, with stated test transactions rolled back. A persistent TEST ONLY order for partial-approval browser review was deliberately retained for that review according to project context; do not delete or alter controlled test data unless explicitly instructed.

## Repository safety
Do not overwrite working code merely to standardize filenames. Inspect existing source and migrations, then make the smallest safe change. New business behaviour must be reflected in the decision register and, when materially changing project state, the Master State.
