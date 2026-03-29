
import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, X, Upload, Save, Loader2, Sparkles, FileSpreadsheet, CheckSquare, Square, Edit2, ArrowDown, Wand2, RefreshCw, Menu, FolderOpen, Car, Truck, Mountain, Flame, Ban, Briefcase, ArrowUpDown, Settings, ArrowRight, HelpCircle, Ruler, Copy, Image as ImageIcon, Percent, AlertCircle, FileWarning, FilterX, Trash2, LayoutGrid, List, Snowflake, Sun, CloudSun, CheckCircle, Eye, EyeOff, Tractor, CircleDot, Globe, AlertTriangle, ShoppingCart } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { TyreProduct, Supplier } from '../../types';
import { WHEEL_RADII, CAR_RADII, CARGO_RADII, TRUCK_RADII, AGRO_RADII } from '../../constants';
import readXlsxFile from 'read-excel-file';
import AiSortModal from './AiSortModal';
import { invokeAiProxy } from '../../aiProxyClient';
import { normalizeQuery } from './sync/syncUtils';

const PAGE_SIZE = 50;

const KNOWN_BRANDS = [
    'NOKIAN', 'MICHELIN', 'CONTINENTAL', 'BRIDGESTONE', 'GOODYEAR', 'PIRELLI', 'HANKOOK', 'YOKOHAMA', 
    'TOYO', 'KUMHO', 'NEXEN', 'DUNLOP', 'PREMIORRI', 'ROSAVA', 'BELSHINA', 'TRIANGLE', 'SAILUN', 
    'LINGLONG', 'LAUFENN', 'COOPER', 'MATADOR', 'BARUM', 'SAVA', 'FULDA', 'KELLY', 'DEBICA', 
    'GENERAL', 'GISLAVED', 'VIKING', 'RIKEN', 'KORMORAN', 'KLEBER', 'BFGOODRICH', 'TIGAR', 
    'UNIROYAL', 'FIRESTONE', 'DAYTON', 'LASSA', 'STARMAXX', 'PETLAS', 'HIFLY', 'DOUBLESTAR', 'ETERNITY', 'OZKA', 'BKT', 'SEHA'
];

const AXIS_OPTIONS = [
    'Ведуча',
    'Причіпна',
    'Рульова',
    'Рульова, автобусна',
    'Рульова/Причіпна',
    'Універсальна'
];

const detectSeason = (title: string, description: string): string | null => {
    const text = (title + ' ' + (description || '')).toLowerCase();
    if (text.includes('зима') || text.includes('зимн') || text.includes('winter') || text.includes('snow') || text.includes('ice') || text.includes('stud') || text.includes('spike') || text.includes('alpin') || text.includes('nord') || text.includes('arct') || text.includes('blizzak') || text.includes('w442') || text.includes('w452') || text.includes('i fit') || text.includes('i*fit') || text.includes('kw31') || text.includes('rw') || text.includes('ws') || text.includes('dm')) return 'winter';
    if (text.includes('літо') || text.includes('літн') || text.includes('summer') || text.includes('sport') || text.includes('energy') || text.includes('premium') || text.includes('contact') || text.includes('control') || text.includes('turismo') || text.includes('potenza') || text.includes('ventu') || text.includes('lk01') || text.includes('lk41') || text.includes('s fit') || text.includes('g fit') || text.includes('k125') || text.includes('k115') || text.includes('k127') || text.includes('prime') || text.includes('blue')) return 'summer';
    if (text.includes('всесезон') || text.includes('all season') || text.includes('allseason') || text.includes('4s') || text.includes('quatrac') || text.includes('cross') || text.includes('weather') || text.includes('as')) return 'all-season';
    return null;
};

