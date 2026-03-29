import React from 'react';
import { Settings, Wrench, ChevronRight } from 'lucide-react';

interface ServiceBannerProps {
  onServiceClick: () => void;
}

const ServiceBanner: React.FC<ServiceBannerProps> = ({ onServiceClick }) => {
  return (
    <div 
      onClick={onServiceClick}
      className="relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-6 mb-8 cursor-pointer group hover:border-zinc-700 transition-colors"
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-8 opacity-5">
        <Settings size={120} className="animate-spin-slow" />
      </div>
      <div className="absolute -bottom-10 -left-10 opacity-10 blur-xl">
        <div className="w-40 h-40 bg-[#FFC300] rounded-full" />
      </div>

      <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FFC300]/10 border border-[#FFC300]/20 flex items-center justify-center flex-shrink-0">
            <Wrench className="text-[#FFC300]" size={24} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg md:text-xl">Потрібен шиномонтаж?</h3>
            <p className="text-zinc-400 text-sm mt-1">Оберіть шини та одразу запишіться на заміну онлайн в місті Синельникове.</p>
          </div>
        </div>

        <button className="flex items-center gap-2 px-6 py-2.5 bg-zinc-800 text-white text-sm font-bold rounded-xl group-hover:bg-[#FFC300] group-hover:text-black transition-colors shrink-0">
          Записатися на СТО
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default ServiceBanner;
