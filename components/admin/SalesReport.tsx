import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, TrendingUp, ShoppingBag, Receipt, UserCheck } from 'lucide-react';
import { supabase } from '../../supabaseClient';

interface OrderRow {
  id: number;
  created_at: string;
  status: string;
  user_id: string | null;
  delivery_method: string | null;
  items: { id: number; title: string; quantity: number; price: string }[] | null;
}

const money = (n: number) => `${Math.round(n).toLocaleString('uk-UA')} грн`;
const price = (v: unknown) => parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.]/g, '')) || 0;
const orderTotal = (o: OrderRow) => (o.items || []).reduce((s, i) => s + price(i.price) * (i.quantity || 1), 0);
const dayKey = (d: Date) => d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });

const STATUS_UA: Record<string, string> = { new: 'Нові', confirmed: 'Підтверджені', shipped: 'Відправлені', completed: 'Виконані', cancelled: 'Скасовані' };

/** Sales summary for the chosen period: revenue, orders, average check, daily chart, best sellers. */
const SalesReport: React.FC = () => {
  const [days, setDays] = useState(30);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - (days - 1));
      const { data } = await supabase.from('tyre_orders')
        .select('id, created_at, status, user_id, delivery_method, items')
        .gte('created_at', since.toISOString()).order('created_at', { ascending: true }).limit(5000);
      setOrders((data as OrderRow[]) || []);
      setLoading(false);
    })();
  }, [days]);

  const report = useMemo(() => {
    const valid = orders.filter(o => o.status !== 'cancelled');
    const revenue = valid.reduce((s, o) => s + orderTotal(o), 0);
    const byDay = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); byDay.set(dayKey(d), 0); }
    for (const o of valid) { const k = dayKey(new Date(o.created_at)); byDay.set(k, (byDay.get(k) || 0) + orderTotal(o)); }
    const products = new Map<string, { title: string; qty: number; sum: number }>();
    for (const o of valid) for (const i of o.items || []) {
      const key = String(i.id ?? i.title);
      const cur = products.get(key) || { title: i.title, qty: 0, sum: 0 };
      cur.qty += i.quantity || 1; cur.sum += price(i.price) * (i.quantity || 1);
      products.set(key, cur);
    }
    const statuses = new Map<string, number>();
    for (const o of orders) statuses.set(o.status || 'new', (statuses.get(o.status || 'new') || 0) + 1);
    return {
      revenue,
      count: valid.length,
      avg: valid.length ? revenue / valid.length : 0,
      registeredShare: valid.length ? Math.round((valid.filter(o => o.user_id).length / valid.length) * 100) : 0,
      cancelled: orders.length - valid.length,
      byDay: Array.from(byDay.entries()),
      top: Array.from(products.values()).sort((a, b) => b.sum - a.sum).slice(0, 8),
      statuses: Array.from(statuses.entries()),
    };
  }, [orders, days]);

  const maxDay = Math.max(1, ...report.byDay.map(([, v]) => v));

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black uppercase flex items-center gap-2"><TrendingUp className="text-[#FFC300]" size={20} /> Звіт продажів</h2>
        <div className="flex bg-black rounded-lg p-1 gap-1">
          {[7, 30, 90, 365].map(d => (
            <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 rounded text-xs font-bold ${days === d ? 'bg-[#FFC300] text-black' : 'text-zinc-400 hover:text-white'}`}>
              {d === 365 ? 'Рік' : `${d} днів`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#FFC300]" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Виручка', value: money(report.revenue), icon: TrendingUp },
              { label: 'Замовлень', value: String(report.count), icon: ShoppingBag, note: report.cancelled ? `+ ${report.cancelled} скасовано` : '' },
              { label: 'Середній чек', value: money(report.avg), icon: Receipt },
              { label: 'Від зареєстрованих', value: `${report.registeredShare}%`, icon: UserCheck },
            ].map(c => (
              <div key={c.label} className="bg-black/40 border border-zinc-800 rounded-xl p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5"><c.icon size={12} /> {c.label}</p>
                <p className="text-xl md:text-2xl font-black text-white mt-1">{c.value}</p>
                {c.note && <p className="text-[10px] text-zinc-500">{c.note}</p>}
              </div>
            ))}
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Виручка по днях</p>
            <div className="flex items-end gap-[2px] h-32 bg-black/30 rounded-xl p-2 overflow-x-auto">
              {report.byDay.map(([day, v]) => (
                <div key={day} className="flex-1 min-w-[4px] group relative flex flex-col justify-end h-full">
                  <div className={`rounded-t ${v ? 'bg-[#FFC300]' : 'bg-zinc-800'} transition-all`} style={{ height: `${Math.max(2, (v / maxDay) * 100)}%` }} />
                  <span className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 z-10">{day}: {money(v)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Найкращі товари</p>
              {report.top.length === 0 ? <p className="text-zinc-500 text-sm">За цей період продажів немає</p> : (
                <ol className="space-y-1.5">
                  {report.top.map((t, i) => (
                    <li key={i} className="flex justify-between gap-3 text-sm">
                      <span className="text-zinc-300 line-clamp-1"><b className="text-zinc-500 mr-1">{i + 1}.</b>{t.title}</span>
                      <span className="text-white font-bold whitespace-nowrap">{t.qty} шт · {money(t.sum)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Статуси замовлень</p>
              <div className="flex flex-wrap gap-2">
                {report.statuses.length === 0 ? <p className="text-zinc-500 text-sm">—</p> : report.statuses.map(([s, n]) => (
                  <span key={s} className="bg-black/40 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs"><b className="text-white">{n}</b> <span className="text-zinc-400">{STATUS_UA[s] || s}</span></span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SalesReport;
