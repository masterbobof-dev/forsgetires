import React, { useEffect, useState } from 'react';
import { CreditCard, Loader2, Check } from 'lucide-react';
import { supabase } from '../../../supabaseClient';

interface Status { public_key: string | null; has_private: boolean; test_mode: boolean; enabled: boolean; paid_orders: number }

/**
 * Online card payment (LiqPay, PrivatBank): the owner pastes the two keys from the LiqPay cabinet and switches it on.
 * The private key is never shown again: it is kept in a closed part of the database.
 */
const PaymentPanel: React.FC = () => {
  const [st, setSt] = useState<Status | null>(null);
  const [pub, setPub] = useState('');
  const [priv, setPriv] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => supabase.rpc('liqpay_keys_status').then(({ data }) => { if (data) { setSt(data as Status); setPub((data as Status).public_key || ''); } });
  useEffect(() => { load(); }, []);

  const saveKeys = async () => {
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.rpc('liqpay_keys_set', { p_public: pub, p_private: priv });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setSt(data as Status); setPriv(''); setMsg({ ok: true, text: 'Ключі збережено' });
  };
  const toggle = async (on: boolean) => {
    if (on && !(st?.public_key && st?.has_private)) { setMsg({ ok: false, text: 'Спершу вставте і збережіть обидва ключі' }); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.from('settings').upsert({ key: 'pay_online', value: on ? '1' : '0' });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    load(); setMsg({ ok: true, text: on ? 'Онлайн-оплату ввімкнено' : 'Онлайн-оплату вимкнено' });
  };

  return (
    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3 mt-6">
      <h5 className="text-white font-bold flex items-center gap-2"><CreditCard size={18} className="text-[#FFC300]" /> Онлайн-оплата карткою (LiqPay, ПриватБанк)</h5>
      <p className="text-xs text-zinc-400 leading-relaxed">
        Ключі — у кабінеті LiqPay: «Налаштування» → «API». Онлайн оплачуються тільки ваші товари, які є в наявності;
        оплачене замовлення одразу бронює товар, а вам приходить повідомлення в Telegram.
        Ключ, що починається з <b>sandbox_</b>, — тестовий: гроші не списуються.
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-zinc-400 text-xs font-bold uppercase mb-1">Публічний ключ (public_key)</span>
          <input value={pub} onChange={e => setPub(e.target.value)} placeholder="i12345678901" autoComplete="off"
            className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-mono text-sm" />
        </label>
        <label className="block">
          <span className="block text-zinc-400 text-xs font-bold uppercase mb-1">Приватний ключ (private_key)</span>
          <input type="password" value={priv} onChange={e => setPriv(e.target.value)} autoComplete="new-password"
            placeholder={st?.has_private ? '•••••• збережено (вставте новий, щоб замінити)' : 'вставте приватний ключ'}
            className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-mono text-sm" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={saveKeys} disabled={busy || (!pub && !priv)} className="h-10 px-4 rounded-lg bg-[#FFC300] text-black font-black text-sm disabled:opacity-40">Зберегти ключі</button>
        {st && (st.enabled
          ? <button onClick={() => toggle(false)} disabled={busy} className="h-10 px-4 rounded-lg bg-zinc-800 text-white font-bold text-sm">Вимкнути онлайн-оплату</button>
          : <button onClick={() => toggle(true)} disabled={busy} className="h-10 px-4 rounded-lg bg-emerald-600 text-white font-bold text-sm">Увімкнути онлайн-оплату</button>)}
        {busy && <Loader2 size={18} className="animate-spin text-[#FFC300]" />}
      </div>
      {st && (
        <p className="text-xs text-zinc-400">
          Стан: {st.enabled ? <b className="text-emerald-400">увімкнено</b> : <b className="text-zinc-300">вимкнено</b>}
          {st.test_mode && <b className="text-orange-400"> · тестовий режим</b>}
          {' · '}ключі: {st.public_key && st.has_private ? 'є' : 'не вставлені'}
          {' · '}оплачених замовлень: {st.paid_orders}
        </p>
      )}
      {msg && <p className={`text-sm font-bold flex items-center gap-1 ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.ok && <Check size={14} />} {msg.text}</p>}
    </div>
  );
};

export default PaymentPanel;
