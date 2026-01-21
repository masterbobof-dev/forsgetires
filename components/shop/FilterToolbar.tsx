
import React from 'react';
import { Search, Eye, EyeOff, X } from 'lucide-react';

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
  return (
    <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl mb-8 mx-2 space-y-4 shadow-xl">
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18}/>
          <input 
            type="text" 
            placeholder="Пошук моделі або артикулу..." 
            value={props.searchQuery} 
            onChange={e => props.setSearchQuery(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && props.onSearch()} 
            className="w-full bg-black border border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-white outline-none focus:border-[#FFC300]" 
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => props.setShowOnlyInStock(!props.showOnlyInStock)} 
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 rounded-xl border transition-colors font-bold text-xs uppercase ${
              props.showOnlyInStock ? 'bg-green-600 text-white border-green-500' : 'bg-black text-zinc-500 border-zinc-700'
            }`}
          >
            {props.showOnlyInStock ? <Eye size={18}/> : <EyeOff size={18}/>} 
            {props.showOnlyInStock ? 'В наявності' : 'Всі'}
          </button>
          <button 
            onClick={props.onSearch} 
            className="flex-1 md:flex-none bg-[#FFC300] hover:bg-[#e6b000] text-black font-black px-8 py-3 rounded-xl transition-transform active:scale-95 uppercase text-sm tracking-widest"
          >
            ЗНАЙТИ
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <select value={props.filterWidth} onChange={e => props.setFilterWidth(e.target.value)} className="bg-black text-white p-3 rounded-xl border border-zinc-800 text-sm font-bold appearance-none cursor-pointer hover:border-zinc-600">
              <option value="">Ширина</option>
              {props.filterOptions.widths.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={props.filterHeight} onChange={e => props.setFilterHeight(e.target.value)} className="bg-black text-white p-3 rounded-xl border border-zinc-800 text-sm font-bold appearance-none cursor-pointer hover:border-zinc-600">
              <option value="">Висота</option>
              {props.filterOptions.heights.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={props.filterRadius} onChange={e => props.setFilterRadius(e.target.value)} className="bg-black text-white p-3 rounded-xl border border-zinc-800 text-sm font-bold appearance-none cursor-pointer hover:border-zinc-600">
              <option value="">Радіус</option>
              {props.filterOptions.radii.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={props.filterBrand} onChange={e => props.setFilterBrand(e.target.value)} className="bg-black text-white p-3 rounded-xl border border-zinc-800 text-sm font-bold appearance-none cursor-pointer hover:border-zinc-600">
              <option value="">Бренд</option>
              {props.filterOptions.brands.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <div className="flex gap-1">
            <select value={props.activeSort} onChange={e => props.setActiveSort(e.target.value as any)} className="flex-grow bg-black text-[#FFC300] p-3 rounded-xl border border-zinc-800 text-sm font-bold appearance-none cursor-pointer">
                <option value="newest">Новинки</option>
                <option value="price_asc">Дешевші</option>
                <option value="price_desc">Дорожчі</option>
                <option value="with_photo">З фото</option>
            </select>
            <button 
              onClick={props.onReset} 
              className="bg-zinc-800 text-white p-3 rounded-xl hover:bg-red-600 transition-colors border border-zinc-700"
              title="Скинути фільтри"
            >
              <X size={20}/>
            </button>
          </div>
      </div>
    </div>
  );
};

export default FilterToolbar;
