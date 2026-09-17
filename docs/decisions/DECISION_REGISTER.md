# Mane Masala — Decision Register

This register records decisions recovered from the Master States and available project context. It does not promote proposals to requirements.

## APPROVED DECISIONS

### D-001 — Technical stack
- Date/Stage: Phase 3C-1
- Topic: Technical architecture
- Decision: Next.js + React + TypeScript; Supabase PostgreSQL/Auth/Storage; GitHub; Vercel; Figma; mobile/tablet-first responsive design.
- Status: APPROVED
- Reason: Recorded as approved in Master State.
- Affected modules: System-wide
- Implementation dependency: Milestone 0
- Notes: Core operation must not depend on ChatGPT, plugins, WhatsApp or OCR.

### D-002 — MVP principle
- Date/Stage: Phase 3C-2
- Topic: Scope
- Decision: Complete the core business loop correctly rather than maximizing features.
- Status: APPROVED
- Reason: Recorded in Master State.
- Affected modules: System-wide
- Implementation dependency: All milestones

### D-003 — Inventory ownership
- Date/Stage: Phase 3C / Phase 4
- Topic: Physical stock movement
- Decision: Inventory is transaction based. Accepted purchase receipt creates stock; production consumption reduces input stock; production output creates stock; Dispatch reduces finished-product stock exactly once; Sale and Invoice do not reduce stock; stock-outs and supplier returns reduce stock; approved customer returns add stock only after inspection/approval.
- Status: APPROVED
- Reason: Non-negotiable business rule.
- Affected modules: Inventory, Purchasing, Production, Orders, Dispatch, Sales, Returns
- Implementation dependency: All physical-stock workflows

### D-004 — FIFO
- Date/Stage: Phase 3C
- Topic: Inventory consumption order
- Decision: FIFO uses actual physical receipt/production date and applies to dispatch, production consumption, stock-outs and other physical consumption.
- Status: APPROVED
- Reason: Non-negotiable business rule.
- Affected modules: Inventory, Purchasing, Production, Dispatch
- Implementation dependency: Milestones 2–7

### D-005 — Permanent IDs
- Date/Stage: Phase 3C
- Topic: Identification
- Decision: IDs/codes are system generated, permanent and centrally controlled; users do not invent them. Historical records retain their IDs.
- Status: APPROVED
- Reason: Traceability/history requirement.
- Affected modules: All
- Implementation dependency: Milestones 0/1
- Notes: Exact financial-year reset rules remain open.

### D-006 — Order planning timing
- Date/Stage: Phase 4 clarification
- Topic: Order flow
- Decision: Order creation starts preparation of the Order/Production Plan. Planning, stock/reservation checks and recipe selection occur before final wife confirmation. Do not revert to confirm-first/plan-later.
- Status: APPROVED
- Reason: Explicit user clarification recorded in v1.6.
- Affected modules: Orders, Inventory, Production
- Implementation dependency: Milestone 5

### D-007 — Recipe version selection
- Date/Stage: Phase 4 clarification
- Topic: Production planning
- Decision: If multiple applicable recipe versions exist, the wife gets an explicit version choice. If one active version is uniquely applicable, it may be preselected but must be visible. Never silently guess.
- Status: APPROVED
- Reason: Explicit clarification.
- Affected modules: Recipes, Production, Orders
- Implementation dependency: Milestones 4/5

### D-008 — Reservation semantics
- Date/Stage: Phase 4
- Topic: Stock reservation
- Decision: Reservation is a commitment only and does not reduce physical stock. Available stock = current stock − active reservations.
- Status: APPROVED
- Reason: Non-negotiable rule.
- Affected modules: Inventory, Orders, Production, Dispatch
- Implementation dependency: Milestones 3–6

### D-009 — Dispatch/Sale/Invoice relationship
- Date/Stage: Phase 4 clarification
- Topic: Final customer fulfillment
- Decision: User experience should feel like Dispatch naturally leads to Sale + Invoice, while database events remain separate for traceability. Dispatch alone owns physical stock reduction.
- Status: APPROVED
- Reason: Reconciles user shorthand with database ownership.
- Affected modules: Orders, Dispatch, Sales, Invoices, Inventory
- Implementation dependency: Milestone 6

