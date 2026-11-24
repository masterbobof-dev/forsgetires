-- Characteristics read from the product title, so category filters work without manual input.
-- Values the program sends in attributes always win; we only fill missing keys.
-- Batteries: capacity, polarity (right/left), body (euro/asia), current, size, voltage.
-- Oils & fluids: viscosity, volume (litres), oil_type, approval list (tyres.auto_approvals).

create or replace function public.auto_attrs(t text, cat bigint) returns jsonb
language plpgsql immutable as $$
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
    if s ~ '(r\s*\+|\(\s*-\s*/?\s*\+\s*\)|прав|\me0\M)' then r := r || '{"polarity":"right"}';
    elsif s ~ '(l\s*\+|\(\s*\+\s*/?\s*-\s*\)|лів|\me1\M)' then r := r || '{"polarity":"left"}'; end if;
    if s ~ '(азія|азия|asia|\mjis\M)' then r := r || '{"body":"asia"}';
    elsif s ~ '(євро|евро|euro)' then r := r || '{"body":"euro"}'; end if;
    m := coalesce(regexp_match(s, 'пт\s*(\d{3,4})'), regexp_match(s, '(\d{3,4})\s*(a|а)?\s*\(?\s*en'), regexp_match(s, '\m(\d{3,4})\s*(a|а)\M'));
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
      if v > 0 and v <= 220 then r := r || jsonb_build_object('volume', trim(trailing '.' from trim(trailing '0' from v::text))); end if;
    else
      m := regexp_match(s, '(\d{2,4})\s*(мл|ml)\M');
      if m is not null then r := r || jsonb_build_object('volume', trim(trailing '.' from trim(trailing '0' from (m[1]::numeric / 1000)::text))); end if;
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

alter table public.tyres add column if not exists auto_approvals text[];
create index if not exists tyres_auto_approvals_idx on public.tyres using gin (auto_approvals);

create or replace function private.tyres_auto_attrs() returns trigger language plpgsql as $$
begin
  new.attributes := public.auto_attrs(new.title, new.category_id) || coalesce(new.attributes, '{}');
  new.auto_approvals := case when (select coalesce(parent_id, id) from public.product_categories where id = new.category_id) = 4
    then nullif(public.product_approvals(new.title, new.approvals), '{}') end;
  return new;
end $$;
drop trigger if exists tyres_auto_attrs on public.tyres;
create trigger tyres_auto_attrs before insert or update of title, category_id, attributes, approvals on public.tyres
  for each row execute function private.tyres_auto_attrs();

update public.product_categories set filter_preset = 'oils' where id = 4;
