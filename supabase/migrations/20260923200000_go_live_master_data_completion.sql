-- Mane Masala go-live master-data completion: additive-only missing items/products.
-- Recipe import is intentionally excluded until workbook Actuals/expected-output semantics are resolved.
BEGIN;

-- Preserve established LIVE PRD convention for new finished products.
UPDATE public.id_sequences
SET prefix='PRD-', next_number=17, width=3, updated_at=now()
WHERE sequence_key='item_fp';

-- Advance RM sequence past every existing numeric RM code without rewriting history.
UPDATE public.id_sequences
SET next_number = GREATEST(next_number, 90), updated_at=now()
WHERE sequence_key='item_rm';

INSERT INTO public.items
  (business_code,item_code,name,item_type,category_id,subcategory,purchase_unit_id,base_unit_id,selling_unit_id,minimum_stock,can_be_sold,can_be_used_in_production,is_intermediate,is_perishable,expiry_tracking_enabled,notes)
SELECT x.code,x.code,x.name,'raw_material',c.id,'Dal',u.id,u.id,u.id,0,false,true,false,false,false,'Food grade'
FROM (VALUES
  ('RM-002','Urad Dal'),
  ('RM-003','Toor Dal'),
  ('RM-004','Masoor Dal')
) AS x(code,name)
CROSS JOIN (SELECT id FROM public.categories WHERE code='PULSES' AND is_active=true LIMIT 1) c
CROSS JOIN (SELECT id FROM public.units WHERE code='U-KG' AND is_active=true LIMIT 1) u
WHERE NOT EXISTS (SELECT 1 FROM public.items i WHERE i.item_code=x.code OR lower(i.name)=lower(x.name));

INSERT INTO public.items
  (business_code,item_code,name,item_type,category_id,product_family,purchase_unit_id,base_unit_id,selling_unit_id,minimum_stock,can_be_sold,can_be_used_in_production,is_intermediate,is_perishable,expiry_tracking_enabled,notes)
SELECT x.code,x.code,x.name,'finished_product',c.id,x.category,u.id,u.id,u.id,0,true,false,false,false,false,x.notes
FROM (VALUES
  ('PRD-017','Forest Honey','Honey','Package: Glass Jar | Minimum package/sale size: 250g'),
  ('PRD-018','Natural Honey','Honey','Package: Glass Jar | Minimum package/sale size: 250g'),
  ('PRD-019','Black Pepper','Spices','Package: Brown Kraft Paper Ziplock Pouch | Minimum package/sale size: 250g'),
  ('PRD-020','Cardamom','Spices','Package: Brown Kraft Paper Ziplock Pouch | Minimum package/sale size: 100g'),
  ('PRD-021','Turmeric','Spices','Package: Brown Kraft Paper Ziplock Pouch | Minimum package/sale size: 100g'),
  ('PRD-022','Bird Eye Chilli','Spices','Package: Brown Kraft Paper Ziplock Pouch | Minimum package/sale size: 100g')
) AS x(code,name,category,notes)
JOIN public.categories c ON c.name=x.category AND c.is_active=true
CROSS JOIN (SELECT id FROM public.units WHERE code='U-KG' AND is_active=true LIMIT 1) u
WHERE NOT EXISTS (SELECT 1 FROM public.items i WHERE lower(i.name)=lower(x.name));

UPDATE public.id_sequences
SET prefix='PRD-', next_number=23, width=3, updated_at=now()
WHERE sequence_key='item_fp';

UPDATE public.id_sequences
SET prefix='RM-', next_number=90, width=3, updated_at=now()
WHERE sequence_key='item_rm';

COMMIT;
