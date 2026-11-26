import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Package, Loader2, Check } from 'lucide-react';
import { supabase } from '../supabaseClient';

/** City + branch/parcel locker picker using the Nova Poshta API (key from settings.nova_poshta_key). */
interface Props {
  city: string;
  warehouse: string;
  onChange: (v: { city: string; warehouse: string }) => void;
  inputCls: string;
}

interface NpCity { Present: string; DeliveryCity: string; MainDescription: string }
interface NpWarehouse { Ref: string; Description: string; Number: string }

let keyCache: Promise<string> | null = null;
const loadKey = () => (keyCache ??= Promise.resolve(supabase.from('settings').select('value').eq('key', 'nova_poshta_key').maybeSingle())
  .then(({ data }) => String((data as any)?.value || '').trim()).catch(() => ''));

const np = async (key: string, calledMethod: string, methodProperties: Record<string, string>) => {
  const res = await fetch('https://api.novaposhta.ua/v2.0/json/', {
    method: 'POST', body: JSON.stringify({ apiKey: key, modelName: 'Address', calledMethod, methodProperties }),
  });
  const data = await res.json();
  return data.success ? data.data : [];
};

const NovaPoshtaPicker: React.FC<Props> = ({ city, warehouse, onChange, inputCls }) => {
  const [key, setKey] = useState('');
  const [cityQuery, setCityQuery] = useState(city);
  const [cities, setCities] = useState<NpCity[]>([]);
  const [cityRef, setCityRef] = useState('');
  const [showCities, setShowCities] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [warehouses, setWarehouses] = useState<NpWarehouse[]>([]);
  const [loadingWh, setLoadingWh] = useState(false);
  const [whQuery, setWhQuery] = useState(warehouse);
  const [showWh, setShowWh] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => { loadKey().then(setKey); }, []);
  useEffect(() => { setCityQuery(city); }, [city]);
  useEffect(() => { setWhQuery(warehouse); }, [warehouse]);

  // saved city: find its reference once so the branch list can be loaded
  useEffect(() => {
    if (!key || !city || cityRef) return;
    np(key, 'searchSettlements', { CityName: city.replace(/^(м\.|с\.|смт)\s*/i, '').split(',')[0], Limit: '5' })
      .then(d => { const c: NpCity | undefined = d[0]?.Addresses?.find((a: NpCity) => a.Present === city) || d[0]?.Addresses?.[0]; if (c) setCityRef(c.DeliveryCity); })
      .catch(() => {});
  }, [key, city]);

  useEffect(() => {
    if (!key || !cityRef) return;
    setLoadingWh(true);
    np(key, 'getWarehouses', { CityRef: cityRef }).then(setWarehouses).catch(() => setWarehouses([])).finally(() => setLoadingWh(false));
  }, [key, cityRef]);

  const searchCities = (term: string) => {
    setCityQuery(term);
    window.clearTimeout(timer.current);
    if (!key || term.trim().length < 2) { setCities([]); return; }
    timer.current = window.setTimeout(async () => {
      setLoadingCities(true);
      try { const d = await np(key, 'searchSettlements', { CityName: term.trim(), Limit: '20' }); setCities(d[0]?.Addresses || []); setShowCities(true); }
      catch { setCities([]); } finally { setLoadingCities(false); }
    }, 350);
  };

  const filteredWh = useMemo(() => {
    const q = whQuery.trim().toLowerCase();
    const list = q && q !== warehouse.toLowerCase() ? warehouses.filter(w => w.Description.toLowerCase().includes(q) || w.Number === q.replace(/\D/g, '')) : warehouses;
    return list.slice(0, 50);
  }, [warehouses, whQuery, warehouse]);

  // no API key: plain text fields
  if (!key) {
    return (
      <>
        <div className="relative"><MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={city} onChange={e => onChange({ city: e.target.value, warehouse })} placeholder="Місто (для Нової Пошти)" autoComplete="address-level2" className={inputCls} /></div>
        <div className="relative"><Package size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={warehouse} onChange={e => onChange({ city, warehouse: e.target.value })} placeholder="Відділення / поштомат НП" className={inputCls} /></div>
      </>
    );
  }

  return (
    <>
      <div className="relative">
        <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={cityQuery} onChange={e => searchCities(e.target.value)} onFocus={() => cities.length && setShowCities(true)}
          onBlur={() => setTimeout(() => setShowCities(false), 200)} placeholder="Місто — почніть вводити назву" autoComplete="off" className={inputCls} />
        {loadingCities && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-zinc-500" />}
        {showCities && cities.length > 0 && (
          <ul className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-zinc-950 border border-zinc-700 rounded-xl shadow-2xl">
            {cities.map(c => (
              <li key={c.DeliveryCity + c.Present}>
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => {
                  setCityRef(c.DeliveryCity); setCityQuery(c.Present); setShowCities(false); setWhQuery('');
                  onChange({ city: c.Present, warehouse: '' });
                }} className="w-full text-left px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800">{c.Present}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="relative">
        <Package size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={whQuery} onChange={e => { setWhQuery(e.target.value); setShowWh(true); }} onFocus={() => setShowWh(true)}
          onBlur={() => setTimeout(() => setShowWh(false), 200)} disabled={!cityRef && !warehouse}
          placeholder={cityRef ? 'Відділення або поштомат — номер чи адреса' : 'Спершу оберіть місто'} autoComplete="off" className={`${inputCls} disabled:opacity-50`} />
        {loadingWh && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-zinc-500" />}
        {showWh && filteredWh.length > 0 && (
          <ul className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-zinc-950 border border-zinc-700 rounded-xl shadow-2xl">
            {filteredWh.map(w => (
              <li key={w.Ref}>
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setWhQuery(w.Description); setShowWh(false); onChange({ city: cityQuery, warehouse: w.Description }); }}
                  className="w-full text-left px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 flex items-start gap-2">
                  {w.Description === warehouse && <Check size={14} className="text-[#FFC300] mt-0.5 shrink-0" />}<span>{w.Description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
};

export default NovaPoshtaPicker;