const TyresTab: React.FC = () => {
  const [tyres, setTyres] = useState<TyreProduct[]>([]);
  const [loadingTyres, setLoadingTyres] = useState(false);
  const [hasMoreTyres, setHasMoreTyres] = useState(true);
  const [tyrePage, setTyrePage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showKeyNeededError, setShowKeyNeededError] = useState(false);
  
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const [tyreSearch, setTyreSearch] = useState('');
  const [tyreCategoryTab, setTyreCategoryTab] = useState<'all' | 'car' | 'cargo' | 'truck' | 'agro' | 'suv' | 'hot' | 'out_of_stock' | 'no_photo'>('all');
  const [tyreSort, setTyreSort] = useState<'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'with_photo' | 'no_photo'>('newest');
  const [filterSupplierId, setFilterSupplierId] = useState<string>('all');
  const [showOnlyInStock, setShowOnlyInStock] = useState(false);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState({ all: 0, car: 0, cargo: 0, truck: 0, agro: 0, suv: 0, hot: 0, out: 0, no_photo: 0 });
  const [enableStockQty, setEnableStockQty] = useState(false);
  
  const normalizeQuery = (title: string): string => {
      return title
          .replace(/^Шина\s+/i, '')
          .replace(/\(.*\)/g, '')
          .replace(/DOT\d{4}/gi, '')
          .replace(/Шина/gi, '')
          .replace(/\d{4}$/, '') // remove year at the end
          .replace(/\s+/g, ' ')
          .trim();
  };
  // Inline editing state
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [editingStockId, setEditingStockId] = useState<number | null>(null);
  const [inlineValue, setInlineValue] = useState('');

  const [selectedTyreIds, setSelectedTyreIds] = useState<Set<number>>(new Set());
  const [bulkMarkup, setBulkMarkup] = useState('');
  const [bulkCategory, setBulkCategory] = useState(''); // NEW for Bulk Category
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);

  const [showAddTyreModal, setShowAddTyreModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [editingTyreId, setEditingTyreId] = useState<number | null>(null);
  const [tyreForm, setTyreForm] = useState({ 
      manufacturer: '', 
      name: '', 
      width: '', 
      height: '', 
      radius: 'R15', 
      season: 'winter', 
      vehicle_type: 'car' as 'car'|'cargo'|'suv'|'truck'|'agro', 
      price: '', 
      old_price: '', 
      base_price: '', 
      catalog_number: '', 
      product_number: '', 
      description: '', 
      is_hot: false, 
      supplier_id: '', 
      stock_quantity: '',
      axis: '',
      seo_title: '',
      seo_description: '',
      seo_keywords: '',
      slug: ''
  });
  const [tyreUploadFiles, setTyreUploadFiles] = useState<File[]>([]);
  const [existingGallery, setExistingGallery] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tyreToDelete, setTyreToDelete] = useState<number | null>(null);
  
  // Mobile UI state
  const [showFilters, setShowFilters] = useState(false);
  
  // Custom Bulk Delete Modal State
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  // Custom Category Delete Modal State
  const [showCategoryDeleteConfirm, setShowCategoryDeleteConfirm] = useState(false);

  // AI IMAGE SEARCH STATE
  const [showAiSearchModal, setShowAiSearchModal] = useState(false);
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [aiSearchResults, setAiSearchResults] = useState<any[]>([]);
  const [selectedAiUrls, setSelectedAiUrls] = useState<string[]>([]);
  const [isSearchingAi, setIsSearchingAi] = useState(false);
  const [targetTyreForAi, setTargetTyreForAi] = useState<TyreProduct | null>(null);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);
  const [apiErrorHint, setApiErrorHint] = useState(false);

  // BULK AI PHOTO PROCESSING STATE
  const [isBulkPhotoProcessing, setIsBulkPhotoProcessing] = useState(false);
  const [bulkPhotoProgress, setBulkPhotoProgress] = useState(0);
  const [bulkPhotoTotal, setBulkPhotoTotal] = useState(0);

  const showError = (msg: string) => { setErrorMessage(msg); setTimeout(() => setErrorMessage(''), 6000); };
  
  const handleCopyTitle = (text: string) => {
      navigator.clipboard.writeText(text);
      setSuccessMessage(`Скопійовано: ${text}`);
      setTimeout(() => setSuccessMessage(''), 2500);
  };

  const handleShareProduct = (tyre: TyreProduct) => {
      const shareText = `🛞 *${tyre.title}*\n💰 Ціна: ${tyre.price} грн\n📦 В наявності: ${tyre.stock_quantity || 'Так'}\n🔗 https://forsage-tyre.com.ua/product/${tyre.slug || tyre.id}`;
      navigator.clipboard.writeText(shareText);
      setSuccessMessage("Текст для месенджера скопійовано!");
      setTimeout(() => setSuccessMessage(''), 2500);
  };

  const isProductReady = (tyre: TyreProduct) => {
    return !!(tyre.description && tyre.seo_title && tyre.seo_description && tyre.image_url && !tyre.image_url.includes('picsum.photos'));
  };

  const handleInlineUpdate = async (id: number, field: 'price' | 'stock_quantity', value: string) => {
      const numVal = parseInt(value);
      if (isNaN(numVal)) {
          setEditingPriceId(null);
          setEditingStockId(null);
          return;
      }

      // Optimistic update
      setTyres(prev => prev.map(t => t.id === id ? { ...t, [field]: numVal } : t));
      
      try {
          const { error } = await supabase.from('tyres').update({ [field]: numVal }).eq('id', id);
          if (error) throw error;
          setSuccessMessage("Оновлено!");
          setTimeout(() => setSuccessMessage(''), 1500);
      } catch (e: any) {
          showError("Помилка: " + e.message);
          fetchTyres(tyrePage, true); // Revert on error
      } finally {
          setEditingPriceId(null);
          setEditingStockId(null);
      }
  };

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
  }, [tyreCategoryTab, tyreSort, filterSupplierId, enableStockQty, showOnlyInStock]);

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
               if(t) query = query.or(`title.ilike.%${t}%,catalog_number.ilike.%${t}%,radius.ilike.%${t}%,product_number.ilike.%${t}%,manufacturer.ilike.%${t}%`);
           });
       }
       
       if (tyreCategoryTab === 'car') query = query.or('vehicle_type.eq.car,vehicle_type.is.null').neq('vehicle_type', 'cargo').neq('vehicle_type', 'suv').not('radius', 'ilike', '%C%');
       else if (tyreCategoryTab === 'cargo') query = query.or('vehicle_type.eq.cargo,radius.ilike.%C%').not('radius', 'in', '("R17.5","R19.5","R22.5")');
       else if (tyreCategoryTab === 'truck') query = query.or('radius.eq.R17.5,radius.eq.R19.5,radius.eq.R22.5,title.ilike.%TIR%,title.ilike.%R17.5%,title.ilike.%R19.5%,title.ilike.%R22.5%');
       else if (tyreCategoryTab === 'agro') {
           const strictAgroRadii = [
               "R10","R12","R14.5","R15.3","R15.5","R24","R26","R28","R30","R32","R34","R36","R38","R40","R42","R44","R46","R48","R50","R52"
           ];
           const specKeywords = "title.ilike.%PR%,title.ilike.%OZKA%,title.ilike.%BKT%,title.ilike.%KNK%,title.ilike.%MPT%,title.ilike.%IND%,title.ilike.%TR-%,title.ilike.%IMP%,title.ilike.%Ф-%,title.ilike.%В-%";
           // Strong exclusion of Cargo terms
           query = query.or(`vehicle_type.eq.agro,and(vehicle_type.neq.car,vehicle_type.neq.suv,vehicle_type.neq.cargo,or(radius.in.("${strictAgroRadii.join('","')}"),${specKeywords}))`)
                        .not('title', 'ilike', '%(C)%')
                        .not('title', 'ilike', '% LT%')
                        .not('title', 'ilike', '%R14C%')
                        .not('title', 'ilike', '%R15C%')
                        .not('title', 'ilike', '%R16C%');
       }
       else if (tyreCategoryTab === 'suv') query = query.eq('vehicle_type', 'suv');
       else if (tyreCategoryTab === 'hot') query = query.eq('is_hot', true);
       else if (tyreCategoryTab === 'out_of_stock') query = query.eq('in_stock', false);
       else if (tyreCategoryTab === 'no_photo') query = query.is('image_url', null);
       else if (tyreCategoryTab === 'ready') {
           query = query.not('description', 'is', null)
                        .not('seo_title', 'is', null)
                        .not('seo_description', 'is', null)
                        .not('image_url', 'is', null)
                        .not('image_url', 'ilike', '%picsum.photos%');
       }

       if (showOnlyInStock && tyreCategoryTab !== 'out_of_stock') {
           if (enableStockQty) query = query.or('stock_quantity.gt.0,stock_quantity.is.null').neq('in_stock', false);
           else query = query.neq('in_stock', false);
       }

       if (filterSupplierId !== 'all') query = query.eq('supplier_id', parseInt(filterSupplierId));

       query = query.order('in_stock', { ascending: false });

       if (tyreSort === 'newest') query = query.order('created_at', { ascending: false });
       else if (tyreSort === 'oldest') query = query.order('created_at', { ascending: true });
       else if (tyreSort === 'price_asc') query = query.order('price', { ascending: true });
       else if (tyreSort === 'price_desc') query = query.order('price', { ascending: false });
       else if (tyreSort === 'with_photo') query = query.order('image_url', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
       else if (tyreSort === 'no_photo') query = query.order('image_url', { ascending: true, nullsFirst: true }).order('created_at', { ascending: false });
       
       const { data, error, count } = await query.range(from, to);
       if (error) throw error;

       if (count !== null) setTotalCount(count);

       if (data) {
          const processedData = data.map(t => {
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
      setTyres([]);
      fetchTyres(0, true);
  };

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

  const handleBulkPriceUpdate = async (dir: number) => {
      if(!bulkMarkup) return;
      setIsApplyingBulk(true);
      setTimeout(() => { setIsApplyingBulk(false); showError("Ціни оновлено (Mock)"); }, 500);
  };

  // --- BULK CATEGORY UPDATE (FIXED LOGIC) ---
  const handleBulkCategoryUpdate = async (category: string) => {
      if (!category || selectedTyreIds.size === 0) return;
      setIsApplyingBulk(true);
      try {
          const ids = Array.from(selectedTyreIds);
          const updates: any = { vehicle_type: category };
          
          // Force All-Season for Truck and Agro
          if (category === 'truck' || category === 'agro') {
              updates.season = 'all-season';
          }

          const { error } = await supabase.from('tyres').update(updates).in('id', ids);
          
          if (error) throw error;
          
          // Update local state
          setTyres(prev => prev.map(t => {
              if (selectedTyreIds.has(t.id)) {
                  return { 
                      ...t, 
                      vehicle_type: category as any,
                      season: (category === 'truck' || category === 'agro') ? 'all-season' : t.season 
                  };
              }
              return t;
          }));
          
          setSuccessMessage(`Оновлено категорію для ${ids.length} товарів.`);
          setBulkCategory('');
          setSelectedTyreIds(new Set()); // Clear selection
          fetchCategoryCounts();
          setTimeout(() => setSuccessMessage(''), 3000);
          
      } catch (e: any) {
          showError("Помилка оновлення категорії: " + e.message);
      } finally {
          setIsApplyingBulk(false);
      }
  };

  const handleBulkHotUpdate = async (action: 'add' | 'remove') => {
      if (selectedTyreIds.size === 0) return;
      setIsApplyingBulk(true);
      try {
          const ids = Array.from(selectedTyreIds);
          const updates = ids.map(id => ({ id, is_hot: action === 'add' }));
          for (const u of updates) await supabase.from('tyres').update(u).eq('id', u.id);
          
          showError(`Оновлено ${ids.length} товарів`);
          fetchTyres(0, true);
          setSelectedTyreIds(new Set());
      } catch (e: any) { showError(e.message); }
      finally { setIsApplyingBulk(false); }
  };

  // --- BULK DELETE ---
  const handleBulkDelete = () => {
      if (selectedTyreIds.size === 0) return;
      setShowBulkDeleteConfirm(true);
  };

  const executeBulkDelete = async () => {
      setShowBulkDeleteConfirm(false);
      setIsApplyingBulk(true);
      try {
          const ids = Array.from(selectedTyreIds);
          const { error } = await supabase.from('tyres').delete().in('id', ids);
          
          if (error) throw error;
          
          setTyres(prev => prev.filter(t => !selectedTyreIds.has(t.id)));
          setSelectedTyreIds(new Set());
          setSuccessMessage(`Успішно видалено ${ids.length} товарів.`);
          setTimeout(() => setSuccessMessage(''), 3000);
          fetchCategoryCounts();
      } catch (e: any) { 
          showError("Помилка видалення: " + e.message); 
      } finally { 
          setIsApplyingBulk(false); 
      }
  };

  // --- CATEGORY DELETE LOGIC ---
  const executeCategoryDelete = async () => {
      if (tyreCategoryTab === 'all') return;
      setShowCategoryDeleteConfirm(false);
      setIsApplyingBulk(true);
      
      try {
          let query = supabase.from('tyres').delete();
          
          // Must mirror fetchTyres filters exactly
          if (tyreCategoryTab === 'car') query = query.or('vehicle_type.eq.car,vehicle_type.is.null').neq('vehicle_type', 'cargo').neq('vehicle_type', 'suv').not('radius', 'ilike', '%C%');
          else if (tyreCategoryTab === 'cargo') query = query.or('vehicle_type.eq.cargo,radius.ilike.%C%').not('radius', 'in', '("R17.5","R19.5","R22.5")');
          else if (tyreCategoryTab === 'truck') query = query.or('radius.eq.R17.5,radius.eq.R19.5,radius.eq.R22.5,title.ilike.%TIR%,title.ilike.%R17.5%,title.ilike.%R19.5%,title.ilike.%R22.5%');
          else if (tyreCategoryTab === 'agro') {
               const strictAgroRadii = [
                   "R10","R12","R14.5","R15.3","R15.5","R24","R26","R28","R30","R32","R34","R36","R38","R40","R42","R44","R46","R48","R50","R52"
               ];
               const specKeywords = "title.ilike.%PR%,title.ilike.%OZKA%,title.ilike.%BKT%,title.ilike.%KNK%,title.ilike.%MPT%,title.ilike.%IND%,title.ilike.%TR-%,title.ilike.%IMP%,title.ilike.%Ф-%,title.ilike.%В-%";
               query = query.or(`vehicle_type.eq.agro,and(vehicle_type.neq.car,vehicle_type.neq.suv,vehicle_type.neq.cargo,or(radius.in.("${strictAgroRadii.join('","')}"),${specKeywords}))`)
                            .not('title', 'ilike', '%(C)%')
                            .not('title', 'ilike', '% LT%')
                            .not('title', 'ilike', '%R14C%')
                            .not('title', 'ilike', '%R15C%')
                            .not('title', 'ilike', '%R16C%');
          }
          else if (tyreCategoryTab === 'suv') query = query.eq('vehicle_type', 'suv');
          else if (tyreCategoryTab === 'hot') query = query.eq('is_hot', true);
          else if (tyreCategoryTab === 'out_of_stock') query = query.eq('in_stock', false);
          else if (tyreCategoryTab === 'no_photo') query = query.is('image_url', null);
          else if (tyreCategoryTab === 'ready') {
              query = query.not('description', 'is', null)
                           .not('seo_title', 'is', null)
                           .not('seo_description', 'is', null)
                           .not('image_url', 'is', null)
                           .not('image_url', 'ilike', '%picsum.photos%');
          }

          // We intentionally do NOT use tyreSearch or supplier filters here to ensure we clear the Category bucket completely
          
          const { error, count } = await query.select('*', { count: 'exact', head: true }); // We actually want to delete, select count is optional but confirm delete happened
          // Actually supbase delete returns rows if select() is chained, but we just need error check.
          
          if (error) throw error;

          setSuccessMessage(`Категорію очищено.`);
          setTimeout(() => setSuccessMessage(''), 3000);
          
          // Reset UI
          setTyres([]);
          setTyrePage(0);
          fetchTyres(0, true);
          fetchCategoryCounts();

      } catch (e: any) {
          showError("Помилка очищення категорії: " + e.message);
      } finally {
          setIsApplyingBulk(false);
      }
  };

  const handleQuickHotToggle = async (tyre: TyreProduct) => {
      const newStatus = !tyre.is_hot;
      setTyres(prev => prev.map(t => t.id === tyre.id ? { ...t, is_hot: newStatus } : t));
      try {
          const { error } = await supabase.from('tyres').update({ is_hot: newStatus }).eq('id', tyre.id);
          if (error) throw error;
      } catch (e: any) {
          setTyres(prev => prev.map(t => t.id === tyre.id ? { ...t, is_hot: !newStatus } : t));
          showError("Помилка оновлення: " + e.message);
      }
  };

  // --- AI IMAGE SEARCH LOGIC ---
  const handleOpenAiSearch = (tyre: TyreProduct) => {
      setTargetTyreForAi(tyre);
      const q = normalizeQuery(tyre.title);
      setAiSearchQuery(q);
      setAiSearchResults([]);
      setSelectedAiUrls([]);
      setAiSearchError(null);
      setShowAiSearchModal(true);
      performAiSearch(q);
  };

  const performAiSearch = async (query: string) => {
      setIsSearchingAi(true);
      setAiSearchError(null);
      setApiErrorHint(false);
      try {
          const res = await invokeAiProxy({
              mode: 'image_search',
              query: query
          });
          if (res.ok && Array.isArray(res.data)) {
              setAiSearchResults(res.data);
              if (res.data.length === 0) {
                  setAiSearchError("Нічого не знайдено. Спробуйте змінити запит.");
              }
          }
      } catch (e: any) {
          if (e.message && e.message.includes('Додайте Serper')) {
              setApiErrorHint(true);
          } else {
              setAiSearchError(e.message);
          }
      } finally {
          setIsSearchingAi(false);
      }
  };

  const toggleAiImage = (url: string) => {
      setSelectedAiUrls(prev => 
          prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]
      );
  };

  const handleSaveAiImages = async () => {
      if (!targetTyreForAi || selectedAiUrls.length === 0) return;
      const tId = targetTyreForAi.id;
      
      const mainUrl = selectedAiUrls[0];
      const gallery = selectedAiUrls.slice(1);
      
      // Optimistic update
      setTyres(prev => prev.map(t => t.id === tId ? { ...t, image_url: mainUrl, gallery } : t));
      
      try {
          const { error } = await supabase.from('tyres').update({ 
              image_url: mainUrl,
              gallery: gallery 
          }).eq('id', tId);
          if (error) throw error;
          setSuccessMessage("Фото та галерею оновлено!");
          setTimeout(() => setSuccessMessage(''), 2000);
          setShowAiSearchModal(false);
          fetchCategoryCounts();
      } catch (e: any) {
          showError("Помилка збереження: " + e.message);
          fetchTyres(tyrePage, true);
      }
  };

  // --- BULK PHOTO OPERATIONS ---
  const handleBulkDeletePhotos = async () => {
      if (selectedTyreIds.size === 0) return;
      if (!confirm(`Видалити фото для ${selectedTyreIds.size} товарів?`)) return;
      
      setIsApplyingBulk(true);
      try {
          const ids = Array.from(selectedTyreIds);
          const { error } = await supabase.from('tyres').update({ image_url: null, gallery: [] }).in('id', ids);
          if (error) throw error;
          
          setTyres(prev => prev.map(t => selectedTyreIds.has(t.id) ? { ...t, image_url: null, gallery: [] } : t));
          setSuccessMessage(`Видалено фото для ${ids.length} товарів.`);
          setSelectedTyreIds(new Set());
          fetchCategoryCounts();
      } catch (e: any) {
          showError("Помилка видалення фото: " + e.message);
      } finally {
          setIsApplyingBulk(false);
      }
  };

  const handleBulkAiSearch = async (onlyMissing: boolean) => {
      if (selectedTyreIds.size === 0) return;
      
      const idsToProcess = Array.from(selectedTyreIds).filter(id => {
          if (!onlyMissing) return true;
          const t = tyres.find(ty => ty.id === id);
          return !t?.image_url;
      });

      if (idsToProcess.length === 0) {
          showError("Немає товарів для обробки.");
          return;
      }

      setIsBulkPhotoProcessing(true);
      setBulkPhotoTotal(idsToProcess.length);
      setBulkPhotoProgress(0);

      let successCount = 0;
      for (const [index, id] of idsToProcess.entries()) {
          const tyre = tyres.find(t => t.id === id);
          if (!tyre) continue;

          try {
              const cleanQ = normalizeQuery(tyre.title);
              const res = await invokeAiProxy({ mode: 'image_search', query: cleanQ });
              if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
                  const firstImg = res.data[0].imageUrl;
                  await supabase.from('tyres').update({ image_url: firstImg }).eq('id', id);
                  setTyres(prev => prev.map(t => t.id === id ? { ...t, image_url: firstImg } : t));
                  successCount++;
              }
              // Rate limiting delay
              await new Promise(r => setTimeout(r, 600)); 
          } catch (e: any) {
              if (e.message && e.message.includes('Додайте Serper')) {
                  setShowKeyNeededError(true);
                  setIsBulkPhotoProcessing(false);
                  return;
              }
              console.error(`Error processing ID ${id}:`, e);
          }
          setBulkPhotoProgress(index + 1);
      }

      setIsBulkPhotoProcessing(false);
      setSuccessMessage(`Оброблено! Додано фото для ${successCount} товарів.`);
      setSelectedTyreIds(new Set());
      fetchCategoryCounts();
  };

  const applyDiscount = (pct: number) => {
      const price = parseFloat(tyreForm.price);
      if (!price) return;
      const base = parseFloat(tyreForm.old_price) || price;
      const newPrice = Math.round(base * (1 - pct / 100));
      setTyreForm(prev => ({ ...prev, old_price: base.toString(), price: newPrice.toString() }));
  };

  const handleSaveTyre = async () => {
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const fileItem of tyreUploadFiles) {
         const fileName = `tyre_${Date.now()}_${fileItem.name.replace(/\s+/g, '_')}`;
         const { error } = await supabase.storage.from('galery').upload(fileName, fileItem);
         if (!error) { const { data } = supabase.storage.from('galery').getPublicUrl(fileName); newUrls.push(data.publicUrl); }
      }
      
      const finalGallery = Array.from(new Set([...existingGallery, ...newUrls]));
      
      // FORCE ALL-SEASON IF TRUCK OR AGRO
      const forcedSeason = (tyreForm.vehicle_type === 'truck' || tyreForm.vehicle_type === 'agro') 
                           ? 'all-season' 
                           : tyreForm.season;

      const seasonLabel = forcedSeason === 'winter' ? 'Winter' : forcedSeason === 'summer' ? 'Summer' : 'All Season';
      const sizeStr = (tyreForm.width && tyreForm.height) ? `${tyreForm.width}/${tyreForm.height}` : '';
      const fullTitle = `${tyreForm.manufacturer} ${tyreForm.name} ${sizeStr} ${tyreForm.radius} ${seasonLabel}`.replace(/\s+/g, ' ').trim();

      const payload: any = {
        title: fullTitle,
        description: tyreForm.description || `Сезон: ${seasonLabel}.`,
        price: tyreForm.price, 
        old_price: tyreForm.old_price || null,
        base_price: tyreForm.base_price || '0', 
        manufacturer: tyreForm.manufacturer, 
        catalog_number: tyreForm.catalog_number,
        product_number: tyreForm.product_number,
        radius: tyreForm.radius, 
        season: forcedSeason, 
        vehicle_type: tyreForm.vehicle_type,
        axis: tyreForm.axis, // Added Axis
        seo_title: tyreForm.seo_title || null,
        seo_description: tyreForm.seo_description || null,
        seo_keywords: tyreForm.seo_keywords || null,
        slug: tyreForm.slug || null,
        image_url: finalGallery[0] || null, 
        gallery: finalGallery, 
        is_hot: tyreForm.is_hot,
        supplier_id: tyreForm.supplier_id ? parseInt(tyreForm.supplier_id) : null,
        stock_quantity: tyreForm.stock_quantity ? parseInt(tyreForm.stock_quantity) : 0,
        in_stock: true
      };

      if (editingTyreId) {
          await supabase.from('tyres').update(payload).eq('id', editingTyreId);
      } else {
          await supabase.from('tyres').insert([payload]);
      }
      
      fetchTyres(0, true); 
      setShowAddTyreModal(false);
    } catch (err: any) { showError(err.message); } finally { setUploading(false); }
  };

  const openEditTyreModal = (t: TyreProduct) => {
      setEditingTyreId(t.id);
      let width = '', height = '';
      const sizeRegex = /(\d{3})[\/\s](\d{2})/;
      const match = t.title.match(sizeRegex);
      if (match) { width = match[1]; height = match[2]; }
      
      let name = t.title;
      if (t.manufacturer) name = name.replace(t.manufacturer, '');
      if (width && height) name = name.replace(`${width}/${height}`, '').replace(`${width} ${height}`, '');
      if (t.radius) name = name.replace(t.radius, '');
      name = name.replace(/Winter|Summer|All Season|Зима|Літо|Всесезон/gi, '');
      name = name.replace(/\s+/g, ' ').trim();

      let parsedSeason = t.season || detectSeason(t.title, t.description || '') || 'summer';
      // Force correction on open
      if (t.vehicle_type === 'truck' || t.vehicle_type === 'agro') {
          parsedSeason = 'all-season';
      }

      setTyreForm({ 
        manufacturer: t.manufacturer || '', 
        name: name, 
        width, height,
        radius: t.radius || 'R15', 
        season: parsedSeason, 
        vehicle_type: t.vehicle_type || 'car', 
        price: String(t.price || ''), 
        old_price: String(t.old_price || ''), 
        base_price: String(t.base_price || ''), 
        catalog_number: t.catalog_number || '',
        product_number: t.product_number || '',
        description: t.description || '', 
        is_hot: !!t.is_hot,
        supplier_id: t.supplier_id ? String(t.supplier_id) : '',
        stock_quantity: t.stock_quantity ? String(t.stock_quantity) : '',
        axis: t.axis || '',
        seo_title: t.seo_title || '',
        seo_description: t.seo_description || '',
        seo_keywords: t.seo_keywords || '',
        slug: t.slug || ''
      });
      
      let currentGallery = t.gallery || [];
      if (currentGallery.length === 0 && t.image_url) {
          currentGallery = [t.image_url];
      }
      setExistingGallery(currentGallery);
      setTyreUploadFiles([]);
      setShowAddTyreModal(true);
  };

  const handleDeleteTyre = async () => {
    if (tyreToDelete) {
        await supabase.from('tyres').delete().eq('id', tyreToDelete);
        setTyreToDelete(null);
        setShowDeleteModal(false);
        fetchTyres(0, true);
    }
  };

  // Helper to get available radii based on vehicle type
  const getRadiiOptions = (type: string) => {
      switch(type) {
          case 'truck': return TRUCK_RADII;
          case 'agro': return AGRO_RADII;
          case 'cargo': return CARGO_RADII;
          case 'car': 
          case 'suv':
          default: return CAR_RADII;
      }
  };

  // Handle Paste Event for Image Upload
  const handleModalPaste = (e: React.ClipboardEvent) => {
      if (e.clipboardData.files.length > 0) {
          e.preventDefault();
          const newFiles = Array.from(e.clipboardData.files).filter((f: any) => f.type.startsWith('image/'));
          if (newFiles.length > 0) {
              setTyreUploadFiles(prev => [...prev, ...newFiles]);
              setSuccessMessage(`Додано ${newFiles.length} фото з буферу!`);
              setTimeout(() => setSuccessMessage(''), 2000);
          }
      }
  };

  return (
    <div className="animate-in fade-in pb-20">
        {errorMessage && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] bg-red-900/90 text-white px-6 py-3 rounded-full border border-red-500 shadow-2xl">{errorMessage}</div>}
        {successMessage && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] bg-green-600/90 text-white px-6 py-3 rounded-full border border-green-400 shadow-2xl flex items-center gap-2"><CheckCircle size={20} />{successMessage}</div>}
        
        {/* --- TOP TOOLBAR --- */}
        <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center gap-2">
                <div className="relative flex-grow">
                    <button 
                        onClick={() => setShowCategoryMenu(!showCategoryMenu)} 
                        className="w-full bg-zinc-900 text-white font-bold px-3 py-2.5 rounded-xl flex items-center gap-2 border border-zinc-800 hover:bg-zinc-800 transition-colors justify-between text-left"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <Menu size={18} className="text-[#FFC300] shrink-0"/> 
                            <span className="uppercase tracking-tight text-[11px] sm:text-xs truncate">{renderCategoryName()}</span>
                        </div>
                    </button>
                    
                    {showCategoryMenu && (
                        <div className="absolute top-full left-0 mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="max-h-[60vh] overflow-y-auto no-scrollbar">
                                <button onClick={() => { resetAllFilters(); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-800/50 text-sm font-medium"><FolderOpen size={18}/> Всі ({categoryCounts.all})</button>
                                <button onClick={() => { setTyreCategoryTab('car'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-800/50 text-sm font-medium"><Car size={18}/> Легкові ({categoryCounts.car})</button>
                                <button onClick={() => { setTyreCategoryTab('cargo'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-800/50 text-sm font-medium"><Truck size={18}/> Вантажні C ({categoryCounts.cargo})</button>
                                <button onClick={() => { setTyreCategoryTab('truck'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-800/50 text-sm font-medium text-blue-300"><Truck size={18}/> TIR ({categoryCounts.truck})</button>
                                <button onClick={() => { setTyreCategoryTab('agro'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-800/50 text-sm font-medium text-green-300"><Tractor size={18}/> Агро ({categoryCounts.agro})</button>
                                <button onClick={() => { setTyreCategoryTab('suv'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-800/50 text-sm font-medium"><Mountain size={18}/> SUV ({categoryCounts.suv})</button>
                                <button onClick={() => { setTyreCategoryTab('hot'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-800/50 text-sm font-medium"><Flame size={18}/> HOT ({categoryCounts.hot})</button>
                                <button onClick={() => { setTyreCategoryTab('ready'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-800/50 text-sm font-medium text-green-400"><CheckCircle size={18}/> Готові ({categoryCounts.ready})</button>
                                <button onClick={() => { setTyreCategoryTab('no_photo'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-800/50 text-sm font-medium text-orange-300"><ImageIcon size={18}/> Без фото ({categoryCounts.no_photo})</button>
                                <button onClick={() => { setTyreCategoryTab('out_of_stock'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 text-sm font-medium"><Ban size={18}/> Немає ({categoryCounts.out})</button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-1.5 md:hidden">
                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2.5 rounded-xl border transition-all ${showFilters ? 'bg-[#FFC300] border-[#FFC300] text-black shadow-lg shadow-yellow-900/20' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                    >
                        <Settings size={20} />
                    </button>
                    <button onClick={() => setShowAiModal(true)} className="p-2.5 bg-purple-600 text-white rounded-xl shadow-lg shadow-purple-900/20"><Sparkles size={20}/></button>
                    <button onClick={() => {setEditingTyreId(null); setShowAddTyreModal(true);}} className="p-2.5 bg-[#FFC300] text-black rounded-xl shadow-lg shadow-yellow-900/20"><Plus size={20}/></button>
                </div>

                <div className="hidden md:flex gap-2">
                    <button onClick={() => setShowAiModal(true)} className="bg-purple-600 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-purple-500 transition-all shadow-lg active:scale-95"><Sparkles size={18}/> <span>AI Сортування</span></button>
                    <button onClick={() => {setEditingTyreId(null); setShowAddTyreModal(true);}} className="bg-[#FFC300] text-black font-black px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[#e6b000] transition-all shadow-lg active:scale-95"><Plus size={18}/> <span>Додати</span></button>
                </div>
            </div>

            {/* Mobile Expandable Filters */}
            <div className={`${showFilters ? 'flex' : 'hidden md:flex'} flex-col md:flex-row gap-2 animate-in slide-in-from-top-2 duration-200`}>
                <div className="grid grid-cols-2 md:flex gap-2 w-full md:w-auto">
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"><Briefcase size={14}/></div>
                        <select value={filterSupplierId} onChange={(e) => setFilterSupplierId(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-2 py-2.5 outline-none focus:border-[#FFC300] text-[11px] font-bold appearance-none cursor-pointer text-white">
                            <option value="all">Всі Пост.</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"><ArrowUpDown size={14}/></div>
                        <select value={tyreSort} onChange={(e) => setTyreSort(e.target.value as any)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-2 py-2.5 outline-none focus:border-[#FFC300] text-[11px] font-bold appearance-none cursor-pointer text-white">
                            <option value="newest">Нові</option>
                            <option value="oldest">Старі</option>
                            <option value="price_asc">Дешеві</option>
                            <option value="price_desc">Дорогі</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-2 w-full md:flex-grow">
                    <div className="relative flex-grow flex items-center">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16}/>
                        <input 
                            type="text" 
                            placeholder="Пошук (Назва, Код)..." 
                            value={tyreSearch} 
                            onChange={e => {
                                const val = e.target.value;
                                setTyreSearch(val);
                                if (val === '') setTimeout(() => fetchTyres(0, true), 0);
                            }} 
                            onKeyDown={e => e.key==='Enter' && fetchTyres(0,true)} 
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-[#FFC300] text-xs font-bold text-white placeholder:text-zinc-600" 
                        />
                    </div>
                    
                    <button 
                        onClick={() => setShowOnlyInStock(!showOnlyInStock)}
                        className={`flex items-center justify-center p-2.5 rounded-xl border transition-all ${showOnlyInStock ? 'bg-green-900/30 border-green-500 text-green-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                    >
                        {showOnlyInStock ? <Eye size={18}/> : <EyeOff size={18}/>}
                    </button>

                    <div className="flex bg-zinc-900 rounded-xl border border-zinc-800 p-1">
                        <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg ${viewMode === 'grid' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-white'}`}><LayoutGrid size={18}/></button>
                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg ${viewMode === 'list' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-white'}`}><List size={18}/></button>
                    </div>
                </div>
            </div>
        </div>

        {selectedTyreIds.size > 0 && (
            <div className="fixed bottom-20 left-4 right-4 md:relative md:bottom-auto md:left-auto md:right-auto z-[90] md:z-0 animate-in slide-in-from-bottom-4 duration-300">
                <div className="bg-zinc-900/95 backdrop-blur-md border border-[#FFC300]/30 md:border-zinc-700 rounded-2xl p-3 shadow-2xl overflow-hidden">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                        <div className="flex items-center justify-between w-full md:w-auto gap-4">
                            <div className="text-zinc-400 font-bold text-[10px] uppercase flex items-center gap-2">
                                <Settings size={14} className="text-[#FFC300]" /> <span>Масове управління</span>
                                <span className="text-[10px] text-white bg-zinc-700 px-2 py-0.5 rounded-full">обрано: {selectedTyreIds.size}</span>
                            </div>
                            <button onClick={() => setSelectedTyreIds(new Set())} className="md:hidden text-zinc-500 hover:text-white"><X size={18}/></button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                            <div className="hidden lg:block border-r border-zinc-700 pr-2">
                                <select 
                                    value={bulkCategory}
                                    onChange={(e) => handleBulkCategoryUpdate(e.target.value)}
                                    className="bg-black border border-zinc-700 rounded-lg p-2 text-white text-[10px] font-bold w-36 outline-none focus:border-[#FFC300]"
                                >
                                    <option value="">Категорія...</option>
                                    <option value="car">Легкова</option>
                                    <option value="suv">SUV</option>
                                    <option value="cargo">Вантажна C</option>
                                    <option value="truck">TIR</option>
                                    <option value="agro">Агро</option>
                                </select>
                            </div>

                            <div className="flex gap-1.5 border-r border-zinc-700 pr-2">
                                <button 
                                    onClick={() => handleBulkAiSearch(true)} 
                                    className="p-2 bg-purple-900/30 hover:bg-purple-600 border border-purple-500/30 text-purple-200 rounded-lg text-[9px] font-black flex items-center gap-1.5"
                                    title="Тільки де немає фото"
                                >
                                    <Sparkles size={14}/> ШІ НОВІ
                                </button>
                                <button 
                                    onClick={() => handleBulkAiSearch(false)} 
                                    className="p-2 bg-zinc-800 hover:bg-purple-600 border border-zinc-700 text-zinc-300 rounded-lg text-[9px] font-black flex items-center gap-1.5"
                                    title="Замінити наявні через ШІ"
                                >
                                    <RefreshCw size={14}/> ШІ ЗАМІНА
                                </button>
                                <button 
                                    onClick={handleBulkDeletePhotos} 
                                    className="p-2 bg-zinc-800 hover:bg-red-600 border border-zinc-700 text-zinc-400 rounded-lg text-[9px] font-black flex items-center gap-1.5"
                                    title="Видалити фото"
                                >
                                    <ImageIcon size={14}/> ОЧИСТИТИ
                                </button>
                            </div>

                            <div className="flex items-center gap-1.5 flex-grow md:flex-none">
                                <input type="text" value={bulkMarkup} onChange={e => setBulkMarkup(e.target.value)} placeholder="%" className="w-12 h-9 p-0 rounded-lg bg-black border border-zinc-700 text-white text-center font-bold text-xs outline-none focus:border-[#FFC300]" />
                                <button onClick={() => handleBulkPriceUpdate(1)} className="flex-grow md:flex-none h-9 bg-green-900/30 text-green-400 px-3 rounded-lg font-bold border border-green-800/50 hover:bg-green-800/50 flex items-center justify-center gap-1 transition-colors text-[10px] uppercase"><ArrowRight size={12} className="-rotate-45"/> Ціна</button>
                                <button onClick={() => handleBulkPriceUpdate(-1)} className="flex-grow md:flex-none h-9 bg-red-900/30 text-red-400 px-3 rounded-lg font-bold border border-red-800/50 hover:bg-red-800/50 flex items-center justify-center gap-1 transition-colors text-[10px] uppercase"><ArrowRight size={12} className="rotate-45"/> Ціна</button>
                            </div>

                            <div className="flex items-center gap-1.5 w-full md:w-auto">
                                <button onClick={() => handleBulkHotUpdate('add')} className="flex-1 md:flex-none h-9 bg-orange-900/30 text-orange-400 px-3 rounded-lg font-bold border border-orange-800/50 hover:bg-orange-800/50 flex items-center justify-center gap-1 transition-colors text-[10px] uppercase"><Flame size={12} /> HOT</button>
                                <button onClick={handleBulkDelete} disabled={isApplyingBulk} className="flex-1 md:flex-none h-9 bg-red-600/20 text-red-500 px-3 rounded-lg font-bold hover:bg-red-600 hover:text-white border border-red-900/30 flex items-center justify-center gap-1 transition-colors text-[10px] uppercase">
                                    {isApplyingBulk ? <Loader2 className="animate-spin text-red-500" size={14}/> : <Trash2 size={12} />} 
                                    Видалити
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- MAIN CONTENT --- */}
        {loadingTyres && tyres.length === 0 ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#FFC300]" size={48} /></div>
        ) : tyres.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/50">
                <FilterX size={48} className="text-zinc-600 mb-4"/>
                <h3 className="text-xl font-bold text-white mb-2">Шин не знайдено</h3>
                <p className="text-zinc-400 text-sm mb-6 max-w-md text-center">Перевірте фільтри або пошуковий запит.</p>
                <button onClick={resetAllFilters} className="bg-[#FFC300] text-black font-bold px-6 py-3 rounded-xl hover:bg-[#e6b000] flex items-center gap-2"><RefreshCw size={20}/> Скинути все</button>
            </div>
        ) : viewMode === 'list' ? (
            /* --- LIST VIEW (Responsive) --- */
            <div className="space-y-3 md:space-y-0">
                {/* Mobile List View (Cards) */}
                <div className="md:hidden space-y-2">
                    {tyres.map(tyre => {
                        const isSelected = selectedTyreIds.has(tyre.id);
                        const isOutOfStock = tyre.in_stock === false;
                        return (
                            <div key={tyre.id} className={`bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 flex gap-3 relative transition-all ${isSelected ? 'ring-2 ring-[#FFC300] bg-[#FFC300]/5' : ''} ${isOutOfStock ? 'opacity-70' : ''}`}>
                                <div className="w-16 h-16 bg-black rounded-lg border border-zinc-800 flex-shrink-0 relative overflow-hidden cursor-pointer shadow-inner" onClick={() => openEditTyreModal(tyre)}>
                                    {tyre.image_url ? (
                                        <img src={tyre.image_url} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-800"><ImageIcon size={20}/></div>
                                    )}
                                    {isOutOfStock && <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center"><span className="text-[7px] font-black bg-red-600 text-white px-1 rounded uppercase">Немає</span></div>}
                                </div>
                                <div className="flex-grow min-w-0 flex flex-col justify-between py-0.5">
                                    <div className="cursor-pointer" onClick={() => openEditTyreModal(tyre)}>
                                        <div className="flex justify-between items-start gap-2 mb-0.5">
                                            <div className="flex items-center gap-1 min-w-0">
                                                <span className="text-[9px] text-zinc-500 font-black uppercase truncate tracking-wider">{tyre.manufacturer || 'Шина'}</span>
                                                {isProductReady(tyre) && <CheckCircle size={10} className="text-green-500 flex-shrink-0" />}
                                            </div>
                                            <button onClick={(e) => { e.stopPropagation(); toggleSelection(tyre.id); }} className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${isSelected ? 'bg-[#FFC300] border-[#FFC300] text-black scale-110 shadow-lg shadow-yellow-900/20' : 'border-zinc-700 bg-black/40'}`}>
                                                {isSelected && <CheckSquare size={12}/>}
                                            </button>
                                        </div>
                                        <h4 className="text-[11px] font-bold text-white line-clamp-1 mb-1 leading-tight">{tyre.title}</h4>
                                        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[10px]">
                                            <span className="text-[#FFC300] font-black">{tyre.price} грн</span>
                                            <span className="text-zinc-600">/</span>
                                            <span className="text-zinc-400 font-medium">{tyre.radius}</span>
                                            {tyre.stock_quantity !== undefined && (
                                                <>
                                                    <span className="text-zinc-600">/</span>
                                                    <span className={`font-black ${parseInt(tyre.stock_quantity) < 4 ? 'text-red-500' : 'text-zinc-500'}`}>
                                                        {tyre.stock_quantity} шт
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-2 flex gap-1.5">
                                        <button 
                                            onClick={() => {
                                                const msg = `Нове замовлення: ${tyre.title} (${tyre.price} грн)`;
                                                navigator.clipboard.writeText(msg);
                                                setSuccessMessage("Дані копійовано!");
                                                setTimeout(() => setSuccessMessage(''), 2000);
                                            }} 
                                            className="h-8 w-8 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg text-blue-400 shrink-0 border border-zinc-700/50" 
                                        >
                                            <ShoppingCart size={14}/>
                                        </button>
                                        <button onClick={() => openEditTyreModal(tyre)} className="flex-grow h-8 bg-[#FFC300] text-black text-[10px] font-black rounded-lg uppercase tracking-wider flex items-center justify-center gap-1 active:scale-95 transition-transform shadow-md shadow-yellow-900/10">
                                            <Edit2 size={12}/> Редагувати
                                        </button>
                                        <button onClick={() => { setTyreToDelete(tyre.id); setShowDeleteModal(true); }} className="h-8 w-8 flex items-center justify-center bg-zinc-800/50 text-red-500 rounded-lg border border-red-900/10 active:bg-red-900/20 shrink-0">
                                            <Trash2 size={14}/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Desktop List View (Table) */}
                <div className="hidden md:block bg-black border border-zinc-800 rounded-xl overflow-hidden shadow-xl overflow-x-auto no-scrollbar">
                    <div className="min-w-[1000px]">
                        {/* Header */}
                        <div className="grid grid-cols-[40px_100px_120px_40px_50px_80px_100px_minmax(0,1fr)_50px_80px_60px_120px] gap-2 p-3 bg-black border-b border-zinc-800 text-zinc-500 text-xs font-bold uppercase items-center sticky top-0 z-20">
                            <div className="flex justify-center">
                                <button onClick={handleSelectAllOnPage} className={`w-5 h-5 rounded border flex items-center justify-center ${tyres.every(t => selectedTyreIds.has(t.id)) ? 'bg-[#FFC300] border-[#FFC300] text-black' : 'border-zinc-600 hover:border-zinc-400'}`}>
                                    {tyres.every(t => selectedTyreIds.has(t.id)) && <CheckSquare size={14}/>}
                                </button>
                            </div>
                            <div className="text-center">Фото</div>
                            <div>Код</div>
                            <div className="text-center text-orange-500 flex justify-center"><Flame size={16}/></div>
                            <div className="text-center">Кат.</div>
                            <div className="text-center font-bold">Сезон</div>
                            <div>Пост.</div>
                            <div className="min-w-0">Назва</div>
                            <div className="text-center">R</div>
                            <div className="text-right">Ціна</div>
                            <div className="text-center">Зал.</div>
                            <div className="text-center">Дії</div>
                        </div>

                        {/* Body */}
                        <div className="divide-y divide-zinc-800">
                            {tyres.map(tyre => {
                                const isSelected = selectedTyreIds.has(tyre.id);
                                const supplierName = suppliers.find(s => s.id === tyre.supplier_id)?.name || '-';
                                const isOutOfStock = tyre.in_stock === false;
                                
                                return (
                                    <div key={tyre.id} className={`grid grid-cols-[40px_100px_120px_40px_50px_80px_100px_minmax(0,1fr)_50px_80px_60px_120px] gap-2 p-2 items-center hover:bg-zinc-900 transition-colors ${isSelected ? 'bg-zinc-800/50' : ''} ${isOutOfStock ? 'opacity-80' : ''}`}>
                                        <div className="flex justify-center">
                                            <button onClick={() => toggleSelection(tyre.id)} className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-[#FFC300] border-[#FFC300] text-black' : 'border-zinc-600 hover:border-zinc-400'}`}>
                                                {isSelected && <CheckSquare size={12}/>}
                                            </button>
                                        </div>
                                        <div className="relative flex justify-center group h-20 w-20 mx-auto">
                                            <div className="w-20 h-20 bg-black rounded border border-zinc-700 overflow-visible relative flex items-center justify-center">
                                                {tyre.image_url ? (
                                                    <img src={tyre.image_url} className="absolute left-0 top-0 w-full h-full object-cover rounded z-10 transition-all duration-200 group-hover:scale-[2.5] group-hover:z-50 group-hover:border-2 group-hover:border-[#FFC300] group-hover:shadow-2xl cursor-zoom-in" alt="" />
                                                ) : (
                                                    <ImageIcon size={24} className="text-zinc-600"/>
                                                )}
                                                {isOutOfStock && <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"><div className="bg-red-600 text-white text-[9px] px-2 py-0.5 font-bold uppercase -rotate-12 border border-red-900 shadow-md">Немає</div></div>}
                                            </div>
                                        </div>
                                        <div className="text-xs text-zinc-400 font-mono truncate" title={tyre.catalog_number}>{tyre.catalog_number || '-'}</div>
                                        <div className="flex justify-center"><input type="checkbox" checked={!!tyre.is_hot} onChange={() => handleQuickHotToggle(tyre)} className="w-5 h-5 accent-orange-600 cursor-pointer bg-zinc-800 border-zinc-600 rounded" /></div>
                                        <div className="flex justify-center">
                                            {tyre.vehicle_type === 'cargo' ? <Truck size={16} className="text-blue-400"/> : tyre.vehicle_type === 'suv' ? <Mountain size={16} className="text-green-400"/> : tyre.vehicle_type === 'truck' ? <Truck size={16} className="text-blue-800"/> : tyre.vehicle_type === 'agro' ? <Tractor size={16} className="text-green-600"/> : <Car size={16} className="text-blue-300"/>}
                                        </div>
                                        <div className="text-center flex justify-center text-[10px] font-bold uppercase">
                                            {tyre.season === 'winter' ? <span className="bg-blue-900/30 text-blue-300 px-2 py-1 rounded border border-blue-900/50">Зима</span> : 
                                            tyre.season === 'summer' ? <span className="bg-orange-900/30 text-orange-300 px-2 py-1 rounded border border-orange-900/50">Літо</span> : 
                                            tyre.season === 'all-season' ? <span className="bg-green-900/30 text-green-300 px-2 py-1 rounded border border-green-900/50">Всесезон</span> : 
                                            <span className="text-zinc-600">-</span>}
                                        </div>
                                        <div className="text-xs text-white font-bold truncate min-w-0" title={supplierName}>{supplierName}</div>
                                        <div className="flex flex-col min-w-0 overflow-hidden">
                                            <div onClick={() => handleCopyTitle(tyre.title)} className="text-sm text-white font-bold leading-tight flex items-center gap-2 cursor-pointer hover:text-[#FFC300] active:scale-95 transition-all group/title overflow-hidden" title={`${tyre.title} (Натисніть, щоб скопіювати)`}>
                                                <span className="truncate block flex-grow">{tyre.title}</span>
                                                {isProductReady(tyre) && <CheckCircle size={14} className="text-green-500 flex-shrink-0" title="Товар повністю готовий" />}
                                                <Copy size={12} className="flex-shrink-0 opacity-0 group-hover/title:opacity-100 text-[#FFC300] transition-opacity"/>
                                            </div>
                                            {tyre.axis && <span className="text-[10px] text-zinc-500 flex items-center gap-1"><CircleDot size={10} className="text-blue-400"/> {tyre.axis}</span>}
                                        </div>
                                        <div className="text-center font-bold text-[#FFC300] text-sm">
                                            {tyre.radius?.replace('R','')}
                                        </div>
                                        <div className="text-right font-mono text-white text-sm">
                                            {editingPriceId === tyre.id ? (
                                                <input 
                                                    autoFocus
                                                    type="number"
                                                    value={inlineValue}
                                                    onChange={e => setInlineValue(e.target.value)}
                                                    onBlur={() => handleInlineUpdate(tyre.id, 'price', inlineValue)}
                                                    onKeyDown={e => e.key === 'Enter' && handleInlineUpdate(tyre.id, 'price', inlineValue)}
                                                    className="w-full bg-zinc-800 border border-[#FFC300] rounded px-1 text-right text-white outline-none"
                                                />
                                            ) : (
                                                <div 
                                                    onClick={() => { setEditingPriceId(tyre.id); setInlineValue(String(tyre.price)); }}
                                                    className="cursor-pointer hover:text-[#FFC300] transition-colors"
                                                    title="Натисніть, щоб змінити ціну"
                                                >
                                                    {tyre.price}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-center font-mono text-sm">
                                            {editingStockId === tyre.id ? (
                                                <input 
                                                    autoFocus
                                                    type="number"
                                                    value={inlineValue}
                                                    onChange={e => setInlineValue(e.target.value)}
                                                    onBlur={() => handleInlineUpdate(tyre.id, 'stock_quantity', inlineValue)}
                                                    onKeyDown={e => e.key === 'Enter' && handleInlineUpdate(tyre.id, 'stock_quantity', inlineValue)}
                                                    className="w-full bg-zinc-800 border border-[#FFC300] rounded px-1 text-center text-white outline-none"
                                                />
                                            ) : (
                                                <div 
                                                    onClick={() => { setEditingStockId(tyre.id); setInlineValue(String(tyre.stock_quantity || 0)); }}
                                                    className={`cursor-pointer hover:text-[#FFC300] transition-colors font-bold ${parseInt(tyre.stock_quantity) < 4 ? 'text-red-500' : 'text-zinc-400'}`}
                                                    title="Натисніть, щоб змінити залишок"
                                                >
                                                    {tyre.stock_quantity || 0}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex justify-center gap-1">
                                            <button 
                                                onClick={() => {
                                                    const msg = `Нове замовлення: ${tyre.title} (${tyre.price} грн)`;
                                                    navigator.clipboard.writeText(msg);
                                                    setSuccessMessage("Дані для замовлення скопійовано!");
                                                    setTimeout(() => setSuccessMessage(''), 2000);
                                                }} 
                                                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-blue-400" 
                                                title="Швидке замовлення"
                                            >
                                                <ShoppingCart size={14}/>
                                            </button>
                                            <button onClick={() => handleShareProduct(tyre)} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-green-400" title="Поділитися в месенджер">
                                                <ArrowRight size={14} className="-rotate-45"/>
                                            </button>
                                            {!tyre.image_url && (
                                                <button onClick={() => handleOpenAiSearch(tyre)} className="p-1.5 bg-purple-900/40 border border-purple-500/30 text-purple-300 hover:bg-purple-600 hover:text-white rounded transition-colors" title="Знайти фото ШІ">
                                                    <Sparkles size={14}/>
                                                </button>
                                            )}
                                            <button onClick={() => openEditTyreModal(tyre)} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300" title="Редагувати">
                                                <Edit2 size={14}/>
                                            </button>
                                            <button onClick={() => { setTyreToDelete(tyre.id); setShowDeleteModal(true); }} className="p-1.5 bg-zinc-800 hover:bg-red-900/50 text-zinc-500 hover:text-red-500 rounded" title="Видалити">
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

    ) : (
            /* --- GRID VIEW --- */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {tyres.map(tyre => (
                    <div key={tyre.id} className={`bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group relative ${selectedTyreIds.has(tyre.id) ? 'ring-2 ring-[#FFC300]' : ''} ${tyre.in_stock === false ? 'opacity-80' : ''}`}>
                        <div className="aspect-square bg-black relative cursor-pointer" onClick={() => openEditTyreModal(tyre)}>
                            {tyre.image_url ? (
                                <img src={tyre.image_url} alt={tyre.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                                    <ImageIcon className="text-zinc-800" size={32}/>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleOpenAiSearch(tyre); }}
                                        className="bg-purple-900/40 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 hover:bg-purple-800 transition-colors"
                                    >
                                        <Sparkles size={12}/> Знайти ШІ
                                    </button>
                                </div>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); toggleSelection(tyre.id); }} className={`absolute top-2 left-2 w-6 h-6 rounded border flex items-center justify-center z-20 ${selectedTyreIds.has(tyre.id) ? 'bg-[#FFC300] border-[#FFC300] text-black' : 'bg-black/50 border-white/50'}`}><CheckSquare size={14}/></button>
                            {tyre.is_hot && <div className="absolute top-2 right-2 bg-orange-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded z-10 shadow-sm">HOT</div>}
                            {tyre.in_stock === false && <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"><span className="text-red-500 font-bold uppercase text-xs border border-red-500 px-2 py-1 -rotate-12 bg-black/20 shadow-lg">Немає</span></div>}
                        </div>
                        <div className="p-3">
                            <div className="text-[10px] text-zinc-500 uppercase font-bold">{tyre.manufacturer}</div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                                <div onClick={() => openEditTyreModal(tyre)} className="text-xs font-bold text-white line-clamp-2 h-8 cursor-pointer hover:text-[#FFC300] transition-colors flex-grow">{tyre.title}</div>
                                <button onClick={(e) => { e.stopPropagation(); handleCopyTitle(tyre.title); }} className="p-1 text-zinc-600 hover:text-[#FFC300] transition-colors" title="Копіювати назву"><Copy size={12}/></button>
                            </div>
                            {tyre.axis && <div className="text-[9px] text-blue-300 font-bold mb-1 flex items-center gap-1"><CircleDot size={8}/> {tyre.axis}</div>}
                            <div className="flex justify-between items-end cursor-pointer" onClick={() => openEditTyreModal(tyre)}><div className="text-[#FFC300] font-mono font-bold">{tyre.price}</div><div className="text-[10px] text-zinc-500">{tyre.radius}</div></div>
                            <div className="mt-2 flex gap-1">
                                <button onClick={() => openEditTyreModal(tyre)} className="flex-1 bg-[#FFC300] hover:bg-[#e6b000] text-black font-black text-xs py-2 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1">
                                    <Edit2 size={12}/> Редагувати
                                </button>
                                <button onClick={() => { setTyreToDelete(tyre.id); setShowDeleteModal(true); }} className="px-3 bg-zinc-800 hover:bg-red-900/50 text-red-500 rounded-lg transition-colors">
                                    <Trash2 size={14}/>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* Load More */}
        {hasMoreTyres && tyres.length > 0 && (
            <div className="mt-8 text-center pb-8"><button onClick={() => fetchTyres(tyrePage + 1)} disabled={loadingTyres} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-8 rounded-xl border border-zinc-700 transition-all flex items-center gap-2 mx-auto disabled:opacity-50 min-w-[200px] justify-center">{loadingTyres ? <Loader2 className="animate-spin" /> : <ArrowDown size={20} />} Завантажити ще ({Math.max(0, totalCount - tyres.length)})</button></div>
        )}

        {/* Add/Edit Modal with PASTE Support */}
        {showAddTyreModal && (
            <div 
                className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 outline-none" 
                onPaste={(e: React.ClipboardEvent) => {
                    if (e.clipboardData.files.length > 0) {
                        e.preventDefault();
                        const newFiles = Array.from(e.clipboardData.files).filter((f: any) => f.type.startsWith('image/'));
                        if (newFiles.length > 0) {
                            setTyreUploadFiles(prev => [...prev, ...newFiles]);
                            setSuccessMessage(`Додано ${newFiles.length} фото з буферу!`);
                            setTimeout(() => setSuccessMessage(''), 2000);
                        }
                    }
                }}
                tabIndex={0}
            >
                <div className="bg-zinc-900 border-0 sm:border sm:border-zinc-700 p-4 sm:p-6 rounded-none sm:rounded-2xl w-full max-w-4xl h-full sm:h-[90vh] flex flex-col shadow-2xl relative" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4 sm:mb-6">
                        <h3 className="text-xl sm:text-2xl font-black text-white">{editingTyreId ? 'Редагування' : 'Нова шина'}</h3>
                        <button onClick={() => setShowAddTyreModal(false)} className="p-2 text-zinc-500 hover:text-white bg-zinc-800 rounded-full"><X size={24}/></button>
                    </div>
                    <div className="flex-grow overflow-y-auto pr-1 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                            <div className="space-y-4">
                                <div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Виробник (Бренд)</label><input list="brands" value={tyreForm.manufacturer} onChange={e => setTyreForm({...tyreForm, manufacturer: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-bold" placeholder="Напр. Michelin"/><datalist id="brands">{KNOWN_BRANDS.map(b => <option key={b} value={b}/>)}</datalist></div>
                                <div><label className="block text-[#FFC300] text-xs font-bold uppercase mb-1">Назва (Модель)</label><input type="text" value={tyreForm.name} onChange={e => setTyreForm({...tyreForm, name: e.target.value})} className="w-full bg-black border border-[#FFC300]/50 rounded-lg p-3 text-white font-bold" placeholder="Напр. Alpin 6"/></div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Ширина</label><input type="text" value={tyreForm.width} onChange={e => setTyreForm({...tyreForm, width: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white text-center" placeholder="205"/></div>
                                    <div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Висота</label><input type="text" value={tyreForm.height} onChange={e => setTyreForm({...tyreForm, height: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white text-center" placeholder="55"/></div>
                                    <div>
                                        <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Радіус</label>
                                        <select 
                                            value={tyreForm.radius} 
                                            onChange={e => setTyreForm({...tyreForm, radius: e.target.value})} 
                                            className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white"
                                        >
                                            {getRadiiOptions(tyreForm.vehicle_type).map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Тип авто</label>
                                    <select 
                                        value={tyreForm.vehicle_type} 
                                        onChange={e => {
                                            const vType = e.target.value as any;
                                            const newRadius = getRadiiOptions(vType)[0];
                                            // Force season to all-season if Truck or Agro
                                            const newSeason = (vType === 'truck' || vType === 'agro') ? 'all-season' : tyreForm.season;
                                            setTyreForm({...tyreForm, vehicle_type: vType, radius: newRadius, season: newSeason, axis: vType !== 'truck' ? '' : tyreForm.axis });
                                        }} 
                                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white"
                                    >
                                        <option value="car">Легкова</option>
                                        <option value="suv">Позашляховик</option>
                                        <option value="cargo">Вантажна (C)</option>
                                        <option value="truck">Вантажна (TIR)</option>
                                        <option value="agro">Агро / Спец</option>
                                    </select>
                                </div>

                                {tyreForm.vehicle_type === 'truck' && (
                                    <div className="animate-in fade-in slide-in-from-top-1">
                                        <label className="block text-blue-400 text-xs font-bold uppercase mb-1 flex items-center gap-1"><CircleDot size={12}/> Вісь (Тільки TIR)</label>
                                        <select 
                                            value={tyreForm.axis} 
                                            onChange={e => setTyreForm({...tyreForm, axis: e.target.value})} 
                                            className="w-full bg-black border border-blue-900 rounded-lg p-3 text-white font-bold"
                                        >
                                            <option value="">-- Оберіть вісь --</option>
                                            {AXIS_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                                        </select>
                                    </div>
                                )}

                                <div className="bg-zinc-800 p-3 rounded-lg border border-zinc-700">
                                    <label className="block text-zinc-400 text-xs font-bold uppercase mb-2 text-center">Сезонність</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button type="button" onClick={() => setTyreForm({...tyreForm, season: 'winter'})} disabled={tyreForm.vehicle_type === 'truck' || tyreForm.vehicle_type === 'agro'} className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${tyreForm.season === 'winter' ? 'bg-blue-900/40 border-blue-500 text-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-black border-zinc-700 text-zinc-500 hover:text-white hover:bg-zinc-900'}`}><Snowflake size={24}/> <span className="text-xs font-black uppercase tracking-wide">Зима</span></button>
                                        <button type="button" onClick={() => setTyreForm({...tyreForm, season: 'summer'})} disabled={tyreForm.vehicle_type === 'truck' || tyreForm.vehicle_type === 'agro'} className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${tyreForm.season === 'summer' ? 'bg-orange-900/40 border-orange-500 text-orange-200 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'bg-black border-zinc-700 text-zinc-500 hover:text-white hover:bg-zinc-900'}`}><Sun size={24}/> <span className="text-xs font-black uppercase tracking-wide">Літо</span></button>
                                        <button type="button" onClick={() => setTyreForm({...tyreForm, season: 'all-season'})} className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all hover:scale-[1.02] active:scale-95 ${tyreForm.season === 'all-season' ? 'bg-green-900/40 border-green-500 text-green-200 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-black border-zinc-700 text-zinc-500 hover:text-white hover:bg-zinc-900'}`}><CloudSun size={24}/> <span className="text-xs font-black uppercase tracking-wide">Всесезон</span></button>
                                    </div>
                                    {(tyreForm.vehicle_type === 'truck' || tyreForm.vehicle_type === 'agro') && <p className="text-center text-[10px] text-zinc-500 mt-2">Для TIR та Спецтехніки тільки "Всесезон"</p>}
                                </div>
                                
                                <div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Постачальник</label><select value={tyreForm.supplier_id} onChange={e => setTyreForm({...tyreForm, supplier_id: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white"><option value="">Не обрано</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                                <div className="border-2 border-dashed border-zinc-700 rounded-xl p-4 text-center">
                                    <input type="file" multiple onChange={e => setTyreUploadFiles(Array.from(e.target.files || []))} className="hidden" id="tyre-files" />
                                    <label htmlFor="tyre-files" className="cursor-pointer flex flex-col items-center gap-2 text-zinc-400 hover:text-white">
                                        <Upload size={32} />
                                        <span className="text-sm font-bold">Натисніть щоб додати фото</span>
                                    </label>
                                    <p className="text-[10px] text-zinc-500 mt-2">або натисніть <span className="text-[#FFC300] font-bold">Ctrl+V</span> для вставки з буферу</p>
                                    {tyreUploadFiles.length > 0 && <div className="mt-2 text-[#FFC300] text-sm font-bold">{tyreUploadFiles.length} файлів обрано</div>}
                                </div>
                                {existingGallery.length > 0 && (<div className="flex gap-2 overflow-x-auto pb-2">{existingGallery.map((url, idx) => (<div key={idx} className="w-16 h-16 rounded border border-zinc-700 flex-shrink-0 relative group"><img src={url} className="w-full h-full object-cover" /><button onClick={() => setExistingGallery(prev => prev.filter(u => u !== url))} className="absolute top-0 right-0 bg-red-600 text-white p-0.5 rounded opacity-0 group-hover:opacity-100"><X size={12}/></button></div>))}</div>)}
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 bg-zinc-800/50 p-4 rounded-xl border border-zinc-800">
                                    <div>
                                        <label className="block text-green-400 text-xs font-bold uppercase mb-1">Роздріб (Продаж)</label>
                                        <input type="number" value={tyreForm.price} onChange={e => setTyreForm({...tyreForm, price: e.target.value})} className="w-full bg-black border border-green-900/50 rounded-lg p-3 text-white font-bold text-xl" placeholder="0"/>
                                    </div>
                                    <div>
                                        <label className="block text-zinc-500 text-xs font-bold uppercase mb-1">Стара ціна</label>
                                        <input type="number" value={tyreForm.old_price} onChange={e => setTyreForm({...tyreForm, old_price: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-zinc-400" placeholder="0"/>
                                    </div>
                                    <div>
                                        <label className="block text-blue-400 text-xs font-bold uppercase mb-1">Закупка (База)</label>
                                        <input type="number" value={tyreForm.base_price} onChange={e => setTyreForm({...tyreForm, base_price: e.target.value})} className="w-full bg-black border border-blue-900/50 rounded-lg p-3 text-white" placeholder="0"/>
                                    </div>
                                    <div>
                                        <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Залишок (шт)</label>
                                        <input type="number" value={tyreForm.stock_quantity} onChange={e => setTyreForm({...tyreForm, stock_quantity: e.target.value})} className={`w-full bg-black border rounded-lg p-3 text-white font-bold ${parseInt(tyreForm.stock_quantity) < 4 ? 'border-red-500 text-red-500' : 'border-zinc-700'}`} placeholder="0"/>
                                        {parseInt(tyreForm.stock_quantity) < 4 && <span className="text-[10px] text-red-500 font-bold uppercase mt-1 block">Мало залишку!</span>}
                                    </div>
                                    
                                    {/* Profit Calculator */}
                                    {tyreForm.price && tyreForm.base_price && (
                                        <div className="col-span-2 bg-black/50 p-2 rounded border border-zinc-700 flex justify-between items-center">
                                            <span className="text-xs text-zinc-400 uppercase font-bold">Прибуток:</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-green-400 font-bold">{parseInt(tyreForm.price) - parseInt(tyreForm.base_price)} грн</span>
                                                <span className="bg-green-900/30 text-green-400 px-2 py-0.5 rounded text-[10px] font-black">
                                                    {(((parseInt(tyreForm.price) - parseInt(tyreForm.base_price)) / parseInt(tyreForm.price)) * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4"><div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Артикул (Код)</label><input type="text" value={tyreForm.catalog_number} onChange={e => setTyreForm({...tyreForm, catalog_number: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-mono" /></div><div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Номер товару</label><input type="text" value={tyreForm.product_number} onChange={e => setTyreForm({...tyreForm, product_number: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-mono" /></div></div>
                                <div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Опис</label><textarea value={tyreForm.description} onChange={e => setTyreForm({...tyreForm, description: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white h-24 text-sm" /></div>
                                
                                {/* SEO SECTION */}
                                <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 space-y-4">
                                    <h4 className="text-zinc-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                        <Globe size={14} className="text-[#FFC300]"/> SEO Налаштування (Google)
                                    </h4>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-zinc-400 text-[10px] font-bold uppercase mb-1">SEO Заголовок (Title)</label>
                                            <input type="text" value={tyreForm.seo_title} onChange={e => setTyreForm({...tyreForm, seo_title: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-white text-xs" placeholder="Залиште порожнім для авто-генерації"/>
                                        </div>
                                        <div>
                                            <label className="block text-zinc-400 text-[10px] font-bold uppercase mb-1">SEO Опис (Description)</label>
                                            <textarea rows={2} value={tyreForm.seo_description} onChange={e => setTyreForm({...tyreForm, seo_description: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-white text-xs" placeholder="Короткий опис для пошуковика"/>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-zinc-400 text-[10px] font-bold uppercase mb-1">Slug (URL)</label>
                                                <input type="text" value={tyreForm.slug} onChange={e => setTyreForm({...tyreForm, slug: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-white text-xs font-mono" placeholder="michelin-alpin-6"/>
                                            </div>
                                            <div>
                                                <label className="block text-zinc-400 text-[10px] font-bold uppercase mb-1">Ключові слова</label>
                                                <input type="text" value={tyreForm.seo_keywords} onChange={e => setTyreForm({...tyreForm, seo_keywords: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-white text-xs" placeholder="шина, купити, зимова"/>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div><label className="flex items-center gap-2 cursor-pointer bg-zinc-800 px-4 py-2 rounded-lg border border-zinc-700 w-fit"><input type="checkbox" checked={tyreForm.is_hot} onChange={e => setTyreForm({...tyreForm, is_hot: e.target.checked})} className="w-5 h-5 accent-[#FFC300]"/><span className="font-bold text-white"><Flame className="inline text-orange-500 mr-1" size={16}/> HOT Пропозиція</span></label>{tyreForm.is_hot && (<div className="flex gap-2 mt-2 animate-in fade-in slide-in-from-top-1">{[2, 3, 5, 10].map(pct => (<button key={pct} onClick={() => applyDiscount(pct)} className="flex-1 bg-red-900/20 border border-red-800 text-red-400 hover:bg-red-900/40 py-1 rounded text-xs font-bold">-{pct}%</button>))}</div>)}</div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-end gap-4"><button onClick={() => setShowAddTyreModal(false)} className="px-6 py-3 bg-zinc-800 text-white font-bold rounded-xl hover:bg-zinc-700">Скасувати</button><button onClick={handleSaveTyre} disabled={uploading} className="px-8 py-3 bg-[#FFC300] text-black font-black rounded-xl hover:bg-[#e6b000] flex items-center gap-2">{uploading ? <Loader2 className="animate-spin"/> : <Save size={20}/>} Зберегти</button></div>
                </div>
            </div>
        )}

        {/* Delete Modal */}
        {showDeleteModal && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm relative shadow-2xl"><h3 className="text-xl font-bold text-white mb-4">Видалити?</h3><div className="flex gap-4"><button onClick={() => { setShowDeleteModal(false); setTyreToDelete(null); }} className="flex-1 py-3 bg-zinc-800 text-white rounded-xl font-bold">Ні</button><button onClick={handleDeleteTyre} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">Так</button></div></div>
            </div>
        )}

        {/* Bulk Delete Confirmation Modal */}
        {showBulkDeleteConfirm && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm relative shadow-2xl text-center">
                   <div className="bg-red-900/20 p-4 rounded-full text-red-500 mb-4 border border-red-900/50 w-16 h-16 flex items-center justify-center mx-auto">
                        <Trash2 size={32} />
                   </div>
                   <h3 className="text-xl font-bold text-white mb-2">Видалити {selectedTyreIds.size} товарів?</h3>
                   <p className="text-zinc-400 text-sm mb-6">Цю дію неможливо скасувати. Товари будуть видалені з бази назавжди.</p>
                   <div className="flex gap-4">
                       <button onClick={() => setShowBulkDeleteConfirm(false)} className="flex-1 py-3 bg-zinc-800 text-white rounded-xl font-bold border border-zinc-700 hover:bg-zinc-700 transition-colors">Скасувати</button>
                       <button onClick={executeBulkDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20">Видалити</button>
                   </div>
               </div>
            </div>
        )}

        {/* Category Delete Confirmation Modal */}
        {showCategoryDeleteConfirm && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm relative shadow-2xl text-center">
                   <div className="bg-red-900/20 p-4 rounded-full text-red-500 mb-4 border border-red-900/50 w-16 h-16 flex items-center justify-center mx-auto">
                        <AlertCircle size={32} />
                   </div>
                   <h3 className="text-xl font-bold text-white mb-2">Очистити категорію?</h3>
                   <p className="text-zinc-400 text-sm mb-6">
                       Ви збираєтесь видалити <strong className="text-white">{renderCategoryName()}</strong>. 
                       <br/>Цю дію неможливо скасувати.
                   </p>
                   <div className="flex gap-4">
                       <button onClick={() => setShowCategoryDeleteConfirm(false)} className="flex-1 py-3 bg-zinc-800 text-white rounded-xl font-bold border border-zinc-700 hover:bg-zinc-700 transition-colors">Скасувати</button>
                       <button onClick={executeCategoryDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20">Так, видалити все</button>
                   </div>
               </div>
            </div>
        )}

        {/* AI Modal */}
        {showAiModal && (
            <AiSortModal onClose={() => setShowAiModal(false)} onRefreshTyres={() => fetchTyres(0, true)} />
        )}
        {/* AI SEARCH MODAL */}
        {showAiSearchModal && (
            <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col shadow-3xl">
                    <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                        <div>
                            <h3 className="text-xl font-black text-white flex items-center gap-3">
                                <Sparkles className="text-purple-500 animate-pulse" /> 
                                AI Пошук фото 🌠
                            </h3>
                            <p className="text-zinc-500 text-xs mt-1 truncate max-w-[300px]">{targetTyreForAi?.title}</p>
                        </div>
                        <button onClick={() => setShowAiSearchModal(false)} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500 hover:text-white"><X size={24}/></button>
                    </div>

                    <div className="p-4 bg-black/20 flex flex-col gap-3">
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={aiSearchQuery} 
                                onChange={e => setAiSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && performAiSearch(aiSearchQuery)}
                                className="flex-grow bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-purple-500 outline-none"
                                placeholder="Назва для пошуку..."
                            />
                            <button 
                                onClick={() => performAiSearch(aiSearchQuery)}
                                disabled={isSearchingAi}
                                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg"
                            >
                                {isSearchingAi ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>}
                                <span>Шукати</span>
                            </button>
                        </div>
                        {aiSearchError && (
                            <div className="flex items-center gap-2 text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg animate-in fade-in slide-in-from-top-1">
                                <AlertTriangle size={14}/>
                                <span className="text-[11px] font-bold uppercase tracking-tight">{aiSearchError}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex-grow overflow-y-auto p-4 max-h-[60vh] custom-scrollbar bg-black/40">
                        {isSearchingAi ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                                <p className="text-zinc-500 font-bold animate-pulse text-sm">Нейромережа підбирає варіанти...</p>
                            </div>
                        ) : aiSearchResults.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {aiSearchResults.map((img, idx) => {
                                    const isSelected = selectedAiUrls.includes(img.imageUrl);
                                    const selectIndex = selectedAiUrls.indexOf(img.imageUrl);
                                    return (
                                        <div 
                                            key={idx} 
                                            onClick={() => toggleAiImage(img.imageUrl)}
                                            className={`group relative aspect-square bg-black rounded-xl overflow-hidden cursor-pointer border-2 transition-all active:scale-95 ${isSelected ? 'border-purple-500 ring-4 ring-purple-500/20 shadow-2xl' : 'border-zinc-800 hover:border-zinc-600'}`}
                                        >
                                            <img src={img.imageUrl} alt={`Result ${idx}`} className="w-full h-full object-contain p-1" />
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <p className="text-[10px] text-zinc-300 truncate">{img.title}</p>
                                            </div>
                                            {isSelected && (
                                                <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center backdrop-blur-[1px]">
                                                    <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-black shadow-xl border-2 border-white/50 animate-in zoom-in-50">
                                                        {selectIndex === 0 ? <CheckCircle size={16}/> : selectIndex + 1}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-zinc-600 gap-4">
                                <HelpCircle size={48} />
                                <p className="text-center font-medium">Результатів поки немає.<br/> Спробуйте змінити запит.</p>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex justify-between items-center sm:flex-row flex-col gap-4">
                        <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                            <span className="text-[10px] text-zinc-500 uppercase font-black tracking-tighter">Обрано для галереї</span>
                            <span className="text-white text-sm font-bold">{selectedAiUrls.length} фото</span>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button onClick={() => setShowAiSearchModal(false)} className="px-6 py-2.5 rounded-xl text-zinc-500 hover:text-white font-bold transition-colors flex-1 sm:flex-none">Скасувати</button>
                            <button 
                                onClick={handleSaveAiImages}
                                disabled={selectedAiUrls.length === 0}
                                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-black px-8 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 flex-1 sm:flex-none"
                            >
                                <Save size={18}/>
                                <span>Зберегти {selectedAiUrls.length > 0 && selectedAiUrls.length}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* BULK PROCESSING OVERLAY */}
        {isBulkPhotoProcessing && (
            <div className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 text-center animate-in fade-in">
                <div className="max-w-md w-full bg-zinc-900 border border-zinc-700 p-8 rounded-3xl shadow-3xl">
                    <div className="relative w-20 h-20 mx-auto mb-6">
                        <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full"></div>
                        <div 
                            className="absolute inset-0 border-4 border-t-purple-500 rounded-full animate-spin"
                            style={{ animationDuration: '1.5s' }}
                        ></div>
                        <Sparkles className="absolute inset-0 m-auto text-purple-500 animate-pulse" size={32} />
                    </div>
                    
                    <h3 className="text-xl font-black text-white mb-2 uppercase tracking-wide">ШІ-Масова обробка</h3>
                    <p className="text-zinc-500 text-sm mb-6 font-medium">Пошук та додавання фото для вибраних товарів...</p>
                    
                    <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden mb-3">
                        <div 
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all duration-500"
                            style={{ width: `${(bulkPhotoProgress / bulkPhotoTotal) * 100}%` }}
                        ></div>
                    </div>
                    
                    <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest px-1">
                        <span className="text-purple-400">Прогрес: {bulkPhotoProgress} / {bulkPhotoTotal}</span>
                        <span className="text-zinc-500">{Math.round((bulkPhotoProgress / bulkPhotoTotal) * 100)}%</span>
                    </div>
                    
                    <p className="mt-8 text-[9px] text-zinc-600 uppercase font-black italic">Будь ласка, не закривайте вкладку до завершення</p>
                </div>
            </div>
        )}

        {/* ERROR HINT OVERLAY */}
        {(showKeyNeededError || apiErrorHint) && (
            <div className="fixed inset-0 z-[700] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in zoom-in-95">
                <div className="max-w-md w-full bg-zinc-900 border-2 border-red-500/50 p-8 rounded-[2.5rem] shadow-[0_0_100px_rgba(239,68,68,0.2)] text-center">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
                        <AlertTriangle className="text-red-500" size={40}/>
                    </div>
                    <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tight italic">Налаштування ШІ не завершене</h3>
                    <p className="text-zinc-400 text-sm mb-8 leading-relaxed">Система каже, що у вас не вписано <b>Serper API Key</b> або не виконано SQL-запит до бази даних.</p>
                    
                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={() => {
                                setShowKeyNeededError(false);
                                setApiErrorHint(false);
                                // Here we would ideally navigate to settings
                                alert("Будь ласка, перейдіть у вкладку 'API / Синхр.' або 'Налашт.' та вкажіть ключ Serper. Крім того, переконайтеся, що ви виконали SQL запит у Supabase.");
                            }}
                            className="w-full bg-white text-black font-black py-4 rounded-2xl hover:bg-zinc-200 transition-all active:scale-95 text-sm uppercase tracking-widest shadow-lg"
                        >
                            Я РОЗУМІЮ
                        </button>
                        <button 
                            onClick={() => { setShowKeyNeededError(false); setApiErrorHint(false); }}
                            className="w-full bg-zinc-800 text-zinc-500 font-bold py-3 rounded-2xl hover:text-white transition-colors"
                        >
                            Закрити
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default TyresTab;
