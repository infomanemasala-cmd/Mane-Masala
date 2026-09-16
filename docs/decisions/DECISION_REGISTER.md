# Mane Masala — Decision Register

This register records decisions recovered from the authoritative Master States and the available project conversation. It does not promote proposals to requirements.

## D-001 — Technical stack
- Date/Stage: Phase 3C-1
- Topic: Technical architecture
- Decision: Next.js + React + TypeScript; Supabase PostgreSQL/Auth/Storage; GitHub; Vercel; Figma; mobile/tablet-first responsive design.
- Status: APPROVED
- Reason: Recorded as approved in Master State v1.4/v1.6.
- Affected modules: System-wide
- Implementation dependency: Milestone 0
- Notes: Core operation must not depend on ChatGPT, plugins, WhatsApp or OCR.

## D-002 — MVP principle
- Date/Stage: Phase 3C-2
- Topic: Scope
- Decision: Complete the core business loop correctly rather than maximizing features.
- Status: APPROVED
- Reason: Recorded in Master State.
- Affected modules: System-wide
- Implementation dependency: All milestones

## D-003 — Inventory ownership
- Date/Stage: Phase 3C / Phase 4
- Topic: Physical stock movement
- Decision: Inventory is transaction based. Accepted purchase receipt creates stock; production consumption reduces input stock; production output creates stock; Dispatch reduces finished-product stock exactly once; Sale and Invoice do not reduce stock; stock-outs and supplier returns reduce stock; approved customer returns add stock only after inspection/approval.
- Status: APPROVED
- Reason: Non-negotiable business rule.
- Affected modules: Inventory, Purchasing, Production, Orders, Dispatch, Sales, Returns
- Implementation dependency: All physical-stock workflows

## D-004 — FIFO
- Date/Stage: Phase 3C
- Topic: Inventory costing/consumption order
- Decision: FIFO uses actual physical receipt/production date and applies to dispatch, production consumption, stock-outs and other physical consumption.
- Status: APPROVED
- Reason: Non-negotiable business rule.
- Affected modules: Inventory, Purchasing, Production, Dispatch
- Implementation dependency: Milestones 2–7

## D-005 — Permanent IDs
- Date/Stage: Phase 3C
- Topic: Identification
- Decision: IDs/codes are system generated, permanent and centrally controlled; users do not invent them. Historical records retain their IDs.
- Status: APPROVED
- Reason: Traceability/history requirement.
- Affected modules: All
- Implementation dependency: Milestone 0/1
- Notes: Exact numbering reset/sequence rules remain separately OPEN until formally approved.

## D-006 — Order planning timing
- Date/Stage: Phase 4 clarification
- Topic: Order flow
- Decision: Order creation starts preparation of the Order/Production Plan. Planning, stock/reservation checks and recipe selection occur before final wife confirmation. Do not revert to “confirm first, plan later.”
- Status: APPROVED
- Reason: Explicit user clarification recorded in v1.6.
- Affected modules: Orders, Inventory, Production
- Implementation dependency: Milestone 5

## D-007 — Recipe version selection
- Date/Stage: Phase 4 clarification
- Topic: Production planning
- Decision: If multiple applicable recipe versions exist, the wife gets an explicit version choice. If one active version is uniquely applicable, it may be preselected but must be visible. Never silently guess.
- Status: APPROVED
- Reason: Explicit v1.6 clarification.
- Affected modules: Recipes, Production, Orders
- Implementation dependency: Milestone 4/5

## D-008 — Reservation semantics
- Date/Stage: Phase 4
- Topic: Stock reservation
- Decision: Reservation is a commitment only and does not reduce physical stock. Available stock = current stock − active reservations.
- Status: APPROVED
- Reason: Non-negotiable business rule and v1.6 clarification.
- Affected modules: Inventory, Orders, Production, Dispatch
- Implementation dependency: Milestones 3–6

## D-009 — Dispatch/Sale/Invoice relationship
- Date/Stage: Phase 4 clarification
- Topic: Final customer fulfillment
- Decision: User experience should feel like Dispatch naturally leads to Sale + Invoice, while database events remain separate for traceability. Dispatch alone owns physical stock reduction.
- Status: APPROVED
- Reason: Reconciles user shorthand with database ownership.
- Affected modules: Orders, Dispatch, Sales, Invoices, Inventory
- Implementation dependency: Milestone 6

## D-010 — Multi-line and multi-order entry
- Date/Stage: Phase 4
- Topic: Order entry
- Decision: One order may contain many item lines; one entry session may capture several separate customer orders, but each remains a separate permanent Order transaction.
- Status: APPROVED
- Reason: Explicit v1.6 clarification.
- Affected modules: Orders, Customers, Sales
- Implementation dependency: Milestone 5

