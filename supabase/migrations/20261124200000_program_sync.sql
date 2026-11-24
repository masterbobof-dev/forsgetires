-- Catalog sync: products from the shop program (project zuhanlspejgizjbwbnda) -> site tyres table.
-- The site pulls changes every 2 minutes (edge function program-sync); program tables are never written.

create table if not exists backups.tyres_before_program_sync as select * from public.tyres;
create table if not exists backups.product_categories_before_program_sync as select * from public.product_categories;

alter table public.tyres add column if not exists program_product_id uuid;
alter table public.tyres add column if not exists program_category_id uuid;
alter table public.tyres add column if not exists hidden_on_site boolean not null default false;
alter table public.tyres add column if not exists program_synced_at timestamptz;
create unique index if not exists tyres_program_product_id_key on public.tyres (program_product_id);

alter table public.product_categories add column if not exists program_category_ids uuid[] not null default '{}';
create index if not exists product_categories_program_ids_idx on public.product_categories using gin (program_category_ids);

create table if not exists private.sync_state (
  name text primary key,
  cursor_at timestamptz not null default '1970-01-01',
  cursor_id uuid not null default '00000000-0000-0000-0000-000000000000',
  last_run_at timestamptz,
  last_ok_at timestamptz,
  last_count int,
  last_error text,
  full_resync_at timestamptz
);
insert into private.sync_state(name) values ('program_catalog') on conflict do nothing;

-- Which site section a program category goes to (by program category name).
create table if not exists private.program_category_rules (
  program_name text primary key,
  root_slug text,          -- site root category slug; null = hidden (not for the site)
  sub_name text            -- site subcategory name; null = put directly into the root
);

create or replace function private.slugify_uk(t text) returns text language plpgsql immutable as $$
declare s text := lower(coalesce(t,''));
begin
  s := replace(s,'щ','shch'); s := replace(s,'ж','zh'); s := replace(s,'х','kh'); s := replace(s,'ц','ts');
  s := replace(s,'ч','ch'); s := replace(s,'ш','sh'); s := replace(s,'ю','yu'); s := replace(s,'я','ya');
  s := replace(s,'є','ye'); s := replace(s,'ї','yi'); s := replace(s,'ё','yo');
  s := translate(s, 'абвгґдезийклмнопрстуфыэіъь', 'abvhgdezyyklmnoprstufyei');
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  return left(trim(both '-' from s), 60);
end $$;

-- Site roots for program goods
insert into public.product_categories (name, slug, parent_id, icon, sort_order, is_active, kind)
select 'Автозапчастини', 'avtozapchastyny', null, 'wrench', 35, true, 'generic'
where not exists (select 1 from public.product_categories where slug = 'avtozapchastyny');
insert into public.product_categories (name, slug, parent_id, icon, sort_order, is_active, kind)
select 'Не для сайту', 'ne-dlya-saytu', null, 'package', 999, false, 'generic'
where not exists (select 1 from public.product_categories where slug = 'ne-dlya-saytu');

