import React from 'react';
import { X, ShoppingCart, Trash2, Scale } from 'lucide-react';
import { TyreProduct } from '../../types';
import { ProductCategory } from '../../categories';
import { getPresetForProduct, formatAttr, AttrField } from '../../productAttributes';

interface CompareModalProps {
  open: boolean;
  products: TyreProduct[];
  categories: ProductCategory[];
  loading: boolean;
  onClose: () => void;
  onRemove: (id: number) => void;
  onClear: () => void;
  onOpenProduct: (p: TyreProduct) => void;
  onAddToCart: (p: TyreProduct) => void;
  formatPrice: (p: string | undefined) => string;
}

const SEASON: Record<string, string> = { winter: 'Зимова', summer: 'Літня', 'all-season': 'Всесезонна' };

const CompareModal: React.FC<CompareModalProps> = ({ open, products, categories, loading, onClose, onRemove, onClear, onOpenProduct, onAddToCart, formatPrice }) => {
  if (!open) return null;

  // rows: common info + every characteristic that at least one product has
  const attrFields: AttrField[] = [];
  for (const p of products) {
    const preset = getPresetForProduct(categories, p);
    for (const f of preset?.fields || []) if (!attrFields.some(x => x.key === f.key)) attrFields.push(f);
  }
  const rows: { label: string; value: (p: TyreProduct) => string }[] = [
    { label: 'Ціна', value: p => `${formatPrice(p.price)} грн` },
    { label: 'Бренд', value: p => p.manufacturer || '—' },
    { label: 'Наявність', value: p => (p.in_stock === false ? 'Під замовлення' : 'В наявності') },
    ...(products.some(p => p.width) ? [{ label: 'Розмір', value: (p: TyreProduct) => (p.width ? `${p.width}/${p.height}` : '—') }] : []),
    ...(products.some(p => p.radius) ? [{ label: 'Радіус', value: (p: TyreProduct) => p.radius || '—' }] : []),
    ...(products.some(p => p.season) ? [{ label: 'Сезон', value: (p: TyreProduct) => SEASON[p.season || ''] || '—' }] : []),
    ...attrFields.map(f => ({ label: f.label, value: (p: TyreProduct) => formatAttr(f, p.attributes?.[f.key]) || '—' })),
  ];

  return (
    <div className="fixed inset-0 z-[172] bg-black/85 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-t-3xl md:rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom md:slide-in-from-bottom-8 duration-300" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Порівняння товарів">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-zinc-800">
          <h2 className="text-lg md:text-xl font-black uppercase flex items-center gap-2"><Scale size={20} className="text-[#FFC300]" /> Порівняння</h2>
          <div className="flex items-center gap-2">
            {products.length > 0 && <button onClick={onClear} className="text-xs font-bold text-zinc-400 hover:text-red-400 px-2 py-1">Очистити</button>}
            <button onClick={onClose} className="p-2 rounded-full bg-zinc-800 text-zinc-400 hover:text-white" aria-label="Закрити"><X size={20} /></button>
          </div>
        </div>

        <div className="overflow-auto overscroll-contain flex-1">
          {loading ? (
            <p className="text-center text-zinc-500 py-16">Завантаження…</p>
          ) : products.length === 0 ? (
            <p className="text-center text-zinc-500 py-16 px-4">Додайте товари до порівняння кнопкою <Scale size={14} className="inline" /> на картці товару.</p>
          ) : (
            <table className="w-full text-sm border-collapse min-w-[520px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-zinc-900 w-24 md:w-40" />
                  {products.map(p => (
                    <th key={p.id} className="p-1.5 md:p-3 align-top text-left font-normal min-w-[140px] md:min-w-[180px]">
                      <div className="relative bg-zinc-950 border border-zinc-800 rounded-2xl p-2 flex flex-col gap-2 h-full">
                        <button onClick={() => onRemove(p.id)} className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/60 text-zinc-400 hover:text-red-400 z-10" aria-label="Прибрати з порівняння"><Trash2 size={14} /></button>
                        <button onClick={() => onOpenProduct(p)} className="h-24 md:h-36 rounded-xl bg-zinc-900 overflow-hidden flex items-center justify-center">
                          {p.image_url ? <img src={p.image_url} alt={p.title} className="w-full h-full object-contain" loading="lazy" referrerPolicy="no-referrer" /> : <span className="text-[11px] text-zinc-500 uppercase font-bold">Без фото</span>}
                        </button>
                        <button onClick={() => onOpenProduct(p)} className="text-left text-xs md:text-sm font-bold text-white hover:text-[#FFC300] line-clamp-3 leading-snug">{p.title}</button>
                        <button onClick={() => onAddToCart(p)} disabled={p.in_stock === false}
                          className="mt-auto bg-[#FFC300] hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-600 text-black text-xs font-black uppercase rounded-xl py-2 flex items-center justify-center gap-1.5 transition-colors">
                          <ShoppingCart size={14} /> У кошик
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const values = products.map(row.value);
                  const differs = new Set(values).size > 1;
                  return (
                    <tr key={row.label} className="border-t border-zinc-800">
                      <td className="sticky left-0 z-10 bg-zinc-900 px-2 md:px-3 py-2.5 text-zinc-500 text-[11px] md:text-xs font-bold uppercase tracking-wide">{row.label}</td>
                      {values.map((v, i) => (
                        <td key={i} className={`px-3 py-2.5 ${differs ? 'text-white font-bold' : 'text-zinc-400'} ${row.label === 'Ціна' ? 'text-[#FFC300] font-black' : ''}`}>{v}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <p className="px-4 py-2 text-[11px] text-zinc-500 border-t border-zinc-800">Жирним виділено характеристики, що відрізняються.</p>
      </div>
    </div>
  );
};

export default CompareModal;
