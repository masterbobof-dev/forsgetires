
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { PRICING_DATA_CARS, PRICING_DATA_SUV, ADDITIONAL_SERVICES, PriceRow } from '../../constants';
import { Printer, Save, Percent } from 'lucide-react';

const PricesTab: React.FC = () => {
  const [priceDataCars, setPriceDataCars] = useState<PriceRow[]>(PRICING_DATA_CARS);
  const [priceDataSUV, setPriceDataSUV] = useState<PriceRow[]>(PRICING_DATA_SUV);
  const [additionalServices, setAdditionalServices] = useState<{ name: string, price: string }[]>(ADDITIONAL_SERVICES);

  useEffect(() => { fetchPrices(); }, []);

  const fetchPrices = async () => {
    try {
      const { data } = await supabase.from('settings').select('key, value').in('key', ['prices_cars', 'prices_suv', 'prices_additional']);
      if (data) data.forEach((r: any) => {
         if (r.key === 'prices_additional') setAdditionalServices(JSON.parse(r.value));
         if (r.key === 'prices_cars') setPriceDataCars(JSON.parse(r.value));
         if (r.key === 'prices_suv') setPriceDataSUV(JSON.parse(r.value));
      });
    } catch (e) { console.error(e); }
  };

  const applyPriceMarkup = (percent: number) => {
     const factor = 1 + (percent / 100);
     const updateRow = (row: PriceRow): PriceRow => {
        if (row.isSurcharge) return row;
        const r = Math.round(parseFloat(row.removeInstall) * factor);
        const b = Math.round(parseFloat(row.balancing) * factor);
        const m = Math.round(parseFloat(row.mounting) * factor);
        return { ...row, removeInstall: r.toString(), balancing: b.toString(), mounting: m.toString(), total1: (r + b + m).toString(), total4: ((r + b + m) * 4).toString() };
     };
     setPriceDataCars(prev => prev.map(updateRow));
     setPriceDataSUV(prev => prev.map(updateRow));
  };

  const saveAllPrices = async () => {
       await supabase.from('settings').upsert({ key: 'prices_additional', value: JSON.stringify(additionalServices) });
       await supabase.from('settings').upsert({ key: 'prices_cars', value: JSON.stringify(priceDataCars) });
       await supabase.from('settings').upsert({ key: 'prices_suv', value: JSON.stringify(priceDataSUV) });
       alert("Збережено!");
  };

  const TablePriceEditor = ({ data, category }: { data: PriceRow[], category: 'cars' | 'suv' }) => (
     <div className="overflow-x-auto bg-black border border-zinc-700 rounded-lg p-2 mb-8"><table className="w-full text-xs md:text-sm text-left"><thead className="text-zinc-500 uppercase font-bold"><tr><th className="p-2">R</th><th className="p-2">Зняття/Вст</th><th className="p-2">Баланс</th><th className="p-2">Монтаж</th><th className="p-2 text-[#FFC300]">Сума (1)</th><th className="p-2 text-[#FFC300]">Сума (4)</th></tr></thead><tbody className="divide-y divide-zinc-800">{data.map((row, idx) => (<tr key={idx}><td className="p-2 text-[#FFC300] font-bold w-16">{row.radius}</td>{['removeInstall','balancing','mounting','total1','total4'].map(f => (<td key={f} className="p-2"><input value={(row as any)[f]} onChange={e => { const n = category === 'cars' ? [...priceDataCars] : [...priceDataSUV]; (n as any)[idx][f] = e.target.value; if (!row.isSurcharge) { const r = parseFloat(n[idx].removeInstall) || 0; const b = parseFloat(n[idx].balancing) || 0; const m = parseFloat(n[idx].mounting) || 0; n[idx].total1 = (r+b+m).toString(); n[idx].total4 = ((r+b+m)*4).toString(); } category === 'cars' ? setPriceDataCars(n) : setPriceDataSUV(n); }} className="w-16 bg-zinc-900 border border-zinc-700 rounded p-1 text-white text-center"/></td>))}</tr>))}</tbody></table></div>
  );

  return (
    <div className="animate-in fade-in space-y-8">
       <div className="flex justify-between items-center mb-4"><h3 className="text-2xl font-black text-white">Прайси</h3><div className="flex gap-2"><button onClick={() => window.print()} className="bg-zinc-800 text-white px-6 py-3 rounded-xl"><Printer size={20}/></button><button onClick={saveAllPrices} className="bg-green-600 text-white px-6 py-3 rounded-xl flex items-center gap-2"><Save size={20}/> Зберегти</button></div></div>
       <div className="flex flex-wrap items-center gap-2 bg-black/50 p-3 rounded-lg border border-zinc-800 mb-4"><span className="text-zinc-400 text-xs font-bold uppercase mr-2 flex items-center gap-1"><Percent size={14}/> Націнка:</span>{[2.5, 5, 10].map(p => (<React.Fragment key={p}><button onClick={() => applyPriceMarkup(p)} className="px-3 py-1 bg-zinc-800 hover:bg-[#FFC300] hover:text-black rounded text-xs">+{p}%</button><button onClick={() => applyPriceMarkup(-p)} className="px-3 py-1 bg-zinc-800 hover:bg-red-500 hover:text-white rounded text-xs">-{p}%</button></React.Fragment>))}</div>
       <div><h4 className="text-lg font-bold text-white mb-4">Легкові</h4><TablePriceEditor data={priceDataCars} category="cars" /></div>
       <div><h4 className="text-lg font-bold text-white mb-4">Кросовери</h4><TablePriceEditor data={priceDataSUV} category="suv" /></div>
       <div><h4 className="text-lg font-bold text-white mb-4">Додаткові</h4><div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800"><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{additionalServices.map((service, idx) => (<div key={idx} className="flex gap-2"><input value={service.name} onChange={e => {const n=[...additionalServices]; n[idx].name=e.target.value; setAdditionalServices(n);}} className="bg-black border border-zinc-700 rounded p-2 text-white flex-grow"/><input value={service.price} onChange={e => {const n=[...additionalServices]; n[idx].price=e.target.value; setAdditionalServices(n);}} className="bg-black border border-zinc-700 rounded p-2 text-[#FFC300] w-24 font-bold text-center"/></div>))}</div></div></div>
    </div>
  );
};

export default PricesTab;
