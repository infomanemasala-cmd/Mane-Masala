-- Mane Masala Phase 4 D4 Round 3
-- Supplier outstanding must remain financially visible when a purchase is
-- partially returned but still has an unpaid/partially-paid balance.
--
-- This source file records the narrowly scoped view correction already
-- present in LIVE migration version 20260917135835. It is intentionally
-- not a second live application of the same correction.

create or replace view public.v_supplier_outstanding as
with purchase_totals as (
  select
    p.id as purchase_id,
    p.supplier_id,
    greatest(
      0::numeric,
      coalesce(
        sum(coalesce(l.line_total, l.billed_quantity * coalesce(l.unit_rate, 0::numeric))),
        0::numeric
      )
      - coalesce(p.discount_amount, 0::numeric)
      + coalesce(p.delivery_charge, 0::numeric)
      + coalesce(p.transport_charge, 0::numeric)
      + coalesce(p.loading_charge, 0::numeric)
      + coalesce(p.unloading_charge, 0::numeric)
      + coalesce(p.packing_charge, 0::numeric)
      + coalesce(p.other_charge, 0::numeric)
      + coalesce(p.tax_amount, 0::numeric)
      - coalesce(adj.credits, 0::numeric)
    ) as payable,
    coalesce(pay.allocated, 0::numeric) as allocated
  from public.purchases p
  left join public.purchase_lines l on l.purchase_id = p.id
  left join (
    select
      supplier_adjustments.purchase_id,
      sum(supplier_adjustments.amount) as credits
    from public.supplier_adjustments
    where supplier_adjustments.adjustment_type = any (array['credit'::text, 'refund'::text])
    group by supplier_adjustments.purchase_id
  ) adj on adj.purchase_id = p.id
  left join (
    select
      supplier_payment_allocations.purchase_id,
      sum(supplier_payment_allocations.amount) as allocated
    from public.supplier_payment_allocations
    group by supplier_payment_allocations.purchase_id
  ) pay on pay.purchase_id = p.id
  where p.financial_status = any (array['unpaid'::text, 'partially_paid'::text])
  group by
    p.id,
    p.supplier_id,
    p.discount_amount,
    p.delivery_charge,
    p.transport_charge,
    p.loading_charge,
    p.unloading_charge,
    p.packing_charge,
    p.other_charge,
    p.tax_amount,
    adj.credits,
    pay.allocated
)
select
  s.id as supplier_id,
  s.business_code,
  s.business_name,
  coalesce(sum(greatest(0::numeric, pt.payable - pt.allocated)), 0::numeric) as outstanding
from public.suppliers s
left join purchase_totals pt on pt.supplier_id = s.id
group by s.id, s.business_code, s.business_name;
