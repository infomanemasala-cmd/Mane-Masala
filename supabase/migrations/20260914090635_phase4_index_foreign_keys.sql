do $$
declare r record; cols text; idx text;
begin
 for r in select c.oid as relid,c.relname,n.nspname,con.conname,con.conkey from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where con.contype='f' and n.nspname='public' loop
  if not exists(select 1 from pg_index i where i.indrelid=r.relid and i.indisvalid and i.indisready and i.indkey[0:array_length(r.conkey,1)-1]=r.conkey) then
   select string_agg(format('%I',a.attname),', ' order by u.ord) into cols from unnest(r.conkey) with ordinality u(attnum,ord) join pg_attribute a on a.attrelid=r.relid and a.attnum=u.attnum;
   idx:=left(r.relname||'_'||r.conname||'_idx',63);
   execute format('create index if not exists %I on %I.%I (%s)',idx,r.nspname,r.relname,cols);
  end if;
 end loop;
end $$;
