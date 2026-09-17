# MANE MASALA — MASTER STATE REVALIDATION
## Phase 4 — Prompt 1 of 3: Master State + Business Logic Baseline

**Date:** 2026-09-17  
**Scope:** Requirements/business-logic revalidation only.  
**Application code changes in this pass:** None.  
**Implementation/E2E validation:** Explicitly deferred to Prompt 2/3.

---

## 1. Executive Summary

This pass establishes the validated baseline for **what Mane Masala is supposed to do**, before using the application implementation as evidence.

The authoritative current state is **MM-BUSINESS-SPEC-1.6**. Historical v1.4 and v1.5 remain preserved archives. v1.6 explicitly supersedes older order-flow wording where it conflicts with the later clarification.

The most important finding is that the approved business model is internally coherent, but several details must remain explicitly open/ambiguous rather than being inferred by implementation:

1. **Subcategories are not an established approved business entity/rule** in the historical Master States or Decision Register.
2. **Base unit vs purchase unit vs transaction/recipe/selling unit** is now an explicit validation concern, but the historical documents only state that unit conversion must be explicit and controlled. The exact data/operating model is not yet approved.
3. The **22 sellable products** are historically established, with a previously verified split of **16 Finished Products + 6 Purchased Finished Products**. The documentation sometimes labels the full 22 as “Finished products”; the distinction is clarified elsewhere. This must not be lost in implementation.
4. **Bulk-to-pack mechanics, financial-year numbering, GST/tax details, detailed permissions, dashboard arrangement, invoice visual design, expiry threshold, negative-stock exceptions, and final intermediate classification remain open**.
5. A historical implementation note still says a persistent TEST ONLY order was retained, while the later clean-test/reset record says operational test data was cleaned. This is a **documentation-state conflict for Prompt 2 to verify against the actual database**, not a business-rule decision.
6. The historical record preserves the major real-world incidents and edge cases that shaped the business rules: shortage vs billed quantity, supplier honour/refusal, linked replacement, partial approval/reservation scaling, multi-order entry, sub-agent end-customer modes, recipe variance/yield, mixed fulfilment, and the Dispatch/Sale/Invoice double-stock-reduction issue.

**Baseline conclusion:** The business requirements are sufficiently defined for Prompt 2 to audit implementation, except where explicitly marked AMBIGUOUS/UNRESOLVED. No new business rule has been invented in this pass.

---

## 2. Audit Plan Executed

This Prompt 1 audit used the following sequence:

1. Read the complete continuity package and its manifest/readme.
2. Read historical Master State v1.4.
3. Read historical Master State v1.5.
4. Read current authoritative Master State v1.6 in full.
5. Read AGENTS.md and VALIDATION_PROTOCOL.md.
6. Read Decision Register, Change Log, Handover and Implementation Gap Report.
7. Read UI Standard and Wife-Friendly UX Standard.
8. Read Core Business Rules, Core Workflows, Architecture and Database Notes.
9. Read Implementation Notes and prior Phase 4 controlled-test/revalidation records.
10. Search the Project Library for historical incidents, examples, terminology, rejected/deferred ideas and unit/product distinctions.
11. Compare historical v1.4/v1.5 → v1.6 → durable decisions/supporting docs.
12. Record contradictions and unresolved points without silently resolving them.
13. Create this requirements baseline and matrix for Prompt 2.

This pass deliberately does **not** treat current code, current browser UI, current database behaviour or deployment status as proof of business correctness.

---

## 3. Documents Reviewed

### Continuity / historical source material
- `MANE_MASALA_MASTER_STATE_v1.4.md` — Project Library archive.
- `MANE_MASALA_MASTER_STATE_v1.5.md` — Project Library archive.
- `MANE_MASALA_MASTER_STATE_v1.6.md` — current authoritative Project Library state.
- `CONTINUITY_README.md`
- `PACKAGE_MANIFEST.md`

The continuity package was also materialized and inspected. It contains the three complete Master States plus continuity instructions/manifest.

### Repository governance / validation
- `/AGENTS.md`
- `/VALIDATION_PROTOCOL.md`

