BEGIN;
ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_status_check;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_status_check CHECK (status = ANY (ARRAY['draft'::text,'active'::text,'inactive'::text,'archived'::text]));
COMMIT;
