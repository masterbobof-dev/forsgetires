import { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import type { TyreProduct, Supplier } from '../../../types';
import { type ProductCategory, buildCategoryFilter, isTyreProduct } from '../../../categories';
import { PAGE_SIZE, type TyreBucket, applyBucketFilter, detectSeason } from './tyreAdminUtils';

export interface BucketCounts { all: number; car: number; cargo: number; truck: number; agro: number; suv: number; hot: number; out: number; no_photo: number; ready?: number }

/**
 * The products list of the admin tab: what is loaded, the filters above it (bucket, section, supplier, search, sorting,
 * "only in stock"), the numbers in the buckets menu, and which rows are ticked for bulk actions.
 */
export const useTyresList = (categories: ProductCategory[], dbReady: boolean, showError: (msg: string) => void) => {
  const [tyres, setTyres] = useState<TyreProduct[]>([]);
  const [loadingTyres, setLoadingTyres] = useState(false);
  const [hasMoreTyres, setHasMoreTyres] = useState(true);
  const [tyrePage, setTyrePage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [tyreSearch, setTyreSearch] = useState('');
  const [tyreCategoryTab, setTyreCategoryTab] = useState<TyreBucket>('all');
  const [tyreSort, setTyreSort] = useState<'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'with_photo' | 'no_photo'>('newest');
  const [filterSupplierId, setFilterSupplierId] = useState<string>('all');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('all');
  const [showOnlyInStock, setShowOnlyInStock] = useState(false);
  /** photo filter: all goods, only with a photo, only without */
  const [filterPhoto, setFilterPhoto] = useState<'all' | 'with' | 'without'>('all');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<BucketCounts>({ all: 0, car: 0, cargo: 0, truck: 0, agro: 0, suv: 0, hot: 0, out: 0, no_photo: 0 });
  const [enableStockQty, setEnableStockQty] = useState(false);

  const [selectedTyreIds, setSelectedTyreIds] = useState<Set<number>>(new Set());

  useEffect(() => {
      fetchSuppliers();
      fetchSettings();
  }, []);

  useEffect(() => {
      setTyres([]); 
      setTyrePage(0);
      setHasMoreTyres(true);
      fetchTyres(0, true); 
      fetchCategoryCounts();
  }, [tyreCategoryTab, tyreSort, filterSupplierId, filterCategoryId, categories, enableStockQty, showOnlyInStock, filterPhoto]);

  const fetchSettings = async () => {
    try {
        const { data } = await supabase.from('settings').select('*').eq('key', 'enable_stock_quantity').single();
        if (data) setEnableStockQty(data.value === 'true');
    } catch (e) { console.error(e); }
  };

  const fetchSuppliers = async () => {
      const { data } = await supabase.from('suppliers').select('*').order('name');
      if (data) setSuppliers(data);
  };

  const fetchCategoryCounts = async () => {
    try {
        const base = supabase.from('tyres').select('*', { count: 'exact', head: true });
        const [all, car, cargo, truck, agro, suv, hot, out, no_photo, ready] = await Promise.all([
            base.then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).or('vehicle_type.eq.car,vehicle_type.is.null').neq('vehicle_type', 'cargo').neq('vehicle_type', 'suv').not('radius', 'ilike', '%C%').then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).or('vehicle_type.eq.cargo,radius.ilike.%C%').not('radius', 'in', '("R17.5","R19.5","R22.5")').then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).or('radius.eq.R17.5,radius.eq.R19.5,radius.eq.R22.5,title.ilike.%TIR%,title.ilike.%R17.5%,title.ilike.%R19.5%,title.ilike.%R22.5%').then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).or('vehicle_type.eq.agro,and(vehicle_type.neq.car,vehicle_type.neq.suv,vehicle_type.neq.cargo,radius.in.("R10","R12","R14.5","R15.3","R15.5","R20","R24","R26","R28","R30","R32","R34","R36","R38","R40","R42"))').then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).eq('vehicle_type', 'suv').then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).eq('is_hot', true).then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).eq('in_stock', false).then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).is('image_url', null).then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true })
                .not('description', 'is', null)
                .not('seo_title', 'is', null)
                .not('seo_description', 'is', null)
                .not('image_url', 'is', null)
                .not('image_url', 'ilike', '%picsum.photos%')
                .then(r => r.count)
        ]);
        setCategoryCounts({ 
            all: all || 0, 
            car: car || 0, 
            cargo: cargo || 0, 
            truck: truck || 0,
            agro: agro || 0,
            suv: suv || 0, 
            hot: hot || 0, 
            out: out || 0,
            no_photo: no_photo || 0,
            ready: ready || 0
        });
    } catch (e) { console.error(e); }
  };

  const fetchTyres = async (pageIdx: number, isRefresh = false) => {
    setLoadingTyres(true);
    try {
       const from = pageIdx * PAGE_SIZE;
       const to = from + PAGE_SIZE - 1;
       let query = supabase.from('tyres').select('*', { count: 'exact' });

       if (tyreSearch.trim().length > 0) {
           const cleanSearch = tyreSearch.replace(/[%_]/g, '');
           const terms = cleanSearch.trim().split(/\s+/);
           terms.forEach(term => {
               const t = term.replace(/[()+,]/g, '');
               // name, article, barcode (from the program), cross numbers, brand
               if(t) query = query.or(`title.ilike.%${t}%,catalog_number.ilike.%${t}%,radius.ilike.%${t}%,product_number.ilike.%${t}%,search_numbers.ilike.%${t}%,manufacturer.ilike.%${t}%`);
           });
       }

       query = applyBucketFilter(query, tyreCategoryTab);

       if (showOnlyInStock && tyreCategoryTab !== 'out_of_stock') {
           if (enableStockQty) query = query.or('stock_quantity.gt.0,stock_quantity.is.null').neq('in_stock', false);
           else query = query.neq('in_stock', false);
       }

       if (filterSupplierId !== 'all') query = query.eq('supplier_id', parseInt(filterSupplierId));
       if (filterCategoryId !== 'all') {
           const cat = categories.find(c => String(c.id) === filterCategoryId);
           const catFilter = cat ? buildCategoryFilter(categories, cat, dbReady) : null;
           if (catFilter) query = query.or(catFilter);
       }

       if (filterPhoto === 'with') query = query.not('image_url', 'is', null).neq('image_url', '');
       else if (filterPhoto === 'without') query = query.or('image_url.is.null,image_url.eq.');

       query = query.order('in_stock', { ascending: false });

       if (tyreSort === 'newest') query = query.order('created_at', { ascending: false });
       else if (tyreSort === 'oldest') query = query.order('created_at', { ascending: true });
       // by the number, not the text (text put 900 after 5000)
       else if (tyreSort === 'price_asc') query = query.order('price_num', { ascending: true, nullsFirst: false });
       else if (tyreSort === 'price_desc') query = query.order('price_num', { ascending: false, nullsFirst: false });
       else if (tyreSort === 'with_photo') query = query.order('image_url', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
       else if (tyreSort === 'no_photo') query = query.order('image_url', { ascending: true, nullsFirst: true }).order('created_at', { ascending: false });

       const { data, error, count } = await query.range(from, to);
       if (error) throw error;

       if (count !== null) setTotalCount(count);

       if (data) {
          const processedData = data.map(t => {
              // season exists only for tyres — a pipe or a filter has none
              if (!isTyreProduct(t, categories)) return { ...t, season: null };
              const inferredSeason = detectSeason(t.title, t.description || '');
              let finalSeason = inferredSeason || t.season || 'summer';

              // Force all-season for truck/agro even on fetch if not set correctly
              if (t.vehicle_type === 'truck' || t.vehicle_type === 'agro') {
                  finalSeason = 'all-season';
              } else if (inferredSeason === null && (t.season === 'all' || t.season === 'all-season')) {
                  finalSeason = 'summer';
              }

              return { ...t, season: finalSeason };
          });

          const uniqueNew = Array.from(new Map(processedData.map(item => [item.id, item])).values()) as TyreProduct[];

          if (isRefresh) { 
              setTyres(uniqueNew); 
              setTyrePage(0); 
              setSelectedTyreIds(new Set()); 
          } else { 
              setTyres(prev => {
                  const newIds = new Set(uniqueNew.map(d => d.id));
                  return [...prev.filter(p => !newIds.has(p.id)), ...uniqueNew];
              }); 
              setTyrePage(pageIdx); 
          }
          setHasMoreTyres(data.length === PAGE_SIZE);
       }
    } catch (e: any) { 
        showError("Помилка завантаження: " + e.message);
    } finally { setLoadingTyres(false); }
  };

  const toggleSelection = (id: number) => {
      const newSet = new Set(selectedTyreIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedTyreIds(newSet);
  };

  const handleSelectAllOnPage = () => {
      const newSet = new Set(selectedTyreIds);
      const idsOnPage = tyres.map(t => t.id);
      const allSelected = idsOnPage.every(id => newSet.has(id));
      if (allSelected) idsOnPage.forEach(id => newSet.delete(id));
      else idsOnPage.forEach(id => newSet.add(id));
      setSelectedTyreIds(newSet);
  };

  const resetAllFilters = () => {
      setTyreSearch('');
      setFilterSupplierId('all');
      setTyreCategoryTab('all');
      setShowOnlyInStock(false);
      setFilterPhoto('all');
      setFilterCategoryId('all');
      setTyres([]);
      fetchTyres(0, true);
  };

  /** name of the chosen bucket with its number, for the menu button */
  const renderCategoryName = () => {
      switch(tyreCategoryTab) {
          case 'car': return `Легкові (${categoryCounts.car})`;
          case 'cargo': return `Вантажні C (${categoryCounts.cargo})`;
          case 'truck': return `ТІР (${categoryCounts.truck})`;
          case 'agro': return `Агро (${categoryCounts.agro})`;
          case 'suv': return `SUV (${categoryCounts.suv})`;
          case 'hot': return `HOT (${categoryCounts.hot})`;
          case 'out_of_stock': return `Немає (${categoryCounts.out})`;
          case 'no_photo': return `Без фото (${categoryCounts.no_photo})`;
          default: return `Всі (${categoryCounts.all})`;
      }
  };

  return {
    tyres, setTyres, loadingTyres, hasMoreTyres, tyrePage, totalCount, fetchTyres, fetchCategoryCounts,
    tyreSearch, setTyreSearch, tyreCategoryTab, setTyreCategoryTab, tyreSort, setTyreSort,
    filterSupplierId, setFilterSupplierId, filterCategoryId, setFilterCategoryId, showOnlyInStock, setShowOnlyInStock,
    suppliers, categoryCounts, enableStockQty,
    filterPhoto, setFilterPhoto,
    selectedTyreIds, setSelectedTyreIds, toggleSelection, handleSelectAllOnPage, resetAllFilters, renderCategoryName,
  };
};

export type TyresList = ReturnType<typeof useTyresList>;
