# Interrupted Prompt 2A Commit Review

## Commit
`742f7c1c6ee8f701d807accd77e7507de7f60640`

Commit message: `fix: correct core reservation production and return backend`.

## Purpose stated by commit
The migration itself states that its scope was: reservation lifecycle correctness, production chronology, FIFO protection, supplier refund type compatibility, and the missing customer-return backend workflow. The commit is a **single-file database migration**; no application/frontend source file was changed in this commit. fileciteturn504file0L3-L7

## Files changed
Exactly one file was added:

- `supabase/migrations/20260917100000_phase4_core_backend_audit_fixes.sql`

GitHub reports 304 additions and 0 deletions for the commit. fileciteturn505file0L2-L2

No validation document was created by this commit.

## Reservation changes
The migration changes `v_inventory_current` so that it exposes `current_stock`, `reserved_stock`, and `available_stock`, with active/issued reservations deducted from physical current stock for availability calculations. It also replaces `prepare_order_plan` and `resolve_order_procurement_requirements`. fileciteturn506file0turn506file1

`prepare_order_plan` explicitly calculates available stock after other orders' active/issued reservations, creates reservations without reducing inventory batches, creates production requirements when order stock is insufficient, and records an audit event. This aligns in intent with the approved reservation rule: reservation is a commitment, not physical stock movement, and available stock is current stock less active reservations. fileciteturn506file0

The function also prevents planning when the order already has an active production plan or active reservation. Whether that lifecycle restriction is fully compatible with every approved partial-approval/replanning scenario was **not independently tested in this recovery review**.

## Production changes
`complete_production` was replaced. The implementation:

- requires authentication;
- locks the production batch while completing it;
- requires approval before completion;
- requires positive output;
- checks available ingredient stock after other reservations;
- consumes ingredient inventory batches in `batch_date, created_at, id` order;
- writes `production_consumption` and `inventory_transactions` records;
- consumes/releases production reservations;
- creates an inventory batch for production output;
- writes `production_outputs` and the corresponding inventory transaction;
- updates the order toward `ready` when its production and fulfilment conditions are satisfied;
- records an audit event.

The FIFO ordering and physical-date use are directly visible in the commit implementation. fileciteturn506file2turn506file3

This is aligned in intent with the approved requirements for production consumption, production output, FIFO physical chronology, reservation separation, and historical auditability. It was **not fully execution-tested as part of this recovery review**, so actual database behaviour remains to be verified later.

## Return changes
### Supplier return
`record_supplier_return` was replaced. It validates authentication and return lines, works against the original purchase/purchase lines and inventory batches, records the supplier return, and can create an explicit supplier credit adjustment. The migration also expands the allowed supplier-adjustment types to include `refund` and `shortage_credit`. fileciteturn506file4turn506file5

This is aligned with the approved rule that supplier returns link to the original purchase and that honoured supplier claims affect payable through an explicit credit/refund/adjustment rather than rewriting the original purchase.

### Customer return
The commit adds the missing backend lifecycle functions:

- `receive_customer_return`
- `inspect_customer_return`
- `approve_customer_return`
- `complete_customer_return`

The visible implementation establishes a Received → Inspected → Approved → Completed lifecycle and records audit events. Approval accepts line-level approved quantities and a refund amount. fileciteturn506file5turn506file6turn506file7turn506file8

This corresponds directly to the validated requirement `MS-067`: Customer return = Received → Inspect → Approve → Stock/Financial Adjustment. fileciteturn509file0L2-L2

The existence of these backend functions does **not** establish frontend accessibility; frontend exposure is outside this recovery review and remains for the later frontend/browser audit.

## Business requirements affected
The commit directly touches these validated baseline areas:

- **MS-032** — Reservation is a commitment, not physical stock movement.
- **MS-033 / MS-034** — Dispatch owns physical reduction; Sale/Invoice must not reduce the same stock again.
- **MS-035 / MS-039 / MS-040 / MS-041** — Production consumption/output and physical-date FIFO/batch traceability.
- **MS-046 / MS-056 / MS-057 / MS-058** — Partial production, partial approval/reservation handling and mixed fulfilment are implicated by order planning/production logic.
- **MS-067** — Customer return lifecycle.
- **MS-068** — Historical corrections/returns must preserve history.

The baseline explicitly marks these as requirements requiring Prompt 2 implementation checks rather than documentation-only confirmations. fileciteturn509file0L2-L2