### Repository supporting documentation
- `docs/decisions/DECISION_REGISTER.md`
- `docs/CHANGE_LOG.md`
- `docs/handover/HANDOVER_TO_NEXT_CHAT.md`
- `docs/handover/IMPLEMENTATION_GAP_REPORT.md`
- `docs/UI_STANDARD.md`
- `docs/master-state/ARCHIVE_AND_VERSION_POLICY.md`
- `docs/business-rules/CORE_BUSINESS_RULES.md`
- `docs/workflows/CORE_WORKFLOWS.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/database/DATABASE_NOTES.md`
- `docs/ux/UX_STANDARD.md`
- `docs/testing/TEST_MATRIX.md`
- `docs/implementation/IMPLEMENTATION_NOTES.md`
- `docs/phase4-step1-controlled-test-2026-09-16.md`
- `docs/phase4-integrated-revalidation-2026-09-16.md`

### Historical project-derived material
Project Library artifacts containing the continuity/handover and validation prompts were searched for:
- historical incidents
- examples
- edge cases
- UI decisions
- rejected/deferred scope
- purchase examples
- unit conversion examples
- product classification
- order/production clarification

### Important source limitation
The available continuity package does **not** contain a verbatim export of the entire historical chat transcript. Historical decisions that were not separately preserved in Master State/Decision Register/supporting documentation therefore cannot be claimed as recovered. Where the available material does not establish a fact, this report leaves it ambiguous/unresolved rather than guessing.

---

## 4. Source-of-Truth Reconciliation

The project has a clear hierarchy:

1. Current Master State v1.6 — authoritative design state.
2. Approved decisions in the current conversation until incorporated into a later Master State.
3. Historical Master States — preserved reference/history.
4. Proposed ideas — not requirements.
5. Memory/context — continuity aid, not business source of truth.

v1.6 explicitly says it supersedes older order wording and must be used as the current continuity state.

### Important historical supersession

v1.4/v1.5 used the older shorthand:

**Order → Confirm → Stock Check → Reserve → Production Requirement...**

v1.6 explicitly replaces this with:

**Customer calls → Order raised → Order Plan prepared → stock/reservations checked → recipe selected where required → production requirement calculated → wife reviews/approves → Order Confirmed → existing stock and/or production → Ready → Dispatch → Sale + Invoice → Payment/Outstanding → Reports.**

This is a genuine historical contradiction, but it is **resolved by the later approved v1.6 decision**. Prompt 2 must therefore audit the implementation against v1.6, not the older wording.

---

## 5. Requirements Confirmed

### Product / master data
- Four controlled item types: Raw Material, Intermediate/Prepared Material, Finished Product, Purchased Finished Product.
- 83 approved raw materials, RM-001 through RM-083.
- 22 approved sellable finished/purchased-finished products.
- Previously verified split: 16 Finished Products and 6 Purchased Finished Products.
- Permanent item identity is retained when an item has multiple business roles.
- Product pack sizes can be separate sellable inventory items while sharing a product family.
- Suppliers, customers, categories and units are controlled masters.
- Suppliers become inactive rather than being deleted.
- Historical records remain traceable.
- The final classification of certain possible Intermediate items remains open.

### Purchasing / receiving
- One supplier bill/slip represents one Purchase document.
- A Purchase can contain many item lines.
- Mane Masala generates the permanent Purchase No.
- Supplier/shopkeeper invoice/slip reference is a separate physical-document reference.
- Purchase date and entry date are distinct concepts.
- Billed quantity is separate from physical received quantity.
- Received, Accepted and Rejected/Damaged are distinct line-level concepts.
- Shortage = Billed − Received.
- Only Accepted physical quantity becomes usable inventory.
- Supplier response is recorded per affected line.
- Honoured claims reduce payable only through an explicit agreed credit/refund/adjustment.
- Refused claims remain disputed and do not silently reduce the original payable.
- Replacement receipts link back to the original purchase/line.
- Original purchase history remains preserved.
- Duplicate supplier invoice/reference warning is required.
- Missing rate may be calculated from reliable information but must be shown/confirmed.
- Attachments are linked to the purchase transaction.
- Receiving and inspection remain separate from purchase entry.

