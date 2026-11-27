import React, { useEffect, useState } from 'react';
import { jsonLd } from '../jsonLd';
import { listPhoto } from '../photoUrl';
import { MapPin, Truck, Store, Phone, ChevronRight, HelpCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { CITIES, cityFromPath, cityPath, cityTexts } from '../api/_cities.js';
import { useCategories, getCategoryIcon } from '../categories';
import { linkClick, navigateTo } from '../navigation';
import { productPath } from '../productUrl';
import { catPath } from '../api/_paths.js';
import { PHONE_NUMBER_1, PHONE_LINK_1 } from '../constants';
import type { TyreProduct } from '../types';

const SITE = 'https://www.forsage-tires.com';

/** "Автозапчастини в <місті>": local landing page for Google (the shop in Synelnykove + nearby towns). */
const LocalCityPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => { const f = () => setPath(window.location.pathname); window.addEventListener('popstate', f); return () => window.removeEventListener('popstate', f); }, []);
  const city = cityFromPath(path) || CITIES[0];
  const t = cityTexts(city);
  const { categories } = useCategories();
  const [goods, setGoods] = useState<TyreProduct[]>([]);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    document.title = t.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.description);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', SITE + cityPath(city));
    window.scrollTo({ top: 0 });
  }, [city.slug]);

  useEffect(() => {
    supabase.from('tyres').select('id, title, slug, price, image_url, image_thumb_url').neq('in_stock', false).eq('on_order', false).eq('has_photo', true)
      .order('stock_quantity', { ascending: false }).limit(8).then(({ data }) => setGoods((data as TyreProduct[]) || []));
    supabase.from('tyres').select('id', { count: 'exact', head: true }).neq('in_stock', false).eq('on_order', false).then(({ count }) => setTotal(count ?? null));
  }, []);

  const popular = categories.filter(c => c.parent_id && (c.available || 0) > 0).sort((a, b) => (b.available! - a.available!)).slice(0, 18);
  const ld = {
    '@context': 'https://schema.org', '@type': 'AutoPartsStore', name: 'Форсаж', url: SITE + cityPath(city), telephone: '+380991674424',
    address: { '@type': 'PostalAddress', streetAddress: 'вул. Квітнева, 9', addressLocality: 'Синельникове', addressRegion: 'Дніпропетровська область', postalCode: '52500', addressCountry: 'UA' },
    geo: { '@type': 'GeoCoordinates', latitude: 48.317541, longitude: 35.513511 },
    areaServed: { '@type': 'City', name: city.name },
  };
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: t.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };

  return (
    <article className="max-w-6xl mx-auto px-4 py-6 md:py-10 pb-28 animate-in fade-in duration-300">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqLd)} />
      <nav className="text-xs text-zinc-500 mb-4 flex items-center gap-1"><a href="/" onClick={e => { e.preventDefault(); onBack(); }} className="hover:text-white">Головна</a><ChevronRight size={12} /><span>{t.h1}</span></nav>
      <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter mb-3">{t.h1}</h1>
      <p className="text-zinc-300 max-w-3xl leading-relaxed">{t.intro}</p>
      {total !== null && <p className="text-zinc-500 text-sm mt-2">Зараз у наявності: <b className="text-white">{total}</b> товарів.</p>}

      <div className="grid sm:grid-cols-3 gap-3 my-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex gap-3"><Store className="text-[#FFC300] shrink-0" /><span><b className="block text-white">Самовивіз</b><span className="text-sm text-zinc-400">м. Синельникове, вул. Квітнева, 9</span></span></div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex gap-3"><Truck className="text-[#FFC300] shrink-0" /><span><b className="block text-white">Нова Пошта{city.home ? '' : ` у ${city.to}`}</b><span className="text-sm text-zinc-400">відділення, поштомат або кур'єр</span></span></div>
        <a href={PHONE_LINK_1} className="bg-zinc-900 border border-zinc-800 hover:border-[#FFC300] rounded-2xl p-4 flex gap-3"><Phone className="text-[#FFC300] shrink-0" /><span><b className="block text-white">{PHONE_NUMBER_1}</b><span className="text-sm text-zinc-400">підберемо деталь за телефоном</span></span></a>
      </div>

      {popular.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight mb-3">Що є в наявності</h2>
          <div className="flex flex-wrap gap-2">
            {popular.map(c => {
              const Icon = getCategoryIcon(c.icon || categories.find(p => p.id === c.parent_id)?.icon);
              return (
                <a key={c.id} href={catPath(c.slug)} onClick={linkClick(catPath(c.slug))}
                  className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-[#FFC300] rounded-xl px-3 py-2 text-sm font-bold text-zinc-200">
                  <span className="text-[#FFC300]"><Icon size={16} /></span>{c.name}<span className="text-zinc-500 font-normal text-xs">{c.available}</span>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {goods.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight mb-3">Популярні товари</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {goods.map(p => (
              <a key={p.id} href={productPath(p)} onClick={linkClick(productPath(p))} className="bg-zinc-900 border border-zinc-800 hover:border-[#FFC300] rounded-2xl overflow-hidden">
                <div className="aspect-square bg-white"><img src={listPhoto(p)} alt={p.title} loading="lazy" className="w-full h-full object-contain p-3" /></div>
                <div className="p-3"><p className="text-xs font-bold text-white line-clamp-2 min-h-[2.5em]">{p.title}</p><p className="text-[#FFC300] font-black mt-1">{Math.round(parseFloat(p.price || '0'))} грн</p></div>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight mb-3">Питання та відповіді</h2>
        <div className="space-y-2">
          {t.faq.map(f => (
            <div key={f.q} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="font-bold text-white flex gap-2"><HelpCircle size={18} className="text-[#FFC300] shrink-0" />{f.q}</p>
              <p className="text-zinc-300 text-sm mt-1 ml-7">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1"><MapPin size={14} /> Доставляємо також</h2>
        <div className="flex flex-wrap gap-2">
          {CITIES.filter(c => c.slug !== city.slug).map(c => (
            <a key={c.slug} href={cityPath(c)} onClick={linkClick(cityPath(c))} className="text-sm text-zinc-300 hover:text-[#FFC300] bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">Автозапчастини {c.home ? 'в' : 'в'} {c.in}</a>
          ))}
        </div>
      </section>
      <div className="mt-8"><button onClick={() => navigateTo('/')} className="bg-[#FFC300] hover:bg-white text-black font-black uppercase px-6 py-3 rounded-xl">Перейти в каталог</button></div>
    </article>
  );
};

export default LocalCityPage;
