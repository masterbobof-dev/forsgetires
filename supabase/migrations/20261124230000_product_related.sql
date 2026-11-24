-- "Аналоги" and "З цим купують" for the product window.
-- Analogs: same kind of product (same oil viscosity / same filter type), closest by title words.
-- Companions: rule based (engine oil → oil & air filters, flush; oil filter → engine oils; brakes → brake fluid ...).

create or replace function public.title_words(t text) returns text[]
language sql immutable as $$
  select coalesce(array_agg(distinct w), '{}') from regexp_split_to_table(lower(coalesce(t, '')), '[^a-zа-яіїєґ0-9]+') w
  where length(w) >= 3 and w !~ '^\d+$' and w not in (
    'масло','масла','моторное','моторна','моторне','моторний','олива','оливи','трансмиссионное','трансмісійна',
    'фильтр','фільтр','масляний','масляный','маслянный','воздушный','повітряний','салона','салону','паливний','топливный',
    'для','with','the','oil','new','synt','motor','engine','комплект','набор','набір','шт','уп','упак',
    'mann','mahle','knecht','bosch','wix','ufi','valeo','filtron','hengst','sct','profit','nipparts','champion','purflux','delphi',
    'asam','kolbenschmidt','herth','buss','jakoparts','hbj','hbe','elparts','знайдено','найдено','за','pmc','nahle','невский','alpha','альфа');
$$;

create or replace function public.viscosity(t text) returns text
language sql immutable as $$
  select (m)[1] || 'w' || (m)[2] from (select regexp_match(lower(coalesce(t, '')), '(\d{1,2})\s*w\s*-?\s*(\d{2})') m) x;
$$;

create or replace function public.product_kind(t text, cat bigint) returns text
language sql immutable as $$
  select case
    when cat = 81 and t ~* '(gl-?\d|трансм|getriebe|atf|dsg|dct|тад|tad|cvt|гидрав|гідрав)' then 'oil_trans'
    when cat = 81 and t ~* '(промыв|промив|flush)' then 'flush'
    when cat = 81 and t ~* '(2t|2т)' then 'oil_2t'
    when cat = 81 and public.viscosity(t) is not null then 'oil_engine'
    when cat = 101 and t ~* 'масл' then 'filter_oil'
    when cat = 101 and t ~* '(возд|повітр)' then 'filter_air'
    when cat = 101 and t ~* 'салон' then 'filter_cabin'
    when cat = 101 and t ~* '(палив|топл)' then 'filter_fuel'
    else 'cat_' || coalesce(cat, 0)
  end;
$$;

create or replace function public.product_related(p_id bigint)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  p record; k text; v text; w text[];
  analogs jsonb; comps jsonb;
begin
  select id, title, category_id into p from tyres where id = p_id;
  if not found then return jsonb_build_object('analogs', '[]'::jsonb, 'companions', '[]'::jsonb); end if;
  k := product_kind(p.title, p.category_id); v := viscosity(p.title); w := title_words(p.title);

  with pool as (
    select t.id, t.title, t.slug, t.price, t.image_url, t.image_thumb_url, t.manufacturer, t.on_order, t.has_photo, t.stock_quantity, t.category_id,
           cardinality(array(select unnest(title_words(t.title)) intersect select unnest(w))) as overlap
    from tyres t
    where t.id <> p.id and t.in_stock is not false and t.on_order is not true and t.hidden_on_site is not true
      and t.category_id = p.category_id
  )
  select coalesce(jsonb_agg(to_jsonb(x) - 'overlap' - 'has_photo' - 'stock_quantity' - 'category_id'), '[]') into analogs from (
    select * from pool
    where product_kind(pool.title, pool.category_id) = k
      and (v is null or viscosity(pool.title) = v)
      and (k not like 'filter\_%' or overlap >= 1)
    order by overlap desc, has_photo desc, stock_quantity desc nulls last limit 8
  ) x;

  -- companions: list of (kind or category, how many)
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
    where r.kind = k and t.id <> p.id and t.in_stock is not false and t.on_order is not true and t.hidden_on_site is not true
  )
  select coalesce(jsonb_agg(to_jsonb(c) - 'target' - 'n' - 'rn'), '[]') into comps from (select * from cand where rn <= n order by target, rn) c;

  return jsonb_build_object('analogs', analogs, 'companions', comps);
end $$;

grant execute on function public.product_related(bigint) to anon, authenticated;
