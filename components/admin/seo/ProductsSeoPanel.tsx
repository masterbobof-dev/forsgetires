import React from 'react';
import { Search, Globe, CheckCircle, AlertTriangle, Image as ImageIcon, Loader2, Edit2 } from 'lucide-react';
import type { SeoProducts } from './useSeoProducts';

const ProductsSeoPanel: React.FC<{ prod: SeoProducts }> = ({ prod }) => {
  const { products, loadingProducts, productSearch, setProductSearch, setEditingProduct } = prod;
  return (
  <div className="space-y-6">
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h3 className="text-2xl font-black text-white flex items-center gap-2">
          <Globe className="text-[#FFC300]"/> SEO Товарів
        </h3>
        <p className="text-zinc-400 text-sm mt-1">Налаштування мета-тегів для кожного товару окремо.</p>
      </div>
      <div className="relative w-full md:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18}/>
        <input 
          type="text" 
          placeholder="Пошук товару..." 
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-white outline-none focus:border-[#FFC300]"
        />
      </div>
    </div>

    {loadingProducts ? (
      <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#FFC300]" size={48} /></div>
    ) : (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden overflow-x-auto no-scrollbar">
        <div className="min-w-[600px]">
          <table className="w-full text-left">
            <thead className="bg-black text-zinc-500 text-[10px] font-black uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Товар</th>
                <th className="px-6 py-4">SEO Статус</th>
                <th className="px-6 py-4 text-right">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {products.map(product => {
                const hasSeo = product.seo_title && product.seo_description;
                return (
                  <tr key={product.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-black rounded border border-zinc-800 overflow-hidden flex-shrink-0">
                          {product.image_url ? <img src={product.image_url} className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-2 text-zinc-700"/>}
                        </div>
                        <div>
                          <div className="text-white font-bold text-sm line-clamp-1">{product.title}</div>
                          <div className="text-zinc-500 text-[10px] font-mono">{product.catalog_number}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {hasSeo ? (
                        <span className="flex items-center gap-1 text-green-500 text-xs font-bold bg-green-900/10 px-2 py-1 rounded-full w-fit">
                          <CheckCircle size={12}/> Налаштовано
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-orange-500 text-xs font-bold bg-orange-900/10 px-2 py-1 rounded-full w-fit">
                          <AlertTriangle size={12}/> Потребує уваги
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setEditingProduct(product)}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
                      >
                        <Edit2 size={16}/>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
  );
};

export default ProductsSeoPanel;
