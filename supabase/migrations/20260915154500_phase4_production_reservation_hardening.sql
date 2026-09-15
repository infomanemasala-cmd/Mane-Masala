-- Phase 4 production integrity hardening.
-- Completing a production batch must not leave unused ingredient reservations active.
-- Production outputs must match the batch's planned output item/unit so order-line
-- produced quantities cannot be polluted by unrelated output items.

create or replace function public.complete_production(p_production_batch_id uuid,p_consumptions jsonb,p_outputs jsonb)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
 v_user uuid:=auth.uid();
 r record;
 b record;
 v_need numeric;
 v_take numeric;
 v_batch_id uuid;
 v_order_id uuid;
 v_order_line_id uuid;
 v_planned numeric;
 v_status text;
 v_approval text;
 v_available numeric;
 v_other_reserved numeric;
 v_consumed numeric;
 v_res record;
 v_output_item_id uuid;
 v_output_unit_id uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select status,wife_approval_status,order_id,order_line_id,output_item_id,output_unit_id
   into v_status,v_approval,v_order_id,v_order_line_id,v_output_item_id,v_output_unit_id
   from public.production_batches where id=p_production_batch_id for update;
 if v_status is null then raise exception 'Production batch not found'; end if;
 if v_status='completed' then raise exception 'Production batch already completed'; end if;
 if v_approval<>'approved' then raise exception 'Production batch not approved'; end if;
 if v_status not in ('planned','in_progress') then raise exception 'Production batch cannot be completed from status %',v_status; end if;
 if jsonb_typeof(p_consumptions)<>'array' then raise exception 'Production consumptions must be an array'; end if;
 if jsonb_typeof(p_outputs)<>'array' then raise exception 'Production outputs must be an array'; end if;

 for r in select * from jsonb_to_recordset(p_consumptions) as x(ingredient_item_id uuid,actual_quantity numeric,unit_id uuid) loop
   v_need:=r.actual_quantity;
   if v_need is null or v_need<=0 then continue; end if;
   select coalesce(sum(ib.quantity_remaining),0) into v_available
     from public.inventory_batches ib
     where ib.item_id=r.ingredient_item_id and ib.status='active' and ib.quantity_remaining>0;
   select coalesce(sum(sr.quantity_reserved),0) into v_other_reserved
     from public.stock_reservations sr
     where sr.item_id=r.ingredient_item_id and sr.status='active' and sr.production_batch_id<>p_production_batch_id;
   if v_need>greatest(0,v_available-v_other_reserved) then
     raise exception 'Insufficient available ingredient stock for %; requested %, available %',r.ingredient_item_id,v_need,greatest(0,v_available-v_other_reserved);
   end if;
   select coalesce(sum(pl.planned_quantity),0) into v_planned
     from public.production_batch_plan_lines pl
     where pl.production_batch_id=p_production_batch_id and pl.ingredient_item_id=r.ingredient_item_id;
   v_consumed:=0;
   for b in select ib.id,ib.quantity_remaining,ib.unit_id,ib.unit_cost
     from public.inventory_batches ib
     where ib.item_id=r.ingredient_item_id and ib.status='active' and ib.quantity_remaining>0
     order by ib.batch_date,ib.created_at,ib.id for update loop
     exit when v_need<=0;
     if b.unit_id<>r.unit_id then raise exception 'Unit mismatch for ingredient %',r.ingredient_item_id; end if;
     v_take:=least(v_need,b.quantity_remaining);
     update public.inventory_batches set quantity_remaining=quantity_remaining-v_take,status=case when quantity_remaining-v_take<=0 then 'depleted' else status end,updated_at=now() where id=b.id;
     insert into public.inventory_transactions(item_id,batch_id,transaction_type,quantity,unit_id,occurred_at,reference_type,reference_id,unit_cost,notes,created_by)
       values(r.ingredient_item_id,b.id,'production_consumption',-v_take,r.unit_id,current_date,'production_batch',p_production_batch_id,b.unit_cost,'Production consumption',v_user);
     insert into public.production_consumption(production_batch_id,ingredient_item_id,planned_quantity,actual_quantity,unit_id,batch_id,consumption_date,one_time_variance,recipe_change_requested)
       values(p_production_batch_id,r.ingredient_item_id,nullif(v_planned,0),v_take,r.unit_id,b.id,current_date,(v_planned>0 and abs(v_take-v_planned)>0.000001),false);
     v_need:=v_need-v_take;
     v_consumed:=v_consumed+v_take;
   end loop;
   if v_need>0 then raise exception 'Insufficient stock after FIFO consumption for ingredient %; short by %',r.ingredient_item_id,v_need; end if;
   for v_res in select id,quantity_reserved from public.stock_reservations
     where production_batch_id=p_production_batch_id and item_id=r.ingredient_item_id and status='active'
     order by reserved_at,id for update loop
     exit when v_consumed<=0;
     v_take:=least(v_consumed,v_res.quantity_reserved);
     if v_take>=v_res.quantity_reserved then
       update public.stock_reservations set status='consumed',consumed_at=now(),updated_at=now() where id=v_res.id;
     else
       update public.stock_reservations set quantity_reserved=quantity_reserved-v_take,updated_at=now() where id=v_res.id;
     end if;
     v_consumed:=v_consumed-v_take;
   end loop;
 end loop;

 -- Any planned reservation not consumed by actual production is released.
 update public.stock_reservations
   set status='released',updated_at=now()
   where production_batch_id=p_production_batch_id and status='active';

 for r in select * from jsonb_to_recordset(p_outputs) as x(output_item_id uuid,quantity numeric,unit_id uuid,unit_cost numeric) loop
   if r.quantity is null or r.quantity<=0 then continue; end if;
   if r.output_item_id<>v_output_item_id then
     raise exception 'Production output item must match the production batch output item';
   end if;
   if r.unit_id<>v_output_unit_id then
     raise exception 'Production output unit must match the production batch output unit';
   end if;
   v_batch_id:=gen_random_uuid();
   insert into public.inventory_batches(id,item_id,source_type,source_id,source_line_id,batch_date,quantity_received,quantity_remaining,unit_id,unit_cost,status)
     values(v_batch_id,r.output_item_id,'production_output',p_production_batch_id,v_order_line_id,current_date,r.quantity,r.quantity,r.unit_id,r.unit_cost,'active');
   insert into public.production_outputs(production_batch_id,output_item_id,quantity,unit_id,output_date,batch_id)
     values(p_production_batch_id,r.output_item_id,r.quantity,r.unit_id,current_date,v_batch_id);
   insert into public.inventory_transactions(item_id,batch_id,transaction_type,quantity,unit_id,occurred_at,reference_type,reference_id,unit_cost,notes,created_by)
     values(r.output_item_id,v_batch_id,'production_output',r.quantity,r.unit_id,current_date,'production_batch',p_production_batch_id,r.unit_cost,'Production output',v_user);
 end loop;

 update public.production_batches set status='completed',actual_output_quantity=coalesce((select sum(quantity) from public.production_outputs where production_batch_id=p_production_batch_id),0),updated_at=now() where id=p_production_batch_id;
 if v_order_line_id is not null then
   update public.order_lines set produced_quantity=coalesce(produced_quantity,0)+coalesce((select sum(quantity) from public.production_outputs where production_batch_id=p_production_batch_id),0),updated_at=now() where id=v_order_line_id;
 end if;
 if v_order_id is not null and not exists(select 1 from public.production_batches pb where pb.order_id=v_order_id and pb.status not in ('completed','cancelled')) and not exists(select 1 from public.order_lines ol where ol.order_id=v_order_id and coalesce(ol.reserved_quantity,0)+coalesce(ol.produced_quantity,0)<ol.ordered_quantity) then
   update public.orders set status='ready',updated_at=now() where id=v_order_id and status in ('confirmed','in_production');
 end if;
 perform public.record_audit_event('production.completed','production_batch',p_production_batch_id,jsonb_build_object('order_id',v_order_id,'order_line_id',v_order_line_id),'application');
 return jsonb_build_object('production_batch_id',p_production_batch_id,'status','completed');
end;
$$;

grant execute on function public.complete_production(uuid,jsonb,jsonb) to authenticated;
