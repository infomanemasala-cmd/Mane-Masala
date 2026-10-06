BEGIN;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS sub_agent_id uuid;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_sub_agent_id_fkey;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_sub_agent_id_fkey
  FOREIGN KEY (sub_agent_id) REFERENCES public.sub_agents(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_customers_sub_agent_id
  ON public.customers(sub_agent_id);

ALTER TABLE public.items ADD COLUMN IF NOT EXISTS pre_archive_is_active boolean;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS pre_archive_is_active boolean;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS pre_archive_is_active boolean;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS pre_archive_is_active boolean;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS pre_archive_is_active boolean;
ALTER TABLE public.sub_agents ADD COLUMN IF NOT EXISTS pre_archive_is_active boolean;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS pre_archive_status text;

UPDATE public.items SET pre_archive_is_active=false WHERE archived_at IS NOT NULL AND pre_archive_is_active IS NULL;
UPDATE public.suppliers SET pre_archive_is_active=false WHERE archived_at IS NOT NULL AND pre_archive_is_active IS NULL;
UPDATE public.customers SET pre_archive_is_active=false WHERE archived_at IS NOT NULL AND pre_archive_is_active IS NULL;
UPDATE public.units SET pre_archive_is_active=false WHERE archived_at IS NOT NULL AND pre_archive_is_active IS NULL;
UPDATE public.categories SET pre_archive_is_active=false WHERE archived_at IS NOT NULL AND pre_archive_is_active IS NULL;
UPDATE public.sub_agents SET pre_archive_is_active=false WHERE archived_at IS NOT NULL AND pre_archive_is_active IS NULL;
UPDATE public.recipes SET pre_archive_status='inactive' WHERE status='archived' AND pre_archive_status IS NULL;

CREATE OR REPLACE FUNCTION public.archive_master_record(p_table text, p_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_user uuid:=auth.uid();
  v_code text;
  v_is_active boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_table NOT IN ('items','suppliers','customers','units','categories','sub_agents') THEN RAISE EXCEPTION 'Archiving is limited to Master Data records'; END IF;

  IF p_table='items' THEN
    SELECT is_active,business_code INTO v_is_active,v_code FROM public.items WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;
    IF EXISTS (SELECT 1 FROM public.stock_reservations WHERE item_id=p_id AND status IN ('active','issued')) THEN RAISE EXCEPTION 'This item has active stock reservations and cannot be archived.'; END IF;
    IF EXISTS (SELECT 1 FROM public.recipe_versions rv JOIN public.recipes r ON r.id=rv.recipe_id WHERE rv.status='active' AND r.status='active' AND (rv.base_ingredient_item_id=p_id OR EXISTS (SELECT 1 FROM public.recipe_lines rl WHERE rl.recipe_version_id=rv.id AND rl.ingredient_item_id=p_id))) THEN RAISE EXCEPTION 'This item is used by an active recipe and cannot be archived.'; END IF;
    UPDATE public.items SET pre_archive_is_active=v_is_active,is_active=false,archived_at=now(),archived_by=v_user,archive_reason=nullif(btrim(coalesce(p_reason,'')),'') WHERE id=p_id;
  ELSIF p_table='suppliers' THEN
    SELECT is_active,business_code INTO v_is_active,v_code FROM public.suppliers WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;
    IF EXISTS (SELECT 1 FROM public.purchases p WHERE p.supplier_id=p_id AND p.financial_status NOT IN ('paid','cancelled')) THEN RAISE EXCEPTION 'This supplier has outstanding financial records and cannot be archived.'; END IF;
    UPDATE public.suppliers SET pre_archive_is_active=v_is_active,is_active=false,archived_at=now(),archived_by=v_user,archive_reason=nullif(btrim(coalesce(p_reason,'')),'') WHERE id=p_id;
  ELSIF p_table='customers' THEN
    SELECT is_active,business_code INTO v_is_active,v_code FROM public.customers WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;
    IF EXISTS (SELECT 1 FROM public.v_customer_outstanding WHERE customer_id=p_id AND outstanding>0) THEN RAISE EXCEPTION 'This customer has an outstanding balance and cannot be archived.'; END IF;
    UPDATE public.customers SET pre_archive_is_active=v_is_active,is_active=false,archived_at=now(),archived_by=v_user,archive_reason=nullif(btrim(coalesce(p_reason,'')),'') WHERE id=p_id;
  ELSIF p_table='units' THEN
    SELECT is_active,code INTO v_is_active,v_code FROM public.units WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;
    IF EXISTS (SELECT 1 FROM public.items WHERE is_active=true AND (base_unit_id=p_id OR purchase_unit_id=p_id OR selling_unit_id=p_id)) THEN RAISE EXCEPTION 'This unit is used by active Master Data and cannot be archived.'; END IF;
    UPDATE public.units SET pre_archive_is_active=v_is_active,is_active=false,archived_at=now(),archived_by=v_user,archive_reason=nullif(btrim(coalesce(p_reason,'')),'') WHERE id=p_id;
  ELSIF p_table='categories' THEN
    SELECT is_active,code INTO v_is_active,v_code FROM public.categories WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;
    IF EXISTS (SELECT 1 FROM public.items WHERE is_active=true AND category_id=p_id) THEN RAISE EXCEPTION 'This category is used by active Master Data and cannot be archived.'; END IF;
    UPDATE public.categories SET pre_archive_is_active=v_is_active,is_active=false,archived_at=now(),archived_by=v_user,archive_reason=nullif(btrim(coalesce(p_reason,'')),'') WHERE id=p_id;
  ELSE
    SELECT is_active,business_code INTO v_is_active,v_code FROM public.sub_agents WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;
    UPDATE public.sub_agents SET pre_archive_is_active=v_is_active,is_active=false,archived_at=now(),archived_by=v_user,archive_reason=nullif(btrim(coalesce(p_reason,'')),'') WHERE id=p_id;
  END IF;

  PERFORM public.record_audit_event('master.record.archived',p_table,p_id,jsonb_build_object('business_code',v_code,'reason',p_reason,'pre_archive_is_active',v_is_active),'application');
  RETURN jsonb_build_object('id',p_id,'table',p_table,'business_code',v_code,'status','archived');
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_master_record(p_table text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_user uuid:=auth.uid();
  v_code text;
  v_restore_active boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  IF p_table='items' THEN
    SELECT business_code,coalesce(pre_archive_is_active,false) INTO v_code,v_restore_active FROM public.items WHERE id=p_id AND archived_at IS NOT NULL FOR UPDATE;
    IF v_code IS NULL THEN RAISE EXCEPTION 'Record not found or not archived'; END IF;
    UPDATE public.items SET is_active=v_restore_active,archived_at=null,archived_by=null,archive_reason=null,pre_archive_is_active=null,updated_at=now() WHERE id=p_id;
  ELSIF p_table='suppliers' THEN
    SELECT business_code,coalesce(pre_archive_is_active,false) INTO v_code,v_restore_active FROM public.suppliers WHERE id=p_id AND archived_at IS NOT NULL FOR UPDATE;
    IF v_code IS NULL THEN RAISE EXCEPTION 'Record not found or not archived'; END IF;
    UPDATE public.suppliers SET is_active=v_restore_active,archived_at=null,archived_by=null,archive_reason=null,pre_archive_is_active=null WHERE id=p_id;
  ELSIF p_table='customers' THEN
    SELECT business_code,coalesce(pre_archive_is_active,false) INTO v_code,v_restore_active FROM public.customers WHERE id=p_id AND archived_at IS NOT NULL FOR UPDATE;
    IF v_code IS NULL THEN RAISE EXCEPTION 'Record not found or not archived'; END IF;
    UPDATE public.customers SET is_active=v_restore_active,archived_at=null,archived_by=null,archive_reason=null,pre_archive_is_active=null WHERE id=p_id;
  ELSIF p_table='units' THEN
    SELECT code,coalesce(pre_archive_is_active,false) INTO v_code,v_restore_active FROM public.units WHERE id=p_id AND archived_at IS NOT NULL FOR UPDATE;
    IF v_code IS NULL THEN RAISE EXCEPTION 'Record not found or not archived'; END IF;
    UPDATE public.units SET is_active=v_restore_active,archived_at=null,archived_by=null,archive_reason=null,pre_archive_is_active=null WHERE id=p_id;
  ELSIF p_table='categories' THEN
    SELECT code,coalesce(pre_archive_is_active,false) INTO v_code,v_restore_active FROM public.categories WHERE id=p_id AND archived_at IS NOT NULL FOR UPDATE;
    IF v_code IS NULL THEN RAISE EXCEPTION 'Record not found or not archived'; END IF;
    UPDATE public.categories SET is_active=v_restore_active,archived_at=null,archived_by=null,archive_reason=null,pre_archive_is_active=null WHERE id=p_id;
  ELSIF p_table='sub_agents' THEN
    SELECT business_code,coalesce(pre_archive_is_active,false) INTO v_code,v_restore_active FROM public.sub_agents WHERE id=p_id AND archived_at IS NOT NULL FOR UPDATE;
    IF v_code IS NULL THEN RAISE EXCEPTION 'Record not found or not archived'; END IF;
    UPDATE public.sub_agents SET is_active=v_restore_active,archived_at=null,archived_by=null,archive_reason=null,pre_archive_is_active=null WHERE id=p_id;
  ELSE
    RAISE EXCEPTION 'Unsupported Master Data table';
  END IF;

  PERFORM public.record_audit_event('master.record.restored',p_table,p_id,jsonb_build_object('business_code',v_code,'restored_active',v_restore_active),'application');
  RETURN jsonb_build_object('id',p_id,'table',p_table,'business_code',v_code,'status',case when v_restore_active then 'active' else 'inactive' end);
END;
$function$;

CREATE OR REPLACE FUNCTION public.archive_recipe(p_recipe_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_user uuid:=auth.uid(); v_code text; v_name text; v_status text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT business_code,name,status INTO v_code,v_name,v_status FROM public.recipes WHERE id=p_recipe_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipe not found'; END IF;
  IF v_status='archived' THEN RAISE EXCEPTION 'Recipe is already archived'; END IF;
  IF EXISTS (SELECT 1 FROM public.production_batches pb JOIN public.recipe_versions rv ON rv.id=pb.recipe_version_id WHERE rv.recipe_id=p_recipe_id AND pb.status IN ('planned','in_progress','approved','ready')) THEN
    RAISE EXCEPTION 'This recipe has an active production batch and cannot be archived.';
  END IF;
  UPDATE public.recipes SET pre_archive_status=v_status,status='archived',updated_at=now(),
    notes=CASE WHEN nullif(btrim(coalesce(p_reason,'')),'') IS NULL THEN notes ELSE concat_ws(E'\n',notes,concat('Archive reason: ',btrim(p_reason))) END
  WHERE id=p_recipe_id;
  PERFORM public.record_audit_event('recipe.archived','recipe',p_recipe_id,jsonb_build_object('business_code',v_code,'reason',p_reason,'pre_archive_status',v_status),'application');
  RETURN jsonb_build_object('id',p_recipe_id,'business_code',v_code,'status','archived');
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_recipe(p_recipe_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_user uuid:=auth.uid(); v_code text; v_output uuid; v_restore_status text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT business_code,output_item_id,coalesce(pre_archive_status,'inactive') INTO v_code,v_output,v_restore_status FROM public.recipes WHERE id=p_recipe_id AND status='archived' FOR UPDATE;
  IF v_code IS NULL THEN RAISE EXCEPTION 'Recipe not found or not archived'; END IF;
  IF v_restore_status NOT IN ('active','inactive','draft') THEN RAISE EXCEPTION 'Archived recipe has an invalid previous status'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.items WHERE id=v_output AND is_active=true) THEN RAISE EXCEPTION 'Recipe output item is archived; restore the output item first.'; END IF;
  UPDATE public.recipes SET status=v_restore_status,updated_at=now(),pre_archive_status=null WHERE id=p_recipe_id;
  PERFORM public.record_audit_event('recipe.restored','recipe',p_recipe_id,jsonb_build_object('business_code',v_code,'restored_status',v_restore_status),'application');
  RETURN jsonb_build_object('id',p_recipe_id,'business_code',v_code,'status',v_restore_status);
END;
$function$;

COMMIT;