### D-010 — Multi-line and multi-order entry
- Date/Stage: Phase 4
- Topic: Order entry
- Decision: One order may contain many item lines; one entry session may capture several separate customer orders, but each remains a separate permanent Order transaction.
- Status: APPROVED
- Reason: Explicit workflow decision.
- Affected modules: Orders, Customers, Sales
- Implementation dependency: Milestone 5

### D-011 — Multi-role item identity
- Date/Stage: Phase 4
- Topic: Item model
- Decision: One permanent item can be sold and used in production/intermediate work. Do not duplicate identity when business role changes.
- Status: APPROVED
- Reason: Controlled item model.
- Affected modules: Masters, Inventory, Production, Sales
- Implementation dependency: Milestones 1/4

### D-012 — Partial production and mixed fulfillment
- Date/Stage: Phase 4
- Topic: Orders/production
- Decision: Partial production and partial dispatch are allowed. Existing reserved finished stock and newly produced stock may jointly fulfill an order. Order lines can progress independently where conditions permit.
- Status: APPROVED
- Reason: Phase 4 scenario decisions and transactional validation.
- Affected modules: Orders, Production, Inventory, Dispatch
- Implementation dependency: Milestones 4–6

### D-013 — Partial approval / procurement blocking
- Date/Stage: Phase 4
- Topic: Multi-line order approval
- Decision: Wife may approve one item line, several lines or leave others pending. A line can be partially approved when available raw material supports only part of required output. A line blocked by missing raw material is Purchase Required and is not fully approved/startable until procurement is resolved. Other lines may proceed independently. Urgent Procurement shows material, immediate quantity and order.
- Status: APPROVED
- Reason: Explicit Phase 4 scenario decision and transactional validation.
- Affected modules: Orders, Production, Inventory, Procurement/Dashboard
- Implementation dependency: Phase 4
- Notes: Case 1: 1 kg required with 0.6 kg supported → approve 0.6 kg, remaining 0.4 kg. Case 2: one ingredient available and another short → purchase required until inward.

### D-014 — Partial approval reservation scaling
- Date/Stage: Phase 4
- Topic: Reservation correctness
- Decision: Partial approval must not scale an already-capped reservation a second time. New plan quantities are compared to existing reservations and reservation is reduced only if the new planned quantity is lower.
- Status: APPROVED
- Reason: Corrected discovered defect where 0.6 kg could incorrectly become 0.36 kg.
- Affected modules: Orders, Production, Inventory
- Implementation dependency: Phase 4

### D-015 — Recipe formulation vs actual yield
- Date/Stage: Phase 4 recipe clarification
- Topic: Recipes
- Decision: Recipe input quantities define formulation. Expected finished output is independent. Scale ingredient quantities by required finished output / recipe expected output. Actual finished output may differ from total raw-material input weight; actual production records actual consumption and actual output.
- Status: APPROVED
- Reason: Explicit user clarification.
- Affected modules: Recipes, Production, Orders
- Implementation dependency: Milestone 4

### D-016 — Recipe version preservation
- Date/Stage: Phase 3C/Phase 4
- Topic: Recipe history
- Decision: Standard recipe changes create a new version after approval; old versions are never overwritten. One-time batch variance affects only that batch.
- Status: APPROVED
- Reason: Historical traceability.
- Affected modules: Recipes, Production
- Implementation dependency: Milestone 4

### D-017 — Purchase document vs physical receipt
- Date/Stage: Phase 3C/Phase 4
- Topic: Purchasing
- Decision: Purchase is the business document; receiving is a separate physical event. One purchase can contain many item rows.
- Status: APPROVED
- Reason: Core purchasing loop.
- Affected modules: Purchases, Receiving, Inventory, Payments
- Implementation dependency: Milestones 2/7

### D-018 — System-generated Purchase No. vs supplier slip
- Date/Stage: Phase 4 UX clarification
- Topic: Purchase identification
- Decision: Mane Masala generates the permanent Purchase No. Supplier/shopkeeper slip or bill reference, when available, is a separate optional physical-document reference. Users do not invent the system Purchase No. Technical supplier UUIDs are not the primary user-facing field.
- Status: APPROVED
- Reason: Explicit user clarification.
- Affected modules: Purchases, Receiving, Attachments, Payments, Reports
- Implementation dependency: Milestone 2

