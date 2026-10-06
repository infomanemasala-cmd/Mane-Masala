-- Material Indent support + Selling Pack display fields
-- Additive only. Does not alter confirm_order / prepare_order_plan behaviour.

alter table public.items
  add column if not exists selling_pack_size_kg numeric(20,6),
  add column if not exists selling_pack_label text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'items_selling_pack_size_kg_chk'
  ) then
    alter table public.items
      add constraint items_selling_pack_size_kg_chk
      check (selling_pack_size_kg is null or selling_pack_size_kg > 0);
  end if;
end $$;

comment on column public.items.selling_pack_size_kg is
  'Commercial pack size expressed in kg of the item base unit. Used only for invoice/sale line display. Null means show ordered quantity as-is.';
comment on column public.items.selling_pack_label is
  'Label shown on commercial documents when pack conversion applies, e.g. Nutri Mix 250G.';