### Units
- Approved unit set: kg, g, litre, ml.
- Conversions must be explicit and controlled.
- The project must not assume that a purchase unit equals the base/inventory unit.
- The 250 g / 500 g / 750 g example establishes the need for conversion, but the exact approved unit-conversion data model is not preserved in the historical Master State.

### Inventory / FIFO
- Inventory is transaction based.
- Current stock is derived, not manually typed.
- Reservation is a commitment, not physical stock movement.
- Available Stock = Current Stock − Active Reservations.
- Accepted purchase receipt creates inventory.
- Production consumption reduces ingredient/intermediate inventory.
- Production output creates inventory.
- Dispatch owns finished-stock physical reduction exactly once.
- Sale does not reduce the same stock again.
- Invoice does not reduce stock.
- Stock-out reduces stock explicitly.
- Supplier return reduces stock.
- Approved customer return may add stock only after inspection/approval.
- Positive and negative adjustments are explicit audited transactions.
- Historical transactions are not deleted to correct errors.
- FIFO uses actual physical receipt/production dates.
- FIFO applies to dispatch, production consumption, stock-outs and other physical consumption.
- Each physical purchase receipt and production output creates an inventory batch.
- Low stock does not automatically create a purchase or production order.
- Exact expiry alert threshold is open.
- Exact negative-stock exception policy is open.

### Recipes / production
- Only wife/admin initially creates or changes recipes.
- Recipe versions are preserved.
- Standard recipe changes create a new version after approval.
- One-time batch variance affects only that batch.
- Recipe inputs define formulation.
- Expected finished output is independent of total input weight.
- Ingredient requirements scale by required finished output / expected recipe output.
- Actual ingredient consumption and actual finished output are authoritative.
- Partial production is allowed.
- Wastage is recorded where applicable.
- Intermediate/prepared material is real inventory and follows FIFO.
- Production is demand-linked to Order + Order Line where customer demand caused it.
- Exact bulk-to-pack operating method remains open.
- Advanced production overhead costing is future scope.

### Orders
- Order is a business transaction, not an invoice.
- Order creation starts planning.
- Planning happens before final wife confirmation.
- One order may contain many item lines.
- One entry session may contain multiple separate customer orders.
- Each separate order remains a separate permanent Order transaction.
- Direct order billing party is Customer.
- Sub-Agent order billing party is Sub-Agent.
- End customer is separately traceable and can be existing, named/unregistered or anonymous.
- Customer-specific selling rates are allowed.
- Advance can be recorded.
- Requests, notes, source, attachments and estimated dispatch date are supported.
- Planning must expose stock/reservation/availability/shortfall/production/recipe/ingredient information.
- Multiple applicable recipe versions require explicit choice.
- A unique applicable active recipe may be preselected but must remain visible.
- No applicable recipe means no guessing and a production block.
- Insufficient ingredient stock creates a procurement requirement/block.
- Partial approval is allowed where supported.
- Existing reservations must not be scaled down twice.
- Existing stock and production may jointly fulfil one order line.
- Partial production and partial dispatch are allowed.
- Customer changes after production starts use revisions/history.
- Cancellation must preserve history and handle produced stock appropriately.

### Dispatch / sale / invoice
- Dispatch records actual quantities/date/method.
- Dispatch consumes reserved/FIFO stock as appropriate.
- Dispatch reduces physical stock exactly once.
- Dispatch may be partial and multiple.
- Sale is created from actual approved Dispatch.
- Invoice is generated from Sale.
- No unnecessary re-entry of dispatched item/customer/quantity.
- Sale and Invoice do not reduce stock again.
- Financial document creation remains a separate auditable database event even though the UX should feel continuous.
- Invoice PDF/printing is MVP.
- Final invoice visual design is open.

### Payments
- Customer and supplier payment directions are distinct.
- Cash and UPI are supported.
- Actual payment date is recorded.
- UPI reference is supported/encouraged.
- Payments are separate transactions.
- Allocation records connect payments to purchases/invoices.
- One payment can cover multiple documents.
- Multiple payments can cover one document.
- Unallocated amounts remain explicit advances.
- No fixed credit period is assumed.

