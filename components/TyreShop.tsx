import React, { useState, useEffect, useMemo, useRef } from 'react';
import { formatUaPhone, isValidUaPhone } from '../phone';
import { supabase } from '../supabaseClient';
import { TyreProduct, CartItem } from '../types';
import { Loader2, Phone, ArrowDown, ArrowLeft, ArrowRight, MapPin, X, ShoppingCart, Scale, Heart, MessageCircle, Send } from 'lucide-react';
import { PHONE_LINK_1, PHONE_NUMBER_1, FORMSPREE_ENDPOINT, TELEGRAM_LINK, VIBER_LINK, SITE_URL } from '../constants';

// Підкомпоненти
import CartDrawer from './shop/CartDrawer';
import ProductDetailModal from './shop/ProductDetailModal';
import CategoryNav, { CategorySelection } from './shop/CategoryNav';
import { FilterPanel, SearchBar, FilterSheet, FilterState, SortValue, countActiveFilters } from './shop/FilterToolbar';
import ProductCard from './shop/ProductCard';
import { useCategories, buildCategoryFilter, getCategoryPath, getRootOf, getRootCategories, getChildren, isTyreProduct } from '../categories';
import { getPresetForCategory, getPresetForProduct, getCardChips, sortAttrValues } from '../productAttributes';
import { productPath, productIdFromLocation } from '../productUrl';
import { parseSearch, searchFilters } from '../searchQuery';
import { useStoredIds, FAVORITES_KEY, COMPARE_KEY, COMPARE_MAX } from '../shopLists';
import CompareModal from './shop/CompareModal';
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

const setHeadTag = (selector: string, create: () => HTMLElement, attr: string, value: string) => {
  let el = document.head.querySelector(selector) as HTMLElement | null;
  if (!el) { el = create(); document.head.appendChild(el); }
  el.setAttribute(attr, value);
};
const setCanonical = (url: string) => {
  setHeadTag('link[rel="canonical"]', () => { const l = document.createElement('link'); l.setAttribute('rel', 'canonical'); return l; }, 'href', url);
  setHeadTag('meta[property="og:url"]', () => { const m = document.createElement('meta'); m.setAttribute('property', 'og:url'); return m; }, 'content', url);
};
const setMetaDescription = (text: string) => {
  setHeadTag('meta[name="description"]', () => { const m = document.createElement('meta'); m.setAttribute('name', 'description'); return m; }, 'content', text);
};

const getSeasonLabel = (s: string | undefined) => {
    if(s === 'winter') return 'Зимова';
    if(s === 'summer') return 'Літня';
    if(s === 'all-season') return 'Всесезонна';
    return 'Універсальна';
}

interface TyreShopProps {
  initialProduct?: TyreProduct | null;
  onBack?: () => void;
  /** signed-in customer (not staff) — orders are linked to the account and the form is prefilled */
  userId?: string;
  userEmail?: string;
  /** opens the customer sign-in window */
  onRequireLogin?: () => void;
  cartItems: CartItem[];
  onCartChange: (items: CartItem[]) => void;
}

