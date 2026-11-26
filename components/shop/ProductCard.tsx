
import React, { useState } from 'react';
import NoPhoto from './NoPhoto';
import { ShoppingCart, Flame, ShoppingBag, Eye, Info, Heart, Scale, PhoneCall, Clock } from 'lucide-react';
import { TyreProduct } from '../../types';
import { parseTyreIndex, describeTyreIndex } from '../../tyreIndex';

interface ProductCardProps {
  /** one of the first cards on screen: load its photo at once (Google measures how fast it appears) */
  priority?: boolean;
  tyre: TyreProduct;
  onClick: () => void;
  onAddToCart: (e: React.MouseEvent) => void;
  onQuickOrder?: (tyre: TyreProduct) => void;
  formatPrice: (p: string | undefined) => string;
  /** characteristic badges, e.g. "60 Ah", "R+", "R16" */
  chips?: string[];
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isCompared?: boolean;
  onToggleCompare?: () => void;
  /** stock tracking is on → show "Залишилося N шт" for low quantities */
  showStock?: boolean;
  /** icon of the product's category, shown when there is no photo */
  placeholderIcon?: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

const ProductCard: React.FC<ProductCardProps> = ({ tyre, onClick, onAddToCart, onQuickOrder, formatPrice, chips = [], isFavorite, onToggleFavorite, isCompared, onToggleCompare, showStock = false, placeholderIcon: PlaceholderIcon, priority = false }) => {
  const [imgBroken, setImgBroken] = useState(false); // a photo that does not open → the yellow icon instead of a "?"
  const hasImg = !!tyre.image_url && !imgBroken;
  const isOutOfStock = tyre.in_stock === false;
  // "ask for the price" goods; partner offers are on order too, but with a known price and delivery days
  const partner = !!tyre.on_order && !!tyre.supplier_offer_id;
  const onOrder = !!tyre.on_order && !partner;
  // own stock from the shop program: real quantity
  const stockQty = tyre.program_product_id && typeof tyre.stock_quantity === 'number' ? tyre.stock_quantity : null;
  const priceNum = parseFloat(tyre.price || '0');
  const oldPriceNum = parseFloat(tyre.old_price || '0');
  const hasDiscount = oldPriceNum > priceNum;
  const discountPercent = hasDiscount ? Math.round(((oldPriceNum - priceNum) / oldPriceNum) * 100) : 0;
  
  // Only real quantities (when stock tracking is on) produce "Залишилося N шт"
  const isLowStock = showStock && typeof tyre.stock_quantity === 'number' && tyre.stock_quantity > 0 && tyre.stock_quantity <= 4;
  const tyreIndex = tyre.width ? parseTyreIndex(tyre.title) : null;

  const altText = `${tyre.manufacturer || ''} ${tyre.title} ${tyre.width ? tyre.width + '/' + tyre.height : ''} ${tyre.radius || ''} купити в Синельниковому`;

  return (
    <article 
      onClick={onClick} 
      className={`group relative flex flex-col h-full bg-zinc-900/50 border rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-yellow-900/20 active:scale-[0.98] ${
        isOutOfStock 
          ? 'opacity-60 border-zinc-800 grayscale-[0.5] hover:border-zinc-700' 
          : tyre.is_hot 
            ? 'border-[#FFC300]/60 shadow-[0_0_15px_rgba(255,195,0,0.15)] hover:border-[#FFC300] hover:shadow-[0_0_20px_rgba(255,195,0,0.3)] cursor-pointer' 
            : 'border-zinc-800 hover:border-[#FFC300] cursor-pointer'
      }`}
    >
       {/* Image Section */}
       <div className={`aspect-square relative overflow-hidden ${hasImg ? 'bg-white' : 'bg-zinc-950'}`}>
          {hasImg ? (
            <img 
              src={tyre.image_thumb_url || tyre.image_url} 
              className="w-full h-full object-contain p-3 sm:p-4 mix-blend-multiply transition-transform duration-700 group-hover:scale-105" 
              alt={altText}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              decoding="async"
              width={400}
              height={500}
              referrerPolicy="no-referrer"
              onError={() => setImgBroken(true)}
            />
          ) : (
            <NoPhoto icon={PlaceholderIcon} size={46} />
          )}
          
          {/* Badges */}
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 flex flex-wrap sm:flex-col gap-1 sm:gap-1.5 max-w-[calc(100%-1rem)]">
            {/* at most two badges: discount and "hit" */}
            {tyre.is_hot && (
              <div className="bg-orange-600 text-white text-[11px] sm:text-[11px] font-black px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow-lg uppercase flex items-center gap-1">
                <Flame size={12} fill="currentColor"/> 
                <span>Хіт</span>
              </div>
            )}
            {hasDiscount && (
              <div className="bg-red-600 text-white text-[10px] sm:text-[11px] font-black px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow-lg uppercase flex items-center gap-1">
                {tyre.promo_badge || `−${discountPercent}%`}
              </div>
            )}
          </div>
          
          {/* Favourite / compare */}
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-30 flex flex-col gap-1.5">
            {onToggleFavorite && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-90 ${isFavorite ? 'bg-red-600 text-white' : 'bg-black/50 text-zinc-300 hover:text-white hover:bg-black/70'}`}
                aria-label={isFavorite ? 'Прибрати з обраного' : 'Додати в обране'} aria-pressed={!!isFavorite}
              >
                <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? 'animate-in zoom-in duration-200' : ''} />
              </button>
            )}
            {onToggleCompare && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleCompare(); }}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-90 ${isCompared ? 'bg-[#FFC300] text-black' : 'bg-black/50 text-zinc-300 hover:text-white hover:bg-black/70'}`}
                aria-label={isCompared ? 'Прибрати з порівняння' : 'Додати до порівняння'} aria-pressed={!!isCompared}
              >
                <Scale size={15} />
              </button>
            )}
          </div>

