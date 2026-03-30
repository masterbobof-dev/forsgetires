
import React from 'react';
import { Tractor, ArrowRight, Wheat } from 'lucide-react';

interface AgroBannerProps {
  onCategoryClick: () => void;
}

const AgroBanner: React.FC<AgroBannerProps> = ({ onCategoryClick }) => {
  return (
    <div
      onClick={onCategoryClick}
      className="group relative overflow-hidden rounded-2xl cursor-pointer mb-6 border border-emerald-800/50 hover:border-emerald-600/70 transition-all duration-300 shadow-lg hover:shadow-[0_4px_30px_rgba(16,185,129,0.15)]"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-900 to-emerald-950/60"></div>
      
      {/* Animated stripe pattern */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'repeating-linear-gradient(45deg, #10b981 0px, #10b981 1px, transparent 0px, transparent 50%)',
        backgroundSize: '12px 12px'
      }}></div>

      {/* Decorative tractor icon */}
      <div className="absolute right-4 md:right-16 top-1/2 -translate-y-1/2 opacity-5 group-hover:opacity-10 transition-opacity">
        <Tractor size={120} className="text-emerald-400" strokeWidth={1} />
      </div>

      {/* Wheat decorative icons */}
      <div className="absolute right-2 md:right-8 top-3 opacity-10 group-hover:opacity-20 transition-opacity rotate-12">
        <Wheat size={32} className="text-yellow-400" />
      </div>
      <div className="absolute right-10 md:right-24 bottom-2 opacity-10 group-hover:opacity-20 transition-opacity -rotate-6">
        <Wheat size={20} className="text-yellow-400" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex items-center justify-between px-4 md:px-8 py-4 md:py-5">
        {/* Left side */}
        <div className="flex items-center gap-3 md:gap-5">
          <div className="bg-emerald-500/20 border border-emerald-500/30 p-2.5 md:p-3 rounded-xl group-hover:bg-emerald-500/30 transition-colors">
            <Tractor size={22} className="text-emerald-400" strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">В наявності</span>
            </div>
            <p className="text-white font-black text-sm md:text-lg uppercase tracking-tight leading-tight">
              Агро та Спецшини
            </p>
            <p className="text-emerald-400/80 text-[10px] md:text-xs font-bold uppercase tracking-widest">
              Трактор • Комбайн • Навантажувач • Спецтехніка
            </p>
          </div>
        </div>

        {/* Right side CTA */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden md:block text-emerald-400 text-xs font-black uppercase tracking-widest group-hover:text-white transition-colors">
            Переглянути
          </span>
          <div className="bg-emerald-500/20 border border-emerald-500/40 group-hover:bg-emerald-500 p-2 rounded-xl transition-all group-hover:border-emerald-400 group-hover:shadow-lg group-hover:shadow-emerald-900/30">
            <ArrowRight size={16} className="text-emerald-400 group-hover:text-white transition-colors group-hover:translate-x-0.5 transform" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgroBanner;
