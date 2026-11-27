import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X, Check, ChevronLeft, Pin, Lock, Unlock, EyeOff, Eye, Trash2, MoreHorizontal, Clipboard } from 'lucide-react';
import { uploadForumImage, updateTopic, deleteTopic, type ForumSection, type ForumTopic } from '../../forum';
import { SectionSelect } from './forumParts';

/** Image files from a paste (Ctrl+V, or «Вставити» on the phone). */
export const pastedImages = (e: ClipboardEvent | React.ClipboardEvent): File[] =>
  Array.from(e.clipboardData?.items || []).filter(i => i.kind === 'file' && i.type.startsWith('image/')).map(i => i.getAsFile()).filter((f): f is File => !!f);

const MAX_PHOTOS = 12;

/**
 * A topic edited right where it is shown (for the shop and forum moderators): the title and the text are fields
 * that save by themselves a moment after typing stops; photos are added (button or paste from the clipboard)
 * and removed at once. Pin / close / hide / delete are hidden under «Ще», so nothing is pressed by accident.
 */
const LiveTopic: React.FC<{
  topic: ForumTopic; sections: ForumSection[]; userId: string;
  onChanged: (t: ForumTopic) => void; onDeleted: () => void;
  /** the editor is the only one on the page: a paste anywhere (outside other fields) adds photos to it */
  pasteAnywhere?: boolean;
}> = ({ topic, sections, userId, onChanged, onDeleted, pasteAnywhere }) => {
  const [title, setTitle] = useState(topic.title);
  const [body, setBody] = useState(topic.body);
  const [images, setImages] = useState<string[]>(topic.images || []);
  const [state, setState] = useState<'' | 'saving' | 'saved' | 'error'>('');
  const [hint, setHint] = useState('');
  const [uploading, setUploading] = useState(0);
  const [more, setMore] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const latest = useRef(topic);
  latest.current = { ...topic, title, body, images };

  // another topic opened in the same place
  useEffect(() => { setTitle(topic.title); setBody(topic.body); setImages(topic.images || []); setState(''); }, [topic.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // the text field grows with the text
  useEffect(() => { const el = bodyRef.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; } }, [body]);
  useEffect(() => { const el = titleRef.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; } }, [title]);

  const save = async (patch: Partial<ForumTopic>) => {
    setState('saving');
    try { await updateTopic(topic.id, patch as any); setState('saved'); onChanged({ ...latest.current, ...patch }); }
    catch { setState('error'); }
  };

  // title and text: saved 1.2 s after typing stops
  useEffect(() => {
    if (title === topic.title && body === topic.body) return;
    if (title.trim().length < 5) { setHint('Заголовок — хоча б 5 літер'); return; }
    if (body.trim().length < 10) { setHint('Текст — хоча б 10 літер'); return; }
    setHint('');
    const t = setTimeout(() => save({ title: title.trim(), body: body.trim() }), 1200);
    return () => clearTimeout(t);
  }, [title, body]); // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = async (files: File[]) => {
    const room = MAX_PHOTOS - latest.current.images.length;
    if (!files.length) return;
    if (room <= 0) { setHint(`Не більше ${MAX_PHOTOS} фото`); return; }
    setUploading(n => n + Math.min(files.length, room));
    for (const f of files.slice(0, room)) {
      try {
        const url = await uploadForumImage(f, userId);
        const next = [...latest.current.images, url];
        setImages(next); latest.current.images = next;
        await save({ images: next });
      } catch { setState('error'); }
      setUploading(n => n - 1);
    }
  };
  // the first photo is the cover of the topic: move a photo one place to the left
  const movePhoto = (i: number) => {
    if (i <= 0) return;
    const next = [...images]; [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setImages(next); latest.current.images = next; save({ images: next });
  };
  const removePhoto = (u: string) => {
    if (!confirm('Прибрати це фото з теми?')) return;
    const next = images.filter(x => x !== u);
    setImages(next); save({ images: next });
  };

  // paste a picture from the clipboard
  useEffect(() => {
    if (!pasteAnywhere) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = pastedImages(e);
      if (!files.length) return;
      // a paste into a reply form belongs to that reply
      const t = e.target as HTMLElement | null;
      if (t?.closest('form')) return;
      e.preventDefault();
      addFiles(files);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const flag = (patch: Partial<ForumTopic>, ask?: string) => { if (ask && !confirm(ask)) return; setMore(false); save(patch); };

  return (
    <div className="bg-zinc-900 border border-[#FFC300]/30 rounded-2xl p-4 md:p-6" onPaste={pasteAnywhere ? undefined : (e) => { const f = pastedImages(e); if (f.length) { e.preventDefault(); addFiles(f); } }}>
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase text-zinc-500 mb-2">
        <span className="text-[#FFC300] normal-case">✏️ Правка на місці: змінюйте текст — зберігається само</span>
        {topic.is_pinned && <span className="flex items-center gap-1 text-[#FFC300]"><Pin size={12} /> закріплено</span>}
        {topic.is_locked && <span className="flex items-center gap-1"><Lock size={12} /> закрито</span>}
        {topic.is_hidden && <span className="flex items-center gap-1 text-red-400"><EyeOff size={12} /> приховано</span>}
        <span className="ml-auto normal-case flex items-center gap-1" aria-live="polite">
          {state === 'saving' && <><Loader2 size={12} className="animate-spin" /> зберігаю…</>}
          {state === 'saved' && <span className="text-emerald-400 flex items-center gap-1"><Check size={12} /> збережено</span>}
          {state === 'error' && <span className="text-red-400">не збереглося — перевірте інтернет</span>}
        </span>
      </div>

      <textarea ref={titleRef} value={title} rows={1} onChange={e => setTitle(e.target.value.replace(/\n/g, ' '))} maxLength={150} aria-label="Заголовок теми"
        className="w-full bg-transparent text-xl md:text-3xl font-black text-white mb-3 rounded-lg px-1 -mx-1 border border-transparent hover:border-zinc-700 focus:border-[#FFC300] outline-none resize-none overflow-hidden leading-tight" />
      <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)} maxLength={10000} aria-label="Текст теми" rows={4}
        className="w-full bg-transparent text-zinc-300 leading-relaxed rounded-lg p-1 -m-1 border border-transparent hover:border-zinc-700 focus:border-[#FFC300] outline-none resize-none overflow-hidden" />
      {hint && <p className="text-xs text-orange-400 mt-1">{hint}</p>}

      {/* photos: remove with ×, add with the tile or paste */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4">
        {images.map((u, i) => (
          <span key={u} className="relative aspect-square rounded-xl overflow-hidden border border-zinc-700 bg-black">
            <img src={u} alt="" className="w-full h-full object-cover" />
            {i === 0
              ? <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-[#FFC300] text-black text-[10px] font-black">обкладинка</span>
              : <button type="button" onClick={() => movePhoto(i)} aria-label="Перемістити фото ліворуч" title="Ближче до початку (перше фото — обкладинка)"
                  className="absolute bottom-1 left-1 w-7 h-7 rounded-full bg-black/75 text-white flex items-center justify-center"><ChevronLeft size={16} /></button>}
            <button type="button" onClick={() => removePhoto(u)} aria-label="Прибрати фото"
              className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/75 text-white flex items-center justify-center"><X size={15} /></button>
          </span>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <span key={`u${i}`} className="aspect-square rounded-xl border border-zinc-700 flex items-center justify-center"><Loader2 className="animate-spin text-[#FFC300]" /></span>
        ))}
        {images.length + uploading < MAX_PHOTOS && (
          <button type="button" onClick={() => fileRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-zinc-700 text-zinc-400 hover:border-[#FFC300] hover:text-[#FFC300] flex flex-col items-center justify-center gap-1 text-xs font-bold">
            <ImagePlus size={22} /> Додати фото
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
      <p className="text-[11px] text-zinc-500 mt-2 flex items-center gap-1"><Clipboard size={12} /> Фото можна вставити з буфера: скопіюйте картинку і натисніть Ctrl+V (на телефоні — «Вставити» в полі тексту).</p>

      <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-zinc-800">
        <SectionSelect sections={sections} value={topic.category} onChange={slug => flag({ category: slug })}
          className="h-10 bg-black border border-zinc-700 rounded-lg px-2 text-xs text-zinc-300 font-bold max-w-[220px]" />
        <div className="relative ml-auto">
          <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="h-10 px-3 rounded-lg border border-zinc-700 text-zinc-300 text-xs font-bold flex items-center gap-1.5">
            <MoreHorizontal size={16} /> Ще
          </button>
          {more && (
            <div className="absolute right-0 bottom-12 z-20 w-56 bg-zinc-950 border border-zinc-700 rounded-xl shadow-2xl p-1">
              <button onClick={() => flag({ is_pinned: !topic.is_pinned })} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-zinc-200 hover:bg-zinc-800"><Pin size={15} /> {topic.is_pinned ? 'Відкріпити' : 'Закріпити вгорі'}</button>
              <button onClick={() => flag({ is_locked: !topic.is_locked })} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-zinc-200 hover:bg-zinc-800">{topic.is_locked ? <Unlock size={15} /> : <Lock size={15} />} {topic.is_locked ? 'Відкрити для відповідей' : 'Закрити для відповідей'}</button>
              <button onClick={() => flag({ is_hidden: !topic.is_hidden }, topic.is_hidden ? undefined : 'Сховати тему від відвідувачів?')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-zinc-200 hover:bg-zinc-800">{topic.is_hidden ? <Eye size={15} /> : <EyeOff size={15} />} {topic.is_hidden ? 'Показати всім' : 'Сховати'}</button>
              <button onClick={async () => { if (!confirm('Видалити тему разом з усіма відповідями? Повернути не можна.')) return; setMore(false); try { await deleteTopic(topic.id); onDeleted(); } catch { setState('error'); } }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-950/40"><Trash2 size={15} /> Видалити тему</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveTopic;
