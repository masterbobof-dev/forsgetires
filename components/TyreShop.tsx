
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { TyreProduct, CartItem } from '../types';
import { ShoppingBag, Loader2, Phone, X, Filter, Snowflake, Sun, CloudSun, Truck, Check, CreditCard, Wallet, ArrowDown, ShoppingCart, Plus, Minus, Trash2, ChevronLeft, ChevronRight, ZoomIn, Ban, Flame, Grid, ArrowUpDown, Search, DollarSign, AlertCircle } from 'lucide-react';
import { PHONE_LINK_1, PHONE_NUMBER_1, FORMSPREE_ENDPOINT } from '../constants';

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

const formatPrice = (priceStr: string | undefined) => {
  if (!priceStr) return '0';
  const num = parseFloat(priceStr);
  return isNaN(num) ? priceStr : Math.round(num).toString();
};

const CATEGORIES = [
  { id: 'all', label: 'Всі шини', icon: Grid },
  { id: 'winter', label: 'Зимові', icon: Snowflake },
  { id: 'summer', label: 'Літні', icon: Sun },
  { id: 'all-season', label: 'Всесезонні', icon: CloudSun },
  { id: 'cargo', label: 'Вантажні (C)', icon: Truck },
  { id: 'hot', label: 'HOT Знижки', icon: Flame },
  { id: 'out_of_stock', label: 'Немає в наявності', icon: Ban },
] as const;

type CategoryType = typeof CATEGORIES[number]['id'];

interface TyreShopProps {
  initialCategory?: CategoryType;
  initialProduct?: TyreProduct | null;
}

