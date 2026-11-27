import React, { useEffect, useState } from 'react';
import { Loader2, CornerDownRight, MessageSquareReply } from 'lucide-react';
import { fetchReplies, markRepliesSeen, forumPath, type ReplyNote } from '../../forum';
import { linkClick } from '../../navigation';
import { whenShort } from './forumParts';

/** «Відповіді вам»: answers to my topics and to my messages, the new ones marked; opening the page marks them seen. */
const RepliesView: React.FC<{ userId?: string; onLogin: () => void }> = ({ userId, onLogin }) => {
  const [list, setList] = useState<ReplyNote[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!userId) return;
    fetchReplies().then(l => {
      setList(l || []);
      markRepliesSeen().then(() => window.dispatchEvent(new Event('forum-unread')), () => undefined);
    }, () => setFailed(true));
  }, [userId]);

  if (!userId) return (
    <div className="text-center py-12">
      <p className="text-zinc-400 mb-4">Увійдіть, щоб бачити відповіді на ваші теми й повідомлення.</p>
      <button onClick={onLogin} className="h-11 px-5 rounded-xl bg-[#FFC300] text-black font-black">Увійти</button>
    </div>
  );
  if (failed) return <p className="text-zinc-400 py-10 text-center">Не вдалося завантажити відповіді. Спробуйте ще раз пізніше.</p>;
  if (!list) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#FFC300]" size={36} /></div>;

  return (
    <section>
      <h1 className="text-2xl md:text-3xl font-black uppercase mb-4 flex items-center gap-2"><MessageSquareReply className="text-[#FFC300]" /> Відповіді вам</h1>
      {!list.length ? <p className="text-zinc-400 py-8 text-center">Поки ніхто не відповідав на ваші теми та повідомлення.</p> : (
        <ul className="space-y-2">
          {list.map(r => {
            const href = `${forumPath({ id: r.topic_id, title: r.topic })}#post-${r.id}`;
            return (
              <li key={r.id}>
                <a href={href} onClick={linkClick(href)}
                  className={`block rounded-2xl border p-3 md:p-4 hover:border-[#FFC300] ${r.unread ? 'border-[#FFC300]/50 bg-[#FFC300]/5' : 'border-zinc-800 bg-zinc-900/60'}`}>
                  <p className="text-[11px] text-zinc-500 flex items-center gap-1 mb-1">
                    {r.unread && <span className="px-1.5 rounded bg-[#FFC300] text-black font-black">нове</span>}
                    <CornerDownRight size={12} /> {r.to_my_message ? 'на ваше повідомлення' : 'у вашій темі'} · {whenShort(r.at)}
                  </p>
                  <p className="font-bold text-white break-words">{r.topic}</p>
                  <p className="text-sm text-zinc-300 mt-1 break-words"><b className="text-zinc-200">{r.author}:</b> {r.body}{r.body.length >= 160 ? '…' : ''}</p>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default RepliesView;
