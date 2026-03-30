
import React, { useState, useEffect } from 'react';
import { X, ShoppingCart, ZoomIn, ShieldCheck, Truck, CreditCard, Info, Snowflake, Sun, CloudSun, Ruler, Flame, Loader2 } from 'lucide-react';
import { TyreProduct } from '../../types';
import { supabase } from '../../supabaseClient';

interface ProductDetailModalProps {
  product: TyreProduct | null;
  onClose: () => void;
  addToCart: (t: TyreProduct) => void;
  formatPrice: (p: string | undefined) => string;
  getSeasonLabel: (s: string | undefined) => string;
  renderSchema: (p: TyreProduct) => React.ReactNode;
  openLightbox: (p: TyreProduct) => void;
  onQuickOrder?: (p: TyreProduct) => void;
  onSimilarClick?: (t: TyreProduct) => void;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose, addToCart, formatPrice, getSeasonLabel, renderSchema, openLightbox, onQuickOrder, onSimilarClick }) => {
  const [similar, setSimilar] = useState<TyreProduct[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  useEffect(() => {
    if (!product) return;
    const fetchSimilar = async () => {
      setLoadingSimilar(true);
      try {
         let query = supabase.from('tyres').select('*').neq('id', product.id).neq('in_stock', false);
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
  
  const isLowStock = product.stock_quantity !== undefined && product.stock_quantity > 0 && product.stock_quantity <= 4;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-2 md:p-4 animate-in fade-in duration-300" onClick={onClose}>
      {renderSchema(product)}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-5xl shadow-2xl relative flex flex-col md:flex-row overflow-hidden max-h-[95vh] md:max-h-[85vh]" onClick={e => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white z-20 bg-black/50 hover:bg-black p-2 rounded-full transition-all"><X size={24} /></button>
          
          {/* Image Section */}
          <div className="w-full md:w-1/2 bg-zinc-950 flex items-center justify-center relative min-h-[350px] md:min-h-full cursor-zoom-in group" onClick={() => openLightbox(product)}>
              {product.image_url ? (
                  <img src={product.image_url} className="w-full h-full object-contain p-4 md:p-8 transition-transform duration-500 group-hover:scale-105" alt={product.title} referrerPolicy="no-referrer" />
              ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-800">
                    <Info size={64} strokeWidth={1} className="mb-4 opacity-20"/>
                    <span className="font-bold uppercase tracking-widest text-xs">Фото відсутнє</span>
                  </div>
              )}
              
              {hasDiscount && (
                <div className="absolute top-6 left-6 bg-red-600 text-white px-4 py-2 rounded-2xl font-black text-sm shadow-2xl animate-bounce">
                  ЗНИЖКА -{discountPercent}%
                </div>
              )}

              <div className="absolute bottom-6 right-6 bg-black/60 backdrop-blur-md p-3 rounded-2xl text-white/70 opacity-0 group-hover:opacity-100 transition-opacity">
                <ZoomIn size={24}/>
              </div>
          </div>

          {/* Info Section */}
          <div className="w-full md:w-1/2 p-6 md:p-10 overflow-y-auto bg-zinc-900 flex flex-col">
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-[#FFC300] text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">
                    {product.manufacturer || 'Шина'}
                  </span>
                  {product.is_hot && <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">HOT</span>}
                  {isLowStock && !isOutOfStock && (
                    <span className="bg-red-600/20 text-red-500 border border-red-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter animate-pulse">
                      Залишилося: {product.stock_quantity} шт
                    </span>
                  )}
                </div>
                
                <h1 className="text-2xl md:text-3xl font-black text-white leading-tight mb-4">{product.title}</h1>
                
                <div className="flex flex-wrap gap-3">
                   <div className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-800 px-3 py-2 rounded-xl">
                      {product.season === 'winter' ? <Snowflake size={16} className="text-blue-400"/> : product.season === 'summer' ? <Sun size={16} className="text-yellow-400"/> : <CloudSun size={16} className="text-zinc-400"/>}
                      <span className="text-zinc-300 text-xs font-bold uppercase tracking-wide">{getSeasonLabel(product.season)}</span>
                   </div>
                   {product.radius && (
                     <div className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-800 px-3 py-2 rounded-xl">
                        <Ruler size={16} className="text-[#FFC300]"/>
                        <span className="text-zinc-300 text-xs font-bold uppercase tracking-wide">{product.radius}</span>
                     </div>
                   )}
                </div>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-zinc-800/30 p-4 rounded-2xl border border-zinc-800/50">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Артикул</p>
                  <p className="text-white font-mono text-sm">{product.catalog_number || '—'}</p>
                </div>
                <div className="bg-zinc-800/30 p-4 rounded-2xl border border-zinc-800/50">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Наявність</p>
                  <p className={`text-sm font-bold ${isOutOfStock ? 'text-red-500' : 'text-emerald-500'}`}>
                    {isOutOfStock ? 'Під замовлення' : 'В наявності'}
                  </p>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Info size={12}/> Опис товару
                </h3>
                <div className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line bg-zinc-800/20 p-4 rounded-2xl border border-zinc-800/50">
                  {product.description || "Детальний опис для цієї моделі уточнюйте у менеджера за телефоном."}
                </div>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-2 mb-8">
                <div className="flex flex-col items-center text-center p-2">
                  <ShieldCheck size={20} className="text-emerald-500 mb-1"/>
                  <span className="text-[8px] text-zinc-500 font-bold uppercase">Гарантія</span>
                </div>
                <div className="flex flex-col items-center text-center p-2">
                  <Truck size={20} className="text-blue-500 mb-1"/>
                  <span className="text-[8px] text-zinc-500 font-bold uppercase">Доставка</span>
                </div>
                <div className="flex flex-col items-center text-center p-2">
                  <CreditCard size={20} className="text-purple-500 mb-1"/>
                  <span className="text-[8px] text-zinc-500 font-bold uppercase">Оплата</span>
                </div>
              </div>

              <div className="sticky bottom-0 bg-zinc-900 border-t border-zinc-800 pt-4 pb-4 md:pb-0 mt-auto z-40 -mx-6 px-6 md:mx-0 md:px-0">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase">Ціна за шт.</span>
                      <span className="text-4xl font-black text-[#FFC300]">{formatPrice(product.price)} <span className="text-sm text-white font-normal uppercase">грн</span></span>
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                  <button 
                    disabled={isOutOfStock}
                    onClick={() => { addToCart(product); onClose(); }} 
                    className={`w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 uppercase tracking-widest transition-all active:scale-95 shadow-xl ${
                      isOutOfStock 
                        ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' 
                        : 'bg-white text-black hover:bg-[#FFC300] hover:shadow-yellow-400/20'
                    }`}
                  >
                    <ShoppingCart size={24} strokeWidth={2.5} /> {isOutOfStock ? 'Немає' : 'Додати у кошик'}
                  </button>
                  
                  {!isOutOfStock && onQuickOrder && (
                    <button 
                      onClick={() => { onQuickOrder(product); onClose(); }}
                      className="w-full py-4 rounded-2xl font-bold text-sm text-[#FFC300] border border-[#FFC300]/30 hover:bg-[#FFC300]/10 transition-all uppercase tracking-widest"
                    >
                      Купити в 1 клік
                    </button>
                  )}
                </div>
              </div>

              {/* Similar Products Sector */}
              <div className="mt-8 border-t border-zinc-800 pt-8 pb-8">
                <h3 className="text-white text-lg font-black uppercase tracking-widest mb-4">Схожі шини ({product.width ? `${product.width}/${product.height} ` : ''}{product.radius})</h3>
                {loadingSimilar ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin text-zinc-500" /></div>
                ) : similar.length === 0 ? (
                  <p className="text-zinc-500 text-sm">Альтернатив не знайдено.</p>
                ) : (
                  <div className="flex gap-4 overflow-x-auto pb-4 snap-x pr-4" style={{scrollbarWidth: 'none'}}>
                    {similar.map(t => (
                      <div key={t.id} onClick={() => onSimilarClick && onSimilarClick(t)} className="min-w-[160px] md:min-w-[180px] bg-zinc-950 border border-zinc-800 rounded-2xl p-3 flex flex-col cursor-pointer hover:border-[#FFC300] transition-colors snap-center group">
                        <div className="h-24 md:h-32 mb-3 bg-zinc-900 rounded-xl p-2 flex items-center justify-center overflow-hidden">
                           {t.image_url ? <img src={t.image_url} alt={t.title} className="max-h-full object-contain group-hover:scale-110 transition-transform"/> : <Info className="opacity-20"/>}
                        </div>
                        <span className="text-[10px] text-[#FFC300] font-black uppercase mb-1 truncate">{t.manufacturer || 'Шина'}</span>
                        <h4 className="text-white text-xs font-bold line-clamp-2 mb-2 flex-grow">{t.title}</h4>
                        <span className="text-sm font-black text-white">{formatPrice(t.price)} грн</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

          </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;
