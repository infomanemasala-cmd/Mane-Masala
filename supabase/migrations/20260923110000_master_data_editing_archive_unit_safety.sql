-- Master Data editing, safe archiving, and controlled item-unit changes.
-- Historical transaction rows are never rewritten.

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;
ALTER TABLE public.sub_agents
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;

CREATE OR REPLACE FUNCTION public.update_master_item(
  p_item_id uuid,
  p_name text,
  p_item_type text,
  p_category_id uuid,
  p_subcategory text,
  p_product_family text,
  p_purchase_unit_id uuid,
  p_base_unit_id uuid,
  p_selling_unit_id uuid,
  p_minimum_stock numeric,
  p_can_be_sold boolean,
  p_can_be_used_in_production boolean,
  p_is_intermediate boolean,
  p_is_perishable boolean,
  p_expiry_tracking_enabled boolean,
  p_expiry_duration_value numeric,
  p_expiry_duration_unit text,
  p_notes text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_item public.items%rowtype;
  v_old_base uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_item FROM public.items WHERE id=p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF p_name IS NULL OR btrim(p_name)='' THEN RAISE EXCEPTION 'Item name is required'; END IF;
  IF p_item_type IS NULL OR NOT EXISTS (SELECT 1 FROM public.item_types WHERE code=p_item_type AND is_active=true) THEN RAISE EXCEPTION 'Select a valid active item type'; END IF;
  IF p_base_unit_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.units WHERE id=p_base_unit_id AND is_active=true) THEN RAISE EXCEPTION 'Select a valid active base unit'; END IF;
  IF p_purchase_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.units WHERE id=p_purchase_unit_id AND is_active=true) THEN RAISE EXCEPTION 'Select a valid active purchase unit'; END IF;
  IF p_selling_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.units WHERE id=p_selling_unit_id AND is_active=true) THEN RAISE EXCEPTION 'Select a valid active selling unit'; END IF;
  IF p_expiry_tracking_enabled AND (coalesce(p_expiry_duration_value,0)<=0 OR p_expiry_duration_unit NOT IN ('days','months','years')) THEN
    RAISE EXCEPTION 'Expiry tracking requires a positive duration and Days, Months or Years';
  END IF;
  v_old_base := v_item.base_unit_id;
  IF v_old_base IS DISTINCT FROM p_base_unit_id THEN
    RAISE EXCEPTION 'Base unit change must use the controlled unit-change workflow';
  END IF;

  UPDATE public.items SET
    name=btrim(p_name), item_type=p_item_type, category_id=p_category_id,
    subcategory=nullif(btrim(coalesce(p_subcategory,'')),''),
    product_family=nullif(btrim(coalesce(p_product_family,'')),''),
    purchase_unit_id=p_purchase_unit_id, base_unit_id=p_base_unit_id,
    selling_unit_id=p_selling_unit_id, minimum_stock=greatest(0,coalesce(p_minimum_stock,0)),
    can_be_sold=coalesce(p_can_be_sold,false),
    can_be_used_in_production=coalesce(p_can_be_used_in_production,false),
    is_intermediate=coalesce(p_is_intermediate,false),
    is_perishable=coalesce(p_is_perishable,false),
    expiry_tracking_enabled=coalesce(p_expiry_tracking_enabled,false),
    expiry_duration_value=case when p_expiry_tracking_enabled then p_expiry_duration_value else null end,
    expiry_duration_unit=case when p_expiry_tracking_enabled then p_expiry_duration_unit else null end,
    notes=nullif(btrim(coalesce(p_notes,'')),''),
    updated_at=now()
  WHERE id=p_item_id;

  PERFORM public.record_audit_event('master.item.updated','item',p_item_id,
    jsonb_build_object('name',p_name,'item_type',p_item_type,'category_id',p_category_id,'purchase_unit_id',p_purchase_unit_id,'base_unit_id',p_base_unit_id,'selling_unit_id',p_selling_unit_id),
    'application');
  RETURN jsonb_build_object('item_id',p_item_id,'business_code',v_item.business_code,'status','updated');
END; $$;

