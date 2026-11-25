import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Users, Eye, ShoppingCart, CheckCircle, Search, MapPin, Smartphone, Globe, Clock, Loader2, Heart, Package, FileText, Share2 } from 'lucide-react';

type Row = { name: string; n: number };
type Data = {
  totals: { visitors: number; page_views: number; viewers: number; carters: number; buyers: number; searches: number };
  orders: { count: number; sum: number };
  by_day: { d: string; visitors: number; views: number }[];
  by_hour: { h: number; n: number }[];
  cities: Row[]; countries: Row[]; devices: Row[]; os: Row[]; browsers: Row[]; sources: Row[];
  viewed: Row[]; carted: Row[]; wished: Row[]; searched: Row[]; pages: Row[]; ordered: Row[]; order_cities: Row[];
};

const DEVICE: Record<string, string> = { Mobile: 'Телефон', Desktop: 'Комп\'ютер', Tablet: 'Планшет' };
const PAGES: Record<string, string> = { '/': 'Головна', '/account': 'Кабінет', '/faq': 'Поширені питання', '/dostavka': 'Доставка', '/kontakty': 'Контакти', '/garantiya': 'Гарантія', '/pro-nas': 'Про магазин', '/statti': 'Статті' };

/** A ranked list with bars: who / what / how many. */
const List: React.FC<{ title: string; icon: React.ReactNode; rows: Row[]; empty?: string; label?: (s: string) => string; unit?: string }> = ({ title, icon, rows, empty, label, unit }) => {
  const max = Math.max(1, ...rows.map(r => r.n));
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <h4 className="text-zinc-300 font-black uppercase text-xs tracking-wide mb-3 flex items-center gap-2"><span className="text-[#FFC300]">{icon}</span>{title}</h4>
      {rows.length === 0 ? <p className="text-zinc-600 text-sm">{empty || 'Поки немає даних'}</p> : (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={r.name + i} className="relative rounded-lg overflow-hidden bg-black/40">
              <div className="absolute inset-y-0 left-0 bg-[#FFC300]/15" style={{ width: `${(r.n / max) * 100}%` }} />
              <div className="relative flex items-center gap-2 px-2.5 py-1.5 text-sm">
                <span className="text-zinc-500 text-xs w-5 shrink-0 tabular-nums">{i + 1}</span>
                <span className="flex-1 min-w-0 truncate text-zinc-200" title={r.name}>{label ? label(r.name) : r.name}</span>
                <span className="font-black text-white tabular-nums shrink-0">{r.n}{unit ? <span className="text-zinc-500 font-normal text-xs"> {unit}</span> : null}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const VisitorStats: React.FC = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let off = false;
    setLoading(true); setError('');
    supabase.rpc('visitor_stats', { p_days: days }).then(({ data, error }) => {
      if (off) return;
      if (error) setError(error.message); else if (!(data as Data)?.totals) setError('немає даних'); else setData(data as Data);
      setLoading(false);
    });
    return () => { off = true; };
  }, [days]);

  const t = data?.totals;
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—');
  const dayMax = Math.max(1, ...(data?.by_day || []).map(d => d.visitors));
  const hours = Array.from({ length: 24 }, (_, h) => data?.by_hour.find(x => x.h === h)?.n || 0);
  const hourMax = Math.max(1, ...hours);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-white font-black uppercase tracking-wide text-lg flex items-center gap-2"><Users className="text-[#FFC300]" size={20} /> Відвідувачі сайту</h3>
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          {[[1, 'Сьогодні'], [7, '7 днів'], [30, '30 днів'], [90, '90 днів']].map(([d, l]) => (
            <button key={d} onClick={() => setDays(d as number)} className={`px-3 h-8 rounded-lg text-xs font-bold ${days === d ? 'bg-[#FFC300] text-black' : 'text-zinc-400 hover:text-white'}`}>{l}</button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">Не вдалося завантажити: {error}</p>}
      {loading && !data ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-[#FFC300]" /></div> : data && t && (
        <div className={`space-y-4 ${loading ? 'opacity-50' : ''}`}>
          {/* The path of a visitor: came → looked at a product → put in the cart → ordered */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { l: 'Зайшли на сайт', v: t.visitors, s: `${t.page_views} переглядів сторінок`, i: <Users size={18} /> },
              { l: 'Дивились товар', v: t.viewers, s: `${pct(t.viewers, t.visitors)} відвідувачів`, i: <Eye size={18} /> },
              { l: 'Поклали в кошик', v: t.carters, s: `${pct(t.carters, t.visitors)} відвідувачів`, i: <ShoppingCart size={18} /> },
              { l: 'Замовлень', v: data.orders.count, s: `на ${Math.round(data.orders.sum).toLocaleString('uk-UA')} грн`, i: <CheckCircle size={18} /> },
              { l: 'Шукали на сайті', v: t.searches, s: 'пошукових запитів', i: <Search size={18} /> },
            ].map(k => (
              <div key={k.l} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-zinc-400 text-[11px] font-bold uppercase"><span className="text-[#FFC300]">{k.i}</span>{k.l}</div>
                <div className="text-3xl font-black text-white mt-1 tabular-nums">{k.v}</div>
                <div className="text-xs text-zinc-500">{k.s}</div>
              </div>
            ))}
          </div>

          {t.visitors === 0 && <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">За цей період відвідувань ще не записано. Дані збираються з моменту ввімкнення лічильника — зайдіть сюди за день-два.</p>}

          {days > 1 && data.by_day.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <h4 className="text-zinc-300 font-black uppercase text-xs tracking-wide mb-3">Відвідувачі по днях</h4>
              <div className="flex items-end gap-1 h-32">
                {data.by_day.map(d => (
                  <div key={d.d} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full group relative" title={`${d.d}: ${d.visitors} відвідувачів, ${d.views} переглядів`}>
                    <span className="text-[10px] text-zinc-400 mb-0.5 opacity-0 group-hover:opacity-100">{d.visitors}</span>
                    <div className="w-full bg-[#FFC300] rounded-t" style={{ height: `${Math.max(3, (d.visitors / dayMax) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-zinc-500 mt-1"><span>{data.by_day[0].d.slice(5)}</span><span>{data.by_day[data.by_day.length - 1].d.slice(5)}</span></div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <List title="З яких міст заходять" icon={<MapPin size={15} />} rows={data.cities} />
            <List title="Звідки прийшли" icon={<Share2 size={15} />} rows={data.sources} empty="Збирається з сьогоднішнього дня" />
            <List title="Пристрої" icon={<Smartphone size={15} />} rows={data.devices} label={s => DEVICE[s] || s} />
            <List title="Що дивляться (товари)" icon={<Eye size={15} />} rows={data.viewed} unit="разів" />
            <List title="Що кладуть у кошик" icon={<ShoppingCart size={15} />} rows={data.carted} unit="разів" />
            <List title="Що замовляють" icon={<Package size={15} />} rows={data.ordered} unit="шт" />
            <List title="Що шукають на сайті" icon={<Search size={15} />} rows={data.searched} />
            <List title="Які розділи й сторінки відкривають" icon={<FileText size={15} />} rows={data.pages} label={s => PAGES[s] || s} />
            <List title="Додають в обране" icon={<Heart size={15} />} rows={data.wished} />
            <List title="Куди замовляють" icon={<MapPin size={15} />} rows={data.order_cities} unit="зам." />
            <List title="Система телефону / комп'ютера" icon={<Smartphone size={15} />} rows={data.os} />
            <List title="Браузери та країни" icon={<Globe size={15} />} rows={[...data.browsers, ...data.countries]} />
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h4 className="text-zinc-300 font-black uppercase text-xs tracking-wide mb-3 flex items-center gap-2"><Clock size={15} className="text-[#FFC300]" /> О котрій годині заходять</h4>
            <div className="flex items-end gap-0.5 h-20">
              {hours.map((n, h) => <div key={h} className="flex-1 bg-[#FFC300]/70 rounded-t" style={{ height: `${Math.max(2, (n / hourMax) * 100)}%` }} title={`${h}:00 — ${n}`} />)}
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500 mt-1"><span>0:00</span><span>6:00</span><span>12:00</span><span>18:00</span><span>23:00</span></div>
          </div>

          <p className="text-xs text-zinc-500">Стать і вік відвідувачів сайт сам визначити не може — ці дані є лише в Google Analytics (потрібен ваш лічильник Google).</p>
        </div>
      )}
    </section>
  );
};

export default VisitorStats;
