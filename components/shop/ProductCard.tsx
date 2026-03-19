
import React from 'react';
import { ShoppingCart, Flame, ShoppingBag, Eye, Info } from 'lucide-react';
import { TyreProduct } from '../../types';

interface ProductCardProps {
  tyre: TyreProduct;
  onClick: () => void;
  onAddToCart: (e: React.MouseEvent) => void;
  onQuickOrder?: (tyre: TyreProduct) => void;
  formatPrice: (p: string | undefined) => string;
}

const ProductCard: React.FC<ProductCardProps> = ({ tyre, onClick, onAddToCart, onQuickOrder, formatPrice }) => {
  const isOutOfStock = tyre.in_stock === false;
  const priceNum = parseFloat(tyre.price || '0');
  const oldPriceNum = parseFloat(tyre.old_price || '0');
  const hasDiscount = oldPriceNum > priceNum;
  const discountPercent = hasDiscount ? Math.round(((oldPriceNum - priceNum) / oldPriceNum) * 100) : 0;
  
  // Check if product is new (last 7 days)
  const isNew = tyre.created_at ? (new Date().getTime() - new Date(tyre.created_at).getTime()) < (7 * 24 * 60 * 60 * 1000) : false;
  
  // Low stock logic
  const isLowStock = tyre.stock_quantity !== undefined && tyre.stock_quantity > 0 && tyre.stock_quantity <= 4;

  const altText = `Шина ${tyre.manufacturer || ''} ${tyre.title} ${tyre.width ? tyre.width + '/' + tyre.height : ''} ${tyre.radius || ''} купити в Синельниковому`;

  return (
    <article 
      onClick={onClick} 
      className={`group relative flex flex-col h-full bg-zinc-900/50 backdrop-blur-sm border rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-yellow-900/20 ${
        isOutOfStock 
          ? 'opacity-60 border-zinc-800 grayscale-[0.5]' 
          : 'border-zinc-800 hover:border-[#FFC300] cursor-pointer'
      }`}
    >
       {/* Image Section */}
       <div className="aspect-[4/5] bg-zinc-950 relative overflow-hidden">
          {tyre.image_url ? (
            <img 
              src={tyre.image_url} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
              alt={altText}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-800">
              <ShoppingBag size={48} strokeWidth={1} className="opacity-20 mb-2"/>
              <span className="text-[10px] font-bold uppercase tracking-widest">Немає фото</span>
            </div>
          )}
          
          {/* Badges */}
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
            {isNew && (
              <div className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg uppercase">
                NEW
              </div>
            )}
            {tyre.is_hot && (
              <div className="bg-orange-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg uppercase flex items-center gap-1 animate-pulse">
                <Flame size={12} fill="currentColor"/> 
                <span>HOT</span>
              </div>
            )}
            {hasDiscount && (
              <div className="bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg uppercase flex items-center gap-1">
                SALE -{discountPercent}%
              </div>
            )}
          </div>
          
          {isLowStock && !isOutOfStock && (
            <div className="absolute bottom-3 left-3 z-10">
              <div className="bg-black/60 backdrop-blur-md text-red-500 text-[9px] font-black px-2 py-1 rounded-lg border border-red-500/30 uppercase tracking-tighter">
                Залишилося: {tyre.stock_quantity} шт
              </div>
            </div>
          )}

          {/* Quick View Overlay (Desktop) */}
          {!isOutOfStock && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
               <div className="bg-white text-black p-3 rounded-full transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-xl">
                  <Eye size={20} />
               </div>
               {onQuickOrder && (
                 <button 
                  onClick={(e) => { e.stopPropagation(); onQuickOrder(tyre); }}
                  className="bg-[#FFC300] text-black px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75 shadow-xl hover:bg-white"
                 >
                   Швидке замовлення
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
       <div className="p-4 flex flex-col flex-grow">
          <div className="flex justify-between items-start mb-1">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider truncate max-w-[70%]">
              {tyre.manufacturer || 'Шина'}
            </span>
            {tyre.season && (
              <span className="text-[9px] text-zinc-400 border border-zinc-800 px-1.5 py-0.5 rounded uppercase font-medium">
                {tyre.season === 'winter' ? 'Зима' : tyre.season === 'summer' ? 'Літо' : 'Всесезон'}
              </span>
            )}
          </div>

          <h3 className="text-sm md:text-base font-bold text-white mb-3 leading-tight line-clamp-2 min-h-[2.5em] group-hover:text-[#FFC300] transition-colors">
            {tyre.title}
          </h3>
          
          <div className="flex flex-wrap gap-1.5 mb-4">
            {tyre.width && (
              <span className="bg-zinc-800/50 text-zinc-300 text-[10px] font-bold px-2 py-0.5 rounded border border-zinc-800">
                {tyre.width}/{tyre.height}
              </span>
            )}
            {tyre.radius && (
              <span className="bg-[#FFC300]/10 text-[#FFC300] text-[10px] font-black px-2 py-0.5 rounded border border-[#FFC300]/20">
                {tyre.radius}
              </span>
            )}
          </div>

          <div className="mt-auto pt-4 border-t border-zinc-800/50 flex items-center justify-between gap-2">
            <div className="flex flex-col">
              {hasDiscount && (
                <span className="text-zinc-500 text-[10px] line-through decoration-red-500/50">
                  {formatPrice(tyre.old_price)}
                </span>
              )}
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-[#FFC300]">
                  {formatPrice(tyre.price)}
                </span>
                <span className="text-[10px] font-bold text-zinc-500 uppercase">грн</span>
              </div>
            </div>
            
            <button 
              onClick={onAddToCart} 
              disabled={isOutOfStock} 
              className={`p-3 rounded-xl transition-all active:scale-90 shadow-lg ${
                isOutOfStock 
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' 
                  : 'bg-[#FFC300] text-black hover:bg-white hover:shadow-yellow-400/20'
              }`}
              title={isOutOfStock ? 'Немає в наявності' : 'Додати у кошик'}
            >
              <ShoppingCart size={20} strokeWidth={2.5} />
            </button>
          </div>
       </div>
    </article>
  );
};

export default ProductCard;