insert into private.program_category_rules(program_name, root_slug, sub_name) values
 ('Оливи-ATF','masla','Оливи та ATF'), ('Хімія','masla','Автохімія'), ('Присадка','masla','Присадки'),
 ('Охлаждающая жидкость','masla','Охолоджуюча рідина'), ('Охолоджуюча рідина','masla','Охолоджуюча рідина'),
 ('Рідина омивача','masla','Рідина омивача'), ('Гальмівна рідина','masla','Гальмівна рідина'),
 ('Силікон-Мастило','masla','Мастила та силікон'), ('Очисник гальм','masla','Очисники'),
 ('Очисник карбюратора','masla','Очисники'), ('Очисник контактів','masla','Очисники'),
 ('Герметик','masla','Герметики та фіксатори'), ('Фіксатор різьби','masla','Герметики та фіксатори'),
 ('АКБ','akumulyatory',null), ('Клема','akumulyatory','Клеми'), ('Зарядні пристрої','akumulyatory','Зарядні пристрої'),
 ('Швидкий старт','akumulyatory','Пуско-зарядні'), ('Крокодили','akumulyatory','Пускові дроти'),
 ('Диск','dysky',null), ('Ковпаки','dysky','Ковпаки'), ('Шини','shyny',null),
 ('Автомобільні аксесуари','avtotovary','Аксесуари'), ('Ароматизатори','avtotovary','Ароматизатори'),
 ('Ліхтарики','avtotovary','Ліхтарики'), ('Поліроль-Віск','avtotovary','Догляд за авто'),
 ('Ганчірки-Мочалки','avtotovary','Догляд за авто'), ('Инструмент ручной','avtotovary','Інструмент'),
 ('Інструмент ручний','avtotovary','Інструмент'), ('Інструмент електричний','avtotovary','Інструмент'),
 ('Свердло','avtotovary','Інструмент'), ('Домкрати','avtotovary','Домкрати та компресори'),
 ('Авто-компрессор','avtotovary','Домкрати та компресори'), ('Авто-компресор','avtotovary','Домкрати та компресори'),
 ('Манометр','avtotovary','Домкрати та компресори'), ('Щітки','avtotovary','Щітки склоочисника'),
 ('Фарба-Ґрунт-Лак','avtotovary','Фарби та кузовний ремонт'), ('Шпаклівка','avtotovary','Фарби та кузовний ремонт'),
 ('Папір наждачний','avtotovary','Фарби та кузовний ремонт'), ('Мастика-Мовіль-Бітум','avtotovary','Фарби та кузовний ремонт'),
 ('Клей-Скотч','avtotovary','Клей та скотч'), ('Рукавички','avtotovary','Рукавички'), ('Наклейки','avtotovary','Наклейки'),
 ('Брелоки','avtotovary','Брелоки'), ('Автомагнитола','avtotovary','Автомагнітоли'), ('Автомагнітола','avtotovary','Автомагнітоли'),
 ('Оплетка на кермо','avtotovary','Аксесуари'), ('Батарейки','avtotovary','Батарейки'), ('Рамка номера','avtotovary','Аксесуари'),
 ('Тонувальна плівка','avtotovary','Аксесуари'), ('Авто-діагностика','avtotovary','Автодіагностика'),
 ('Вогнегасник','avtotovary','Автомобільна аптечка та безпека'), ('Трос','avtotovary','Троси та буксирування'),
 ('Шумоізоляція','avtotovary','Шумоізоляція'), ('Бризковики-підкрилки','avtotovary','Бризковики та підкрилки'),
 ('Насадка на глушник','avtotovary','Аксесуари'), ('Салон','avtotovary','Салон'), ('Ковпачки','avtotovary','Аксесуари'),
 ('Инструмент','avtotovary','Інструмент'),
 ('Электрика','avtozapchastyny','Електрика'), ('Електрика','avtozapchastyny','Електрика'),
 ('Выхлопная система','avtozapchastyny','Вихлопна система'), ('Вихлопна система','avtozapchastyny','Вихлопна система'),
 ('Топливная система','avtozapchastyny','Паливна система'), ('Паливна система','avtozapchastyny','Паливна система'),
 ('Електробензонасоси','avtozapchastyny','Паливна система'), ('Гальма','avtozapchastyny','Гальмівна система'),
 ('Колодки','avtozapchastyny','Гальмівна система'), ('Іномарка в наявності','avtozapchastyny',null),
 ('Нові товари','avtozapchastyny',null), ('Atom','avtozapchastyny',null), ('Рос. запчастини Зеніт (номенклатура)','avtozapchastyny',null),
 ('Напої+Соки+Енергетики',null,null), ('Кава та напої',null,null), ('Снеки та хотдоги',null,null),
 ('Прилади для стрижки',null,null), ('Шиномонтаж',null,null)
on conflict (program_name) do update set root_slug = excluded.root_slug, sub_name = excluded.sub_name;

-- Make sure a program category is mapped to a site category; returns the site category id.
create or replace function private.ensure_program_category(p_id uuid, p_name text) returns bigint
language plpgsql security definer set search_path = public, private as $$
declare
  v_cat bigint; v_root bigint; v_root_slug text; v_sub text; v_has_rule boolean;