## D-011 — Multi-role item identity
- Date/Stage: Phase 4
- Topic: Item model
- Decision: One permanent item can be sold and used in production/intermediate work. Do not duplicate identity when business role changes.
- Status: APPROVED
- Reason: Explicit v1.6 clarification.
- Affected modules: Masters, Inventory, Production, Sales
- Implementation dependency: Milestones 1/4

## D-012 — Partial production and mixed fulfillment
- Date/Stage: Phase 4
- Topic: Orders/production
- Decision: Partial production and partial dispatch are allowed. Existing reserved finished stock and newly produced stock may jointly fulfill an order. One order line can progress independently of another where the business rules permit.
- Status: APPROVED
- Reason: Phase 4 business testing and v1.6 rules.
- Affected modules: Orders, Production, Inventory, Dispatch
- Implementation dependency: Milestones 4–6

## D-013 — Partial approval / procurement blocking
- Date/Stage: Phase 4
- Topic: Multi-line order approval
- Decision: Wife may approve one item line, several lines, or leave a line pending. A line with insufficient raw material can be partially approved where supported by available material; a line blocked by a missing raw material is marked purchase-required and is not startable/fully approved until procurement is resolved. Other order lines may proceed independently. Urgent Procurement must show material, immediate quantity and order.
- Status: APPROVED
- Reason: Explicit Phase 4 scenario decisions and transactional validation.
- Affected modules: Orders, Production, Inventory, Procurement/Dashboard
- Implementation dependency: Phase 4
- Notes: Case 1 example: 1 kg required with 0.6 kg supported → partial approve 0.6 kg, remaining 0.4 kg. Case 2: one ingredient available and another short → purchase-required until inward.

## D-014 — Partial approval reservation scaling
- Date/Stage: Phase 4
- Topic: Reservation correctness
- Decision: Partial approval must not scale an already-capped reservation a second time. New plan quantities are compared to existing reservations and reservation quantity is reduced only when the new planned quantity is lower.
- Status: APPROVED
- Reason: Corrected a discovered backend bug where 0.6 kg availability could incorrectly become a 0.36 kg reservation.
- Affected modules: Orders, Production, Inventory
- Implementation dependency: Phase 4

## D-015 — Recipe formulation vs actual yield
- Date/Stage: Phase 4 recipe clarification
- Topic: Recipes
- Decision: Recipe input quantities define formulation. Expected finished output is independent. Scale ingredient quantities by required finished output / recipe expected output. Actual finished output may differ from total raw-material input weight; actual production records actual consumption and actual output.
- Status: APPROVED
- Reason: Explicit user clarification.
- Affected modules: Recipes, Production, Orders
- Implementation dependency: Milestone 4
- Notes: Do not assume total ingredient weight equals finished output.

## D-016 — Recipe version preservation
- Date/Stage: Phase 3C/Phase 4
- Topic: Recipe history
- Decision: Standard recipe changes create a new version after approval; old versions are never overwritten. One-time batch variance affects that batch only.
- Status: APPROVED
- Reason: Historical traceability requirement.
- Affected modules: Recipes, Production
- Implementation dependency: Milestone 4

## D-017 — Purchase document vs physical receipt
- Date/Stage: Phase 3C/Phase 4
- Topic: Purchasing
- Decision: Purchase is the business document; receiving is a separate physical event. A purchase can contain many item rows.
- Status: APPROVED
- Reason: Core purchasing loop.
- Affected modules: Purchases, Receiving, Inventory, Payments
- Implementation dependency: Milestones 2/7

## D-018 — System-generated Purchase No. vs supplier slip
- Date/Stage: Phase 4 UX clarification
- Topic: Purchase identification
- Decision: Mane Masala generates the permanent Purchase No. The supplier/shopkeeper slip or bill reference, when available, is a separate optional reference captured from the physical document. Users must not invent the system Purchase No.
- Status: APPROVED
- Reason: Explicit user clarification; consistent with v1.6 rule that a generated system reference exists when supplier invoice number is missing.
- Affected modules: Purchases, Receiving, Attachments, Payments, Reports
- Implementation dependency: Milestone 2
- Notes: Do not label a database-generated identifier as “Supplier ID” or expose technical supplier UUIDs as the user's primary reference.

