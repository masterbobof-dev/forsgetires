-- One-off job that copies product photos from third-party sites into our Storage
-- (see supabase/functions/image-migrate). Applied on 2026-11-24; the cron job
-- unschedules itself when nothing is left to do.
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
ALTER TABLE public.tyres ADD COLUMN IF NOT EXISTS image_source_url text;   -- original link (to undo)
ALTER TABLE public.tyres ADD COLUMN IF NOT EXISTS image_job_at timestamptz;
ALTER TABLE public.tyres ADD COLUMN IF NOT EXISTS image_job_error text;
ALTER TABLE public.tyres ADD COLUMN IF NOT EXISTS image_job_attempts int NOT NULL DEFAULT 0;
-- functions claim_image_jobs(n) and kick_image_jobs(calls) + settings.image_job_key:
-- see the database (SECURITY DEFINER, not callable by visitors).
