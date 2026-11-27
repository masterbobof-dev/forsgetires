import React, { useEffect, useState } from 'react';
import { CheckCircle, Loader2, XCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { PHONE_NUMBER_1, PHONE_LINK_1 } from '../constants';

/**
 * The page the buyer comes back to from LiqPay (/oplata?order=N): waits a little for the bank's answer
 * and says whether the payment came through. Paid goods leave the cart.
 */
const PaymentResult: React.FC<{ onBack: () => void; onPaid: (ids: number[]) => void }> = ({ onBack, onPaid }) => {
  const order = Number(new URLSearchParams(window.location.search).get('order')) || 0;
  const [state, setState] = useState<'wait' | 'paid' | 'not'>('wait');

  useEffect(() => {
    document.title = 'Оплата замовлення — Форсаж';
    let stop = false, tries = 0;
    const ask = async () => {
      if (stop) return;
      const { data } = await supabase.functions.invoke('liqpay', { body: { action: 'status', order_id: order } });
      if (stop) return;
      if (data?.paid) {
        setState('paid');
        try {
          const p = JSON.parse(sessionStorage.getItem('forsage_paying') || 'null');
          if (p && Number(p.order) === order) { onPaid(p.ids || []); sessionStorage.removeItem('forsage_paying'); }
        } catch { /* nothing to clear */ }
        return;
      }
      // the bank usually answers within seconds; after ~40 s show «not paid yet»
      if (++tries >= 14) { setState('not'); return; }
      setTimeout(ask, 3000);
    };
    if (order) ask(); else setState('not');
    return () => { stop = true; };
  }, [order]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-lg mx-auto px-4 py-10 md:py-16 text-center">
      {state === 'wait' && (
        <>
          <Loader2 size={56} className="mx-auto animate-spin text-[#FFC300] mb-6" />
          <h1 className="text-2xl font-black text-white mb-2">Перевіряємо оплату…</h1>
          <p className="text-zinc-400">Замовлення №{order}. Зазвичай це займає кілька секунд.</p>
        </>
      )}
      {state === 'paid' && (
        <>
          <CheckCircle size={64} className="mx-auto text-emerald-400 mb-6" />
          <h1 className="text-3xl font-black text-white mb-3">Оплату отримано!</h1>
          <p className="text-zinc-300 mb-2">Замовлення №{order} оплачено, товар заброньовано за вами.</p>
          <p className="text-zinc-400 text-sm mb-8">Менеджер зв'яжеться з вами, щоб підтвердити відправку або час самовивозу. Номер ТТН з'явиться в «Моєму кабінеті» (якщо ви зареєстровані).</p>
        </>
      )}
      {state === 'not' && (
        <>
          <XCircle size={64} className="mx-auto text-orange-400 mb-6" />
          <h1 className="text-2xl font-black text-white mb-3">Оплата ще не надійшла</h1>
          <p className="text-zinc-300 mb-2">{order ? `Замовлення №${order} збережено.` : 'Замовлення не знайдено.'} Якщо гроші списалися — все гаразд, банк повідомить нас трохи пізніше.</p>
          <p className="text-zinc-400 text-sm mb-8">Якщо оплату скасовано — менеджер зателефонує і запропонує інший спосіб оплати. Або подзвоніть нам: <a href={PHONE_LINK_1} className="text-[#FFC300] font-bold">{PHONE_NUMBER_1}</a></p>
        </>
      )}
      <button onClick={onBack} className="inline-flex items-center gap-2 bg-white text-black font-black px-6 py-4 rounded-2xl hover:bg-[#FFC300]"><ArrowLeft size={18} /> До каталогу</button>
    </div>
  );
};

export default PaymentResult;
