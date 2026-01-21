
import React from 'react';
import { ShoppingCart, Flame, ShoppingBag } from 'lucide-react';
import { TyreProduct } from '../../types';

interface ProductCardProps {
  tyre: TyreProduct;
  onClick: () => void;
  onAddToCart: (e: React.MouseEvent) => void;
  formatPrice: (p: string | undefined) => string;
}

const ProductCard: React.FC<ProductCardProps> = ({ tyre, onClick, onAddToCart, formatPrice }) => {
  const isOutOfStock = tyre.in_stock === false;
  const priceNum = parseFloat(tyre.price || '0');
  const oldPriceNum = parseFloat(tyre.old_price || '0');
  const hasDiscount = oldPriceNum > priceNum;
  
  const altText = `Шина ${tyre.manufacturer || ''} ${tyre.title} ${tyre.width ? tyre.width + '/' + tyre.height : ''} ${tyre.radius || ''} купити в Синельниковому`;

  return (
    <article 
      onClick={onClick} 
      className={`h-full bg-zinc-900 border rounded-xl overflow-hidden hover:border-[#FFC300] transition-all group flex flex-col relative cursor-pointer ${isOutOfStock ? 'opacity-70 border-zinc-800' : 'border-zinc-800 shadow-lg hover:shadow-yellow-900/10'}`}
    >
       <div className="aspect-square bg-black relative overflow-hidden">
          {tyre.image_url && !isOutOfStock ? (
            <img 
              src={tyre.image_url} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
              alt={altText}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 bg-zinc-950">
              <ShoppingBag size={32} className="opacity-20 mb-2"/>
              <span className="text-[10px] font-bold uppercase">{isOutOfStock ? 'Немає' : 'Без фото'}</span>
            </div>
          )}
          
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
            {tyre.is_hot && <div className="bg-orange-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-lg uppercase flex items-center gap-1"><Flame size={10} fill="currentColor"/> HOT</div>}
            {hasDiscount && <div className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-lg uppercase">SALE</div>}
          </div>
          
          {isOutOfStock && <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20"><span className="text-white text-[10px] font-black uppercase bg-red-600 px-2 py-1 -rotate-12">Архів</span></div>}
       </div>

       <div className="p-3 md:p-4 flex flex-col flex-grow">
          <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1 truncate">{tyre.manufacturer || 'Шина'}</div>
          <h3 className="text-sm md:text-base font-bold text-white mb-2 leading-tight line-clamp-2 min-h-[2.5em] group-hover:text-[#FFC300] transition-colors">{tyre.title}</h3>
          
          <div className="text-[10px] text-zinc-500 mb-2 flex flex-col gap-0.5">
            {tyre.catalog_number && <span>Арт: <span className="text-zinc-400 font-mono">{tyre.catalog_number}</span></span>}
            {(tyre.width || tyre.height || tyre.radius) && (
              <span className="text-[#FFC300] font-black uppercase mt-0.5 text-[11px]">
                {tyre.width}{tyre.height ? '/' + tyre.height : ''} {tyre.radius}
              </span>
            )}
          </div>

          <div className="mt-auto pt-3 border-t border-zinc-800 flex flex-col gap-2">
            <div className="flex flex-col">
              {hasDiscount && <span className="text-zinc-500 text-[10px] line-through">{formatPrice(tyre.old_price)} грн</span>}
              <span className="text-xl font-black text-[#FFC300]">{formatPrice(tyre.price)} <span className="text-[10px] font-normal text-zinc-500">грн</span></span>
            </div>
            <button 
              onClick={onAddToCart} 
              disabled={isOutOfStock} 
              className={`w-full py-3 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${
                isOutOfStock ? 'bg-zinc-800 text-zinc-500' : 'bg-white text-black hover:bg-[#FFC300]'
              }`}
            >
              <ShoppingCart size={14} /> {isOutOfStock ? 'Відсутня' : 'Купити'}
            </button>
          </div>
       </div>
    </article>
  );
};

export default ProductCard;
