import React, { useEffect, useState } from 'react';
import { Search, Truck, Store, Wallet, ShieldCheck, Flame, ChevronRight, BookOpen, Star, HelpCircle } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { TyreProduct } from '../../types';
import { ProductCategory, getRootCategories, getCategoryIcon, buildCategoryFilter } from '../../categories';
import { Article, fetchArticles, articlePath, articleExcerpt } from '../../articles';
import { linkClick } from '../../navigation';
import { Stars } from '../shop/ProductReviews';
import SizeGuideModal from './SizeGuideModal';

interface Props {
  categories: ProductCategory[];
  dbReady: boolean;
  sizeOptions: { widths: string[]; heights: string[]; radii: string[] };
  onPickCategory: (id: number | 'hot') => void;
  onSizeSearch: (w: string, h: string, r: string) => void;
  onOpenProduct: (p: TyreProduct) => void;
  formatPrice: (p: string | undefined) => string;
  prepare: (p: TyreProduct) => TyreProduct;
}

const BENEFITS = [
  { icon: Truck, title: 'Доставка по Україні', text: 'Новою Поштою у відділення або поштомат' },
  { icon: Store, title: 'Самовивіз', text: 'м. Синельникове, вул. Квітнева, 9' },
  { icon: Wallet, title: 'Оплата при отриманні', text: 'або передоплата на рахунок' },
  { icon: ShieldCheck, title: 'Гарантія та повернення', text: '14 днів на повернення за законом' },
];

const selectCls = 'w-full bg-black border border-zinc-700 rounded-xl px-3 py-3 text-white font-bold text-sm outline-none focus:border-[#FFC300] appearance-none';

