
import React, { useState } from 'react';
import { CreditCard, ShieldCheck, Coins, Coffee, Phone, AlertCircle } from 'lucide-react';
import { HERO_BG_IMAGE } from '../constants';
import BookingWizard from './BookingWizard';

const Hero: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [error, setError] = useState('');

  const startBooking = () => {
    if (phone.length < 9) {
      setError('Введіть коректний номер (мін. 9 цифр)');
      return;
    }
    setError('');
    setShowWizard(true);
  };

  return (
    <div className="relative w-full overflow-hidden">
      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0">
        <img 
          src={HERO_BG_IMAGE}
          alt="Шиномонтаж Forsage Фасад" 
          className="w-full h-full object-cover object-center md:object-top opacity-50"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/70 to-[#09090b]"></div>
      </div>

      {/* Content Layer */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-12 md:py-20 flex flex-col gap-8">
        
        <div className="space-y-6">
          
          {/* ONLINE BOOKING BLOCK */}
          <div className="bg-[#18181b] border-l-4 border-[#FFC300] p-6 backdrop-blur-md rounded-r-lg shadow-[0_0_30px_rgba(255,195,0,0.15)] md:max-w-2xl mt-4">
            <h2 className="text-3xl md:text-5xl font-black text-[#FFC300] uppercase leading-tight mb-4 drop-shadow-md tracking-tight italic">
              ОНЛАЙН ЗАПИС
            </h2>
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                    <input 
                      type="tel" 
                      placeholder="Ваш номер (099...)" 
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setError('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && startBooking()}
                      className={`w-full bg-black/50 border ${error ? 'border-red-500' : 'border-zinc-700'} text-white p-4 pl-12 rounded-xl text-lg outline-none focus:border-[#FFC300] transition-colors`}
                    />
                </div>
                <button 
                  onClick={startBooking}
                  className="bg-[#FFC300] hover:bg-[#e6b000] text-black font-black text-lg px-8 py-4 rounded-xl transition-transform active:scale-95 shadow-lg shadow-yellow-900/20 whitespace-nowrap"
                >
                  ЗАПИСАТИСЯ ЗАРАЗ
                </button>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-red-500 text-sm font-bold animate-in slide-in-from-left-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment Block */}
            <div className="bg-zinc-800/60 backdrop-blur-md border border-zinc-700 p-5 rounded-xl flex items-center gap-4 hover:border-[#FFC300] transition-colors group">
              <div className="p-3 bg-zinc-900 rounded-full group-hover:bg-[#FFC300] transition-colors">
                <CreditCard className="text-[#FFC300] w-8 h-8 group-hover:text-black transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-white uppercase group-hover:text-[#FFC300] transition-colors">
                Розрахунок карткою
                <span className="block text-sm font-normal text-zinc-400 normal-case mt-1">(термінал працює)</span>
              </h3>
            </div>

            {/* Change Block */}
            <div className="bg-zinc-800/60 backdrop-blur-md border border-zinc-700 p-5 rounded-xl flex items-center gap-4 hover:border-[#FFC300] transition-colors group">
              <div className="p-3 bg-zinc-900 rounded-full group-hover:bg-[#FFC300] transition-colors">
                <Coins className="text-[#FFC300] w-8 h-8 group-hover:text-black transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-white uppercase group-hover:text-[#FFC300] transition-colors">
                Завжди маємо здачу
              </h3>
            </div>
            
            {/* Fixed Prices */}
            <div className="bg-zinc-800/60 backdrop-blur-md border border-zinc-700 p-5 rounded-xl flex items-center gap-4 hover:border-[#FFC300] transition-colors group">
              <div className="p-3 bg-zinc-900 rounded-full group-hover:bg-[#FFC300] transition-colors">
                <ShieldCheck className="text-[#FFC300] w-8 h-8 group-hover:text-black transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-white uppercase group-hover:text-[#FFC300] transition-colors">
                Фіксовані ціни
                <span className="block text-sm font-normal text-zinc-400 normal-case mt-1">на всі послуги</span>
              </h3>
            </div>

            {/* Comfort Block */}
            <div className="bg-zinc-800/60 backdrop-blur-md border border-zinc-700 p-5 rounded-xl flex items-center gap-4 hover:border-[#FFC300] transition-colors group">
              <div className="p-3 bg-zinc-900 rounded-full group-hover:bg-[#FFC300] transition-colors">
                <Coffee className="text-[#FFC300] w-8 h-8 group-hover:text-black transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-white uppercase group-hover:text-[#FFC300] transition-colors">
                Гаряча кава та чай
                <span className="block text-sm font-normal text-zinc-400 normal-case mt-1">(холодні напої)</span>
              </h3>
            </div>
          </div>
        </div>
      </div>

      {showWizard && <BookingWizard initialPhone={phone} onClose={() => setShowWizard(false)} />}
    </div>
  );
};

export default Hero;
