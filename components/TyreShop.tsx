
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { TyreProduct, CartItem } from '../types';
import { ShoppingBag, Loader2, Phone, X, Filter, Snowflake, Sun, CloudSun, Truck, Check, CreditCard, Wallet, ArrowDown, ShoppingCart, Plus, Minus, Trash2, ChevronLeft, ChevronRight, ZoomIn, Ban, Flame, Grid, ArrowUpDown, Search, DollarSign, AlertCircle, Tag, Briefcase, MapPin } from 'lucide-react';
import { PHONE_LINK_1, PHONE_NUMBER_1, FORMSPREE_ENDPOINT, NOVA_POSHTA_API_KEY } from '../constants';
import { DEFAULT_IMG_CONFIG, DEFAULT_BG_CONFIG } from './admin/promo/shared';

const PAGE_SIZE = 60;

// Helper to safely parse messy price strings (e.g. "2 500", "1,200.00")
const safeParsePrice = (val: string | undefined | null): number => {
    if (!val) return 0;
    const clean = String(val).replace(/,/g, '.').replace(/[^\d.]/g, '');
    return parseFloat(clean) || 0;
};

const formatPrice = (priceStr: string | undefined) => {
  if (!priceStr) return '0';
  // Use safeParsePrice to ensure we handle spaces/commas before formatting back
  const num = safeParsePrice(priceStr);
  return num ? Math.round(num).toString() : priceStr;
};

