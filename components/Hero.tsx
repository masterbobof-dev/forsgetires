
import React, { useState, useEffect, useRef } from 'react';
import { Phone, Flame, ChevronRight, ChevronLeft, ShoppingBag, ArrowRight } from 'lucide-react';
import { HERO_BG_IMAGE, PHONE_NUMBER_1 } from '../constants';
import BookingWizard from './BookingWizard';
import { supabase } from '../supabaseClient';
import { TyreProduct } from '../types';

interface HeroProps {
  onShopRedirect: (category: string, tyre?: TyreProduct) => void;
}

const safeParsePrice = (val: string | undefined | null): number => {
    if (!val) return 0;
    const clean = String(val).replace(/,/g, '.').replace(/[^\d.]/g, '');
    return parseFloat(clean) || 0;
};

const formatPrice = (priceStr: string | undefined) => {
  if (!priceStr) return '0';
  const num = safeParsePrice(priceStr);
  return num ? Math.round(num).toString() : priceStr;
};

const Hero: React.FC<HeroProps> = ({ onShopRedirect }) => {
  const [phone, setPhone] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [hotTyres, setHotTyres] = useState<TyreProduct[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [promos, setPromos] = useState<any[]>([]);
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const [heroText, setHeroText] = useState({ title: 'ЦІЛОДОБОВИЙ ШИНОМОНТАЖ', subtitle: 'В М. СИНЕЛЬНИКОВЕ (24/7)' });

  useEffect(() => {
    const fetchData = async () => {
      const { data: lightTyres } = await supabase
        .from('tyres')
        .select('*')
        .eq('is_hot', true)
        .neq('in_stock', false)
        .limit(12);
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
      else if (promo.link === 'phone') window.location.href = `tel:${PHONE_NUMBER_1}`;
      else if (promo.link && (promo.link.startsWith('http') || promo.link.startsWith('/'))) {
          window.location.href = promo.link;
      }
  };

  const nextPromo = () => {
    if (promos.length > 1) {
      setCurrentPromoIndex((prev) => (prev + 1) % promos.length);
    }
  };

  const prevPromo = () => {
    if (promos.length > 1) {
      setCurrentPromoIndex((prev) => (prev - 1 + promos.length) % promos.length);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  const currentPromo = promos[currentPromoIndex];

  return (
    <section className="relative w-full overflow-hidden pb-12">
      <div className="absolute inset-0 z-0 h-[120vh]">
        <img
          src={HERO_BG_IMAGE}
          alt="Шиномонтаж Форсаж Синельникове"
          className="w-full h-full object-cover object-center opacity-50"
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/70 to-[#09090b]"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8 md:py-20 flex flex-col gap-12">
        {/* PROMO SLIDER */}
        {promos.length > 0 && currentPromo && (
            <div className="relative group/carousel">
                <div 
                  onClick={() => handlePromoClick(currentPromo)} 
                  className={`w-full rounded-3xl p-6 md:p-12 text-white shadow-2xl relative overflow-hidden cursor-pointer transition-all duration-500 min-h-[350px] md:min-h-[450px] flex items-center ${currentPromo.color}`}
                >
                    {/* 1. CUSTOM BACKGROUND IMAGE LAYER */}
                    {currentPromo.backgroundImage && (
                        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                            <img 
                                src={currentPromo.backgroundImage} 
                                className="w-full h-full transition-opacity duration-300"
                                style={{ 
                                    opacity: (currentPromo.backgroundConfig?.opacity ?? 100) / 100,
                                    objectPosition: `center ${currentPromo.backgroundConfig?.positionY ?? 50}%`,
                                    objectFit: currentPromo.backgroundConfig?.objectFit || 'cover',
                                    transform: `scale(${(currentPromo.backgroundConfig?.scale || 100) / 100})`
                                }}
                                alt=""
                            />
                            <div 
                                className="absolute inset-0 bg-black transition-opacity duration-300"
                                style={{ opacity: (currentPromo.backgroundConfig?.overlayOpacity ?? 40) / 100 }}
                            ></div>
                        </div>
                    )}

                    {/* 2. PATTERN LAYER */}
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

                    <div className="relative z-20 flex flex-col md:flex-row items-center justify-between gap-8 w-full">
                        <div className="flex-grow text-center md:text-left z-20 max-w-2xl">
                            <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-md border border-[#FFC300]/50 text-[#FFC300] px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest mb-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#FFC300] animate-pulse"></div>
                                АКЦІЯ
                            </div>
                            <h2 className="text-3xl md:text-6xl font-black uppercase italic leading-tight mb-4 text-white drop-shadow-2xl">{currentPromo.title}</h2>
                            <div className="pl-4 border-l-2 border-[#FFC300] mb-8 hidden md:block">
                                <p className="text-base md:text-xl font-medium text-zinc-300">{currentPromo.text}</p>
                            </div>
                            <p className="text-base font-medium text-zinc-300 mb-6 md:hidden">{currentPromo.text}</p>
                            
                            <button 
                              onClick={(e) => { e.stopPropagation(); handlePromoClick(currentPromo); }}
                              className="w-full md:w-auto bg-[#FFC300] text-black font-black text-sm md:text-base px-10 py-4 rounded-xl uppercase tracking-widest active:scale-95 flex items-center justify-center gap-3 mx-auto md:mx-0 hover:bg-[#e6b000] transition-all shadow-lg shadow-yellow-900/20"
                            >
                                {currentPromo.buttonText} <ChevronRight size={20}/>
                            </button>
                        </div>

                        {/* PRODUCT IMAGE COMPONENT */}
                        <div className="absolute right-0 top-0 bottom-0 w-1/2 h-full z-10 pointer-events-none hidden md:flex items-center justify-center">
                            {currentPromo.image_url && (
                                <div 
                                    className="relative w-full h-full flex items-center justify-center"
                                    style={{
                                        transform: `scale(${(currentPromo.imageConfig?.scale || 100) / 100}) translate(${currentPromo.imageConfig?.xOffset || 0}px, ${currentPromo.imageConfig?.yOffset || 0}px)`,
                                        opacity: (currentPromo.imageConfig?.opacity || 100) / 100
                                    }}
                                >
                                    {currentPromo.imageConfig?.glow && (
                                        <div 
                                            className="absolute inset-0 bg-[#FFC300]/30 blur-[80px] rounded-full scale-90 pointer-events-none"
                                            style={{ mixBlendMode: 'screen' }}
                                        ></div>
                                    )}
                                    
                                    <img 
                                        src={currentPromo.image_url} 
                                        className={`
                                            max-w-none max-h-none object-contain relative z-10
                                            ${currentPromo.imageConfig?.shadow ? 'drop-shadow-[0_25px_50px_rgba(0,0,0,0.8)]' : ''}
                                        `}
                                        style={{
                                            height: '100%',
                                            maskImage: currentPromo.imageConfig?.vignette ? (
                                                currentPromo.imageConfig.maskType === 'linear' 
                                                ? `linear-gradient(to ${currentPromo.imageConfig.maskDirection || 'right'}, black 0%, black ${Math.max(0, 50 - ((currentPromo.imageConfig.vignetteStrength || 30) / 2))}%, transparent 100%)`
                                                : `radial-gradient(circle at center, black ${Math.max(0, 95 - (currentPromo.imageConfig.vignetteStrength || 30))}%, transparent 100%)`
                                            ) : 'none',
                                            WebkitMaskImage: currentPromo.imageConfig?.vignette ? (
                                                currentPromo.imageConfig.maskType === 'linear' 
                                                ? `linear-gradient(to ${currentPromo.imageConfig.maskDirection || 'right'}, black 0%, black ${Math.max(0, 50 - ((currentPromo.imageConfig.vignetteStrength || 30) / 2))}%, transparent 100%)`
                                                : `radial-gradient(circle at center, black ${Math.max(0, 95 - (currentPromo.imageConfig.vignetteStrength || 30))}%, transparent 100%)`
                                            ) : 'none'
                                        }}
                                        alt="Promo" 
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* SLIDER CONTROLS */}
                {promos.length > 1 && (
                  <>
                    <button 
                      onClick={(e) => { e.stopPropagation(); prevPromo(); }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-sm opacity-0 group-hover/carousel:opacity-100 transition-opacity"
                    >
                      <ChevronLeft size={24}/>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); nextPromo(); }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-sm opacity-0 group-hover/carousel:opacity-100 transition-opacity"
                    >
                      <ChevronRight size={24}/>
                    </button>
                    
                    {/* DOTS */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-2">
                      {promos.map((_, idx) => (
                        <button 
                          key={idx}
                          onClick={(e) => { e.stopPropagation(); setCurrentPromoIndex(idx); }}
                          className={`w-2 h-2 rounded-full transition-all ${idx === currentPromoIndex ? 'bg-[#FFC300] w-6' : 'bg-white/30'}`}
                        />
                      ))}
                    </div>
                  </>
                )}
            </div>
        )}

        {/* HERO TITLE & BOOKING */}
        <div className="w-full bg-[#18181b]/80 border-l-4 border-[#FFC300] p-6 md:p-10 backdrop-blur-md rounded-r-2xl shadow-2xl">
          <h1 className="text-3xl md:text-6xl font-black text-[#FFC300] uppercase leading-tight mb-8 tracking-tight italic text-center md:text-left">
            {heroText.title}<br/><span className="text-white">{heroText.subtitle}</span>
          </h1>
          <div className="flex flex-col md:flex-row gap-4 w-full">
            <div className="relative flex-grow">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={24} />
                <input type="tel" placeholder="Ваш номер (099...)" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-black/50 border border-zinc-700 text-white p-5 pl-14 rounded-2xl text-xl outline-none focus:border-[#FFC300] transition-colors" />
            </div>
            <button onClick={() => setShowWizard(true)} className="bg-[#FFC300] hover:bg-[#e6b000] text-black font-black text-2xl px-12 py-5 rounded-2xl active:scale-95 shadow-lg shadow-yellow-900/20 whitespace-nowrap transition-all uppercase tracking-wider">ЗАПИСАТИСЯ</button>
          </div>
        </div>

        {/* HOT TYRES SECTION - FIXED VISIBILITY & ALIGNMENT */}
        {hotTyres.length > 0 && (
          <div className="space-y-6">
            <div className="flex justify-between items-end px-2">
               <div>
                  <h2 className="text-[#FFC300] font-black text-2xl md:text-3xl flex items-center gap-2 uppercase italic">
                    <Flame size={28} className="animate-pulse text-orange-500" fill="currentColor" /> HOT ПРОПОЗИЦІЇ
                  </h2>
                  <p className="text-zinc-400 text-sm md:text-base font-bold">Найкращі ціни на шини та диски</p>
               </div>
               <div className="hidden md:flex gap-2">
                  <button onClick={() => scroll('left')} className="p-3 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"><ChevronLeft size={24}/></button>
                  <button onClick={() => scroll('right')} className="p-3 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"><ChevronRight size={24}/></button>
               </div>
            </div>

            <div 
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto pb-8 scrollbar-hide snap-x px-2 items-stretch"
            >
              {hotTyres.map((tyre) => {
                const price = safeParsePrice(tyre.price);
                const oldPrice = safeParsePrice(tyre.old_price);
                const hasDiscount = oldPrice > price;

                return (
                  <div 
                    key={tyre.id} 
                    onClick={() => onShopRedirect('all', tyre)}
                    className="flex-shrink-0 w-[280px] min-h-[420px] bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden cursor-pointer hover:border-[#FFC300] transition-all group snap-start shadow-xl flex flex-col"
                  >
                    <div className="h-48 bg-black relative flex-shrink-0">
                       {tyre.image_url ? (
                         <img src={tyre.image_url} alt={tyre.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center text-zinc-800 italic font-black text-4xl">NO PHOTO</div>
                       )}
                       <div className="absolute top-3 left-3 flex flex-col gap-2">
                          <div className="bg-orange-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-lg uppercase flex items-center gap-1"><Flame size={12} fill="white"/> HOT</div>
                          {hasDiscount && <div className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-lg uppercase italic">SALE</div>}
                       </div>
                    </div>
                    
                    <div className="p-4 flex flex-col flex-grow">
                       <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">{tyre.manufacturer || 'Шина'}</span>
                       {/* Fixed min-height for title to prevent price jumps */}
                       <h3 className="text-white font-bold text-sm md:text-base line-clamp-2 group-hover:text-[#FFC300] transition-colors leading-tight mb-2 min-h-[2.5rem]">
                         {tyre.title}
                       </h3>
                       
                       <div className="mt-auto pt-3 border-t border-zinc-800/50 flex items-end justify-between">
                          <div className="flex flex-col">
                             {hasDiscount && (
                               <span className="text-white opacity-70 text-xs font-bold line-through mb-0.5">
                                 {formatPrice(tyre.old_price)} грн
                               </span>
                             )}
                             <span className="text-[#FFC300] text-2xl font-black leading-none">
                               {formatPrice(tyre.price)}
                               <span className="text-xs font-bold text-zinc-400 ml-1 uppercase">грн</span>
                             </span>
                          </div>
                          <div className="bg-zinc-800 p-2.5 rounded-xl text-[#FFC300] group-hover:bg-[#FFC300] group-hover:text-black transition-all shadow-lg">
                             <ArrowRight size={20}/>
                          </div>
                       </div>
                    </div>
                  </div>
                );
              })}
              
              {/* SEE ALL CARD */}
              <div 
                onClick={() => onShopRedirect('all')}
                className="flex-shrink-0 w-[200px] min-h-[420px] bg-zinc-900 border border-zinc-800 border-dashed rounded-2xl flex flex-col items-center justify-center text-center gap-4 cursor-pointer hover:bg-zinc-800 transition-all snap-start"
              >
                 <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center text-[#FFC300]">
                    <ShoppingBag size={32}/>
                 </div>
                 <span className="text-white font-black uppercase text-sm px-4">Переглянути весь каталог</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {showWizard && <BookingWizard initialPhone={phone} onClose={() => setShowWizard(false)} />}
    </section>
  );
};

export default Hero;
