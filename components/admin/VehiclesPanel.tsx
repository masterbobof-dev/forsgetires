import React, { useEffect, useMemo, useState } from 'react';
import { Car, Plus, Pencil, Trash2, Save, X, Loader2, Search } from 'lucide-react';
import { supabase } from '../../supabaseClient';

/** A car of the "Підбір за авто" block on the home page (table vehicles). */
interface VehicleRow {
  id: number; make: string; model: string; years: string; tyres: string[];
  wheel_pcd: string | null; wheel_dia: number | null;
  battery_ah_min: number | null; battery_ah_max: number | null;
  battery_body: 'euro' | 'asia' | null; battery_polarity: 'right' | 'left' | null;
  note: string | null;
}

type Form = { make: string; model: string; years: string; tyres: string; wheel_pcd: string; wheel_dia: string; ah_min: string; ah_max: string; body: string; polarity: string; note: string };

const EMPTY: Form = { make: '', model: '', years: '', tyres: '', wheel_pcd: '', wheel_dia: '', ah_min: '', ah_max: '', body: '', polarity: '', note: '' };
const inputCls = 'w-full bg-black border border-zinc-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-[#FFC300]';
const num = (s: string) => (s.trim() === '' || isNaN(Number(s.replace(',', '.'))) ? null : Number(s.replace(',', '.')));

/** "185/65 R15, 195/55r16" -> ['185/65 R15', '195/55 R16'] */
const parseTyres = (s: string) => s.split(/[,;\n]+/).map(t => t.trim().toUpperCase().replace(/\s*R\s*/, ' R')).filter(Boolean);

