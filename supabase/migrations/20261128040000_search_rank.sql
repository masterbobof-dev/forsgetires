-- Shop search (applied live 2026-11-28).
-- tyres.search_norm: name + brand + numbers in one spelling (Cyrillic/Latin look-alike letters → Latin, К2 = K2,
-- K-2 = K2, 5W-30 = 5W30). tyres.search_skel: the same without vowels and doubled letters (typos: калодки = колодки).
-- search_rank(p_norm, p_words): every pattern must be found in search_norm; the brand typed first, then whole words,
-- then own goods in stock with a photo. search_rank_skel: the same on search_skel (the typo try).
-- Both are plain SQL (inlined by PostgreSQL), the visitor's rights apply; the site adds its filters on top.
create or replace function public.search_fold(t text) returns text
language sql immutable parallel safe as $$
  select trim(regexp_replace(
    regexp_replace(
      translate(lower(coalesce(t, '')), 'авекмнорстухіё''’ʼ`', 'abekmhopctyxie'),
      '([a-zа-яіїєґ])-(?=[0-9])', '\1', 'g'),
    '[^0-9a-zа-яіїєґ.]+', ' ', 'g'))
$$;

create or replace function public.search_line(p_title text, p_brand text, p_numbers text, p_catalog text, p_product text) returns text
language sql immutable parallel safe as $$
  select public.search_fold(coalesce(p_title, '') || ' ' || coalesce(p_brand, ''))
    || ' ' || public.search_fold(coalesce(p_numbers, '') || ' '
         || regexp_replace(coalesce(p_catalog, ''), '[^0-9A-Za-zА-Яа-яІіЇїЄєҐґ]', '', 'g') || ' '
         || regexp_replace(coalesce(p_product, ''), '[^0-9A-Za-zА-Яа-яІіЇїЄєҐґ]', '', 'g'))
$$;

create or replace function public.search_skel(t text) returns text
language sql immutable parallel safe as $$
  select trim(regexp_replace(regexp_replace(regexp_replace(coalesce(t, ''), '[aeiouyаеиіїоуыэюяєёйьъ]', '', 'g'), '([^ ])\1+', '\1', 'g'), ' +', ' ', 'g'))
$$;

alter table public.tyres add column if not exists search_norm text;
alter table public.tyres add column if not exists search_skel text;

create or replace function public.tyres_search_norm() returns trigger
language plpgsql as $$
begin
  new.search_norm := public.search_line(new.title, new.manufacturer, new.search_numbers, new.catalog_number, new.product_number);
  new.search_skel := public.search_skel(new.search_norm);
  return new;
end $$;
drop trigger if exists tyres_search_norm on public.tyres;
create trigger tyres_search_norm before insert or update of title, manufacturer, search_numbers, catalog_number, product_number on public.tyres
  for each row execute function public.tyres_search_norm();

update public.tyres set search_norm = public.search_line(title, manufacturer, search_numbers, catalog_number, product_number);
update public.tyres set search_skel = public.search_skel(search_norm);
create index if not exists tyres_search_norm_trgm on public.tyres using gin (search_norm gin_trgm_ops);
create index if not exists tyres_search_skel_trgm on public.tyres using gin (search_skel gin_trgm_ops);

create or replace function public.search_rank(p_norm text[], p_words text[] default '{}')
returns setof public.tyres
language sql stable as $$
  select t.* from public.tyres t
  where (cardinality(p_norm) < 1 or t.search_norm ~ p_norm[1])
    and (cardinality(p_norm) < 2 or t.search_norm ~ p_norm[2])
    and (cardinality(p_norm) < 3 or t.search_norm ~ p_norm[3])
    and (cardinality(p_norm) < 4 or t.search_norm ~ p_norm[4])
    and (cardinality(p_norm) < 5 or t.search_norm ~ p_norm[5])
    and (cardinality(p_norm) < 6 or t.search_norm ~ p_norm[6])
    and (cardinality(p_norm) < 7 or (select bool_and(t.search_norm ~ p) from unnest(p_norm[7:]) p))
  order by
    (select coalesce(sum(case when t.search_norm ~ ('(^| )' || w || '( |$)') then 10
                              when t.search_norm ~ ('(^| )' || w) then 5 else 0 end), 0) from unnest(p_words) w)
    + case when public.search_fold(t.brand_key) = any(p_words) then 25 else 0 end
    + case when t.is_hot then 3 else 0 end
    + case when t.in_stock is not false and t.program_product_id is not null then 4 else 0 end
    + case when t.has_photo then 2 else 0 end
    - case when t.ask_price then 8 else 0 end
    - case when t.on_order then 3 else 0 end desc,
    t.list_rank, t.id
$$;
grant execute on function public.search_rank(text[], text[]) to anon, authenticated;

create or replace function public.search_rank_skel(p_norm text[], p_words text[] default '{}')
returns setof public.tyres
language sql stable as $$
  select t.* from public.tyres t
  where (cardinality(p_norm) < 1 or t.search_skel ~ p_norm[1])
    and (cardinality(p_norm) < 2 or t.search_skel ~ p_norm[2])
    and (cardinality(p_norm) < 3 or t.search_skel ~ p_norm[3])
    and (cardinality(p_norm) < 4 or t.search_skel ~ p_norm[4])
    and (cardinality(p_norm) < 5 or t.search_skel ~ p_norm[5])
    and (cardinality(p_norm) < 6 or t.search_skel ~ p_norm[6])
    and (cardinality(p_norm) < 7 or (select bool_and(t.search_skel ~ p) from unnest(p_norm[7:]) p))
  order by
    (select coalesce(sum(word_similarity(w, t.search_norm)
       + case when t.search_skel ~ ('(^| )' || public.search_skel(w) || '( |$)') then 1 else 0 end), 0) from unnest(p_words) w) desc,
    case when t.in_stock is not false and t.program_product_id is not null then 0 else 1 end,
    t.list_rank, t.id
$$;
grant execute on function public.search_rank_skel(text[], text[]) to anon, authenticated;
