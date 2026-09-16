-- Phase 4 purchase return / damage flow.
-- A rejected receipt quantity never enters inventory.
-- A later return of accepted stock removes physical stock through FIFO.
-- Every supplier return stays linked to the original purchase and is auditable.

alter table public.purchase_return_lines
  add column if not exists return_source text not null default 'accepted_stock';

alter table public.purchase_return_lines
  drop constraint if exists purchase_return_lines_source_chk;

alter table public.purchase_return_lines
  add constraint purchase_return_lines_source_chk
  check (return_source in ('rejected_receipt','accepted_stock'));

create index if not exists purchase_return_lines_purchase_line_idx
  on public.purchase_return_lines(purchase_line_id);

create or replace function public.record_supplier_return(
  p_purchase_id uuid,
  p_return_date date,
  p_reason text,
  p_lines jsonb,
  p_credit_amount numeric default 0,
  p_supplier_agreed boolean default true,
  p_notes text default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_return_id uuid := public.gen_random_uuid();
  v_supplier_id uuid;
  v_line jsonb;
  v_purchase_line public.purchase_lines%rowtype;
  v_qty numeric;
  v_source text;
  v_available numeric;
  v_remaining numeric;
  v_batch public.inventory_batches%rowtype;
  v_take numeric;
  v_count int := 0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if coalesce(jsonb_array_length(p_lines),0) = 0 then raise exception 'At least one return item is required'; end if;
  if coalesce(p_credit_amount,0) < 0 then raise exception 'Credit amount cannot be negative'; end if;

  select supplier_id into v_supplier_id
  from public.purchases
  where id = p_purchase_id
  for update;
  if v_supplier_id is null then raise exception 'Purchase not found'; end if;

  insert into public.purchase_returns(
    id,business_code,purchase_id,return_date,reason,status,supplier_agreed,credit_amount,notes,created_by
  ) values (
    v_return_id,null,p_purchase_id,coalesce(p_return_date,current_date),nullif(trim(coalesce(p_reason,'')),''),
    'completed',p_supplier_agreed,coalesce(p_credit_amount,0),nullif(trim(coalesce(p_notes,'')),''),v_user
  );

  for v_line in select * from jsonb_array_elements(p_lines) loop
    select * into v_purchase_line
    from public.purchase_lines
    where id = (v_line->>'purchase_line_id')::uuid
      and purchase_id = p_purchase_id
    for update;
    if not found then raise exception 'Purchase line not found'; end if;

    v_qty := greatest(0,coalesce((v_line->>'quantity')::numeric,0));
    v_source := coalesce(v_line->>'return_source','accepted_stock');
    if v_qty <= 0 then raise exception 'Return quantity must be greater than zero'; end if;
    if v_source not in ('rejected_receipt','accepted_stock') then raise exception 'Invalid return source'; end if;

    if v_source = 'rejected_receipt' then
      select greatest(0,
        coalesce(sum(rl.rejected_quantity),0) -
        coalesce((select sum(prl.quantity) from public.purchase_return_lines prl
                  join public.purchase_returns pr on pr.id=prl.purchase_return_id
                  where prl.purchase_line_id=v_purchase_line.id
                    and pr.status <> 'cancelled'
                    and prl.return_source='rejected_receipt'),0)
      ) into v_available
      from public.purchase_receipt_lines rl
      where rl.purchase_line_id = v_purchase_line.id;
    else
      select greatest(0,coalesce(sum(b.quantity_remaining),0)) into v_available
      from public.inventory_batches b
      where b.item_id=v_purchase_line.item_id and b.status='active';
      -- Do not allow a supplier return to create negative physical stock.
      -- The returned quantity is removed FIFO below.
    end if;

    if v_qty > coalesce(v_available,0) then
      raise exception 'Return quantity for this item exceeds the quantity available to return';
    end if;

    insert into public.purchase_return_lines(
      id,purchase_return_id,purchase_line_id,quantity,unit_id,reason,return_source
    ) values (
      public.gen_random_uuid(),v_return_id,v_purchase_line.id,v_qty,v_purchase_line.unit_id,
      nullif(trim(coalesce(v_line->>'reason','')),''),v_source
    );

    if v_source='accepted_stock' then
      v_remaining := v_qty;
      for v_batch in
        select * from public.inventory_batches
        where item_id=v_purchase_line.item_id and status='active' and quantity_remaining>0
        order by batch_date,created_at,id
        for update
      loop
        exit when v_remaining <= 0;
        v_take := least(v_remaining,v_batch.quantity_remaining);
        update public.inventory_batches
          set quantity_remaining=quantity_remaining-v_take,
              status=case when quantity_remaining-v_take=0 then 'depleted' else status end,
              updated_at=now()
        where id=v_batch.id;
        insert into public.inventory_transactions(
          item_id,batch_id,transaction_type,quantity,unit_id,occurred_at,reference_type,reference_id,reference_line_id,unit_cost,notes,created_by
        ) values (
          v_purchase_line.item_id,v_batch.id,'supplier_return',-v_take,v_batch.unit_id,now(),
          'purchase_return',v_return_id,v_purchase_line.id,v_batch.unit_cost,'Supplier return',v_user
        );
        v_remaining := v_remaining-v_take;
      end loop;
      if v_remaining>0 then raise exception 'Unable to complete supplier return from available stock'; end if;
    end if;

    v_count := v_count+1;
  end loop;

  update public.purchases
    set workflow_status=case when coalesce((select sum(prl.quantity) from public.purchase_return_lines prl join public.purchase_returns pr on pr.id=prl.purchase_return_id where pr.purchase_id=p_purchase_id and pr.status<>'cancelled'),0)>0 then 'partial_returned' else workflow_status end,
        updated_at=now()
  where id=p_purchase_id;

  if coalesce(p_credit_amount,0)>0 then
    insert into public.supplier_adjustments(
      id,supplier_id,purchase_id,purchase_return_id,adjustment_date,adjustment_type,amount,notes,created_by
    ) values (
      public.gen_random_uuid(),v_supplier_id,p_purchase_id,v_return_id,coalesce(p_return_date,current_date),
      'credit',p_credit_amount,'Supplier credit for purchase return',v_user
    );
  end if;

  perform public.record_audit_event(
    'purchase.return.completed','purchase',p_purchase_id,
    jsonb_build_object('purchase_return_id',v_return_id,'lines',v_count,'credit_amount',coalesce(p_credit_amount,0)),
    'application'
  );

  return jsonb_build_object('purchase_return_id',v_return_id,'purchase_id',p_purchase_id,'lines',v_count,'credit_amount',coalesce(p_credit_amount,0),'status','completed');
end;
$$;

revoke all on function public.record_supplier_return(uuid,date,text,jsonb,numeric,boolean,text) from public,anon;
grant execute on function public.record_supplier_return(uuid,date,text,jsonb,numeric,boolean,text) to authenticated;
