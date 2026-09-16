# Mane Masala — Migration Rules

## Process
**Staging / Review → Validation → Approved Migration → Persistent Database**.

## Data classification
- A — Confirmed
- B — Calculated
- C — Needs Confirmation
- D — Unknown

Never invent quantities, rates, dates, suppliers, customer balances or opening stock.

## Migration layers
1. Units/categories
2. Products/raw materials
3. Suppliers
4. Customers/Sub-Agents
5. Recipes
6. Opening stock
7. Reliable historical purchases/receipts
8. Historical outstanding balances
9. Other approved historical transactions
10. Reconciliation

The 22 finished products and 83 raw materials are master data, not automatic stock. Opening stock is an explicit opening-stock transaction/batch. Historical FIFO batches are preserved when known; otherwise approved opening-stock batches are used. Unknown information remains flagged.

Initial migration is not ongoing operation. After launch, the application is authoritative.

## History
Reclassification of an item preserves its permanent Item ID and historical transactions; do not recreate history or silently move historical stock.
