import { parseAttrRange } from '../shopUtils';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import type { TyreProduct } from '../../../types';
import { type ProductCategory, buildCategoryFilter } from '../../../categories';
import { parseSearch, searchFilters, swapLayout, looseWord, brandFamily } from '../../../searchQuery';
import { logAnalyticsEvent } from '../../admin/analytics';
import type { CategorySelection } from '../CategoryNav';
import type { SortValue } from '../FilterToolbar';
import { PAGE_SIZE } from '../shopUtils';

interface ProductListParams {
  categories: ProductCategory[];
  categoriesLoading: boolean;
  dbReady: boolean;
  /** promos are loaded (prices in the list already include them) */
  promosReady: boolean;
  activeCategory: CategorySelection;
  activeCat: ProductCategory | undefined;
  agroCategory: ProductCategory | undefined;
  showTyreFilters: boolean;
  activeSort: SortValue;
  debouncedSearch: string;
  attrFilters: Record<string, string>;
  filterBrand: string;
  filterRadius: string;
  filterWidth: string;
  filterHeight: string;
  filterSeason: string;
  showOnlyInStock: boolean;
  favoriteIds: number[];
  /** a product picked in the agro banner: shown first in its section */
  priorityProductId: number | null;
  enableStockQty: boolean;
  /** database row → product as the shop shows it (size, availability, promo price) */
  prepare: (p: TyreProduct) => TyreProduct;
}

