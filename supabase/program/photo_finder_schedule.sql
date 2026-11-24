-- Fast photo search for all goods without a photo (run in the SITE project).
-- Each minute: one batched search (100 products) + 10 download workers (8 products each) ≈ 80 photos/min.
-- Stops itself when nothing is left.
select cron.schedule('photo-finder', '* * * * *', $c$
  select case
    when (select (public.photo_job_status()->>'to_search')::int + (public.photo_job_status()->>'to_download')::int) = 0
      then (select cron.unschedule('photo-finder'))::int::bigint
    else (
      select count(net.http_post(url := 'https://zzxueclhkhvwdmxflmyx.supabase.co/functions/v1/photo-finder',
        headers := jsonb_build_object('Content-Type','application/json','x-sync-key',(select value from private.integration_secrets where name='program_sync_token')),
        body := case when g = 0 then '{"action":"search","n":100}'::jsonb else '{"action":"download","n":8}'::jsonb end,
        timeout_milliseconds := 150000))
      from generate_series(0, 10) g)
  end
$c$);

-- 2026-11-24: the search now runs only for products queued by staff in the admin panel ("Фото ШІ" → "Запустити пошук"):
--   public.photo_queue(category_id | null, limit)  — queue products of a category (with subcategories) and start the job
--   public.photo_queue_stop()                       — clear the queue and stop the job
--   public.photo_status_staff(), public.photo_category_stats() — progress and per-category counts for the panel
--   public.photo_cron_ensure()                      — (re)creates the 'photo-finder' cron job; it stops itself when done