          {isLowStock && !isOutOfStock && (
            <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 z-10">
              <div className="bg-black/60 backdrop-blur-md text-red-500 text-[10px] font-black px-2 py-1 rounded-lg border border-red-500/30 uppercase tracking-tighter">
                Залишилося: {tyre.stock_quantity} шт
              </div>
            </div>
          )}

          {/* Quick View Overlay (only devices with a mouse) */}
          {!isOutOfStock && (
            <div className="absolute inset-0 hidden [@media(hover:hover)]:flex bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 items-center justify-center gap-2">
               <div className="bg-white text-black p-3 rounded-full transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-xl">
                  <Eye size={20} />
               </div>
               {onQuickOrder && (
                 <button 
                  onClick={(e) => { e.stopPropagation(); onQuickOrder(tyre); }}
                  className="bg-[#FFC300] text-black px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75 shadow-xl hover:bg-white"
                 >
                   {onOrder ? 'Дізнатися ціну' : 'Швидке замовлення'}
                 </button>
               )}
            </div>
          )}
          
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
              <span className="text-white text-xs font-black uppercase bg-zinc-800 border border-zinc-700 px-4 py-2 rounded-lg tracking-widest -rotate-6 shadow-2xl">
                Архів
              </span>
            </div>
          )}
       </div>

       {/* Content Section */}
       <div className="p-3 sm:p-4 flex flex-col flex-grow">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[11px] text-zinc-500 uppercase font-bold tracking-wider truncate max-w-[70%]">
              {tyre.manufacturer || 'Товар'}
            </span>
            {tyre.season && (
              <span className="text-[10px] text-zinc-400 border border-zinc-800 px-1.5 py-0.5 rounded uppercase font-medium">
                {tyre.season === 'winter' ? 'Зима' : tyre.season === 'summer' ? 'Літо' : 'Всесезон'}
              </span>
            )}
          </div>

          <h3 className="text-[13px] sm:text-sm md:text-base font-bold text-white mb-2 sm:mb-3 leading-tight line-clamp-2 min-h-[2.5em] group-hover:text-[#FFC300] transition-colors">
            {tyre.title}
          </h3>
          
          <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-3 sm:mb-4">
            {chips.map(chip => (
              <span key={chip} className="bg-zinc-800/60 text-zinc-200 text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded border border-zinc-700/60 whitespace-nowrap">
                {chip}
              </span>
            ))}
            {tyre.width && (
              <span className="bg-zinc-800/50 text-zinc-300 text-[11px] font-bold px-2 py-0.5 rounded border border-zinc-800">
                {tyre.width}/{tyre.height}
              </span>
            )}
            {tyre.radius && (
              <span className="bg-[#FFC300]/10 text-[#FFC300] text-[11px] font-black px-2 py-0.5 rounded border border-[#FFC300]/20">
                {tyre.radius}
              </span>
            )}
            {tyreIndex && (
              <span title={describeTyreIndex(tyreIndex)} className="bg-zinc-800/50 text-zinc-300 text-[11px] font-bold px-2 py-0.5 rounded border border-zinc-800">
                {tyreIndex.code}
              </span>
            )}
          </div>

          {onOrder || partner ? (
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 mb-2"><Clock size={13} /> Під замовлення{partner && tyre.lead_days ? ` · ${tyre.lead_days} дн.` : ''}</p>
          ) : stockQty !== null && stockQty > 0 ? (
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-green-400 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> В наявності: {stockQty > 10 ? '>10' : stockQty} шт
            </p>
          ) : null}

          <div className="mt-auto pt-3 sm:pt-4 border-t border-zinc-800/50 flex items-center justify-between gap-2">
            {onOrder ? (
              <span className="text-sm font-black text-zinc-300 leading-tight">Ціну<br className="sm:hidden" /> уточнюйте</span>
            ) : (
            <div className="flex flex-col min-w-0">
              {hasDiscount && (
                <span className="text-zinc-500 text-[11px] line-through decoration-red-500/50">
                  {formatPrice(tyre.old_price)}
                </span>
              )}
              <div className="flex items-baseline gap-1 min-w-0">
                <span className={`${String(formatPrice(tyre.price)).length > 4 ? 'text-base' : 'text-lg'} sm:text-xl font-black text-[#FFC300] truncate`}>
                  {formatPrice(tyre.price)}
                </span>
                <span className="text-[11px] font-bold text-zinc-500 uppercase">грн</span>
              </div>
            </div>
            )}
            
            {onOrder && onQuickOrder ? (
              <button
                onClick={(e) => { e.stopPropagation(); onQuickOrder(tyre); }}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-[#FFC300] hover:text-black text-white text-[11px] font-black uppercase transition-colors active:scale-95 shrink-0"
                title="Дізнатися ціну і термін"
              >
                <PhoneCall size={16} /> <span className="hidden sm:inline">Дізнатися ціну</span>
              </button>
            ) : (
            <button 
              onClick={onAddToCart} 
              disabled={isOutOfStock} 
              className={`p-2.5 sm:p-3 rounded-xl transition-all active:scale-90 shadow-lg shrink-0 ${
                isOutOfStock 
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' 
                  : 'bg-[#FFC300] text-black hover:bg-white hover:shadow-yellow-400/20'
              }`}
              title={isOutOfStock ? 'Немає в наявності' : 'Додати у кошик'}
            >
              <ShoppingCart size={20} strokeWidth={2.5} />
            </button>
            )}
          </div>
       </div>
    </article>
  );
};

export default ProductCard;
