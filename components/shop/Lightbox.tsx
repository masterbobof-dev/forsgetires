import React, { useRef, useState } from 'react';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';

/** Which photos are open in the full-screen viewer. */
export const useLightbox = () => {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const show = (list: string[], at: number) => { setImages(list); setIndex(at); setOpen(true); };
  return { open, images, index, setIndex, show, close: () => setOpen(false) };
};

interface LightboxProps {
  images: string[];
  index: number;
  setIndex: React.Dispatch<React.SetStateAction<number>>;
  onClose: () => void;
}

/** Full-screen photo viewer: arrows on computers, swipe on phones, a click anywhere closes it. */
const Lightbox: React.FC<LightboxProps> = ({ images, index, setIndex, onClose }) => {
  const touch = useRef<number | null>(null);
  return (
    <div
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        const start = touch.current; touch.current = null;
        if (start === null || images.length < 2) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 50) { e.stopPropagation(); e.preventDefault(); setIndex(i => (i + (dx < 0 ? 1 : -1) + images.length) % images.length); }
      }}
    >
      <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full z-10" aria-label="Закрити"><X size={32}/></button>
      {images.length > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); setIndex(i => (i - 1 + images.length) % images.length); }} className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 text-white items-center justify-center hover:bg-white/20" aria-label="Попереднє фото"><ArrowLeft size={24} /></button>
          <button onClick={e => { e.stopPropagation(); setIndex(i => (i + 1) % images.length); }} className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 text-white items-center justify-center hover:bg-white/20" aria-label="Наступне фото"><ArrowRight size={24} /></button>
          <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-sm font-bold">{index + 1} / {images.length}</span>
        </>
      )}
      <img key={index} src={images[index]} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in fade-in duration-200" alt="" />
    </div>
  );
};

export default Lightbox;
