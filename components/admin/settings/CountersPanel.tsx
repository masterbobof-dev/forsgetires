import React, { useEffect, useState } from 'react';
import { BarChart3, Check, Loader2 } from 'lucide-react';
import { supabase } from '../../../supabaseClient';

/**
 * Visitor counters of Google Analytics (sex, age, interests of visitors) and Facebook/Instagram Pixel (ads).
 * The numbers are not secret: they are visible in the page anyway.
 */
const CountersPanel: React.FC = () => {
  const [ga, setGa] = useState('');
  const [fb, setFb] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    supabase.from('settings').select('key, value').in('key', ['ga_measurement_id', 'fb_pixel_id']).then(({ data }) => {
      setGa(data?.find(r => r.key === 'ga_measurement_id')?.value || '');
      setFb(data?.find(r => r.key === 'fb_pixel_id')?.value || '');
    });
  }, []);

  const save = async () => {
    const g = ga.trim().toUpperCase(), f = fb.trim();
    if (g && !/^G-[A-Z0-9]{4,20}$/.test(g)) { setMsg({ ok: false, text: 'Номер Google Analytics має вигляд G-XXXXXXXXXX' }); return; }
    if (f && !/^\d{6,20}$/.test(f)) { setMsg({ ok: false, text: 'Номер Pixel — це лише цифри' }); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.from('settings').upsert([{ key: 'ga_measurement_id', value: g }, { key: 'fb_pixel_id', value: f }]);
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Збережено. Лічильники запрацюють для нових відвідувачів сайту.' });
    if (!error) setGa(g);
  };

  return (
    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3 mt-6">
      <h5 className="text-white font-bold flex items-center gap-2"><BarChart3 size={18} className="text-[#FFC300]" /> Лічильники відвідувачів</h5>
      <p className="text-xs text-zinc-400 leading-relaxed">
        <b>Google Analytics</b> (безкоштовно) показує стать, вік та інтереси відвідувачів — після того, як у ньому ввімкнено «Сигнали Google»
        і відвідувачів назбирається достатньо. <b>Facebook Pixel</b> потрібен лише для реклами в Facebook / Instagram.
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-zinc-400 text-xs font-bold uppercase mb-1">Google Analytics (G-…)</span>
          <input value={ga} onChange={e => setGa(e.target.value)} placeholder="G-XXXXXXXXXX" autoComplete="off" className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-mono text-sm" />
        </label>
        <label className="block">
          <span className="block text-zinc-400 text-xs font-bold uppercase mb-1">Facebook Pixel (необов'язково)</span>
          <input value={fb} onChange={e => setFb(e.target.value)} placeholder="1234567890" autoComplete="off" inputMode="numeric" className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-mono text-sm" />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={save} disabled={busy} className="h-10 px-4 rounded-lg bg-[#FFC300] text-black font-black text-sm disabled:opacity-40">Зберегти</button>
        {busy && <Loader2 size={18} className="animate-spin text-[#FFC300]" />}
      </div>
      {msg && <p className={`text-sm font-bold flex items-center gap-1 ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.ok && <Check size={14} />} {msg.text}</p>}
    </div>
  );
};

export default CountersPanel;
