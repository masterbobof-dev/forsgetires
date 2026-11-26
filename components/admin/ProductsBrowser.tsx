import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Menu, Folder, FolderOpen, Equal, Search, X, Loader2, Image as ImageIcon, Copy, ExternalLink, FileSpreadsheet, ChevronRight, Settings2, Package, ArrowUpDown,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useCategories, getRootCategories, getChildren, buildCategoryFilter, type ProductCategory } from '../../categories';
import { productPath } from '../../productUrl';
import { CategoriesEditor } from './tyres/CategoriesEditor';
import { exportProductsCsv } from './tyres/exportProducts';

const PAGE = 50;

/** Copy to the clipboard; where the browser refuses, the old way through a hidden text box. */
const copyText = (text: string) => {
  const fallback = () => {
    const t = document.createElement('textarea');
    t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch { /* nothing more to try */ }
    t.remove();
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(fallback); else fallback();
};
const FIELDS = 'id, title, slug, price, manufacturer, catalog_number, product_number, stock_quantity, in_stock, on_order, lead_days, image_url, image_thumb_url, category_id, program_product_id';

interface Row {
  id: number; title: string; slug: string | null; price: string | null; manufacturer: string | null; catalog_number: string | null;
  product_number: string | null; stock_quantity: number | null; in_stock: boolean | null; on_order: boolean | null; lead_days: string | null;
  image_url: string | null; image_thumb_url: string | null; category_id: number | null; program_product_id: string | null;
}
type Sort = 'newest' | 'price_desc' | 'price_asc' | 'name';

/** How many goods each section has (with its subsections) — staff only. */
const useTotals = (categories: ProductCategory[], key: number) => {
  const [own, setOwn] = useState<Record<number, number>>({});
  useEffect(() => {
    supabase.rpc('admin_category_totals').then(({ data }) => {
      const m: Record<number, number> = {};
      for (const r of (data as { category_id: number | null; n: number }[]) || []) if (r.category_id != null) m[r.category_id] = Number(r.n);
      setOwn(m);
    });
  }, [key]);
  return (c: ProductCategory): number => (own[c.id] || 0) + getChildren(categories, c.id).reduce((a, k) => a + (own[k.id] || 0), 0);
};

/**
 * Admin → «Товари»: only to find and look at goods. Name, quantity, photos, barcode, price and stock are edited in the
 * shop program (no doubles on the site). The sections menu slides out from the left over the list, like folders:
 * a section opens its subsections, a subsection (or a section without them) shows its goods and closes the menu.
 */
const ProductsBrowser: React.FC = () => {
  const { categories, dbReady, reload } = useCategories({ includeInactive: true });
  const [totalsKey, setTotalsKey] = useState(0);
  const total = useTotals(categories, totalsKey);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openRoot, setOpenRoot] = useState<number | null>(null);
  const [catId, setCatId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [photo, setPhoto] = useState<'all' | 'with' | 'without'>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [onlyStock, setOnlyStock] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [toast, setToast] = useState('');
  const [editor, setEditor] = useState(false);
  const [exporting, setExporting] = useState(false);
  const touchX = useRef<number | null>(null);

  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 350); return () => clearTimeout(t); }, [search]);

  const cat = categories.find(c => c.id === catId) || null;
  const root = cat?.parent_id ? categories.find(c => c.id === cat.parent_id) || null : null;

  const load = async (p: number) => {
    setLoading(true);
    let query = supabase.from('tyres').select(FIELDS, { count: 'exact' });
    if (q) {
      // name, article, barcode, cross numbers, brand — every word must match
      for (const w of q.replace(/[%_(),]/g, ' ').split(/\s+/).filter(Boolean)) {
        query = query.or(`title.ilike.%${w}%,catalog_number.ilike.%${w}%,product_number.ilike.%${w}%,search_numbers.ilike.%${w}%,manufacturer.ilike.%${w}%`);
      }
    }
    if (cat) { const f = buildCategoryFilter(categories, cat, dbReady); if (f) query = query.or(f); }
    if (photo === 'with') query = query.not('image_url', 'is', null).neq('image_url', '');
    if (photo === 'without') query = query.or('image_url.is.null,image_url.eq.');
    if (onlyStock) query = query.neq('in_stock', false).gt('stock_quantity', 0);
    if (sort === 'price_desc') query = query.order('price_num', { ascending: false, nullsFirst: false });
    else if (sort === 'price_asc') query = query.order('price_num', { ascending: true, nullsFirst: false });
    else if (sort === 'name') query = query.order('title');
    else query = query.order('created_at', { ascending: false });
    const { data, count: n } = await query.range(p * PAGE, p * PAGE + PAGE - 1);
    setRows(prev => (p === 0 ? (data as Row[]) || [] : [...prev, ...((data as Row[]) || [])]));
    setCount(n || 0);
    setPage(p);
    setLoading(false);
  };
  useEffect(() => { if (categories.length || dbReady) load(0); }, [q, catId, photo, sort, onlyStock, categories]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (c: ProductCategory | null, close: boolean) => { setCatId(c?.id ?? null); if (close) setMenuOpen(false); };
  const copy = (text: string, what = 'Скопійовано') => { copyText(text); setToast(`${what}: ${text.length > 40 ? text.slice(0, 40) + '…' : text}`); setTimeout(() => setToast(''), 1800); };
  const catName = (id: number | null) => categories.find(c => c.id === id)?.name || '';
  const roots = useMemo(() => getRootCategories(categories), [categories]);

  return (
    <div className="max-w-6xl mx-auto pb-20 relative">
      {toast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] bg-green-600/95 text-white px-5 py-2.5 rounded-full shadow-2xl text-sm font-bold">{toast}</div>}
      {editor && <CategoriesEditor onClose={() => { setEditor(false); reload(); setTotalsKey(k => k + 1); }} />}

      {/* top: menu button with the open section, search, filters */}
      <div className="sticky top-14 lg:top-[6.5rem] z-30 bg-zinc-950 pt-2 pb-3 space-y-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setMenuOpen(true)} aria-label="Категорії" className="h-11 px-3 rounded-xl bg-[#FFC300] text-black font-black flex items-center gap-2 shrink-0"><Menu size={20} /> <span className="hidden sm:inline text-sm">Категорії</span></button>
          <div className="min-w-0 flex-1">
            {root && <p className="text-[11px] font-bold text-sky-400 truncate leading-tight">{root.name}</p>}
            <p className="text-sm md:text-base font-black text-white truncate leading-tight">{cat ? cat.name : 'Усі товари'} <span className="text-zinc-500 font-bold text-xs">· {count}</span></p>
          </div>
          <button onClick={async () => { setExporting(true); try { await exportProductsCsv(categories, dbReady, cat ? String(cat.id) : 'all'); } catch { alert('Не вдалося вивантажити'); } setExporting(false); }}
            disabled={exporting} title="Вивантажити в Excel" className="h-11 px-3 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 flex items-center gap-2 text-xs font-bold shrink-0 disabled:opacity-50">
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} <span className="hidden md:inline">Excel</span>
          </button>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Пошук: назва, артикул, штрихкод" inputMode="search"
            className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-9 text-white text-sm outline-none focus:border-[#FFC300]" />
          {search && <button onClick={() => setSearch('')} aria-label="Очистити" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500"><X size={16} /></button>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <select value={photo} onChange={e => setPhoto(e.target.value as typeof photo)} aria-label="Фото"
            className={`h-10 bg-zinc-900 border rounded-xl px-2 text-xs font-bold outline-none ${photo !== 'all' ? 'border-[#FFC300] text-[#FFC300]' : 'border-zinc-800 text-white'}`}>
            <option value="all">Фото: всі</option><option value="with">З фото</option><option value="without">Без фото</option>
          </select>
          <select value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Сортування" className="h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-2 text-xs font-bold text-white outline-none">
            <option value="newest">Нові</option><option value="price_desc">Ціна ↓ дорожчі</option><option value="price_asc">Ціна ↑ дешевші</option><option value="name">Назва А–Я</option>
          </select>
          <button onClick={() => setOnlyStock(!onlyStock)} className={`h-10 rounded-xl border text-xs font-bold ${onlyStock ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-zinc-800 text-zinc-300 bg-zinc-900'}`}>
            {onlyStock ? '✓ ' : ''}В наявності
          </button>
        </div>
      </div>

      {/* sections menu: slides out over the goods; swipe left, tap outside or choose the last level to close */}
      {menuOpen && (
        <div className="fixed inset-0 z-[150]" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <nav aria-label="Категорії товарів" onClick={e => e.stopPropagation()}
            onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
            onTouchEnd={e => { if (touchX.current != null && e.changedTouches[0].clientX - touchX.current < -60) setMenuOpen(false); touchX.current = null; }}
            className="absolute left-0 top-0 bottom-0 w-[85%] max-w-sm bg-zinc-900 border-r border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <span className="font-black uppercase text-white flex items-center gap-2"><Menu size={18} className="text-[#FFC300]" /> Категорії</span>
              <button onClick={() => setMenuOpen(false)} aria-label="Закрити меню" className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              <button onClick={() => pick(null, true)} className={`w-full flex items-center gap-3 px-4 py-3 text-left ${!cat ? 'bg-[#FFC300]/10 text-[#FFC300]' : 'text-white hover:bg-zinc-800'}`}>
                <Package size={20} /> <span className="flex-1 font-bold">Усі товари</span>
              </button>
              {roots.map(r => {
                const kids = getChildren(categories, r.id);
                const opened = openRoot === r.id;
                const active = catId === r.id;
                return (
                  <div key={r.id}>
                    <button onClick={() => { if (kids.length) { setOpenRoot(opened ? null : r.id); pick(r, false); } else pick(r, true); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left ${active ? 'bg-[#FFC300]/10 text-[#FFC300]' : 'text-white hover:bg-zinc-800'} ${r.is_active ? '' : 'opacity-50'}`}>
                      {opened ? <FolderOpen size={20} className="text-[#FFC300] shrink-0" /> : <Folder size={20} className="text-[#FFC300] shrink-0" />}
                      <span className="flex-1 font-bold truncate">{r.name}</span>
                      <span className="text-xs text-zinc-500">{total(r)}</span>
                      {kids.length > 0 && <ChevronRight size={16} className={`text-zinc-500 transition-transform ${opened ? 'rotate-90' : ''}`} />}
                    </button>
                    {opened && kids.map(k => (
                      <button key={k.id} onClick={() => pick(k, true)}
                        className={`w-full flex items-center gap-3 pl-10 pr-4 py-2.5 text-left ${catId === k.id ? 'bg-[#FFC300]/10 text-[#FFC300]' : 'text-zinc-200 hover:bg-zinc-800'} ${k.is_active ? '' : 'opacity-50'}`}>
                        <Equal size={18} className="text-zinc-500 shrink-0" />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-bold truncate">{k.name}</span>
                          <span className="block text-[10px] font-bold text-sky-400 truncate">{r.name}</span>
                        </span>
                        <span className="text-xs text-zinc-500">{total(k)}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
            <button onClick={() => { setMenuOpen(false); setEditor(true); }} className="m-3 h-10 rounded-xl border border-zinc-700 text-zinc-300 text-xs font-bold flex items-center justify-center gap-2 hover:border-[#FFC300]">
              <Settings2 size={14} /> Налаштувати категорії
            </button>
          </nav>
        </div>
      )}

      <p className="text-[11px] text-zinc-500 mb-3">Назву, кількість, фото, штрихкод, ціну і склад змінюють у програмі — тут лише пошук і перегляд. Натисніть на назву, артикул або штрихкод, щоб скопіювати.</p>

      {loading && rows.length === 0 ? <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-[#FFC300]" size={36} /></div>
        : rows.length === 0 ? <p className="py-16 text-center text-zinc-500">Нічого не знайдено</p> : (
        <ul className="space-y-2">
          {rows.map(r => {
            const qty = Number(r.stock_quantity || 0);
            const hidden = r.in_stock === false;
            return (
              <li key={r.id} className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-3 flex gap-3 ${hidden ? 'opacity-70' : ''}`}>
                <a href={r.image_url || undefined} target="_blank" rel="noopener noreferrer" className="w-20 h-20 md:w-24 md:h-24 shrink-0 rounded-xl bg-white overflow-hidden flex items-center justify-center">
                  {r.image_thumb_url || r.image_url ? <img src={r.image_thumb_url || r.image_url!} alt="" loading="lazy" className="w-full h-full object-contain" /> : <ImageIcon size={26} className="text-zinc-400" />}
                </a>
                <div className="flex-1 min-w-0">
                  <button onClick={() => copy(r.title, 'Назву скопійовано')} className="text-left text-sm md:text-base font-bold text-white leading-snug hover:text-[#FFC300] active:text-[#FFC300]">
                    {r.title} <Copy size={11} className="inline text-zinc-600" />
                  </button>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px] font-mono text-zinc-400">
                    {r.manufacturer && <span className="font-sans font-bold text-zinc-300">{r.manufacturer}</span>}
                    {r.catalog_number && <button onClick={() => copy(r.catalog_number!, 'Артикул')} className="hover:text-white">Арт: {r.catalog_number}</button>}
                    {r.product_number && <button onClick={() => copy(r.product_number!, 'Штрихкод')} className="hover:text-white">▮▮ {r.product_number}</button>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {r.on_order ? <span className="text-[11px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/30 rounded-lg px-2 py-0.5">Під замовлення{r.lead_days ? ` · ${r.lead_days} дн.` : ''}</span>
                      : <span className={`text-[11px] font-bold rounded-lg px-2 py-0.5 border ${qty > 0 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30'}`}>{qty > 0 ? `Залишок: ${qty} шт` : 'Немає'}</span>}
                    {hidden && <span className="text-[11px] font-bold text-zinc-400 border border-zinc-700 rounded-lg px-2 py-0.5">не показується на сайті</span>}
                    {r.category_id && <span className="text-[11px] font-bold text-sky-400">{catName(r.category_id)}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end justify-between shrink-0">
                  <span className="text-base md:text-lg font-black text-white whitespace-nowrap">{r.price && Number(r.price) > 0 ? `${Number(r.price).toLocaleString('uk-UA')} грн` : '—'}</span>
                  {!hidden && <a href={productPath({ id: r.id, title: r.title, slug: r.slug || undefined })} target="_blank" rel="noopener noreferrer" title="Відкрити на сайті" className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800"><ExternalLink size={16} /></a>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > 0 && rows.length < count && (
        <div className="text-center mt-6">
          <button onClick={() => load(page + 1)} disabled={loading} className="h-11 px-6 rounded-xl bg-zinc-800 text-white font-bold text-sm flex items-center gap-2 mx-auto disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpDown size={16} />} Показати ще ({count - rows.length})
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductsBrowser;
