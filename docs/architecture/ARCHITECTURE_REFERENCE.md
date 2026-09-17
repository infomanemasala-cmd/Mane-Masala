# Mane Masala — Architecture Reference

## Authority
The current authoritative Master State is **MM-BUSINESS-SPEC-1.6**. This document is a supporting reference, not a replacement.

## Approved stack
- Next.js + React + TypeScript
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- GitHub
- Vercel
- Figma
- Mobile/tablet-first responsive UI with responsive desktop support

## Repository
- `infomanemasala-cmd/Mane-Masala`
- default branch: `main`
- Supabase project: `fogdwzpfudbktncajesk`
- Vercel project: `mane-masala`

## Layering rule
1. Browser/UI presents the business workflow in plain language.
2. Critical stock/financial actions use controlled database/server functions.
3. Supabase is the persistent business source of truth.
4. Audit/history records preserve important business events.
5. Reports are read-only views/queries over authoritative transaction data.

## Critical domain relationships
- Supplier → Purchase → Purchase Lines → Receipt → Inspection → Inventory → Supplier Payable → Payment/Allocation
- Recipe Version → Production Batch → Plan Lines → Consumption → Output/Wastage → Inventory
- Customer/Sub-Agent → Order → Order Lines → Plan/Reservation → Production/Stock → Dispatch → Sale → Invoice → Payment

## Transaction ownership
- Accepted purchase receipt creates physical inventory.
- Reservation is only a commitment.
- Production consumption reduces input inventory.
- Production output creates inventory.
- Dispatch reduces finished stock exactly once.
- Sale and Invoice do not reduce stock.
- Stock-out and approved supplier return reduce stock.
- Approved customer return adds stock only after inspection/approval.

## Engineering discipline
Inspect actual schema, function signatures, status values and current `main` source before changing implementation. Prefer the smallest safe correction. Do not infer missing parameters or business rules from UI names. Build/lint, business tests, reconciliation and deployment/runtime evidence are required before release claims.
