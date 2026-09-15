INSERT INTO public.id_sequences(sequence_key,prefix,next_number,width) VALUES ('ORD','ORD-',1,6),('PUR','PUR-',1,6),('PB','PB-',1,6),('DSP','DSP-',1,6),('SAL','SAL-',1,6),('INV','INV-',1,6),('CPY','CPY-',1,6),('SPY','SPY-',1,6) ON CONFLICT(sequence_key) DO NOTHING;
CREATE OR REPLACE FUNCTION public.assign_transaction_business_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
begin
  if NEW.business_code is null or btrim(NEW.business_code)='' then
    NEW.business_code:=public.generate_business_code(case TG_TABLE_NAME when 'orders' then 'ORD' when 'purchases' then 'PUR' when 'production_batches' then 'PB' when 'dispatches' then 'DSP' when 'sales' then 'SAL' when 'invoices' then 'INV' when 'customer_payments' then 'CPY' when 'supplier_payments' then 'SPY' else NULL end);
  end if;
  return NEW;
end;
$function$;
DROP TRIGGER IF EXISTS orders_business_code_trigger ON public.orders;
CREATE TRIGGER orders_business_code_trigger BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.assign_transaction_business_code();
DROP TRIGGER IF EXISTS purchases_business_code_trigger ON public.purchases;
CREATE TRIGGER purchases_business_code_trigger BEFORE INSERT ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.assign_transaction_business_code();
DROP TRIGGER IF EXISTS production_batches_business_code_trigger ON public.production_batches;
CREATE TRIGGER production_batches_business_code_trigger BEFORE INSERT ON public.production_batches FOR EACH ROW EXECUTE FUNCTION public.assign_transaction_business_code();
DROP TRIGGER IF EXISTS dispatches_business_code_trigger ON public.dispatches;
CREATE TRIGGER dispatches_business_code_trigger BEFORE INSERT ON public.dispatches FOR EACH ROW EXECUTE FUNCTION public.assign_transaction_business_code();
DROP TRIGGER IF EXISTS sales_business_code_trigger ON public.sales;
CREATE TRIGGER sales_business_code_trigger BEFORE INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION public.assign_transaction_business_code();
DROP TRIGGER IF EXISTS invoices_business_code_trigger ON public.invoices;
CREATE TRIGGER invoices_business_code_trigger BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.assign_transaction_business_code();
DROP TRIGGER IF EXISTS customer_payments_business_code_trigger ON public.customer_payments;
CREATE TRIGGER customer_payments_business_code_trigger BEFORE INSERT ON public.customer_payments FOR EACH ROW EXECUTE FUNCTION public.assign_transaction_business_code();
DROP TRIGGER IF EXISTS supplier_payments_business_code_trigger ON public.supplier_payments;
CREATE TRIGGER supplier_payments_business_code_trigger BEFORE INSERT ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION public.assign_transaction_business_code();
UPDATE public.purchases SET business_code=public.generate_business_code('PUR') WHERE business_code IS NULL;
UPDATE public.orders SET business_code=public.generate_business_code('ORD') WHERE business_code IS NULL;
UPDATE public.production_batches SET business_code=public.generate_business_code('PB') WHERE business_code IS NULL;
UPDATE public.dispatches SET business_code=public.generate_business_code('DSP') WHERE business_code IS NULL;
UPDATE public.sales SET business_code=public.generate_business_code('SAL') WHERE business_code IS NULL;
UPDATE public.invoices SET business_code=public.generate_business_code('INV') WHERE business_code IS NULL;
UPDATE public.customer_payments SET business_code=public.generate_business_code('CPY') WHERE business_code IS NULL;
UPDATE public.supplier_payments SET business_code=public.generate_business_code('SPY') WHERE business_code IS NULL;
