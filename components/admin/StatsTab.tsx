
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { DollarSign } from 'lucide-react';

const StatsTab: React.FC = () => {
  const [stats, setStats] = useState({ totalOrders: 0, totalRevenue: 0, totalTyres: 0, totalBookings: 0 });

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const { count: ordersCount } = await supabase.from('tyre_orders').select('*', { count: 'exact', head: true });
      const { count: tyresCount } = await supabase.from('tyres').select('*', { count: 'exact', head: true });
      const { count: bookingCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
      
      const { data: orders } = await supabase.from('tyre_orders').select('items');
      const { data: allTyres } = await supabase.from('tyres').select('id, base_price');
      const basePriceMap = new Map();
      allTyres?.forEach(t => basePriceMap.set(t.id, t.base_price)); 

      let profit = 0;
      orders?.forEach((o: any) => { if (o.items) o.items.forEach((i: any) => { const sell = parseFloat(String(i.price).replace(/[^\d.]/g, '')) || 0; const base = parseFloat(String(i.base_price || basePriceMap.get(i.id)).replace(/[^\d.]/g, '')) || 0; profit += (sell - base) * (i.quantity || 1); }); });
      setStats({ totalOrders: ordersCount || 0, totalTyres: tyresCount || 0, totalBookings: bookingCount || 0, totalRevenue: profit });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in">
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800"><h3 className="text-zinc-400 text-xs font-bold uppercase">Всього замовлень</h3><p className="text-4xl font-black text-white">{stats.totalOrders}</p></div>
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800"><h3 className="text-zinc-400 text-xs font-bold uppercase">Шини</h3><p className="text-4xl font-black text-[#FFC300]">{stats.totalTyres}</p></div>
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800"><h3 className="text-zinc-400 text-xs font-bold uppercase">Записів</h3><p className="text-4xl font-black text-white">{stats.totalBookings}</p></div>
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 relative overflow-hidden"><h3 className="text-zinc-400 text-xs font-bold uppercase">Чистий дохід</h3><p className="text-3xl font-black text-green-400">{stats.totalRevenue.toLocaleString()} грн</p><DollarSign className="absolute -bottom-4 -right-4 text-green-900/20 w-32 h-32" /></div>
    </div>
  );
};

export default StatsTab;
