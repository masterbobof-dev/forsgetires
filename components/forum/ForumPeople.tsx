import React, { useEffect, useRef, useState } from 'react';
import { Loader2, UserPlus, UserCheck, Users, MessageCircle, Car as CarIcon, Plus, Pencil, Trash2, Save, X, Send, MapPin, CalendarDays, ArrowLeft } from 'lucide-react';
import { linkClick, navigateTo } from '../../navigation';
import {
  fetchProfile, fetchPeople, setFollow, fetchMe, saveMe, fetchInbox, fetchThread, sendMessage, fetchMyCars, saveCar, deleteCar,
  userPath, messagesPath, forumPath, type Profile, type PersonShort, type Car, type InboxRow, type Thread,
} from '../../forum';
import { Avatar, AvatarPicker, PhotoPicker, Body, when } from './forumParts';

const btn = 'h-10 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50';
const input = 'w-full bg-black border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#FFC300]';

const PersonLink: React.FC<{ p: PersonShort; sub?: React.ReactNode }> = ({ p, sub }) => (
  <a href={userPath(p.pid)} onClick={linkClick(userPath(p.pid))} className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-800/60">
    <Avatar name={p.name} avatar={p.avatar} size={40} />
    <span className="min-w-0"><span className="block font-bold text-white truncate">{p.name}</span>{sub && <span className="block text-xs text-zinc-500 truncate">{sub}</span>}</span>
  </a>
);

