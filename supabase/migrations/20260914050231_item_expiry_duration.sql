-- Mane Masala: item expiry duration configuration.
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS expiry_duration_value numeric(10,2),
  ADD COLUMN IF NOT EXISTS expiry_duration_unit text;
