-- The forum hides user_id with column-level grants, so new public columns must be granted explicitly.
grant select (author_pid) on public.forum_topics to anon, authenticated;
grant select (author_pid, parent_id) on public.forum_posts to anon, authenticated;