/** Photos of a car: one big picture and small ones to switch. */
const CarPhotos: React.FC<{ photos: string[]; alt: string }> = ({ photos, alt }) => {
  const [i, setI] = useState(0);
  if (!photos.length) return <div className="aspect-[16/9] rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-700"><CarIcon size={56} /></div>;
  return (
    <div className="space-y-2">
      <a href={photos[i]} target="_blank" rel="noopener noreferrer" className="block aspect-[16/9] rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800">
        <img src={photos[i]} alt={alt} className="w-full h-full object-cover" loading="lazy" />
      </a>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {photos.map((u, k) => (
            <button key={u} onClick={() => setI(k)} className={`w-16 h-12 shrink-0 rounded-lg overflow-hidden border-2 ${k === i ? 'border-[#FFC300]' : 'border-transparent opacity-70'}`} aria-label={`Фото ${k + 1}`}>
              <img src={u} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const carTitle = (c: Pick<Car, 'make' | 'model' | 'year'>) => `${c.make} ${c.model}${c.year ? ` ${c.year}` : ''}`;

/** Add or change one car of the garage. */
const CarForm: React.FC<{ userId: string; initial?: Car; onDone: () => void }> = ({ userId, initial, onDone }) => {
  const [c, setC] = useState<Partial<Car>>(initial || { photos: [] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof Car, v: any) => setC(x => ({ ...x, [k]: v }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!c.make?.trim() || !c.model?.trim()) { setErr('Вкажіть марку і модель'); return; }
    setBusy(true); setErr('');
    try { await saveCar(c as Car); onDone(); } catch { setErr('Не вдалося зберегти. Спробуйте ще раз.'); }
    setBusy(false);
  };
  return (
    <form onSubmit={save} className="bg-zinc-900 border border-[#FFC300]/40 rounded-2xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input className={input} value={c.make || ''} onChange={e => set('make', e.target.value)} placeholder="Марка, напр. Toyota" aria-label="Марка" maxLength={40} />
        <input className={input} value={c.model || ''} onChange={e => set('model', e.target.value)} placeholder="Модель, напр. Camry" aria-label="Модель" maxLength={60} />
        <input className={input} value={c.year || ''} onChange={e => set('year', Number(e.target.value.replace(/\D/g, '').slice(0, 4)) || null)} placeholder="Рік" inputMode="numeric" aria-label="Рік" />
        <input className={input} value={c.engine || ''} onChange={e => set('engine', e.target.value)} placeholder="Двигун, напр. 2.5 дизель" aria-label="Двигун" maxLength={60} />
      </div>
      <input className={input} value={c.nickname || ''} onChange={e => set('nickname', e.target.value)} placeholder="Як ви її називаєте (необов'язково)" aria-label="Назва" maxLength={60} />
      <textarea className={`${input} min-h-[90px]`} value={c.about || ''} onChange={e => set('about', e.target.value)} placeholder="Розкажіть про авто: що робили, що поставили, як їздить" aria-label="Про авто" maxLength={3000} />
      <PhotoPicker userId={userId} images={c.photos || []} onChange={u => set('photos', u)} onError={setErr} max={12} />
      {err && <p className="text-sm text-red-400">{err}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={`${btn} bg-[#FFC300] text-black`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Зберегти авто</button>
        <button type="button" onClick={onDone} className={`${btn} border border-zinc-700 text-zinc-300`}><X size={16} /> Скасувати</button>
      </div>
    </form>
  );
};

/** /forum/user-N: who the person is, their garage, following, and a button to write to them. */
export const ProfileView: React.FC<{ pid: number; userId?: string; onLogin: () => void }> = ({ pid, userId, onLogin }) => {
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [list, setList] = useState<{ kind: 'followers' | 'following' | 'friends'; people: PersonShort[] } | null>(null);
  const [editCar, setEditCar] = useState<Car | 'new' | null>(null);
  const [myCars, setMyCars] = useState<Car[]>([]);
  const [editMe, setEditMe] = useState(false);
  const [about, setAbout] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const r = await fetchProfile(pid).catch(() => null);
    setP(r);
    if (r) document.title = `${r.name} — профіль на форумі «Форсаж»`;
    if (r?.is_me) setMyCars(await fetchMyCars().catch(() => []));
  };
  useEffect(() => { setP(undefined); setList(null); load(); }, [pid, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (p === undefined) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#FFC300]" size={40} /></div>;
  if (!p) return <p className="text-zinc-400 py-10 text-center">Такого учасника не знайдено.</p>;

  const follow = async () => {
    if (!userId) { onLogin(); return; }
    setBusy(true);
    try { setP(await setFollow(pid, !p.i_follow)); } catch { alert('Не вдалося. Спробуйте ще раз.'); }
    setBusy(false);
  };
  const showList = async (kind: 'followers' | 'following' | 'friends') => {
    if (list?.kind === kind) { setList(null); return; }
    setList({ kind, people: await fetchPeople(pid, kind).catch(() => []) });
  };
  const cars = p.is_me ? myCars : p.cars;
  const friends = p.i_follow && p.follows_me;
  const stat = (n: number, label: string, kind?: 'followers' | 'following' | 'friends') => (
    <button onClick={kind ? () => showList(kind) : undefined} className={`text-center px-2 py-2 rounded-xl ${list?.kind === kind && kind ? 'bg-[#FFC300]/15' : 'hover:bg-zinc-800/60'}`}>
      <span className="block text-xl font-black text-white">{n}</span><span className="block text-[11px] text-zinc-400">{label}</span>
    </button>
  );

  return (
    <div className="space-y-5">
      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-6">
        <div className="flex items-start gap-4">
          <Avatar name={p.name} avatar={p.avatar} size={72} />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-black text-white break-words">{p.name}</h1>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400 mt-1">
              {p.city && <span className="flex items-center gap-1"><MapPin size={12} /> {p.city}</span>}
              <span className="flex items-center gap-1"><CalendarDays size={12} /> на сайті з {when(p.joined)}</span>
              {friends && <span className="flex items-center gap-1 text-emerald-400 font-bold"><Users size={12} /> ви друзі</span>}
              {!friends && p.follows_me && <span className="text-zinc-300">підписаний(а) на вас</span>}
            </div>
          </div>
        </div>
        {p.about && !editMe && <div className="mt-4 text-sm"><Body text={p.about} /></div>}
        {editMe && (
          <div className="mt-4 space-y-3">
            {userId && <AvatarPicker userId={userId} name={p.name} onSaved={() => load()} />}
            <input className={input} value={city} onChange={e => setCity(e.target.value)} placeholder="Місто, напр. Синельникове" maxLength={60} aria-label="Місто" />
            <textarea className={`${input} min-h-[90px]`} value={about} onChange={e => setAbout(e.target.value)} placeholder="Кілька слів про себе" maxLength={1000} aria-label="Про себе" />
            <div className="flex gap-2">
              <button onClick={async () => { setBusy(true); try { await saveMe(about, city); setEditMe(false); await load(); } catch { alert('Не вдалося зберегти'); } setBusy(false); }}
                disabled={busy} className={`${btn} bg-[#FFC300] text-black`}><Save size={16} /> Зберегти</button>
              <button onClick={() => setEditMe(false)} className={`${btn} border border-zinc-700 text-zinc-300`}>Скасувати</button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-5 gap-1 mt-4 border-t border-zinc-800 pt-3">
          {stat(p.topics, 'тем')}{stat(p.posts, 'відповідей')}{stat(p.friends, 'друзі', 'friends')}{stat(p.followers, 'підписники', 'followers')}{stat(p.following, 'підписки', 'following')}
        </div>
        {list && (
          <div className="mt-2 bg-black/30 rounded-xl p-2">
            {list.people.length ? list.people.map(x => <PersonLink key={x.pid} p={x} />) : <p className="text-sm text-zinc-500 p-2">Поки нікого.</p>}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-4">
          {p.is_me ? (
            <>
              <button onClick={async () => { const me = await fetchMe().catch(() => null); setAbout(me?.about || ''); setCity(me?.city || ''); setEditMe(true); }} className={`${btn} border border-zinc-700 text-white`}><Pencil size={16} /> Редагувати профіль</button>
              <a href={messagesPath()} onClick={linkClick(messagesPath())} className={`${btn} border border-zinc-700 text-white`}><MessageCircle size={16} /> Мої повідомлення</a>
            </>
          ) : (
            <>
              <button onClick={follow} disabled={busy} className={`${btn} ${p.i_follow ? 'border border-zinc-700 text-zinc-300' : 'bg-[#FFC300] text-black'}`}>
                {p.i_follow ? <><UserCheck size={16} /> Ви підписані</> : <><UserPlus size={16} /> {p.follows_me ? 'Підписатися у відповідь' : 'Підписатися'}</>}
              </button>
              <button onClick={() => (userId ? navigateTo(messagesPath(pid)) : onLogin())} className={`${btn} border border-zinc-700 text-white`}><MessageCircle size={16} /> Написати</button>
            </>
          )}
        </div>
        {!p.is_me && <p className="text-[11px] text-zinc-500 mt-2">Підпишіться один на одного — і станете друзями.</p>}
      </section>

      <section>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-black uppercase flex items-center gap-2"><CarIcon size={20} className="text-[#FFC300]" /> Гараж{cars.length ? ` (${cars.length})` : ''}</h2>
          {p.is_me && !editCar && <button onClick={() => setEditCar('new')} className={`${btn} bg-[#FFC300] text-black`}><Plus size={16} /> Додати авто</button>}
        </div>
        {p.is_me && editCar === 'new' && userId && <div className="mb-3"><CarForm userId={userId} onDone={() => { setEditCar(null); load(); }} /></div>}
        {!cars.length && editCar !== 'new' && (
          <p className="text-zinc-500 text-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            {p.is_me ? 'Додайте своє авто з фото — як у бортжурналі: марка, рік, двигун, що робили.' : 'Учасник ще не додав авто.'}
          </p>
        )}
        <div className="grid md:grid-cols-2 gap-3">
          {cars.map(c => (p.is_me && typeof editCar === 'object' && editCar?.id === c.id && userId) ? (
            <div key={c.id} className="md:col-span-2"><CarForm userId={userId} initial={c} onDone={() => { setEditCar(null); load(); }} /></div>
          ) : (
            <article key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 space-y-3">
              <CarPhotos photos={c.photos} alt={carTitle(c)} />
              <div>
                <h3 className="font-black text-white text-lg leading-tight">{carTitle(c)}</h3>
                <p className="text-xs text-zinc-400">{[c.nickname && `«${c.nickname}»`, c.engine].filter(Boolean).join(' · ')}</p>
              </div>
              {c.about && <div className="text-sm"><Body text={c.about} /></div>}
              {p.is_me && (
                <div className="flex gap-2">
                  <button onClick={() => setEditCar(c)} className={`${btn} h-9 border border-zinc-700 text-zinc-300`}><Pencil size={14} /> Змінити</button>
                  <button onClick={async () => { if (confirm(`Видалити ${carTitle(c)} з гаража?`)) { await deleteCar(c.id).catch(() => alert('Не вдалося видалити')); load(); } }}
                    className={`${btn} h-9 border border-red-900 text-red-400`}><Trash2 size={14} /> Видалити</button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {p.recent.length > 0 && (
        <section>
          <h2 className="text-lg font-black uppercase mb-3">Теми учасника</h2>
          <ul className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
            {p.recent.map(t => <li key={t.id}><a href={forumPath(t)} onClick={linkClick(forumPath(t))} className="block px-4 py-3 text-zinc-200 hover:text-[#FFC300]">{t.title}</a></li>)}
          </ul>
        </section>
      )}
    </div>
  );
};

/** /forum/messages: the list of conversations; /forum/messages?to=N: one conversation. */
export const MessagesView: React.FC<{ userId?: string; onLogin: () => void }> = ({ userId, onLogin }) => {
  const to = Number(new URLSearchParams(window.location.search).get('to')) || null;
  const [inbox, setInbox] = useState<InboxRow[] | null>(null);
  const [thread, setThread] = useState<Thread | null | undefined>(undefined);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!userId) return;
    if (to) setThread(await fetchThread(to).catch(() => null));
    else setInbox(await fetchInbox().catch(() => []));
    window.dispatchEvent(new Event('forum-unread'));
  };
  useEffect(() => { setThread(undefined); setInbox(null); load(); }, [to, userId]); // eslint-disable-line react-hooks/exhaustive-deps
  // new messages appear by themselves while the page is open
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 10000); return () => clearInterval(t); }, [to, userId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [thread?.messages.length]);
  useEffect(() => { document.title = 'Повідомлення — форум «Форсаж»'; }, []);

  if (!userId) return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center space-y-3">
      <p className="text-zinc-300">Увійдіть, щоб читати й писати особисті повідомлення.</p>
      <button onClick={onLogin} className="h-11 px-5 rounded-xl bg-[#FFC300] text-black font-black text-sm">Увійти</button>
    </div>
  );

  if (to) {
    if (thread === undefined) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#FFC300]" size={40} /></div>;
    if (!thread) return <p className="text-zinc-400 py-10 text-center">Не вдалося відкрити розмову.</p>;
    const send = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!text.trim()) return;
      setBusy(true); setErr('');
      try { await sendMessage(to, text); setText(''); await load(); } catch (x: any) { setErr(x?.message?.includes('Забагато') ? x.message : 'Не вдалося надіслати. Спробуйте ще раз.'); }
      setBusy(false);
    };
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <a href={messagesPath()} onClick={linkClick(messagesPath())} className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white" aria-label="Усі розмови"><ArrowLeft size={18} /></a>
          <PersonLink p={thread.with} sub="профіль" />
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 space-y-2 min-h-[240px] max-h-[60vh] overflow-y-auto">
          {!thread.messages.length && <p className="text-sm text-zinc-500 text-center py-8">Напишіть перше повідомлення.</p>}
          {thread.messages.map(m => (
            <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-line break-words ${m.mine ? 'bg-[#FFC300] text-black rounded-br-md' : 'bg-zinc-800 text-zinc-100 rounded-bl-md'}`}>
                {m.body}
                <span className={`block text-[10px] mt-1 ${m.mine ? 'text-black/60' : 'text-zinc-500'}`}>
                  {new Date(m.at).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{m.mine ? (m.read ? ' · прочитано' : ' · надіслано') : ''}
                </span>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} className="flex gap-2 items-end">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={2} maxLength={4000} placeholder="Повідомлення" aria-label="Повідомлення"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 768) { e.preventDefault(); send(e as any); } }}
            className={`${input} resize-none`} />
          <button type="submit" disabled={busy || !text.trim()} className={`${btn} h-12 bg-[#FFC300] text-black shrink-0`} aria-label="Надіслати">{busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}</button>
        </form>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <p className="text-[11px] text-zinc-500">Особисті повідомлення бачите лише ви і співрозмовник. Лайка автоматично ховається.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-2xl md:text-3xl font-black uppercase flex items-center gap-2"><MessageCircle className="text-[#FFC300]" /> Повідомлення</h1>
      {!inbox ? <Loader2 className="animate-spin text-[#FFC300]" /> : !inbox.length ? (
        <p className="text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm">Розмов поки немає. Відкрийте профіль учасника (натисніть на ім'я біля повідомлення на форумі) і натисніть «Написати».</p>
      ) : (
        <ul className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800 overflow-hidden">
          {inbox.map(r => (
            <li key={r.pid}>
              <a href={messagesPath(r.pid)} onClick={linkClick(messagesPath(r.pid))} className={`flex items-center gap-3 px-3 py-3 hover:bg-zinc-800/60 ${r.unread ? 'bg-[#FFC300]/5' : ''}`}>
                <Avatar name={r.name} avatar={r.avatar} size={44} />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2"><b className="text-white truncate">{r.name}</b><span className="text-[11px] text-zinc-500 ml-auto shrink-0">{new Date(r.at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}</span></span>
                  <span className={`block text-sm truncate ${r.unread ? 'text-white font-bold' : 'text-zinc-400'}`}>{r.from_me ? 'Ви: ' : ''}{r.last}</span>
                </span>
                {r.unread > 0 && <span className="min-w-6 h-6 px-1.5 rounded-full bg-[#FFC300] text-black text-xs font-black flex items-center justify-center">{r.unread}</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
