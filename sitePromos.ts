import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { settingValue } from './publicSettings';
import type { TyreProduct } from './types';
import type { ProductCategory } from './categories';

/** Promos and banners managed from the shop program (tables site_promos / site_banners). */
export interface SitePromo {
  id: number; title: string; discount_percent: number;
  target_type: 'product' | 'category' | 'brand' | 'all'; target_ids: string[];
  badge_text?: string | null; ends_at?: string | null;
}
export interface SiteBanner {
  id: number; title?: string | null; subtitle?: string | null; image_url: string; image_mobile_url?: string | null;
  button_text?: string | null; link?: string | null; sort_order: number;
}

let promoCache: Promise<SitePromo[]> | null = null;
const loadPromos = () => (promoCache ??= Promise.resolve(
  supabase.from('site_promos').select('id, title, discount_percent, target_type, target_ids, badge_text, ends_at')
).then(({ data }) => ((data as SitePromo[]) || []).map(p => ({ ...p, discount_percent: Number(p.discount_percent) }))).catch(() => []));

/** Live promos (the database only returns active ones within their dates). `ready` = loaded. */
export const useSitePromos = () => {
  const [state, setState] = useState<{ promos: SitePromo[]; ready: boolean }>({ promos: [], ready: false });
  useEffect(() => { let on = true; loadPromos().then(promos => on && setState({ promos, ready: true })); return () => { on = false; }; }, []);
  return state;
};

const num = (v?: string) => { const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : 0; };

/** Best promo for a product: by product (site id or program id), category (or its parent), brand, or all. */
export const findPromo = (p: TyreProduct, promos: SitePromo[], categories: ProductCategory[]) => {
  if (!promos.length) return null;
  const cat = categories.find(c => c.id === p.category_id);
  const catIds = [cat?.id, cat?.parent_id].filter(Boolean).map(String);
  const brand = (p.manufacturer || '').trim().toLowerCase();
  let best: SitePromo | null = null;
  for (const pr of promos) {
    const ids = (pr.target_ids || []).map(String);
    const hit = pr.target_type === 'all'
      || (pr.target_type === 'product' && (ids.includes(String(p.id)) || (!!p.program_product_id && ids.includes(p.program_product_id))))
      || (pr.target_type === 'category' && catIds.some(id => ids.includes(id)))
      || (pr.target_type === 'brand' && !!brand && ids.some(b => b.trim().toLowerCase() === brand));
    if (hit && (!best || pr.discount_percent > best.discount_percent)) best = pr;
  }
  return best;
};

/** Price with the promo applied: old price shown crossed out, badge text for the card. */
export const applyPromo = (p: TyreProduct, promos: SitePromo[], categories: ProductCategory[]): TyreProduct => {
  const pr = findPromo(p, promos, categories);
  const price = num(p.price);
  if (!pr || price <= 0) return p;
  const discounted = Math.max(1, Math.round(price * (1 - pr.discount_percent / 100)));
  const old = Math.max(num(p.old_price), price);
  return { ...p, price: String(discounted), old_price: String(old), promo_badge: pr.badge_text || `−${Math.round(pr.discount_percent)}%` };
};

export const fetchBanners = async (): Promise<SiteBanner[]> => {
  const { data } = await supabase.from('site_banners').select('id, title, subtitle, image_url, image_mobile_url, button_text, link, sort_order').order('sort_order');
  return (data as SiteBanner[]) || [];
};

/** Home page blocks order (settings.home_blocks, edited in the program). */
export type HomeBlockType = 'banners' | 'car_search' | 'size_search' | 'categories' | 'hits' | 'promos' | 'benefits' | 'reviews' | 'articles';
/** blocks the program may turn on; the lean default home shows only banners + hits/recent, then the product grid */
export const ALL_HOME_BLOCKS: HomeBlockType[] = ['banners', 'car_search', 'hits', 'size_search', 'categories', 'promos', 'benefits', 'reviews', 'articles'];
export const DEFAULT_HOME_BLOCKS: HomeBlockType[] = ['banners', 'car_search', 'hits'];
export const fetchHomeBlocks = async (): Promise<{ type: HomeBlockType; title?: string }[]> => {
  const { data } = await settingValue('home_blocks');
  try {
    const list = JSON.parse((data as any)?.value || '[]') as { type: HomeBlockType; enabled?: boolean; title?: string }[];
    if (Array.isArray(list) && list.length) return list.filter(b => b.enabled !== false && ALL_HOME_BLOCKS.includes(b.type));
  } catch { /* default order */ }
  return DEFAULT_HOME_BLOCKS.map(type => ({ type }));
};
