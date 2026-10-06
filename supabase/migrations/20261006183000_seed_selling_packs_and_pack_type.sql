-- Add pack type; seed selling pack data for all listed sellable products.
-- Safe / additive. Match by name (case-insensitive, flexible punctuation).

alter table public.items
  add column if not exists selling_pack_type text;

comment on column public.items.selling_pack_type is
  'Commercial packaging type, e.g. Brown Kraft Paper Ziplock Pouch, Glass Jar, Container, Bottle.';

-- Helper: update by flexible name match
create or replace function public._seed_item_pack(
  p_name_pattern text,
  p_size_kg numeric,
  p_pack_type text,
  p_label_suffix text
) returns void
language plpgsql
as $$
begin
  update public.items i
  set
    selling_pack_size_kg = p_size_kg,
    selling_pack_type = p_pack_type,
    selling_pack_label = trim(i.name) || ' ' || p_label_suffix,
    updated_at = now()
  where i.is_active = true
    and i.archived_at is null
    and lower(regexp_replace(i.name, '[[:space:][:punct:]]+', ' ', 'g'))
        like lower(regexp_replace(p_name_pattern, '[[:space:][:punct:]]+', ' ', 'g'));
end;
$$;

-- Chutney Pudi
select public._seed_item_pack('%Bele%Channa%Urad%Chutney%', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G');
select public._seed_item_pack('%Kobri%Chutney%Pudi%', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G');

-- Masala
select public._seed_item_pack('%Puliyogare%Gojju%', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G');
select public._seed_item_pack('%Vangi%Bath%Powder%', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G');
select public._seed_item_pack('%Bisi%Bele%Bath%Powder%', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G');
select public._seed_item_pack('%Sambar%Powder%', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G');

-- Instant Food
select public._seed_item_pack('%Gojju%Avalakki%', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G');
select public._seed_item_pack('%Nutri%Mix%', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G');

-- Instant Snacks (Special before generic Avalakki)
select public._seed_item_pack('%Rice%Avalakki%Special%', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G');
select public._seed_item_pack('%Rice%Avalakki%', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G');
select public._seed_item_pack('%Laddu%Dry%Fruit%', 0.500, 'Container', '500G');

-- Spreads
select public._seed_item_pack('%Peanut%Butter%', 0.250, 'Glass Jar', '250G');
select public._seed_item_pack('%Choco%Almond%', 0.250, 'Glass Jar', '250G');
select public._seed_item_pack('%Sausse%Tomato%Sweet%', 0.200, 'Bottle', '200G');
select public._seed_item_pack('%Sausse%Tomato%', 0.200, 'Bottle', '200G');
select public._seed_item_pack('%Sauce%Tomato%Sweet%', 0.200, 'Bottle', '200G');
select public._seed_item_pack('%Sauce%Tomato%', 0.200, 'Bottle', '200G');
select public._seed_item_pack('%Ghee%Home%', 0.200, 'Glass Jar', '200G');

-- Honey
select public._seed_item_pack('%Forest%Honey%', 0.250, 'Glass Jar', '250G');
select public._seed_item_pack('%Natural%Honey%', 0.250, 'Glass Jar', '250G');

-- Spices
select public._seed_item_pack('%Black%Pepper%', 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G');
select public._seed_item_pack('%Cardamom%', 0.100, 'Brown Kraft Paper Ziplock Pouch', '100G');
select public._seed_item_pack('%Turmeric%', 0.100, 'Brown Kraft Paper Ziplock Pouch', '100G');
select public._seed_item_pack('%Bird%Eye%Chilli%', 0.100, 'Brown Kraft Paper Ziplock Pouch', '100G');

drop function if exists public._seed_item_pack(text, numeric, text, text);
