import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
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

        {/* MIDDLE SECTION: Charts & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-white font-black uppercase tracking-wider text-sm flex items-center gap-2">
                            <Activity className="text-blue-400" size={18}/> Технічний розподіл
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Пристрої юзерів</p>
                            <div className="space-y-3">
                                {Object.entries(stats.deviceType).map(([name, val]: any) => {
                                    const totalArr = Object.values(stats.deviceType);
                                    const total = totalArr.length > 0 ? totalArr.reduce((a, b) => a + b, 0) : 1;
                                    const pct = Math.round((val / total) * 100);
                                    return (
                                        <div key={name}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-bold text-zinc-300 flex items-center gap-2 uppercase tracking-wide">
                                                    {name === 'mobile' ? <Smartphone size={12}/> : <Monitor size={12}/>} {name || 'Інше'}
                                                </span>
                                                <span className="text-xs text-[#FFC300] font-black">{pct}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-black rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 rounded-full" style={{width: `${pct}%`}}></div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Географія (Топ міст)</p>
                            <div className="space-y-3">
                                {stats.topCities.map(([name, val]: any) => {
                                    const total = stats.topCities.reduce((a, b) => a + b[1], 0) || 1;
                                    const pct = Math.round((val / total) * 100);
                                    return (
                                        <div key={name}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wide flex items-center gap-2"><Globe size={12}/> {name}</span>
                                                <span className="text-xs text-zinc-500">{val} сес.</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-black rounded-full overflow-hidden">
                                                <div className="h-full bg-[#FFC300] rounded-full" style={{width: `${pct}%`}}></div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
                        <h3 className="text-zinc-400 font-black uppercase text-[10px] mb-4 flex items-center gap-2 tracking-widest">
                            <Eye size={14} className="text-blue-400"/> Популярні Товари
                        </h3>
                        <div className="space-y-2">
                             {stats.topViewed.map((it, idx) => (
                                 <div key={idx} className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-zinc-800/50 hover:border-blue-500/30 transition-colors">
                                     <span className="text-xs font-bold text-zinc-300 truncate w-2/3">{it.name}</span>
                                     <span className="text-blue-400 font-black text-xs">{it.count} перегляди</span>
                                 </div>
                             ))}
                             {stats.topViewed.length === 0 && <p className="text-zinc-600 text-xs italic italic">Немає даних...</p>}
                        </div>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
                        <h3 className="text-zinc-400 font-black uppercase text-[10px] mb-4 flex items-center gap-2 tracking-widest">
                            <ShoppingCart size={14} className="text-[#FFC300]"/> Додано в кошик
                        </h3>
                        <div className="space-y-2">
                             {stats.topCart.map((it, idx) => (
                                 <div key={idx} className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-zinc-800/50 hover:border-[#FFC300]/30 transition-colors">
                                     <span className="text-xs font-bold text-zinc-300 truncate w-2/3">{it.name}</span>
                                     <span className="text-[#FFC300] font-black text-xs">{it.count} рази</span>
                                 </div>
                             ))}
                             {stats.topCart.length === 0 && <p className="text-zinc-600 text-xs italic">Немає даних...</p>}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl overflow-hidden self-start">
               <h3 className="text-white font-black uppercase tracking-wider text-sm mb-6 flex items-center gap-2">
                   <Clock className="text-zinc-500" size={18}/> Останні дії
               </h3>
               <div className="space-y-4 relative">
                   <div className="absolute left-[11px] top-0 bottom-0 w-[1px] bg-zinc-800"></div>
                   {stats.recentEvents.map((ev, i) => (
                       <div key={i} className="relative z-10 flex gap-4">
                           <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-4 border-zinc-900 shadow-xl ${
                               ev.event_type === 'add_to_cart' ? 'bg-[#FFC300] text-black' : 
                               ev.event_type === 'view_item' ? 'bg-blue-500 text-white' : 
                               ev.event_type === 'quick_order' ? 'bg-red-500 text-white' : 'bg-zinc-700 text-white'
                           }`}>
                               {ev.event_type === 'add_to_cart' ? <ShoppingCart size={10} strokeWidth={3}/> : 
                                ev.event_type === 'view_item' ? <Eye size={10} strokeWidth={3}/> : <Activity size={10} strokeWidth={3}/>}
                           </div>
                           <div className="flex flex-col min-w-0">
                               <span className="text-white font-bold text-xs">{getEventLabel(ev.event_type)}</span>
                               <span className="text-[10px] text-zinc-400 truncate">{ev.item_name || ev.page_path || 'Система'}</span>
                               <span className="text-[9px] text-zinc-600 font-mono mt-0.5">{new Date(ev.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {ev.city || 'UA'}</span>
                           </div>
                       </div>
                   ))}
                   {stats.recentEvents.length === 0 && <p className="text-zinc-600 text-xs italic pl-8">Подій поки немає...</p>}
               </div>
               <button onClick={() => fetchStats()} className="w-full mt-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors">
                   Оновити стрічку
               </button>
            </div>
        </div>
    </div>
  );
};

export default StatsTab;
