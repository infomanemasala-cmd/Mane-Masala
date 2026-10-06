# Mane Masala Project Bible — Forensic Archive

**Archive date:** 2026-10-06. Documentation-only forensic recovery; secrets excluded.

## Database Relationships
Supplier→Purchase→Lines→Receipt→Inspection→Inventory→Payable→Payment. Recipe→Version→Lines→Production Batch→Plan→Consumption/Output→Inventory. Customer/Sub-Agent→Order→Lines→Planning/Reservation→Production→Dispatch→Sale→Invoice→Payment. Orders retain billing customer plus sub-agent/end-customer traceability. Production retains order/order-line/recipe links. Dispatch lines point to order lines; sale/invoice are downstream.