CREATE OR REPLACE FUNCTION public.change_item_base_unit(
  p_item_id uuid,
  p_new_base_unit_id uuid,
  p_confirmed_factor numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_item public.items%rowtype;
  v_old public.units%rowtype;
  v_new public.units%rowtype;
  v_old_root uuid;
  v_new_root uuid;
  v_old_factor numeric;
  v_new_factor numeric;
  v_factor numeric;
  v_stock numeric;
  v_reserved numeric;
  v_expected numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_item FROM public.items WHERE id=p_item_id AND is_active=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active item not found'; END IF;
  SELECT * INTO v_old FROM public.units WHERE id=v_item.base_unit_id AND is_active=true;
  SELECT * INTO v_new FROM public.units WHERE id=p_new_base_unit_id AND is_active=true;
  IF NOT FOUND OR v_new.id IS NULL THEN RAISE EXCEPTION 'New base unit is not active'; END IF;
  IF v_old.id=v_new.id THEN RETURN jsonb_build_object('item_id',p_item_id,'factor',1,'status','no_change'); END IF;

  v_old_root := coalesce(v_old.base_unit_id,v_old.id);
  v_new_root := coalesce(v_new.base_unit_id,v_new.id);
  IF v_old_root=v_new_root THEN
    v_old_factor := coalesce(v_old.conversion_to_base,1);
    v_new_factor := coalesce(v_new.conversion_to_base,1);
    IF v_old_factor<=0 OR v_new_factor<=0 THEN RAISE EXCEPTION 'Unit conversion is invalid'; END IF;
    v_factor := v_old_factor / v_new_factor;
  ELSIF v_old.base_unit_id=v_new.id AND v_old.conversion_to_base>0 THEN
    v_factor := v_old.conversion_to_base;
  ELSIF v_new.base_unit_id=v_old.id AND v_new.conversion_to_base>0 THEN
    v_factor := 1 / v_new.conversion_to_base;
  ELSE
    RAISE EXCEPTION 'These units do not have a safe conversion path. The base unit was not changed.';
  END IF;

  IF v_factor<=0 OR p_confirmed_factor IS NULL OR abs(p_confirmed_factor-v_factor)>0.000000000001 THEN
    RAISE EXCEPTION 'Conversion confirmation does not match the controlled conversion factor. No data was changed.';
  END IF;

  SELECT coalesce(sum(quantity_remaining),0) INTO v_stock
  FROM public.inventory_batches WHERE item_id=p_item_id AND status='active';
  SELECT coalesce(sum(quantity_reserved),0) INTO v_reserved
  FROM public.stock_reservations WHERE item_id=p_item_id AND status IN ('active','issued');
  v_expected := v_stock*v_factor;

  UPDATE public.inventory_batches
    SET quantity_received=quantity_received*v_factor,
        quantity_remaining=quantity_remaining*v_factor,
        unit_id=p_new_base_unit_id,
        unit_cost=case when unit_cost is null then null else unit_cost/v_factor end
  WHERE item_id=p_item_id AND status='active' AND quantity_remaining<>0;

  UPDATE public.stock_reservations
    SET quantity_reserved=quantity_reserved*v_factor, unit_id=p_new_base_unit_id
  WHERE item_id=p_item_id AND status IN ('active','issued');

  UPDATE public.items SET base_unit_id=p_new_base_unit_id, updated_at=now() WHERE id=p_item_id;

  PERFORM public.record_audit_event('master.item.base_unit_changed','item',p_item_id,
    jsonb_build_object('old_unit_id',v_old.id,'new_unit_id',p_new_base_unit_id,'factor',v_factor,'stock_before',v_stock,'stock_after',v_expected,'reserved_before',v_reserved,'reserved_after',v_reserved*v_factor),
    'application');
  RETURN jsonb_build_object('item_id',p_item_id,'old_unit_id',v_old.id,'new_unit_id',p_new_base_unit_id,'factor',v_factor,'stock_before',v_stock,'stock_after',v_expected,'reserved_before',v_reserved,'reserved_after',v_reserved*v_factor,'status','converted');
END; $$;

CREATE OR REPLACE FUNCTION public.archive_master_record(
  p_table text,
  p_id uuid,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
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
    UPDATE public.items SET is_active=false,archived_at=now(),archived_by=v_user,archive_reason=nullif(btrim(coalesce(p_reason,'')),''),updated_at=now() WHERE id=p_id;
  ELSIF p_table='suppliers' THEN
    SELECT is_active,business_code INTO v_is_active,v_code FROM public.suppliers WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;
    IF EXISTS (SELECT 1 FROM public.purchases p WHERE p.supplier_id=p_id AND p.financial_status NOT IN ('paid','cancelled')) THEN RAISE EXCEPTION 'This supplier has outstanding financial records and cannot be archived.'; END IF;
    UPDATE public.suppliers SET is_active=false,archived_at=now(),archived_by=v_user,archive_reason=nullif(btrim(coalesce(p_reason,'')),'') WHERE id=p_id;
  ELSIF p_table='customers' THEN
    SELECT is_active,business_code INTO v_is_active,v_code FROM public.customers WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;
    IF EXISTS (SELECT 1 FROM public.v_customer_outstanding WHERE customer_id=p_id AND outstanding_amount>0) THEN RAISE EXCEPTION 'This customer has an outstanding balance and cannot be archived.'; END IF;
    UPDATE public.customers SET is_active=false,archived_at=now(),archived_by=v_user,archive_reason=nullif(btrim(coalesce(p_reason,'')),'') WHERE id=p_id;
  ELSIF p_table='units' THEN
    SELECT is_active,code INTO v_is_active,v_code FROM public.units WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;
    IF EXISTS (SELECT 1 FROM public.items WHERE is_active=true AND (base_unit_id=p_id OR purchase_unit_id=p_id OR selling_unit_id=p_id)) THEN RAISE EXCEPTION 'This unit is used by active Master Data and cannot be archived.'; END IF;
    UPDATE public.units SET is_active=false,archived_at=now(),archived_by=v_user,archive_reason=nullif(btrim(coalesce(p_reason,'')),'') WHERE id=p_id;
  ELSIF p_table='categories' THEN
    SELECT is_active,code INTO v_is_active,v_code FROM public.categories WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;
    IF EXISTS (SELECT 1 FROM public.items WHERE is_active=true AND category_id=p_id) THEN RAISE EXCEPTION 'This category is used by active Master Data and cannot be archived.'; END IF;
    UPDATE public.categories SET is_active=false,archived_at=now(),archived_by=v_user,archive_reason=nullif(btrim(coalesce(p_reason,'')),'') WHERE id=p_id;
  ELSE
    SELECT is_active,business_code INTO v_is_active,v_code FROM public.sub_agents WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;
    UPDATE public.sub_agents SET is_active=false,archived_at=now(),archived_by=v_user,archive_reason=nullif(btrim(coalesce(p_reason,'')),'') WHERE id=p_id;
  END IF;

  PERFORM public.record_audit_event('master.record.archived',p_table,p_id,jsonb_build_object('business_code',v_code,'reason',p_reason),'application');
  RETURN jsonb_build_object('id',p_id,'table',p_table,'business_code',v_code,'status','archived');
END; $$;

CREATE OR REPLACE FUNCTION public.restore_master_record(p_table text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid:=auth.uid(); v_code text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_table='items' THEN UPDATE public.items SET is_active=true,archived_at=null,archived_by=null,archive_reason=null,updated_at=now() WHERE id=p_id RETURNING business_code INTO v_code;
  ELSIF p_table='suppliers' THEN UPDATE public.suppliers SET is_active=true,archived_at=null,archived_by=null,archive_reason=null WHERE id=p_id RETURNING business_code INTO v_code;
  ELSIF p_table='customers' THEN UPDATE public.customers SET is_active=true,archived_at=null,archived_by=null,archive_reason=null WHERE id=p_id RETURNING business_code INTO v_code;
  ELSIF p_table='units' THEN UPDATE public.units SET is_active=true,archived_at=null,archived_by=null,archive_reason=null WHERE id=p_id RETURNING code INTO v_code;
  ELSIF p_table='categories' THEN UPDATE public.categories SET is_active=true,archived_at=null,archived_by=null,archive_reason=null WHERE id=p_id RETURNING code INTO v_code;
  ELSIF p_table='sub_agents' THEN UPDATE public.sub_agents SET is_active=true,archived_at=null,archived_by=null,archive_reason=null WHERE id=p_id RETURNING business_code INTO v_code;
  ELSE RAISE EXCEPTION 'Unsupported Master Data table';
  END IF;
  IF v_code IS NULL THEN RAISE EXCEPTION 'Record not found'; END IF;
  PERFORM public.record_audit_event('master.record.restored',p_table,p_id,jsonb_build_object('business_code',v_code),'application');
  RETURN jsonb_build_object('id',p_id,'table',p_table,'business_code',v_code,'status','active');
END; $$;

REVOKE ALL ON FUNCTION public.update_master_item(uuid,text,text,uuid,text,text,uuid,uuid,uuid,numeric,boolean,boolean,boolean,boolean,boolean,numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_master_item(uuid,text,text,uuid,text,text,uuid,uuid,uuid,numeric,boolean,boolean,boolean,boolean,boolean,numeric,text,text) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.change_item_base_unit(uuid,uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.change_item_base_unit(uuid,uuid,numeric) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.archive_master_record(text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.archive_master_record(text,uuid,text) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.restore_master_record(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.restore_master_record(text,uuid) TO authenticated,service_role;
