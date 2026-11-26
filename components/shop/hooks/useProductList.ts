import { parseAttrRange } from '../shopUtils';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import type { TyreProduct } from '../../../types';
import { type ProductCategory, buildCategoryFilter } from '../../../categories';
import { parseSearch, searchFilters } from '../../../searchQuery';
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
  const attrFiltersKey = JSON.stringify(q.attrFilters);
  const paramsKey = [q.categoriesLoading, q.activeCategory, q.activeSort, q.enableStockQty, q.filterBrand, q.filterRadius, q.filterWidth, q.filterHeight,
    q.filterSeason, q.showOnlyInStock, q.debouncedSearch, q.priorityProductId, attrFiltersKey, q.promosReady].join('|');
  const [loadedKey, setLoadedKey] = useState('');

  const fetchTyres = async (pageIndex: number, isRefresh = false) => {
    const my = isRefresh ? ++reqNo.current : reqNo.current;
    const key = paramsKey;
    try {
      if (isRefresh) setLoading(true); else setLoadingMore(true);
      const from = pageIndex * PAGE_SIZE, to = from + PAGE_SIZE - 1;
      let query = supabase.from('tyres').select('*', { count: 'exact' });

      // smart search: sizes in any format, several words, Cyrillic brand names
      for (const f of searchFilters(parseSearch(q.debouncedSearch))) query = query.or(f);
      for (const [key, value] of Object.entries(q.attrFilters)) {
        if (!value) continue;
        const range = parseAttrRange(value);
        query = key === 'approval' ? query.contains('auto_approvals', [value])
          // "60..82" (from the car picker): any whole value in between, e.g. battery capacity
          : range ? query.in(`attributes->>${key}`, range.values)
          : query.eq(`attributes->>${key}`, value);
      }
      if (q.filterBrand) query = query.eq('manufacturer', q.filterBrand);
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

      // "All goods" without a search shows only what can be bought now (old "on order" tyres are found by search)
      if (q.activeCategory === 'all' && !q.debouncedSearch.trim()) query = query.eq('on_order', false);
      if (q.activeSort === 'with_photo') query = query.eq('has_photo', true);

      // real stock first, old "on order" tyres after it
      query = query.order('on_order', { ascending: true });
      if (q.activeSort === 'recommended' || q.activeSort === 'with_photo') {
        // what is nice to buy first: recommended in the program (is_hot), with a photo, then the newest
        query = query.order('is_hot', { ascending: false }).order('has_photo', { ascending: false }).order('in_stock', { ascending: false }).order('created_at', { ascending: false });
      } else {
        const sorts = { price_asc: 'price_num', price_desc: 'price_num', newest: 'created_at', oldest: 'created_at', no_photo: 'created_at' };
        query = query.order('in_stock', { ascending: false }).order((sorts as any)[q.activeSort] || 'created_at', { ascending: ['price_asc', 'oldest'].includes(q.activeSort) });
      }

      const { data, error, count } = await query.range(from, to);
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
        setHasMore(data.length === PAGE_SIZE);
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
  return { tyres, loading: loading || loadedKey !== paramsKey, loadingMore, hasMore, totalCount, loadMore: () => fetchTyres(page + 1) };
};
