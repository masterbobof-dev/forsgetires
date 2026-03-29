
import React, { useRef } from 'react';
import { Grid, Snowflake, Sun, CloudSun, Truck, Tractor, Flame, Ban, Mountain } from 'lucide-react';

export const CATEGORIES = [
  { id: 'all', label: 'Всі шини', icon: Grid },
  { id: 'winter', label: 'Зимові', icon: Snowflake },
  { id: 'summer', label: 'Літні', icon: Sun },
  { id: 'all-season', label: 'Всесезонні', icon: CloudSun },
  { id: 'cargo', label: 'Буси (C)', icon: Truck },
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const hasDragged = useRef(false);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDragging.current = true;
    hasDragged.current = false;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
    scrollRef.current.style.cursor = 'grabbing';
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = x - startX.current;
    if (Math.abs(walk) > 5) hasDragged.current = true;
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const onMouseUp = () => {
    isDragging.current = false;
    if (scrollRef.current) scrollRef.current.style.cursor = 'grab';
  };

  return (
    <div
      ref={scrollRef}
      className="mb-6 md:mb-10 -mx-2 px-2 overflow-x-auto scrollbar-hide select-none"
      style={{ WebkitOverflowScrolling: 'touch', cursor: 'grab' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div className="flex lg:grid lg:grid-cols-11 gap-2 pb-2 lg:pb-0" style={{ minWidth: 'max-content' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={(e) => {
              if (hasDragged.current) { e.preventDefault(); return; }
              onCategoryChange(cat.id);
            }}
            className={`group flex flex-col items-center justify-center gap-1.5 p-2.5 md:p-3.5 rounded-xl border transition-all duration-300 w-[72px] md:w-auto lg:w-auto flex-shrink-0 ${
              activeCategory === cat.id
                ? 'bg-[#FFC300] text-black border-[#FFC300] shadow-xl shadow-yellow-900/30'
                : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-white hover:border-zinc-700'
            }`}
          >
            <div className={`p-1.5 rounded-lg transition-all duration-300 ${
              activeCategory === cat.id ? 'bg-black/10' : 'bg-zinc-800 group-hover:bg-zinc-700'
            }`}>
              <cat.icon size={16} strokeWidth={activeCategory === cat.id ? 2.5 : 2} />
            </div>
            <span className={`font-black text-[8px] uppercase tracking-wide text-center leading-tight ${
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
