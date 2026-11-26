import React, { useState } from 'react';
import { Search, FileSpreadsheet, Menu, FolderOpen, Car, Truck, Mountain, Flame, Ban, Briefcase, ArrowUpDown, Settings, Image as ImageIcon, LayoutGrid, List, CheckCircle, Eye, EyeOff, Tractor } from 'lucide-react';
import type { ProductCategory } from '../../../categories';
import type { TyresList } from './useTyresList';

interface TyresToolbarProps {
  list: TyresList;
  /** sections for the <select>: "Шини", "— Легкові", … */
  categoryOptions: { cat: ProductCategory; label: string }[];
  viewMode: 'list' | 'grid';
  setViewMode: (v: 'list' | 'grid') => void;
  exporting: boolean;
  exportProducts: () => void;
  onOpenAttrImport: () => void;
}

/** Top of the tab: the buckets menu, Excel buttons, and the filters row (supplier, section, sorting, search, "only in stock", view). */
const TyresToolbar: React.FC<TyresToolbarProps> = ({ list, categoryOptions, viewMode, setViewMode, exporting, exportProducts, onOpenAttrImport }) => {
  const {
    renderCategoryName, resetAllFilters, setTyreCategoryTab, categoryCounts, suppliers, fetchTyres,
    filterSupplierId, setFilterSupplierId, filterCategoryId, setFilterCategoryId, tyreSort, setTyreSort,
    tyreSearch, setTyreSearch, showOnlyInStock, setShowOnlyInStock,
  } = list;
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  // Mobile UI state
  const [showFilters, setShowFilters] = useState(false);
  const setShowAttrImport = (_open: true) => onOpenAttrImport();

  return (
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
            </div>

            <div className="hidden md:flex gap-2">
                <button onClick={() => setShowAttrImport(true)} className="bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg active:scale-95"><FileSpreadsheet size={18}/> <span>Характеристики з Excel</span></button>
                <button onClick={exportProducts} disabled={exporting} className="bg-zinc-800 border border-zinc-700 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-zinc-700 transition-all active:scale-95 disabled:opacity-50"><FileSpreadsheet size={18}/> <span>{exporting ? 'Готуємо…' : 'Вивантажити в Excel'}</span></button>
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
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"><FolderOpen size={14}/></div>
                    <select value={filterCategoryId} onChange={(e) => setFilterCategoryId(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-2 py-2.5 outline-none focus:border-[#FFC300] text-[11px] font-bold appearance-none cursor-pointer text-white">
                        <option value="all">Всі категорії</option>
                        {categoryOptions.map(({ cat, label }) => <option key={cat.id} value={cat.id}>{label}</option>)}
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
  );
};

export default TyresToolbar;
