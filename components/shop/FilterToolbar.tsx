import React, { useEffect, useState } from 'react';
import SearchSuggest, { SuggestHandlers } from './SearchSuggest';
import { Search, X, SlidersHorizontal, Eye, EyeOff, ArrowUpDown, Check } from 'lucide-react';
import { FilterPreset } from '../../productAttributes';

export type SortValue = 'recommended' | 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'with_photo' | 'no_photo';

export interface FilterState {
  searchQuery: string;
  showOnlyInStock: boolean;
  filterWidth: string;
  filterHeight: string;
  filterRadius: string;
  filterBrand: string;
  filterSeason: string;
  attrFilters: Record<string, string>;
}

export interface FilterOptions {
  widths: string[];
  heights: string[];
  radii: string[];
  brands: string[];
}

interface FilterPanelProps {
  state: FilterState;
  set: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  setAttr: (key: string, value: string) => void;
  options: FilterOptions;
  /** distinct values found in products of the current category, per attribute key */
  attrValues: Record<string, string[]>;
  showTyreFilters: boolean;
  preset: FilterPreset | null;
  onReset: () => void;
}

const selectCls = 'w-full bg-black/40 text-white px-3 py-2.5 rounded-xl border border-zinc-800 text-sm font-bold appearance-none cursor-pointer hover:border-[#FFC300]/50 transition-colors focus:border-[#FFC300] outline-none';
const labelCls = 'block text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-1.5';

export const countActiveFilters = (s: FilterState) =>
  [s.filterWidth, s.filterHeight, s.filterRadius, s.filterBrand, s.filterSeason].filter(Boolean).length +
  Object.values(s.attrFilters).filter(Boolean).length +
  (s.showOnlyInStock ? 1 : 0);

