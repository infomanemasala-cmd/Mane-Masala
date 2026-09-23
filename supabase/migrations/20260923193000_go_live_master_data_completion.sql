-- Mane Masala go-live master data completion and safe item maintenance
-- Additive only. No historical transaction rewrite.

do $$
declare
  v_kg uuid;
  v_pulses uuid;
  v_spices uuid;
begin
  select id into v_kg from public.units where lower(symbol) = 'kg' and is_active is true order by id limit 1;
  select id into v_pulses from public.categories where code = 'PULSES' and is_active is true limit 1;
  select id into v_spices from public.categories where code = 'SPICES' and is_active is true limit 1;

  if v_kg is null or v_pulses is null or v_spices is null then
    raise exception 'Required Master Data dependencies are missing: KG/PULSES/SPICES';
  end if;

  if exists (select 1 from public.items where item_code = 'RM-002' and name <> 'Urad Dal') then
    raise exception 'RM-002 already belongs to a different item';
  end if;
  if exists (select 1 from public.items where item_code = 'RM-003' and name <> 'Toor Dal') then
    raise exception 'RM-003 already belongs to a different item';
  end if;
  if exists (select 1 from public.items where item_code = 'RM-004' and name <> 'Masoor Dal') then
    raise exception 'RM-004 already belongs to a different item';
  end if;

  insert into public.items(
    business_code,item_code,name,item_type,category_id,subcategory,
    purchase_unit_id,base_unit_id,selling_unit_id,minimum_stock,
    can_be_sold,can_be_used_in_production,is_intermediate,is_perishable,
    expiry_tracking_enabled,notes
  )
  select 'RM-002','RM-002','Urad Dal','raw_material',v_pulses,'Dal',
         v_kg,v_kg,v_kg,0,false,true,false,false,false,'Food grade'
  where not exists (select 1 from public.items where item_code='RM-002');

  insert into public.items(
    business_code,item_code,name,item_type,category_id,subcategory,
    purchase_unit_id,base_unit_id,selling_unit_id,minimum_stock,
    can_be_sold,can_be_used_in_production,is_intermediate,is_perishable,
    expiry_tracking_enabled,notes
  )
  select 'RM-003','RM-003','Toor Dal','raw_material',v_pulses,'Dal',
         v_kg,v_kg,v_kg,0,false,true,false,false,false,'Food grade'
  where not exists (select 1 from public.items where item_code='RM-003');

  insert into public.items(
    business_code,item_code,name,item_type,category_id,subcategory,
    purchase_unit_id,base_unit_id,selling_unit_id,minimum_stock,
    can_be_sold,can_be_used_in_production,is_intermediate,is_perishable,
    expiry_tracking_enabled,notes
  )
  select 'RM-004','RM-004','Masoor Dal','raw_material',v_pulses,'Dal',
         v_kg,v_kg,v_kg,0,false,true,false,false,false,'Food grade'
  where not exists (select 1 from public.items where item_code='RM-004');

  if exists (select 1 from public.items where item_code='FP-002' and name <> 'Black Pepper') then
    raise exception 'FP-002 already belongs to a different item';
  end if;
  if exists (select 1 from public.items where item_code='FP-003' and name <> 'Cardamom') then
    raise exception 'FP-003 already belongs to a different item';
  end if;
  if exists (select 1 from public.items where item_code='FP-004' and name <> 'Turmeric') then
    raise exception 'FP-004 already belongs to a different item';
  end if;

  insert into public.items(
    business_code,item_code,name,item_type,category_id,subcategory,
    purchase_unit_id,base_unit_id,selling_unit_id,minimum_stock,
    can_be_sold,can_be_used_in_production,is_intermediate,is_perishable,
    expiry_tracking_enabled,notes
  )
  select 'FP-002','FP-002','Black Pepper','finished_product',v_spices,'Whole Spice',
         v_kg,v_kg,v_kg,0,true,false,false,false,false,
         'Package: Brown Kraft Paper Ziplock Pouch | Minimum package/sale size: 250g'
  where not exists (select 1 from public.items where item_code='FP-002');

  insert into public.items(
    business_code,item_code,name,item_type,category_id,subcategory,
    purchase_unit_id,base_unit_id,selling_unit_id,minimum_stock,
    can_be_sold,can_be_used_in_production,is_intermediate,is_perishable,
    expiry_tracking_enabled,notes
  )
  select 'FP-003','FP-003','Cardamom','finished_product',v_spices,'Whole Spice',
         v_kg,v_kg,v_kg,0,true,false,false,false,false,
         'Package: Brown Kraft Paper Ziplock Pouch | Minimum package/sale size: 100g'
  where not exists (select 1 from public.items where item_code='FP-003');

  insert into public.items(
    business_code,item_code,name,item_type,category_id,subcategory,
    purchase_unit_id,base_unit_id,selling_unit_id,minimum_stock,
    can_be_sold,can_be_used_in_production,is_intermediate,is_perishable,
    expiry_tracking_enabled,notes
  )
  select 'FP-004','FP-004','Turmeric','finished_product',v_spices,'Spice',
         v_kg,v_kg,v_kg,0,true,false,false,false,false,
         'Package: Brown Kraft Paper Ziplock Pouch | Minimum package/sale size: 100g'
  where not exists (select 1 from public.items where item_code='FP-004');

  -- These identities already exist as operational materials and are intentionally reused.
  -- They already carry the supplied sellable/package role:
  -- RM-051 Bird Eye Chilli, RM-070 Honey – Forest, RM-071 Honey – Natural.

  update public.id_sequences
  set next_number = greatest(next_number, 90), updated_at = now()
  where sequence_key = 'item_rm';

  update public.id_sequences
  set next_number = greatest(next_number, 5), updated_at = now()
  where sequence_key = 'item_fp';
