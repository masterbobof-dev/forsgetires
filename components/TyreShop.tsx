
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { TyreProduct, CartItem } from '../types';
import { ShoppingBag, Loader2, Phone, X, Filter, Snowflake, Sun, CloudSun, Truck, Check, CreditCard, Wallet, ArrowDown, ShoppingCart, Plus, Minus, Trash2, ChevronLeft, ChevronRight, ZoomIn, Ban, Flame, Grid, ArrowUpDown, Search, DollarSign, AlertCircle, Tag, Briefcase, MapPin, Eye, EyeOff, Tractor, Route } from 'lucide-react';
import { PHONE_LINK_1, PHONE_NUMBER_1, FORMSPREE_ENDPOINT } from '../constants';
import { DEFAULT_IMG_CONFIG, DEFAULT_BG_CONFIG } from './admin/promo/shared';

const PAGE_SIZE = 60;

const AXLE_TYPES = ['Ведуча', 'Причіпна', 'Рульова', 'Рульова, автобусна', 'Рульова/Причіпна', 'Універсальна'];

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

const isValidImageUrl = (url: string | undefined | null): boolean => {
    if (!url) return false;
    const clean = url.trim().toLowerCase();
    return clean !== '' && clean !== 'null' && clean !== 'undefined' && clean.startsWith('http');
};

