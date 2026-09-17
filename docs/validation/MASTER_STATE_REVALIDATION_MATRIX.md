# MANE MASALA — MASTER STATE REVALIDATION MATRIX

## Purpose
This matrix is the Prompt 1 requirements baseline. It checks significant approved requirements/decisions against the recovered historical and current documentation. It does **not** claim database/frontend/test correctness; those are Prompt 2/3 concerns.

**Row count:** 90 significant requirement/decision rows. A row can consolidate several closely related sub-bullets while preserving their meaning.

| ID | Area | Requirement / Decision | Source | Current Master State | Status | Notes | Prompt 2 Implementation Check Required |
|---|---|---|---|---|---|---|---|
| MS-001 | Architecture | Approved technical stack and repository architecture | v1.4/v1.5/v1.6; AGENTS | Next.js/React/TS + Supabase/Auth/Storage + GitHub/Vercel/Figma; mobile-first | CONFIRMED | Historical and current records agree. | YES |
| MS-002 | Business objective | Complete core business loop rather than maximum features | v1.4/v1.6 D-002 | Core customer and purchasing loops must reconcile | CONFIRMED | No later decision reverses MVP principle. | YES |
| MS-003 | Master data | Controlled item types: Raw Material, Intermediate, Finished Product, Purchased Finished Product | v1.4/v1.6 | Four controlled item types | CONFIRMED | Role flags may overlap identity. | YES |
| MS-004 | Master data | One permanent item identity can have multiple operational roles | v1.5 D-011 / v1.6 | No duplicate item merely for role change | CONFIRMED | History retained. | YES |
| MS-005 | Master data | 83 approved raw materials RM-001..RM-083 | v1.4/v1.6 | RM source list preserved | CONFIRMED | Exact list present in v1.6. | YES |
| MS-006 | Master data | 22 approved sellable finished/purchased-finished products | v1.4/v1.5/v1.6 | 22 product entries preserved | CONFIRMED | Terminology should distinguish 16 FP + 6 PFP. | YES |
| MS-007 | Master data | 16 Finished Products + 6 Purchased Finished Products split | v1.6 §4/§5 and D-027 | Previously verified split 16/6 | CONFIRMED | Current live data was intentionally cleaned; exact rows must be restored from authoritative data. | YES |
| MS-008 | Master data | Categories are controlled master data | v1.4/v1.6 | Categories in master schema | CONFIRMED | No separate subcategory rule established. | YES |
| MS-009 | Master data | Subcategories | Prompt 1 request vs historical docs | No explicit approved subcategory model found | MISSING | Prompt 1 names subcategories, but Master State/Decision Register do not establish a subcategory entity or rule. | YES |
| MS-010 | Units | Approved units are kg, g, litre, ml | v1.4/v1.6 | Explicit controlled units | CONFIRMED | No other base units approved. | YES |
| MS-011 | Units | Unit conversions must be explicit and controlled | v1.4/v1.6 | Conversion required but mechanism not fully specified | CONFIRMED | Implementation semantics remain to be audited. | YES |
| MS-012 | Units | Separate base unit vs purchase unit vs transaction/recipe/selling unit | Prompt 1 unit revalidation wording | Historical Master State only says explicit controlled conversion | AMBIGUOUS | The distinction is sensible but not fully documented as an approved historical decision; do not silently promote it. | YES |
| MS-013 | Units | Example purchase 250g/500g/750g for base kg | Prompt 1 example | No equivalent approved conversion table/formula found | AMBIGUOUS | Example clarifies intended need but exact conversion data model is not established. | YES |
| MS-014 | IDs | System-generated permanent human-readable codes | v1.4/v1.6 D-005 | User does not invent IDs | CONFIRMED | Code families are approved. | YES |
| MS-015 | IDs | Exact financial-year reset/numbering rules | v1.6 OPEN-001 | Still open | UNRESOLVED | Must be decided before numbering is frozen across FY. | YES |
| MS-016 | Suppliers | Permanent supplier IDs; inactive not deleted | v1.4/v1.6 | Supplier history retained | CONFIRMED | Supplier types listed. | YES |
| MS-017 | Suppliers | Supplier can provide raw and/or finished goods; item can have multiple suppliers | v1.6 | Explicit relationship | CONFIRMED | Price history required. | YES |
| MS-018 | Customers | Permanent customer IDs and customer types | v1.4/v1.6 | Customer master model preserved | CONFIRMED | Sub-Agent special model is separate. | YES |
| MS-019 | Sub-Agents | Sub-Agent is billing party; end customer separately traceable | v1.5/v1.6 D-006/D-010 | Direct/sub-agent model explicit | CONFIRMED | Includes anonymous end customer. | YES |
| MS-020 | Sub-Agents | End customer modes: existing, named unregistered, anonymous | v1.6 §7 | All three explicitly approved | CONFIRMED | Prompt 2 must verify implementation. | YES |
| MS-021 | Purchasing | One supplier bill/slip = one Purchase; many item lines | v1.5/v1.6 D-017 | Multi-line purchase | CONFIRMED | Purchase is document, receiving is separate event. | YES |
| MS-022 | Purchasing | System Purchase No. separate from supplier/shopkeeper slip reference | v1.6 D-018 | Generated permanent Purchase No.; optional physical reference | CONFIRMED | Earlier generic invoice wording is refined, not contradictory. | YES |
| MS-023 | Purchasing | Billed quantity separate from physical Received quantity | v1.4/v1.6 D-019 | Separate fields/concepts | CONFIRMED | Core shortage rule. | YES |
| MS-024 | Receiving | Accepted physical quantity alone enters usable stock | v1.6 | Only accepted quantity creates usable inventory | CONFIRMED | Rejected/damaged remains outside usable stock. | YES |
| MS-025 | Receiving | Line-level Received, Accepted, Rejected/Damaged | v1.6 D-019 / VALIDATION_PROTOCOL | Line breakdown required | CONFIRMED | Shortage = Billed − Received. | YES |
| MS-026 | Purchasing | Supplier claim response per affected line | v1.6 D-020 | Honoured/refused response preserved | CONFIRMED | Disputed amount remains traceable. | YES |
| MS-027 | Purchasing | Honoured claim reduces payable only by explicit agreed credit/refund | v1.6 D-020 | Original purchase preserved; payable adjusted by settlement | CONFIRMED | Not a silent billed-quantity rewrite. | YES |
| MS-028 | Purchasing | Refused claim leaves original payable and marks affected amount disputed | v1.6 D-020 | Dispute remains traceable | CONFIRMED | Requires UI/report audit later. | YES |
| MS-029 | Purchasing | Later replacement linked to original purchase/line | v1.6 D-020 | Replacement not unrelated purchase | CONFIRMED | Cross-module implementation audit required. | YES |
| MS-030 | Purchasing | Duplicate supplier invoice/reference warning | v1.4/v1.6 | Warning required | CONFIRMED | Need exact duplicate semantics in Prompt 2. | YES |
| MS-031 | Inventory | Transaction-based inventory equation | v1.4/v1.6 | Opening + receipts + production in − physical outflows ± adjustments = current | CONFIRMED | Equation is non-negotiable. | YES |
| MS-032 | Inventory | Reservation is commitment, not physical stock movement | v1.6 D-008 | Available = current − active reservations | CONFIRMED | Critical ownership rule. | YES |
| MS-033 | Inventory | Dispatch owns finished-stock physical reduction exactly once | v1.6 D-009 | Dispatch reduces stock | CONFIRMED | Sale/invoice do not. | YES |
| MS-034 | Inventory | Sale and Invoice never reduce same stock again | v1.6 | Financial records only for stock ownership | CONFIRMED | Critical double-reduction safeguard. | YES |
| MS-035 | Inventory | Production consumption reduces ingredient/intermediate stock; output adds stock | v1.6 | Explicit ownership | CONFIRMED | FIFO applies to consumption. | YES |
| MS-036 | Inventory | Stock-out reduces stock and is explicit/auditable | v1.4/v1.6 | Reasons defined | CONFIRMED | Includes Production as a reason historically. | YES |
| MS-037 | Inventory | Supplier return reduces stock; customer return adds stock only after inspection/approval | v1.6 D-021/D-022 | Separate return ownership | CONFIRMED | Customer-return implementation is later audit. | YES |
| MS-038 | Inventory | No direct current-balance editing | v1.4/v1.6 | Transactions only | CONFIRMED | Adjustments are auditable transactions. | YES |
| MS-039 | FIFO | FIFO uses physical receipt/production date, not invoice date | v1.6 D-004 | Firm rule | CONFIRMED | Applies across physical consumption. | YES |
| MS-040 | FIFO | FIFO applies to dispatch, production consumption, stock-outs and other physical consumption | v1.6 | Explicit scope | CONFIRMED | Returns/corrections need implementation audit for exact batch treatment. | YES |
| MS-041 | FIFO | Each purchase receipt and production output creates inventory batch | v1.6 | Batch traceability | CONFIRMED | Prompt 2 must inspect actual allocation. | YES |
| MS-042 | Production | Recipe version is preserved; standard change creates new version | v1.6 D-016 | Old versions never overwritten | CONFIRMED | Historical production keeps prior version. | YES |
| MS-043 | Production | Recipe formulation inputs independent from expected finished output | v1.6 D-015 | Scale by required output / expected output | CONFIRMED | Do not equate input weight to output. | YES |
| MS-044 | Production | Actual consumption and actual output are authoritative | v1.6 | Actuals override standard for batch record | CONFIRMED | Variance handling explicit. | YES |
| MS-045 | Production | One-time variance vs standard recipe change | v1.6 D-015/D-016 | One-time affects batch; standard creates new version after approval | CONFIRMED | Prompt 2 implementation check. | YES |
| MS-046 | Production | Partial production supported | v1.6 D-012 | Order remains open until fulfilled/cancelled | CONFIRMED | Line-independent where permitted. | YES |
| MS-047 | Production | Intermediate/prepared materials are real inventory and FIFO | v1.6 | Example Puliyogare intermediate ~3kg | CONFIRMED | Exact classifications remain open. | YES |
| MS-048 | Packaging | Controlled bulk-to-pack conversion required architecturally; exact method open | v1.6 OPEN-003 | Example 12kg → 40×250g + remainder | UNRESOLVED | Do not implement mechanics until approved. | YES |
| MS-049 | Orders | Order creation starts planning before final confirmation | v1.6 §8; D-006 | Explicitly supersedes old wording | CONFIRMED | Critical historical supersession. | YES |
| MS-050 | Orders | Order status model Draft→Received→Production Planned→Confirmed→In Production→Ready→Partially Dispatched→Dispatched→Completed; Cancelled where appropriate | v1.6 §8.3 | Approved business statuses | CONFIRMED | DB uses production_planned value. | YES |
| MS-051 | Orders | Multi-line orders | v1.5/v1.6 D-010 | One order many lines | CONFIRMED | Line outcomes may be independent. | YES |
| MS-052 | Orders | One entry session may capture multiple separate orders | v1.5/v1.6 D-010 | Each remains separate permanent order | CONFIRMED | Not one combined order. | YES |
| MS-053 | Orders | Planning shows current/reserved/available/order qty/shortfall/production requirement/recipe/ingredient availability | v1.6 §8.4 / GAP-023 | Explicit visibility requirement | CONFIRMED | Prompt 2 must verify actual UI. | YES |
| MS-054 | Orders | Multiple recipe versions require explicit choice; unique active version may be preselected but visible | v1.6 D-007 | No silent guessing | CONFIRMED | Critical. | YES |
| MS-055 | Orders | No applicable recipe blocks production; insufficient ingredients create procurement block | v1.6 test matrix/GAP | Explicit block | CONFIRMED | Partial approval exception also documented. | YES |
| MS-056 | Orders | Partial approval can approve supported quantity; procurement-short line cannot be fully approved until resolved | D-013 | Example 1kg required/0.6kg supported | CONFIRMED | Reservation scaling correction is historical incident. | YES |
| MS-057 | Orders | Partial approval must not double-scale capped reservation | D-014 | Existing reservation reduced only if new plan lower | CONFIRMED | Known bug and fix recorded. | YES |
| MS-058 | Orders | Mixed existing-stock + production fulfillment allowed | D-012/v1.6 | One line can be jointly fulfilled | CONFIRMED | Prompt 2 must test. | YES |
| MS-059 | Orders | Customer changes after production starts use revision/history | v1.6 test matrix | Revision not silent overwrite | CONFIRMED | Exact revision semantics need implementation audit. | YES |
| MS-060 | Orders | Cancellation after planning/production preserves history and handles produced stock | v1.6 test matrix | Cancellation is allowed where appropriate | CONFIRMED | Exact produced-stock disposition not fully specified. | YES |
| MS-061 | Dispatch | Partial/multiple dispatches allowed; actual dispatch drives financial creation | v1.6 D-009 | Dispatch records actual quantities/date/method | CONFIRMED | Sale/invoice derived from actual dispatch. | YES |
| MS-062 | Sales | Sale retains originating order/billing customer/dispatched quantities/prices | v1.6 | One order may produce multiple sales | CONFIRMED | Prompt 2 implementation audit. | YES |
| MS-063 | Invoice | Invoice generated from Sale; PDF/print MVP; final visual design open | v1.6 | Financial document separate from stock movement | CONFIRMED | Visual design remains OPEN. | YES |
| MS-064 | Payments | Supplier/customer payments are separate transactions with allocation records | v1.6 D-023 | One-to-many and many-to-one allocation | CONFIRMED | Directions must be unmistakable. | YES |
| MS-065 | Payments | Unallocated payment is explicit advance | v1.6 | No silent allocation | CONFIRMED | Customer and supplier. | YES |
| MS-066 | Payments | No fixed credit period assumed | v1.6 | Outstanding based on transactions | CONFIRMED | Do not invent terms. | YES |
| MS-067 | Returns | Customer return = Received→Inspect→Approve→Stock/Financial Adjustment | v1.6 D-021 | Returned goods not automatically saleable | CONFIRMED | Dedicated implementation remains an audit gate, not a business ambiguity. | YES |
| MS-068 | Corrections | Never delete history; use returns/adjustments/reversals/revisions/linked corrections | v1.6 | Historical preservation | CONFIRMED | Core integrity rule. | YES |
| MS-069 | Reports | Read-only reports covering sales/purchases/inventory/production/customers/suppliers/sub-agents/payments/management | v1.6 | Defined report families | CONFIRMED | Profitability/costing only where approved; advanced costing future. | YES |
| MS-070 | Dashboard | Priority attention areas and quick actions; final arrangement awaits wife review | v1.6 | Priority list defined | UNRESOLVED | Arrangement is open, not absent. | YES |
| MS-071 | UX | One clear primary action, plain language, minimal fields, safe confirmations, no technical IDs | UI Standard/UX Standard/v1.6 | System-wide law | CONFIRMED | Must be verified page-by-page later. | YES |
| MS-072 | UX | Shared DataTable: server search, count, pagination, sorting, consistent interaction/reset | UI Standard/v1.6 D-026 | Mandatory for relevant list/table pages | CONFIRMED | Screenshot already demonstrates why this must be enforced page-by-page; implementation audit remains Prompt 2. | YES |
| MS-073 | UX | Related-master creation in context preserves parent form and selects new record | UI Standard/v1.6 | Mandatory where practical | CONFIRMED | Implementation audit required. | YES |
| MS-074 | UX | Mobile/tablet first; responsive reflow, not shrunken desktop | UI Standard/UX Standard | Mandatory | CONFIRMED | Detailed mobile validation deferred to later pass. | YES |
| MS-075 | Branding | Fixed supplied logo/name; food-business visual language; no redesign of logo | v1.6/UX | Brand asset authoritative | CONFIRMED | Production visibility remains later audit. | YES |
| MS-076 | Uploads | Frontend-first foundation for Excel/CSV, PDF, photos, purchase/sales docs, customer/supplier/opening stock; uncertain extraction requires confirmation | Prompt 1 + VALIDATION_PROTOCOL | Future/current foundation distinction | CONFIRMED | Automation/OCR/chat entry is future scope. | YES |
| MS-077 | Future scope | ChatGPT conversational entry, OCR, WhatsApp automation excluded from MVP | v1.4/v1.5/v1.6 | Future only | FUTURE SCOPE | Must not be reintroduced accidentally. | NO |
| MS-078 | Future scope | Advanced GST/accounting excluded; detailed tax rules open | v1.6 OPEN-002 | Future/open | FUTURE SCOPE | Tax fields may exist but logic is not defined. | NO |
| MS-079 | Future scope | Automatic purchase orders, forecasting, supplier scoring, advanced analytics excluded | v1.4/v1.6 D-025 | Future only | FUTURE SCOPE | Do not promote proposals. | NO |
| MS-080 | Future scope | Barcode/QR, marketplace/courier automation, complex permissions excluded | v1.6 | Future only | FUTURE SCOPE | Detailed permissions separately open. | NO |
| MS-081 | Future scope | Advanced packaging conversion and advanced production overhead costing excluded | v1.6 | Future/open | FUTURE SCOPE | Bulk-to-pack mechanics still unresolved. | NO |
| MS-082 | Open decision | Detailed permissions beyond wife/admin approval | OPEN-004 | Open | UNRESOLVED | Do not invent role matrix. | YES |
| MS-083 | Open decision | Expiry alert threshold | OPEN-007 | Open | UNRESOLVED | Do not invent threshold. | YES |
| MS-084 | Open decision | Negative stock exception policy | OPEN-008 | Open | UNRESOLVED | Default prevention is stated; exception treatment is not. | YES |
| MS-085 | Open decision | Final intermediate classification | OPEN-009 | Open | UNRESOLVED | Preserve Item ID/history if reclassified. | YES |
| MS-086 | Open decision | Final invoice visual design | OPEN-006 | Open | UNRESOLVED | Business/wife review required. | YES |
| MS-087 | Open decision | Final dashboard arrangement | OPEN-005 | Open | UNRESOLVED | Business usability review required. | YES |
| MS-088 | Release | Phase 4 not cleared until implementation, tests, reconciliation, browser/mobile evidence and branding gates pass | v1.6 §30 / VALIDATION_PROTOCOL | Release gate | CONFIRMED | This is a release rule, not an implementation claim. | YES |
| MS-089 | Historical order wording | Older v1.4/v1.5 wording placed Confirm before Stock Check/Planning | v1.4 §4 / v1.5 §39 vs v1.6 §8 | Superseded by explicit v1.6 clarification: Order creation starts planning before final confirmation | CONTRADICTED | Historical statement is preserved but no longer current; v1.6 is authoritative. | YES |
| MS-090 | Mobile UX | Detailed visual mobile refinement occurs near the end after functional consistency | v1.5/v1.6 mobile notes | Basic mobile acceptance was previously stated; detailed refinement intentionally later | DEFERRED | This is sequencing, not permission to skip mobile validation at release. | YES |

