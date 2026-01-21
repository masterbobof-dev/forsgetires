
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
    <div className="mb-8 px-2">
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-11 gap-2 md:gap-3">
        {CATEGORIES.map(cat => (
          <button 
            key={cat.id} 
            onClick={() => onCategoryChange(cat.id)} 
            className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border transition-all duration-300 ${
              activeCategory === cat.id 
                ? 'bg-[#FFC300] text-black scale-105 shadow-lg shadow-yellow-900/20 border-[#FFC300]' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <cat.icon size={18} />
            <span className="font-bold text-[10px] uppercase text-center leading-tight whitespace-pre-wrap">{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryNav;
