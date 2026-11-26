import React, { useEffect, useMemo, useState } from 'react';
import { Car, Battery, Disc3, CircleDot, Phone } from 'lucide-react';
import { supabase } from '../../supabaseClient';

export interface Vehicle {
  id: number; make: string; model: string; years: string; tyres: string[];
  wheel_pcd: string | null; wheel_dia: number | null;
  battery_ah_min: number | null; battery_ah_max: number | null;
  battery_body: 'euro' | 'asia' | null; battery_polarity: 'right' | 'left' | null;
}

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
}> = ({ onTyreSize, onBattery, onWheels }) => {
  const [list, setList] = useState<Vehicle[]>([]);
  const [make, setMake] = useState('');
  const [id, setId] = useState<number | ''>('');

  useEffect(() => {
    supabase.from('vehicles').select('id, make, model, years, tyres, wheel_pcd, wheel_dia, battery_ah_min, battery_ah_max, battery_body, battery_polarity')
      .order('make').order('model').then(({ data }) => setList((data as Vehicle[]) || []));
  }, []);
  const makes = useMemo(() => [...new Set(list.map(v => v.make))], [list]);
  const models = list.filter(v => v.make === make);
  const car = list.find(v => v.id === id);

  return (
    <section className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-4 md:p-6">
      <h2 className="text-base md:text-xl font-black uppercase tracking-tight mb-3 flex items-center gap-2"><Car className="text-[#FFC300]" size={22} /> Підбір за авто</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select aria-label="Марка авто" value={make} onChange={e => { setMake(e.target.value); setId(''); }} className={selectCls}>
          <option value="">Марка</option>{makes.map(m => <option key={m}>{m}</option>)}
        </select>
        <select aria-label="Модель авто" value={id} disabled={!make} onChange={e => setId(e.target.value ? Number(e.target.value) : '')} className={selectCls}>
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
                  return (
                    <button key={s} disabled={!p} onClick={() => p && onTyreSize(...p)}
                      className="px-3 h-10 rounded-xl bg-[#FFC300] text-black font-black text-sm hover:bg-white transition-colors disabled:bg-zinc-800 disabled:text-zinc-400">{s}</button>
                  );
                })}
              </div>
            </div>
          )}
          {car.battery_ah_min && (
            <div className="flex flex-wrap items-center gap-2 justify-between bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5">
              <p className="text-sm text-zinc-300 flex items-center gap-2">
                <Battery size={18} className="text-[#FFC300] shrink-0" />
                <span>Акумулятор: <b className="text-white">{car.battery_ah_min === car.battery_ah_max ? car.battery_ah_min : `${car.battery_ah_min}–${car.battery_ah_max}`} Ah</b>
                  {car.battery_polarity ? `, ${car.battery_polarity === 'right' ? 'плюс праворуч' : 'плюс ліворуч'}` : ''}
                  {car.battery_body ? `, корпус ${car.battery_body === 'euro' ? 'Європа' : 'Азія'}` : ''}</span>
              </p>
              {onBattery && (
                <button onClick={() => onBattery(car.battery_polarity ? { polarity: car.battery_polarity } : {})}
                  className="h-9 px-3 rounded-lg border border-[#FFC300]/50 text-[#FFC300] font-bold text-xs hover:bg-[#FFC300]/10">Показати акумулятори</button>
              )}
            </div>
          )}
          {car.wheel_pcd && (
            <div className="flex flex-wrap items-center gap-2 justify-between bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5">
              <p className="text-sm text-zinc-300 flex items-center gap-2">
                <Disc3 size={18} className="text-[#FFC300] shrink-0" />
                <span>Диски: кріплення <b className="text-white">{car.wheel_pcd}</b>{car.wheel_dia ? <>, центральний отвір <b className="text-white">{car.wheel_dia}</b> мм</> : null}</span>
              </p>
              {onWheels && (
                <button onClick={() => onWheels({ pcd: car.wheel_pcd! })} className="h-9 px-3 rounded-lg border border-[#FFC300]/50 text-[#FFC300] font-bold text-xs hover:bg-[#FFC300]/10">Показати диски</button>
              )}
            </div>
          )}
          <p className="text-[11px] text-zinc-500 flex items-center gap-1.5"><Phone size={12} /> Комплектації бувають різні — перед покупкою звірте розмір з боковиною шини або уточніть у менеджера.</p>
        </div>
      )}
    </section>
  );
};

export default VehiclePicker;
