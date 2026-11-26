import { supabase } from './supabaseClient';
import { slugify } from './categories';

export const FORUM_CATEGORIES: { id: string; name: string }[] = [
  { id: 'shyny', name: 'Шини' },
  { id: 'dysky', name: 'Диски' },
  { id: 'akb', name: 'Акумулятори' },
  { id: 'remont', name: 'Ремонт і обслуговування' },
  { id: 'masla', name: 'Масла і рідини' },
  { id: 'inshe', name: 'Інше' },
];
export const forumCategoryName = (id: string) => FORUM_CATEGORIES.find(c => c.id === id)?.name || 'Інше';

export interface ForumTopic {
  id: number; created_at: string; author_name: string; is_shop: boolean; category: string;
  title: string; body: string; images: string[]; is_pinned: boolean; is_hidden: boolean;
  replies_count: number; last_reply_at: string; views: number;
}
export interface ForumPost {
  id: number; topic_id: number; created_at: string; author_name: string; is_shop: boolean;
  body: string; images: string[]; is_hidden: boolean;
}

const TOPIC_FIELDS = 'id, created_at, author_name, is_shop, category, title, body, images, is_pinned, is_hidden, replies_count, last_reply_at, views';
const POST_FIELDS = 'id, topic_id, created_at, author_name, is_shop, body, images, is_hidden';

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

export const fetchTopics = async (category?: string | null) => {
  let q = supabase.from('forum_topics').select(TOPIC_FIELDS).order('is_pinned', { ascending: false }).order('last_reply_at', { ascending: false }).limit(100);
  if (category) q = q.eq('category', category);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as ForumTopic[];
};

export const fetchTopic = async (id: number) => {
  const [{ data: topic, error }, { data: posts }] = await Promise.all([
    supabase.from('forum_topics').select(TOPIC_FIELDS).eq('id', id).maybeSingle(),
    supabase.from('forum_posts').select(POST_FIELDS).eq('topic_id', id).order('created_at').limit(500),
  ]);
  if (error) throw error;
  supabase.rpc('forum_view', { p_id: id }).then(() => undefined, () => undefined);
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
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b || file), 'image/jpeg', 0.82));
  }
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from('forum').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw error;
  return supabase.storage.from('forum').getPublicUrl(path).data.publicUrl;
};

export const createTopic = async (t: { category: string; title: string; body: string; images: string[] }) => {
  const { data, error } = await supabase.from('forum_topics').insert([t]).select('id, title').single();
  if (error) throw error;
  return data as { id: number; title: string };
};
export const createPost = async (p: { topic_id: number; body: string; images: string[] }) => {
  const { error } = await supabase.from('forum_posts').insert([p]);
  if (error) throw error;
};
export const setHidden = async (table: 'forum_topics' | 'forum_posts', id: number, hidden: boolean) => {
  const { error } = await supabase.from(table).update({ is_hidden: hidden }).eq('id', id);
  if (error) throw error;
};
