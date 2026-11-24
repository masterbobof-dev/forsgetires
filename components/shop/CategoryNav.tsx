import React from 'react';
import { Grid, Flame, ChevronRight } from 'lucide-react';
import {
  ProductCategory, getRootCategories, getChildren, getRootOf, getCategoryIcon,
} from '../../categories';

/** 'all' = всі товари, 'hot' = акції, otherwise a category id. */
export type CategorySelection = 'all' | 'hot' | number;

interface CategoryNavProps {
  categories: ProductCategory[];
  active: CategorySelection;
  onChange: (sel: CategorySelection) => void;
}

const Chip: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  accent?: 'hot';
}> = ({ active, onClick, icon: Icon, label, accent }) => (
  <button
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

const CategoryNav: React.FC<CategoryNavProps> = ({ categories, active, onChange }) => {
  const roots = getRootCategories(categories);
  const activeCat = typeof active === 'number' ? categories.find(c => c.id === active) : undefined;
  const activeRoot = activeCat ? getRootOf(categories, activeCat) : undefined;
  const subcats = activeRoot ? getChildren(categories, activeRoot.id) : [];

  return (
    <div className="mb-6 md:mb-8 space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        <Chip active={active === 'all'} onClick={() => onChange('all')} icon={Grid} label="Всі товари" />
        {roots.map(cat => (
          <Chip
            key={cat.id}
            active={activeRoot?.id === cat.id}
            onClick={() => onChange(cat.id)}
            icon={getCategoryIcon(cat.icon)}
            label={cat.name}
          />
        ))}
        <Chip active={active === 'hot'} onClick={() => onChange('hot')} icon={Flame} label="Акції" accent="hot" />
      </div>

      {activeRoot && subcats.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-hide animate-in fade-in slide-in-from-top-1 duration-200">
          <ChevronRight size={14} className="text-zinc-600 shrink-0" />
          <button
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
