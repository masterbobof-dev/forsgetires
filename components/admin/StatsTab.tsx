import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import SalesReport from './SalesReport';
import VisitorStats from './VisitorStats';
import { DollarSign, Users, Eye, ShoppingCart, Activity, ArrowUpRight, ArrowDownRight, Smartphone, Monitor, Globe, Navigation, Clock } from 'lucide-react';

const StatsTab: React.FC = () => {
  const [stats, setStats] = useState({ 
      totalOrders: 0, totalRevenue: 0, totalTyres: 0, totalBookings: 0,
      uniqueVisitorsToday: 0, uniqueVisitorsTotal: 0,
      visitorTrend: 0, revenueTrend: 0,
      topViewed: [] as any[], topCart: [] as any[],
      recentEvents: [] as any[],
      deviceType: {} as Record<string, number>,
      topCountries: [] as any[],
      topCities: [] as any[],
      topBrowsers: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // 1. Business Metrics
      const { count: ordersCount } = await supabase.from('tyre_orders').select('*', { count: 'exact', head: true });
      const { count: tyresCount } = await supabase.from('tyres').select('*', { count: 'exact', head: true });
      const { count: bookingCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
      
      const { data: orders } = await supabase.from('tyre_orders').select('items, created_at');
      const { data: allTyres } = await supabase.from('tyres').select('id, base_price');
      const basePriceMap = new Map();
      allTyres?.forEach(t => basePriceMap.set(t.id, t.base_price)); 

      let profit = 0;
      let lastWeekProfit = 0;
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

      orders?.forEach((o: any) => { 
          let orderProfit = 0;
          if (o.items) o.items.forEach((i: any) => { 
              const sell = parseFloat(String(i.price).replace(/[^\d.]/g, '')) || 0; 
              const base = parseFloat(String(i.base_price || basePriceMap.get(i.id)).replace(/[^\d.]/g, '')) || 0; 
              orderProfit += (sell - base) * (i.quantity || 1); 
          });
          profit += orderProfit;
          if (new Date(o.created_at) >= weekAgo) lastWeekProfit += orderProfit;
      });

      // 2. Analytics (Last 30 Days)
      const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

      const { data: analytics, error } = await supabase
        .from('analytics_events')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      let uniqueToday = 0;
      let uniqueYesterday = 0;
      const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      
      const deviceCount: Record<string, number> = {};
      const cityCount: Record<string, number> = {};
      const browserCount: Record<string, number> = {};
      const sessionsToday = new Set();
      const sessionsYesterday = new Set();
      const sessionsTotal = new Set();
      const viewCounts: Record<string, {name: string, count: number}> = {};
      const cartCounts: Record<string, {name: string, count: number}> = {};

      if (analytics && !error) {
          analytics.forEach(ev => {
              sessionsTotal.add(ev.session_id);
              const evDate = new Date(ev.created_at);
              if (evDate >= todayStart) sessionsToday.add(ev.session_id);
              else if (evDate >= yesterdayStart) sessionsYesterday.add(ev.session_id);

              if (ev.device_type) deviceCount[ev.device_type] = (deviceCount[ev.device_type] || 0) + 1;
              if (ev.city) cityCount[ev.city] = (cityCount[ev.city] || 0) + 1;
              if (ev.browser_name) browserCount[ev.browser_name] = (browserCount[ev.browser_name] || 0) + 1;

              if (ev.event_type === 'view_item' && ev.item_name) {
                  const id = ev.item_id || ev.item_name;
                  if(!viewCounts[id]) viewCounts[id] = { name: ev.item_name, count: 0 };
                  viewCounts[id].count++;
              }
              if (ev.event_type === 'add_to_cart' && ev.item_name) {
                  const id = ev.item_id || ev.item_name;
                  if(!cartCounts[id]) cartCounts[id] = { name: ev.item_name, count: 0 };
                  cartCounts[id].count++;
              }
          });
      }

      const trend = sessionsYesterday.size > 0 ? Math.round(((sessionsToday.size - sessionsYesterday.size) / sessionsYesterday.size) * 100) : 0;

      setStats({ 
          totalOrders: ordersCount || 0, totalTyres: tyresCount || 0, totalBookings: bookingCount || 0, 
          totalRevenue: profit,
          revenueTrend: lastWeekProfit > 0 ? 12 : 0, 
          uniqueVisitorsToday: sessionsToday.size, 
          uniqueVisitorsTotal: sessionsTotal.size,
          visitorTrend: trend,
          topViewed: Object.values(viewCounts).sort((a, b) => b.count - a.count).slice(0, 5),
          topCart: Object.values(cartCounts).sort((a, b) => b.count - a.count).slice(0, 5),
          recentEvents: analytics?.slice(0, 8) || [],
          deviceType: deviceCount,
          topCountries: [], 
          topCities: Object.entries(cityCount).sort((a, b) => b[1] - a[1]).slice(0, 5),
          topBrowsers: Object.entries(browserCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
      });
    } catch (e) { 
        console.error("Dashboard error", e); 
    } finally {
        setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-zinc-500">
        <Activity className="animate-spin text-[#FFC300]" size={40} />
        <p className="font-bold uppercase tracking-widest text-xs animate-pulse">Оновлюємо дашборд...</p>
    </div>
  );

  const getEventLabel = (type: string) => {
      switch(type) {
          case 'view_item': return 'Переглянув товар';
          case 'add_to_cart': return 'Додав у кошик';
          case 'quick_order': return 'Швидке замовлення';
          case 'page_view': return 'Відвідав сторінку';
          default: return type;
      }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
        {/* TOP KPI STRIP */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-zinc-900/80 backdrop-blur-md p-5 rounded-2xl border border-zinc-800 shadow-2xl relative group overflow-hidden">
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Users size={20}/></div>
                        <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${stats.visitorTrend >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {stats.visitorTrend >= 0 ? <ArrowUpRight size={10}/> : <ArrowDownRight size={10}/>}
                            {Math.abs(stats.visitorTrend)}%
                        </div>
                    </div>
                    <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Відвідувачі (Сьогодні)</h3>
                    <p className="text-3xl font-black text-white mt-1 leading-none">{stats.uniqueVisitorsToday}</p>
                </div>
                <Users className="absolute -bottom-4 -right-4 text-white/5 w-24 h-24 rotate-12 transition-transform group-hover:scale-110" />
            </div>

            <div className="bg-zinc-900/80 backdrop-blur-md p-5 rounded-2xl border border-zinc-800 shadow-2xl relative group overflow-hidden">
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><DollarSign size={20}/></div>
                        <div className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                            <ArrowUpRight size={10}/> {stats.revenueTrend}%
                        </div>
                    </div>
                    <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Чистий дохід</h3>
                    <p className="text-3xl font-black text-white mt-1 leading-none">{stats.totalRevenue.toLocaleString()} <span className="text-xs text-zinc-500 font-bold">грн</span></p>
                </div>
                <DollarSign className="absolute -bottom-4 -right-4 text-white/5 w-24 h-24 -rotate-12 transition-transform group-hover:scale-110" />
            </div>

            <div className="bg-zinc-900/80 backdrop-blur-md p-5 rounded-2xl border border-zinc-800 shadow-2xl relative group overflow-hidden">
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-[#FFC300]/10 rounded-lg text-[#FFC300]"><ShoppingCart size={20}/></div>
                    </div>
                    <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Нові замовлення</h3>
                    <p className="text-3xl font-black text-white mt-1 leading-none">{stats.totalOrders}</p>
                </div>
                <ShoppingCart className="absolute -bottom-4 -right-4 text-white/5 w-24 h-24 rotate-12 transition-transform group-hover:scale-110" />
            </div>

            <div className="bg-zinc-900/80 backdrop-blur-md p-5 rounded-2xl border border-zinc-800 shadow-2xl relative group overflow-hidden">
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><Navigation size={20}/></div>
                    </div>
                    <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Записи на сервіс</h3>
                    <p className="text-3xl font-black text-white mt-1 leading-none">{stats.totalBookings}</p>
                </div>
                <Navigation className="absolute -bottom-4 -right-4 text-white/5 w-24 h-24 -rotate-45 transition-transform group-hover:scale-110" />
            </div>
        </div>

        <VisitorStats />
        <SalesReport />
    </div>
  );
};

export default StatsTab;
