-- Telegram bot (edge function telegram-bot). Applied to the site database on 2026-11-24.
-- The bot token and the webhook secret are stored in private.integration_secrets
-- (names telegram_bot_token, telegram_webhook_secret) — never in the code.
create table if not exists public.telegram_users (
  id bigint generated always as identity primary key,
  chat_id bigint not null unique,
  name text,
  username text,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  notify boolean not null default true,
  active boolean not null default true,
  pending text,                       -- waiting for a TTN / comment: "ttn:<order id>" | "cm:<order id>"
  created_at timestamptz not null default now()
);
create table if not exists public.telegram_invites (
  code text primary key,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  label text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  used_at timestamptz,
  used_by bigint
);
alter table public.telegram_users enable row level security;
alter table public.telegram_invites enable row level security;
create policy telegram_users_staff on public.telegram_users for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy telegram_invites_staff on public.telegram_invites for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- secrets for the edge function only
create or replace function public.telegram_secrets() returns jsonb language sql stable security definer set search_path = public, private as $$
  select jsonb_build_object(
    'token', (select value from private.integration_secrets where name = 'telegram_bot_token'),
    'secret', (select value from private.integration_secrets where name = 'telegram_webhook_secret'),
    'sync', (select value from private.integration_secrets where name = 'program_sync_token'));
$$;
revoke all on function public.telegram_secrets() from public, anon, authenticated;
grant execute on function public.telegram_secrets() to service_role;
create or replace function public.telegram_set_token(p_token text) returns void language sql security definer set search_path = public, private as $$
  insert into private.integration_secrets(name, value) values ('telegram_bot_token', p_token)
  on conflict (name) do update set value = excluded.value;
$$;
revoke all on function public.telegram_set_token(text) from public, anon, authenticated;
grant execute on function public.telegram_set_token(text) to service_role;

-- new order / new review → the bot
create or replace function private.telegram_call(p_body jsonb) returns void language sql security definer set search_path = public, private as $$
  select null::void from (select net.http_post(
    url := 'https://zzxueclhkhvwdmxflmyx.supabase.co/functions/v1/telegram-bot',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-key', (select value from private.integration_secrets where name = 'program_sync_token')),
    body := p_body, timeout_milliseconds := 30000)) x;
$$;
create or replace function private.telegram_on_order() returns trigger language plpgsql security definer set search_path = public, private as $$
begin perform private.telegram_call(jsonb_build_object('action', 'notify_order', 'id', new.id)); return new; end $$;
create or replace function private.telegram_on_review() returns trigger language plpgsql security definer set search_path = public, private as $$
begin perform private.telegram_call(jsonb_build_object('action', 'notify_review', 'id', new.id)); return new; end $$;
create or replace trigger telegram_new_order after insert on public.tyre_orders for each row execute function private.telegram_on_order();
create or replace trigger telegram_new_review after insert on public.product_reviews for each row execute function private.telegram_on_review();

-- daily summary for owners (18:00 UTC = 20:00 Kyiv in winter, 21:00 in summer)
select cron.schedule('telegram-daily', '0 18 * * *', $c$select private.telegram_call('{"action":"daily"}'::jsonb)$c$);
