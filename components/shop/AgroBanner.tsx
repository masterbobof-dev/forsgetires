
import React from 'react';
import { Tractor, ArrowRight, Wheat, ShoppingCart } from 'lucide-react';
import { TyreProduct } from '../../types';

interface AgroBannerProps {
  onCategoryClick: () => void;
  featuredProducts?: TyreProduct[];
  onProductClick?: (id: number) => void;
}

const AgroBanner: React.FC<AgroBannerProps> = ({ onCategoryClick, featuredProducts = [], onProductClick }) => {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl mb-6 border border-emerald-800/50 hover:border-emerald-600/70 transition-all duration-300 shadow-lg hover:shadow-[0_4px_30px_rgba(16,185,129,0.15)]"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-900 to-emerald-950/60" onClick={onCategoryClick}></div>
      
      {/* Animated stripe pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(45deg, #10b981 0px, #10b981 1px, transparent 0px, transparent 50%)',
        backgroundSize: '12px 12px'
      }}></div>

      {/* Decorative tractor icon */}
      <div className="absolute left-1/4 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none">
        <Tractor size={160} className="text-emerald-400" strokeWidth={1} />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6 px-4 md:px-8 py-5 md:py-6">
        
        {/* Top Section: Icon, Text and Mobile CTA */}
        <div className="flex items-center justify-between w-full lg:w-auto">
          <div className="flex items-center gap-4 md:gap-6 cursor-pointer flex-grow" onClick={onCategoryClick}>
            <div className="bg-emerald-500/20 border border-emerald-500/30 p-3 md:p-4 rounded-2xl group-hover:bg-emerald-500/30 transition-colors shadow-inner">
              <Tractor size={28} className="text-emerald-400" strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-emerald-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest animate-pulse">В наявності</span>
                <span className="text-yellow-400/60 text-[10px] font-bold uppercase tracking-widest hidden md:block">• Прямі поставки</span>
              </div>
              <p className="text-white font-black text-xl md:text-2xl uppercase tracking-tighter leading-tight">
                Агро та Спецшини
              </p>
              <p className="text-emerald-400/80 text-xs md:text-sm font-bold uppercase tracking-widest mt-1">
                Трактори • Комбайни • Спецтехніка
              </p>
            </div>
          </div>

          {/* Mobile Arrow CTA (Hidden on Desktop) */}
          <div 
            className="flex lg:hidden bg-emerald-500/20 border border-emerald-500/40 p-2.5 rounded-xl active:bg-emerald-500 active:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all"
            onClick={onCategoryClick}
          >
            <ArrowRight size={20} className="text-emerald-400" />
          </div>
        </div>

        {/* Middle: Featured Products (The "Showcase") */}
        {featuredProducts.length > 0 && (
          <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 scrollbar-hide lg:pb-0 w-full lg:w-auto">
            {featuredProducts.map((product) => (
              <div 
                key={product.id}
                onClick={(e) => { e.stopPropagation(); onProductClick?.(product.id); }}
                className="flex items-center gap-3 bg-zinc-950/40 border border-emerald-500/20 p-2 rounded-xl hover:bg-emerald-900/20 hover:border-emerald-500/50 transition-all cursor-pointer group/card w-[160px] md:w-[190px] shrink-0 active:scale-95"
              >
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-black overflow-hidden flex-shrink-0 border border-zinc-800 group-hover/card:border-emerald-500/30 transition-colors">
                  <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] md:text-xs font-black text-white truncate uppercase leading-tight">{product.title}</p>
                  <p className="text-xs md:text-sm font-black text-[#FFC300] mt-0.5">{Math.round(parseFloat(product.price)).toLocaleString()} грн</p>
                  <div className="flex items-center gap-1 mt-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter">Дивитись</span>
                    <ArrowRight size={8} className="text-emerald-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Right side: Global CTA (Desktop only) */}
        <div className="hidden lg:flex items-center gap-3 shrink-0 cursor-pointer group/cta" onClick={onCategoryClick}>
          <div className="hidden xl:flex flex-col items-end">
            <span className="text-white text-xs font-black uppercase tracking-widest italic leading-none">Всі пропозиції</span>
            <span className="text-emerald-500 text-[10px] font-bold uppercase tracking-tighter opacity-60">Перейти до розділу</span>
          </div>
          <div className="bg-emerald-500/20 border border-emerald-500/40 group-hover/cta:bg-emerald-500 p-2.5 md:p-3 rounded-xl transition-all group-hover/cta:border-emerald-400 group-hover/cta:shadow-[0_0_20px_rgba(16,185,129,0.4)]">
            <ArrowRight size={20} className="text-emerald-400 group-hover/cta:text-white transition-colors group-hover/cta:translate-x-1 transform duration-300" />
          </div>
        </div>
      </div>

      {/* Wheat decorative icons */}
      <div className="absolute left-8 bottom-3 opacity-10 pointer-events-none rotate-12 hidden md:block">
        <Wheat size={40} className="text-yellow-400" />
      </div>
    </div>
  );
};

export default AgroBanner;