## D-019 — Purchase line receiving decisions
- Date/Stage: Phase 4 purchase-flow clarification
- Topic: Receiving/inspection
- Decision: The user records physical Received, Accepted and Rejected/Damaged per line. Shortage is calculated as Billed − Received. Only Accepted quantity becomes usable stock. The system keeps a complete line-level breakdown and summary.
- Status: APPROVED
- Reason: Explicit user clarification.
- Affected modules: Purchasing, Inventory, Supplier Returns/Adjustments
- Implementation dependency: Milestone 2/7

## D-020 — Supplier claim response
- Date/Stage: Phase 4 purchase-flow clarification
- Topic: Shortage/damage/return settlement
- Decision: Supplier response is recorded per affected line. If supplier honours the claim, the agreed credit/refund is calculated by the system and reduces payable. If supplier does not honour the claim, the amount remains disputed and the original payable is not silently reduced. Replacement later received is linked to the original purchase/line, not entered as an unrelated purchase.
- Status: APPROVED
- Reason: Explicit user clarification reconciling shortage/damage and supplier refusal.
- Affected modules: Purchases, Receiving, Supplier Adjustments, Returns, Payments, Outstanding
- Implementation dependency: Milestones 2/7

## D-021 — Customer returns
- Date/Stage: Phase 3C
- Topic: Returns
- Decision: Customer return follows Return Received → Inspect → Approve → Stock/Financial Adjustment. Returned goods do not automatically become saleable stock.
- Status: APPROVED
- Reason: Core business rule.
- Affected modules: Sales, Inventory, Returns, Payments
- Implementation dependency: Milestone 7

## D-022 — Supplier returns
- Date/Stage: Phase 3C
- Topic: Supplier returns
- Decision: Supplier returns are linked to original purchase/purchase line; multiple returns are allowed. Approved supplier returns remove stock.
- Status: APPROVED
- Reason: Core business rule.
- Affected modules: Purchases, Inventory, Payments
- Implementation dependency: Milestone 7

## D-023 — Payments and allocations
- Date/Stage: Phase 3C
- Topic: Financial transactions
- Decision: Supplier/customer payments are separate transactions with allocation records. One payment may cover multiple documents; multiple payments may cover one document. Unallocated amounts are explicit advances.
- Status: APPROVED
- Reason: Reconciliation requirement.
- Affected modules: Payments, Sales, Purchases, Outstanding
- Implementation dependency: Milestone 7

## D-024 — Low stock does not auto-create work
- Date/Stage: Phase 3C
- Topic: Automation boundary
- Decision: Low stock does not automatically create a purchase order or production order. Customer orders are the normal production-planning trigger.
- Status: APPROVED
- Reason: Explicit scope rule.
- Affected modules: Inventory, Orders, Production, Purchasing
- Implementation dependency: Milestones 3–5

## D-025 — MVP exclusions
- Date/Stage: Phase 3C-2
- Topic: Scope exclusions
- Decision: Current MVP deliberately excludes ChatGPT conversational entry, OCR automation, WhatsApp automation, advanced GST/accounting, automatic purchase orders, forecasting, supplier scoring, advanced customer/Sub-Agent analytics, barcode/QR, marketplace/courier automation, complex permissions, advanced packaging conversion and advanced production overhead costing.
- Status: APPROVED
- Reason: MVP boundary.
- Affected modules: System-wide
- Implementation dependency: Future phases

## D-026 — System-wide UI law
- Date/Stage: Phase 4 deep UX/workflow audit
- Topic: UI standardization
- Decision: A rule approved for one page is a system-wide standard unless a documented business reason requires otherwise. All list/table pages use the shared DataTable behaviour: server-backed search, result count, pagination, sortable headers, useful business fields, permanent business codes where relevant, consistent search reset and the same search interaction. Forms use one clear primary action, clear section headings, safe defaults only, no unnecessary technical IDs, confirmation for important stock/financial actions, plain-language errors, and preserved context for nested creation. Related-master creation must be reused across relevant workflows.
- Status: APPROVED
- Reason: Explicit v1.5/v1.6 UI standard and Purchase reference-pattern decision.
- Affected modules: Masters, Purchases, Inventory, Production, Orders, Sales & Invoices, Payments, Reports
- Implementation dependency: Phase 4 page-by-page audit

## D-027 — Sellable product type separation
- Date/Stage: Phase 3C / Phase 4 UI audit
- Topic: Product catalogue
- Decision: Finished Product and Purchased Finished Product are distinct controlled item types. Sellable item identity remains one permanent item record; the application should make the two sellable categories visibly selectable/listable rather than hiding the distinction in a generic item dropdown.
- Status: APPROVED
- Reason: Controlled item-type model in Master State v1.6 plus the system-wide UI visibility requirement.
- Affected modules: Masters, Orders, Purchases, Inventory, Sales & Invoices
- Implementation dependency: Phase 4 UI audit

