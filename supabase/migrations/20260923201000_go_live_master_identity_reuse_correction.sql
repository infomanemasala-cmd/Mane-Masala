-- Correct identity reuse for workbook products that already exist as LIVE items.
-- The first completion migration created PRD-017/018 before the existing RM-070/RM-071 identity reuse was reconciled.
-- Corrective action is archive-only for those duplicate rows; no physical deletion.

BEGIN;

UPDATE public.items
SET is_active=false,
    archived_at=now(),
    archived_by=null,
    archive_reason='Duplicate identity corrected: reuse existing RM-070 Honey – Forest identity'
WHERE item_code='PRD-017' AND lower(name)='forest honey' AND is_active=true;

UPDATE public.items
SET is_active=false,
    archived_at=now(),
    archived_by=null,
    archive_reason='Duplicate identity corrected: reuse existing RM-071 Honey – Natural identity'
WHERE item_code='PRD-018' AND lower(name)='natural honey' AND is_active=true;

UPDATE public.items
SET name='Forest Honey',
    item_type='finished_product',
    product_family='Honey',
    can_be_sold=true,
    can_be_used_in_production=true,
    is_intermediate=false,
    notes='Tested food-grade honey
Product: Forest Honey | Package: Glass Jar | Minimum package/sale size: 250g',
    updated_at=now()
WHERE item_code='RM-070';

UPDATE public.items
SET name='Natural Honey',
    item_type='finished_product',
    product_family='Honey',
    can_be_sold=true,
    can_be_used_in_production=true,
    is_intermediate=false,
    notes='Tested food-grade honey
Product: Natural Honey | Package: Glass Jar | Minimum package/sale size: 250g',
    updated_at=now()
WHERE item_code='RM-071';

UPDATE public.items
SET item_type='finished_product',
    product_family='Spices',
    can_be_sold=true,
    can_be_used_in_production=true,
    is_intermediate=false,
    notes='Product: Bird Eye Chilli | Package: Brown Kraft Paper Ziplock Pouch | Minimum package/sale size: 100g',
    updated_at=now()
WHERE item_code='RM-051';

UPDATE public.id_sequences
SET prefix='PRD-', next_number=17, width=3, updated_at=now()
WHERE sequence_key='item_fp';

COMMIT;
