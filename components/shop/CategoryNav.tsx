import React, { useEffect, useRef, useState } from 'react';
import { Grid, Flame, ChevronRight, ChevronDown, ChevronLeft, Heart } from 'lucide-react';
import {
  ProductCategory, getRootCategories, getChildren, getRootOf, getCategoryIcon,
} from '../../categories';

/** 'all' = всі товари, 'hot' = акції, otherwise a category id. */
export type CategorySelection = 'all' | 'hot' | 'fav' | number;

interface CategoryNavProps {
  categories: ProductCategory[];
  active: CategorySelection;
  onChange: (sel: CategorySelection) => void;
  favoritesCount?: number;
}

const Chip: React.FC<{
  id?: string;
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  accent?: 'hot';
}> = ({ id, active, onClick, icon: Icon, label, accent }) => (
  <button
    data-chip={id}
    onClick={onClick}
    className={`group flex items-center gap-2 px-3 py-2.5 md:px-4 md:py-3 rounded-xl border transition-all duration-200 shrink-0 ${
      active
        ? accent === 'hot'
          ? 'bg-red-600 text-white border-red-600 shadow-xl shadow-red-900/30'
          : 'bg-[#FFC300] text-black border-[#FFC300] shadow-xl shadow-yellow-900/30'
        : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white hover:border-zinc-700'
    }`}
  >
    <Icon size={16} strokeWidth={active ? 2.5 : 2} />
    <span className="font-black text-[11px] md:text-xs uppercase tracking-wide whitespace-nowrap">{label}</span>
  </button>
);