const TyreShop: React.FC<TyreShopProps> = ({ 
  initialProduct, 
  onBack, 
  userId,
  userEmail,
  onRequireLogin,
  cartItems,
  onCartChange,
}) => {
  const { categories, dbReady, loading: categoriesLoading } = useCategories();
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
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxTouch = useRef<number | null>(null);
  const [selectedProductForModal, setSelectedProductForModal] = useState<TyreProduct | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<TyreProduct[]>([]);
  const [agroFeaturedProducts, setAgroFeaturedProducts] = useState<TyreProduct[]>([]);
  const [priorityProductId, setPriorityProductId] = useState<number | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('recent_tyres');
      if (stored) setRecentlyViewed(JSON.parse(stored));
    } catch(e) {}
  }, [selectedProductForModal]);

  const [activeCategory, setActiveCategory] = useState<CategorySelection>('all');
  const favorites = useStoredIds(FAVORITES_KEY);
  const compare = useStoredIds(COMPARE_KEY, COMPARE_MAX);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareProducts, setCompareProducts] = useState<TyreProduct[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const activeCat = typeof activeCategory === 'number' ? categories.find(c => c.id === activeCategory) : undefined;
  const agroCategory = categories.find(c => c.vehicle_type === 'agro');
  const showTyreFilters = !!activeCat && activeCat.kind === 'tyre';
  const preset = getPresetForCategory(categories, activeCat);
  const [attrFilters, setAttrFilters] = useState<Record<string, string>>({});
  const [attrValues, setAttrValues] = useState<Record<string, string[]>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  // direction of the slide animation when switching categories (-1 = from left, 1 = from right)
  const [slideDir, setSlideDir] = useState<0 | -1 | 1>(0);

  // Order of categories for swipe navigation and slide direction: all, Шини, Легкові, ..., Диски, ..., Акції
  const categoryOrder = useMemo<CategorySelection[]>(() => [
    'all',
    ...getRootCategories(categories).flatMap(r => [r.id, ...getChildren(categories, r.id).map(c => c.id)]),
    'hot',
  ], [categories]);

  // --- LOGIC: CATEGORY <-> URL (?c=slug) ---
  useEffect(() => {
    if (categoriesLoading) return;
    const slug = new URLSearchParams(window.location.search).get('c');
    if (slug === 'akcii') setActiveCategory('hot');
    else if (slug === 'obrane') setActiveCategory('fav');
    else if (slug) {
      const found = categories.find(c => c.slug === slug);
      if (found) setActiveCategory(found.id);
    }
  }, [categoriesLoading]);

  useEffect(() => {
    if (categoriesLoading || window.location.pathname.startsWith('/p/')) return;
    const url = new URL(window.location.href);
    if (activeCategory === 'all') url.searchParams.delete('c');
    else url.searchParams.set('c', activeCategory === 'hot' ? 'akcii' : activeCategory === 'fav' ? 'obrane' : (activeCat?.slug || ''));
    window.history.replaceState(window.history.state, '', url.toString());
  }, [activeCategory, categoriesLoading]);

  const [activeSort, setActiveSort] = useState<SortValue>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  // search runs 350 ms after the customer stops typing
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(searchQuery), 350); return () => clearTimeout(t); }, [searchQuery]);
  useEffect(() => { if (debouncedSearch.trim().length >= 3) logAnalyticsEvent('search', undefined, debouncedSearch.trim()); }, [debouncedSearch]);
  const [showOnlyInStock, setShowOnlyInStock] = useState(false);

  const [filterWidth, setFilterWidth] = useState('');
  const [filterHeight, setFilterHeight] = useState('');
  const [filterRadius, setFilterRadius] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [filterOptions, setFilterOptions] = useState({ widths: [] as string[], heights: [] as string[], radii: [] as string[], brands: [] as string[] });
  
  const [enableStockQty, setEnableStockQty] = useState(false);
  const [novaPoshtaKey, setNovaPoshtaKey] = useState('');
  const [shopPhone, setShopPhone] = useState(PHONE_NUMBER_1);
  const [shopPhone2, setShopPhone2] = useState('063 582 38 58');
  const [shopPhoneLink, setShopPhoneLink] = useState(PHONE_LINK_1);
  const [shopPhoneLink2, setShopPhoneLinkLink2] = useState('tel:+380635823858');

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

  // Prefill checkout from the customer's profile
  useEffect(() => {
    if (!userId) return;
    supabase.from('customer_profiles').select('full_name, phone, city, warehouse').eq('id', userId).maybeSingle().then(({ data }) => {
      if (!data) return;
      if (data.full_name) setOrderName(prev => prev || data.full_name);
      if (data.phone) { setOrderPhone(prev => prev || formatUaPhone(data.phone)); setQuickOrderPhone(prev => prev || formatUaPhone(data.phone)); }
      if (data.city) { setNpSearchCity(prev => prev || data.city); setSelectedCityName(prev => prev || data.city); }
      if (data.warehouse) setSelectedWarehouseName(prev => prev || data.warehouse);
    });
  }, [userId]);

  const [orderSending, setOrderSending] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState('');

  const [quickOrderProduct, setQuickOrderProduct] = useState<TyreProduct | null>(null);
  const [quickOrderPhone, setQuickOrderPhone] = useState('');
  const [quickOrderSending, setQuickOrderSending] = useState(false);
  const [showContactHub, setShowContactHub] = useState(false);

  // --- LOGIC: PRODUCT WINDOW <-> ADDRESS (/p/<id>-<slug>) ---
  /** Open the product window and give it its own address; "Back" closes it again. */
  const openProduct = (p: TyreProduct, opts: { replace?: boolean } = {}) => {
    setSelectedProductForModal(p);
    const path = productPath(p);
    if (window.location.pathname === path) return;
    const state = { forsageProduct: p.id };
    if (opts.replace || window.history.state?.forsageProduct) window.history.replaceState(state, '', path);
    else window.history.pushState(state, '', path);
  };
  const closeProduct = () => {
    if (window.history.state?.forsageProduct) { window.history.back(); return; } // popstate closes the window
    setSelectedProductForModal(null);
    const params = new URLSearchParams(window.location.search);
    params.delete('p'); params.delete('product');
    const q = params.toString();
    window.history.replaceState({}, '', `/${q ? `?${q}` : ''}`);
  };

  /** Show a product by id (from the address): use the loaded list or ask the database. */
  const showProductById = async (id: number) => {
    const local = tyres.find(t => t.id === id);
    if (local) { setSelectedProductForModal(local); return; }
    const { data } = await supabase.from('tyres').select('*').eq('id', id).maybeSingle();
    if (data) setSelectedProductForModal(parseTyreSpecs(data as TyreProduct));
  };

  // Product address in the URL when the page opens (also old links ?p=123)
  const initialProductHandled = useRef(false);
  useEffect(() => {
    if (initialProductHandled.current || categoriesLoading) return;
    initialProductHandled.current = true;
    const id = productIdFromLocation();
    if (id) {
      showProductById(id).then(() => {
        // turn old ?p=123 links into the new address
        if (!window.location.pathname.startsWith('/p/')) {
          supabase.from('tyres').select('id, title, slug').eq('id', id).maybeSingle().then(({ data }) => {
            if (data) window.history.replaceState({}, '', productPath(data as TyreProduct));
          });
        }
      });
    } else if (initialProduct) {
      openProduct(initialProduct, { replace: true });
    }
  }, [categoriesLoading, initialProduct]);

  // Browser "Back" / "Forward"
  useEffect(() => {
    const onPop = () => {
      const id = productIdFromLocation();
      if (id) showProductById(id);
      else setSelectedProductForModal(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedProductForModal) {
      // SEO: Dynamic Title
      document.title = `${selectedProductForModal.title} — купити в Україні | Forsage`;
      
      // SEO: Meta Description + canonical link of the product page
      setMetaDescription(selectedProductForModal.seo_description || `Купити ${selectedProductForModal.title}. Ціна: ${formatPrice(selectedProductForModal.price)} грн. В наявності. Доставка по Україні.`);
      setCanonical(`${SITE_URL}${productPath(selectedProductForModal)}`);
      logAnalyticsEvent('view_item', String(selectedProductForModal.id), selectedProductForModal.title);
    } else {
      // Only touch SEO tags on category pages; the home page keeps the values from admin SEO settings
      if (activeCat) {
        document.title = `${activeCat.name} — купити в інтернет-магазині Форсаж | Синельникове`;
        setMetaDescription(activeCat.description || `${activeCat.name} в наявності в інтернет-магазині Форсаж. Самовивіз у Синельниковому, доставка Новою Поштою по всій Україні.`);
        setCanonical(`${SITE_URL}/?c=${activeCat.slug}`);
      } else if (activeCategory === 'hot') {
        document.title = 'Акції та знижки — інтернет-магазин Форсаж';
        setCanonical(`${SITE_URL}/?c=akcii`);
      }
      if (url.searchParams.has('p') && !productIdFromLocation()) { url.searchParams.delete('p'); window.history.replaceState({}, '', url.toString()); }
    }
  }, [selectedProductForModal, activeCat, activeCategory]);

  const submitQuickOrder = async () => {
    if (!isValidUaPhone(quickOrderPhone)) { setOrderError("Введіть номер повністю: +380 XX XXX XX XX"); return; }
    if (!quickOrderProduct) return;
    
    setQuickOrderSending(true); setOrderError('');
    try {
      const { error } = await supabase.from('tyre_orders').insert([{ 
 customer_name: orderName || 'Швидке замовлення', 
          customer_phone: quickOrderPhone, 
          status: 'new', 
          user_id: userId || null,
          customer_email: userEmail || null,
          items: [{ id: quickOrderProduct.id, title: quickOrderProduct.title, quantity: 1, price: quickOrderProduct.price }] 
      }]);
      if (error) throw error;
      logAnalyticsEvent('purchase', String(quickOrderProduct.id), quickOrderProduct.title, undefined, safeParsePrice(quickOrderProduct.price));
      setOrderSuccess(true);
      setQuickOrderProduct(null);
      setQuickOrderPhone('');
    } catch (err) { setOrderError("Помилка при відправці замовлення"); } finally { setQuickOrderSending(false); }
  };

  // --- LOGIC: FETCHING SETTINGS ---
  useEffect(() => {
    const fetchSettings = async () => {
      const { data: setts } = await supabase.from('settings').select('key, value').in('key', [
        'enable_stock_quantity', 
        'contact_phone1', 
        'contact_phone2', 
        'nova_poshta_key', 
        'agro_featured_ids',
      ]);
      if (setts) {
          for (const item of setts) {
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
                  setShopPhoneLinkLink2(`tel:${link}`); 
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
      
    };
    fetchSettings();
  }, []);

  // --- LOGIC: FILTER OPTIONS (brands, sizes, characteristics) OF THE CURRENT CATEGORY ---
  useEffect(() => {
    if (categoriesLoading) return;
    let cancelled = false;
    (async () => {
      let q = supabase.from('tyres').select(dbReady ? 'manufacturer, radius, title, attributes' : 'manufacturer, radius, title').neq('in_stock', false);
      if (activeCategory === 'hot') q = q.eq('is_hot', true);
      else if (activeCat) {
        const f = buildCategoryFilter(categories, activeCat, dbReady);
        if (f) q = q.or(f);
      }
      const { data } = await q.limit(5000);
      if (cancelled || !data) return;
      const brands = new Set<string>(), radii = new Set<string>(), widths = new Set<string>(), heights = new Set<string>();
      const attrs: Record<string, Set<string>> = {};
      (data as any[]).forEach(item => {
        if (item.manufacturer?.trim()) brands.add(item.manufacturer.trim());
        if (item.radius) radii.add(item.radius.trim());
        const m = (item.title || '').match(/(\d{3})[\/\s](\d{2})/);
        if (m) { widths.add(m[1]); heights.add(m[2]); }
        if (item.attributes && typeof item.attributes === 'object') {
          for (const [k, v] of Object.entries(item.attributes)) {
            if (v === null || v === undefined || String(v).trim() === '') continue;
            (attrs[k] ||= new Set()).add(String(v).trim());
          }
        }
      });
      setFilterOptions({
        brands: Array.from(brands).sort((a, b) => a.localeCompare(b)),
        radii: Array.from(radii).sort((a, b) => parseFloat(a.replace(/[^\d.]/g, '')) - parseFloat(b.replace(/[^\d.]/g, ''))),
        widths: Array.from(widths).sort(),
        heights: Array.from(heights).sort(),
      });
      setAttrValues(Object.fromEntries(Object.entries(attrs).map(([k, set]) => [k, sortAttrValues(Array.from(set))])));
    })();
    return () => { cancelled = true; };
  }, [categoriesLoading, activeCategory, dbReady]);

  // --- LOGIC: TYRE DATA ---
  const attrFiltersKey = JSON.stringify(attrFilters);
  useEffect(() => {
    if (categoriesLoading) return;
    setPage(0);
    setTyres([]); 
    fetchTyres(0, true);
  }, [categoriesLoading, activeCategory, activeSort, enableStockQty, filterBrand, filterRadius, filterWidth, filterHeight, filterSeason, showOnlyInStock, debouncedSearch, priorityProductId, attrFiltersKey]);

  const resetFilters = () => {
    setSearchQuery(''); setFilterWidth(''); setFilterHeight(''); setFilterRadius(''); setFilterBrand(''); setFilterSeason(''); setAttrFilters({}); setShowOnlyInStock(false);
  };

  const filterState: FilterState = { searchQuery, showOnlyInStock, filterWidth, filterHeight, filterRadius, filterBrand, filterSeason, attrFilters };
  const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    const setters: Record<string, (v: any) => void> = {
      searchQuery: setSearchQuery, showOnlyInStock: setShowOnlyInStock, filterWidth: setFilterWidth, filterHeight: setFilterHeight,
      filterRadius: setFilterRadius, filterBrand: setFilterBrand, filterSeason: setFilterSeason, attrFilters: setAttrFilters,
    };
    setters[key](value);
  };
  const setAttr = (key: string, value: string) => setAttrFilters(prev => {
    const next = { ...prev };
    if (value) next[key] = value; else delete next[key];
    return next;
  });
  const activeFilterCount = countActiveFilters(filterState);

  /** Switch category with filters cleanup + slide animation direction. */
  const changeCategory = (cat: CategorySelection) => {
    if (cat === activeCategory) return;
    const next = typeof cat === 'number' ? categories.find(c => c.id === cat) : undefined;
    if (cat === 'all') {
      resetFilters();
    } else if (!next || next.kind !== 'tyre') {
      // tyre-only filters make no sense outside tyre categories
      setFilterWidth(''); setFilterHeight(''); setFilterRadius(''); setFilterSeason('');
    }
    const rootChanged = !next || !activeCat || getRootOf(categories, next).id !== getRootOf(categories, activeCat).id;
    if (rootChanged) { setFilterBrand(''); setAttrFilters({}); }
    const from = categoryOrder.indexOf(activeCategory), to = categoryOrder.indexOf(cat);
    setSlideDir(to > from ? 1 : -1);
    setPriorityProductId(null);
    setActiveCategory(cat);
  };

  // Horizontal swipe over the product list switches to the next / previous category
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const onListTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onListTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x, dy = t.clientY - start.y;
    if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - start.t > 700) return;
    const idx = categoryOrder.indexOf(activeCategory);
    const nextIdx = idx + (dx < 0 ? 1 : -1);
    if (nextIdx >= 0 && nextIdx < categoryOrder.length) {
      changeCategory(categoryOrder[nextIdx]);
      window.scrollTo({ top: Math.min(window.scrollY, listTopRef.current ? listTopRef.current.getBoundingClientRect().top + window.scrollY - 140 : 0), behavior: 'smooth' });
    }
  };
  const listTopRef = useRef<HTMLDivElement>(null);

  // Header cart icon opens the cart drawer
  useEffect(() => {
    const open = () => setIsCartOpen(true);
    window.addEventListener('forsage:open-cart', open);
    return () => window.removeEventListener('forsage:open-cart', open);
  }, []);

  const handleAgroProductClick = (id: number) => {
    setPriorityProductId(id);
    setActiveCategory(agroCategory ? agroCategory.id : 'all');
    setFilterSeason('');
    setSearchQuery('');
    setFilterBrand('');
    setFilterRadius('');
    setFilterWidth('');
    setFilterHeight('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const parseTyreSpecs = (tyre: TyreProduct): TyreProduct => {
    if (!isTyreProduct(tyre, categories)) {
      const in_stock = enableStockQty ? (tyre.in_stock !== false && (tyre.stock_quantity ?? 0) > 0) : tyre.in_stock !== false;
      return { ...tyre, season: undefined, width: undefined, height: undefined, in_stock };
    }
    const m = tyre.title.match(/(\d{3})[\/\s](\d{2})[\s\w]*R(\d{2}(?:\.5|\.3)?[C|c]?)/);
    let width = '', height = '', parsedRadius = tyre.radius || '', vehicle_type = tyre.vehicle_type || 'car';
    if (m) { 
        width = m[1]; height = m[2]; 
        const r = m[3].toUpperCase(); 
        if (!parsedRadius) parsedRadius = `R${r}`; 
        if (vehicle_type === 'car' && r.endsWith('C')) vehicle_type = 'cargo'; 
    }
    // unknown season stays unknown (no "всесезонна" badge instead of a guess)
    const season = tyre.season || undefined;
    let in_stock = enableStockQty ? (tyre.in_stock !== false && (tyre.stock_quantity ?? 0) > 0) : tyre.in_stock !== false;
    return { ...tyre, width, height, radius: parsedRadius, season, vehicle_type, in_stock };
  };

  const fetchTyres = async (pageIndex: number, isRefresh = false) => {
    try {
      if (isRefresh) setLoading(true); else setLoadingMore(true);
      const from = pageIndex * PAGE_SIZE, to = from + PAGE_SIZE - 1;
      let query = supabase.from('tyres').select('*', { count: 'exact' });
      
      // smart search: sizes in any format, several words, Cyrillic brand names
      for (const f of searchFilters(parseSearch(debouncedSearch))) query = query.or(f);
      for (const [key, value] of Object.entries(attrFilters)) {
        if (value) query = query.eq(`attributes->>${key}`, value);
      }
      if (filterBrand) query = query.eq('manufacturer', filterBrand);
      if (filterRadius) query = query.eq('radius', filterRadius);
      if (filterWidth) query = query.ilike('title', `%${filterWidth}%`);
      if (filterHeight) query = query.ilike('title', `%/${filterHeight}%`);
      if (showOnlyInStock) query = query.neq('in_stock', false);
      if (filterSeason && showTyreFilters) query = query.eq('season', filterSeason);

      if (activeCategory === 'hot') query = query.eq('is_hot', true);
      else if (activeCategory === 'fav') query = query.in('id', favorites.ids.length ? favorites.ids : [-1]);
      else if (activeCat) {
        const catFilter = buildCategoryFilter(categories, activeCat, dbReady);
        if (catFilter) query = query.or(catFilter);
      }
      
      query = query.order('is_hot', { ascending: false }).order('in_stock', { ascending: false });
      const sorts = { price_asc: 'price', price_desc: 'price', newest: 'created_at', oldest: 'created_at' };
      query = query.order((sorts as any)[activeSort] || 'created_at', { ascending: ['price_asc','oldest'].includes(activeSort) });

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      if (data) {
        let processed = data.map(parseTyreSpecs);
        
        // --- PRIORITY LOGIC ---
        if (priorityProductId && pageIndex === 0 && agroCategory && activeCategory === agroCategory.id) {
            const index = processed.findIndex(p => p.id === priorityProductId);
            if (index > 0) {
                const [item] = processed.splice(index, 1);
                processed.unshift(item);
            } else if (index === -1) {
                const { data: pData } = await supabase.from('tyres').select('*').eq('id', priorityProductId).single();
                if (pData) processed.unshift(parseTyreSpecs(pData));
            }
        }
        
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
    if (!orderName.trim()) { setOrderError("Будь ласка, введіть ім'я"); return; }
    if (!isValidUaPhone(orderPhone)) { setOrderError("Введіть телефон повністю: +380 XX XXX XX XX"); return; }
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
          user_id: userId || null,
          customer_email: userEmail || null,
          items: cartItems.map(i => ({ id: i.id, title: i.title, quantity: i.quantity, price: i.price })) 
      }]);
      if (error) throw error;
      logAnalyticsEvent('purchase', cartItems.map(i => i.id).join(','), `${cartItems.length} товар(и)`, undefined,
        cartItems.reduce((sum, i) => sum + safeParsePrice(i.price) * i.quantity, 0));
      // remember name / phone / delivery address in the customer's profile
      if (userId) {
        supabase.from('customer_profiles').upsert({
          id: userId, full_name: orderName, phone: orderPhone,
          ...(deliveryMethod === 'newpost' && selectedCityName ? { city: selectedCityName, warehouse: selectedWarehouseName } : {}),
          updated_at: new Date().toISOString(),
        }).then(() => {});
      }
      setOrderSuccess(true); 
      onCartChange([]);
    } catch (err) { setOrderError("Помилка при відправці замовлення"); } finally { setOrderSending(false); }
  };

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

  const handleProductClick = (tyre: TyreProduct) => {
    if (tyre.in_stock !== false) openProduct(tyre);
  };

  const renderSchema = (product: TyreProduct) => {
    const schema = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": product.title,
      "image": [product.image_url, ...(product.gallery || [])].filter(Boolean),
      "description": product.description || `${product.title} — в наявності в інтернет-магазині Forsage.`,
      "sku": `product-${product.id}`,
      "brand": {
        "@type": "Brand",
        "name": product.manufacturer || "Forsage Tires"
      },
      "offers": {
        "@type": "Offer",
        "url": `${SITE_URL}${productPath(product)}`,
        "priceCurrency": "UAH",
        "price": safeParsePrice(product.price),
        "priceValidUntil": "2026-12-31",
        "availability": product.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        "itemCondition": "https://schema.org/NewCondition"
      }
    };
    return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />;
  };

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2500);
  };
  const toggleFavorite = (p: TyreProduct) => {
    const adding = !favorites.has(p.id);
    favorites.toggle(p.id);
    showToast(adding ? `В обраному: ${p.title}` : 'Прибрано з обраного');
    if (adding) logAnalyticsEvent('add_to_wishlist', String(p.id), p.title);
  };
  const toggleCompare = (p: TyreProduct) => {
    const adding = !compare.has(p.id);
    if (!compare.toggle(p.id)) { showToast(`Можна порівняти до ${COMPARE_MAX} товарів`); return; }
    showToast(adding ? `Додано до порівняння (${compare.ids.length + 1})` : 'Прибрано з порівняння');
  };

  // Load products for the compare window
  useEffect(() => {
    if (!compareOpen) return;
    if (compare.ids.length === 0) { setCompareProducts([]); return; }
    setCompareLoading(true);
    supabase.from('tyres').select('*').in('id', compare.ids).then(({ data }) => {
      const list = ((data as TyreProduct[]) || []).map(parseTyreSpecs);
      setCompareProducts(compare.ids.map(id => list.find(p => p.id === id)).filter(Boolean) as TyreProduct[]);
      setCompareLoading(false);
    });
  }, [compareOpen, compare.ids.join(',')]);

  // the favourites list changed while looking at it → refresh
  useEffect(() => {
    if (activeCategory === 'fav' && !categoriesLoading) fetchTyres(0, true);
  }, [favorites.ids.join(',')]);

  const filterPanel = (
    <FilterPanel
      state={filterState}
      set={setFilter}
      setAttr={setAttr}
      options={filterOptions}
      attrValues={attrValues}
      showTyreFilters={showTyreFilters}
      preset={preset}
      onReset={resetFilters}
    />
  );

  const slideClass = slideDir === 1 ? 'slide-in-from-right-8' : slideDir === -1 ? 'slide-in-from-left-8' : 'slide-in-from-bottom-4';

  return (
    <div className="min-h-screen bg-[#09090b] pt-3 md:pt-8 pb-32">
      <div className="max-w-7xl mx-auto px-3 md:px-4">

        {/* ── Intro: compact on phones, with mini map on large screens ── */}
        <header className="flex flex-col lg:flex-row justify-between items-stretch lg:items-end gap-4 lg:gap-6 mb-5 md:mb-8">
          <div className="flex-1 space-y-3 md:space-y-5 animate-in fade-in slide-in-from-left-4 duration-500">
            <nav className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] uppercase tracking-widest font-black text-zinc-500" aria-label="Навігація">
              <button onClick={onBack} className="hover:text-[#FFC300] transition-colors">Головна</button>
              <span className="text-zinc-800">/</span>
              <button onClick={() => changeCategory('all')} className="text-zinc-500 hover:text-[#FFC300] transition-colors">Каталог</button>
              {activeCategory === 'hot' && (<><span className="text-zinc-800">/</span><span className="text-[#FFC300]">Акції</span></>)}
              {activeCategory === 'fav' && (<><span className="text-zinc-800">/</span><span className="text-[#FFC300]">Обране</span></>)}
              {activeCat && getCategoryPath(categories, activeCat).map((c, i, arr) => (
                <React.Fragment key={c.id}>
                  <span className="text-zinc-800">/</span>
                  {i === arr.length - 1
                    ? <span className="text-[#FFC300]">{c.name}</span>
                    : <button onClick={() => changeCategory(c.id)} className="text-zinc-500 hover:text-[#FFC300] transition-colors">{c.name}</button>}
                </React.Fragment>
              ))}
            </nav>

            <h1 key={`h1-${String(activeCategory)}`} className="text-[28px] leading-[1.05] sm:text-4xl md:text-5xl font-black text-white uppercase italic tracking-tighter animate-in fade-in slide-in-from-bottom-2 duration-300">
              {activeCat ? activeCat.name : activeCategory === 'hot' ? 'Акції' : activeCategory === 'fav' ? 'Обране' : <>Форсаж <span className="text-[#FFC300]">Синельникове</span></>}
            </h1>

            <p className="text-zinc-400 text-sm md:text-base max-w-xl leading-relaxed line-clamp-2 md:line-clamp-none">
              {activeCat?.description || <>
                <span className="text-[#FFC300] font-bold">Шини, диски, акумулятори та автотовари</span> в наявності.
                Самовивіз у <span className="text-white font-bold">Синельниковому</span> або доставка Новою Поштою по всій Україні.
              </>}
            </p>

            <div className="flex flex-wrap gap-2">
              <a href={shopPhoneLink} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 pl-1.5 pr-3 py-1.5 md:pl-2 md:pr-4 md:py-2 rounded-xl hover:border-[#FFC300] transition-all group active:scale-95">
                <span className="w-8 h-8 md:w-10 md:h-10 bg-[#FFC300] rounded-lg flex items-center justify-center text-black group-hover:scale-110 transition-transform"><Phone size={16} /></span>
                <span className="text-white font-black text-sm md:text-lg tracking-tight">{shopPhone}</span>
              </a>
              <a href={shopPhoneLink2} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 pl-1.5 pr-3 py-1.5 md:pl-2 md:pr-4 md:py-2 rounded-xl hover:border-[#FFC300] transition-all group active:scale-95">
                <span className="w-8 h-8 md:w-10 md:h-10 bg-zinc-800 border border-zinc-700 rounded-lg flex items-center justify-center text-[#FFC300] group-hover:scale-110 transition-transform"><Phone size={16} /></span>
                <span className="text-white font-black text-sm md:text-lg tracking-tight">{shopPhone2}</span>
              </a>
              <a
                href="https://www.google.com/maps/dir/?api=1&destination=48.317541,35.513511"
                target="_blank" rel="noopener noreferrer"
                className="lg:hidden flex items-center gap-2 bg-zinc-900 border border-zinc-800 pl-1.5 pr-3 py-1.5 md:pl-2 md:pr-4 md:py-2 rounded-xl hover:border-[#FFC300] transition-all active:scale-95"
              >
                <span className="w-8 h-8 md:w-10 md:h-10 bg-zinc-800 border border-zinc-700 rounded-lg flex items-center justify-center text-[#FFC300]"><MapPin size={16} /></span>
                <span className="text-zinc-300 font-bold text-xs md:text-sm">вул. Квітнева 9</span>
              </a>
            </div>
          </div>

          {/* Desktop: Mini Map */}
          <div className="hidden lg:block lg:w-5/12 xl:w-[420px] shrink-0 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#FFC300]/40 to-yellow-600/20 rounded-3xl blur opacity-30 group-hover:opacity-60 transition duration-700"></div>
              <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2653.2206680489955!2d35.513511315682!3d48.31754097923793!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDjCsDE5JzAzLjEiTiAzNcKwMzAnNDguNiJF!5e0!3m2!1suk!2sua!4v1650000000000!5m2!1suk!2sua"
                  width="100%" height="180"
                  style={{ border: 0, filter: 'grayscale(1) invert(0.85) contrast(1.1)' }}
                  allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                  title="Forsage location"
                ></iframe>
                <div className="bg-zinc-950/90 border-t border-zinc-800 p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <MapPin size={12} className="text-[#FFC300] shrink-0" />
                    <p className="text-zinc-400 text-[11px] font-bold truncate">м. Синельникове, вул. Квітнева 9</p>
                  </div>
                  <a
                    href="https://www.google.com/maps/dir/?api=1&destination=48.317541,35.513511"
                    target="_blank" rel="noopener noreferrer"
                    className="bg-[#FFC300] px-3 py-1.5 rounded-lg text-black font-black text-[11px] uppercase tracking-widest hover:bg-white transition-colors shrink-0 flex items-center gap-1"
                  >
                    Маршрут <ArrowRight size={10} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </header>

        <CategoryNav categories={categories} active={activeCategory} onChange={changeCategory} favoritesCount={favorites.ids.length} />

        {activeCategory === 'all' && agroCategory && (
          <AgroBanner
            onCategoryClick={() => changeCategory(agroCategory.id)}
            featuredProducts={agroFeaturedProducts}
            onProductClick={handleAgroProductClick}
          />
        )}

        {/* ── Catalogue: filters sidebar (desktop) + products ── */}
        <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6 xl:gap-8">
          <aside className="hidden lg:block" aria-label="Фільтри">
            <div className="sticky pb-6 max-h-[calc(100vh-var(--header-h,72px)-24px)] overflow-y-auto overscroll-contain pr-1 scrollbar-hide" style={{ top: 'calc(var(--header-h, 72px) + 16px)' }}>
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-zinc-300 mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-[#FFC300] rounded-full" /> Фільтри
                </h2>
                {filterPanel}
              </div>
            </div>
          </aside>

          <div ref={listTopRef} onTouchStart={onListTouchStart} onTouchEnd={onListTouchEnd} className="min-w-0">
            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSearch={() => setDebouncedSearch(searchQuery)}
              activeSort={activeSort}
              setActiveSort={setActiveSort}
              activeFilters={activeFilterCount}
              totalCount={totalCount}
              onOpenFilters={() => setFiltersOpen(true)}
            />

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5 mt-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-zinc-900/40 rounded-2xl animate-pulse border border-zinc-800/50 flex flex-col p-3">
                    <div className="bg-zinc-800/50 rounded-xl aspect-square mb-3 w-full"></div>
                    <div className="bg-zinc-800/50 h-2 w-16 mb-2 rounded-full"></div>
                    <div className="bg-zinc-800/50 h-4 w-3/4 mb-4 rounded-full"></div>
                    <div className="bg-zinc-800/50 h-8 w-2/3 rounded-xl"></div>
                  </div>
                ))}
              </div>
            ) : tyres.length === 0 ? (
              <div key={`empty-${String(activeCategory)}`} className={`mt-2 text-center py-16 md:py-24 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800 flex flex-col items-center gap-5 px-4 animate-in fade-in ${slideClass} duration-300`}>
                <div className="p-5 bg-zinc-800/50 rounded-full text-zinc-600"><ShoppingCart size={40} strokeWidth={1} /></div>
                <div className="space-y-2">
                  <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tight">Нічого не знайдено</h3>
                  <p className="text-zinc-500 text-sm max-w-xs mx-auto">
                    {activeFilterCount || searchQuery ? 'Спробуйте змінити або скинути фільтри' : 'У цій категорії поки немає товарів. Зателефонуйте — підберемо під замовлення!'}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {(activeFilterCount > 0 || searchQuery) && <button onClick={resetFilters} className="bg-white text-black font-black px-6 py-3 rounded-xl hover:bg-[#FFC300] transition-all">Скинути фільтри</button>}
                  <a href={shopPhoneLink} className="bg-zinc-800 text-white font-black px-6 py-3 rounded-xl hover:bg-zinc-700 transition-all flex items-center gap-2"><Phone size={16} /> {shopPhone}</a>
                </div>
              </div>
            ) : (
              <div key={`grid-${String(activeCategory)}`} className={`grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5 mt-2 animate-in fade-in ${slideClass} duration-300`}>
                {tyres.map((tyre, idx) => (
                  <div key={tyre.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${Math.min((idx % PAGE_SIZE) * 40, 400)}ms` }}>
                    <ProductCard
                      tyre={tyre}
                      chips={getCardChips(getPresetForProduct(categories, tyre), tyre.attributes)}
                      onClick={() => handleProductClick(tyre)}
                      onAddToCart={(e) => { e.stopPropagation(); addToCart(tyre); }}
                      onQuickOrder={(p) => setQuickOrderProduct(p)}
                      formatPrice={formatPrice}
                      isFavorite={favorites.has(tyre.id)}
                      onToggleFavorite={() => toggleFavorite(tyre)}
                      isCompared={compare.has(tyre.id)}
                      onToggleCompare={() => toggleCompare(tyre)}
                      showStock={enableStockQty}
                    />
                  </div>
                ))}
              </div>
            )}

            {hasMore && !loading && tyres.length > 0 && (
              <div className="mt-10 md:mt-16 text-center">
                <button
                  onClick={() => fetchTyres(page + 1)}
                  disabled={loadingMore}
                  className="group relative bg-zinc-900 hover:bg-zinc-800 text-white font-black py-4 px-10 rounded-2xl border border-zinc-800 transition-all shadow-xl flex items-center justify-center gap-3 mx-auto overflow-hidden active:scale-95"
                >
                  {loadingMore ? <Loader2 className="animate-spin" size={20} /> : <ArrowDown size={20} className="group-hover:translate-y-1 transition-transform" />}
                  <span className="uppercase tracking-widest text-xs md:text-sm">Показати ще</span>
                </button>
                <p className="mt-3 text-zinc-500 text-[11px] font-bold uppercase tracking-widest">Показано {tyres.length} з {totalCount}</p>
              </div>
            )}

            <p className="lg:hidden mt-6 text-center text-[11px] font-bold uppercase tracking-widest text-zinc-700">
              ← Проведіть пальцем, щоб змінити категорію →
            </p>
          </div>
        </div>
      </div>

      {compare.ids.length > 0 && (
        <button
          onClick={() => setCompareOpen(true)}
          className="fixed left-4 md:left-6 z-[150] flex items-center gap-2 bg-[#FFC300] text-black font-black text-xs uppercase tracking-wide pl-3 pr-4 py-3 rounded-2xl shadow-2xl shadow-yellow-900/30 hover:bg-white transition-colors animate-in slide-in-from-left-4 fade-in duration-300"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
        >
          <Scale size={18} /> Порівняти ({compare.ids.length})
        </button>
      )}

      <CompareModal
        open={compareOpen}
        products={compareProducts}
        categories={categories}
        loading={compareLoading}
        onClose={() => setCompareOpen(false)}
        onRemove={compare.remove}
        onClear={() => { compare.clear(); setCompareOpen(false); }}
        onOpenProduct={(p) => { setCompareOpen(false); openProduct(p); }}
        onAddToCart={(p) => addToCart(p)}
        formatPrice={formatPrice}
      />

      <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} totalCount={totalCount}>
        {filterPanel}
      </FilterSheet>

      {recentlyViewed.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 mt-16 pb-12">
            <h2 className="text-xl font-black text-white uppercase tracking-widest mb-6 border-b border-zinc-800 pb-4">
              <span className="bg-[#FFC300] text-black px-2 py-0.5 mr-2 rounded">історія</span>
              Ви нещодавно переглядали
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-6 snap-x" style={{scrollbarWidth: 'none'}}>
              {recentlyViewed.map(t => (
                  <div key={t.id} onClick={() => openProduct(t)} className="min-w-[180px] max-w-[220px] bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col cursor-pointer hover:border-[#FFC300] transition-colors snap-center group">
                    <div className="h-32 mb-3 bg-zinc-950 rounded-xl p-2 flex items-center justify-center overflow-hidden">
                        {t.image_url ? <img src={t.image_url} alt={t.title} className="max-h-full object-contain group-hover:scale-110 transition-transform"/> : <div className="text-zinc-700 font-bold text-[11px] uppercase">Без фото</div>}
                    </div>
                    <span className="text-[11px] text-[#FFC300] font-black uppercase tracking-widest mb-1 truncate">{t.manufacturer || 'Товар'}</span>
                    <h4 className="text-white text-xs font-bold line-clamp-2 mb-2 flex-grow">{t.title}</h4>
                    <span className="text-base font-black text-white">{formatPrice(t.price)} грн</span>
                  </div>
              ))}
            </div>
        </div>
      )}

      {cartItems.length > 0 && (
        <button
          onClick={() => setIsCartOpen(true)}
          key={`cart-${cartItems.length}`}
          className="fixed right-4 md:right-6 z-[155] bg-white text-black w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform animate-in zoom-in-50 duration-300"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}
          aria-label="Відкрити кошик"
        >
          <ShoppingCart size={24} />
          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[11px] font-bold min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full border-2 border-zinc-900">{cartItems.reduce((a,b)=>a+b.quantity,0)}</span>
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
        product={selectedProductForModal} onClose={closeProduct} 
        preset={selectedProductForModal ? getPresetForProduct(categories, selectedProductForModal) : null}
        isFavorite={selectedProductForModal ? favorites.has(selectedProductForModal.id) : false}
        onToggleFavorite={() => selectedProductForModal && toggleFavorite(selectedProductForModal)}
        isCompared={selectedProductForModal ? compare.has(selectedProductForModal.id) : false}
        onToggleCompare={() => selectedProductForModal && toggleCompare(selectedProductForModal)}
        userId={userId}
        userName={orderName}
        onRequireLogin={onRequireLogin}
        addToCart={addToCart} formatPrice={formatPrice} getSeasonLabel={getSeasonLabel} renderSchema={renderSchema}
        openLightbox={(images, index) => { setCurrentLightboxImages(images); setLightboxIndex(index); setLightboxOpen(true); }}
        showStock={enableStockQty}
        onQuickOrder={(p) => setQuickOrderProduct(p)}
        onSimilarClick={(t) => openProduct(t, { replace: true })}
      />

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setLightboxOpen(false)}
          onTouchStart={e => { lightboxTouch.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            const start = lightboxTouch.current; lightboxTouch.current = null;
            if (start === null || currentLightboxImages.length < 2) return;
            const dx = e.changedTouches[0].clientX - start;
            if (Math.abs(dx) > 50) { e.stopPropagation(); e.preventDefault(); setLightboxIndex(i => (i + (dx < 0 ? 1 : -1) + currentLightboxImages.length) % currentLightboxImages.length); }
          }}
        >
          <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full z-10" aria-label="Закрити"><X size={32}/></button>
          {currentLightboxImages.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setLightboxIndex(i => (i - 1 + currentLightboxImages.length) % currentLightboxImages.length); }} className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 text-white items-center justify-center hover:bg-white/20" aria-label="Попереднє фото"><ArrowLeft size={24} /></button>
              <button onClick={e => { e.stopPropagation(); setLightboxIndex(i => (i + 1) % currentLightboxImages.length); }} className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 text-white items-center justify-center hover:bg-white/20" aria-label="Наступне фото"><ArrowRight size={24} /></button>
              <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-sm font-bold">{lightboxIndex + 1} / {currentLightboxImages.length}</span>
            </>
          )}
          <img key={lightboxIndex} src={currentLightboxImages[lightboxIndex]} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in fade-in duration-200" alt="" />
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
                <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest mb-2 text-left">Ваш телефон</p>
                <input 
                  type="tel" 
                  placeholder="+380 __ ___ __ __" 
                  value={quickOrderPhone}
                  inputMode="tel" autoComplete="tel"
                  onChange={e => setQuickOrderPhone(formatUaPhone(e.target.value))}
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
              
              <p className="text-[10px] text-zinc-500 font-bold uppercase mt-4">Натискаючи кнопку, ви погоджуєтесь з <a href="/oferta" target="_blank" className="underline">офертою</a> та <a href="/privacy" target="_blank" className="underline">обробкою персональних даних</a>.</p>
            </div>
          </div>
        </div>
      )}

      {/* Floating contact button: Viber / Telegram / call */}
      {showContactHub && <div className="fixed inset-0 z-[159] bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={() => setShowContactHub(false)} />}
      <div className="fixed right-4 md:right-6 z-[160] flex flex-col items-end gap-2.5 pointer-events-none" style={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)" }}>
          <div className={`flex flex-col items-end gap-2.5 transition-all duration-300 origin-bottom-right ${showContactHub ? 'scale-100 opacity-100 translate-y-0 pointer-events-auto' : 'scale-75 opacity-0 translate-y-6 pointer-events-none'}`}>
              {[
                { href: VIBER_LINK, label: 'Viber', cls: 'bg-[#7360F2] text-white', icon: <MessageCircle size={22} /> },
                { href: TELEGRAM_LINK, label: 'Telegram', cls: 'bg-[#0088cc] text-white', icon: <Send size={22} />, external: true },
                { href: shopPhoneLink, label: `Подзвонити ${shopPhone}`, cls: 'bg-[#FFC300] text-black', icon: <Phone size={22} strokeWidth={2.5} /> },
              ].map(item => (
                <a key={item.label} href={item.href} {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} onClick={() => setShowContactHub(false)} className="flex items-center gap-2.5">
                  <span className="bg-black/90 border border-zinc-800 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-2xl whitespace-nowrap">{item.label}</span>
                  <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl active:scale-95 transition-transform ${item.cls}`}>{item.icon}</span>
                </a>
              ))}
          </div>

          <button 
            onClick={() => setShowContactHub(!showContactHub)}
            className={`h-14 rounded-2xl flex items-center justify-center gap-2 shadow-2xl transition-all duration-300 pointer-events-auto active:scale-95 ${showContactHub ? 'w-14 bg-zinc-800 text-white' : 'w-14 md:w-auto md:px-5 bg-[#FFC300] text-black shadow-yellow-900/50'}`}
            aria-label={showContactHub ? 'Закрити' : "Зв'язатися з нами"} aria-expanded={showContactHub}
          >
            {showContactHub ? <X size={26} /> : <><MessageCircle size={26} strokeWidth={2.5} /><span className="hidden md:inline font-black text-sm uppercase">Зв'язатися</span></>}
          </button>
      </div>

      {toast.visible && (
        <div className="fixed bottom-[100px] left-1/2 -translate-x-1/2 z-[150] w-[90%] md:w-auto bg-black/90 backdrop-blur-md text-white px-2 py-2 md:px-6 md:py-3 rounded-2xl md:rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-between gap-3 animate-in slide-in-from-bottom-10 fade-in duration-300 border border-zinc-800">
           <div className="flex items-center gap-3 w-full overflow-hidden">
             <div className="bg-[#FFC300] p-2 rounded-xl shrink-0"><ShoppingCart size={16} className="text-black" /></div>
             <div className="flex flex-col flex-1 min-w-0">
               <span className="text-[11px] font-black uppercase tracking-widest text-[#FFC300]">У кошику</span>
               <span className="text-xs font-bold truncate">{toast.message}</span>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default TyreShop;
