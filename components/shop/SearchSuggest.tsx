import React, { useEffect, useState } from 'react';
import { FolderTree, Search, Package } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { parseSearch, searchFilters } from '../../searchQuery';
import type { ProductCategory } from '../../categories';
import type { TyreProduct } from '../../types';
import NoPhoto from './NoPhoto';

/**
 * Drop-down under the search field: matching categories and up to 6 products (photo, price),
 * so the buyer jumps straight to the right section or product while typing.
 */
export interface SuggestHandlers {
  categories: ProductCategory[];
  onProduct: (p: TyreProduct) => void;
  onCategory: (c: ProductCategory) => void;
}
interface Props {
  query: string;
  categories: ProductCategory[];
  onProduct: (p: TyreProduct) => void;
  onCategory: (c: ProductCategory) => void;
  onAll: () => void;
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').trim();

const SearchSuggest: React.FC<Props> = ({ query, categories, onProduct, onCategory, onAll }) => {
  const [items, setItems] = useState<TyreProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) { setItems([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      let req = supabase.from('tyres').select('id, title, slug, price, image_url, image_thumb_url, on_order, manufacturer, catalog_number')
        .neq('in_stock', false).not('hidden_on_site', 'is', true);
      for (const f of searchFilters(parseSearch(q))) req = req.or(f);
      const { data } = await req.order('on_order', { ascending: true }).order('has_photo', { ascending: false }).order('stock_quantity', { ascending: false }).limit(6);
      if (alive) { setItems((data as TyreProduct[]) || []); setLoading(false); }
    }, 200);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  if (q.length < 2) return null;
  const words = norm(q).split(/\s+/).filter(w => w.length >= 2);
  const cats = categories
    .filter(c => (c.available || 0) > 0 && words.some(w => norm(c.name).includes(w)))
    .sort((a, b) => (b.available || 0) - (a.available || 0)).slice(0, 4);
  if (!cats.length && !items.length && !loading) return null;

  // onMouseDown + preventDefault: the click must win over the input losing focus
  const pick = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); fn(); };

  return (
    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden max-h-[70vh] overflow-y-auto">
      {cats.map(c => (
        <button key={c.id} onMouseDown={pick(() => onCategory(c))} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800 text-sm">
          <FolderTree size={16} className="text-[#FFC300] shrink-0" />
          <span className="text-white font-bold flex-1 truncate">{c.name}</span>
          <span className="text-[11px] text-zinc-500">{c.available} шт</span>
        </button>
      ))}
      {cats.length > 0 && items.length > 0 && <div className="border-t border-zinc-800" />}
      {items.map(p => {
        const img = p.image_thumb_url || p.image_url;
        return (
          <button key={p.id} onMouseDown={pick(() => onProduct(p))} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-zinc-800">
            <span className="w-10 h-10 shrink-0 rounded-lg bg-white flex items-center justify-center overflow-hidden">
              {img ? <img src={img} alt="" className="w-full h-full object-contain" loading="lazy" /> : <NoPhoto size={16} />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs text-white font-bold line-clamp-2">{p.title}</span>
              {p.catalog_number && <span className="block text-[10px] text-zinc-500">{p.catalog_number}</span>}
            </span>
            <span className="text-xs font-black text-[#FFC300] whitespace-nowrap">
              {p.on_order ? 'Під замовл.' : `${Math.round(parseFloat(p.price || '0'))} грн`}
            </span>
          </button>
        );
      })}
      <button onMouseDown={pick(onAll)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-zinc-950 hover:bg-zinc-800 text-xs font-bold text-zinc-300 border-t border-zinc-800">
        <Search size={14} /> {loading ? 'Шукаю…' : `Усі результати для «${q}»`}
      </button>
    </div>
  );
};

export default SearchSuggest;
