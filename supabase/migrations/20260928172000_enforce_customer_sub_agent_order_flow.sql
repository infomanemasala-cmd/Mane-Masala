BEGIN;

CREATE OR REPLACE FUNCTION public.validate_order_customer_sub_agent()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_customer_sub_agent uuid;
  v_end_customer_sub_agent uuid;
  v_sub_agent_active boolean;
BEGIN
  IF NEW.order_party_type='direct' THEN
    SELECT c.sub_agent_id,sa.is_active INTO v_customer_sub_agent,v_sub_agent_active
    FROM public.customers c
    LEFT JOIN public.sub_agents sa ON sa.id=c.sub_agent_id
    WHERE c.id=NEW.customer_id;
    IF v_customer_sub_agent IS NOT NULL AND coalesce(v_sub_agent_active,false) THEN
      RAISE EXCEPTION 'This customer is assigned to an active Sub-Agent. Create the order through that Sub-Agent, or explicitly reassign the customer to Direct Customer first.';
    END IF;
  ELSIF NEW.order_party_type='sub_agent' AND NEW.end_customer_customer_id IS NOT NULL THEN
    SELECT sub_agent_id INTO v_end_customer_sub_agent FROM public.customers WHERE id=NEW.end_customer_customer_id;
    IF v_end_customer_sub_agent IS NOT NULL AND v_end_customer_sub_agent IS DISTINCT FROM NEW.sub_agent_id
       AND EXISTS (SELECT 1 FROM public.sub_agents sa WHERE sa.id=v_end_customer_sub_agent AND sa.is_active) THEN
      RAISE EXCEPTION 'The selected end customer is assigned to a different active Sub-Agent.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS orders_validate_customer_sub_agent ON public.orders;
CREATE TRIGGER orders_validate_customer_sub_agent
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.validate_order_customer_sub_agent();

COMMIT;