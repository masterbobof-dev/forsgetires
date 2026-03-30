import React, { useState, useEffect } from 'react';
import Logo from './Logo';
import { ViewState } from '../types';
import { Menu, X, Phone, Lock, ShoppingBag } from 'lucide-react';
import { PHONE_NUMBER_1, PHONE_NUMBER_2, PHONE_LINK_1, PHONE_LINK_2 } from '../constants';
import { supabase } from '../supabaseClient';

interface HeaderProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onAdminClick?: () => void;
  cartCount?: number;
}

const Header: React.FC<HeaderProps> = ({ currentView, onChangeView, onAdminClick, cartCount = 0 }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [phones, setPhones] = useState({
    p1: PHONE_NUMBER_1,
    p2: PHONE_NUMBER_2,
    link1: PHONE_LINK_1,
    link2: PHONE_LINK_2,
  });

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setIsMenuOpen(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchContacts = async () => {
      const { data } = await supabase.from('settings').select('key, value').in('key', ['contact_phone1', 'contact_phone2']);
      if (data) {
        const newPhones = { ...phones };
        data.forEach(r => {
          const digits = r.value.replace(/[^\d]/g, '');
          const link = digits.startsWith('0') && digits.length === 10
            ? `+38${digits}`
            : digits.startsWith('380') ? `+${digits}` : digits;
          if (r.key === 'contact_phone1') { newPhones.p1 = r.value; newPhones.link1 = `tel:${link}`; }
          if (r.key === 'contact_phone2') { newPhones.p2 = r.value; newPhones.link2 = `tel:${link}`; }
        });
        setPhones(newPhones);
      }
    };
    fetchContacts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navItems: { label: string; view: ViewState }[] = [
    { label: 'Каталог Шини', view: 'home' },
    { label: 'Послуги СТО', view: 'service' },
    { label: 'Ціни', view: 'prices' },
    { label: 'Фотогалерея', view: 'gallery' },
  ];

  const handleNavClick = (view: ViewState) => {
    onChangeView(view);
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-black/90 backdrop-blur-md border-b border-white/10 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">

        {/* Logo & Brand */}
        <button
          type="button"
          onClick={() => handleNavClick('home')}
          className="flex items-center gap-3 md:gap-4 text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC300] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          aria-label="На головну"
        >
          <Logo />
          <span className="flex flex-col group">
            <span className="font-black text-2xl md:text-3xl tracking-wide text-white italic -skew-x-12 group-hover:text-[#FFC300] transition-colors">
              ФОРСАЖ
            </span>
            <span className="text-[10px] md:text-xs text-zinc-400 font-bold uppercase tracking-[0.2em] leading-none ml-1">
              Шиномонтаж
            </span>
          </span>
        </button>

        {/* Right Side */}
        <div className="flex items-center gap-6">

          {/* Phones — desktop */}
          <div className="hidden lg:flex flex-col items-end gap-0.5 border-r border-zinc-800 pr-6 mr-2">
            <a href={phones.link1} className="flex items-center gap-2 text-[#FFC300] font-bold text-sm hover:text-[#e6b000] transition-colors group">
              <Phone size={14} className="group-hover:animate-bounce" />
              {phones.p1}
            </a>
            <a href={phones.link2} className="flex items-center gap-2 text-zinc-400 font-bold text-sm hover:text-white transition-colors">
              <Phone size={14} />
              {phones.p2}
            </a>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={() => onAdminClick?.()}
              className="text-zinc-600 hover:text-[#FFC300] transition-colors p-2 rounded-full hover:bg-zinc-800/50"
              title="Вхід для персоналу"
            >
              <Lock size={18} />
            </button>

            {navItems.map((item) => (
              <button
                key={item.view}
                onClick={() => handleNavClick(item.view)}
                className={`relative text-sm lg:text-base font-bold uppercase tracking-wide transition-colors hover:text-[#FFC300] flex items-center gap-1.5 ${
                  currentView === item.view ? 'text-[#FFC300]' : 'text-zinc-300'
                }`}
              >
                {/* Active underline indicator */}
                {currentView === item.view && (
                  <span className="absolute -bottom-[18px] left-0 right-0 h-[2px] bg-[#FFC300] rounded-full animate-in fade-in duration-300" />
                )}

                {/* Cart badge on Шини */}
                {item.view === 'home' ? (
                  <span className="relative">
                    <ShoppingBag size={16} className="-mt-0.5" />
                    {cartCount > 0 && (
                      <span key={cartCount} className="absolute -top-2 -right-2 min-w-[16px] h-4 px-0.5 bg-[#FFC300] text-black text-[9px] font-black rounded-full flex items-center justify-center animate-in zoom-in duration-200">
                        {cartCount > 99 ? '99+' : cartCount}
                      </span>
                    )}
                  </span>
                ) : null}
                {item.label}
              </button>
            ))}
          </nav>

          {/* Mobile Controls */}
          <div className="flex items-center gap-2 md:hidden">
            {/* Cart badge — mobile */}
            <button
              onClick={() => handleNavClick('home')}
              className="relative w-9 h-9 flex items-center justify-center text-zinc-300 hover:text-[#FFC300] transition-colors"
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span key={`mob-${cartCount}`} className="absolute top-0 right-0 min-w-[16px] h-4 px-0.5 bg-[#FFC300] text-black text-[9px] font-black rounded-full flex items-center justify-center animate-in zoom-in duration-200">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>

            <a
              href={phones.link1}
              className="w-9 h-9 flex items-center justify-center bg-[#FFC300] rounded-full text-black active:scale-90 transition-transform shadow-lg shadow-yellow-900/20"
            >
              <Phone size={16} />
            </a>

            <button
              className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 hover:border-[#FFC300] text-white px-3 py-2 rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all group"
              onClick={() => setIsMenuOpen(prev => !prev)}
              aria-label="Відкрити меню"
            >
              <span className="text-[#FFC300] group-hover:text-white transition-colors">
                {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </span>
              <span>Меню</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-zinc-900 border-b border-white/10 shadow-2xl animate-in slide-in-from-top-2 duration-200">
          <div className="bg-black/50 p-4 border-b border-white/5 flex flex-col items-center gap-3">
            <a href={phones.link1} className="flex items-center gap-2 text-[#FFC300] font-bold text-lg">
              <Phone size={18} /> {phones.p1}
            </a>
            <a href={phones.link2} className="flex items-center gap-2 text-white font-bold text-lg">
              <Phone size={18} /> {phones.p2}
            </a>
          </div>

          <nav className="flex flex-col p-4 gap-1">
            <button
              onClick={() => { onAdminClick?.(); setIsMenuOpen(false); }}
              className="text-xl font-bold uppercase italic tracking-wider text-left py-3 border-b border-white/5 text-zinc-500 hover:text-[#FFC300] flex items-center gap-2 transition-colors"
            >
              <Lock size={18} /> Персонал
            </button>

            {navItems.map((item) => (
              <button
                key={item.view}
                onClick={() => handleNavClick(item.view)}
                className={`text-xl font-black uppercase italic tracking-wider text-left py-3 border-b border-white/5 flex items-center gap-2 transition-colors ${
                  currentView === item.view
                    ? 'text-[#FFC300]'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                {/* Cart badge in mobile menu */}
                {item.view === 'home' ? (
                  <span className="relative">
                    <ShoppingBag size={20} />
                    {cartCount > 0 && (
                      <span key={`mmob-${cartCount}`} className="absolute -top-2 -right-2 min-w-[16px] h-4 px-0.5 bg-[#FFC300] text-black text-[9px] font-black rounded-full flex items-center justify-center animate-in zoom-in duration-200">
                        {cartCount > 99 ? '99+' : cartCount}
                      </span>
                    )}
                  </span>
                ) : null}
                {item.label}
                {/* Active dot indicator */}
                {currentView === item.view && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-[#FFC300]" />
                )}
              </button>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
