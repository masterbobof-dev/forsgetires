import React, { useEffect, useState } from 'react';
import { Check, Trash2, Loader2, MessageSquare, Reply, EyeOff } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Stars } from '../shop/ProductReviews';

interface Row {
  id: number;
  product_id: number;
  author_name: string;
  rating: number;
  body: string | null;
  approved: boolean;
  admin_reply: string | null;
  created_at: string;
  tyres?: { title: string } | null;
}

const ReviewsTab: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'all'>('pending');
  const [replyFor, setReplyFor] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');

  const load = async () => {
    setLoading(true);
    let q = supabase.from('product_reviews').select('id, product_id, author_name, rating, body, approved, admin_reply, created_at, tyres(title)').order('created_at', { ascending: false }).limit(200);
    if (filter === 'pending') q = q.eq('approved', false);
    if (filter === 'approved') q = q.eq('approved', true);
    const { data } = await q;
    setRows((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  const update = async (id: number, patch: Partial<Row>) => {
    await supabase.from('product_reviews').update(patch).eq('id', id);
    load();
  };
  const remove = async (id: number) => {
    if (!window.confirm('Видалити відгук?')) return;
    await supabase.from('product_reviews').delete().eq('id', id);
    load();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
        <h2 className="font-black uppercase text-lg flex items-center gap-2"><MessageSquare className="text-[#FFC300]" /> Відгуки покупців</h2>
        <div className="flex bg-black rounded-lg p-1 gap-1">
          {([['pending', 'На перевірці'], ['approved', 'Опубліковані'], ['all', 'Усі']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} className={`px-3 py-1.5 rounded text-xs font-bold ${filter === id ? 'bg-[#FFC300] text-black' : 'text-zinc-400 hover:text-white'}`}>{label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#FFC300]" size={36} /></div>
      ) : rows.length === 0 ? (
        <p className="text-center text-zinc-500 py-16">{filter === 'pending' ? 'Нових відгуків немає' : 'Відгуків немає'}</p>
      ) : rows.map(r => (
        <div key={r.id} className={`bg-zinc-900 border rounded-2xl p-4 space-y-2 ${r.approved ? 'border-zinc-800' : 'border-[#FFC300]/40'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-white font-bold">{r.author_name} <span className="ml-2"><Stars value={r.rating} /></span></p>
              <p className="text-zinc-500 text-xs">{new Date(r.created_at).toLocaleString('uk-UA')} · товар: {r.tyres?.title || `#${r.product_id}`}</p>
            </div>
            <div className="flex gap-1.5">
              {r.approved
                ? <button onClick={() => update(r.id, { approved: false })} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-bold"><EyeOff size={14} /> Сховати</button>
                : <button onClick={() => update(r.id, { approved: true })} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-bold"><Check size={14} /> Опублікувати</button>}
              <button onClick={() => { setReplyFor(r.id); setReplyText(r.admin_reply || ''); }} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-bold"><Reply size={14} /> Відповісти</button>
              <button onClick={() => remove(r.id)} className="p-2 rounded-lg bg-red-900/30 text-red-400" aria-label="Видалити"><Trash2 size={14} /></button>
            </div>
          </div>
          {r.body && <p className="text-zinc-300 text-sm whitespace-pre-line">{r.body}</p>}
          {r.admin_reply && replyFor !== r.id && <p className="text-xs text-zinc-400 border-l-2 border-[#FFC300]/50 pl-2"><b className="text-[#FFC300]">Ваша відповідь:</b> {r.admin_reply}</p>}
          {replyFor === r.id && (
            <div className="flex gap-2">
              <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Відповідь магазину (видно під відгуком)" className="flex-1 bg-black border border-zinc-700 rounded-lg p-2 text-white text-sm" />
              <button onClick={() => { update(r.id, { admin_reply: replyText.trim() || null }); setReplyFor(null); }} className="px-3 rounded-lg bg-[#FFC300] text-black text-xs font-black">Зберегти</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ReviewsTab;
