import { supabase } from './supabaseClient';
import { slugify } from './categories';

/** A forum section or subsection (table forum_sections; topics point to it by slug). */
export interface ForumSection {
  id: number; parent_id: number | null; slug: string; name: string; description: string | null; sort_order: number;
}

export interface ForumTopic {
  id: number; created_at: string; author_name: string; is_shop: boolean; category: string;
  title: string; body: string; images: string[]; is_pinned: boolean; is_hidden: boolean; is_locked: boolean;
  replies_count: number; last_reply_at: string; views: number; edited_at: string | null; author_avatar: string | null;
}
export interface ForumPost {
  id: number; topic_id: number; created_at: string; author_name: string; is_shop: boolean;
  body: string; images: string[]; is_hidden: boolean; edited_at: string | null; author_avatar: string | null;
}

const TOPIC_FIELDS = 'id, created_at, author_name, is_shop, category, title, body, images, is_pinned, is_hidden, is_locked, replies_count, last_reply_at, views, edited_at, author_avatar';
const POST_FIELDS = 'id, topic_id, created_at, author_name, is_shop, body, images, is_hidden, edited_at, author_avatar';

export const forumPath = (t?: Pick<ForumTopic, 'id' | 'title'> | null) => {
  if (!t) return '/forum';
  const s = slugify(t.title).slice(0, 60);
  return `/forum/${t.id}${s ? `-${s}` : ''}`;
};
/** /forum/123-... → 123; /forum/new → 'new'; /forum → null */
export const forumRoute = (path = window.location.pathname): number | 'new' | null => {
  const m = path.match(/^\/forum\/(new|\d+)/);
  return !m ? null : m[1] === 'new' ? 'new' : Number(m[1]);
};

// --- sections ---
let sectionsCache: Promise<ForumSection[]> | null = null;
export const fetchSections = (fresh = false): Promise<ForumSection[]> => {
  if (fresh || !sectionsCache) {
    sectionsCache = Promise.resolve(supabase.from('forum_sections').select('id, parent_id, slug, name, description, sort_order').order('sort_order').order('id'))
      .then(({ data, error }) => { if (error) throw error; return (data || []) as ForumSection[]; });
    sectionsCache.catch(() => { sectionsCache = null; });
  }
  return sectionsCache;
};
export const rootSections = (all: ForumSection[]) => all.filter(s => !s.parent_id);
export const childSections = (all: ForumSection[], id: number) => all.filter(s => s.parent_id === id);
/** the section and its parent, top first (for breadcrumbs) */
export const sectionChain = (all: ForumSection[], slug: string | null | undefined): ForumSection[] => {
  const s = all.find(x => x.slug === slug);
  if (!s) return [];
  const p = s.parent_id ? all.find(x => x.id === s.parent_id) : undefined;
  return p ? [p, s] : [s];
};
/** slugs a section shows: itself and its subsections */
export const sectionSlugs = (all: ForumSection[], slug: string) => {
  const s = all.find(x => x.slug === slug);
  return s ? [s.slug, ...childSections(all, s.id).map(k => k.slug)] : [slug];
};
export const sectionName = (all: ForumSection[], slug: string) => all.find(s => s.slug === slug)?.name || 'Загальне';

export const saveSection = async (s: Partial<ForumSection> & { name: string }) => {
  const row = { name: s.name.trim(), slug: (s.slug?.trim() ? slugify(s.slug) : slugify(s.name)).slice(0, 60), description: s.description?.trim() || null, parent_id: s.parent_id || null, sort_order: s.sort_order ?? 0 };
  const { error } = s.id ? await supabase.from('forum_sections').update(row).eq('id', s.id) : await supabase.from('forum_sections').insert([row]);
  if (error) throw error;
  sectionsCache = null;
};
export const deleteSection = async (id: number) => {
  const { error } = await supabase.from('forum_sections').delete().eq('id', id);
  if (error) throw error;
  sectionsCache = null;
};

// --- topics and replies ---
/** Statistics of every section: topics, replies, last activity. */
export const fetchSectionStats = async () => {
  const { data } = await supabase.from('forum_topics').select('category, replies_count, last_reply_at').limit(5000);
  const map: Record<string, { topics: number; replies: number; last: string | null }> = {};
  for (const t of (data || []) as { category: string; replies_count: number; last_reply_at: string }[]) {
    const m = (map[t.category] ??= { topics: 0, replies: 0, last: null });
    m.topics++; m.replies += t.replies_count;
    if (!m.last || t.last_reply_at > m.last) m.last = t.last_reply_at;
  }
  return map;
};

