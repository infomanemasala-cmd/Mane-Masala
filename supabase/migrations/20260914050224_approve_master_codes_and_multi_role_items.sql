-- Mane Masala approved master-code scheme and multi-role item usage.
-- Existing RM-001..RM-083 are preserved. Business codes are system-generated and permanent.

alter table public.items
  add column if not exists can_be_sold boolean not null default false,
  add column if not exists can_be_used_in_production boolean not null default false,
  add column if not exists is_intermediate boolean not null default false;

comment on column public.items.can_be_sold is 'Business role: item may be sold directly; permanent item identity remains unchanged.';
comment on column public.items.can_be_used_in_production is 'Business role: item may be consumed as a production input; the same item may also be sold.';
comment on column public.items.is_intermediate is 'Business role: item may be held as prepared/intermediate material without creating a duplicate item identity.';

update public.items
set can_be_sold = true
where item_type in ('finished_product','purchased_finished_product');

update public.items
set can_be_used_in_production = true
where item_type = 'raw_material';

-- Approved human-readable business-code families. Existing raw-material numbering continues at RM-084.
insert into public.id_sequences (sequence_key, prefix, next_number, width)
values
  ('item_rm','RM-',84,3),
  ('item_fp','FP-',1,3),
  ('item_pfp','PFP-',1,3),
  ('supplier','SUP-',1,3),
  ('customer','CUS-',1,3),
  ('sub_agent','SA-',1,3),
  ('category','CAT-',1,3),
  ('unit','UNT-',1,3)
on conflict (sequence_key) do update
set prefix = excluded.prefix,
    next_number = greatest(public.id_sequences.next_number, excluded.next_number),
    width = excluded.width,
    updated_at = now();

comment on table public.id_sequences is 'Central permanent business-code sequence control. Approved families: RM, FP, PFP, SUP, CUS, SA, CAT, UNT. Codes are system-generated and permanent.';
