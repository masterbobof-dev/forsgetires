-- Re-check of automatically attached photos with the strict rules (photo-finder action "recheck").
alter table tyres add column if not exists photo_rechecked_at timestamptz;
-- temporary job, removed when everything is checked:
-- select cron.schedule('photo-recheck', '* * * * *', $c$ select net.http_post(url := 'https://zzxueclhkhvwdmxflmyx.supabase.co/functions/v1/photo-finder', headers := jsonb_build_object('Content-Type','application/json','x-sync-key',(select value from private.integration_secrets where name='program_sync_token')), body := '{"action":"recheck","n":6}'::jsonb, timeout_milliseconds := 150000) $c$);
