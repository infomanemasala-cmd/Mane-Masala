-- Phase 4 F-12: permanent human-readable IDs for core inventory/return records.
-- Scope ONLY: business-code coverage. No transaction semantics, inventory logic,
-- FIFO, reservations, purchasing, production, dispatch, sales, payments, RLS,
-- reports, or UI changes.
-- Existing UUID primary keys and existing business codes are preserved.

-- Reuse the established central PREFIX-000001 business-code pattern.
-- These two sequence families are the minimum additional families needed to
-- distinguish inventory transaction records from return records without
-- changing the existing code families.
INSERT INTO public.id_sequences(sequence_key,prefix,next_number,width)
VALUES
  ('ITX','ITX-',1,6),
  ('RET','RET-',1,6)
ON CONFLICT(sequence_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.assign_transaction_business_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
begin
  IF NEW.business_code IS NULL OR btrim(NEW.business_code)='' THEN
    NEW.business_code:=public.generate_business_code(
      CASE TG_TABLE_NAME
        WHEN 'orders' THEN 'ORD'
        WHEN 'purchases' THEN 'PUR'
        WHEN 'production_batches' THEN 'PB'
        WHEN 'dispatches' THEN 'DSP'
        WHEN 'sales' THEN 'SAL'
        WHEN 'invoices' THEN 'INV'
        WHEN 'customer_payments' THEN 'CPY'
        WHEN 'supplier_payments' THEN 'SPY'
        WHEN 'inventory_transactions' THEN 'ITX'
        WHEN 'purchase_returns' THEN 'RET'
        WHEN 'customer_returns' THEN 'RET'
        ELSE NULL
      END
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS inventory_transactions_business_code_trigger ON public.inventory_transactions;
CREATE TRIGGER inventory_transactions_business_code_trigger
BEFORE INSERT ON public.inventory_transactions
FOR EACH ROW EXECUTE FUNCTION public.assign_transaction_business_code();

DROP TRIGGER IF EXISTS purchase_returns_business_code_trigger ON public.purchase_returns;
CREATE TRIGGER purchase_returns_business_code_trigger
BEFORE INSERT ON public.purchase_returns
FOR EACH ROW EXECUTE FUNCTION public.assign_transaction_business_code();

DROP TRIGGER IF EXISTS customer_returns_business_code_trigger ON public.customer_returns;
CREATE TRIGGER customer_returns_business_code_trigger
BEFORE INSERT ON public.customer_returns
FOR EACH ROW EXECUTE FUNCTION public.assign_transaction_business_code();

-- Backfill only rows that have no business code. Existing codes are never
-- changed, so historical identity is preserved.
UPDATE public.inventory_transactions
SET business_code=public.generate_business_code('ITX')
WHERE business_code IS NULL;

UPDATE public.purchase_returns
SET business_code=public.generate_business_code('RET')
WHERE business_code IS NULL;

UPDATE public.customer_returns
SET business_code=public.generate_business_code('RET')
WHERE business_code IS NULL;

-- Preserve the existing table-local uniqueness guarantees while making the
-- generated families explicit in the migration.
CREATE UNIQUE INDEX IF NOT EXISTS inventory_transactions_business_code_uidx
  ON public.inventory_transactions(business_code);
CREATE UNIQUE INDEX IF NOT EXISTS purchase_returns_business_code_uidx
  ON public.purchase_returns(business_code);
CREATE UNIQUE INDEX IF NOT EXISTS customer_returns_business_code_uidx
  ON public.customer_returns(business_code);

COMMENT ON FUNCTION public.assign_transaction_business_code() IS
  'Central permanent transaction business-code assignment. Existing families remain ORD, PUR, PB, DSP, SAL, INV, CPY, SPY; F-12 adds ITX for inventory transactions and RET for purchase/customer returns.';
