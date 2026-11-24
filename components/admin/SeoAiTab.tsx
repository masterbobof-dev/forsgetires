import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, Save, Square, Play, Check, X, FolderTree, AlertCircle } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useCategories } from '../../categories';

/**
 * AI texts for SEO: product descriptions + Google title/description, category texts.
 * Generate for a chosen category and amount → quickly review (all ticked, texts editable) → save.
 */
interface Draft { description: string; seo_title: string; seo_description: string; skipped?: boolean }
interface Row { id: number; title: string; seo_draft: Draft }

const call = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('seo-ai', { body });
  if (error) {
    let msg = error.message;
    try { msg = (await (error as any).context?.json())?.error || msg; } catch { /* keep */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
};

const len = (s: string, max: number) => <span className={`text-[10px] ${s.length > max ? 'text-red-400' : 'text-zinc-500'}`}>{s.length}/{max}</span>;

const SeoAiTab: React.FC = () => {
  const { categories } = useCategories({ includeInactive: true });
  const [stats, setStats] = useState<Record<number, number>>({});
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('100');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, goal: 0 });
  const stopRef = useRef(false);
  const [msg, setMsg] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [draftCount, setDraftCount] = useState(0);
  const [off, setOff] = useState<Set<number>>(new Set());
  const [edits, setEdits] = useState<Record<number, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'products' | 'categories'>('products');
  const [catDrafts, setCatDrafts] = useState<{ id: number; name: string; seo_draft: Draft }[]>([]);

  const loadStats = useCallback(async () => {
    const { data } = await supabase.rpc('seo_category_stats');
    setStats(Object.fromEntries(((data as any[]) || []).map(r => [Number(r.category_id), Number(r.missing)])));
  }, []);
  const loadDrafts = useCallback(async () => {
    const { data, count } = await supabase.from('tyres').select('id, title, seo_draft', { count: 'exact' })
      .not('seo_draft', 'is', null).not('seo_draft->>description', 'is', null).order('id').limit(30);
    setRows((data as Row[]) || []); setDraftCount(count || 0); setOff(new Set()); setEdits({});
  }, []);
  const loadCatDrafts = useCallback(async () => {
    const { data } = await supabase.from('product_categories').select('id, name, seo_draft').not('seo_draft', 'is', null).order('id');
    setCatDrafts((data as any) || []);
  }, []);
  useEffect(() => { loadStats(); loadDrafts(); loadCatDrafts(); }, [loadStats, loadDrafts, loadCatDrafts]);

  const total = (id: number): number => (stats[id] || 0) + categories.filter(c => c.parent_id === id).reduce((s, c) => s + total(c.id), 0);
  const all = (Object.values(stats) as number[]).reduce((a, b) => a + b, 0);
  const roots = categories.filter(c => !c.parent_id && total(c.id) > 0).sort((a, b) => total(b.id) - total(a.id));
  const available = category ? total(Number(category)) : all;

  const generate = async () => {
    const goal = amount === 'all' ? available : Math.min(Number(amount), available);
    stopRef.current = false; setRunning(true); setMsg(''); setProgress({ done: 0, goal });
    let done = 0;
    try {
      while (done < goal && !stopRef.current) {
        const r = await call({ action: 'generate', category_id: category ? Number(category) : undefined, n: Math.min(20, goal - done) });
        if (!r.generated) break;
        done += r.generated; setProgress({ done, goal });
      }
      setMsg(`Готово: ${done} описів чекають перегляду.`);
    } catch (e: any) { setMsg(`Зупинено: ${e.message}`); }
    setRunning(false); loadStats(); loadDrafts();
  };

  const value = (r: Row): Draft => edits[r.id] || r.seo_draft;
  const edit = (r: Row, k: keyof Draft, v: string) => setEdits(e => ({ ...e, [r.id]: { ...value(r), [k]: v } }));

  const savePage = async () => {
    setSaving(true); setMsg('');
    try {
      const keep = rows.filter(r => !off.has(r.id)).map(r => ({ id: r.id, ...value(r) }));
      const drop = rows.filter(r => off.has(r.id)).map(r => r.id);
      if (keep.length) await call({ action: 'save', items: keep });
      if (drop.length) await call({ action: 'discard', ids: drop });
      setMsg(`Збережено ${keep.length}, відхилено ${drop.length}.`);
      loadDrafts();
    } catch (e: any) { setMsg(`Помилка: ${e.message}`); }
    setSaving(false);
  };

  const genCategories = async () => {
    setRunning(true); setMsg('');
    try {
      let n = 0;
      for (let i = 0; i < 20; i++) { const r = await call({ action: 'generate_categories' }); if (!r.generated) break; n += r.generated; }
      setMsg(`Тексти категорій: ${n} чекають перегляду.`);
    } catch (e: any) { setMsg(`Помилка: ${e.message}`); }
    setRunning(false); loadCatDrafts();
  };
  const saveCategories = async () => {
    setSaving(true);
    try { await call({ action: 'save_categories', items: catDrafts.map(c => ({ id: c.id, ...c.seo_draft })) }); setMsg('Тексти категорій збережено.'); loadCatDrafts(); }
    catch (e: any) { setMsg(`Помилка: ${e.message}`); }
    setSaving(false);
  };

  const box = 'w-full bg-black border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-[#FFC300]';
  const tab = (on: boolean) => `px-3 py-1.5 rounded-lg text-xs font-bold ${on ? 'bg-[#FFC300] text-black' : 'bg-zinc-800 text-zinc-300'}`;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-black text-white flex items-center gap-2"><Sparkles className="text-[#FFC300]" /> SEO ШІ</h2>
        <p className="text-zinc-400 text-sm mt-1">ШІ пише описи товарів і тексти для Google (заголовок і опис у пошуку). Ви переглядаєте й зберігаєте. ШІ бере лише факти з назви й характеристик і не вигадує сумісність з авто.</p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setView('products')} className={tab(view === 'products')}>Товари ({draftCount} на перегляд)</button>
        <button onClick={() => setView('categories')} className={tab(view === 'categories')}>Категорії ({catDrafts.length})</button>
      </div>

      {view === 'products' ? (<>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2"><Play size={16} /> Згенерувати описи</h3>
          <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
            <label className="text-xs text-zinc-400">Категорія
              <select value={category} onChange={e => setCategory(e.target.value)} className="mt-1 w-full bg-black border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#FFC300]">
                <option value="">Усі категорії — {all} без опису</option>
                {roots.map(r => (
                  <optgroup key={r.id} label={r.name}>
                    <option value={r.id}>{r.name} — усе ({total(r.id)})</option>
                    {categories.filter(c => c.parent_id === r.id && total(c.id) > 0).sort((a, b) => total(b.id) - total(a.id))
                      .map(c => <option key={c.id} value={c.id}>  {c.name} ({total(c.id)})</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-400">Скільки
              <select value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 w-full bg-black border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#FFC300]">
                {['20', '50', '100', '200', '500'].map(n => <option key={n} value={n}>{n}</option>)}
                <option value="all">Усі ({available})</option>
              </select>
            </label>
            {running
              ? <button onClick={() => { stopRef.current = true; }} className="bg-zinc-800 hover:bg-red-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl flex items-center gap-2"><Square size={14} /> Зупинити</button>
              : <button onClick={generate} disabled={!available} className="bg-[#FFC300] hover:bg-white text-black font-black text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-40"><Sparkles size={16} /> Згенерувати</button>}
          </div>
          {running && (
            <div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-[#FFC300] transition-all" style={{ width: `${progress.goal ? (progress.done / progress.goal) * 100 : 0}%` }} /></div>
              <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> {progress.done} з {progress.goal} — не закривайте сторінку</p>
            </div>
          )}
          {msg && <p className="text-sm text-zinc-300 flex items-center gap-1"><AlertCircle size={14} /> {msg}</p>}
        </div>

        {rows.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">Показано {rows.length} з {draftCount}. Текст можна виправити. Натисніть ✓, щоб відхилити опис.</p>
            {rows.map(r => {
              const d = value(r); const on = !off.has(r.id);
              return (
                <div key={r.id} className={`bg-zinc-900 border rounded-2xl p-3 space-y-2 ${on ? 'border-zinc-800' : 'border-red-700 opacity-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-white text-sm">{r.title}</p>
                    <button onClick={() => setOff(s => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })}
                      className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${on ? 'bg-green-600' : 'bg-red-600'} text-white`}>{on ? <Check size={14} /> : <X size={14} />}</button>
                  </div>
                  <textarea value={d.description} onChange={e => edit(r, 'description', e.target.value)} rows={4} className={box} />
                  <div className="grid md:grid-cols-2 gap-2">
                    <label className="text-[11px] text-zinc-500">Заголовок у Google {len(d.seo_title, 65)}<input value={d.seo_title} onChange={e => edit(r, 'seo_title', e.target.value)} className={box} /></label>
                    <label className="text-[11px] text-zinc-500">Опис у Google {len(d.seo_description, 160)}<input value={d.seo_description} onChange={e => edit(r, 'seo_description', e.target.value)} className={box} /></label>
                  </div>
                </div>
              );
            })}
            <div className="sticky bottom-20 md:bottom-4 z-10 flex items-center gap-3 bg-zinc-950/95 backdrop-blur border border-zinc-800 rounded-2xl p-3">
              <button onClick={savePage} disabled={saving} className="bg-[#FFC300] hover:bg-white text-black font-black text-sm px-5 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Зберегти {draftCount > rows.length ? 'і далі' : ''}
              </button>
              <span className="text-xs text-zinc-400">Зберегти {rows.length - off.size}, відхилити {off.size}</span>
            </div>
          </div>
        )}
      </>) : (
        <div className="space-y-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-wrap items-center gap-3">
            <FolderTree className="text-[#FFC300]" />
            <p className="text-sm text-zinc-300 flex-1 min-w-[200px]">Тексти для сторінок категорій: як вибрати, на що звернути увагу, доставка. Генеруються для категорій без опису.</p>
            <button onClick={genCategories} disabled={running} className="bg-[#FFC300] hover:bg-white text-black font-black text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-40">
              {running ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Згенерувати тексти категорій
            </button>
          </div>
          {msg && <p className="text-sm text-zinc-300">{msg}</p>}
          {catDrafts.map((c, i) => (
            <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 space-y-2">
              <p className="font-bold text-white">{c.name}</p>
              <textarea value={c.seo_draft.description} rows={6} className={box}
                onChange={e => setCatDrafts(list => list.map((x, j) => j === i ? { ...x, seo_draft: { ...x.seo_draft, description: e.target.value } } : x))} />
              <div className="grid md:grid-cols-2 gap-2">
                <input value={c.seo_draft.seo_title} className={box} onChange={e => setCatDrafts(list => list.map((x, j) => j === i ? { ...x, seo_draft: { ...x.seo_draft, seo_title: e.target.value } } : x))} />
                <input value={c.seo_draft.seo_description} className={box} onChange={e => setCatDrafts(list => list.map((x, j) => j === i ? { ...x, seo_draft: { ...x.seo_draft, seo_description: e.target.value } } : x))} />
              </div>
            </div>
          ))}
          {catDrafts.length > 0 && (
            <button onClick={saveCategories} disabled={saving} className="bg-[#FFC300] hover:bg-white text-black font-black text-sm px-5 py-2.5 rounded-xl flex items-center gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Зберегти тексти категорій
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SeoAiTab;
