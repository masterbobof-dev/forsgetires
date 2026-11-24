import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles, Search, Loader2, Check, X, ImageOff, RefreshCw, Save, Settings2, ExternalLink, AlertCircle, Play, Square } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useCategories } from '../../categories';

/** AI photo search: settings, review queue (choose photos before they are attached) and manual search. */

interface Verdict { match: boolean; white_background: boolean; no_extra_text: boolean; good_quality: boolean }
interface Candidate { url: string; link: string; title?: string; w?: number; h?: number; score?: number; ai?: Verdict | null; ok?: boolean; error?: string; stored?: { full: string; thumb: string } }
interface Product { id: number; title: string; manufacturer?: string | null; catalog_number?: string | null; image_url?: string | null; gallery?: string[] | null; photo_candidates?: Candidate[] | null; photo_auto?: boolean }

const SETTINGS = ['photo_finder_mode', 'photo_finder_max_photos', 'photo_finder_white_bg', 'photo_finder_no_text', 'photo_finder_min_size'] as const;
type SettingsState = Record<(typeof SETTINGS)[number], string>;
const DEFAULTS: SettingsState = { photo_finder_mode: 'review', photo_finder_max_photos: '3', photo_finder_white_bg: '1', photo_finder_no_text: '1', photo_finder_min_size: '600' };

