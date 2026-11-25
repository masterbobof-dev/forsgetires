-- Characteristics read from titles for 14 more sections (terminals, ignition, air fresheners, oil seals, clamps,
-- bearings, gloves, shock absorbers, relays, fasteners, hoses, brakes, gaskets, dust boots, jacks, cables).
create or replace function public.auto_attrs_more(t text, preset text) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  s text := lower(coalesce(t, ''));
  u text := upper(coalesce(t, ''));
  r jsonb := '{}';
  m text[];
  a numeric; b numeric;
begin
  if preset = 'terminals' then
    if s !~ '(клем)' then return r; end if;
    if s ~ '(прикур|провід|провод)' then r := r || '{"term_kind":"wire"}';
    else
      if s ~ '(компл|к-т|2\s*шт|\(\s*\+\s*/?\s*-\s*\))' then r := r || '{"term_pole":"pair"}';
      elsif s ~ '(\(\s*\+\s*\)|\+\s*\(|плюс)' then r := r || '{"term_pole":"plus"}';
      elsif s ~ '(\(\s*-\s*\)|мінус|минус)' then r := r || '{"term_pole":"minus"}';
      elsif s ~ '(клеммы|клеми)' then r := r || '{"term_pole":"pair"}'; end if;
    end if;
    if s ~ '(латун)' then r := r || '{"material":"brass"}';
    elsif s ~ '(свин)' then r := r || '{"material":"lead"}';
    elsif s ~ '(цинк)' then r := r || '{"material":"zinc"}';
    elsif s ~ '(алюм)' then r := r || '{"material":"alu"}';
    elsif s ~ '(мідь|медь|медн|\dcu)' then r := r || '{"material":"copper"}'; end if;
  elsif preset = 'ignition' then
    if s ~ '(розжар|накал)' then r := r || '{"ign_type":"glow"}';
    elsif s ~ '(свеч|свіч)' then r := r || '{"ign_type":"plug"}';
    elsif s ~ '(провод|дрот)' then r := r || '{"ign_type":"wires"}';
    elsif s ~ '(катушк|котушк)' then r := r || '{"ign_type":"coil"}';
    elsif s ~ '(бегунок|бігунок)' then r := r || '{"ign_type":"rotor"}';
    elsif s ~ '(крышка|кришка)' then r := r || '{"ign_type":"cap"}';
    elsif s ~ '(замок)' then r := r || '{"ign_type":"lock"}';
    elsif s ~ '(модуль|коммутатор|комутатор)' then r := r || '{"ign_type":"module"}'; end if;
    if r ->> 'ign_type' = 'plug' then
      m := regexp_match(s, '(16|21)\s?(mm|мм)');
      if m is not null then r := r || jsonb_build_object('plug_key', m[1]); end if;
      if s ~ '(ирид|ірид|iridium)' then r := r || '{"plug_metal":"iridium"}';
      elsif s ~ '(платин|platinum)' then r := r || '{"plug_metal":"platinum"}'; end if;
      m := coalesce(regexp_match(u, '(?:^|[^0-9A-Z])(8|16)\s?V(?=[^A-Z0-9]|$)'), regexp_match(u, '(?:^|[^A-Z])V(8|16)(?=[^0-9]|$)'), regexp_match(s, '(8|16)\s?кл'));
      if m is not null then r := r || jsonb_build_object('valves', m[1]); end if;
      if s ~ '(компл|к-т|4\s*шт)' then r := r || '{"pack":"kit"}'; end if;
      if s ~ '(мото|скутер)' then r := r || '{"plug_for":"moto"}'; end if;
    end if;
  elsif preset = 'fresheners' then
    if s !~ '(аромат|освіжув|освежит|спрей|запах|пахуч)' then return r; end if;
    if s ~ '(спрей|spray)' then r := r || '{"scent_form":"spray"}';
    elsif s ~ '(обдув|дефлектор|решітк|решетк)' then r := r || '{"scent_form":"vent"}';
    elsif s ~ '(консерв)' then r := r || '{"scent_form":"can"}';
    elsif s ~ '(мешоч|мішеч|pearls)' then r := r || '{"scent_form":"bag"}';
    elsif s ~ '(жидк|рідк|капсул|\d\s?ml|\d\s?мл)' then r := r || '{"scent_form":"liquid"}';
    elsif s ~ '(торпед|панел)' then r := r || '{"scent_form":"dash"}';
    elsif s ~ '(подвес|підвіс|карточк|картк|листок|smile)' then r := r || '{"scent_form":"hanging"}'; end if;
  elsif preset = 'seals' then
    if s ~ '(клапан)' then r := r || '{"seal_place":"valve"}';
    elsif s ~ '(коленвал|колінвал)' then r := r || '{"seal_place":"crank"}';
    elsif s ~ '(распредвал|розподіл)' then r := r || '{"seal_place":"cam"}';
    elsif s ~ '(полуос|півос|привод)' then r := r || '{"seal_place":"axle"}';
    elsif s ~ '(ступиц|маточ)' then r := r || '{"seal_place":"hub"}';
    elsif s ~ '(кпп|штока|первичн|редуктор|хвостовик)' then r := r || '{"seal_place":"gearbox"}'; end if;
    m := regexp_match(s, '(\d{2,3}(?:[.,]\d)?)\s*[*xх×]\s*(\d{2,3}(?:[.,]\d)?)\s*[*xх×]\s*(\d{1,2}(?:[.,]\d)?)');
    if m is not null then r := r || jsonb_build_object('seal_size', replace(m[1] || '×' || m[2] || '×' || m[3], ',', '.')); end if;
    if s ~ '(компл|к-т)' then r := r || '{"pack":"kit"}'; end if;
  elsif preset = 'clamps' then
    if s ~ '(пластик)' then r := r || '{"clamp_type":"plastic"}';
    elsif s ~ '(глушител)' then r := r || '{"clamp_type":"exhaust"}';
    elsif s ~ '(шрус|пыльник|пильник)' then r := r || '{"clamp_type":"cv"}';
    elsif s ~ '(силов)' then r := r || '{"clamp_type":"power"}';
    elsif s ~ '(черв|метал|нерж|оцинк)' then r := r || '{"clamp_type":"worm"}'; end if;
    if r ->> 'clamp_type' = 'plastic' then
      m := regexp_match(s, '(\d{1,3}(?:[.,]\d)?)\s*[xх×]\s*(\d{1,3}(?:[.,]\d)?)');
      if m is not null then
        a := replace(m[1], ',', '.')::numeric; b := replace(m[2], ',', '.')::numeric;
        r := r || jsonb_build_object('clamp_size', least(a, b)::text || '×' || greatest(a, b)::text);
      end if;
    elsif r ->> 'clamp_type' in ('worm', 'power') then
      m := regexp_match(s, '(?:^|[^0-9a-zа-я-])0?(\d{1,3})\s*-\s*(\d{2,3})(?![0-9-])');
      if m is not null and m[1]::int < m[2]::int then r := r || jsonb_build_object('clamp_size', m[1] || '–' || m[2]); end if;
    end if;
  elsif preset = 'bearings' then
    if s ~ '(ступиц|маточ)' then r := r || '{"bearing_type":"hub"}';
    elsif s ~ '(выжим|вижим)' then r := r || '{"bearing_type":"release"}';
    elsif s ~ '(опорн)' then r := r || '{"bearing_type":"strut"}';
    elsif s ~ '(\m6[0-3]\d{2}|кульк|шарик)' then r := r || '{"bearing_type":"ball"}'; end if;
    m := regexp_match(u, '(?:^|[^0-9A-Z.])(6[0-3]\d{2})(?=[^0-9]|$)');
    if m is not null then r := r || jsonb_build_object('bearing_no', m[1]); end if;
    if u ~ '2RS' then r := r || '{"bearing_seal":"2RS"}'; elsif u ~ '(ZZ|2Z)' then r := r || '{"bearing_seal":"ZZ"}'; end if;
    if r ? 'bearing_type' and r ->> 'bearing_type' in ('hub') then
      if s ~ '(перед)' then r := r || '{"pos":"front"}'; elsif s ~ '(зад)' then r := r || '{"pos":"rear"}'; end if;
    end if;
  elsif preset = 'gloves' then
    m := regexp_match(s, '(?:^|[^a-zа-я])р\.?\s?(\d{1,2})(?![0-9])');
    if m is not null then r := r || jsonb_build_object('glove_size', m[1]); end if;
    if s ~ '(нітрил|нитрил)' then r := r || '{"coating":"nitrile"}';
    elsif s ~ '(латекс)' then r := r || '{"coating":"latex"}';
    elsif s ~ '(поліурет|полиурет)' then r := r || '{"coating":"pu"}';
    elsif s ~ '(пвх)' then r := r || '{"coating":"pvc"}'; end if;
  elsif preset = 'shocks' then
    if s ~ '(багажник|капот|упор)' then r := r || '{"shock_type":"trunk"}';
    elsif s ~ '(пружин)' then r := r || '{"shock_type":"spring"}';
    elsif s !~ '(амортизатор)' then return r;
    elsif s ~ '(газомасл|газо-масл|\mгаз)' then r := r || '{"shock_type":"gasoil"}';
    elsif s ~ '(масл)' then r := r || '{"shock_type":"oil"}';
    else r := r || '{"shock_type":"shock"}'; end if;
    if r ->> 'shock_type' <> 'trunk' then
      if s ~ '(перед)' then r := r || '{"pos":"front"}'; elsif s ~ '(зад)' then r := r || '{"pos":"rear"}'; end if;
    end if;
  elsif preset = 'relays' then
    m := coalesce(regexp_match(s, '(\d{1,2})\s*-?\s*(?:[xх]|ти|х)?\s*-?\s*конт'), regexp_match(s, '(\d{1,2})\s*контакт'));
    if m is not null then r := r || jsonb_build_object('contacts', m[1]); end if;
    m := regexp_match(u, '(?:^|[^0-9])(\d{2,3})\s?(?:A|А|АМПЕР)(?=[^A-ZА-Я0-9]|$)');
    if m is not null then r := r || jsonb_build_object('amp', m[1]); end if;
    m := regexp_match(u, '(?:^|[^0-9])(12|24)\s?(?:V|В|ВОЛЬТ)');
    if m is not null then r := r || jsonb_build_object('voltage', m[1]); end if;
    if s ~ '(поворот)' then r := r || '{"relay_for":"turn"}';
    elsif s ~ '(дворник|склоочис)' then r := r || '{"relay_for":"wiper"}';
    elsif r ? 'contacts' then r := r || '{"relay_for":"universal"}'; end if;
  elsif preset = 'fasteners' then
    if s ~ '(гайк)' then r := r || '{"fast_type":"nut"}';
    elsif s ~ '(шпильк|гужон)' then r := r || '{"fast_type":"stud"}';
    elsif s ~ '(шайб)' then r := r || '{"fast_type":"washer"}';
    elsif s ~ '(болт|гвинт|винт)' then r := r || '{"fast_type":"bolt"}'; end if;
    m := regexp_match(u, '[MМ]\s?(\d{1,2})\s?[XХ×]\s?(?:\d{2,3}\s?[XХ×]\s?)?([012][.,]\d{1,2})');
    if m is not null then r := r || jsonb_build_object('thread', 'M' || m[1] || '×' || replace(m[2], ',', '.'));
    else
      m := regexp_match(u, '(?:^|[^A-ZА-Я0-9])[MМ]\s?(\d{1,2})(?=[^0-9]|$)');
      if m is not null then r := r || jsonb_build_object('thread', 'M' || m[1]); end if;
    end if;
    m := regexp_match(s, 'ключ\s*№?\s*(\d{2})');
    if m is not null then r := r || jsonb_build_object('key_size', m[1]); end if;
    if s ~ '(колес)' then r := r || '{"fast_for":"wheel"}'; end if;
  elsif preset = 'hoses' then
    m := coalesce(regexp_match(s, '(?:ø|d)\s*(\d{1,2})\s*(?:мм|mm)'), regexp_match(s, '(?:^|[^0-9,.])(\d{1,2})\s*(?:мм|mm)'));
    if m is not null then r := r || jsonb_build_object('hose_d', m[1]); end if;
    if s ~ '(топлив|палив)' then r := r || '{"hose_for":"fuel"}';
    elsif s ~ '(газа|газу|гбо)' then r := r || '{"hose_for":"gas"}';
    elsif s ~ '(тормоз|гальм)' then r := r || '{"hose_for":"brake"}';
    elsif s ~ '(вакуум)' then r := r || '{"hose_for":"vacuum"}';
    elsif s ~ '(універс|универс)' then r := r || '{"hose_for":"universal"}'; end if;
  elsif preset = 'brakes' then
    if s ~ '(ремкомпл|монтажн|пружин)' then r := r || '{"brake_part":"kit"}';
    elsif s ~ '(колодк)' then r := r || '{"brake_part":"pads"}';
    elsif s ~ '(диск)' then r := r || '{"brake_part":"disc"}';
    elsif s ~ '(барабан)' then r := r || '{"brake_part":"drum"}';
    elsif s ~ '(трубк)' then r := r || '{"brake_part":"pipe"}';
    elsif s ~ '(шланг)' then r := r || '{"brake_part":"hose"}';
    elsif s ~ '(цилиндр|циліндр)' then r := r || '{"brake_part":"cyl"}';
    elsif s ~ '(трос)' then r := r || '{"brake_part":"cable"}';
    elsif s ~ '(суппорт|супорт)' then r := r || '{"brake_part":"caliper"}'; end if;
    if s ~ '(перед)' then r := r || '{"pos":"front"}'; elsif s ~ '(зад)' then r := r || '{"pos":"rear"}'; end if;
  elsif preset = 'gaskets' then
    if s ~ '(гбц|головки блок)' then r := r || '{"gasket_place":"head"}';
    elsif s ~ '(клапанн|крыш/клап|кришки клап)' then r := r || '{"gasket_place":"valvecover"}';
    elsif s ~ '(коллектор|колектор)' then r := r || '{"gasket_place":"manifold"}';
    elsif s ~ '(поддон|піддон|картер)' then r := r || '{"gasket_place":"pan"}';
    elsif s ~ '(приемн|приймальн|глушит)' then r := r || '{"gasket_place":"exhaust"}';
    elsif s ~ '(дроссел|дросел)' then r := r || '{"gasket_place":"throttle"}';
    elsif s ~ '(насос)' then r := r || '{"gasket_place":"pump"}';
    elsif s ~ '(термостат)' then r := r || '{"gasket_place":"thermostat"}';
    elsif s ~ '(кольцо|кільце)' then r := r || '{"gasket_place":"ring"}'; end if;
    if s ~ '(компл|к-т|набор|набір)' then r := r || '{"pack":"kit"}'; end if;
  elsif preset = 'boots' then
    if s ~ '(шрус)' then r := r || '{"boot_place":"cv"}';
    elsif s ~ '(рейк)' then r := r || '{"boot_place":"rack"}';
    elsif s ~ '(амортизатор|стойк|стійк)' then r := r || '{"boot_place":"shock"}';
    elsif s ~ '(наконечник|тяг)' then r := r || '{"boot_place":"tie"}';
    elsif s ~ '(шаров|кульов)' then r := r || '{"boot_place":"ball"}';
    elsif s ~ '(суппорт|супорт)' then r := r || '{"boot_place":"caliper"}';
    elsif s ~ '(кулис|передач|кпп)' then r := r || '{"boot_place":"gear"}'; end if;
    if r ->> 'boot_place' = 'cv' then
      if s ~ '(наружн|зовнішн)' then r := r || '{"boot_side":"outer"}'; elsif s ~ '(внутр)' then r := r || '{"boot_side":"inner"}'; end if;
    end if;
  elsif preset = 'jacks' then
    if s ~ '(компрес)' then r := r || '{"tool_kind":"compressor"}';
    elsif s ~ '(домкрат)' then r := r || '{"tool_kind":"jack"}';
    elsif s ~ '(манометр)' then r := r || '{"tool_kind":"gauge"}';
    elsif s ~ '(ключ)' then r := r || '{"tool_kind":"wrench"}'; end if;
    if r ->> 'tool_kind' = 'jack' then
      m := regexp_match(s, '(\d(?:[.,]\d)?)\s?т(?![a-zа-яіїє])');
      if m is not null then r := r || jsonb_build_object('load_t', replace(m[1], ',', '.')); end if;
      if s ~ '(подкатн|підкатн)' then r := r || '{"jack_type":"trolley"}';
      elsif s ~ '(ромб)' then r := r || '{"jack_type":"scissor"}';
      elsif s ~ '(гидравл|гідравл|бутыл|пляшк)' then r := r || '{"jack_type":"bottle"}'; end if;
    elsif r ->> 'tool_kind' = 'compressor' then
      m := regexp_match(s, '(\d{2,3})\s?л\s?/\s?(?:мин|хв)');
      if m is not null then r := r || jsonb_build_object('flow', m[1]); end if;
    end if;
  elsif preset = 'cables' then
    if s ~ '(буксир)' then r := r || '{"cable_kind":"tow"}';
    elsif s ~ '(ручн|ручник)' then r := r || '{"cable_kind":"handbrake"}';
    elsif s ~ '(сцеплен|зчеплен)' then r := r || '{"cable_kind":"clutch"}';
    elsif s ~ '(газа|газу|акселер)' then r := r || '{"cable_kind":"gas"}';
    elsif s ~ '(спидометр|спідометр)' then r := r || '{"cable_kind":"speedo"}';
    elsif s ~ '(капот)' then r := r || '{"cable_kind":"hood"}'; end if;
    if r ->> 'cable_kind' = 'tow' then
      m := regexp_match(s, '(\d{1,2}(?:[.,]\d)?)\s?т(?![a-zа-яіїє])');
      if m is not null then r := r || jsonb_build_object('load_t', replace(m[1], ',', '.')); end if;
      m := regexp_match(s, '(\d{1,2}(?:[.,]\d)?)\s?м(?![a-zа-яіїє])');
      if m is not null then r := r || jsonb_build_object('len_m', replace(m[1], ',', '.')); end if;
    end if;
  end if;
  return r;
end $$;

-- auto_attrs calls it for these presets (patch of the live function body)
do $do$
declare d text;
begin
  select pg_get_functiondef('public.auto_attrs(text,bigint)'::regprocedure) into d;
  if d not like '%auto_attrs_more%' then
    d := regexp_replace(d, '\n\s*return r;\s*\n\s*end', E'\n  if preset is not null then r := r || public.auto_attrs_more(t, preset); end if;\n  return r;\nend');
    execute d;
  end if;
end $do$;

update public.product_categories set filter_preset = v.p from (values
  (115,'terminals'),(45,'ignition'),(71,'fresheners'),(21,'seals'),(20,'clamps'),(131,'bearings'),(119,'gloves'),(24,'shocks'),
  (27,'relays'),(114,'fasteners'),(38,'hoses'),(41,'brakes'),(76,'gaskets'),(108,'boots'),(94,'jacks'),(23,'cables')) v(id, p)
  where product_categories.id = v.id;
update public.tyres set attributes = attributes where category_id in (115,45,71,21,20,131,119,24,27,114,38,41,76,108,94,23);
