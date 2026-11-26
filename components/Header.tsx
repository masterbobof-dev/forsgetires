import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { catPath } from '../api/_paths.js';
import Logo from './Logo';
import { ViewState } from '../types';
import { Menu, X, Phone, User, ShoppingCart, ChevronDown, LayoutGrid, MessagesSquare } from 'lucide-react';
import { useCategories, getRootCategories, getChildren, getCategoryIcon } from '../categories';
import { linkClick } from '../navigation';
import CatalogMenu from './CatalogMenu';
import { PHONE_NUMBER_1, PHONE_NUMBER_2, PHONE_LINK_1, PHONE_LINK_2 } from '../constants';
import { supabase } from '../supabaseClient';
import { settingsRows } from '../publicSettings';

interface HeaderProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onAccountClick?: () => void;
  isLoggedIn?: boolean;
  /** a staff member is signed in: the button leads to the admin panel */
  isStaff?: boolean;
  cartCount?: number;
  /** the "F" of the logo: the hidden way into the admin panel */
  onLogoAdmin?: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, onChangeView, onAccountClick, isLoggedIn = false, isStaff = false, cartCount = 0, onLogoAdmin }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [mobileCatalog, setMobileCatalog] = useState(false);
  // breadcrumb "Каталог" opens the full catalogue menu
  useEffect(() => {
    const open = () => { if (window.innerWidth < 768) return; setCatalogOpen(true); };
    window.addEventListener('open-catalog', open);
    return () => window.removeEventListener('open-catalog', open);
  }, []);
  const { categories } = useCategories();
  const roots = getRootCategories(categories);

  const goCategory = (slug: string) => (e: React.MouseEvent) => {
    setCatalogOpen(false);
    setIsMenuOpen(false);
    setMobileCatalog(false);
    linkClick(catPath(slug))(e);
  };
  const headerRef = useRef<HTMLElement>(null);

  // Expose the header height as a CSS variable so sticky bars sit right under it
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const openCart = () => {
    if (currentView !== 'home') onChangeView('home');
    // let the shop mount first when coming from another page
    setTimeout(() => window.dispatchEvent(new Event('forsage:open-cart')), currentView !== 'home' ? 300 : 0);
  };
  const [phones, setPhones] = useState({
    p1: PHONE_NUMBER_1,
    p2: PHONE_NUMBER_2,
    link1: PHONE_LINK_1,
    link2: PHONE_LINK_2,
  });

  // the phone menu closes when the page changes (also by the browser's back button)
  useEffect(() => {
    const close = () => setIsMenuOpen(false);
    window.addEventListener('popstate', close);
    return () => window.removeEventListener('popstate', close);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    // only a real width change (turning the phone); the address bar hiding on scroll changes just the height
    let w = window.innerWidth;
    const handleResize = () => { if (window.innerWidth !== w) { w = window.innerWidth; setIsMenuOpen(false); } };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchContacts = async () => {
      const { data } = await settingsRows(['contact_phone1', 'contact_phone2']);
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

  const infoLinks: [string, string][] = [
    ['/dostavka-i-oplata', 'Доставка і оплата'],
    ['/garantiya-i-povernennya', 'Гарантія і повернення'],
    ['/faq', 'Поширені питання'],
    ['/kontakty', 'Контакти'],
  ];

  const handleNavClick = (view: ViewState) => {
    onChangeView(view);
    setIsMenuOpen(false);
  };

  return (
    <header ref={headerRef} className="sticky top-0 z-50 w-full bg-black/90 backdrop-blur-md border-b border-white/10 shadow-lg">
      <div className="max-w-7xl mx-auto px-3 md:px-4 py-2 md:py-3 flex items-center justify-between gap-2">

        {/* Logo & Brand */}
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
        {/* the "F": the way into the admin panel (owner and the administrators set in the settings) */}
        <button type="button" onClick={() => { setIsMenuOpen(false); onLogoAdmin ? onLogoAdmin() : handleNavClick('home'); }} aria-label="Вхід для адміністратора"
          className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC300] focus-visible:ring-offset-2 focus-visible:ring-offset-black">
          <Logo />
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('home')}
          className="flex items-center text-left rounded-lg min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC300] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          aria-label="На головну"
        >
          <span className="hidden min-[360px]:flex flex-col group min-w-0 overflow-hidden pr-1">
            <span className="font-black text-lg sm:text-2xl md:text-3xl tracking-wide text-white italic -skew-x-12 group-hover:text-[#FFC300] transition-colors">
              ФОРСАЖ
            </span>
            <span className="block text-[8px] min-[400px]:text-[9px] sm:text-[11px] md:text-xs text-[#FFC300]/90 md:text-zinc-400 font-bold uppercase tracking-[0.12em] sm:tracking-[0.2em] leading-none ml-0.5 mt-0.5 whitespace-nowrap">
              <span className="md:hidden">Автозапчастини · Шини</span><span className="hidden md:inline">Автозапчастини · Шини · АКБ</span>
            </span>
          </span>
        </button>
        </div>

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
            <div className="relative">
              <button
                onClick={() => setCatalogOpen(o => !o)}
                aria-expanded={catalogOpen}
                className={`flex items-center gap-1.5 text-sm lg:text-base font-bold uppercase tracking-wide transition-colors hover:text-[#FFC300] ${catalogOpen || currentView === 'home' ? 'text-[#FFC300]' : 'text-zinc-300'}`}
              >
                <LayoutGrid size={18} /> Каталог <ChevronDown size={16} className={`transition-transform ${catalogOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <a href="/forum" onClick={linkClick('/forum')} className="hidden xl:inline text-sm lg:text-base font-bold uppercase tracking-wide text-zinc-300 hover:text-[#FFC300] transition-colors">Форум</a>

            <button
              onClick={openCart}
              className="relative flex items-center gap-2 bg-[#FFC300] hover:bg-white text-black font-black text-sm uppercase tracking-wide px-4 py-2.5 rounded-xl transition-colors active:scale-95"
              aria-label="Кошик"
            >
              <ShoppingCart size={20} /> Кошик
              {cartCount > 0 && (
                <span key={cartCount} className="min-w-[18px] h-[18px] px-1 bg-black text-[#FFC300] text-[11px] font-black rounded-full flex items-center justify-center animate-in zoom-in duration-200">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>
            <button
              className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 hover:border-[#FFC300] text-white px-3 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
              onClick={() => setIsMenuOpen(prev => !prev)}
              aria-label="Меню"
            >
              <span className="text-[#FFC300]">{isMenuOpen ? <X size={20} /> : <Menu size={20} />}</span> Меню
            </button>
          </nav>

          {/* Mobile Controls */}
          <div className="flex items-center gap-1.5 md:hidden shrink-0">
            {/* Cart badge — mobile */}
            <button
              onClick={() => { setIsMenuOpen(false); openCart(); }}
              className="relative h-10 pl-3 pr-3.5 flex items-center gap-1.5 rounded-xl bg-[#FFC300] text-black font-black text-xs uppercase active:scale-95 transition-transform"
              aria-label="Кошик"
            >
              <ShoppingCart size={20} /> <span className="hidden min-[340px]:inline">Кошик</span>
              {cartCount > 0 && (
                <span key={`mob-${cartCount}`} className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 bg-black text-[#FFC300] border border-[#FFC300] text-[10px] font-black rounded-full flex items-center justify-center animate-in zoom-in duration-200">
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
              className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 hover:border-[#FFC300] text-white p-2 sm:px-3 sm:py-2 rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all group"
              onClick={() => setIsMenuOpen(prev => !prev)}
              aria-label="Відкрити меню"
            >
              <span className="text-[#FFC300] group-hover:text-white transition-colors">
                {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </span>
              <span className="hidden sm:inline">Меню</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {/* a tap anywhere outside the menu closes it (put into <body>: the header's blur would trap a fixed layer) */}
      {isMenuOpen && createPortal(
        <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setIsMenuOpen(false)} aria-hidden="true" />,
        document.body,
      )}
      {isMenuOpen && (
        <div className="absolute top-full left-0 md:left-auto md:right-4 w-full md:w-[380px] md:rounded-b-2xl max-h-[calc(100dvh-var(--header-h,64px))] overflow-y-auto overscroll-contain bg-zinc-900 border-b border-white/10 shadow-2xl animate-in slide-in-from-top-2 duration-200">
          <div className="bg-black/50 px-4 py-3 border-b border-white/5 flex flex-wrap justify-center gap-x-5 gap-y-1">
            <a href={phones.link1} className="flex items-center gap-2 text-[#FFC300] font-bold">
              <Phone size={16} /> {phones.p1}
            </a>
            <a href={phones.link2} className="flex items-center gap-2 text-white font-bold">
              <Phone size={16} /> {phones.p2}
            </a>
          </div>

          <nav className="flex flex-col p-4 gap-1">
            <button
              onClick={() => { onAccountClick?.(); setIsMenuOpen(false); }}
              className="text-base font-black uppercase tracking-wide text-left py-2.5 border-b border-white/5 text-zinc-300 hover:text-[#FFC300] flex items-center gap-2 transition-colors"
            >
<User size={20} /> {isLoggedIn || isStaff ? 'Мій кабінет' : 'Увійти / Реєстрація'}
            </button>

            <button onClick={() => { setIsMenuOpen(false); setMobileCatalog(true); }}
              className="my-3 flex items-center gap-3 rounded-2xl bg-[#FFC300] text-black px-4 py-3.5 font-black uppercase">
              <LayoutGrid size={20} /> Каталог товарів <span className="ml-auto text-xs font-bold normal-case opacity-70">{roots.length} розділів</span>
            </button>
            {/* the forum right under the catalogue: people should not have to look for it */}
            <a href="/forum" onClick={(e) => { setIsMenuOpen(false); linkClick('/forum')(e); }}
              className="mb-2 flex items-center gap-3 rounded-2xl border border-[#FFC300]/40 bg-zinc-800 text-white px-4 py-3.5 font-black uppercase">
              <MessagesSquare size={20} className="text-[#FFC300]" /> Форум автомобілістів <span className="ml-auto text-xs font-bold normal-case text-zinc-400">питання й поради</span>
            </a>
            <div className="grid grid-cols-2 gap-x-3 py-1">
              {infoLinks.map(([href, label]) => (
                <a key={href} href={href} onClick={(e) => { setIsMenuOpen(false); linkClick(href)(e); }} className="py-2 text-sm text-zinc-400 hover:text-white font-bold">{label}</a>
              ))}
            </div>
            <button onClick={() => setIsMenuOpen(false)} className="mt-2 h-11 rounded-xl border border-zinc-700 text-zinc-300 font-bold text-sm flex items-center justify-center gap-2"><X size={16} /> Закрити меню</button>
          </nav>
        </div>
      )}
      {(catalogOpen || mobileCatalog) && (
        <CatalogMenu categories={categories} onPick={goCategory} hrefFor={catPath} onClose={() => { setCatalogOpen(false); setMobileCatalog(false); }}
          footer={(
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              <a href="/forum" onClick={(e) => { setCatalogOpen(false); setMobileCatalog(false); linkClick('/forum')(e); }} className="text-xs font-bold text-[#FFC300] hover:text-white">Форум</a>
              {infoLinks.map(([href, label]) => (
                <a key={href} href={href} onClick={(e) => { setCatalogOpen(false); setMobileCatalog(false); linkClick(href)(e); }} className="text-xs text-zinc-400 hover:text-[#FFC300]">{label}</a>
              ))}
            </div>
          )} />
      )}
    </header>
  );
};

export default Header;
