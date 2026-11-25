import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, Trash2, Plus, Sparkles, Hand, AlertTriangle, CheckCircle, ExternalLink, EyeOff } from 'lucide-react';
import { supabase } from '../../supabaseClient';

/**
 * Extra SEO settings: health check, AI / manual mode, title templates, section texts and hiding,
 * redirects, shop hours, Google / Facebook counters. The site's server pages read these settings.
 */
export type SeoView = 'health' | 'mode' | 'templates' | 'sections' | 'redirects' | 'local' | 'counters';
export const SEO_VIEWS: { id: SeoView; label: string }[] = [
  { id: 'health', label: 'Перевірка' },
  { id: 'mode', label: 'ШІ або вручну' },
  { id: 'templates', label: 'Шаблони' },
  { id: 'sections', label: 'Розділи' },
  { id: 'redirects', label: 'Перенаправлення' },
  { id: 'local', label: 'Магазин' },
  { id: 'counters', label: 'Google і лічильники' },
];

interface Cat { id: number; name: string; parent_id: number | null; is_active: boolean; description: string | null; seo_title: string | null; seo_description: string | null; noindex: boolean }

const box = 'bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6 space-y-4';
const input = 'w-full bg-black border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#FFC300]';
const lbl = 'block text-xs text-zinc-400 mb-1';
const btn = 'inline-flex items-center gap-2 bg-[#FFC300] text-black font-black text-sm rounded-xl px-4 py-2.5 disabled:opacity-50';
const hint = 'text-xs text-zinc-500 leading-relaxed';

const useSettings = (keys: string[]) => {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const keyStr = keys.join(',');
  useEffect(() => {
    supabase.from('settings').select('key, value').in('key', keyStr.split(',')).then(({ data }) =>
      setVals(Object.fromEntries((data || []).map((r: any) => [r.key, String(r.value ?? '')]))));
  }, [keyStr]);
  const set = (k: string, v: string) => setVals(s => ({ ...s, [k]: v }));
  const save = async (only?: Record<string, string>) => {
    setSaving(true);
    const rows = Object.entries(only || vals).filter(([k]) => keyStr.split(',').includes(k) || only).map(([key, value]) => ({ key, value: String(value).trim() }));
    const { error } = await supabase.from('settings').upsert(rows);
    setMsg(error ? `Помилка: ${error.message}` : 'Збережено ✓'); setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };
  return { vals, set, save, msg, saving };
};

