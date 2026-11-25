-- 1) Supplier price-list titles ("BOSCH BO F026407071 1 672 66 Фільтр масляний ... Знайдено за: ...") are shown clean:
--    "Фільтр масляний ... BOSCH F026407071"; brand and article fill the empty manufacturer / catalog_number.
--    public.clean_title_parts(t) (applied live) returns {title, brand?, article?}.
-- 2) Better reading of battery / oil characteristics from titles.

create or replace function private.tyres_auto_attrs() returns trigger language plpgsql set search_path = public, private as $$
declare c jsonb;
begin
  if true then
    c := public.clean_title_parts(new.title);
    new.title := c->>'title';
    if c ? 'brand' and coalesce(new.manufacturer, '') = '' then new.manufacturer := c->>'brand'; end if;
    if c ? 'article' and coalesce(new.catalog_number, '') = '' then new.catalog_number := c->>'article'; end if;
  end if;
  new.attributes := public.auto_attrs(new.title, new.category_id) || coalesce(new.attributes, '{}');
  new.auto_approvals := case when (select coalesce(parent_id, id) from public.product_categories where id = new.category_id) = 4
    then nullif(public.product_approvals(new.title, new.approvals), '{}') end;
  return new;
end $$;

create or replace function public.parse_approvals(t text) returns text[]
language sql immutable set search_path = public as $$
  with s as (select ' ' || upper(coalesce(t, '')) || ' ' as u)
  select coalesce(array_agg(distinct a order by a), '{}') from (
    select 'ACEA ' || m[1] a from s, regexp_matches(u, '(?:^|[^A-Z0-9])([ABC][1-8]|E[4-9]|E1[01])(?=[^A-Z0-9]|$)', 'g') m
    union all select 'API ' || m[1] from s, regexp_matches(u, '(?:^|[^A-Z0-9])(S[G-Q]|C[D-K](?:-4)?)(?=[^A-Z0-9+]|$)(?![ -]?MATIC)', 'g') m
    union all select 'VW ' || m[1] || '.' || m[2] from s, regexp_matches(u, '(?:^|[^0-9])(50[0-9]|51[0-9])[ .]?(0[0-9])(?=[^0-9]|$)', 'g') m
    union all select 'MB ' || m[1] || '.' || m[2] from s, regexp_matches(u, '(?:MB[ -]?|[^0-9])(22[0-9])[.](\d{1,2})(?=[^0-9]|$)', 'g') m
    union all select 'BMW LL-' || m[1] from s, regexp_matches(u, '(?:LONGLIFE|BMW[ -]?LL)[ -]?(\d{2})', 'g') m
    union all select 'RN' || lpad(m[1], 4, '0') from s, regexp_matches(u, 'RN[ -]?(0?7\d{2}|17)', 'g') m
    union all select 'GM dexos' || m[1] from s, regexp_matches(u, 'DEXOS[ -]?(\d)', 'g') m
    union all select 'Ford M2C' || m[1] from s, regexp_matches(u, 'M2C[ -]?(\d{3})', 'g') m
    union all select 'Porsche A40' from s where u ~ 'PORSCHE[ -]?A40'
  ) x;
$$;

create or replace function public.auto_attrs(t text, cat bigint) returns jsonb
language plpgsql stable set search_path = public as $$
declare
  s text := lower(coalesce(t, ''));
  r jsonb := '{}';
  m text[];
  v numeric;
  root bigint;
begin
  select coalesce(c.parent_id, c.id) into root from public.product_categories c where c.id = cat;
  if root = 3 and cat = 3 then
    m := coalesce(regexp_match(s, '(\d{2,3})\s*(ah|аг|а·?год|ач)'), regexp_match(s, '6\s*ст\s*-?\s*(\d{2,3})'));
    if m is not null then r := r || jsonb_build_object('capacity', m[1]); end if;
    if s ~ '(r\s*\+|\(\s*-\s*/?\s*\+\s*\)|прав|\me0\M|\(r\))' then r := r || '{"polarity":"right"}';
    elsif s ~ '(l\s*\+|\(\s*\+\s*/?\s*-\s*\)|лів|\me1\M|\(l\))' then r := r || '{"polarity":"left"}'; end if;
    if s ~ '(азія|азия|asia|\mjis\M)' then r := r || '{"body":"asia"}';
    elsif s ~ '(євро|евро|euro)' then r := r || '{"body":"euro"}'; end if;
    m := coalesce(regexp_match(s, 'пт\s*(\d{3,4})'), regexp_match(s, '(\d{3,4})\s*(a|а)?\s*\(?\s*en'), regexp_match(s, '\m(\d{3,4})\s*(a|а)\M'), regexp_match(s, '(?:ah|аг|ач)\s+(\d{3,4})\s+[rl]\s*\+'), regexp_match(s, '\(?[rl]\)?\s+(\d{3,4})\s*(?:a|а)?\s*$'));
    if m is not null and m[1]::int between 200 and 1500 then r := r || jsonb_build_object('current', m[1]); end if;
    m := regexp_match(s, '(\d{3})\s*[*x×х]\s*(\d{3})\s*[*x×х]\s*(\d{3})');
    if m is not null then r := r || jsonb_build_object('size', m[1] || '×' || m[2] || '×' || m[3]); end if;
    m := regexp_match(s, '\m(6|12|24)\s*v\M');
    if m is not null then r := r || jsonb_build_object('voltage', m[1]); end if;
  elsif root = 4 then
    if public.viscosity(s) is not null then r := r || jsonb_build_object('viscosity', upper(public.viscosity(s))); end if;
    m := regexp_match(s, '(\d+(?:[.,]\d+)?)\s*(л|l|lt|ltr|литр|літр)(?![a-zа-яіїє])');
    if m is not null then
      v := replace(m[1], ',', '.')::numeric;
      if v > 0 and v <= 220 then r := r || jsonb_build_object('volume', (case when v = trunc(v) then trunc(v)::text else rtrim(v::text, '0') end)); end if;
    else
      m := regexp_match(s, '(\d{2,4})\s*(мл|ml)\M');
      if m is not null then r := r || jsonb_build_object('volume', rtrim(rtrim(round(m[1]::numeric / 1000, 3)::text, '0'), '.')); end if;
    end if;
    if s ~ '(atf|dexron|декстрон|\mcvt\M|\mdsg\M|варіатор|вариатор)' then r := r || '{"oil_type":"atf"}';
    elsif s ~ '(gl-?\s?\d|трансм|getriebe|\m(75|80|85)w)' then r := r || '{"oil_type":"trans"}';
    elsif s ~ '(гальмівн|тормозн|brake|\mdot\s?-?\d)' then r := r || '{"oil_type":"brake"}';
    elsif s ~ '(антифриз|тосол|охолодж|coolant)' then r := r || '{"oil_type":"coolant"}';
    elsif public.viscosity(s) is not null or s ~ '(моторн|motor|engine)' then r := r || '{"oil_type":"engine"}';
    end if;
  end if;
  return r;
end $$;

-- backfill
update public.tyres set title = title where public.clean_title_parts(title)->>'title' <> title;
update public.tyres t set attributes = t.attributes - 'current' - 'polarity' where t.category_id = 3;
update public.tyres t set attributes = t.attributes - 'volume' where t.category_id in (select id from public.product_categories where id = 4 or parent_id = 4);

-- 3) public.home_recommended(p_n, p_skip) — goods for the home page: what visitors view / put in the cart (30 days),
--    spread over sections, with a photo and price >= 100 UAH. Security definer (reads analytics), applied live.
