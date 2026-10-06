-- Finalize selling pack columns, enforce pack when can_be_sold, reseed all known products.
-- Additive. Safe to re-run.

alter table public.items
  add column if not exists selling_pack_size_kg numeric(20,6),
  add column if not exists selling_pack_label text,
  add column if not exists selling_pack_type text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'items_selling_pack_size_kg_chk') then
    alter table public.items
      add constraint items_selling_pack_size_kg_chk
      check (selling_pack_size_kg is null or selling_pack_size_kg > 0);
  end if;
end $$;

-- Enforce: sellable active items must carry pack type + size
create or replace function public.trg_items_require_selling_pack()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.can_be_sold, false) = true and coalesce(new.is_active, true) = true then
    if new.selling_pack_size_kg is null or new.selling_pack_size_kg <= 0 then
      raise exception 'Min packing size (selling_pack_size_kg) is required when Can be sold is enabled.';
    end if;
    if new.selling_pack_type is null or btrim(new.selling_pack_type) = '' then
      raise exception 'Packaging type (selling_pack_type) is required when Can be sold is enabled.';
    end if;
    if new.selling_pack_label is null or btrim(new.selling_pack_label) = '' then
      new.selling_pack_label := trim(new.name) || ' ' ||
        case
          when round(new.selling_pack_size_kg * 1000) % 1000 = 0
            then (round(new.selling_pack_size_kg)::text || 'KG')
          else (round(new.selling_pack_size_kg * 1000)::text || 'G')
        end;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_items_require_selling_pack on public.items;
create trigger trg_items_require_selling_pack
  before insert or update on public.items
  for each row
  execute function public.trg_items_require_selling_pack();

-- Seed / refresh pack data from canonical product list (exact name match, case-insensitive)
with pack(name, size_kg, pack_type, suffix) as (
  values
    ('Bele Channa Urad Chutney Pudi', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G'),
    ('Kobri Chutney Pudi', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G'),
    ('Puliyogare Gojju', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G'),
    ('Vangi Bath Powder', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G'),
    ('Bisi Bele Bath Powder', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G'),
    ('Sambar Powder', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G'),
    ('Gojju Avalakki', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G'),
    ('Nutri Mix', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G'),
    ('Rice Avalakki Special', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G'),
    ('Rice Avalakki', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G'),
    ('Laddu Dry Fruit', 0.500, 'Container', '500G'),
    ('Peanut Butter', 0.250, 'Glass Jar', '250G'),
    ('Choco Almond', 0.250, 'Glass Jar', '250G'),
    ('Sausse Tomato Sweet', 0.200, 'Bottle', '200G'),
    ('Sauce Tomato Sweet', 0.200, 'Bottle', '200G'),
    ('Sausse Tomato', 0.200, 'Bottle', '200G'),
    ('Sauce Tomato', 0.200, 'Bottle', '200G'),
    ('Ghee Home', 0.200, 'Glass Jar', '200G'),
    ('Forest Honey', 0.250, 'Glass Jar', '250G'),
    ('Natural Honey', 0.250, 'Glass Jar', '250G'),
    ('Black Pepper', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G'),
    ('Cardamom', 0.100, 'Brown Kraft Paper Ziplock Pouch', '100G'),
    ('Turmeric', 0.100, 'Brown Kraft Paper Ziplock Pouch', '100G'),
    ('Bird Eye Chilli', 0.100, 'Brown Kraft Paper Ziplock Pouch', '100G')
)
update public.items i
set
  selling_pack_size_kg = p.size_kg,
  selling_pack_type = p.pack_type,
  selling_pack_label = trim(i.name) || ' ' || p.suffix,
  updated_at = now()
from pack p
where lower(trim(i.name)) = lower(trim(p.name))
  and i.is_active = true;

-- Also by known PRD codes
update public.items i set
  selling_pack_size_kg = v.size_kg,
  selling_pack_type = v.pack_type,
  selling_pack_label = trim(i.name) || ' ' || v.suffix,
  updated_at = now()
from (values
  ('PRD-017', 0.250, 'Glass Jar', '250G'),
  ('PRD-018', 0.250, 'Glass Jar', '250G'),
  ('PRD-019', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G'),
  ('PRD-020', 0.100, 'Brown Kraft Paper Ziplock Pouch', '100G'),
  ('PRD-021', 0.100, 'Brown Kraft Paper Ziplock Pouch', '100G'),
  ('PRD-022', 0.100, 'Brown Kraft Paper Ziplock Pouch', '100G')
) as v(code, size_kg, pack_type, suffix)
where i.is_active = true
  and (i.item_code = v.code or i.business_code = v.code)
  and i.selling_pack_size_kg is null;

-- Parse go-live notes where still empty
update public.items i
set
  selling_pack_size_kg = case
    when i.notes ~* '100\s*g' then 0.100
    when i.notes ~* '200\s*g' then 0.200
    when i.notes ~* '250\s*g' then 0.250
    when i.notes ~* '500\s*g' then 0.500
    else i.selling_pack_size_kg
  end,
  selling_pack_type = coalesce(i.selling_pack_type,
    case
      when i.notes ~* 'glass jar' then 'Glass Jar'
      when i.notes ~* 'bottle' then 'Bottle'
      when i.notes ~* 'container' then 'Container'
      when i.notes ~* 'ziplock|kraft|pouch' then 'Brown Kraft Paper Ziplock Pouch'
      else null
    end),
  selling_pack_label = coalesce(i.selling_pack_label,
    case
      when i.notes ~* '100\s*g' then trim(i.name) || ' 100G'
      when i.notes ~* '200\s*g' then trim(i.name) || ' 200G'
      when i.notes ~* '250\s*g' then trim(i.name) || ' 250G'
      when i.notes ~* '500\s*g' then trim(i.name) || ' 500G'
      else i.selling_pack_label
    end),
  updated_at = now()
where i.is_active = true
  and i.can_be_sold = true
  and i.selling_pack_size_kg is null
  and i.notes is not null;

comment on column public.items.selling_pack_size_kg is
  'Commercial pack size in kg of base unit. Invoice display only. Required when can_be_sold.';
comment on column public.items.selling_pack_type is
  'Commercial packaging type. Required when can_be_sold.';
comment on column public.items.selling_pack_label is
  'Label on commercial documents when pack conversion applies.';