const TyreShop: React.FC<TyreShopProps> = ({ initialCategory = 'all', initialProduct }) => {
  const [tyres, setTyres] = useState<TyreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentLightboxImages, setCurrentLightboxImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Filters & Search
  const [activeCategory, setActiveCategory] = useState<CategoryType>(initialCategory);
  const [activeSort, setActiveSort] = useState<'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'with_photo' | 'no_photo'>('newest');
  const [searchQuery, setSearchQuery] = useState(''); // Text search state

  const [filterWidth, setFilterWidth] = useState('');
  const [filterHeight, setFilterHeight] = useState('');
  const [filterRadius, setFilterRadius] = useState('');
  
  // Price Range State
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Stock Quantity Logic
  const [enableStockQty, setEnableStockQty] = useState(false);

  const [orderName, setOrderName] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'newpost'>('pickup');
  const [paymentMethod, setPaymentMethod] = useState<'prepayment' | 'full'>('prepayment');
  
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');

  const [orderSending, setOrderSending] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState('');

  const touchStartRef = useRef<number | null>(null);
  const touchEndRef = useRef<number | null>(null);

  // Fetch Settings
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('settings').select('value').eq('key', 'enable_stock_quantity').single();
      if (data && data.value === 'true') {
        setEnableStockQty(true);
      }
    };
    fetchSettings();
  }, []);

  // Update active category if prop changes (e.g. from Home navigation)
  useEffect(() => {
    if (initialCategory) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory]);

  // Trigger fetch when these change
  useEffect(() => {
    setPage(0);
    setTyres([]); 
    fetchTyres(0, true);
  }, [activeCategory, activeSort, enableStockQty]); // Added enableStockQty dependency

  const parseTyreSpecs = (tyre: TyreProduct): TyreProduct => {
    const sizeRegex = /(\d{3})[\/\s](\d{2})[\s\w]*R(\d{2}[C|c]?)/; 
    const match = tyre.title.match(sizeRegex) || tyre.description?.match(sizeRegex);
    
    let width = ''; 
    let height = ''; 
    let parsedRadius = tyre.radius || ''; 
    
    // Prefer database value first, default to 'car' if null
    let vehicle_type: 'car' | 'cargo' | 'suv' = tyre.vehicle_type || 'car';

    if (match) { 
        width = match[1]; 
        height = match[2]; 
        const rawRadius = match[3].toUpperCase(); 
        
        if (!parsedRadius) parsedRadius = `R${rawRadius}`;
        
        // Only override if vehicle_type is missing/car but specs indicate Cargo
        if (vehicle_type === 'car' && rawRadius.endsWith('C')) {
            vehicle_type = 'cargo';
        }
    }

    // Secondary Check for Cargo if vehicle_type is not already set
    if (vehicle_type === 'car') {
        const upperTitle = tyre.title.toUpperCase();
        if (upperTitle.includes('R12C') || upperTitle.includes('R13C') || upperTitle.includes('R14C') || 
            upperTitle.includes('R15C') || upperTitle.includes('R16C') || upperTitle.includes('R17C') || 
            upperTitle.includes('LT') || upperTitle.includes('CARGO')) { 
            vehicle_type = 'cargo'; 
        }
    }

    const lowerTitle = (tyre.title + ' ' + tyre.description).toLowerCase();
    let season = 'all'; 
    if (lowerTitle.includes('зима') || lowerTitle.includes('winter') || lowerTitle.includes('snow') || lowerTitle.includes('ice')) season = 'winter';
    else if (lowerTitle.includes('літо') || lowerTitle.includes('summer')) season = 'summer';
    else if (lowerTitle.includes('всесезон') || lowerTitle.includes('all season')) season = 'all-season';
    
    // Logic for in_stock based on setting
    let in_stock = tyre.in_stock !== false;
    
    if (enableStockQty && tyre.stock_quantity !== undefined && tyre.stock_quantity !== null) {
        if (tyre.stock_quantity <= 0) {
            in_stock = false;
        }
    }
    
    return { ...tyre, width, height, radius: parsedRadius, season, vehicle_type, in_stock };
  };

  const fetchTyres = async (pageIndex: number, isRefresh = false) => {
    try {
      if (isRefresh) setLoading(true);
      else setLoadingMore(true);

      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase.from('tyres').select('*', { count: 'exact' });

      // 1. TEXT SEARCH FILTER (If exists)
      if (searchQuery.trim()) {
         const term = searchQuery.trim();
         query = query.or(`title.ilike.%${term}%,catalog_number.ilike.%${term}%,manufacturer.ilike.%${term}%`);
      }

      // 2. CATEGORY FILTERS
      // Base logic for Stock: 
      // If enableStockQty is true:
      //   - Normal categories: exclude items where in_stock is false OR stock_quantity is 0
      //   - Out of Stock category: include items where in_stock is false OR stock_quantity is 0
      
      const stockCondition = enableStockQty 
        ? `.or(in_stock.eq.false,stock_quantity.eq.0)` // Defines "Out of Stock"
        : `.eq(in_stock,false)`;

      if (activeCategory === 'hot') {
         query = query.eq('is_hot', true);
         if (enableStockQty) query = query.or('stock_quantity.gt.0,stock_quantity.is.null').neq('in_stock', false);
         else query = query.neq('in_stock', false);
      } else if (activeCategory === 'winter') {
         query = query.or('title.ilike.%winter%,title.ilike.%зима%,description.ilike.%winter%,description.ilike.%зима%');
         if (enableStockQty) query = query.or('stock_quantity.gt.0,stock_quantity.is.null').neq('in_stock', false);
         else query = query.neq('in_stock', false);
      } else if (activeCategory === 'summer') {
         query = query.or('title.ilike.%summer%,title.ilike.%літо%,description.ilike.%summer%,description.ilike.%літо%');
         if (enableStockQty) query = query.or('stock_quantity.gt.0,stock_quantity.is.null').neq('in_stock', false);
         else query = query.neq('in_stock', false);
      } else if (activeCategory === 'all-season') {
         query = query.or('title.ilike.%all season%,title.ilike.%всесезон%,description.ilike.%all season%,description.ilike.%всесезон%');
         if (enableStockQty) query = query.or('stock_quantity.gt.0,stock_quantity.is.null').neq('in_stock', false);
         else query = query.neq('in_stock', false);
      } else if (activeCategory === 'cargo') {
         query = query.or('vehicle_type.eq.cargo,radius.ilike.%C%,title.ilike.%R12C%,title.ilike.%R13C%,title.ilike.%R14C%,title.ilike.%R15C%,title.ilike.%R16C%,title.ilike.%R17C%,title.ilike.%R18C%,title.ilike.%R19C%,title.ilike.%LT%,title.ilike.%Cargo%,title.ilike.%Bus%');
         if (enableStockQty) query = query.or('stock_quantity.gt.0,stock_quantity.is.null').neq('in_stock', false);
         else query = query.neq('in_stock', false);
      } else if (activeCategory === 'out_of_stock') {
         if (enableStockQty) query = query.or('in_stock.eq.false,stock_quantity.eq.0');
         else query = query.eq('in_stock', false);
      } else {
         // Default 'all' - only in stock
         if (enableStockQty) query = query.or('stock_quantity.gt.0,stock_quantity.is.null').neq('in_stock', false);
         else query = query.neq('in_stock', false);
      }

      // 3. PRICE FILTERS
      if (minPrice) {
         query = query.gte('price', parseInt(minPrice));
      }
      if (maxPrice) {
         query = query.lte('price', parseInt(maxPrice));
      }

      // 4. SORTING
      if (activeSort === 'with_photo') {
         query = query.order('image_url', { ascending: false, nullsFirst: false })
                      .order('created_at', { ascending: false });
      } else if (activeSort === 'no_photo') {
         query = query.order('image_url', { ascending: true, nullsFirst: true })
                      .order('created_at', { ascending: false });
      } else if (activeSort === 'price_asc') {
         query = query.order('price', { ascending: true });
      } else if (activeSort === 'price_desc') {
         query = query.order('price', { ascending: false });
      } else if (activeSort === 'oldest') {
         query = query.order('created_at', { ascending: true });
      } else {
         query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query.range(from, to);
      if (error) throw error;

      if (data) {
        let processed = data.map(parseTyreSpecs);
        
        // Client-side fix for "With Photo" priority if mixed
        if (activeSort === 'with_photo') {
            processed = processed.sort((a, b) => {
                const aHas = !!a.image_url && a.image_url.length > 5;
                const bHas = !!b.image_url && b.image_url.length > 5;
                if (aHas === bHas) return 0;
                return aHas ? -1 : 1;
            });
        }

        if (isRefresh) { 
            setTyres(processed); 
        } else { 
            setTyres(prev => [...prev, ...processed]); 
        }
        
        setPage(pageIndex);

        if (data.length < PAGE_SIZE) setHasMore(false);
        else setHasMore(true);
      }
    } catch (error) { console.error("Error fetching tyres:", error); } finally { setLoading(false); setLoadingMore(false); }
  };

  const handleCategoryChange = (cat: CategoryType) => {
     setActiveCategory(cat);
     if (cat === 'all') setActiveSort('newest');
  };

  const handleForceSearch = () => {
     setPage(0);
     setTyres([]);
     fetchTyres(0, true);
  };

  const loadMore = () => { const nextPage = page + 1; fetchTyres(nextPage); };
  
  const addToCart = (tyre: TyreProduct) => { 
      if (tyre.in_stock === false) return; 
      
      setCart(prev => { 
          const existing = prev.find(item => item.id === tyre.id);
          const currentQty = existing ? existing.quantity : 0;

          // Stock Limit Check
          if (enableStockQty && tyre.stock_quantity !== undefined && tyre.stock_quantity !== null && tyre.stock_quantity > 0) {
              if (currentQty + 1 > tyre.stock_quantity) {
                  alert(`Вибачте, доступно лише ${tyre.stock_quantity} шт. цього товару.`);
                  return prev;
              }
          }

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
              const newQty = item.quantity + delta;
              
              // Stock Limit Check
              if (delta > 0 && enableStockQty && item.stock_quantity !== undefined && item.stock_quantity !== null && item.stock_quantity > 0) {
                  if (newQty > item.stock_quantity) {
                      // alert(`Максимальна кількість: ${item.stock_quantity}`);
                      return item;
                  }
              }

              return { ...item, quantity: Math.max(1, newQty) }; 
          } 
          return item; 
      })); 
  };

  const removeFromCart = (id: number) => { setCart(prev => prev.filter(item => item.id !== id)); };
  const cartTotal = useMemo(() => cart.reduce((total, item) => total + (parseFloat(item.price) * item.quantity), 0), [cart]);

  const openLightbox = (tyre: TyreProduct) => { let images: string[] = []; if (tyre.image_url) images.push(tyre.image_url); if (tyre.gallery && Array.isArray(tyre.gallery)) { const additional = tyre.gallery.filter(url => url !== tyre.image_url); images = [...images, ...additional]; } if (images.length === 0) return; setCurrentLightboxImages(images); setCurrentImageIndex(0); setLightboxOpen(true); };
  
  // Effect to open lightbox if initialProduct is provided (from Home page Hot Deal click)
  useEffect(() => {
    if (initialProduct) {
      openLightbox(initialProduct);
    }
  }, [initialProduct]);

  const nextImage = (e?: React.MouseEvent) => { e?.stopPropagation(); setCurrentImageIndex(prev => (prev + 1) % currentLightboxImages.length); };
  const prevImage = (e?: React.MouseEvent) => { e?.stopPropagation(); setCurrentImageIndex(prev => (prev - 1 + currentLightboxImages.length) % currentLightboxImages.length); };
  const onTouchStart = (e: React.TouchEvent) => { touchStartRef.current = e.targetTouches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => { touchEndRef.current = e.targetTouches[0].clientX; };
  const onTouchEnd = () => { if (!touchStartRef.current || !touchEndRef.current) return; const distance = touchStartRef.current - touchEndRef.current; if (distance > 50) nextImage(); if (distance < -50) prevImage(); touchStartRef.current = null; touchEndRef.current = null; };

  const submitOrder = async () => {
    if (!orderName || orderPhone.length < 9) { setOrderError("Введіть коректне ім'я та телефон"); return; }
    if (deliveryMethod === 'newpost' && (!selectedCity || !selectedWarehouse)) { setOrderError("Оберіть місто та відділення"); return; }
    if (cart.length === 0) { setOrderError("Кошик порожній"); return; }
    setOrderSending(true); setOrderError('');
    try {
      const itemsPayload = cart.map(i => ({ 
         id: i.id, 
         title: i.title, 
         quantity: i.quantity, 
         price: i.price,
         base_price: i.base_price 
      }));
      
      const { error } = await supabase.from('tyre_orders').insert([{ customer_name: orderName, customer_phone: orderPhone, status: 'new', delivery_method: deliveryMethod, delivery_city: deliveryMethod === 'newpost' ? `${selectedRegion}, ${selectedCity}` : null, delivery_warehouse: deliveryMethod === 'newpost' ? selectedWarehouse : null, payment_method: deliveryMethod === 'newpost' ? paymentMethod : null, items: itemsPayload }]);
      if (error) throw new Error("Помилка бази даних: " + error.message);
      try {
        const itemsDesc = cart.map(i => `${i.title} (${i.quantity} шт) - ${formatPrice(i.price)} грн`).join('\n');
        const formData = { subject: `Замовлення шин (${cart.length} поз.)`, customer_name: orderName, customer_phone: orderPhone, items: itemsDesc, total_price: `${cartTotal} грн`, delivery_method: deliveryMethod === 'pickup' ? "Самовивіз" : "Нова Пошта", delivery_address: deliveryMethod === 'pickup' ? "-" : `${selectedRegion}, ${selectedCity}, ${selectedWarehouse}`, payment_method: deliveryMethod === 'newpost' ? (paymentMethod === 'prepayment' ? 'Предоплата' : 'Повна оплата') : '-' };
        await fetch(FORMSPREE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      } catch (emailErr) { console.error("Email sending failed", emailErr); }
      setOrderSuccess(true); setCart([]);
    } catch (err: any) { console.error(err); setOrderError("Помилка при створенні замовлення. Спробуйте ще раз."); } finally { setOrderSending(false); }
  };

  const options = useMemo(() => {
    const widths = new Set<string>(); const heights = new Set<string>(); const radii = new Set<string>();
    tyres.forEach(t => { if (t.in_stock !== false) { if (t.width) widths.add(t.width); if (t.height) heights.add(t.height); if (t.radius) radii.add(t.radius); } });
    return { widths: Array.from(widths).sort(), heights: Array.from(heights).sort(), radii: Array.from(radii).sort((a, b) => parseInt(a.replace(/\D/g,'')) - parseInt(b.replace(/\D/g,''))) };
  }, [tyres]);

  const filteredTyres = tyres.filter(t => (!filterWidth || t.width === filterWidth) && (!filterHeight || t.height === filterHeight) && (!filterRadius || t.radius === filterRadius));
  const resetFilters = () => { 
      setFilterWidth(''); 
      setFilterHeight(''); 
      setFilterRadius(''); 
      setSearchQuery(''); 
      setMinPrice('');
      setMaxPrice('');
      handleForceSearch(); 
  };

  return (
    <div className="min-h-screen bg-[#09090b] py-8 md:py-12 animate-in fade-in duration-500 pb-32">
      <div className="max-w-7xl mx-auto px-2 md:px-4">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 px-2">
           <div>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-2 border-b-2 border-[#FFC300] inline-block pb-2">Магазин Шин та Дисків</h2>
              <p className="text-zinc-400">Широкий вибір нових та б/в шин у Синельниковому.</p>
           </div>
           <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-4 w-full md:w-auto">
              <div className="p-2 bg-[#FFC300] rounded-full text-black"><Phone size={20}/></div>
              <div>
                 <p className="text-xs text-zinc-500 uppercase font-bold">Консультація</p>
                 <a href={PHONE_LINK_1} className="text-white font-bold text-lg hover:text-[#FFC300]">{PHONE_NUMBER_1}</a>
              </div>
           </div>
        </div>
        
        {/* CATEGORY NAV */}
        <div className="mb-8 px-2">
           <div className="grid grid-cols-3 md:flex md:flex-wrap md:justify-center gap-2 md:gap-4">
              {CATEGORIES.map(cat => {
                 const isActive = activeCategory === cat.id;
                 return (
                    <button 
                       key={cat.id} 
                       onClick={() => handleCategoryChange(cat.id)}
                       className={`
                          flex flex-col items-center justify-center gap-2 p-2 md:p-4 rounded-xl transition-all duration-300 border
                          ${isActive 
                             ? 'bg-[#FFC300] border-[#FFC300] text-black shadow-lg scale-105' 
                             : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-600 hover:text-white'}
                       `}
                    >
                       <cat.icon size={20} className={`md:w-6 md:h-6 ${isActive ? 'animate-bounce' : ''}`} />
                       <span className="font-bold text-[10px] md:text-sm uppercase tracking-wide text-center leading-tight">{cat.label}</span>
                    </button>
                 );
              })}
           </div>
        </div>

        {/* TOOLBAR: SEARCH, FILTERS & SORT */}
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl mb-8 shadow-xl mx-2">
           <div className="flex flex-col gap-4">
              
              {/* Top Row: Search Input */}
              <div className="flex gap-2">
                 <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18}/>
                    <input 
                       type="text" 
                       placeholder="Пошук (наприклад: Michelin, R16, 205/55)..." 
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && handleForceSearch()}
                       className="w-full bg-black border border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-white outline-none focus:border-[#FFC300]"
                    />
                 </div>
                 <button 
                    onClick={handleForceSearch}
                    className="bg-[#FFC300] hover:bg-[#e6b000] text-black font-black px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg active:scale-95 transition-transform uppercase tracking-wider text-sm md:text-base"
                 >
                    ЗНАЙТИ
                 </button>
              </div>

              {/* Bottom Row: Dropdowns */}
              <div className="flex flex-col lg:flex-row gap-4">
                 
                 {/* Filters Container */}
                 <div className="flex flex-col sm:flex-row gap-2 w-full lg:flex-grow">
                    {/* Size Filters */}
                    <div className="grid grid-cols-3 gap-0 bg-black/50 rounded-xl border border-zinc-800 flex-grow overflow-hidden divide-x divide-zinc-800">
                       <div className="relative group">
                          <Filter size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#FFC300] hidden sm:block" />
                          <select value={filterWidth} onChange={(e) => setFilterWidth(e.target.value)} className="bg-transparent text-white text-xs md:text-sm font-bold p-3 sm:pl-8 w-full outline-none cursor-pointer hover:bg-zinc-800/50 transition-colors text-center sm:text-left appearance-none sm:appearance-auto"><option value="">Ширина</option>{options.widths.map(w => <option key={w} value={w}>{w}</option>)}</select>
                       </div>
                       <div className="relative group">
                          <select value={filterHeight} onChange={(e) => setFilterHeight(e.target.value)} className="bg-transparent text-white text-xs md:text-sm font-bold p-3 w-full outline-none cursor-pointer hover:bg-zinc-800/50 transition-colors text-center"><option value="">Висота</option>{options.heights.map(h => <option key={h} value={h}>{h}</option>)}</select>
                       </div>
                       <div className="relative group">
                          <select value={filterRadius} onChange={(e) => setFilterRadius(e.target.value)} className="bg-transparent text-white text-xs md:text-sm font-bold p-3 w-full outline-none cursor-pointer hover:bg-zinc-800/50 transition-colors text-center"><option value="">Радіус</option>{options.radii.map(r => <option key={r} value={r}>{r}</option>)}</select>
                       </div>
                    </div>

                    {/* Price Range Inputs */}
                    <div className="flex items-center gap-2 bg-black/50 p-1 rounded-xl border border-zinc-800 px-3 sm:w-auto w-full justify-center">
                        <span className="text-zinc-500 text-xs font-bold whitespace-nowrap">Ціна:</span>
                        <input 
                            type="number" 
                            placeholder="Від" 
                            value={minPrice} 
                            onChange={(e) => setMinPrice(e.target.value)} 
                            className="w-16 bg-transparent text-white text-sm font-bold p-2 outline-none text-center border-b border-zinc-700 focus:border-[#FFC300]"
                        />
                        <span className="text-zinc-600">-</span>
                        <input 
                            type="number" 
                            placeholder="До" 
                            value={maxPrice} 
                            onChange={(e) => setMaxPrice(e.target.value)} 
                            className="w-16 bg-transparent text-white text-sm font-bold p-2 outline-none text-center border-b border-zinc-700 focus:border-[#FFC300]"
                        />
                    </div>

                    {(filterWidth || filterHeight || filterRadius || searchQuery || minPrice || maxPrice) && (
                       <button onClick={resetFilters} className="bg-zinc-800 text-white p-3 rounded-xl hover:bg-red-900/50 transition-colors flex-shrink-0 border border-zinc-700"><X size={20}/></button>
                    )}
                 </div>

                 {/* Sort */}
                 <div className="w-full lg:w-auto lg:min-w-[200px]">
                    <div className="flex items-center gap-2 bg-black/50 p-1 rounded-xl border border-zinc-800 w-full">
                       <ArrowUpDown size={16} className="text-zinc-500 ml-2 flex-shrink-0" />
                       <select value={activeSort} onChange={(e) => setActiveSort(e.target.value as any)} className="bg-transparent text-white text-sm font-bold p-2 outline-none w-full cursor-pointer hover:text-[#FFC300]">
                          <option value="newest">Спочатку нові</option>
                          <option value="oldest">Спочатку старі</option>
                          <option value="price_asc">Від дешевих</option>
                          <option value="price_desc">Від дорогих</option>
                          <option value="with_photo">З фото</option>
                          <option value="no_photo">Без фото</option>
                       </select>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* PRODUCTS GRID */}
        {loading ? (
           <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="animate-spin text-[#FFC300] mb-4" size={48} />
              <p className="text-zinc-500 animate-pulse">Завантаження шин...</p>
           </div>
        ) : filteredTyres.length === 0 ? (
           <div className="text-center py-20 bg-zinc-900 rounded-xl border border-zinc-800 mx-2">
              <ShoppingBag size={48} className="mx-auto text-zinc-600 mb-4" />
              <h3 className="text-xl font-bold text-white">Шин не знайдено</h3>
              <p className="text-zinc-500 text-sm mt-2">Спробуйте змінити фільтри або категорію</p>
              <button onClick={() => {resetFilters(); handleCategoryChange('all');}} className="mt-6 px-6 py-2 bg-[#FFC300] text-black font-bold rounded-lg hover:bg-[#e6b000]">
                 Показати всі шини
              </button>
           </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 px-2">
               {filteredTyres.map((tyre) => {
                  // Determine display price logic
                  const hasDiscount = tyre.old_price && parseFloat(tyre.old_price) > parseFloat(tyre.price);
                  return (
                  <div key={tyre.id} className={`bg-zinc-900 border rounded-xl overflow-hidden hover:border-[#FFC300] transition-colors group flex flex-col relative ${tyre.in_stock === false ? 'border-zinc-800 opacity-70' : 'border-zinc-800'}`}>
                     
                     {/* BADGES */}
                     <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1 max-w-[80%]">
                        {tyre.is_hot && <div className="bg-orange-600 text-white p-1 rounded shadow-lg flex items-center gap-1 text-[10px] font-bold px-2 uppercase"><Flame size={12} className="fill-current"/> HOT</div>}
                        {hasDiscount && <div className="bg-red-600 text-white p-1 rounded shadow-lg flex items-center gap-1 text-[10px] font-bold px-2 uppercase">SALE</div>}
                        {tyre.season === 'winter' && <div className="bg-blue-600 text-white p-1 rounded shadow-lg" title="Зима"><Snowflake size={14} /></div>}
                        {tyre.season === 'summer' && <div className="bg-orange-500 text-white p-1 rounded shadow-lg" title="Літо"><Sun size={14} /></div>}
                        {tyre.season === 'all-season' && <div className="bg-green-600 text-white p-1 rounded shadow-lg" title="Всесезон"><CloudSun size={14} /></div>}
                        {tyre.vehicle_type === 'cargo' && <div className="bg-purple-600 text-white p-1 rounded shadow-lg" title="Вантажна"><Truck size={14} /></div>}
                     </div>

                     {tyre.in_stock === false && (
                        <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center pointer-events-none">
                           <div className="bg-red-600 text-white px-3 py-1 font-black uppercase -rotate-12 border-2 border-white shadow-xl text-sm">Немає в наявності</div>
                        </div>
                     )}

                     {/* IMAGE */}
                     <div className={`aspect-square bg-black relative overflow-hidden ${tyre.in_stock !== false ? 'cursor-zoom-in' : ''}`} onClick={() => tyre.in_stock !== false && openLightbox(tyre)}>
                        {tyre.image_url ? (
                           <img src={tyre.image_url} alt={tyre.title} className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${tyre.in_stock === false ? 'grayscale' : ''}`} />
                        ) : (
                           <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 bg-zinc-950">
                              <ShoppingBag size={32} className="opacity-20 mb-2"/>
                              <span className="text-xs font-bold">Немає фото</span>
                           </div>
                        )}
                        {tyre.gallery && tyre.gallery.length > 0 && (
                           <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm">
                              <Plus size={10} /> {tyre.gallery.length} фото
                           </div>
                        )}
                     </div>

                     {/* INFO */}
                     <div className="p-3 md:p-4 flex flex-col flex-grow">
                        <h3 className="text-sm md:text-base font-bold text-white mb-2 leading-tight line-clamp-2 h-[2.5em]">{tyre.title}</h3>
                        
                        {(tyre.width || tyre.height) && (
                           <div className="inline-flex items-center gap-1 mb-3 text-zinc-400 text-xs font-mono bg-black/40 px-2 py-1 rounded self-start border border-zinc-800">
                              <span>{tyre.width}</span>/<span>{tyre.height}</span> <span className="text-[#FFC300]">{tyre.radius}</span>
                           </div>
                        )}

                        {enableStockQty && tyre.in_stock !== false && (
                           <div className="text-[10px] font-bold text-green-400 mb-2 flex items-center gap-1">
                               <Check size={10} /> В наявності: {tyre.stock_quantity ? tyre.stock_quantity : '> 4'} шт.
                           </div>
                        )}

                        <div className="mt-auto pt-3 border-t border-zinc-800">
                           <div className="flex flex-col justify-between gap-2">
                              {/* Price Display Logic */}
                              {hasDiscount ? (
                                <div className="flex flex-col items-start leading-none">
                                   <span className="text-zinc-500 text-xs line-through decoration-zinc-500 mb-1">{formatPrice(tyre.old_price)} грн</span>
                                   <span className={`text-xl font-black ${tyre.in_stock === false ? 'text-zinc-500' : 'text-red-500'}`}>
                                      {formatPrice(tyre.price)} <span className="text-xs font-normal text-zinc-500">грн</span>
                                   </span>
                                </div>
                              ) : (
                                <span className={`text-xl font-black ${tyre.in_stock === false ? 'text-zinc-500' : 'text-[#FFC300]'}`}>
                                   {formatPrice(tyre.price)} <span className="text-xs font-normal text-zinc-500">грн</span>
                                </span>
                              )}

                              <button 
                                 onClick={() => addToCart(tyre)} 
                                 disabled={tyre.in_stock === false} 
                                 className={`
                                    w-full font-bold text-xs py-3 rounded-lg transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-wide
                                    ${tyre.in_stock === false ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-white text-black hover:bg-[#FFC300]'}
                                 `}
                              >
                                 {tyre.in_stock === false ? <Ban size={14}/> : <ShoppingCart size={14} />} 
                                 {tyre.in_stock === false ? 'Відсутнє' : 'Купити'}
                              </button>
                           </div>
                        </div>
                     </div>
                  </div>
               )})}
            </div>
            
            {hasMore && (
               <div className="mt-12 text-center">
                  <button onClick={loadMore} disabled={loadingMore} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-8 rounded-xl border border-zinc-700 transition-all flex items-center gap-2 mx-auto disabled:opacity-50 hover:border-[#FFC300]">
                     {loadingMore ? <Loader2 className="animate-spin" /> : <ArrowDown size={20} />} 
                     Завантажити ще
                  </button>
               </div>
            )}
          </>
        )}
      </div>

      {cart.length > 0 && <button onClick={() => setIsCartOpen(true)} className="fixed bottom-6 right-6 z-40 bg-[#FFC300] text-black p-4 rounded-full shadow-[0_0_20px_rgba(255,195,0,0.4)] animate-bounce hover:scale-110 transition-transform"><div className="relative"><ShoppingCart size={28} /><div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border border-white">{cart.reduce((a,b) => a + b.quantity, 0)}</div></div></button>}

      {isCartOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex justify-end animate-in slide-in-from-right">
           <div className="w-full max-w-md bg-zinc-900 h-full border-l border-zinc-700 p-6 flex flex-col shadow-2xl relative">
              <button onClick={() => setIsCartOpen(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={24} /></button>
              <h2 className="text-2xl font-black text-white uppercase italic mb-6 flex items-center gap-2"><ShoppingCart className="text-[#FFC300]" /> Кошик</h2>
              
              {!orderSuccess ? (
                <>
                  <div className="flex-grow overflow-y-auto space-y-4 mb-4 pr-2">
                    {cart.length === 0 ? <p className="text-zinc-500 text-center py-10">Кошик порожній</p> : cart.map(item => (<div key={item.id} className="bg-black border border-zinc-800 p-3 rounded-lg flex items-center gap-3"><div className="w-16 h-16 bg-zinc-800 rounded flex-shrink-0 overflow-hidden">{item.image_url && <img src={item.image_url} className="w-full h-full object-cover" alt="" />}</div><div className="flex-grow"><h4 className="text-white font-bold text-sm leading-tight line-clamp-1">{item.title}</h4><p className="text-[#FFC300] font-mono text-sm">{formatPrice(item.price)} грн</p>{enableStockQty && item.stock_quantity && <p className="text-zinc-500 text-[10px]">Доступно: {item.stock_quantity} шт</p>}</div><div className="flex flex-col items-center gap-1"><div className="flex items-center bg-zinc-800 rounded"><button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-zinc-400 hover:text-white"><Minus size={14} /></button><span className="w-6 text-center text-sm font-bold">{item.quantity}</span><button onClick={() => updateQuantity(item.id, 1)} className={`p-1 text-zinc-400 hover:text-white ${enableStockQty && item.stock_quantity && item.quantity >= item.stock_quantity ? 'opacity-30 cursor-not-allowed' : ''}`}><Plus size={14} /></button></div><button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-400 text-xs"><Trash2 size={14}/></button></div></div>))}
                  </div>
                  {cart.length > 0 && (<div className="border-t border-zinc-800 pt-4"><div className="flex justify-between text-xl font-black text-white mb-4"><span>Разом:</span><span className="text-[#FFC300]">{Math.round(cartTotal)} грн</span></div><div className="space-y-3 mb-4"><input type="text" value={orderName} onChange={e => setOrderName(e.target.value)} placeholder="Ваше ім'я" className="w-full bg-zinc-800 border border-zinc-700 rounded p-3 text-white outline-none focus:border-[#FFC300]" /><input type="tel" value={orderPhone} onChange={e => setOrderPhone(e.target.value)} placeholder="Телефон" className="w-full bg-zinc-800 border border-zinc-700 rounded p-3 text-white outline-none focus:border-[#FFC300]" /><div className="grid grid-cols-2 gap-2"><button onClick={() => setDeliveryMethod('pickup')} className={`py-2 rounded font-bold text-xs ${deliveryMethod === 'pickup' ? 'bg-[#FFC300] text-black' : 'bg-black text-zinc-400 border border-zinc-800'}`}>Самовивіз</button><button onClick={() => setDeliveryMethod('newpost')} className={`py-2 rounded font-bold text-xs ${deliveryMethod === 'newpost' ? 'bg-red-600 text-white' : 'bg-black text-zinc-400 border border-zinc-800'}`}>Нова Пошта</button></div>{deliveryMethod === 'newpost' && (<div className="space-y-2 bg-zinc-800/50 p-2 rounded border border-zinc-700 text-sm"><select value={selectedRegion} onChange={e => { setSelectedRegion(e.target.value); setSelectedCity(''); }} className="w-full bg-black border border-zinc-700 rounded p-2 text-white"><option value="">Область</option>{MOCK_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}</select><select value={selectedCity} onChange={e => { setSelectedCity(e.target.value); setSelectedWarehouse(''); }} disabled={!selectedRegion} className="w-full bg-black border border-zinc-700 rounded p-2 text-white"><option value="">Місто</option>{selectedRegion && MOCK_CITIES[selectedRegion]?.map(c => <option key={c} value={c}>{c}</option>)}</select><select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)} disabled={!selectedCity} className="w-full bg-black border border-zinc-700 rounded p-2 text-white"><option value="">Відділення</option>{selectedCity && getMockWarehouses(selectedCity).map(w => <option key={w} value={w}>{w}</option>)}</select><div className="flex gap-2 pt-1"><label className="flex items-center gap-1 text-xs text-zinc-400"><input type="radio" checked={paymentMethod === 'prepayment'} onChange={() => setPaymentMethod('prepayment')} /> Предоплата</label><label className="flex items-center gap-1 text-xs text-zinc-400"><input type="radio" checked={paymentMethod === 'full'} onChange={() => setPaymentMethod('full')} /> Повна</label></div></div>)}</div>{orderError && <p className="text-red-500 text-sm mb-2">{orderError}</p>}<button onClick={submitOrder} disabled={orderSending} className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black py-4 rounded-xl flex justify-center items-center shadow-lg">{orderSending ? <Loader2 className="animate-spin" /> : 'ЗАМОВИТИ ВСЕ'}</button></div>)}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center"><div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-4"><Check size={40} /></div><h3 className="text-2xl font-bold text-white mb-2">Замовлення успішне!</h3><p className="text-zinc-400 mb-6">Дякуємо. Менеджер зв'яжеться з вами.</p><button onClick={() => { setIsCartOpen(false); setOrderSuccess(false); }} className="px-8 py-3 bg-zinc-800 text-white rounded-xl">Закрити</button></div>
              )}
           </div>
        </div>
      )}

      {lightboxOpen && currentLightboxImages.length > 0 && (<div className="fixed inset-0 z-[200] bg-black flex items-center justify-center animate-in fade-in duration-300"><button onClick={() => setLightboxOpen(false)} className="absolute top-4 right-4 text-white hover:text-[#FFC300] z-50 p-2"><X size={32}/></button><div className="w-full h-full flex items-center justify-center relative touch-pan-y" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>{currentLightboxImages.length > 1 && (<><button onClick={prevImage} className="absolute left-2 md:left-8 text-white/50 hover:text-white z-50 hidden md:block"><ChevronLeft size={48}/></button><button onClick={nextImage} className="absolute right-2 md:right-8 text-white/50 hover:text-white z-50 hidden md:block"><ChevronRight size={48}/></button></>)}<img src={currentLightboxImages[currentImageIndex]} alt="" className="max-w-full max-h-full object-contain pointer-events-none select-none" />{currentLightboxImages.length > 1 && (<div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">{currentLightboxImages.map((_, idx) => (<div key={idx} className={`w-2 h-2 rounded-full transition-colors ${idx === currentImageIndex ? 'bg-[#FFC300]' : 'bg-white/30'}`} />))}</div>)}</div></div>)}
    </div>
  );
};

export default TyreShop;
