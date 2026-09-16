alter table public.production_batch_plan_lines
  add column if not exists sequence_number integer;

update public.production_batch_plan_lines p
set sequence_number = r.sequence_number
from public.recipe_lines r
where p.recipe_line_id = r.id
  and p.sequence_number is null;
