import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, MessageSquare, Plus, Pin, Eye, Loader2, EyeOff, Lock, Unlock, Pencil, Trash2, ChevronRight, Search, MessagesSquare,
} from 'lucide-react';
import type { AuthState } from '../../useAuth';
import { linkClick, navigateTo } from '../../navigation';
import {
  forumPath, forumRoute, fetchSections, fetchSectionStats, fetchTopics, fetchTopic, createTopic, createPost, updateTopic, updatePost,
  deleteTopic, deletePost, fetchOwnIds, rootSections, childSections, sectionChain, sectionSlugs, sectionName,
  type ForumSection, type ForumTopic, type ForumPost,
} from '../../forum';
import { Body, Photos, Author, Avatar, AvatarPicker, MessageForm, when, whenShort } from './forumParts';

const sectionHref = (slug: string) => `/forum?c=${slug}`;

/** "Форум › Шини › Зимові шини" */
const Crumbs: React.FC<{ chain: ForumSection[] }> = ({ chain }) => (
  <nav className="flex flex-wrap items-center gap-1 text-xs font-bold text-zinc-500 mb-3">
    <a href="/forum" onClick={linkClick('/forum')} className="hover:text-white">Форум</a>
    {chain.map(s => (
      <React.Fragment key={s.id}><ChevronRight size={12} /><a href={sectionHref(s.slug)} onClick={linkClick(sectionHref(s.slug))} className="hover:text-white">{s.name}</a></React.Fragment>
    ))}
  </nav>
);

type Stats = Record<string, { topics: number; replies: number; last: string | null }>;
const sumStats = (stats: Stats, slugs: string[]) => slugs.reduce((a, s) => {
  const x = stats[s]; if (!x) return a;
  return { topics: a.topics + x.topics, replies: a.replies + x.replies, last: !a.last || (x.last && x.last > a.last) ? x.last : a.last };
}, { topics: 0, replies: 0, last: null as string | null });

/** A row of a section in the list: name, description, topics/replies, last activity. */
const SectionRow: React.FC<{ s: ForumSection; all: ForumSection[]; stats: Stats }> = ({ s, all, stats }) => {
  const st = sumStats(stats, sectionSlugs(all, s.slug));
  return (
    <a href={sectionHref(s.slug)} onClick={linkClick(sectionHref(s.slug))} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-colors">
      <MessagesSquare size={20} className="text-[#FFC300] shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-white">{s.name}</span>
        {s.description && <span className="block text-xs text-zinc-500 truncate">{s.description}</span>}
      </span>
      <span className="text-right text-[11px] text-zinc-500 shrink-0 leading-tight">
        <span className="block"><b className="text-zinc-300">{st.topics}</b> тем · <b className="text-zinc-300">{st.replies}</b> відп.</span>
        {st.last && <span className="block">{whenShort(st.last)}</span>}
      </span>
    </a>
  );
};

