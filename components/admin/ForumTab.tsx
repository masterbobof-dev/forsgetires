import React, { useEffect, useMemo, useState } from 'react';
import {
  MessagesSquare, Plus, Pencil, Trash2, Pin, Lock, Unlock, EyeOff, Eye, Loader2, Search, ExternalLink, ChevronDown, ChevronUp, FolderTree, Save, X,
  ShieldCheck, Send, Copy, BarChart3,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import {
  fetchSections, fetchTopics, fetchTopic, saveSection, deleteSection, createTopic, createPost, updateTopic, updatePost, deleteTopic, deletePost,
  rootSections, childSections, sectionName, sectionSlugs, forumPath, type ForumSection, type ForumTopic, type ForumPost,
} from '../../forum';
import { MessageForm, SectionSelect, Body, Photos, Author, when } from '../forum/forumParts';
import LiveTopic from '../forum/LiveTopic';
import LivePost from '../forum/LivePost';

const btn = 'h-9 px-3 rounded-lg border text-xs font-bold flex items-center gap-1.5 shrink-0';
const btnGrey = `${btn} border-zinc-700 text-zinc-300 hover:border-zinc-500`;
const btnRed = `${btn} border-red-900 text-red-400 hover:bg-red-950/40`;
const input = 'w-full bg-black border border-zinc-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-[#FFC300]';

/** Sections and subsections: add, rename, describe, order, delete (only when empty). */
const SectionsPanel: React.FC<{ sections: ForumSection[]; counts: Record<string, number>; onChanged: () => void }> = ({ sections, counts, onChanged }) => {
  const [form, setForm] = useState<Partial<ForumSection> & { name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const save = async () => {
    if (!form || form.name.trim().length < 2) { setMsg('Вкажіть назву розділу'); return; }
    setBusy(true); setMsg('');
    try { await saveSection(form); setForm(null); onChanged(); }
    catch (e: any) { setMsg(/duplicate|unique/i.test(e?.message || '') ? 'Така адреса розділу вже є — змініть назву або адресу' : 'Не вдалося зберегти'); }
    setBusy(false);
  };
  const remove = async (s: ForumSection) => {
    if (childSections(sections, s.id).length) { alert('Спочатку видаліть або перенесіть його підрозділи.'); return; }
    if (counts[s.slug]) { alert(`У розділі є теми (${counts[s.slug]}). Спочатку перенесіть їх в інший розділ.`); return; }
    if (!confirm(`Видалити розділ «${s.name}»?`)) return;
    try { await deleteSection(s.id); onChanged(); } catch { alert('Не вдалося видалити'); }
  };
  const row = (s: ForumSection, sub: boolean) => (
    <div key={s.id} className={`flex items-center gap-2 py-2 ${sub ? 'pl-6' : ''}`}>
      <span className="flex-1 min-w-0">
        <span className={`block truncate ${sub ? 'text-zinc-300' : 'font-black text-white uppercase text-sm'}`}>{s.name}</span>
        {s.description && <span className="block text-xs text-zinc-500 truncate">{s.description}</span>}
      </span>
      <span className="text-xs text-zinc-500 shrink-0">{counts[s.slug] || 0} тем</span>
      <button onClick={() => setForm({ ...s })} className={btnGrey} title="Змінити"><Pencil size={14} /></button>
      <button onClick={() => remove(s)} className={btnRed} title="Видалити"><Trash2 size={14} /></button>
    </div>
  );
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="font-black uppercase flex items-center gap-2"><FolderTree size={18} className="text-[#FFC300]" /> Розділи форуму</h3>
        <button onClick={() => setForm({ name: '', parent_id: null, sort_order: 100 })} className={`${btn} bg-[#FFC300] text-black border-[#FFC300]`}><Plus size={14} /> Додати розділ</button>
      </div>
      {form && (
        <div className="bg-black/40 border border-zinc-700 rounded-xl p-3 mb-3 space-y-2">
          <div className="grid sm:grid-cols-2 gap-2">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Назва, напр. «Шини для бусів»" className={input} />
            <select value={form.parent_id || ''} onChange={e => setForm({ ...form, parent_id: e.target.value ? Number(e.target.value) : null })} className={input}>
              <option value="">Головний розділ</option>
              {rootSections(sections).filter(r => r.id !== form.id).map(r => <option key={r.id} value={r.id}>Підрозділ у «{r.name}»</option>)}
            </select>
          </div>
          <input value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Короткий опис (необов'язково)" className={input} />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-zinc-400">Порядок (менше — вище)
              <input type="number" value={form.sort_order ?? 0} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} className={input} />
            </label>
            <label className="text-xs text-zinc-400">Адреса латиницею (необов'язково)
              <input value={form.slug || ''} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="створиться сама" className={input} />
            </label>
          </div>
          {msg && <p className="text-sm text-red-400">{msg}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className={`${btn} bg-[#FFC300] text-black border-[#FFC300]`}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Зберегти</button>
            <button onClick={() => setForm(null)} className={btnGrey}><X size={14} /> Скасувати</button>
          </div>
        </div>
      )}
      <div className="divide-y divide-zinc-800">
        {rootSections(sections).map(r => (
          <div key={r.id}>{row(r, false)}{childSections(sections, r.id).map(k => row(k, true))}</div>
        ))}
      </div>
    </section>
  );
};

/** Forum figures for 7 / 30 days (the same as the Telegram /forum command). */
const StatsPanel: React.FC = () => {
  const [days, setDays] = useState(7);
  const [s, setS] = useState<any>(null);
  useEffect(() => { setS(null); supabase.rpc('forum_stats', { p_days: days }).then(({ data }) => setS(data || {})); }, [days]);
  const cell = (n: number | undefined, label: string) => (
    <div className="bg-black/40 border border-zinc-800 rounded-xl p-3"><div className="text-2xl font-black text-white">{n ?? '—'}</div><div className="text-[11px] text-zinc-400">{label}</div></div>
  );
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-black uppercase flex items-center gap-2"><BarChart3 size={18} className="text-[#FFC300]" /> Статистика форуму</h3>
        <select value={days} onChange={e => setDays(Number(e.target.value))} className={`${input} w-auto`} aria-label="Період">
          <option value={1}>За добу</option><option value={7}>За 7 днів</option><option value={30}>За 30 днів</option>
        </select>
      </div>
      {!s ? <Loader2 className="animate-spin text-[#FFC300]" /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {cell(s.topics, 'нових тем')}{cell(s.posts, 'відповідей')}{cell(s.writers, 'людей писали')}{cell(s.users_new, `нових покупців (усього ${s.users_total ?? 0})`)}
          </div>
          {!!s.top_topics?.length && (
            <div className="text-sm"><div className="text-xs font-bold text-zinc-400 uppercase mb-1">Популярні теми</div>
              {s.top_topics.map((t: any) => <a key={t.id} href={forumPath(t)} target="_blank" rel="noopener noreferrer" className="block truncate text-zinc-200 hover:text-[#FFC300]">• {t.title} <span className="text-zinc-500">— переглядів {t.views}, відповідей {t.replies_count}</span></a>)}
            </div>
          )}
          {!!s.top_authors?.length && (
            <div className="text-sm"><div className="text-xs font-bold text-zinc-400 uppercase mb-1">Найактивніші</div>
              <div className="flex flex-wrap gap-2">{s.top_authors.map((a: any) => <span key={a.name} className="px-2 py-1 rounded-lg bg-black/40 border border-zinc-800 text-zinc-200">{a.name} · {a.n}</span>)}</div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

/** Owner only: who may look after the forum, and their Telegram invitations. */
const ModeratorsPanel: React.FC = () => {
  const [list, setList] = useState<{ email: string; name: string | null }[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [link, setLink] = useState('');
  const load = async () => { const { data } = await supabase.from('forum_moderators').select('email, name').order('created_at'); setList((data as any) || []); };
  useEffect(() => { load(); }, []);
  const add = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) { setMsg('Вкажіть e-mail, з яким людина входить на сайт'); return; }
    const { error } = await supabase.from('forum_moderators').upsert({ email: e, name: name.trim() || null });
    if (error) { setMsg('Не вдалося зберегти'); return; }
    setEmail(''); setName(''); setMsg('Додано ✓'); load();
  };
  const remove = async (e: string) => {
    if (!confirm(`Забрати права модератора у ${e}?`)) return;
    await supabase.from('forum_moderators').delete().eq('email', e); load();
  };
  const invite = async (label: string) => {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join('');
    const { error } = await supabase.from('telegram_invites').insert({ code, role: 'forum', label: label || 'Модератор форуму' });
    if (error) { setMsg('Не вдалося створити запрошення'); return; }
    setLink(`https://t.me/Forsageshop_bot?start=${code}`);
  };
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-6 space-y-3">
      <h3 className="font-black uppercase flex items-center gap-2"><ShieldCheck size={18} className="text-[#FFC300]" /> Модератори форуму</h3>
      <p className="text-xs text-zinc-400 leading-relaxed">
        Модератор бачить в адмінці <b>лише форум</b>: може ховати й видаляти повідомлення, закріплювати й закривати теми, змінювати розділи.
        Замовлень, товарів, цін і налаштувань він не бачить. Людина має зареєструватися на сайті з цим e-mail і відкрити адресу <b>forsage-tires.com/admin</b>.
      </p>
      <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail модератора" className={input} aria-label="E-mail модератора" />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ім'я (для себе)" className={input} />
        <button onClick={add} className={`${btn} h-10 bg-[#FFC300] text-black border-[#FFC300] justify-center`}><Plus size={14} /> Додати</button>
      </div>
      {msg && <p className="text-sm text-[#FFC300]">{msg}</p>}
      {list.length > 0 && (
        <ul className="divide-y divide-zinc-800">
          {list.map(m => (
            <li key={m.email} className="flex flex-wrap items-center gap-2 py-2">
              <span className="flex-1 min-w-0 text-sm text-white truncate">{m.name ? <b>{m.name}</b> : null} {m.email}</span>
              <button onClick={() => invite(m.name || m.email)} className={btnGrey}><Send size={14} /> Запросити в Telegram</button>
              <button onClick={() => remove(m.email)} className={btnRed}><Trash2 size={14} /> Забрати права</button>
            </li>
          ))}
        </ul>
      )}
      {link && (
        <div className="bg-black/40 border border-[#FFC300]/40 rounded-xl p-3 text-sm space-y-2">
          <p className="text-zinc-300">Надішліть це посилання модератору. Він натисне «Start» у Telegram і почне отримувати нові повідомлення форуму та статистику (команда /forum). Діє 24 години, спрацює один раз.</p>
          <div className="flex gap-2 items-center"><code className="flex-1 min-w-0 truncate text-[#FFC300]">{link}</code>
            <button onClick={() => navigator.clipboard?.writeText(link).catch(() => undefined)} className={btnGrey}><Copy size={14} /> Копіювати</button></div>
        </div>
      )}
    </section>
  );
};

/** One topic in the admin list: tap it and it opens for editing right there (text saves by itself,
 *  photos are added / pasted / removed at once), with its replies under it. */
const TopicAdmin: React.FC<{ t: ForumTopic; sections: ForumSection[]; userId: string; onChanged: () => void; asShop: boolean }> = ({ t, sections, userId, onChanged, asShop }) => {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(t);
  useEffect(() => setTopic(t), [t]);
  const [edit, setEdit] = useState<number | null>(null);
  const [posts, setPosts] = useState<ForumPost[] | null>(null);
  const loadPosts = async () => setPosts((await fetchTopic(t.id, false)).posts);
  useEffect(() => { if (open) loadPosts(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (fn: () => Promise<void>, ask?: string) => {
    if (ask && !confirm(ask)) return;
    try { await fn(); await loadPosts(); } catch { alert('Не вдалося зберегти зміни'); }
  };
  return (
    <li className={`bg-zinc-900 border rounded-2xl ${topic.is_hidden ? 'border-red-900/60' : topic.is_pinned ? 'border-[#FFC300]/40' : 'border-zinc-800'}`}>
      <button type="button" onClick={() => { if (open) onChanged(); setOpen(!open); }} aria-expanded={open} className="w-full text-left p-3 md:p-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase text-zinc-500 mb-1">
            <span className="text-[#FFC300]">{sectionName(sections, topic.category)}</span>
            {topic.is_pinned && <span className="flex items-center gap-1 text-[#FFC300]"><Pin size={12} /> закріплено</span>}
            {topic.is_locked && <span className="flex items-center gap-1"><Lock size={12} /> закрито</span>}
            {topic.is_hidden && <span className="flex items-center gap-1 text-red-400"><EyeOff size={12} /> приховано</span>}
          </div>
          <div className="font-bold text-white break-words">{topic.title}</div>
          <div className="text-xs text-zinc-500 mt-1">{topic.author_name} · {when(topic.created_at)} · відповідей {topic.replies_count} · переглядів {topic.views}{topic.images?.length ? ` · фото ${topic.images.length}` : ''}</div>
        </div>
        <span className="shrink-0 h-9 px-3 rounded-lg border border-zinc-700 text-zinc-300 text-xs font-bold flex items-center gap-1.5">
          {open ? <><ChevronUp size={14} /> Згорнути</> : <><Pencil size={14} /> Правити</>}
        </span>
      </button>
      {open && (
        <div className="border-t border-zinc-800 p-3 md:p-4 space-y-3 bg-black/20">
          <LiveTopic topic={topic} sections={sections} userId={userId} onChanged={setTopic} onDeleted={onChanged} />
          <a href={forumPath(topic)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-[#FFC300]"><ExternalLink size={14} /> Подивитися на сайті</a>
          <h4 className="text-xs font-black uppercase text-zinc-500 pt-2">Відповіді</h4>
          {!posts ? <Loader2 className="animate-spin text-[#FFC300]" /> : posts.map(p => (
            <LivePost key={p.id} post={p} userId={userId}
              onChanged={np => setPosts(list => (list || []).map(x => (x.id === np.id ? np : x)))}
              onDeleted={() => loadPosts()} />
          ))}
          {posts && <MessageForm userId={userId} submitLabel={asShop ? 'Відповісти від магазину' : 'Відповісти'} onSubmit={v => act(() => createPost({ topic_id: t.id, body: v.body, images: v.images }))} />}
        </div>
      )}
    </li>
  );
};

/** Admin → Форум: sections, every topic (including hidden), new topics from the shop.
 *  A forum moderator (role "forum") sees only this tab and posts under their own name. */
const ForumTab: React.FC<{ isStaff?: boolean }> = ({ isStaff = true }) => {
  const [sections, setSections] = useState<ForumSection[]>([]);
  const [topics, setTopics] = useState<ForumTopic[] | null>(null);
  const [userId, setUserId] = useState('');
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'all' | 'hidden'>('all');
  const [creating, setCreating] = useState(false);
  const [showSections, setShowSections] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showMods, setShowMods] = useState(false);

  const load = async () => {
    const all = await fetchSections(true);
    setSections(all);
    setTopics(await fetchTopics({ slugs: filter ? sectionSlugs(all, filter) : null, search, limit: 300 }));
  };
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || '')); }, []);
  useEffect(() => { const t = setTimeout(load, search ? 350 : 0); return () => clearTimeout(t); }, [filter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    // counted from all topics of the list when no filter, otherwise unknown for other sections
    for (const t of topics || []) m[t.category] = (m[t.category] || 0) + 1;
    return m;
  }, [topics]);
  const shown = (topics || []).filter(t => view === 'all' || t.is_hidden);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl md:text-2xl font-black uppercase flex items-center gap-2"><MessagesSquare className="text-[#FFC300]" /> Форум</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowStats(!showStats)} className={btnGrey}><BarChart3 size={14} /> Статистика</button>
          {isStaff && <button onClick={() => setShowMods(!showMods)} className={btnGrey}><ShieldCheck size={14} /> Модератори</button>}
          <button onClick={() => setShowSections(!showSections)} className={btnGrey}><FolderTree size={14} /> Розділи</button>
          <a href="/forum" target="_blank" rel="noopener noreferrer" className={btnGrey}><ExternalLink size={14} /> Відкрити форум</a>
          <button onClick={() => setCreating(!creating)} className={`${btn} bg-[#FFC300] text-black border-[#FFC300]`}><Plus size={14} /> Нова тема</button>
        </div>
      </div>
      {showStats && <StatsPanel />}
      {showMods && isStaff && <ModeratorsPanel />}
      {showSections && <SectionsPanel sections={sections} counts={filter ? {} : counts} onChanged={load} />}
      {creating && userId && sections.length > 0 && (
        <MessageForm userId={userId} sections={sections} topic allowPin submitLabel={isStaff ? 'Опублікувати від магазину' : 'Опублікувати'} onCancel={() => setCreating(false)}
          onSubmit={async v => { await createTopic({ category: v.category, title: v.title, body: v.body, images: v.images, is_pinned: !!v.is_pinned }); setCreating(false); await load(); }} />
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Пошук за заголовком" className={`${input} pl-9`} />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className={`${input} w-auto`}>
          <option value="">Усі розділи</option>
          {rootSections(sections).map(r => (
            <optgroup key={r.id} label={r.name}>
              <option value={r.slug}>{r.name} (весь)</option>
              {childSections(sections, r.id).map(k => <option key={k.id} value={k.slug}>{k.name}</option>)}
            </optgroup>
          ))}
        </select>
        <select value={view} onChange={e => setView(e.target.value as 'all' | 'hidden')} className={`${input} w-auto`}>
          <option value="all">Усі теми</option>
          <option value="hidden">Лише приховані</option>
        </select>
      </div>
      {!topics ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-[#FFC300]" /></div>
        : !shown.length ? <p className="text-zinc-500 text-center py-10">Тем не знайдено</p>
          : <ul className="space-y-2">{shown.map(t => <TopicAdmin key={t.id} t={t} sections={sections} userId={userId} onChanged={load} asShop={isStaff} />)}</ul>}
    </div>
  );
};

export default ForumTab;
