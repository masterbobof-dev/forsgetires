import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MessageSquare, Plus, Pin, Eye, ImagePlus, Loader2, X, Send, EyeOff, Store } from 'lucide-react';
import type { AuthState } from '../../useAuth';
import { linkClick, navigateTo } from '../../navigation';
import {
  FORUM_CATEGORIES, forumCategoryName, forumPath, forumRoute, fetchTopics, fetchTopic, createTopic, createPost,
  uploadForumImage, setHidden, type ForumTopic, type ForumPost,
} from '../../forum';

const when = (iso: string) => new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });

/** Text of a message: paragraphs and line breaks, links are not clickable (no spam). */
const Body: React.FC<{ text: string }> = ({ text }) => (
  <div className="space-y-3 text-zinc-300 leading-relaxed">
    {text.replace(/\r/g, '').split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line break-words">{p}</p>)}
  </div>
);

const Photos: React.FC<{ urls: string[] }> = ({ urls }) => urls.length ? (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
    {urls.map(u => (
      <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800">
        <img src={u} alt="Фото до повідомлення" loading="lazy" className="w-full h-full object-cover" />
      </a>
    ))}
  </div>
) : null;

const Author: React.FC<{ name: string; shop: boolean; date: string }> = ({ name, shop, date }) => (
  <div className="flex items-center gap-2 text-xs text-zinc-500">
    <span className={`font-bold flex items-center gap-1 ${shop ? 'text-[#FFC300]' : 'text-zinc-300'}`}>{shop && <Store size={13} />}{name}</span>
    <span>· {when(date)}</span>
  </div>
);

/** Text + up to 6 photos; used for a new topic and for a reply. */
const Composer: React.FC<{
  auth: AuthState; withTitle?: boolean; submitLabel: string;
  onSubmit: (v: { title: string; category: string; body: string; images: string[] }) => Promise<void>;
}> = ({ auth, withTitle, submitLabel, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('shyny');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState<'' | 'photo' | 'send'>('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const userId = auth.session?.user?.id as string | undefined;

  if (!userId) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center space-y-3">
        <p className="text-zinc-300">Щоб писати на форумі, увійдіть або зареєструйтеся — це безкоштовно.</p>
        <div className="flex gap-2 justify-center">
          <button onClick={() => auth.openAuthModal('login')} className="h-11 px-5 rounded-xl bg-[#FFC300] text-black font-black text-sm">Увійти</button>
          <button onClick={() => auth.openAuthModal('register')} className="h-11 px-5 rounded-xl border border-zinc-700 text-white font-bold text-sm">Реєстрація</button>
        </div>
      </div>
    );
  }
  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy('photo'); setError('');
    try {
      for (const f of Array.from(files).slice(0, 6 - images.length)) {
        const url = await uploadForumImage(f, userId);
        setImages(prev => [...prev, url]);
      }
    } catch { setError('Не вдалося завантажити фото. Спробуйте інше (JPG або PNG до 5 МБ).'); }
    setBusy('');
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (withTitle && title.trim().length < 5) return setError('Напишіть заголовок (хоча б 5 літер).');
    if (body.trim().length < (withTitle ? 10 : 2)) return setError('Напишіть текст повідомлення.');
    setBusy('send'); setError('');
    try {
      await onSubmit({ title: title.trim(), category, body: body.trim(), images });
      setTitle(''); setBody(''); setImages([]);
    } catch (err: any) { setError(err?.message?.includes('Забагато') ? err.message : 'Не вдалося надіслати. Спробуйте ще раз.'); }
    setBusy('');
  };
  return (
    <form onSubmit={send} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-5 space-y-3">
      {withTitle && <>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={150} placeholder="Заголовок теми, напр. «Які шини взяти на Ланос?»"
          className="w-full h-12 bg-black border border-zinc-700 rounded-xl px-4 text-white font-bold outline-none focus:border-[#FFC300]" />
        <div className="flex flex-wrap gap-1.5">
          {FORUM_CATEGORIES.map(c => (
            <button type="button" key={c.id} onClick={() => setCategory(c.id)}
              className={`px-3 h-9 rounded-lg text-xs font-bold border ${category === c.id ? 'bg-[#FFC300] text-black border-[#FFC300]' : 'border-zinc-700 text-zinc-300'}`}>{c.name}</button>
          ))}
        </div>
      </>}
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={withTitle ? 6 : 4} maxLength={withTitle ? 10000 : 5000}
        placeholder={withTitle ? 'Опишіть питання або поділіться порадою' : 'Ваша відповідь'}
        className="w-full bg-black border border-zinc-700 rounded-xl p-4 text-white outline-none focus:border-[#FFC300]" />
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map(u => (
            <span key={u} className="relative w-20 h-20 rounded-lg overflow-hidden border border-zinc-700">
              <img src={u} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setImages(prev => prev.filter(x => x !== u))} aria-label="Прибрати фото"
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center"><X size={14} /></button>
            </span>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { addPhotos(e.target.files); e.target.value = ''; }} />
        <button type="button" disabled={!!busy || images.length >= 6} onClick={() => fileRef.current?.click()}
          className="h-11 px-4 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-bold flex items-center gap-2 disabled:opacity-40">
          {busy === 'photo' ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />} Фото
        </button>
        <button type="submit" disabled={!!busy}
          className="ml-auto h-11 px-5 rounded-xl bg-[#FFC300] text-black font-black text-sm flex items-center gap-2 disabled:opacity-50">
          {busy === 'send' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {submitLabel}
        </button>
      </div>
    </form>
  );
};

const ForumPage: React.FC<{ auth: AuthState; isStaff: boolean; onBack: () => void }> = ({ auth, isStaff, onBack }) => {
  const [route, setRoute] = useState(() => forumRoute());
  const [category, setCategory] = useState<string | null>(() => new URLSearchParams(window.location.search).get('c'));
  const [topics, setTopics] = useState<ForumTopic[] | null>(null);
  const [topic, setTopic] = useState<ForumTopic | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onPop = () => { setRoute(forumRoute()); setCategory(new URLSearchParams(window.location.search).get('c')); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const load = async () => {
    setLoading(true); setFailed(false);
    try {
      if (typeof route === 'number') {
        const r = await fetchTopic(route);
        setTopic(r.topic); setPosts(r.posts);
        if (r.topic) document.title = `${r.topic.title} — форум «Форсаж»`;
      } else if (route === null) {
        setTopics(await fetchTopics(category));
        document.title = 'Форум автомобілістів: шини, диски, ремонт — «Форсаж»';
      }
    } catch { setFailed(true); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [route, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = (
    <button onClick={() => (route === null ? onBack() : navigateTo('/forum'))} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-bold mb-4">
      <ArrowLeft size={18} /> {route === null ? 'До магазину' : 'Усі теми'}
    </button>
  );
  const moderate = async (table: 'forum_topics' | 'forum_posts', id: number, hidden: boolean) => {
    try { await setHidden(table, id, hidden); await load(); } catch { alert('Не вдалося змінити'); }
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-3 md:px-4 py-6 md:py-10 min-h-screen">
      {back}
      {route === 'new' ? (
        <>
          <h1 className="text-2xl md:text-3xl font-black uppercase mb-4">Нова тема</h1>
          <Composer auth={auth} withTitle submitLabel="Опублікувати" onSubmit={async v => {
            const t = await createTopic({ category: v.category, title: v.title, body: v.body, images: v.images });
            navigateTo(forumPath(t));
          }} />
        </>
      ) : loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#FFC300]" size={40} /></div>
      ) : failed ? (
        <p className="text-zinc-400 py-10 text-center">Не вдалося завантажити форум. <button onClick={load} className="text-[#FFC300] font-bold">Спробувати ще раз</button></p>
      ) : typeof route === 'number' ? (
        !topic ? <p className="text-zinc-400 py-10 text-center">Тему не знайдено або її приховано.</p> : (
          <article className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-6">
              <a href={`/forum?c=${topic.category}`} onClick={linkClick(`/forum?c=${topic.category}`)} className="text-xs font-bold text-[#FFC300] uppercase">{forumCategoryName(topic.category)}</a>
              <h1 className="text-xl md:text-3xl font-black text-white mt-1 mb-3 break-words">{topic.title}</h1>
              <Author name={topic.author_name} shop={topic.is_shop} date={topic.created_at} />
              <div className="mt-4"><Body text={topic.body} /></div>
              <Photos urls={topic.images} />
              {isStaff && (
                <button onClick={() => moderate('forum_topics', topic.id, !topic.is_hidden)} className="mt-4 text-xs font-bold text-red-400 flex items-center gap-1">
                  <EyeOff size={14} /> {topic.is_hidden ? 'Показати тему' : 'Сховати тему'}
                </button>
              )}
            </div>
            <h2 className="text-lg font-black uppercase pt-2">Відповіді ({posts.filter(p => !p.is_hidden).length})</h2>
            {posts.map(p => (
              <div key={p.id} className={`border rounded-2xl p-4 ${p.is_shop ? 'bg-[#FFC300]/5 border-[#FFC300]/30' : 'bg-zinc-900/60 border-zinc-800'} ${p.is_hidden ? 'opacity-50' : ''}`}>
                <Author name={p.author_name} shop={p.is_shop} date={p.created_at} />
                <div className="mt-2"><Body text={p.body} /></div>
                <Photos urls={p.images} />
                {isStaff && (
                  <button onClick={() => moderate('forum_posts', p.id, !p.is_hidden)} className="mt-2 text-xs font-bold text-red-400 flex items-center gap-1">
                    <EyeOff size={14} /> {p.is_hidden ? 'Показати' : 'Сховати'}
                  </button>
                )}
              </div>
            ))}
            <Composer auth={auth} submitLabel="Відповісти" onSubmit={async v => { await createPost({ topic_id: topic.id, body: v.body, images: v.images }); await load(); }} />
          </article>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h1 className="text-2xl md:text-4xl font-black uppercase">Форум автомобілістів</h1>
              <p className="text-zinc-400 text-sm mt-1">Питайте, діліться досвідом і порадами: шини, диски, акумулятори, ремонт.</p>
            </div>
            <a href="/forum/new" onClick={linkClick('/forum/new')} className="h-11 px-4 rounded-xl bg-[#FFC300] text-black font-black text-sm flex items-center gap-2"><Plus size={18} /> Нова тема</a>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {[{ id: '', name: 'Усі' }, ...FORUM_CATEGORIES].map(c => {
              const href = c.id ? `/forum?c=${c.id}` : '/forum';
              const active = (category || '') === c.id;
              return <a key={c.id || 'all'} href={href} onClick={linkClick(href)} className={`px-3 h-9 rounded-lg text-xs font-bold border flex items-center ${active ? 'bg-[#FFC300] text-black border-[#FFC300]' : 'border-zinc-800 text-zinc-300 hover:border-zinc-600'}`}>{c.name}</a>;
            })}
          </div>
          {!topics?.length ? <p className="text-zinc-400 py-10 text-center">Тут поки немає тем. Станьте першим!</p> : (
            <ul className="space-y-2">
              {topics.map(t => (
                <li key={t.id}>
                  <a href={forumPath(t)} onClick={linkClick(forumPath(t))}
                    className={`block bg-zinc-900 border rounded-2xl p-4 hover:border-[#FFC300] transition-colors ${t.is_pinned ? 'border-[#FFC300]/40' : 'border-zinc-800'} ${t.is_hidden ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-zinc-500 mb-1">
                      {t.is_pinned && <Pin size={12} className="text-[#FFC300]" />}<span className="text-[#FFC300]">{forumCategoryName(t.category)}</span>
                    </div>
                    <h2 className="text-base md:text-lg font-bold text-white leading-snug break-words">{t.title}</h2>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-zinc-500">
                      <span className={t.is_shop ? 'text-[#FFC300] font-bold' : ''}>{t.author_name}</span>
                      <span className="flex items-center gap-1"><MessageSquare size={13} /> {t.replies_count}</span>
                      <span className="flex items-center gap-1"><Eye size={13} /> {t.views}</span>
                      <span>{when(t.last_reply_at)}</span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default ForumPage;
