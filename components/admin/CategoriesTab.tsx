/// <reference types="vite/client" />
import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Save, X, Loader2, Edit2, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, FolderTree,
  Copy, CheckCircle, AlertTriangle, CornerDownRight,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import {
  useCategories, ProductCategory, CATEGORY_ICONS, getCategoryIcon, getRootCategories,
  getChildren, getCategoryTree, slugify,
} from '../../categories';
import { PRESET_OPTIONS } from '../../productAttributes';
import migrationSql from '../../supabase/migrations/20261124120000_product_categories.sql?raw';

type FormState = {
  name: string;
  slug: string;
  parent_id: string;
  icon: string;
  description: string;
  is_active: boolean;
  kind: 'tyre' | 'generic';
  filter_preset: string;
};

const EMPTY_FORM: FormState = {
  name: '', slug: '', parent_id: '', icon: 'package', description: '', is_active: true, kind: 'generic', filter_preset: '',
};

const CategoriesTab: React.FC = () => {
  const { categories, dbReady, loading, reload } = useCategories({ includeInactive: true });
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [editing, setEditing] = useState<ProductCategory | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const flash = (type: 'ok' | 'err', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // Number of products directly in each category
  useEffect(() => {
    if (!dbReady || categories.length === 0) return;
    Promise.all(categories.map(c =>
      supabase.from('tyres').select('id', { count: 'exact', head: true }).eq('category_id', c.id)
        .then(r => [c.id, r.count || 0] as const)
    )).then(entries => setCounts(Object.fromEntries(entries)));
  }, [categories, dbReady]);

  const totalInTree = (cat: ProductCategory) =>
    getCategoryTree(categories, cat).reduce((sum, c) => sum + (counts[c.id] || 0), 0);

  const openCreate = (parentId?: number) => {
    const parent = parentId ? categories.find(c => c.id === parentId) : undefined;
    setEditing(null);
    setForm({ ...EMPTY_FORM, parent_id: parentId ? String(parentId) : '', kind: parent?.kind || 'generic' });
    setShowForm(true);
  };

  const openEdit = (cat: ProductCategory) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      parent_id: cat.parent_id ? String(cat.parent_id) : '',
      icon: cat.icon || 'package',
      description: cat.description || '',
      is_active: cat.is_active,
      kind: cat.kind,
      filter_preset: cat.filter_preset || '',
    });
    setShowForm(true);
  };

  // A category can't become a child of itself or of its own sub-categories
  const parentOptions = useMemo(() => {
    const blocked = editing ? new Set(getCategoryTree(categories, editing).map(c => c.id)) : new Set<number>();
    return categories.filter(c => !blocked.has(c.id));
  }, [categories, editing]);

  const save = async () => {
    const name = form.name.trim();
    if (!name) { flash('err', 'Вкажіть назву категорії'); return; }
    setSaving(true);
    const parentId = form.parent_id ? Number(form.parent_id) : null;
    const siblings = categories.filter(c => (c.parent_id || null) === parentId && c.id !== editing?.id);
    const payload = {
      name,
      slug: (form.slug.trim() ? slugify(form.slug) : slugify(name)),
      parent_id: parentId,
      icon: form.icon,
      description: form.description.trim() || null,
      is_active: form.is_active,
      kind: form.kind,
      filter_preset: form.kind === 'tyre' ? null : (form.filter_preset || null),
      ...(editing ? {} : { sort_order: (Math.max(0, ...siblings.map(s => s.sort_order)) + 10) }),
    };
    const { error } = editing
      ? await supabase.from('product_categories').update(payload).eq('id', editing.id)
      : await supabase.from('product_categories').insert([payload]);
    setSaving(false);
    if (error) {
      flash('err', error.message.includes('duplicate') ? 'Категорія з такою адресою (slug) вже існує — змініть назву або адресу' : `Помилка: ${error.message}`);
      return;
    }
    setShowForm(false);
    flash('ok', editing ? 'Категорію збережено' : 'Категорію додано');
    reload();
  };

  const remove = async (cat: ProductCategory) => {
    const inside = totalInTree(cat);
    if (inside > 0) {
      flash('err', `У категорії «${cat.name}» є товари (${inside} шт). Спочатку перенесіть їх в іншу категорію у розділі «Товари».`);
      return;
    }
    const subs = getCategoryTree(categories, cat).length - 1;
    const extra = subs > 0 ? ` Разом з нею видаляться підкатегорії (${subs} шт).` : '';
    if (!window.confirm(`Видалити категорію «${cat.name}»?${extra}`)) return;
    const { error } = await supabase.from('product_categories').delete().eq('id', cat.id);
    if (error) { flash('err', `Помилка: ${error.message}`); return; }
    flash('ok', 'Категорію видалено');
    reload();
  };

  const toggleActive = async (cat: ProductCategory) => {
    const { error } = await supabase.from('product_categories').update({ is_active: !cat.is_active }).eq('id', cat.id);
    if (error) flash('err', `Помилка: ${error.message}`); else reload();
  };

  const move = async (cat: ProductCategory, dir: -1 | 1) => {
    const siblings = cat.parent_id ? getChildren(categories, cat.parent_id) : getRootCategories(categories);
    const idx = siblings.findIndex(s => s.id === cat.id);
    const other = siblings[idx + dir];
    if (!other) return;
    // Re-number all siblings so equal sort_order values don't block the swap
    const reordered = [...siblings];
    reordered[idx] = other;
    reordered[idx + dir] = cat;
    await Promise.all(reordered.map((c, i) =>
      supabase.from('product_categories').update({ sort_order: (i + 1) * 10 }).eq('id', c.id)));
    reload();
  };

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(migrationSql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      flash('err', 'Не вдалося скопіювати автоматично. Відкрийте файл supabase/migrations/20261124120000_product_categories.sql');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#FFC300]" size={40} /></div>;
  }

  if (!dbReady) {
    return (
      <div className="max-w-2xl mx-auto bg-zinc-900 border border-[#FFC300]/40 rounded-2xl p-6 space-y-4 animate-in fade-in">
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-[#FFC300]" size={28} />
          <h2 className="text-xl font-black uppercase">Потрібне одноразове налаштування бази</h2>
        </div>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Щоб керувати категоріями, у базі даних потрібно створити таблицю категорій. Це робиться один раз, займає хвилину:
        </p>
        <ol className="list-decimal list-inside text-zinc-300 text-sm space-y-2">
          <li>Натисніть кнопку <b>«Скопіювати SQL»</b> нижче.</li>
          <li>Відкрийте <b>supabase.com</b> → ваш проєкт → <b>SQL Editor</b> → <b>New query</b>.</li>
          <li>Вставте скопійований текст і натисніть <b>Run</b>.</li>
          <li>Поверніться сюди й оновіть сторінку.</li>
        </ol>
        <p className="text-zinc-500 text-xs">
          Існуючі шини автоматично розкладуться по підкатегоріях (Легкові, SUV, Буси, Вантажні, Агро). Нічого не видаляється.
        </p>
        <button
          onClick={copySql}
          className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          {copied ? <><CheckCircle size={18} /> Скопійовано!</> : <><Copy size={18} /> Скопіювати SQL</>}
        </button>
        {message && <p className="text-red-400 text-xs">{message.text}</p>}
      </div>
    );
  }

  const renderRow = (cat: ProductCategory, depth: number, siblingsCount: number, index: number): React.ReactNode => {
    const Icon = getCategoryIcon(cat.icon);
    const children = getChildren(categories, cat.id);
    return (
      <React.Fragment key={cat.id}>
        <div
          className={`flex items-center gap-2 md:gap-3 p-3 rounded-xl border transition-colors ${
            cat.is_active ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-950 border-zinc-900 opacity-60'
          }`}
          style={{ marginLeft: depth * 24 }}
        >
          {depth > 0 && <CornerDownRight size={14} className="text-zinc-600 shrink-0" />}
          <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center text-[#FFC300] shrink-0">
            <Icon size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white truncate">{cat.name}</span>
              {cat.kind === 'tyre' && <span className="text-[9px] font-black uppercase bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded">шини</span>}
              {cat.filter_preset && <span className="text-[9px] font-black uppercase bg-emerald-900/40 text-emerald-300 px-1.5 py-0.5 rounded">фільтри: {cat.filter_preset === 'batteries' ? 'акумулятори' : 'диски'}</span>}
              {!cat.is_active && <span className="text-[9px] font-black uppercase bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">прихована</span>}
            </div>
            <span className="text-[11px] text-zinc-500">
              Товарів: {depth === 0 && children.length ? `${totalInTree(cat)} (разом з підкатегоріями)` : counts[cat.id] || 0}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => move(cat, -1)} disabled={index === 0} className="p-2 text-zinc-500 hover:text-white disabled:opacity-20" title="Вище"><ArrowUp size={16} /></button>
            <button onClick={() => move(cat, 1)} disabled={index === siblingsCount - 1} className="p-2 text-zinc-500 hover:text-white disabled:opacity-20" title="Нижче"><ArrowDown size={16} /></button>
            <button onClick={() => toggleActive(cat)} className="p-2 text-zinc-500 hover:text-white" title={cat.is_active ? 'Сховати з сайту' : 'Показати на сайті'}>
              {cat.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            {depth === 0 && (
              <button onClick={() => openCreate(cat.id)} className="p-2 text-zinc-500 hover:text-[#FFC300]" title="Додати підкатегорію"><Plus size={16} /></button>
            )}
            <button onClick={() => openEdit(cat)} className="p-2 text-zinc-500 hover:text-[#FFC300]" title="Редагувати"><Edit2 size={16} /></button>
            <button onClick={() => remove(cat)} className="p-2 text-zinc-500 hover:text-red-500" title="Видалити"><Trash2 size={16} /></button>
          </div>
        </div>
        {children.map((child, i) => renderRow(child, depth + 1, children.length, i))}
      </React.Fragment>
    );
  };

  const roots = getRootCategories(categories);

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in">
      <div className="flex items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <FolderTree className="text-[#FFC300]" />
          <div>
            <h2 className="font-black uppercase text-lg">Категорії магазину</h2>
            <p className="text-zinc-500 text-xs">Порядок тут = порядок на сайті. Приховані категорії не видно покупцям.</p>
          </div>
        </div>
        <button onClick={() => openCreate()} className="bg-[#FFC300] text-black font-black px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[#e6b000] active:scale-95 transition-all shrink-0">
          <Plus size={18} /> <span className="hidden sm:inline">Нова категорія</span>
        </button>
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-sm font-bold border ${message.type === 'ok' ? 'bg-green-900/20 text-green-400 border-green-900/50' : 'bg-red-900/20 text-red-400 border-red-900/50'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-2">
        {roots.length === 0 && <p className="text-center text-zinc-500 py-10">Категорій ще немає. Натисніть «Нова категорія».</p>}
        {roots.map((cat, i) => renderRow(cat, 0, roots.length, i))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black">{editing ? 'Редагування категорії' : 'Нова категорія'}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 text-zinc-500 hover:text-white bg-zinc-800 rounded-full"><X size={20} /></button>
            </div>

            <div>
              <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Назва</label>
              <input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Напр. Диски" className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-bold outline-none focus:border-[#FFC300]" />
            </div>

            <div>
              <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Батьківська категорія</label>
              <select value={form.parent_id} onChange={e => setForm({ ...form, parent_id: e.target.value })} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white">
                <option value="">— Немає (головна категорія) —</option>
                {parentOptions.filter(c => !c.parent_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="text-[11px] text-zinc-500 mt-1">Наприклад, «Легкові» — підкатегорія «Шини».</p>
            </div>

            <div>
              <label className="block text-zinc-400 text-xs font-bold uppercase mb-2">Іконка</label>
              <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5">
                {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, icon: key })}
                    className={`aspect-square rounded-lg border flex items-center justify-center transition-colors ${form.icon === key ? 'bg-[#FFC300] text-black border-[#FFC300]' : 'bg-black border-zinc-800 text-zinc-400 hover:text-white'}`}
                  >
                    <Icon size={18} />
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-3 bg-black/40 border border-zinc-800 rounded-xl p-3 cursor-pointer">
              <input type="checkbox" checked={form.kind === 'tyre'} onChange={e => setForm({ ...form, kind: e.target.checked ? 'tyre' : 'generic' })} className="mt-1 accent-[#FFC300]" />
              <span>
                <span className="block text-sm font-bold text-white">Це шини</span>
                <span className="block text-[11px] text-zinc-500">Покупці побачать фільтри «ширина / висота / радіус / сезон», а в адмінці — поля шини.</span>
              </span>
            </label>

            {form.kind !== 'tyre' && (
              <div>
                <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Характеристики та фільтри</label>
                <select value={form.filter_preset} onChange={e => setForm({ ...form, filter_preset: e.target.value })} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white">
                  {PRESET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <p className="text-[11px] text-zinc-500 mt-1">Підкатегорії успадковують цей набір від головної категорії.</p>
              </div>
            )}

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="accent-[#FFC300]" />
              <span className="text-sm text-zinc-300">Показувати на сайті</span>
            </label>

            <div>
              <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Опис (необов'язково, для SEO)</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white text-sm" />
            </div>

            <div>
              <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Адреса в посиланні (необов'язково)</label>
              <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder={slugify(form.name || 'nazva')} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-mono text-sm" />
              <p className="text-[11px] text-zinc-500 mt-1">Сайт покаже категорію за посиланням ?c={form.slug ? slugify(form.slug) : slugify(form.name || 'nazva')}</p>
            </div>

            <button onClick={save} disabled={saving} className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Зберегти
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesTab;
