import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles, Search, Loader2, Check, X, ImageOff, RefreshCw, Save, Settings2, ExternalLink, AlertCircle } from 'lucide-react';
import { supabase } from '../../supabaseClient';

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
const QuickReview: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, count } = await supabase.from('tyres').select('id, title, manufacturer, photo_candidates', { count: 'exact' })
      .eq('photo_review', true).order('id').range(0, PAGE - 1);
    setItems((data as Product[]) || []); setTotal(count || 0); setOff(new Set()); setLoading(false);
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => { load(); }, [load]);

  const tiles = items.flatMap(p => (p.photo_candidates || []).filter(c => c.stored).map((c, i) => ({ p, c, first: i === 0 })));
  const toggle = (url: string) => setOff(s => { const n = new Set(s); n.has(url) ? n.delete(url) : n.add(url); return n; });
  const keepCount = tiles.filter(t => !off.has(t.c.url)).length;

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const payload = items.map(p => ({ product_id: p.id, urls: (p.photo_candidates || []).filter(c => c.stored && !off.has(c.url)).map(c => c.url) }));
      const r = await call({ action: 'staff.bulk_save', items: payload });
      setMsg(`Збережено: ${r.attached} товарів з фото, ${r.rejected} без фото`);
      onChanged(); await load();
    } catch (e: any) { setMsg(`Помилка: ${e.message}`); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#FFC300]" /></div>;
  if (!items.length) return <p className="text-zinc-500 text-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">Немає фото на перевірку.{msg && <><br /><span className="text-green-400">{msg}</span></>}</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">
        Товари {Math.min(PAGE, items.length)} з {total}. Усі фото відмічені — <b className="text-white">натисніть на погане фото</b>, щоб зняти галочку.
        Товар без жодної галочки отримає позначку «немає гарного фото».
      </p>
      {msg && <p className="text-sm text-green-400">{msg}</p>}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-2">
        {tiles.map(({ p, c, first }) => {
          const on = !off.has(c.url);
          return (
            <button key={p.id + c.url} type="button" onClick={() => toggle(c.url)} title={p.title}
              className={`relative rounded-lg overflow-hidden border-2 text-left transition-all ${on ? 'border-green-600' : 'border-red-600 opacity-40'}`}>
              <div className="aspect-square bg-white"><img src={c.stored!.thumb} alt="" loading="lazy" className="w-full h-full object-contain" /></div>
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
        <span className="text-xs text-zinc-400">Залишаю {keepCount} фото, знято {off.size}</span>
      </div>
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

  const toggleCls = (on: boolean) => `px-3 py-1.5 rounded-lg text-xs font-bold ${on ? 'bg-[#FFC300] text-black' : 'bg-zinc-800 text-zinc-300'}`;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2"><Sparkles className="text-[#FFC300]" /> Фото ШІ</h2>
          <p className="text-zinc-400 text-sm mt-1">Пошук фото товарів у Google з перевіркою ШІ: той самий товар, білий фон, без написів, чітке фото.</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">На перевірку: <b className="text-[#FFC300]">{queueCount}</b></span>
          <span className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">З авто-фото: <b className="text-white">{stats.withAuto}</b></span>
          <span className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">Без фото: <b className="text-white">{stats.without}</b></span>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2 mb-3"><Settings2 size={16} /> Налаштування фонового пошуку</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-zinc-400 text-xs mb-1.5">Що робити зі знайденими фото</p>
            <div className="flex gap-1.5">
              <button onClick={() => set('photo_finder_mode', 'review')} className={toggleCls(settings.photo_finder_mode !== 'auto')}>Показати мені</button>
              <button onClick={() => set('photo_finder_mode', 'auto')} className={toggleCls(settings.photo_finder_mode === 'auto')}>Закріпити самі</button>
            </div>
          </div>
          <div>
            <p className="text-zinc-400 text-xs mb-1.5">Фото на товар (ракурси)</p>
            <div className="flex gap-1.5">{['1', '2', '3', '4', '5'].map(n => <button key={n} onClick={() => set('photo_finder_max_photos', n)} className={toggleCls(settings.photo_finder_max_photos === n)}>{n}</button>)}</div>
          </div>
          <div>
            <p className="text-zinc-400 text-xs mb-1.5">Вимоги</p>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => set('photo_finder_white_bg', settings.photo_finder_white_bg === '0' ? '1' : '0')} className={toggleCls(settings.photo_finder_white_bg !== '0')}>Білий фон</button>
              <button onClick={() => set('photo_finder_no_text', settings.photo_finder_no_text === '0' ? '1' : '0')} className={toggleCls(settings.photo_finder_no_text !== '0')}>Без написів</button>
            </div>
          </div>
          <div>
            <p className="text-zinc-400 text-xs mb-1.5">Мінімальний розмір фото</p>
            <div className="flex gap-1.5">{['400', '600', '800'].map(n => <button key={n} onClick={() => set('photo_finder_min_size', n)} className={toggleCls(settings.photo_finder_min_size === n)}>{n}px</button>)}</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={saveSettings} className="bg-white hover:bg-[#FFC300] text-black font-black text-sm px-4 py-2 rounded-xl flex items-center gap-2"><Save size={16} /> Зберегти</button>
          {savedMsg && <span className="text-sm text-green-400">{savedMsg}</span>}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setView('quick')} className={toggleCls(view === 'quick')}>Швидка перевірка ({queueCount})</button>
        <button onClick={() => setView('queue')} className={toggleCls(view === 'queue')}>По одному</button>
        <button onClick={() => setView('search')} className={toggleCls(view === 'search')}>Пошук для товару</button>
        {view === 'queue' && <button onClick={loadQueue} className="ml-auto text-zinc-400 hover:text-white text-xs flex items-center gap-1"><RefreshCw size={14} /> Оновити</button>}
      </div>

      {view === 'quick' ? <QuickReview onChanged={loadQueue} /> : view === 'queue' ? (
        loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#FFC300]" /></div>
        : queue.length === 0 ? (
          <p className="text-zinc-500 text-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
            Черга порожня. Тут з'являтимуться товари, для яких фоновий пошук знайшов фото (у режимі «Показати мені»).
          </p>
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
                placeholder="Назва, артикул або номер товару" className="w-full bg-black border border-zinc-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white outline-none focus:border-[#FFC300]" />
            </div>
            <button onClick={doSearch} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm px-4 rounded-xl">Знайти</button>
          </div>
          {!picked && results.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
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
  );
};

export default PhotoFinderTab;
