-- Applied live 2026-11-25: backups outside the database
-- * private Storage bucket "backups"; edge function backup-export writes backups/YYYY-MM-DD/<table>.json.gz, keeps 30 days
-- * cron "backup-export" 01:37 UTC daily; result saved in settings.backup_export_at
-- * private.site_problems() also checks: today's in-database copy has >= 90% of products; outside copy not older than 2 days
insert into storage.buckets(id, name, public) values ('backups', 'backups', false) on conflict do nothing;
