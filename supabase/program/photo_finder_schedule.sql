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