## Expected behaviour
Against the validated baseline, the expected behaviour is:

1. Reservation does not physically reduce inventory.
2. Available stock excludes active/issued reservations belonging to other orders.
3. Production planning can reserve existing stock and create procurement requirements for shortages.
4. Production consumes ingredient inventory through FIFO physical batches and creates output inventory.
5. Dispatch is the owner of physical finished-stock reduction; later Sale/Invoice creation must not reduce it again.
6. Supplier returns remain linked to original purchasing history and any payable reduction is explicit.
7. Customer returns follow Received → Inspect → Approve → Stock/Financial Adjustment and returned goods are not automatically saleable before approval.
8. Historical events remain auditable rather than being deleted/re-written.

These expectations are consistent with the Prompt 1 baseline, including the explicit reservation, FIFO, production and return requirements. fileciteturn508file0L2-L2

## Actual implementation
At code level, the commit implements the above areas through one migration containing:

- a supplier-adjustment constraint change;
- a replacement inventory-current view;
- replacement order procurement-resolution logic;
- replacement order planning logic;
- replacement production-completion logic;
- replacement dispatch logic;
- replacement supplier-return logic;
- new customer-return receipt/inspection/approval/completion functions.

The commit therefore represents a substantial **database/business-logic change**, not merely a documentation or compatibility change. GitHub confirms the migration is the only changed file and contains 304 additions. fileciteturn505file0L2-L2

## Evidence reviewed
- Commit `742f7c1c6ee8f701d807accd77e7507de7f60640` and its GitHub diff/file metadata. fileciteturn504file0L3-L7
- Exact migration file added by the commit. fileciteturn505file0L2-L2
- Prompt 1 Master State revalidation baseline. fileciteturn508file0L2-L2
- Prompt 1 requirements matrix, especially inventory/reservation/FIFO/production/order/return requirements. fileciteturn509file0L2-L2
- Function-level contents identified in the migration for procurement resolution, order planning, production completion, dispatch, supplier return, and customer return lifecycle. fileciteturn506file0turn506file2turn506file4turn506file6turn506file7turn506file8

## Status
**PARTIAL — aligned in documented intent, not yet fully verified.**

The changes appear to address approved requirements rather than introduce a new business model. However, this recovery review is intentionally limited to understanding the interrupted commit. It does not establish runtime correctness, migration application state, database reconciliation, frontend accessibility, or complete E2E behaviour.

## Potential issues
1. **Runtime verification remains outstanding.** Code inspection alone cannot prove reservation, FIFO, production, dispatch, supplier-return or customer-return behaviour in the live database.
2. **Customer-return frontend exposure is not established by this commit.** The backend lifecycle exists, but frontend/browser verification is deliberately outside this review.
3. **Partial approval/replanning interaction needs targeted verification.** `prepare_order_plan` rejects an order that already has active reservations; this may be correct for the intended lifecycle, but its interaction with the approved partial-approval/reservation-scaling scenarios must be tested before treating the behaviour as verified.
4. **Supplier-return accounting needs runtime reconciliation.** The commit supports explicit supplier credit/refund-related types, but actual payable/outstanding effects require later database tests.
5. **FIFO requires execution evidence.** The code orders batches by physical batch chronology, but this review does not certify actual batch allocation under all partial/return/correction scenarios.

These are verification items, not new business decisions.

## Testing still required
This recovery review does not execute a new full audit. The following must remain for the appropriate later implementation/test pass:

- live migration/application-state verification;
- reservation vs physical-stock test;
- partial approval/reservation-scaling regression test;
- FIFO multi-lot and partial-consumption test;
- production consumption/output reconciliation test;
- dispatch → sale → invoice no-double-reduction test;
- supplier-return/payable reconciliation test;
- customer-return Received → Inspect → Approve → stock/financial adjustment test;
- duplicate/retry/atomicity tests for the affected RPCs;
- frontend accessibility/browser verification for customer returns and all affected workflows.

## Code changes that should NOT be made yet
No additional code changes should be made solely from this recovery review.

In particular, do not redesign reservation, production, FIFO, supplier-return, or customer-return behaviour until the affected implementation is execution-tested against the validated Prompt 1 baseline. Any genuinely conflicting business rule must be raised as an **UNRESOLVED BUSINESS DECISION** rather than inferred from this interrupted commit.