### D-019 — Purchase line receiving decisions
- Date/Stage: Phase 4 purchase-flow clarification
- Topic: Receiving/inspection
- Decision: User records Billed, Received, Accepted and Rejected/Damaged per line. Shortage = Billed − Received. Only Accepted becomes usable stock. The system retains a line-level and document-level breakdown.
- Status: APPROVED
- Reason: Explicit user clarification.
- Affected modules: Purchasing, Inventory, Supplier Returns/Adjustments
- Implementation dependency: Milestones 2/7

### D-020 — Supplier claim response
- Date/Stage: Phase 4 purchase-flow clarification
- Topic: Shortage/damage/return settlement
- Decision: Supplier response is recorded per affected line. If honoured, choose credit or refund and the system calculates the affected value, reducing payable by the agreed amount. If refused, the original payable is not silently reduced; the amount remains Disputed/Pending. Later replacement is linked to the original purchase/line.
- Status: APPROVED
- Reason: Explicit user clarification reconciling shortage/damage and supplier refusal.
- Affected modules: Purchases, Receiving, Supplier Adjustments, Returns, Payments, Outstanding
- Implementation dependency: Milestones 2/7

### D-021 — Customer returns
- Date/Stage: Phase 3C
- Topic: Returns
- Decision: Customer return follows Return Received → Inspect → Approve → Stock/Financial Adjustment. Returned goods do not automatically become saleable stock.
- Status: APPROVED
- Reason: Core business rule.
- Affected modules: Sales, Inventory, Returns, Payments
- Implementation dependency: Milestone 7

### D-022 — Supplier returns
- Date/Stage: Phase 3C
- Topic: Supplier returns
- Decision: Supplier returns link to original purchase/purchase line; multiple returns are allowed. Approved supplier returns remove stock.
- Status: APPROVED
- Reason: Core business rule.
- Affected modules: Purchases, Inventory, Payments
- Implementation dependency: Milestone 7

### D-023 — Payments and allocations
- Date/Stage: Phase 3C
- Topic: Financial transactions
- Decision: Supplier/customer payments are separate transactions with allocation records. One payment may cover multiple documents; multiple payments may cover one document. Unallocated amounts remain explicit advances.
- Status: APPROVED
- Reason: Reconciliation requirement.
- Affected modules: Payments, Sales, Purchases, Outstanding
- Implementation dependency: Milestone 7

### D-024 — Low stock does not auto-create work
- Date/Stage: Phase 3C
- Topic: Automation boundary
- Decision: Low stock does not automatically create a purchase order or production order. Customer orders are the normal production-planning trigger.
- Status: APPROVED
- Reason: Scope rule.
- Affected modules: Inventory, Orders, Production, Purchasing
- Implementation dependency: Milestones 3–5

### D-025 — MVP exclusions
- Date/Stage: Phase 3C-2
- Topic: Scope exclusions
- Decision: Current MVP deliberately excludes ChatGPT conversational entry, OCR automation, WhatsApp automation, advanced GST/accounting, automatic purchase orders, forecasting, supplier scoring, advanced customer/Sub-Agent analytics, barcode/QR, marketplace/courier automation, complex permissions, advanced packaging conversion and advanced production overhead costing.
- Status: APPROVED
- Reason: MVP boundary.
- Affected modules: System-wide
- Implementation dependency: Future phases

### D-026 — System-wide UI law
- Date/Stage: Phase 4 deep UX/workflow audit
- Topic: UI standardization
- Decision: A rule approved for one page is a system-wide standard unless a documented business reason requires otherwise. Lists use shared DataTable behaviour: server-backed search, count, pagination, sortable headers, useful business fields, permanent codes where relevant and consistent search interaction. Forms use one clear primary action, clear headings, safe defaults only, no unnecessary technical IDs, plain-language errors, confirmation for important stock/financial actions and preserved context for nested creation.
- Status: APPROVED
- Reason: Explicit system-wide UX decision.
- Affected modules: All operational pages and Masters
- Implementation dependency: Phase 4 audit

### D-027 — Sellable product type separation
- Date/Stage: Phase 3C / Phase 4 UI audit
- Topic: Product catalogue
- Decision: Finished Product and Purchased Finished Product are distinct controlled item types and should be visibly selectable/listable. Permanent item identity is not duplicated.
- Status: APPROVED
- Reason: Controlled item-type model and UI visibility requirement.
- Affected modules: Masters, Orders, Purchases, Inventory, Sales
- Implementation dependency: Phase 4 audit

