create or replace function public.complete_production_with_learning(p_production_batch_id uuid,p_consumptions jsonb,p_outputs jsonb,p_variance_mode text default 'one_time') returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_output numeric;
begin
if p_variance_mode not in ('one_time','permanent') then raise exception 'Invalid variance treatment'; end if;
select coalesce(sum((x.value->>'quantity')::numeric),0) into v_output from jsonb_array_elements(p_outputs) x;
if p_variance_mode='permanent' then perform public.save_actuals_as_recipe_version(p_production_batch_id,p_consumptions,v_output); end if;
return public.complete_production(p_production_batch_id,p_consumptions,p_outputs);
end;$function$;
revoke all on function public.complete_production_with_learning(uuid,jsonb,jsonb,text) from public,anon;
grant execute on function public.complete_production_with_learning(uuid,jsonb,jsonb,text) to authenticated;
