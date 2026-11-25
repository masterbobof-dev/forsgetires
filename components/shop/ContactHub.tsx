import React, { useState } from 'react';
import { Phone, X, MessageCircle, Send } from 'lucide-react';
import { TELEGRAM_LINK, VIBER_LINK } from '../../constants';

/** Floating contact button in the corner: Viber / Telegram / call. */
const ContactHub: React.FC<{ shopPhone: string; shopPhoneLink: string }> = ({ shopPhone, shopPhoneLink }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && <div className="fixed inset-0 z-[159] bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={() => setOpen(false)} />}
      <div className="fixed right-4 md:right-6 z-[160] flex flex-col items-end gap-2.5 pointer-events-none" style={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)" }}>
          <div className={`flex flex-col items-end gap-2.5 transition-all duration-300 origin-bottom-right ${open ? 'scale-100 opacity-100 translate-y-0 pointer-events-auto' : 'scale-75 opacity-0 translate-y-6 pointer-events-none'}`}>
              {[
                { href: VIBER_LINK, label: 'Viber', cls: 'bg-[#7360F2] text-white', icon: <MessageCircle size={22} /> },
                { href: TELEGRAM_LINK, label: 'Telegram', cls: 'bg-[#0088cc] text-white', icon: <Send size={22} />, external: true },
                { href: shopPhoneLink, label: `Подзвонити ${shopPhone}`, cls: 'bg-[#FFC300] text-black', icon: <Phone size={22} strokeWidth={2.5} /> },
              ].map(item => (
                <a key={item.label} href={item.href} {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} onClick={() => setOpen(false)} className="flex items-center gap-2.5">
                  <span className="bg-black/90 border border-zinc-800 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-2xl whitespace-nowrap">{item.label}</span>
                  <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl active:scale-95 transition-transform ${item.cls}`}>{item.icon}</span>
                </a>
              ))}
          </div>

          <button 
            onClick={() => setOpen(!open)}
            className={`h-14 rounded-2xl flex items-center justify-center gap-2 shadow-2xl transition-all duration-300 pointer-events-auto active:scale-95 ${open ? 'w-14 bg-zinc-800 text-white' : 'w-14 md:w-auto md:px-5 bg-[#FFC300] text-black shadow-yellow-900/50'}`}
            aria-label={open ? 'Закрити' : "Зв'язатися з нами"} aria-expanded={open}
          >
            {open ? <X size={26} /> : <><MessageCircle size={26} strokeWidth={2.5} /><span className="hidden md:inline font-black text-sm uppercase">Зв'язатися</span></>}
          </button>
      </div>
    </>
  );
};

export default ContactHub;
