import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronRight, Flame, X, Folder, FolderOpen, LayoutGrid, Package } from 'lucide-react';
import { ProductCategory, getRootCategories, getChildren } from '../categories';
import { catSlugFrom } from '../api/_paths.js';

/**
 * The full product catalogue as a folder tree, the same as in the admin panel: a panel slides out from the left over
 * the page (phone and computer). A folder opens its subfolders (several can be open), a subfolder opens its goods.
 * A field on top finds a folder by name, with its parent folder in small letters.
 */
interface Props {
  categories: ProductCategory[];
  onPick: (slug: string) => (e: React.MouseEvent) => void;
  hrefFor: (slug: string) => string;
  onClose: () => void;
  /** links under the tree (forum, delivery, …) */
  footer?: React.ReactNode;
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[’'`]/g, '');
const count = (c: ProductCategory) => c.total ?? c.available ?? 0;

const CatalogMenu: React.FC<Props> = ({ categories, onPick, hrefFor, onClose, footer }) => {
  const roots = useMemo(() => getRootCategories(categories).sort((a, b) => count(b) - count(a)), [categories]);
  const kidsOf = (id: number) => getChildren(categories, id).sort((a, b) => count(b) - count(a));
  // the folder of the page you are on is open at once
  const [open, setOpen] = useState<Set<number>>(() => {
    const slug = catSlugFrom(window.location.pathname, window.location.search);
    const c = categories.find(x => x.slug === slug);
    const root = c ? (c.parent_id ?? c.id) : null;
    return new Set(root ? [root] : []);
  });
  const toggle = (id: number) => setOpen(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [query, setQuery] = useState('');
  const touchX = useRef<number | null>(null);
  const currentSlug = catSlugFrom(window.location.pathname, window.location.search);

  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const q = norm(query.trim());
  const words = q.split(/\s+/).filter(Boolean);
  const found = words.length && q.length >= 2 ? categories.filter(c => words.every(w => norm(c.name).includes(w))).sort((a, b) => count(b) - count(a)) : [];
  const parentName = (c: ProductCategory) => categories.find(p => p.id === c.parent_id)?.name;
  const num = (c: ProductCategory) => <span className="text-xs text-zinc-500 tabular-nums shrink-0">{count(c)}</span>;
  const on = (c: ProductCategory) => c.slug === currentSlug;

  const leaf = (c: ProductCategory, sub = false) => (
    <a key={c.id} href={hrefFor(c.slug)} onClick={onPick(c.slug)}
      className={`flex items-center gap-2.5 ${sub ? 'pl-3 pr-4 py-2' : 'px-4 py-3'} ${on(c) ? 'bg-[#FFC300]/10 text-[#FFC300]' : 'text-zinc-200 hover:bg-zinc-800'}`}>
      {sub && <span className="w-3 border-t border-zinc-700 -ml-3 shrink-0" aria-hidden />}
      <Folder size={sub ? 16 : 20} className={`${sub ? 'text-[#FFC300]/80' : 'text-[#FFC300]'} shrink-0`} />
      <span className={`flex-1 min-w-0 truncate font-bold ${sub ? 'text-sm' : ''}`}>{c.name}</span>
      {num(c)}
    </a>
  );

  return createPortal(
    <div className="fixed inset-0 z-[190]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 animate-in fade-in duration-200" />
      <nav aria-label="Каталог товарів" onClick={e => e.stopPropagation()}
        onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={e => { if (touchX.current != null && e.changedTouches[0].clientX - touchX.current < -70) onClose(); touchX.current = null; }}
        className="absolute left-0 top-0 bottom-0 w-[88%] max-w-md bg-zinc-900 border-r border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
        <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-800 shrink-0">
          <h2 className="font-black uppercase text-white flex items-center gap-2"><LayoutGrid size={18} className="text-[#FFC300]" /> Каталог товарів</h2>
          <button onClick={onClose} aria-label="Закрити каталог" className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white bg-zinc-800"><X size={20} /></button>
        </div>
        <div className="px-3 pt-3 pb-2 border-b border-zinc-800 space-y-2 shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Знайти розділ: фільтри, лампочки, масла…" aria-label="Знайти розділ"
              className="w-full h-11 bg-black border border-zinc-700 rounded-xl pl-9 pr-9 text-sm text-white outline-none focus:border-[#FFC300] placeholder:text-zinc-600" />
            {query && <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white" aria-label="Очистити"><X size={16} /></button>}
          </div>
          {!q && (
            <div className="flex gap-2 text-[11px] font-bold">
              <button onClick={() => setOpen(new Set(roots.map(r => r.id)))} className="text-zinc-400 hover:text-white">Розгорнути все</button>
              <span className="text-zinc-700">·</span>
              <button onClick={() => setOpen(new Set())} className="text-zinc-400 hover:text-white">Згорнути все</button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain py-2">
          {q.length >= 2 ? (
            found.length ? found.map(c => (
              <a key={c.id} href={hrefFor(c.slug)} onClick={onPick(c.slug)}
                className={`flex items-center gap-3 px-4 py-2.5 ${on(c) ? 'bg-[#FFC300]/10 text-[#FFC300]' : 'text-zinc-200 hover:bg-zinc-800'}`}>
                <Folder size={18} className="text-[#FFC300] shrink-0" />
                <span className="flex-1 min-w-0"><span className="block text-sm font-bold truncate">{c.name}</span>{c.parent_id && <span className="block text-[10px] font-bold text-sky-400 truncate">{parentName(c)}</span>}</span>
                {num(c)}
              </a>
            )) : <p className="px-4 py-6 text-sm text-zinc-500">Розділ не знайдено. Спробуйте пошук товарів на сторінці каталогу.</p>
          ) : (
            <>
              <a href={hrefFor('akcii')} onClick={onPick('akcii')} className="flex items-center gap-3 px-4 py-3 text-orange-400 font-black hover:bg-orange-500/10">
                <Flame size={20} /> <span className="flex-1">Хіти та акції</span>
              </a>
              {roots.map(r => {
                const kids = kidsOf(r.id);
                if (!kids.length) return leaf(r);
                const opened = open.has(r.id);
                return (
                  <div key={r.id}>
                    <div className={`flex items-center ${on(r) ? 'bg-[#FFC300]/10' : 'hover:bg-zinc-800'}`}>
                      <button onClick={() => toggle(r.id)} aria-expanded={opened}
                        className={`flex-1 min-w-0 flex items-center gap-3 pl-4 pr-2 py-3 text-left ${on(r) ? 'text-[#FFC300]' : 'text-white'}`}>
                        {opened ? <FolderOpen size={20} className="text-[#FFC300] shrink-0" /> : <Folder size={20} className="text-[#FFC300] shrink-0" />}
                        <span className="flex-1 font-bold truncate">{r.name}</span>
                        {num(r)}
                      </button>
                      <button onClick={() => toggle(r.id)} aria-label={opened ? `Згорнути ${r.name}` : `Розгорнути ${r.name}`} className="w-11 h-11 flex items-center justify-center text-zinc-400 hover:text-white shrink-0">
                        <ChevronRight size={18} className={`transition-transform ${opened ? 'rotate-90' : ''}`} />
                      </button>
                    </div>
                    {opened && (
                      <div className="ml-6 border-l border-zinc-700 mb-1">
                        <a href={hrefFor(r.slug)} onClick={onPick(r.slug)} className="flex items-center gap-2.5 pl-3 pr-4 py-2 text-[#FFC300] hover:bg-zinc-800">
                          <span className="w-3 border-t border-zinc-700 -ml-3 shrink-0" aria-hidden />
                          <Package size={16} className="shrink-0" />
                          <span className="flex-1 text-sm font-black">Усі товари розділу</span>
                          {num(r)}
                        </a>
                        {kids.map(k => leaf(k, true))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
        {footer && <div className="border-t border-zinc-800 px-4 py-3 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </nav>
    </div>,
    document.body,
  );
};

export default CatalogMenu;
