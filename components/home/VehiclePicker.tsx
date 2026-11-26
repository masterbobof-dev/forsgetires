import React, { useEffect, useMemo, useState } from 'react';
import { Car, Battery, Disc3, CircleDot, Phone, Search, Info, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { parseAttrRange } from '../shop/shopUtils';

export interface Vehicle {
  id: number; make: string; model: string; years: string; tyres: string[];
  wheel_pcd: string | null; wheel_dia: number | null;
  battery_ah_min: number | null; battery_ah_max: number | null;
  battery_body: 'euro' | 'asia' | null; battery_polarity: 'right' | 'left' | null; note: string | null;
}

const SAVED_KEY = 'forsage_my_car';
/** Battery filter for a car: its polarity and capacity from the recommended one up to a bit bigger (smaller is not fit). */
const batteryAttrs = (car: Vehicle): Record<string, string> => ({
  ...(car.battery_polarity ? { polarity: car.battery_polarity } : {}),
  ...(car.battery_ah_min ? { capacity: `${car.battery_ah_min}..${(car.battery_ah_max || car.battery_ah_min) + 10}` } : {}),
});
const countBadge = (n: number | null | undefined) => n == null ? '' : ` (${n})`;
const norm = (s: string) => s.toLowerCase().replace(/[^a-zа-яіїєґ0-9]+/gi, ' ').trim();

const selectCls = 'w-full bg-black border border-zinc-700 rounded-xl px-3 py-3 text-white font-bold outline-none focus:border-[#FFC300] disabled:opacity-40';

/** "185/60 R14" -> ['185', '60', 'R14'] */
export const splitTyreSize = (s: string): [string, string, string] | null => {
  const m = s.match(/^(\d{3})\/(\d{2})\s*(R\d{2}(?:[.,]5)?C?)$/i);
  return m ? [m[1], m[2], m[3].toUpperCase()] : null;
};

/** "Підбір за авто": the make and model give factory tyre sizes, the battery and the wheel fitment. */
const VehiclePicker: React.FC<{
  onTyreSize: (w: string, h: string, r: string) => void;
  onBattery?: (attrs: Record<string, string>) => void;
  onWheels?: (attrs: Record<string, string>) => void;
  /** hubcaps section (when there are no wheels to offer) */
  onHubcaps?: (radius: string) => void;
  phone?: string; phoneLink?: string;
}> = ({ onTyreSize, onBattery, onWheels, onHubcaps, phone, phoneLink }) => {
  const [list, setList] = useState<Vehicle[]>([]);
  const [make, setMake] = useState('');
  const [id, setId] = useState<number | ''>('');
  const [q, setQ] = useState('');

  useEffect(() => {
    supabase.from('vehicles').select('id, make, model, years, tyres, wheel_pcd, wheel_dia, battery_ah_min, battery_ah_max, battery_body, battery_polarity, note')
      .order('make').order('model').then(({ data }) => {
        const rows = (data as Vehicle[]) || [];
        setList(rows);
        // the car chosen last time on this phone/computer
        try {
          const saved = Number(localStorage.getItem(SAVED_KEY));
          const v = rows.find(r => r.id === saved);
          if (v) { setMake(v.make); setId(v.id); }
        } catch { /* no storage */ }
      });
  }, []);
  const choose = (v: Vehicle | null) => {
    setMake(v?.make || ''); setId(v?.id ?? ''); setQ('');
    try { if (v) localStorage.setItem(SAVED_KEY, String(v.id)); else localStorage.removeItem(SAVED_KEY); } catch { /* no storage */ }
  };
  const makes = useMemo(() => [...new Set(list.map(v => v.make))].sort((a, b) => a.localeCompare(b, 'uk')), [list]);
  const models = list.filter(v => v.make === make);
  const car = list.find(v => v.id === id);
  /** typing "golf 7" or "ланос" finds the car without scrolling two lists */
  const found = useMemo(() => {
    const words = norm(q).split(' ').filter(Boolean);
    if (!words.length) return [];
    return list.filter(v => { const t = norm(`${v.make} ${v.model}`); return words.every(w => t.includes(w)); }).slice(0, 8);
  }, [q, list]);
  /** how many goods each button would show: sizes, batteries, wheels (null = still counting) */
  const [counts, setCounts] = useState<{ tyres: Record<string, { all: number; stock: number }>; battery: number | null; wheels: number | null } | null>(null);
  useEffect(() => {
    if (!car) { setCounts(null); return; }
    let live = true;
    setCounts(null);
    const visible = () => supabase.from('tyres').select('id', { count: 'exact', head: true }).or('in_stock.neq.false,program_product_id.is.null');
    const tyreCounts = Promise.all(car.tyres.map(async size => {
      const [{ count: all }, { count: stock }] = await Promise.all([
        visible().ilike('title', `%${size}%`),
        visible().ilike('title', `%${size}%`).eq('on_order', false).neq('in_stock', false),
      ]);
      return [size, { all: all || 0, stock: stock || 0 }] as const;
    }));
    const batt = batteryAttrs(car);
    let bq = visible().eq('on_order', false).neq('in_stock', false).in('attributes->>capacity', parseAttrRange(batt.capacity || '')?.values || ['-']);
    if (batt.polarity) bq = bq.eq('attributes->>polarity', batt.polarity);
    const wq = car.wheel_pcd ? visible().eq('attributes->>pcd', car.wheel_pcd) : null;
    Promise.all([tyreCounts, batt.capacity ? bq : Promise.resolve({ count: null }), wq || Promise.resolve({ count: null })]).then(([t, b, w]) => {
      if (live) setCounts({ tyres: Object.fromEntries(t), battery: b.count ?? null, wheels: w.count ?? null });
    }, () => undefined);
    return () => { live = false; };
  }, [car?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const batteryText = car && car.battery_ah_min
    ? <>Акумулятор: <b className="text-white">{car.battery_ah_min === car.battery_ah_max ? car.battery_ah_min : `${car.battery_ah_min}–${car.battery_ah_max}`} Ah</b>
      {car.battery_polarity ? `, ${car.battery_polarity === 'right' ? 'плюс праворуч' : 'плюс ліворуч'}` : ''}
      {car.battery_body ? `, корпус ${car.battery_body === 'euro' ? 'Європа' : 'Азія'}` : ''}</>
    : <>Акумулятор: залежить від версії авто — підкажемо телефоном</>;

  return (
    <section className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-4 md:p-6">
      <h2 className="text-base md:text-xl font-black uppercase tracking-tight mb-3 flex items-center gap-2"><Car className="text-[#FFC300]" size={22} /> Підбір за авто</h2>
      <div className="relative mb-2">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={q} onChange={e => setQ(e.target.value)} aria-label="Пошук авто" placeholder="Швидкий пошук: напр. Golf 7, Ланос, Camry"
          className="w-full h-11 bg-black border border-zinc-700 rounded-xl pl-9 pr-9 text-white outline-none focus:border-[#FFC300]" />
        {q && <button onClick={() => setQ('')} aria-label="Очистити" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500"><X size={16} /></button>}
        {q.trim() && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl">
            {found.length ? found.map(v => (
              <button key={v.id} onClick={() => choose(v)} className="w-full text-left px-3 py-2.5 hover:bg-zinc-800 text-sm">
                <b className="text-white">{v.make} {v.model}</b> <span className="text-zinc-500">{v.years}</span>
              </button>
            )) : <p className="px-3 py-3 text-sm text-zinc-400">Такого авто ще немає в списку — зателефонуйте, підберемо.</p>}
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select aria-label="Марка авто" value={make} onChange={e => { setMake(e.target.value); setId(''); }} className={selectCls}>
          <option value="">Марка ({makes.length})</option>{makes.map(m => <option key={m}>{m}</option>)}
        </select>
        <select aria-label="Модель авто" value={id} disabled={!make} onChange={e => choose(list.find(v => v.id === Number(e.target.value)) || null)} className={selectCls}>
          <option value="">Модель</option>{models.map(v => <option key={v.id} value={v.id}>{v.model}{v.years ? ` (${v.years})` : ''}</option>)}
        </select>
      </div>

      {car && (
        <div className="mt-4 space-y-3 animate-in fade-in duration-300">
          {car.tyres.length > 0 && (
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase mb-1.5 flex items-center gap-1.5"><CircleDot size={14} className="text-[#FFC300]" /> Шини (заводські розміри)</p>
              <div className="flex flex-wrap gap-2">
                {car.tyres.map(s => {
                  const p = splitTyreSize(s);
                  const c = counts?.tyres[s];
                  return (
                    <button key={s} disabled={!p} onClick={() => p && onTyreSize(...p)}
                      className={`px-3 min-h-10 py-1.5 rounded-xl font-black text-sm transition-colors text-left leading-tight ${c && c.all === 0 ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-[#FFC300] text-black hover:bg-white'}`}>
                      {s}
                      {c && <span className="block text-[10px] font-bold opacity-80">{c.stock ? `${c.stock} в наявності` : c.all ? `${c.all} під замовлення` : 'під замовлення'}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 justify-between bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5">
            <p className="text-sm text-zinc-300 flex items-center gap-2">
              <Battery size={18} className="text-[#FFC300] shrink-0" />
              <span>{batteryText}</span>
            </p>
            {onBattery && (
              counts?.battery === 0 && phoneLink ? (
                <a href={phoneLink} className="h-9 px-3 rounded-lg border border-[#FFC300]/50 text-[#FFC300] font-bold text-xs hover:bg-[#FFC300]/10 flex items-center gap-1.5"><Phone size={13} /> Підберемо телефоном</a>
              ) : (
                <button onClick={() => onBattery(batteryAttrs(car))}
                  className="h-9 px-3 rounded-lg border border-[#FFC300]/50 text-[#FFC300] font-bold text-xs hover:bg-[#FFC300]/10">Показати акумулятори{countBadge(car.battery_ah_min ? counts?.battery : null)}</button>
              )
            )}
          </div>
          {car.wheel_pcd && (
            <div className="flex flex-wrap items-center gap-2 justify-between bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5">
              <p className="text-sm text-zinc-300 flex items-center gap-2">
                <Disc3 size={18} className="text-[#FFC300] shrink-0" />
                <span>Диски: кріплення <b className="text-white">{car.wheel_pcd}</b>{car.wheel_dia ? <>, центральний отвір <b className="text-white">{car.wheel_dia}</b> мм</> : null}</span>
              </p>
              {counts?.wheels ? (
                onWheels && <button onClick={() => onWheels({ pcd: car.wheel_pcd! })} className="h-9 px-3 rounded-lg border border-[#FFC300]/50 text-[#FFC300] font-bold text-xs hover:bg-[#FFC300]/10">Показати диски ({counts.wheels})</button>
              ) : counts ? (
                <div className="w-full flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-zinc-400 flex-1 min-w-[180px]">Таких дисків зараз немає на сайті — привеземо під замовлення.</span>
                  {phoneLink && <a href={phoneLink} className="h-9 px-3 rounded-lg border border-[#FFC300]/50 text-[#FFC300] font-bold text-xs hover:bg-[#FFC300]/10 flex items-center gap-1.5"><Phone size={13} /> {phone || 'Зателефонувати'}</a>}
                  {onHubcaps && [...new Set(car.tyres.map(t => splitTyreSize(t)?.[2].replace(/C$/, '')).filter(Boolean) as string[])].map(r => (
                    <button key={r} onClick={() => onHubcaps(r)} className="h-9 px-3 rounded-lg border border-zinc-700 text-zinc-300 font-bold text-xs hover:border-zinc-500">Ковпаки {r}</button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
          {car.note && <p className="text-xs text-zinc-300 flex items-start gap-1.5"><Info size={14} className="text-[#FFC300] shrink-0 mt-0.5" /> {car.note}</p>}
          <p className="text-[11px] text-zinc-500 flex items-center gap-1.5"><Phone size={12} /> Комплектації бувають різні — перед покупкою звірте розмір з боковиною шини або уточніть у менеджера.</p>
        </div>
      )}
    </section>
  );
};

export default VehiclePicker;
