import React, { useState } from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';

/** Product out of stock: the buyer leaves a phone, the shop gets a Telegram message when it is back. */
const StockAlertForm: React.FC<{ productId: number; defaultName?: string }> = ({ productId, defaultName }) => {
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const digits = phone.replace(/\D/g, '');
  const valid = digits.length >= 9 && digits.length <= 13;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || state === 'sending') return;
    setState('sending');
    const { error } = await supabase.from('stock_alerts').insert([{ product_id: productId, phone: phone.trim(), name: defaultName?.slice(0, 80) || null }]);
    setState(error ? 'error' : 'done');
  };

  if (state === 'done') {
    return (
      <p className="flex-1 flex items-center gap-2 text-sm font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-3">
        <Check size={18} /> Дякуємо! Зателефонуємо, щойно товар з'явиться.
      </p>
    );
  }
  return (
    <form onSubmit={send} className="flex-1 flex flex-col gap-2">
      <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5"><Bell size={14} className="text-[#FFC300]" /> Повідомити, коли з'явиться</span>
      <div className="flex gap-2">
        <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Ваш телефон"
          aria-label="Ваш телефон" className="flex-1 min-w-0 h-12 bg-black border border-zinc-700 rounded-2xl px-4 text-white font-bold focus:border-[#FFC300] outline-none" />
        <button type="submit" disabled={!valid || state === 'sending'}
          className="shrink-0 h-12 px-4 rounded-2xl font-black text-xs uppercase tracking-wide bg-[#FFC300] text-black hover:bg-white disabled:opacity-40 transition-colors flex items-center gap-2">
          {state === 'sending' ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />} Чекаю
        </button>
      </div>
      {state === 'error' && <span className="text-xs text-red-400">Не вдалося зберегти. Спробуйте ще раз або зателефонуйте нам.</span>}
    </form>
  );
};

export default StockAlertForm;
