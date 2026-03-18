
import React from 'react';
// Added Mountain icon for SUV category to fix type mismatch in TyreShop.tsx
import { Grid, Snowflake, Sun, CloudSun, Truck, Tractor, Flame, Ban, Mountain } from 'lucide-react';

export const CATEGORIES = [
  { id: 'all', label: 'Всі шини', icon: Grid },
  { id: 'winter', label: 'Зимові', icon: Snowflake },
  { id: 'summer', label: 'Літні', icon: Sun },
  { id: 'all-season', label: 'Всесезонні', icon: CloudSun },
  { id: 'cargo', label: 'Буси (C)', icon: Truck },
  // Added suv category to fix "no overlap" error in TyreShop.tsx
  { id: 'suv', label: 'SUV / 4x4', icon: Mountain },
  { id: 'truck', label: 'Вантажні (TIR)', icon: Truck },
  { id: 'agro', label: 'Агро / Спец', icon: Tractor },
  { id: 'hot_light', label: 'HOT Легкові', icon: Flame },
  { id: 'hot_heavy', label: 'HOT Вантажні', icon: Flame },
  { id: 'out_of_stock', label: 'Архів', icon: Ban },
] as const;

export type CategoryType = typeof CATEGORIES[number]['id'];

interface CategoryNavProps {
  activeCategory: CategoryType;
  onCategoryChange: (cat: CategoryType) => void;
}

const CategoryNav: React.FC<CategoryNavProps> = ({ activeCategory, onCategoryChange }) => {
  return (
    <div className="mb-12 -mx-2 px-2 overflow-x-auto no-scrollbar">
      <div className="flex lg:grid lg:grid-cols-11 gap-3 min-w-max lg:min-w-0 pb-4 lg:pb-0">
        {CATEGORIES.map(cat => (
          <button 
            key={cat.id} 
            onClick={() => onCategoryChange(cat.id)} 
            className={`group flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border transition-all duration-500 min-w-[100px] lg:min-w-0 ${
              activeCategory === cat.id 
                ? 'bg-[#FFC300] text-black border-[#FFC300] shadow-2xl shadow-yellow-900/30 -translate-y-1' 
                : 'bg-zinc-900/50 backdrop-blur-sm border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-white hover:border-zinc-700'
            }`}
          >
            <div className={`p-2 rounded-xl transition-all duration-500 ${
              activeCategory === cat.id ? 'bg-black/10' : 'bg-zinc-800 group-hover:bg-zinc-700 group-hover:scale-110'
            }`}>
              <cat.icon size={20} strokeWidth={activeCategory === cat.id ? 2.5 : 2} />
            </div>
            <span className={`font-black text-[9px] uppercase tracking-widest text-center leading-tight transition-all duration-500 ${
              activeCategory === cat.id ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
            }`}>
              {cat.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryNav;
