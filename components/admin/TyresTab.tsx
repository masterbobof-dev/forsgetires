
import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, X, Upload, Save, Loader2, FileSpreadsheet, CheckSquare, Square, Edit2, ArrowDown, Wand2, RefreshCw, Menu, FolderOpen, Car, Truck, Mountain, Flame, Ban, Briefcase, ArrowUpDown, Settings, ArrowRight, HelpCircle, Ruler, Copy, Image as ImageIcon, Percent, AlertCircle, FileWarning, FilterX, Trash2, LayoutGrid, List, Snowflake, Sun, CloudSun, CheckCircle, Eye, EyeOff, Tractor } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { TyreProduct, Supplier } from '../../types';
import { WHEEL_RADII, CAR_RADII, CARGO_RADII, TRUCK_RADII, AGRO_RADII } from '../../constants';
import readXlsxFile from 'read-excel-file';

const PAGE_SIZE = 50;

const KNOWN_BRANDS = [
    'NOKIAN', 'MICHELIN', 'CONTINENTAL', 'BRIDGESTONE', 'GOODYEAR', 'PIRELLI', 'HANKOOK', 'YOKOHAMA', 
    'TOYO', 'KUMHO', 'NEXEN', 'DUNLOP', 'PREMIORRI', 'ROSAVA', 'BELSHINA', 'TRIANGLE', 'SAILUN', 
    'LINGLONG', 'LAUFENN', 'COOPER', 'MATADOR', 'BARUM', 'SAVA', 'FULDA', 'KELLY', 'DEBICA', 
    'GENERAL', 'GISLAVED', 'VIKING', 'RIKEN', 'KORMORAN', 'KLEBER', 'BFGOODRICH', 'TIGAR', 
    'UNIROYAL', 'FIRESTONE', 'DAYTON', 'LASSA', 'STARMAXX', 'PETLAS', 'HIFLY', 'DOUBLESTAR', 'ETERNITY', 'OZKA', 'BKT', 'SEHA'
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

  const [selectedTyreIds, setSelectedTyreIds] = useState<Set<number>>(new Set());
  const [bulkMarkup, setBulkMarkup] = useState('');
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);

  const [showAddTyreModal, setShowAddTyreModal] = useState(false);
  const [editingTyreId, setEditingTyreId] = useState<number | null>(null);
  const [tyreForm, setTyreForm] = useState({ manufacturer: '', name: '', width: '', height: '', radius: 'R15', season: 'winter', vehicle_type: 'car' as 'car'|'cargo'|'suv'|'truck'|'agro', price: '', old_price: '', base_price: '', catalog_number: '', product_number: '', description: '', is_hot: false, supplier_id: '', stock_quantity: '' });
  const [tyreUploadFiles, setTyreUploadFiles] = useState<File[]>([]);
  const [existingGallery, setExistingGallery] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tyreToDelete, setTyreToDelete] = useState<number | null>(null);
  
  // Custom Bulk Delete Modal State
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const showError = (msg: string) => { setErrorMessage(msg); setTimeout(() => setErrorMessage(''), 6000); };
  
  const handleCopyTitle = (text: string) => {
      navigator.clipboard.writeText(text);
      setSuccessMessage(`Скопійовано: ${text}`);
      setTimeout(() => setSuccessMessage(''), 2500);
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
        const [all, car, cargo, truck, agro, suv, hot, out, no_photo] = await Promise.all([
            base.then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).or('vehicle_type.eq.car,vehicle_type.is.null').neq('vehicle_type', 'cargo').neq('vehicle_type', 'suv').not('radius', 'ilike', '%C%').then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).or('vehicle_type.eq.cargo,radius.ilike.%C%').not('radius', 'in', '("R17.5","R19.5","R22.5")').then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).or('radius.eq.R17.5,radius.eq.R19.5,radius.eq.R22.5,title.ilike.%TIR%,title.ilike.%R17.5%,title.ilike.%R19.5%,title.ilike.%R22.5%').then(r => r.count),
            // Updated AGRO count logic to match new filter
            supabase.from('tyres').select('*', { count: 'exact', head: true }).or('vehicle_type.eq.agro,title.ilike.%agro%,title.ilike.%tractor%,radius.in.("R10","R12","R14.5","R15.3","R15.5","R20","R24","R26","R28","R30","R32","R34","R36","R38","R40","R42")').then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).eq('vehicle_type', 'suv').then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).eq('is_hot', true).then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).eq('in_stock', false).then(r => r.count),
            supabase.from('tyres').select('*', { count: 'exact', head: true }).is('image_url', null).then(r => r.count)
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
            no_photo: no_photo || 0
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
           const agroRadii = [
               "R10","R12","R14.5","R15.3","R15.5","R20","R22.5",
               "R24","R26","R28","R30","R32","R34","R36","R38","R40","R42","R48"
           ];
           const titleFilters = agroRadii.map(r => `title.ilike.%${r}%`).join(',');
           const specKeywords = "title.ilike.%PR%,title.ilike.%OZKA%,title.ilike.%BKT%,title.ilike.%KNK%,title.ilike.%MPT%,title.ilike.%IND%,title.ilike.%TR-%,title.ilike.%IMP%,title.ilike.%Ф-%,title.ilike.%В-%";
           // Include vehicle_type.eq.agro to catch ambiguous sizes like R16 that are explicitly marked
           query = query.or(`vehicle_type.eq.agro,title.ilike.%agro%,title.ilike.%tractor%,title.ilike.%farm%,title.ilike.%ind%,radius.in.("${agroRadii.join('","')}"),${titleFilters},${specKeywords}`);
       }
       else if (tyreCategoryTab === 'suv') query = query.eq('vehicle_type', 'suv');
       else if (tyreCategoryTab === 'hot') query = query.eq('is_hot', true);
       else if (tyreCategoryTab === 'out_of_stock') query = query.eq('in_stock', false);
       else if (tyreCategoryTab === 'no_photo') query = query.is('image_url', null);

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
              if (inferredSeason === null && (t.season === 'all' || t.season === 'all-season')) finalSeason = 'summer';
              return { ...t, season: finalSeason };
          });

          if (isRefresh) { 
              setTyres(processedData); 
              setTyrePage(0); 
              setSelectedTyreIds(new Set()); 
          } else { 
              setTyres(prev => {
                  const newIds = new Set(processedData.map(d => d.id));
                  return [...prev.filter(p => !newIds.has(p.id)), ...processedData];
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

  // --- NEW: BULK DELETE ---
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
      const seasonLabel = tyreForm.season === 'winter' ? 'Winter' : tyreForm.season === 'summer' ? 'Summer' : 'All Season';
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
        season: tyreForm.season,
        vehicle_type: tyreForm.vehicle_type, 
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

      const parsedSeason = t.season || detectSeason(t.title, t.description || '') || 'summer';

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
        stock_quantity: t.stock_quantity ? String(t.stock_quantity) : ''
      });
      setExistingGallery(t.gallery || (t.image_url ? [t.image_url] : []));
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

  return (
    <div className="animate-in fade-in pb-20">
        {errorMessage && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] bg-red-900/90 text-white px-6 py-3 rounded-full border border-red-500 shadow-2xl">{errorMessage}</div>}
        {successMessage && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] bg-green-600/90 text-white px-6 py-3 rounded-full border border-green-400 shadow-2xl flex items-center gap-2"><CheckCircle size={20} />{successMessage}</div>}
        
        {/* --- TOP TOOLBAR --- */}
        <div className="flex flex-col md:flex-row gap-4 justify-between mb-4">
            <div className="relative">
                <button onClick={() => setShowCategoryMenu(!showCategoryMenu)} className="bg-zinc-800 text-white font-bold px-4 py-3 rounded-lg flex items-center gap-2 border border-zinc-700 hover:bg-zinc-700 transition-colors w-full md:w-auto justify-between">
                    <div className="flex items-center gap-2"><Menu size={20} className="text-[#FFC300]"/> <span className="uppercase tracking-wide text-sm">{renderCategoryName()}</span></div>
                </button>
                {showCategoryMenu && (
                    <div className="absolute top-full left-0 mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                        <button onClick={() => { setTyreCategoryTab('all'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-800/50"><FolderOpen size={18}/> Всі ({categoryCounts.all})</button>
                        <button onClick={() => { setTyreCategoryTab('car'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-800/50"><Car size={18}/> Легкові ({categoryCounts.car})</button>
                        <button onClick={() => { setTyreCategoryTab('cargo'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-800/50"><Truck size={18}/> Вантажні C ({categoryCounts.cargo})</button>
                        <button onClick={() => { setTyreCategoryTab('truck'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-800/50 text-blue-300"><Truck size={18}/> Вантажні TIR ({categoryCounts.truck})</button>
                        <button onClick={() => { setTyreCategoryTab('agro'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-800/50 text-green-300"><Tractor size={18}/> Агро / Спец ({categoryCounts.agro})</button>
                        <button onClick={() => { setTyreCategoryTab('suv'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-800/50"><Mountain size={18}/> SUV ({categoryCounts.suv})</button>
                        <button onClick={() => { setTyreCategoryTab('hot'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-800/50"><Flame size={18}/> HOT ({categoryCounts.hot})</button>
                        <button onClick={() => { setTyreCategoryTab('no_photo'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3 border-b border-zinc-800/50 text-orange-300"><ImageIcon size={18}/> Без фото ({categoryCounts.no_photo})</button>
                        <button onClick={() => { setTyreCategoryTab('out_of_stock'); setShowCategoryMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center gap-3"><Ban size={18}/> Немає ({categoryCounts.out})</button>
                    </div>
                )}
            </div>

            <div className="relative min-w-[140px] hidden md:block">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"><Briefcase size={16}/></div>
                <select value={filterSupplierId} onChange={(e) => setFilterSupplierId(e.target.value)} className="w-full h-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-2 py-2 outline-none focus:border-[#FFC300] text-sm font-bold appearance-none cursor-pointer hover:bg-zinc-800 text-white">
                    <option value="all">Всі Пост.</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            <div className="flex-grow flex gap-2">
                <div className="relative flex-grow flex items-center">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16}/>
                    <input 
                        type="text" 
                        placeholder="Пошук шин..." 
                        value={tyreSearch} 
                        onChange={e => {
                            const val = e.target.value;
                            setTyreSearch(val);
                            if (val === '') setTimeout(() => fetchTyres(0, true), 0);
                        }} 
                        onKeyDown={e => e.key==='Enter' && fetchTyres(0,true)} 
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-3 outline-none focus:border-[#FFC300] text-lg font-bold text-white" 
                    />
                </div>
                
                <button 
                    onClick={() => setShowOnlyInStock(!showOnlyInStock)}
                    className={`flex items-center gap-2 px-3 rounded-lg border font-bold text-xs whitespace-nowrap transition-colors ${showOnlyInStock ? 'bg-green-900/30 border-green-500 text-green-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}
                    title="Фільтр наявності"
                >
                    {showOnlyInStock ? <Eye size={18}/> : <EyeOff size={18}/>}
                    <span className="hidden lg:inline">В наявності</span>
                </button>

                <div className="relative min-w-[140px]">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"><ArrowUpDown size={16}/></div>
                    <select value={tyreSort} onChange={(e) => setTyreSort(e.target.value as any)} className="w-full h-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-2 py-2 outline-none focus:border-[#FFC300] text-sm font-bold appearance-none cursor-pointer hover:bg-zinc-800 text-white">
                        <option value="newest">Нові</option>
                        <option value="oldest">Старі</option>
                        <option value="price_asc">Дешеві</option>
                        <option value="price_desc">Дорогі</option>
                        <option value="with_photo">З фото</option>
                        <option value="no_photo">Без фото</option>
                    </select>
                </div>
            </div>

            <div className="flex gap-2 flex-wrap justify-end">
                <div className="flex bg-zinc-900 rounded-lg border border-zinc-800 p-1">
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}><LayoutGrid size={18}/></button>
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded ${viewMode === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}><List size={18}/></button>
                </div>

                <button onClick={() => {setEditingTyreId(null); setTyreForm({ manufacturer: '', name: '', width: '', height: '', radius: 'R15', season: 'winter', vehicle_type: 'car', price: '', old_price: '', base_price: '', catalog_number: '', product_number: '', description: '', is_hot: false, supplier_id: '', stock_quantity: '' }); setExistingGallery([]); setTyreUploadFiles([]); setShowAddTyreModal(true);}} className="bg-[#FFC300] text-black font-bold px-3 md:px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#e6b000]"><Plus size={18}/> <span className="hidden md:inline">Додати</span></button>
            </div>
        </div>

        {selectedTyreIds.size > 0 && (
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 mb-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-2">
                <div className="text-zinc-400 font-bold text-sm uppercase flex items-center gap-2">
                    <Settings size={16} className="text-[#FFC300]" /> <span>Масове управління</span>
                    <span className="text-xs normal-case text-white bg-zinc-600 px-2 py-0.5 rounded ml-1">обрано: {selectedTyreIds.size}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                    <input type="text" value={bulkMarkup} onChange={e => setBulkMarkup(e.target.value)} placeholder="%" className="w-16 p-2 rounded-lg bg-black border border-zinc-600 text-white text-center font-bold outline-none focus:border-[#FFC300]" />
                    <button onClick={() => handleBulkPriceUpdate(1)} className="flex-1 sm:flex-none bg-green-900/50 text-green-200 px-4 py-2 rounded-lg font-bold border border-green-800 hover:bg-green-800 flex items-center justify-center gap-1 transition-colors whitespace-nowrap text-xs md:text-sm"><ArrowRight size={14} className="-rotate-45"/> + Ціна</button>
                    <button onClick={() => handleBulkPriceUpdate(-1)} className="flex-1 sm:flex-none bg-red-900/50 text-red-200 px-4 py-2 rounded-lg font-bold border border-red-800 hover:bg-red-800 flex items-center justify-center gap-1 transition-colors whitespace-nowrap text-xs md:text-sm"><ArrowRight size={14} className="rotate-45"/> - Ціна</button>
                    <div className="w-px h-8 bg-zinc-700 mx-2 hidden md:block"></div>
                    <button onClick={() => handleBulkHotUpdate('add')} className="flex-1 sm:flex-none bg-orange-900/50 text-orange-200 px-4 py-2 rounded-lg font-bold border border-orange-800 hover:bg-orange-800 flex items-center justify-center gap-1 transition-colors whitespace-nowrap text-xs md:text-sm"><Flame size={14} /> HOT -%</button>
                    <button onClick={() => handleBulkHotUpdate('remove')} className="flex-1 sm:flex-none bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg font-bold border border-zinc-600 hover:bg-zinc-600 flex items-center justify-center gap-1 transition-colors whitespace-nowrap text-xs md:text-sm"><Ban size={14} /> NO HOT</button>
                    
                    {/* NEW DELETE BUTTON */}
                    <button onClick={handleBulkDelete} disabled={isApplyingBulk} className="flex-1 sm:flex-none bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-500 flex items-center justify-center gap-1 transition-colors whitespace-nowrap text-xs md:text-sm shadow-lg ml-2 border border-red-800">
                        {isApplyingBulk ? <Loader2 className="animate-spin" size={14}/> : <Trash2 size={14} />} 
                        Видалити
                    </button>
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
            /* --- LIST VIEW (Optimized for Visibility) --- */
            <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
                {/* Header */}
                <div className="grid grid-cols-[40px_100px_120px_40px_50px_80px_100px_1fr_50px_100px_80px] gap-2 p-3 bg-black border-b border-zinc-800 text-zinc-500 text-xs font-bold uppercase items-center sticky top-0 z-20">
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
                    <div>Назва</div>
                    <div className="text-center">R</div>
                    <div className="text-right">Ціна</div>
                    <div className="text-center">Дії</div>
                </div>

                {/* Body */}
                <div className="divide-y divide-zinc-800">
                    {tyres.map(tyre => {
                        const isSelected = selectedTyreIds.has(tyre.id);
                        const supplierName = suppliers.find(s => s.id === tyre.supplier_id)?.name || '-';
                        const isOutOfStock = tyre.in_stock === false;
                        
                        return (
                            <div key={tyre.id} className={`grid grid-cols-[40px_100px_120px_40px_50px_80px_100px_1fr_50px_100px_80px] gap-2 p-2 items-center hover:bg-zinc-900 transition-colors ${isSelected ? 'bg-zinc-800/50' : ''} ${isOutOfStock ? 'opacity-80' : ''}`}>
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
                                <div className="text-xs text-white font-bold truncate" title={supplierName}>{supplierName}</div>
                                <div onClick={() => handleCopyTitle(tyre.title)} className="text-sm text-white font-bold truncate leading-tight flex items-center gap-1 cursor-pointer hover:text-[#FFC300] active:scale-95 transition-all group/title" title={`${tyre.title} (Натисніть, щоб скопіювати)`}>
                                    <span className="truncate">{tyre.title}</span><Copy size={12} className="opacity-0 group-hover/title:opacity-100 text-[#FFC300] transition-opacity"/>
                                </div>
                                <div className="text-center font-bold text-[#FFC300] text-sm">{tyre.radius?.replace('R','')}</div>
                                <div className="text-right font-mono text-white text-sm">{tyre.price}</div>
                                <div className="flex justify-center gap-1"><button onClick={() => openEditTyreModal(tyre)} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300"><Edit2 size={14}/></button><button onClick={() => { setTyreToDelete(tyre.id); setShowDeleteModal(true); }} className="p-1.5 bg-zinc-800 hover:bg-red-900/50 text-zinc-500 hover:text-red-500 rounded"><X size={14}/></button></div>
                            </div>
                        );
                    })}
                </div>
            </div>
        ) : (
            /* --- GRID VIEW --- */
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {tyres.map(tyre => (
                    <div key={tyre.id} className={`bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group relative ${selectedTyreIds.has(tyre.id) ? 'ring-2 ring-[#FFC300]' : ''} ${tyre.in_stock === false ? 'opacity-80' : ''}`}>
                        <div className="aspect-square bg-black relative">
                            {tyre.image_url ? <img src={tyre.image_url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100" /> : <div className="w-full h-full flex items-center justify-center text-zinc-700"><ImageIcon/></div>}
                            <button onClick={() => toggleSelection(tyre.id)} className={`absolute top-2 left-2 w-6 h-6 rounded border flex items-center justify-center z-20 ${selectedTyreIds.has(tyre.id) ? 'bg-[#FFC300] border-[#FFC300] text-black' : 'bg-black/50 border-white/50'}`}><CheckSquare size={14}/></button>
                            {tyre.is_hot && <div className="absolute top-2 right-2 bg-orange-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded z-10 shadow-sm">HOT</div>}
                            {tyre.in_stock === false && <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"><span className="text-red-500 font-bold uppercase text-xs border border-red-500 px-2 py-1 -rotate-12 bg-black/20 shadow-lg">Немає</span></div>}
                        </div>
                        <div className="p-3">
                            <div className="text-[10px] text-zinc-500 uppercase font-bold">{tyre.manufacturer}</div>
                            <div onClick={() => handleCopyTitle(tyre.title)} title={`${tyre.title} (Натисніть, щоб скопіювати)`} className="text-xs font-bold text-white line-clamp-2 h-8 mb-1 cursor-pointer hover:text-[#FFC300] transition-colors">{tyre.title}</div>
                            <div className="flex justify-between items-end"><div className="text-[#FFC300] font-mono font-bold">{tyre.price}</div><div className="text-[10px] text-zinc-500">{tyre.radius}</div></div>
                            <div className="mt-2 flex gap-1"><button onClick={() => openEditTyreModal(tyre)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white text-xs py-1 rounded">Ред.</button><button onClick={() => { setTyreToDelete(tyre.id); setShowDeleteModal(true); }} className="px-2 bg-zinc-800 hover:bg-red-900/50 text-red-500 rounded"><Trash2 size={12}/></button></div>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* Load More */}
        {hasMoreTyres && tyres.length > 0 && (
            <div className="mt-8 text-center pb-8"><button onClick={() => fetchTyres(tyrePage + 1)} disabled={loadingTyres} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-8 rounded-xl border border-zinc-700 transition-all flex items-center gap-2 mx-auto disabled:opacity-50 min-w-[200px] justify-center">{loadingTyres ? <Loader2 className="animate-spin" /> : <ArrowDown size={20} />} Завантажити ще ({Math.max(0, totalCount - tyres.length)})</button></div>
        )}

        {/* Add/Edit Modal */}
        {showAddTyreModal && (
            <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl relative">
                    <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-black text-white">{editingTyreId ? 'Редагування шини' : 'Нова шина'}</h3><button onClick={() => setShowAddTyreModal(false)} className="text-zinc-500 hover:text-white"><X size={28}/></button></div>
                    <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                <div className="bg-zinc-800 p-3 rounded-lg border border-zinc-700"><label className="block text-zinc-400 text-xs font-bold uppercase mb-2 text-center">Сезонність</label><div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => setTyreForm({...tyreForm, season: 'winter'})} className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all hover:scale-[1.02] active:scale-95 ${tyreForm.season === 'winter' ? 'bg-blue-900/40 border-blue-500 text-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-black border-zinc-700 text-zinc-500 hover:text-white hover:bg-zinc-900'}`}><Snowflake size={24}/> <span className="text-xs font-black uppercase tracking-wide">Зима</span></button><button type="button" onClick={() => setTyreForm({...tyreForm, season: 'summer'})} className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all hover:scale-[1.02] active:scale-95 ${tyreForm.season === 'summer' ? 'bg-orange-900/40 border-orange-500 text-orange-200 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'bg-black border-zinc-700 text-zinc-500 hover:text-white hover:bg-zinc-900'}`}><Sun size={24}/> <span className="text-xs font-black uppercase tracking-wide">Літо</span></button><button type="button" onClick={() => setTyreForm({...tyreForm, season: 'all-season'})} className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all hover:scale-[1.02] active:scale-95 ${tyreForm.season === 'all-season' ? 'bg-green-900/40 border-green-500 text-green-200 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-black border-zinc-700 text-zinc-500 hover:text-white hover:bg-zinc-900'}`}><CloudSun size={24}/> <span className="text-xs font-black uppercase tracking-wide">Всесезон</span></button></div></div>
                                <div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Тип авто</label><select value={tyreForm.vehicle_type} onChange={e => setTyreForm({...tyreForm, vehicle_type: e.target.value as any, radius: getRadiiOptions(e.target.value as any)[0] })} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white"><option value="car">Легкова</option><option value="suv">Позашляховик</option><option value="cargo">Вантажна (C)</option><option value="truck">Вантажна (TIR)</option><option value="agro">Агро / Спец</option></select></div>
                                <div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Постачальник</label><select value={tyreForm.supplier_id} onChange={e => setTyreForm({...tyreForm, supplier_id: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white"><option value="">Не обрано</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                                <div className="border-2 border-dashed border-zinc-700 rounded-xl p-4 text-center"><input type="file" multiple onChange={e => setTyreUploadFiles(Array.from(e.target.files || []))} className="hidden" id="tyre-files" /><label htmlFor="tyre-files" className="cursor-pointer flex flex-col items-center gap-2 text-zinc-400 hover:text-white"><Upload size={32} /><span className="text-sm font-bold">Натисніть щоб додати фото</span></label>{tyreUploadFiles.length > 0 && <div className="mt-2 text-[#FFC300] text-sm font-bold">{tyreUploadFiles.length} файлів обрано</div>}</div>
                                {existingGallery.length > 0 && (<div className="flex gap-2 overflow-x-auto pb-2">{existingGallery.map((url, idx) => (<div key={idx} className="w-16 h-16 rounded border border-zinc-700 flex-shrink-0 relative group"><img src={url} className="w-full h-full object-cover" /><button onClick={() => setExistingGallery(prev => prev.filter(u => u !== url))} className="absolute top-0 right-0 bg-red-600 text-white p-0.5 rounded opacity-0 group-hover:opacity-100"><X size={12}/></button></div>))}</div>)}
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 bg-zinc-800/50 p-4 rounded-xl border border-zinc-800"><div><label className="block text-green-400 text-xs font-bold uppercase mb-1">Роздріб (Продаж)</label><input type="number" value={tyreForm.price} onChange={e => setTyreForm({...tyreForm, price: e.target.value})} className="w-full bg-black border border-green-900/50 rounded-lg p-3 text-white font-bold text-xl" placeholder="0"/></div><div><label className="block text-zinc-500 text-xs font-bold uppercase mb-1">Стара ціна</label><input type="number" value={tyreForm.old_price} onChange={e => setTyreForm({...tyreForm, old_price: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-zinc-400" placeholder="0"/></div><div><label className="block text-blue-400 text-xs font-bold uppercase mb-1">Закупка (База)</label><input type="number" value={tyreForm.base_price} onChange={e => setTyreForm({...tyreForm, base_price: e.target.value})} className="w-full bg-black border border-blue-900/50 rounded-lg p-3 text-white" placeholder="0"/></div><div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Залишок (шт)</label><input type="number" value={tyreForm.stock_quantity} onChange={e => setTyreForm({...tyreForm, stock_quantity: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-bold" placeholder="0"/></div></div>
                                <div className="grid grid-cols-2 gap-4"><div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Артикул (Код)</label><input type="text" value={tyreForm.catalog_number} onChange={e => setTyreForm({...tyreForm, catalog_number: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-mono" /></div><div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Номер товару</label><input type="text" value={tyreForm.product_number} onChange={e => setTyreForm({...tyreForm, product_number: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-mono" /></div></div>
                                <div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Опис</label><textarea value={tyreForm.description} onChange={e => setTyreForm({...tyreForm, description: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white h-24 text-sm" /></div>
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
    </div>
  );
};

export default TyresTab;
