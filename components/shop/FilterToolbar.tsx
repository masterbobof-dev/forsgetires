
import React, { useState } from 'react';
import { Search, Eye, EyeOff, X, SlidersHorizontal, ChevronDown } from 'lucide-react';

interface FilterToolbarProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  showOnlyInStock: boolean;
  setShowOnlyInStock: (val: boolean) => void;
  filterWidth: string;
  setFilterWidth: (val: string) => void;
  filterHeight: string;
  setFilterHeight: (val: string) => void;
  filterRadius: string;
  setFilterRadius: (val: string) => void;
  filterBrand: string;
  setFilterBrand: (val: string) => void;
  activeSort: string;
  setActiveSort: (val: any) => void;
  filterOptions: { widths: string[], heights: string[], radii: string[], brands: string[] };
  onSearch: () => void;
  onReset: () => void;
}

const FilterToolbar: React.FC<FilterToolbarProps> = (props) => {
  const hasActiveFilters = props.filterWidth || props.filterHeight || props.filterRadius || props.filterBrand || props.searchQuery;
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800 p-3 md:p-5 rounded-2xl mb-6 mx-0 shadow-2xl space-y-3">
      {/* Search Row */}
      <div className="flex gap-2">
        <div className="relative flex-grow group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#FFC300] transition-colors" size={16}/>
          <input
            type="text"
            placeholder="Пошук: модель, бренд, артикул..."
            value={props.searchQuery}
            onChange={e => props.setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && props.onSearch()}
            className="w-full bg-black/50 border border-zinc-700/50 rounded-xl pl-9 pr-3 py-3 text-white text-sm outline-none focus:border-[#FFC300] focus:ring-2 focus:ring-[#FFC300]/10 transition-all placeholder:text-zinc-600"
          />
        </div>

        <button
          onClick={() => props.setShowOnlyInStock(!props.showOnlyInStock)}
          className={`flex items-center gap-1.5 px-3 py-3 rounded-xl border transition-all font-bold text-xs whitespace-nowrap ${
            props.showOnlyInStock
              ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/50'
              : 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:border-zinc-500'
          }`}
        >
          {props.showOnlyInStock ? <Eye size={15}/> : <EyeOff size={15}/>}
          <span className="hidden sm:inline">{props.showOnlyInStock ? 'В наявн.' : 'Всі'}</span>
        </button>

        <button
          onClick={props.onSearch}
          className="bg-[#FFC300] hover:bg-white text-black font-black px-4 md:px-8 py-3 rounded-xl transition-all active:scale-95 uppercase text-xs md:text-sm tracking-widest shadow-lg shadow-yellow-900/20 whitespace-nowrap"
        >
          ЗНАЙТИ
        </button>
      </div>

      {/* Filters Toggle */}
      <div>
        <button
          onClick={() => setFiltersOpen(prev => !prev)}
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors w-full"
        >
          <SlidersHorizontal size={13} />
          <span className="text-[11px] font-black uppercase tracking-widest">Параметри підбору</span>
          {hasActiveFilters && (
            <span className="bg-[#FFC300] text-black text-[9px] font-black px-1.5 py-0.5 rounded-full ml-1">
              Активні
            </span>
          )}
          <ChevronDown size={14} className={`ml-auto transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
        </button>

        {filtersOpen && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mt-3">
            <div className="relative">
              <select value={props.filterWidth} onChange={e => props.setFilterWidth(e.target.value)} className="w-full bg-black/40 text-white p-2.5 md:p-3 rounded-xl border border-zinc-800 text-xs md:text-sm font-bold appearance-none cursor-pointer hover:border-[#FFC300]/50 transition-colors focus:border-[#FFC300] outline-none">
                <option value="">Ширина</option>
                {props.filterOptions.widths.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div className="relative">
              <select value={props.filterHeight} onChange={e => props.setFilterHeight(e.target.value)} className="w-full bg-black/40 text-white p-2.5 md:p-3 rounded-xl border border-zinc-800 text-xs md:text-sm font-bold appearance-none cursor-pointer hover:border-[#FFC300]/50 transition-colors focus:border-[#FFC300] outline-none">
                <option value="">Висота</option>
                {props.filterOptions.heights.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div className="relative">
              <select value={props.filterRadius} onChange={e => props.setFilterRadius(e.target.value)} className="w-full bg-black/40 text-white p-2.5 md:p-3 rounded-xl border border-zinc-800 text-xs md:text-sm font-bold appearance-none cursor-pointer hover:border-[#FFC300]/50 transition-colors focus:border-[#FFC300] outline-none">
                <option value="">Радіус</option>
                {props.filterOptions.radii.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div className="relative">
              <select value={props.filterBrand} onChange={e => props.setFilterBrand(e.target.value)} className="w-full bg-black/40 text-white p-2.5 md:p-3 rounded-xl border border-zinc-800 text-xs md:text-sm font-bold appearance-none cursor-pointer hover:border-[#FFC300]/50 transition-colors focus:border-[#FFC300] outline-none">
                <option value="">Бренд</option>
                {props.filterOptions.brands.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div className="relative">
              <select value={props.activeSort} onChange={e => props.setActiveSort(e.target.value as any)} className="w-full bg-black/40 text-[#FFC300] p-2.5 md:p-3 rounded-xl border border-zinc-800 text-xs md:text-sm font-bold appearance-none cursor-pointer hover:border-[#FFC300]/50 transition-colors focus:border-[#FFC300] outline-none">
                <option value="newest">Новинки</option>
                <option value="price_asc">Найдешевші</option>
                <option value="price_desc">Найдорожчі</option>
                <option value="with_photo">З фото</option>
              </select>
            </div>

            <button
              onClick={props.onReset}
              disabled={!hasActiveFilters}
              className={`flex items-center justify-center gap-2 p-2.5 md:p-3 rounded-xl border transition-all font-bold text-xs uppercase tracking-widest ${
                hasActiveFilters
                  ? 'bg-red-600/10 text-red-500 border-red-500/30 hover:bg-red-600 hover:text-white hover:border-red-600'
                  : 'bg-zinc-800/30 text-zinc-600 border-zinc-800 cursor-not-allowed'
              }`}
            >
              <X size={15}/>
              <span>Скинути</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterToolbar;
