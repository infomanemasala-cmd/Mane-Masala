alter function public.record_supplier_return(uuid,date,text,jsonb,numeric,boolean,text) security definer;
grant execute on function public.record_supplier_return(uuid,date,text,jsonb,numeric,boolean,text) to authenticated;
