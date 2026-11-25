-- Characteristics read from titles for lamps, wipers, coolant, brake fluid, fuses, filters and belts (filter presets on those sections).
create or replace function public.auto_attrs(t text, cat bigint) returns jsonb
language plpgsql stable set search_path = public as $$
declare
  s text := lower(coalesce(t, ''));
  r jsonb := '{}';
  m text[];
  v numeric;
  root bigint;
  preset text;
  u text := upper(coalesce(t, ''));
begin
  select coalesce(c.parent_id, c.id), coalesce(c.filter_preset, p.filter_preset) into root, preset
    from public.product_categories c left join public.product_categories p on p.id = c.parent_id where c.id = cat;
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

  if preset = 'lamps' then
    m := regexp_match(u, '(?:^|[^A-Z0-9])(H1[1-9]|H2[17]|HB[1-5]|HIR2|H[1-9]|D[1-4][SR]|P21/5W|W21/5W|PY21W|WY21W|P21W|W21W|W16W|WY5W|W5W|W3W|W1[.,]2W|R10W|R5W|C10W|C5W|T4W|H6W|H21W|P27W|P27/7W|T10|T15|T20|T25|BA15S|BAY15D|BAU15S|BA9S|SV8[.,]5)(?=[^A-Z0-9]|$)');
    if m is not null then r := r || jsonb_build_object('lamp_base', replace(m[1], ',', '.')); end if;
    m := regexp_match(u, '(?:^|[^0-9])(12|24|6)\s?V(?=[^A-Z]|$)');
    if m is not null then r := r || jsonb_build_object('voltage', m[1]); end if;
    m := regexp_match(u, '(?:^|[^0-9/.,])(\d{1,3}(?:[.,]\d)?(?:/\d{1,3})?)\s?W(?=[^A-Z0-9]|$)');
    if m is not null then r := r || jsonb_build_object('power', replace(m[1], ',', '.')); end if;
    if s ~ '(\mled\M|світлодіод|светодиод|\msmd\M)' then r := r || '{"lamp_tech":"led"}';
    elsif s ~ '(ксенон|xenon|\md[1-4][sr]\M)' then r := r || '{"lamp_tech":"xenon"}';
    elsif s ~ '(галоген|halogen|\mh\d{1,2}\M|\mhb[1-5]\M)' then r := r || '{"lamp_tech":"halogen"}';
    elsif r ? 'lamp_base' then r := r || '{"lamp_tech":"bulb"}'; end if;
    m := regexp_match(u, '(?:^|[^0-9])([3-8])(?:[.,]\d)?K(?=[^A-Z0-9]|$)|(?:^|[^0-9])([3-8]\d00)\s?K(?=[^A-Z0-9]|$)');
    if m is not null then r := r || jsonb_build_object('color_temp', coalesce(m[2], m[1] || '000')); end if;
  elsif preset = 'wipers' then
    m := regexp_match(s, '(\d{3})\s*/\s*(\d{3})\s*(мм|mm)?');
    if m is not null then r := r || jsonb_build_object('length', m[1] || '/' || m[2]);
    else
      m := coalesce(regexp_match(s, '(\d{3})\s*(мм|mm)'), regexp_match(s, '\m(\d{2})\s*(см|cm)'), regexp_match(s, 'стеклоочистител\w*\s+(\d{3})\M'));
      if m is not null then r := r || jsonb_build_object('length', case when length(m[1]) = 2 then m[1] || '0' else m[1] end); end if;
    end if;
    if s ~ '(безкаркас|бескаркас|aerotwin|flat)' then r := r || '{"wiper_type":"flat"}';
    elsif s ~ '(гібрид|гибрид|hybrid)' then r := r || '{"wiper_type":"hybrid"}';
    elsif s ~ '(каркас)' then r := r || '{"wiper_type":"frame"}'; end if;
    if s ~ '(к-т|компл|\mkit\M|\d{3}\s*/\s*\d{3})' then r := r || '{"pack":"kit"}'; end if;
  elsif preset = 'coolant' then
    m := regexp_match(u, '(G1[123]\s?(?:\+\+|\+|PLUS)?|CT1[12]|G48|G30|G33|G34|G40)');
    if m is not null then r := r || jsonb_build_object('coolant_std', replace(replace(m[1], ' ', ''), 'PLUS', '+')); end if;
    if s ~ '(красн|червон|red)' then r := r || '{"color":"red"}';
    elsif s ~ '(зелен|green)' then r := r || '{"color":"green"}';
    elsif s ~ '(син|blue)' then r := r || '{"color":"blue"}';
    elsif s ~ '(желт|жовт|yellow)' then r := r || '{"color":"yellow"}';
    elsif s ~ '(фиолет|фіолет|violet|лилов)' then r := r || '{"color":"violet"}';
    elsif s ~ '(оранж|помаранч|orange)' then r := r || '{"color":"orange"}'; end if;
    if s ~ '(конц)' then r := r || '{"coolant_kind":"concentrate"}';
    elsif s ~ '(тосол)' then r := r || '{"coolant_kind":"tosol"}';
    elsif s ~ '(дист)' then r := r || '{"coolant_kind":"water"}';
    elsif s ~ '(антифриз|охолодж|охлажд)' then r := r || '{"coolant_kind":"ready"}'; end if;
  elsif preset = 'brakefluid' then
    m := regexp_match(u, '(?:DOT|ДОТ)\s?-?\s?([345](?:[.,]1)?)');
    if m is not null then r := r || jsonb_build_object('dot', 'DOT ' || replace(m[1], ',', '.')); end if;
  elsif preset = 'fuses' then
    m := regexp_match(u, '(?:^|[^0-9])(\d{1,3})\s?[AА](?=[^A-ZА-Я0-9]|$)');
    if m is not null then r := r || jsonb_build_object('amp', m[1]); end if;
    if s ~ '(супер міні|супер мини|micro|мікро|микро)' then r := r || '{"fuse_type":"micro"}';
    elsif s ~ '(міні|мини|\matm\M)' then r := r || '{"fuse_type":"mini"}';
    elsif s ~ '(максі|макси|maxi)' then r := r || '{"fuse_type":"maxi"}';
    elsif s ~ '(катридж|картридж)' then r := r || '{"fuse_type":"cartridge"}';
    elsif s ~ '(старого|циліндр|цилиндр)' then r := r || '{"fuse_type":"old"}';
    elsif s ~ '(євро|евро|плоск)' then r := r || '{"fuse_type":"standard"}'; end if;
  elsif preset = 'filters' then
    if s ~ '(маслян|масляний|\moil\M)' then r := r || '{"filter_type":"oil"}';
    elsif s ~ '(салон|cabin)' then r := r || '{"filter_type":"cabin"}';
    elsif s ~ '(воздуш|повітр|\mair\M)' then r := r || '{"filter_type":"air"}';
    elsif s ~ '(газа|газу|\mгбо\M)' then r := r || '{"filter_type":"gas"}';
    elsif s ~ '(топлив|паливн|fuel|бензонасос)' then r := r || '{"filter_type":"fuel"}'; end if;
  elsif preset = 'belts' then
    if s ~ '(ролик)' then r := r || '{"belt_type":"roller"}';
    elsif s ~ '(натяж|натяг)' then r := r || '{"belt_type":"tensioner"}';
    elsif s ~ '(\mгрм\M|зубчат)' then r := r || '{"belt_type":"timing"}';
    elsif s ~ '(поліклин|поликлин|\d\s?pk\s?\d{3,4}|генер)' then r := r || '{"belt_type":"poly"}';
    elsif s ~ '(ремень|ремінь)' then r := r || '{"belt_type":"other"}'; end if;
    m := regexp_match(u, '(\d{1,2})\s?PK\s?(\d{3,4})');
    if m is not null then r := r || jsonb_build_object('belt_size', m[1] || 'PK' || m[2]); end if;
  end if;
  return r;
end $$;

update public.product_categories set filter_preset = v.p from (values (92,'lamps'),(66,'wipers'),(33,'coolant'),(111,'brakefluid'),(100,'fuses'),(101,'filters'),(105,'belts')) v(id, p) where product_categories.id = v.id;
update public.tyres set attributes = attributes where category_id in (92,66,33,111,100,101,105);
