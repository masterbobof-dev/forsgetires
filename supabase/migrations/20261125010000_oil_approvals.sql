-- Oil approvals (допуски): tyres.approvals comes from the program (field "approvals": ["VW 502.00", "MB 229.5", ...]).
-- Until the program sends them, they are read from the product name.
alter table public.tyres add column if not exists approvals text[];

-- Approvals found in a text, in one standard spelling: "ACEA A3", "API SN", "VW 502.00", "MB 229.5", "BMW LL-01", "RN0700", "GM dexos2", "Ford M2C913", "Porsche A40"
create or replace function public.parse_approvals(t text) returns text[]
language sql immutable as $$
  with s as (select ' ' || upper(coalesce(t, '')) || ' ' as u)
  select coalesce(array_agg(distinct a order by a), '{}') from (
    select 'ACEA ' || m[1] a from s, regexp_matches(u, '(?:^|[^A-Z0-9])([ABC][1-8]|E[4-9]|E1[01])(?=[^A-Z0-9]|$)', 'g') m
    union all select 'API ' || m[1] from s, regexp_matches(u, '(?:^|[^A-Z0-9])(S[G-Q]|C[D-K](?:-4)?)(?=[^A-Z0-9+]|$)', 'g') m
    union all select 'VW ' || m[1] || '.' || m[2] from s, regexp_matches(u, '(?:^|[^0-9])(50[0-9]|51[0-9])[ .]?(0[0-9])(?=[^0-9]|$)', 'g') m
    union all select 'MB ' || m[1] || '.' || m[2] from s, regexp_matches(u, '(?:MB[ -]?|[^0-9])(22[0-9])[.](\d{1,2})(?=[^0-9]|$)', 'g') m
    union all select 'BMW LL-' || m[1] from s, regexp_matches(u, '(?:LONGLIFE|BMW[ -]?LL)[ -]?(\d{2})', 'g') m
    union all select 'RN' || lpad(m[1], 4, '0') from s, regexp_matches(u, 'RN[ -]?(0?7\d{2}|17)', 'g') m
    union all select 'GM dexos' || m[1] from s, regexp_matches(u, 'DEXOS[ -]?(\d)', 'g') m
    union all select 'Ford M2C' || m[1] from s, regexp_matches(u, 'M2C[ -]?(\d{3})', 'g') m
    union all select 'Porsche A40' from s where u ~ 'PORSCHE[ -]?A40'
  ) x;
$$;

-- Approvals of a product: from the program, otherwise from the name
create or replace function public.product_approvals(t text, a text[]) returns text[]
language sql immutable as $$
  select case when cardinality(a) > 0
    then coalesce(nullif(public.parse_approvals(array_to_string(a, ' ; ')), '{}'), a)
    else public.parse_approvals(t) end;
$$;

-- Title words for "same product line" matching: viscosity (10w40) and volume (4l, 1л, 0,87кг) do not count
create or replace function public.title_words(t text) returns text[]
language sql immutable as $$
  select coalesce(array_agg(distinct w), '{}') from regexp_split_to_table(lower(coalesce(t, '')), '[^a-zа-яіїєґ0-9]+') w
  where length(w) >= 3 and w !~ '^\d+$' and w !~ '^\d{1,2}w\d{0,2}$' and w !~ '^\d+(l|л|кг|kg|мл|ml|гр|г)$' and w not in (
    'масло','масла','моторное','моторна','моторне','моторний','моторное','олива','оливи','трансмиссионное','трансмісійна',
    'фильтр','фільтр','масляний','масляный','маслянный','воздушный','повітряний','салона','салону','паливний','топливный',
    'для','with','the','oil','new','synt','motor','engine','комплект','набор','набір','шт','уп','упак','acea','api','ace',
    'вир','виробництва','пр','производства','про','вугільний','угольный','cdti','tdi','tsi','crdi','dci','hdi','gls',
    'mann','mahle','knecht','bosch','wix','wixfiltron','ufi','valeo','filtron','hengst','sct','profit','nipparts','champion','purflux','delphi',
    'asam','kolbenschmidt','herth','buss','jakoparts','hbj','hbe','elparts','знайдено','найдено','за','pmc','nahle','невский','alpha','альфа',
    'синій','синий','метал','металл','metal','metall');
$$;

-- Analogs order: 0 cross number → 1 same oil, other volume → 2 same viscosity + same approvals → 3 same viscosity / same car.
-- Each analog carries "reason": cross | volume | approvals | similar. The product's own approvals are returned too.
create or replace function public.product_related(p_id bigint)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  p record; k text; v text; w text[]; nums text[]; appr text[];
  cross_ids bigint[]; analogs jsonb; comps jsonb; is_oil boolean;
