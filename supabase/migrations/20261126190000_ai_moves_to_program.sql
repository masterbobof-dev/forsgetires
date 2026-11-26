-- AI on the site is switched off: the program's AI helper writes product SEO (title, description, keywords)
-- and sends it with the products through program-sync. Applied to the live database on 2026-11-26.
do $$ begin perform cron.unschedule('seo-ai-auto'); exception when others then null; end $$;
insert into settings (key, value) values ('seo_mode', 'manual') on conflict (key) do update set value = 'manual';
-- private.program_sync_apply: in the update, before lead_days:
--   seo_title = coalesce(nullif(btrim(p->>'seo_title'), ''), t.seo_title),
--   seo_description = coalesce(nullif(btrim(p->>'seo_description'), ''), t.seo_description),
--   seo_keywords = coalesce(nullif(btrim(p->>'seo_keywords'), ''), t.seo_keywords),
-- and after inserting a new product the same three fields are set when the program sent them.