end $$;

create or replace function public.update_master_item_safe(
  p_item_id uuid,
  p_name text,
  p_category_id uuid default null,
  p_subcategory text default null,
  p_product_family text default null,
  p_purchase_unit_id uuid default null,
  p_base_unit_id uuid default null,
  p_selling_unit_id uuid default null,
  p_minimum_stock numeric default 0,
  p_can_be_sold boolean default false,
  p_can_be_used_in_production boolean default false,
  p_is_intermediate boolean default false,
  p_is_perishable boolean default false,
  p_expiry_tracking_enabled boolean default false,
  p_expiry_duration_value numeric default null,
  p_expiry_duration_unit text default null,
  p_notes text default null
)
returns public.items
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_old public.items;
  v_new public.items;
  v_has_history boolean := false;
  v_stock numeric := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_old from public.items where id=p_item_id for update;
  if v_old.id is null then raise exception 'Item not found'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'Item name is required'; end if;
  if p_minimum_stock < 0 then raise exception 'Minimum stock cannot be negative'; end if;
  if p_base_unit_id is null then raise exception 'Base unit is required'; end if;

  select coalesce(sum(quantity_remaining),0) into v_stock
  from public.inventory_batches
  where item_id=p_item_id and status='active';

  select exists (
    select 1 from public.purchase_lines where item_id=p_item_id
    union all select 1 from public.purchase_receipt_lines prl join public.purchase_lines pl on pl.id=prl.purchase_line_id where pl.item_id=p_item_id
    union all select 1 from public.inventory_transactions where item_id=p_item_id
    union all select 1 from public.inventory_batches where item_id=p_item_id
    union all select 1 from public.production_consumption where ingredient_item_id=p_item_id
    union all select 1 from public.production_outputs where output_item_id=p_item_id
    union all select 1 from public.order_lines where item_id=p_item_id
    union all select 1 from public.dispatch_lines where item_id=p_item_id
    union all select 1 from public.sale_lines where item_id=p_item_id
    union all select 1 from public.invoice_lines where item_id=p_item_id
    union all select 1 from public.customer_return_lines where item_id=p_item_id
    union all select 1 from public.stock_outs where item_id=p_item_id
    union all select 1 from public.stock_adjustments where item_id=p_item_id
    union all select 1 from public.opening_stock where item_id=p_item_id
  ) into v_has_history;

  if (p_base_unit_id is distinct from v_old.base_unit_id
      or p_purchase_unit_id is distinct from v_old.purchase_unit_id
      or p_selling_unit_id is distinct from v_old.selling_unit_id)
     and (v_has_history or v_stock <> 0) then
    raise exception 'Unit change blocked because this item has historical/current stock dependencies. Create a new master item instead.';
  end if;

  update public.items
  set name=trim(p_name),
      category_id=p_category_id,
      subcategory=nullif(trim(p_subcategory),''),
      product_family=nullif(trim(p_product_family),''),
      purchase_unit_id=p_purchase_unit_id,
      base_unit_id=p_base_unit_id,
      selling_unit_id=p_selling_unit_id,
      minimum_stock=p_minimum_stock,
      can_be_sold=p_can_be_sold,
      can_be_used_in_production=p_can_be_used_in_production,
      is_intermediate=p_is_intermediate,
      is_perishable=p_is_perishable,
      expiry_tracking_enabled=p_expiry_tracking_enabled,
      expiry_duration_value=p_expiry_duration_value,
      expiry_duration_unit=nullif(trim(p_expiry_duration_unit),''),
      notes=nullif(trim(p_notes),''),
      updated_at=now()
  where id=p_item_id
  returning * into v_new;

  perform public.record_audit_event(
    'master.item.updated','item',p_item_id,
    jsonb_build_object('item_code',v_old.item_code,'name_before',v_old.name,'name_after',v_new.name),
    'application'
  );
  return v_new;
