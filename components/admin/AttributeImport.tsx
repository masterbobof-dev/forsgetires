import React, { useMemo, useState } from 'react';
import readXlsxFile from 'read-excel-file';
import { X, Upload, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useCategories, getRootCategories, getChildren, ProductCategory } from '../../categories';
import { getPresetForCategory, suggestTitle, FilterPreset } from '../../productAttributes';

/** Column of the product table we can fill from the file */
type Target = 'title' | 'manufacturer' | 'price' | 'old_price' | 'base_price' | 'catalog_number' | 'stock_quantity' | 'image_url' | 'description' | `attr:${string}` | '';

const BASE_TARGETS: { value: Target; label: string; guesses: string[] }[] = [
  { value: 'title', label: 'Назва', guesses: ['назва', 'найменування', 'name', 'товар', 'title', 'модель'] },
  { value: 'manufacturer', label: 'Бренд', guesses: ['бренд', 'виробник', 'brand', 'vendor', 'марка'] },
  { value: 'price', label: 'Ціна продажу', guesses: ['ціна', 'роздріб', 'price', 'ціна продажу', 'роздрібна'] },
  { value: 'old_price', label: 'Стара ціна (закреслена)', guesses: ['стара ціна', 'old price', 'стара'] },
  { value: 'base_price', label: 'Закупівельна ціна', guesses: ['закупка', 'закупівля', 'вхідна', 'опт', 'base'] },
  { value: 'catalog_number', label: 'Артикул', guesses: ['артикул', 'код', 'sku', 'article', 'каталожний'] },
  { value: 'stock_quantity', label: 'Кількість', guesses: ['кількість', 'залишок', 'наявність', 'qty', 'stock', 'к-сть'] },
  { value: 'image_url', label: 'Фото (посилання)', guesses: ['фото', 'зображення', 'image', 'picture', 'картинка'] },
  { value: 'description', label: 'Опис', guesses: ['опис', 'description'] },
];

// Extra spellings for characteristic columns
const ATTR_GUESSES: Record<string, string[]> = {
  capacity: ['ємність', 'емкость', 'ah', 'а/год', 'ач'],
  polarity: ['полярність', 'полярность', 'polarity'],
  body: ['корпус', 'тип корпусу', 'стандарт'],
  current: ['пусковий', 'пусковой', 'струм', 'cca', 'en'],
  size: ['розмір', 'розміри', 'габарит', 'size', 'дхшхв'],
  voltage: ['напруга', 'вольт', 'voltage', 'v'],
  diameter: ['діаметр', 'радіус', 'diameter', 'r'],
  pcd: ['pcd', 'кріплення', 'сверловка', 'свердловка'],
  width: ['ширина', 'width', 'j'],
  et: ['виліт', 'вылет', 'et'],
  dia: ['dia', 'центральний', 'цо', 'ступиця'],
  type: ['тип диска', 'тип', 'матеріал'],
};

/** Turn what suppliers write into our codes: "+ справа", "R", "0" → right, "Asia/JIS" → asia ... */
const normalizeAttr = (key: string, raw: string): string => {
  const v = raw.trim().toLowerCase();
  if (!v) return '';
  if (key === 'polarity') {
    if (/(прав|справ|right|\br\b|зворот|обрат|^0$|\(-\s*\+\)|-\s*\+)/.test(v)) return 'right';
    if (/(лів|лев|left|\bl\b|прям|^1$|\(\+\s*-\)|\+\s*-)/.test(v)) return 'left';
    return '';
  }
  if (key === 'body') return /(asia|азі|jis|японс)/.test(v) ? 'asia' : 'euro';
  if (key === 'type') return /(стал|steel|штамп)/.test(v) ? 'steel' : /(кован|forg)/.test(v) ? 'forged' : 'alloy';
  if (key === 'diameter') return v.replace(/[^\d.]/g, '');
  if (key === 'voltage') return v.replace(/[^\d]/g, '') || '12';
  if (key === 'capacity' || key === 'current') return v.replace(',', '.').replace(/[^\d.]/g, '');
  if (key === 'pcd') return v.replace(/\s*[хx×*]\s*/g, 'x').replace(/[^\dx.]/g, '');
  if (key === 'size') return v.replace(/\s*[хx×*]\s*/g, '×').replace(/[^\d×.]/g, '');
  if (key === 'width' || key === 'et' || key === 'dia') return v.replace(',', '.').replace(/[^\d.-]/g, '');
  return raw.trim();
};