const CATEGORIES = [
  { id: 'all', label: 'Всі шини', icon: Grid },
  { id: 'winter', label: 'Зимові', icon: Snowflake },
  { id: 'summer', label: 'Літні', icon: Sun },
  { id: 'all-season', label: 'Всесезонні', icon: CloudSun },
  { id: 'cargo', label: 'Буси (C)', icon: Truck },
  { id: 'truck', label: 'Вантажні (TIR)', icon: Truck },
  { id: 'agro', label: 'Агро / Спец', icon: Tractor },
  { id: 'hot_light', label: 'HOT Легкові', icon: Flame },
  { id: 'hot_heavy', label: 'HOT Вантажні', icon: Flame },
  { id: 'out_of_stock', label: 'Архів', icon: Ban },
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
  
  const [selectedProductForModal, setSelectedProductForModal] = useState<TyreProduct | null>(null);

  // Filters
  const [activeCategory, setActiveCategory] = useState<CategoryType>(initialCategory);
  const [activeSort, setActiveSort] = useState<'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'with_photo' | 'no_photo'>('newest');
  const [searchQuery, setSearchQuery] = useState(''); 
  const [showOnlyInStock, setShowOnlyInStock] = useState(false); 
  const [filterWidth, setFilterWidth] = useState('');
  const [filterHeight, setFilterHeight] = useState('');
  const [filterRadius, setFilterRadius] = useState('');
  const [filterBrand, setFilterBrand] = useState(''); 
  const [filterAxle, setFilterAxle] = useState(''); 
  const [filterOptions, setFilterOptions] = useState({ widths: [], heights: [], radii: [], brands: [] });
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const [enableStockQty, setEnableStockQty] = useState(false);
  const [promoBanner, setPromoBanner] = useState<any>(null);
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prodId = params.get('product_id');
    if (prodId) {
        const fetchDeepLinkProduct = async () => {
            const { data } = await supabase.from('tyres').select('*').eq('id', prodId).single();
            if (data) setSelectedProductForModal(data);
        };
        fetchDeepLinkProduct();
    }
  }, []);

  const handleProductClick = (tyre: TyreProduct) => {
      setSelectedProductForModal(tyre);
      const newUrl = `${window.location.pathname}?product_id=${tyre.id}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const handleCloseModal = () => {
      setSelectedProductForModal(null);
      window.history.pushState({ path: window.location.pathname }, '', window.location.pathname);
  };

  useEffect(() => {
    const fetchGlobalSettings = async () => {
      const { data } = await supabase.from('settings').select('key, value');
      if (data) {
          data.forEach(item => {
              if (item.key === 'enable_stock_quantity') setEnableStockQty(item.value === 'true');
              if (item.key === 'contact_phone1') { setShopPhone(item.value); setShopPhoneLink(`tel:${item.value.replace(/[^\d+]/g, '')}`); }
              if (item.key === 'nova_poshta_key') setNovaPoshtaKey(item.value);
              if (item.key === 'promo_data' && item.value) { try { const p = JSON.parse(item.value); setPromoBanner(Array.isArray(p) ? p.find((x:any) => x.active) : (p.active ? p : null)); } catch(e){} }
          });
      }
    };
    fetchGlobalSettings();
  }, []);

  useEffect(() => {
    setPage(0);
    setTyres([]); 
    fetchTyres(0, true);
  }, [activeCategory, activeSort, enableStockQty, filterBrand, filterRadius, filterWidth, filterHeight, filterAxle, showOnlyInStock]);

  const fetchTyres = async (pageIndex: number, isRefresh = false) => {
    try {
      if (isRefresh) setLoading(true); else setLoadingMore(true);
      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase.from('tyres').select('*', { count: 'exact' });

      if (searchQuery.trim()) {
         const term = searchQuery.trim();
         query = query.or(`title.ilike.%${term}%,catalog_number.ilike.%${term}%,manufacturer.ilike.%${term}%`);
      }

      if (filterBrand) query = query.eq('manufacturer', filterBrand);
      if (filterRadius) query = query.eq('radius', filterRadius);
      if (filterWidth) query = query.ilike('title', `%${filterWidth}%`);
      if (filterHeight) query = query.ilike('title', `%/${filterHeight}%`);

      if (activeCategory === 'hot_light') query = query.eq('is_hot', true).or('vehicle_type.eq.car,vehicle_type.eq.suv,vehicle_type.eq.cargo');
      else if (activeCategory === 'hot_heavy') query = query.eq('is_hot', true).or('vehicle_type.eq.truck,vehicle_type.eq.agro');
      else if (activeCategory === 'winter') query = query.or('title.ilike.%winter%,title.ilike.%зима%');
      else if (activeCategory === 'summer') query = query.or('title.ilike.%summer%,title.ilike.%літо%');
      else if (activeCategory === 'all-season') query = query.or('title.ilike.%all season%,title.ilike.%всесезон%');
      else if (activeCategory === 'out_of_stock') query = query.eq('in_stock', false);

      query = query.order('in_stock', { ascending: false }).order('created_at', { ascending: false });

      const { data, error } = await query.range(from, to);
      if (error) throw error;

      if (data) {
        if (isRefresh) setTyres(data); else setTyres(prev => [...prev, ...data]);
        setPage(pageIndex);
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); setLoadingMore(false); }
  };

  const addToCart = (tyre: TyreProduct) => { 
      if (tyre.in_stock === false) return; 
      setCart(prev => { 
          const existing = prev.find(item => item.id === tyre.id);
          if (existing) return prev.map(item => item.id === tyre.id ? { ...item, quantity: item.quantity + 1 } : item); 
          return [...prev, { ...tyre, quantity: 1 }]; 
      }); 
      setIsCartOpen(true); 
  };

  const cartTotal = useMemo(() => cart.reduce((total, item) => total + (safeParsePrice(item.price) * item.quantity), 0), [cart]);

  return (
    <div className="min-h-screen bg-[#09090b] py-8 md:py-12 animate-in fade-in duration-500 pb-32">
      <div className="max-w-7xl mx-auto px-2 md:px-4">
        <div className="flex flex-col lg:flex-row justify-between items-start md:items-center gap-4 mb-8 px-2">
           <div className="shrink-0">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-2 border-b-2 border-[#FFC300] inline-block pb-2">Магазин Шин та Дисків</h2>
              <p className="text-zinc-400">Широкий вибір нових та б/в шин у Синельниковому.</p>
           </div>
           <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-4 w-full md:w-auto shrink-0">
              <div className="p-2 bg-[#FFC300] rounded-full text-black"><Phone size={20}/></div>
              <div><p className="text-xs text-zinc-500 uppercase font-bold">Консультація</p><a href={shopPhoneLink} className="text-white font-bold text-lg hover:text-[#FFC300]">{shopPhone}</a></div>
           </div>
        </div>

        {/* CATEGORIES */}
        <div className="mb-8 px-2">
           <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-10 gap-2 md:gap-3">
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl transition-all border ${activeCategory === cat.id ? 'bg-[#FFC300] border-[#FFC300] text-black shadow-lg' : 'bg-zinc-900 border-zinc-400 text-zinc-400 hover:text-white'}`}>
                   <cat.icon size={18} />
                   <span className="font-bold text-[10px] uppercase tracking-wide text-center leading-tight">{cat.label}</span>
                </button>
              ))}
           </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl mb-8 shadow-xl mx-2">
           <div className="flex gap-2">
              <div className="relative flex-grow">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18}/>
                 <input type="text" placeholder="Пошук..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchTyres(0, true)} className="w-full bg-black border border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-white outline-none focus:border-[#FFC300]" />
              </div>
              <button onClick={() => fetchTyres(0, true)} className="bg-[#FFC300] hover:bg-[#e6b000] text-black font-black px-6 py-3 rounded-xl uppercase tracking-wider text-sm md:text-base">ЗНАЙТИ</button>
           </div>
        </div>

        {loading ? (
           <div className="flex flex-col items-center justify-center py-20"><Loader2 className="animate-spin text-[#FFC300] mb-4" size={48} /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 px-2">
             {tyres.map((tyre) => {
                const hasPhoto = isValidImageUrl(tyre.image_url);
                return (
                <div key={tyre.id} onClick={() => handleProductClick(tyre)} className={`h-full bg-zinc-900 border rounded-xl overflow-hidden hover:border-[#FFC300] transition-colors group flex flex-col relative border-zinc-800 ${tyre.in_stock === false ? 'opacity-70' : ''}`}>
                   <div className={`aspect-square bg-black relative overflow-hidden cursor-pointer`}>
                      {hasPhoto ? (
                         <img src={tyre.image_url} alt={tyre.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                         <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 bg-zinc-950"><ShoppingBag size={32} className="opacity-20 mb-2"/><span className="text-xs font-bold">{tyre.in_stock === false ? 'Відсутнє' : 'Немає фото'}</span></div>
                      )}
                      {tyre.in_stock === false && <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center"><div className="bg-red-600 text-white px-3 py-1 font-black uppercase -rotate-12 border border-white text-xs">Немає</div></div>}
                   </div>
                   <div className="p-3 md:p-4 flex flex-col flex-grow">
                      <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">{tyre.manufacturer || 'Шина'}</div>
                      <h3 className="text-sm md:text-base font-bold text-white mb-4 leading-snug line-clamp-2 min-h-[2.5em]">{tyre.title}</h3>
                      <div className="mt-auto pt-3 border-t border-zinc-800 flex flex-col gap-3">
                         <span className="text-xl font-black text-[#FFC300]">{formatPrice(tyre.price)} <span className="text-xs font-normal text-zinc-500">грн</span></span>
                         <button onClick={(e) => { e.stopPropagation(); addToCart(tyre); }} disabled={tyre.in_stock === false} className={`w-full font-bold text-xs py-3 rounded-lg flex items-center justify-center gap-2 active:scale-95 uppercase transition-all ${tyre.in_stock === false ? 'bg-zinc-800 text-zinc-500' : 'bg-white text-black hover:bg-[#FFC300]'}`}>
                             <ShoppingCart size={14} /> КУПИТИ
                         </button>
                      </div>
                   </div>
                </div>
             )})}
          </div>
        )}
        
        {hasMore && !loading && (
           <div className="mt-12 text-center"><button onClick={() => fetchTyres(page + 1)} disabled={loadingMore} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-8 rounded-xl border border-zinc-700 flex items-center gap-2 mx-auto">{loadingMore ? <Loader2 className="animate-spin" /> : <ArrowDown size={20} />} Більше шин</button></div>
        )}
      </div>

      {/* CART OVERLAY */}
      {cart.length > 0 && <button onClick={() => setIsCartOpen(true)} className="fixed bottom-6 right-6 z-40 bg-[#FFC300] text-black p-4 rounded-full shadow-[0_0_20px_rgba(255,195,0,0.4)] animate-bounce"><div className="relative"><ShoppingCart size={28} /><div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border border-white">{cart.reduce((a,b) => a + b.quantity, 0)}</div></div></button>}
      
      {isCartOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex justify-end animate-in slide-in-from-right">
           <div className="w-full max-w-md bg-zinc-900 h-full border-l border-zinc-700 p-6 flex flex-col shadow-2xl">
              <button onClick={() => setIsCartOpen(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={24} /></button>
              <h2 className="text-2xl font-black text-white uppercase italic mb-6 flex items-center gap-2"><ShoppingCart className="text-[#FFC300]" /> Кошик</h2>
              <div className="flex-grow overflow-y-auto space-y-4 mb-4">
                {cart.map(item => (
                  <div key={item.id} className="bg-black border border-zinc-800 p-3 rounded-lg flex items-center gap-3">
                    <div className="w-16 h-16 bg-zinc-800 rounded flex-shrink-0 overflow-hidden">
                       {isValidImageUrl(item.image_url) && <img src={item.image_url} className="w-full h-full object-cover" alt="" />}
                    </div>
                    <div className="flex-grow"><h4 className="text-white font-bold text-sm leading-tight line-clamp-1">{item.title}</h4><p className="text-[#FFC300] font-mono text-sm">{formatPrice(item.price)} грн</p></div>
                    <button onClick={() => setCart(prev => prev.filter(x => x.id !== item.id))} className="text-zinc-600 hover:text-red-500"><Trash2 size={18}/></button>
                  </div>
                ))}
              </div>
              <div className="border-t border-zinc-800 pt-4">
                 <div className="flex justify-between text-xl font-black text-white mb-4"><span>Разом:</span><span className="text-[#FFC300]">{Math.round(cartTotal)} грн</span></div>
                 <button className="w-full bg-[#FFC300] text-black font-black py-4 rounded-xl shadow-lg">ОФОРМИТИ ЗАМОВЛЕННЯ</button>
              </div>
           </div>
        </div>
      )}

      {selectedProductForModal && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 md:p-4 animate-in fade-in duration-200" onClick={handleCloseModal}>
              <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl shadow-2xl relative flex flex-col md:flex-row overflow-hidden max-h-[90vh]" onClick={e => e.stopPropagation()}>
                  <button onClick={handleCloseModal} className="absolute top-4 right-4 text-zinc-500 hover:text-white z-20 bg-black/50 p-1 rounded-full"><X size={24} /></button>
                  <div className="w-full md:w-1/2 bg-black flex items-center justify-center min-h-[300px]">
                      {isValidImageUrl(selectedProductForModal.image_url) ? (
                          <img src={selectedProductForModal.image_url} className="w-full h-full object-cover" alt={selectedProductForModal.title} />
                      ) : (
                          <div className="flex flex-col items-center justify-center text-zinc-700"><ShoppingBag size={64} className="opacity-20 mb-4"/><span className="font-bold">Немає фото</span></div>
                      )}
                  </div>
                  <div className="w-full md:w-1/2 p-6 md:p-8 overflow-y-auto bg-zinc-900">
                      <div className="mb-6"><span className="text-zinc-500 font-bold uppercase tracking-wider text-xs mb-2 block">{selectedProductForModal.manufacturer}</span><h1 className="text-xl md:text-2xl font-black text-white leading-tight mb-2">{selectedProductForModal.title}</h1></div>
                      <div className="space-y-4 mb-8">
                          <div className="flex justify-between items-center border-b border-zinc-800 pb-2"><span className="text-zinc-400 text-sm">Діаметр</span><span className="text-[#FFC300] font-bold">{selectedProductForModal.radius || '-'}</span></div>
                          <div className="flex justify-between items-center border-b border-zinc-800 pb-2"><span className="text-zinc-400 text-sm">Виробник</span><span className="text-white font-bold">{selectedProductForModal.manufacturer || '-'}</span></div>
                          {selectedProductForModal.stock_quantity !== undefined && enableStockQty && <div className="flex justify-between items-center border-b border-zinc-800 pb-2"><span className="text-zinc-400 text-sm">В наявності</span><span className="text-green-400 font-bold">{selectedProductForModal.stock_quantity} шт.</span></div>}
                      </div>
                      <div className="mt-auto"><div className="mb-4"><span className="text-3xl font-black text-[#FFC300]">{formatPrice(selectedProductForModal.price)} <span className="text-base text-white font-normal">грн</span></span></div><button onClick={() => { addToCart(selectedProductForModal); handleCloseModal(); }} className="w-full py-4 rounded-xl font-bold text-lg bg-white text-black hover:bg-[#FFC300] shadow-lg flex items-center justify-center gap-2"><ShoppingCart size={20} /> КУПИТИ ЗАРАЗ</button></div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default TyreShop;
