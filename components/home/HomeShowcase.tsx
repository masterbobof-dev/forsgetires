import React, { useEffect, useState } from 'react';
import { Search, Truck, Store, Wallet, ShieldCheck, Flame, ChevronRight, ChevronLeft, BookOpen, HelpCircle, Percent } from 'lucide-react';
import { useSitePromos, fetchBanners, fetchHomeBlocks, SiteBanner, HomeBlockType, DEFAULT_HOME_BLOCKS } from '../../sitePromos';
import { navigateTo } from '../../navigation';
import { supabase } from '../../supabaseClient';
import { TyreProduct } from '../../types';
import { ProductCategory, getRootCategories, getCategoryIcon } from '../../categories';
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
  const [hotIsPicked, setHotIsPicked] = useState(true);
  const [hot, setHot] = useState<TyreProduct[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [reviews, setReviews] = useState<{ id: number; author_name: string; rating: number; body: string | null; tyres?: { title: string } | null }[]>([]);
  const roots = getRootCategories(categories);
  const [blocks, setBlocks] = useState<{ type: HomeBlockType; title?: string }[]>(DEFAULT_HOME_BLOCKS.map(type => ({ type })));
  const [banners, setBanners] = useState<SiteBanner[]>([]);
  const { promos } = useSitePromos();
  useEffect(() => { fetchHomeBlocks().then(setBlocks); fetchBanners().then(setBanners); }, []);

  useEffect(() => {
    // hits with photos; if there are few, add goods in stock with photos (biggest stock first)
    (async () => {
      const { data: hits } = await supabase.from('tyres').select('*').eq('is_hot', true).neq('in_stock', false).eq('on_order', false).eq('has_photo', true).limit(12);
      let list = (hits as TyreProduct[]) || [];
      setHotIsPicked(list.length >= 4);
      if (list.length < 12) {
        const { data: more } = await supabase.from('tyres').select('*').neq('in_stock', false).eq('on_order', false).eq('has_photo', true)
          .not('id', 'in', `(${list.map(p => p.id).join(',') || 0})`).order('stock_quantity', { ascending: false }).limit(12 - list.length);
        list = [...list, ...((more as TyreProduct[]) || [])];
      }
      setHot(list.map(prepare));
    })();
    fetchArticles(3).then(setArticles);
    supabase.from('product_reviews').select('id, author_name, rating, body, tyres(title)').eq('approved', true).order('created_at', { ascending: false }).limit(3)
      .then(({ data }) => setReviews((data as any) || []));
  }, []);

  const linkTo = (href?: string | null) => (e: React.MouseEvent) => {
    if (!href) return;
    if (/^https?:\/\//.test(href) && !href.includes('forsage-tires.com')) return; // external: normal link
    e.preventDefault();
    navigateTo(href.replace(/^https?:\/\/(www\.)?forsage-tires\.com/, '') || '/');
  };

  const sections: Record<HomeBlockType, React.ReactNode> = {
    banners: banners.length > 0 ? <BannerSlider banners={banners} linkTo={linkTo} /> : null,
    size_search: categories.some(c => c.kind === 'tyre') && <>
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

      </>,
    categories: <>
      {/* Category tiles */}
      <section>
        <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight mb-3 md:mb-4">Каталог</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
          {roots.map((c, i) => {
            const Icon = getCategoryIcon(c.icon);
            const n = c.available;
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
      {/* Popular sections: the biggest subcategories */}
      {(() => {
        const subs = categories.filter(c => c.parent_id && (c.available || 0) > 0).sort((a, b) => (b.available! - a.available!)).slice(0, 16);
        if (subs.length < 4) return null;
        return (
          <section>
            <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight mb-3 md:mb-4">Популярні розділи</h2>
            <div className="flex flex-wrap gap-2">
              {subs.map(c => {
                const Icon = getCategoryIcon(c.icon || categories.find(p => p.id === c.parent_id)?.icon);
                return (
                  <button key={c.id} onClick={() => onPickCategory(c.id)}
                    className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-[#FFC300] hover:text-[#FFC300] rounded-xl px-3 py-2 text-sm font-bold text-zinc-200 transition-colors">
                    <span className="text-[#FFC300]"><Icon size={16} /></span>{c.name}<span className="text-zinc-500 font-normal text-xs">{c.available}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })()}

      </>,
    hits: <>
      {/* Hits & discounts */}
      {hot.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight flex items-center gap-2"><Flame className="text-orange-500" /> {hotIsPicked ? 'Хіти та акції' : 'Рекомендуємо'}</h2>
            {hotIsPicked && <button onClick={() => onPickCategory('hot')} className="text-sm font-bold text-[#FFC300] hover:underline flex items-center">Усі <ChevronRight size={16} /></button>}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-3 px-3 snap-x scrollbar-hide fade-edges md:[mask-image:none]">
            {hot.map(p => {
              const old = parseFloat(p.old_price || '0'), price = parseFloat(p.price || '0');
              return (
                <button key={p.id} onClick={() => onOpenProduct(p)} className="snap-start shrink-0 w-[160px] md:w-[200px] text-left bg-zinc-900 border border-zinc-800 hover:border-[#FFC300] rounded-2xl overflow-hidden transition-colors">
                  <div className="aspect-square bg-white relative">
                    {p.image_url && <img src={p.image_thumb_url || p.image_url} alt={p.title} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-contain p-3 mix-blend-multiply" />}
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

      </>,
    promos: promos.length > 0 ? (
      <section>
        <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight mb-3 md:mb-4 flex items-center gap-2"><Percent className="text-red-500" /> Акції</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {promos.map(pr => {
            const cat = pr.target_type === 'category' ? categories.find(c => pr.target_ids.includes(String(c.id))) : undefined;
            return (
              <button key={pr.id} onClick={() => onPickCategory(cat ? cat.id : 'hot')} className="text-left bg-gradient-to-br from-red-600/20 to-zinc-900 border border-red-500/30 hover:border-red-400 rounded-2xl p-4 transition-colors">
                <span className="inline-block bg-red-600 text-white text-xs font-black px-2 py-0.5 rounded-full mb-2">{pr.badge_text || `−${Math.round(pr.discount_percent)}%`}</span>
                <span className="block font-black text-white leading-tight">{pr.title}</span>
                {pr.ends_at && <span className="block text-xs text-zinc-400 mt-1">до {new Date(pr.ends_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}</span>}
              </button>
            );
          })}
        </div>
      </section>
    ) : null,
    benefits: <>
      {/* Benefits */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        {BENEFITS.map(b => (
          <div key={b.title} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-3 md:p-4 flex gap-3 items-start">
            <span className="w-10 h-10 shrink-0 rounded-xl bg-zinc-800 text-[#FFC300] flex items-center justify-center"><b.icon size={20} /></span>
            <span><span className="block text-sm font-black text-white leading-tight">{b.title}</span><span className="block text-xs text-zinc-400 mt-0.5">{b.text}</span></span>
          </div>
        ))}
      </section>

      </>,
    reviews: <>
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

      </>,
    articles: <>
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

      </>,
  };

  return (
    <div className="space-y-8 md:space-y-12 mb-10">
      {blocks.map(b => <React.Fragment key={b.type}>{sections[b.type]}</React.Fragment>)}
      <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight -mb-4 md:-mb-6">Усі товари</h2>
      <SizeGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
};

/** Banners from the program: swipe / arrows, auto-advance every 6 s. */
const BannerSlider: React.FC<{ banners: SiteBanner[]; linkTo: (href?: string | null) => (e: React.MouseEvent) => void }> = ({ banners, linkTo }) => {
  const [i, setI] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);
  const n = banners.length;
  useEffect(() => {
    if (n < 2) return;
    const t = setInterval(() => setI(v => (v + 1) % n), 6000);
    return () => clearInterval(t);
  }, [n, i]);
  const go = (d: number) => setI(v => (v + d + n) % n);
  return (
    <section className="relative rounded-3xl overflow-hidden bg-zinc-900 border border-zinc-800 animate-in fade-in duration-500"
      onTouchStart={e => setTouchX(e.touches[0].clientX)}
      onTouchEnd={e => { if (touchX === null) return; const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); setTouchX(null); }}>
      <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
        {banners.map((b, k) => (
          <a key={b.id} href={b.link || undefined} onClick={linkTo(b.link)} className="relative shrink-0 w-full block aspect-[4/3] sm:aspect-[16/6] md:aspect-[16/5]" aria-hidden={k !== i} tabIndex={k === i ? 0 : -1}>
            <picture>
              {b.image_mobile_url && <source media="(max-width: 639px)" srcSet={b.image_mobile_url} />}
              <img src={b.image_url} alt={b.title || 'Акція'} className="absolute inset-0 w-full h-full object-cover" loading={k === 0 ? 'eager' : 'lazy'} />
            </picture>
            {(b.title || b.subtitle || b.button_text) && (
              <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-transparent flex flex-col justify-end sm:justify-center p-5 md:p-10 gap-2">
                {b.title && <span className="text-2xl md:text-4xl font-black text-white uppercase italic tracking-tight max-w-xl leading-none">{b.title}</span>}
                {b.subtitle && <span className="text-sm md:text-lg text-zinc-200 max-w-lg">{b.subtitle}</span>}
                {b.button_text && <span className="mt-1 self-start bg-[#FFC300] text-black font-black uppercase text-xs md:text-sm px-4 py-2.5 rounded-xl">{b.button_text}</span>}
              </div>
            )}
          </a>
        ))}
      </div>
      {n > 1 && (
        <>
          <button onClick={() => go(-1)} aria-label="Попередній банер" className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white items-center justify-center"><ChevronLeft /></button>
          <button onClick={() => go(1)} aria-label="Наступний банер" className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white items-center justify-center"><ChevronRight /></button>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {banners.map((b, k) => <button key={b.id} onClick={() => setI(k)} aria-label={`Банер ${k + 1}`} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-6 bg-[#FFC300]' : 'w-1.5 bg-white/50'}`} />)}
          </div>
        </>
      )}
    </section>
  );
};

export default HomeShowcase;
