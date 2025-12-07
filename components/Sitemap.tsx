
import React from 'react';
import { ViewState } from '../types';
import { Map, Home, ShoppingBag, DollarSign, Image as ImageIcon, Phone, Wrench, Lightbulb } from 'lucide-react';

interface SitemapProps {
  onNavigate: (view: ViewState) => void;
}

const Sitemap: React.FC<SitemapProps> = ({ onNavigate }) => {
  const sections = [
    {
      title: "Основне",
      links: [
        { label: "Головна сторінка", view: 'home', icon: Home },
        { label: "Магазин Шин та Дисків", view: 'shop', icon: ShoppingBag },
        { label: "Прайс-лист та Послуги", view: 'prices', icon: DollarSign },
        { label: "Фотогалерея", view: 'gallery', icon: ImageIcon },
      ]
    },
    {
      title: "Інформація",
      links: [
        { label: "Корисні поради", view: 'home', icon: Lightbulb, hash: 'tips' },
        { label: "Послуги ремонту", view: 'home', icon: Wrench, hash: 'services' },
        { label: "Контакти та Карта", view: 'home', icon: Phone, hash: 'contacts' },
      ]
    }
  ];

  const handleLinkClick = (view: ViewState | string) => {
    if (view === 'tips' || view === 'services' || view === 'contacts') {
       // Just navigate home, scrolling logic would be handled there usually, 
       // but for this architecture we just go Home.
       onNavigate('home');
    } else {
       onNavigate(view as ViewState);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#09090b] py-12 animate-in fade-in duration-500">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-8 border-b border-zinc-800 pb-4">
           <Map className="text-[#FFC300] w-8 h-8" />
           <h1 className="text-3xl md:text-4xl font-black text-white uppercase italic tracking-wide">
             Карта Сайту
           </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {sections.map((section, idx) => (
            <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 hover:border-[#FFC300]/50 transition-colors">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span className="w-2 h-8 bg-[#FFC300] rounded-full"></span>
                {section.title}
              </h2>
              <ul className="space-y-4">
                {section.links.map((link, lIdx) => (
                  <li key={lIdx}>
                    <button 
                      onClick={() => handleLinkClick(link.view)}
                      className="flex items-center gap-3 text-zinc-400 hover:text-[#FFC300] hover:translate-x-2 transition-all group w-full text-left"
                    >
                      <div className="p-2 bg-black rounded-lg group-hover:bg-[#FFC300] group-hover:text-black transition-colors border border-zinc-800 group-hover:border-[#FFC300]">
                        <link.icon size={18} />
                      </div>
                      <span className="font-bold text-lg">{link.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-zinc-900 p-8 rounded-2xl border border-zinc-800 text-center">
            <h3 className="text-2xl font-black text-white mb-2">Шиномонтаж ФОРСАЖ</h3>
            <p className="text-zinc-500 mb-6">м. Синельникове, вул. Квітнева 9</p>
            <button 
                onClick={() => onNavigate('home')}
                className="bg-[#FFC300] text-black font-bold py-3 px-8 rounded-xl hover:bg-[#e6b000] transition-transform active:scale-95"
            >
                На Головну
            </button>
        </div>

      </div>
    </div>
  );
};

export default Sitemap;
