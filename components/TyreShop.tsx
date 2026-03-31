
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { TyreProduct, CartItem } from '../types';
import { Loader2, Phone, ArrowDown, ArrowLeft, ArrowRight, MapPin, X, ShoppingCart, Lock } from 'lucide-react';
import { PHONE_LINK_1, PHONE_NUMBER_1, FORMSPREE_ENDPOINT, TELEGRAM_LINK, VIBER_LINK } from '../constants';

// Підкомпоненти
import CartDrawer from './shop/CartDrawer';
import ProductDetailModal from './shop/ProductDetailModal';
import CategoryNav, { CategoryType, CATEGORIES } from './shop/CategoryNav';
import FilterToolbar from './shop/FilterToolbar';
import ProductCard from './shop/ProductCard';
import ServiceBanner from './shop/ServiceBanner';
import AgroBanner from './shop/AgroBanner';
import SeoContentBlock from './shop/SeoContentBlock';
import { logAnalyticsEvent } from './admin/analytics';

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
  onServiceClick?: () => void;
}

const TyreShop: React.FC<TyreShopProps> = ({ 
  initialCategory = 'all', 
  initialProduct, 
  onBack, 
  isAdmin, 
  onAdminClick,
  cartItems,
  onCartChange,
  onServiceClick
}) => {
  const [tyres, setTyres] = useState<TyreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [toast, setToast] = useState<{message: string, visible: boolean}>({message: '', visible: false});
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [isCartOpen, setIsCartOpen] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentLightboxImages, setCurrentLightboxImages] = useState<string[]>([]);
  const [selectedProductForModal, setSelectedProductForModal] = useState<TyreProduct | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<TyreProduct[]>([]);
  const [agroFeaturedProducts, setAgroFeaturedProducts] = useState<TyreProduct[]>([]);
  const [priorityProductId, setPriorityProductId] = useState<number | null>(null);
  const [heroTitle, setHeroTitle] = useState('ЦІЛОДОБОВИЙ ШИНОМОНТАЖ');
  const [heroSubtitle, setHeroSubtitle] = useState('В М. СИНЕЛЬНИКОВЕ (24/7)');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('recent_tyres');
      if (stored) setRecentlyViewed(JSON.parse(stored));
    } catch(e) {}
  }, [selectedProductForModal]);

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
  const [shopPhone2, setShopPhone2] = useState('063 582 38 58');
  const [shopPhoneLink, setShopPhoneLink] = useState(PHONE_LINK_1);
  const [shopPhoneLink2, setShopPhoneLink2] = useState('tel:+380635823858');

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
  const [showContactHub, setShowContactHub] = useState(false);

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
      logAnalyticsEvent('view_item', String(selectedProductForModal.id), selectedProductForModal.title);
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
      const { data: setts } = await supabase.from('settings').select('key, value').in('key', [
        'enable_stock_quantity', 
        'contact_phone1', 
        'contact_phone2', 
        'nova_poshta_key', 
        'agro_featured_ids',
        'hero_title',
        'hero_subtitle'
      ]);
      if (setts) {
          for (const item of setts) {
              if (item.key === 'hero_title') setHeroTitle(item.value);
              if (item.key === 'hero_subtitle') setHeroSubtitle(item.value);
              if (item.key === 'enable_stock_quantity') setEnableStockQty(item.value === 'true');
              if (item.key === 'contact_phone1') { 
                  setShopPhone(item.value); 
                  const digits = item.value.replace(/[^\d]/g, '');
                  const link = digits.startsWith('0') && digits.length === 10 ? `+38${digits}` : digits.startsWith('380') ? `+${digits}` : digits;
                  setShopPhoneLink(`tel:${link}`); 
              }
              if (item.key === 'contact_phone2') { 
                  setShopPhone2(item.value); 
                  const digits = item.value.replace(/[^\d]/g, '');
                  const link = digits.startsWith('0') && digits.length === 10 ? `+38${digits}` : digits.startsWith('380') ? `+${digits}` : digits;
                  setShopPhoneLink2(`tel:${link}`); 
              }
              if (item.key === 'nova_poshta_key') setNovaPoshtaKey(item.value);
              if (item.key === 'agro_featured_ids' && item.value) {
                  const ids = item.value.split(',').map(Number);
                  const { data: aData } = await supabase.from('tyres').select('*').in('id', ids);
                  if (aData) {
                      const sorted = ids.map(id => aData.find(t => t.id === id)).filter(Boolean) as TyreProduct[];
                      setAgroFeaturedProducts(sorted);
                  }
              }
          }
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
  }, [activeCategory, activeSort, enableStockQty, filterBrand, filterRadius, filterWidth, filterHeight, showOnlyInStock, searchQuery, priorityProductId]);

  const handleAgroProductClick = (id: number) => {
    setPriorityProductId(id);
    setActiveCategory('agro');
    setSearchQuery('');
    setFilterBrand('');
    setFilterRadius('');
    setFilterWidth('');
    setFilterHeight('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
      else if (activeCategory === 'car') query = query.eq('vehicle_type', 'car');
      else if (activeCategory === 'truck') query = query.eq('vehicle_type', 'truck');
      else if (activeCategory === 'agro') query = query.eq('vehicle_type', 'agro');
      else if (activeCategory === 'suv') query = query.eq('vehicle_type', 'suv');
      else if (activeCategory === 'out_of_stock') query = query.eq('in_stock', false);
      else if (['winter','summer','all-season'].includes(activeCategory)) query = query.eq('season', activeCategory);
      else if (activeCategory.startsWith('hot')) query = query.eq('is_hot', true);
      
      query = query.order('is_hot', { ascending: false }).order('in_stock', { ascending: false });
      const sorts = { price_asc: 'price', price_desc: 'price', newest: 'created_at', oldest: 'created_at' };
      query = query.order((sorts as any)[activeSort] || 'created_at', { ascending: ['price_asc','oldest'].includes(activeSort) });

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      if (data) {
        let processed = data.map(parseTyreSpecs);
        
        // --- PRIORITY LOGIC ---
        if (priorityProductId && pageIndex === 0 && activeCategory === 'agro') {
            const index = processed.findIndex(p => p.id === priorityProductId);
            if (index > 0) {
                const [item] = processed.splice(index, 1);
                processed.unshift(item);
            } else if (index === -1) {
                // If not in first page, fetch it specifically and unshift
                const { data: pData } = await supabase.from('tyres').select('*').eq('id', priorityProductId).single();
                if (pData) processed.unshift(parseTyreSpecs(pData));
            }
        }
        
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
      logAnalyticsEvent('add_to_cart', String(tyre.id), tyre.title);
      const ex = cartItems.find(item => item.id === tyre.id);
      const newCart = ex 
        ? cartItems.map(i => i.id === tyre.id ? { ...i, quantity: i.quantity + 1 } : i) 
        : [...cartItems, { ...tyre, quantity: 1 }];
      onCartChange(newCart);
      
      setToast({ message: tyre.title, visible: true });
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
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
        
                <header className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-6 mb-8 md:mb-12 px-2">
            {/* Left: Info block */}
            <div className="flex-1 space-y-5">
               <nav className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-zinc-600">
                 <button onClick={onBack} className="hover:text-[#FFC300] transition-colors">Головна</button>
                 <span className="text-zinc-800">/</span>
                 <span className="text-zinc-500">Магазин та сервіс</span>
                 {activeCategory !== 'all' && (
                   <>
                     <span className="text-zinc-800">/</span>
                     <span className="text-[#FFC300]">{CATEGORIES.find(c => c.id === activeCategory)?.label}</span>
                   </>
                 )}
               </nav>

               <div>
                 <h1 className="text-3xl md:text-5xl font-black text-white uppercase italic tracking-tighter leading-tight mb-2">
                   ФОРСАЖ <span className="text-[#FFC300]">СИНЕЛЬНИКОВЕ</span>
                 </h1>
                 <div className="flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest bg-emerald-500/5 py-1 px-3 rounded-full w-fit border border-emerald-500/10">
                   <span className="relative flex h-2 w-2">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                   </span>
                   ВІДКРИТО 24/7
                 </div>
               </div>

               <p className="text-zinc-400 text-sm md:text-base max-w-xl leading-relaxed">
                 Ми знаходимося в місті{' '}
                 <span className="text-white font-black">Синельникове</span>.
                 Надаємо послуги шиномонтажу та маємо{' '}
                 <span className="text-[#FFC300] font-black">великий вибір шин та запчастин</span>{' '}
                 в наявності.
               </p>

               <div className="flex flex-wrap gap-3">
                 <a href={shopPhoneLink} className="bg-zinc-900 border border-zinc-800 p-3 md:p-4 rounded-2xl flex items-center gap-3 group hover:border-[#FFC300] transition-all flex-1 min-w-[200px]">
                   <div className="w-10 h-10 md:w-12 md:h-12 bg-[#FFC300] rounded-xl flex items-center justify-center text-black group-hover:scale-110 transition-transform shrink-0">
                     <Phone size={18}/>
                   </div>
                   <div>
                     <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-0.5">Менеджер · Vodafone</p>
                     <span className="text-white font-black text-base md:text-lg tracking-tight">{shopPhone}</span>
                   </div>
                 </a>
                 <a href={shopPhoneLink2} className="bg-zinc-900 border border-zinc-800 p-3 md:p-4 rounded-2xl flex items-center gap-3 group hover:border-[#FFC300] transition-all flex-1 min-w-[200px]">
                   <div className="w-10 h-10 md:w-12 md:h-12 bg-zinc-800 border border-zinc-700 rounded-xl flex items-center justify-center text-[#FFC300] group-hover:scale-110 transition-transform shrink-0">
                     <Phone size={18}/>
                   </div>
                   <div>
                     <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-0.5">Офіс · Kyivstar</p>
                     <span className="text-white font-black text-base md:text-lg tracking-tight">{shopPhone2}</span>
                   </div>
                 </a>
                 {isAdmin && (
                   <button onClick={onAdminClick} className="bg-zinc-900/80 border border-[#FFC300]/30 p-3 md:p-4 rounded-2xl flex items-center gap-3 hover:border-[#FFC300] transition-all group shrink-0">
                     <div className="p-1.5 bg-zinc-800 rounded-lg text-[#FFC300] group-hover:scale-110 transition-transform">
                       <Lock size={14} strokeWidth={2.5}/>
                     </div>
                     <span className="text-white font-black text-xs uppercase">Адмін</span>
                   </button>
                 )}
               </div>
            </div>

            {/* Mobile: "How to get to us" button (hidden on desktop) */}
            <div className="lg:hidden">
               <a 
                 href="https://www.google.com/maps/dir/?api=1&destination=48.317541,35.513511"
                 target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 p-3 rounded-2xl hover:border-[#FFC300] transition-all group w-full"
               >
                 <div className="w-10 h-10 bg-zinc-800 border border-zinc-700 rounded-xl flex items-center justify-center text-[#FFC300] group-hover:scale-110 transition-transform shrink-0">
                   <MapPin size={18}/>
                 </div>
                 <div className="flex-1">
                   <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-0.5">Наша адреса</p>
                   <span className="text-white font-black text-sm">Як до нас добратися →</span>
                 </div>
                 <div className="text-right shrink-0">
                   <p className="text-zinc-500 text-[10px] font-bold">м. Синельникове</p>
                   <p className="text-zinc-600 text-[10px] font-bold">вул. Квітнева 9</p>
                 </div>
               </a>
            </div>

            {/* Desktop: Mini Map (hidden on mobile) */}
            <div className="hidden lg:block lg:w-5/12 xl:w-[380px] shrink-0">
               <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#FFC300]/40 to-yellow-600/20 rounded-3xl blur opacity-30 group-hover:opacity-60 transition duration-700"></div>
                  <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
                    <iframe 
                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2653.2206680489955!2d35.513511315682!3d48.31754097923793!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDjCsDE5JzAzLjEiTiAzNcKwMzAnNDguNiJF!5e0!3m2!1suk!2sua!4v1650000000000!5m2!1suk!2sua" 
                        width="100%" 
                        height="180" 
                        style={{ border: 0, filter: 'grayscale(1) invert(0.85) contrast(1.1)' }} 
                        allowFullScreen 
                        loading="lazy" 
                        referrerPolicy="no-referrer-when-downgrade"
                        title="Forsage Tires location"
                    ></iframe>
                    <div className="bg-zinc-950/90 border-t border-zinc-800 p-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                          <MapPin size={12} className="text-[#FFC300] shrink-0"/>
                          <p className="text-zinc-400 text-[10px] font-bold truncate">м. Синельникове, вул. Квітнева 9</p>
                        </div>
                        <a 
                          href="https://www.google.com/maps/dir/?api=1&destination=48.317541,35.513511" 
                          target="_blank" rel="noopener noreferrer"
                          className="bg-[#FFC300] px-2.5 py-1 rounded-lg text-black font-black text-[9px] uppercase tracking-widest hover:bg-white transition-colors shrink-0 flex items-center gap-1"
                        >
                          Маршрут <ArrowRight size={9} />
                        </a>
                    </div>
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

        {onServiceClick && <ServiceBanner onServiceClick={onServiceClick} />}

        {/* Agro Banner — shown only when not already in agro category */}
        {activeCategory !== 'agro' && (
          <AgroBanner 
            onCategoryClick={() => { setPriorityProductId(null); setActiveCategory('agro'); }} 
            featuredProducts={agroFeaturedProducts}
            onProductClick={handleAgroProductClick}
          />
        )}

        <FilterToolbar 
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          showOnlyInStock={showOnlyInStock} setShowOnlyInStock={setShowOnlyInStock}
          filterWidth={filterWidth} setFilterWidth={setFilterWidth}
          filterHeight={filterHeight} setFilterHeight={setFilterHeight}
          filterRadius={filterRadius} setFilterRadius={setFilterRadius}
          filterBrand={filterBrand} setFilterBrand={setFilterBrand}
          activeSort={activeSort} setActiveSort={setActiveSort}
          filterOptions={filterOptions}
          totalCount={totalCount}
          onSearch={() => fetchTyres(0, true)}
          onReset={() => { setSearchQuery(''); setFilterWidth(''); setFilterHeight(''); setFilterRadius(''); setFilterBrand(''); setActiveCategory('all'); }}
        />

        {loading ? (
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8 px-2 animate-in fade-in duration-300">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-zinc-900/40 rounded-2xl h-[320px] md:h-[420px] animate-pulse border border-zinc-800/50 flex flex-col p-3 md:p-4">
                  <div className="bg-zinc-800/50 rounded-xl h-[160px] md:h-[250px] mb-4 w-full"></div>
                  <div className="bg-zinc-800/50 h-2 w-16 mb-2 rounded-full"></div>
                  <div className="bg-zinc-800/50 h-4 md:h-5 w-3/4 mb-auto rounded-full"></div>
                  <div className="bg-zinc-800/50 h-8 w-2/3 mt-6 rounded-xl"></div>
                </div>
              ))}
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

      {recentlyViewed.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 mt-16 pb-12">
            <h2 className="text-xl font-black text-white uppercase tracking-widest mb-6 border-b border-zinc-800 pb-4">
              <span className="bg-[#FFC300] text-black px-2 py-0.5 mr-2 rounded">історія</span>
              Ви нещодавно переглядали
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-6 snap-x" style={{scrollbarWidth: 'none'}}>
              {recentlyViewed.map(t => (
                  <div key={t.id} onClick={() => setSelectedProductForModal(t)} className="min-w-[180px] max-w-[220px] bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col cursor-pointer hover:border-[#FFC300] transition-colors snap-center group">
                    <div className="h-32 mb-3 bg-zinc-950 rounded-xl p-2 flex items-center justify-center overflow-hidden">
                        {t.image_url ? <img src={t.image_url} alt={t.title} className="max-h-full object-contain group-hover:scale-110 transition-transform"/> : <div className="text-zinc-700 font-bold text-[10px] uppercase">Без фото</div>}
                    </div>
                    <span className="text-[10px] text-[#FFC300] font-black uppercase tracking-widest mb-1 truncate">{t.manufacturer || 'Шина'}</span>
                    <h4 className="text-white text-xs font-bold line-clamp-2 mb-2 flex-grow">{t.title}</h4>
                    <span className="text-base font-black text-white">{formatPrice(t.price)} грн</span>
                  </div>
              ))}
            </div>
        </div>
      )}

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
        onSimilarClick={(t) => setSelectedProductForModal(t)}
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

      {/* Floating Contact Hub */}
      <div className="fixed bottom-6 right-6 z-[160] flex flex-col items-end gap-3 pointer-events-none">
          {/* Expanded Menu */}
          <div className={`flex flex-col gap-3 transition-all duration-300 transform origin-bottom ${showContactHub ? 'scale-100 opacity-100 translate-y-0 pointer-events-auto' : 'scale-50 opacity-0 translate-y-10 pointer-events-none'}`}>
              <a href={TELEGRAM_LINK} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
                  <span className="bg-black/80 backdrop-blur-md border border-zinc-800 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-2xl">Telegram</span>
                  <div className="w-12 h-12 bg-[#0088cc] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-900/40 hover:scale-110 active:scale-95 transition-all">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                  </div>
              </a>
              <a href={VIBER_LINK} className="flex items-center gap-3 group">
                  <span className="bg-black/80 backdrop-blur-md border border-zinc-800 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-2xl">Viber</span>
                  <div className="w-12 h-12 bg-[#7360f2] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-purple-900/40 hover:scale-110 active:scale-95 transition-all">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </div>
              </a>
              <a href={PHONE_LINK_1} className="flex items-center gap-3 group">
                  <span className="bg-black/80 backdrop-blur-md border border-zinc-800 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-2xl">Дзвінок</span>
                  <div className="w-12 h-12 bg-[#FFC300] rounded-2xl flex items-center justify-center text-black shadow-xl shadow-yellow-900/40 hover:scale-110 active:scale-95 transition-all">
                      <Phone size={24} strokeWidth={2.5}/>
                  </div>
              </a>
          </div>

          {/* Main Toggle Button */}
          <button 
            onClick={() => setShowContactHub(!showContactHub)}
            className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-2xl transition-all duration-500 pointer-events-auto active:scale-90 ${showContactHub ? 'bg-zinc-800 text-white rotate-90' : 'bg-[#FFC300] text-black shadow-yellow-900/50'}`}
          >
            {showContactHub ? <X size={32} /> : (
              <div className="relative">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-bounce"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full border-2 border-[#FFC300] animate-ping"></span>
              </div>
            )}
          </button>
      </div>

      {/* Floating Toast Notification */}
      {toast.visible && (
        <div className="fixed bottom-[100px] left-1/2 -translate-x-1/2 z-[150] w-[90%] md:w-auto bg-black/90 backdrop-blur-md text-white px-2 py-2 md:px-6 md:py-3 rounded-2xl md:rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-between gap-3 animate-in slide-in-from-bottom-10 fade-in duration-300 border border-zinc-800">
           <div className="flex items-center gap-3 w-full overflow-hidden">
             <div className="bg-[#FFC300] p-2 rounded-xl shrink-0"><ShoppingCart size={16} className="text-black" /></div>
             <div className="flex flex-col flex-1 min-w-0">
               <span className="text-[10px] font-black uppercase tracking-widest text-[#FFC300]">У кошику</span>
               <span className="text-xs font-bold truncate">{toast.message}</span>
             </div>
           </div>
           <button onClick={() => { setIsCartOpen(true); setToast(p => ({...p, visible: false})); }} className="bg-white text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#FFC300] transition-colors shrink-0">
             Оформ.
           </button>
        </div>
      )}

      {/* SEO Content Block for Google Ranking */}
      <SeoContentBlock />
    </div>
  );
};

export default TyreShop;
