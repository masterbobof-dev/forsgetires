
import React, { useState, useEffect } from 'react';
import { PRICING_DATA_CARS, PRICING_DATA_SUV, ADDITIONAL_SERVICES, PriceRow } from '../constants';
import { Disc, AlertCircle, Car, Truck, ChevronRight, Wrench, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

const PriceTable: React.FC<{ title: string; icon: React.ReactNode; data: PriceRow[] }> = ({ title, icon, data }) => (
  <div className="mb-12">
    <div className="flex items-center gap-3 mb-6">
      <div className="p-3 bg-zinc-800 rounded-xl border border-zinc-700">
        {icon}
      </div>
      <h3 className="text-xl md:text-2xl font-bold text-white uppercase italic tracking-wide">
        {title}
      </h3>
    </div>

    <div className="relative">
      {/* Scroll Hint for Mobile */}
      <div className="md:hidden absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center animate-pulse pointer-events-none border border-white/20">
        <ChevronRight className="text-white w-5 h-5" />
      </div>

      <div className="w-full overflow-x-auto rounded-2xl shadow-xl shadow-black/50 border border-zinc-800 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900">
        <table className="w-full text-left border-collapse min-w-[600px] md:min-w-[800px]">
          <thead>
            <tr className="bg-zinc-900 text-white">
              <th className="p-3 md:p-6 font-bold uppercase text-xs md:text-sm tracking-wider border-b border-zinc-700 whitespace-nowrap sticky left-0 bg-zinc-900 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                Радіус (R)
              </th>
              <th className="p-3 md:p-6 font-bold uppercase text-[10px] md:text-xs text-center tracking-wider border-b border-zinc-700 text-zinc-400">
                <div className="flex flex-col gap-1">
                  <span>Зняття та</span>
                  <span>Встановлення</span>
                </div>
              </th>
              <th className="p-3 md:p-6 font-bold uppercase text-[10px] md:text-xs text-center tracking-wider border-b border-zinc-700 text-zinc-400">Балансування</th>
              <th className="p-3 md:p-6 font-bold uppercase text-[10px] md:text-xs text-center tracking-wider border-b border-zinc-700 text-zinc-400">Шиномонтаж</th>
              <th className="p-3 md:p-6 font-bold uppercase text-xs md:text-sm tracking-wider border-b border-zinc-700 text-[#FFC300] bg-zinc-800/50 min-w-[90px]">
                <div className="flex flex-col gap-1">
                  <span>Сума</span>
                  <span className="text-[10px] opacity-70 font-normal">за 1 колесо</span>
                </div>
              </th>
              <th className="p-3 md:p-6 font-bold uppercase text-xs md:text-sm tracking-wider border-b border-zinc-700 text-[#FFC300] bg-zinc-800/50 min-w-[90px]">
                <div className="flex flex-col gap-1">
                  <span>Сума</span>
                  <span className="text-[10px] opacity-70 font-normal">за 4 колеса</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-black/40">
            {data.map((row, index) => {
              const isSurcharge = row.isSurcharge;
              return (
                <tr 
                  key={index} 
                  className={`
                    group transition-colors
                    ${isSurcharge ? 'bg-[#FFC300]/10 hover:bg-[#FFC300]/20' : 'hover:bg-zinc-900'}
                  `}
                >
                  {/* Radius Column - Sticky on Mobile */}
                  <td className={`p-3 md:p-6 font-bold border-r border-zinc-800/50 relative sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] ${isSurcharge ? 'bg-zinc-900/95' : 'bg-[#09090b] group-hover:bg-zinc-900'}`}>
                    <div className="flex items-center gap-2 md:gap-3">
                      {!isSurcharge && (
                        <div className="hidden md:block p-2 bg-zinc-900 rounded-full border border-zinc-700 group-hover:border-[#FFC300] transition-colors">
                          <Disc className={`w-5 h-5 ${isSurcharge ? 'text-white' : 'text-[#FFC300]'}`} />
                        </div>
                      )}
                      <span className={`${isSurcharge ? "uppercase tracking-wide text-[#FFC300] text-xs md:text-sm whitespace-normal max-w-[120px]" : "text-sm md:text-lg text-white"}`}>
                        {isSurcharge ? row.radius : `R ${row.radius}`}
                      </span>
                    </div>
                  </td>

                  {/* Service Columns */}
                  <td className="p-3 md:p-6 text-zinc-300 font-medium text-xs md:text-base text-center">{row.removeInstall}</td>
                  <td className="p-3 md:p-6 text-zinc-300 font-medium text-xs md:text-base text-center">{row.balancing}</td>
                  <td className="p-3 md:p-6 text-zinc-300 font-medium text-xs md:text-base text-center">{row.mounting}</td>

                  {/* Total Columns */}
                  <td className="p-3 md:p-6 font-black text-sm md:text-xl text-[#FFC300] bg-zinc-900/30 border-l border-zinc-800/50 whitespace-nowrap">
                    {row.total1} <span className="text-[10px] md:text-xs font-normal text-zinc-500 ml-1">грн</span>
                  </td>
                  <td className="p-3 md:p-6 font-black text-sm md:text-xl text-[#FFC300] bg-zinc-900/30 border-l border-zinc-800/50 shadow-inner whitespace-nowrap">
                    {row.total4} <span className="text-[10px] md:text-xs font-normal text-zinc-500 ml-1">грн</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const Prices: React.FC = () => {
  const [priceData, setPriceData] = useState<{
    cars: PriceRow[],
    suv: PriceRow[],
    additional: { name: string, price: string }[]
  }>({
    cars: PRICING_DATA_CARS,
    suv: PRICING_DATA_SUV,
    additional: ADDITIONAL_SERVICES
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrices();
  }, []);

  const fetchPrices = async () => {
    try {
      const { data } = await supabase.from('settings').select('key, value').in('key', ['prices_cars', 'prices_suv', 'prices_additional']);
      
      const newPrices = { ...priceData };
      if (data && data.length > 0) {
        data.forEach((row: any) => {
          if (row.key === 'prices_cars') newPrices.cars = JSON.parse(row.value);
          if (row.key === 'prices_suv') newPrices.suv = JSON.parse(row.value);
          if (row.key === 'prices_additional') newPrices.additional = JSON.parse(row.value);
        });
        setPriceData(newPrices);
      }
    } catch (error) {
      console.error("Error fetching prices:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] py-12 animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-black text-white mb-8 border-b-2 border-[#FFC300] inline-block pb-2">
          Прайс-лист
        </h2>
        
        <div className="flex items-center gap-2 mb-8 text-zinc-400 bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
          <AlertCircle className="text-[#FFC300] w-6 h-6 flex-shrink-0" />
          <p className="text-sm md:text-base">
            Прокрутіть таблицю вправо, щоб побачити повну вартість.
          </p>
        </div>

        {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#FFC300]" size={32} /></div>}

        <PriceTable 
          title="Легкові Автомобілі" 
          icon={<Car className="text-[#FFC300] w-6 h-6" />}
          data={priceData.cars} 
        />

        <div className="my-16 border-t border-dashed border-zinc-800"></div>

        <PriceTable 
          title="Мікроавтобуси / Кросовери" 
          icon={<Truck className="text-[#FFC300] w-6 h-6" />}
          data={priceData.suv} 
        />
        
        <div className="my-16 border-t border-dashed border-zinc-800"></div>

        <div className="mb-12">
           <div className="flex items-center gap-3 mb-6">
             <div className="p-3 bg-zinc-800 rounded-xl border border-zinc-700">
                <Wrench className="text-[#FFC300] w-6 h-6" />
             </div>
             <h3 className="text-xl md:text-2xl font-bold text-white uppercase italic tracking-wide">
               Додаткові послуги та матеріали
             </h3>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {priceData.additional.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-[#FFC300] transition-colors group">
                   <span className="text-zinc-300 font-medium group-hover:text-white">{item.name}</span>
                   <span className="text-[#FFC300] font-bold whitespace-nowrap ml-2">{item.price}</span>
                </div>
              ))}
           </div>
        </div>

      </div>
    </div>
  );
};

export default Prices;
