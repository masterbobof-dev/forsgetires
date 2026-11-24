import type { TyreProduct } from './types';

// Must stay identical to slugify() / productPath() in api/_shop.js (server side)
const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'yi', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'yu', я: 'ya', ы: 'y', э: 'e', ё: 'yo', ъ: '',
};
const productSlug = (text: string) =>
  String(text || '').toLowerCase().split('').map(ch => TRANSLIT[ch] ?? ch).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);

/** Address of a product page, e.g. /p/48355-laufenn-lk41-g-fit-165-60-r14 */
export const productPath = (p: Pick<TyreProduct, 'id' | 'title' | 'slug'>) => {
  const slug = productSlug(p.slug || p.title);
  return `/p/${p.id}${slug ? `-${slug}` : ''}`;
};

/** Product id from the current address: /p/123-..., or old links ?p=123 / ?product=123. */
export const productIdFromLocation = (loc: Location = window.location): number | null => {
  const m = loc.pathname.match(/^\/p\/(\d+)/);
  if (m) return Number(m[1]);
  const q = new URLSearchParams(loc.search);
  const raw = q.get('p') || q.get('product');
  return raw && /^\d+$/.test(raw) ? Number(raw) : null;
};