### D-028 — Purchase physical-unit conversion
- Date/Stage: Phase 4 runtime defect correction
- Topic: Units / inventory
- Decision: Purchase-line quantity remains in the selected transaction unit; accepted quantity is converted exactly once to base-unit inventory using controlled item/unit conversion. Inventory batch and movement quantities are base-unit quantities and unit cost is adjusted consistently.
- Status: APPROVED
- Reason: Existing approved F-07 correction and runtime defect audit.
- Affected modules: Purchases, Receiving, Inventory, FIFO
- Implementation dependency: Milestone 2/3

### D-029 — Physical receipt date controls FIFO batch date
- Date/Stage: Phase 4 runtime defect correction
- Topic: FIFO
- Decision: When a physical receipt date is supplied, it becomes the inventory batch date used for FIFO. Receipt event timestamp remains the event timestamp. Invoice date must not substitute for physical receipt date.
- Status: APPROVED
- Reason: Existing approved F-02 correction.
- Affected modules: Purchasing, Receiving, Inventory, FIFO
- Implementation dependency: Milestones 2/3

### D-030 — Supplier credit/refund reconciliation
- Date/Stage: Phase 4 runtime defect correction
- Topic: Supplier outstanding
- Decision: Supplier outstanding follows purchase payable − supplier credit/refund adjustments − supplier payment allocations. Supplier payment allocation due calculations must account for approved supplier adjustments and synchronize purchase financial status.
- Status: APPROVED
- Reason: Corrected runtime synchronization defect.
- Affected modules: Purchases, Supplier Adjustments, Payments, Outstanding, Reports
- Implementation dependency: Milestone 7

### D-031 — UUID generator volatility
- Date/Stage: Phase 4 runtime defect correction
- Topic: Database integrity
- Decision: The public UUID wrapper delegates to a random generator and must be VOLATILE, not IMMUTABLE. Existing UUID values are not replaced.
- Status: APPROVED
- Reason: Corrected primary-key collision risk in multi-row operations.
- Affected modules: System-wide transaction creation
- Implementation dependency: Database foundation

### D-032 — Purchase review one-flow UX
- Date/Stage: Phase 4 purchase-flow refinement
- Topic: Wife usability
- Decision: Purchase workflow should be one guided flow: Purchase → Receive & Inspect → Review shortages/damage/supplier response → Complete → Supplier Payment. Do not expose technical database fields as the business workflow.
- Status: APPROVED
- Reason: Explicit UX refinement and zero-computer-user requirement.
- Affected modules: Purchases, Receiving, Payments
- Implementation dependency: Phase 4

### D-033 — No approval checkbox duplication
- Date/Stage: Phase 4 order UX refinement
- Topic: Approval UX
- Decision: Do not add an approval checkbox when the action button itself is the confirmation. Use one obvious action rather than checkbox + action duplication unless a separate business reason is later approved.
- Status: APPROVED
- Reason: Explicit user/usability decision.
- Affected modules: Orders, Production, Purchases and other approvals
- Implementation dependency: Phase 4 UI audit

## OPEN DECISIONS

### OPEN-001 — Exact financial-year numbering/reset
- Date/Stage: Phase 3C
- Topic: Numbering
- Decision: Not final.
- Status: OPEN
- Reason: Must be approved before numbering is frozen across financial years.
- Affected modules: Financial documents
- Implementation dependency: Numbering implementation

### OPEN-002 — Exact GST/tax implementation
- Date/Stage: Phase 3C
- Topic: Tax
- Decision: Detailed GST/accounting treatment is not defined; do not guess.
- Status: OPEN
- Reason: Future/advanced accounting scope.
- Affected modules: Purchases, Sales, Invoices, Payments, Reports
- Implementation dependency: GST/accounting implementation

### OPEN-003 — Bulk-to-pack operating method
- Date/Stage: Phase 3C
- Topic: Packaging
- Decision: Architecture must support controlled conversion, but exact operating method is not approved. Example architecture: 12 kg bulk → 40 × 250 g packs + remainder.
- Status: OPEN
- Reason: Business process not finalized.
- Affected modules: Production, Inventory, Packaging
- Implementation dependency: Packaging implementation

