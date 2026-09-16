# Mane Masala — Core Workflows

## Customer
Customer calls → Order raised → Order/Production Plan prepared → current/reserved/available stock checked → reserve usable stock → shortfall calculated → recipe version selected where required → ingredient requirement calculated → wife reviews/approves → Order Confirmed → existing reserved stock and/or production → actual production consumption/output → Ready → Dispatch → Sale + Invoice → Payment/Outstanding → Reports.

Order may contain many item lines. One entry session may contain several separate customer orders; each remains a separate permanent Order. Sub-Agent is the billing party; end-customer remains separately traceable, including anonymous end customers.

Partial production and partial dispatch are allowed. Mixed existing-stock + production fulfillment is allowed. A line can progress independently where its own production/stock conditions permit.

## Production
Order Production Requirement → Recipe Version → Production Batch → Ingredient Requirement → FIFO/availability check → Wife Approval → Start/In Production → Actual Consumption → Actual Output → Wastage → Inventory.

Recipe is expected standard; actual consumption and actual output are authoritative. One-time variance affects one batch. Standard change creates a new recipe version after approval. Intermediate/prepared materials are real stock and follow FIFO.

## Purchasing
Purchase → Receive → Inspect → Accept / Shortage / Return → Inventory → Supplier Payable → Payment.

Purchase is the business document; receiving is a separate physical event. One purchase may contain many lines. The system generates the permanent Purchase No. Supplier/shopkeeper slip/bill reference is a separate optional reference.

At line level record Billed, Received, Accepted and Rejected/Damaged. Shortage = Billed − Received. Only Accepted enters usable inventory. Supplier response is recorded for affected quantities. Honoured claim → agreed credit/refund reduces payable. Refused claim → original payable remains; affected value is disputed and traceable. Later replacement is linked to the original purchase/line.

## Inventory ownership
Accepted purchase receipt creates stock. Production consumption reduces input stock. Production output creates stock. Dispatch reduces finished stock exactly once. Sale and Invoice do not reduce stock again. Supplier return reduces stock. Approved customer return can add stock only after inspection/approval. Stock-out reduces stock. Reservation is not physical movement.

## Payments
Payments are separate transactions. Allocation records link payments to purchases/invoices. One payment may cover multiple documents and multiple payments may cover one document. Unallocated amount is an explicit advance. Supplier and customer payment flows must be unmistakably separate.