### Returns / corrections
- Supplier returns link to original purchase/purchase line.
- Multiple supplier returns are allowed.
- Customer return is:
  **Return Received → Inspect → Approve → Stock/Financial Adjustment**.
- Returned goods do not automatically become saleable stock.
- Corrections use returns, adjustments, reversals, revisions and linked correction records.
- History is never deleted.

### Reporting / dashboard
- Reports are read-only.
- Sales, purchase, inventory, production, customer, supplier, Sub-Agent, payment and management report families are approved.
- Useful charts are approved.
- CSV/PDF/print export is approved; Excel export is not currently required.
- Dashboard priority areas are approved.
- Final dashboard arrangement remains open pending actual wife usability review.

### UX
- Wife is the primary operational user and essentially a zero-computer user.
- Plain language.
- One obvious next action.
- Minimal unnecessary fields.
- No unnecessary technical IDs.
- Permanent business codes shown where useful.
- Strong confirmation for important stock/financial actions.
- Clear business-language errors.
- Shared DataTable standard.
- Related-master creation in context where practical.
- Nested creation preserves parent form and selects the new record.
- Mobile/tablet-first responsive reflow.
- Tables may scroll horizontally inside their own container.
- Fixed supplied Mane Masala logo/name.
- Food-business visual language is allowed around the fixed brand.

### Future scope
The following are deliberately not MVP requirements:
- ChatGPT conversational entry
- OCR automation
- WhatsApp automation
- advanced GST/accounting
- automatic purchase orders
- forecasting
- supplier scoring
- advanced customer analytics
- advanced Sub-Agent analytics
- barcode/QR
- marketplace/courier automation
- complex permissions
- advanced packaging conversion
- advanced production overhead costing

---

## 6. Historical Decisions Confirmed

The current Decision Register contains **27 numbered approved decisions (D-001 to D-027)** and **12 numbered open decisions (OPEN-001 to OPEN-012)**.

Important approved decisions include:
- approved technical stack
- complete-core-loop MVP principle
- transaction ownership for inventory
- physical-date FIFO
- permanent IDs
- Order creation starts planning
- explicit recipe-version choice
- reservation semantics
- Dispatch/Sale/Invoice relationship
- multi-order and multi-line entry
- multi-role item identity
- partial production/mixed fulfilment
- partial approval/procurement blocking
- reservation scaling correction
- formulation vs actual yield
- recipe-version preservation
- purchase vs physical receipt separation
- Purchase No. vs supplier slip reference
- line-level receiving decisions
- supplier claim settlement
- customer returns
- supplier returns
- payment allocations
- no automatic work from low stock
- MVP exclusions
- system-wide UI law
- Finished Product/Purchased Finished Product visible separation

The historical Decision Register is consistent with v1.6 on these decisions.

---

## 7. Historical Incidents / Real-World Examples Confirmed

### Incident 1 — Order planning timing
**Scenario:** The earlier implementation/wording could confirm an order before planning.

**Approved behaviour:** Order creation starts the planning process. Stock/reservation/recipe/production requirements are reviewed before final wife confirmation.

**Rule:** D-006 / v1.6 §8.

**Baseline status:** Preserved and explicitly superseded old wording.

---

### Incident 2 — Partial approval reservation scaling bug
**Scenario:** A line requiring 1 kg had only 0.6 kg support. An existing reservation could incorrectly be scaled again, producing an incorrect 0.36 kg reservation.

**Approved behaviour:** Partial approval can be 0.6 kg, and an existing capped reservation must not be scaled down a second time.

**Rule:** D-013 and D-014.

**Baseline status:** Preserved as an explicit regression scenario for Prompt 2.

---

### Incident 3 — Purchase shortage vs accepted stock
**Scenario:** Bill 25 kg, physical receipt 24.5 kg; an example further distinguishes accepted and rejected/damaged quantity.

**Approved behaviour:** Billed quantity remains distinct from physical receipt. Only accepted physical quantity enters usable inventory. Shortage is tracked separately.

**Rule:** D-019/D-020 and purchase rules.

