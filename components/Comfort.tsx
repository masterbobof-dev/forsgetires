import React from 'react';
import { Coffee, Armchair } from 'lucide-react';

const Comfort: React.FC = () => {
  return (
    <section className="py-8 bg-zinc-900/50 border-y border-white/5">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
             <Armchair className="text-[#FFC300] w-8 h-8" />
             <h3 className="text-2xl font-bold text-white">Комфорт Клієнтів</h3>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-black rounded-full border border-zinc-800">
              <Coffee className="text-[#FFC300] w-5 h-5" />
              <span className="text-zinc-200 font-medium">Гарячий кофе</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-black rounded-full border border-zinc-800">
              <Coffee className="text-[#FFC300] w-5 h-5" />
              <span className="text-zinc-200 font-medium">Смачний чай</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-black rounded-full border border-zinc-800">
              <span className="text-2xl leading-none">🥤</span>
              <span className="text-zinc-200 font-medium">Холодні напої</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Comfort;