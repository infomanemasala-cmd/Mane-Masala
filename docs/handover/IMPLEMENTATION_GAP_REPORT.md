# Mane Masala — Implementation Gap Report

**Basis:** authoritative Master State v1.6, historical v1.4/v1.5, available project conversation, and inspection of the current GitHub `main` tree. This is a working audit, not a claim that every browser path has passed.

## IMPLEMENTED / REPRESENTED
- Next.js/React/TypeScript application shell.
- Supabase clients, authentication foundation and session proxy.
- Supabase migration structure and audit foundation.
- Shared DataTable foundation for search/count/pagination/sort.
- Masters, permanent business-code handling and in-context master creation patterns.
- Multi-line Purchase entry and purchase attachment storage foundation.
- Receiving/inspection and inventory transaction foundations.
- Stock Out and Stock Adjustment workflow foundations.
- Recipes/recipe versions and Production workflow foundations.
- Orders with direct/Sub-Agent/end-customer traceability and production planning work.
- Partial production/partial approval/procurement workflow foundations.
- Dispatch → Sale → Invoice workflow foundations.
- Customer/supplier payment and allocation foundations.
- Reports standardized console.
- Dashboard and theme/branding foundations.
- `/orders-partial` review route and Urgent Procurement dashboard support were created during Phase 4.

## PARTIALLY IMPLEMENTED / REQUIRES RELEASE EVIDENCE
- Purchase end-to-end workflow: code exists, but authenticated browser/mobile E2E and complete business reconciliation still need evidence.
- Purchase line shortage/damage/supplier-response settlement: implementation has been extended, but must be tested against the actual current Supabase schema and realistic transactions.
- Supplier credit/refund/dispute treatment: business rule is defined; full UI/report/payment reconciliation remains to be proven.
- Order partial approval and mixed fulfillment: database-level tests exist; final production UI and full E2E still need verification.
- DataTable standard: shared infrastructure exists, but every relevant page must be checked page-by-page.
- Branding/logo: asset exists and integration work has occurred, but visibility in the current production deployment must be verified.
- Reports: standardized console exists, but values need independent reconciliation.
- Mobile: responsive foundations exist; operational create flows still require small-screen validation.
- Atomicity/idempotency: database hardening exists in several areas; evidence is still required across all critical operations.

## UNKNOWN UNTIL VERIFIED
- Current production runtime error state after the latest source changes.
- Exact current Vercel deployment-to-commit mapping after the most recent documentation/code changes.
- Full authenticated browser E2E across all required permutations.
- Full mobile E2E across all operational create flows.
- Page-by-page sortable/search/count/pagination compliance.
- Full cross-report reconciliation after realistic current transactions.

## CONFLICTING / RECONCILIATION REQUIRED
### Version numbering request vs current authoritative state
- Earlier state: v1.4 was the approved Phase 4 entry state.
- Historical v1.5 exists in the Project Library.
- Current authoritative state: v1.6 explicitly says it is the continuity source of truth and says not to create another Master State until a meaningful state change.
- Resolution: do not manufacture a second v1.5 containing later v1.6 decisions. Preserve v1.4/v1.5 as historical archives and continue from v1.6.

### Purchase invoice/slip terminology
- Master State: supplier invoice number is supported; generated system reference is used when supplier invoice number is missing.
- Later user clarification: Mane Masala must generate the permanent Purchase No.; the shopkeeper/supplier slip reference is captured separately when available.
- Resolution: treat Purchase No. as the system-generated permanent identifier and supplier slip/bill reference as an optional physical-document reference. Do not expose technical UUIDs as the user's primary supplier/purchase identifier.

### Purchase financial amount when physical shortage occurs
- Approved rule: shortage does not silently reduce the original financial purchase. It remains based on agreed billed quantity/rate unless supplier credit/refund/adjustment is agreed.
- Later clarification: if supplier honours the shortage/damage, system calculates the affected value and reduces payable by the agreed credit/refund; if supplier refuses, keep the amount disputed and do not reduce payable.
- Resolution: this is a refinement, not a contradiction: original bill is preserved; payable is adjusted only by an explicit supplier settlement.

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

## Evidence currently available
- GitHub repository exists and `main` is active.
- Current repository tree includes application, components, docs, Supabase migrations and CI configuration.
- Supabase project is established and the Master State records it as active/healthy from prior verification.
- Database-level transactional tests have previously been performed and rolled back where stated in the continuity context.
- The user's browser visual review of the partial-order route was positive, but this is not authenticated E2E proof.

## Release interpretation
**Repository/code exists ≠ implemented correctly. READY deployment ≠ Phase 4 approved.** Every PARTIALLY IMPLEMENTED and UNKNOWN item that is a Phase 4 release gate must be tested and evidenced before clearance.