const ChipGroup: React.FC<{ value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }> = ({ value, onChange, options }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map(o => {
      const active = value === o.value;
      return (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(active ? '' : o.value)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
            active ? 'bg-[#FFC300] text-black border-[#FFC300] shadow-lg shadow-yellow-900/20' : 'bg-black/40 text-zinc-300 border-zinc-800 hover:border-zinc-600'
          }`}
        >
          {active && <Check size={12} strokeWidth={3} />}
          {o.label}
        </button>
      );
    })}
  </div>
);

/** All filter controls. Rendered in the desktop sidebar and in the mobile bottom sheet. */
export const FilterPanel: React.FC<FilterPanelProps> = ({ state, set, setAttr, options, attrValues, showTyreFilters, preset, onReset }) => {
  const active = countActiveFilters(state);
  return (
    <div className="space-y-5">
      {showTyreFilters && (
        <div className="space-y-3">
          <div>
            <span className={labelCls}>Популярні розміри</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { w: '205', h: '55', r: 'R16' },
                { w: '195', h: '65', r: 'R15' },
                { w: '225', h: '65', r: 'R17' },
                { w: '185', h: '65', r: 'R14' },
              ].map(size => {
                const on = state.filterWidth === size.w && state.filterHeight === size.h && state.filterRadius === size.r;
                return (
                  <button
                    key={`${size.w}-${size.h}-${size.r}`}
                    type="button"
                    onClick={() => {
                      set('filterWidth', on ? '' : size.w);
                      set('filterHeight', on ? '' : size.h);
                      set('filterRadius', on ? '' : size.r);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors active:scale-95 ${on ? 'bg-[#FFC300] text-black' : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
                  >
                    {size.w}/{size.h} {size.r}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>Ширина</label>
              <select value={state.filterWidth} onChange={e => set('filterWidth', e.target.value)} className={selectCls}>
                <option value="">—</option>
                {options.widths.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Висота</label>
              <select value={state.filterHeight} onChange={e => set('filterHeight', e.target.value)} className={selectCls}>
                <option value="">—</option>
                {options.heights.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Радіус</label>
              <select value={state.filterRadius} onChange={e => set('filterRadius', e.target.value)} className={selectCls}>
                <option value="">—</option>
                {options.radii.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <button type="button" onClick={() => window.dispatchEvent(new Event('forsage:size-guide'))} className="-mt-1 text-xs font-bold text-[#FFC300] hover:underline self-start">
            Як дізнатися свій розмір?
          </button>
          <div>
            <span className={labelCls}>Сезон</span>
            <ChipGroup
              value={state.filterSeason}
              onChange={v => set('filterSeason', v)}
              options={[{ value: 'winter', label: '❄ Зимові' }, { value: 'summer', label: '☀ Літні' }, { value: 'all-season', label: 'Всесезонні' }]}
            />
          </div>
        </div>
      )}

      {preset && preset.fields.filter(f => f.filter !== 'none').map(field => {
        const value = state.attrFilters[field.key] || '';
        const known = attrValues[field.key] || [];
        if (field.filter === 'chips' && field.options) {
          return (
            <div key={field.key}>
              <span className={labelCls}>{field.label}</span>
              <ChipGroup value={value} onChange={v => setAttr(field.key, v)} options={field.options} />
            </div>
          );
        }
        const values = field.options ? field.options.filter(o => known.length === 0 || known.includes(o.value)) : known.map(v => ({ value: v, label: field.unit ? `${v} ${field.unit}` : v }));
        if (values.length === 0) return null;
        return (
          <div key={field.key}>
            <label className={labelCls}>{field.label}</label>
            <select value={value} onChange={e => setAttr(field.key, e.target.value)} className={selectCls}>
              <option value="">Будь-яка</option>
              {values.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        );
      })}

      {options.brands.length > 0 && (
        <div>
          <label className={labelCls}>Бренд</label>
          <select value={state.filterBrand} onChange={e => set('filterBrand', e.target.value)} className={selectCls}>
            <option value="">Усі бренди</option>
            {options.brands.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      )}

      <button
        type="button"
        onClick={() => set('showOnlyInStock', !state.showOnlyInStock)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-bold transition-colors ${
          state.showOnlyInStock ? 'bg-emerald-600/15 text-emerald-400 border-emerald-500/40' : 'bg-black/40 text-zinc-300 border-zinc-800 hover:border-zinc-600'
        }`}
      >
        <span className="flex items-center gap-2">{state.showOnlyInStock ? <Eye size={16} /> : <EyeOff size={16} />} Лише в наявності</span>
        <span className={`w-9 h-5 rounded-full relative transition-colors ${state.showOnlyInStock ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${state.showOnlyInStock ? 'left-[18px]' : 'left-0.5'}`} />
        </span>
      </button>

      {active > 0 && (
        <button
          type="button"
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/30 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors"
        >
          <X size={14} /> Скинути фільтри ({active})
        </button>
      )}
    </div>
  );
};

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onSearch: () => void;
  activeSort: SortValue;
  setActiveSort: (v: SortValue) => void;
  activeFilters: number;
  totalCount: number;
  onOpenFilters: () => void;
  suggest?: SuggestHandlers;
}

