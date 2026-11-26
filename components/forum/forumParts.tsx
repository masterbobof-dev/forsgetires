import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X, Send, Store, Camera } from 'lucide-react';
import { uploadForumImage, rootSections, childSections, AVATAR_ICONS, uploadAvatar, saveMyAvatar, fetchMyAvatar, userPath, type ForumSection } from '../../forum';
import { linkClick } from '../../navigation';

export const when = (iso: string) => new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
export const whenShort = (iso: string) => new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });

/** Text of a message: paragraphs and line breaks, links are not clickable (no spam). */
export const Body: React.FC<{ text: string }> = ({ text }) => (
  <div className="space-y-3 text-zinc-300 leading-relaxed">
    {text.replace(/\r/g, '').split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line break-words">{p}</p>)}
  </div>
);

export const Photos: React.FC<{ urls: string[] }> = ({ urls }) => urls.length ? (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
    {urls.map(u => (
      <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800">
        <img src={u} alt="Фото до повідомлення" loading="lazy" className="w-full h-full object-cover" />
      </a>
    ))}
  </div>
) : null;

const AVATAR_COLORS = ['bg-sky-600', 'bg-emerald-600', 'bg-violet-600', 'bg-rose-600', 'bg-amber-600', 'bg-teal-600', 'bg-indigo-600', 'bg-pink-600'];
/** Round picture of an author: the shop's logo, a chosen icon, an own photo, or the first letter of the name. */
export const Avatar: React.FC<{ name: string; avatar?: string | null; shop?: boolean; size?: number }> = ({ name, avatar, shop, size = 36 }) => {
  const style = { width: size, height: size, fontSize: size * 0.5 };
  if (shop) return <span style={style} className="shrink-0 rounded-full bg-[#FFC300] text-black font-black flex items-center justify-center" aria-hidden>F</span>;
  if (avatar?.startsWith('emoji:')) return <span style={style} className="shrink-0 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center leading-none" aria-hidden>{avatar.slice(6)}</span>;
  if (avatar?.startsWith('https://')) return <img src={avatar} alt="" style={style} className="shrink-0 rounded-full object-cover border border-zinc-700" loading="lazy" />;
  const n = name || '?';
  const color = AVATAR_COLORS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return <span style={{ ...style, fontSize: size * 0.42 }} className={`shrink-0 rounded-full ${color} text-white font-black flex items-center justify-center`} aria-hidden>{(n.trim()[0] || '?').toUpperCase()}</span>;
};

export const Author: React.FC<{ name: string; shop: boolean; date: string; edited?: string | null; avatar?: string | null; pid?: number | null }> = ({ name, shop, date, edited, avatar, pid }) => (
  <div className="flex items-center gap-2.5">
    {pid && !shop ? <a href={userPath(pid)} onClick={linkClick(userPath(pid))} aria-label={`Профіль: ${name}`}><Avatar name={name} avatar={avatar} shop={shop} /></a> : <Avatar name={name} avatar={avatar} shop={shop} />}
    <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500 min-w-0">
      {pid && !shop
        ? <a href={userPath(pid)} onClick={linkClick(userPath(pid))} className="font-bold text-zinc-200 hover:text-[#FFC300] underline-offset-2 hover:underline">{name}</a>
        : <span className={`font-bold flex items-center gap-1 ${shop ? 'text-[#FFC300]' : 'text-zinc-200'}`}>{shop && <Store size={13} />}{name}</span>}
      <span>· опубліковано {when(date)}</span>
      {edited && <span className="italic">· оновлено {when(edited)}</span>}
    </div>
  </div>
);

/** Choose a fun icon or put an own photo; saved in the person's profile and shown on all their forum messages. */
export const AvatarPicker: React.FC<{ userId: string; name: string; onSaved?: (a: string | null) => void }> = ({ userId, name, onSaved }) => {
  const [current, setCurrent] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { fetchMyAvatar(userId).then(setCurrent, () => undefined); }, [userId]);
  const save = async (a: string | null) => {
    setBusy(true); setError('');
    try { await saveMyAvatar(userId, a); setCurrent(a); onSaved?.(a); setOpen(false); } catch { setError('Не вдалося зберегти. Спробуйте ще раз.'); }
    setBusy(false);
  };
  const photo = async (f?: File) => {
    if (!f) return;
    setBusy(true); setError('');
    try { await save(await uploadAvatar(f, userId)); } catch { setError('Не вдалося завантажити фото. Спробуйте інше (JPG або PNG).'); setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar name={name} avatar={current} size={52} />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpen(!open)} className="h-9 px-3 rounded-lg border border-zinc-700 text-zinc-200 text-xs font-bold hover:border-[#FFC300]">Обрати значок</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { photo(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="h-9 px-3 rounded-lg border border-zinc-700 text-zinc-200 text-xs font-bold hover:border-[#FFC300] flex items-center gap-1.5 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} Своє фото
          </button>
          {current && <button type="button" disabled={busy} onClick={() => save(null)} className="h-9 px-3 rounded-lg text-zinc-500 text-xs font-bold hover:text-white">Прибрати</button>}
        </div>
      </div>
      {open && (
        <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
          {AVATAR_ICONS.map(e => (
            <button key={e} type="button" disabled={busy} onClick={() => save(`emoji:${e}`)} aria-label={`Значок ${e}`}
              className={`aspect-square rounded-full text-2xl flex items-center justify-center border ${current === `emoji:${e}` ? 'border-[#FFC300] bg-[#FFC300]/10' : 'border-zinc-700 bg-zinc-800 hover:border-zinc-500'}`}>{e}</button>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
};

/** Choose a section: subsections are grouped under their section. */
export const SectionSelect: React.FC<{ sections: ForumSection[]; value: string; onChange: (slug: string) => void; className?: string }> = ({ sections, value, onChange, className }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    className={className || 'w-full h-12 bg-black border border-zinc-700 rounded-xl px-3 text-white font-bold outline-none focus:border-[#FFC300]'}>
    {rootSections(sections).map(r => (
      <optgroup key={r.id} label={r.name}>
        <option value={r.slug}>{r.name} — загальне</option>
        {childSections(sections, r.id).map(k => <option key={k.id} value={k.slug}>{k.name}</option>)}
      </optgroup>
    ))}
  </select>
);

/** Photos of a message: add (up to 6, shrunk on the phone before upload) and remove. */
export const PhotoPicker: React.FC<{
  userId: string; images: string[]; onChange: (urls: string[]) => void; onBusy?: (b: boolean) => void; onError?: (m: string) => void; max?: number;
  /** filled with the "add these files" function, for photos pasted from the clipboard into the form */
  addRef?: React.MutableRefObject<((files: File[]) => void) | null>;
}> = ({ userId, images, onChange, onBusy, onError, max = 6, addRef }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const add = async (files: File[] | FileList | null) => {
    if (!files?.length) return;
    setBusy(true); onBusy?.(true);
    let list = images;
    try {
      for (const f of Array.from(files).slice(0, max - images.length)) {
        const url = await uploadForumImage(f, userId);
        list = [...list, url];
        onChange(list);
      }
    } catch { onError?.('Не вдалося завантажити фото. Спробуйте інше (JPG або PNG).'); }
    setBusy(false); onBusy?.(false);
  };
  if (addRef) addRef.current = (files) => { add(files); };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {images.map(u => (
        <span key={u} className="relative w-20 h-20 rounded-lg overflow-hidden border border-zinc-700">
          <img src={u} alt="" className="w-full h-full object-cover" />
          <button type="button" onClick={() => onChange(images.filter(x => x !== u))} aria-label="Прибрати фото"
            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center"><X size={14} /></button>
        </span>
      ))}
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { add(e.target.files); e.target.value = ''; }} />
      <button type="button" disabled={busy || images.length >= max} onClick={() => fileRef.current?.click()}
        className="h-11 px-4 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-bold flex items-center gap-2 disabled:opacity-40">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />} Фото {images.length ? `(${images.length}/${max})` : ''}
      </button>
    </div>
  );
};

export interface MessageValue { title: string; category: string; body: string; images: string[]; is_pinned?: boolean }

/** Form of a message: a topic (title + section + text + photos) or a reply (text + photos). For new and edited messages. */
export const MessageForm: React.FC<{
  userId: string; sections?: ForumSection[]; topic?: boolean; initial?: Partial<MessageValue>;
  submitLabel: string; onSubmit: (v: MessageValue) => Promise<void>; onCancel?: () => void; allowPin?: boolean;
}> = ({ userId, sections = [], topic, initial, submitLabel, onSubmit, onCancel, allowPin }) => {
  const [title, setTitle] = useState(initial?.title || '');
  const [category, setCategory] = useState(initial?.category || sections.find(s => s.parent_id)?.slug || sections[0]?.slug || 'inshe');
  const [body, setBody] = useState(initial?.body || '');
  const [images, setImages] = useState<string[]>(initial?.images || []);
  const [pinned, setPinned] = useState(!!initial?.is_pinned);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const addPhotos = useRef<((files: File[]) => void) | null>(null);
  // a picture pasted from the clipboard (Ctrl+V, «Вставити» on the phone) becomes a photo of the message
  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.items || []).filter(i => i.kind === 'file' && i.type.startsWith('image/')).map(i => i.getAsFile()).filter((f): f is File => !!f);
    if (files.length) { e.preventDefault(); addPhotos.current?.(files); }
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (topic && title.trim().length < 5) return setError('Напишіть заголовок (хоча б 5 літер).');
    if (body.trim().length < (topic ? 10 : 2)) return setError(topic ? 'Текст теми — хоча б 10 літер.' : 'Напишіть текст повідомлення.');
    setSending(true); setError('');
    try {
      await onSubmit({ title: title.trim(), category, body: body.trim(), images, is_pinned: pinned });
      if (!initial) { setTitle(''); setBody(''); setImages([]); }
    } catch (err: any) { setError(err?.message?.includes('Забагато') ? err.message : 'Не вдалося зберегти. Спробуйте ще раз.'); }
    setSending(false);
  };
  return (
    <form onSubmit={send} onPaste={onPaste} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-5 space-y-3">
      {topic && <>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={150} placeholder="Заголовок теми, напр. «Які шини взяти на Ланос?»"
          className="w-full h-12 bg-black border border-zinc-700 rounded-xl px-4 text-white font-bold outline-none focus:border-[#FFC300]" />
        {sections.length > 0 && <div><label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Розділ</label><SectionSelect sections={sections} value={category} onChange={setCategory} /></div>}
      </>}
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={topic ? 7 : 4} maxLength={topic ? 10000 : 5000}
        placeholder={topic ? 'Опишіть питання або поділіться порадою' : 'Ваша відповідь'}
        className="w-full bg-black border border-zinc-700 rounded-xl p-4 text-white outline-none focus:border-[#FFC300]" />
      <PhotoPicker userId={userId} images={images} onChange={setImages} onBusy={setPhotoBusy} onError={setError} addRef={addPhotos} />
      {allowPin && topic && (
        <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} className="accent-[#FFC300]" /> Закріпити вгорі розділу</label>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex items-center gap-2 justify-end">
        {onCancel && <button type="button" onClick={onCancel} className="h-11 px-4 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-bold">Скасувати</button>}
        <button type="submit" disabled={sending || photoBusy}
          className="h-11 px-5 rounded-xl bg-[#FFC300] text-black font-black text-sm flex items-center gap-2 disabled:opacity-50">
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {submitLabel}
        </button>
      </div>
    </form>
  );
};
