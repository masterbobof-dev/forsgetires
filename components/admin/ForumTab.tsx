import React, { useEffect, useMemo, useState } from 'react';
import {
  MessagesSquare, Plus, Pencil, Trash2, Pin, Lock, Unlock, EyeOff, Eye, Loader2, Search, ExternalLink, ChevronDown, ChevronUp, FolderTree, Save, X,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import {
  fetchSections, fetchTopics, fetchTopic, saveSection, deleteSection, createTopic, createPost, updateTopic, updatePost, deleteTopic, deletePost,
  rootSections, childSections, sectionName, sectionSlugs, forumPath, type ForumSection, type ForumTopic, type ForumPost,
} from '../../forum';
import { MessageForm, SectionSelect, Body, Photos, Author, when } from '../forum/forumParts';

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

/** One topic in the admin list: quick actions, editing, and its replies. */
const TopicAdmin: React.FC<{ t: ForumTopic; sections: ForumSection[]; userId: string; onChanged: () => void }> = ({ t, sections, userId, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<'topic' | number | null>(null);
  const [posts, setPosts] = useState<ForumPost[] | null>(null);
  const loadPosts = async () => setPosts((await fetchTopic(t.id, false)).posts);
  useEffect(() => { if (open) loadPosts(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (fn: () => Promise<void>, ask?: string) => {
    if (ask && !confirm(ask)) return;
    try { await fn(); onChanged(); if (open) await loadPosts(); } catch { alert('Не вдалося зберегти зміни'); }
  };
  return (
    <li className={`bg-zinc-900 border rounded-2xl ${t.is_hidden ? 'border-red-900/60' : t.is_pinned ? 'border-[#FFC300]/40' : 'border-zinc-800'}`}>
      <div className="p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase text-zinc-500 mb-1">
          <span className="text-[#FFC300]">{sectionName(sections, t.category)}</span>
          {t.is_pinned && <span className="flex items-center gap-1 text-[#FFC300]"><Pin size={12} /> закріплено</span>}
          {t.is_locked && <span className="flex items-center gap-1"><Lock size={12} /> закрито</span>}
          {t.is_hidden && <span className="flex items-center gap-1 text-red-400"><EyeOff size={12} /> приховано</span>}
        </div>
        <div className="font-bold text-white break-words">{t.title}</div>
        <div className="text-xs text-zinc-500 mt-1">{t.author_name} · {when(t.created_at)} · відповідей {t.replies_count} · переглядів {t.views}</div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <button onClick={() => { setEdit('topic'); setOpen(true); }} className={btnGrey}><Pencil size={14} /> Редагувати</button>
          <button onClick={() => act(() => updateTopic(t.id, { is_pinned: !t.is_pinned }))} className={btnGrey}><Pin size={14} /> {t.is_pinned ? 'Відкріпити' : 'Закріпити'}</button>
          <button onClick={() => act(() => updateTopic(t.id, { is_locked: !t.is_locked }))} className={btnGrey}>{t.is_locked ? <Unlock size={14} /> : <Lock size={14} />} {t.is_locked ? 'Відкрити' : 'Закрити'}</button>
          <button onClick={() => act(() => updateTopic(t.id, { is_hidden: !t.is_hidden }))} className={btnGrey}>{t.is_hidden ? <Eye size={14} /> : <EyeOff size={14} />} {t.is_hidden ? 'Показати' : 'Сховати'}</button>
          <SectionSelect sections={sections} value={t.category} onChange={slug => act(() => updateTopic(t.id, { category: slug }))}
            className="h-9 bg-black border border-zinc-700 rounded-lg px-2 text-xs text-zinc-300 font-bold max-w-[200px]" />
          <a href={forumPath(t)} target="_blank" rel="noopener noreferrer" className={btnGrey}><ExternalLink size={14} /> На сайті</a>
          <button onClick={() => setOpen(!open)} className={btnGrey}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Відповіді</button>
          <button onClick={() => act(() => deleteTopic(t.id), `Видалити тему «${t.title}» разом з усіма відповідями? Повернути не можна.`)} className={btnRed}><Trash2 size={14} /> Видалити</button>
        </div>
      </div>
      {open && (
        <div className="border-t border-zinc-800 p-3 md:p-4 space-y-3 bg-black/20">
          {edit === 'topic' ? (
            <MessageForm userId={userId} sections={sections} topic allowPin initial={t} submitLabel="Зберегти" onCancel={() => setEdit(null)}
              onSubmit={v => act(async () => { await updateTopic(t.id, { title: v.title, body: v.body, images: v.images, category: v.category, is_pinned: !!v.is_pinned }); setEdit(null); })} />
          ) : (
            <div><Body text={t.body} /><Photos urls={t.images} /></div>
          )}
          {!posts ? <Loader2 className="animate-spin text-[#FFC300]" /> : posts.map(p => edit === p.id ? (
            <MessageForm key={p.id} userId={userId} initial={p} submitLabel="Зберегти" onCancel={() => setEdit(null)}
              onSubmit={v => act(async () => { await updatePost(p.id, { body: v.body, images: v.images }); setEdit(null); })} />
          ) : (
            <div key={p.id} className={`border rounded-xl p-3 ${p.is_hidden ? 'border-red-900/60 opacity-60' : 'border-zinc-800'}`}>
              <Author name={p.author_name} shop={p.is_shop} date={p.created_at} edited={p.edited_at} />
              <div className="mt-2 text-sm"><Body text={p.body} /></div>
              <Photos urls={p.images} />
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button onClick={() => setEdit(p.id)} className={btnGrey}><Pencil size={14} /> Редагувати</button>
                <button onClick={() => act(() => updatePost(p.id, { is_hidden: !p.is_hidden }))} className={btnGrey}>{p.is_hidden ? <Eye size={14} /> : <EyeOff size={14} />} {p.is_hidden ? 'Показати' : 'Сховати'}</button>
                <button onClick={() => act(() => deletePost(p.id), 'Видалити цю відповідь?')} className={btnRed}><Trash2 size={14} /> Видалити</button>
              </div>
            </div>
          ))}
          {posts && <MessageForm userId={userId} submitLabel="Відповісти від магазину" onSubmit={v => act(() => createPost({ topic_id: t.id, body: v.body, images: v.images }))} />}
        </div>
      )}
    </li>
  );
};

/** Admin → Форум: sections, every topic (including hidden), new topics from the shop. */
const ForumTab: React.FC = () => {
  const [sections, setSections] = useState<ForumSection[]>([]);
  const [topics, setTopics] = useState<ForumTopic[] | null>(null);
  const [userId, setUserId] = useState('');
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'all' | 'hidden'>('all');
  const [creating, setCreating] = useState(false);
  const [showSections, setShowSections] = useState(false);

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
          <button onClick={() => setShowSections(!showSections)} className={btnGrey}><FolderTree size={14} /> Розділи</button>
          <a href="/forum" target="_blank" rel="noopener noreferrer" className={btnGrey}><ExternalLink size={14} /> Відкрити форум</a>
          <button onClick={() => setCreating(!creating)} className={`${btn} bg-[#FFC300] text-black border-[#FFC300]`}><Plus size={14} /> Нова тема</button>
        </div>
      </div>
      {showSections && <SectionsPanel sections={sections} counts={filter ? {} : counts} onChanged={load} />}
      {creating && userId && sections.length > 0 && (
        <MessageForm userId={userId} sections={sections} topic allowPin submitLabel="Опублікувати від магазину" onCancel={() => setCreating(false)}
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
          : <ul className="space-y-2">{shown.map(t => <TopicAdmin key={t.id} t={t} sections={sections} userId={userId} onChanged={load} />)}</ul>}
    </div>
  );
};

export default ForumTab;
