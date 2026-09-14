ALTER TABLE public.items ADD COLUMN IF NOT EXISTS item_code text;

UPDATE public.items
SET item_code = business_code
WHERE item_code IS NULL AND business_code IS NOT NULL;

ALTER TABLE public.items
  ALTER COLUMN item_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_items_item_code_unique ON public.items(item_code);

COMMENT ON COLUMN public.items.item_code IS 'Permanent business-facing Item Code. System-generated, unique, and never reused. RM/FP/PFP codes are the item codes.';
