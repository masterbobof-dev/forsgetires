import React from 'react';
import type { TyreProduct } from '../../types';

/** "Ви нещодавно переглядали" under the catalogue. */
const RecentlyViewed: React.FC<{ items: TyreProduct[]; onOpen: (p: TyreProduct) => void; formatPrice: (p: string | undefined) => string }> = ({ items, onOpen, formatPrice }) => (
  <div className="max-w-7xl mx-auto px-4 mt-16 pb-12">
      <h2 className="text-xl font-black text-white uppercase tracking-widest mb-6 border-b border-zinc-800 pb-4">
        <span className="bg-[#FFC300] text-black px-2 py-0.5 mr-2 rounded">історія</span>
        Ви нещодавно переглядали
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-6 snap-x" style={{scrollbarWidth: 'none'}}>
        {items.map(t => (
            <div key={t.id} onClick={() => onOpen(t)} className="min-w-[180px] max-w-[220px] bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col cursor-pointer hover:border-[#FFC300] transition-colors snap-center group">
              <div className="h-32 mb-3 bg-zinc-950 rounded-xl p-2 flex items-center justify-center overflow-hidden">
                  {t.image_url ? <img src={t.image_url} alt={t.title} className="max-h-full object-contain group-hover:scale-110 transition-transform"/> : <div className="text-zinc-700 font-bold text-[11px] uppercase">Без фото</div>}
              </div>
              <span className="text-[11px] text-[#FFC300] font-black uppercase tracking-widest mb-1 truncate">{t.manufacturer || 'Товар'}</span>
              <h4 className="text-white text-xs font-bold line-clamp-2 mb-2 flex-grow">{t.title}</h4>
              <span className="text-base font-black text-white">{formatPrice(t.price)} грн</span>
            </div>
        ))}
      </div>
  </div>
);

export default RecentlyViewed;
