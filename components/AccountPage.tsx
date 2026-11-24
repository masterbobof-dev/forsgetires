import React, { useEffect, useState } from 'react';
import { formatUaPhone } from '../phone';
import { User, Phone, MapPin, Package, LogOut, Save, Loader2, Key, CheckCircle2, ShoppingBag, ArrowLeft, Truck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import NovaPoshtaPicker from './NovaPoshtaPicker';
import type { AuthState } from '../useAuth';

interface Profile { full_name: string; phone: string; city: string; warehouse: string }

interface OrderRow {
  id: number;
  created_at: string;
  status: string;
  items: { id: number; title: string; quantity: number; price: string }[] | null;
  delivery_method?: string;
  delivery_city?: string;
  delivery_warehouse?: string;
  tracking_number?: string | null;
}

export const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: 'Прийнято', cls: 'bg-green-500/10 text-green-400 border-green-500/30' },
  confirmed: { label: 'Підтверджено', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  shipped: { label: 'Відправлено', cls: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  completed: { label: 'Виконано', cls: 'bg-zinc-700/40 text-zinc-300 border-zinc-600/50' },
  cancelled: { label: 'Скасовано', cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
};

const price = (v: string) => Math.round(parseFloat(String(v).replace(',', '.').replace(/[^\d.]/g, '')) || 0);

const inputCls = 'w-full bg-black border border-zinc-700 rounded-xl p-3 pl-10 text-white outline-none focus:border-[#FFC300] transition-colors';

const AccountPage: React.FC<{ auth: AuthState; onBack: () => void }> = ({ auth, onBack }) => {
  const user = auth.session?.user;
  const [profile, setProfile] = useState<Profile>({ full_name: '', phone: '', city: '', warehouse: '' });
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState<'orders' | 'profile'>('orders');

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: p }, { data: o }] = await Promise.all([
        supabase.from('customer_profiles').select('full_name, phone, city, warehouse').eq('id', user.id).maybeSingle(),
        supabase.from('tyre_orders').select('id, created_at, status, items, delivery_method, delivery_city, delivery_warehouse, tracking_number')
          .eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);
      setProfile({
        full_name: p?.full_name || user.user_metadata?.full_name || '',
        phone: p?.phone || user.user_metadata?.phone || '',
        city: p?.city || '',
        warehouse: p?.warehouse || '',
      });
      setOrders((o as OrderRow[]) || []);
      setLoading(false);
    })();
  }, [user?.id]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#FFC300]/10 text-[#FFC300] flex items-center justify-center"><User size={32} /></div>
        <h1 className="text-2xl font-black uppercase">Мій кабінет</h1>
        <p className="text-zinc-400">Увійдіть або зареєструйтесь, щоб бачити свої замовлення та не вводити адресу щоразу.</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button onClick={() => auth.openAuthModal('login')} className="bg-[#FFC300] text-black font-black px-6 py-3 rounded-xl hover:bg-white transition-colors">Увійти</button>
          <button onClick={() => auth.openAuthModal('register')} className="bg-zinc-800 text-white font-black px-6 py-3 rounded-xl hover:bg-zinc-700 transition-colors">Зареєструватися</button>
        </div>
      </div>
    );
  }

  const saveProfile = async () => {
    setSaving(true); setSaved(false);
    const { error } = await supabase.from('customer_profiles').upsert({ id: user.id, ...profile, updated_at: new Date().toISOString() });
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  };

  const changePassword = async () => {
    if (newPassword.length < 6) { setPwMsg({ ok: false, text: 'Мінімум 6 символів' }); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Пароль змінено' });
    if (!error) setNewPassword('');
  };

  return (
    <div className="max-w-4xl mx-auto px-3 md:px-4 py-5 md:py-10 pb-28 animate-in fade-in duration-300">
      <button onClick={onBack} className="text-zinc-500 hover:text-[#FFC300] text-xs font-black uppercase tracking-widest flex items-center gap-1 mb-4"><ArrowLeft size={14} /> До каталогу</button>

      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#FFC300] text-black flex items-center justify-center font-black text-xl shrink-0">
            {(profile.full_name || user.email || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-3xl font-black uppercase tracking-tight truncate">{profile.full_name || 'Мій кабінет'}</h1>
            <p className="text-zinc-500 text-xs md:text-sm truncate">{user.email}</p>
          </div>
        </div>
        <button onClick={auth.logout} className="shrink-0 flex items-center gap-2 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-900/60 px-3 py-2 rounded-xl text-xs font-bold transition-colors">
          <LogOut size={16} /> <span className="hidden sm:inline">Вийти</span>
        </button>
      </div>

      <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 mb-5 w-full sm:w-fit">
        {([['orders', 'Мої замовлення', Package], ['profile', 'Дані та адреса', User]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${tab === id ? 'bg-[#FFC300] text-black shadow' : 'text-zinc-400 hover:text-white'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#FFC300]" size={36} /></div>
      ) : tab === 'orders' ? (
        orders.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900/40 border border-dashed border-zinc-800 rounded-3xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <ShoppingBag size={40} className="mx-auto text-zinc-700" />
            <p className="text-zinc-400">Замовлень ще немає</p>
            <button onClick={onBack} className="bg-[#FFC300] text-black font-black px-6 py-3 rounded-xl hover:bg-white transition-colors">Перейти до каталогу</button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o, i) => {
              const st = ORDER_STATUS[o.status] || ORDER_STATUS.new;
              const total = (o.items || []).reduce((s, it) => s + price(it.price) * (it.quantity || 1), 0);
              return (
                <div key={o.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-4 duration-300" style={{ animationDelay: `${Math.min(i * 50, 300)}ms` }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-black text-white">Замовлення № {o.id}</p>
                      <p className="text-zinc-500 text-xs">{new Date(o.created_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${st.cls}`}>{st.label}</span>
                  </div>
                  <ul className="space-y-1 mb-3">
                    {(o.items || []).map((it, idx) => (
                      <li key={idx} className="flex justify-between gap-3 text-sm">
                        <span className="text-zinc-300 line-clamp-1">{it.title}</span>
                        <span className="text-zinc-500 whitespace-nowrap">{it.quantity} × {price(it.price)} грн</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-800">
                    <span className="text-zinc-500 text-xs flex items-center gap-1.5">
                      <Truck size={14} />
                      {o.delivery_method === 'newpost' ? `Нова Пошта: ${o.delivery_city || ''} ${o.delivery_warehouse || ''}` : 'Самовивіз, м. Синельникове'}
                    </span>
                    <span className="text-[#FFC300] font-black">{total} грн</span>
                  </div>
                  {o.tracking_number && (
                    <a href={`https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(o.tracking_number)}`} target="_blank" rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-white bg-red-600/90 hover:bg-red-600 px-3 py-2 rounded-lg">
                      Відстежити посилку (ТТН {o.tracking_number})
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="grid md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">Контакти та доставка</h2>
            <p className="text-zinc-500 text-xs">Ці дані підставляться при оформленні замовлення.</p>
            {([
              ['full_name', "Ім'я та прізвище", User, 'name'],
              ['phone', 'Телефон', Phone, 'tel'],
            ] as const).map(([key, label, Icon, ac]) => (
              <div key={key} className="relative">
                <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input value={profile[key]} onChange={e => setProfile({ ...profile, [key]: key === 'phone' ? formatUaPhone(e.target.value) : e.target.value })} placeholder={label}
                  autoComplete={ac} type={key === 'phone' ? 'tel' : 'text'} className={inputCls} />
              </div>
            ))}
            <p className="text-zinc-500 text-xs pt-1">Куди надсилати замовлення (Нова Пошта):</p>
            <NovaPoshtaPicker city={profile.city} warehouse={profile.warehouse} inputCls={inputCls}
              onChange={v => setProfile(p => ({ ...p, ...v }))} />
            <button onClick={saveProfile} disabled={saving}
              className="w-full bg-[#FFC300] hover:bg-white text-black font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
              {saving ? <Loader2 className="animate-spin" size={18} /> : saved ? <><CheckCircle2 size={18} /> Збережено</> : <><Save size={18} /> Зберегти</>}
            </button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3 h-fit">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">Змінити пароль</h2>
            <div className="relative">
              <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Новий пароль (мін. 6 символів)" autoComplete="new-password" className={inputCls} />
            </div>
            <button onClick={changePassword} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black py-3 rounded-xl transition-colors">Змінити</button>
            {pwMsg && <p className={`text-xs font-bold ${pwMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{pwMsg.text}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountPage;
