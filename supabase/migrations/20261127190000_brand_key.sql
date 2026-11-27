-- Applied live with apply_migration; this file is the record.
-- tyres.brand_key: the brand without case, spaces, dots and dashes («Elring»/«ELRING», «K2»/«K-2», «A.B.S.»/«ABS»).
-- The site's brand filter compares keys; public.filter_options() lists each brand once in its most common spelling
-- (690 spellings → 642 brands).
alter table public.tyres add column if not exists brand_key text
  generated always as (nullif(lower(regexp_replace(coalesce(manufacturer, ''), '[^0-9A-Za-zА-Яа-яІіЇїЄєҐґ]', '', 'g')), '')) stored;
create index if not exists tyres_brand_key_idx on public.tyres (brand_key);
grant select (brand_key) on public.tyres to anon, authenticated;
