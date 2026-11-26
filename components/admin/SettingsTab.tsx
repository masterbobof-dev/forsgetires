
import React, { useState, useEffect } from 'react';
import { Settings, Briefcase, Save, AlertTriangle, Shield, UserCog, LayoutGrid, Smartphone } from 'lucide-react';
import type { SettingsSubTab } from './settings/settingsTypes';
// Logic
import { useSettingsMessages } from './settings/useSettingsMessages';
import { useSettingsForm } from './settings/useSettingsForm';
import { useSuppliers } from './settings/useSuppliers';
import { useSmartPhotoUpload } from './settings/useSmartPhotoUpload';
// Parts of the tab
import ContactsPanel from './settings/ContactsPanel';
import KeysPanel from './settings/KeysPanel';
import AccessPanel from './settings/AccessPanel';
import SuppliersPanel from './settings/SuppliersPanel';
import StockImportPanel from './settings/StockImportPanel';
import SupplierDeleteModal from './settings/SupplierDeleteModal';

/**
 * Admin tab "Налаштування": the menu of its parts on the left, the chosen part on the right.
 * This file only ties the parts together; the parts and the logic live in ./settings.
 */
const SettingsTab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsSubTab>('suppliers');
  const { errorMessage, successMessage, showMsg } = useSettingsMessages();
  const supp = useSuppliers(showMsg);
  const form = useSettingsForm(showMsg);
  const smart = useSmartPhotoUpload();
  const { saveAllSettings } = form;

  useEffect(() => {
    form.fetchSettings();
    supp.fetchSuppliersAndCounts();
  }, []);

  // --- RENDER HELPERS ---
  const NavButton = ({ id, label, icon: Icon }: { id: SettingsSubTab, label: string, icon: any }) => (
      <button 
        onClick={() => setActiveTab(id)}
        className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors ${activeTab === id ? 'bg-[#FFC300] text-black shadow-lg' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
      >
          <Icon size={18} /> {label}
      </button>
  );

  return (
    <div className="animate-in fade-in h-full flex flex-col md:flex-row gap-6 pb-20">
        {errorMessage && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-red-900/90 text-white px-6 py-3 rounded-full border border-red-500 shadow-xl flex items-center gap-2"><AlertTriangle size={18}/> {errorMessage}</div>}
        {successMessage && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-green-600/90 text-white px-6 py-3 rounded-full border border-green-400 shadow-xl font-bold">{successMessage}</div>}

       {/* SIDEBAR NAVIGATION */}
       <div className="md:w-64 flex-shrink-0 flex flex-col gap-2">
           <h3 className="text-xl font-black text-white px-4 mb-2 flex items-center gap-2"><Settings className="text-[#FFC300]"/> Налаштування</h3>
           <div className="bg-zinc-950 rounded-2xl p-2 border border-zinc-800 space-y-1">
               <NavButton id="general" label="Контакти" icon={Smartphone} />
               <NavButton id="security" label="API Ключі" icon={Shield} />
               <NavButton id="manager" label="Менеджер / Доступ" icon={UserCog} />
               <NavButton id="suppliers" label="Постачальники" icon={Briefcase} />
               <NavButton id="system" label="Склад / Імпорт" icon={LayoutGrid} />
           </div>

           <button onClick={saveAllSettings} className="mt-4 bg-zinc-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-700 border border-zinc-700">
               <Save size={18}/> Зберегти зміни
           </button>
       </div>

       {/* MAIN CONTENT AREA */}
       <div className="flex-grow bg-zinc-900 rounded-2xl border border-zinc-800 p-6 shadow-xl overflow-y-auto min-h-[500px]">

           {/* --- TAB: GENERAL --- */}
           {activeTab === 'general' && <ContactsPanel form={form} />}

           {/* --- TAB: SECURITY --- */}
           {activeTab === 'security' && <KeysPanel form={form} />}

           {/* --- TAB: MANAGER / ACCESS --- */}
           {activeTab === 'manager' && <AccessPanel form={form} />}

           {/* --- TAB: SUPPLIERS --- */}
           {activeTab === 'suppliers' && <SuppliersPanel supp={supp} />}

           {/* --- TAB: SYSTEM / WAREHOUSE / IMPORT / AI --- */}
           {activeTab === 'system' && <StockImportPanel smart={smart} />}
       </div>

       {/* UNIFIED DELETE MODAL */}
       {supp.showDeleteModal && supp.deleteData && <SupplierDeleteModal supp={supp} deleteData={supp.deleteData} />}
    </div>
  );
};

export default SettingsTab;
