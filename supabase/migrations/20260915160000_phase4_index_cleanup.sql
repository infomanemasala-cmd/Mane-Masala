-- Phase 4 database index cleanup.
-- Cover remaining foreign keys used by production planning and remove a duplicate item-type index.

create index if not exists production_batch_plan_lines_recipe_line_idx
  on public.production_batch_plan_lines(recipe_line_id);

create index if not exists production_batch_plan_lines_unit_idx
  on public.production_batch_plan_lines(unit_id);

drop index if exists public.items_type_idx;
