import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Loader2, Calendar } from 'lucide-react';
import { Article, fetchArticles, articlePath, articleExcerpt, articleIdFromPath } from '../articles';
import { linkClick } from '../navigation';

/** Article text is stored as plain text: blank lines separate paragraphs, short lines without a full stop are headings. */
export const ArticleBody: React.FC<{ content: string }> = ({ content }) => {
  const blocks = content.replace(/\r/g, '').split(/\n{2,}|\n(?=[А-ЯІЇЄA-Z💡])/).map(b => b.trim()).filter(Boolean);
  return (
    <div className="space-y-4 text-zinc-300 leading-relaxed text-base">
      {blocks.map((b, i) => {
        const isHeading = b.length < 80 && !/[.!?:]$/.test(b) && !b.includes('\n');
        return isHeading
          ? <h2 key={i} className="text-xl font-black text-white pt-2">{b}</h2>
          : <p key={i} className="whitespace-pre-line">{b}</p>;
      })}
    </div>
  );
};

const ArticlesPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [current, setCurrent] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState(() => articleIdFromPath());
  useEffect(() => {
    const onPop = () => setId(articleIdFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchArticles().then(list => {
      setArticles(list);
      setCurrent(id ? list.find(a => a.id === id) || null : null);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    const title = current ? `${current.title} — Форсаж` : 'Корисно знати: статті про шини та диски — Форсаж';
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', current ? articleExcerpt(current.content, 160) : 'Поради про вибір, зберігання та обслуговування шин і дисків від магазину «Форсаж».');
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `https://www.forsage-tires.com${current ? articlePath(current) : '/statti'}`);
    window.scrollTo({ top: 0 });
  }, [current?.id]);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-[#FFC300]" size={40} /></div>;

  if (current) {
    const others = articles.filter(a => a.id !== current.id).slice(0, 3);
    const ld = {
      '@context': 'https://schema.org', '@type': 'Article', headline: current.title,
      image: current.image_url ? [current.image_url] : undefined, datePublished: current.created_at,
      author: { '@type': 'Organization', name: 'Форсаж' }, publisher: { '@type': 'Organization', name: 'Форсаж' },
      mainEntityOfPage: `https://www.forsage-tires.com${articlePath(current)}`,
    };
    return (
      <article className="max-w-3xl mx-auto px-4 py-6 md:py-12 pb-28 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
        <a href="/statti" onClick={linkClick('/statti')} className="text-zinc-500 hover:text-[#FFC300] text-xs font-black uppercase tracking-widest flex items-center gap-1 mb-6"><ArrowLeft size={14} /> Усі статті</a>
        <h1 className="text-2xl md:text-4xl font-black tracking-tight mb-3 leading-tight">{current.title}</h1>
        <p className="text-zinc-500 text-sm flex items-center gap-1.5 mb-6"><Calendar size={14} /> {new Date(current.created_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        {current.image_url && <img src={current.image_url} alt={current.title} className="w-full rounded-2xl mb-6 max-h-[420px] object-cover" />}
        <ArticleBody content={current.content} />
        <div className="mt-10 p-5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-white font-bold">Потрібна порада з вибором? Подзвоніть — підберемо.</p>
          <button onClick={onBack} className="bg-[#FFC300] text-black font-black px-5 py-3 rounded-xl uppercase text-sm">До каталогу</button>
        </div>
        {others.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-black uppercase mb-3">Читайте також</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {others.map(a => (
                <a key={a.id} href={articlePath(a)} onClick={linkClick(articlePath(a))} className="bg-zinc-900 border border-zinc-800 hover:border-[#FFC300] rounded-2xl p-4 transition-colors">
                  <p className="font-bold text-white text-sm leading-snug">{a.title}</p>
                </a>
              ))}
            </div>
          </section>
        )}
      </article>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-12 pb-28 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <button onClick={onBack} className="text-zinc-500 hover:text-[#FFC300] text-xs font-black uppercase tracking-widest flex items-center gap-1 mb-6"><ArrowLeft size={14} /> До каталогу</button>
      <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter mb-2 flex items-center gap-3"><BookOpen className="text-[#FFC300]" size={36} /> Корисно знати</h1>
      <p className="text-zinc-400 mb-8">Поради про вибір, зберігання та обслуговування шин і дисків.</p>
      {articles.length === 0 ? <p className="text-zinc-500">Статей поки немає.</p> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((a, i) => (
            <a key={a.id} href={articlePath(a)} onClick={linkClick(articlePath(a))} className="group bg-zinc-900 border border-zinc-800 hover:border-[#FFC300] rounded-2xl overflow-hidden transition-colors animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${i * 50}ms` }}>
              {a.image_url && <div className="aspect-[16/9] bg-zinc-950 overflow-hidden"><img src={a.image_url} alt={a.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /></div>}
              <div className="p-4">
                <h2 className="font-black text-white leading-snug group-hover:text-[#FFC300] transition-colors">{a.title}</h2>
                <p className="text-zinc-400 text-sm mt-2 line-clamp-3">{articleExcerpt(a.content, 160)}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArticlesPage;