### OPEN-004 — Detailed permissions
- Date/Stage: Phase 3C
- Topic: Authorization
- Decision: Wife/admin approval is sufficient for MVP; detailed role matrix is future.
- Status: OPEN
- Reason: Detailed permissions not defined.
- Affected modules: System-wide
- Implementation dependency: Permission implementation

### OPEN-005 — Final dashboard arrangement
- Date/Stage: Phase 3C/Phase 4
- Topic: Dashboard UX
- Decision: Final arrangement awaits actual wife usability review.
- Status: OPEN
- Reason: Usability evidence still required.
- Affected modules: Dashboard
- Implementation dependency: UX review

### OPEN-006 — Exact invoice visual design
- Date/Stage: Phase 3C/Phase 4
- Topic: Invoice
- Decision: Final content/branding/layout remains open until invoice UI review.
- Status: OPEN
- Reason: Business visual review pending.
- Affected modules: Invoices
- Implementation dependency: Invoice UI

### OPEN-007 — Expiry alert threshold
- Date/Stage: Phase 3C
- Topic: Inventory alerts
- Decision: Exact threshold is not approved.
- Status: OPEN
- Reason: Business rule pending.
- Affected modules: Inventory, Dashboard, Reports
- Implementation dependency: Expiry alert implementation

### OPEN-008 — Negative stock exception policy
- Date/Stage: Phase 4
- Topic: Inventory control
- Decision: Default should prevent unexplained negative stock; exact business exception policy is not approved.
- Status: OPEN
- Reason: Requires explicit business decision.
- Affected modules: Inventory, Production, Dispatch, Returns
- Implementation dependency: Exception implementation

### OPEN-009 — Intermediate classification
- Date/Stage: Phase 3C
- Topic: Item classification
- Decision: Some current finished-product records may later be reclassified as Intermediate/Prepared Material while preserving the same permanent Item ID/history.
- Status: OPEN
- Reason: Final classification not supplied.
- Affected modules: Masters, Inventory, Production
- Implementation dependency: Classification review

### OPEN-010 — Phase 4 browser/mobile/release evidence
- Date/Stage: Phase 4
- Topic: Release
- Decision: Full authenticated browser E2E, mobile E2E, page-by-page DataTable verification, atomicity/idempotency, report reconciliation, logo validation and final production runtime validation remain release gates until evidenced as passed.
- Status: OPEN
- Reason: Code/deployment existence is not evidence of full release correctness.
- Affected modules: System-wide
- Implementation dependency: Phase 4 release gate

### OPEN-011 — Exact packaging conversion mechanics
- Date/Stage: Phase 4
- Topic: Packaging
- Decision: See OPEN-003; do not implement by unexplained stock adjustment.
- Status: OPEN
- Reason: Same unresolved operating method.
- Affected modules: Production, Inventory
- Implementation dependency: Packaging implementation

### OPEN-012 — Current master-data restoration/classification evidence
- Date/Stage: Phase 4 revalidation
- Topic: Data migration
- Decision: Do not guess the exact historical 105-item mapping/opening stock. Restore only from exact approved source data and classify A/B/C/D as defined by migration rules.
- Status: OPEN
- Reason: Exact historical dataset must be evidenced before import.
- Affected modules: Masters, Inventory, Migration
- Implementation dependency: Initial data migration/reconciliation

## HISTORICAL / SUPERSEDED DECISIONS

### H-001 — Earlier order timing wording
- Historical statement: Earlier Master State wording described confirmation before planning.
- Superseded by: D-006 / v1.6 clarification that order creation starts planning before final wife confirmation.
- Status: SUPERSEDED
- Preservation: Historical v1.4/v1.5 remain unchanged.

### H-002 — Historical v1.5 repository archive notice
- Historical repository state: v1.5 was represented by an archive notice because exact historical v1.5 was preserved in the Project Library.
- Current treatment: Keep exact historical v1.5 in Library; current authoritative state is v1.6. Do not manufacture a later document carrying the v1.5 version number.
- Status: SUPERSEDED as a repository representation only; historical version itself remains preserved.

## Decision handling rule
**OPEN item → implementation dependency → discuss → approve → record → implement.** Do not guess.
