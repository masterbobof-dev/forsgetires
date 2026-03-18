
import React from 'react';
import { Search, Eye, EyeOff, X, Filter, SlidersHorizontal, Snowflake, Sun, CloudSun } from 'lucide-react';

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

  return (
    <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800 p-4 md:p-6 rounded-3xl mb-8 mx-2 shadow-2xl space-y-6">
      {/* Search and Main Actions */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-grow group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#FFC300] transition-colors" size={20}/>
          <input 
            type="text" 
            placeholder="Пошук за моделлю, брендом або артикулом..." 
            value={props.searchQuery} 
            onChange={e => props.setSearchQuery(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && props.onSearch()} 
            className="w-full bg-black/50 border border-zinc-700/50 rounded-2xl pl-12 pr-4 py-4 text-white outline-none focus:border-[#FFC300] focus:ring-4 focus:ring-[#FFC300]/10 transition-all placeholder:text-zinc-600" 
          />
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={() => props.setShowOnlyInStock(!props.showOnlyInStock)} 
            className={`flex items-center gap-2 px-6 py-4 rounded-2xl border transition-all font-bold text-xs uppercase tracking-widest ${
              props.showOnlyInStock 
                ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/50 shadow-lg shadow-emerald-900/20' 
                : 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:border-zinc-500'
            }`}
          >
            {props.showOnlyInStock ? <Eye size={18}/> : <EyeOff size={18}/>} 
            <span className="hidden sm:inline">{props.showOnlyInStock ? 'В наявності' : 'Всі товари'}</span>
            <span className="sm:hidden">{props.showOnlyInStock ? 'Є' : 'Всі'}</span>
          </button>
          
          <button 
            onClick={props.onSearch} 
            className="flex-grow lg:flex-none bg-[#FFC300] hover:bg-white text-black font-black px-10 py-4 rounded-2xl transition-all active:scale-95 uppercase text-sm tracking-widest shadow-xl shadow-yellow-900/20"
          >
            ЗНАЙТИ
          </button>
        </div>
      </div>
      
      {/* Advanced Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-zinc-500 mb-1">
          <SlidersHorizontal size={14} />
          <span className="text-[10px] font-black uppercase tracking-widest">Параметри підбору</span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="relative">
            <select value={props.filterWidth} onChange={e => props.setFilterWidth(e.target.value)} className="w-full bg-black/40 text-white p-4 rounded-2xl border border-zinc-800 text-sm font-bold appearance-none cursor-pointer hover:border-[#FFC300]/50 transition-colors focus:border-[#FFC300] outline-none">
                <option value="">Ширина</option>
                {props.filterOptions.widths.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          
          <div className="relative">
            <select value={props.filterHeight} onChange={e => props.setFilterHeight(e.target.value)} className="w-full bg-black/40 text-white p-4 rounded-2xl border border-zinc-800 text-sm font-bold appearance-none cursor-pointer hover:border-[#FFC300]/50 transition-colors focus:border-[#FFC300] outline-none">
                <option value="">Висота</option>
                {props.filterOptions.heights.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          
          <div className="relative">
            <select value={props.filterRadius} onChange={e => props.setFilterRadius(e.target.value)} className="w-full bg-black/40 text-white p-4 rounded-2xl border border-zinc-800 text-sm font-bold appearance-none cursor-pointer hover:border-[#FFC300]/50 transition-colors focus:border-[#FFC300] outline-none">
                <option value="">Радіус</option>
                {props.filterOptions.radii.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          
          <div className="relative">
            <select value={props.filterBrand} onChange={e => props.setFilterBrand(e.target.value)} className="w-full bg-black/40 text-white p-4 rounded-2xl border border-zinc-800 text-sm font-bold appearance-none cursor-pointer hover:border-[#FFC300]/50 transition-colors focus:border-[#FFC300] outline-none">
                <option value="">Бренд</option>
                {props.filterOptions.brands.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div className="relative">
            <select value={props.activeSort} onChange={e => props.setActiveSort(e.target.value as any)} className="w-full bg-black/40 text-[#FFC300] p-4 rounded-2xl border border-zinc-800 text-sm font-bold appearance-none cursor-pointer hover:border-[#FFC300]/50 transition-colors focus:border-[#FFC300] outline-none">
                <option value="newest">Новинки</option>
                <option value="price_asc">Найдешевші</option>
                <option value="price_desc">Найдорожчі</option>
                <option value="with_photo">З фото</option>
            </select>
          </div>

          <button 
            onClick={props.onReset} 
            disabled={!hasActiveFilters}
            className={`flex items-center justify-center gap-2 p-4 rounded-2xl border transition-all font-bold text-xs uppercase tracking-widest ${
              hasActiveFilters 
                ? 'bg-red-600/10 text-red-500 border-red-500/30 hover:bg-red-600 hover:text-white hover:border-red-600' 
                : 'bg-zinc-800/30 text-zinc-600 border-zinc-800 cursor-not-allowed'
            }`}
          >
            <X size={18}/>
            <span>Скинути</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterToolbar;