const useCats = () => {
  const [cats, setCats] = useState<Cat[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase.from('product_categories').select('id, name, parent_id, is_active, description, seo_title, seo_description, noindex').order('sort_order');
    setCats((data as Cat[]) || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  return { cats, setCats, load };
};

// ---------------- health ----------------
const Health: React.FC<{ onOpen: (v: string) => void }> = ({ onOpen }) => {
  const [h, setH] = useState<any>(null);
  useEffect(() => { supabase.rpc('seo_health').then(({ data }) => setH(data)); }, []);
  if (!h) return <div className={box}><Loader2 className="animate-spin text-zinc-500" /></div>;
  const pct = (n: number) => (h.products ? Math.round((n / h.products) * 100) : 0);
  const rows: { n: number; text: string; fix: string; go?: string; bad?: boolean }[] = [
    { n: h.no_seo_title, text: `товарів без власного заголовка для Google (${pct(h.no_seo_title)}%)`, fix: 'Увімкніть режим «ШІ» або задайте шаблон — тоді заголовок буде у всіх.', go: 'mode' },
    { n: h.no_seo_desc, text: 'товарів без опису для Google', fix: 'Те саме: режим «ШІ» або шаблон опису.', go: 'templates' },
    { n: h.dup_products, text: `товарів з однаковими заголовками (${h.dup_groups} груп)`, fix: `Google вважає їх копіями. Найчастіші: ${(h.dup_examples || []).slice(0, 3).join('; ')}. Приберіть дублі в програмі.`, bad: true },
    { n: h.long_title, text: 'заголовків довших за 70 символів (Google обріже)', fix: 'Скоротіть у «Товар вручну».', go: 'products' },
    { n: h.short_desc, text: 'занадто коротких описів для Google', fix: 'Краще 140–160 символів.' },
    { n: h.thin, text: 'товарів без фото і без тексту — Google показує їх гірше', fix: 'Фото ШІ та описи в програмі.' },
    { n: h.cats_no_title, text: `розділів без заголовка для Google (з ${h.cats})`, fix: 'Заповніть у «Розділи» або увімкніть ШІ.', go: 'sections' },
    { n: h.cats_no_text, text: 'розділів без тексту на сторінці', fix: 'Текст унизу сторінки розділу допомагає потрапити в пошук.', go: 'sections' },
  ];
  const score = Math.max(0, 100 - Math.round(pct(h.no_seo_title) * 0.3 + pct(h.dup_products) * 0.4 + pct(h.thin) * 0.2 + (h.cats ? (h.cats_no_text / h.cats) * 10 : 0)));
  return (
    <div className="space-y-4">
      <div className={`${box} flex items-center gap-5`}>
        <div className={`text-5xl font-black ${score >= 80 ? 'text-green-400' : score >= 50 ? 'text-[#FFC300]' : 'text-red-400'}`}>{score}</div>
        <div><div className="text-white font-black">Оцінка SEO зі 100</div><p className={hint}>Перевірено {h.products} товарів у наявності та {h.cats} розділів. Приховано від Google розділів: {h.cats_hidden}. Перенаправлень: {h.redirects}.{h.ai_done ? ` ШІ вже заповнив: ${h.ai_done}.` : ''}</p></div>
      </div>
      <div className={box}>
        {rows.map((r, i) => (
          <div key={i} className="flex gap-3 items-start border-b border-zinc-800 last:border-0 pb-3 last:pb-0">
            {r.n ? <AlertTriangle size={18} className={r.bad ? 'text-red-400 shrink-0 mt-0.5' : 'text-[#FFC300] shrink-0 mt-0.5'} /> : <CheckCircle size={18} className="text-green-400 shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white"><b>{r.n}</b> {r.text}</div>
              {r.n > 0 && <p className={hint}>{r.fix}</p>}
            </div>
            {r.n > 0 && r.go && <button onClick={() => onOpen(r.go!)} className="text-xs font-bold text-[#FFC300] shrink-0">Виправити →</button>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------- AI / manual ----------------
const Mode: React.FC = () => {
  const s = useSettings(['seo_mode']);
  const mode = s.vals.seo_mode === 'ai' ? 'ai' : 'manual';
  const pick = (m: string) => { s.set('seo_mode', m); s.save({ seo_mode: m }); };
  const card = (id: string, icon: React.ReactNode, title: string, text: string) => (
    <button onClick={() => pick(id)} className={`text-left rounded-2xl border-2 p-4 transition ${mode === id ? 'border-[#FFC300] bg-[#FFC300]/10' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'}`}>
      <div className="flex items-center gap-2 text-white font-black">{icon}{title}{mode === id && <CheckCircle size={16} className="text-[#FFC300] ml-auto" />}</div>
      <p className={`${hint} mt-2`}>{text}</p>
    </button>
  );
  return (
    <div className={box}>
      <div className="text-white font-black text-lg">Хто заповнює SEO</div>
      <div className="grid sm:grid-cols-2 gap-3">
        {card('ai', <Sparkles size={18} className="text-[#FFC300]" />, 'ШІ автоматично', 'Кожні 10 хвилин ШІ пише заголовок і опис для Google до 25 товарів і 10 розділів, де їх ще немає, і одразу публікує. Те, що ви написали вручну, ШІ не чіпає. Описи товарів на сайті не пише — вони з програми.')}
        {card('manual', <Hand size={18} className="text-[#FFC300]" />, 'Вручну', 'ШІ нічого сам не робить. Для товарів без заголовка сайт бере шаблон (вкладка «Шаблони»). Ви правите товари у «Товар вручну», а розділи — у «Розділи».')}
      </div>
      <p className={hint}>ШІ працює на вашому ключі Gemini. Один товар коштує частки цента, усі ~7000 товарів — орієнтовно до 1–2 $. Вимкнути можна будь-коли, натиснувши «Вручну».</p>
      {s.msg && <div className="text-sm text-green-400">{s.msg}</div>}
    </div>
  );
};

// ---------------- templates ----------------
const VARS = ['{назва}', '{бренд}', '{ціна}', '{артикул}', '{категорія}', '{розділ}', '{місто}', '{магазин}'];
const Templates: React.FC = () => {
  const { cats } = useCats();
  const roots = cats.filter(c => !c.parent_id && c.is_active);
  const keys = ['seo_tpl_title', 'seo_tpl_desc', ...roots.flatMap(r => [`seo_tpl_title_${r.id}`, `seo_tpl_desc_${r.id}`])];
  const s = useSettings(keys);
  const [focus, setFocus] = useState('seo_tpl_title');
  const sample = (t: string) => t.replace(/\{назва\}/g, 'Michelin Alpin 6 205/55 R16 91H').replace(/\{бренд\}/g, 'Michelin').replace(/\{ціна\}/g, '4250')
    .replace(/\{артикул\}/g, '123456').replace(/\{категорія\}/g, 'Зимові шини').replace(/\{розділ\}/g, 'Шини').replace(/\{місто\}/g, 'Синельникове').replace(/\{магазин\}/g, 'Форсаж');
  const pair = (suffix: string, name: string) => (
    <div className="space-y-2 border-t border-zinc-800 pt-4 first:border-0 first:pt-0" key={suffix || 'all'}>
      <div className="text-white font-bold text-sm">{name}</div>
      <div><label className={lbl}>Заголовок у Google</label>
        <input className={input} value={s.vals[`seo_tpl_title${suffix}`] || ''} onFocus={() => setFocus(`seo_tpl_title${suffix}`)} onChange={e => s.set(`seo_tpl_title${suffix}`, e.target.value)} placeholder={suffix ? 'порожньо — як для всіх товарів' : '{назва} — купити в {місто}, ціна {ціна} грн | {магазин}'} />
        {s.vals[`seo_tpl_title${suffix}`] && <p className="text-[11px] text-blue-300 mt-1">Приклад: {sample(s.vals[`seo_tpl_title${suffix}`])}</p>}</div>
      <div><label className={lbl}>Опис у Google</label>
        <textarea rows={2} className={input} value={s.vals[`seo_tpl_desc${suffix}`] || ''} onFocus={() => setFocus(`seo_tpl_desc${suffix}`)} onChange={e => s.set(`seo_tpl_desc${suffix}`, e.target.value)} placeholder={suffix ? 'порожньо — як для всіх товарів' : 'Купити {назва} за {ціна} грн у магазині {магазин}. Самовивіз у {місто}, доставка Новою Поштою по Україні.'} />
        {s.vals[`seo_tpl_desc${suffix}`] && <p className="text-[11px] text-blue-300 mt-1">Приклад: {sample(s.vals[`seo_tpl_desc${suffix}`])}</p>}</div>
    </div>
  );
  return (
    <div className={box}>
      <div className="text-white font-black text-lg">Шаблони заголовків</div>
      <p className={hint}>Шаблон потрібен для товарів, у яких немає свого заголовка (написаного вручну або ШІ). Натисніть на слово в дужках — воно вставиться в поле, де стоїть курсор. Шаблон розділу важливіший за загальний.</p>
      <div className="flex flex-wrap gap-1.5">{VARS.map(v => <button key={v} onClick={() => s.set(focus, `${(s.vals[focus] || '').trimEnd()} ${v}`.trim())} className="text-xs bg-zinc-800 text-zinc-200 rounded-lg px-2 py-1 hover:bg-zinc-700">{v}</button>)}</div>
      {pair('', 'Для всіх товарів')}
      {roots.map(r => pair(`_${r.id}`, `Розділ «${r.name}»`))}
      <div className="flex items-center gap-3"><button className={btn} disabled={s.saving} onClick={() => s.save()}><Save size={16} />Зберегти</button><span className="text-sm text-green-400">{s.msg}</span></div>
    </div>
  );
};

// ---------------- sections ----------------
const Sections: React.FC = () => {
  const { cats, setCats } = useCats();
  const [open, setOpen] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const upd = (id: number, patch: Partial<Cat>) => setCats(cs => cs.map(c => (c.id === id ? { ...c, ...patch } : c)));
  const save = async (c: Cat) => {
    const { error } = await supabase.from('product_categories').update({ seo_title: c.seo_title || null, seo_description: c.seo_description || null, description: c.description || null, noindex: c.noindex }).eq('id', c.id);
    setMsg(error ? `Помилка: ${error.message}` : `«${c.name}» збережено ✓`); setTimeout(() => setMsg(''), 3000);
  };
  const list = cats.filter(c => c.is_active);
  const ordered = list.filter(c => !c.parent_id).flatMap(r => [r, ...list.filter(c => c.parent_id === r.id)]);
  return (
    <div className={box}>
      <div className="text-white font-black text-lg">Розділи каталогу</div>
      <p className={hint}>Заголовок і опис для Google та текст унизу сторінки розділу. «Сховати від Google» — розділ лишається на сайті, але не потрапляє в пошук і карту сайту (для дрібних або службових розділів).</p>
      {msg && <div className="text-sm text-green-400">{msg}</div>}
      <div className="divide-y divide-zinc-800">
        {ordered.map(c => {
          const ok = !!c.seo_title && !!c.description;
          return (
            <div key={c.id} className="py-2">
              <button onClick={() => setOpen(open === c.id ? null : c.id)} className={`w-full flex items-center gap-2 text-left text-sm ${c.parent_id ? 'pl-4 text-zinc-300' : 'text-white font-bold'}`}>
                {ok ? <CheckCircle size={14} className="text-green-400 shrink-0" /> : <AlertTriangle size={14} className="text-[#FFC300] shrink-0" />}
                <span className="flex-1 truncate">{c.name}</span>
                {c.noindex && <EyeOff size={14} className="text-zinc-500" />}
              </button>
              {open === c.id && (
                <div className="mt-3 space-y-3 pl-6">
                  <div><label className={lbl}>Заголовок у Google <span className={(c.seo_title || '').length > 65 ? 'text-red-400' : ''}>{(c.seo_title || '').length}/65</span></label>
                    <input className={input} value={c.seo_title || ''} onChange={e => upd(c.id, { seo_title: e.target.value })} placeholder={`${c.name} — купити в Синельникове, ціни | Форсаж`} /></div>
                  <div><label className={lbl}>Опис у Google <span className={(c.seo_description || '').length > 160 ? 'text-red-400' : ''}>{(c.seo_description || '').length}/160</span></label>
                    <textarea rows={2} className={input} value={c.seo_description || ''} onChange={e => upd(c.id, { seo_description: e.target.value })} /></div>
                  <div><label className={lbl}>Текст на сторінці розділу</label>
                    <textarea rows={6} className={input} value={c.description || ''} onChange={e => upd(c.id, { description: e.target.value })} /></div>
                  <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={c.noindex} onChange={e => upd(c.id, { noindex: e.target.checked })} /> Сховати від Google</label>
                  <button className={btn} onClick={() => save(c)}><Save size={16} />Зберегти</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------- redirects ----------------
const toPath = (s: string) => { const t = s.trim(); try { return t.startsWith('http') ? new URL(t).pathname + new URL(t).search : t.startsWith('/') ? t : `/${t}`; } catch { return t; } };
const Redirects: React.FC = () => {
  const [rows, setRows] = useState<{ from_path: string; to_path: string; hits: number }[]>([]);
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [msg, setMsg] = useState('');
  const load = useCallback(async () => { const { data } = await supabase.from('seo_redirects').select('*').order('created_at', { ascending: false }); setRows((data as any) || []); }, []);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    const f = toPath(from).replace(/\/+$/, ''), t = toPath(to);
    if (!f || f === '/' || !t) { setMsg('Вкажіть обидві адреси'); return; }
    const { error } = await supabase.from('seo_redirects').upsert({ from_path: f, to_path: t });
    setMsg(error ? `Помилка: ${error.message}` : 'Додано ✓'); if (!error) { setFrom(''); setTo(''); load(); }
  };
  const del = async (f: string) => { await supabase.from('seo_redirects').delete().eq('from_path', f); load(); };
  return (
    <div className={box}>
      <div className="text-white font-black text-lg">Перенаправлення</div>
      <p className={hint}>Якщо стара сторінка більше не існує (товар видалено, змінилась адреса), людина з Google потрапить на нову, а не на помилку. Можна вставляти повні посилання — сайт сам візьме потрібну частину.</p>
      <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
        <input className={input} value={from} onChange={e => setFrom(e.target.value)} placeholder="Стара адреса, напр. /p/123-stara-shyna" />
        <input className={input} value={to} onChange={e => setTo(e.target.value)} placeholder="Нова адреса, напр. /katalog/shyny" />
        <button className={btn} onClick={add}><Plus size={16} />Додати</button>
      </div>
      {msg && <div className="text-sm text-green-400">{msg}</div>}
      <div className="divide-y divide-zinc-800">
        {rows.map(r => (
          <div key={r.from_path} className="py-2 flex items-center gap-2 text-xs">
            <span className="text-zinc-300 truncate flex-1">{r.from_path}</span><span className="text-zinc-500">→</span>
            <span className="text-white truncate flex-1">{r.to_path}</span>
            <span className="text-zinc-500 shrink-0" title="Скільки разів спрацювало">{r.hits}</span>
            <button onClick={() => del(r.from_path)} className="text-red-400 p-1"><Trash2 size={14} /></button>
          </div>
        ))}
        {!rows.length && <p className={hint}>Поки немає перенаправлень.</p>}
      </div>
    </div>
  );
};

// ---------------- shop ----------------
const DAYS: Record<string, string> = { 'Mo-Su': 'Щодня', 'Mo-Sa': 'Пн–Сб', 'Mo-Fr': 'Пн–Пт' };
const Local: React.FC = () => {
  const s = useSettings(['seo_hours', 'seo_founded']);
  const m = (s.vals.seo_hours || '').match(/^(Mo-\w\w) (\d\d:\d\d)-(\d\d:\d\d)$/);
  const [days, from, to] = m ? [m[1], m[2], m[3]] : ['Mo-Su', '08:00', '18:00'];
  const allDay = s.vals.seo_hours === 'Mo-Su 00:00-23:59';
  const setH = (d: string, f: string, t: string) => s.set('seo_hours', `${d} ${f}-${t}`);
  return (
    <div className={box}>
      <div className="text-white font-black text-lg">Магазин для Google Карт</div>
      <p className={hint}>Години роботи та рік відкриття потрапляють у дані для Google (у пошуку і на картах). Адреса й телефони вже вказані.</p>
      <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={allDay} onChange={e => (e.target.checked ? s.set('seo_hours', 'Mo-Su 00:00-23:59') : setH('Mo-Su', '08:00', '18:00'))} /> Працюємо цілодобово</label>
      {!allDay && (
        <div className="grid grid-cols-3 gap-2">
          <div><label className={lbl}>Дні</label><select className={input} value={days} onChange={e => setH(e.target.value, from, to)}>{Object.entries(DAYS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className={lbl}>З</label><input type="time" className={input} value={from} onChange={e => setH(days, e.target.value, to)} /></div>
          <div><label className={lbl}>До</label><input type="time" className={input} value={to} onChange={e => setH(days, from, e.target.value)} /></div>
        </div>
      )}
      <div className="max-w-[200px]"><label className={lbl}>Рік відкриття</label><input className={input} inputMode="numeric" maxLength={4} value={s.vals.seo_founded || ''} onChange={e => s.set('seo_founded', e.target.value.replace(/\D/g, ''))} placeholder="напр. 2012" /></div>
      <div className="flex items-center gap-3"><button className={btn} disabled={s.saving} onClick={() => s.save()}><Save size={16} />Зберегти</button><span className="text-sm text-green-400">{s.msg}</span></div>
    </div>
  );
};

// ---------------- counters ----------------
const Counters: React.FC = () => {
  const s = useSettings(['seo_gsc_verify', 'ga_measurement_id', 'fb_pixel_id']);
  const bad = (k: string, re: RegExp) => s.vals[k] && !re.test(s.vals[k].trim());
  return (
    <div className="space-y-4">
      <div className={box}>
        <div className="text-white font-black text-lg">Google Search Console</div>
        <p className={hint}>Тут видно, за якими запитами вас шукають і які сторінки Google не бере. 1) Відкрийте <a className="text-[#FFC300] underline" href="https://search.google.com/search-console" target="_blank" rel="noreferrer">search.google.com/search-console <ExternalLink size={11} className="inline" /></a> 2) Додайте ресурс «Префікс URL»: https://www.forsage-tires.com 3) Оберіть спосіб «Тег HTML», скопіюйте весь рядок і вставте нижче 4) Збережіть тут і натисніть «Підтвердити» в Google 5) Там же в «Файли Sitemap» додайте: sitemap.xml</p>
        <input className={input} value={s.vals.seo_gsc_verify || ''} onChange={e => s.set('seo_gsc_verify', e.target.value)} placeholder='<meta name="google-site-verification" content="..." />' />
      </div>
      <div className={box}>
        <div className="text-white font-black text-lg">Google Analytics</div>
        <p className={hint}>Скільки людей заходить, звідки і що купують. На analytics.google.com створіть ресурс → «Потік даних» → «Веб» → скопіюйте «Ідентифікатор показника» (починається з G-).</p>
        <input className={input} value={s.vals.ga_measurement_id || ''} onChange={e => s.set('ga_measurement_id', e.target.value)} placeholder="G-XXXXXXXXXX" />
        {bad('ga_measurement_id', /^G-[A-Z0-9]+$/i) && <p className="text-xs text-red-400">Має починатися з G-</p>}
      </div>
      <div className={box}>
        <div className="text-white font-black text-lg">Facebook / Instagram піксель</div>
        <p className={hint}>Потрібен для реклами в Facebook та Instagram. У Meta Business → «Менеджер подій» → скопіюйте ID пікселя (лише цифри).</p>
        <input className={input} value={s.vals.fb_pixel_id || ''} onChange={e => s.set('fb_pixel_id', e.target.value.replace(/\s/g, ''))} placeholder="1234567890123456" />
        {bad('fb_pixel_id', /^\d{6,20}$/) && <p className="text-xs text-red-400">Лише цифри</p>}
      </div>
      <div className="flex items-center gap-3"><button className={btn} disabled={s.saving} onClick={() => s.save()}><Save size={16} />Зберегти</button><span className="text-sm text-green-400">{s.msg}</span></div>
      <p className={hint}>Карта сайту для Google: <a className="text-[#FFC300] underline" href="/sitemap.xml" target="_blank" rel="noreferrer">forsage-tires.com/sitemap.xml</a> — оновлюється сама, сховані розділи в неї не потрапляють.</p>
    </div>
  );
};

const SeoProPanel: React.FC<{ view: SeoView; onOpen: (v: string) => void }> = ({ view, onOpen }) => {
  if (view === 'health') return <Health onOpen={onOpen} />;
  if (view === 'mode') return <Mode />;
  if (view === 'templates') return <Templates />;
  if (view === 'sections') return <Sections />;
  if (view === 'redirects') return <Redirects />;
  if (view === 'local') return <Local />;
  return <Counters />;
};

export default SeoProPanel;
