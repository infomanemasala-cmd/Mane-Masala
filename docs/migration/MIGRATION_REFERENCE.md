# Mane Masala — Migration Reference

## Migration principles
- Migrations are append-only.
- Never rewrite or delete a historical transaction to repair data.
- Never invent missing quantities, dates, rates, suppliers, customers, balances or opening stock.
- Use staging/review → validation → approved migration → persistent database for initial data.
- Classify imported information as A Confirmed, B Calculated, C Needs Confirmation, or D Unknown.
- The 22 finished products and 83 raw materials are master data, not automatic opening stock.
- Opening stock must be an explicit opening-stock transaction/batch.
- Preserve historical FIFO batches where their physical dates are known; otherwise use approved opening-stock batches.

## Important live/repository divergence lesson
Repository migrations can exist without being active in the live Supabase database. During Phase 4, F-02 receipt-date and F-07 unit-conversion migrations were found in the repository but absent from the live migration registry. Future validation must therefore inspect both repository migration files and the live migration registry.

## Phase 4 correction migrations recorded
- UUID wrapper volatility correction.
- Purchase unit → base-unit conversion.
- Physical receipt date → FIFO batch date preservation.
- Supplier credit/refund reconciliation in payment allocation and purchase financial status.
- Partial approval reservation-scaling correction.

## Data safety
No continuity-documentation change authorizes real-data import. No historical transaction may be deleted simply to make tests pass. Controlled test data must be explicitly identified and cleaned only under an approved cleanup instruction.
