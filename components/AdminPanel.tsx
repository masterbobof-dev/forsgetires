
import React, { useState, useEffect } from 'react';
import { Lock, LogOut, ShieldAlert, UserCheck, Loader2, Menu, X as CloseIcon, ChevronRight, LayoutDashboard, Settings as SettingsIcon, ShoppingBag, Wrench, BarChart3, Globe, Megaphone, FileText, Database, Users, Calendar } from 'lucide-react';
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
  onBackToSite?: () => void;
  mode: 'service' | 'tyre';
  setMode: (mode: 'service' | 'tyre') => void;
}

type AccessStatus = 'loading' | 'granted_admin' | 'granted_staff' | 'denied' | 'setup_required';

const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout, onBackToSite, mode, setMode }) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'clients' | 'gallery' | 'prices' | 'settings' | 'tyres' | 'orders' | 'stats' | 'articles' | 'seo' | 'promo' | 'sync'>(
    'orders'
  );
  
  const [accessStatus, setAccessStatus] = useState<AccessStatus>('loading');
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- SECURITY CHECK ---
  useEffect(() => {
      checkAccess();
  }, []);

  const checkAccess = async () => {
      setAccessStatus('loading');
      
      try {
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (userError) throw userError;
          if (!user || !user.email) {
              onLogout();
              return;
          }
          
          const email = user.email.trim().toLowerCase();
          setCurrentUserEmail(email);

          // Fetch permissions from DB
          const { data: settings, error: settingsError } = await supabase.from('settings').select('key, value').in('key', ['admin_email', 'service_staff_email']);
          
          if (settingsError) throw settingsError;

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
      } catch (error: any) {
          console.error("Access check error:", error);
          setAccessStatus('denied'); // Or show a specific error state
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
          <div className="min-h-screen bg-black flex flex-col items-center justify-center text-[#FFC300] p-4 text-center">
              <Loader2 className="animate-spin mb-4" size={48} />
              <p className="font-bold animate-pulse mb-2">Перевірка прав доступу...</p>
              <p className="text-zinc-500 text-xs max-w-xs">
                  Ми перевіряємо ваші права адміністратора. Це може зайняти кілька секунд.
              </p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-8 text-zinc-500 hover:text-white text-xs underline"
              >
                  Оновити сторінку
              </button>
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

  const getTabLabel = (tab: string) => {
    switch(tab) {
        case 'schedule': return 'Розклад';
        case 'clients': return 'Клієнти';
        case 'prices': return 'Прайс';
        case 'gallery': return 'Галерея';
        case 'tyres': return 'Шини';
        case 'orders': return 'Замовлення';
        case 'promo': return 'Маркетинг';
        case 'sync': return 'API / Синхр.';
        case 'seo': return 'SEO';
        case 'articles': return 'Статті';
        case 'settings': return 'Налашт.';
        case 'stats': return 'Стат.';
        default: return tab;
    }
  };

  const getTabIcon = (tab: string) => {
    switch(tab) {
        case 'schedule': return <Calendar size={18}/>;
        case 'clients': return <Users size={18}/>;
        case 'prices': return <BarChart3 size={18}/>;
        case 'gallery': return <LayoutDashboard size={18}/>;
        case 'tyres': return <ShoppingBag size={18}/>;
        case 'orders': return <FileText size={18}/>;
        case 'promo': return <Megaphone size={18}/>;
        case 'sync': return <Database size={18}/>;
        case 'seo': return <Globe size={18}/>;
        case 'articles': return <FileText size={18}/>;
        case 'settings': return <SettingsIcon size={18}/>;
        case 'stats': return <BarChart3 size={18}/>;
        default: return null;
    }
  };

  const serviceTabs = isStaff ? ['schedule', 'clients'] : ['schedule', 'clients', 'prices', 'gallery'];
  const tyreTabs = ['orders', 'tyres', 'promo', 'sync', 'seo', 'articles', 'stats', 'settings'];
  const currentTabs = mode === 'service' ? serviceTabs : tyreTabs;

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20 animate-in fade-in duration-500">
      <header className="bg-zinc-900 border-b border-zinc-800 p-3 md:p-4 sticky top-0 z-50 shadow-md print:hidden">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
           <div className="flex items-center gap-3">
               <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white"
               >
                   <Menu size={24} />
               </button>
               <h1 className="text-lg md:text-xl font-bold uppercase flex items-center gap-2">
                   <Lock className="text-[#FFC300] hidden sm:block"/> 
                   <span className="truncate max-w-[150px] sm:max-w-none">
                    {isStaff ? 'Сервіс' : 'Admin'}
                   </span>
               </h1>
               
               {onBackToSite && (
                 <button 
                   onClick={onBackToSite}
                   className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg text-xs font-bold transition-all border border-zinc-700"
                 >
                   <ChevronRight size={14} className="rotate-180" /> На сайт
                 </button>
               )}
               
               {!isStaff && (
                   <div className="bg-black p-1 rounded-lg border border-zinc-700 flex ml-2">
                       <button 
                        onClick={() => { setMode('tyre'); setIsMobileMenuOpen(false); }}
                        className={`px-2 sm:px-3 py-1 rounded text-[10px] sm:text-xs font-bold transition-colors flex items-center gap-1 ${mode === 'tyre' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                       >
                           <ShoppingBag size={12} className="hidden xs:block"/> Магазин шин
                       </button>
                       <button 
                        onClick={() => { setMode('service'); setIsMobileMenuOpen(false); }}
                        className={`px-2 sm:px-3 py-1 rounded text-[10px] sm:text-xs font-bold transition-colors flex items-center gap-1 ${mode === 'service' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                       >
                           <Wrench size={12} className="hidden xs:block"/> Сервіс
                       </button>
                   </div>
               )}
           </div>
           
           {/* Desktop Navigation */}
           <div className="hidden md:flex items-center gap-2">
               <div className="flex bg-black rounded-lg p-1 overflow-x-auto scrollbar-hide max-w-[400px] lg:max-w-none">
                  {currentTabs.map(t => (
                      <button 
                        key={t} 
                        onClick={() => setActiveTab(t as any)} 
                        className={`px-4 py-2 rounded font-bold text-sm uppercase whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === t ? 'bg-[#FFC300] text-black shadow-lg' : 'text-zinc-400 hover:text-white'}`}
                      >
                        {getTabIcon(t)}
                        {getTabLabel(t)}
                      </button>
                  ))}
               </div>
               <button onClick={onLogout} className="flex-shrink-0 px-4 py-2 text-zinc-500 hover:text-red-400 ml-2 flex items-center gap-2 whitespace-nowrap border-l border-zinc-800 transition-colors"><LogOut size={16}/> Вихід</button>
           </div>

            {/* Mobile Active Tab Indicator & Logout */}
            <div className="md:hidden flex items-center gap-2">
                <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full border border-zinc-800">
                    <span className="text-[#FFC300]">{getTabIcon(activeTab)}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">{getTabLabel(activeTab)}</span>
                </div>
                <button 
                    onClick={onLogout}
                    className="p-2 bg-red-900/10 text-red-500 rounded-lg border border-red-900/20"
                    title="Вийти"
                >
                    <LogOut size={18} />
                </button>
            </div>
        </div>
      </header>

      {/* Mobile Sidebar Menu */}
      {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[100] md:hidden animate-in fade-in duration-200">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
              <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-zinc-900 border-r border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
                  <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                          <Lock className="text-[#FFC300]" size={20}/>
                          <span className="font-black uppercase tracking-tighter text-lg">Меню</span>
                      </div>
                      <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-zinc-800 rounded-lg text-zinc-400">
                          <CloseIcon size={20} />
                      </button>
                  </div>

                  <div className="flex-grow overflow-y-auto p-4 space-y-1">
                      <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-3 mb-2">Розділи</div>
                      {currentTabs.map(t => (
                          <button 
                            key={t} 
                            onClick={() => { setActiveTab(t as any); setIsMobileMenuOpen(false); }} 
                            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${activeTab === t ? 'bg-[#FFC300] text-black font-black' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                          >
                            <div className="flex items-center gap-3">
                                {getTabIcon(t)}
                                <span className="text-sm uppercase tracking-wide">{getTabLabel(t)}</span>
                            </div>
                            {activeTab === t && <ChevronRight size={16} />}
                          </button>
                      ))}
                  </div>

                  <div className="p-4 border-t border-zinc-800">
                      <button 
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-900/10 text-red-500 font-bold hover:bg-red-900/20 transition-colors"
                      >
                          <LogOut size={20} />
                          <span>Вийти з акаунту</span>
                      </button>
                  </div>
              </div>
          </div>
      )}

      <main className="max-w-7xl mx-auto p-3 md:p-4 print:hidden">
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
