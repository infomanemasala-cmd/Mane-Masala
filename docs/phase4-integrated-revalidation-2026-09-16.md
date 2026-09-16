# Mane Masala — Phase 4 Integrated Revalidation & Cross-Check

**Date:** 2026-09-16  
**Master State:** MM-BUSINESS-SPEC-1.6  
**Repository:** `infomanemasala-cmd/Mane-Masala` / `main`  
**Supabase:** `fogdwzpfudbktncajesk`  
**Purpose:** Revalidate the implementation against the accumulated approved agenda, discussion points, business rules, UI laws, module requirements and release gates. This document is an audit register, not a replacement Master State.

## 1. Source hierarchy used for this revalidation

1. Master State v1.6 — authoritative design/implementation continuity source.
2. Decision Register — durable record of approved/open decisions.
3. UI Standard — system-wide list/form consistency rules.
4. Current GitHub `main` source — implementation truth.
5. Current Supabase schema, functions, views, policies and live data — runtime/business truth.
6. Current Vercel production deployment/runtime state — deployment truth.
7. Prior controlled test evidence — useful validation evidence, but not browser E2E proof.

No proposal was promoted to an approved rule during this audit.

## 2. Master agenda / approved requirements cross-check

| Area | Approved/agreed requirement | Current audit result | Status |
|---|---|---|---|
| Architecture | Next.js + React + TypeScript + Supabase + GitHub + Vercel + Figma | Current repo/deployment uses approved stack | VERIFIED |
| Wife UX | Plain language, one obvious next action, minimal technical fields, strong confirmation | Applied in corrected Orders/Product/Production surfaces; page-by-page E2E still required | PARTIALLY VERIFIED |
| IDs | Permanent generated business codes; user does not invent IDs | Backend and DataTable expose business codes | VERIFIED |
| Items | Raw Material / Intermediate / Finished Product / Purchased Finished Product | Live item types verified | VERIFIED |
| Sellable roles | `can_be_sold` is independent of item type; one item identity may have multiple roles | Preserved; order selector groups approved sellable types without duplicating items | VERIFIED |
| Finished catalogue | 22 approved finished/purchased-finished products; previous split 16 FP + 6 PFP | Master State confirms count/split; live DB is intentionally clean after disposable-data reset, so current rows are 0 | BLOCKED FOR DATA RESTORE / NO GUESS |
| Units | kg, g, litre, ml | Item model supports units; live master rows currently 0 after reset | PARTIALLY VERIFIED |
| Suppliers | Supplier can supply raw and/or finished goods; supplier history preserved | Schema/UI supports it; E2E remains open | PARTIALLY VERIFIED |
| Customers | Direct customer and Sub-Agent; Sub-Agent is billing party; end customer traceability | Corrected active Orders screen implements all three end-customer modes | IMPLEMENTED / E2E OPEN |
| Multi-order entry | One session can capture multiple separate orders | Corrected active Orders screen supports it | IMPLEMENTED / E2E OPEN |
| Multi-line orders | One order can contain many lines | Corrected active Orders screen supports it | IMPLEMENTED / E2E OPEN |
| Order timing | Order → Plan → Reserve/availability → Recipe → Production requirement → Wife review → Confirm | Corrected active Orders screen follows this order | IMPLEMENTED / E2E OPEN |
| Planning visibility | Current Stock → Reserved → Available → Order Qty → Shortfall → Production Required → Recipe | Corrected planning modal exposes these fields | IMPLEMENTED / E2E OPEN |
| Recipe selection | Explicit selection when multiple versions; no guessing | Corrected planning modal requires selection for production shortfall | IMPLEMENTED / E2E OPEN |
| Procurement block | Ingredient shortage must be visible; no silent production | Backend tests passed shortage blocking; final UI E2E open | PARTIALLY VERIFIED |
| Reservations | Commitment only; never physical stock movement | Backend tests passed; current planning UI labels reservation semantics | VERIFIED BACKEND / E2E OPEN |
| Production linkage | Production requirement/batch linked to exact Order + Order Line + recipe version | Live production views expose order/order-line/recipe context | VERIFIED SCHEMA / E2E OPEN |
| Production filters | Date, batch, product, status, wife approval | Corrected: filters now drive the shared DataTable itself | IMPLEMENTED / E2E OPEN |
| Wife approval | Important production/order actions require approval | RPC/UI path exists; browser validation open | PARTIALLY VERIFIED |
| Partial production | Allowed | Backend capability exists; permutation E2E remains open | PARTIALLY VERIFIED |
| Mixed fulfilment | Existing stock + production can jointly fulfil | Backend/business tests covered core path; browser E2E open | PARTIALLY VERIFIED |
| Partial dispatch | Allowed | Fulfilment console and RPC exist; E2E open | PARTIALLY VERIFIED |
| Dispatch ownership | Dispatch reduces physical stock exactly once | Controlled test passed; no duplicate sale/invoice stock movement observed | VERIFIED BACKEND |
| Sale/Invoice | Derived from actual Dispatch; no second stock reduction | Controlled test passed | VERIFIED BACKEND |
| Payments | Customer/supplier directions separate; allocations and advances | RPCs exist; payment allocation auth corrected | PARTIALLY VERIFIED |
| Supplier return | Linked to original purchase/line; FIFO stock removal | Controlled test passed | VERIFIED BACKEND |
| Customer return | Return Received → Inspect → Approve → Stock/Financial Adjustment | Table exists but no dedicated customer-return RPC was found in live public routines | OPEN / GAP |
| Purchasing | Purchase document separate from receipt/inspection | Backend and purchase UI foundations exist | PARTIALLY VERIFIED |
| Purchase shortage | Billed vs received vs accepted vs rejected; shortage formula | Controlled test path and current purchase flow support core distinction | PARTIALLY VERIFIED |
| Supplier claim | Credit/refund/dispute/replacement linked to original | Supplier return/adjustment backend exists; full UI E2E open | PARTIALLY VERIFIED |
| FIFO | Actual physical receipt/production date | Controlled FIFO crossing test passed | VERIFIED BACKEND |
| Stock-out | Separate from sale/dispatch/returns | UI/backend path exists; controlled tests passed | VERIFIED BACKEND |
| Stock adjustment | Auditable positive/negative transaction; no direct balance editing | UI payload was corrected and backend tested | VERIFIED BACKEND |
| Historical preservation | Never delete transactions to hide corrections | Backend model and correction paths preserve history | VERIFIED DESIGN / E2E OPEN |
| Reports | Read-only; sales/purchase/inventory/production/customer/supplier/sub-agent/payment/management views | Standardized reports console exists; reconciliation still open | PARTIALLY VERIFIED |
| Dashboard | Attention areas and quick actions | Basic dashboard exists; final arrangement remains open pending wife usability review | OPEN |
| Mobile | Responsive reflow, touch-friendly, mobile-first; every operational create flow tested | No independent full mobile E2E evidence yet | OPEN |
| Branding | Fixed authoritative logo/name; visual polish after functional consistency | Brand asset is in shell; final production visibility validation remains open | PARTIALLY VERIFIED |
| Security | RLS, hardened functions, no exposed secrets, auth, authorization | RLS verified; safe advisor fixes applied; remaining advisor warnings/open auth setting remain | PARTIALLY VERIFIED |
| Release | Build/lint + business tests + cross-module + reconciliation + browser E2E + mobile + no fake production data | Build/deployment/backend controlled tests pass; browser/mobile/reconciliation gates remain | NOT CLEARED |

