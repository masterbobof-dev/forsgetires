
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { TyreProduct, CartItem } from '../types';
import { Loader2, Phone, ArrowDown, ArrowLeft, X, ShoppingCart } from 'lucide-react';
import { PHONE_LINK_1, PHONE_NUMBER_1, FORMSPREE_ENDPOINT } from '../constants';

// Підкомпоненти
import CartDrawer from './shop/CartDrawer';
import ProductDetailModal from './shop/ProductDetailModal';
import CategoryNav, { CategoryType } from './shop/CategoryNav';
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
  const [selectedProductForModal, setSelectedProductForModal] = useState<TyreProduct | null>(null);

  const [activeCategory, setActiveCategory] = useState<CategoryType>(initialCategory);
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

  // --- LOGIC: FETCHING SETTINGS ---
  useEffect(() => {
    const fetchSettings = async () => {
      const { data: setts } = await supabase.from('settings').select('key, value').in('key', ['enable_stock_quantity', 'contact_phone1', 'nova_poshta_key']);
      if (setts) {
          setts.forEach(item => {
              if (item.key === 'enable_stock_quantity') setEnableStockQty(item.value === 'true');
              if (item.key === 'contact_phone1') { setShopPhone(item.value); setShopPhoneLink(`tel:${item.value.replace(/[^\d+]/g, '')}`); }
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
      else if (['winter','summer','all-season'].includes(activeCategory)) query = query.eq('season', activeCategory);
      else if (activeCategory.startsWith('hot')) query = query.eq('is_hot', true);
      
      query = query.order('in_stock', { ascending: false });
      const sorts = { price_asc: 'price', price_desc: 'price', newest: 'created_at', oldest: 'created_at' };
      query = query.order((sorts as any)[activeSort] || 'created_at', { ascending: ['price_asc','oldest'].includes(activeSort) });

      const { data, error } = await query.range(from, to);
      if (error) throw error;
      if (data) {
        let processed = data.map(parseTyreSpecs);
        setTyres(isRefresh ? processed : prev => [...prev, ...processed]); 
        setPage(pageIndex);
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); setLoadingMore(false); }
  };

  // --- LOGIC: CART ---
  const addToCart = (tyre: TyreProduct) => { 
      if (!tyre.in_stock) return; 
      setCart(prev => { 
          const ex = prev.find(item => item.id === tyre.id);
          return ex ? prev.map(i => i.id === tyre.id ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { ...tyre, quantity: 1 }]; 
      }); 
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
          items: cart.map(i => ({ id: i.id, title: i.title, quantity: i.quantity, price: i.price })) 
      }]);
      if (error) throw error;
      setOrderSuccess(true); setCart([]);
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
    const s = { "@context": "https://schema.org/", "@type": "Product", "name": product.title, "image": product.image_url, "offers": { "@type": "Offer", "price": safeParsePrice(product.price), "priceCurrency": "UAH", "availability": product.in_stock ? "InStock" : "OutOfStock" } };
    return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />;
  };

  return (
    <div className="min-h-screen bg-[#09090b] py-8 md:py-12 animate-in fade-in pb-32">
      <div className="max-w-7xl mx-auto px-2 md:px-4">
        
        <header className="flex flex-col lg:flex-row justify-between items-start md:items-center gap-6 mb-8 px-2">
           <div className="flex flex-col gap-4">
              <button onClick={() => window.history.back()} className="flex items-center gap-2 text-zinc-500 hover:text-[#FFC300] font-bold text-sm transition-colors">
                <ArrowLeft size={18} /> На головну
              </button>
              <h1 className="text-3xl md:text-4xl font-black text-white border-b-2 border-[#FFC300] inline-block pb-2">Магазин Шин та Дисків</h1>
           </div>
           <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-4 w-full md:w-auto">
              <div className="p-2 bg-[#FFC300] rounded-full text-black"><Phone size={20}/></div>
              <div><p className="text-xs text-zinc-500 font-bold uppercase">Консультація</p><a href={shopPhoneLink} className="text-white font-bold text-lg">{shopPhone}</a></div>
           </div>
        </header>
        
        <CategoryNav activeCategory={activeCategory} onCategoryChange={setActiveCategory} />

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
          onReset={() => { setSearchQuery(''); setFilterWidth(''); setFilterHeight(''); setFilterRadius(''); setFilterBrand(''); }}
        />

        {loading ? (
           <div className="flex flex-col items-center justify-center py-20"><Loader2 className="animate-spin text-[#FFC300] mb-4" size={48} /><p className="text-zinc-500">Завантаження...</p></div>
        ) : tyres.length === 0 ? (
           <div className="text-center py-20 bg-zinc-900 rounded-xl border border-zinc-800 mx-2 text-zinc-500 font-bold">За вашим запитом нічого не знайдено</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 px-2">
             {tyres.map((tyre) => (
                <ProductCard 
                  key={tyre.id} 
                  tyre={tyre} 
                  onClick={() => handleProductClick(tyre)} 
                  onAddToCart={(e) => { e.stopPropagation(); addToCart(tyre); }} 
                  formatPrice={formatPrice}
                />
             ))}
          </div>
        )}

        {hasMore && <div className="mt-12 text-center"><button onClick={() => fetchTyres(page+1)} disabled={loadingMore} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-8 rounded-xl border border-zinc-700 transition-colors flex items-center justify-center gap-2 mx-auto">{loadingMore ? <Loader2 className="animate-spin" size={20}/> : <ArrowDown size={20}/>} Завантажити ще</button></div>}
      </div>

      {cart.length > 0 && (
        <button onClick={() => setIsCartOpen(true)} className="fixed bottom-6 right-6 z-40 bg-[#FFC300] text-black p-4 rounded-full shadow-2xl animate-bounce hover:scale-110 transition-transform">
           <div className="relative">
             <ShoppingCart size={28} />
             <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-zinc-900">{cart.reduce((a,b)=>a+b.quantity,0)}</div>
           </div>
        </button>
      )}

      <CartDrawer 
        isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} cart={cart} cartTotal={useMemo(() => cart.reduce((a,b) => a + (safeParsePrice(b.price)*b.quantity), 0), [cart])}
        orderName={orderName} setOrderName={setOrderName} orderPhone={orderPhone} setOrderPhone={setOrderPhone}
        deliveryMethod={deliveryMethod} setDeliveryMethod={setDeliveryMethod} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
        npSearchCity={npSearchCity} handleCityInputChange={(e) => { setNpSearchCity(e.target.value); if(e.target.value.length > 2) fetchNpCities(e.target.value); }}
        isNpLoadingCities={isNpLoadingCities} showCityDropdown={showCityDropdown} npCities={npCities}
        handleCitySelect={(city) => { setNpSearchCity(city.Present); setSelectedCityName(city.Present); setSelectedCityRef(city.DeliveryCity); setShowCityDropdown(false); fetchNpWarehouses(city.DeliveryCity); }}
        selectedWarehouseName={selectedWarehouseName} setSelectedWarehouseName={setSelectedWarehouseName} isNpLoadingWarehouses={isNpLoadingWarehouses} npWarehouses={npWarehouses}
        selectedCityRef={selectedCityRef} formatPrice={formatPrice} orderSending={orderSending} orderSuccess={orderSuccess} orderError={orderError}
        setOrderSuccess={setOrderSuccess} submitOrder={submitOrder} removeFromCart={(id) => setCart(prev => prev.filter(i => i.id !== id))}
        updateQuantity={(id, d) => setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + d) } : i))}
      />

      <ProductDetailModal 
        product={selectedProductForModal} onClose={() => setSelectedProductForModal(null)} 
        addToCart={addToCart} formatPrice={formatPrice} getSeasonLabel={getSeasonLabel} renderSchema={renderSchema}
        openLightbox={(p) => { setCurrentLightboxImages([p.image_url].filter(Boolean) as string[]); setLightboxOpen(true); }}
      />

      {lightboxOpen && (
        <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-4 animate-in fade-in" onClick={() => setLightboxOpen(false)}>
          <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full"><X size={32}/></button>
          <img src={currentLightboxImages[0]} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
};

export default TyreShop;
