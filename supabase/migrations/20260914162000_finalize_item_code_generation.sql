INSERT INTO public.id_sequences (sequence_key, prefix, next_number, width) VALUES ('item_int', 'INT-', 1, 3), ('item_other', 'ITM-', 1, 3) ON CONFLICT (sequence_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.assign_item_business_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_sequence_key text;
BEGIN
  IF NEW.business_code IS NULL OR btrim(NEW.business_code) = '' THEN
    v_sequence_key := CASE NEW.item_type
      WHEN 'raw_material' THEN 'item_rm'
      WHEN 'finished_product' THEN 'item_fp'
      WHEN 'purchased_finished_product' THEN 'item_pfp'
      WHEN 'intermediate' THEN 'item_int'
      ELSE 'item_other'
    END;
    NEW.business_code := public.generate_business_code(v_sequence_key);
  END IF;
  IF NEW.item_code IS NULL OR btrim(NEW.item_code) = '' THEN
    NEW.item_code := NEW.business_code;
  END IF;
  RETURN NEW;
END;
$function$;

UPDATE public.items SET item_code = business_code WHERE item_code IS DISTINCT FROM business_code AND business_code IS NOT NULL;
