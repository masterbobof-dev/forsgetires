
import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, ShieldCheck, Coins, Coffee, Phone, AlertCircle, MapPin, CalendarDays, Flame, ChevronRight, ChevronLeft, ShoppingBag, Megaphone, Star, Truck, Tractor, ArrowRight } from 'lucide-react';
import { HERO_BG_IMAGE, PHONE_NUMBER_1, PHONE_NUMBER_2, PHONE_LINK_1, PHONE_LINK_2 } from '../constants';
import BookingWizard from './BookingWizard';
import { supabase } from '../supabaseClient';
import { TyreProduct } from '../types';
import { DEFAULT_IMG_CONFIG, DEFAULT_BG_CONFIG } from './admin/promo/shared';

interface HeroProps {
  onShopRedirect: (category: string, tyre?: TyreProduct) => void;
}

const safeParsePrice = (val: string | undefined | null): number => {
    if (!val) return 0;
    const clean = String(val).replace(/,/g, '.').replace(/[^\d.]/g, '');
    return parseFloat(clean) || 0;
};

const Hero: React.FC<HeroProps> = ({ onShopRedirect }) => {
  const [phone, setPhone] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [error, setError] = useState('');
  const [hotTyres, setHotTyres] = useState<TyreProduct[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [promos, setPromos] = useState<any[]>([]);
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const [heroText, setHeroText] = useState({ title: 'ЦІЛОДОБОВИЙ ШИНОМОНТАЖ', subtitle: 'В М. СИНЕЛЬНИКОВЕ (24/7)' });

  useEffect(() => {
    const fetchData = async () => {
      const { data: lightTyres } = await supabase.from('tyres').select('*').eq('is_hot', true).in('vehicle_type', ['car', 'suv', 'cargo']).limit(10);
      if (lightTyres) setHotTyres(lightTyres);
      
      const { data: settingsData } = await supabase.from('settings').select('key, value').in('key', ['promo_data', 'hero_title', 'hero_subtitle']);
      if (settingsData) {
          settingsData.forEach(item => {
              if (item.key === 'promo_data' && item.value) {
                  try {
                     const p = JSON.parse(item.value);
                     setPromos(Array.isArray(p) ? p.filter((x:any) => x.active) : (p.active ? [p] : []));
                  } catch (e) { console.error(e); }
              }
              if (item.key === 'hero_title' && item.value) setHeroText(prev => ({ ...prev, title: item.value }));
              if (item.key === 'hero_subtitle' && item.value) setHeroText(prev => ({ ...prev, subtitle: item.value }));
          });
      }
    };
    fetchData();
  }, []);

  const handlePromoClick = (promo: any) => {
      if (!promo) return;
      if (promo.link === 'shop') onShopRedirect('all'); 
      else if (promo.link === 'booking') setShowWizard(true);
  };

  return (
    <section className="relative w-full overflow-hidden pb-12">
      <div className="absolute inset-0 z-0 h-[120vh]">
        <img src={HERO_BG_IMAGE} alt="Шиномонтаж Форсаж Синельникове — професійний сервіс" className="w-full h-full object-cover object-center opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/70 to-[#09090b]"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8 md:py-20 flex flex-col gap-8">
        {promos.length > 0 && (
            <div className="relative group/carousel">
                <div onClick={() => handlePromoClick(promos[currentPromoIndex])} className={`w-full rounded-3xl p-6 md:p-12 text-white shadow-2xl relative overflow-hidden cursor-pointer transition-all duration-500 ${promos[currentPromoIndex].color}`}>
                    <div className="relative z-20 flex flex-col md:flex-row items-center justify-between gap-8 min-h-[300px]">
                        <div className="flex-grow text-center md:text-left z-20 max-w-2xl">
                            <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-md border border-[#FFC300]/50 text-[#FFC300] px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest mb-4">АКЦІЯ</div>
                            <h2 className="text-3xl md:text-6xl font-black uppercase italic leading-tight mb-4 text-white">{promos[currentPromoIndex].title}</h2>
                            <p className="text-base md:text-xl font-medium text-zinc-300 mb-6">{promos[currentPromoIndex].text}</p>
                            <button className="w-full md:w-auto bg-[#FFC300] text-black font-black text-sm md:text-base px-10 py-4 rounded-xl uppercase tracking-widest active:scale-95 flex items-center justify-center gap-3 mx-auto md:mx-0">
                                {promos[currentPromoIndex].buttonText} <ChevronRight size={20}/>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <div className="w-full bg-[#18181b] border-l-4 border-[#FFC300] p-6 md:p-8 backdrop-blur-md rounded-r-lg shadow-xl">
          <h1 className="text-3xl md:text-6xl font-black text-[#FFC300] uppercase leading-tight mb-6 tracking-tight italic text-center md:text-left">
            {heroText.title}<br/><span className="text-white">{heroText.subtitle}</span>
          </h1>
          <div className="flex flex-col md:flex-row gap-4 w-full">
            <div className="relative flex-grow">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={24} />
                <input type="tel" placeholder="Ваш номер (099...)" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-black/50 border border-zinc-700 text-white p-4 pl-12 rounded-xl text-lg outline-none focus:border-[#FFC300]" />
            </div>
            <button onClick={() => setShowWizard(true)} className="bg-[#FFC300] text-black font-black text-xl px-10 py-5 rounded-xl active:scale-95 shadow-lg whitespace-nowrap">ЗАПИСАТИСЯ</button>
          </div>
        </div>

        {/* SEO Keywords hidden or styled */}
        <div className="hidden">
          <h2>Ремонт шин, балансування коліс, зварювання дисків, нові шини Синельникове</h2>
          <p>Найкращий шиномонтаж у місті. Працюємо цілодобово для вашої безпеки на дорозі.</p>
        </div>
      </div>

      {showWizard && <BookingWizard initialPhone={phone} onClose={() => setShowWizard(false)} />}
    </section>
  );
};

export default Hero;
