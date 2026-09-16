-- Phase 4J security lint cleanup.
-- The supplier-outstanding view only reads tables whose authenticated policies permit
-- read access, so use invoker permissions rather than the view owner's permissions.
alter view public.v_supplier_outstanding set (security_invoker = true);

-- Recipe version creation already requires auth.uid() and is an application workflow;
-- anonymous callers must not be able to execute the SECURITY DEFINER function.
revoke execute on function public.save_recipe_version(uuid,text,uuid,uuid,numeric,uuid,jsonb,text,boolean,date) from anon;
