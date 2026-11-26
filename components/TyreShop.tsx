import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { TyreProduct, CartItem } from '../types';
import { useCategories, getRootOf, getRootCategories, getChildren, isTyreProduct, getCategoryIcon } from '../categories';
import { getPresetForCategory, getPresetForProduct, getCardChips } from '../productAttributes';
import { useStoredIds, FAVORITES_KEY, COMPARE_KEY, COMPARE_MAX } from '../shopLists';
import { useSitePromos } from '../sitePromos';
import { logAnalyticsEvent } from './admin/analytics';

// Blocks of the page
import ShopIntro from './shop/ShopIntro';
import CategoryNav, { CategorySelection } from './shop/CategoryNav';
import QuickFilters from './shop/QuickFilters';
import HomeShowcase from './home/HomeShowcase';
import AgroBanner from './shop/AgroBanner';
import { FilterPanel, SearchBar, FilterSheet } from './shop/FilterToolbar';
import ProductCard from './shop/ProductCard';
import { GridSkeleton, EmptyResults, ShowMore, CategoryAbout, SwipeHint } from './shop/CatalogParts';
import RecentlyViewed from './shop/RecentlyViewed';
import { CompareButton, CartButton, CartToast, useToast } from './shop/FloatingButtons';
import ContactHub from './shop/ContactHub';
// Windows
import CartDrawer from './shop/CartDrawer';
import ProductDetailModal from './shop/ProductDetailModal';
import CompareModal from './shop/CompareModal';
import QuickOrderModal from './shop/QuickOrderModal';
import Lightbox, { useLightbox } from './shop/Lightbox';
import SizeGuideModal from './home/SizeGuideModal';
// Logic
import { PAGE_SIZE, safeParsePrice, formatPrice, getSeasonLabel } from './shop/shopUtils';
import { prepareProduct } from './shop/productSpecs';
import { renderProductSchema } from './shop/productSchema';
import { useShopSettings } from './shop/hooks/useShopSettings';
import { useShopFilters } from './shop/hooks/useShopFilters';
import { useCategoryUrl } from './shop/hooks/useCategoryUrl';
import { catSlugFrom } from '../api/_paths.js';
import { useCheckout } from './shop/hooks/useCheckout';
import { useProductList } from './shop/hooks/useProductList';
import { useFilterOptions } from './shop/hooks/useFilterOptions';
import { useProductRoute } from './shop/hooks/useProductRoute';
import { useShopSeo } from './shop/hooks/useShopSeo';
import { useCompareWindow } from './shop/hooks/useCompareWindow';
import { useCategorySwipe } from './shop/hooks/useCategorySwipe';

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

/**
 * The shop page: sections, filters, the product list, product window, cart and checkout.
 * This file only ties the parts together; the blocks live in ./shop and the logic in ./shop/hooks.
 */