const CategoryNav: React.FC<CategoryNavProps> = ({ categories, active, onChange, favoritesCount = 0 }) => {
  const roots = getRootCategories(categories);
  const activeCat = typeof active === 'number' ? categories.find(c => c.id === active) : undefined;
  const activeRoot = activeCat ? getRootOf(categories, activeCat) : undefined;
  const subcats = activeRoot ? getChildren(categories, activeRoot.id) : [];
  const rootRow = useRef<HTMLDivElement>(null);
  const subRow = useRef<HTMLDivElement>(null);

  // Keep the selected chip centered in its row (only horizontal scroll, the page doesn't jump)
  useEffect(() => {
    const center = (row: HTMLDivElement | null, id: string) => {
      const chip = row?.querySelector<HTMLElement>(`[data-chip="${id}"]`);
      if (!row || !chip) return;
      row.scrollTo({ left: chip.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2, behavior: 'smooth' });
    };
    center(rootRow.current, activeRoot ? String(activeRoot.id) : String(active));
    if (activeCat) center(subRow.current, String(activeCat.id));
  }, [active, activeRoot?.id, activeCat?.id]);

  // Phone: one button that drops down a grid of ALL sections (instead of a long sideways row)
  const [open, setOpen] = useState(false);
  const [drill, setDrill] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // breadcrumb "Каталог" on phones opens this list
  useEffect(() => {
    const h = () => { if (window.innerWidth < 768) { setOpen(true); setDrill(null); boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
    window.addEventListener('open-catalog', h);
    return () => window.removeEventListener('open-catalog', h);
  }, []);
  type Item = { id: string; sel: CategorySelection; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; label: string; on: boolean; hot?: boolean };
  const items: Item[] = [
    { id: 'all', sel: 'all', icon: Grid, label: 'Категорії', on: active === 'all' },
    ...roots.map(c => ({ id: String(c.id), sel: c.id as CategorySelection, icon: getCategoryIcon(c.icon), label: c.name, on: activeRoot?.id === c.id })),
    { id: 'hot', sel: 'hot', icon: Flame, label: 'Акції', on: active === 'hot', hot: true },
    ...((favoritesCount > 0 || active === 'fav') ? [{ id: 'fav', sel: 'fav' as CategorySelection, icon: Heart, label: `Обране (${favoritesCount})`, on: active === 'fav', hot: true }] : []),
  ];
  const current = items.find(i => i.on) || items[0];
  const CurIcon = current.icon;

  return (
    <div className="mb-4 md:mb-6 space-y-2">
      <div className="md:hidden" ref={boxRef}>
        <div className={`${open ? 'sticky top-[60px] z-30' : ''} flex gap-2`}>
          {/* one step up: subsection -> its section -> all goods */}
          {active !== 'all' && !open && (
            <button onClick={() => onChange(activeCat?.parent_id ?? 'all')} aria-label="На рівень вище"
              className="w-12 shrink-0 rounded-xl border border-zinc-700 bg-zinc-900 text-white flex items-center justify-center active:bg-zinc-800">
              <ChevronLeft size={22} />
            </button>
          )}
          <button onClick={() => { setOpen(o => !o); setDrill(activeRoot && getChildren(categories, activeRoot.id).length ? activeRoot.id : null); }} aria-expanded={open}
            className={`${open ? 'shadow-[0_8px_16px_-6px_rgba(0,0,0,0.9)]' : ''} flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2.5 min-h-[48px] rounded-xl border font-black text-xs uppercase tracking-wide transition-colors bg-[#FFC300] border-[#FFC300] text-black`}>
            <span className="shrink-0"><CurIcon size={17} strokeWidth={2.5} /></span>
            <span className="flex-1 min-w-0 text-left">
              {activeCat && activeRoot && activeCat.id !== activeRoot.id && (
                <span className="block text-[10px] font-bold opacity-60 truncate">{activeRoot.name}</span>
              )}
              <span className="block truncate">{current.id === 'all' ? 'Категорії' : activeCat ? activeCat.name : current.label}</span>
            </span>
            <span className="text-[10px] font-bold opacity-70 normal-case shrink-0">{open ? 'закрити' : 'усі категорії'}</span>
            <ChevronDown size={18} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {open && (() => {
          const close = () => { setOpen(false); setDrill(null); };
          const pick = (sel: CategorySelection) => { onChange(sel); close(); };
          const drillRoot = drill != null ? roots.find(r => r.id === drill) : undefined;
          const tile = (key: string | number, Icon: any, label: string, on: boolean, onClick: () => void, extra = '', arrow = false) => (
            <button key={key} onClick={onClick}
              className={`relative flex flex-col items-center justify-center gap-1.5 min-h-[76px] px-1.5 py-2 rounded-xl border text-center ${on ? 'bg-[#FFC300] border-[#FFC300] text-black' : 'bg-zinc-900 border-zinc-800 text-zinc-200 active:bg-zinc-800'} ${extra}`}>
              <span className={on ? '' : 'text-[#FFC300]'}><Icon size={20} /></span>
              <span className="font-black text-[10px] uppercase leading-tight break-words w-full">{label}</span>
              {arrow && <ChevronRight size={12} className="absolute right-1.5 top-1.5 text-zinc-500" />}
            </button>
          );
          return (
            <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
              {drillRoot ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <button onClick={() => setDrill(null)} className="h-9 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-bold flex items-center gap-1"><ChevronLeft size={14} /> Назад</button>
                    <span className="font-black uppercase text-sm text-white truncate">{drillRoot.name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {tile('all-' + drillRoot.id, Grid, `Усі: ${drillRoot.name}`, active === drillRoot.id, () => pick(drillRoot.id), '!border-[#FFC300]/40')}
                    {getChildren(categories, drillRoot.id).map(k => tile(k.id, getCategoryIcon(k.icon || drillRoot.icon), k.name, active === k.id, () => pick(k.id)))}
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {roots.map(r => {
                    const hasKids = getChildren(categories, r.id).length > 0;
                    return tile(r.id, getCategoryIcon(r.icon), r.name, activeRoot?.id === r.id, () => hasKids ? setDrill(r.id) : pick(r.id), '', hasKids);
                  })}
                  {items.filter(i => i.hot).map(i => tile(i.id, i.icon, i.label, i.on, () => pick(i.sel), i.on ? '' : '!bg-red-500/10 !border-red-500/30 !text-red-400'))}
                  {active !== 'all' && tile('all', Grid, 'Усі товари', false, () => pick('all'))}
                </div>
              )}
              <button onClick={() => { close(); boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                className="mt-3 w-full h-11 rounded-xl border border-zinc-800 bg-zinc-900 text-sm font-bold text-zinc-300 flex items-center justify-center gap-1">
                <ChevronDown size={16} className="rotate-180" /> Закрити категорії
              </button>
            </div>
          );
        })()}
      </div>
      <div ref={rootRow} className="hidden md:flex relative gap-2 overflow-x-auto pb-1 -mx-3 px-3 md:mx-0 md:px-0 scrollbar-hide fade-edges md:[mask-image:none] md:[-webkit-mask-image:none] md:flex-wrap" style={{ WebkitOverflowScrolling: 'touch' }}>
        <Chip id="all" active={active === 'all'} onClick={() => onChange('all')} icon={Grid} label="Всі товари" />
        {roots.map(cat => (
          <Chip
            key={cat.id}
            id={String(cat.id)}
            active={activeRoot?.id === cat.id}
            onClick={() => onChange(cat.id)}
            icon={getCategoryIcon(cat.icon)}
            label={cat.name}
          />
        ))}
        <Chip id="hot" active={active === 'hot'} onClick={() => onChange('hot')} icon={Flame} label="Акції" accent="hot" />
        {(favoritesCount > 0 || active === 'fav') && (
          <Chip id="fav" active={active === 'fav'} onClick={() => onChange('fav')} icon={Heart} label={`Обране (${favoritesCount})`} accent="hot" />
        )}
      </div>

      {activeRoot && subcats.length > 0 && (
        <div ref={subRow} key={activeRoot.id} className="relative flex items-center gap-2 overflow-x-auto pb-1 -mx-3 px-3 md:mx-0 md:px-0 scrollbar-hide fade-edges md:[mask-image:none] md:[-webkit-mask-image:none] animate-in fade-in slide-in-from-top-2 duration-300">
          <ChevronRight size={14} className="text-zinc-600 shrink-0" />
          <button
            data-chip={String(activeRoot.id)}
            onClick={() => onChange(activeRoot.id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide whitespace-nowrap border transition-colors ${
              active === activeRoot.id
                ? 'bg-white text-black border-white'
                : 'bg-black/40 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-600'
            }`}
          >
            Усі: {activeRoot.name}
          </button>
          {subcats.map(sub => {
            const SubIcon = getCategoryIcon(sub.icon);
            return (
              <button
                key={sub.id}
                data-chip={String(sub.id)}
                onClick={() => onChange(sub.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide whitespace-nowrap border transition-colors ${
                  active === sub.id
                    ? 'bg-white text-black border-white'
                    : 'bg-black/40 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-600'
                }`}
              >
                <SubIcon size={12} />
                {sub.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CategoryNav;