**Baseline status:** Preserved.

---

### Incident 4 — Supplier honours shortage/damage
**Scenario:** Supplier agrees to compensate for an affected quantity.

**Approved behaviour:** Record supplier response and an explicit agreed credit/refund/adjustment. Payable is reduced by the agreed settlement value; original purchase remains intact.

**Rule:** D-020.

**Baseline status:** Preserved.

---

### Incident 5 — Supplier refuses claim
**Scenario:** Supplier refuses the shortage/damage claim.

**Approved behaviour:** Do not silently reduce payable. Preserve the affected amount as disputed/pending.

**Rule:** D-020.

**Baseline status:** Preserved.

---

### Incident 6 — Later replacement
**Scenario:** Supplier later sends the missing quantity.

**Approved behaviour:** Record a linked replacement receipt against the original purchase/purchase line, not an unrelated new purchase.

**Rule:** D-020.

**Baseline status:** Preserved.

---

### Incident 7 — Multi-order entry session
**Scenario:** Several customers/orders may be captured during one operator session.

**Approved behaviour:** One session may contain multiple separate Orders; each receives its own permanent Order identity.

**Rule:** D-010.

**Baseline status:** Preserved.

---

### Incident 8 — Sub-Agent end-customer traceability
**Scenario:** A Sub-Agent places the order for an end customer who may already exist, may only be named, or may be anonymous.

**Approved behaviour:** Sub-Agent is billing party; end customer remains separately traceable in the appropriate mode.

**Rule:** v1.6 §7/§8, D-010.

**Baseline status:** Preserved.

---

### Incident 9 — Recipe input weight vs finished yield
**Scenario:** Finished output does not necessarily equal total ingredient input weight.

**Approved behaviour:** Recipe formulation quantities and expected output are separate. Actual output is recorded independently.

**Rule:** D-015.

**Baseline status:** Preserved.

---

### Incident 10 — Multiple recipe versions
**Scenario:** More than one applicable recipe version exists.

**Approved behaviour:** Wife receives an explicit version choice. No silent selection.

**Rule:** D-007.

**Baseline status:** Preserved.

---

### Incident 11 — No recipe / insufficient ingredient
**Scenario:** Ordered finished product has no applicable recipe or its required ingredient is unavailable.

**Approved behaviour:** Block or mark purchase-required; never silently guess a recipe or fabricate production capacity.

**Rule:** v1.6 §8.4, test matrix, GAP-002/GAP-023.

**Baseline status:** Preserved.

---

### Incident 12 — Reserved stock vs another order
**Scenario:** Stock reserved for one order must not be consumed by another order.

**Approved behaviour:** Reservation protects the committed quantity from unrelated consumption while leaving physical stock unchanged.

**Rule:** D-008 and permutation matrix.

**Baseline status:** Preserved.

---

### Incident 13 — Mixed fulfilment
**Scenario:** Part of an order can be fulfilled from existing stock and the remainder through production.

**Approved behaviour:** Existing reserved stock and produced stock may jointly fulfil the order.

**Rule:** D-012.

**Baseline status:** Preserved.

---

### Incident 14 — Dispatch/Sale/Invoice double deduction
**Scenario:** Treating Sale or Invoice as another stock movement would deduct the same goods twice.

**Approved behaviour:** Dispatch owns physical stock reduction; Sale and Invoice are financial/audit records only.

**Rule:** D-003/D-009 and v1.6.

**Baseline status:** Preserved as a critical invariant.

---

### Incident 15 — Bulk-to-pack
**Scenario:** Example conversion such as 12 kg bulk → 40 × 250 g packs + remainder.

**Approved behaviour:** Must be a controlled conversion, not an unexplained stock adjustment.

**Rule:** OPEN-003.

**Baseline status:** Example preserved; operating method remains unresolved.

---

## 8. Contradictions Found

### C-001 — Old order timing vs v1.6
**Older statement:** Confirm before planning/stock check.

**Later statement:** Order creation starts planning; wife reviews plan before final confirmation.

**Resolution:** v1.6 explicitly supersedes the old wording.

