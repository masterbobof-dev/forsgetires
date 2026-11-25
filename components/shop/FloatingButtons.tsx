import React, { useState } from 'react';
import { ShoppingCart, Scale } from 'lucide-react';

/** "Порівняти (N)" in the bottom left corner. */
export const CompareButton: React.FC<{ count: number; onClick: () => void }> = ({ count, onClick }) => (
  <button
    onClick={onClick}
    className="fixed left-4 md:left-6 z-[150] flex items-center gap-2 bg-[#FFC300] text-black font-black text-xs uppercase tracking-wide pl-3 pr-4 py-3 rounded-2xl shadow-2xl shadow-yellow-900/30 hover:bg-white transition-colors animate-in slide-in-from-left-4 fade-in duration-300"
    style={{ bottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
  >
    <Scale size={18} /> Порівняти ({count})
  </button>
);

/** Cart button above the contact button; `count` = how many pieces are in the cart. */
export const CartButton: React.FC<{ count: number; onClick: () => void }> = ({ count, onClick }) => (
  <button
    onClick={onClick}
    className="fixed right-4 md:right-6 z-[155] bg-white text-black w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform animate-in zoom-in-50 duration-300"
    style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}
    aria-label="Відкрити кошик"
  >
    <ShoppingCart size={24} />
    <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[11px] font-bold min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full border-2 border-zinc-900">{count}</span>
  </button>
);

/** Short message at the bottom of the screen ("У кошику: …"). */
export const useToast = () => {
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const show = (message: string, ms = 2500) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), ms);
  };
  return { toast, show };
};

export const CartToast: React.FC<{ message: string }> = ({ message }) => (
  <div className="fixed bottom-[100px] left-1/2 -translate-x-1/2 z-[150] w-[90%] md:w-auto bg-black/90 backdrop-blur-md text-white px-2 py-2 md:px-6 md:py-3 rounded-2xl md:rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-between gap-3 animate-in slide-in-from-bottom-10 fade-in duration-300 border border-zinc-800">
     <div className="flex items-center gap-3 w-full overflow-hidden">
       <div className="bg-[#FFC300] p-2 rounded-xl shrink-0"><ShoppingCart size={16} className="text-black" /></div>
       <div className="flex flex-col flex-1 min-w-0">
         <span className="text-[11px] font-black uppercase tracking-widest text-[#FFC300]">У кошику</span>
         <span className="text-xs font-bold truncate">{message}</span>
       </div>
     </div>
  </div>
);
