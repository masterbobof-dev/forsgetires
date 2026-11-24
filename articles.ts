import { supabase } from './supabaseClient';

export interface Article { id: number; title: string; content: string; image_url?: string | null; created_at: string }

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'yi', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'yu', я: 'ya', ы: 'y', э: 'e', ё: 'yo', ъ: '',
};
const slug = (t: string) => t.toLowerCase().split('').map(c => TRANSLIT[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);

/** /statti/8-koly-potribno-minyaty-shyny (same rule as api/page.js) */
export const articlePath = (a: Pick<Article, 'id' | 'title'>) => `/statti/${a.id}-${slug(a.title.replace(/[^\p{L}\p{N}\s-]/gu, ' '))}`;
export const articleIdFromPath = (path = window.location.pathname): number | null => {
  const m = path.match(/^\/statti\/(\d+)/);
  return m ? Number(m[1]) : null;
};

/** Plain-text excerpt (articles are stored as plain text with blank lines between paragraphs). */
export const articleExcerpt = (content: string, len = 160) => {
  const text = content.replace(/\s+/g, ' ').trim();
  return text.length > len ? `${text.slice(0, len).replace(/\s\S*$/, '')}…` : text;
};

export const fetchArticles = async (limit = 50): Promise<Article[]> => {
  const { data } = await supabase.from('articles').select('id, title, content, image_url, created_at').order('created_at', { ascending: false }).limit(limit);
  return ((data as Article[]) || []).map(a => ({ ...a, title: a.title.trim() }));
};
