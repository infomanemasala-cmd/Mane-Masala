-- Item Master: formal selling pack columns on update_master_item (not notes)

create or replace function public.update_master_item(
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
  p_notes text,
  p_selling_pack_type text default null,
  p_selling_pack_size_kg numeric default null,
  p_selling_pack_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_item public.items%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_item from public.items where id = p_item_id for update;
  if not found then raise exception 'Item not found'; end if;
  if p_name is null or btrim(p_name) = '' then raise exception 'Item name is required'; end if;
  if p_item_type is null or not exists (select 1 from public.item_types where code = p_item_type and is_active = true) then
    raise exception 'Select a valid active item type';
  end if;
  if p_base_unit_id is null or not exists (select 1 from public.units where id = p_base_unit_id and is_active = true) then
    raise exception 'Select a valid active base unit';
  end if;
  if p_purchase_unit_id is not null and not exists (select 1 from public.units where id = p_purchase_unit_id and is_active = true) then
    raise exception 'Select a valid active purchase unit';
  end if;
  if p_selling_unit_id is not null and not exists (select 1 from public.units where id = p_selling_unit_id and is_active = true) then
    raise exception 'Select a valid active selling unit';
  end if;
  if p_expiry_tracking_enabled and (coalesce(p_expiry_duration_value, 0) <= 0 or p_expiry_duration_unit not in ('days', 'months', 'years')) then
    raise exception 'Expiry tracking requires a positive duration and Days, Months or Years';
  end if;
  if v_item.base_unit_id is distinct from p_base_unit_id then
    raise exception 'Base unit change must use the controlled unit-change workflow';
  end if;
  if coalesce(p_can_be_sold, false) and coalesce(p_selling_pack_size_kg, 0) <= 0 then
    raise exception 'Sellable items require a selling pack size (kg)';
  end if;

  update public.items set
    name = btrim(p_name),
    item_type = p_item_type,
    category_id = p_category_id,
    subcategory = nullif(btrim(coalesce(p_subcategory, '')), ''),
    product_family = nullif(btrim(coalesce(p_product_family, '')), ''),
    purchase_unit_id = p_purchase_unit_id,
    base_unit_id = p_base_unit_id,
    selling_unit_id = p_selling_unit_id,
    minimum_stock = greatest(0, coalesce(p_minimum_stock, 0)),
    can_be_sold = coalesce(p_can_be_sold, false),
    can_be_used_in_production = coalesce(p_can_be_used_in_production, false),
    is_intermediate = coalesce(p_is_intermediate, false),
    is_perishable = coalesce(p_is_perishable, false),
    expiry_tracking_enabled = coalesce(p_expiry_tracking_enabled, false),
    expiry_duration_value = case when coalesce(p_expiry_tracking_enabled, false) then p_expiry_duration_value else null end,
    expiry_duration_unit = case when coalesce(p_expiry_tracking_enabled, false) then p_expiry_duration_unit else null end,
    notes = nullif(btrim(coalesce(p_notes, '')), ''),
    selling_pack_type = nullif(btrim(coalesce(p_selling_pack_type, '')), ''),
    selling_pack_size_kg = case when coalesce(p_selling_pack_size_kg, 0) > 0 then p_selling_pack_size_kg else null end,
    selling_pack_label = nullif(btrim(coalesce(p_selling_pack_label, '')), ''),
    updated_at = now()
  where id = p_item_id;

  return jsonb_build_object('ok', true, 'id', p_item_id);
end;
$function$;

grant execute on function public.update_master_item(
  uuid, text, text, uuid, text, text, uuid, uuid, uuid, numeric,
  boolean, boolean, boolean, boolean, boolean, numeric, text, text,
  text, numeric, text
) to authenticated;