begin
  select id, title, category_id, search_numbers, approvals into p from tyres where id = p_id;
  if not found then return jsonb_build_object('analogs', '[]'::jsonb, 'companions', '[]'::jsonb, 'approvals', '[]'::jsonb); end if;
  k := product_kind(p.title, p.category_id); v := viscosity(p.title); w := title_words(p.title);
  is_oil := k in ('oil_engine', 'oil_trans');
  appr := case when is_oil then product_approvals(p.title, p.approvals) else '{}' end;
  nums := array(select n from unnest(string_to_array(coalesce(p.search_numbers, ''), ' ')) n where length(n) >= 4);

  select coalesce(array_agg(id), '{}') into cross_ids from (
    select t.id from tyres t
    where cardinality(nums) > 0 and string_to_array(t.search_numbers, ' ') && nums
      and t.id <> p.id and t.in_stock is not false and t.on_order is not true and t.hidden_on_site is not true
    order by t.has_photo desc, t.stock_quantity desc nulls last limit 8
  ) c;

  with cross_rows as (
    select t.id, t.title, t.slug, t.price, t.image_url, t.image_thumb_url, t.manufacturer, t.on_order,
           'cross'::text as reason, 0 as grp, 0 as shared, 0 as overlap, t.has_photo, t.stock_quantity
    from tyres t where t.id = any(cross_ids)
  ), pool as (
    select t.id, t.title, t.slug, t.price, t.image_url, t.image_thumb_url, t.manufacturer, t.on_order, t.has_photo, t.stock_quantity,
           cardinality(array(select unnest(title_words(t.title)) intersect select unnest(w))) as overlap,
           case when is_oil then cardinality(array(select unnest(product_approvals(t.title, t.approvals)) intersect select unnest(appr))) else 0 end as shared
    from tyres t
    where t.id <> p.id and not (t.id = any(cross_ids)) and t.in_stock is not false and t.on_order is not true and t.hidden_on_site is not true
      and t.category_id = p.category_id
      and product_kind(t.title, t.category_id) = k
      and (v is null or viscosity(t.title) = v)
  ), similar_rows as (
    select id, title, slug, price, image_url, image_thumb_url, manufacturer, on_order,
           case when is_oil and cardinality(w) > 0 and overlap >= least(2, cardinality(w)) then 'volume'
                when shared > 0 then 'approvals' else 'similar' end as reason,
           case when is_oil and cardinality(w) > 0 and overlap >= least(2, cardinality(w)) then 1
                when shared > 0 then 2 else 3 end as grp,
           shared, overlap, has_photo, stock_quantity
    from pool
    where (k not like 'filter\_%' or overlap >= 1)
  )
  select coalesce(jsonb_agg(to_jsonb(x) - 'grp' - 'shared' - 'overlap' - 'has_photo' - 'stock_quantity'
                            order by grp, shared desc, overlap desc, has_photo desc, stock_quantity desc nulls last), '[]') into analogs from (
    select * from (select * from cross_rows union all select * from similar_rows) u
    order by grp, shared desc, overlap desc, has_photo desc, stock_quantity desc nulls last limit 12
  ) x;

  with rules(kind, target, n) as (values
    ('oil_engine','filter_oil',4), ('oil_engine','filter_air',2), ('oil_engine','flush',2),
    ('flush','oil_engine',4), ('flush','filter_oil',4),
    ('oil_trans','cat_60',3), ('oil_trans','cat_21',3),
    ('filter_oil','oil_engine',5), ('filter_oil','filter_air',3),
    ('filter_air','filter_cabin',3), ('filter_air','filter_oil',3), ('filter_air','oil_engine',2),
    ('filter_cabin','filter_air',3), ('filter_cabin','cat_71',3),
    ('filter_fuel','filter_air',3), ('filter_fuel','filter_oil',2), ('filter_fuel','cat_39',3),
    ('cat_41','cat_111',4), ('cat_41','cat_18',3), ('cat_111','cat_41',5),
    ('cat_33','cat_102',5), ('cat_102','cat_33',4), ('cat_102','cat_105',3),
    ('cat_70','cat_66',5), ('cat_66','cat_70',4),
    ('cat_92','cat_100',3), ('cat_92','cat_99',3), ('cat_100','cat_27',3), ('cat_27','cat_100',3),
    ('cat_3','cat_115',3), ('cat_3','cat_57',3), ('cat_3','cat_26',2), ('cat_115','cat_3',3), ('cat_57','cat_115',3),
    ('cat_24','cat_51',2), ('cat_24','cat_55',2), ('cat_24','cat_74',2), ('cat_24','cat_108',2),
    ('cat_47','cat_117',3), ('cat_47','cat_89',3), ('cat_117','cat_47',3), ('cat_117','cat_62',2), ('cat_89','cat_47',3), ('cat_89','cat_122',3),
    ('cat_126','cat_122',4), ('cat_122','cat_126',4),
    ('cat_64','cat_108',4), ('cat_64','cat_127',3),
    ('cat_45','filter_air',3), ('cat_45','oil_engine',3),
    ('cat_105','cat_102',3), ('cat_105','cat_21',3),
    ('cat_61','cat_36',3), ('cat_61','cat_119',3),
    ('cat_17','cat_71',3), ('cat_17','cat_18',3), ('cat_71','cat_17',3),
    ('cat_76','cat_60',4), ('cat_21','cat_60',3),
    ('cat_68','cat_76',3), ('cat_68','cat_60',3)
  ), cand as (
    select t.id, t.title, t.slug, t.price, t.image_url, t.image_thumb_url, t.manufacturer, t.on_order, r.target, r.n,
           row_number() over (partition by r.target order by
             cardinality(array(select unnest(title_words(t.title)) intersect select unnest(w))) desc,
             (v is not null and viscosity(t.title) = v) desc, t.has_photo desc, t.stock_quantity desc nulls last) rn
    from rules r
    join tyres t on (case when r.target like 'cat\_%' then t.category_id = substr(r.target, 5)::bigint
                          else t.category_id in (81, 101) and product_kind(t.title, t.category_id) = r.target end)
    where r.kind = k and t.id <> p.id and not (t.id = any(cross_ids)) and t.in_stock is not false and t.on_order is not true and t.hidden_on_site is not true
  )
  select coalesce(jsonb_agg(to_jsonb(c) - 'target' - 'n' - 'rn'), '[]') into comps from (select * from cand where rn <= n order by target, rn) c;

  return jsonb_build_object('analogs', analogs, 'companions', comps, 'approvals', to_jsonb(appr));
end $$;
