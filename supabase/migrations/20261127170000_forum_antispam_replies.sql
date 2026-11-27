-- Applied live with apply_migration; this file is the record (stage 6: forum).
-- 1) private.forum_before_insert(): a newcomer (account younger than a day, or fewer than 3 messages) cannot post links
--    (http, www, t.me, domain.com/.ua/...) and may write at most 3 messages an hour; staff and moderators are not limited.
-- 2) «Відповіді вам»: forum_people.replies_seen_at; public.forum_replies(p_limit), public.forum_replies_unread(),
--    public.forum_replies_seen() — answers to my topics and to my messages, for signed-in people only.
alter table public.forum_people add column if not exists replies_seen_at timestamptz not null default now();