## Status summary

| Status | Count |
|---|---:|
| CONFIRMED | 71 |
| CONTRADICTED | 1 |
| MISSING | 1 |
| AMBIGUOUS | 2 |
| UNRESOLVED | 9 |
| DEFERRED | 1 |
| FUTURE SCOPE | 5 |

## Interpretation
- **CONFIRMED** means the requirement/decision is established by the recovered documentation and is part of the Prompt 2 baseline.
- **CONTRADICTED** means a historical statement conflicts with the current baseline; the conflict is retained as history and must not override a later authoritative decision.
- **MISSING** means the requested concept is not established as an approved business requirement in the recovered source material.
- **AMBIGUOUS** means the intent is visible but the exact rule/data model is not established; do not guess.
- **UNRESOLVED** means an explicit open business/implementation decision remains.
- **DEFERRED** means the requirement is intentionally sequenced later, not removed.
- **FUTURE SCOPE** means it is explicitly outside the current MVP boundary.

## Key Prompt 2 watchpoints
1. Do not reintroduce the older confirm-first order sequence.
2. Do not collapse Finished Product and Purchased Finished Product into one invisible generic category.
3. Do not invent a Subcategory model.
4. Do not invent unit-conversion semantics that are not approved.
5. Do not treat source-code presence as proof of user-visible implementation.
6. Verify the stale test-order documentation against live data.
7. Verify every page against the system-wide UI standard, especially the Orders screen.
