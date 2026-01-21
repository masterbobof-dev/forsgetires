
import React from 'react';
import { X, ShoppingCart, ZoomIn } from 'lucide-react';
import { TyreProduct } from '../../types';

interface ProductDetailModalProps {
  product: TyreProduct | null;
  onClose: () => void;
  addToCart: (t: TyreProduct) => void;
  formatPrice: (p: string | undefined) => string;
  getSeasonLabel: (s: string | undefined) => string;
  renderSchema: (p: TyreProduct) => React.ReactNode;
  openLightbox: (p: TyreProduct) => void;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose, addToCart, formatPrice, getSeasonLabel, renderSchema, openLightbox }) => {
  if (!product) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 md:p-4 animate-in fade-in duration-200" onClick={onClose}>
      {renderSchema(product)}
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl shadow-2xl relative flex flex-col md:flex-row overflow-hidden max-h-[90vh]" onClick={e => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white z-20 bg-black/50 p-1 rounded-full"><X size={24} /></button>
          
          <div className="w-full md:w-1/2 bg-black flex items-center justify-center relative min-h-[300px] cursor-zoom-in" onClick={() => openLightbox(product)}>
              {product.image_url ? (
                  <img src={product.image_url} className="w-full h-full object-cover" alt={product.title} />
              ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-700">Немає фото</div>
              )}
              <div className="absolute bottom-4 right-4 bg-black/60 p-2 rounded-lg text-white/70"><ZoomIn size={20}/></div>
          </div>

          <div className="w-full md:w-1/2 p-6 md:p-8 overflow-y-auto bg-zinc-900 flex flex-col">
              <div className="mb-6">
                <span className="text-[#FFC300] font-bold uppercase tracking-wider text-xs mb-2 block">{product.manufacturer || 'Шина'}</span>
                <h1 className="text-xl md:text-2xl font-black text-white leading-tight mb-2">{product.title}</h1>
                <div className="flex flex-wrap gap-2 mt-3">
                   <span className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded text-xs font-bold">{getSeasonLabel(product.season)}</span>
                   {product.radius && <span className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded text-xs font-bold">{product.radius}</span>}
                </div>
              </div>

              <div className="prose prose-invert prose-sm mb-8 text-zinc-400 whitespace-pre-line border-t border-zinc-800 pt-4">
                {product.description || "Опис відсутній для цього товару."}
              </div>

              <div className="mt-auto border-t border-zinc-800 pt-6">
                <div className="flex items-end gap-3 mb-6">
                    <span className="text-4xl font-black text-[#FFC300]">{formatPrice(product.price)} <span className="text-base text-white font-normal">грн</span></span>
                </div>
                <button 
                  onClick={() => { addToCart(product); onClose(); }} 
                  className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 uppercase tracking-wide bg-white text-black hover:bg-[#FFC300] transition-colors"
                >
                  <ShoppingCart size={22} /> Купити
                </button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;
