
import React, { useState, useEffect } from 'react';
import { Heart, Scale, X, ShoppingCart, ZoomIn, ChevronLeft, ChevronRight, Gauge, ShieldCheck, Truck, CreditCard, Info, Snowflake, Sun, CloudSun, Ruler, Flame, Loader2, Phone, ArrowRight } from 'lucide-react';
import { TyreProduct } from '../../types';
import { supabase } from '../../supabaseClient';
import { FilterPreset, formatAttr } from '../../productAttributes';
import ProductReviews from './ProductReviews';
import { parseTyreIndex, describeTyreIndex } from '../../tyreIndex';

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
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose, addToCart, formatPrice, getSeasonLabel, renderSchema, openLightbox, onQuickOrder, onSimilarClick, preset, isFavorite, onToggleFavorite, isCompared, onToggleCompare, userId, userName, onRequireLogin, showStock = false }) => {
  const [similar, setSimilar] = useState<TyreProduct[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);
  useEffect(() => { setPhotoIdx(0); }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    const fetchSimilar = async () => {
      setLoadingSimilar(true);
      try {
         let query = supabase.from('tyres').select('*').neq('id', product.id).neq('in_stock', false);
         if (product.category_id) query = query.eq('category_id', product.category_id);
         if (product.radius) query = query.eq('radius', product.radius);
         if (product.width) query = query.ilike('title', `%${product.width}%`);
         if (product.height) query = query.ilike('title', `%/${product.height}%`);
         
         const { data } = await query.limit(4);
         if (data) {
           // Basic mapping to ensure it conforms to TyreProduct
           setSimilar(data.map(d => ({...d, in_stock: true})));
         }
      } catch(e) {} finally { setLoadingSimilar(false); }
    };
    fetchSimilar();
    
    // Зберігаємо в "Нещодавно переглянуті"
    try {
      const recentRaw = localStorage.getItem('recent_tyres');
      let recent: TyreProduct[] = recentRaw ? JSON.parse(recentRaw) : [];
      recent = recent.filter(t => t.id !== product.id);
      recent.unshift(product);
      if (recent.length > 5) recent = recent.slice(0, 5);
      localStorage.setItem('recent_tyres', JSON.stringify(recent));
    } catch(e) {}

  }, [product]);

  if (!product) return null;

  const isOutOfStock = product.in_stock === false;
  const priceNum = parseFloat(product.price || '0');
  const oldPriceNum = parseFloat(product.old_price || '0');
  const hasDiscount = oldPriceNum > priceNum;
  const discountPercent = hasDiscount ? Math.round(((oldPriceNum - priceNum) / oldPriceNum) * 100) : 0;
  
  const isLowStock = showStock && typeof product.stock_quantity === 'number' && product.stock_quantity > 0 && product.stock_quantity <= 4;
  const photos = Array.from(new Set([product.image_url, ...(product.gallery || [])].filter(Boolean))) as string[];
  const current = photos[Math.min(photoIdx, Math.max(photos.length - 1, 0))];
  const go = (dir: number) => setPhotoIdx(i => (i + dir + photos.length) % photos.length);
  const tyreIndex = product.width ? parseTyreIndex(product.title) : null;

  return (
    <div className="fixed inset-0 z-[170] bg-black/90 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-300" onClick={onClose}>
      {renderSchema(product)}
      <div className="bg-zinc-900 border border-zinc-800 rounded-t-3xl md:rounded-3xl w-full max-w-5xl shadow-2xl relative flex flex-col md:flex-row overflow-y-auto md:overflow-hidden overscroll-contain max-h-[94vh] md:max-h-[85vh] animate-in slide-in-from-bottom md:slide-in-from-bottom-8 md:zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
          <button onClick={onClose} className="sticky md:absolute top-3 md:top-4 ml-auto mr-3 md:mr-0 md:right-4 -mb-12 md:mb-0 text-zinc-300 hover:text-white z-20 bg-black/60 hover:bg-black p-2 rounded-full transition-all shrink-0" aria-label="Закрити"><X size={22} /></button>
          
          {/* Image Section: all photos, swipe / arrows / thumbnails */}
          <div className="w-full md:w-1/2 bg-zinc-950 flex flex-col relative shrink-0 md:min-h-full">
            <div
              className="relative flex items-center justify-center aspect-[4/3] md:aspect-auto md:flex-1 cursor-zoom-in group overflow-hidden"
              onClick={() => photos.length && openLightbox(photos, photoIdx)}
              onTouchStart={e => setTouchX(e.touches[0].clientX)}
              onTouchEnd={e => {
                if (touchX === null || photos.length < 2) return;
                const dx = e.changedTouches[0].clientX - touchX;
                setTouchX(null);
                if (Math.abs(dx) > 50) { e.stopPropagation(); go(dx < 0 ? 1 : -1); }
              }}
            >
              {current ? (
                <img key={current} src={current} className="w-full h-full object-contain p-4 md:p-8 transition-transform duration-500 group-hover:scale-105 animate-in fade-in duration-300" alt={product.title} referrerPolicy="no-referrer" />
              ) : (
                <div className="flex flex-col items-center justify-center text-zinc-800">
                  <Info size={64} strokeWidth={1} className="mb-4 opacity-20"/>
                  <span className="font-bold uppercase tracking-widest text-xs">Фото відсутнє</span>
                </div>
              )}

              {hasDiscount && (
                <div className="absolute top-4 left-4 md:top-6 md:left-6 bg-red-600 text-white px-3 py-1.5 rounded-xl font-black text-sm shadow-2xl">
                  Знижка −{discountPercent}%
                </div>
              )}

              {photos.length > 1 && (
                <>
                  <button onClick={e => { e.stopPropagation(); go(-1); }} className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white items-center justify-center hover:bg-black" aria-label="Попереднє фото"><ChevronLeft size={22} /></button>
                  <button onClick={e => { e.stopPropagation(); go(1); }} className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white items-center justify-center hover:bg-black" aria-label="Наступне фото"><ChevronRight size={22} /></button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 md:hidden">
                    {photos.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === photoIdx ? 'w-5 bg-[#FFC300]' : 'w-1.5 bg-white/40'}`} />)}
                  </div>
                </>
              )}

              <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md p-2.5 rounded-xl text-white/70 opacity-0 group-hover:opacity-100 transition-opacity">
                <ZoomIn size={20}/>
              </div>
            </div>

            {photos.length > 1 && (
              <div className="hidden md:flex gap-2 p-3 overflow-x-auto scrollbar-hide border-t border-zinc-800">
                {photos.map((src, i) => (
                  <button key={src} onClick={() => setPhotoIdx(i)} className={`w-16 h-16 shrink-0 rounded-lg bg-zinc-900 overflow-hidden border-2 transition-colors ${i === photoIdx ? 'border-[#FFC300]' : 'border-transparent hover:border-zinc-600'}`} aria-label={`Фото ${i + 1}`}>
                    <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="w-full md:w-1/2 p-5 md:p-10 md:overflow-y-auto bg-zinc-900 flex flex-col pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-[#FFC300] text-black px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-tighter">
                    {product.manufacturer || 'Товар'}
                  </span>
                  {product.is_hot && <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-tighter">Хіт</span>}
                  {isLowStock && !isOutOfStock && (
                    <span className="bg-red-600/20 text-red-500 border border-red-500/30 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-tighter animate-pulse">
                      Залишилося: {product.stock_quantity} шт
                    </span>
                  )}
                </div>
                
                <h1 className="text-2xl md:text-3xl font-black text-white leading-tight mb-4">{product.title}</h1>

                <div className="flex gap-2 mb-4">
                  {onToggleFavorite && (
                    <button onClick={onToggleFavorite} aria-pressed={!!isFavorite}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${isFavorite ? 'bg-red-600 border-red-600 text-white' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}>
                      <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} /> {isFavorite ? 'В обраному' : 'В обране'}
                    </button>
                  )}
                  {onToggleCompare && (
                    <button onClick={onToggleCompare} aria-pressed={!!isCompared}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${isCompared ? 'bg-[#FFC300] border-[#FFC300] text-black' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}>
                      <Scale size={14} /> {isCompared ? 'У порівнянні' : 'Порівняти'}
                    </button>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-3">
                   {product.season && <div className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-800 px-3 py-2 rounded-xl">
                      {product.season === 'winter' ? <Snowflake size={16} className="text-blue-400"/> : product.season === 'summer' ? <Sun size={16} className="text-yellow-400"/> : <CloudSun size={16} className="text-zinc-400"/>}
                      <span className="text-zinc-300 text-xs font-bold uppercase tracking-wide">{getSeasonLabel(product.season)}</span>
                   </div>}
                   {tyreIndex && (
                     <div className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-800 px-3 py-2 rounded-xl" title="Індекс навантаження та швидкості">
                        <Gauge size={16} className="text-[#FFC300]"/>
                        <span className="text-zinc-300 text-xs font-bold">{tyreIndex.code}: {describeTyreIndex(tyreIndex)}</span>
                     </div>
                   )}
                   {product.radius && (
                     <div className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-800 px-3 py-2 rounded-xl">
                        <Ruler size={16} className="text-[#FFC300]"/>
                        <span className="text-zinc-300 text-xs font-bold uppercase tracking-wide">{product.radius}</span>
                     </div>
                   )}
                </div>
              </div>

              {preset && product.attributes && preset.fields.some(f => formatAttr(f, product.attributes?.[f.key])) && (
                <div className="mb-6 rounded-2xl border border-zinc-800 overflow-hidden">
                  <h3 className="text-zinc-500 text-[11px] font-black uppercase tracking-widest px-4 py-2.5 bg-zinc-800/40">Характеристики</h3>
                  <dl className="divide-y divide-zinc-800">
                    {preset.fields.map(f => {
                      const v = formatAttr(f, product.attributes?.[f.key]);
                      if (!v) return null;
                      return (
                        <div key={f.key} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                          <dt className="text-zinc-500">{f.label}</dt>
                          <dd className="text-white font-bold text-right">{v}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              )}

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-zinc-800/30 p-4 rounded-2xl border border-zinc-800/50">
                  <p className="text-[11px] text-zinc-500 font-bold uppercase mb-1">Артикул</p>
                  <p className="text-white font-mono text-sm">{product.catalog_number || '—'}</p>
                </div>
                <div className="bg-zinc-800/30 p-4 rounded-2xl border border-zinc-800/50">
                  <p className="text-[11px] text-zinc-500 font-bold uppercase mb-1">Наявність</p>
                  <p className={`text-sm font-bold ${isOutOfStock ? 'text-red-500' : 'text-emerald-500'}`}>
                    {isOutOfStock ? 'Під замовлення' : 'В наявності'}
                  </p>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-zinc-500 text-[11px] font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Info size={12}/> Опис товару
                </h3>
                <div className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line bg-zinc-800/20 p-4 rounded-2xl border border-zinc-800/50">
                  {product.description || "Детальний опис для цієї моделі уточнюйте у менеджера за телефоном."}
                </div>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-2 mb-8 bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/50">
                <div className="flex flex-col items-center text-center group">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-2 group-hover:scale-110 transition-transform">
                    <ShieldCheck size={20} />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-black uppercase tracking-tighter">Гарантія якості</span>
                </div>
                <div className="flex flex-col items-center text-center group">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500 mb-2 group-hover:scale-110 transition-transform">
                    <Truck size={20} />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-black uppercase tracking-tighter">Швидка доставка</span>
                </div>
                <div className="flex flex-col items-center text-center group">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-500 mb-2 group-hover:scale-110 transition-transform">
                    <CreditCard size={20} />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-black uppercase tracking-tighter">Зручна оплата</span>
                </div>
              </div>

              <div className="sticky bottom-0 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 py-3 md:pt-4 md:pb-0 mt-auto z-40 -mx-5 px-5 md:mx-0 md:px-0">
                <div className="flex items-center gap-3 md:flex-col md:items-stretch">
                  <div className="flex flex-col shrink-0 md:mb-3">
                    <span className="text-[10px] md:text-[11px] text-zinc-500 font-bold uppercase tracking-widest md:mb-1">Ціна за штуку</span>
                    <span className="text-2xl md:text-4xl font-black text-[#FFC300] drop-shadow-[0_0_10px_rgba(255,195,0,0.2)] whitespace-nowrap">
                      {formatPrice(product.price)} <span className="text-xs md:text-sm text-white font-normal uppercase">грн</span>
                    </span>
                  </div>
                  <div className="flex flex-1 gap-2 md:flex-col md:gap-3">
                    <button
                      disabled={isOutOfStock}
                      onClick={() => { addToCart(product); onClose(); }}
                      className={`flex-1 py-3.5 md:py-5 rounded-2xl font-black text-xs sm:text-sm md:text-lg flex items-center justify-center gap-2 md:gap-3 uppercase tracking-wider md:tracking-widest transition-all active:scale-95 shadow-xl ${
                        isOutOfStock
                          ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                          : 'bg-white text-black hover:bg-[#FFC300] hover:shadow-yellow-400/20'
                      }`}
                    >
                      <ShoppingCart size={20} strokeWidth={2.5} /> {isOutOfStock ? 'Немає' : <><span className="sm:hidden">У кошик</span><span className="hidden sm:inline">Додати у кошик</span></>}
                    </button>
                    {!isOutOfStock && onQuickOrder && (
                      <button
                        onClick={() => { onQuickOrder(product); onClose(); }}
                        className="shrink-0 px-4 md:w-full md:py-4 rounded-2xl font-black text-xs text-[#FFC300] border border-[#FFC300]/30 hover:bg-[#FFC300]/10 hover:border-[#FFC300] transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                        aria-label="Купити в 1 клік"
                      >
                        <Phone size={16} /> <span className="hidden md:inline">Купити в 1 клік</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <ProductReviews productId={product.id} userId={userId} userName={userName} onRequireLogin={onRequireLogin} />

              {/* Similar Products Sector */}
              <div className="mt-8 border-t border-zinc-800 pt-8">
                <h3 className="text-white text-lg font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-[#FFC300] rounded-full"></div>
                  Схожі пропозиції
                </h3>
                {loadingSimilar ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin text-zinc-500" /></div>
                ) : similar.length === 0 ? (
                  <p className="text-zinc-500 text-sm italic">Альтернатив поки не знайдено.</p>
                ) : (
                  <div className="flex gap-4 overflow-x-auto pb-6 snap-x pr-4 scrollbar-hide">
                    {similar.map(t => (
                      <div key={t.id} onClick={() => onSimilarClick && onSimilarClick(t)} className="min-w-[170px] md:min-w-[190px] bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-col cursor-pointer hover:border-[#FFC300] transition-all snap-center group/card hover:shadow-2xl">
                        <div className="h-24 md:h-32 mb-3 bg-zinc-900/50 rounded-xl p-3 flex items-center justify-center overflow-hidden border border-zinc-800/50 group-hover/card:bg-black transition-colors">
                           {t.image_url ? <img src={t.image_url} alt={t.title} className="max-h-full object-contain group-hover/card:scale-110 transition-transform duration-500"/> : <Info className="opacity-10"/>}
                        </div>
                        <div className="flex-grow">
                          <span className="text-[11px] text-[#FFC300] font-black uppercase mb-1 block">{t.manufacturer || 'Товар'}</span>
                          <h4 className="text-white text-xs font-bold line-clamp-2 mb-2 leading-snug">{t.title} {t.radius}</h4>
                        </div>
                        <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center justify-between">
                          <span className="text-sm font-black text-white">{formatPrice(t.price)}</span>
                          <ArrowRight size={14} className="text-[#FFC300] opacity-0 group-hover/card:opacity-100 transition-all -translate-x-2 group-hover/card:translate-x-0"/>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recently Viewed - Display from localStorage */}
              {(() => {
                const recent = JSON.parse(localStorage.getItem('recent_tyres') || '[]').filter((t: any) => t.id !== product.id);
                if (recent.length === 0) return null;
                return (
                  <div className="mt-8 border-t border-zinc-800 pt-8 pb-10">
                    <h3 className="text-zinc-500 text-[11px] font-black uppercase tracking-widest mb-4">Ви нещодавно переглядали</h3>
                    <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                       {recent.slice(0, 4).map((t: any) => (
                         <div key={t.id} onClick={() => onSimilarClick && onSimilarClick(t)} className="min-w-[140px] bg-zinc-900/50 border border-zinc-800/30 p-2.5 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-zinc-800 transition-colors">
                            <div className="w-10 h-10 bg-black rounded flex-shrink-0 flex items-center justify-center p-1">
                               <img src={t.image_url} className="w-full h-full object-contain" alt="" />
                            </div>
                            <div className="min-w-0">
                               <p className="text-[10px] text-white font-bold truncate leading-tight uppercase">{t.manufacturer}</p>
                               <p className="text-[11px] text-[#FFC300] font-black leading-tight">{formatPrice(t.price)}</p>
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>
                );
              })()}

          </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;