export const fetchTopics = async (opts: { slugs?: string[] | null; search?: string; limit?: number } = {}) => {
  let q = supabase.from('forum_topics').select(TOPIC_FIELDS).order('is_pinned', { ascending: false }).order('last_reply_at', { ascending: false }).limit(opts.limit || 100);
  if (opts.slugs?.length) q = q.in('category', opts.slugs);
  const s = opts.search?.trim().replace(/[%,()]/g, ' ');
  if (s) q = q.ilike('title', `%${s}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as ForumTopic[];
};

export const fetchTopic = async (id: number, countView = true) => {
  const [{ data: topic, error }, { data: posts }] = await Promise.all([
    supabase.from('forum_topics').select(TOPIC_FIELDS).eq('id', id).maybeSingle(),
    supabase.from('forum_posts').select(POST_FIELDS).eq('topic_id', id).order('created_at').limit(500),
  ]);
  if (error) throw error;
  if (countView) supabase.rpc('forum_view', { p_id: id }).then(() => undefined, () => undefined);
  return { topic: topic as ForumTopic | null, posts: (posts || []) as ForumPost[] };
};

/** Photo from the phone: shrink to max 1600 px JPEG (fast upload, small storage), then store in the person's own folder. */
export const uploadForumImage = async (file: File, userId: string): Promise<string> => {
  const bitmap = await createImageBitmap(file).catch(() => null);
  let blob: Blob = file;
  if (bitmap) {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b || file), 'image/jpeg', 0.85));
  }
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from('forum').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw error;
  return supabase.storage.from('forum').getPublicUrl(path).data.publicUrl;
};

export const createTopic = async (t: { category: string; title: string; body: string; images: string[]; is_pinned?: boolean }) => {
  const { data, error } = await supabase.from('forum_topics').insert([t]).select('id, title').single();
  if (error) throw error;
  return data as { id: number; title: string };
};
export const createPost = async (p: { topic_id: number; body: string; images: string[] }) => {
  const { error } = await supabase.from('forum_posts').insert([p]);
  if (error) throw error;
};
export type TopicPatch = Partial<Pick<ForumTopic, 'title' | 'body' | 'images' | 'category' | 'is_pinned' | 'is_locked' | 'is_hidden'>>;
export const updateTopic = async (id: number, patch: TopicPatch) => {
  const { error } = await supabase.from('forum_topics').update(patch).eq('id', id);
  if (error) throw error;
};
export const updatePost = async (id: number, patch: Partial<Pick<ForumPost, 'body' | 'images' | 'is_hidden'>>) => {
  const { error } = await supabase.from('forum_posts').update(patch).eq('id', id);
  if (error) throw error;
};
export const deleteTopic = async (id: number) => {
  const { error } = await supabase.from('forum_topics').delete().eq('id', id);
  if (error) throw error;
};
export const deletePost = async (id: number) => {
  const { error } = await supabase.from('forum_posts').delete().eq('id', id);
  if (error) throw error;
};
export const setHidden = (table: 'forum_topics' | 'forum_posts', id: number, hidden: boolean) =>
  table === 'forum_topics' ? updateTopic(id, { is_hidden: hidden }) : updatePost(id, { is_hidden: hidden });

/** Which messages of a topic are the visitor's own (they may edit those). user_id is not readable, so the database answers. */
export const fetchOwnIds = async (userId: string | undefined, topicId: number) => {
  if (!userId) return { topic: false, posts: new Set<number>() };
  const { data } = await supabase.rpc('forum_own', { p_topic: topicId });
  const r = (data || {}) as { topic?: boolean; posts?: number[] };
  return { topic: !!r.topic, posts: new Set<number>(r.posts || []) };
};

// --- avatars: a fun icon ("emoji:🚗") or the person's own photo ---
export const AVATAR_ICONS = ['🚗', '🏎️', '🚙', '🛻', '🚐', '🚚', '🚜', '🏍️', '🛞', '🔧', '🔋', '⛽', '🏁', '🚦', '😎', '🤠', '🦊', '🐻', '🐺', '🦁', '🐯', '🐼', '🦅', '🐝', '⚡', '🔥', '❄️', '☀️', '🌟', '🎯'];

/** Photo for the avatar: cut to a square in the middle, 256 px JPEG, into the person's own folder. */
export const uploadAvatar = async (file: File, userId: string): Promise<string> => {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('no image'))), 'image/jpeg', 0.88));
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('forum').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw error;
  return supabase.storage.from('forum').getPublicUrl(path).data.publicUrl;
};
export const fetchMyAvatar = async (userId: string) => {
  const { data } = await supabase.from('customer_profiles').select('avatar').eq('id', userId).maybeSingle();
  return (data as { avatar: string | null } | null)?.avatar || null;
};
export const saveMyAvatar = async (userId: string, avatar: string | null) => {
  const { error } = await supabase.from('customer_profiles').upsert({ id: userId, avatar, updated_at: new Date().toISOString() });
  if (error) throw error;
};
