ALTER TABLE public.supplier_payments DROP CONSTRAINT IF EXISTS supplier_payments_payment_method_check;
ALTER TABLE public.supplier_payments ADD CONSTRAINT supplier_payments_payment_method_check CHECK (payment_method = ANY (ARRAY['cash'::text,'upi'::text,'bank_transfer'::text,'other'::text]));
ALTER TABLE public.customer_payments DROP CONSTRAINT IF EXISTS customer_payments_payment_method_check;
ALTER TABLE public.customer_payments ADD CONSTRAINT customer_payments_payment_method_check CHECK (payment_method = ANY (ARRAY['cash'::text,'upi'::text,'bank_transfer'::text,'other'::text]));
