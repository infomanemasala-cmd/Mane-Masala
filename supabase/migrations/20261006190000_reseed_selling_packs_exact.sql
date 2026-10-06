-- Reseed selling pack fields using exact names + item_code.
-- Previous seed used LIKE patterns only; LIVE returned 0 rows.
-- Safe / idempotent. Does not change inventory logic.

alter table public.items
  add column if not exists selling_pack_size_kg numeric(20,6),
  add column if not exists selling_pack_label text,
  add column if not exists selling_pack_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'items_selling_pack_size_kg_chk'
  ) then
    alter table public.items
      add constraint items_selling_pack_size_kg_chk
      check (selling_pack_size_kg is null or selling_pack_size_kg > 0);
  end if;
end $$;

-- Exact-name / code helper
create or replace function public._seed_item_pack_exact(
  p_names text[],
  p_codes text[],
  p_size_kg numeric,
  p_pack_type text,
  p_label_suffix text
) returns integer
language plpgsql
as $$
declare
  v_count integer := 0;
begin
  update public.items i
  set
    selling_pack_size_kg = p_size_kg,
    selling_pack_type = p_pack_type,
    selling_pack_label = trim(i.name) || ' ' || p_label_suffix,
    updated_at = now()
  where i.is_active = true
    and coalesce(i.archived_at, 'infinity'::timestamptz) = 'infinity'::timestamptz
    and (
      lower(trim(i.name)) = any (select lower(trim(x)) from unnest(p_names) as x)
      or lower(trim(coalesce(i.item_code, ''))) = any (select lower(trim(x)) from unnest(p_codes) as x)
      or lower(trim(coalesce(i.business_code, ''))) = any (select lower(trim(x)) from unnest(p_codes) as x)
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Also match contains-all-tokens (order independent) for naming drift
create or replace function public._seed_item_pack_tokens(
  p_tokens text[],
  p_size_kg numeric,
  p_pack_type text,
  p_label_suffix text
) returns integer
language plpgsql
as $$
declare
  v_count integer := 0;
  v_norm text;
  r record;
  ok boolean;
  tok text;
begin
  for r in
    select i.id, i.name
    from public.items i
    where i.is_active = true
      and coalesce(i.archived_at, 'infinity'::timestamptz) = 'infinity'::timestamptz
      and i.selling_pack_size_kg is null
  loop
    v_norm := lower(regexp_replace(coalesce(r.name, ''), '[[:space:][:punct:]]+', ' ', 'g'));
    ok := true;
    foreach tok in array p_tokens loop
      if position(lower(tok) in v_norm) = 0 then
        ok := false;
        exit;
      end if;
    end loop;
    if ok then
      update public.items i
      set
        selling_pack_size_kg = p_size_kg,
        selling_pack_type = p_pack_type,
        selling_pack_label = trim(i.name) || ' ' || p_label_suffix,
        updated_at = now()
      where i.id = r.id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

do $$
declare
  t integer := 0;
  c integer;
begin
  -- Chutney Pudi
  select public._seed_item_pack_exact(
    array['Bele Channa Urad Chutney Pudi','Bele Channa Urad Chutney'],
    array[]::text[], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G'
  ) into c; t := t + c;
  select public._seed_item_pack_tokens(array['bele','channa','urad','chutney'], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G') into c; t := t + c;

  select public._seed_item_pack_exact(
    array['Kobri Chutney Pudi','Kobri Chutney'],
    array[]::text[], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G'
  ) into c; t := t + c;
  select public._seed_item_pack_tokens(array['kobri','chutney'], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G') into c; t := t + c;

  -- Masala
  select public._seed_item_pack_exact(array['Puliyogare Gojju'], array[]::text[], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G') into c; t := t + c;
  select public._seed_item_pack_tokens(array['puliyogare','gojju'], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G') into c; t := t + c;

  select public._seed_item_pack_exact(array['Vangi Bath Powder'], array[]::text[], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G') into c; t := t + c;
  select public._seed_item_pack_tokens(array['vangi','bath'], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G') into c; t := t + c;

  select public._seed_item_pack_exact(array['Bisi Bele Bath Powder'], array[]::text[], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G') into c; t := t + c;
  select public._seed_item_pack_tokens(array['bisi','bele','bath'], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G') into c; t := t + c;

  select public._seed_item_pack_exact(array['Sambar Powder'], array[]::text[], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G') into c; t := t + c;
  select public._seed_item_pack_tokens(array['sambar','powder'], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G') into c; t := t + c;

  -- Instant Food
  select public._seed_item_pack_exact(array['Gojju Avalakki'], array[]::text[], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G') into c; t := t + c;
  select public._seed_item_pack_tokens(array['gojju','avalakki'], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G') into c; t := t + c;

  select public._seed_item_pack_exact(array['Nutri Mix'], array[]::text[], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G') into c; t := t + c;
  select public._seed_item_pack_tokens(array['nutri','mix'], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G') into c; t := t + c;

  -- Instant Snacks
  select public._seed_item_pack_exact(array['Rice Avalakki Special'], array[]::text[], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G') into c; t := t + c;
  select public._seed_item_pack_tokens(array['rice','avalakki','special'], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G') into c; t := t + c;

  select public._seed_item_pack_exact(array['Rice Avalakki'], array[]::text[], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G') into c; t := t + c;
  select public._seed_item_pack_tokens(array['rice','avalakki'], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G') into c; t := t + c;

  select public._seed_item_pack_exact(array['Laddu Dry Fruit','Dry Fruit Laddu'], array[]::text[], 0.500, 'Container', '500G') into c; t := t + c;
  select public._seed_item_pack_tokens(array['laddu','dry','fruit'], 0.500, 'Container', '500G') into c; t := t + c;

  -- Spreads
  select public._seed_item_pack_exact(array['Peanut Butter'], array[]::text[], 0.250, 'Glass Jar', '250G') into c; t := t + c;
  select public._seed_item_pack_tokens(array['peanut','butter'], 0.250, 'Glass Jar', '250G') into c; t := t + c;

  select public._seed_item_pack_exact(array['Choco Almond'], array[]::text[], 0.250, 'Glass Jar', '250G') into c; t := t + c;
  select public._seed_item_pack_tokens(array['choco','almond'], 0.250, 'Glass Jar', '250G') into c; t := t + c;

  select public._seed_item_pack_exact(
    array['Sausse Tomato Sweet','Sauce Tomato Sweet','Tomato Sweet Sauce','Tomato Sweet Sausse'],
    array[]::text[], 0.200, 'Bottle', '200G'
  ) into c; t := t + c;
  select public._seed_item_pack_tokens(array['tomato','sweet'], 0.200, 'Bottle', '200G') into c; t := t + c;

  select public._seed_item_pack_exact(
    array['Sausse Tomato','Sauce Tomato','Tomato Sauce','Tomato Sausse'],
    array[]::text[], 0.200, 'Bottle', '200G'
  ) into c; t := t + c;

  select public._seed_item_pack_exact(array['Ghee Home','Home Ghee'], array[]::text[], 0.200, 'Glass Jar', '200G') into c; t := t + c;
  select public._seed_item_pack_tokens(array['ghee'], 0.200, 'Glass Jar', '200G') into c; t := t + c;

  -- Honey + Spices (known PRD codes from go-live migration)
  select public._seed_item_pack_exact(array['Forest Honey'], array['PRD-017'], 0.250, 'Glass Jar', '250G') into c; t := t + c;
  select public._seed_item_pack_exact(array['Natural Honey'], array['PRD-018'], 0.250, 'Glass Jar', '250G') into c; t := t + c;
  select public._seed_item_pack_exact(array['Black Pepper'], array['PRD-019'], 0.250, 'Brown Kraft Paper Ziplock Pouch', '250G') into c; t := t + c;
  select public._seed_item_pack_exact(array['Cardamom'], array['PRD-020'], 0.100, 'Brown Kraft Paper Ziplock Pouch', '100G') into c; t := t + c;
  select public._seed_item_pack_exact(array['Turmeric'], array['PRD-021'], 0.100, 'Brown Kraft Paper Ziplock Pouch', '100G') into c; t := t + c;
  select public._seed_item_pack_exact(array['Bird Eye Chilli','Birds Eye Chilli'], array['PRD-022'], 0.100, 'Brown Kraft Paper Ziplock Pouch', '100G') into c; t := t + c;

  -- Fallback: parse notes "Minimum package/sale size: 250g" written at go-live
  update public.items i
  set
    selling_pack_size_kg = case
      when i.notes ~* '100\s*g' then 0.100
      when i.notes ~* '200\s*g' then 0.200
      when i.notes ~* '250\s*g' then 0.250
      when i.notes ~* '500\s*g' then 0.500
      else i.selling_pack_size_kg
    end,
    selling_pack_type = coalesce(
      i.selling_pack_type,
      case
        when i.notes ~* 'glass jar' then 'Glass Jar'
        when i.notes ~* 'bottle' then 'Bottle'
        when i.notes ~* 'container' then 'Container'
        when i.notes ~* 'ziplock|kraft|pouch' then 'Brown Kraft Paper Ziplock Pouch'
        else null
      end
    ),
    selling_pack_label = coalesce(
      i.selling_pack_label,
      case
        when i.notes ~* '100\s*g' then trim(i.name) || ' 100G'
        when i.notes ~* '200\s*g' then trim(i.name) || ' 200G'
        when i.notes ~* '250\s*g' then trim(i.name) || ' 250G'
        when i.notes ~* '500\s*g' then trim(i.name) || ' 500G'
        else i.selling_pack_label
      end
    ),
    updated_at = now()
  where i.is_active = true
    and i.can_be_sold = true
    and i.selling_pack_size_kg is null
    and i.notes is not null
    and i.notes ~* 'minimum package|package:';

  get diagnostics c = row_count;
  t := t + c;

  raise notice 'selling_pack reseed touched approximately % row updates (exact+token+notes)', t;
end $$;

drop function if exists public._seed_item_pack_exact(text[], text[], numeric, text, text);
drop function if exists public._seed_item_pack_tokens(text[], numeric, text, text);
