import React from 'react';
import { Package } from 'lucide-react';

type IconType = React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

/**
 * Placeholder for a product without a photo: the category icon in a yellow tile (same look as "Популярні розділи" on the home page).
 * Fills its parent; `size` = icon size in px.
 */
const NoPhoto: React.FC<{ icon?: IconType; size?: number; label?: string }> = ({ icon: Icon = Package, size = 44, label }) => (
  <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-800 to-zinc-950">
    <span className="flex items-center justify-center rounded-[28%] bg-[#FFC300]/10 border border-[#FFC300]/20 text-[#FFC300]"
      style={{ width: size * 1.9, height: size * 1.9 }}>
      <Icon size={size} strokeWidth={1.5} />
    </span>
    {label && <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>}
  </div>
);

export default NoPhoto;
