-- Applied live 2026-11-25
-- * private.sync_log + public.program_sync_log(jsonb) (service_role) + public.program_sync_history(int) (staff): journal of program syncs, 30 days
-- * program_sync_hide_missing: refuses to hide more than max(50, 20%) of in-stock products; writes a 'guard' row, health alert
-- * tyres.thumb_error; trigger tyres_reset_thumb clears image_thumb_url when image_url changes without a new thumb
-- * edge function make-thumbs + cron "make-thumbs" (every minute, only while products without thumbnails exist)
-- * private.cleanup_old() weekly (cron "cleanup-old"): analytics > 400 days, js_error > 60 days, cron log > 14 days
-- * dropped duplicate index idx_tyres_is_hot
alter table tyres add column if not exists thumb_error text;