/** The list of products of the current section with all filters applied, loaded page by page. */
export const useProductList = (q: ProductListParams) => {
  const [tyres, setTyres] = useState<TyreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  // every new search / section gets a number: an older answer that comes back late is thrown away
  // (otherwise the list jumps: first the results of "фі", then of "фільтр")
  const reqNo = useRef(0);
  // home page mix: how far the own and the partner lists have been shown
  const mixAt = useRef({ own: 0, partner: 0 });
  const attrFiltersKey = JSON.stringify(q.attrFilters);
  const paramsKey = [q.categoriesLoading, q.activeCategory, q.activeSort, q.enableStockQty, q.filterBrand, q.filterRadius, q.filterWidth, q.filterHeight,
    q.filterSeason, q.showOnlyInStock, q.debouncedSearch, q.priorityProductId, attrFiltersKey, q.promosReady].join('|');
  const [loadedKey, setLoadedKey] = useState('');
  /** the search was corrected: the other keyboard layout, or names close to what was typed */
  const [searchNote, setSearchNote] = useState('');

  const fetchTyres = async (pageIndex: number, isRefresh = false) => {
    const my = isRefresh ? ++reqNo.current : reqNo.current;
    const key = paramsKey;
    try {
      if (isRefresh) setLoading(true); else setLoadingMore(true);
      const from = pageIndex * PAGE_SIZE, to = from + PAGE_SIZE - 1;
      const build = (text = q.debouncedSearch) => {
      let query = supabase.from('tyres').select('*', { count: 'exact' });

      // smart search: sizes in any format, several words, Cyrillic brand names
      for (const f of searchFilters(parseSearch(text))) query = query.or(f);
      for (const [key, value] of Object.entries(q.attrFilters)) {
        if (!value) continue;
        const range = parseAttrRange(value);
        query = key === 'approval' ? query.contains('auto_approvals', [value])
          // "60..82" (from the car picker): any whole value in between, e.g. battery capacity
          : range ? query.in(`attributes->>${key}`, range.values)
          : query.eq(`attributes->>${key}`, value);
      }
      if (q.filterBrand) {
        // the brand, and goods without a brand whose name has it («… Таврия, Славута Тернополь»)
        const b = q.filterBrand.replace(/["\\*]/g, '');
        const family = brandFamily(b);
        if (family.length) {
          // one maker under several names (ТМК = Тернополь / Тернопіль): any of them, by brand or in the name
          const names = family.map(r => `manufacturer.ilike."*${r}*"`).join(',');
          const titles = family.map(r => `title.ilike."*${r}*"`).join(',');
          query = query.or(`${names},and(manufacturer.is.null,or(${titles}))`);
        } else {
          query = query.or(`manufacturer.ilike."${b}",and(manufacturer.is.null,title.ilike."*${looseWord(b.toLowerCase())}*")`);
        }
      }
      if (q.filterRadius) query = query.eq('radius', q.filterRadius);
      if (q.filterWidth) query = query.ilike('title', `%${q.filterWidth}%`);
      if (q.filterHeight) query = query.ilike('title', `%/${q.filterHeight}%`);
      if (q.showOnlyInStock) query = query.neq('in_stock', false).eq('on_order', false);
      // goods from the shop program that are sold out are not shown at all
      query = query.or('in_stock.neq.false,program_product_id.is.null');
      if (q.filterSeason && q.showTyreFilters) query = query.eq('season', q.filterSeason);

      if (q.activeCategory === 'hot') query = query.eq('is_hot', true);
      else if (q.activeCategory === 'fav') query = query.in('id', q.favoriteIds.length ? q.favoriteIds : [-1]);
      else if (q.activeCat) {
        const catFilter = buildCategoryFilter(q.categories, q.activeCat, q.dbReady);
        if (catFilter) query = query.or(catFilter);
      }

      // "All goods" without a search shows only what can be bought now: own stock and partner goods with a price
      // (old "on order, ask the price" goods are found by search)
      if (q.activeCategory === 'all' && !q.debouncedSearch.trim()) query = query.eq('ask_price', false);
      if (q.activeSort === 'with_photo') query = query.eq('has_photo', true);

      if (q.activeSort === 'recommended' || q.activeSort === 'with_photo') {
        // recommended in the program first; then own goods with a photo, partner goods, own goods without a photo,
        // and "on order, ask the price" at the end (list_rank)
        query = query.order('is_hot', { ascending: false }).order('list_rank', { ascending: true }).order('in_stock', { ascending: false }).order('created_at', { ascending: false });
      } else {
        query = query.order('ask_price', { ascending: true });
        const sorts = { price_asc: 'price_num', price_desc: 'price_num', newest: 'created_at', oldest: 'created_at', no_photo: 'created_at' };
        query = query.order('in_stock', { ascending: false }).order((sorts as any)[q.activeSort] || 'created_at', { ascending: ['price_asc', 'oldest'].includes(q.activeSort) });
      }
      return query;
      };

      // the home page (all goods, nothing searched): own goods and partner goods (GPL, Omega) take turns,
      // otherwise the 20 000+ partner goods would come only after all own goods
      const mix = q.activeCategory === 'all' && !q.debouncedSearch.trim() && q.activeSort === 'recommended';
      let data: any[] | null, error: any, count: number | null, more: boolean;
      if (mix) {
        // each side keeps its own place; when one side runs out, the other fills the page
        if (isRefresh) mixAt.current = { own: 0, partner: 0 };
        const at = mixAt.current;
        const [own, partner] = await Promise.all([
          build().is('supplier_offer_id', null).range(at.own, at.own + PAGE_SIZE - 1),
          build().not('supplier_offer_id', 'is', null).range(at.partner, at.partner + PAGE_SIZE - 1),
        ]);
        error = own.error || partner.error;
        const a = own.data || [], p = partner.data || [];
        data = [];
        let i = 0, j = 0;
        while (data.length < PAGE_SIZE && (i < a.length || j < p.length)) {
          if (i < a.length) data.push(a[i++]);
          if (data.length < PAGE_SIZE && j < p.length) data.push(p[j++]);
        }
        if (my === reqNo.current) mixAt.current = { own: at.own + i, partner: at.partner + j };
        count = (own.count || 0) + (partner.count || 0);
        more = at.own + i < (own.count || 0) || at.partner + j < (partner.count || 0);
      } else {
        const r = await build().range(from, to);
        data = r.data; error = r.error; count = r.count; more = (r.data || []).length === PAGE_SIZE;
      }
      // nothing found for the words typed: maybe the keyboard was in the other layout («ащкв» = «ford»),
      // or there is a typo («амартизатор») — then show what is close and say so
      let note = '';
      const typed = q.debouncedSearch.trim();
      if (isRefresh && typed.length >= 3 && !error && !(data || []).length) {
        const alt = swapLayout(typed);
        if (alt) {
          const r = await build(alt).range(from, to);
          if ((r.data || []).length) { data = r.data; count = r.count; more = r.data!.length === PAGE_SIZE; note = alt; }
        }
        if (!note) {
          const { data: near } = await supabase.rpc('search_similar', { p_q: typed, p_n: PAGE_SIZE });
          const ids = ((near as { id: number }[]) || []).map(x => x.id);
          if (ids.length) {
            const r = await build('').in('id', ids).range(0, PAGE_SIZE - 1);
            const order = new Map(ids.map((id, i) => [id, i]));
            data = (r.data || []).sort((a: any, b: any) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
            count = data.length; more = false; note = 'схожі назви';
          }
        }
        // what people look for and do not find: in the owner's weekly report
        if (my === reqNo.current) logAnalyticsEvent(note ? 'search_fixed' : 'search_empty', undefined, typed);
      }
      if (isRefresh && my === reqNo.current) setSearchNote(note);
      if (my !== reqNo.current) return;
      if (error) throw error;
      if (data) {
        let processed = data.map(q.prepare);

        // --- PRIORITY LOGIC ---
        if (q.priorityProductId && pageIndex === 0 && q.agroCategory && q.activeCategory === q.agroCategory.id) {
            const index = processed.findIndex(p => p.id === q.priorityProductId);
            if (index > 0) {
                const [item] = processed.splice(index, 1);
                processed.unshift(item);
            } else if (index === -1) {
                const { data: pData } = await supabase.from('tyres').select('*').eq('id', q.priorityProductId).single();
                if (pData) processed.unshift(q.prepare(pData));
            }
        }

        const uniqueNew = Array.from(new Map(processed.map(item => [item.id, item])).values()) as TyreProduct[];

        setTyres(isRefresh ? uniqueNew : prev => {
            const newIds = new Set(uniqueNew.map(d => d.id));
            return [...prev.filter(p => !newIds.has(p.id)), ...uniqueNew];
        });
        setPage(pageIndex);
        setHasMore(more);
        if (count !== null) setTotalCount(count);
      }
      if (isRefresh) setLoadedKey(key);
    } catch (error) { console.error(error); if (isRefresh && my === reqNo.current) setLoadedKey(key); } finally { if (my === reqNo.current) { setLoading(false); setLoadingMore(false); } }
  };

  // a new section, filter, sorting or search → the list is loaded again from its first page
  useEffect(() => {
    if (q.categoriesLoading || !q.promosReady) return;
    setPage(0);
    setTyres([]);
    fetchTyres(0, true);
  }, [q.categoriesLoading, q.activeCategory, q.activeSort, q.enableStockQty, q.filterBrand, q.filterRadius, q.filterWidth, q.filterHeight, q.filterSeason, q.showOnlyInStock, q.debouncedSearch, q.priorityProductId, attrFiltersKey, q.promosReady]);

  // the favourites list changed while looking at it → refresh
  useEffect(() => {
    if (q.activeCategory === 'fav' && !q.categoriesLoading) fetchTyres(0, true);
  }, [q.favoriteIds.join(',')]);

  // until the answer for the current search/section comes, the old list is not shown (it flashed for a moment before)
  return { tyres, searchNote, loading: loading || loadedKey !== paramsKey, loadingMore, hasMore, totalCount, loadMore: () => fetchTyres(page + 1) };
};
