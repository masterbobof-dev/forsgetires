
import React, { useState, useEffect } from 'react';
import { Lock, LogOut, ShieldAlert, UserCheck, Loader2 } from 'lucide-react';
import ScheduleTab from './admin/ScheduleTab';
import ClientsTab from './admin/ClientsTab';
import GalleryTab from './admin/GalleryTab';
import PricesTab from './admin/PricesTab';
import SettingsTab from './admin/SettingsTab';
import TyresTab from './admin/TyresTab';
import OrdersTab from './admin/OrdersTab';
import StatsTab from './admin/StatsTab';
import ArticlesTab from './admin/ArticlesTab';
import SeoTab from './admin/SeoTab';
import PromoTab from './admin/PromoTab';
import SyncTab from './admin/SyncTab';
import { supabase } from '../supabaseClient';

interface AdminPanelProps {
  onLogout: () => void;
  mode: 'service' | 'tyre';
  setMode: (mode: 'service' | 'tyre') => void;
}

type AccessStatus = 'loading' | 'granted_admin' | 'granted_staff' | 'denied' | 'setup_required';

const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout, mode, setMode }) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'clients' | 'gallery' | 'prices' | 'settings' | 'tyres' | 'orders' | 'stats' | 'articles' | 'seo' | 'promo' | 'sync'>(
    'orders'
  );
  
  const [accessStatus, setAccessStatus] = useState<AccessStatus>('loading');
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  // --- SECURITY CHECK ---
  useEffect(() => {
      checkAccess();
  }, []);

  const checkAccess = async () => {
      setAccessStatus('loading');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
          onLogout();
          return;
      }
      
      const email = user.email.trim().toLowerCase();
      setCurrentUserEmail(email);

      // Fetch permissions from DB
      const { data: settings } = await supabase.from('settings').select('key, value').in('key', ['admin_email', 'service_staff_email']);
      
      const adminEmail = settings?.find(s => s.key === 'admin_email')?.value?.trim().toLowerCase();
      const staffEmail = settings?.find(s => s.key === 'service_staff_email')?.value?.trim().toLowerCase();

      if (!adminEmail) {
          // FIRST RUN: No admin defined yet. Allow current user to claim ownership.
          setAccessStatus('setup_required');
      } else if (email === adminEmail) {
          // Is Admin
          setAccessStatus('granted_admin');
          // Default to tyre mode if not set
          if (mode === 'service') setMode('tyre'); 
      } else if (email === staffEmail) {
          // Is Staff
          setAccessStatus('granted_staff');
          setMode('service'); // Force service mode
          setActiveTab('schedule');
      } else {
          // Unauthorized
          setAccessStatus('denied');
      }
  };

  const claimOwnership = async () => {
      if (!currentUserEmail) return;
      const { error } = await supabase.from('settings').insert([{ key: 'admin_email', value: currentUserEmail }]);
      if (!error) {
          alert(`Вітаємо! Ваш email (${currentUserEmail}) встановлено як Адміністратора.`);
          checkAccess();
      } else {
          alert("Помилка: " + error.message);
      }
  };

  // Set default tab when switching modes
  useEffect(() => {
     if (mode === 'service') {
         if (!['schedule', 'clients', 'gallery', 'prices'].includes(activeTab)) {
             setActiveTab('schedule');
         }
     } else {
         if (!['tyres', 'orders', 'stats', 'settings', 'articles', 'seo', 'promo', 'sync'].includes(activeTab)) {
             setActiveTab('orders');
         }
     }
  }, [mode]);

  // --- RENDER ACCESS STATES ---

  if (accessStatus === 'loading') {
      return (
          <div className="min-h-screen bg-black flex flex-col items-center justify-center text-[#FFC300]">
              <Loader2 className="animate-spin mb-4" size={48} />
              <p className="font-bold animate-pulse">Перевірка прав доступу...</p>
          </div>
      );
  }

  if (accessStatus === 'denied') {
      return (
          <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4 text-center animate-in zoom-in">
              <div className="w-24 h-24 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-6 border-2 border-red-900/50 shadow-[0_0_50px_rgba(220,38,38,0.2)]">
                  <ShieldAlert size={48} />
              </div>
              <h2 className="text-3xl font-black text-white mb-2 uppercase">Доступ заборонено</h2>
              <p className="text-zinc-400 max-w-md mb-8 text-lg">
                  Ваш акаунт <span className="text-white font-mono bg-zinc-800 px-2 py-1 rounded text-sm">{currentUserEmail}</span> не має прав адміністратора або співробітника.
              </p>
              <button 
                  onClick={onLogout} 
                  className="bg-zinc-100 hover:bg-white text-black font-black py-4 px-8 rounded-xl flex items-center gap-2 transition-transform active:scale-95"
              >
                  <LogOut size={20}/> Вийти з акаунту
              </button>
          </div>
      );
  }

  if (accessStatus === 'setup_required') {
      return (
          <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4 text-center animate-in fade-in">
              <div className="w-24 h-24 bg-[#FFC300]/20 text-[#FFC300] rounded-full flex items-center justify-center mb-6 border-2 border-[#FFC300]/50 shadow-[0_0_50px_rgba(255,195,0,0.2)]">
                  <UserCheck size={48} />
              </div>
              <h2 className="text-3xl font-black text-white mb-2 uppercase">Налаштування Власника</h2>
              <p className="text-zinc-400 max-w-md mb-8">
                  Система ще не має призначеного адміністратора. Ви хочете призначити свій акаунт <span className="text-white font-mono bg-zinc-800 px-2 py-1 rounded text-sm">{currentUserEmail}</span> головним власником?
              </p>
              <button 
                  onClick={claimOwnership} 
                  className="bg-[#FFC300] hover:bg-[#e6b000] text-black font-black py-4 px-8 rounded-xl flex items-center gap-2 transition-transform active:scale-95 shadow-lg"
              >
                  <UserCheck size={20}/> ТАК, Я ВЛАСНИК
              </button>
          </div>
      );
  }

  // --- RENDER MAIN PANEL (GRANTED) ---
  const isStaff = accessStatus === 'granted_staff';

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20 animate-in fade-in duration-500">
      <header className="bg-zinc-900 border-b border-zinc-800 p-4 sticky top-0 z-50 shadow-md print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="flex items-center gap-4">
               <h1 className="text-xl font-bold uppercase flex items-center gap-2">
                   <Lock className="text-[#FFC300]"/> 
                   {isStaff ? 'Сервіс (Персонал)' : 'Admin Panel'}
               </h1>
               
               {!isStaff && (
                   <div className="bg-black p-1 rounded-lg border border-zinc-700 flex">
                       <button 
                        onClick={() => setMode('tyre')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors ${mode === 'tyre' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                       >
                           Магазин
                       </button>
                       <button 
                        onClick={() => setMode('service')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors ${mode === 'service' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                       >
                           Сервіс
                       </button>
                   </div>
               )}
           </div>
           
           {/* Navigation Container */}
           <div className="flex bg-black rounded-lg p-1 overflow-x-auto w-full md:w-auto scrollbar-hide max-w-[95vw]">
              {mode === 'service' && ['schedule', 'clients'].map(t => (
                  <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 rounded font-bold text-sm uppercase whitespace-nowrap flex-shrink-0 transition-colors ${activeTab === t ? 'bg-[#FFC300] text-black' : 'text-zinc-400 hover:text-white'}`}>{t === 'schedule' ? 'Розклад' : 'Клієнти'}</button>
              ))}
              
              {!isStaff && mode === 'service' && ['prices', 'gallery'].map(t => (
                  <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 rounded font-bold text-sm uppercase whitespace-nowrap flex-shrink-0 transition-colors ${activeTab === t ? 'bg-[#FFC300] text-black' : 'text-zinc-400 hover:text-white'}`}>{t === 'prices' ? 'Прайс' : 'Галерея'}</button>
              ))}

              {mode === 'tyre' && !isStaff && ['orders', 'tyres', 'promo', 'sync', 'seo', 'articles', 'stats', 'settings'].map(t => (
                  <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 rounded font-bold text-sm uppercase whitespace-nowrap flex-shrink-0 transition-colors ${activeTab === t ? 'bg-[#FFC300] text-black' : 'text-zinc-400 hover:text-white'}`}>{t === 'tyres' ? 'Шини' : t === 'promo' ? 'Маркетинг' : t === 'sync' ? 'API' : t === 'seo' ? 'SEO' : t === 'orders' ? 'Замовлення' : t === 'articles' ? 'Статті' : t === 'settings' ? 'Налашт.' : 'Стат.'}</button>
              ))}
              
              <button onClick={onLogout} className="px-4 py-2 text-zinc-500 hover:text-white ml-2 flex items-center gap-2 whitespace-nowrap flex-shrink-0 border-l border-zinc-800"><LogOut size={16}/> Вихід</button>
           </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 print:hidden">
         {activeTab === 'schedule' && <ScheduleTab />}
         {activeTab === 'clients' && <ClientsTab />}
         {!isStaff && activeTab === 'gallery' && <GalleryTab />}
         {!isStaff && activeTab === 'prices' && <PricesTab />}
         {!isStaff && activeTab === 'settings' && <SettingsTab />}
         {!isStaff && activeTab === 'tyres' && <TyresTab />}
         {!isStaff && activeTab === 'orders' && <OrdersTab />}
         {!isStaff && activeTab === 'stats' && <StatsTab />}
         {!isStaff && activeTab === 'articles' && <ArticlesTab />}
         {!isStaff && activeTab === 'seo' && <SeoTab />}
         {!isStaff && activeTab === 'promo' && <PromoTab />}
         {!isStaff && activeTab === 'sync' && <SyncTab />}
      </main>
    </div>
  );
};

export default AdminPanel;
