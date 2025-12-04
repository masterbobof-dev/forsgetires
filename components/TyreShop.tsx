
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { TyreProduct, CartItem } from '../types';
import { ShoppingBag, Loader2, Phone, X, AlertCircle, Filter, Snowflake, Sun, CloudSun, Truck, MapPin, Check, CreditCard, Wallet, ArrowDown, ShoppingCart, Plus, Minus, Trash2, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { PHONE_LINK_1, PHONE_NUMBER_1, FORMSPREE_ENDPOINT } from '../constants';

// --- MOCK DATA FOR NOVA POSHTA IMITATION ---
const MOCK_REGIONS = [
  "Дніпропетровська обл.", "Київська обл.", "Львівська обл.", "Одеська обл.", "Харківська обл.", "Запорізька обл.", "Вінницька обл.", "Полтавська обл."
];

const MOCK_CITIES: Record<string, string[]> = {
  "Дніпропетровська обл.": ["Дніпро", "Кривий Ріг", "Кам'янське", "Нікополь", "Павлоград", "Новомосковськ", "Синельникове"],
  "Київська обл.": ["Київ", "Біла Церква", "Бровари", "Бориспіль", "Ірпінь", "Буча"],
  "Львівська обл.": ["Львів", "Дрогобич", "Червоноград", "Стрий"],
  "Одеська обл.": ["Одеса", "Ізмаїл", "Чорноморськ"],
  "Харківська обл.": ["Харків", "Лозова", "Ізюм"],
  "Запорізька обл.": ["Запоріжжя", "Мелітополь", "Бердянськ"],
  "Вінницька обл.": ["Вінниця", "Жмеринка", "Могилів-Подільський"],
  "Полтавська обл.": ["Полтава", "Кременчук", "Горішні Плавні"]
};

const getMockWarehouses = (city: string) => {
  const count = city === "Київ" || city === "Дніпро" ? 20 : 5;
  return Array.from({ length: count }, (_, i) => `Відділення №${i + 1}: вул. Центральна, ${i + 15}`);
};

const PAGE_SIZE = 60;

// Utility to format price without decimals
const formatPrice = (priceStr: string | undefined) => {
  if (!priceStr) return '0';
  const num = parseFloat(priceStr);
  return isNaN(num) ? priceStr : Math.round(num).toString();
};

const TyreShop: React.FC = () => {
  const [tyres, setTyres] = useState<TyreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentLightboxImages, setCurrentLightboxImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Filters State
  const [filterWidth, setFilterWidth] = useState('');
  const [filterHeight, setFilterHeight] = useState('');
  const [filterRadius, setFilterRadius] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [filterVehicle, setFilterVehicle] = useState(''); 

  // Order Form State
  const [orderName, setOrderName] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'newpost'>('pickup');
  const [paymentMethod, setPaymentMethod] = useState<'prepayment' | 'full'>('prepayment');
  
  // Nova Poshta Imitation State
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');

  const [orderSending, setOrderSending] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState('');

  // Swipe logic for Lightbox
  const touchStartRef = useRef<number | null>(null);
  const touchEndRef = useRef<number | null>(null);

  useEffect(() => {
    fetchTyres(0, true);
  }, []);

  const parseTyreSpecs = (tyre: TyreProduct): TyreProduct => {
    const sizeRegex = /(\d{3})[\/\s](\d{2})[\s\w]*[R|r]?(\d{2}[C|c]?)/; 
    const match = tyre.title.match(sizeRegex) || tyre.description?.match(sizeRegex);

    let width = '';
    let height = '';
    let parsedRadius = tyre.radius || '';
    let vehicle_type: 'car' | 'cargo' | 'suv' = 'car';

    if (match) {
      width = match[1];
      height = match[2];
      const rawRadius = match[3].toUpperCase();
      if (!parsedRadius) parsedRadius = `R${rawRadius}`;
      if (rawRadius.includes('C')) vehicle_type = 'cargo';
    }

    if (tyre.title.toUpperCase().includes(' R14C') || tyre.title.toUpperCase().includes(' R15C') || tyre.title.toUpperCase().includes(' R16C')) {
        vehicle_type = 'cargo';
    }

    const lowerTitle = (tyre.title + ' ' + tyre.description).toLowerCase();
    let season = 'all'; 
    if (lowerTitle.includes('зима') || lowerTitle.includes('winter') || lowerTitle.includes('snow')) season = 'winter';
    else if (lowerTitle.includes('літо') || lowerTitle.includes('summer')) season = 'summer';
    else if (lowerTitle.includes('всесезон') || lowerTitle.includes('all season')) season = 'all-season';

    return { ...tyre, width, height, radius: parsedRadius, season, vehicle_type };
  };

  const fetchTyres = async (pageIndex: number, isRefresh = false) => {
    try {
      if (isRefresh) setLoading(true);
      else setLoadingMore(true);

      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('tyres')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (error) throw error;

      if (data) {
        const processed = data.map(parseTyreSpecs);
        if (isRefresh) setTyres(processed);
        else setTyres(prev => [...prev, ...processed]);

        if (data.length < PAGE_SIZE) setHasMore(false);
        else setHasMore(true);
      }
    } catch (error) {
      console.error("Error fetching tyres:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchTyres(nextPage);
  };

  // --- CART LOGIC ---
  const addToCart = (tyre: TyreProduct) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === tyre.id);
      if (existing) {
        return prev.map(item => item.id === tyre.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...tyre, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + (parseFloat(item.price) * item.quantity), 0);
  }, [cart]);

  // --- LIGHTBOX LOGIC ---
  const openLightbox = (tyre: TyreProduct) => {
    // Combine main image and gallery
    let images: string[] = [];
    if (tyre.image_url) images.push(tyre.image_url);
    if (tyre.gallery && Array.isArray(tyre.gallery)) {
       // Filter out duplicates if main image is also in gallery
       const additional = tyre.gallery.filter(url => url !== tyre.image_url);
       images = [...images, ...additional];
    }
    
    if (images.length === 0) return; // No images to show

    setCurrentLightboxImages(images);
    setCurrentImageIndex(0);
    setLightboxOpen(true);
  };

  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentImageIndex(prev => (prev + 1) % currentLightboxImages.length);
  };

  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentImageIndex(prev => (prev - 1 + currentLightboxImages.length) % currentLightboxImages.length);
  };

  // Swipe Handlers
  const onTouchStart = (e: React.TouchEvent) => { touchStartRef.current = e.targetTouches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => { touchEndRef.current = e.targetTouches[0].clientX; };
  const onTouchEnd = () => {
    if (!touchStartRef.current || !touchEndRef.current) return;
    const distance = touchStartRef.current - touchEndRef.current;
    if (distance > 50) nextImage();
    if (distance < -50) prevImage();
    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  // --- ORDER SUBMISSION ---
  const submitOrder = async () => {
    if (!orderName || orderPhone.length < 9) {
      setOrderError("Введіть коректне ім'я та телефон");
      return;
    }
    if (deliveryMethod === 'newpost' && (!selectedCity || !selectedWarehouse)) {
        setOrderError("Оберіть місто та відділення");
        return;
    }
    if (cart.length === 0) {
      setOrderError("Кошик порожній");
      return;
    }

    setOrderSending(true);
    setOrderError('');

    try {
      // 1. Create Order in DB (Primary)
      const itemsPayload = cart.map(i => ({ id: i.id, title: i.title, quantity: i.quantity, price: i.price }));
      
      const { error } = await supabase.from('tyre_orders').insert([{
        customer_name: orderName,
        customer_phone: orderPhone,
        status: 'new',
        delivery_method: deliveryMethod,
        delivery_city: deliveryMethod === 'newpost' ? `${selectedRegion}, ${selectedCity}` : null,
        delivery_warehouse: deliveryMethod === 'newpost' ? selectedWarehouse : null,
        payment_method: deliveryMethod === 'newpost' ? paymentMethod : null,
        items: itemsPayload
      }]);

      if (error) {
         throw new Error("Помилка бази даних: " + error.message);
      }

      // 2. Email Notification (Secondary - Try Catch so it doesn't block success)
      try {
        const itemsDesc = cart.map(i => `${i.title} (${i.quantity} шт) - ${formatPrice(i.price)} грн`).join('\n');
        const formData = {
          subject: `Замовлення шин (${cart.length} поз.)`,
          customer_name: orderName,
          customer_phone: orderPhone,
          items: itemsDesc,
          total_price: `${cartTotal} грн`,
          delivery_method: deliveryMethod === 'pickup' ? "Самовивіз" : "Нова Пошта",
          delivery_address: deliveryMethod === 'pickup' ? "-" : `${selectedRegion}, ${selectedCity}, ${selectedWarehouse}`,
          payment_method: deliveryMethod === 'newpost' ? (paymentMethod === 'prepayment' ? 'Предоплата' : 'Повна оплата') : '-'
        };

        await fetch(FORMSPREE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
      } catch (emailErr) {
        console.error("Email sending failed, but order saved.", emailErr);
      }

      setOrderSuccess(true);
      setCart([]); // Clear cart
    } catch (err: any) {
      console.error(err);
      setOrderError("Помилка при створенні замовлення. Спробуйте ще раз.");
    } finally {
      setOrderSending(false);
    }
  };


  // --- FILTERING ---
  const options = useMemo(() => {
    const widths = new Set<string>();
    const heights = new Set<string>();
    const radii = new Set<string>();

    tyres.forEach(t => {
      if (t.width) widths.add(t.width);
      if (t.height) heights.add(t.height);
      if (t.radius) radii.add(t.radius);
    });

    return {
      widths: Array.from(widths).sort(),
      heights: Array.from(heights).sort(),
      radii: Array.from(radii).sort((a, b) => parseInt(a.replace(/\D/g,'')) - parseInt(b.replace(/\D/g,'')))
    };
  }, [tyres]);

  const filteredTyres = tyres.filter(t => {
    return (!filterWidth || t.width === filterWidth) &&
           (!filterHeight || t.height === filterHeight) &&
           (!filterRadius || t.radius === filterRadius) &&
           (!filterSeason || t.season === filterSeason) &&
           (!filterVehicle || t.vehicle_type === filterVehicle);
  });

  const resetFilters = () => {
    setFilterWidth(''); setFilterHeight(''); setFilterRadius(''); setFilterSeason(''); setFilterVehicle('');
  };

  return (
    <div className="min-h-screen bg-[#09090b] py-12 animate-in fade-in duration-500 pb-32">
      <div className="max-w-7xl mx-auto px-4">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
           <div>
             <h2 className="text-3xl md:text-4xl font-black text-white mb-2 border-b-2 border-[#FFC300] inline-block pb-2">Магазин Шин</h2>
             <p className="text-zinc-400">Якісні шини в наявності та під замовлення.</p>
           </div>
           
           <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-4">
              <div className="p-2 bg-[#FFC300] rounded-full text-black"><Phone size={20}/></div>
              <div>
                 <p className="text-xs text-zinc-500 uppercase font-bold">Консультація</p>
                 <a href={PHONE_LINK_1} className="text-white font-bold text-lg hover:text-[#FFC300]">{PHONE_NUMBER_1}</a>
              </div>
           </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-zinc-900 border border-zinc-800 p-4 md:p-6 rounded-2xl mb-8 shadow-xl">
           <div className="flex items-center gap-2 mb-4 text-[#FFC300] font-bold uppercase tracking-wide text-sm"><Filter size={18} /> Підбір шин</div>
           <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <select value={filterWidth} onChange={(e) => setFilterWidth(e.target.value)} className="bg-black border border-zinc-700 rounded-lg p-3 text-white outline-none focus:border-[#FFC300]"><option value="">Ширина</option>{options.widths.map(w => <option key={w} value={w}>{w}</option>)}</select>
              <select value={filterHeight} onChange={(e) => setFilterHeight(e.target.value)} className="bg-black border border-zinc-700 rounded-lg p-3 text-white outline-none focus:border-[#FFC300]"><option value="">Висота</option>{options.heights.map(h => <option key={h} value={h}>{h}</option>)}</select>
              <select value={filterRadius} onChange={(e) => setFilterRadius(e.target.value)} className="bg-black border border-zinc-700 rounded-lg p-3 text-white outline-none focus:border-[#FFC300]"><option value="">Радіус</option>{options.radii.map(r => <option key={r} value={r}>{r}</option>)}</select>
              <select value={filterSeason} onChange={(e) => setFilterSeason(e.target.value)} className="bg-black border border-zinc-700 rounded-lg p-3 text-white outline-none focus:border-[#FFC300]"><option value="">Сезон</option><option value="winter">Зима</option><option value="summer">Літо</option><option value="all-season">Всесезон</option></select>
              <select value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)} className="bg-black border border-zinc-700 rounded-lg p-3 text-white outline-none focus:border-[#FFC300]"><option value="">Тип</option><option value="car">Легкові</option><option value="cargo">Вантажні (C)</option></select>
              <button onClick={resetFilters} className="bg-zinc-800 text-zinc-300 font-bold p-3 rounded-lg hover:bg-zinc-700 hover:text-white col-span-2 md:col-span-1 border border-zinc-700">Скинути</button>
           </div>
        </div>

        {/* Product Grid - CHANGED LAYOUT: Mobile 2 cols, PC 3 cols */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#FFC300]" size={48} /></div>
        ) : filteredTyres.length === 0 ? (
          <div className="text-center py-20 bg-zinc-900 rounded-xl border border-zinc-800">
             <ShoppingBag size={48} className="mx-auto text-zinc-600 mb-4" />
             <h3 className="text-xl font-bold text-white">Шин не знайдено</h3>
             <button onClick={resetFilters} className="text-[#FFC300] hover:underline mt-2">Показати всі шини</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
              {filteredTyres.map((tyre) => (
                <div key={tyre.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-[#FFC300] transition-colors group flex flex-col relative">
                  
                  {/* Badges */}
                  <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1 max-w-[80%]">
                    {tyre.season === 'winter' && <div className="bg-blue-600 text-white p-1 rounded shadow-lg"><Snowflake size={14} /></div>}
                    {tyre.season === 'summer' && <div className="bg-orange-500 text-white p-1 rounded shadow-lg"><Sun size={14} /></div>}
                    {tyre.season === 'all-season' && <div className="bg-green-600 text-white p-1 rounded shadow-lg"><CloudSun size={14} /></div>}
                    {tyre.vehicle_type === 'cargo' && <div className="bg-purple-600 text-white p-1 rounded shadow-lg"><Truck size={14} /></div>}
                  </div>

                  {/* Image Area - Click triggers Lightbox */}
                  <div 
                    className="aspect-square bg-black relative overflow-hidden cursor-zoom-in"
                    onClick={() => openLightbox(tyre)}
                  >
                    {tyre.image_url ? (
                      <img src={tyre.image_url} alt={tyre.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">Немає фото</div>
                    )}
                    {/* Multi-photo indicator */}
                    {tyre.gallery && tyre.gallery.length > 0 && (
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
                        <Plus size={10} /> {tyre.gallery.length} фото
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3 md:p-4 flex flex-col flex-grow">
                    <h3 className="text-sm md:text-lg font-bold text-white mb-1 leading-tight line-clamp-2 min-h-[2.5em]">{tyre.title}</h3>
                    
                    {(tyre.width || tyre.height) && (
                      <div className="inline-flex items-center gap-1 mb-2 text-zinc-400 text-xs font-mono bg-black/40 px-2 py-1 rounded self-start">
                          <span>{tyre.width}</span>/<span>{tyre.height}</span> {tyre.radius}
                      </div>
                    )}

                    <div className="mt-auto pt-3 border-t border-zinc-800">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                           <span className="text-xl md:text-2xl font-black text-[#FFC300]">{formatPrice(tyre.price)} <span className="text-xs font-normal text-zinc-500">грн</span></span>
                           <button 
                             onClick={() => addToCart(tyre)}
                             className="bg-white text-black font-bold text-xs md:text-sm px-3 py-2 rounded hover:bg-[#FFC300] transition-colors flex items-center justify-center gap-1 active:scale-95"
                           >
                             <ShoppingCart size={14} /> КУПИТИ
                           </button>
                        </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {hasMore && (
              <div className="mt-12 text-center">
                <button onClick={loadMore} disabled={loadingMore} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-8 rounded-xl border border-zinc-700 transition-all flex items-center gap-2 mx-auto disabled:opacity-50">
                  {loadingMore ? <Loader2 className="animate-spin" /> : <ArrowDown size={20} />} Завантажити ще
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* FLOATING CART BUTTON */}
      {cart.length > 0 && (
        <button 
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-[#FFC300] text-black p-4 rounded-full shadow-[0_0_20px_rgba(255,195,0,0.4)] animate-bounce hover:scale-110 transition-transform"
        >
          <div className="relative">
             <ShoppingCart size={28} />
             <div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border border-white">
                {cart.reduce((a,b) => a + b.quantity, 0)}
             </div>
          </div>
        </button>
      )}

      {/* CART DRAWER/MODAL */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex justify-end animate-in slide-in-from-right">
           <div className="w-full max-w-md bg-zinc-900 h-full border-l border-zinc-700 p-6 flex flex-col shadow-2xl relative">
              <button onClick={() => setIsCartOpen(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={24} /></button>
              <h2 className="text-2xl font-black text-white uppercase italic mb-6 flex items-center gap-2"><ShoppingCart className="text-[#FFC300]" /> Кошик</h2>
              
              {!orderSuccess ? (
                <>
                  <div className="flex-grow overflow-y-auto space-y-4 mb-4 pr-2">
                    {cart.length === 0 ? (
                      <p className="text-zinc-500 text-center py-10">Кошик порожній</p>
                    ) : (
                      cart.map(item => (
                        <div key={item.id} className="bg-black border border-zinc-800 p-3 rounded-lg flex items-center gap-3">
                           <div className="w-16 h-16 bg-zinc-800 rounded flex-shrink-0 overflow-hidden">
                              {item.image_url && <img src={item.image_url} className="w-full h-full object-cover" alt="" />}
                           </div>
                           <div className="flex-grow">
                              <h4 className="text-white font-bold text-sm leading-tight line-clamp-1">{item.title}</h4>
                              <p className="text-[#FFC300] font-mono text-sm">{formatPrice(item.price)} грн</p>
                           </div>
                           <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center bg-zinc-800 rounded">
                                 <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-zinc-400 hover:text-white"><Minus size={14} /></button>
                                 <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                                 <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-zinc-400 hover:text-white"><Plus size={14} /></button>
                              </div>
                              <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-400 text-xs"><Trash2 size={14}/></button>
                           </div>
                        </div>
                      ))
                    )}
                  </div>

                  {cart.length > 0 && (
                     <div className="border-t border-zinc-800 pt-4">
                        <div className="flex justify-between text-xl font-black text-white mb-4">
                           <span>Разом:</span>
                           <span className="text-[#FFC300]">{Math.round(cartTotal)} грн</span>
                        </div>
                        
                        {/* Order Form Mini */}
                        <div className="space-y-3 mb-4">
                           <input type="text" value={orderName} onChange={e => setOrderName(e.target.value)} placeholder="Ваше ім'я" className="w-full bg-zinc-800 border border-zinc-700 rounded p-3 text-white outline-none focus:border-[#FFC300]" />
                           <input type="tel" value={orderPhone} onChange={e => setOrderPhone(e.target.value)} placeholder="Телефон" className="w-full bg-zinc-800 border border-zinc-700 rounded p-3 text-white outline-none focus:border-[#FFC300]" />
                           
                           <div className="grid grid-cols-2 gap-2">
                             <button onClick={() => setDeliveryMethod('pickup')} className={`py-2 rounded font-bold text-xs ${deliveryMethod === 'pickup' ? 'bg-[#FFC300] text-black' : 'bg-black text-zinc-400 border border-zinc-800'}`}>Самовивіз</button>
                             <button onClick={() => setDeliveryMethod('newpost')} className={`py-2 rounded font-bold text-xs ${deliveryMethod === 'newpost' ? 'bg-red-600 text-white' : 'bg-black text-zinc-400 border border-zinc-800'}`}>Нова Пошта</button>
                           </div>

                           {deliveryMethod === 'newpost' && (
                              <div className="space-y-2 bg-zinc-800/50 p-2 rounded border border-zinc-700 text-sm">
                                <select value={selectedRegion} onChange={e => { setSelectedRegion(e.target.value); setSelectedCity(''); }} className="w-full bg-black border border-zinc-700 rounded p-2 text-white"><option value="">Область</option>{MOCK_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}</select>
                                <select value={selectedCity} onChange={e => { setSelectedCity(e.target.value); setSelectedWarehouse(''); }} disabled={!selectedRegion} className="w-full bg-black border border-zinc-700 rounded p-2 text-white"><option value="">Місто</option>{selectedRegion && MOCK_CITIES[selectedRegion]?.map(c => <option key={c} value={c}>{c}</option>)}</select>
                                <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)} disabled={!selectedCity} className="w-full bg-black border border-zinc-700 rounded p-2 text-white"><option value="">Відділення</option>{selectedCity && getMockWarehouses(selectedCity).map(w => <option key={w} value={w}>{w}</option>)}</select>
                                <div className="flex gap-2 pt-1">
                                   <label className="flex items-center gap-1 text-xs text-zinc-400"><input type="radio" checked={paymentMethod === 'prepayment'} onChange={() => setPaymentMethod('prepayment')} /> Предоплата</label>
                                   <label className="flex items-center gap-1 text-xs text-zinc-400"><input type="radio" checked={paymentMethod === 'full'} onChange={() => setPaymentMethod('full')} /> Повна</label>
                                </div>
                              </div>
                           )}
                        </div>

                        {orderError && <p className="text-red-500 text-sm mb-2">{orderError}</p>}

                        <button onClick={submitOrder} disabled={orderSending} className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black py-4 rounded-xl flex justify-center items-center shadow-lg">
                           {orderSending ? <Loader2 className="animate-spin" /> : 'ЗАМОВИТИ ВСЕ'}
                        </button>
                     </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-4"><Check size={40} /></div>
                    <h3 className="text-2xl font-bold text-white mb-2">Замовлення успішне!</h3>
                    <p className="text-zinc-400 mb-6">Дякуємо. Менеджер зв'яжеться з вами.</p>
                    <button onClick={() => { setIsCartOpen(false); setOrderSuccess(false); }} className="px-8 py-3 bg-zinc-800 text-white rounded-xl">Закрити</button>
                </div>
              )}
           </div>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {lightboxOpen && currentLightboxImages.length > 0 && (
        <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center animate-in fade-in duration-300">
          <button onClick={() => setLightboxOpen(false)} className="absolute top-4 right-4 text-white hover:text-[#FFC300] z-50 p-2"><X size={32}/></button>
          
          <div 
             className="w-full h-full flex items-center justify-center relative touch-pan-y"
             onTouchStart={onTouchStart}
             onTouchMove={onTouchMove}
             onTouchEnd={onTouchEnd}
          >
             {currentLightboxImages.length > 1 && (
               <>
                 <button onClick={prevImage} className="absolute left-2 md:left-8 text-white/50 hover:text-white z-50 hidden md:block"><ChevronLeft size={48}/></button>
                 <button onClick={nextImage} className="absolute right-2 md:right-8 text-white/50 hover:text-white z-50 hidden md:block"><ChevronRight size={48}/></button>
               </>
             )}
             
             <img 
               src={currentLightboxImages[currentImageIndex]} 
               alt="" 
               className="max-w-full max-h-full object-contain pointer-events-none select-none"
             />

             {currentLightboxImages.length > 1 && (
               <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
                  {currentLightboxImages.map((_, idx) => (
                    <div key={idx} className={`w-2 h-2 rounded-full transition-colors ${idx === currentImageIndex ? 'bg-[#FFC300]' : 'bg-white/30'}`} />
                  ))}
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TyreShop;