const guessTarget = (header: string, targets: { value: Target; guesses: string[] }[]): Target => {
  const h = header.toLowerCase().trim();
  for (const t of targets) if (t.guesses.some(g => h === g)) return t.value;
  for (const t of targets) if (t.guesses.some(g => g.length > 2 && h.includes(g))) return t.value;
  return '';
};

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const AttributeImport: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const { categories, dbReady } = useCategories({ includeInactive: true });
  const [categoryId, setCategoryId] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Target[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null);

  const category = categories.find(c => String(c.id) === categoryId);
  const preset: FilterPreset | null = category ? getPresetForCategory(categories, category) : null;
  const options: { cat: ProductCategory; label: string }[] = getRootCategories(categories).filter(c => c.kind !== 'tyre').flatMap(r => [
    { cat: r, label: r.name }, ...getChildren(categories, r.id).map(c => ({ cat: c, label: `— ${c.name}` })),
  ]);

  const targets = useMemo(() => [
    ...BASE_TARGETS,
    ...(preset?.fields || []).map(f => ({ value: `attr:${f.key}` as Target, label: `★ ${f.label}`, guesses: [f.label.toLowerCase(), ...(ATTR_GUESSES[f.key] || [])] })),
  ], [preset]);

  const onFile = async (file: File) => {
    setResult(null);
    setFileName(file.name);
    const data = (await readXlsxFile(file)) as unknown[][];
    const headerIdx = data.findIndex(r => r.filter(c => c !== null && String(c).trim()).length >= 2);
    const head = (data[headerIdx] || []).map(c => String(c ?? '').trim());
    const body = data.slice(headerIdx + 1).map(r => r.map(c => (c === null || c === undefined ? '' : String(c))))
      .filter(r => r.some(c => c.trim()));
    setHeaders(head);
    setRows(body);
    setMapping(head.map(h => guessTarget(h, targets)));
  };

  const buildRow = (r: string[]) => {
    const p: Record<string, any> = {};
    const attrs: Record<string, string> = {};
    mapping.forEach((t, i) => {
      if (!t) return;
      const v = (r[i] || '').trim();
      if (t.startsWith('attr:')) { const key = t.slice(5); const n = normalizeAttr(key, v); if (n) attrs[key] = n; }
      else p[t] = v;
    });
    const price = num(p.price);
    const title = (p.title || '').trim() || suggestTitle(preset, (p.manufacturer || '').trim(), attrs);
    return {
      title, attrs,
      payload: {
        title,
        manufacturer: p.manufacturer?.trim() || null,
        price: price ? String(Math.round(price)) : null,
        old_price: num(p.old_price) ? String(Math.round(num(p.old_price))) : null,
        base_price: num(p.base_price) ? String(num(p.base_price)) : null,
        catalog_number: p.catalog_number?.trim() || null,
        stock_quantity: p.stock_quantity !== undefined ? Math.round(num(p.stock_quantity)) : null,
        image_url: /^https?:\/\//.test(p.image_url || '') ? p.image_url.trim() : null,
        description: p.description?.trim() || null,
      },
    };
  };

  const preview = rows.slice(0, 8).map(buildRow);

  const runImport = async () => {
    if (!category) return;
    setImporting(true);
    let created = 0, updated = 0, skipped = 0;
    const errors: string[] = [];
    for (const r of rows) {
      const { title, attrs, payload } = buildRow(r);
      if (!title || !payload.price) { skipped++; continue; }
      const record: Record<string, any> = { ...payload, category_id: category.id, attributes: attrs, in_stock: (payload.stock_quantity ?? 1) > 0 };
      Object.keys(record).forEach(k => record[k] === null && delete record[k]);
      if (record.image_url) record.gallery = [record.image_url];
      // same article in this category → update instead of creating a duplicate
      let existingId: number | null = null;
      if (payload.catalog_number) {
        const { data } = await supabase.from('tyres').select('id').eq('catalog_number', payload.catalog_number).eq('category_id', category.id).limit(1);
        existingId = data?.[0]?.id ?? null;
      }
      const { error } = existingId
        ? await supabase.from('tyres').update(record).eq('id', existingId)
        : await supabase.from('tyres').insert([record]);
      if (error) { if (errors.length < 5) errors.push(`${title}: ${error.message}`); skipped++; }
      else if (existingId) updated++; else created++;
    }
    setImporting(false);
    setResult({ created, updated, skipped, errors });
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="text-lg font-black flex items-center gap-2"><FileSpreadsheet className="text-emerald-400" /> Імпорт з Excel (диски, акумулятори, інші товари)</h3>
          <button onClick={onClose} className="p-2 rounded-full bg-zinc-800 text-zinc-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {!dbReady && <p className="text-amber-400 text-sm">Спочатку налаштуйте категорії (розділ «Категорії»).</p>}
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">1. Категорія товарів</label>
              <select value={categoryId} onChange={e => { setCategoryId(e.target.value); setMapping(headers.map(h => guessTarget(h, targets))); }} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white">
                <option value="">— оберіть —</option>
                {options.map(({ cat, label }) => <option key={cat.id} value={cat.id}>{label}</option>)}
              </select>
              {preset && <p className="text-[11px] text-emerald-400 mt-1">Характеристики: {preset.fields.map(f => f.label).join(', ')}</p>}
            </div>
            <div>
              <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">2. Файл Excel (.xlsx)</label>
              <label className="flex items-center gap-2 bg-black border border-dashed border-zinc-600 rounded-lg p-3 cursor-pointer hover:border-[#FFC300] text-zinc-300 text-sm">
                <Upload size={16} /> {fileName || 'Обрати файл…'}
                <input type="file" accept=".xlsx" className="hidden" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
              </label>
            </div>
          </div>

          {headers.length > 0 && (
            <div>
              <p className="text-zinc-400 text-xs font-bold uppercase mb-2">3. Що є в кожній колонці (визначено автоматично — перевірте)</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {headers.map((h, i) => (
                  <div key={i} className="bg-black/40 border border-zinc-800 rounded-lg p-2">
                    <p className="text-xs text-zinc-500 truncate" title={h}>«{h || `Колонка ${i + 1}`}» <span className="text-zinc-600">напр.: {rows[0]?.[i]?.slice(0, 24)}</span></p>
                    <select value={mapping[i] || ''} onChange={e => setMapping(m => m.map((x, j) => (j === i ? e.target.value as Target : x)))} className={`w-full mt-1 bg-black border rounded p-1.5 text-sm ${mapping[i] ? 'border-emerald-700 text-white' : 'border-zinc-700 text-zinc-500'}`}>
                      <option value="">— не імпортувати —</option>
                      {targets.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.length > 0 && category && (
            <div>
              <p className="text-zinc-400 text-xs font-bold uppercase mb-2">4. Як виглядатимуть перші товари ({rows.length} рядків у файлі)</p>
              <div className="overflow-x-auto border border-zinc-800 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-800/50 text-zinc-400"><tr><th className="p-2 text-left">Назва</th><th className="p-2">Ціна</th><th className="p-2">Артикул</th><th className="p-2 text-left">Характеристики</th></tr></thead>
                  <tbody>
                    {preview.map((p, i) => (
                      <tr key={i} className="border-t border-zinc-800">
                        <td className="p-2 text-white">{p.title || <span className="text-red-400">немає назви</span>}</td>
                        <td className="p-2 text-center">{p.payload.price || <span className="text-red-400">—</span>}</td>
                        <td className="p-2 text-center text-zinc-400">{p.payload.catalog_number || '—'}</td>
                        <td className="p-2 text-zinc-300">{Object.entries(p.attrs).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">Товар з таким самим артикулом у цій категорії буде оновлено, а не продубльовано. Рядки без назви або ціни пропускаються.</p>
            </div>
          )}

          {result && (
            <div className={`p-3 rounded-lg border text-sm ${result.errors.length ? 'border-amber-700 bg-amber-900/20' : 'border-emerald-700 bg-emerald-900/20'}`}>
              <p className="font-bold flex items-center gap-2">{result.errors.length ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />} Додано: {result.created}, оновлено: {result.updated}, пропущено: {result.skipped}</p>
              {result.errors.map((e, i) => <p key={i} className="text-xs text-amber-300 mt-1">{e}</p>)}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-sm">Закрити</button>
          <button onClick={runImport} disabled={!category || rows.length === 0 || importing || !mapping.includes('price')}
            className="px-5 py-2.5 rounded-xl bg-[#FFC300] hover:bg-white text-black font-black text-sm disabled:opacity-40 flex items-center gap-2">
            {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Імпортувати {rows.length || ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttributeImport;
