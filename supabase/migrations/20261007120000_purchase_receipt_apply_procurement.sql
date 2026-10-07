-- Purchase receipt posts inventory (existing) and now auto-applies accepted stock
-- to open Material Indent / order_line_procurement_requirements, creates reservations,
-- and releases pending_procurement when shortfall is covered.

create or replace function public.apply_received_stock_to_open_procurement(
  p_item_id uuid,
  p_quantity numeric,
  p_unit_id uuid,
  p_user uuid,
  p_purchase_id uuid,
  p_receipt_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining numeric := greatest(0, coalesce(p_quantity, 0));
  v_req record;
  v_take numeric;
  v_closed int := 0;
  v_reserved numeric := 0;
  v_batch_ids uuid[] := array[]::uuid[];
begin
  if v_remaining <= 0 then
    return jsonb_build_object('applied', 0, 'closed', 0);
  end if;

  for v_req in
    select q.*
    from public.order_line_procurement_requirements q
    where q.ingredient_item_id = p_item_id
      and q.status = 'open'
      and q.shortfall_quantity > 0
    order by
      case when q.priority = 'urgent' then 0 else 1 end,
      q.created_at nulls last,
      q.id
    for update
  loop
    exit when v_remaining <= 0;
    v_take := least(v_remaining, v_req.shortfall_quantity);
    if v_take <= 0 then
      continue;
    end if;

    update public.order_line_procurement_requirements
    set
      available_quantity = coalesce(available_quantity, 0) + v_take,
      shortfall_quantity = greatest(0, shortfall_quantity - v_take),
      status = case when shortfall_quantity - v_take <= 0 then 'closed' else status end,
      notes = coalesce(notes, '') || format(
        ' | Stock applied from purchase %s receipt %s (+%s)',
        p_purchase_id::text, p_receipt_id::text, v_take
      ),
      updated_at = now()
    where id = v_req.id;

    insert into public.stock_reservations(
      order_id, order_line_id, item_id, quantity_reserved, unit_id,
      status, reserved_at, created_by, production_batch_id
    ) values (
      v_req.order_id, v_req.order_line_id, p_item_id, v_take, coalesce(p_unit_id, v_req.unit_id),
      'active', now(), p_user, v_req.production_batch_id
    );

    v_remaining := v_remaining - v_take;
    v_reserved := v_reserved + v_take;
    if v_req.production_batch_id is not null then
      v_batch_ids := array_append(v_batch_ids, v_req.production_batch_id);
    end if;
    if (v_req.shortfall_quantity - v_take) <= 0 then
      v_closed := v_closed + 1;
    end if;
  end loop;

  if cardinality(v_batch_ids) > 0 then
    update public.production_batches pb
    set wife_approval_status = 'pending', updated_at = now()
    where pb.id = any(v_batch_ids)
      and pb.wife_approval_status = 'pending_procurement'
      and not exists (
        select 1 from public.order_line_procurement_requirements q
        where q.production_batch_id = pb.id and q.status = 'open' and q.shortfall_quantity > 0
      );

    update public.order_lines ol
    set
      production_approval_status = 'pending',
      production_block_reason = null,
      updated_at = now()
    where ol.id in (
      select distinct q.order_line_id
      from public.order_line_procurement_requirements q
      where q.production_batch_id = any(v_batch_ids)
    )
    and not exists (
      select 1 from public.order_line_procurement_requirements q2
      where q2.order_line_id = ol.id and q2.status = 'open' and q2.shortfall_quantity > 0
    )
    and ol.production_approval_status = 'pending_procurement';
  end if;

  return jsonb_build_object(
    'applied', p_quantity - v_remaining,
    'closed', v_closed,
    'reserved', v_reserved
  );
end;
$$;

revoke all on function public.apply_received_stock_to_open_procurement(uuid, numeric, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.apply_received_stock_to_open_procurement(uuid, numeric, uuid, uuid, uuid, uuid) to authenticated, service_role;

create or replace function public.receive_purchase(
  p_purchase_id uuid,
  p_lines jsonb,
  p_received_at timestamptz default now()
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_receipt_id uuid := public.gen_random_uuid();
  v_user uuid := auth.uid();
  v_line jsonb;
  v_purchase_line public.purchase_lines%rowtype;
  v_received numeric;
  v_accepted numeric;
  v_rejected numeric;
  v_replacement numeric;
  v_batch_id uuid;
  v_outcome text;
  v_count int := 0;
  v_workflow text;
  v_received_batch_date date;
  v_apply jsonb;
  v_total_applied numeric := 0;
  v_total_closed int := 0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select workflow_status into v_workflow from public.purchases where id = p_purchase_id for update;
  if v_workflow is null then raise exception 'Purchase not found'; end if;
  if exists (
    select 1 from public.purchase_receipts
    where purchase_id = p_purchase_id and status not in ('cancelled')
  ) then
    raise exception 'Purchase already has a receipt. Inventory was already posted for this purchase.';
  end if;

  insert into public.purchase_receipts(id, purchase_id, received_at, received_by, status)
  values (v_receipt_id, p_purchase_id, coalesce(p_received_at, now()), v_user, 'received');

  for v_line in select * from jsonb_array_elements(p_lines) loop
    select * into v_purchase_line
    from public.purchase_lines
    where id = (v_line->>'purchase_line_id')::uuid and purchase_id = p_purchase_id;
    if not found then
      raise exception 'Purchase line not found: %', v_line->>'purchase_line_id';
    end if;

    v_received := greatest(0, coalesce((v_line->>'received_quantity')::numeric, 0));
    v_accepted := greatest(0, coalesce((v_line->>'accepted_quantity')::numeric, 0));
    v_rejected := greatest(0, coalesce((v_line->>'rejected_quantity')::numeric, v_received - v_accepted));
    v_replacement := greatest(0, coalesce((v_line->>'replacement_quantity')::numeric, 0));
    v_received_batch_date := coalesce(
      (v_line->>'received_batch_date')::date,
      coalesce(p_received_at, now())::date
    );

    if v_received <= 0 then
      raise exception 'Received quantity must be greater than zero for purchase line %', v_purchase_line.id;
    end if;
    if v_received < v_accepted + v_rejected then
      raise exception 'Accepted + rejected exceeds received for purchase line %', v_purchase_line.id;
    end if;

    insert into public.purchase_receipt_lines(
      id, receipt_id, purchase_line_id, received_quantity, accepted_quantity,
      rejected_quantity, replacement_quantity, unit_id, received_batch_date,
      expiry_date, best_before_date, notes
    ) values (
      public.gen_random_uuid(), v_receipt_id, v_purchase_line.id, v_received, v_accepted,
      v_rejected, v_replacement, v_purchase_line.unit_id, v_received_batch_date,
      (v_line->>'expiry_date')::date, (v_line->>'best_before_date')::date, v_line->>'notes'
    );

    if v_accepted > 0 then
      v_batch_id := public.gen_random_uuid();
      insert into public.inventory_batches(
        id, item_id, source_type, source_id, source_line_id, batch_date,
        quantity_received, quantity_remaining, unit_id, unit_cost,
        expiry_date, best_before_date, status
      ) values (
        v_batch_id, v_purchase_line.item_id, 'purchase_receipt', v_receipt_id, v_purchase_line.id,
        v_received_batch_date, v_accepted, v_accepted, v_purchase_line.unit_id, v_purchase_line.unit_rate,
        (v_line->>'expiry_date')::date, (v_line->>'best_before_date')::date, 'active'
      );
      insert into public.inventory_transactions(
        item_id, batch_id, transaction_type, quantity, unit_id, occurred_at,
        reference_type, reference_id, reference_line_id, unit_cost, notes, created_by
      ) values (
        v_purchase_line.item_id, v_batch_id, 'purchase_receipt', v_accepted, v_purchase_line.unit_id,
        coalesce(p_received_at, now()), 'purchase_receipt', v_receipt_id, v_purchase_line.id,
        v_purchase_line.unit_rate, 'Accepted purchase receipt', v_user
      );

      v_apply := public.apply_received_stock_to_open_procurement(
        v_purchase_line.item_id,
        v_accepted,
        v_purchase_line.unit_id,
        v_user,
        p_purchase_id,
        v_receipt_id
      );
      v_total_applied := v_total_applied + coalesce((v_apply->>'applied')::numeric, 0);
      v_total_closed := v_total_closed + coalesce((v_apply->>'closed')::int, 0);
    end if;

    v_count := v_count + 1;
    v_outcome := case
      when v_accepted = 0 then 'returned'
      when v_accepted < v_received then 'partially_accepted'
      else 'accepted'
    end;
    insert into public.purchase_inspections(receipt_id, purchase_line_id, inspected_at, inspected_by, outcome, notes)
    values (v_receipt_id, v_purchase_line.id, coalesce(p_received_at, now()), v_user, v_outcome, v_line->>'inspection_notes');
  end loop;

  if v_count = 0 then raise exception 'At least one receipt line is required'; end if;

  update public.purchase_receipts set status = 'inspected_stock' where id = v_receipt_id;
  update public.purchases set workflow_status = 'inspected_stock', updated_at = now() where id = p_purchase_id;

  perform public.record_audit_event(
    'purchase.received',
    'purchase',
    p_purchase_id,
    jsonb_build_object(
      'receipt_id', v_receipt_id,
      'lines', v_count,
      'procurement_applied', v_total_applied,
      'procurement_closed', v_total_closed
    ),
    'application'
  );

  return jsonb_build_object(
    'receipt_id', v_receipt_id,
    'purchase_id', p_purchase_id,
    'status', 'inspected_stock',
    'procurement_applied', v_total_applied,
    'procurement_closed', v_total_closed
  );
end;
$$;

revoke all on function public.receive_purchase(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.receive_purchase(uuid, jsonb, timestamptz) to authenticated, service_role;

comment on function public.receive_purchase(uuid, jsonb, timestamptz) is
  'Posts accepted stock to inventory_batches and auto-applies qty to open order procurement (Material Indent), reserves stock, releases pending_procurement when covered.';
