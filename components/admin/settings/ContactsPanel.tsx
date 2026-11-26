import React from 'react';
import { Phone, MapPin, Link2 } from 'lucide-react';
import type { SettingsForm } from './useSettingsForm';

/** Part "Контакти": the phones, the address and the map link shown on the site. */
const ContactsPanel: React.FC<{ form: SettingsForm }> = ({ form }) => {
  const {
    contactSettings, setContactSettings,
  } = form;

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4">
        <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2 pb-4 border-b border-zinc-800"><Phone className="text-[#FFC300]" size={20}/> Контактна Інформація</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div>
               <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Телефон 1 (Основний)</label>
               <input type="text" value={contactSettings.phone1} onChange={e => setContactSettings({...contactSettings, phone1: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-bold" placeholder="099 167 44 24"/>
           </div>
           <div>
               <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Телефон 2 (Додатковий)</label>
               <input type="text" value={contactSettings.phone2} onChange={e => setContactSettings({...contactSettings, phone2: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-bold" placeholder="063 582 38 58"/>
           </div>
           <div>
               <label className="block text-zinc-400 text-xs font-bold uppercase mb-1 flex items-center gap-2"><MapPin size={14}/> Текст Адреси</label>
               <input type="text" value={contactSettings.address} onChange={e => setContactSettings({...contactSettings, address: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white" placeholder="м. Синельникове, вул. Квітнева 9"/>
           </div>
           <div>
               <label className="block text-zinc-400 text-xs font-bold uppercase mb-1 flex items-center gap-2"><Link2 size={14}/> Посилання на Google Maps</label>
               <input type="text" value={contactSettings.mapLink} onChange={e => setContactSettings({...contactSettings, mapLink: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-zinc-300 text-sm font-mono" placeholder="https://maps.google..."/>
           </div>
        </div>
    </div>
  );
};

export default ContactsPanel;
