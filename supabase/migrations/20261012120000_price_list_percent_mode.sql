-- Price list: fixed amount OR percent of item default_selling_rate

alter table public.item_customer_type_prices
  add column if not exists price_mode text not null default 'fixed',
  add column if not exists percent_of_default numeric;

-- Allow unit_price null when percent mode (computed at resolve time)
alter table public.item_customer_type_prices
  alter column unit_price drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'item_customer_type_prices_price_mode_chk'
  ) then
    alter table public.item_customer_type_prices
      add constraint item_customer_type_prices_price_mode_chk
      check (price_mode in ('fixed', 'percent'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'item_customer_type_prices_value_chk'
  ) then
    alter table public.item_customer_type_prices
      add constraint item_customer_type_prices_value_chk
      check (
        (price_mode = 'fixed' and unit_price is not null and unit_price >= 0)
        or
        (price_mode = 'percent' and percent_of_default is not null and percent_of_default > 0)
      );
  end if;
end $$;

comment on column public.item_customer_type_prices.price_mode is 'fixed = unit_price; percent = percent_of_default of items.default_selling_rate';
comment on column public.item_customer_type_prices.percent_of_default is 'When price_mode=percent, e.g. 90 means 90% of default_selling_rate (per kg)';

-- Resolve: customer-type row first (fixed or percent of default), else default_selling_rate. Always per-kg.
create or replace function public.resolve_item_selling_price(
  p_item_id uuid,
  p_customer_id uuid
) returns numeric
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_ct text;
  v_price numeric;
  v_basis text;
  v_mode text;
  v_pct numeric;
  v_pack numeric;
  v_default numeric;
begin
  select c.customer_type into v_ct from public.customers c where c.id = p_customer_id;

  select ict.unit_price, ict.rate_basis, coalesce(ict.price_mode, 'fixed'), ict.percent_of_default
    into v_price, v_basis, v_mode, v_pct
  from public.item_customer_type_prices ict
  where ict.item_id = p_item_id and ict.customer_type = v_ct and ict.is_active
  limit 1;

  select i.default_selling_rate, i.selling_pack_size_kg
    into v_default, v_pack
  from public.items i where i.id = p_item_id;

  if found and v_mode is not null then
    if v_mode = 'percent' then
      if v_default is null then
        return null;
      end if;
      v_price := round(v_default * (coalesce(v_pct, 100) / 100.0), 6);
      -- percent is always relative to default per-kg
      return v_price;
    end if;

    -- fixed
    if v_price is not null then
      if coalesce(v_basis, 'kg') = 'pack' then
        if coalesce(v_pack, 0) > 0 then
          return round(v_price / v_pack, 6);
        end if;
      end if;
      return v_price;
    end if;
  end if;

  return v_default;
end;
$$;

grant execute on function public.resolve_item_selling_price(uuid, uuid) to authenticated;
