-- Photo search progress for the admin panel: "готово N з M · з фото X, без фото Y".
-- photo_queue() marks the start of a run (settings.photo_run_started_at) when nothing is waiting;
-- photo_job_status() counts run_total / run_found / run_none since that moment. Applied on 2026-11-24.
create or replace function public.photo_queue(p_category bigint, p_limit integer)
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare n int; busy boolean;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  select (s->>'to_search')::int + (s->>'to_download')::int > 0 into busy from (select public.photo_job_status() s) x;
  if not busy then
    insert into settings(key, value) values ('photo_run_started_at', now()::text)
    on conflict (key) do update set value = excluded.value;
  end if;
  with recursive tree as (
    select id from product_categories where p_category is not null and id = p_category
    union all select c.id from product_categories c join tree t on c.parent_id = t.id
  )
  update tyres set photo_queued_at = now()
  where id in (
    select x.id from tyres x
    where x.program_product_id is not null and x.in_stock and x.image_url is null and x.photo_search_at is null and x.photo_queued_at is null
      and (p_category is null or x.category_id in (select id from tree))
    order by x.stock_quantity desc, x.id
    limit greatest(least(coalesce(p_limit, 100000), 100000), 1)
  );
  get diagnostics n = row_count;
  if n > 0 then perform public.photo_cron_ensure(); end if;
  return n;
end $function$;

create or replace function public.photo_job_status()
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  with run as (select coalesce((select value::timestamptz from settings where key = 'photo_run_started_at'), now()) t)
  select jsonb_build_object(
    'to_search', count(*) filter (where photo_queued_at is not null and program_product_id is not null and in_stock and image_url is null and photo_search_at is null),
    'to_download', count(*) filter (where image_url is null and not photo_review and photo_candidates is not null and jsonb_array_length(photo_candidates) > 0
                                     and (photo_download_at is null or (photo_search_error is null and photo_attempts < 3))),
    'to_verify', 0,
    'to_review', count(*) filter (where photo_review),
    'found', count(*) filter (where photo_auto),
    'not_found', count(*) filter (where image_url is null and not photo_review and (photo_search_error is not null
                                   or (photo_candidates is not null and photo_download_at is not null and photo_attempts >= 3))),
    'run_total', count(*) filter (where photo_queued_at >= run.t),
    'run_found', count(*) filter (where photo_queued_at >= run.t and (photo_review or image_url is not null)),
    'run_none', count(*) filter (where photo_queued_at >= run.t and image_url is null and not photo_review
                                   and (photo_search_error is not null or (photo_download_at is not null and photo_attempts >= 3))),
    'running', exists (select 1 from cron.job where jobname = 'photo-finder'))
  from tyres, run
$function$;
