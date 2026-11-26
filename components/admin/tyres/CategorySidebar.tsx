import React, { useEffect, useState } from 'react';
import { FolderOpen, Folder, ChevronRight, ChevronDown, Pencil, X, Package } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { getRootCategories, getChildren, type ProductCategory } from '../../../categories';
import CategoriesTab from '../CategoriesTab';
import VehiclesPanel from '../VehiclesPanel';

/** How many goods each section has (including its subsections), loaded once per opening of the tab. */
const useTotals = (categories: ProductCategory[], reloadKey: number) => {
  const [own, setOwn] = useState<Record<number, number>>({});
  useEffect(() => {
    supabase.rpc('admin_category_totals').then(({ data }) => {
      const m: Record<number, number> = {};
      for (const r of (data as { category_id: number | null; n: number }[]) || []) if (r.category_id != null) m[r.category_id] = Number(r.n);
      setOwn(m);
    });
  }, [reloadKey]);
  const total = (c: ProductCategory): number => (own[c.id] || 0) + getChildren(categories, c.id).reduce((a, k) => a + total(k), 0);
  return total;
};

/** Window with the full sections editor (names, subsections, order, descriptions, questions-answers) and the cars for the car picker. */
export const CategoriesEditor: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-[200] flex">
    <div className="absolute inset-0 bg-black/80" onClick={onClose} />
    <div className="relative ml-auto w-full max-w-5xl h-full bg-zinc-950 border-l border-zinc-800 overflow-y-auto p-3 md:p-6 animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-black uppercase flex items-center gap-2"><FolderOpen className="text-[#FFC300]" /> Категорії і підкатегорії</h2>
        <button onClick={onClose} aria-label="Закрити" className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800"><X size={22} /></button>
      </div>
      <CategoriesTab />
      <VehiclesPanel />
    </div>
  </div>
);

/**
 * Left column of "Товари": every section with its subsections and the number of goods; a click shows its goods,
 * the pencil opens the sections editor right here (no separate tab).
 */
const CategorySidebar: React.FC<{
  categories: ProductCategory[]; active: string; onPick: (id: string) => void; allCount: number; onEdit: () => void; reloadKey: number;
}> = ({ categories, active, onPick, allCount, onEdit, reloadKey }) => {
  const total = useTotals(categories, reloadKey);
  const [open, setOpen] = useState<Set<number>>(new Set());
  // the section of the chosen subsection stays open
  useEffect(() => {
    const c = categories.find(x => String(x.id) === active);
    if (c?.parent_id) setOpen(prev => new Set(prev).add(c.parent_id!));
  }, [active, categories]);
  const row = (c: ProductCategory, depth: number) => {
    const kids = getChildren(categories, c.id);
    const isOpen = open.has(c.id);
    const isActive = String(c.id) === active;
    return (
      <div key={c.id}>
        <div className={`flex items-center rounded-lg ${isActive ? 'bg-[#FFC300] text-black' : 'text-zinc-300 hover:bg-zinc-800'} ${c.is_active ? '' : 'opacity-50'}`} style={{ paddingLeft: depth * 14 }}>
          {kids.length ? (
            <button onClick={() => setOpen(prev => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} className="w-6 h-8 flex items-center justify-center shrink-0" aria-label={isOpen ? 'Згорнути' : 'Розгорнути'}>
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : <span className="w-6 shrink-0" />}
          <button onClick={() => onPick(String(c.id))} className="flex-1 min-w-0 flex items-center gap-1.5 py-1.5 pr-2 text-left text-xs font-bold" title={c.is_active ? c.name : `${c.name} (прихована на сайті)`}>
            {depth === 0 ? <Folder size={14} className={isActive ? '' : 'text-[#FFC300]'} /> : null}
            <span className="truncate flex-1">{c.name}</span>
            <span className={`text-[10px] font-bold ${isActive ? 'text-black/70' : 'text-zinc-500'}`}>{total(c)}</span>
          </button>
        </div>
        {isOpen && kids.map(k => row(k, depth + 1))}
      </div>
    );
  };
  return (
    <aside className="hidden 2xl:block w-64 shrink-0">
      <div className="sticky top-32 bg-zinc-900 border border-zinc-800 rounded-2xl p-2 max-h-[calc(100vh-9rem)] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between px-2 py-1.5 mb-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Категорії</span>
          <button onClick={onEdit} className="h-7 px-2 rounded-lg border border-zinc-700 text-[11px] font-bold text-zinc-300 hover:border-[#FFC300] flex items-center gap-1"><Pencil size={12} /> Редагувати</button>
        </div>
        <button onClick={() => onPick('all')} className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-black ${active === 'all' ? 'bg-[#FFC300] text-black' : 'text-white hover:bg-zinc-800'}`}>
          <Package size={14} /> <span className="flex-1 text-left">Усі товари</span> <span className="text-[10px]">{allCount}</span>
        </button>
        {getRootCategories(categories).map(c => row(c, 0))}
      </div>
    </aside>
  );
};

export default CategorySidebar;
