-- Applied live with apply_migration; this file is the record.
-- 1) private.program_sync_apply: «recommended» from the program's catalogue export sets tyres.is_hot
--    (line added: is_hot = case when p ? 'recommended' then coalesce((p->>'recommended')::boolean, false) else t.is_hot end)
-- 2) category_counts(): n_all = everything a buyer sees in a section (also partner goods on order),
--    so sections with only partner goods are in the catalogue menu too.
drop function if exists public.category_counts();
create function public.category_counts()
 returns table(category_id bigint, n bigint, with_photo bigint, n_all bigint)
 language sql stable security definer set search_path to 'public'
as $$
  select category_id, count(*) filter (where not on_order), count(*) filter (where has_photo and not on_order), count(*)
  from tyres where in_stock and category_id is not null
  group by category_id
$$;
grant execute on function public.category_counts() to anon, authenticated;