/** Compact bar: search + "Фільтри" (mobile/tablet) + sort. Sticky under the site header. */
export const SearchBar: React.FC<SearchBarProps> = ({ searchQuery, setSearchQuery, onSearch, activeSort, setActiveSort, activeFilters, totalCount, onOpenFilters, suggest }) => {
  const [focused, setFocused] = useState(false);
  return (
  <div className="sticky z-30 -mx-2 px-2 py-2 md:py-3 bg-[#09090b] border-b border-zinc-800/80 shadow-[0_8px_16px_-8px_rgba(0,0,0,0.9)] lg:border-0 lg:shadow-none lg:static lg:mx-0 lg:px-0 lg:bg-transparent lg:backdrop-blur-none" style={{ top: 'var(--header-h, 64px)' }}>
    <div className="flex gap-2">
      <div className="relative flex-grow group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#FFC300] transition-colors" size={16} />
        <input
          type="search"
          enterKeyHint="search"
          placeholder="Пошук: модель, бренд, артикул..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { onSearch(); setFocused(false); (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') setFocused(false); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete="off"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-9 py-2.5 md:py-3 text-white text-sm outline-none focus:border-[#FFC300] focus:ring-2 focus:ring-[#FFC300]/10 transition-all placeholder:text-zinc-600"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white" aria-label="Очистити пошук">
            <X size={16} />
          </button>
        )}
        {focused && suggest && (
          <SearchSuggest query={searchQuery} {...suggest}
            onProduct={p => { setFocused(false); suggest.onProduct(p); }}
            onCategory={c => { setFocused(false); suggest.onCategory(c); }}
            onAll={() => { setFocused(false); onSearch(); }} />
        )}
      </div>

      <button
        onClick={onOpenFilters}
        className={`lg:hidden relative flex items-center gap-1.5 px-3 rounded-xl border font-bold text-xs transition-all active:scale-95 ${
          activeFilters ? 'bg-[#FFC300] text-black border-[#FFC300]' : 'bg-zinc-900 text-zinc-200 border-zinc-800'
        }`}
        aria-label="Фільтри"
      >
        <SlidersHorizontal size={16} />
        <span className="hidden sm:inline">Фільтри</span>
        {activeFilters > 0 && (
          <span className="absolute -top-1.5 -right-1.5 sm:static min-w-[18px] h-[18px] px-1 rounded-full bg-black text-[#FFC300] text-[11px] font-black flex items-center justify-center">
            {activeFilters}
          </span>
        )}
      </button>

      <div className="relative">
        <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <select
          value={activeSort}
          onChange={e => setActiveSort(e.target.value as SortValue)}
          className="h-full bg-zinc-900 text-[#FFC300] pl-8 pr-2 sm:pr-3 rounded-xl border border-zinc-800 text-xs font-bold appearance-none cursor-pointer outline-none focus:border-[#FFC300] w-[44px] sm:w-auto text-transparent sm:text-[#FFC300]"
          aria-label="Сортування"
        >
          <option value="recommended">Рекомендовані</option>
          <option value="newest">Новинки</option>
          <option value="price_asc">Найдешевші</option>
          <option value="price_desc">Найдорожчі</option>
          <option value="with_photo">Тільки з фото</option>
        </select>
      </div>
    </div>
    <p className="hidden lg:block mt-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-500 px-1">
      Знайдено: <span className="text-zinc-300">{totalCount}</span> шт
    </p>
  </div>
  );
};

/** Bottom sheet (phone) / side panel (tablet) with the filter panel. */
export const FilterSheet: React.FC<{ open: boolean; onClose: () => void; totalCount: number; children: React.ReactNode }> = ({ open, onClose, totalCount, children }) => {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[180] lg:hidden" role="dialog" aria-modal="true" aria-label="Фільтри">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[88vh] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] bg-zinc-900 border-t md:border-t-0 md:border-l border-zinc-800 rounded-t-3xl md:rounded-none flex flex-col shadow-2xl animate-in slide-in-from-bottom md:slide-in-from-right duration-300">
        <div className="md:hidden flex justify-center pt-2.5 pb-1"><span className="w-10 h-1.5 rounded-full bg-zinc-700" /></div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2"><SlidersHorizontal size={18} className="text-[#FFC300]" /> Фільтри</h2>
          <button onClick={onClose} className="p-2 rounded-full bg-zinc-800 text-zinc-400 hover:text-white" aria-label="Закрити"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 overscroll-contain">{children}</div>
        <div className="p-4 border-t border-zinc-800 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button onClick={onClose} className="w-full bg-[#FFC300] hover:bg-white text-black font-black py-3.5 rounded-2xl uppercase tracking-widest text-sm active:scale-[0.98] transition-all">
            Показати {totalCount} товарів
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
