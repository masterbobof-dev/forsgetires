import React from 'react';
import { Loader2, Phone, ArrowDown, ShoppingCart } from 'lucide-react';

/** Grey placeholders shown while the list is loading. */
export const GridSkeleton: React.FC = () => (
  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5 mt-2">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="bg-zinc-900/40 rounded-2xl animate-pulse border border-zinc-800/50 flex flex-col p-3">
        <div className="bg-zinc-800/50 rounded-xl aspect-square mb-3 w-full"></div>
        <div className="bg-zinc-800/50 h-2 w-16 mb-2 rounded-full"></div>
        <div className="bg-zinc-800/50 h-4 w-3/4 mb-4 rounded-full"></div>
        <div className="bg-zinc-800/50 h-8 w-2/3 rounded-xl"></div>
      </div>
    ))}
  </div>
);

interface EmptyResultsProps {
  /** slide-in animation matching the direction of the section change */
  slideClass: string;
  searchQuery: string;
  activeFilterCount: number;
  /** a section is open (so "search in all sections" makes sense) */
  inSection: boolean;
  onSearchEverywhere: () => void;
  onReset: () => void;
  shopPhone: string;
  shopPhoneLink: string;
}

/** "Nothing found": a hint what to do next, with buttons to widen the search, reset filters or call. */
export const EmptyResults: React.FC<EmptyResultsProps> = ({ slideClass, searchQuery, activeFilterCount, inSection, onSearchEverywhere, onReset, shopPhone, shopPhoneLink }) => (
  <div className={`mt-2 text-center py-16 md:py-24 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800 flex flex-col items-center gap-5 px-4 animate-in fade-in ${slideClass} duration-300`}>
    <div className="p-5 bg-zinc-800/50 rounded-full text-zinc-600"><ShoppingCart size={40} strokeWidth={1} /></div>
    <div className="space-y-2">
      <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tight">Нічого не знайдено</h3>
      <p className="text-zinc-500 text-sm max-w-xs mx-auto">
        {searchQuery ? <>За запитом «{searchQuery}» нічого немає. Спробуйте коротше — одне-два слова або артикул, чи зателефонуйте: підберемо й привеземо під замовлення.</> : activeFilterCount ? 'Спробуйте змінити або скинути фільтри' : 'У цій категорії поки немає товарів. Зателефонуйте — підберемо під замовлення!'}
      </p>
    </div>
    <div className="flex flex-wrap justify-center gap-2">
      {searchQuery && inSection && <button onClick={onSearchEverywhere} className="bg-[#FFC300] text-black font-black px-6 py-3 rounded-xl hover:bg-white transition-all">Шукати в усіх розділах</button>}
      {(activeFilterCount > 0 || searchQuery) && <button onClick={onReset} className="bg-white text-black font-black px-6 py-3 rounded-xl hover:bg-[#FFC300] transition-all">Скинути фільтри</button>}
      <a href={shopPhoneLink} className="bg-zinc-800 text-white font-black px-6 py-3 rounded-xl hover:bg-zinc-700 transition-all flex items-center gap-2"><Phone size={16} /> {shopPhone}</a>
    </div>
  </div>
);

/** "Показати ще" under the list. */
export const ShowMore: React.FC<{ onMore: () => void; loadingMore: boolean; shown: number; totalCount: number }> = ({ onMore, loadingMore, shown, totalCount }) => (
  <div className="mt-10 md:mt-16 text-center">
    <button
      onClick={onMore}
      disabled={loadingMore}
      className="group relative bg-zinc-900 hover:bg-zinc-800 text-white font-black py-4 px-10 rounded-2xl border border-zinc-800 transition-all shadow-xl flex items-center justify-center gap-3 mx-auto overflow-hidden active:scale-95"
    >
      {loadingMore ? <Loader2 className="animate-spin" size={20} /> : <ArrowDown size={20} className="group-hover:translate-y-1 transition-transform" />}
      <span className="uppercase tracking-widest text-xs md:text-sm">Показати ще</span>
    </button>
    <p className="mt-3 text-zinc-500 text-[11px] font-bold uppercase tracking-widest">Показано {shown} з {totalCount}</p>
  </div>
);

/** Folded text about the section (also read by Google). */
export const CategoryAbout: React.FC<{ name: string; description: string }> = ({ name, description }) => (
  <details className="mt-10 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 md:p-6 group">
    <summary className="cursor-pointer font-black uppercase tracking-tight text-zinc-200 list-none flex items-center justify-between">
      Про категорію «{name}»<ArrowDown size={16} className="group-open:rotate-180 transition-transform" />
    </summary>
    <div className="mt-3 space-y-2 text-sm text-zinc-400 leading-relaxed">
      {description.split(/\n+/).filter(Boolean).map((t, i) => <p key={i}>{t}</p>)}
    </div>
  </details>
);

/** Phones: a reminder that swiping changes the section. */
export const SwipeHint: React.FC = () => (
  <p className="lg:hidden mt-6 text-center text-[11px] font-bold uppercase tracking-widest text-zinc-700">
    ← Проведіть пальцем, щоб змінити категорію →
  </p>
);
