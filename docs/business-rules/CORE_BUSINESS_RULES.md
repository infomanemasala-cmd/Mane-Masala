# Mane Masala — Core Business Rules

## Inventory equation
**Opening Stock + Receipts + Production In − Dispatch − Production Consumption − Stock-outs − Returns ± Adjustments = Current Stock**.

Never manually overwrite a current stock balance.

**Available Stock = Current Stock − Active Reservations.** Reservation is a commitment, not a stock movement.

## FIFO
FIFO uses the actual physical receipt/production date. It applies to dispatch/sales, production consumption, stock-outs and other physical consumption. Each purchase receipt and production output creates an inventory batch.

## Purchasing
Billed quantity and physical quantity are separate. Bill 25 kg / accepted 24.5 kg → usable stock 24.5 kg; shortage 0.5 kg. The original financial purchase remains based on agreed billed quantity/rate unless an explicit financial adjustment is agreed. Later replacement is linked to the original purchase; supplier credit is a linked supplier adjustment/purchase return.

## Supplier claim refinement
For shortage, damage or rejection, record the affected quantity per purchase line. If supplier honours, record the agreed credit/refund and reduce payable by that amount. If supplier refuses, preserve the original payable and record the affected amount as disputed. Never silently reduce the bill because physical quantity was short.

## Production
Recipe quantities are expected requirements. Actual ingredient consumption and actual finished output are authoritative. Actual output can differ from total ingredient weight. Standard recipe changes create new versions; one-time batch variance affects only that batch.

## Orders
Order creation starts planning. Planning checks current/reserved/available stock, calculates shortfall, selects recipe version where applicable, calculates production requirements and is reviewed by wife before final confirmation/execution. Multi-line orders can have independent line outcomes. Partial production and partial dispatch are allowed.

## Transaction ownership
- Purchase receipt: creates accepted inventory.
- Production consumption: reduces ingredient/intermediate stock.
- Production output: creates inventory.
- Dispatch: reduces finished stock exactly once.
- Sale: financial record; no second stock reduction.
- Invoice: financial document; no stock reduction.
- Supplier return: removes stock.
- Approved customer return after inspection: may add stock.
- Stock-out: removes stock.
- Reports: read-only.

## Historical integrity
Never delete historical transactions to correct a mistake. Use returns, adjustments, reversals, revisions and linked corrections. Permanent IDs remain stable.

## Scope exclusions
Do not assume detailed GST/accounting, automatic purchase orders, forecasting, supplier scoring, advanced analytics, barcode/QR, marketplace/courier automation, complex permissions, advanced packaging conversion, advanced production overhead costing, OCR automation, WhatsApp automation or ChatGPT conversational entry are MVP requirements.