## 3. System-wide UI law — explicit audit checklist

The following is now treated as a single system-wide law, not page-by-page convenience:

- Shared DataTable on all list/table pages.
- Server-backed search.
- Result count.
- Pagination.
- Sortable headers.
- Useful business fields.
- Permanent business codes where relevant.
- Consistent search reset.
- Consistent search interaction.
- One clear primary action per operational page.
- Clear section headings.
- No unnecessary technical IDs.
- Important stock/financial confirmation.
- Plain-language errors.
- Related-master creation reused across workflows.
- Nested creation preserves parent context and selects the newly created master.
- Mobile reflow rather than shrunken desktop layout.

### Correction made in this audit
The shared DataTable now accepts typed server-side filters. This was necessary because a filter control that only changed a modal dropdown was not sufficient evidence of a filtered list/table.

## 4. Product catalogue requirement — explicit correction

Master State v1.6 records:
- 22 approved finished/purchased-finished products.
- Previously verified type split: 16 `finished_product`, 6 `purchased_finished_product`.
- Permanent item-code families: FP and PFP.
- Item role flags include `can_be_sold` and production/intermediate roles.

The current live database was intentionally cleaned of disposable test/business-like rows. Therefore the live `items` table is currently empty rather than falsely populated.

The UI now exposes:
- **Products for Sale → Finished Products**
- **Products for Sale → Purchased Finished Products**

These views are live Item Master views and use the shared DataTable. The audit deliberately did **not** invent the six PFP classifications or recreate master records without the exact approved source data.

## 5. Order-screen regression identified and corrected

The previous active `/orders` page had been switched to a reduced operational console. The screen shown during this audit confirmed that regression: it did not present the complete approved order intake/planning experience as a unified page.

