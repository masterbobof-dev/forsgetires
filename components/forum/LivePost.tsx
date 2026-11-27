import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X, Check, ChevronLeft, EyeOff, Eye, Trash2, MoreHorizontal } from 'lucide-react';
import { uploadForumImage, updatePost, deletePost, type ForumPost } from '../../forum';
import { Author } from './forumParts';
import { pastedImages } from './LiveTopic';

const MAX_PHOTOS = 6;

/**
 * A reply edited right where it is shown (for the shop and forum moderators): the text saves by itself a moment after
 * typing stops; photos are added (button or paste while the reply is in focus), moved and removed at once.
 * Hide and delete are under «Ще» and ask first.
 */
const LivePost: React.FC<{
  post: ForumPost; userId: string; onChanged: (p: ForumPost) => void; onDeleted: () => void;
  replyTo?: string | null; actions?: React.ReactNode;
}> = ({ post, userId, onChanged, onDeleted, replyTo, actions }) => {
  const [body, setBody] = useState(post.body);
  const [images, setImages] = useState<string[]>(post.images || []);
  const [state, setState] = useState<'' | 'saving' | 'saved' | 'error'>('');
  const [uploading, setUploading] = useState(0);
  const [more, setMore] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const latest = useRef(post);
  latest.current = { ...post, body, images };

  useEffect(() => { setBody(post.body); setImages(post.images || []); setState(''); }, [post.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const el = bodyRef.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; } }, [body]);

  const save = async (patch: Partial<ForumPost>) => {
    setState('saving');
    try { await updatePost(post.id, patch as any); setState('saved'); onChanged({ ...latest.current, ...patch }); }
    catch { setState('error'); }
  };
  useEffect(() => {
    if (body === post.body || body.trim().length < 2) return;
    const t = setTimeout(() => save({ body: body.trim() }), 1200);
    return () => clearTimeout(t);
  }, [body]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPhotos = (next: string[]) => { setImages(next); latest.current.images = next; save({ images: next }); };
  const addFiles = async (files: File[]) => {
    const room = MAX_PHOTOS - latest.current.images.length;
    if (!files.length || room <= 0) return;
    setUploading(n => n + Math.min(files.length, room));
    for (const f of files.slice(0, room)) {
      try { const url = await uploadForumImage(f, userId); setPhotos([...latest.current.images, url]); } catch { setState('error'); }
      setUploading(n => n - 1);
    }
  };

  return (
    <div id={`post-${post.id}`} onPaste={(e) => { const f = pastedImages(e); if (f.length) { e.preventDefault(); addFiles(f); } }}
      className={`border rounded-2xl p-4 ${post.is_shop ? 'bg-[#FFC300]/5 border-[#FFC300]/30' : 'bg-zinc-900/60 border-zinc-800'} ${post.is_hidden ? 'opacity-60' : ''}`}>
      {replyTo && <p className="text-[11px] text-zinc-500 mb-1">↳ у відповідь {replyTo}</p>}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0"><Author name={post.author_name} shop={post.is_shop} date={post.created_at} edited={post.edited_at} avatar={post.author_avatar} pid={post.author_pid} /></div>
        <span className="text-[11px] shrink-0 pt-1" aria-live="polite">
          {post.is_hidden && <span className="text-red-400 font-bold mr-2">приховано</span>}
          {state === 'saving' && <Loader2 size={12} className="inline animate-spin text-zinc-400" />}
          {state === 'saved' && <span className="text-emerald-400 inline-flex items-center gap-1"><Check size={12} /> збережено</span>}
          {state === 'error' && <span className="text-red-400">не збереглося</span>}
        </span>
      </div>
      <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)} maxLength={5000} rows={2} aria-label="Текст відповіді"
        className="mt-2 w-full bg-transparent text-zinc-300 leading-relaxed rounded-lg p-1 -m-1 border border-transparent hover:border-zinc-700 focus:border-[#FFC300] outline-none resize-none overflow-hidden" />
      {(images.length > 0 || uploading > 0) && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
          {images.map((u, i) => (
            <span key={u} className="relative aspect-square rounded-lg overflow-hidden border border-zinc-700 bg-black">
              <img src={u} alt="" className="w-full h-full object-cover" />
              {i > 0 && <button type="button" onClick={() => { const n = [...images]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setPhotos(n); }} aria-label="Перемістити фото ліворуч"
                className="absolute bottom-1 left-1 w-6 h-6 rounded-full bg-black/75 text-white flex items-center justify-center"><ChevronLeft size={14} /></button>}
              <button type="button" onClick={() => { if (confirm('Прибрати це фото?')) setPhotos(images.filter(x => x !== u)); }} aria-label="Прибрати фото"
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/75 text-white flex items-center justify-center"><X size={13} /></button>
            </span>
          ))}
          {Array.from({ length: uploading }).map((_, i) => <span key={`u${i}`} className="aspect-square rounded-lg border border-zinc-700 flex items-center justify-center"><Loader2 className="animate-spin text-[#FFC300]" size={18} /></span>)}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {actions}
        {images.length + uploading < MAX_PHOTOS && (
          <button type="button" onClick={() => fileRef.current?.click()} className="h-9 px-3 rounded-lg border border-zinc-700 text-zinc-300 text-xs font-bold flex items-center gap-1.5"><ImagePlus size={14} /> Фото</button>
        )}
        <div className="relative ml-auto">
          <button type="button" onClick={() => setMore(!more)} aria-expanded={more} aria-label="Ще дії з відповіддю" className="h-9 px-3 rounded-lg border border-zinc-700 text-zinc-300 text-xs font-bold flex items-center gap-1.5"><MoreHorizontal size={14} /> Ще</button>
          {more && (
            <div className="absolute right-0 bottom-11 z-20 w-48 bg-zinc-950 border border-zinc-700 rounded-xl shadow-2xl p-1">
              <button onClick={() => { if (!post.is_hidden && !confirm('Сховати цю відповідь від відвідувачів?')) return; setMore(false); save({ is_hidden: !post.is_hidden }); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-zinc-200 hover:bg-zinc-800">{post.is_hidden ? <Eye size={15} /> : <EyeOff size={15} />} {post.is_hidden ? 'Показати всім' : 'Сховати'}</button>
              <button onClick={async () => { if (!confirm('Видалити цю відповідь?')) return; setMore(false); try { await deletePost(post.id); onDeleted(); } catch { setState('error'); } }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-950/40"><Trash2 size={15} /> Видалити</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LivePost;
