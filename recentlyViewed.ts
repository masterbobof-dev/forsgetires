import type { TyreProduct } from './types';

/** "Ви переглядали": last viewed products in this browser (only light fields are kept). */
const KEY = 'recent_tyres';
const MAX = 12;
export type RecentProduct = Pick<TyreProduct, 'id' | 'title' | 'slug' | 'price' | 'image_url' | 'image_thumb_url' | 'manufacturer' | 'on_order' | 'category_id' | 'supplier_offer_id'>;

export const getRecent = (): RecentProduct[] => {
  try { const list = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(list) ? list.filter(p => p && p.id) : []; } catch { return []; }
};

export const addRecent = (p: TyreProduct) => {
  try {
    const light: RecentProduct = { id: p.id, title: p.title, slug: p.slug, price: p.price, image_url: p.image_url, image_thumb_url: p.image_thumb_url, manufacturer: p.manufacturer, on_order: p.on_order, category_id: p.category_id, supplier_offer_id: p.supplier_offer_id };
    localStorage.setItem(KEY, JSON.stringify([light, ...getRecent().filter(x => x.id !== p.id)].slice(0, MAX)));
  } catch { /* private mode */ }
};
