
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { TyreProduct, CartItem } from '../types';
import { Loader2, Phone, ArrowDown, ArrowLeft, X, ShoppingCart, Lock } from 'lucide-react';
import { PHONE_LINK_1, PHONE_NUMBER_1, FORMSPREE_ENDPOINT } from '../constants';

// Підкомпоненти
import CartDrawer from './shop/CartDrawer';
import ProductDetailModal from './shop/ProductDetailModal';
import CategoryNav, { CategoryType, CATEGORIES } from './shop/CategoryNav';
import FilterToolbar from './shop/FilterToolbar';
import ProductCard from './shop/ProductCard';

const PAGE_SIZE = 60;

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

const getSeasonLabel = (s: string | undefined) => {
    if(s === 'winter') return 'Зимова';
    if(s === 'summer') return 'Літня';
    if(s === 'all-season') return 'Всесезонна';
    return 'Універсальна';
}

interface TyreShopProps {
  initialCategory?: CategoryType;
  initialProduct?: TyreProduct | null;
  onBack?: () => void;
  isAdmin?: boolean;
  onAdminClick?: () => void;
  cartItems: CartItem[];
  onCartChange: (items: CartItem[]) => void;
}

const TyreShop: React.FC<TyreShopProps> = ({ 
  initialCategory = 'all', 
  initialProduct, 
  onBack, 
  isAdmin, 
  onAdminClick,
  cartItems,
  onCartChange
}) => {
  const [tyres, setTyres] = useState<TyreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [isCartOpen, setIsCartOpen] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentLightboxImages, setCurrentLightboxImages] = useState<string[]>([]);
  const [selectedProductForModal, setSelectedProductForModal] = useState<TyreProduct | null>(null);

  const [activeCategory, setActiveCategory] = useState<CategoryType>(initialCategory);

  // --- LOGIC: SYNC INITIAL CATEGORY ---
  useEffect(() => {
    setActiveCategory(initialCategory);
  }, [initialCategory]);

  const [activeSort, setActiveSort] = useState<'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'with_photo' | 'no_photo'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyInStock, setShowOnlyInStock] = useState(false);

  const [filterWidth, setFilterWidth] = useState('');
  const [filterHeight, setFilterHeight] = useState('');
  const [filterRadius, setFilterRadius] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterOptions, setFilterOptions] = useState({ widths: [] as string[], heights: [] as string[], radii: [] as string[], brands: [] as string[] });
  
  const [enableStockQty, setEnableStockQty] = useState(false);
  const [novaPoshtaKey, setNovaPoshtaKey] = useState('');
  const [shopPhone, setShopPhone] = useState(PHONE_NUMBER_1);
  const [shopPhoneLink, setShopPhoneLink] = useState(PHONE_LINK_1);

  const [orderName, setOrderName] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'newpost'>('pickup');
  const [paymentMethod, setPaymentMethod] = useState<'prepayment' | 'full'>('prepayment');
  
  const [npSearchCity, setNpSearchCity] = useState('');
  const [npCities, setNpCities] = useState<any[]>([]);
  const [npWarehouses, setNpWarehouses] = useState<any[]>([]);
  const [selectedCityRef, setSelectedCityRef] = useState('');
  const [selectedCityName, setSelectedCityName] = useState('');
  const [selectedWarehouseName, setSelectedWarehouseName] = useState('');
  const [isNpLoadingCities, setIsNpLoadingCities] = useState(false);
  const [isNpLoadingWarehouses, setIsNpLoadingWarehouses] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  const [orderSending, setOrderSending] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState('');

  const [quickOrderProduct, setQuickOrderProduct] = useState<TyreProduct | null>(null);
  const [quickOrderPhone, setQuickOrderPhone] = useState('');
  const [quickOrderSending, setQuickOrderSending] = useState(false);

  // --- LOGIC: HANDLE INITIAL PRODUCT & URL SYNC ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('p') || urlParams.get('product');

    if (productId && tyres.length > 0) {
      const p = tyres.find(t => String(t.id) === productId);
      if (p) setSelectedProductForModal(p);
    } else if (initialProduct) {
      setSelectedProductForModal(initialProduct);
    }
  }, [initialProduct, tyres.length]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedProductForModal) {
      // SEO: Dynamic Title
      document.title = `${selectedProductForModal.title} — Купити шини ${selectedProductForModal.radius} в Україні | Forsage Tires`;
      
      // SEO: Meta Description
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', `Купити ${selectedProductForModal.title}. Ціна: ${formatPrice(selectedProductForModal.price)} грн. В наявності. Безкоштовний підбір та доставка по Україні.`);

      // Sync URL
      url.searchParams.set('p', String(selectedProductForModal.id));
      window.history.replaceState({}, '', url.toString());
    } else {
      document.title = "Forsage Tires — Магазин шин та дисків у Синельниково";
      url.searchParams.delete('p');
      window.history.replaceState({}, '', url.toString());
    }
  }, [selectedProductForModal]);

  // ... (rest of the code)

  const submitQuickOrder = async () => {
    if (!quickOrderPhone || quickOrderPhone.length < 9) { setOrderError("Введіть коректний номер телефону"); return; }
    if (!quickOrderProduct) return;
    
    setQuickOrderSending(true); setOrderError('');
    try {
      const { error } = await supabase.from('tyre_orders').insert([{ 
          customer_name: 'Швидке замовлення', 
          customer_phone: quickOrderPhone, 
          status: 'new', 
          items: [{ id: quickOrderProduct.id, title: quickOrderProduct.title, quantity: 1, price: quickOrderProduct.price }] 
      }]);
      if (error) throw error;
      setOrderSuccess(true);
      setQuickOrderProduct(null);
      setQuickOrderPhone('');
    } catch (err) { setOrderError("Помилка при відправці замовлення"); } finally { setQuickOrderSending(false); }
  };

  // --- NOVA POSHTA LOGIC ---

  // --- LOGIC: FETCHING SETTINGS ---
  useEffect(() => {
    const fetchSettings = async () => {
      const { data: setts } = await supabase.from('settings').select('key, value').in('key', ['enable_stock_quantity', 'contact_phone1', 'nova_poshta_key']);
      if (setts) {
          setts.forEach(item => {
              if (item.key === 'enable_stock_quantity') setEnableStockQty(item.value === 'true');
              if (item.key === 'contact_phone1') { 
                  setShopPhone(item.value); 
                  const digits = item.value.replace(/[^\d]/g, '');
                  const link = digits.startsWith('0') && digits.length === 10 ? `+38${digits}` : digits.startsWith('380') ? `+${digits}` : digits;
                  setShopPhoneLink(`tel:${link}`); 
              }
              if (item.key === 'nova_poshta_key') setNovaPoshtaKey(item.value);
          });
      }
      
      const { data: tData } = await supabase.from('tyres').select('manufacturer, radius, title').neq('in_stock', false);
      if (tData) {
          const brands = new Set<string>(), radii = new Set<string>(), widths = new Set<string>(), heights = new Set<string>();
          tData.forEach(item => {
              if (item.manufacturer) { let b = item.manufacturer.trim(); brands.add(b); }
              if (item.radius) radii.add(item.radius.trim());
              const m = item.title.match(/(\d{3})[\/\s](\d{2})/);
              if (m) { widths.add(m[1]); heights.add(m[2]); }
          });
          setFilterOptions({ 
              brands: Array.from(brands).sort(), 
              radii: Array.from(radii).sort((a, b) => parseFloat(a.replace(/[^\d.]/g, '')) - parseFloat(b.replace(/[^\d.]/g, ''))), 
              widths: Array.from(widths).sort(), 
              heights: Array.from(heights).sort() 
          });
      }
    };
    fetchSettings();
  }, []);

  // --- LOGIC: TYRE DATA ---
  useEffect(() => {
    setPage(0);
    setTyres([]); 
    fetchTyres(0, true);
  }, [activeCategory, activeSort, enableStockQty, filterBrand, filterRadius, filterWidth, filterHeight, showOnlyInStock, searchQuery]);

  const parseTyreSpecs = (tyre: TyreProduct): TyreProduct => {
    const m = tyre.title.match(/(\d{3})[\/\s](\d{2})[\s\w]*R(\d{2}(?:\.5|\.3)?[C|c]?)/);
    let width = '', height = '', parsedRadius = tyre.radius || '', vehicle_type = tyre.vehicle_type || 'car';
    if (m) { 
        width = m[1]; height = m[2]; 
        const r = m[3].toUpperCase(); 
        if (!parsedRadius) parsedRadius = `R${r}`; 
        if (vehicle_type === 'car' && r.endsWith('C')) vehicle_type = 'cargo'; 
    }
    const lt = (tyre.title + ' ' + (tyre.description || '')).toLowerCase();
    let season = tyre.season || 'all'; 
    if (!tyre.season) { 
        if (['зима','winter','snow','ice'].some(x => lt.includes(x))) season = 'winter'; 
        else if (['літо','summer'].some(x => lt.includes(x))) season = 'summer'; 
        else if (['всесезон','all season'].some(x => lt.includes(x))) season = 'all-season'; 
    }
    let in_stock = enableStockQty ? (tyre.in_stock !== false && (tyre.stock_quantity ?? 0) > 0) : tyre.in_stock !== false;
    return { ...tyre, width, height, radius: parsedRadius, season, vehicle_type, in_stock };
  };

  const fetchTyres = async (pageIndex: number, isRefresh = false) => {
    try {
      if (isRefresh) setLoading(true); else setLoadingMore(true);
      const from = pageIndex * PAGE_SIZE, to = from + PAGE_SIZE - 1;
      let query = supabase.from('tyres').select('*', { count: 'exact' });
      
      if (searchQuery.trim()) query = query.or(`title.ilike.%${searchQuery.trim()}%,catalog_number.ilike.%${searchQuery.trim()}%,manufacturer.ilike.%${searchQuery.trim()}%`);
      if (filterBrand) query = query.eq('manufacturer', filterBrand);
      if (filterRadius) query = query.eq('radius', filterRadius);
      if (filterWidth) query = query.ilike('title', `%${filterWidth}%`);
      if (filterHeight) query = query.ilike('title', `%/${filterHeight}%`);
      if (showOnlyInStock) query = query.neq('in_stock', false);

      if (activeCategory === 'cargo') query = query.or('vehicle_type.eq.cargo,radius.ilike.%C%');
      else if (activeCategory === 'truck') query = query.eq('vehicle_type', 'truck');
      else if (activeCategory === 'agro') query = query.eq('vehicle_type', 'agro');
      else if (activeCategory === 'suv') query = query.eq('vehicle_type', 'suv');
      else if (activeCategory === 'out_of_stock') query = query.eq('in_stock', false);
      else if (['winter','summer','all-season'].includes(activeCategory)) query = query.eq('season', activeCategory);
      else if (activeCategory.startsWith('hot')) query = query.eq('is_hot', true);
      
      query = query.order('in_stock', { ascending: false });
      const sorts = { price_asc: 'price', price_desc: 'price', newest: 'created_at', oldest: 'created_at' };
      query = query.order((sorts as any)[activeSort] || 'created_at', { ascending: ['price_asc','oldest'].includes(activeSort) });

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      if (data) {
        let processed = data.map(parseTyreSpecs);
        
        // Thorough deduplication of the new data itself
        const uniqueNew = Array.from(new Map(processed.map(item => [item.id, item])).values()) as TyreProduct[];

        setTyres(isRefresh ? uniqueNew : prev => {
            const newIds = new Set(uniqueNew.map(d => d.id));
            return [...prev.filter(p => !newIds.has(p.id)), ...uniqueNew];
        }); 
        setPage(pageIndex);
        setHasMore(data.length === PAGE_SIZE);
        if (count !== null) setTotalCount(count);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); setLoadingMore(false); }
  };

  // --- LOGIC: CART ---
  const addToCart = (tyre: TyreProduct) => { 
      if (!tyre.in_stock) return; 
      const ex = cartItems.find(item => item.id === tyre.id);
      const newCart = ex 
        ? cartItems.map(i => i.id === tyre.id ? { ...i, quantity: i.quantity + 1 } : i) 
        : [...cartItems, { ...tyre, quantity: 1 }];
      onCartChange(newCart);
      setIsCartOpen(true); 
  };

  const submitOrder = async () => {
    if (!orderName || orderPhone.length < 9) { setOrderError("Будь ласка, введіть ім'я та телефон"); return; }
    setOrderSending(true); setOrderError('');
    try {
      const { error } = await supabase.from('tyre_orders').insert([{ 
          customer_name: orderName, 
          customer_phone: orderPhone, 
          status: 'new', 
          delivery_method: deliveryMethod, 
          delivery_city: selectedCityName, 
          delivery_warehouse: selectedWarehouseName, 
          payment_method: paymentMethod, 
          items: cartItems.map(i => ({ id: i.id, title: i.title, quantity: i.quantity, price: i.price })) 
      }]);
      if (error) throw error;
      setOrderSuccess(true); 
      onCartChange([]);
    } catch (err) { setOrderError("Помилка при відправці замовлення"); } finally { setOrderSending(false); }
  };

  // --- NOVA POSHTA LOGIC ---
  const fetchNpCities = async (term: string) => {
    if(!novaPoshtaKey) return;
    setIsNpLoadingCities(true);
    try {
        const res = await fetch('https://api.novaposhta.ua/v2.0/json/', {
            method: 'POST',
            body: JSON.stringify({ apiKey: novaPoshtaKey, modelName: "Address", calledMethod: "searchSettlements", methodProperties: { CityName: term, Limit: "20" } })
        });
        const data = await res.json();
        if (data.success) { setNpCities(data.data[0]?.Addresses || []); setShowCityDropdown(true); }
    } catch (e) { console.error(e); } finally { setIsNpLoadingCities(false); }
  };

  const fetchNpWarehouses = async (cityRef: string) => {
    if(!novaPoshtaKey) return;
    setIsNpLoadingWarehouses(true);
    try {
        const res = await fetch('https://api.novaposhta.ua/v2.0/json/', {
            method: 'POST',
            body: JSON.stringify({ apiKey: novaPoshtaKey, modelName: "Address", calledMethod: "getWarehouses", methodProperties: { CityRef: cityRef } })
        });
        const data = await res.json();
        if (data.success) setNpWarehouses(data.data);
    } catch (e) { console.error(e); } finally { setIsNpLoadingWarehouses(false); }
  };

  // --- HELPERS ---
  const handleProductClick = (tyre: TyreProduct) => {
    if (tyre.in_stock !== false) setSelectedProductForModal(tyre);
  };

  const renderSchema = (product: TyreProduct) => {
    const schema = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": product.title,
      "image": [product.image_url, ...(product.gallery || [])].filter(Boolean),
      "description": product.description || `Якісна шина ${product.title} для вашого авто. В наявності на Forsage Tires.`,
      "sku": `tyre-${product.id}`,
      "brand": {
        "@type": "Brand",
        "name": product.manufacturer || "Forsage Tires"
      },
      "offers": {
        "@type": "Offer",
        "url": `https://www.forsage-tires.com/?p=${product.id}`,
        "priceCurrency": "UAH",
        "price": safeParsePrice(product.price),
        "priceValidUntil": "2026-12-31",
        "availability": product.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        "itemCondition": "https://schema.org/NewCondition"
      }
    };
    return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />;
  };

  return (
    <div className="min-h-screen bg-[#09090b] py-4 md:py-12 animate-in fade-in duration-500 pb-32">
      <div className="max-w-7xl mx-auto px-2 md:px-4">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-6 mb-5 md:mb-10 px-2">
           <div className="flex flex-col gap-2 md:gap-4">
              <nav className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-zinc-600">
                <button onClick={onBack} className="hover:text-[#FFC300] transition-colors">Головна</button>
                <span className="text-zinc-800">/</span>
                <span className="text-zinc-400">Магазин шин</span>
                {activeCategory !== 'all' && (
                  <>
                    <span className="text-zinc-800">/</span>
                    <span className="text-[#FFC300]">{CATEGORIES.find(c => c.id === activeCategory)?.label}</span>
                  </>
                )}
              </nav>
              <div className="flex flex-col">
                <h1 className="text-2xl md:text-5xl font-black text-white tracking-tighter mb-1 uppercase italic">
                  Магазин <span className="text-[#FFC300]">шин</span>
                </h1>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <span className="w-8 h-[1px] bg-[#FFC300]"></span>
                  Знайдено {totalCount} товарів
                </p>
              </div>
           </div>
           
           <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto">
              {isAdmin && (
                <button
                  onClick={onAdminClick}
                  className="flex-1 md:flex-none bg-zinc-900/80 backdrop-blur-sm border border-[#FFC300]/30 p-2.5 md:p-4 rounded-xl md:rounded-2xl flex items-center gap-2 md:gap-4 hover:border-[#FFC300] transition-all group shadow-lg shadow-yellow-900/10"
                >
                  <div className="p-2 md:p-3 bg-zinc-800 rounded-lg md:rounded-xl text-[#FFC300] group-hover:scale-110 transition-transform">
                    <Lock size={16} strokeWidth={2.5}/>
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-0.5">Адмін</p>
                    <span className="text-white font-black text-xs uppercase tracking-wider">Повернутися</span>
                  </div>
                </button>
              )}
              <div className="flex-1 md:flex-none bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 p-2.5 md:p-4 rounded-xl md:rounded-2xl flex items-center gap-2 md:gap-4 hover:border-zinc-700 transition-colors group">
                <div className="p-2 md:p-3 bg-[#FFC300] rounded-lg md:rounded-xl text-black group-hover:scale-110 transition-transform shadow-lg shadow-yellow-900/20">
                  <Phone size={16} strokeWidth={2.5}/>
                </div>
                <div>
                  <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-0.5">Підбір шин</p>
                  <a href={shopPhoneLink} className="text-white font-black text-sm md:text-lg hover:text-[#FFC300] transition-colors">{shopPhone}</a>
                </div>
              </div>
           </div>
        </header>
        
        <CategoryNav 
          activeCategory={activeCategory} 
          onCategoryChange={(cat) => {
            if (cat === 'all') {
              setSearchQuery('');
              setFilterWidth('');
              setFilterHeight('');
              setFilterRadius('');
              setFilterBrand('');
              setShowOnlyInStock(false);
            }
            setActiveCategory(cat);
          }} 
        />

        <FilterToolbar 
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          showOnlyInStock={showOnlyInStock} setShowOnlyInStock={setShowOnlyInStock}
          filterWidth={filterWidth} setFilterWidth={setFilterWidth}
          filterHeight={filterHeight} setFilterHeight={setFilterHeight}
          filterRadius={filterRadius} setFilterRadius={setFilterRadius}
          filterBrand={filterBrand} setFilterBrand={setFilterBrand}
          activeSort={activeSort} setActiveSort={setActiveSort}
          filterOptions={filterOptions}
          onSearch={() => fetchTyres(0, true)}
          onReset={() => { setSearchQuery(''); setFilterWidth(''); setFilterHeight(''); setFilterRadius(''); setFilterBrand(''); setActiveCategory('all'); }}
        />

        {loading ? (
           <div className="flex flex-col items-center justify-center py-32 animate-pulse">
              <Loader2 className="animate-spin text-[#FFC300] mb-6" size={64} strokeWidth={1} />
              <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Завантаження каталогу...</p>
           </div>
        ) : tyres.length === 0 ? (
           <div className="text-center py-32 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800 mx-2 flex flex-col items-center gap-6">
              <div className="p-6 bg-zinc-800/50 rounded-full text-zinc-600">
                <ShoppingCart size={48} strokeWidth={1}/>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Нічого не знайдено</h3>
                <p className="text-zinc-500 text-sm max-w-xs mx-auto">Спробуйте змінити параметри фільтрації або скинути їх</p>
              </div>
              <button onClick={() => { setSearchQuery(''); setFilterWidth(''); setFilterHeight(''); setFilterRadius(''); setFilterBrand(''); setActiveCategory('all'); }} className="bg-white text-black font-black px-8 py-3 rounded-xl hover:bg-[#FFC300] transition-all">Скинути все</button>
           </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8 px-2">
             {tyres.map((tyre, idx) => (
                <div key={tyre.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${Math.min(idx * 50, 500)}ms` }}>
                  <ProductCard 
                    tyre={tyre} 
                    onClick={() => handleProductClick(tyre)} 
                    onAddToCart={(e) => { e.stopPropagation(); addToCart(tyre); }} 
                    onQuickOrder={(p) => setQuickOrderProduct(p)}
                    formatPrice={formatPrice}
                  />
                </div>
             ))}
          </div>
        )}

        {hasMore && (
          <div className="mt-20 text-center">
            <button 
              onClick={() => fetchTyres(page+1)} 
              disabled={loadingMore} 
              className="group relative bg-zinc-900 hover:bg-zinc-800 text-white font-black py-5 px-12 rounded-2xl border border-zinc-800 transition-all shadow-xl hover:shadow-yellow-900/5 flex items-center justify-center gap-4 mx-auto overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              {loadingMore ? <Loader2 className="animate-spin" size={24}/> : <ArrowDown size={24} className="group-hover:translate-y-1 transition-transform"/>} 
              <span className="uppercase tracking-widest text-sm">Показати ще товари</span>
            </button>
            <p className="mt-4 text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
              Показано {tyres.length} з {totalCount}
            </p>
          </div>
        )}
      </div>

      {cartItems.length > 0 && (
        <button onClick={() => setIsCartOpen(true)} className="fixed bottom-6 right-6 z-40 bg-[#FFC300] text-black p-4 rounded-full shadow-2xl animate-bounce hover:scale-110 transition-transform">
           <div className="relative">
             <ShoppingCart size={28} />
             <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-zinc-900">{cartItems.reduce((a,b)=>a+b.quantity,0)}</div>
           </div>
        </button>
      )}

      <CartDrawer 
        isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} cart={cartItems} cartTotal={useMemo(() => cartItems.reduce((a,b) => a + (safeParsePrice(b.price)*b.quantity), 0), [cartItems])}
        orderName={orderName} setOrderName={setOrderName} orderPhone={orderPhone} setOrderPhone={setOrderPhone}
        deliveryMethod={deliveryMethod} setDeliveryMethod={setDeliveryMethod} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
        npSearchCity={npSearchCity} handleCityInputChange={(e) => { setNpSearchCity(e.target.value); if(e.target.value.length > 2) fetchNpCities(e.target.value); }}
        isNpLoadingCities={isNpLoadingCities} showCityDropdown={showCityDropdown} npCities={npCities}
        handleCitySelect={(city) => { setNpSearchCity(city.Present); setSelectedCityName(city.Present); setSelectedCityRef(city.DeliveryCity); setShowCityDropdown(false); fetchNpWarehouses(city.DeliveryCity); }}
        selectedWarehouseName={selectedWarehouseName} setSelectedWarehouseName={setSelectedWarehouseName} isNpLoadingWarehouses={isNpLoadingWarehouses} npWarehouses={npWarehouses}
        selectedCityRef={selectedCityRef} formatPrice={formatPrice} orderSending={orderSending} orderSuccess={orderSuccess} orderError={orderError}
        setOrderSuccess={setOrderSuccess} submitOrder={submitOrder} removeFromCart={(id) => onCartChange(cartItems.filter(i => i.id !== id))}
        updateQuantity={(id, d) => onCartChange(cartItems.map(i => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + d) } : i))}
      />

      <ProductDetailModal 
        product={selectedProductForModal} onClose={() => setSelectedProductForModal(null)} 
        addToCart={addToCart} formatPrice={formatPrice} getSeasonLabel={getSeasonLabel} renderSchema={renderSchema}
        openLightbox={(p) => { setCurrentLightboxImages([p.image_url].filter(Boolean) as string[]); setLightboxOpen(true); }}
        onQuickOrder={(p) => setQuickOrderProduct(p)}
      />

      {lightboxOpen && (
        <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-4 animate-in fade-in" onClick={() => setLightboxOpen(false)}>
          <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full"><X size={32}/></button>
          <img src={currentLightboxImages[0]} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
        </div>
      )}

      {quickOrderProduct && (
        <div className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in zoom-in duration-300" onClick={() => setQuickOrderProduct(null)}>
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl w-full max-w-md shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setQuickOrderProduct(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={24}/></button>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="bg-[#FFC300]/10 p-4 rounded-full text-[#FFC300] mb-2">
                <Phone size={32} strokeWidth={2.5}/>
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Купити в 1 клік</h3>
              <p className="text-zinc-500 text-sm">Введіть ваш номер телефону, і ми зателефонуємо вам для оформлення замовлення.</p>
              
              <div className="w-full mt-4">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2 text-left">Ваш телефон</p>
                <input 
                  type="tel" 
                  placeholder="0XX XXX XX XX" 
                  value={quickOrderPhone}
                  onChange={e => setQuickOrderPhone(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl py-4 px-6 text-white text-xl font-black focus:border-[#FFC300] outline-none transition-all placeholder:text-zinc-800"
                />
              </div>

              {orderError && <p className="text-red-500 text-xs font-bold bg-red-500/10 p-3 rounded-xl w-full">{orderError}</p>}

              <button 
                onClick={submitQuickOrder}
                disabled={quickOrderSending}
                className="w-full bg-[#FFC300] hover:bg-white text-black font-black py-5 rounded-2xl mt-4 transition-all active:scale-95 shadow-xl shadow-yellow-900/20 uppercase tracking-widest flex items-center justify-center gap-3"
              >
                {quickOrderSending ? <Loader2 className="animate-spin" size={24}/> : "Замовити дзвінок"}
              </button>
              
              <p className="text-[9px] text-zinc-600 font-bold uppercase mt-4">Натискаючи кнопку, ви погоджуєтесь на обробку персональних даних.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TyreShop;