/** Admin: add, change and delete cars for the car picker on the home page. */
const VehiclesPanel: React.FC = () => {
  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<VehicleRow | 'new' | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('vehicles').select('*').order('make').order('model');
    if (error) setMsg({ ok: false, text: 'Не вдалося завантажити машини: ' + error.message });
    setRows((data as VehicleRow[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter(r => `${r.make} ${r.model}`.toLowerCase().includes(s)) : rows;
  }, [rows, q]);

  const open = (r: VehicleRow | 'new') => {
    setEditing(r);
    setMsg(null);
    setForm(r === 'new' ? EMPTY : {
      make: r.make, model: r.model, years: r.years, tyres: (r.tyres || []).join(', '),
      wheel_pcd: r.wheel_pcd || '', wheel_dia: r.wheel_dia != null ? String(r.wheel_dia) : '',
      ah_min: r.battery_ah_min != null ? String(r.battery_ah_min) : '', ah_max: r.battery_ah_max != null ? String(r.battery_ah_max) : '',
      body: r.battery_body || '', polarity: r.battery_polarity || '', note: r.note || '',
    });
  };

  const save = async () => {
    if (!form.make.trim() || !form.model.trim()) { setMsg({ ok: false, text: 'Вкажіть марку і модель' }); return; }
    setSaving(true);
    const payload = {
      make: form.make.trim(), model: form.model.trim(), years: form.years.trim(), tyres: parseTyres(form.tyres),
      wheel_pcd: form.wheel_pcd.trim().replace(/[хХ*]/g, 'x') || null, wheel_dia: num(form.wheel_dia),
      battery_ah_min: num(form.ah_min), battery_ah_max: num(form.ah_max),
      battery_body: form.body || null, battery_polarity: form.polarity || null, note: form.note.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing === 'new'
      ? await supabase.from('vehicles').insert([payload])
      : await supabase.from('vehicles').update(payload).eq('id', (editing as VehicleRow).id);
    setSaving(false);
    if (error) { setMsg({ ok: false, text: 'Не збереглося: ' + error.message }); return; }
    setMsg({ ok: true, text: 'Збережено' });
    setEditing(null);
    load();
  };

  const remove = async (r: VehicleRow) => {
    if (!confirm(`Видалити ${r.make} ${r.model}?`)) return;
    const { error } = await supabase.from('vehicles').delete().eq('id', r.id);
    if (error) { setMsg({ ok: false, text: 'Не видалилося: ' + error.message }); return; }
    setRows(rows.filter(x => x.id !== r.id));
  };

  const field = (key: keyof Form, label: string, placeholder = '') => (
    <div>
      <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">{label}</label>
      <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} className={inputCls} />
    </div>
  );

  return (
    <section className="mt-8 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg md:text-xl font-black uppercase flex items-center gap-2"><Car className="text-[#FFC300]" /> Машини для підбору <span className="text-zinc-500 text-sm">({rows.length})</span></h2>
        <button onClick={() => open('new')} className="bg-[#FFC300] text-black font-black px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-white"><Plus size={18} /> Додати машину</button>
      </div>
      <p className="text-zinc-500 text-sm mb-4">Ці машини показуються в блоці «Підбір за авто» на головній сторінці: покупець вибирає марку й модель і бачить розміри шин, акумулятор і диски.</p>

      {msg && <div className={`mb-3 text-sm font-bold ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</div>}

      {editing && (
        <div className="mb-5 bg-black/40 border border-zinc-700 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {field('make', 'Марка', 'Volkswagen')}
            {field('model', 'Модель', 'Golf VII')}
            {field('years', 'Роки', '2012–2019')}
          </div>
          {field('tyres', 'Розміри шин (через кому)', '195/65 R15, 205/55 R16')}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {field('wheel_pcd', 'Диски: PCD', '5x112')}
            {field('wheel_dia', 'Диски: DIA', '57.1')}
            {field('ah_min', 'АКБ: від, А·год', '60')}
            {field('ah_max', 'АКБ: до, А·год', '74')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">АКБ: полярність</label>
              <select value={form.polarity} onChange={e => setForm({ ...form, polarity: e.target.value })} className={inputCls}>
                <option value="">не вказано</option>
                <option value="right">R+ (плюс праворуч)</option>
                <option value="left">L+ (плюс ліворуч)</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">АКБ: корпус</label>
              <select value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} className={inputCls}>
                <option value="">не вказано</option>
                <option value="euro">європейський</option>
                <option value="asia">азійський</option>
              </select>
            </div>
          </div>
          {field('note', 'Примітка (необов\'язково)')}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="bg-[#FFC300] text-black font-black px-5 py-2 rounded-xl flex items-center gap-2 disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Зберегти</button>
            <button onClick={() => setEditing(null)} className="bg-zinc-800 text-white font-bold px-5 py-2 rounded-xl flex items-center gap-2"><X size={16} /> Скасувати</button>
          </div>
        </div>
      )}

      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Пошук: марка або модель" className={inputCls + ' pl-9'} />
      </div>

      {loading ? <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-[#FFC300]" /></div> : (
        <div className="divide-y divide-zinc-800 max-h-[60vh] overflow-y-auto">
          {shown.map(r => (
            <div key={r.id} className="py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white truncate">{r.make} {r.model} <span className="text-zinc-500 font-normal text-sm">{r.years}</span></div>
                <div className="text-xs text-zinc-500 truncate">
                  {(r.tyres || []).join(', ') || 'шини не вказані'}
                  {r.wheel_pcd ? ` · диски ${r.wheel_pcd}` : ''}
                  {r.battery_ah_min ? ` · АКБ ${r.battery_ah_min}${r.battery_ah_max && r.battery_ah_max !== r.battery_ah_min ? '–' + r.battery_ah_max : ''} А·год` : ''}
                </div>
              </div>
              <button onClick={() => open(r)} title="Змінити" className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"><Pencil size={16} /></button>
              <button onClick={() => remove(r)} title="Видалити" className="p-2 rounded-lg bg-zinc-800 hover:bg-red-900/40 text-red-400"><Trash2 size={16} /></button>
            </div>
          ))}
          {!shown.length && <p className="py-6 text-center text-zinc-500 text-sm">Нічого не знайдено</p>}
        </div>
      )}
    </section>
  );
};

export default VehiclesPanel;
