import React, { useEffect, useRef, useState } from 'react';
import { Grid, Flame, ChevronRight, ChevronDown, Heart } from 'lucide-react';
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
  type Item = { id: string; sel: CategorySelection; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; label: string; on: boolean; hot?: boolean };
  const items: Item[] = [
    { id: 'all', sel: 'all', icon: Grid, label: 'Всі товари', on: active === 'all' },
    ...roots.map(c => ({ id: String(c.id), sel: c.id as CategorySelection, icon: getCategoryIcon(c.icon), label: c.name, on: activeRoot?.id === c.id })),
    { id: 'hot', sel: 'hot', icon: Flame, label: 'Акції', on: active === 'hot', hot: true },
    ...((favoritesCount > 0 || active === 'fav') ? [{ id: 'fav', sel: 'fav' as CategorySelection, icon: Heart, label: `Обране (${favoritesCount})`, on: active === 'fav', hot: true }] : []),
  ];
  const current = items.find(i => i.on) || items[0];
  const CurIcon = current.icon;

  return (
    <div className="mb-4 md:mb-6 space-y-2">
      <div className="md:hidden">
        <button onClick={() => setOpen(o => !o)} aria-expanded={open}
          className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-xl border font-black text-xs uppercase tracking-wide transition-colors ${current.hot ? 'bg-red-600 border-red-600 text-white' : 'bg-[#FFC300] border-[#FFC300] text-black'}`}>
          <CurIcon size={17} strokeWidth={2.5} />
          <span className="flex-1 text-left truncate">{current.label}</span>
          <span className="text-[10px] font-bold opacity-70 normal-case">{open ? 'згорнути' : `усі розділи (${categories.length})`}</span>
          <ChevronDown size={18} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="mt-2 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-3 gap-2">
              {items.filter(i => i.id === 'all' || i.hot).map(i => {
                const Icon = i.icon;
                return (
                  <button key={i.id} onClick={() => { onChange(i.sel); setOpen(false); }}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border font-black text-[10px] uppercase ${i.on ? (i.hot ? 'bg-red-600 border-red-600 text-white' : 'bg-[#FFC300] border-[#FFC300] text-black') : i.hot ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-zinc-900 border-zinc-800 text-zinc-200'}`}>
                    <Icon size={15} /> <span className="truncate">{i.label}</span>
                  </button>
                );
              })}
            </div>
            {roots.map(r => {
              const RIcon = getCategoryIcon(r.icon);
              const kids = getChildren(categories, r.id);
              return (
                <div key={r.id}>
                  <button onClick={() => { onChange(r.id); setOpen(false); }}
                    className={`w-full flex items-center gap-2 px-1 py-1.5 font-black text-sm uppercase ${active === r.id ? 'text-[#FFC300]' : 'text-white'}`}>
                    <span className="text-[#FFC300]"><RIcon size={17} /></span> <span className="flex-1 text-left">{r.name}</span>
                    <span className="text-[10px] font-bold text-zinc-500 normal-case">усі ›</span>
                  </button>
                  {kids.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5 mt-1">
                      {kids.map(k => {
                        const KIcon = getCategoryIcon(k.icon || r.icon);
                        return (
                          <button key={k.id} onClick={() => { onChange(k.id); setOpen(false); }}
                            className={`flex flex-col items-center justify-center gap-1 min-h-[58px] px-1 py-1.5 rounded-xl border text-center ${active === k.id ? 'bg-[#FFC300] border-[#FFC300] text-black' : 'bg-zinc-900 border-zinc-800 text-zinc-200'}`}>
                            <span className={active === k.id ? '' : 'text-[#FFC300]'}><KIcon size={15} /></span>
                            <span className="font-bold text-[10px] leading-tight break-words w-full">{k.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
