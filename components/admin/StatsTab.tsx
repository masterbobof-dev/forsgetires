import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { DollarSign, Users, Eye, ShoppingCart, Activity } from 'lucide-react';

const StatsTab: React.FC = () => {
  const [stats, setStats] = useState({ 
      totalOrders: 0, totalRevenue: 0, totalTyres: 0, totalBookings: 0,
      uniqueVisitorsToday: 0, uniqueVisitorsTotal: 0,
      topViewed: [] as any[], topCart: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      // Basic Business Stats
      const { count: ordersCount } = await supabase.from('tyre_orders').select('*', { count: 'exact', head: true });
      const { count: tyresCount } = await supabase.from('tyres').select('*', { count: 'exact', head: true });
      const { count: bookingCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
      
      const { data: orders } = await supabase.from('tyre_orders').select('items');
      const { data: allTyres } = await supabase.from('tyres').select('id, base_price');
      const basePriceMap = new Map();
      allTyres?.forEach(t => basePriceMap.set(t.id, t.base_price)); 

      let profit = 0;
      orders?.forEach((o: any) => { 
          if (o.items) o.items.forEach((i: any) => { 
              const sell = parseFloat(String(i.price).replace(/[^\d.]/g, '')) || 0; 
              const base = parseFloat(String(i.base_price || basePriceMap.get(i.id)).replace(/[^\d.]/g, '')) || 0; 
              profit += (sell - base) * (i.quantity || 1); 
          }); 
      });

      // Analytics Stats
      let uniqueToday = 0;
      let uniqueTotal = 0;
      let topViewed = [];
      let topCart = [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // We fetch analytics from the last 30 days to avoid huge payloads
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: analytics, error } = await supabase
        .from('analytics_events')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (analytics && !error) {
          // Process Visitors
          const sessionsToday = new Set();
          const sessionsTotal = new Set();
          
          const viewCounts: Record<string, {name: string, count: number}> = {};
          const cartCounts: Record<string, {name: string, count: number}> = {};

          analytics.forEach(ev => {
              sessionsTotal.add(ev.session_id);
              if (new Date(ev.created_at) >= today) {
                  sessionsToday.add(ev.session_id);
              }

              if (ev.event_type === 'view_item' && ev.item_id && ev.item_name) {
                  if(!viewCounts[ev.item_id]) viewCounts[ev.item_id] = { name: ev.item_name, count: 0 };
                  viewCounts[ev.item_id].count++;
              }
              if (ev.event_type === 'add_to_cart' && ev.item_id && ev.item_name) {
                  if(!cartCounts[ev.item_id]) cartCounts[ev.item_id] = { name: ev.item_name, count: 0 };
                  cartCounts[ev.item_id].count++;
              }
          });

          uniqueToday = sessionsToday.size;
          uniqueTotal = sessionsTotal.size;

          topViewed = Object.values(viewCounts).sort((a, b) => b.count - a.count).slice(0, 5);
          topCart = Object.values(cartCounts).sort((a, b) => b.count - a.count).slice(0, 5);
      }

      setStats({ 
          totalOrders: ordersCount || 0, totalTyres: tyresCount || 0, totalBookings: bookingCount || 0, totalRevenue: profit,
          uniqueVisitorsToday: uniqueToday, uniqueVisitorsTotal: uniqueTotal,
          topViewed, topCart
      });
    } catch (e) { 
        console.error("Помилка завантаження статистики", e); 
    } finally {
        setLoading(false);
    }
  };

  if (loading) return <div className="text-zinc-500 animate-pulse pb-10">Завантаження аналітики...</div>

  return (
    <div className="space-y-8 pb-20 animate-in fade-in">
        {/* Бізнес-показники */}
        <div>
            <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <DollarSign className="text-[#FFC300]"/> Бізнес Показники
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800"><h3 className="text-zinc-400 text-xs font-bold uppercase">Всього замовлень</h3><p className="text-4xl font-black text-white">{stats.totalOrders}</p></div>
                <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800"><h3 className="text-zinc-400 text-xs font-bold uppercase">Шини в базі</h3><p className="text-4xl font-black text-[#FFC300]">{stats.totalTyres}</p></div>
                <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800"><h3 className="text-zinc-400 text-xs font-bold uppercase">Записів на СТО</h3><p className="text-4xl font-black text-white">{stats.totalBookings}</p></div>
                <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 relative overflow-hidden"><h3 className="text-zinc-400 text-xs font-bold uppercase">Чистий дохід</h3><p className="text-2xl font-black text-green-400">{stats.totalRevenue.toLocaleString()} грн</p><DollarSign className="absolute -bottom-4 -right-4 text-green-900/20 w-32 h-32" /></div>
            </div>
        </div>

        {/* Веб-аналітика */}
        <div>
            <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <Activity className="text-blue-400"/> Веб Аналітика (30 днів)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 relative overflow-hidden">
                    <h3 className="text-zinc-400 text-xs font-bold uppercase">Унікальні Відвідування (Сьогодні)</h3>
                    <p className="text-4xl font-black text-blue-400 mt-2">{stats.uniqueVisitorsToday}</p>
                    <Users className="absolute -bottom-4 -right-4 text-blue-900/20 w-32 h-32" />
                </div>
                <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 relative overflow-hidden">
                    <h3 className="text-zinc-400 text-xs font-bold uppercase">Унікальні Відвідування (Місяць)</h3>
                    <p className="text-4xl font-black text-white mt-2">{stats.uniqueVisitorsTotal}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Топ Переглядів */}
                <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                    <h3 className="text-zinc-400 text-xs font-bold uppercase mb-4 flex items-center gap-2">
                        <Eye size={16}/> Найпопулярніші шини (Перегляди)
                    </h3>
                    {stats.topViewed.length === 0 ? <p className="text-zinc-600 text-sm">Даних ще немає</p> : (
                        <div className="space-y-3">
                            {stats.topViewed.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-black/50 rounded-lg">
                                    <span className="text-zinc-300 text-sm font-bold w-2/3 truncate">{item.name}</span>
                                    <span className="text-white font-black bg-zinc-800 px-3 py-1 rounded-md">{item.count} разів</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Топ Кошик */}
                <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                    <h3 className="text-zinc-400 text-xs font-bold uppercase mb-4 flex items-center gap-2">
                        <ShoppingCart size={16}/> Найбільше додавали в кошик
                    </h3>
                    {stats.topCart.length === 0 ? <p className="text-zinc-600 text-sm">Даних ще немає</p> : (
                        <div className="space-y-3">
                            {stats.topCart.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-black/50 rounded-lg">
                                    <span className="text-[#FFC300] text-sm font-bold w-2/3 truncate">{item.name}</span>
                                    <span className="text-black font-black bg-[#FFC300] px-3 py-1 rounded-md">{item.count} разів</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default StatsTab;
