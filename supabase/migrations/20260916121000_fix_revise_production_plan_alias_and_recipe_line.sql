create or replace function public.revise_production_plan(p_production_batch_id uuid, p_recipe_version_id uuid default null::uuid, p_additional_ingredients jsonb default '[]'::jsonb, p_permanent_recipe_change boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid:=auth.uid();
  b record;
  v_rv record;
  oldrv record;
  line record;
  x jsonb;
  v_selected uuid;
  v_expected numeric;
  v_plan numeric;
  v_avail numeric;
  v_ing uuid;
  v_qty numeric;
  v_unit uuid;
  v_seq int;
  v_new uuid;
  v_next int;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_additional_ingredients)<>'array' then raise exception 'Additional ingredients must be an array'; end if;

  select * into b from public.production_batches where id=p_production_batch_id for update;
  if b.id is null then raise exception 'Production batch not found'; end if;
  if b.status<>'planned' or b.wife_approval_status<>'pending' then raise exception 'Recipe or ingredient changes are allowed only while wife approval is pending'; end if;

  v_selected:=coalesce(p_recipe_version_id,b.recipe_version_id);
  select rv.*,r.name recipe_name,r.output_item_id,r.status recipe_status
    into v_rv
    from public.recipe_versions rv
    join public.recipes r on r.id=rv.recipe_id
   where rv.id=v_selected and rv.status='active' and r.status='active';
  if v_rv.id is null then raise exception 'Selected recipe version is not active'; end if;
  if v_rv.output_item_id<>b.output_item_id or v_rv.output_unit_id<>b.output_unit_id then raise exception 'Selected recipe output must match this production batch'; end if;

  update public.stock_reservations set status='released',updated_at=now() where production_batch_id=b.id and status='active';
  delete from public.production_batch_plan_lines where production_batch_id=b.id;

  if p_permanent_recipe_change then
    select * into oldrv from public.recipe_versions where id=v_selected;
    select coalesce(max(version_number),0)+1 into v_next from public.recipe_versions where recipe_id=oldrv.recipe_id;
    insert into public.recipe_versions(recipe_id,version_number,expected_output_quantity,output_unit_id,notes,status,effective_from,created_by)
    values(oldrv.recipe_id,v_next,oldrv.expected_output_quantity,oldrv.output_unit_id,coalesce(oldrv.notes,'')||' | revised from production plan','active',current_date,v_user)
    returning id into v_new;
    insert into public.recipe_lines(recipe_version_id,ingredient_item_id,quantity,unit_id,sequence_number,notes)
      select v_new,ingredient_item_id,quantity,unit_id,sequence_number,notes
      from public.recipe_lines where recipe_version_id=v_selected;
    update public.recipe_versions set status='inactive' where id=v_selected;
    v_selected:=v_new;
  end if;

  update public.production_batches set recipe_version_id=v_selected,updated_at=now() where id=b.id;
  select expected_output_quantity into v_expected from public.recipe_versions where id=v_selected;
  v_plan:=b.planned_output_quantity;
  if v_plan<=0 or v_expected<=0 then raise exception 'Production target and recipe expected output must be greater than zero'; end if;

  for line in select id,ingredient_item_id,quantity,unit_id from public.recipe_lines where recipe_version_id=v_selected order by sequence_number,id loop
    insert into public.production_batch_plan_lines(production_batch_id,recipe_line_id,ingredient_item_id,planned_quantity,unit_id)
    values(b.id,line.id,line.ingredient_item_id,line.quantity*(v_plan/v_expected),line.unit_id);
  end loop;

  v_seq:=coalesce((select max(sequence_number) from public.recipe_lines where recipe_version_id=v_selected),0)+1;
  for x in select value from jsonb_array_elements(p_additional_ingredients) loop
    v_ing:=nullif(x->>'ingredient_item_id','')::uuid;
    v_qty:=(x->>'quantity')::numeric;
    v_unit:=nullif(x->>'unit_id','')::uuid;
    if v_ing is null or v_qty is null or v_qty<=0 or v_unit is null then raise exception 'Additional ingredient needs item, quantity and unit'; end if;
    if p_permanent_recipe_change then
      insert into public.recipe_lines(recipe_version_id,ingredient_item_id,quantity,unit_id,sequence_number,notes)
      values(v_selected,v_ing,(v_qty*v_expected/v_plan),v_unit,v_seq,'Added from production plan')
      returning id into v_new;
      insert into public.production_batch_plan_lines(production_batch_id,recipe_line_id,ingredient_item_id,planned_quantity,unit_id)
      values(b.id,v_new,v_ing,v_qty*(v_plan/v_expected),v_unit);
      v_seq:=v_seq+1;
    else
      insert into public.production_batch_plan_lines(production_batch_id,recipe_line_id,ingredient_item_id,planned_quantity,unit_id)
      values(b.id,null,v_ing,v_qty,v_unit);
    end if;
  end loop;

  for line in select ingredient_item_id,unit_id,sum(planned_quantity) planned_quantity
                from public.production_batch_plan_lines where production_batch_id=b.id group by ingredient_item_id,unit_id loop
    select greatest(0,
      coalesce(sum(ib.quantity_remaining),0)-
      coalesce((select sum(sr.quantity_reserved) from public.stock_reservations sr
                where sr.item_id=line.ingredient_item_id and sr.status='active' and sr.production_batch_id<>b.id),0)
    ) into v_avail
    from public.inventory_batches ib
    where ib.item_id=line.ingredient_item_id and ib.status='active' and ib.quantity_remaining>0;
    if v_avail<line.planned_quantity then raise exception 'Insufficient ingredient stock; need %, available %',line.planned_quantity,v_avail; end if;
    insert into public.stock_reservations(order_id,item_id,quantity_reserved,unit_id,status,reserved_at,created_by,production_batch_id)
    values(b.order_id,line.ingredient_item_id,line.planned_quantity,line.unit_id,'active',now(),v_user,b.id);
  end loop;

  perform public.record_audit_event('production.plan.revised','production_batch',b.id,
    jsonb_build_object('recipe_version_id',v_selected,'permanent_recipe_change',p_permanent_recipe_change,'additional_ingredients',p_additional_ingredients),'application');
  return jsonb_build_object('production_batch_id',b.id,'recipe_version_id',v_selected,'status','planned','permanent_recipe_change',p_permanent_recipe_change);
end;
$function$;
