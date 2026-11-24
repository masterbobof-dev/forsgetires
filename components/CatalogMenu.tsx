import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronRight, ChevronLeft, Flame, X } from 'lucide-react';
import { ProductCategory, getRootCategories, getChildren, getCategoryIcon } from '../categories';

/**
 * The full product catalogue: main sections on the left, ALL their subsections on the right (with the number of goods),
 * and a field to find a section by name. Computer: a big drop-down. Phone: a full-screen panel (sections → subsections).
 */
interface Props {
  categories: ProductCategory[];
  onPick: (slug: string) => (e: React.MouseEvent) => void;
  hrefFor: (slug: string) => string;
  onClose: () => void;
  mobile?: boolean;
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[’'`]/g, '');

const CatalogMenu: React.FC<Props> = ({ categories, onPick, hrefFor, onClose, mobile = false }) => {
  // biggest sections first
  const roots = useMemo(() => getRootCategories(categories).sort((a, b) => (b.available || 0) - (a.available || 0)), [categories]);
  const [active, setActive] = useState<number | null>(mobile ? null : roots[0]?.id ?? null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!mobile) return;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mobile]);
  const root = roots.find(r => r.id === active) || (mobile ? undefined : roots[0]);
  const kids = root ? getChildren(categories, root.id).sort((a, b) => (b.available || 0) - (a.available || 0)) : [];
  const q = norm(query.trim());
  const found = q.length >= 2 ? categories.filter(c => norm(c.name).includes(q)).sort((a, b) => (b.available || 0) - (a.available || 0)).slice(0, 30) : [];
  const parentName = (c: ProductCategory) => categories.find(p => p.id === c.parent_id)?.name;
  const iconOf = (c: ProductCategory) => getCategoryIcon(c.icon || categories.find(p => p.id === c.parent_id)?.icon);
  const count = (c: ProductCategory) => (c.available ? <span className="ml-auto pl-2 text-[11px] text-zinc-500 font-normal tabular-nums">{c.available}</span> : null);

