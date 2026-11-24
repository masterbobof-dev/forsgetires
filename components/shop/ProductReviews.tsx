import React, { useEffect, useState } from 'react';
import { Star, Loader2, MessageSquare, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';

interface Review {
  id: number;
  author_name: string;
  rating: number;
  body: string | null;
  approved: boolean;
  admin_reply: string | null;
  created_at: string;
  user_id: string | null;
}

export const Stars: React.FC<{ value: number; size?: number; onChange?: (v: number) => void }> = ({ value, size = 14, onChange }) => (
  <span className="inline-flex gap-0.5" aria-label={`Оцінка ${value} з 5`}>
    {[1, 2, 3, 4, 5].map(i => (
      <button
        key={i}
        type="button"
        disabled={!onChange}
        onClick={() => onChange?.(i)}
        className={`${onChange ? 'cursor-pointer active:scale-90 transition-transform p-0.5' : 'cursor-default'} ${i <= value ? 'text-[#FFC300]' : 'text-zinc-700'}`}
        aria-label={onChange ? `${i} з 5` : undefined}
      >
        <Star size={size} fill={i <= value ? 'currentColor' : 'none'} />
      </button>
    ))}
  </span>
);

interface Props {
  productId: number;
  userId?: string;
  userName?: string;
  onRequireLogin?: () => void;
}

const ProductReviews: React.FC<Props> = ({ productId, userId, userName, onRequireLogin }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [name, setName] = useState(userName || '');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('product_reviews')
      .select('id, author_name, rating, body, approved, admin_reply, created_at, user_id')
      .eq('product_id', productId).order('created_at', { ascending: false }).limit(50);
    setReviews((data as Review[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); setShowForm(false); setMessage(null); }, [productId]);
  useEffect(() => { if (userName && !name) setName(userName); }, [userName]);

  const approved = reviews.filter(r => r.approved);
  const mine = userId ? reviews.find(r => r.user_id === userId) : undefined;
  const avg = approved.length ? approved.reduce((s, r) => s + r.rating, 0) / approved.length : 0;

  const submit = async () => {
    if (!userId) { onRequireLogin?.(); return; }
    if (!name.trim()) { setMessage({ ok: false, text: 'Вкажіть ім\'я' }); return; }
    setSending(true);
    const { error } = await supabase.from('product_reviews').insert([{
      product_id: productId, user_id: userId, author_name: name.trim().slice(0, 80), rating, body: body.trim().slice(0, 2000) || null,
    }]);
    setSending(false);
    if (error) {
      setMessage({ ok: false, text: error.code === '23505' ? 'Ви вже залишили відгук на цей товар.' : 'Не вдалося надіслати відгук. Спробуйте пізніше.' });
      return;
    }
    setMessage({ ok: true, text: 'Дякуємо! Відгук з\'явиться після перевірки.' });
    setShowForm(false); setBody('');
    load();
  };

  return (
    <section className="mt-8 border-t border-zinc-800 pt-6" aria-label="Відгуки">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-white text-lg font-black uppercase tracking-widest flex items-center gap-2">
          <MessageSquare size={18} className="text-[#FFC300]" /> Відгуки
          {approved.length > 0 && <span className="text-zinc-500 text-sm normal-case tracking-normal font-bold">({approved.length})</span>}
        </h3>
        {approved.length > 0 && (
          <span className="flex items-center gap-2 text-sm font-black text-white"><Stars value={Math.round(avg)} /> {avg.toFixed(1)}</span>
        )}
      </div>

      {!mine && !showForm && (
        <button
          onClick={() => (userId ? setShowForm(true) : onRequireLogin?.())}
          className="w-full mb-4 py-3 rounded-2xl border border-dashed border-zinc-700 text-zinc-300 hover:border-[#FFC300] hover:text-[#FFC300] text-sm font-bold transition-colors"
        >
          {userId ? 'Написати відгук' : 'Увійдіть, щоб написати відгук'}
        </button>
      )}

      {showForm && (
        <div className="mb-4 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3"><span className="text-xs text-zinc-500 font-bold uppercase">Ваша оцінка</span><Stars value={rating} size={22} onChange={setRating} /></div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ваше ім'я" maxLength={80}
            className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white text-sm outline-none focus:border-[#FFC300]" />
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Що сподобалось / не сподобалось? (необов'язково)" rows={3} maxLength={2000}
            className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white text-sm outline-none focus:border-[#FFC300] resize-none" />
          <div className="flex gap-2">
            <button onClick={submit} disabled={sending} className="flex-1 bg-[#FFC300] hover:bg-white text-black font-black py-3 rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {sending ? <Loader2 size={16} className="animate-spin" /> : 'Надіслати'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-bold">Скасувати</button>
          </div>
        </div>
      )}

      {message && (
        <p className={`mb-4 text-xs font-bold flex items-center gap-2 ${message.ok ? 'text-green-400' : 'text-red-400'}`}>
          {message.ok && <CheckCircle2 size={14} />} {message.text}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="animate-spin text-zinc-600" /></div>
      ) : (
        <div className="space-y-3">
          {mine && !mine.approved && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3 text-xs text-zinc-400">Ваш відгук ({mine.rating}★) очікує перевірки.</div>
          )}
          {approved.length === 0 && !mine && <p className="text-zinc-500 text-sm">Відгуків ще немає — будьте першим!</p>}
          {approved.map(r => (
            <article key={r.id} className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-white font-bold text-sm">{r.author_name}</span>
                <span className="text-zinc-600 text-[11px]">{new Date(r.created_at).toLocaleDateString('uk-UA')}</span>
              </div>
              <Stars value={r.rating} size={12} />
              {r.body && <p className="text-zinc-300 text-sm mt-2 whitespace-pre-line">{r.body}</p>}
              {r.admin_reply && (
                <div className="mt-2 pl-3 border-l-2 border-[#FFC300]/50 text-xs text-zinc-400"><b className="text-[#FFC300]">Форсаж:</b> {r.admin_reply}</div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default ProductReviews;
