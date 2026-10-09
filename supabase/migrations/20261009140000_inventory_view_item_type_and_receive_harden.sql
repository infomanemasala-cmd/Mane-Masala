-- 1) Inventory current view: expose item_type so UI can split tables
create or replace view public.v_inventory_current as
select
  i.id as item_id,
  i.business_code,
  i.name,
  i.item_type,
  i.base_unit_id,
  coalesce(sum(b.quantity_remaining), 0)::numeric as current_stock,
  coalesce((select sum(r.quantity_reserved) from public.stock_reservations r where r.item_id = i.id and r.status = 'active'), 0)::numeric as reserved_stock,
  (coalesce(sum(b.quantity_remaining), 0) - coalesce((select sum(r.quantity_reserved) from public.stock_reservations r where r.item_id = i.id and r.status = 'active'), 0))::numeric as available_stock,
  i.minimum_stock,
  i.is_active
from public.items i
left join public.inventory_batches b on b.item_id = i.id and b.status = 'active'
group by i.id, i.business_code, i.name, i.item_type, i.base_unit_id, i.minimum_stock, i.is_active;

grant select on public.v_inventory_current to authenticated, service_role;

-- 2) Harden receive_purchase: security definer + unit_id fallback when line unit is null
create or replace function public.receive_purchase(
  p_purchase_id uuid,
  p_lines jsonb,
  p_received_at timestamptz default now()
) returns jsonb
language plpgsql
security definer
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
  v_factor numeric;
  v_inventory_accepted numeric;
  v_base_unit_id uuid;
  v_unit_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select workflow_status into v_workflow
  from public.purchases
  where id = p_purchase_id
  for update;

  if v_workflow is null then raise exception 'Purchase not found'; end if;

  if exists (
    select 1 from public.purchase_receipts
    where purchase_id = p_purchase_id and status not in ('cancelled')
  ) then
    raise exception 'Purchase already has a receipt. Open the purchase again — if status is still Not received, cancel the empty/partial receipt first.';
  end if;

  insert into public.purchase_receipts(id, purchase_id, received_at, received_by, status)
  values (v_receipt_id, p_purchase_id, coalesce(p_received_at, now()), v_user, 'received');

  for v_line in select * from jsonb_array_elements(p_lines) loop
    select * into v_purchase_line
    from public.purchase_lines
    where id = (v_line->>'purchase_line_id')::uuid
      and purchase_id = p_purchase_id;

    if not found then
      raise exception 'Purchase line not found: %', v_line->>'purchase_line_id';
    end if;

    select base_unit_id,
           coalesce(v_purchase_line.unit_id, purchase_unit_id, base_unit_id)
      into v_base_unit_id, v_unit_id
    from public.items
    where id = v_purchase_line.item_id and is_active = true;

    if v_base_unit_id is null then
      raise exception 'Item has no base unit configured (Item Master). Cannot post stock.';
    end if;
    if v_unit_id is null then
      raise exception 'Purchase line has no unit and item has no purchase/base unit.';
    end if;

    -- If line unit was null, persist the resolved unit for audit
    if v_purchase_line.unit_id is null then
      update public.purchase_lines set unit_id = v_unit_id where id = v_purchase_line.id;
      v_purchase_line.unit_id := v_unit_id;
    end if;

    begin
      v_factor := public.purchase_to_base_factor(v_purchase_line.item_id, v_purchase_line.unit_id);
    exception when others then
      v_factor := 1;
    end;
    if v_factor is null or v_factor <= 0 then v_factor := 1; end if;

    v_received := greatest(0, coalesce((v_line->>'received_quantity')::numeric, 0));
    v_accepted := greatest(0, coalesce((v_line->>'accepted_quantity')::numeric, 0));
    v_rejected := greatest(0, coalesce((v_line->>'rejected_quantity')::numeric, v_received - v_accepted));
    v_replacement := greatest(0, coalesce((v_line->>'replacement_quantity')::numeric, 0));
    v_received_batch_date := coalesce((v_line->>'received_batch_date')::date, coalesce(p_received_at, now())::date);

    if v_received <= 0 then
      raise exception 'Received quantity must be greater than zero for a purchase line';
    end if;
    if v_received < v_accepted + v_rejected then
      raise exception 'Accepted + rejected exceeds received for a purchase line';
    end if;

    insert into public.purchase_receipt_lines(
      id, receipt_id, purchase_line_id, received_quantity, accepted_quantity,
      rejected_quantity, replacement_quantity, unit_id, received_batch_date,
      expiry_date, best_before_date, notes
    ) values (
      public.gen_random_uuid(), v_receipt_id, v_purchase_line.id,
      v_received, v_accepted, v_rejected, v_replacement, v_purchase_line.unit_id,
      v_received_batch_date,
      (v_line->>'expiry_date')::date, (v_line->>'best_before_date')::date,
      v_line->>'notes'
    );

    if v_accepted > 0 then
      v_inventory_accepted := v_accepted * v_factor;
      if v_inventory_accepted <= 0 then
        raise exception 'Converted accepted quantity must be greater than zero';
      end if;
      v_batch_id := public.gen_random_uuid();
      insert into public.inventory_batches(
        id, item_id, source_type, source_id, source_line_id, batch_date,
        quantity_received, quantity_remaining, unit_id, unit_cost,
        expiry_date, best_before_date, status
      ) values (
        v_batch_id, v_purchase_line.item_id, 'purchase_receipt', v_receipt_id, v_purchase_line.id,
        v_received_batch_date, v_inventory_accepted, v_inventory_accepted, v_base_unit_id,
        case when v_factor = 1 then v_purchase_line.unit_rate else v_purchase_line.unit_rate / v_factor end,
        (v_line->>'expiry_date')::date, (v_line->>'best_before_date')::date, 'active'
      );
      insert into public.inventory_transactions(
        item_id, batch_id, transaction_type, quantity, unit_id, occurred_at,
        reference_type, reference_id, reference_line_id, unit_cost, notes, created_by
      ) values (
        v_purchase_line.item_id, v_batch_id, 'purchase_receipt', v_inventory_accepted, v_base_unit_id,
        coalesce(p_received_at, now()), 'purchase_receipt', v_receipt_id, v_purchase_line.id,
        case when v_factor = 1 then v_purchase_line.unit_rate else v_purchase_line.unit_rate / v_factor end,
        'Accepted purchase receipt', v_user
      );
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

  begin
    perform public.record_audit_event(
      'purchase.received', 'purchase', p_purchase_id,
      jsonb_build_object('receipt_id', v_receipt_id, 'lines', v_count),
      'application'
    );
  exception when others then
    null; -- audit must not block stock post
  end;

  return jsonb_build_object(
    'receipt_id', v_receipt_id,
    'purchase_id', p_purchase_id,
    'status', 'inspected_stock',
    'lines', v_count
  );
end;
$$;

revoke all on function public.receive_purchase(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.receive_purchase(uuid, jsonb, timestamptz) to authenticated, service_role;
