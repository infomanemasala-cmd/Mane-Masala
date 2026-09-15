create or replace function public.save_actuals_as_recipe_version(p_production_batch_id uuid,p_consumptions jsonb,p_actual_output numeric) returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_user uuid:=auth.uid(); b record; oldrv record; x record; v_next int; v_new uuid; v_qty numeric; v_seq int:=1; v_scale numeric;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_actual_output is null or p_actual_output<=0 then raise exception 'Actual output must be greater than zero'; end if;
 if jsonb_typeof(p_consumptions)<>'array' then raise exception 'Production consumptions must be an array'; end if;
 select * into b from public.production_batches where id=p_production_batch_id for update;
 if b.id is null then raise exception 'Production batch not found'; end if;
 if b.status<>'completed' or b.wife_approval_status<>'approved' then raise exception 'Recipe learning requires a completed, approved production batch'; end if;
 select * into oldrv from public.recipe_versions where id=b.recipe_version_id;
 if oldrv.id is null then raise exception 'Recipe version not found'; end if;
 select coalesce(max(version_number),0)+1 into v_next from public.recipe_versions where recipe_id=oldrv.recipe_id;
 insert into public.recipe_versions(recipe_id,version_number,expected_output_quantity,output_unit_id,notes,status,effective_from,created_by) values(oldrv.recipe_id,v_next,oldrv.expected_output_quantity,oldrv.output_unit_id,coalesce(oldrv.notes,'')||' | learned from actual production batch '||coalesce(b.id::text,''),'active',current_date,v_user) returning id into v_new;
 for x in select ingredient_item_id,unit_id,sum(actual_quantity) actual_quantity from jsonb_to_recordset(p_consumptions) as z(ingredient_item_id uuid,actual_quantity numeric,unit_id uuid) where actual_quantity>0 group by ingredient_item_id,unit_id order by ingredient_item_id loop
  v_scale:=oldrv.expected_output_quantity/p_actual_output;
  v_qty:=x.actual_quantity*v_scale;
  insert into public.recipe_lines(recipe_version_id,ingredient_item_id,quantity,unit_id,sequence_number,notes) values(v_new,x.ingredient_item_id,v_qty,x.unit_id,v_seq,'Learned from actual production');
  v_seq:=v_seq+1;
 end loop;
 if v_seq=1 then raise exception 'At least one actual ingredient is required'; end if;
 update public.recipe_versions set status='inactive' where id=oldrv.id;
 update public.production_batches set recipe_version_id=v_new,updated_at=now() where id=b.id;
 perform public.record_audit_event('production.recipe.learned','production_batch',b.id,jsonb_build_object('new_recipe_version_id',v_new,'actual_output',p_actual_output),'application');
 return jsonb_build_object('recipe_version_id',v_new,'version_number',v_next,'recipe_id',oldrv.recipe_id);
end;
$$;
