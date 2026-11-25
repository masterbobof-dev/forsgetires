-- Applied live 2026-11-25: security cleanup
-- * removed 46 disabled "old_off_*" policies (they were all "false" — dead weight)
-- * bookings: dropped "anyone_read" (customer names/phones were readable by anyone); staff keep access via staff_all
-- * seo_health(): no longer callable without signing in
-- * private.slugify_uk / private.clean_sku: fixed search_path
-- * photo_cron_ensure(): 7 parallel calls per minute instead of 11 (fewer "not enough resources" failures)
-- * 48 products: dead third-party photo links (404 / site gone) removed; original kept in image_source_url
-- * settings.seo_image -> https://www.forsage-tires.com/og.jpg (old domain image no longer exists)
drop policy if exists anyone_read on bookings;
revoke execute on function public.seo_health() from anon, public;
alter function private.slugify_uk set search_path = public, pg_catalog;
alter function private.clean_sku set search_path = public, pg_catalog;
