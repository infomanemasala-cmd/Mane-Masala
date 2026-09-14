-- Mane Masala Business System
-- Approved master code families and multi-role item usage.
-- Permanent codes are system generated; users never type them.

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS can_be_sold boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_be_used_in_production boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_intermediate boolean NOT NULL DEFAULT false;

UPDATE public.items SET can_be_sold = true WHERE item_type IN ('finished_product','purchased_finished_product');
UPDATE public.items SET can_be_used_in_production = true WHERE item_type = 'raw_material';

INSERT INTO public.id_sequences (sequence_key, prefix, next_number, width)
VALUES
 ('item_rm','RM-',84,3),('item_fp','FP-',1,3),('item_pfp','PFP-',1,3),
 ('supplier','SUP-',1,3),('customer','CUS-',1,3),('sub_agent','SA-',1,3),
 ('category','CAT-',1,3),('unit','UNT-',1,3)
ON CONFLICT (sequence_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.generate_business_code(p_sequence_key text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_prefix text; v_number bigint; v_width integer;
BEGIN
 SELECT s.prefix,s.next_number,s.width INTO v_prefix,v_number,v_width FROM public.id_sequences s WHERE s.sequence_key=p_sequence_key FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown business code sequence: %',p_sequence_key; END IF;
 UPDATE public.id_sequences SET next_number=v_number+1,updated_at=now() WHERE sequence_key=p_sequence_key;
 RETURN v_prefix || lpad(v_number::text,v_width,'0');
END; $$;
REVOKE ALL ON FUNCTION public.generate_business_code(text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.assign_item_business_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.business_code IS NULL OR btrim(NEW.business_code)='' THEN NEW.business_code:=public.generate_business_code(CASE NEW.item_type WHEN 'raw_material' THEN 'item_rm' WHEN 'finished_product' THEN 'item_fp' WHEN 'purchased_finished_product' THEN 'item_pfp' ELSE NULL END); END IF; RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.assign_supplier_business_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF NEW.business_code IS NULL OR btrim(NEW.business_code)='' THEN NEW.business_code:=public.generate_business_code('supplier'); END IF; RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.assign_customer_business_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF NEW.business_code IS NULL OR btrim(NEW.business_code)='' THEN NEW.business_code:=public.generate_business_code('customer'); END IF; RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.assign_sub_agent_business_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF NEW.business_code IS NULL OR btrim(NEW.business_code)='' THEN NEW.business_code:=public.generate_business_code('sub_agent'); END IF; RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.assign_category_business_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF NEW.code IS NULL OR btrim(NEW.code)='' THEN NEW.code:=public.generate_business_code('category'); END IF; RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.assign_unit_business_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF NEW.code IS NULL OR btrim(NEW.code)='' THEN NEW.code:=public.generate_business_code('unit'); END IF; RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS items_business_code_trigger ON public.items;
CREATE TRIGGER items_business_code_trigger BEFORE INSERT ON public.items FOR EACH ROW EXECUTE FUNCTION public.assign_item_business_code();
DROP TRIGGER IF EXISTS suppliers_business_code_trigger ON public.suppliers;
CREATE TRIGGER suppliers_business_code_trigger BEFORE INSERT ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.assign_supplier_business_code();
DROP TRIGGER IF EXISTS customers_business_code_trigger ON public.customers;
CREATE TRIGGER customers_business_code_trigger BEFORE INSERT ON public.customers FOR EACH ROW EXECUTE FUNCTION public.assign_customer_business_code();
DROP TRIGGER IF EXISTS sub_agents_business_code_trigger ON public.sub_agents;
CREATE TRIGGER sub_agents_business_code_trigger BEFORE INSERT ON public.sub_agents FOR EACH ROW EXECUTE FUNCTION public.assign_sub_agent_business_code();
DROP TRIGGER IF EXISTS categories_business_code_trigger ON public.categories;
CREATE TRIGGER categories_business_code_trigger BEFORE INSERT ON public.categories FOR EACH ROW EXECUTE FUNCTION public.assign_category_business_code();
DROP TRIGGER IF EXISTS units_business_code_trigger ON public.units;
CREATE TRIGGER units_business_code_trigger BEFORE INSERT ON public.units FOR EACH ROW EXECUTE FUNCTION public.assign_unit_business_code();

UPDATE public.items SET business_code=public.generate_business_code(CASE item_type WHEN 'finished_product' THEN 'item_fp' WHEN 'purchased_finished_product' THEN 'item_pfp' END) WHERE business_code IS NULL AND item_type IN ('finished_product','purchased_finished_product');
UPDATE public.categories SET code=public.generate_business_code('category') WHERE code IS NOT NULL AND code NOT LIKE 'CAT-%';
UPDATE public.units SET code=public.generate_business_code('unit') WHERE code IS NOT NULL AND code NOT LIKE 'UNT-%';

COMMENT ON FUNCTION public.generate_business_code(text) IS 'Central permanent business-code generator. Approved families: RM, FP, PFP, SUP, CUS, SA, CAT, UNT.';
COMMENT ON COLUMN public.items.can_be_sold IS 'Item role: may be sold directly; does not change item identity.';
COMMENT ON COLUMN public.items.can_be_used_in_production IS 'Item role: may be consumed in production; same item may also be sold.';
COMMENT ON COLUMN public.items.is_intermediate IS 'Item role: may be held as intermediate/prepared material; same stock identity is retained.';
