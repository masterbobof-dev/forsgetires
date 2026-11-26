import React from 'react';
import { Loader2, Phone, X } from 'lucide-react';
import type { TyreProduct } from '../../types';
import { formatUaPhone } from '../../phone';

interface QuickOrderModalProps {
  product: TyreProduct;
  phone: string;
  setPhone: (v: string) => void;
  error: string;
  sending: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

/** "Купити в 1 клік" (or "Дізнатися ціну" for goods on order): the customer leaves a phone number. */
const QuickOrderModal: React.FC<QuickOrderModalProps> = ({ product, phone, setPhone, error, sending, onSubmit, onClose }) => (
  <div className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in zoom-in duration-300" onClick={onClose}>
    <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl w-full max-w-md shadow-2xl relative" onClick={e => e.stopPropagation()}>
      <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={24}/></button>
      <div className="flex flex-col items-center text-center gap-4">
        <div className="bg-[#FFC300]/10 p-4 rounded-full text-[#FFC300] mb-2">
          <Phone size={32} strokeWidth={2.5}/>
        </div>
        <h3 className="text-xl font-black text-white uppercase tracking-tight">{product.on_order ? "Дізнатися ціну" : "Купити в 1 клік"}</h3>
        <p className="text-zinc-500 text-sm">{product.on_order ? 'Залиште номер — менеджер зателефонує і скаже ціну та термін постачання.' : 'Введіть ваш номер телефону, і ми зателефонуємо вам для оформлення замовлення.'}</p>

        <div className="w-full mt-4">
          <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest mb-2 text-left">Ваш телефон</p>
          <input 
            type="tel" 
            placeholder="+380 __ ___ __ __" 
            value={phone}
            inputMode="tel" autoComplete="tel"
            onChange={e => setPhone(formatUaPhone(e.target.value))}
            className="w-full bg-black border border-zinc-800 rounded-xl py-4 px-6 text-white text-xl font-black focus:border-[#FFC300] outline-none transition-all placeholder:text-zinc-800"
          />
        </div>

        {error && <p className="text-red-500 text-xs font-bold bg-red-500/10 p-3 rounded-xl w-full">{error}</p>}

        <button 
          onClick={onSubmit}
          disabled={sending}
          className="w-full bg-[#FFC300] hover:bg-white text-black font-black py-5 rounded-2xl mt-4 transition-all active:scale-95 shadow-xl shadow-yellow-900/20 uppercase tracking-widest flex items-center justify-center gap-3"
        >
          {sending ? <Loader2 className="animate-spin" size={24}/> : "Замовити дзвінок"}
        </button>

        <p className="text-[10px] text-zinc-500 font-bold uppercase mt-4">Натискаючи кнопку, ви погоджуєтесь з <a href="/oferta" target="_blank" className="underline">офертою</a> та <a href="/privacy" target="_blank" className="underline">обробкою персональних даних</a>.</p>
      </div>
    </div>
  </div>
);

export default QuickOrderModal;
