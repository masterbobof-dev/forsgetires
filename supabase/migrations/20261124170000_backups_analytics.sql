-- Nightly in-database backups (applied 2026-11-24) + public analytics IDs.

-- Copies of the main tables in schema "backups" (not reachable through the website API),
-- e.g. backups.tyres_20261124. Kept 14 days. Restore example:
--   INSERT INTO public.tyres SELECT * FROM backups.tyres_20261124 WHERE id = 123;
CREATE SCHEMA IF NOT EXISTS backups;
REVOKE ALL ON SCHEMA backups FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION backups.run_daily(keep_days int DEFAULT 14)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = backups, public, pg_temp AS $$
DECLARE
  t text;
  stamp text := to_char(now() AT TIME ZONE 'Europe/Kyiv', 'YYYYMMDD');
  old record;
  made int := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY['tyres','product_categories','tyre_orders','customer_profiles','product_reviews','settings','suppliers','articles'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TABLE IF EXISTS backups.%I', t || '_' || stamp);
      EXECUTE format('CREATE TABLE backups.%I AS TABLE public.%I', t || '_' || stamp, t);
      made := made + 1;
    END IF;
  END LOOP;
  FOR old IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'backups' AND tablename ~ '_[0-9]{8}$'
      AND to_date(right(tablename, 8), 'YYYYMMDD') < (now() AT TIME ZONE 'Europe/Kyiv')::date - keep_days
  LOOP
    EXECUTE format('DROP TABLE backups.%I', old.tablename);
  END LOOP;
  RETURN format('%s tables copied (%s)', made, stamp);
END $$;
REVOKE ALL ON FUNCTION backups.run_daily(int) FROM public, anon, authenticated;
SELECT cron.schedule('daily-backup', '17 1 * * *', 'SELECT backups.run_daily(14)');

-- Google Analytics / Meta Pixel IDs are public (they are visible in any site's HTML anyway)
ALTER POLICY "public_read" ON public.settings USING (
  key LIKE 'contact\_%' OR key LIKE 'seo\_%' OR key LIKE 'hero\_%' OR key LIKE 'prices\_%' OR key LIKE 'legal\_%'
  OR key IN ('promo_data', 'enable_stock_quantity', 'nova_poshta_key', 'agro_featured_ids', 'hide_tire_service', 'ga_measurement_id', 'fb_pixel_id'));