Correction:
- `/orders` now uses `orders-console-unified.tsx`.
- Direct and Sub-Agent orders are supported.
- Existing, named-unregistered and anonymous end customers are supported for Sub-Agent orders.
- Multiple orders can be captured in one session.
- Multiple lines per order are supported.
- Sellable product selection is visibly grouped into Finished Products and Purchased Finished Products where live data exists.
- Planning explicitly shows current/reserved/available/shortfall/production required.
- Recipe version selection is explicit.
- Confirmation is separate from planning.
- `/orders-partial` remains the dedicated fulfilment route for production/partial/mixed fulfilment and dispatch.

This corrects implementation drift without changing the approved business model.

## 6. Backend / live database cross-checks performed

- Live item types verified: `finished_product`, `intermediate`, `purchased_finished_product`, `raw_material`.
- Live operational transaction counts verified as zero after the disposable-data cleanup.
- Live `v_orders_list`, `v_order_production_plan`, `v_production_batches_list`, `v_purchases_list`, `v_inventory_current`, `v_supplier_outstanding` and `v_customer_outstanding` schemas inspected.
- Supplier outstanding definition inspected and confirmed to include completed purchases, supplier credits/refunds and payment allocations.
- Customer return tables inspected.
- Public RPC inventory inspected; no dedicated customer-return RPC is currently exposed.
- Payment allocation RPC execution for authenticated users was restored and rechecked in the prior audit cycle.
- Supabase RLS policies inspected on supplier outstanding source tables.

## 7. Security revalidation

Security advisor findings on 2026-09-16:
- The `v_supplier_outstanding` SECURITY DEFINER view finding was closed by setting `security_invoker = true`, because the authenticated read policies on its source tables permit the intended access.
- Anonymous execution of `save_recipe_version` was revoked. The function itself already requires `auth.uid()`.
- 40 authenticated SECURITY DEFINER function warnings remain. These are application business RPCs and must not be blindly revoked; their authorization model should be reviewed as a group.
- Supabase Auth leaked-password protection remains disabled and is a release/security setting to enable.

## 8. Evidence classification

### VERIFIED
- Controlled backend customer flow including planning, reservation, production, FIFO dispatch, sale and invoice.
- Controlled backend purchase/receipt/inspection/payment path.
- FIFO cross-batch consumption.
- Duplicate purchase receipt protection.
- Duplicate dispatch/state protection.
- Sale/invoice do not reduce inventory a second time.
- Inventory stock-out and adjustment backend paths.
- Supplier return/credit/payment path.
- Current production deployment builds successfully and is READY.
- Current production runtime error query returned no error logs in the checked two-hour window.

### PARTIALLY VERIFIED
- Purchase shortage/damage/claim settlement end-to-end.
- Order partial/mixed fulfilment.
- Payment allocation UI.
- Reports reconciliation.
- Production filter/list UI.
- Security/authorization.

### UNVERIFIED
- Full authenticated browser E2E across every operational page.
- Full mobile/tablet E2E across every create flow.
- Page-by-page UI-standard compliance evidence.
- Customer-return end-to-end workflow.
- Final logo/branding review in all approved prominent locations.
- Final financial/report reconciliation under realistic multi-transaction data.

### BLOCKED / NEEDS EXACT SOURCE DATA
- Restoring the previously approved 105 master rows after the clean test reset, especially the exact 16 FP / 6 PFP classification and any exact supplier/customer/category data. Do not guess or recreate from memory.

## 9. Release gate decision

**Phase 4 remains NOT CLEARED.**

The code/deployment is healthier and the identified Orders/product-list/filter regressions have been corrected, but the release gate explicitly requires evidence for authenticated E2E, mobile flows, reconciliation, returns, atomicity/idempotency and security review. A READY Vercel deployment is not itself Phase 4 approval.

## 10. Next integrated validation sequence

1. Verify current `main` and latest READY deployment match.
2. Authenticate through the real browser/UI.
3. Enter/restore only the exact approved real master data; do not invent classifications or quantities.
4. Test the corrected Orders screen: Direct, Sub-Agent, existing/named/anonymous end customer, multi-line, multi-order session.
5. Test plan → reservation → recipe selection → procurement block → wife approval → confirmation.
6. Test production demand linkage, partial production and mixed fulfilment.
7. Test partial dispatch → Sale + Invoice with exact one-time stock reduction.
8. Test customer payment allocations and advances.
9. Test purchase receiving → shortage/damage → supplier response → return/credit/replacement → payment.
10. Test customer return after the exact financial adjustment treatment is confirmed/implemented.
11. Reconcile inventory/FIFO/reservations, supplier outstanding, customer outstanding, sales, invoices and payments.
12. Run mobile operational flows.
13. Re-run security/performance advisors and resolve/approve each remaining finding.
14. Only after all gates pass, update the Phase 4 release status.