const HomeShowcase: React.FC<Props> = ({ categories, dbReady, sizeOptions, onPickCategory, onSizeSearch, onOpenProduct, formatPrice, prepare }) => {
  const [w, setW] = useState('');
  const [h, setH] = useState('');
  const [r, setR] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [hot, setHot] = useState<TyreProduct[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [reviews, setReviews] = useState<{ id: number; author_name: string; rating: number; body: string | null; tyres?: { title: string } | null }[]>([]);
  const roots = getRootCategories(categories);

  useEffect(() => {
    if (!roots.length) return;
    Promise.all(roots.map(async c => {
      let q = supabase.from('tyres').select('id', { count: 'exact', head: true }).neq('in_stock', false);
      const f = buildCategoryFilter(categories, c, dbReady);
      if (f) q = q.or(f);
      const { count } = await q;
      return [c.id, count || 0] as const;
    })).then(e => setCounts(Object.fromEntries(e)));
  }, [categories.length, dbReady]);

  useEffect(() => {
    supabase.from('tyres').select('*').eq('is_hot', true).neq('in_stock', false).not('image_url', 'is', null).limit(12)
      .then(({ data }) => setHot(((data as TyreProduct[]) || []).map(prepare)));
    fetchArticles(3).then(setArticles);
    supabase.from('product_reviews').select('id, author_name, rating, body, tyres(title)').eq('approved', true).order('created_at', { ascending: false }).limit(3)
      .then(({ data }) => setReviews((data as any) || []));
  }, []);

  return (
    <div className="space-y-8 md:space-y-12 mb-10">
      {/* Quick size search */}
      <section className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-base md:text-xl font-black uppercase tracking-tight">Підбір шин за розміром</h2>
          <button onClick={() => setGuideOpen(true)} className="text-xs font-bold text-[#FFC300] hover:underline flex items-center gap-1"><HelpCircle size={14} /> Як дізнатися розмір?</button>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-[1fr_1fr_1fr_auto] gap-2">
          <select aria-label="Ширина" value={w} onChange={e => setW(e.target.value)} className={selectCls}><option value="">Ширина</option>{sizeOptions.widths.map(v => <option key={v}>{v}</option>)}</select>
          <select aria-label="Висота" value={h} onChange={e => setH(e.target.value)} className={selectCls}><option value="">Висота</option>{sizeOptions.heights.map(v => <option key={v}>{v}</option>)}</select>
          <select aria-label="Радіус" value={r} onChange={e => setR(e.target.value)} className={selectCls}><option value="">Радіус</option>{sizeOptions.radii.filter(x => /^R\d/.test(x)).map(v => <option key={v}>{v}</option>)}</select>
          <button onClick={() => onSizeSearch(w, h, r)} className="col-span-3 md:col-span-1 bg-[#FFC300] hover:bg-white text-black font-black uppercase rounded-xl px-6 py-3 flex items-center justify-center gap-2 transition-colors active:scale-95">
            <Search size={18} /> Знайти шини
          </button>
        </div>
      </section>

      {/* Category tiles */}
      <section>
        <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight mb-3 md:mb-4">Каталог</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
          {roots.map((c, i) => {
            const Icon = getCategoryIcon(c.icon);
            const n = counts[c.id];
            return (
              <button key={c.id} onClick={() => onPickCategory(c.id)}
                className="group relative overflow-hidden text-left bg-zinc-900 border border-zinc-800 hover:border-[#FFC300] rounded-2xl p-4 md:p-5 min-h-[110px] md:min-h-[140px] flex flex-col justify-between transition-all hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-4 duration-500"
                style={{ animationDelay: `${i * 60}ms` }}>
                <Icon size={64} className="absolute -right-3 -bottom-3 text-zinc-800 group-hover:text-[#FFC300]/20 transition-colors" />
                <span className="w-10 h-10 rounded-xl bg-[#FFC300]/10 text-[#FFC300] flex items-center justify-center"><Icon size={20} /></span>
                <span className="relative">
                  <span className="block font-black text-white uppercase text-sm md:text-base leading-tight">{c.name}</span>
                  <span className="block text-xs text-zinc-500 mt-0.5">{n === undefined ? ' ' : n > 0 ? `${n} товарів` : 'Скоро в каталозі'}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Hits & discounts */}
      {hot.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight flex items-center gap-2"><Flame className="text-orange-500" /> Хіти та акції</h2>
            <button onClick={() => onPickCategory('hot')} className="text-sm font-bold text-[#FFC300] hover:underline flex items-center">Усі <ChevronRight size={16} /></button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-3 px-3 snap-x scrollbar-hide fade-edges md:[mask-image:none]">
            {hot.map(p => {
              const old = parseFloat(p.old_price || '0'), price = parseFloat(p.price || '0');
              return (
                <button key={p.id} onClick={() => onOpenProduct(p)} className="snap-start shrink-0 w-[160px] md:w-[200px] text-left bg-zinc-900 border border-zinc-800 hover:border-[#FFC300] rounded-2xl overflow-hidden transition-colors">
                  <div className="aspect-square bg-zinc-950 relative">
                    {p.image_url && <img src={p.image_url} alt={p.title} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                    {old > price && <span className="absolute top-2 left-2 bg-red-600 text-white text-[11px] font-black px-2 py-0.5 rounded-full">−{Math.round((1 - price / old) * 100)}%</span>}
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-bold text-white line-clamp-2 min-h-[2.5em]">{p.title}</p>
                    <p className="mt-1 text-[#FFC300] font-black">{formatPrice(p.price)} <span className="text-zinc-500 text-[11px]">грн</span></p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Benefits */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        {BENEFITS.map(b => (
          <div key={b.title} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-3 md:p-4 flex gap-3 items-start">
            <span className="w-10 h-10 shrink-0 rounded-xl bg-zinc-800 text-[#FFC300] flex items-center justify-center"><b.icon size={20} /></span>
            <span><span className="block text-sm font-black text-white leading-tight">{b.title}</span><span className="block text-xs text-zinc-400 mt-0.5">{b.text}</span></span>
          </div>
        ))}
      </section>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section>
          <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight mb-3 md:mb-4">Відгуки покупців</h2>
          <div className="grid md:grid-cols-3 gap-3">
            {reviews.map(rv => (
              <div key={rv.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-1"><b className="text-white text-sm">{rv.author_name}</b><Stars value={rv.rating} /></div>
                {rv.body && <p className="text-zinc-300 text-sm line-clamp-4">{rv.body}</p>}
                {rv.tyres?.title && <p className="text-zinc-500 text-xs mt-2 line-clamp-1">{rv.tyres.title}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Articles */}
      {articles.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight flex items-center gap-2"><BookOpen className="text-[#FFC300]" /> Корисно знати</h2>
            <a href="/statti" onClick={linkClick('/statti')} className="text-sm font-bold text-[#FFC300] hover:underline flex items-center">Усі статті <ChevronRight size={16} /></a>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {articles.map(a => (
              <a key={a.id} href={articlePath(a)} onClick={linkClick(articlePath(a))} className="group bg-zinc-900 border border-zinc-800 hover:border-[#FFC300] rounded-2xl overflow-hidden transition-colors">
                {a.image_url && <div className="aspect-[16/9] bg-zinc-950 overflow-hidden"><img src={a.image_url} alt={a.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /></div>}
                <div className="p-4">
                  <h3 className="font-black text-white leading-snug group-hover:text-[#FFC300] transition-colors">{a.title}</h3>
                  <p className="text-zinc-400 text-sm mt-1 line-clamp-2">{articleExcerpt(a.content, 120)}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight -mb-4 md:-mb-6">Усі товари</h2>
      <SizeGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
};

export default HomeShowcase;
