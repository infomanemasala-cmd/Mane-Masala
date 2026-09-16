alter function public.record_stock_out(uuid,numeric,uuid,date,text,text) security definer;
alter function public.record_stock_adjustment(uuid,numeric,uuid,date,text,text) security definer;
grant execute on function public.record_stock_out(uuid,numeric,uuid,date,text,text) to authenticated;
grant execute on function public.record_stock_adjustment(uuid,numeric,uuid,date,text,text) to authenticated;
