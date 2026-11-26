
import { safeParsePrice } from './shopUtils';
import StockAlertForm from './StockAlertForm';
import React, { useState, useEffect, useRef } from 'react';
import NoPhoto from './NoPhoto';
import { Heart, Scale, X, ShoppingCart, ZoomIn, ChevronLeft, ChevronRight, Gauge, ShieldCheck, Truck, CreditCard, Info, Snowflake, Sun, CloudSun, Ruler, Flame, Loader2, Phone, ArrowRight } from 'lucide-react';
import { TyreProduct } from '../../types';
import { supabase } from '../../supabaseClient';
import { FilterPreset, formatAttr } from '../../productAttributes';
import ProductReviews from './ProductReviews';
import { parseTyreIndex, describeTyreIndex } from '../../tyreIndex';
import { addRecent, getRecent } from '../../recentlyViewed';

/** Why an analog is shown (product_related() in the DB). */
const REASON_BADGE: Record<string, { label: string; cls: string }> = {
  cross: { label: 'Точний аналог', cls: 'bg-green-600 text-white' },
  volume: { label: 'Інший об\'єм', cls: 'bg-[#FFC300] text-black' },
  approvals: { label: 'Ті ж допуски', cls: 'bg-blue-600 text-white' },
};

interface ProductDetailModalProps {
  product: TyreProduct | null;
  onClose: () => void;
  addToCart: (t: TyreProduct) => void;
  formatPrice: (p: string | undefined) => string;
  getSeasonLabel: (s: string | undefined) => string;
  renderSchema: (p: TyreProduct) => React.ReactNode;
  openLightbox: (images: string[], index: number) => void;
  onQuickOrder?: (p: TyreProduct) => void;
  onSimilarClick?: (t: TyreProduct) => void;
  /** characteristics definition for disks / batteries */
  preset?: FilterPreset | null;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isCompared?: boolean;
  onToggleCompare?: () => void;
  userId?: string;
  userName?: string;
  onRequireLogin?: () => void;
  /** stock tracking is on → show "Залишилося N шт" */
  showStock?: boolean;
  /** icon of a product's category, shown instead of a missing photo */
  iconFor?: (p: TyreProduct) => React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose, addToCart, formatPrice, getSeasonLabel, renderSchema, openLightbox, onQuickOrder, onSimilarClick, preset, isFavorite, onToggleFavorite, isCompared, onToggleCompare, userId, userName, onRequireLogin, showStock = false, iconFor }) => {
  const [companions, setCompanions] = useState<TyreProduct[]>([]);
  const [approvals, setApprovals] = useState<string[]>([]);
  const [allAnalogs, setAllAnalogs] = useState(false);
  const [similar, setSimilar] = useState<TyreProduct[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);
  const lastScroll = useRef(0); // a tap right after scrolling must not open another product
  useEffect(() => { setPhotoIdx(0); setAllAnalogs(false); }, [product?.id]);

  const isTyre = !!(product && (product.width || product.radius || product.season));

  useEffect(() => {
    if (!product) return;
    addRecent(product);
    let alive = true;
    setLoadingSimilar(true); setSimilar([]); setCompanions([]); setApprovals([]);
    (async () => {
      try {
        if (isTyre) {
          // tyres: same size
          let query = supabase.from('tyres').select('*').neq('id', product.id).neq('in_stock', false);
          if (product.category_id) query = query.eq('category_id', product.category_id);
          if (product.radius) query = query.eq('radius', product.radius);
          if (product.width) query = query.ilike('title', `%${product.width}%`);
          if (product.height) query = query.ilike('title', `%/${product.height}%`);
          const { data } = await query.limit(4);
          if (alive) setSimilar((data as TyreProduct[]) || []);
        } else {
          // other goods: analogs (same viscosity / same car) and rule-based "З цим купують" — see product_related() in the DB
          const { data } = await supabase.rpc('product_related', { p_id: product.id });
          if (alive && data) {
            let analogs = (data.analogs as TyreProduct[]) || [], comps = (data.companions as TyreProduct[]) || [];
            // the list has light fields only: goods without a photo need their category (icon),
            // partner offers need their id and delivery days (they show a real price) — one request for both
            const need = [...analogs, ...comps].filter(t => (!t.image_url && !t.image_thumb_url) || t.on_order).map(t => t.id);
            if (need.length) {
              const { data: extra } = await supabase.from('tyres').select('id, category_id, supplier_offer_id, lead_days').in('id', need);
              const byId = new Map(((extra as Pick<TyreProduct, 'id' | 'category_id' | 'supplier_offer_id' | 'lead_days'>[]) || []).map(c => [c.id, c]));
              const add = (t: TyreProduct) => (byId.has(t.id) ? { ...t, ...byId.get(t.id) } : t);
              analogs = analogs.map(add); comps = comps.map(add);
            }
            if (!alive) return;
            setSimilar(analogs); setCompanions(comps); setApprovals((data.approvals as string[]) || []);
          }
        }
      } catch { /* blocks stay empty */ } finally { if (alive) setLoadingSimilar(false); }
    })();
    return () => { alive = false; };
  }, [product?.id]);

  /** Lists hold only light fields — load the full product before opening it / adding to the cart. */
  const withFull = (t: TyreProduct, fn: (full: TyreProduct) => void) => async () => {
    const { data } = await supabase.from('tyres').select('*').eq('id', t.id).maybeSingle();
    fn((data as TyreProduct) || t);
  };
  const openItem = (t: TyreProduct) => withFull(t, full => onSimilarClick && onSimilarClick(full));

  if (!product) return null;

  const isOutOfStock = product.in_stock === false;
  const partner = !!product.on_order && !!product.supplier_offer_id;
  const onOrder = !!product.on_order && !partner;
  const stockQty = product.program_product_id && typeof product.stock_quantity === 'number' ? product.stock_quantity : null;
  const priceNum = parseFloat(product.price || '0');
  const oldPriceNum = parseFloat(product.old_price || '0');
  const hasDiscount = oldPriceNum > priceNum;
  const discountPercent = hasDiscount ? Math.round(((oldPriceNum - priceNum) / oldPriceNum) * 100) : 0;
  
  const isLowStock = showStock && typeof product.stock_quantity === 'number' && product.stock_quantity > 0 && product.stock_quantity <= 4;
  const photos = Array.from(new Set([product.image_url, ...(product.gallery || [])].filter(Boolean))) as string[];
  const current = photos[Math.min(photoIdx, Math.max(photos.length - 1, 0))];
  const go = (dir: number) => setPhotoIdx(i => (i + dir + photos.length) % photos.length);
  const tyreIndex = product.width ? parseTyreIndex(product.title) : null;

  const availability = isOutOfStock ? 'Немає в наявності' : onOrder ? 'Під замовлення' : partner ? `Під замовлення · доставка ${product.lead_days ? `${product.lead_days} дн.` : 'кілька днів'}` : stockQty !== null && stockQty > 0 ? `В наявності: ${stockQty > 10 ? '>10' : stockQty} шт` : 'В наявності';
  const availabilityCls = isOutOfStock ? 'text-red-500' : onOrder || partner ? 'text-amber-400' : 'text-emerald-500';
  const hasSpecs = !!(preset && product.attributes && preset.fields.some(f => formatAttr(f, product.attributes?.[f.key])));
  const recent = getRecent().filter(t => t.id !== product.id).slice(0, 8);

  /** One card style for "З цим купують" and "Аналоги": white photo, name, price, cart button. */
  const relatedCard = (t: TyreProduct) => {
    const reason = (t as TyreProduct & { reason?: string; cross?: boolean }).reason || ((t as { cross?: boolean }).cross ? 'cross' : '');
    const badge = REASON_BADGE[reason];
    const img = t.image_thumb_url || t.image_url;
    const Icon = iconFor ? iconFor(t) : undefined;
    return (
      <div key={t.id} className="snap-start shrink-0 w-[118px] md:w-[150px] bg-zinc-950 border border-zinc-800 hover:border-zinc-600 rounded-2xl overflow-hidden flex flex-col transition-colors">
        <button onClick={openItem(t)} className="text-left flex-1 outline-none focus:outline-none [-webkit-tap-highlight-color:transparent]">
          <div className={`relative h-20 md:h-28 flex items-center justify-center ${img ? 'bg-white' : ''}`}>
            {img ? <img src={img} alt={t.title} loading="lazy" className="w-full h-full object-contain p-2" /> : <NoPhoto icon={Icon} size={26} />}
            {badge && <span className={`absolute top-1.5 left-1.5 text-[9px] ${badge.cls} font-black uppercase px-1.5 py-0.5 rounded`}>{badge.label}</span>}
          </div>
          <p className="px-2.5 pt-2 text-[11px] font-bold text-white line-clamp-2 min-h-[2.6em] leading-snug">{t.title} {t.radius}</p>
        </button>
        <div className="px-2.5 pb-2.5 pt-1.5 flex items-center justify-between gap-1">
          <span className="text-[13px] font-black text-[#FFC300] whitespace-nowrap">{t.on_order && !t.supplier_offer_id ? <span className="text-[11px] text-amber-400">Під замовлення</span> : <>{formatPrice(t.price)} <span className="text-[10px] text-zinc-500 font-normal">грн</span></>}</span>
          {(!t.on_order || t.supplier_offer_id) && <button onClick={withFull(t, addToCart)} aria-label="У кошик" className="w-7 h-7 shrink-0 rounded-lg bg-[#FFC300] hover:bg-white text-black flex items-center justify-center"><ShoppingCart size={14} /></button>}
        </div>
      </div>
    );
  };
  /** Analogs: a compact list (small photo, full name, stock or delivery days, price, cart) — 4 rows, the rest on demand. */
  const analogRow = (t: TyreProduct) => {
    const reason = (t as TyreProduct & { reason?: string }).reason || '';
    const badge = REASON_BADGE[reason];
    const img = t.image_thumb_url || t.image_url;
    const Icon = iconFor ? iconFor(t) : undefined;
    const askPrice = t.on_order && !t.supplier_offer_id;
    return (
      <li key={t.id} className="flex items-center gap-2.5 py-2">
        <button onClick={openItem(t)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left outline-none [-webkit-tap-highlight-color:transparent]">
          <span className={`w-12 h-12 shrink-0 rounded-lg overflow-hidden flex items-center justify-center ${img ? 'bg-white' : 'bg-zinc-800'}`}>
            {img ? <img src={img} alt="" loading="lazy" className="w-full h-full object-contain p-0.5" /> : <NoPhoto icon={Icon} size={18} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-xs font-bold text-white leading-snug line-clamp-2 break-words">{t.title}</span>
            <span className="flex flex-wrap items-center gap-x-2 text-[10px] font-bold mt-0.5">
              {badge && <span className={`${badge.cls} px-1 rounded uppercase`}>{badge.label}</span>}
              <span className={t.on_order ? 'text-amber-400' : 'text-emerald-400'}>{t.on_order ? `під замовлення${t.lead_days ? ` · ${t.lead_days} дн.` : ''}` : 'в наявності'}</span>
            </span>
          </span>
        </button>
        <span className="shrink-0 text-right">
          {askPrice ? <span className="text-[11px] text-amber-400 font-bold">ціна за запитом</span> : <span className="text-sm font-black text-[#FFC300] whitespace-nowrap">{formatPrice(t.price)} <span className="text-[10px] text-zinc-500 font-normal">грн</span></span>}
        </span>
        {!askPrice && <button onClick={withFull(t, addToCart)} aria-label="У кошик" className="w-9 h-9 shrink-0 rounded-lg bg-[#FFC300] hover:bg-white text-black flex items-center justify-center"><ShoppingCart size={15} /></button>}
      </li>
    );
  };
  const analogList = (title: string, items: TyreProduct[]) => (
    <section>
      <h3 className="text-white text-sm md:text-base font-black uppercase tracking-wide mb-1 flex items-center gap-2">
        <span className="w-1.5 h-4 bg-[#FFC300] rounded-full" />{title} <span className="text-zinc-500 text-xs font-bold normal-case">{items.length}</span>
      </h3>
      <ul className="divide-y divide-zinc-800">{(allAnalogs ? items : items.slice(0, 4)).map(analogRow)}</ul>
      {items.length > 4 && (
        <button onClick={() => setAllAnalogs(v => !v)} className="mt-1 w-full h-9 rounded-xl border border-zinc-800 text-xs font-bold text-zinc-300 hover:border-zinc-600">
          {allAnalogs ? 'Згорнути' : `Показати ще ${items.length - 4}`}
        </button>
      )}
    </section>
  );
  const row = (title: string, items: TyreProduct[]) => (
    <section>
      <h3 className="text-white text-sm md:text-base font-black uppercase tracking-wide mb-3 flex items-center gap-2">
        <span className="w-1.5 h-4 bg-[#FFC300] rounded-full" />{title}
      </h3>
      <div className="flex gap-2 md:gap-3 overflow-x-auto overscroll-x-contain pb-2 snap-x scrollbar-hide -mx-4 px-4 scroll-pl-4 md:-mx-7 md:px-7 md:scroll-pl-7">{items.map(relatedCard)}</div>
    </section>
  );

  const buyButtons = (
    onOrder ? (
      onQuickOrder && (
        <button onClick={() => { onQuickOrder(product); onClose(); }}
          className="flex-1 h-12 md:h-14 rounded-2xl font-black text-sm md:text-base flex items-center justify-center gap-2 uppercase tracking-wide bg-[#FFC300] text-black hover:bg-white transition-all active:scale-95">
          <Phone size={18} /> Дізнатися ціну
        </button>
      )
    ) : isOutOfStock ? (
      <StockAlertForm productId={product.id} defaultName={userName} />
    ) : (<>
      <button disabled={isOutOfStock} onClick={() => { addToCart(product); onClose(); }}
        className={`flex-1 h-12 md:h-14 rounded-2xl font-black text-sm md:text-base flex items-center justify-center gap-2 uppercase tracking-wide transition-all active:scale-95 ${isOutOfStock ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-[#FFC300] text-black hover:bg-white'}`}>
        <ShoppingCart size={20} strokeWidth={2.5} /> {isOutOfStock ? 'Немає в наявності' : <><span className="sm:hidden">У кошик</span><span className="hidden sm:inline">Додати у кошик</span></>}
      </button>
      {!isOutOfStock && onQuickOrder && (
        <button onClick={() => { onQuickOrder(product); onClose(); }} aria-label="Купити в 1 клік"
          className="shrink-0 h-12 md:h-14 px-4 rounded-2xl font-black text-xs text-[#FFC300] border border-[#FFC300]/40 hover:bg-[#FFC300]/10 hover:border-[#FFC300] transition-all uppercase tracking-wide flex items-center justify-center gap-2">
          <Phone size={16} /> <span className="hidden md:inline">Купити в 1 клік</span>
        </button>
      )}
    </>)
  );
  const priceBlock = onOrder
    ? <p className="text-sm text-zinc-300"><b className="text-white">Ціну і термін постачання</b> уточнить менеджер.</p>
    : (
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl md:text-4xl font-black text-[#FFC300] whitespace-nowrap">{formatPrice(product.price)} <span className="text-xs md:text-sm text-white font-normal uppercase">грн</span></span>
        {hasDiscount && <span className="text-sm text-zinc-500 line-through">{formatPrice(product.old_price)} грн</span>}
        {/* tyres are bought in sets: show the price of four at once */}
        {isTyre && safeParsePrice(product.price) > 0 && (
          <span className="basis-full text-xs md:text-sm text-zinc-400">Комплект 4 шт: <b className="text-white">{formatPrice(String(safeParsePrice(product.price) * 4))} грн</b></span>
        )}
      </div>
    );

  return (
    <div className="fixed inset-0 z-[170] bg-black/90 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-300" onClick={onClose}>
      {renderSchema(product)}
      <div className="bg-zinc-900 md:border border-zinc-800 md:rounded-3xl w-full max-w-6xl shadow-2xl relative overflow-y-auto overflow-x-hidden overscroll-contain h-[100dvh] md:h-auto md:max-h-[92vh] animate-in slide-in-from-bottom md:slide-in-from-bottom-8 md:zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
        onScroll={() => { lastScroll.current = Date.now(); }}
        onClickCapture={e => { if (Date.now() - lastScroll.current < 350) { e.preventDefault(); e.stopPropagation(); } }}>
        {/* phone: a real bar with "close" that always stays on top */}
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-2 px-3 h-12 bg-zinc-900/95 backdrop-blur border-b border-zinc-800">
          <button onClick={onClose} className="h-9 pl-2 pr-3 flex items-center gap-1 rounded-xl bg-zinc-800 text-white text-sm font-bold" aria-label="Закрити"><ChevronLeft size={18} /> Назад</button>
          <span className="flex-1 truncate text-xs text-zinc-400 font-bold">{product.title}</span>
          <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-xl bg-zinc-800 text-white" aria-label="Закрити картку"><X size={20} /></button>
        </div>
        <div className="hidden md:flex sticky top-0 z-30 h-0 justify-end">
          <button onClick={onClose} className="m-3 h-10 w-10 flex items-center justify-center text-zinc-300 hover:text-white bg-black/70 hover:bg-black rounded-full transition-all shrink-0" aria-label="Закрити"><X size={22} /></button>
        </div>

        {/* Top: photo + the main things (name, price, buy) */}
        <div className="md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div className={`${current ? 'bg-white' : 'bg-zinc-950'} flex flex-col md:self-start overflow-hidden`}>
            <div
              className={`relative flex items-center justify-center w-full group overflow-hidden ${current ? 'aspect-[4/3] md:aspect-square md:max-h-[62vh] cursor-zoom-in' : 'h-40 md:h-72 bg-gradient-to-br from-zinc-800 to-zinc-950'}`}
              onClick={() => photos.length && openLightbox(photos, photoIdx)}
              data-no-swipe="" onTouchStart={e => setTouchX(e.touches[0].clientX)}
              onTouchEnd={e => {
                if (touchX === null || photos.length < 2) return;
                const dx = e.changedTouches[0].clientX - touchX;
                setTouchX(null);
                if (Math.abs(dx) > 50) { e.stopPropagation(); go(dx < 0 ? 1 : -1); }
              }}
            >
              {current ? (
                <img key={current} src={current} className="w-full h-full object-contain p-4 md:p-6 transition-transform duration-500 group-hover:scale-105 animate-in fade-in duration-300" alt={product.title} referrerPolicy="no-referrer" />
              ) : (
                <NoPhoto icon={iconFor ? iconFor(product) : undefined} size={56} label="Фото скоро буде" />
              )}
              {hasDiscount && <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1.5 rounded-xl font-black text-sm shadow-2xl">Знижка −{discountPercent}%</div>}
              {photos.length > 1 && (
                <>
                  <button onClick={e => { e.stopPropagation(); go(-1); }} className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white items-center justify-center hover:bg-black" aria-label="Попереднє фото"><ChevronLeft size={22} /></button>
                  <button onClick={e => { e.stopPropagation(); go(1); }} className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white items-center justify-center hover:bg-black" aria-label="Наступне фото"><ChevronRight size={22} /></button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 md:hidden">
                    {photos.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === photoIdx ? 'w-5 bg-[#FFC300]' : 'w-1.5 bg-black/30'}`} />)}
                  </div>
                </>
              )}
              <div className="absolute bottom-3 right-3 bg-black/60 p-2 rounded-xl text-white/80 opacity-0 group-hover:opacity-100 transition-opacity"><ZoomIn size={18}/></div>
            </div>
            {photos.length > 1 && (
              <div className="hidden md:flex gap-2 p-3 overflow-x-auto scrollbar-hide border-t border-zinc-200 bg-white">
                {photos.map((src, i) => (
                  <button key={src} onClick={() => setPhotoIdx(i)} className={`w-14 h-14 shrink-0 rounded-lg bg-white overflow-hidden border-2 transition-colors ${i === photoIdx ? 'border-[#FFC300]' : 'border-zinc-200 hover:border-zinc-400'}`} aria-label={`Фото ${i + 1}`}>
                    <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 md:p-7 md:pr-14 space-y-4 min-w-0">
            <div className="flex flex-wrap items-center gap-2 pr-12 md:pr-0">
              {product.manufacturer && <span className="bg-[#FFC300] text-black px-2.5 py-1 rounded-full text-[11px] font-black uppercase">{product.manufacturer}</span>}
              {product.is_hot && <span className="bg-orange-600 text-white px-2.5 py-1 rounded-full text-[11px] font-black uppercase">Хіт</span>}
              {isLowStock && !isOutOfStock && <span className="bg-red-600/20 text-red-500 border border-red-500/30 px-2.5 py-1 rounded-full text-[11px] font-black uppercase">Залишилося: {product.stock_quantity} шт</span>}
            </div>

            <h1 className={`${product.title.length > 70 ? "text-base" : "text-xl"} md:text-2xl font-black text-white leading-tight`}>{product.title}</h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className={`font-bold flex items-center gap-1.5 ${availabilityCls}`}><span className="w-2 h-2 rounded-full bg-current" />{availability}</span>
              {product.catalog_number && <span className="text-zinc-500">Артикул: <span className="text-zinc-200 font-mono">{product.catalog_number}</span></span>}
            </div>

            {(product.season || tyreIndex || product.radius) && (
              <div className="flex flex-wrap gap-2">
                {product.season && <div className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-800 px-3 py-1.5 rounded-xl">
                  {product.season === 'winter' ? <Snowflake size={16} className="text-blue-400"/> : product.season === 'summer' ? <Sun size={16} className="text-yellow-400"/> : <CloudSun size={16} className="text-zinc-400"/>}
                  <span className="text-zinc-300 text-xs font-bold uppercase">{getSeasonLabel(product.season)}</span>
                </div>}
                {tyreIndex && (
                  <div className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-800 px-3 py-1.5 rounded-xl" title="Індекс навантаження та швидкості">
                    <Gauge size={16} className="text-[#FFC300]"/><span className="text-zinc-300 text-xs font-bold">{tyreIndex.code}: {describeTyreIndex(tyreIndex)}</span>
                  </div>
                )}
                {product.radius && <div className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-800 px-3 py-1.5 rounded-xl"><Ruler size={16} className="text-[#FFC300]"/><span className="text-zinc-300 text-xs font-bold uppercase">{product.radius}</span></div>}
              </div>
            )}

            {/* Price and buy (desktop; on phones the bar at the bottom of the window) */}
            <div className="hidden md:block bg-zinc-950/60 border border-zinc-800 rounded-2xl p-4 space-y-3">
              {priceBlock}
              <div className="flex gap-2">{buyButtons}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onToggleFavorite && (
                <button onClick={onToggleFavorite} aria-pressed={!!isFavorite}
                  className={`flex items-center gap-1.5 px-3 h-9 rounded-xl border text-xs font-bold transition-colors ${isFavorite ? 'bg-red-600 border-red-600 text-white' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}>
                  <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} /> {isFavorite ? 'В обраному' : 'В обране'}
                </button>
              )}
              {onToggleCompare && (
                <button onClick={onToggleCompare} aria-pressed={!!isCompared}
                  className={`flex items-center gap-1.5 px-3 h-9 rounded-xl border text-xs font-bold transition-colors ${isCompared ? 'bg-[#FFC300] border-[#FFC300] text-black' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}>
                  <Scale size={14} /> {isCompared ? 'У порівнянні' : 'Порівняти'}
                </button>
              )}
            </div>

            <ul className="grid grid-cols-3 gap-2 text-[11px] text-zinc-400 font-bold">
              <li className="flex items-center gap-1.5 bg-zinc-950/50 border border-zinc-800/60 rounded-xl px-2 py-2"><ShieldCheck size={16} className="text-emerald-500 shrink-0" /> Гарантія якості</li>
              <li className="flex items-center gap-1.5 bg-zinc-950/50 border border-zinc-800/60 rounded-xl px-2 py-2"><Truck size={16} className="text-blue-500 shrink-0" /> Нова Пошта</li>
              <li className="flex items-center gap-1.5 bg-zinc-950/50 border border-zinc-800/60 rounded-xl px-2 py-2"><CreditCard size={16} className="text-purple-500 shrink-0" /> Оплата при отриманні</li>
            </ul>

            {hasSpecs && preset && (
              <div className="rounded-2xl border border-zinc-800 overflow-hidden">
                <h3 className="text-zinc-500 text-[11px] font-black uppercase tracking-widest px-4 py-2 bg-zinc-800/40">Характеристики</h3>
                <dl className="divide-y divide-zinc-800">
                  {preset.fields.map(f => {
                    const v = formatAttr(f, product.attributes?.[f.key]);
                    if (!v) return null;
                    return (
                      <div key={f.key} className="flex justify-between gap-4 px-4 py-2 text-sm">
                        <dt className="text-zinc-500">{f.label}</dt>
                        <dd className="text-white font-bold text-right">{v}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            )}

            {approvals.length > 0 && (
              <div>
                <h3 className="text-zinc-500 text-[11px] font-black uppercase tracking-widest mb-2">Допуски та специфікації</h3>
                <div className="flex flex-wrap gap-1.5">
                  {approvals.map(a => <span key={a} className="text-xs font-bold text-white bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1">{a}</span>)}
                </div>
              </div>
            )}

            {product.description ? (
              <div>
                <h3 className="text-zinc-500 text-[11px] font-black uppercase tracking-widest mb-2">Опис товару</h3>
                <div className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line">{product.description}</div>
              </div>
            ) : (
              <p className="text-zinc-500 text-xs">Потрібна консультація щодо цього товару? Зателефонуйте — підкажемо й підберемо.</p>
            )}
          </div>
        </div>

        {/* Below, across the whole window: goods to buy together, analogs, reviews */}
        <div className="px-4 md:px-7 pt-6 pb-6 space-y-7 border-t border-zinc-800">
          {companions.length > 0 && row('З цим купують', companions)}
          {loadingSimilar
            ? <div className="flex justify-center py-4"><Loader2 className="animate-spin text-zinc-500" /></div>
            : similar.length > 0 && (isTyre ? row('Схожі пропозиції', similar) : analogList('Аналоги й схожі товари', similar))}

          <ProductReviews productId={product.id} userId={userId} userName={userName} onRequireLogin={onRequireLogin} />

          {recent.length > 0 && (
            <section>
              <h3 className="text-zinc-500 text-[11px] font-black uppercase tracking-widest mb-3">Ви нещодавно переглядали</h3>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 scroll-pl-4 md:-mx-7 md:px-7 md:scroll-pl-7">
                {recent.map(t => (
                  <button key={t.id} onClick={async () => {
                    const { data } = await supabase.from('tyres').select('*').eq('id', t.id).maybeSingle();
                    if (data && onSimilarClick) onSimilarClick(data as TyreProduct);
                  }} className="shrink-0 w-[200px] bg-zinc-950/60 border border-zinc-800 p-2 rounded-xl flex items-center gap-2 text-left hover:border-[#FFC300] transition-colors">
                    <span className={`w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden ${(t.image_thumb_url || t.image_url) ? 'bg-white' : 'bg-zinc-800'}`}>
                      {(t.image_thumb_url || t.image_url) ? <img src={t.image_thumb_url || t.image_url} className="w-full h-full object-contain" alt="" loading="lazy" /> : <NoPhoto icon={iconFor ? iconFor(t as TyreProduct) : undefined} size={20} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] text-white font-bold line-clamp-2 leading-tight">{t.title}</span>
                      <span className="block text-[11px] text-[#FFC300] font-black mt-0.5">{t.on_order && !t.supplier_offer_id ? 'Під замовлення' : formatPrice(t.price)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Phones: price and buy button always at hand */}
        <div className="md:hidden sticky bottom-0 z-40 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3">
          <div className="shrink-0 max-w-[45%]">{priceBlock}</div>
          <div className="flex flex-1 gap-2">{buyButtons}</div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;