  const searchBox = (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Знайти розділ: фільтри, лампочки, масла…" autoFocus={!mobile}
        className="w-full h-11 bg-black border border-zinc-700 rounded-xl pl-9 pr-9 text-sm text-white outline-none focus:border-[#FFC300] placeholder:text-zinc-600" />
      {query && <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white" aria-label="Очистити"><X size={16} /></button>}
    </div>
  );

  const link = (c: ProductCategory, extra = '') => {
    const Icon = iconOf(c);
    return (
      <a key={c.id} href={hrefFor(c.slug)} onClick={onPick(c.slug)}
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold text-zinc-200 hover:bg-zinc-800 hover:text-[#FFC300] transition-colors ${extra}`}>
        <span className="text-[#FFC300] shrink-0"><Icon size={17} className="shrink-0" /></span>
        <span className="min-w-0 leading-tight">{c.name}{q && c.parent_id && <span className="block text-[11px] text-zinc-500 font-normal">{parentName(c)}</span>}</span>
        {count(c)}
      </a>
    );
  };

  const results = q.length >= 2 && (
    found.length
      ? <div className={`grid gap-1 ${mobile ? '' : 'grid-cols-3'}`}>{found.map(c => link(c))}</div>
      : <p className="text-sm text-zinc-500 py-6 text-center">Розділ не знайдено. Спробуйте пошук товарів на сторінці каталогу.</p>
  );

  // ---------- phone ----------
  if (mobile) {
    // rendered into <body>: inside the blurred header a "fixed" panel would be clipped to the header
    return createPortal(
      <div className="fixed inset-0 z-[190] bg-zinc-950 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200 md:hidden">
        <div className="flex items-center gap-2 px-3 h-14 border-b border-zinc-800 shrink-0">
          {root && !q
            ? <button onClick={() => setActive(null)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-900 text-white" aria-label="Назад"><ChevronLeft size={20} /></button>
            : null}
          <h2 className="flex-1 font-black uppercase tracking-wide text-white truncate">{root && !q ? root.name : 'Каталог товарів'}</h2>
          <button onClick={onClose} className="h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-900 text-white" aria-label="Закрити"><X size={20} /></button>
        </div>
        <div className="p-3 shrink-0">{searchBox}</div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {q.length >= 2 ? results : root ? (
            <div className="flex flex-col gap-1">
              {link(root, 'bg-[#FFC300]/10 !text-[#FFC300]')}
              {kids.map(c => link(c))}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {roots.map(r => {
                const Icon = getCategoryIcon(r.icon);
                const hasKids = getChildren(categories, r.id).length > 0;
                return hasKids ? (
                  <button key={r.id} onClick={() => setActive(r.id)} className="flex items-center gap-3 rounded-xl px-3 py-3.5 bg-zinc-900 text-left text-base font-black text-white active:bg-zinc-800">
                    <span className="w-9 h-9 rounded-xl bg-[#FFC300]/10 text-[#FFC300] flex items-center justify-center shrink-0"><Icon size={20} /></span>
                    <span className="flex-1">{r.name}</span>
                    <span className="text-xs text-zinc-500 font-normal">{r.available}</span>
                    <ChevronRight size={18} className="text-zinc-500" />
                  </button>
                ) : (
                  <a key={r.id} href={hrefFor(r.slug)} onClick={onPick(r.slug)} className="flex items-center gap-3 rounded-xl px-3 py-3.5 bg-zinc-900 text-base font-black text-white">
                    <span className="w-9 h-9 rounded-xl bg-[#FFC300]/10 text-[#FFC300] flex items-center justify-center shrink-0"><Icon size={20} /></span>
                    <span className="flex-1">{r.name}</span><span className="text-xs text-zinc-500 font-normal">{r.available}</span>
                  </a>
                );
              })}
              <a href={hrefFor('akcii')} onClick={onPick('akcii')} className="flex items-center gap-3 rounded-xl px-3 py-3.5 bg-orange-500/10 text-base font-black text-orange-400">
                <span className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0"><Flame size={20} /></span> Хіти та акції
              </a>
            </div>
          )}
        </div>
      </div>,
      document.body,
    );
  }

  // ---------- computer ----------
  return (
    <div className="flex flex-col gap-3 normal-case">
      {searchBox}
      {q.length >= 2 ? <div className="max-h-[60vh] overflow-y-auto">{results}</div> : (
        <div className="grid grid-cols-[230px_1fr] gap-4 min-h-[320px]">
          <div className="flex flex-col gap-0.5 border-r border-zinc-800 pr-3">
            {roots.map(r => {
              const Icon = getCategoryIcon(r.icon);
              const on = root?.id === r.id;
              return (
                <a key={r.id} href={hrefFor(r.slug)} onClick={onPick(r.slug)} onMouseEnter={() => setActive(r.id)} onFocus={() => setActive(r.id)}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-black transition-colors ${on ? 'bg-[#FFC300] text-black' : 'text-white hover:bg-zinc-800'}`}>
                  <Icon size={18} className={`shrink-0 ${on ? '' : 'text-[#FFC300]'}`} />
                  <span className="flex-1">{r.name}</span>
                  <span className={`text-[11px] font-normal ${on ? 'text-black/60' : 'text-zinc-500'}`}>{r.available}</span>
                  <ChevronRight size={14} className={on ? '' : 'text-zinc-600'} />
                </a>
              );
            })}
            <a href={hrefFor('akcii')} onClick={onPick('akcii')} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-black text-orange-400 hover:bg-orange-500/10 mt-1">
              <Flame size={18} /> Хіти та акції
            </a>
          </div>
          <div className="min-w-0">
            {root && (
              <>
                <a href={hrefFor(root.slug)} onClick={onPick(root.slug)} className="inline-flex items-center gap-1 text-lg font-black text-white hover:text-[#FFC300] mb-2">
                  {root.name} <span className="text-sm text-zinc-500 font-normal">— усі товари ({root.available})</span> <ChevronRight size={16} />
                </a>
                {kids.length
                  ? <div className="grid grid-cols-3 gap-x-1 gap-y-0.5 max-h-[60vh] overflow-y-auto pr-1">{kids.map(c => link(c, '!py-2'))}</div>
                  : <p className="text-sm text-zinc-500">У цьому розділі немає підрозділів — відкрийте його повністю.</p>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogMenu;