begin
  select id into v_cat from product_categories where program_category_ids @> array[p_id] order by parent_id nulls last limit 1;
  if v_cat is not null then return v_cat; end if;

  select true, root_slug, sub_name into v_has_rule, v_root_slug, v_sub from program_category_rules where program_name = trim(p_name);
  if not coalesce(v_has_rule, false) then v_root_slug := 'avtozapchastyny'; v_sub := trim(p_name); end if;
  if v_root_slug is null then v_root_slug := 'ne-dlya-saytu'; v_sub := null; end if;

  select id into v_root from product_categories where slug = v_root_slug and parent_id is null;
  if v_sub is null then
    v_cat := v_root;
  else
    select id into v_cat from product_categories where parent_id = v_root and lower(name) = lower(v_sub) limit 1;
    if v_cat is null then
      insert into product_categories (name, slug, parent_id, icon, sort_order, is_active, kind)
      values (v_sub,
              left(v_root_slug || '-' || private.slugify_uk(v_sub), 70) ||
                case when exists (select 1 from product_categories where slug = left(v_root_slug || '-' || private.slugify_uk(v_sub), 70)) then '-' || substr(md5(p_id::text), 1, 4) else '' end,
              v_root, null, 100, true,
              (select kind from product_categories where id = v_root))
      returning id into v_cat;
    end if;
  end if;
  update product_categories set program_category_ids = array_append(program_category_ids, p_id) where id = v_cat;
  return v_cat;
end $$;

