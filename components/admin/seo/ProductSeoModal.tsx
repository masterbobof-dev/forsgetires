import React from 'react';
import { Save, RefreshCw, Loader2, X } from 'lucide-react';
import type { SeoProducts } from './useSeoProducts';

/** Edit window "SEO для товару" (shown while a product is being edited). */
const ProductSeoModal: React.FC<{ prod: SeoProducts }> = ({ prod }) => {
  const { editingProduct, setEditingProduct, isSavingProduct, handleSaveProductSeo, autoFillProductSeo } = prod;
  if (!editingProduct) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
      <div className="bg-zinc-900 border-0 sm:border sm:border-zinc-700 rounded-none sm:rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh]">
        <div className="p-4 sm:p-6 border-b border-zinc-800 flex justify-between items-center">
          <div>
            <h4 className="text-lg sm:text-xl font-black text-white">SEO для товару</h4>
            <p className="text-zinc-500 text-[10px] sm:text-xs truncate max-w-[200px] sm:max-w-[400px]">{editingProduct.title}</p>
          </div>
          <button onClick={() => setEditingProduct(null)} className="p-2 bg-zinc-800 rounded-full text-zinc-500 hover:text-white"><X size={24}/></button>
        </div>
        
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={() => autoFillProductSeo(editingProduct)}
              className="text-[#FFC300] text-xs font-bold flex items-center gap-1 hover:underline bg-[#FFC300]/10 px-3 py-1.5 rounded-full"
            >
              <RefreshCw size={12}/> Авто-заповнення
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-zinc-400 text-[10px] font-black uppercase mb-1">SEO Заголовок (Title)</label>
              <input 
                type="text" 
                value={editingProduct.seo_title || ''}
                onChange={e => setEditingProduct({...editingProduct, seo_title: e.target.value})}
                className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white font-bold focus:border-[#FFC300] outline-none text-sm"
                placeholder="Напр. Michelin Alpin 6 205/55 R16 купити в Синельникове"
              />
            </div>

            <div>
              <label className="block text-zinc-400 text-[10px] font-black uppercase mb-1">SEO Опис (Description)</label>
              <textarea 
                rows={3}
                value={editingProduct.seo_description || ''}
                onChange={e => setEditingProduct({...editingProduct, seo_description: e.target.value})}
                className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white text-sm focus:border-[#FFC300] outline-none"
                placeholder="Напр. Купуйте якісні зимові шини Michelin Alpin 6 за найкращою ціною..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-400 text-[10px] font-black uppercase mb-1">Slug (URL шлях)</label>
                <input 
                  type="text" 
                  value={editingProduct.slug || ''}
                  onChange={e => setEditingProduct({...editingProduct, slug: e.target.value})}
                  className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white font-mono text-xs focus:border-[#FFC300] outline-none"
                  placeholder="michelin-alpin-6-205-55-r16"
                />
              </div>
              <div>
                <label className="block text-zinc-400 text-[10px] font-black uppercase mb-1">Ключові слова</label>
                <input 
                  type="text" 
                  value={editingProduct.seo_keywords || ''}
                  onChange={e => setEditingProduct({...editingProduct, seo_keywords: e.target.value})}
                  className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white text-xs focus:border-[#FFC300] outline-none"
                  placeholder="шини, michelin, купити"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white p-4 rounded-xl border border-zinc-300">
            <div className="text-[10px] text-gray-500 mb-2 uppercase font-bold">Google Preview</div>
            <div className="text-[#1a0dab] text-base sm:text-lg font-medium truncate">{editingProduct.seo_title || editingProduct.title}</div>
            <div className="text-green-700 text-[10px] sm:text-xs truncate">forsage.com.ua › products › {editingProduct.slug || '...'}</div>
            <div className="text-gray-600 text-[10px] sm:text-xs line-clamp-2 mt-1">{editingProduct.seo_description || 'Опис ще не додано...'}</div>
          </div>
        </div>

        <div className="p-4 sm:p-6 border-t border-zinc-800 flex gap-3 mt-auto">
          <button onClick={() => setEditingProduct(null)} className="flex-1 py-3 bg-zinc-800 text-white font-bold rounded-xl hover:bg-zinc-700 transition-colors">Скасувати</button>
          <button onClick={handleSaveProductSeo} disabled={isSavingProduct} className="flex-1 py-3 bg-[#FFC300] text-black font-black rounded-xl hover:bg-[#e6b000] transition-colors flex items-center justify-center gap-2">
            {isSavingProduct ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Зберегти
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductSeoModal;
