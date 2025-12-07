
import React from 'react';
import { ViewState } from '../types';
import { Map } from 'lucide-react';

interface FooterProps {
  onNavigate?: (view: ViewState) => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-black py-8 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-zinc-500 text-sm font-mono">
          © {new Date().getFullYear()} Шиномонтаж <span className="text-[#FFC300]">FORSAGE</span>. Всі права захищено.
        </p>
        
        {onNavigate && (
          <button 
            onClick={() => {
                onNavigate('sitemap');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2 text-zinc-500 hover:text-[#FFC300] transition-colors text-sm font-bold uppercase tracking-wider"
          >
            <Map size={14} />
            Карта сайту
          </button>
        )}
      </div>
    </footer>
  );
};

export default Footer;
