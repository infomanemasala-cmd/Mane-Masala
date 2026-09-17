# Mane Masala — Implementation Gap Report

**Basis:** exact Project Library Master States v1.4/v1.5/v1.6, available project conversation context, and inspection of the current GitHub `main` tree plus current Vercel deployment evidence. This is an audit record, not a claim that every browser path has passed.

## IMPLEMENTED / REPRESENTED IN CURRENT REPOSITORY
- Next.js/React/TypeScript application shell.
- Supabase browser/server clients, authentication foundation and session proxy.
- Supabase migration structure and audit foundation.
- Shared DataTable foundation for search/count/pagination/sort.
- Masters, permanent business-code handling and in-context master creation patterns.
- Finished Product and Purchased Finished Product sellable-product separation in order entry and Masters UI.
- Multi-line Purchase entry and purchase attachment foundation.
- Purchase Receive & Inspect and line-level shortage/damage/supplier-response settlement workflow.
- Inventory transaction foundations, Stock Out and Stock Adjustment workflow.
- Recipes/recipe versions and Production workflow foundations.
- Orders with Direct/Sub-Agent/end-customer traceability, multi-order entry sessions, multi-line orders and planning.
- Partial production/partial approval/procurement workflow foundations and Urgent Procurement dashboard support.
- Dispatch → Sale → Invoice workflow foundations.
- Customer/supplier payments, allocation and advance foundations.
- Standardized reports console.
- Dashboard/theme/branding foundations.
- Phase 4 runtime correction migrations for UUID volatility, purchase unit conversion, physical receipt-date FIFO and supplier financial reconciliation.

## PARTIALLY IMPLEMENTED / REQUIRES RELEASE EVIDENCE
- Purchase end-to-end workflow: current code exists, but authenticated browser/mobile E2E and full reconciliation remain to be evidenced.
- Purchase line shortage/damage/supplier-response settlement: current code and database changes exist; realistic current-live runtime tests remain required.
- Supplier credit/refund/dispute treatment: business rule is defined and code exists; payment/outstanding/report reconciliation must be proven end-to-end.
- Replacement receipt linkage: schema/business rule exists; runtime proof of later linked replacement remains required.
- Supplier return: schema and workflow foundations exist; complete browser/runtime test remains required.
- Order partial approval and mixed fulfillment: database-level tests exist; final current-production authenticated E2E remains open.
- DataTable standard: shared infrastructure exists; page-by-page compliance still needs evidence.
- Branding/logo: authoritative asset and integration work exist; current production visual verification remains open.
- Reports: standardized console exists; values need independent transaction-level reconciliation.
- Mobile: responsive foundations exist; every operational create flow still requires small-screen validation.
- Atomicity/idempotency: hardening exists in several critical operations; complete evidence across all release-critical actions is still open.
- Customer return: customer-return tables and business rule exist, but a dedicated current live end-to-end operation still requires explicit verification.

## IMPLEMENTATION / RUNTIME CORRECTIONS RECORDED
- D1 UUID generator: live wrapper volatility corrected to VOLATILE.
- D2 F-07 purchase-unit conversion: controlled purchase-unit to base-unit conversion installed; conversion occurs once at receipt.
- D3 F-02 FIFO receipt date: explicit physical receipt date is preserved as inventory batch date.
- D4 supplier financial reconciliation: supplier credit/refund adjustments are included in payment allocation due and purchase financial status synchronization.
- Partial approval reservation scaling defect: existing capped reservation is not scaled a second time.
- Production-plan MutationObserver freeze: identical label text is no longer rewritten inside the observer loop.
- Dropdown search: code and item/product name are intended to be searchable while display remains `CODE — Name`; current production runtime should still be checked before calling this fully validated.

## UNKNOWN UNTIL VERIFIED
- Full authenticated browser E2E across all required permutations.
- Full mobile E2E across all operational create flows.
- Page-by-page sortable/search/count/pagination compliance.
- Complete report reconciliation after realistic current transactions.
- Full runtime verification of the four 2026-09-17 defect corrections.
- Complete customer-return browser flow.
- Exact current master/opening-stock restoration state; do not guess historical data.
- Final branding visibility in current production.

## CONFLICTS / RECONCILIATION REQUIRED

### C-001 — Version numbering request vs current authoritative state
- Earlier state: v1.4 was the approved Phase 4 entry state.
- Historical v1.5 exists in the Project Library.
- Current authoritative state: v1.6 explicitly says it is the continuity source of truth and says not to create another Master State until a meaningful state change.
- Resolution: do not manufacture a second v1.5 carrying later v1.6 decisions. Preserve historical v1.4/v1.5 and continue from v1.6. The requested v1.5 filename is already represented in the repository as an archive notice and the exact historical file is preserved in Library.

### C-002 — Purchase invoice/slip terminology
- Earlier Master State wording: supplier invoice number is supported; generated system reference is used when missing.
- Later user clarification: Mane Masala must generate the permanent Purchase No.; the supplier/shopkeeper slip reference is captured separately when available.
- Resolution: Purchase No. is the system-generated permanent identifier; supplier slip/bill reference is optional source-document data. Do not expose technical supplier UUIDs as the primary user field.

### C-003 — Purchase financial amount when physical shortage occurs
- Base rule: shortage does not silently reduce the original financial purchase.
- Later refinement: if supplier honours, agreed credit/refund reduces payable; if supplier refuses, amount remains disputed and payable is not reduced.
- Resolution: not a contradiction. Preserve original bill; adjust payable only through an explicit supplier settlement.

### C-004 — Historical order timing wording
- Earlier v1.4/v1.5 wording described confirmation before planning.
- Later v1.6 clarification states order creation starts planning before final wife confirmation.
- Resolution: v1.6 supersedes the older timing for current implementation; historical wording remains preserved in historical files.

## NOT IMPLEMENTED / FUTURE / OPEN BY DESIGN
- Exact financial-year numbering/reset.
- Detailed GST/accounting rules.
- Exact bulk-to-pack operating method.
- Detailed permission matrix beyond MVP wife/admin approval.
- Final dashboard arrangement after usability review.
- Exact invoice visual design.
- Exact expiry-alert threshold.
- Exact negative-stock exception policy.
- Final intermediate classification.
- ChatGPT conversational entry, OCR automation, WhatsApp automation, forecasting, supplier scoring, advanced analytics, barcode/QR, marketplace/courier automation, advanced packaging conversion and advanced production overhead costing.

## REPOSITORY CHECK — CURRENT MAIN
- Repository exists and default branch is `main`.
- Current inspected commit: `90bf801861606e4a40481be7e9bbf4efc2fc7dae`.
- Current source contains `/orders` → `OrdersConsoleUnifiedV6` and `/purchases` → `PurchaseConsoleV3` + purchase history.
- Repository contains CI configuration, migrations, application pages/components and continuity documentation.
- The current production deployment is READY for the same commit and GitHub's combined Vercel status is `success`.
- A 6-hour production runtime error/fatal query for that deployment returned no route entries.

## DATABASE / MIGRATION CHECK
- Supabase project is established in the project context.
- Current repository includes the Phase 4 migration history and recent correction migrations.
- Live migration/application state must continue to be checked because repository migration presence alone does not prove live activation.
- No real Mane Masala business data was imported as part of the continuity-documentation task.

## RELEASE INTERPRETATION
**Repository/code exists ≠ implemented correctly. READY deployment ≠ Phase 4 approved.** Every PARTIALLY IMPLEMENTED and UNKNOWN item that is a Phase 4 release gate must be tested and evidenced before clearance.