const call = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('photo-finder', { body });
  if (error) {
    let msg = error.message;
    try { msg = (await (error as any).context?.json())?.error || msg; } catch { /* keep */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
};

const Badge: React.FC<{ ok?: boolean; label: string }> = ({ ok, label }) => (
  <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${ok ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
    {ok ? <Check size={10} /> : <X size={10} />}{label}
  </span>
);

/** grid of candidate photos with AI verdicts; click to select (several = angles / sets) */
const CandidatesPicker: React.FC<{
  product: Product; candidates: Candidate[]; maxPhotos: number; onDone: () => void;
}> = ({ product, candidates, maxPhotos, onDone }) => {
  const [selected, setSelected] = useState<string[]>(() => candidates.filter(c => c.ok).slice(0, maxPhotos).map(c => c.url));
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<'' | 'attach' | 'reject'>('');
  const [error, setError] = useState('');
  useEffect(() => { setSelected(candidates.filter(c => c.ok).slice(0, maxPhotos).map(c => c.url)); }, [candidates, maxPhotos]);

  const toggle = (url: string) => setSelected(s => (s.includes(url) ? s.filter(x => x !== url) : [...s, url]));
  const attach = async () => {
    setBusy('attach'); setError('');
    try { await call({ action: 'staff.attach', product_id: product.id, urls: selected }); onDone(); }
    catch (e: any) { setError(e.message); } finally { setBusy(''); }
  };
  const reject = async () => {
    setBusy('reject'); setError('');
    try { await call({ action: 'staff.reject', product_id: product.id }); onDone(); }
    catch (e: any) { setError(e.message); } finally { setBusy(''); }
  };
  const visible = candidates.filter(c => !broken.has(c.url));

  return (
    <div>
      {visible.length === 0 ? (
        <p className="text-zinc-500 text-sm py-4">Немає варіантів для показу.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {visible.map(c => {
            const idx = selected.indexOf(c.url);
            return (
              <button key={c.url} type="button" onClick={() => toggle(c.url)}
                className={`relative text-left rounded-xl overflow-hidden border-2 transition-colors ${idx >= 0 ? 'border-[#FFC300]' : c.ok ? 'border-green-700/60 hover:border-green-500' : 'border-zinc-800 hover:border-zinc-600'}`}>
                <div className="aspect-square bg-white">
                  <img src={c.url} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-contain"
                    onError={() => setBroken(b => new Set(b).add(c.url))} />
                </div>
                {idx >= 0 && <span className="absolute top-1.5 left-1.5 bg-[#FFC300] text-black text-xs font-black w-6 h-6 rounded-full flex items-center justify-center">{idx + 1}</span>}
                <div className="p-1.5 bg-zinc-950 space-y-1">
                  {c.ai ? (
                    <div className="flex flex-wrap gap-1">
                      <Badge ok={c.ai.match} label="товар" />
                      <Badge ok={c.ai.white_background} label="фон" />
                      <Badge ok={c.ai.no_extra_text} label="без напису" />
                      <Badge ok={c.ai.good_quality} label="якість" />
                    </div>
                  ) : <span className="text-[10px] text-zinc-500">{c.error || 'ШІ не перевіряв'}</span>}
                  <span className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span>{c.w && c.h ? `${c.w}×${c.h}` : ''}</span>
                    <a href={c.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="hover:text-white flex items-center gap-0.5">джерело <ExternalLink size={10} /></a>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-400 flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={attach} disabled={!selected.length || !!busy}
          className="bg-[#FFC300] hover:bg-white disabled:opacity-40 text-black font-black text-sm px-4 py-2 rounded-xl flex items-center gap-2">
          {busy === 'attach' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Закріпити вибрані ({selected.length})
        </button>
        <button onClick={reject} disabled={!!busy} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-sm px-4 py-2 rounded-xl flex items-center gap-2">
          {busy === 'reject' ? <Loader2 size={16} className="animate-spin" /> : <ImageOff size={16} />} Немає гарного фото
        </button>
        <span className="text-xs text-zinc-500 self-center">Перше вибране стане головним, решта — додаткові ракурси.</span>
      </div>
    </div>
  );
};

/** one product: current photos + "find photos" with an editable query */
const ProductPhotos: React.FC<{ product: Product; maxPhotos: number; onDone: () => void }> = ({ product, maxPhotos, onDone }) => {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>(product.photo_candidates || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setCandidates(product.photo_candidates || []); setQuery(''); setError(''); }, [product.id]);

  const find = async () => {
    setLoading(true); setError('');
    try { const r = await call({ action: 'staff.find', product_id: product.id, query: query.trim() || undefined }); setCandidates(r.candidates || []); if (!query) setQuery(r.query || ''); }
    catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
      <div className="flex gap-3 items-start">
        <div className="w-16 h-16 shrink-0 rounded-lg bg-white overflow-hidden flex items-center justify-center">
          {product.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-contain" /> : <ImageOff size={20} className="text-zinc-400" />}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-white leading-tight">{product.title}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{[product.manufacturer, product.catalog_number].filter(Boolean).join(' · ')}{product.gallery?.length ? ` · зараз фото: ${product.gallery.length}` : ''}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && find()}
          placeholder="Запит для пошуку (необов'язково — інакше за назвою)" className="flex-1 bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-[#FFC300]" />
        <button onClick={find} disabled={loading} className="bg-[#FFC300] hover:bg-white text-black font-black text-sm px-4 rounded-xl flex items-center gap-2 disabled:opacity-50">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {candidates.length ? 'Шукати ще' : 'Знайти фото'}
        </button>
      </div>
      {loading && <p className="text-xs text-zinc-400">Шукаю в Google і перевіряю кожне фото через ШІ — до хвилини…</p>}
      {error && <p className="text-sm text-red-400 flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}
      {candidates.length > 0 && <CandidatesPicker product={product} candidates={candidates} maxPhotos={maxPhotos} onDone={onDone} />}
    </div>
  );
};


/**
 * Quick review: every pre-checked photo in one grid, all ticked. Untick bad ones, press "Save" —
 * ticked photos are attached at once (they were copied to our storage in advance), a product with
 * no ticked photo is marked "no good photo". 60 products per page.
 */
const PAGE = 60;
/** true if the browser can really load and show the picture (3 attempts) */
const imageOpens = async (url: string) => {
  for (let i = 0; i < 3; i++) {
    const ok = await new Promise<boolean>(res => {
      const img = new Image(); const timer = setTimeout(() => res(false), 15000);
      img.onload = () => { clearTimeout(timer); res(img.naturalWidth >= 100 && img.naturalHeight >= 100); };
      img.onerror = () => { clearTimeout(timer); res(false); };
      img.src = url + (i ? `?r=${i}` : '');
    });
    if (ok) return true;
    await new Promise(r => setTimeout(r, 700 * (i + 1)));
  }
  return false;
};
const QuickReview: React.FC<{ onChanged: () => void; waiting: number }> = ({ onChanged, waiting }) => {
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  // photos the browser could not show (after retries): they can never be saved
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [tries, setTries] = useState<Record<string, number>>({});
  const onImgError = (url: string) => {
    const n = (tries[url] || 0) + 1;
    if (n > 3) { setFailed(f => new Set(f).add(url)); return; }
    setTimeout(() => setTries(t => ({ ...t, [url]: n })), 800 * n); // try again a bit later
  };

  const load = useCallback(async () => {
    setLoading(true); setFailed(new Set()); setTries({});
    const { data, count } = await supabase.from('tyres').select('id, title, manufacturer, photo_candidates', { count: 'exact' })
      .eq('photo_review', true).order('id').range(0, PAGE - 1);
    setItems((data as Product[]) || []); setTotal(count || 0); setOff(new Set()); setLoading(false);
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => { load(); }, [load]);
  // the background search found new photos: show them at once if the list is empty, otherwise just update the counter
  useEffect(() => {
    if (saving || loading) return;
    if (!items.length && waiting > 0) load();
    else if (items.length && waiting > total) setTotal(waiting);
  }, [waiting]); // eslint-disable-line react-hooks/exhaustive-deps

  const tiles = items.flatMap(p => (p.photo_candidates || []).filter(c => c.stored).map((c, i) => ({ p, c, first: i === 0 })));
  const toggle = (url: string) => setOff(s => { const n = new Set(s); n.has(url) ? n.delete(url) : n.add(url); return n; });
  const keepCount = tiles.filter(t => !off.has(t.c.url) && !failed.has(t.c.url)).length;

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      // control: every photo that is going to be saved must really open in the browser
      const kept = tiles.filter(t => !off.has(t.c.url) && !failed.has(t.c.url));
      const broken = new Set<string>(failed);
      let next = 0;
      await Promise.all(Array.from({ length: 6 }, async () => {
        while (next < kept.length) { const t = kept[next++]; if (!(await imageOpens(t.c.stored!.full))) broken.add(t.c.url); }
      }));
      setFailed(broken);
      const payload = items.map(p => {
        const chosen = (p.photo_candidates || []).filter(c => c.stored && !off.has(c.url));
        const good = chosen.filter(c => !broken.has(c.url));
        // all chosen photos turned out broken → the product is not touched and stays for the next check
        return chosen.length && !good.length ? null : { product_id: p.id, urls: good.map(c => c.url) };
      }).filter(Boolean);
      const r = await call({ action: 'staff.bulk_save', items: payload });
      setMsg(`Збережено: ${r.attached} товарів з фото, ${r.rejected} без фото${broken.size ? `. Фото, що не відкрились (не збережено): ${broken.size}` : ''}`);
      onChanged(); await load();
    } catch (e: any) { setMsg(`Помилка: ${e.message}`); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#FFC300]" /></div>;
  if (!items.length) return <p className="text-zinc-500 text-sm text-center py-6">Немає фото на перевірку. Запустіть пошук у кроці 1.{msg && <><br /><span className="text-green-400">{msg}</span></>}</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">
        Товари {Math.min(PAGE, items.length)} з {total}. Усі фото відмічені — <b className="text-white">натисніть на погане фото</b>, щоб зняти галочку.
        Товар без жодної галочки отримає позначку «немає гарного фото».
      </p>
      {msg && <p className="text-sm text-green-400">{msg}</p>}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-2">
        {tiles.map(({ p, c, first }) => {
          const bad = failed.has(c.url);
          const on = !off.has(c.url) && !bad;
          const n = tries[c.url] || 0;
          return (
            <button key={p.id + c.url} type="button" onClick={() => !bad && toggle(c.url)} title={p.title}
              className={`relative rounded-lg overflow-hidden border-2 text-left transition-all ${on ? 'border-green-600' : 'border-red-600 opacity-40'}`}>
              <div className="aspect-square bg-white">
                {bad
                  ? <span className="w-full h-full flex items-center justify-center text-center text-[10px] font-bold text-red-600 p-1">Фото не відкрилось — не буде збережено</span>
                  : <img key={n} src={c.stored!.thumb + (n ? `?r=${n}` : '')} alt="" loading="lazy" onError={() => onImgError(c.url)} className="w-full h-full object-contain" />}
              </div>
              <span className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center ${on ? 'bg-green-600' : 'bg-red-600'} text-white`}>{on ? <Check size={12} /> : <X size={12} />}</span>
              <span className={`block px-1 py-0.5 text-[10px] leading-tight line-clamp-2 min-h-[2.2em] ${first ? 'text-zinc-200' : 'text-zinc-600'} bg-zinc-950`}>{first ? p.title : '↳ інший ракурс'}</span>
            </button>
          );
        })}
      </div>
      <div className="sticky bottom-20 md:bottom-4 z-10 flex flex-wrap items-center gap-3 bg-zinc-950/95 backdrop-blur border border-zinc-800 rounded-2xl p-3">
        <button onClick={save} disabled={saving} className="bg-[#FFC300] hover:bg-white text-black font-black text-sm px-5 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Зберегти {total > items.length ? 'і далі' : ''}
        </button>
        <span className="text-xs text-zinc-400">Залишаю {keepCount} фото, знято {off.size}{failed.size ? `, не відкрились: ${failed.size}` : ''}{saving ? ' — перевіряю, що всі фото відкриваються…' : ''}</span>
      </div>
    </div>
  );
};

/** Start a photo search for a chosen category and amount; shows the progress of the background job. */
const LaunchPanel: React.FC<{ onProgress: () => void }> = ({ onProgress }) => {
  const { categories } = useCategories({ includeInactive: true });
  const [stats, setStats] = useState<Record<number, number>>({});
  const [status, setStatus] = useState<any>(null);
  const [category, setCategory] = useState<string>('');
  const [amount, setAmount] = useState<string>('100');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    const [{ data: st }, { data: rows }] = await Promise.all([supabase.rpc('photo_status_staff'), supabase.rpc('photo_category_stats')]);
    setStatus(st);
    setStats(Object.fromEntries(((rows as any[]) || []).map(r => [Number(r.category_id), Number(r.without_photo)])));
  }, []);
  useEffect(() => { refresh(); const t = setInterval(() => { refresh(); onProgress(); }, 20000); return () => clearInterval(t); }, [refresh, onProgress]);

  // goods without a photo in a category including its subcategories
  const total = (id: number): number => (stats[id] || 0) + categories.filter(c => c.parent_id === id).reduce((s, c) => s + total(c.id), 0);
  const all = (Object.values(stats) as number[]).reduce((a, b) => a + b, 0);
  const roots = categories.filter(c => !c.parent_id && total(c.id) > 0).sort((a, b) => total(b.id) - total(a.id));
  const available = category ? total(Number(category)) : all;

  const start = async () => {
    setBusy(true); setMsg('');
    const { data, error } = await supabase.rpc('photo_queue', { p_category: category ? Number(category) : null, p_limit: amount === 'all' ? 100000 : Number(amount) });
    setMsg(error ? `Помилка: ${error.message}` : data ? `Запущено: ${data} товарів у черзі. Фото з'являтимуться у «Швидкій перевірці».` : 'У цій категорії немає товарів без фото.');
    setBusy(false); refresh();
  };
  const stop = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('photo_queue_stop');
    setMsg(error ? `Помилка: ${error.message}` : `Зупинено. Знято з черги: ${data}.`);
    setBusy(false); refresh();
  };

  const left = (status?.to_search || 0) + (status?.to_download || 0);
  const running = status?.running && left > 0;
  const field = 'mt-1 w-full bg-black border border-zinc-700 rounded-xl px-3 h-11 text-sm text-white outline-none focus:border-[#FFC300]';
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-[1fr_150px_auto] gap-3 items-end">
        <label className="text-xs text-zinc-400">Категорія
          <select value={category} onChange={e => setCategory(e.target.value)} className={field}>
            <option value="">Усі категорії — {all} без фото</option>
            {roots.map(r => (
              <optgroup key={r.id} label={r.name}>
                <option value={r.id}>{r.name} — усе ({total(r.id)})</option>
                {categories.filter(c => c.parent_id === r.id && total(c.id) > 0).sort((a, b) => total(b.id) - total(a.id))
                  .map(c => <option key={c.id} value={c.id}>  {c.name} ({total(c.id)})</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-400">Скільки товарів
          <select value={amount} onChange={e => setAmount(e.target.value)} className={field}>
            {['50', '100', '200', '500', '1000'].map(n => <option key={n} value={n}>{n}</option>)}
            <option value="all">Усі ({available})</option>
          </select>
        </label>
        <button onClick={start} disabled={busy || available === 0} className="h-11 bg-[#FFC300] hover:bg-white text-black font-black text-sm px-6 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Знайти фото
        </button>
      </div>
      {running ? (
        <div className="flex flex-wrap items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2.5">
          <Loader2 size={16} className="animate-spin text-green-400 shrink-0" />
          <p className="text-sm text-green-300 flex-1 min-w-[200px]">Пошук іде — залишилось <b>{left}</b> товарів (приблизно {Math.max(1, Math.ceil(left / 30))} хв). Сторінку можна закрити, фото з'являться у кроці 2.</p>
          <button onClick={stop} disabled={busy} className="shrink-0 bg-zinc-800 hover:bg-red-600 text-white font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5"><Square size={12} /> Зупинити</button>
        </div>
      ) : msg ? <p className="text-sm text-zinc-300">{msg}</p> : null}
    </div>
  );
};

const PhotoFinderTab: React.FC = () => {
  const [settings, setSettings] = useState<SettingsState>(DEFAULTS);
  const [savedMsg, setSavedMsg] = useState('');
  const [view, setView] = useState<'quick' | 'queue' | 'search'>('quick');
  const [queue, setQueue] = useState<Product[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [stats, setStats] = useState({ withAuto: 0, without: 0 });
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [picked, setPicked] = useState<Product | null>(null);
  const maxPhotos = Number(settings.photo_finder_max_photos) || 3;
  const FIELDS = 'id, title, manufacturer, catalog_number, image_url, gallery, photo_candidates, photo_auto';

  const loadQueue = useCallback(async () => {
    setLoading(true);
    const [{ data, count }, a, b] = await Promise.all([
      supabase.from('tyres').select(FIELDS, { count: 'exact' }).eq('photo_review', true).order('stock_quantity', { ascending: false }).limit(10),
      supabase.from('tyres').select('id', { count: 'exact', head: true }).eq('photo_auto', true),
      supabase.from('tyres').select('id', { count: 'exact', head: true }).not('program_product_id', 'is', null).neq('in_stock', false).is('image_url', null),
    ]);
    setQueue((data as Product[]) || []); setQueueCount(count || 0);
    setStats({ withAuto: a.count || 0, without: b.count || 0 });
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.from('settings').select('key, value').in('key', SETTINGS as unknown as string[]).then(({ data }) => {
      const next = { ...DEFAULTS };
      (data || []).forEach((r: any) => { (next as any)[r.key] = String(r.value ?? ''); });
      setSettings(next);
    });
    loadQueue();
  }, [loadQueue]);

  const saveSettings = async () => {
    const { error } = await supabase.from('settings').upsert(Object.entries(settings).map(([key, value]) => ({ key, value })));
    setSavedMsg(error ? `Помилка: ${error.message}` : 'Збережено'); setTimeout(() => setSavedMsg(''), 2500);
  };
  const set = (k: keyof SettingsState, v: string) => setSettings(s => ({ ...s, [k]: v }));

  const doSearch = async () => {
    const t = term.trim();
    if (t.length < 2) return;
    const s = t.replace(/[,()]/g, ' ');
    const { data } = await supabase.from('tyres').select(FIELDS).or(`title.ilike.%${s}%,catalog_number.ilike.%${s}%,search_numbers.ilike.%${s.toUpperCase().replace(/[^0-9A-ZА-ЯІЇЄҐ]/g, '')}%`).limit(20);
    setResults((data as Product[]) || []); setPicked(null);
  };

  const [showSettings, setShowSettings] = useState(false);
  const [notFound, setNotFound] = useState(0);
  useEffect(() => { supabase.rpc('photo_status_staff').then(({ data }) => setNotFound(Number((data as any)?.not_found) || 0)); }, [queueCount]);

  const toggleCls = (on: boolean) => `px-3 h-9 rounded-lg text-xs font-bold ${on ? 'bg-[#FFC300] text-black' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;
  const card = 'bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-5';
  const stepTitle = (n: number, text: string, extra?: React.ReactNode) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4">
      <span className="w-7 h-7 shrink-0 rounded-full bg-[#FFC300] text-black font-black text-sm flex items-center justify-center">{n}</span>
      <h3 className="text-base font-black text-white flex-1 min-w-[60%] sm:min-w-0">{text}</h3>
      {extra}
    </div>
  );
  const summary = [
    settings.photo_finder_mode === 'auto' ? 'закріплювати без перевірки' : 'показувати мені перед збереженням',
    `до ${maxPhotos} фото на товар`,
    settings.photo_finder_white_bg !== '0' ? 'білий фон' : '',
    settings.photo_finder_no_text !== '0' ? 'без написів' : '',
    `від ${settings.photo_finder_min_size || '600'}px`,
  ].filter(Boolean).join(' · ');
  const stat = (label: string, value: number, accent = false) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3">
      <p className={`text-2xl font-black leading-none ${accent && value > 0 ? 'text-[#FFC300]' : 'text-white'}`}>{value}</p>
      <p className="text-[11px] text-zinc-500 mt-1.5 leading-tight">{label}</p>
    </div>
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-300 max-w-6xl">
      <div>
        <h2 className="text-2xl font-black text-white flex items-center gap-2"><Sparkles className="text-[#FFC300]" /> Фото ШІ</h2>
        <p className="text-zinc-400 text-sm mt-1">ШІ шукає фото товарів в інтернеті, ви переглядаєте й зберігаєте.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stat('чекають вашої перевірки', queueCount, true)}
        {stat('товарів уже з фото від ШІ', stats.withAuto)}
        {stat('товарів ще без фото', stats.without)}
        {stat('гарного фото не знайдено', notFound)}
      </div>

      {/* Step 1 */}
      <div className={card}>
        {stepTitle(1, 'Знайти фото')}
        <LaunchPanel onProgress={loadQueue} />
        <div className="mt-4 pt-3 border-t border-zinc-800">
          <button onClick={() => setShowSettings(v => !v)} className="w-full flex items-center gap-2 text-left text-xs text-zinc-400 hover:text-white">
            <Settings2 size={14} className="shrink-0" />
            <span className="flex-1"><b className="text-zinc-300">Налаштування:</b> {summary}</span>
            <span className="shrink-0 text-[#FFC300] font-bold">{showSettings ? 'Згорнути' : 'Змінити'}</span>
          </button>
          {showSettings && (
            <div className="mt-4 space-y-4">
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <p className="text-zinc-300 text-xs font-bold mb-1.5">Що робити зі знайденими фото</p>
                  <div className="flex gap-1.5">
                    <button onClick={() => set('photo_finder_mode', 'review')} className={toggleCls(settings.photo_finder_mode !== 'auto')}>Показати мені</button>
                    <button onClick={() => set('photo_finder_mode', 'auto')} className={toggleCls(settings.photo_finder_mode === 'auto')}>Закріпити без перевірки</button>
                  </div>
                </div>
                <div>
                  <p className="text-zinc-300 text-xs font-bold mb-1.5">Скільки фото на один товар</p>
                  <div className="flex gap-1.5">{['1', '2', '3', '4', '5'].map(n => <button key={n} onClick={() => set('photo_finder_max_photos', n)} className={`${toggleCls(settings.photo_finder_max_photos === n)} w-9 !px-0`}>{n}</button>)}</div>
                </div>
                <div>
                  <p className="text-zinc-300 text-xs font-bold mb-1.5">Вимоги до фото</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => set('photo_finder_white_bg', settings.photo_finder_white_bg === '0' ? '1' : '0')} className={toggleCls(settings.photo_finder_white_bg !== '0')}>Тільки білий фон</button>
                    <button onClick={() => set('photo_finder_no_text', settings.photo_finder_no_text === '0' ? '1' : '0')} className={toggleCls(settings.photo_finder_no_text !== '0')}>Без написів і водяних знаків</button>
                  </div>
                </div>
                <div>
                  <p className="text-zinc-300 text-xs font-bold mb-1.5">Мінімальний розмір фото</p>
                  <div className="flex gap-1.5">{['400', '600', '800'].map(n => <button key={n} onClick={() => set('photo_finder_min_size', n)} className={toggleCls(settings.photo_finder_min_size === n)}>{n}px</button>)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={saveSettings} className="h-10 bg-white hover:bg-[#FFC300] text-black font-black text-sm px-4 rounded-xl flex items-center gap-2"><Save size={16} /> Зберегти налаштування</button>
                {savedMsg && <span className="text-sm text-green-400">{savedMsg}</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step 2 */}
      <div className={card}>
        {stepTitle(2, `Перевірити знайдені фото${queueCount ? ` (${queueCount})` : ''}`,
          <select value={view} onChange={e => setView(e.target.value as typeof view)} aria-label="Спосіб перевірки"
            className="bg-black border border-zinc-700 rounded-lg px-2 h-9 text-xs text-zinc-300 outline-none focus:border-[#FFC300]">
            <option value="quick">Усі разом (швидко)</option>
            <option value="queue">По одному товару</option>
            <option value="search">Знайти фото для одного товару</option>
          </select>)}

      {view === 'quick' ? <QuickReview onChanged={loadQueue} waiting={queueCount} /> : view === 'queue' ? (
        loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#FFC300]" /></div>
        : queue.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-6">Немає фото на перевірку.</p>
        ) : (
          <div className="space-y-4">
            {queue.map(p => <ProductPhotos key={p.id} product={p} maxPhotos={maxPhotos} onDone={loadQueue} />)}
            {queueCount > queue.length && <p className="text-center text-xs text-zinc-500">Показано {queue.length} з {queueCount}. Після обробки підвантажаться наступні.</p>}
          </div>
        )
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input value={term} onChange={e => setTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder="Назва, артикул або номер товару" className="w-full bg-black border border-zinc-700 rounded-xl pl-9 pr-3 h-11 text-sm text-white outline-none focus:border-[#FFC300]" />
            </div>
            <button onClick={doSearch} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm px-4 rounded-xl">Знайти</button>
          </div>
          {!picked && results.length > 0 && (
            <div className="bg-black/40 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
              {results.map(p => (
                <button key={p.id} onClick={() => setPicked(p)} className="w-full text-left flex items-center gap-3 p-3 hover:bg-zinc-800/60">
                  <div className="w-10 h-10 shrink-0 rounded bg-white overflow-hidden flex items-center justify-center">
                    {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-contain" /> : <ImageOff size={14} className="text-zinc-400" />}
                  </div>
                  <span className="text-sm text-white">{p.title}</span>
                </button>
              ))}
            </div>
          )}
          {picked && (
            <>
              <button onClick={() => setPicked(null)} className="text-xs text-zinc-400 hover:text-white">← до результатів</button>
              <ProductPhotos product={picked} maxPhotos={maxPhotos} onDone={() => { setPicked(null); loadQueue(); }} />
            </>
          )}
        </div>
      )}
      </div>
    </div>
  );
};

export default PhotoFinderTab;
