-- MANE MASALA — Phase 4 Runtime Defect Round 1 — D1
-- Random UUID wrappers must be VOLATILE. No data is changed.
alter function public.gen_random_uuid() volatile;
