-- SEO tab: hide sections from Google, redirects, health check, AI/manual mode
alter table tyres add column if not exists seo_auto_at timestamptz;
alter table product_categories add column if not exists noindex boolean not null default false;

create table if not exists seo_redirects (
  from_path text primary key check (from_path like '/%'),
  to_path text not null,
  hits int not null default 0,
  created_at timestamptz not null default now()
);
alter table seo_redirects enable row level security;
drop policy if exists read_all on seo_redirects;
create policy read_all on seo_redirects for select using (true);
drop policy if exists staff_write on seo_redirects;
create policy staff_write on seo_redirects for all using (public.is_staff()) with check (public.is_staff());

create or replace function public.seo_redirect_hit(p text) returns void language sql security definer set search_path = public as
$$ update seo_redirects set hits = hits + 1 where from_path = p $$;
grant execute on function public.seo_redirect_hit(text) to anon, authenticated;

insert into settings(key, value) values ('seo_mode', 'manual') on conflict (key) do nothing;

create or replace function public.seo_health() returns jsonb language sql stable security definer set search_path = public as $$
  with p as (select * from tyres where in_stock is not false and program_product_id is not null),
  dup as (select lower(trim(coalesce(nullif(seo_title,''), title))) t, count(*) n from p group by 1 having count(*) > 1)
  select case when not public.is_staff() then null else jsonb_build_object(
    'products', (select count(*) from p),
    'no_seo_title', (select count(*) from p where coalesce(seo_title,'') = ''),
    'no_seo_desc', (select count(*) from p where coalesce(seo_description,'') = ''),
    'long_title', (select count(*) from p where length(seo_title) > 70),
    'short_desc', (select count(*) from p where seo_description <> '' and length(seo_description) < 70),
    'dup_groups', (select count(*) from dup),
    'dup_products', (select coalesce(sum(n),0) from dup),
    'dup_examples', (select coalesce(jsonb_agg(t), '[]') from (select t from dup order by n desc limit 5) x),
    'no_photo', (select count(*) from p where image_url is null),
    'no_text', (select count(*) from p where coalesce(description,'') = ''),
    'thin', (select count(*) from p where image_url is null and coalesce(description,'') = ''),
    'cats', (select count(*) from product_categories where is_active),
    'cats_no_text', (select count(*) from product_categories where is_active and coalesce(description,'') = ''),
    'cats_no_title', (select count(*) from product_categories where is_active and coalesce(seo_title,'') = ''),
    'cats_hidden', (select count(*) from product_categories where noindex),
    'redirects', (select count(*) from seo_redirects),
    'ai_done', (select count(*) from p where seo_auto_at is not null and coalesce(seo_title,'') <> '')
  ) end
$$;
grant execute on function public.seo_health() to authenticated;

-- AI SEO: every 10 minutes; the function itself does nothing while seo_mode = 'manual'
select cron.unschedule('seo-ai-auto') where exists (select 1 from cron.job where jobname = 'seo-ai-auto');
select cron.schedule('seo-ai-auto', '*/10 * * * *', $c$
  select net.http_post(
    url := 'https://zzxueclhkhvwdmxflmyx.supabase.co/functions/v1/seo-ai',
    headers := jsonb_build_object('Content-Type','application/json','x-sync-key',(select value from private.integration_secrets where name='program_sync_token')),
    body := '{"action":"auto_seo"}'::jsonb, timeout_milliseconds := 120000)
$c$);
