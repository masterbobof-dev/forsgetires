
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

// Helper to safely parse messy price strings
const safeParsePrice = (val: string | undefined | null): number => {
    if (!val) return 0;
    const clean = String(val).replace(/,/g, '.').replace(/[^\d.]/g, '');
    return parseFloat(clean) || 0;
};

const Hero: React.FC<HeroProps> = ({ onShopRedirect }) => {
  const [phone, setPhone] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [error, setError] = useState('');
  
  // Hot Products State (Cars/SUV/Cargo)
  const [hotTyres, setHotTyres] = useState<TyreProduct[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hot Products State (Truck/Agro)
  const [hotTruckTyres, setHotTruckTyres] = useState<TyreProduct[]>([]);
  const scrollRefTruck = useRef<HTMLDivElement>(null);

  // Promo Banners State (Array)
  const [promos, setPromos] = useState<any[]>([]);
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);

  // Dynamic Text & Contacts
  const [heroText, setHeroText] = useState({
      title: 'ЦІЛОДОБОВИЙ ШИНОМОНТАЖ',
      subtitle: 'В М. СИНЕЛЬНИКОВЕ (24/7)'
  });
  const [contacts, setContacts] = useState({
      p1: PHONE_NUMBER_1,
      p2: PHONE_NUMBER_2,
      link1: PHONE_LINK_1,
      link2: PHONE_LINK_2,
      address: 'м. Синельникове, вул. Квітнева 9'
  });

  useEffect(() => {
    const fetchData = async () => {
      // 1. Fetch Hot Tyres (Light Vehicles: Car, SUV, Cargo)
      const { data: lightTyres } = await supabase
        .from('tyres')
        .select('*')
        .eq('is_hot', true)
        .in('vehicle_type', ['car', 'suv', 'cargo']) // Filter for light vehicles
        .order('created_at', { ascending: false })
        .limit(10);
      if (lightTyres) setHotTyres(lightTyres);

      // 2. Fetch Hot Tyres (Heavy Vehicles: Truck, Agro)
      const { data: heavyTyres } = await supabase
        .from('tyres')
        .select('*')
        .eq('is_hot', true)
        .in('vehicle_type', ['truck', 'agro']) // Filter for heavy vehicles
        .order('created_at', { ascending: false })
        .limit(10);
      if (heavyTyres) setHotTruckTyres(heavyTyres);

      // 3. Fetch Promo Data & Settings
      const { data: settingsData } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['promo_data', 'hero_title', 'hero_subtitle', 'contact_phone1', 'contact_phone2', 'contact_address']);
        
      if (settingsData) {
          settingsData.forEach(item => {
              if (item.key === 'promo_data' && item.value) {
                  try {
                     const p = JSON.parse(item.value);
                     let loadedPromos = [];
                     if (Array.isArray(p)) {
                         loadedPromos = p.filter((item: any) => item.active);
                     } else if (p.active) {
                         loadedPromos = [p];
                     }
                     setPromos(loadedPromos);
                  } catch (e) { console.error(e); }
              }
              if (item.key === 'hero_title' && item.value) setHeroText(prev => ({ ...prev, title: item.value }));
              if (item.key === 'hero_subtitle' && item.value) setHeroText(prev => ({ ...prev, subtitle: item.value }));
              
              if (item.key === 'contact_phone1') setContacts(prev => ({ ...prev, p1: item.value, link1: `tel:${item.value.replace(/[^\d+]/g,'')}` }));
              if (item.key === 'contact_phone2') setContacts(prev => ({ ...prev, p2: item.value, link2: `tel:${item.value.replace(/[^\d+]/g,'')}` }));
              if (item.key === 'contact_address') setContacts(prev => ({ ...prev, address: item.value }));
          });
      }
    };
    fetchData();
  }, []);

  // Auto-slide carousel
  useEffect(() => {
      if (promos.length <= 1) return;
      const interval = setInterval(() => {
          setCurrentPromoIndex(prev => (prev + 1) % promos.length);
      }, 5000); 
      return () => clearInterval(interval);
  }, [promos.length]);

  const nextPromo = (e: React.MouseEvent) => {
      e.stopPropagation();
      setCurrentPromoIndex(prev => (prev + 1) % promos.length);
  };

  const prevPromo = (e: React.MouseEvent) => {
      e.stopPropagation();
      setCurrentPromoIndex(prev => (prev - 1 + promos.length) % promos.length);
  };

  const handlePromoClick = (promo: any) => {
      if (!promo) return;
      if (promo.link === 'shop') {
          onShopRedirect('all'); 
      } else if (promo.link === 'booking') {
          setShowWizard(true);
      } else if (promo.link === 'phone') {
          window.location.href = contacts.link1;
      }
  };

  const startBooking = () => {
    if (phone.length < 9) {
      setError('Введіть коректний номер (мін. 9 цифр)');
      return;
    }
    setError('');
    setShowWizard(true);
  };

  // Scroll Handlers for Light Tyres
  const handleScroll = (e: React.WheelEvent) => {
    if (scrollRef.current) {
      if (e.deltaY !== 0) {
         scrollRef.current.scrollLeft += e.deltaY;
      }
    }
  };
  const scrollLeft = () => { if (scrollRef.current) scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' }); };
  const scrollRight = () => { if (scrollRef.current) scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' }); };

  // Scroll Handlers for Heavy Tyres
  const handleScrollTruck = (e: React.WheelEvent) => {
    if (scrollRefTruck.current) {
      if (e.deltaY !== 0) {
         scrollRefTruck.current.scrollLeft += e.deltaY;
      }
    }
  };
  const scrollLeftTruck = () => { if (scrollRefTruck.current) scrollRefTruck.current.scrollBy({ left: -300, behavior: 'smooth' }); };
  const scrollRightTruck = () => { if (scrollRefTruck.current) scrollRefTruck.current.scrollBy({ left: 300, behavior: 'smooth' }); };

  // Current active promo
  const currentPromo = promos.length > 0 ? promos[currentPromoIndex] : null;
  const imgConfig = { ...DEFAULT_IMG_CONFIG, ...(currentPromo?.imageConfig || {}) };
  const bgConfig = { ...DEFAULT_BG_CONFIG, ...(currentPromo?.backgroundConfig || {}) };

  // Calculate Mask for Soft Vignette
  let maskImageStyle: React.CSSProperties = {};
  if (imgConfig.vignette) {
      if (imgConfig.maskType === 'linear') {
          const fadeStart = Math.max(0, 50 - (imgConfig.vignetteStrength / 2)); 
          const direction = imgConfig.maskDirection || 'right';
          const val = `linear-gradient(to ${direction}, black 0%, black ${fadeStart}%, transparent 100%)`;
          maskImageStyle = { maskImage: val, WebkitMaskImage: val };
      } else {
          const maskStop = Math.max(0, 95 - imgConfig.vignetteStrength);
          const val = `radial-gradient(circle at center, black ${maskStop}%, transparent 100%)`;
          maskImageStyle = { maskImage: val, WebkitMaskImage: val };
      }
  }

  // Helper to render a card
  const ProductCard: React.FC<{ tyre: TyreProduct, category: string }> = ({ tyre, category }) => {
      const priceNum = safeParsePrice(tyre.price);
      const oldPriceNum = safeParsePrice(tyre.old_price);
      const hasDiscount = oldPriceNum > 0 && oldPriceNum > priceNum;
      
      return (
        <div 
          onClick={() => onShopRedirect(category, tyre)}
          className="flex-shrink-0 w-[45%] md:w-[20%] min-w-[140px] bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-[#FFC300] transition-all snap-start group/card relative cursor-pointer hover:shadow-lg hover:shadow-yellow-900/10"
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
              <div className="flex flex-col justify-end mt-2 min-h-[40px]">
                  {hasDiscount ? (
                    <div className="flex flex-col items-start leading-none relative">
                        <div className="absolute -top-3 left-0 bg-red-600 text-white text-[9px] px-1 rounded transform -rotate-2">
                           SALE
                        </div>
                        {/* UPDATED: Yellow text for old price, standard red line-through */}
                        <span className="text-[#FFC300] text-[11px] line-through decoration-red-500/80 mb-0.5 ml-8">
                            {Math.round(oldPriceNum)}
                        </span>
                        {/* UPDATED: Slightly larger new price */}
                        <span className="font-black text-base md:text-lg text-red-500">
                            {Math.round(priceNum)} <span className="text-[10px] text-zinc-500 font-normal">грн</span>
                        </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-start leading-none pt-2">
                        <span className="font-black text-sm text-[#FFC300]">
                            {Math.round(priceNum)} <span className="text-[10px] text-zinc-500 font-normal">грн</span>
                        </span>
                    </div>
                  )}
              </div>
            </div>
        </div>
      );
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
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8 md:py-20 flex flex-col gap-8">
        
        {/* PROMO CAROUSEL */}
        {currentPromo && (
            <div className="relative group/carousel">
                <div 
                    onClick={() => handlePromoClick(currentPromo)}
                    className={`w-full rounded-3xl p-6 md:p-12 text-white shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden cursor-pointer transition-all duration-500 ${currentPromo.color}`}
                >
                    {/* CUSTOM BACKGROUND IMAGE LAYER */}
                    {currentPromo.backgroundImage && (
                        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                            <img 
                                src={currentPromo.backgroundImage} 
                                className="w-full h-full object-cover transition-opacity duration-300"
                                style={{ 
                                    opacity: (bgConfig.opacity ?? 100) / 100,
                                    objectPosition: `center ${bgConfig.positionY ?? 50}%`
                                }}
                                alt=""
                            />
                            {/* Dark Overlay for readability */}
                            <div 
                                className="absolute inset-0 bg-black transition-opacity duration-300"
                                style={{ opacity: (bgConfig.overlayOpacity ?? 40) / 100 }}
                            ></div>
                        </div>
                    )}

                    {/* PATTERN OVERLAY */}
                    {currentPromo.pattern && currentPromo.pattern !== 'none' && (
                        <div 
                            className="absolute inset-0 z-0 pointer-events-none"
                            style={{ 
                                backgroundImage: currentPromo.pattern,
                                opacity: (currentPromo.patternOpacity || 10) / 100,
                                backgroundSize: 'auto',
                                backgroundRepeat: 'repeat',
                                mixBlendMode: 'screen'
                            }}
                        ></div>
                    )}

                    <div className="relative z-20 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12 min-h-[300px]">
                        
                        {/* TEXT CONTENT */}
                        <div className="flex-grow text-center md:text-left z-20 max-w-2xl relative">
                            
                             {/* Modern Badge */}
                            <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-md border border-[#FFC300]/50 text-[#FFC300] px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest mb-4 md:mb-6 shadow-[0_0_15px_rgba(255,195,0,0.2)] justify-center md:justify-start">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#FFC300] animate-pulse"></div>
                                АКЦІЯ
                            </div>
                            
                            {/* Mobile-optimized typography */}
                            <h3 className="text-3xl md:text-6xl font-black uppercase italic leading-tight mb-4 md:mb-6 drop-shadow-xl tracking-tighter break-words text-white">
                                {currentPromo.title}
                            </h3>
                            
                            <div className="md:pl-4 md:border-l-2 md:border-[#FFC300] mb-6 md:mb-8 inline-block text-center md:text-left w-full md:w-auto">
                                <p className="text-base md:text-xl font-medium text-zinc-300 leading-snug drop-shadow-md">
                                    {currentPromo.text}
                                </p>
                            </div>

                            <button className="w-full md:w-auto bg-[#FFC300] text-black font-black text-sm md:text-base px-10 py-4 rounded-xl hover:scale-105 transition-transform uppercase tracking-widest shadow-[0_0_20px_rgba(255,195,0,0.4)] active:scale-95 flex items-center justify-center md:justify-start gap-3 mx-auto md:mx-0 group/btn">
                                {currentPromo.buttonText}
                                <ChevronRight size={20} className="group-hover/btn:translate-x-1 transition-transform"/>
                            </button>
                        </div>
                        
                        {/* Custom Image or Fallback Icon */}
                        <div className="absolute right-0 top-0 bottom-0 w-full md:w-1/2 h-full z-10 pointer-events-none opacity-30 md:opacity-100 flex items-center justify-center">
                             {currentPromo.image_url ? (
                                 <div
                                    className="relative w-full h-full flex items-center justify-center transition-transform duration-700"
                                    style={{
                                        transform: `scale(${imgConfig.scale / 100}) translate(${imgConfig.xOffset}px, ${imgConfig.yOffset}px)`,
                                        opacity: (imgConfig.opacity || 100) / 100
                                    }}
                                 >
                                     {imgConfig.glow && (
                                         <div className="absolute inset-0 bg-[#FFC300]/30 blur-[80px] rounded-full scale-90 pointer-events-none mix-blend-screen"></div>
                                     )}
                                     <img 
                                        src={currentPromo.image_url} 
                                        alt="Promo" 
                                        className={`
                                            max-w-none max-h-none object-contain relative z-10
                                            ${imgConfig.shadow ? 'drop-shadow-[0_25px_50px_rgba(0,0,0,0.8)]' : ''}
                                        `}
                                        style={{
                                            height: '100%',
                                            ...maskImageStyle
                                        }}
                                     />
                                 </div>
                             ) : (
                                <Megaphone size={200} className="text-white/5 -rotate-12" />
                             )}
                        </div>
                    </div>
                </div>

                {/* Carousel Controls (Only if > 1) */}
                {promos.length > 1 && (
                    <>
                        <button 
                            onClick={prevPromo}
                            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 md:-translate-x-6 w-10 h-10 md:w-12 md:h-12 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center backdrop-blur-sm border border-white/10 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300 z-30"
                        >
                            <ChevronLeft size={24}/>
                        </button>
                        <button 
                            onClick={nextPromo}
                            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 md:translate-x-6 w-10 h-10 md:w-12 md:h-12 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center backdrop-blur-sm border border-white/10 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300 z-30"
                        >
                            <ChevronRight size={24}/>
                        </button>
                        {/* Dots */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-30">
                            {promos.map((_, idx) => (
                                <div 
                                    key={idx} 
                                    className={`w-2 h-2 rounded-full transition-all ${idx === currentPromoIndex ? 'bg-white w-6' : 'bg-white/40'}`}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        )}

        <div className="space-y-6">
          
          {/* ADDRESS & PHONES BLOCK - Centered on Mobile */}
          <div className="flex flex-col md:flex-row w-full gap-4 md:gap-8 items-center md:items-center justify-between bg-black/40 p-5 rounded-xl border border-white/10 backdrop-blur-sm mt-4 text-center md:text-left">
             <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 text-zinc-200">
                <MapPin className="text-[#FFC300] shrink-0" size={28} />
                <span className="text-base md:text-xl font-bold leading-tight">
                  {contacts.address}
                </span>
             </div>
             
             <div className="hidden md:block h-8 w-px bg-white/10"></div>

             <div className="flex flex-col sm:flex-row gap-3 sm:gap-8 w-full md:w-auto justify-center">
                <a href={contacts.link1} className="flex items-center justify-center gap-2 font-bold text-lg md:text-xl text-white hover:text-[#FFC300] transition-colors">
                   <Phone className="text-[#FFC300]" size={20} />
                   {contacts.p1}
                </a>
                <a href={contacts.link2} className="flex items-center justify-center gap-2 font-bold text-lg md:text-xl text-white hover:text-[#FFC300] transition-colors">
                   <Phone className="text-[#FFC300]" size={20} />
                   {contacts.p2}
                </a>
             </div>
          </div>

          {/* ONLINE BOOKING BLOCK */}
          <div className="w-full bg-[#18181b] border-l-4 border-[#FFC300] p-6 md:p-8 backdrop-blur-md rounded-r-lg shadow-[0_0_30px_rgba(255,195,0,0.15)]">
            <h1 className="text-3xl md:text-6xl font-black text-[#FFC300] uppercase leading-tight mb-6 drop-shadow-md tracking-tight italic text-center md:text-left">
              {heroText.title}<br/><span className="text-white">{heroText.subtitle}</span>
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
                      // Increased font size on mobile to prevent iOS zoom
                      className={`w-full h-full bg-black/50 border ${error ? 'border-red-500' : 'border-zinc-700'} text-white p-4 pl-12 rounded-xl text-base md:text-xl outline-none focus:border-[#FFC300] transition-colors`}
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

          {/* --- SLIDER 1: LIGHT VEHICLES --- */}
          {hotTyres.length > 0 && (
            <div className="mt-8">
               <div className="flex items-center justify-between gap-3 mb-4 pl-1">
                  <div className="flex items-center gap-3">
                      <Flame className="text-orange-500 fill-orange-500 animate-pulse" size={28} />
                      <h2 className="text-xl md:text-3xl font-black text-white italic uppercase tracking-wide">
                         Гарячі Пропозиції
                      </h2>
                  </div>
                  <button onClick={() => onShopRedirect('hot_light')} className="text-sm text-zinc-400 hover:text-[#FFC300] font-bold uppercase flex items-center gap-1">Дивитися всі <ArrowRight size={14}/></button>
               </div>
               
               <div className="relative group">
                  {/* Left Arrow (Desktop Only) */}
                  <button onClick={scrollLeft} className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-black/80 rounded-full border border-zinc-700 items-center justify-center text-white hover:bg-[#FFC300] hover:text-black hover:border-[#FFC300] transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 -translate-x-1/2 duration-300">
                     <ChevronLeft size={28} />
                  </button>

                  {/* Right Arrow (Desktop Only) */}
                  <button onClick={scrollRight} className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-black/80 rounded-full border border-zinc-700 items-center justify-center text-white hover:bg-[#FFC300] hover:text-black hover:border-[#FFC300] transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 translate-x-1/2 duration-300">
                     <ChevronRight size={28} />
                  </button>

                  <div 
                      ref={scrollRef}
                      onWheel={handleScroll}
                      className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory cursor-grab active:cursor-grabbing px-1"
                      style={{ scrollBehavior: 'smooth' }}
                  >
                      {hotTyres.map((tyre) => (
                          <ProductCard key={tyre.id} tyre={tyre} category="hot_light" />
                      ))}
                  </div>
               </div>
            </div>
          )}

          {/* --- SLIDER 2: TRUCK & SPECIAL (NEW) --- */}
          {hotTruckTyres.length > 0 && (
            <div className="mt-8 border-t border-zinc-800 pt-8">
               <div className="flex items-center justify-between gap-3 mb-4 pl-1">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-800 rounded-lg border border-zinc-700">
                          <Truck className="text-blue-400" size={24} />
                      </div>
                      <h2 className="text-xl md:text-3xl font-black text-white italic uppercase tracking-wide">
                         Вантажні та Спецтехніка <span className="text-orange-500 not-italic">(HOT)</span>
                      </h2>
                  </div>
                  <button onClick={() => onShopRedirect('hot_heavy')} className="text-sm text-zinc-400 hover:text-[#FFC300] font-bold uppercase flex items-center gap-1">Дивитися всі <ArrowRight size={14}/></button>
               </div>
               
               <div className="relative group">
                  <button onClick={scrollLeftTruck} className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-black/80 rounded-full border border-zinc-700 items-center justify-center text-white hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 -translate-x-1/2 duration-300">
                     <ChevronLeft size={28} />
                  </button>

                  <button onClick={scrollRightTruck} className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-black/80 rounded-full border border-zinc-700 items-center justify-center text-white hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 translate-x-1/2 duration-300">
                     <ChevronRight size={28} />
                  </button>

                  <div 
                      ref={scrollRefTruck}
                      onWheel={handleScrollTruck}
                      className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory cursor-grab active:cursor-grabbing px-1"
                      style={{ scrollBehavior: 'smooth' }}
                  >
                      {hotTruckTyres.map((tyre) => (
                          <ProductCard key={tyre.id} tyre={tyre} category="hot_heavy" />
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