-- Apply a page of changes from the program export.
create or replace function private.program_sync_apply(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  c jsonb; p jsonb; v_cat bigint; v_visible boolean; v_price numeric; v_qty numeric;
  v_ins int := 0; v_upd int := 0; v_photo text; v_cat_active boolean;
  v_catmap jsonb := '{}'::jsonb;
  v_auto bigint := (select id from product_categories where slug = 'avtozapchastyny' and parent_id is null);
begin
  for c in select * from jsonb_array_elements(coalesce(payload->'categories', '[]')) loop
    v_catmap := v_catmap || jsonb_build_object(c->>'id', ensure_program_category((c->>'id')::uuid, c->>'name'));
  end loop;

  for p in select * from jsonb_array_elements(coalesce(payload->'products', '[]')) loop
    v_cat := coalesce((v_catmap->>(p->>'category_id'))::bigint,
                      (select id from product_categories where program_category_ids @> array[(p->>'category_id')::uuid] limit 1),
                      v_auto);
    -- category hidden (itself or its root) -> product hidden
    select coalesce(c1.is_active, true) and coalesce(c2.is_active, true) into v_cat_active
      from product_categories c1 left join product_categories c2 on c2.id = c1.parent_id where c1.id = v_cat;
    v_price := coalesce((p->>'retail_price')::numeric, 0) / 100.0;
    v_qty := coalesce((p->>'qty_on_hand')::numeric, 0);
    v_visible := coalesce((p->>'active')::boolean, false) and v_qty > 0 and v_price > 0 and coalesce(v_cat_active, true);
    v_photo := coalesce(p->'photos'->>0, nullif(p->>'photo_url', ''));

    update tyres t set
      title = p->>'name',
      price = trim(to_char(v_price, 'FM9999999990.00')),
      catalog_number = nullif(p->>'sku', ''),
      product_number = nullif(p->>'barcode', ''),
      manufacturer = nullif(p->>'brand', ''),
      stock_quantity = greatest(floor(v_qty), 0)::int,
      in_stock = v_visible and not t.hidden_on_site,
      category_id = v_cat,
      program_category_id = nullif(p->>'category_id', '')::uuid,
      image_url = coalesce(t.image_url, v_photo),
      attributes = coalesce(t.attributes, '{}'::jsonb)
                   || coalesce(nullif(p->'specs', 'null'::jsonb), '{}'::jsonb)
                   || case when nullif(p->>'oem_number', '') is not null then jsonb_build_object('oem', p->>'oem_number') else '{}'::jsonb end,
      program_synced_at = now()
    where t.program_product_id = (p->>'id')::uuid;

    if found then
      v_upd := v_upd + 1;
    elsif v_visible then
      insert into tyres (program_product_id, title, price, catalog_number, product_number, manufacturer, stock_quantity,
                         in_stock, category_id, program_category_id, image_url, attributes, season, vehicle_type, program_synced_at)
      values ((p->>'id')::uuid, p->>'name', trim(to_char(v_price, 'FM9999999990.00')), nullif(p->>'sku', ''), nullif(p->>'barcode', ''),
              nullif(p->>'brand', ''), greatest(floor(v_qty), 0)::int, true, v_cat, nullif(p->>'category_id', '')::uuid, v_photo,
              coalesce(nullif(p->'specs', 'null'::jsonb), '{}'::jsonb)
                || case when nullif(p->>'oem_number', '') is not null then jsonb_build_object('oem', p->>'oem_number') else '{}'::jsonb end,
              null, null, now());
      v_ins := v_ins + 1;
    end if;
  end loop;

  return jsonb_build_object('inserted', v_ins, 'updated', v_upd);
end $$;

revoke all on function private.program_sync_apply(jsonb) from public, anon, authenticated;
revoke all on function private.ensure_program_category(uuid, text) from public, anon, authenticated;

-- Edge functions call these through PostgREST (service role only)
create or replace function public.program_sync_apply(payload jsonb) returns jsonb
language sql security definer set search_path = public, private as $$ select private.program_sync_apply(payload) $$;
revoke all on function public.program_sync_apply(jsonb) from public, anon, authenticated;
grant execute on function public.program_sync_apply(jsonb) to service_role;

create or replace function public.program_sync_state() returns jsonb
language sql security definer set search_path = public, private as $$
  select to_jsonb(s) || jsonb_build_object('token', (select value from integration_secrets where name = 'program_sync_token'))
  from sync_state s where name = 'program_catalog' $$;
revoke all on function public.program_sync_state() from public, anon, authenticated;
grant execute on function public.program_sync_state() to service_role;

create or replace function public.program_sync_save(p_cursor_at timestamptz, p_cursor_id uuid, p_count int, p_error text, p_full boolean default false) returns void
language sql security definer set search_path = public, private as $$
  update sync_state set
    cursor_at = coalesce(p_cursor_at, cursor_at), cursor_id = coalesce(p_cursor_id, cursor_id),
    last_run_at = now(), last_ok_at = case when p_error is null then now() else last_ok_at end,
    last_count = p_count, last_error = p_error,
    full_resync_at = case when p_full then now() else full_resync_at end
  where name = 'program_catalog' $$;
revoke all on function public.program_sync_save(timestamptz, uuid, int, text, boolean) from public, anon, authenticated;
grant execute on function public.program_sync_save(timestamptz, uuid, int, text, boolean) to service_role;

-- Applied afterwards (live version of the functions differs from the above only by these):
--  * program_sync_apply: specs/oem merged via v_attrs (specs used only when it is a JSON object)
--  * internal program SKUs like "AUTO-…" are not shown to customers:
create or replace function private.clean_sku(s text) returns text language sql immutable as $$ select case when s ilike 'AUTO-%' then null else nullif(s, '') end $$;
--    (program_sync_apply uses private.clean_sku(p->>'sku') for catalog_number)
--  * schedules:
-- select cron.schedule('program-sync', '*/2 * * * *', $c$ select net.http_post(url := 'https://zzxueclhkhvwdmxflmyx.supabase.co/functions/v1/program-sync', headers := jsonb_build_object('Content-Type','application/json','x-sync-key',(select value from private.integration_secrets where name='program_sync_token')), body := '{}'::jsonb, timeout_milliseconds := 150000) $c$);
-- select cron.schedule('program-sync-full-reset', '17 1 * * *', $c$ update private.sync_state set cursor_at = '1970-01-01', cursor_id = '00000000-0000-0000-0000-000000000000', full_resync_at = now() where name = 'program_catalog' $c$);
