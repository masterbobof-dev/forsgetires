-- Applied live with apply_migration; this file is the record (stage 1: reliability).
-- 1) make-thumbs asked every minute "is there a photo without a small copy?" by reading all goods: a small index.
create index if not exists tyres_need_thumb_idx on public.tyres (id)
  where image_url like '%/storage/v1/object/public/galery/%' and (image_thumb_url is null or image_thumb_url like '%-thumb.jpg') and thumb_error is null and in_stock is not false;
-- 2) private.site_ping(): every 5 minutes home, a section (/katalog/avtozapchastyny-filtry), a product (/p/56430) and the forum;
--    the 4 MB sitemap and the Google feed only once a day (06:00 Kyiv). Before, both were downloaded every 5 minutes.
-- 3) search: trigram indexes, a search over 31k goods went from ~190 ms to ~3 ms.
create index if not exists tyres_search_numbers_trgm on public.tyres using gin (search_numbers gin_trgm_ops);
create index if not exists tyres_catalog_number_trgm on public.tyres using gin (catalog_number gin_trgm_ops);
create index if not exists tyres_manufacturer_trgm on public.tyres using gin (manufacturer gin_trgm_ops);
-- 4) private.backup_restore_check(): a trial restore of the newest daily copy (goods, orders, reviews, customers,
--    categories, settings) into a scratch table; result to the owner in Telegram. cron 'backup-restore-check' '41 6 3 * *'.