const TopicRow: React.FC<{ t: ForumTopic; all: ForumSection[]; showSection?: boolean }> = ({ t, all, showSection }) => (
  <li>
    <a href={forumPath(t)} onClick={linkClick(forumPath(t))}
      className={`block bg-zinc-900 border rounded-2xl p-4 hover:border-[#FFC300] transition-colors ${t.is_pinned ? 'border-[#FFC300]/40' : 'border-zinc-800'} ${t.is_hidden ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-zinc-500 mb-1">
        {t.is_pinned && <span className="flex items-center gap-1 text-[#FFC300]"><Pin size={12} /> Закріплено</span>}
        {t.is_locked && <span className="flex items-center gap-1"><Lock size={12} /> Закрито</span>}
        {t.is_hidden && <span className="flex items-center gap-1 text-red-400"><EyeOff size={12} /> Приховано</span>}
        {showSection && <span className="text-[#FFC300]">{sectionName(all, t.category)}</span>}
      </div>
      <h3 className="text-base md:text-lg font-bold text-white leading-snug break-words">{t.title}</h3>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-zinc-500">
        <span className={`flex items-center gap-1.5 ${t.is_shop ? 'text-[#FFC300] font-bold' : ''}`}><Avatar name={t.author_name} avatar={t.author_avatar} shop={t.is_shop} size={20} />{t.author_name}</span>
        <span className="flex items-center gap-1"><MessageSquare size={13} /> {t.replies_count}</span>
        <span className="flex items-center gap-1"><Eye size={13} /> {t.views}</span>
        <span>{when(t.last_reply_at)}</span>
      </div>
    </a>
  </li>
);

/** Small action button of the shop's tools. */
const Tool: React.FC<{ onClick: () => void; icon: React.ReactNode; label: string; danger?: boolean }> = ({ onClick, icon, label, danger }) => (
  <button onClick={onClick} className={`h-9 px-3 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${danger ? 'border-red-900 text-red-400 hover:bg-red-950/40' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}>{icon}{label}</button>
);

const ForumPage: React.FC<{ auth: AuthState; isStaff: boolean; onBack: () => void }> = ({ auth, isStaff, onBack }) => {
  const [route, setRoute] = useState(() => forumRoute());
  const [section, setSection] = useState<string | null>(() => new URLSearchParams(window.location.search).get('c'));
  const [sections, setSections] = useState<ForumSection[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [topics, setTopics] = useState<ForumTopic[] | null>(null);
  const [topic, setTopic] = useState<ForumTopic | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [own, setOwn] = useState<{ topic: boolean; posts: Set<number> }>({ topic: false, posts: new Set() });
  const [editing, setEditing] = useState<'topic' | number | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const userId = auth.session?.user?.id as string | undefined;

  useEffect(() => {
    const onPop = () => { setRoute(forumRoute()); setSection(new URLSearchParams(window.location.search).get('c')); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setFailed(false); setEditing(null);
    try {
      const all = await fetchSections();
      setSections(all);
      if (typeof route === 'number') {
        const r = await fetchTopic(route, !quiet);
        setTopic(r.topic); setPosts(r.posts);
        setOwn(await fetchOwnIds(userId, route));
        if (r.topic) document.title = `${r.topic.title} — форум «Форсаж»`;
      } else if (route === null) {
        const [list, st] = await Promise.all([
          fetchTopics({ slugs: section ? sectionSlugs(all, section) : null, limit: section ? 100 : 15 }),
          fetchSectionStats(),
        ]);
        setTopics(list); setStats(st);
        const cur = all.find(s => s.slug === section);
        document.title = cur ? `${cur.name} — форум «Форсаж»` : 'Форум автомобілістів: шини, диски, ремонт — «Форсаж»';
      }
    } catch { setFailed(true); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [route, section, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn: () => Promise<void>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    try { await fn(); await load(true); } catch { alert('Не вдалося зберегти зміни. Спробуйте ще раз.'); }
  };

  const current = sections.find(s => s.slug === section) || null;
  // search over all topics (title), a moment after typing stops
  const [searchResults, setSearchResults] = useState<ForumTopic[] | null>(null);
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setSearchResults(null); return; }
    const t = setTimeout(() => { fetchTopics({ search: q, limit: 50 }).then(setSearchResults, () => setSearchResults([])); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const back = (
    <button onClick={() => (route === null && !section ? onBack() : window.history.length > 1 ? window.history.back() : navigateTo('/forum'))}
      className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-bold mb-4">
      <ArrowLeft size={18} /> {route === null && !section ? 'До магазину' : 'Назад'}
    </button>
  );
  const newTopicHref = `/forum/new${section ? `?c=${section}` : ''}`;
  const newTopicButton = (
    <a href={newTopicHref} onClick={linkClick(newTopicHref)} className="h-11 px-4 rounded-xl bg-[#FFC300] text-black font-black text-sm flex items-center gap-2 shrink-0"><Plus size={18} /> Нова тема</a>
  );
  const loginBox = (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center space-y-3">
      <p className="text-zinc-300">Щоб писати на форумі, увійдіть або зареєструйтеся — це безкоштовно.</p>
      <div className="flex gap-2 justify-center">
        <button onClick={() => auth.openAuthModal('login')} className="h-11 px-5 rounded-xl bg-[#FFC300] text-black font-black text-sm">Увійти</button>
        <button onClick={() => auth.openAuthModal('register')} className="h-11 px-5 rounded-xl border border-zinc-700 text-white font-bold text-sm">Реєстрація</button>
      </div>
    </div>
  );

  let content: React.ReactNode;
  if (route === 'new') {
    const pre = new URLSearchParams(window.location.search).get('c') || undefined;
    content = (
      <>
        <Crumbs chain={sectionChain(sections, pre)} />
        <h1 className="text-2xl md:text-3xl font-black uppercase mb-4">Нова тема</h1>
        {!userId ? loginBox : sections.length === 0 ? <Loader2 className="animate-spin text-[#FFC300]" /> : (
          <MessageForm userId={userId} sections={sections} topic allowPin={isStaff} initial={pre ? { category: pre } : undefined} submitLabel="Опублікувати"
            onSubmit={async v => { const t = await createTopic({ category: v.category, title: v.title, body: v.body, images: v.images, ...(isStaff ? { is_pinned: v.is_pinned } : {}) }); navigateTo(forumPath(t)); }} />
        )}
      </>
    );
  } else if (loading) {
    content = <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#FFC300]" size={40} /></div>;
  } else if (failed) {
    content = <p className="text-zinc-400 py-10 text-center">Не вдалося завантажити форум. <button onClick={() => load()} className="text-[#FFC300] font-bold">Спробувати ще раз</button></p>;
  } else if (typeof route === 'number') {
    content = !topic ? <p className="text-zinc-400 py-10 text-center">Тему не знайдено або її приховано.</p> : (
      <article className="space-y-4">
        <Crumbs chain={sectionChain(sections, topic.category)} />
        {editing === 'topic' && userId ? (
          <MessageForm userId={userId} sections={isStaff ? sections : []} topic initial={topic} submitLabel="Зберегти" onCancel={() => setEditing(null)}
            onSubmit={v => act(() => updateTopic(topic.id, { title: v.title, body: v.body, images: v.images, ...(isStaff ? { category: v.category } : {}) }))} />
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-6">
            <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase text-zinc-500 mb-1">
              {topic.is_pinned && <span className="flex items-center gap-1 text-[#FFC300]"><Pin size={12} /> Закріплено</span>}
              {topic.is_locked && <span className="flex items-center gap-1"><Lock size={12} /> Тему закрито</span>}
              {topic.is_hidden && <span className="flex items-center gap-1 text-red-400"><EyeOff size={12} /> Приховано</span>}
            </div>
            <h1 className="text-xl md:text-3xl font-black text-white mb-3 break-words">{topic.title}</h1>
            <Author name={topic.author_name} shop={topic.is_shop} date={topic.created_at} edited={topic.edited_at} avatar={topic.author_avatar} />
            <div className="mt-4"><Body text={topic.body} /></div>
            <Photos urls={topic.images} />
            {(isStaff || own.topic) && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-zinc-800">
                <Tool onClick={() => setEditing('topic')} icon={<Pencil size={14} />} label="Редагувати" />
                {isStaff && <>
                  <Tool onClick={() => act(() => updateTopic(topic.id, { is_pinned: !topic.is_pinned }))} icon={<Pin size={14} />} label={topic.is_pinned ? 'Відкріпити' : 'Закріпити'} />
                  <Tool onClick={() => act(() => updateTopic(topic.id, { is_locked: !topic.is_locked }))} icon={topic.is_locked ? <Unlock size={14} /> : <Lock size={14} />} label={topic.is_locked ? 'Відкрити тему' : 'Закрити тему'} />
                  <Tool onClick={() => act(() => updateTopic(topic.id, { is_hidden: !topic.is_hidden }))} icon={<EyeOff size={14} />} label={topic.is_hidden ? 'Показати' : 'Сховати'} />
                  <Tool danger onClick={() => act(async () => { await deleteTopic(topic.id); navigateTo(sectionHref(topic.category)); }, 'Видалити тему разом з усіма відповідями? Повернути не можна.')} icon={<Trash2 size={14} />} label="Видалити" />
                </>}
              </div>
            )}
          </div>
        )}
        <h2 className="text-lg font-black uppercase pt-2">Відповіді ({posts.filter(p => !p.is_hidden).length})</h2>
        {posts.map(p => editing === p.id && userId ? (
          <MessageForm key={p.id} userId={userId} initial={p} submitLabel="Зберегти" onCancel={() => setEditing(null)}
            onSubmit={v => act(() => updatePost(p.id, { body: v.body, images: v.images }))} />
        ) : (
          <div key={p.id} className={`border rounded-2xl p-4 ${p.is_shop ? 'bg-[#FFC300]/5 border-[#FFC300]/30' : 'bg-zinc-900/60 border-zinc-800'} ${p.is_hidden ? 'opacity-50' : ''}`}>
            <Author name={p.author_name} shop={p.is_shop} date={p.created_at} edited={p.edited_at} avatar={p.author_avatar} />
            <div className="mt-2"><Body text={p.body} /></div>
            <Photos urls={p.images} />
            {(isStaff || own.posts.has(p.id)) && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Tool onClick={() => setEditing(p.id)} icon={<Pencil size={14} />} label="Редагувати" />
                {isStaff && <>
                  <Tool onClick={() => act(() => updatePost(p.id, { is_hidden: !p.is_hidden }))} icon={<EyeOff size={14} />} label={p.is_hidden ? 'Показати' : 'Сховати'} />
                  <Tool danger onClick={() => act(() => deletePost(p.id), 'Видалити цю відповідь?')} icon={<Trash2 size={14} />} label="Видалити" />
                </>}
              </div>
            )}
          </div>
        ))}
        {topic.is_locked && !isStaff ? (
          <p className="text-center text-zinc-500 text-sm py-4 flex items-center justify-center gap-2"><Lock size={16} /> Тему закрито, нові відповіді не приймаються.</p>
        ) : !userId ? loginBox : (
          <MessageForm userId={userId} submitLabel="Відповісти" onSubmit={async v => { await createPost({ topic_id: topic.id, body: v.body, images: v.images }); await load(true); }} />
        )}
      </article>
    );
  } else if (current) {
    // a section: its subsections, then its topics
    const kids = childSections(sections, current.id);
    content = (
      <>
        <Crumbs chain={sectionChain(sections, current.slug).slice(0, -1)} />
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-black uppercase">{current.name}</h1>
            {current.description && <p className="text-zinc-400 text-sm mt-1">{current.description}</p>}
          </div>
          {newTopicButton}
        </div>
        {kids.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800 mb-6 overflow-hidden">
            {kids.map(k => <SectionRow key={k.id} s={k} all={sections} stats={stats} />)}
          </div>
        )}
        <h2 className="text-lg font-black uppercase mb-3">Теми</h2>
        {!topics?.length ? <p className="text-zinc-400 py-8 text-center">Тут поки немає тем. Станьте першим!</p> : (
          <ul className="space-y-2">{topics.map(t => <TopicRow key={t.id} t={t} all={sections} showSection={kids.length > 0} />)}</ul>
        )}
      </>
    );
  } else {
    // the forum's front page: every section with its subsections, then the latest topics
    content = (
      <>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-black uppercase">Форум автомобілістів</h1>
            <p className="text-zinc-400 text-sm mt-1">Питайте, діліться досвідом і порадами: шини, диски, акумулятори, ремонт.</p>
          </div>
          {newTopicButton}
        </div>
        {userId && (
          <details className="mb-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <summary className="cursor-pointer text-sm font-bold text-zinc-300">Ваш значок на форумі — оберіть прикольну іконку або поставте своє фото</summary>
            <div className="mt-3"><AvatarPicker userId={userId} name={auth.session?.user?.user_metadata?.full_name || auth.session?.user?.email || '?'} /></div>
          </details>
        )}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Пошук по темах форуму"
            className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 text-white outline-none focus:border-[#FFC300]" />
        </div>
        {searchResults ? (
          searchResults.length ? <ul className="space-y-2">{searchResults.map(t => <TopicRow key={t.id} t={t} all={sections} showSection />)}</ul>
            : <p className="text-zinc-400 py-8 text-center">Нічого не знайдено. Спробуйте інше слово або створіть нову тему.</p>
        ) : (
          <>
            <div className="space-y-4 mb-8">
              {rootSections(sections).map(r => (
                <section key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  <a href={sectionHref(r.slug)} onClick={linkClick(sectionHref(r.slug))} className="flex items-center justify-between px-4 py-3 bg-zinc-800/60 hover:bg-zinc-800">
                    <span className="font-black uppercase tracking-tight text-white">{r.name}</span>
                    <span className="text-[11px] text-zinc-400">{sumStats(stats, sectionSlugs(sections, r.slug)).topics} тем <ChevronRight size={14} className="inline" /></span>
                  </a>
                  <div className="divide-y divide-zinc-800">
                    {childSections(sections, r.id).map(k => <SectionRow key={k.id} s={k} all={sections} stats={stats} />)}
                  </div>
                </section>
              ))}
            </div>
            <h2 className="text-lg font-black uppercase mb-3">Останні теми</h2>
            {!topics?.length ? <p className="text-zinc-400 py-8 text-center">Тут поки немає тем. Станьте першим!</p> : (
              <ul className="space-y-2">{topics.map(t => <TopicRow key={t.id} t={t} all={sections} showSection />)}</ul>
            )}
          </>
        )}
      </>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full px-3 md:px-4 py-6 md:py-10 min-h-screen">
      {back}
      {content}
    </div>
  );
};

export default ForumPage;
