
import React, { useState, useEffect } from 'react';
import { Lock, LogOut } from 'lucide-react';
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

interface AdminPanelProps {
  onLogout: () => void;
  mode: 'service' | 'tyre';
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout, mode }) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'clients' | 'gallery' | 'prices' | 'settings' | 'tyres' | 'orders' | 'stats' | 'articles' | 'seo' | 'promo'>(
    mode === 'service' ? 'schedule' : 'tyres'
  );

  useEffect(() => {
     if (mode === 'service' && !['schedule', 'clients', 'gallery', 'prices'].includes(activeTab)) {
        setActiveTab('schedule');
     } else if (mode === 'tyre' && !['tyres', 'orders', 'stats', 'settings', 'articles', 'seo', 'promo'].includes(activeTab)) {
        setActiveTab('tyres');
     }
  }, [mode]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20">
      <header className="bg-zinc-900 border-b border-zinc-800 p-4 sticky top-0 z-50 shadow-md print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
           <h1 className="text-xl font-bold uppercase flex items-center gap-2"><Lock className="text-[#FFC300]"/> Admin Panel <span className="text-xs text-zinc-500 bg-black px-2 py-0.5 rounded">{mode === 'service' ? 'Сервіс' : 'Магазин'}</span></h1>
           <div className="flex bg-black rounded-lg p-1 overflow-x-auto">
              {mode === 'service' && ['schedule', 'clients', 'prices', 'gallery'].map(t => (
                  <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 rounded font-bold text-sm uppercase ${activeTab === t ? 'bg-[#FFC300] text-black' : 'text-zinc-400'}`}>{t === 'schedule' ? 'Розклад' : t === 'clients' ? 'Клієнти' : t === 'prices' ? 'Прайс' : t === 'gallery' ? 'Галерея' : 'Налашт.'}</button>
              ))}
              {mode === 'tyre' && ['tyres', 'orders', 'promo', 'seo', 'articles', 'stats', 'settings'].map(t => (
                  <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 rounded font-bold text-sm uppercase ${activeTab === t ? 'bg-[#FFC300] text-black' : 'text-zinc-400'}`}>{t === 'tyres' ? 'Шини' : t === 'promo' ? 'Маркетинг' : t === 'seo' ? 'SEO' : t === 'orders' ? 'Замовлення' : t === 'articles' ? 'Статті' : t === 'settings' ? 'Налашт.' : 'Стат.'}</button>
              ))}
              <button onClick={onLogout} className="px-4 py-2 text-zinc-500 hover:text-white ml-2 flex items-center gap-2"><LogOut size={16}/> Вихід</button>
           </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 print:hidden">
         {activeTab === 'schedule' && <ScheduleTab />}
         {activeTab === 'clients' && <ClientsTab />}
         {activeTab === 'gallery' && <GalleryTab />}
         {activeTab === 'prices' && <PricesTab />}
         {activeTab === 'settings' && <SettingsTab />}
         {activeTab === 'tyres' && <TyresTab />}
         {activeTab === 'orders' && <OrdersTab />}
         {activeTab === 'stats' && <StatsTab />}
         {activeTab === 'articles' && <ArticlesTab />}
         {activeTab === 'seo' && <SeoTab />}
         {activeTab === 'promo' && <PromoTab />}
      </main>
    </div>
  );
};

export default AdminPanel;