**Status:** CONTRADICTION RESOLVED BY AUTHORITATIVE LATER DECISION.

---

### C-002 — Historical implementation note vs clean-data continuity state
`docs/implementation/IMPLEMENTATION_NOTES.md` states that a persistent TEST ONLY order was deliberately retained.

The later Step 1 controlled-test evidence states that disposable test records were cleaned before the clean go-live reset, and v1.6 records zero operational transactions in the live database.

**Resolution:** This is not a business-rule conflict. It is a **documentation/runtime-state conflict** that Prompt 2 must verify against the actual live database and then correct in documentation if stale.

**Status:** IMPLEMENTATION STATE VERIFICATION REQUIRED.

---

### C-003 — “22 finished products” wording vs explicit 16 FP / 6 PFP split
Some Master State headings refer to all 22 as “Finished products”, while the item-type model and later Decision D-027 clearly distinguish Finished Product and Purchased Finished Product.

**Resolution:** Treat the authoritative catalogue as **22 sellable finished/purchased-finished products = 16 FP + 6 PFP**. Do not collapse the two controlled item types.

**Status:** DOCUMENTATION CLARIFICATION REQUIRED; BUSINESS MODEL ITSELF IS CONFIRMED.

---

## 9. Missing / Ambiguous Requirements

### A-001 — Subcategories
The Prompt 1 checklist asks for subcategories, but the recovered Master States, Decision Register and supporting business-rule documents establish **Categories**, not a separately approved Subcategory model.

**Status:** MISSING / UNRESOLVED BUSINESS DECISION.

Prompt 2 must not invent a subcategory implementation simply because the word appears in this validation prompt.

---

### A-002 — Exact unit-conversion model
The historical project establishes:
- kg/g/litre/ml
- explicit controlled conversion
- purchase and physical quantity are distinct concepts.

However, the exact approved data model for:
- base unit
- purchase unit
- transaction unit
- recipe unit
- selling/packing unit
- conversion factors
- rounding rules
- price-rate interpretation

is not fully preserved.

**Status:** AMBIGUOUS / UNRESOLVED BUSINESS DECISION.

Prompt 2 must inspect the current schema and classify any existing implementation, but must not assume an unapproved conversion model is correct.

---

### A-003 — Exact treatment of produced stock after cancellation
Cancellation after planning/production is explicitly required to preserve history and handle produced stock, but the exact business disposition of already-produced stock after cancellation is not fully stated.

**Status:** AMBIGUOUS implementation/business edge detail.

Prompt 2 should identify exactly what the current system does; no new policy should be invented.

---

### A-004 — Exact FIFO treatment for every return/correction edge
FIFO is explicit for physical consumption, but the precise batch-selection/restoration policy for every customer-return and correction scenario is not fully documented.

**Status:** AMBIGUOUS.

Prompt 2 must audit existing implementation and avoid inventing a new return-costing rule.

---

## 10. Open Decisions — Must Remain Open

The following must not be silently resolved during implementation:

1. Exact financial-year numbering/reset rules.
2. Detailed GST/tax implementation.
3. Exact bulk-to-pack operating method.
4. Detailed permissions beyond MVP wife/admin approval.
5. Final dashboard arrangement after wife usability review.
6. Exact invoice visual design.
7. Expiry alert threshold.
8. Negative-stock exception policy.
9. Final intermediate classification.
10. Phase 4 browser/mobile/release evidence.
11. Grouped authorization review of authenticated SECURITY DEFINER functions.
12. Supabase Auth leaked-password protection configuration.

The historical Decision Register also records the technical stack as resolved; it is not an open decision.

---

## 11. Previously Rejected / Deferred / Excluded Ideas

The recovered documentation does not provide a complete verbatim list of every historical rejected proposal. It does, however, preserve the explicit MVP boundary and items that must not be reintroduced as current requirements.

Do not silently introduce:
- ChatGPT conversational data entry
- OCR automation
- WhatsApp automation
- automatic purchase orders
- forecasting
- supplier scoring
- advanced customer/Sub-Agent analytics
- barcode/QR
- marketplace/courier automation
- complex permissions
- advanced packaging conversion
- advanced production overhead costing
- detailed GST/accounting rules
- automatic production solely because stock is low
- invented credit periods
- invented tax rates
- invented financial-year numbering
- invented negative-stock exceptions
- invented expiry thresholds
- invented product classification
- unrelated duplicate item identities

