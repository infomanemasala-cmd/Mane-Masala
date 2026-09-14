-- Mane Masala: item types are maintained as a master list.
ALTER TABLE public.items DROP CONSTRAINT items_type_chk;
ALTER TABLE public.items
  ADD CONSTRAINT items_item_type_fk FOREIGN KEY (item_type) REFERENCES public.item_types(code);
CREATE INDEX IF NOT EXISTS idx_items_item_type ON public.items(item_type);
