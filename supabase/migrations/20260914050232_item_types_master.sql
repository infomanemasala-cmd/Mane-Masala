-- Mane Masala: business-maintained item-type choices.
CREATE TABLE IF NOT EXISTS public.item_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.item_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated manage item types" ON public.item_types
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.item_types (code, name) VALUES
  ('raw_material', 'Raw material'),
  ('intermediate', 'Intermediate / prepared material'),
  ('finished_product', 'Finished product'),
  ('purchased_finished_product', 'Purchased finished product')
ON CONFLICT (code) DO NOTHING;
