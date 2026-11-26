-- Partner goods (tyres.supplier_offer_id, ~22k rows from the program) are not kept in the daily copies:
-- the program sends them again by itself. The check "backup is incomplete" now compares with own goods only.
-- Applied live with apply_migration; this file is the record.
create or replace function backups.run_daily(keep_days integer default 14)
 returns text language plpgsql security definer set search_path to 'backups', 'public', 'pg_temp'
as $function$
declare
  t text;
  stamp text := to_char(now() at time zone 'Europe/Kyiv', 'YYYYMMDD');
  old record;
  made int := 0;
begin
  foreach t in array array['tyres','product_categories','tyre_orders','customer_profiles','product_reviews','settings','suppliers','articles'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop table if exists backups.%I', t || '_' || stamp);
      if t = 'tyres' then
        execute format('create table backups.%I as select * from public.tyres where supplier_offer_id is null', t || '_' || stamp);
      else
        execute format('create table backups.%I as table public.%I', t || '_' || stamp, t);
      end if;
      made := made + 1;
    end if;
  end loop;
  for old in
    select tablename from pg_tables
    where schemaname = 'backups' and tablename ~ '_[0-9]{8}$'
      and to_date(right(tablename, 8), 'YYYYMMDD') < (now() at time zone 'Europe/Kyiv')::date - keep_days
  loop
    execute format('drop table backups.%I', old.tablename);
  end loop;
  return format('%s tables copied (%s)', made, stamp);
end $function$;

-- the health check: compare today's copy with own goods only
create or replace function private.site_problems()
 returns text[] language plpgsql security definer set search_path to 'public', 'private', 'cron'
as $function$
declare p text[] := '{}'; s record; n int; n_busy int; jobs text; stamp text := to_char(now() at time zone 'Europe/Kyiv', 'YYYYMMDD');
begin
  select * into s from private.sync_state where name = 'program_catalog';
  if s.last_ok_at is null or s.last_ok_at < now() - interval '60 minutes' then
    p := p || format('Обмін з програмою не працює вже %s хв (перевірте, чи увімкнена програма й інтернет на її комп''ютері)', coalesce(round(extract(epoch from now() - s.last_ok_at) / 60)::text, '?'));
  end if;
  if s.last_error is not null then p := p || ('Помилка обміну з програмою: ' || left(s.last_error, 150)); end if;
  select count(*) into n from private.sync_log where note = 'guard' and run_at > now() - interval '24 hours';
  if n > 0 then p := p || 'Програма прислала неповний каталог — сайт нічого не приховав, перевірте програму'; end if;
  select count(*) filter (where return_message ilike '%startup timeout%' or return_message ilike '%statement timeout%'),
         count(*) filter (where not (return_message ilike '%startup timeout%' or return_message ilike '%statement timeout%')),
         string_agg(distinct j.jobname, ', ') filter (where not (d.return_message ilike '%startup timeout%' or d.return_message ilike '%statement timeout%'))
    into n_busy, n, jobs
    from cron.job_run_details d left join cron.job j using (jobid)
   where d.status = 'failed' and d.start_time > now() - interval '1 hour';
  if n_busy >= 5 then
    p := p || format('База даних перевантажена: %s фонових задач за годину не встигли запуститися. Зазвичай це наплив роботів, минає саме, покупці сайт бачать. Якщо триває понад 3 години — напишіть розробнику', n_busy);
  end if;
  if n > 0 then p := p || format('Фонових задач з помилкою за годину: %s (%s)', n, jobs); end if;
  select count(*) into n from net._http_response where created > now() - interval '1 hour' and (status_code >= 500 or status_code is null) and coalesce(status_code, 0) <> 546;
  if n >= 5 then p := p || format('Збоїв серверних функцій за годину: %s', n); end if;
  if extract(hour from now() at time zone 'Europe/Kyiv') >= 4 and to_regclass('backups.tyres_' || stamp) is null then
    p := p || 'Сьогоднішню резервну копію не створено';
  elsif to_regclass('backups.tyres_' || stamp) is not null then
    execute format('select count(*) from backups.%I', 'tyres_' || stamp) into n;
    if n < (select count(*) * 0.9 from tyres where supplier_offer_id is null) then p := p || format('Резервна копія неповна: %s товарів', n); end if;
  end if;
  if coalesce((select (value::jsonb->>'at')::timestamptz from settings where key = 'backup_export_at'), now() - interval '9 days') < now() - interval '2 days' then
    p := p || 'Зовнішня резервна копія (сховище) не оновлювалась понад 2 дні';
  end if;
  select count(*) into n from analytics_events where event_type = 'js_error' and created_at > now() - interval '1 hour';
  if n >= 10 then p := p || format('Помилок на сайті у покупців за годину: %s', n); end if;
  return p;
end $function$;
