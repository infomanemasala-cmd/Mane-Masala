# Mane Masala Project Bible — Forensic Archive

**Archive date:** 2026-10-06. Documentation-only forensic recovery; secrets excluded.

## Database Schema
LIVE: 53 public base tables, all RLS-enabled. Logical groups: audit/system, masters, purchasing, inventory, recipes/production, orders/fulfillment, money. Views: v_customer_outstanding, v_inventory_current, v_order_production_plan, v_orders_list, v_production_batches_list, v_production_yield_learning, v_purchases_list, v_recipes_list, v_supplier_outstanding, v_urgent_procurement. Current items 115/108 active; recipes 16; orders 0.