end;
$function$;

create or replace function public.archive_master_items(p_item_ids uuid[], p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_user uuid := auth.uid();
  v_stock numeric;
  v_blocked text;
  v_count int := 0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if coalesce(array_length(p_item_ids,1),0)=0 then raise exception 'Select at least one item to archive'; end if;

  foreach v_id in array p_item_ids loop
    select coalesce(sum(quantity_remaining),0) into v_stock
    from public.inventory_batches where item_id=v_id and status='active';

    if v_stock > 0 then
      raise exception 'Cannot archive % because current stock is %', v_id, v_stock;
    end if;

    if exists (
      select 1 from public.recipes r where r.output_item_id=v_id and r.status='active'
      union all
      select 1
      from public.recipe_versions rv
      join public.recipe_lines rl on rl.recipe_version_id=rv.id
      where rv.status='active' and rl.ingredient_item_id=v_id
      union all
      select 1 from public.stock_reservations sr where sr.item_id=v_id and sr.status='active'
      union all
      select 1 from public.order_lines ol join public.orders o on o.id=ol.order_id
      where ol.item_id=v_id and o.status not in ('cancelled','completed')
    ) then
      raise exception 'Cannot archive item % because it is used by an active operational dependency', v_id;
    end if;

    update public.items
    set is_active=false, archived_at=now(), archived_by=v_user, archive_reason=nullif(trim(p_reason),''),
        updated_at=now()
    where id=v_id and is_active=true;

    if found then
      v_count := v_count + 1;
      perform public.record_audit_event(
        'master.item.archived','item',v_id,
        jsonb_build_object('reason',p_reason),
        'application'
      );
    end if;
  end loop;

  return jsonb_build_object('archived_count',v_count);
end;
$function$;

create or replace function public.restore_master_items(p_item_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_count int := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if coalesce(array_length(p_item_ids,1),0)=0 then raise exception 'Select at least one item to restore'; end if;

  foreach v_id in array p_item_ids loop
    if exists (
      select 1 from public.items active
      join public.items archived on archived.id=v_id
      where active.is_active=true and lower(active.name)=lower(archived.name)
    ) then
      raise exception 'Cannot restore item % because another active item already uses this name', v_id;
    end if;

    update public.items
    set is_active=true, archived_at=null, archived_by=null, archive_reason=null, updated_at=now()
    where id=v_id and is_active=false;

    if found then
      v_count := v_count + 1;
      perform public.record_audit_event(
        'master.item.restored','item',v_id,
        jsonb_build_object('restored',true),
        'application'
      );
    end if;
  end loop;

  return jsonb_build_object('restored_count',v_count);
end;
$function$;

revoke all on function public.update_master_item_safe(uuid,text,uuid,text,text,uuid,uuid,uuid,numeric,boolean,boolean,boolean,boolean,boolean,numeric,text,text) from public;
revoke all on function public.archive_master_items(uuid[],text) from public;
revoke all on function public.restore_master_items(uuid[]) from public;
grant execute on function public.update_master_item_safe(uuid,text,uuid,text,text,uuid,uuid,uuid,numeric,boolean,boolean,boolean,boolean,boolean,numeric,text,text) to authenticated;
grant execute on function public.archive_master_items(uuid[],text) to authenticated;
grant execute on function public.restore_master_items(uuid[]) to authenticated;
