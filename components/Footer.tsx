import React from 'react';
import { Phone, MapPin, Clock, ShieldCheck } from 'lucide-react';
import { PHONE_NUMBER_1, PHONE_NUMBER_2, PHONE_LINK_1, PHONE_LINK_2 } from '../constants';

const Footer: React.FC = () => {
  return (
    <footer className="bg-black pt-20 pb-12 border-t border-white/10 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[1px] bg-gradient-to-r from-transparent via-[#FFC300]/30 to-transparent"></div>
      
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col">
            <span className="font-black text-4xl tracking-tighter text-white italic -skew-x-12">
              ФОРСАЖ<span className="text-[#FFC300]">24</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em] leading-none mt-1 ml-1">Шиномонтаж & Магазин</span>
          </div>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-xs">
            Найкращий сервіс у м. Синельникове. Професійне обладнання, досвідчені майстри та великий вибір шин у наявності.
          </p>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black uppercase tracking-widest">
               <ShieldCheck size={16} className="text-[#FFC300]" /> 100% Гарантія
             </div>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <h4 className="text-white font-black uppercase tracking-widest text-xs flex items-center gap-2">
            <span className="w-6 h-[2px] bg-[#FFC300]"></span>
            Послуги
          </h4>
          <ul className="flex flex-col gap-3 text-zinc-400 text-sm font-medium">
            <li className="hover:text-white transition-colors flex items-center gap-2">
              <div className="w-1 h-1 bg-[#FFC300] rounded-full"></div>
              Шиномонтаж та балансування
            </li>
            <li className="hover:text-white transition-colors flex items-center gap-2">
              <div className="w-1 h-1 bg-[#FFC300] rounded-full"></div>
              Ремонт бічних порізів
            </li>
            <li className="hover:text-white transition-colors flex items-center gap-2">
              <div className="w-1 h-1 bg-[#FFC300] rounded-full"></div>
              Продаж нових та вживаних шин
            </li>
            <li className="hover:text-white transition-colors flex items-center gap-2">
              <div className="w-1 h-1 bg-[#FFC300] rounded-full"></div>
              Сезонне зберігання
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-8">
          <h4 className="text-white font-black uppercase tracking-widest text-xs flex items-center gap-2">
            <span className="w-6 h-[2px] bg-[#FFC300]"></span>
            Зв'язок
          </h4>
          <div className="flex flex-col gap-4">
            <a href={PHONE_LINK_1} className="flex items-center gap-4 text-zinc-400 hover:text-white transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center group-hover:bg-[#FFC300] group-hover:text-black transition-all shadow-lg">
                <Phone size={20} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Основний</span>
                <span className="font-black text-lg tracking-tight">{PHONE_NUMBER_1}</span>
              </div>
            </a>
            <a href={PHONE_LINK_2} className="flex items-center gap-4 text-zinc-400 hover:text-white transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center group-hover:bg-[#FFC300] group-hover:text-black transition-all shadow-lg">
                <Phone size={20} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Додатковий</span>
                <span className="font-black text-lg tracking-tight">{PHONE_NUMBER_2}</span>
              </div>
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <h4 className="text-white font-black uppercase tracking-widest text-xs flex items-center gap-2">
            <span className="w-6 h-[2px] bg-[#FFC300]"></span>
            Локація
          </h4>
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-4 text-zinc-400">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-[#FFC300] flex-shrink-0 shadow-lg">
                <Clock size={20} />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-white text-lg">24 / 7</span>
                <span className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-600">Працюємо цілодобово</span>
              </div>
            </div>
            <div className="flex items-start gap-4 text-zinc-400">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-[#FFC300] flex-shrink-0 shadow-lg">
                <MapPin size={20} />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-white text-lg">м. Синельникове</span>
                <span className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-600">Дніпропетровська обл.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
        <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.4em] text-center md:text-left">
          © {new Date().getFullYear()} Шиномонтаж ФОРСАЖ. Всі права захищено.
        </p>
        <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-zinc-600">
           <span className="hover:text-zinc-400 cursor-pointer transition-colors">Політика конфіденційності</span>
           <span className="hover:text-zinc-400 cursor-pointer transition-colors">Публічна оферта</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
