-- Photo check that was interrupted (worker died after claiming the product) used to be lost forever.
-- Now it is retried: no result 6 minutes after the claim → claimed again, up to 3 attempts; then counted as "no good photo".
-- Applied to the site database on 2026-11-24 (claim_photo_download and photo_job_status were replaced accordingly).
alter table public.tyres add column if not exists photo_attempts int not null default 0;

create or replace function public.claim_photo_download(n integer)
returns setof tyres language sql security definer set search_path to 'public' as $function$
  update tyres t set photo_download_at = now(), photo_attempts = t.photo_attempts + 1
  where t.id in (
    select id from tyres
    where image_url is null and not photo_review and photo_candidates is not null and jsonb_array_length(photo_candidates) > 0
      and (photo_download_at is null
           or (photo_search_error is null and photo_download_at < now() - interval '6 minutes' and photo_attempts < 3))
    order by stock_quantity desc, id
    limit greatest(least(n, 10), 1)
    for update skip locked
  )
  returning t.*;
$function$;

create or replace function public.photo_job_status()
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select jsonb_build_object(
    'to_search', count(*) filter (where photo_queued_at is not null and program_product_id is not null and in_stock and image_url is null and photo_search_at is null),
    'to_download', count(*) filter (where image_url is null and not photo_review and photo_candidates is not null and jsonb_array_length(photo_candidates) > 0
                                     and (photo_download_at is null or (photo_search_error is null and photo_attempts < 3))),
    'to_verify', 0,
    'to_review', count(*) filter (where photo_review),
    'found', count(*) filter (where photo_auto),
    'not_found', count(*) filter (where image_url is null and not photo_review and (photo_search_error is not null
                                   or (photo_candidates is not null and photo_download_at is not null and photo_attempts >= 3))),
    'running', exists (select 1 from cron.job where jobname = 'photo-finder'))
  from tyres
$function$;
