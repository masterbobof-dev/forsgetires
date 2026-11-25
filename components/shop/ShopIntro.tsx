import React from 'react';
import { Phone, ArrowRight, MapPin } from 'lucide-react';
import { type ProductCategory, getCategoryPath } from '../../categories';
import type { CategorySelection } from './CategoryNav';

const MAP_ROUTE_URL = 'https://www.google.com/maps/dir/?api=1&destination=%D0%B2%D1%83%D0%BB%D0%B8%D1%86%D1%8F%20%D0%9A%D0%B2%D1%96%D1%82%D0%BD%D0%B5%D0%B2%D0%B0%209%2C%20%D0%A1%D0%B8%D0%BD%D0%B5%D0%BB%D1%8C%D0%BD%D0%B8%D0%BA%D0%BE%D0%B2%D0%B5%2C%20%D0%94%D0%BD%D1%96%D0%BF%D1%80%D0%BE%D0%BF%D0%B5%D1%82%D1%80%D0%BE%D0%B2%D1%81%D1%8C%D0%BA%D0%B0%20%D0%BE%D0%B1%D0%BB%D0%B0%D1%81%D1%82%D1%8C';
const MAP_EMBED_URL = 'https://www.google.com/maps?q=%D0%B2%D1%83%D0%BB%D0%B8%D1%86%D1%8F%20%D0%9A%D0%B2%D1%96%D1%82%D0%BD%D0%B5%D0%B2%D0%B0%209%2C%20%D0%A1%D0%B8%D0%BD%D0%B5%D0%BB%D1%8C%D0%BD%D0%B8%D0%BA%D0%BE%D0%B2%D0%B5%2C%20%D0%94%D0%BD%D1%96%D0%BF%D1%80%D0%BE%D0%BF%D0%B5%D1%82%D1%80%D0%BE%D0%B2%D1%81%D1%8C%D0%BA%D0%B0%20%D0%BE%D0%B1%D0%BB%D0%B0%D1%81%D1%82%D1%8C&z=17&hl=uk&output=embed';

interface ShopIntroProps {
  /** on the home page the block stays in the page for Google and screen readers but is not shown */
  hidden: boolean;
  activeCategory: CategorySelection;
  activeCat: ProductCategory | undefined;
  categories: ProductCategory[];
  shopPhone: string;
  shopPhone2: string;
  shopPhoneLink: string;
  shopPhoneLink2: string;
  /** breadcrumb "Головна": all goods, no filters, top of the page */
  onHome: () => void;
  /** breadcrumb "Каталог": all goods + open the catalogue menu */
  onCatalog: () => void;
  onPickCategory: (id: number) => void;
}

