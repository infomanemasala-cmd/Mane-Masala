-- Mane Masala Masters & Settings: recipe code wiring
BEGIN;

INSERT INTO public.id_sequences(sequence_key,prefix,next_number,width)
VALUES('recipe','REC-',1,3)
ON CONFLICT (sequence_key) DO NOTHING;

UPDATE public.id_sequences
SET next_number = GREATEST(next_number, COALESCE((SELECT max((substring(business_code from 5))::bigint)+1 FROM public.recipes WHERE business_code ~ '^REC-[0-9]+$'),1)),
    prefix='REC-', width=3, updated_at=now()
WHERE sequence_key='recipe';

WITH missing AS (
  SELECT id, row_number() over (order by created_at,id) AS rn
  FROM public.recipes WHERE business_code IS NULL
)
UPDATE public.recipes r
SET business_code='REC-' || lpad((s.next_number - 1 + missing.rn)::text,3,'0'), updated_at=now()
FROM missing, public.id_sequences s
WHERE r.id=missing.id AND s.sequence_key='recipe';

UPDATE public.id_sequences
SET next_number=GREATEST(next_number,(SELECT COALESCE(max((substring(business_code from 5))::bigint)+1,1) FROM public.recipes WHERE business_code ~ '^REC-[0-9]+$')),updated_at=now()
WHERE sequence_key='recipe';

CREATE OR REPLACE FUNCTION public.save_recipe_version(
  p_recipe_id uuid DEFAULT NULL::uuid,p_name text DEFAULT NULL::text,p_output_item_id uuid DEFAULT NULL::uuid,
  p_base_ingredient_item_id uuid DEFAULT NULL::uuid,p_expected_output_quantity numeric DEFAULT NULL::numeric,
  p_output_unit_id uuid DEFAULT NULL::uuid,p_lines jsonb DEFAULT '[]'::jsonb,p_notes text DEFAULT NULL::text,
  p_activate boolean DEFAULT true,p_effective_from date DEFAULT CURRENT_DATE
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare
  v_user uuid:=auth.uid(); v_recipe_id uuid:=p_recipe_id; v_version_id uuid; v_next int;
  v_name text; v_output_item uuid; v_line_count int; v_distinct_count int; v_business_code text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if coalesce(trim(p_name),'')='' then raise exception 'Recipe name is required'; end if;
  if p_output_item_id is null then raise exception 'Finished / output item is required'; end if;
  if p_base_ingredient_item_id is null then raise exception 'Choose one base raw material'; end if;
  if p_expected_output_quantity is null or p_expected_output_quantity<=0 then raise exception 'Expected finished output must be greater than zero'; end if;
  if p_output_unit_id is null then raise exception 'Output unit is required'; end if;
  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'Add at least one raw material to the recipe'; end if;
  select count(*),count(distinct nullif(value->>'ingredient_item_id','')::uuid) into v_line_count,v_distinct_count from jsonb_array_elements(p_lines);
  if v_line_count<>v_distinct_count then raise exception 'Each raw material should appear only once in a recipe version'; end if;
  if v_recipe_id is null then
    v_business_code:=public.generate_business_code('recipe');
    insert into public.recipes(business_code,output_item_id,name,status,notes,created_by)
    values(v_business_code,p_output_item_id,trim(p_name),case when p_activate then 'active' else 'draft' end,p_notes,v_user)
    returning id into v_recipe_id;
  else
    select name,output_item_id into v_name,v_output_item from public.recipes where id=v_recipe_id for update;
    if v_name is null then raise exception 'Recipe not found'; end if;
    if v_output_item<>p_output_item_id then raise exception 'A recipe cannot be changed to a different output item; create a new recipe instead'; end if;
    update public.recipes set name=trim(p_name),notes=p_notes,updated_at=now() where id=v_recipe_id;
    select business_code into v_business_code from public.recipes where id=v_recipe_id;
  end if;
  if not exists(select 1 from jsonb_array_elements(p_lines) x where nullif(x->>'ingredient_item_id','')::uuid=p_base_ingredient_item_id) then raise exception 'The selected base raw material must also be a recipe ingredient'; end if;
  if exists(select 1 from jsonb_to_recordset(p_lines) as x(ingredient_item_id uuid,quantity numeric,unit_id uuid)
    left join public.items i on i.id=x.ingredient_item_id
    where x.ingredient_item_id is null or x.quantity is null or x.quantity<=0 or x.unit_id is null
      or i.id is null or i.is_active is not true or i.can_be_used_in_production is not true or x.unit_id<>i.base_unit_id)
    then raise exception 'Every raw material must be active, production-usable, have a positive quantity, and use its standard base unit'; end if;
  if not exists(select 1 from public.items where id=p_output_item_id and is_active is true) then raise exception 'Output item is not active'; end if;
  if not exists(select 1 from public.units where id=p_output_unit_id and is_active is true) then raise exception 'Output unit is not active'; end if;
  select coalesce(max(version_number),0)+1 into v_next from public.recipe_versions where recipe_id=v_recipe_id;
  if p_activate then update public.recipe_versions set status='inactive' where recipe_id=v_recipe_id and status='active'; end if;
  insert into public.recipe_versions(recipe_id,version_number,expected_output_quantity,output_unit_id,base_ingredient_item_id,notes,status,effective_from,created_by)
  values(v_recipe_id,v_next,p_expected_output_quantity,p_output_unit_id,p_base_ingredient_item_id,p_notes,case when p_activate then 'active' else 'draft' end,p_effective_from,v_user)
  returning id into v_version_id;
  insert into public.recipe_lines(recipe_version_id,ingredient_item_id,quantity,unit_id,sequence_number,notes)
  select v_version_id,x.ingredient_item_id,x.quantity,x.unit_id,row_number() over(order by x.sequence_number nulls last,x.ingredient_item_id),x.notes
  from jsonb_to_recordset(p_lines) as x(ingredient_item_id uuid,quantity numeric,unit_id uuid,sequence_number int,notes text);
  if p_activate then update public.recipes set status='active',updated_at=now() where id=v_recipe_id; end if;
  perform public.record_audit_event('recipe.version.saved','recipe',v_recipe_id,jsonb_build_object('recipe_version_id',v_version_id,'version_number',v_next,'activated',p_activate,'base_ingredient_item_id',p_base_ingredient_item_id,'expected_output_quantity',p_expected_output_quantity),'application');
  return jsonb_build_object('recipe_id',v_recipe_id,'recipe_version_id',v_version_id,'version_number',v_next,'status',case when p_activate then 'active' else 'draft' end,'business_code',v_business_code);
end;
$function$;

REVOKE ALL ON FUNCTION public.save_recipe_version(uuid,text,uuid,uuid,numeric,uuid,jsonb,text,boolean,date) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.save_recipe_version(uuid,text,uuid,uuid,numeric,uuid,jsonb,text,boolean,date) TO authenticated,service_role;
COMMIT;