const getSeasonLabel = (s: string | undefined) => {
    if(s === 'winter') return 'Зимова';
    if(s === 'summer') return 'Літня';
    if(s === 'all-season') return 'Всесезонна';
    return '';
}

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
  
  // NEW: Detail Modal
  const [selectedProductForModal, setSelectedProductForModal] = useState<TyreProduct | null>(null);

  // Filters & Search
  const [activeCategory, setActiveCategory] = useState<CategoryType>(initialCategory);
  const [activeSort, setActiveSort] = useState<'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'with_photo' | 'no_photo'>('newest');
  const [searchQuery, setSearchQuery] = useState(''); // Text search state

  const [filterWidth, setFilterWidth] = useState('');
  const [filterHeight, setFilterHeight] = useState('');
  const [filterRadius, setFilterRadius] = useState('');
  const [filterBrand, setFilterBrand] = useState(''); // New Brand Filter
  
  // GLOBAL FILTER OPTIONS (Not dependent on current page)
  const [filterOptions, setFilterOptions] = useState({
      widths: [] as string[],
      heights: [] as string[],
      radii: [] as string[],
      brands: [] as string[]
  });

  // Price Range State
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Stock Quantity Logic
  const [enableStockQty, setEnableStockQty] = useState(false);
  const [promoBanner, setPromoBanner] = useState<any>(null);
  
  // Dynamic Contact Info
  const [shopPhone, setShopPhone] = useState(PHONE_NUMBER_1);
  const [shopPhoneLink, setShopPhoneLink] = useState(PHONE_LINK_1);

  const [orderName, setOrderName] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'newpost'>('pickup');
  const [paymentMethod, setPaymentMethod] = useState<'prepayment' | 'full'>('prepayment');
  
  // Nova Poshta State
  const [npSearchCity, setNpSearchCity] = useState('');
  const [npCities, setNpCities] = useState<any[]>([]);
  const [npWarehouses, setNpWarehouses] = useState<any[]>([]);
  const [selectedCityRef, setSelectedCityRef] = useState('');
  const [selectedCityName, setSelectedCityName] = useState('');
  const [selectedWarehouseRef, setSelectedWarehouseRef] = useState('');
  const [selectedWarehouseName, setSelectedWarehouseName] = useState('');
  const [isNpLoadingCities, setIsNpLoadingCities] = useState(false);
  const [isNpLoadingWarehouses, setIsNpLoadingWarehouses] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  const [orderSending, setOrderSending] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState('');

  const touchStartRef = useRef<number | null>(null);
  const touchEndRef = useRef<number | null>(null);

  // Nova Poshta API Logic
  useEffect(() => {
      const timer = setTimeout(() => {
          if (npSearchCity.length > 1 && !selectedCityRef) {
              fetchNpCities(npSearchCity);
          }
      }, 500);
      return () => clearTimeout(timer);
  }, [npSearchCity, selectedCityRef]);

  const fetchNpCities = async (term: string) => {
      setIsNpLoadingCities(true);
      try {
          const res = await fetch('https://api.novaposhta.ua/v2.0/json/', {
              method: 'POST',
              body: JSON.stringify({
                  apiKey: NOVA_POSHTA_API_KEY,
                  modelName: "Address",
                  calledMethod: "searchSettlements",
                  methodProperties: {
                      CityName: term,
                      Limit: "20",
                      Page: "1"
                  }
              })
          });
          const data = await res.json();
          if (data.success && data.data && data.data[0]) {
              // The API structure for searchSettlements returns an array of objects which contain 'Addresses'
              setNpCities(data.data[0].Addresses || []);
              setShowCityDropdown(true);
          } else {
              setNpCities([]);
          }
      } catch (e) {
          console.error("NP API Error", e);
      } finally {
          setIsNpLoadingCities(false);
      }
  };

  const fetchNpWarehouses = async (cityRef: string) => {
      setIsNpLoadingWarehouses(true);
      try {
          const res = await fetch('https://api.novaposhta.ua/v2.0/json/', {
              method: 'POST',
              body: JSON.stringify({
                  apiKey: NOVA_POSHTA_API_KEY,
                  modelName: "Address",
                  calledMethod: "getWarehouses",
                  methodProperties: {
                      CityRef: cityRef,
                      Language: "UA"
                  }
              })
          });
          const data = await res.json();
          if (data.success) {
              setNpWarehouses(data.data);
          }
      } catch (e) {
          console.error("NP Warehouse Error", e);
      } finally {
          setIsNpLoadingWarehouses(false);
      }
  };

  const handleCitySelect = (city: any) => {
      const cityName = city.Present; // Full name with region
      const cityRef = city.DeliveryCity; // Ref for getting warehouses
      
      setNpSearchCity(cityName);
      setSelectedCityName(cityName);
      setSelectedCityRef(cityRef);
      setNpCities([]);
      setShowCityDropdown(false);
      
      // Reset warehouse
      setSelectedWarehouseRef('');
      setSelectedWarehouseName('');
      setNpWarehouses([]);
      
      fetchNpWarehouses(cityRef);
  };

  const handleCityInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setNpSearchCity(e.target.value);
      setSelectedCityRef(''); // Reset selection if user types again
      setSelectedCityName('');
      setShowCityDropdown(true);
  };

  // Fetch Settings & Promo & GLOBAL FILTERS
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('settings').select('key, value').in('key', ['enable_stock_quantity', 'promo_data', 'contact_phone1']);
      if (data) {
          data.forEach(item => {
              if (item.key === 'enable_stock_quantity') {
                  setEnableStockQty(item.value === 'true');
              }
              if (item.key === 'contact_phone1') {
                  setShopPhone(item.value);
                  setShopPhoneLink(`tel:${item.value.replace(/[^\d+]/g, '')}`);
              }
              if (item.key === 'promo_data' && item.value) {
                  try {
                      const p = JSON.parse(item.value);
                      const active = Array.isArray(p) ? p.find((x:any) => x.active) : (p.active ? p : null);
                      setPromoBanner(active);
                  } catch (e) { console.error(e); }
              }
          });
      }
    };

    const fetchGlobalFilters = async () => {
        // Fetch minimal data to build filters from entire DB
        const { data } = await supabase.from('tyres').select('manufacturer, radius, title').neq('in_stock', false);
        if (data) {
            const brands = new Set<string>();
            const radii = new Set<string>();
            const widths = new Set<string>();
            const heights = new Set<string>();

            data.forEach(item => {
                if (item.manufacturer) {
                    let brand = item.manufacturer.trim();
                    // --- NORMALIZE BRANDS ---
                    if (brand === 'Ш.Ханкук тайр' || brand === 'Ш.Ханкук Тайр' || brand === 'Lfufen') {
                        brand = 'Laufenn';
                    }
                    brands.add(brand);
                }
                if (item.radius) radii.add(item.radius.trim());
                
                // Parse dimensions from title since they are not columns
                const sizeRegex = /(\d{3})[\/\s](\d{2})/;
                const match = item.title.match(sizeRegex);
                if (match) {
                    widths.add(match[1]);
                    heights.add(match[2]);
                }
            });

            setFilterOptions({
                brands: Array.from(brands).sort(),
                radii: Array.from(radii).sort((a, b) => parseInt(a.replace(/\D/g,'')||'0') - parseInt(b.replace(/\D/g,'')||'0')),
                widths: Array.from(widths).sort(),
                heights: Array.from(heights).sort()
            });
        }
    };

    fetchSettings();
    fetchGlobalFilters();
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
  }, [activeCategory, activeSort, enableStockQty, filterBrand, filterRadius, filterWidth, filterHeight]); 

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

    // --- NORMALIZE MANUFACTURER FOR DISPLAY ---
    let manufacturer = tyre.manufacturer || '';
    if (manufacturer === 'Ш.Ханкук тайр' || manufacturer === 'Ш.Ханкук Тайр' || manufacturer === 'Lfufen') {
        manufacturer = 'Laufenn';
    }
    
    return { ...tyre, width, height, radius: parsedRadius, season, vehicle_type, in_stock, manufacturer };
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
         query = query.or(`title.ilike.%${term}%,catalog_number.ilike.%${term}%,manufacturer.ilike.%${term}%,product_number.ilike.%${term}%`);
      }

      // --- SERVER SIDE FILTERS ---
      if (filterBrand) {
          if (filterBrand === 'Laufenn') {
              // Handle aliases for Laufenn in database query
              query = query.or('manufacturer.eq.Laufenn,manufacturer.eq.Ш.Ханкук тайр,manufacturer.eq.Ш.Ханкук Тайр');
          } else {
              query = query.eq('manufacturer', filterBrand);
          }
      }
      if (filterRadius) {
          // Try exact match on radius column
          query = query.eq('radius', filterRadius);
      }
      if (filterWidth) {
          // Since width is usually in title like "205/55", we search for "205" in title roughly
          query = query.ilike('title', `%${filterWidth}%`);
      }
      if (filterHeight) {
          query = query.ilike('title', `%/${filterHeight}%`); // Try to match "/55"
      }

      // 2. CATEGORY FILTERS
      if (activeCategory === 'hot') {
         query = query.eq('is_hot', true);
         if (enableStockQty) {
             query = query.neq('in_stock', false);
         } else {
             query = query.neq('in_stock', false);
         }
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
  
  // Use safeParsePrice for total calculation
  const cartTotal = useMemo(() => cart.reduce((total, item) => total + (safeParsePrice(item.price) * item.quantity), 0), [cart]);

  const openLightbox = (tyre: TyreProduct) => { let images: string[] = []; if (tyre.image_url) images.push(tyre.image_url); if (tyre.gallery && Array.isArray(tyre.gallery)) { const additional = tyre.gallery.filter(url => url !== tyre.image_url); images = [...images, ...additional]; } if (images.length === 0) return; setCurrentLightboxImages(images); setCurrentImageIndex(0); setLightboxOpen(true); };
  
  // Effect to open detail modal if initialProduct is provided (from Home page Hot Deal click)
  useEffect(() => {
    if (initialProduct) {
      setSelectedProductForModal(initialProduct);
    }
  }, [initialProduct]);

  const nextImage = (e?: React.MouseEvent) => { e?.stopPropagation(); setCurrentImageIndex(prev => (prev + 1) % currentLightboxImages.length); };
  const prevImage = (e?: React.MouseEvent) => { e?.stopPropagation(); setCurrentImageIndex(prev => (prev - 1 + currentLightboxImages.length) % currentLightboxImages.length); };
  const onTouchStart = (e: React.TouchEvent) => { touchStartRef.current = e.targetTouches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => { touchEndRef.current = e.targetTouches[0].clientX; };
  const onTouchEnd = () => { if (!touchStartRef.current || !touchEndRef.current) return; const distance = touchStartRef.current - touchEndRef.current; if (distance > 50) nextImage(); if (distance < -50) prevImage(); touchStartRef.current = null; touchEndRef.current = null; };

  const submitOrder = async () => {
    if (!orderName || orderPhone.length < 9) { setOrderError("Введіть коректне ім'я та телефон"); return; }
    if (deliveryMethod === 'newpost' && (!selectedCityName || !selectedWarehouseName)) { setOrderError("Оберіть місто та відділення Нової Пошти"); return; }
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
      
      const { error } = await supabase.from('tyre_orders').insert([{ 
          customer_name: orderName, 
          customer_phone: orderPhone, 
          status: 'new', 
          delivery_method: deliveryMethod, 
          delivery_city: deliveryMethod === 'newpost' ? selectedCityName : null, 
          delivery_warehouse: deliveryMethod === 'newpost' ? selectedWarehouseName : null, 
          payment_method: deliveryMethod === 'newpost' ? paymentMethod : null, 
          items: itemsPayload 
      }]);
      
      if (error) throw new Error("Помилка бази даних: " + error.message);
      try {
        const itemsDesc = cart.map(i => `${i.title} (${i.quantity} шт) - ${formatPrice(i.price)} грн`).join('\n');
        const formData = { 
            subject: `Замовлення шин (${cart.length} поз.)`, 
            customer_name: orderName, 
            customer_phone: orderPhone, 
            items: itemsDesc, 
            total_price: `${cartTotal} грн`, 
            delivery_method: deliveryMethod === 'pickup' ? "Самовивіз" : "Нова Пошта", 
            delivery_address: deliveryMethod === 'pickup' ? "-" : `${selectedCityName}, ${selectedWarehouseName}`, 
            payment_method: deliveryMethod === 'newpost' ? (paymentMethod === 'prepayment' ? 'Предоплата' : 'Повна оплата') : '-' 
        };
        await fetch(FORMSPREE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      } catch (emailErr) { console.error("Email sending failed", emailErr); }
      setOrderSuccess(true); setCart([]);
    } catch (err: any) { console.error(err); setOrderError("Помилка при створенні замовлення. Спробуйте ще раз."); } finally { setOrderSending(false); }
  };

  const filteredTyres = tyres; // No more client-side filtering needed for these main props
  
  const resetFilters = () => { 
      setFilterWidth(''); 
      setFilterHeight(''); 
      setFilterRadius(''); 
      setFilterBrand('');
      setSearchQuery(''); 
      setMinPrice('');
      setMaxPrice('');
      handleForceSearch(); 
  };

  return (
    <div className="min-h-screen bg-[#09090b] py-8 md:py-12 animate-in fade-in duration-500 pb-32">
      <div className="max-w-7xl mx-auto px-2 md:px-4">
        
        {/* HEADER SECTION with Mini Banner */}
        <div className="flex flex-col lg:flex-row justify-between items-start md:items-center gap-4 mb-8 px-2 relative">
           <div className="shrink-0">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-2 border-b-2 border-[#FFC300] inline-block pb-2">Магазин Шин та Дисків</h2>
              <p className="text-zinc-400">Широкий вибір нових та б/в шин у Синельниковому.</p>
           </div>

           {/* MINI BANNER (Visible on Desktop) */}
           {promoBanner && (
               (() => {
                   const imgConfig = { ...DEFAULT_IMG_CONFIG, ...(promoBanner.imageConfig || {}) };
                   const bgConfig = { ...DEFAULT_BG_CONFIG, ...(promoBanner.backgroundConfig || {}) };
                   
                   // Mask Logic
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

                   return (
                       <div className={`hidden lg:flex flex-1 mx-8 rounded-xl relative overflow-hidden items-center justify-between shadow-lg border border-white/10 max-w-2xl h-36 ${promoBanner.color}`}>
                           
                           {/* Custom Background Image */}
                           {promoBanner.backgroundImage && (
                                <div className="absolute inset-0 z-0 pointer-events-none">
                                    <img 
                                        src={promoBanner.backgroundImage} 
                                        className="w-full h-full object-cover transition-opacity duration-300"
                                        style={{ 
                                            opacity: (bgConfig.opacity ?? 100) / 100,
                                            objectPosition: `center ${bgConfig.positionY ?? 50}%`
                                        }}
                                        alt=""
                                    />
                                    <div className="absolute inset-0 bg-black" style={{ opacity: (bgConfig.overlayOpacity ?? 40) / 100 }}></div>
                                </div>
                           )}

                           {/* Pattern */}
                           {promoBanner.pattern && promoBanner.pattern !== 'none' && (
                               <div 
                                   className="absolute inset-0 z-0 pointer-events-none" 
                                   style={{ 
                                       backgroundImage: promoBanner.pattern, 
                                       opacity: (promoBanner.patternOpacity || 10) / 100,
                                       mixBlendMode: 'screen',
                                       backgroundSize: 'auto',
                                       backgroundRepeat: 'repeat'
                                   }}
                               ></div>
                           )}

                           <div className="relative z-10 flex flex-col justify-center pl-6 py-4 h-full flex-grow">
                                <div className="text-[10px] font-bold text-[#FFC300] uppercase tracking-widest mb-1 flex items-center gap-2">
                                   <div className="w-1.5 h-1.5 bg-[#FFC300] rounded-full animate-pulse"></div>
                                   Active Promo
                                </div>
                                <h3 className="text-2xl font-black text-white italic uppercase leading-none drop-shadow-md">{promoBanner.title}</h3>
                                <p className="text-xs text-zinc-300 mt-1 line-clamp-2 max-w-xs leading-tight drop-shadow-sm font-medium">{promoBanner.text}</p>
                           </div>

                           {/* Product Image */}
                           {promoBanner.image_url && (
                               <div className="w-48 h-full relative mr-4 flex items-center justify-center pointer-events-none">
                                  <div 
                                    style={{
                                        transform: `scale(${imgConfig.scale / 100}) translate(${imgConfig.xOffset}px, ${imgConfig.yOffset}px)`,
                                        opacity: (imgConfig.opacity || 100) / 100,
                                        height: '100%',
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                  >
                                      {imgConfig.glow && (
                                         <div className="absolute inset-0 bg-[#FFC300]/30 blur-[40px] rounded-full scale-75 pointer-events-none mix-blend-screen"></div>
                                      )}
                                      <img 
                                        src={promoBanner.image_url} 
                                        className={`max-w-none max-h-none object-contain relative z-10 ${imgConfig.shadow ? 'drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]' : ''}`} 
                                        style={{ height: '120%', ...maskImageStyle }}
                                        alt="Promo" 
                                      />
                                  </div>
                               </div>
                           )}
                       </div>
                   );
               })()
           )}

           <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-4 w-full md:w-auto shrink-0">
              <div className="p-2 bg-[#FFC300] rounded-full text-black"><Phone size={20}/></div>
              <div>
                 <p className="text-xs text-zinc-500 uppercase font-bold">Консультація</p>
                 <a href={shopPhoneLink} className="text-white font-bold text-lg hover:text-[#FFC300]">{shopPhone}</a>
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
                       placeholder="Пошук (наприклад: Michelin, R16, 205/55, код)..." 
                       value={searchQuery}
                       onChange={(e) => {
                           const val = e.target.value;
                           setSearchQuery(val);
                           if (val === '') setTimeout(() => handleForceSearch(), 0);
                       }}
                       onKeyDown={(e) => e.key === 'Enter' && handleForceSearch()}
                       // text-base to prevent zoom on mobile
                       className="w-full bg-black border border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-base text-white outline-none focus:border-[#FFC300]"
                    />
                 </div>
                 <button 
                    onClick={handleForceSearch}
                    className="bg-[#FFC300] hover:bg-[#e6b000] text-black font-black px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg active:scale-95 transition-transform uppercase tracking-wider text-sm md:text-base whitespace-nowrap"
                 >
                    ЗНАЙТИ
                 </button>
              </div>

              {/* Bottom Row: Dropdowns - Stacked on Mobile for better touch targets */}
              <div className="flex flex-col lg:flex-row gap-4">
                 
                 {/* Filters Container */}
                 <div className="flex flex-col sm:flex-row gap-2 w-full lg:flex-grow">
                    {/* Size Filters */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-0 sm:bg-black/50 sm:rounded-xl sm:border sm:border-zinc-800 flex-grow sm:overflow-hidden sm:divide-x sm:divide-zinc-800">
                       <div className="relative group bg-black/50 border border-zinc-800 sm:border-0 rounded-xl sm:rounded-none">
                          <Filter size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#FFC300] hidden sm:block" />
                          <select value={filterWidth} onChange={(e) => setFilterWidth(e.target.value)} className="bg-transparent text-white text-base md:text-sm font-bold p-3 sm:pl-8 w-full outline-none cursor-pointer hover:bg-zinc-800/50 transition-colors text-center sm:text-left appearance-none sm:appearance-auto"><option value="">Ширина</option>{filterOptions.widths.map(w => <option key={w} value={w}>{w}</option>)}</select>
                       </div>
                       <div className="relative group bg-black/50 border border-zinc-800 sm:border-0 rounded-xl sm:rounded-none">
                          <select value={filterHeight} onChange={(e) => setFilterHeight(e.target.value)} className="bg-transparent text-white text-base md:text-sm font-bold p-3 w-full outline-none cursor-pointer hover:bg-zinc-800/50 transition-colors text-center"><option value="">Висота</option>{filterOptions.heights.map(h => <option key={h} value={h}>{h}</option>)}</select>
                       </div>
                       <div className="relative group bg-black/50 border border-zinc-800 sm:border-0 rounded-xl sm:rounded-none">
                          <select value={filterRadius} onChange={(e) => setFilterRadius(e.target.value)} className="bg-transparent text-white text-base md:text-sm font-bold p-3 w-full outline-none cursor-pointer hover:bg-zinc-800/50 transition-colors text-center"><option value="">Радіус</option>{filterOptions.radii.map(r => <option key={r} value={r}>{r}</option>)}</select>
                       </div>
                       {/* BRAND FILTER */}
                       <div className="relative group bg-black/50 border border-zinc-800 sm:border-0 rounded-xl sm:rounded-none">
                          <Briefcase size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 hidden sm:block" />
                          <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} className="bg-transparent text-white text-base md:text-sm font-bold p-3 sm:pl-8 w-full outline-none cursor-pointer hover:bg-zinc-800/50 transition-colors text-center sm:text-left appearance-none sm:appearance-auto"><option value="">Бренд</option>{filterOptions.brands.map(b => <option key={b} value={b}>{b}</option>)}</select>
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
                            className="w-16 bg-transparent text-white text-base md:text-sm font-bold p-2 outline-none text-center border-b border-zinc-700 focus:border-[#FFC300]"
                        />
                        <span className="text-zinc-600">-</span>
                        <input 
                            type="number" 
                            placeholder="До" 
                            value={maxPrice} 
                            onChange={(e) => setMaxPrice(e.target.value)} 
                            className="w-16 bg-transparent text-white text-base md:text-sm font-bold p-2 outline-none text-center border-b border-zinc-700 focus:border-[#FFC300]"
                        />
                    </div>

                    {(filterWidth || filterHeight || filterRadius || filterBrand || searchQuery || minPrice || maxPrice) && (
                       <button onClick={resetFilters} className="bg-zinc-800 text-white p-3 rounded-xl hover:bg-red-900/50 transition-colors flex-shrink-0 border border-zinc-700 flex justify-center items-center"><X size={20}/></button>
                    )}
                 </div>

                 {/* Sort */}
                 <div className="w-full lg:w-auto lg:min-w-[200px]">
                    <div className="flex items-center gap-2 bg-black/50 p-1 rounded-xl border border-zinc-800 w-full">
                       <ArrowUpDown size={16} className="text-zinc-500 ml-2 flex-shrink-0" />
                       <select value={activeSort} onChange={(e) => setActiveSort(e.target.value as any)} className="bg-transparent text-white text-base md:text-sm font-bold p-2 outline-none w-full cursor-pointer hover:text-[#FFC300]">
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
                  // Determine display price logic safely
                  const priceNum = safeParsePrice(tyre.price);
                  const oldPriceNum = safeParsePrice(tyre.old_price);
                  const hasDiscount = oldPriceNum > priceNum;
                  
                  return (
                  <div key={tyre.id} className={`bg-zinc-900 border rounded-xl overflow-hidden hover:border-[#FFC300] transition-colors group flex flex-col relative ${tyre.in_stock === false ? 'border-zinc-800 opacity-70' : 'border-zinc-800'}`}>
                     
                     {/* BADGES */}
                     <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1 max-w-[70%]">
                        {tyre.is_hot && <div className="bg-orange-600 text-white p-1 rounded shadow-lg flex items-center gap-1 text-[10px] font-bold px-2 uppercase"><Flame size={12} className="fill-current"/> HOT</div>}
                        {hasDiscount && <div className="bg-red-600 text-white p-1 rounded shadow-lg flex items-center gap-1 text-[10px] font-bold px-2 uppercase">SALE</div>}
                        {tyre.season === 'winter' && <div className="bg-blue-600 text-white p-1 rounded shadow-lg" title="Зима"><Snowflake size={14} /></div>}
                        {tyre.season === 'summer' && <div className="bg-orange-500 text-white p-1 rounded shadow-lg" title="Літо"><Sun size={14} /></div>}
                        {tyre.season === 'all-season' && <div className="bg-green-600 text-white p-1 rounded shadow-lg" title="Всесезон"><CloudSun size={14} /></div>}
                        {tyre.vehicle_type === 'cargo' && <div className="bg-purple-600 text-white p-1 rounded shadow-lg" title="Вантажна"><Truck size={14} /></div>}
                     </div>

                     {/* SPECS BADGE (Moved to top-right of image area) */}
                     {(tyre.width || tyre.height) && (
                        <div className="absolute top-2 right-2 z-10 text-[10px] md:text-xs font-black bg-zinc-900/90 backdrop-blur-sm text-white px-2 py-1 rounded border border-zinc-700 shadow-lg">
                           {tyre.width}/{tyre.height} <span className="text-[#FFC300]">{tyre.radius}</span>
                        </div>
                     )}

                     {tyre.in_stock === false && (
                        <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center pointer-events-none">
                           <div className="bg-red-600 text-white px-3 py-1 font-black uppercase -rotate-12 border-2 border-white shadow-xl text-sm">Немає в наявності</div>
                        </div>
                     )}

                     {/* IMAGE */}
                     <div className={`aspect-square bg-black relative overflow-hidden cursor-pointer`} onClick={() => tyre.in_stock !== false && setSelectedProductForModal(tyre)}>
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

                     {/* INFO SECTION */}
                     <div className="p-3 md:p-4 flex flex-col flex-grow relative" onClick={() => tyre.in_stock !== false && setSelectedProductForModal(tyre)}>
                        {/* BRAND LABEL */}
                        {tyre.manufacturer && (
                            <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1 tracking-wider">{tyre.manufacturer}</div>
                        )}

                        {/* TITLE (Improved Spacing) */}
                        <h3 className="text-sm md:text-base font-bold text-white mb-2 leading-snug line-clamp-2 min-h-[2.5em] pr-2 cursor-pointer hover:text-[#FFC300] transition-colors">
                            {tyre.title}
                        </h3>

                        {/* ADDED SEASON TEXT */}
                        {tyre.season && (
                            <div className="text-[10px] text-zinc-400 font-bold uppercase mb-2">
                                Сезон: <span className="text-white">{getSeasonLabel(tyre.season)}</span>
                            </div>
                        )}

                        <div className="text-[10px] text-zinc-500 mb-2 flex flex-col gap-0.5">
                           {tyre.catalog_number && <span>Арт: <span className="text-zinc-400 font-mono">{tyre.catalog_number}</span></span>}
                           {tyre.product_number && <span>№: <span className="text-zinc-400 font-mono">{tyre.product_number}</span></span>}
                        </div>

                        {enableStockQty && tyre.in_stock !== false && (
                           <div className="text-[10px] font-bold text-green-400 mb-2 flex items-center gap-1">
                               <Check size={10} /> 
                               {tyre.stock_quantity ? (
                                   <span>В наявності: {tyre.stock_quantity} шт.</span>
                               ) : (
                                   <span>В наявності</span>
                               )}
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
                                 onClick={(e) => { e.stopPropagation(); addToCart(tyre); }} 
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
                  {cart.length > 0 && (
                    <div className="border-t border-zinc-800 pt-4">
                        <div className="flex justify-between text-xl font-black text-white mb-4"><span>Разом:</span><span className="text-[#FFC300]">{Math.round(cartTotal)} грн</span></div>
                        
                        <div className="space-y-3 mb-4">
                            <input type="text" value={orderName} onChange={e => setOrderName(e.target.value)} placeholder="Ваше ім'я" className="w-full bg-zinc-800 border border-zinc-700 rounded p-3 text-white outline-none focus:border-[#FFC300]" />
                            <input type="tel" value={orderPhone} onChange={e => setOrderPhone(e.target.value)} placeholder="Телефон" className="w-full bg-zinc-800 border border-zinc-700 rounded p-3 text-white outline-none focus:border-[#FFC300]" />
                            
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setDeliveryMethod('pickup')} className={`py-2 rounded font-bold text-xs ${deliveryMethod === 'pickup' ? 'bg-[#FFC300] text-black' : 'bg-black text-zinc-400 border border-zinc-800'}`}>Самовивіз</button>
                                <button onClick={() => setDeliveryMethod('newpost')} className={`py-2 rounded font-bold text-xs ${deliveryMethod === 'newpost' ? 'bg-red-600 text-white' : 'bg-black text-zinc-400 border border-zinc-800'}`}>Нова Пошта</button>
                            </div>
                            
                            {deliveryMethod === 'newpost' && (
                                <div className="space-y-2 bg-zinc-800/50 p-2 rounded border border-zinc-700 text-sm relative">
                                    {/* NOVA POSHTA CITY SEARCH */}
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16}/>
                                        <input 
                                            type="text" 
                                            value={npSearchCity} 
                                            onChange={handleCityInputChange}
                                            placeholder="Введіть місто..." 
                                            className="w-full bg-black border border-zinc-700 rounded p-2 pl-9 text-white focus:border-red-500 outline-none"
                                        />
                                        {isNpLoadingCities && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 className="animate-spin text-zinc-500" size={16}/></div>}
                                        
                                        {showCityDropdown && npCities.length > 0 && (
                                            <div className="absolute top-full left-0 w-full bg-black border border-zinc-700 rounded-b mt-1 max-h-48 overflow-y-auto z-50 shadow-xl">
                                                {npCities.map((city: any) => (
                                                    <div 
                                                        key={city.Ref} 
                                                        onClick={() => handleCitySelect(city)}
                                                        className="p-2 hover:bg-zinc-800 cursor-pointer text-sm text-zinc-300 border-b border-zinc-800 last:border-0"
                                                    >
                                                        {city.Present}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* NOVA POSHTA WAREHOUSE SELECT */}
                                    <select 
                                        value={selectedWarehouseName} 
                                        onChange={e => setSelectedWarehouseName(e.target.value)} 
                                        disabled={!selectedCityRef || isNpLoadingWarehouses} 
                                        className="w-full bg-black border border-zinc-700 rounded p-2 text-white disabled:opacity-50"
                                    >
                                        <option value="">{isNpLoadingWarehouses ? 'Завантаження...' : 'Оберіть відділення'}</option>
                                        {npWarehouses.map((w: any) => (
                                            <option key={w.Ref} value={w.Description}>{w.Description}</option>
                                        ))}
                                    </select>

                                    <div className="flex gap-2 pt-1">
                                        <label className="flex items-center gap-1 text-xs text-zinc-400 cursor-pointer">
                                            <input type="radio" checked={paymentMethod === 'prepayment'} onChange={() => setPaymentMethod('prepayment')} className="accent-red-500" /> Предоплата
                                        </label>
                                        <label className="flex items-center gap-1 text-xs text-zinc-400 cursor-pointer">
                                            <input type="radio" checked={paymentMethod === 'full'} onChange={() => setPaymentMethod('full')} className="accent-red-500" /> Повна оплата
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {orderError && <p className="text-red-500 text-sm mb-2 font-bold bg-red-900/10 p-2 rounded border border-red-900/30">{orderError}</p>}
                        
                        <button onClick={submitOrder} disabled={orderSending} className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black py-4 rounded-xl flex justify-center items-center shadow-lg transition-transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
                            {orderSending ? <Loader2 className="animate-spin" /> : 'ЗАМОВИТИ ВСЕ'}
                        </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center"><div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-4"><Check size={40} /></div><h3 className="text-2xl font-bold text-white mb-2">Замовлення успішне!</h3><p className="text-zinc-400 mb-6">Дякуємо. Менеджер зв'яжеться з вами.</p><button onClick={() => { setIsCartOpen(false); setOrderSuccess(false); }} className="px-8 py-3 bg-zinc-800 text-white rounded-xl">Закрити</button></div>
              )}
           </div>
        </div>
      )}

      {/* NEW PRODUCT DETAILS MODAL */}
      {selectedProductForModal && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 md:p-4 animate-in fade-in duration-200" onClick={() => setSelectedProductForModal(null)}>
              <div 
                className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl shadow-2xl relative flex flex-col md:flex-row overflow-hidden max-h-[90vh]" 
                onClick={e => e.stopPropagation()}
              >
                  <button onClick={() => setSelectedProductForModal(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white z-20 bg-black/50 p-1 rounded-full"><X size={24} /></button>
                  
                  {/* LEFT: IMAGE */}
                  <div className="w-full md:w-1/2 bg-black flex items-center justify-center relative group min-h-[300px]">
                      {selectedProductForModal.image_url ? (
                          <>
                            <img src={selectedProductForModal.image_url} className="w-full h-full object-cover" alt={selectedProductForModal.title} />
                            <button 
                                onClick={() => openLightbox(selectedProductForModal)}
                                className="absolute bottom-4 right-4 bg-zinc-900/80 text-white p-3 rounded-full hover:bg-[#FFC300] hover:text-black transition-colors"
                            >
                                <ZoomIn size={20} />
                            </button>
                          </>
                      ) : (
                          <div className="flex flex-col items-center justify-center text-zinc-700">
                              <ShoppingBag size={64} className="opacity-20 mb-4"/>
                              <span>Немає фото</span>
                          </div>
                      )}
                  </div>

                  {/* RIGHT: DETAILS */}
                  <div className="w-full md:w-1/2 p-6 md:p-8 overflow-y-auto bg-zinc-900">
                      <div className="mb-6">
                          {selectedProductForModal.manufacturer && <span className="text-zinc-500 font-bold uppercase tracking-wider text-xs mb-2 block">{selectedProductForModal.manufacturer}</span>}
                          <h2 className="text-xl md:text-2xl font-black text-white leading-tight mb-2">{selectedProductForModal.title}</h2>
                          {selectedProductForModal.stock_quantity !== undefined && enableStockQty && (
                              <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-900/20 text-green-400 text-xs font-bold rounded">
                                  <Check size={12}/> В наявності: {selectedProductForModal.stock_quantity} шт
                              </div>
                          )}
                      </div>

                      <div className="space-y-4 mb-8">
                          <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                              <span className="text-zinc-400 text-sm">Ширина</span>
                              <span className="text-white font-bold">{selectedProductForModal.width || '-'}</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                              <span className="text-zinc-400 text-sm">Висота</span>
                              <span className="text-white font-bold">{selectedProductForModal.height || '-'}</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                              <span className="text-zinc-400 text-sm">Діаметр</span>
                              <span className="text-[#FFC300] font-bold">{selectedProductForModal.radius || '-'}</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                              <span className="text-zinc-400 text-sm">Сезон</span>
                              <span className="text-white font-bold flex items-center gap-2">
                                  {selectedProductForModal.season === 'winter' && <Snowflake size={14} className="text-blue-400"/>}
                                  {selectedProductForModal.season === 'summer' && <Sun size={14} className="text-orange-400"/>}
                                  {selectedProductForModal.season === 'all-season' && <CloudSun size={14} className="text-green-400"/>}
                                  {getSeasonLabel(selectedProductForModal.season)}
                              </span>
                          </div>
                          <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                              <span className="text-zinc-400 text-sm">Тип авто</span>
                              <span className="text-white font-bold capitalize">{selectedProductForModal.vehicle_type === 'cargo' ? 'Вантажний (C)' : selectedProductForModal.vehicle_type === 'suv' ? 'Позашляховик' : 'Легковий'}</span>
                          </div>
                          {(selectedProductForModal.catalog_number || selectedProductForModal.product_number) && (
                              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                                  <span className="text-zinc-400 text-sm">Артикул / Код</span>
                                  <span className="text-zinc-300 font-mono text-sm">{selectedProductForModal.catalog_number || selectedProductForModal.product_number}</span>
                              </div>
                          )}
                      </div>

                      <div className="mt-auto">
                          <div className="flex items-end gap-3 mb-4">
                              {safeParsePrice(selectedProductForModal.old_price) > safeParsePrice(selectedProductForModal.price) && (
                                  <span className="text-zinc-500 line-through text-sm mb-1">{formatPrice(selectedProductForModal.old_price)} грн</span>
                              )}
                              <span className="text-3xl font-black text-[#FFC300]">{formatPrice(selectedProductForModal.price)} <span className="text-base text-white font-normal">грн</span></span>
                          </div>
                          
                          <button 
                              onClick={() => { addToCart(selectedProductForModal); setSelectedProductForModal(null); }}
                              disabled={selectedProductForModal.in_stock === false}
                              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 uppercase tracking-wide transition-all active:scale-95 ${selectedProductForModal.in_stock === false ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-white text-black hover:bg-[#FFC300] shadow-lg'}`}
                          >
                              <ShoppingCart size={20} />
                              {selectedProductForModal.in_stock === false ? 'Немає в наявності' : 'Додати в кошик'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {lightboxOpen && currentLightboxImages.length > 0 && (<div className="fixed inset-0 z-[200] bg-black flex items-center justify-center animate-in fade-in duration-300"><button onClick={() => setLightboxOpen(false)} className="absolute top-4 right-4 text-white hover:text-[#FFC300] z-50 p-2"><X size={32}/></button><div className="w-full h-full flex items-center justify-center relative touch-pan-y" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>{currentLightboxImages.length > 1 && (<><button onClick={prevImage} className="absolute left-2 md:left-8 text-white/50 hover:text-white z-50 hidden md:block"><ChevronLeft size={48}/></button><button onClick={nextImage} className="absolute right-2 md:right-8 text-white/50 hover:text-white z-50 hidden md:block"><ChevronRight size={48}/></button></>)}<img src={currentLightboxImages[currentImageIndex]} alt="" className="max-w-full max-h-full object-contain pointer-events-none select-none" />{currentLightboxImages.length > 1 && (<div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">{currentLightboxImages.map((_, idx) => (<div key={idx} className={`w-2 h-2 rounded-full transition-colors ${idx === currentImageIndex ? 'bg-[#FFC300]' : 'bg-white/30'}`} />))}</div>)}</div></div>)}
    </div>
  );
};

export default TyreShop;
