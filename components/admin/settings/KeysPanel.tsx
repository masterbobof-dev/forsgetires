import React from 'react';
import { Shield, Crown, Truck, KeyRound } from 'lucide-react';
import type { SettingsForm } from './useSettingsForm';
import PaymentPanel from './PaymentPanel';

/** Part "API Ключі": the owner's e-mail, delivery and supplier keys. (AI lives in the program, not on the site.) */
const KeysPanel: React.FC<{ form: SettingsForm }> = ({ form }) => {
  const {
    adminEmail, setAdminEmail, novaPoshtaKey, setNovaPoshtaKey, supplierKey, setSupplierKey,
  } = form;

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4">
        <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2 pb-4 border-b border-zinc-800"><Shield className="text-[#FFC300]" size={20}/> Безпека та Ключі</h4>
        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
             <label className="block text-[#FFC300] text-xs font-bold uppercase mb-2 flex items-center gap-2"><Crown size={16}/> Email Власника (Головний Адмін)</label>
             <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white font-bold" placeholder="admin@forsage.com"/>
        </div>




        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-800">
             <div>
                 <label className="block text-zinc-400 text-xs font-bold uppercase mb-1 flex items-center gap-2"><Truck size={14}/> Ключ Нова Пошта</label>
                 <input type="text" value={novaPoshtaKey} onChange={e => setNovaPoshtaKey(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-mono text-sm" placeholder="Ключ API Нової Пошти"/>
             </div>
             <div>
                 <label className="block text-zinc-400 text-xs font-bold uppercase mb-1 flex items-center gap-2"><KeyRound size={14}/> Ключ Постачальника (Omega)</label>
                 <input type="password" value={supplierKey} onChange={e => setSupplierKey(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-mono text-sm" placeholder="API ключ постачальника"/>
             </div>
        </div>
        <PaymentPanel />
    </div>
  );
};

export default KeysPanel;