The exact historical “rejected alternatives” list is not fully recoverable from the available durable material; therefore this report does not claim more than the preserved exclusions.

---

## 12. Documentation Corrections Recommended

These are documentation-baseline corrections, not application changes:

1. Make the phrase **“22 sellable finished/purchased-finished products — 16 FP + 6 PFP”** the consistent catalogue wording.
2. Add an explicit note that **Subcategory is not currently an approved business entity** unless separately approved.
3. Add an explicit unit-conversion decision only after the business model is confirmed; until then keep the current wording “explicit and controlled”.
4. Reconcile the stale Implementation Notes statement about a retained TEST ONLY order against the actual live database in Prompt 2.
5. Preserve the old order wording only as historical/superseded material and ensure current documentation always uses the v1.6 timing.
6. Keep open decisions visibly separate from MVP requirements.
7. Keep future upload automation/ChatGPT/OCR/WhatsApp scope separate from current MVP.

---

## 13. Prompt 2 Implementation Audit Baseline

Prompt 2 must compare the actual implementation against this baseline, not redesign the baseline.

### Highest-risk areas to inspect first
1. Orders: active route must follow v1.6 timing, not the old confirm-first flow.
2. System-wide UI law: the same standard must actually appear on every relevant list/form.
3. Finished Product vs Purchased Finished Product: visible, distinct, correctly sourced from the permanent item model.
4. Units: verify actual conversion model against approved rules; flag any guessed semantics.
5. Purchasing: billed vs received vs accepted vs rejected/damaged and supplier settlement.
6. Inventory: exact ownership of every physical movement.
7. FIFO: actual batch allocation by physical date.
8. Production: recipe version, demand linkage, partial production, actuals, intermediate stock.
9. Mixed fulfilment and reservation correctness.
10. Dispatch → Sale → Invoice: exactly one physical stock reduction.
11. Payments: allocation/advance/outstanding.
12. Customer return workflow.
13. Reports: definitions and derivation from approved transactions.
14. Related-master creation consistency.
15. Page-by-page shared DataTable compliance.
16. Mobile/tablet-first workflow behaviour.
17. Security/authorization and atomicity.

### Prompt 2 must classify each implementation item as
- VERIFIED
- FAILED
- PARTIALLY VERIFIED
- NOT IMPLEMENTED
- NOT VISIBLE
- VERIFICATION REQUIRED
- OPEN DECISION

No source-code presence alone is sufficient evidence.

---

## 14. Baseline Business Flow

### Customer
**Customer calls → Order raised → Order Plan prepared → stock/reservations checked → recipe version selected where required → production requirement calculated → wife reviews/approves → Order Confirmed → existing reserved stock and/or production → actual production → Ready → Dispatch → Sale + Invoice → Payment/Outstanding → Reports**

### Purchasing
**Purchase → Receive → Inspect → Accept / Shortage / Return → Inventory → Supplier Payable → Payment**

### Production
**Order Production Requirement → Recipe Version → Production Batch → Ingredient Requirement → FIFO/availability check → Wife Approval → Start/In Production → Actual Consumption → Actual Output → Wastage → Inventory**

### Customer return
**Return Received → Inspect → Approve → Stock/Financial Adjustment**

### Critical inventory ownership
**Reservation ≠ physical movement.  
Dispatch = physical finished-stock movement.  
Sale ≠ stock movement.  
Invoice ≠ stock movement.  
Production consumption = input stock reduction.  
Production output = inventory addition.**

---

## 15. Prompt 1 Final Baseline Decision

**Business requirements baseline: ESTABLISHED WITH EXPLICIT OPEN/AMBIGUOUS ITEMS.**

No application readiness conclusion is made here.

Prompt 2 should now perform the implementation audit against this baseline and should specifically investigate the Orders regression shown during the current review rather than treating previous implementation notes as proof.
