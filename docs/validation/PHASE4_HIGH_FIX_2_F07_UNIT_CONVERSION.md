# Phase 4 High Fix 2 — F-07 Unit Conversion

**Implementation commit:** `92917adb0fca98952f6b261947956d78bc6f4f69`

## Existing flow and exact gap

The approved model defines `items.purchase_unit_id`, `items.base_unit_id`, and unit conversion metadata (`units.base_unit_id`, `units.conversion_to_base`). The audited `create_purchase_entry(...)` instead persisted every purchase line with `items.base_unit_id`, so a purchase expressed in a different purchase unit was not preserved as that transaction unit and no controlled conversion occurred. `receive_purchase(...)` then used the purchase-line unit directly for the inventory batch. The audit recorded this as F-07. fileciteturn575file1L73-L81

## Correction

A small `purchase_to_base_factor(item_id, unit_id)` guard now resolves the conversion factor:

- configured item base unit → factor `1`;
- configured purchase unit → requires the unit's `base_unit_id` to equal the item's base unit and requires a positive `conversion_to_base`;
- any other unit → rejected;
- missing/invalid conversion metadata → rejected.

`create_purchase_entry(...)` now preserves the billed quantity and its transaction unit. An explicit `unit_id` may be the configured purchase unit or the item's base unit. If omitted, the configured purchase unit is used, falling back to the base unit only when no purchase unit is configured.

`receive_purchase(...)` keeps received/accepted/rejected quantities in the purchase-line transaction unit, but converts **accepted quantity only** to the item's base unit before creating `inventory_batches` and the purchase-receipt inventory transaction. The base-unit cost is correspondingly derived as purchase-unit rate divided by the conversion factor.

## Examples checked mathematically

- 250 g × 0.001 Kg/g = **0.250 Kg**.
- 500 g × 0.001 Kg/g = **0.500 Kg**.
- 750 g × 0.001 Kg/g = **0.750 Kg**.
- Kg → Kg uses factor **1**, so 2 Kg remains **2 Kg** and is not converted again.
- At ₹100 per 250 g, the equivalent base-unit cost is ₹100 / 0.250 = **₹400/Kg**.

## Historical preservation

Purchase and receipt quantities remain recorded in their original transaction unit through `purchase_lines.unit_id` and `purchase_receipt_lines.unit_id`. Inventory quantity and inventory transaction quantity are stored in the item's base unit. No schema redesign was introduced.

## Static validation

- Inspected `units` and `items` unit/conversion fields.
- Inspected the audited purchase and receiving RPCs.
- Confirmed conversion direction is purchase unit × `conversion_to_base` → base unit.
- Confirmed base-unit input returns factor 1 and avoids double conversion.
- Confirmed mismatched/missing conversion metadata raises an exception.
- Confirmed rejected/replacement quantities do not enter inventory.
- Inspected resulting SQL and confirmed no F-01/F-11, FIFO, reservation, production, dispatch, return, or other finding logic was changed.

## Runtime status

**Not runtime verified.** Required live tests remain: purchase/receipt with a non-base purchase unit, 250 g → 0.250 Kg inventory reconciliation, base-unit case, invalid conversion rejection, accepted-only inventory creation, and downstream FIFO consumption using the resulting base-unit batches.

F-03 through F-12 remain intentionally outside this fix; F-01/F-11 remain untouched.