## OPEN-001 — Exact financial-year numbering/reset
- Date/Stage: Phase 3C
- Topic: Numbering
- Decision: Not yet final.
- Status: OPEN
- Reason: Must be approved before numbering is frozen across financial years.
- Affected modules: All financial documents
- Implementation dependency: Numbering implementation

## OPEN-002 — Exact GST/tax implementation
- Date/Stage: Phase 3C
- Topic: Tax
- Decision: Not defined in detail; do not guess.
- Status: OPEN
- Reason: Future/advanced accounting scope.
- Affected modules: Purchases, Sales, Invoices, Payments, Reports
- Implementation dependency: GST/accounting implementation

## OPEN-003 — Bulk-to-pack operating method
- Date/Stage: Phase 3C
- Topic: Packaging
- Decision: Architecture must support controlled conversion, but exact operating method is not approved.
- Status: OPEN
- Reason: Business process not finalized.
- Affected modules: Production, Inventory, Packaging
- Implementation dependency: Packaging implementation

## OPEN-004 — Detailed permissions
- Date/Stage: Phase 3C
- Topic: Authorization
- Decision: Wife/admin approval is sufficient for MVP; detailed role matrix is future.
- Status: OPEN
- Reason: Detailed permissions not defined.
- Affected modules: System-wide
- Implementation dependency: Permission implementation

## OPEN-005 — Final dashboard arrangement
- Date/Stage: Phase 3C/Phase 4
- Topic: Dashboard UX
- Decision: Final arrangement awaits actual wife usability review.
- Status: OPEN
- Reason: Usability evidence still required.
- Affected modules: Dashboard
- Implementation dependency: UX review

## OPEN-006 — Exact invoice visual design
- Date/Stage: Phase 3C/Phase 4
- Topic: Invoice
- Decision: Final content/branding/layout remains open until invoice UI review.
- Status: OPEN
- Reason: Business visual review pending.
- Affected modules: Invoices
- Implementation dependency: Invoice UI

## OPEN-007 — Expiry alert threshold
- Date/Stage: Phase 3C
- Topic: Inventory alerts
- Decision: Exact threshold is not approved.
- Status: OPEN
- Reason: Business rule pending.
- Affected modules: Inventory, Dashboard, Reports
- Implementation dependency: Expiry alert implementation

## OPEN-008 — Negative stock exception policy
- Date/Stage: Phase 4
- Topic: Inventory control
- Decision: Default should prevent unexplained negative stock; exact exception policy is not approved.
- Status: OPEN
- Reason: Requires explicit business decision.
- Affected modules: Inventory, Production, Dispatch, Returns
- Implementation dependency: Exception implementation

## OPEN-009 — Intermediate classification
- Date/Stage: Phase 3C
- Topic: Item classification
- Decision: Some current finished-product records may later be reclassified as Intermediate/Prepared Material while preserving the same permanent Item ID/history.
- Status: OPEN
- Reason: Final classification not supplied.
- Affected modules: Masters, Inventory, Production
- Implementation dependency: Classification review

## OPEN-010 — Phase 4 browser/mobile/release evidence
- Date/Stage: Phase 4
- Topic: Release
- Decision: Full authenticated browser E2E, mobile E2E, page-by-page DataTable verification, atomicity/idempotency, report reconciliation, logo validation and final production runtime validation remain release gates until evidenced as passed.
- Status: OPEN
- Reason: Code/deployment existence is not proof of business correctness.
- Affected modules: System-wide
- Implementation dependency: Phase 4 release audit

## OPEN-011 — SECURITY DEFINER authorization review
- Date/Stage: Phase 4 security audit
- Topic: Database authorization
- Decision: The security advisor currently reports 40 SECURITY DEFINER functions executable by authenticated users. These may be intentional application RPCs, but their authorization checks and execute grants must be reviewed as a group before final release. Do not blindly revoke access because the linter warns on intentional business RPCs.
- Status: OPEN
- Reason: Security advisor finding observed on 2026-09-16.
- Affected modules: System-wide database functions
- Implementation dependency: Phase 4 security review

## OPEN-012 — Auth leaked-password protection
- Date/Stage: Phase 4 security audit
- Topic: Authentication security
- Decision: Supabase Auth leaked-password protection is currently disabled and must be enabled before final release if the project configuration permits it.
- Status: OPEN
- Reason: Security advisor finding observed on 2026-09-16.
- Affected modules: Authentication
- Implementation dependency: Auth/security settings
