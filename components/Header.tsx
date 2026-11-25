import React, { useState, useEffect, useRef } from 'react';
import { catPath } from '../api/_paths.js';
import Logo from './Logo';
import { ViewState } from '../types';
import { Menu, X, Phone, User, ShoppingBag, ChevronDown, Flame, LayoutGrid, Lock } from 'lucide-react';
import { useCategories, getRootCategories, getChildren, getCategoryIcon } from '../categories';
import { linkClick } from '../navigation';
import CatalogMenu from './CatalogMenu';
import { PHONE_NUMBER_1, PHONE_NUMBER_2, PHONE_LINK_1, PHONE_LINK_2 } from '../constants';
import { supabase } from '../supabaseClient';

interface HeaderProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onAccountClick?: () => void;
  isLoggedIn?: boolean;
  /** a staff member is signed in: the button leads to the admin panel */
  isStaff?: boolean;
  cartCount?: number;
}

const Header: React.FC<HeaderProps> = ({ currentView, onChangeView, onAccountClick, isLoggedIn = false, isStaff = false, cartCount = 0 }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [mobileCatalog, setMobileCatalog] = useState(false);
  // breadcrumb "Каталог" opens the full catalogue menu
  useEffect(() => {
    const open = () => { if (window.innerWidth < 768) return; { window.scrollTo({ top: 0, behavior: 'smooth' }); setCatalogOpen(true); } };
    window.addEventListener('open-catalog', open);
    return () => window.removeEventListener('open-catalog', open);
  }, []);
  const catalogRef = useRef<HTMLDivElement>(null);
  const { categories } = useCategories();
  const roots = getRootCategories(categories);

  // close the catalog dropdown on outside click / Esc
  useEffect(() => {
    if (!catalogOpen) return;
    const onDown = (e: MouseEvent) => { if (!catalogRef.current?.contains(e.target as Node)) setCatalogOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCatalogOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [catalogOpen]);

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
    { label: 'Каталог товарів', view: 'home' },
  ];
  const infoLinks: [string, string][] = [
    ['/dostavka-i-oplata', 'Доставка і оплата'],
    ['/garantiya-i-povernennya', 'Гарантія і повернення'],
    ['/faq', 'Поширені питання'],
    ['/statti', 'Корисні статті'],
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
        <button
          type="button"
          onClick={() => handleNavClick('home')}
          className="flex items-center gap-2 md:gap-4 text-left rounded-lg min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC300] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          aria-label="На головну"
        >
          <Logo />
          <span className="hidden min-[360px]:flex flex-col group min-w-0 overflow-hidden pr-1">
            <span className="font-black text-lg sm:text-2xl md:text-3xl tracking-wide text-white italic -skew-x-12 group-hover:text-[#FFC300] transition-colors">
              ФОРСАЖ
            </span>
            <span className="block text-[8px] min-[400px]:text-[9px] sm:text-[11px] md:text-xs text-[#FFC300]/90 md:text-zinc-400 font-bold uppercase tracking-[0.12em] sm:tracking-[0.2em] leading-none ml-0.5 mt-0.5 whitespace-nowrap">
              <span className="md:hidden">Автозапчастини · Шини</span><span className="hidden md:inline">Автозапчастини · Шини · АКБ</span>
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
              onClick={() => onAccountClick?.()}
              className={`flex items-center gap-2 text-sm font-bold transition-colors px-3 py-2 rounded-xl hover:bg-zinc-800/60 ${currentView === 'account' ? 'text-[#FFC300]' : 'text-zinc-300 hover:text-[#FFC300]'}`}
              aria-label={isStaff ? 'Адмін-панель' : isLoggedIn ? 'Мій кабінет' : 'Увійти'}
            >
              {isStaff ? <><Lock size={18} className="text-[#FFC300]" /> Адмінка</> : <><User size={18} /> {isLoggedIn ? 'Кабінет' : 'Увійти'}</>}
            </button>

            <div ref={catalogRef} className="relative">
              <button
                onClick={() => setCatalogOpen(o => !o)}
                aria-expanded={catalogOpen}
                className={`flex items-center gap-1.5 text-sm lg:text-base font-bold uppercase tracking-wide transition-colors hover:text-[#FFC300] ${catalogOpen || currentView === 'home' ? 'text-[#FFC300]' : 'text-zinc-300'}`}
              >
                <LayoutGrid size={18} /> Каталог <ChevronDown size={16} className={`transition-transform ${catalogOpen ? 'rotate-180' : ''}`} />
              </button>
              {catalogOpen && (
                <div className="fixed left-1/2 -translate-x-1/2 mt-4 w-[min(1120px,calc(100vw-2rem))] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200"
                  style={{ top: 'var(--header-h, 72px)' }}>
                  <CatalogMenu categories={categories} onPick={goCategory} hrefFor={catPath} onClose={() => setCatalogOpen(false)} />
                  <div className="mt-3 pt-3 border-t border-zinc-800 flex flex-wrap gap-x-5 gap-y-1">
                    {infoLinks.map(([href, label]) => (
                      <a key={href} href={href} onClick={(e) => { setCatalogOpen(false); linkClick(href)(e); }} className="text-xs text-zinc-400 hover:text-[#FFC300] transition-colors">{label}</a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={openCart}
              className="relative flex items-center gap-2 bg-[#FFC300] hover:bg-white text-black font-black text-xs uppercase tracking-wide px-3 py-2 rounded-xl transition-colors active:scale-95"
              aria-label="Кошик"
            >
              <ShoppingBag size={16} /> Кошик
              {cartCount > 0 && (
                <span key={cartCount} className="min-w-[18px] h-[18px] px-1 bg-black text-[#FFC300] text-[11px] font-black rounded-full flex items-center justify-center animate-in zoom-in duration-200">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>
          </nav>

          {/* Mobile Controls */}
          <div className="flex items-center gap-1.5 md:hidden shrink-0">
            {/* Cart badge — mobile */}
            <button
              onClick={openCart}
              className="relative w-9 h-9 flex items-center justify-center text-zinc-300 hover:text-[#FFC300] transition-colors"
              aria-label="Кошик"
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span key={`mob-${cartCount}`} className="absolute top-0 right-0 min-w-[16px] h-4 px-0.5 bg-[#FFC300] text-black text-[10px] font-black rounded-full flex items-center justify-center animate-in zoom-in duration-200">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onAccountClick?.()}
              className={`hidden min-[420px]:flex w-9 h-9 items-center justify-center transition-colors ${isLoggedIn || isStaff ? 'text-[#FFC300]' : 'text-zinc-300 hover:text-[#FFC300]'}`}
              aria-label={isStaff ? 'Адмін-панель' : isLoggedIn ? 'Мій кабінет' : 'Увійти'}
            >
              {isStaff ? <Lock size={20} /> : <User size={20} />}
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
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full max-h-[calc(100dvh-var(--header-h,64px))] overflow-y-auto overscroll-contain bg-zinc-900 border-b border-white/10 shadow-2xl animate-in slide-in-from-top-2 duration-200">
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
              onClick={() => { onAccountClick?.(); setIsMenuOpen(false); }}
              className="text-xl font-black uppercase italic tracking-wider text-left py-3 border-b border-white/5 text-zinc-300 hover:text-[#FFC300] flex items-center gap-2 transition-colors"
            >
              {isStaff ? <><Lock size={20} className="text-[#FFC300]" /> Адмін-панель</> : <><User size={20} /> {isLoggedIn ? 'Мій кабінет' : 'Увійти / Реєстрація'}</>}
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
                      <span key={`mmob-${cartCount}`} className="absolute -top-2 -right-2 min-w-[16px] h-4 px-0.5 bg-[#FFC300] text-black text-[10px] font-black rounded-full flex items-center justify-center animate-in zoom-in duration-200">
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
            <button onClick={() => { setIsMenuOpen(false); setMobileCatalog(true); }}
              className="my-3 flex items-center gap-3 rounded-2xl bg-[#FFC300] text-black px-4 py-3.5 font-black uppercase">
              <LayoutGrid size={20} /> Каталог товарів <span className="ml-auto text-xs font-bold normal-case opacity-70">{roots.length} розділів</span>
            </button>
            <div className="flex flex-col py-2">
              {infoLinks.map(([href, label]) => (
                <a key={href} href={href} onClick={(e) => { setIsMenuOpen(false); linkClick(href)(e); }} className="py-2 text-zinc-400 hover:text-white font-bold">{label}</a>
              ))}
            </div>
          </nav>
        </div>
      )}
      {mobileCatalog && <CatalogMenu mobile categories={categories} onPick={goCategory} hrefFor={catPath} onClose={() => setMobileCatalog(false)} />}
    </header>
  );
};

export default Header;
