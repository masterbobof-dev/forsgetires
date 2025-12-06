
import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, ShieldCheck, Coins, Coffee, Phone, AlertCircle, MapPin, CalendarDays, Flame, ChevronRight, ChevronLeft, ShoppingBag } from 'lucide-react';
import { HERO_BG_IMAGE, PHONE_NUMBER_1, PHONE_NUMBER_2, PHONE_LINK_1, PHONE_LINK_2 } from '../constants';
import BookingWizard from './BookingWizard';
import { supabase } from '../supabaseClient';
import { TyreProduct } from '../types';

interface HeroProps {
  onShopRedirect: (tyre: TyreProduct) => void;
}

const Hero: React.FC<HeroProps> = ({ onShopRedirect }) => {
  const [phone, setPhone] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [error, setError] = useState('');
  
  // Hot Products State
  const [hotTyres, setHotTyres] = useState<TyreProduct[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchHotTyres = async () => {
      const { data } = await supabase
        .from('tyres')
        .select('*')
        .eq('is_hot', true)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (data) setHotTyres(data);
    };
    fetchHotTyres();
  }, []);

  const startBooking = () => {
    if (phone.length < 9) {
      setError('Введіть коректний номер (мін. 9 цифр)');
      return;
    }
    setError('');
    setShowWizard(true);
  };

  const handleScroll = (e: React.WheelEvent) => {
    if (scrollRef.current) {
      // If we scroll vertically with mouse wheel, translate it to horizontal scroll
      if (e.deltaY !== 0) {
         // e.preventDefault(); // Optional: Uncomment if you want to strictly lock page scroll while hovering
         scrollRef.current.scrollLeft += e.deltaY;
      }
    }
  };

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative w-full overflow-hidden pb-12">
      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0 h-[120vh]">
        <img 
          src={HERO_BG_IMAGE}
          alt="Шиномонтаж Forsage Фасад" 
          className="w-full h-full object-cover object-center md:object-top opacity-50"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/70 to-[#09090b]"></div>
      </div>

      {/* Content Layer */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-12 md:py-20 flex flex-col gap-8">
        
        <div className="space-y-6">
          
          {/* ADDRESS & PHONES BLOCK */}
          <div className="flex flex-col md:flex-row w-full gap-4 md:gap-8 items-start md:items-center justify-between bg-black/40 p-5 rounded-xl border border-white/10 backdrop-blur-sm mt-4">
             <div className="flex items-center gap-3 text-zinc-200">
                <MapPin className="text-[#FFC300] shrink-0" size={28} />
                <span className="text-base md:text-xl font-bold leading-tight">
                  м. Синельникове, <span className="whitespace-nowrap">вул. Квітнева 9</span>
                </span>
             </div>
             
             <div className="hidden md:block h-8 w-px bg-white/10"></div>

             <div className="flex flex-col sm:flex-row gap-3 sm:gap-8 w-full md:w-auto">
                <a href={PHONE_LINK_1} className="flex items-center gap-2 font-bold text-lg md:text-xl text-white hover:text-[#FFC300] transition-colors">
                   <Phone className="text-[#FFC300]" size={20} />
                   {PHONE_NUMBER_1}
                </a>
                <a href={PHONE_LINK_2} className="flex items-center gap-2 font-bold text-lg md:text-xl text-white hover:text-[#FFC300] transition-colors">
                   <Phone className="text-[#FFC300]" size={20} />
                   {PHONE_NUMBER_2}
                </a>
             </div>
          </div>

          {/* ONLINE BOOKING BLOCK */}
          <div className="w-full bg-[#18181b] border-l-4 border-[#FFC300] p-6 md:p-8 backdrop-blur-md rounded-r-lg shadow-[0_0_30px_rgba(255,195,0,0.15)]">
            <h1 className="text-4xl md:text-6xl font-black text-[#FFC300] uppercase leading-tight mb-6 drop-shadow-md tracking-tight italic text-center md:text-left">
              Професійний Шиномонтаж<br/><span className="text-white">в Синельникове (24/7)</span>
            </h1>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4 w-full">
                <div className="relative flex-grow">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={24} />
                    <input 
                      type="tel" 
                      placeholder="Ваш номер (099...)" 
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setError('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && startBooking()}
                      className={`w-full h-full bg-black/50 border ${error ? 'border-red-500' : 'border-zinc-700'} text-white p-4 pl-12 rounded-xl text-xl outline-none focus:border-[#FFC300] transition-colors`}
                    />
                </div>
                <button 
                  onClick={startBooking}
                  className="bg-[#FFC300] hover:bg-[#e6b000] text-black font-black text-xl px-10 py-5 rounded-xl transition-transform active:scale-95 shadow-lg shadow-yellow-900/20 whitespace-nowrap flex-grow md:flex-grow-0"
                >
                  ЗАПИСАТИСЯ ЗАРАЗ
                </button>
              </div>
              
              {/* CHANGE BOOKING BUTTON */}
              <div className="flex justify-center md:justify-start">
                 <button 
                   onClick={() => setShowWizard(true)}
                   className="text-zinc-400 hover:text-white text-sm font-bold flex items-center gap-2 transition-colors border-b border-transparent hover:border-zinc-500 pb-0.5"
                 >
                   <CalendarDays size={16} /> Вже маєте запис? Змінити / Скасувати
                 </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-500 text-base font-bold animate-in slide-in-from-left-2">
                  <AlertCircle size={18} /> {error}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment Block */}
            <div className="bg-zinc-800/60 backdrop-blur-md border border-zinc-700 p-5 rounded-xl flex items-center gap-4 hover:border-[#FFC300] transition-colors group">
              <div className="p-3 bg-zinc-900 rounded-full group-hover:bg-[#FFC300] transition-colors">
                <CreditCard className="text-[#FFC300] w-8 h-8 group-hover:text-black transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-white uppercase group-hover:text-[#FFC300] transition-colors">
                Розрахунок карткою
                <span className="block text-sm font-normal text-zinc-400 normal-case mt-1">(термінал працює)</span>
              </h3>
            </div>

            {/* Change Block */}
            <div className="bg-zinc-800/60 backdrop-blur-md border border-zinc-700 p-5 rounded-xl flex items-center gap-4 hover:border-[#FFC300] transition-colors group">
              <div className="p-3 bg-zinc-900 rounded-full group-hover:bg-[#FFC300] transition-colors">
                <Coins className="text-[#FFC300] w-8 h-8 group-hover:text-black transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-white uppercase group-hover:text-[#FFC300] transition-colors">
                Завжди маємо здачу
              </h3>
            </div>
            
            {/* Fixed Prices */}
            <div className="bg-zinc-800/60 backdrop-blur-md border border-zinc-700 p-5 rounded-xl flex items-center gap-4 hover:border-[#FFC300] transition-colors group">
              <div className="p-3 bg-zinc-900 rounded-full group-hover:bg-[#FFC300] transition-colors">
                <ShieldCheck className="text-[#FFC300] w-8 h-8 group-hover:text-black transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-white uppercase group-hover:text-[#FFC300] transition-colors">
                Фіксовані ціни
                <span className="block text-sm font-normal text-zinc-400 normal-case mt-1">(на всі послуги)</span>
              </h3>
            </div>

            {/* Comfort Block */}
            <div className="bg-zinc-800/60 backdrop-blur-md border border-zinc-700 p-5 rounded-xl flex items-center gap-4 hover:border-[#FFC300] transition-colors group">
              <div className="p-3 bg-zinc-900 rounded-full group-hover:bg-[#FFC300] transition-colors">
                <Coffee className="text-[#FFC300] w-8 h-8 group-hover:text-black transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-white uppercase group-hover:text-[#FFC300] transition-colors">
                Гаряча кава та чай
                <span className="block text-sm font-normal text-zinc-400 normal-case mt-1">(холодні напої)</span>
              </h3>
            </div>
          </div>

          {/* HOT DEALS SLIDER */}
          {hotTyres.length > 0 && (
            <div className="mt-8">
               <div className="flex items-center gap-3 mb-4 pl-1">
                  <Flame className="text-orange-500 fill-orange-500 animate-pulse" size={28} />
                  <h2 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-wide">
                     Гарячі Пропозиції
                  </h2>
               </div>
               
               <div className="relative group">
                  {/* Left Arrow (Desktop Only) */}
                  <button 
                    onClick={scrollLeft} 
                    className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-black/80 rounded-full border border-zinc-700 items-center justify-center text-white hover:bg-[#FFC300] hover:text-black hover:border-[#FFC300] transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 -translate-x-1/2 duration-300"
                  >
                     <ChevronLeft size={28} />
                  </button>

                  {/* Right Arrow (Desktop Only) */}
                  <button 
                    onClick={scrollRight} 
                    className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-black/80 rounded-full border border-zinc-700 items-center justify-center text-white hover:bg-[#FFC300] hover:text-black hover:border-[#FFC300] transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 translate-x-1/2 duration-300"
                  >
                     <ChevronRight size={28} />
                  </button>

                  <div 
                      ref={scrollRef}
                      onWheel={handleScroll}
                      className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory cursor-grab active:cursor-grabbing px-1"
                      style={{ scrollBehavior: 'smooth' }}
                  >
                      {hotTyres.map((tyre) => (
                        <div 
                          key={tyre.id} 
                          onClick={() => onShopRedirect(tyre)}
                          className="flex-shrink-0 w-[33%] md:w-[20%] min-w-[140px] bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-[#FFC300] transition-all snap-start group/card relative cursor-pointer hover:shadow-lg hover:shadow-yellow-900/10"
                        >
                            <div className="aspect-square bg-black relative">
                              {tyre.image_url ? (
                                  <img src={tyre.image_url} alt={tyre.title} className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500" />
                              ) : (
                                  <div className="w-full h-full flex items-center justify-center text-zinc-700">
                                    <ShoppingBag size={24} />
                                  </div>
                              )}
                              <div className="absolute top-2 left-2 bg-orange-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase">
                                  HOT
                              </div>
                            </div>
                            <div className="p-3">
                              <div className="h-9 mb-1 overflow-hidden">
                                  <h4 className="text-xs font-bold text-white leading-tight line-clamp-2">{tyre.title}</h4>
                              </div>
                              <div className="flex justify-between items-end mt-2">
                                  <span className="text-[#FFC300] font-black text-sm">{tyre.price} <span className="text-[10px] text-zinc-500 font-normal">грн</span></span>
                                  <div className="bg-zinc-800 p-1.5 rounded-lg text-zinc-400 group-hover/card:bg-[#FFC300] group-hover/card:text-black transition-colors">
                                    <ChevronRight size={14} />
                                  </div>
                              </div>
                            </div>
                        </div>
                      ))}
                  </div>
               </div>
            </div>
          )}

        </div>
      </div>

      {showWizard && <BookingWizard initialPhone={phone} onClose={() => setShowWizard(false)} />}
    </div>
  );
};

export default Hero;