const TyreShop: React.FC<TyreShopProps> = ({
  initialProduct,
  userId,
  userEmail,
  onRequireLogin,
  cartItems,
  onCartChange,
}) => {
  const { categories, dbReady, loading: categoriesLoading } = useCategories();
  const { promos, ready: promosReady } = useSitePromos();
  const { enableStockQty, novaPoshtaKey, shopPhone, shopPhone2, shopPhoneLink, shopPhoneLink2, agroFeaturedProducts } = useShopSettings();
  const favorites = useStoredIds(FAVORITES_KEY);
  const compare = useStoredIds(COMPARE_KEY, COMPARE_MAX);
  const { toast, show: showToast } = useToast();
  const lightbox = useLightbox();

  /** database row → product as the shop shows it (tyre size, real availability, promo price) */
  const prepare = (tyre: TyreProduct): TyreProduct => prepareProduct(tyre, categories, promos, enableStockQty);

  // --- the chosen section ---
  const [activeCategory, setActiveCategory] = useState<CategorySelection>('all');
  const activeCat = typeof activeCategory === 'number' ? categories.find(c => c.id === activeCategory) : undefined;
  const categorySlug = (cat: CategorySelection) => cat === 'all' ? '' : cat === 'hot' ? 'akcii' : cat === 'fav' ? 'obrane' : (categories.find(c => c.id === cat)?.slug || '');
  const agroCategory = categories.find(c => c.vehicle_type === 'agro');
  const showTyreFilters = !!activeCat && activeCat.kind === 'tyre';
  const preset = getPresetForCategory(categories, activeCat);
  /** a product picked in the agro banner: shown first in its section */
  const [priorityProductId, setPriorityProductId] = useState<number | null>(null);
  // direction of the slide animation when switching categories (-1 = from left, 1 = from right)
  const [slideDir, setSlideDir] = useState<0 | -1 | 1>(0);

  // Order of categories for swipe navigation and slide direction: all, Шини, Легкові, ..., Диски, ..., Акції
  const categoryOrder = useMemo<CategorySelection[]>(() => [
    'all',
    ...getRootCategories(categories).flatMap(r => [r.id, ...getChildren(categories, r.id).map(c => c.id)]),
    'hot',
  ], [categories]);

  const filters = useShopFilters();
  const { searchQuery, setSearchQuery, debouncedSearch, setDebouncedSearch, activeFilterCount, resetFilters } = filters;
  // A section's own address is being opened (from Google or a link): until the section is chosen, don't show
  // the home page and don't load all goods — it fetched the home blocks for nothing and made the page jump.
  // Decided while drawing (not in an effect), because the home blocks would start loading in that same moment.
  const urlSectionDone = useRef(false);
  const urlSlug = catSlugFrom(window.location.pathname, window.location.search);
  const openingSection = !urlSectionDone.current && activeCategory === 'all' && window.location.pathname.startsWith('/katalog/')
    && (categoriesLoading || urlSlug === 'akcii' || urlSlug === 'obrane' || categories.some(c => c.slug === urlSlug));
  useEffect(() => { if (!categoriesLoading) urlSectionDone.current = true; }, [categoriesLoading]);
  useCategoryUrl(categories, categoriesLoading, activeCategory, setActiveCategory, categorySlug);
  // statistics: which sections people open
  useEffect(() => { if (activeCat) logAnalyticsEvent('page_view', undefined, `Розділ: ${activeCat.name}`); }, [activeCat?.id]);

  const { form: checkoutForm, quickOrder, orderName } = useCheckout({ userId, userEmail, cartItems, onCartChange, novaPoshtaKey });

  /** Switch category with filters cleanup + slide animation direction. */
  const changeCategory = (cat: CategorySelection) => {
    if (cat === activeCategory) return;
    const next = typeof cat === 'number' ? categories.find(c => c.id === cat) : undefined;
    if (cat === 'all') {
      resetFilters();
    } else if (!next || next.kind !== 'tyre') {
      // tyre-only filters make no sense outside tyre categories
      filters.setFilterWidth(''); filters.setFilterHeight(''); filters.setFilterRadius(''); filters.setFilterSeason('');
    }
    const rootChanged = !next || !activeCat || getRootOf(categories, next).id !== getRootOf(categories, activeCat).id;
    if (rootChanged) { filters.setFilterBrand(''); filters.setAttrFilters({}); }
    const from = categoryOrder.indexOf(activeCategory), to = categoryOrder.indexOf(cat);
    setSlideDir(to > from ? 1 : -1);
    setPriorityProductId(null);
    setActiveCategory(cat);
  };

  // --- the list, its filters, the open product ---
  const { tyres, loading, loadingMore, hasMore, totalCount, loadMore } = useProductList({
    categories, categoriesLoading: categoriesLoading || openingSection, dbReady, promosReady, activeCategory, activeCat, agroCategory, showTyreFilters,
    activeSort: filters.activeSort, debouncedSearch, attrFilters: filters.attrFilters,
    filterBrand: filters.filterBrand, filterRadius: filters.filterRadius, filterWidth: filters.filterWidth, filterHeight: filters.filterHeight,
    filterSeason: filters.filterSeason, showOnlyInStock: filters.showOnlyInStock,
    favoriteIds: favorites.ids, priorityProductId, enableStockQty, prepare,
  });
  const { filterOptions, attrValues } = useFilterOptions(categories, categoriesLoading || openingSection, dbReady, activeCategory, activeCat);
  const { selectedProduct, openProduct, closeProduct } = useProductRoute({ tyres, prepare, categories, categoriesLoading, activeCategory, changeCategory, categorySlug, initialProduct });
  useShopSeo(selectedProduct, activeCat, activeCategory);

  // "Ви нещодавно переглядали": the product window saves what was opened, so the list is read again after every open / close
  const [recentlyViewed, setRecentlyViewed] = useState<TyreProduct[]>([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('recent_tyres');
      if (stored) setRecentlyViewed(JSON.parse(stored));
    } catch(e) {}
  }, [selectedProduct]);

  const listTopRef = useRef<HTMLDivElement>(null);
  const swipe = useCategorySwipe(categoryOrder, activeCategory, changeCategory, listTopRef);

  // --- windows ---
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  // Header cart icon opens the cart drawer
  useEffect(() => {
    const open = () => setIsCartOpen(true);
    window.addEventListener('forsage:open-cart', open);
    return () => window.removeEventListener('forsage:open-cart', open);
  }, []);

  // "How to find your size" explainer, opened from the tyre filters
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  useEffect(() => {
    const open = () => setSizeGuideOpen(true);
    window.addEventListener('forsage:size-guide', open);
    return () => window.removeEventListener('forsage:size-guide', open);
  }, []);

  const compareWindow = useCompareWindow(compare.ids, prepare);

  // --- actions ---
  const handleAgroProductClick = (id: number) => {
    setPriorityProductId(id);
    setActiveCategory(agroCategory ? agroCategory.id : 'all');
    filters.setFilterSeason('');
    setSearchQuery('');
    filters.setFilterBrand('');
    filters.setFilterRadius('');
    filters.setFilterWidth('');
    filters.setFilterHeight('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** icon of the product's category (or its parent) for cards without a photo */
  const productIcon = (p: TyreProduct) => {
    const c = categories.find(x => x.id === p.category_id);
    const parent = c?.parent_id ? categories.find(x => x.id === c.parent_id) : undefined;
    return getCategoryIcon(c?.icon || parent?.icon || (isTyreProduct(p, categories) ? 'circle-dot' : 'package'));
  };

  const addToCart = (tyre: TyreProduct) => {
      if (!tyre.in_stock) return;
      logAnalyticsEvent('add_to_cart', String(tyre.id), tyre.title);
      const ex = cartItems.find(item => item.id === tyre.id);
      const newCart = ex
        ? cartItems.map(i => i.id === tyre.id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...cartItems, { ...tyre, quantity: 1 }];
      onCartChange(newCart);
      showToast(tyre.title, 3000);
  };

  const handleProductClick = (tyre: TyreProduct) => {
    if (tyre.in_stock !== false) openProduct(tyre);
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

  // Scroll to the list once the new list has loaded: scrolling right away landed in the wrong place
  // (the home blocks above disappear a moment later and the page jumped to the footer).
  const scrollPending = useRef(false);
  const scrollToList = () => {
    scrollPending.current = true;
    // nothing to reload (same section): scroll anyway, a little later
    setTimeout(() => { if (scrollPending.current) { scrollPending.current = false; listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 1500);
  };
  useEffect(() => {
    if (loading || !scrollPending.current) return;
    scrollPending.current = false;
    setTimeout(() => listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }, [loading, tyres]);
  const cartTotal = useMemo(() => cartItems.reduce((a,b) => a + (safeParsePrice(b.price)*b.quantity), 0), [cartItems]);
  /** the home page as such: all goods, nothing searched or filtered */
  const isHome = activeCategory === 'all' && !debouncedSearch.trim() && activeFilterCount === 0 && !openingSection;
  const slideClass = slideDir === 1 ? 'slide-in-from-right-8' : slideDir === -1 ? 'slide-in-from-left-8' : 'slide-in-from-bottom-4';

  const filterPanel = (
    <FilterPanel
      state={filters.filterState}
      set={filters.setFilter}
      setAttr={filters.setAttr}
      options={filterOptions}
      attrValues={attrValues}
      showTyreFilters={showTyreFilters}
      preset={preset}
      onReset={resetFilters}
    />
  );

  return (
    <div className="min-h-screen bg-[#09090b] pt-3 md:pt-8 pb-32">
      <div className="max-w-7xl mx-auto px-3 md:px-4">

        {/* ── Intro: compact on phones, with mini map on large screens ── */}
        <ShopIntro
          hidden={isHome}
          activeCategory={activeCategory} activeCat={activeCat} categories={categories}
          shopPhone={shopPhone} shopPhone2={shopPhone2} shopPhoneLink={shopPhoneLink} shopPhoneLink2={shopPhoneLink2}
          onHome={() => { changeCategory('all'); resetFilters(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          onCatalog={() => { changeCategory('all'); resetFilters(); setTimeout(() => window.dispatchEvent(new Event('open-catalog')), 60); }}
          onPickCategory={changeCategory}
        />

        <CategoryNav categories={categories} active={activeCategory} onChange={changeCategory} favoritesCount={favorites.ids.length} />

        <QuickFilters
          showTyreFilters={showTyreFilters} preset={preset} attrValues={attrValues}
          attrFilters={filters.attrFilters} onAttrChange={(key, value) => filters.setAttrFilters(prev => ({ ...prev, [key]: value }))}
          filterWidth={filters.filterWidth} setFilterWidth={filters.setFilterWidth}
          filterHeight={filters.filterHeight} setFilterHeight={filters.setFilterHeight}
          filterRadius={filters.filterRadius} setFilterRadius={filters.setFilterRadius}
          filterOptions={filterOptions}
        />

        {isHome && (
          <HomeShowcase
            categories={categories}
            dbReady={dbReady}
            sizeOptions={filterOptions}
            onPickCategory={(id) => { changeCategory(id); scrollToList(); }}
            onSizeSearch={(w, h, r) => {
              const tyreRoot = categories.find(c => c.kind === 'tyre' && !c.parent_id);
              if (tyreRoot) changeCategory(tyreRoot.id);
              filters.setFilterWidth(w); filters.setFilterHeight(h); filters.setFilterRadius(r);
              scrollToList();
            }}
            onAttrSearch={(id, attrs) => { changeCategory(id); filters.setAttrFilters(attrs); scrollToList(); }}
            onSearchText={(q) => { changeCategory('all'); filters.setSearchQuery(q); scrollToList(); }}
            onOpenProduct={(p) => openProduct(p)}
            formatPrice={formatPrice}
            prepare={prepare}
          />
        )}

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

          <div ref={listTopRef} onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd} className="min-w-0">
            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSearch={() => setDebouncedSearch(searchQuery)}
              activeSort={filters.activeSort}
              setActiveSort={filters.setActiveSort}
              activeFilters={activeFilterCount}
              totalCount={totalCount}
              onOpenFilters={() => setFiltersOpen(true)}
              suggest={{
                categories,
                onProduct: async p => {
                  const { data } = await supabase.from('tyres').select('*').eq('id', p.id).maybeSingle();
                  if (data) openProduct(prepare(data as TyreProduct));
                },
                onCategory: c => { setSearchQuery(''); setDebouncedSearch(''); changeCategory(c.id); listTopRef.current?.scrollIntoView({ behavior: 'smooth' }); },
              }}
            />

            {loading ? (
              <GridSkeleton />
            ) : tyres.length === 0 ? (
              <EmptyResults
                key={`empty-${String(activeCategory)}`}
                slideClass={slideClass} searchQuery={searchQuery} activeFilterCount={activeFilterCount}
                inSection={activeCategory !== 'all'}
                onSearchEverywhere={() => { const q = searchQuery; changeCategory('all'); setTimeout(() => setSearchQuery(q), 50); }}
                onReset={resetFilters}
                shopPhone={shopPhone} shopPhoneLink={shopPhoneLink}
              />
            ) : (
              <div key={`grid-${String(activeCategory)}`} className={`grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5 mt-2 animate-in fade-in ${slideClass} duration-300`}>
                {tyres.map((tyre, idx) => (
                  <div key={tyre.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${Math.min((idx % PAGE_SIZE) * 40, 400)}ms` }}>
                    <ProductCard
                      tyre={tyre}
                      priority={idx < 4}
                      chips={getCardChips(getPresetForProduct(categories, tyre), tyre.attributes)}
                      onClick={() => handleProductClick(tyre)}
                      onAddToCart={(e) => { e.stopPropagation(); addToCart(tyre); }}
                      onQuickOrder={(p) => quickOrder.open(p)}
                      formatPrice={formatPrice}
                      isFavorite={favorites.has(tyre.id)}
                      onToggleFavorite={() => toggleFavorite(tyre)}
                      isCompared={compare.has(tyre.id)}
                      onToggleCompare={() => toggleCompare(tyre)}
                      showStock={enableStockQty}
                      placeholderIcon={productIcon(tyre)}
                    />
                  </div>
                ))}
              </div>
            )}

            {hasMore && !loading && tyres.length > 0 && (
              <ShowMore onMore={loadMore} loadingMore={loadingMore} shown={tyres.length} totalCount={totalCount} />
            )}

            {(activeCat?.description || activeCat?.faq?.length) && !debouncedSearch && (
              <CategoryAbout name={activeCat.name} description={activeCat.description || ''} faq={activeCat.faq} />
            )}

            <SwipeHint />
          </div>
        </div>
      </div>

      {compare.ids.length > 0 && (
        <CompareButton count={compare.ids.length} onClick={() => compareWindow.setOpen(true)} />
      )}

      <CompareModal
        open={compareWindow.open}
        products={compareWindow.products}
        categories={categories}
        loading={compareWindow.loading}
        onClose={() => compareWindow.setOpen(false)}
        onRemove={compare.remove}
        onClear={() => { compare.clear(); compareWindow.setOpen(false); }}
        onOpenProduct={(p) => { compareWindow.setOpen(false); openProduct(p); }}
        onAddToCart={(p) => addToCart(p)}
        formatPrice={formatPrice}
      />

      <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} totalCount={totalCount}>
        {filterPanel}
      </FilterSheet>

      {recentlyViewed.length > 0 && (
        <RecentlyViewed items={recentlyViewed} onOpen={(t) => openProduct(t)} formatPrice={formatPrice} />
      )}

      {cartItems.length > 0 && (
        <CartButton key={`cart-${cartItems.length}`} count={cartItems.reduce((a,b)=>a+b.quantity,0)} onClick={() => setIsCartOpen(true)} />
      )}

      <CartDrawer
        isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} cart={cartItems} cartTotal={cartTotal}
        {...checkoutForm}
        formatPrice={formatPrice}
        removeFromCart={(id) => onCartChange(cartItems.filter(i => i.id !== id))}
        updateQuantity={(id, d) => onCartChange(cartItems.map(i => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + d) } : i))}
      />

      <ProductDetailModal
        product={selectedProduct} onClose={closeProduct}
        preset={selectedProduct ? getPresetForProduct(categories, selectedProduct) : null}
        isFavorite={selectedProduct ? favorites.has(selectedProduct.id) : false}
        onToggleFavorite={() => selectedProduct && toggleFavorite(selectedProduct)}
        isCompared={selectedProduct ? compare.has(selectedProduct.id) : false}
        onToggleCompare={() => selectedProduct && toggleCompare(selectedProduct)}
        userId={userId}
        userName={orderName}
        onRequireLogin={onRequireLogin}
        addToCart={addToCart} formatPrice={formatPrice} getSeasonLabel={getSeasonLabel} renderSchema={renderProductSchema}
        openLightbox={lightbox.show}
        showStock={enableStockQty}
        onQuickOrder={(p) => quickOrder.open(p)}
        onSimilarClick={(t) => openProduct(t, { replace: true })}
        iconFor={productIcon}
      />

      {lightbox.open && (
        <Lightbox images={lightbox.images} index={lightbox.index} setIndex={lightbox.setIndex} onClose={lightbox.close} />
      )}

      {quickOrder.product && (
        <QuickOrderModal
          product={quickOrder.product} phone={quickOrder.phone} setPhone={quickOrder.setPhone}
          error={quickOrder.error} sending={quickOrder.sending} onSubmit={quickOrder.submit} onClose={quickOrder.close}
        />
      )}

      {/* Floating contact button: Viber / Telegram / call */}
      <ContactHub shopPhone={shopPhone} shopPhoneLink={shopPhoneLink} />

      {toast.visible && <CartToast message={toast.message} />}
      <SizeGuideModal open={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} />
    </div>
  );
};

export default TyreShop;
