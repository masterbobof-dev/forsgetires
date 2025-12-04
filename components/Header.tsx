import React from 'react';
import Logo from './Logo';
import { ViewState } from '../types';
import { Menu, X, Phone, Lock } from 'lucide-react';
import { PHONE_NUMBER_1, PHONE_NUMBER_2, PHONE_LINK_1, PHONE_LINK_2 } from '../constants';

interface HeaderProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onAdminClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, onChangeView, onAdminClick }) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const navItems: { label: string; view: ViewState }[] = [
    { label: 'Головна', view: 'home' },
    { label: 'Ціни', view: 'prices' },
    { label: 'Фотогалерея', view: 'gallery' },
  ];

  const handleNavClick = (view: ViewState) => {
    onChangeView(view);
    setIsMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-black/90 backdrop-blur-md border-b border-white/10 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        
        {/* Left Side: Logo & Brand Name */}
        <div className="flex items-center gap-3 md:gap-4">
          <Logo />
          
          <div 
            className="flex flex-col cursor-pointer group"
            onClick={() => handleNavClick('home')}
          >
            <span className="font-black text-2xl md:text-3xl tracking-wide text-white italic -skew-x-12 group-hover:text-[#FFC300] transition-colors">
              ФОРСАЖ
            </span>
            <span className="text-[10px] md:text-xs text-zinc-400 font-bold uppercase tracking-[0.2em] leading-none ml-1">
              Шиномонтаж
            </span>
          </div>
        </div>

        {/* Right Side: Desktop Phones, Desktop Nav, Mobile Controls */}
        <div className="flex items-center gap-6">
          
          {/* Phones - Visible on Desktop/Tablet */}
          <div className="hidden lg:flex flex-col items-end gap-0.5 border-r border-zinc-800 pr-6 mr-2">
            <a href={PHONE_LINK_1} className="flex items-center gap-2 text-[#FFC300] font-bold text-sm hover:text-[#e6b000] transition-colors group">
              <Phone size={14} className="group-hover:animate-bounce" /> 
              {PHONE_NUMBER_1}
            </a>
            <a href={PHONE_LINK_2} className="flex items-center gap-2 text-zinc-400 font-bold text-sm hover:text-white transition-colors">
              <Phone size={14} /> 
              {PHONE_NUMBER_2}
            </a>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {/* Admin Lock Button */}
            <button 
              onClick={() => onAdminClick && onAdminClick()}
              className="text-zinc-600 hover:text-[#FFC300] transition-colors p-2 rounded-full hover:bg-zinc-800/50"
              title="Вхід для персоналу"
            >
              <Lock size={18} />
            </button>

            {navItems.map((item) => (
              <button
                key={item.view}
                onClick={() => handleNavClick(item.view)}
                className={`text-sm lg:text-base font-bold uppercase tracking-wide transition-colors hover:text-[#FFC300] ${
                  currentView === item.view ? 'text-[#FFC300]' : 'text-zinc-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Mobile Controls */}
          <div className="flex items-center gap-3 md:hidden">
            {/* Quick Call Icon for Mobile */}
            <a href={PHONE_LINK_1} className="w-10 h-10 flex items-center justify-center bg-[#FFC300] rounded-full text-black active:scale-90 transition-transform">
              <Phone size={20} />
            </a>
            
            <button 
              className="text-white p-1 active:scale-90 transition-transform"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={32} /> : <Menu size={32} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav Dropdown */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-zinc-900 border-b border-white/10 shadow-2xl animate-in slide-in-from-top-2">
          {/* Mobile Phones in Menu */}
          <div className="bg-black/50 p-4 border-b border-white/5 flex flex-col items-center gap-3">
             <a href={PHONE_LINK_1} className="flex items-center gap-2 text-[#FFC300] font-bold text-lg">
                <Phone size={18} /> {PHONE_NUMBER_1}
             </a>
             <a href={PHONE_LINK_2} className="flex items-center gap-2 text-white font-bold text-lg">
                <Phone size={18} /> {PHONE_NUMBER_2}
             </a>
          </div>

          <nav className="flex flex-col p-4 gap-2">
            {/* Admin Link for Mobile Menu */}
            <button
               onClick={() => {
                 if(onAdminClick) onAdminClick();
                 setIsMenuOpen(false);
               }}
               className="text-xl font-bold uppercase italic tracking-wider text-left py-3 border-b border-white/5 text-zinc-500 hover:text-[#FFC300] flex items-center gap-2"
            >
               <Lock size={18} /> Персонал
            </button>

            {navItems.map((item) => (
              <button
                key={item.view}
                onClick={() => handleNavClick(item.view)}
                className={`text-xl font-black uppercase italic tracking-wider text-left py-3 border-b border-white/5 ${
                  currentView === item.view ? 'text-[#FFC300]' : 'text-zinc-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;