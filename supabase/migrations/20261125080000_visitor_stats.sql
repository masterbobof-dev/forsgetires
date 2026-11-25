-- Visitor statistics. The site sent a field the table did not have (screen_resolution), so nothing was recorded since March 2026.
alter table public.analytics_events add column if not exists screen_resolution text, add column if not exists referrer text,
  add column if not exists value numeric, add column if not exists region text;
create index if not exists analytics_events_created_idx on public.analytics_events (created_at desc);
-- public.visitor_stats(p_days int) returns jsonb — totals, by day/hour, cities, devices, sources, viewed/carted/searched/ordered goods.
-- Staff only (is_staff()), security definer; applied live on 2026-11-25.