/** Top of a section page: breadcrumbs, the section name and description, phones and the map (big screens). */
const ShopIntro: React.FC<ShopIntroProps> = ({ hidden, activeCategory, activeCat, categories, shopPhone, shopPhone2, shopPhoneLink, shopPhoneLink2, onHome, onCatalog, onPickCategory }) => (
  <header className={`${hidden ? 'sr-only' : ''} flex flex-col lg:flex-row justify-between items-stretch lg:items-end gap-4 lg:gap-6 mb-5 md:mb-8`}>
    <div className="flex-1 space-y-3 md:space-y-5 animate-in fade-in slide-in-from-left-4 duration-500">
      <nav className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] uppercase tracking-widest font-black text-zinc-500" aria-label="Навігація">
        <button onClick={onHome} className="hover:text-[#FFC300] transition-colors">Головна</button>
        <span className="text-zinc-800">/</span>
        <button onClick={onCatalog} className="text-zinc-500 hover:text-[#FFC300] transition-colors">Каталог</button>
        {activeCategory === 'hot' && (<><span className="text-zinc-800">/</span><span className="text-[#FFC300]">Акції</span></>)}
        {activeCategory === 'fav' && (<><span className="text-zinc-800">/</span><span className="text-[#FFC300]">Обране</span></>)}
        {activeCat && getCategoryPath(categories, activeCat).map((c, i, arr) => (
          <React.Fragment key={c.id}>
            <span className="text-zinc-800">/</span>
            {i === arr.length - 1
              ? <span className="text-[#FFC300]">{c.name}</span>
              : <button onClick={() => onPickCategory(c.id)} className="text-zinc-500 hover:text-[#FFC300] transition-colors">{c.name}</button>}
          </React.Fragment>
        ))}
      </nav>

      <h1 key={`h1-${String(activeCategory)}`} className="text-[28px] leading-[1.05] sm:text-4xl md:text-5xl font-black text-white uppercase italic tracking-tighter animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeCat ? activeCat.name : activeCategory === 'hot' ? 'Акції' : activeCategory === 'fav' ? 'Обране' : <>Форсаж <span className="text-[#FFC300]">Синельникове</span></>}
      </h1>

      <p className={`${activeCat?.description ? '' : 'hidden md:block'} text-zinc-400 text-sm md:text-base max-w-xl leading-relaxed line-clamp-2 md:line-clamp-none`}>
        {activeCat?.description || <>
          <span className="md:hidden"><span className="text-[#FFC300] font-bold">Шини, диски, АКБ, автотовари</span> в наявності. Самовивіз або Нова Пошта.</span>
          <span className="hidden md:inline"><span className="text-[#FFC300] font-bold">Шини, диски, акумулятори та автотовари</span> в наявності.
          Самовивіз у <span className="text-white font-bold">Синельниковому</span> або доставка Новою Поштою по всій Україні.</span>
        </>}
      </p>

      {/* phones are in the header on phones — here only on bigger screens */}
      <div className="hidden md:flex flex-wrap gap-2">
        <a href={shopPhoneLink} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 pl-1.5 pr-3 py-1.5 md:pl-2 md:pr-4 md:py-2 rounded-xl hover:border-[#FFC300] transition-all group active:scale-95">
          <span className="w-8 h-8 md:w-10 md:h-10 bg-[#FFC300] rounded-lg flex items-center justify-center text-black group-hover:scale-110 transition-transform"><Phone size={16} /></span>
          <span className="text-white font-black text-sm md:text-lg tracking-tight">{shopPhone}</span>
        </a>
        <a href={shopPhoneLink2} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 pl-1.5 pr-3 py-1.5 md:pl-2 md:pr-4 md:py-2 rounded-xl hover:border-[#FFC300] transition-all group active:scale-95">
          <span className="w-8 h-8 md:w-10 md:h-10 bg-zinc-800 border border-zinc-700 rounded-lg flex items-center justify-center text-[#FFC300] group-hover:scale-110 transition-transform"><Phone size={16} /></span>
          <span className="text-white font-black text-sm md:text-lg tracking-tight">{shopPhone2}</span>
        </a>
        <a
          href={MAP_ROUTE_URL}
          target="_blank" rel="noopener noreferrer"
          className="lg:hidden flex items-center gap-2 bg-zinc-900 border border-zinc-800 pl-1.5 pr-3 py-1.5 md:pl-2 md:pr-4 md:py-2 rounded-xl hover:border-[#FFC300] transition-all active:scale-95"
        >
          <span className="w-8 h-8 md:w-10 md:h-10 bg-zinc-800 border border-zinc-700 rounded-lg flex items-center justify-center text-[#FFC300]"><MapPin size={16} /></span>
          <span className="text-zinc-300 font-bold text-xs md:text-sm">вул. Квітнева 9</span>
        </a>
      </div>
    </div>

    {/* Desktop: Mini Map */}
    <div className="hidden lg:block lg:w-5/12 xl:w-[420px] shrink-0 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-[#FFC300]/40 to-yellow-600/20 rounded-3xl blur opacity-30 group-hover:opacity-60 transition duration-700"></div>
        <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
          <iframe
            src={MAP_EMBED_URL}
            width="100%" height="180"
            style={{ border: 0, filter: 'grayscale(1) invert(0.85) contrast(1.1)' }}
            allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"
            title="Forsage location"
          ></iframe>
          <div className="bg-zinc-950/90 border-t border-zinc-800 p-3 flex items-center justify-between gap-2">
            <div className="min-w-0 flex items-center gap-2">
              <MapPin size={12} className="text-[#FFC300] shrink-0" />
              <p className="text-zinc-400 text-[11px] font-bold truncate">м. Синельникове, вул. Квітнева 9</p>
            </div>
            <a
              href={MAP_ROUTE_URL}
              target="_blank" rel="noopener noreferrer"
              className="bg-[#FFC300] px-3 py-1.5 rounded-lg text-black font-black text-[11px] uppercase tracking-widest hover:bg-white transition-colors shrink-0 flex items-center gap-1"
            >
              Маршрут <ArrowRight size={10} />
            </a>
          </div>
        </div>
      </div>
    </div>
  </header>
);

export default ShopIntro;
