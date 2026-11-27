-- Applied live with apply_migration; this file is the record (stage 3: search and catalogue).
-- 1) public.search_similar(p_q, p_n): goods whose name is close to the words typed (pg_trgm word similarity, `<%`),
--    used by the site when an exact search finds nothing (typos like «амартизатор ланос»). Index on lower(title).
-- 2) public.filter_options(p_cats, p_null_cat, p_hot): brands, radii, tyre sizes, characteristics of a section,
--    counted in the database over every product (the browser used to see only the first 5000 rows).
-- 3) private.weekly_report(): «Шукали і не знайшли» (event search_empty) and «Знайшли лише з виправленням» (search_fixed).
create index if not exists tyres_title_lower_trgm on public.tyres using gin (lower(title) gin_trgm_ops);
