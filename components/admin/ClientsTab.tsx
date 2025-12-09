
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { Users, Search, History, Trash2, Edit2, X } from 'lucide-react';

const ClientsTab: React.FC = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientHistory, setSelectedClientHistory] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingClient, setEditingClient] = useState<any | null>(null);

  useEffect(() => { fetchClients(); }, []);

  const fetchClients = async () => { const { data } = await supabase.from('bookings').select('*').order('booking_date', { ascending: false }); if (data) setClients(data); };
  
  const uniqueClients = useMemo(() => {
     const map = new Map();
     clients.forEach((c) => {
        if (!map.has(c.customer_phone)) map.set(c.customer_phone, { ...c, total_visits: 0 });
        const entry = map.get(c.customer_phone);
        entry.total_visits += 1;
        if (new Date(c.booking_date) > new Date(entry.booking_date)) entry.booking_date = c.booking_date;
     });
     let arr = Array.from(map.values());
     if (clientSearch.trim()) arr = arr.filter(c => c.customer_phone.includes(clientSearch.trim()) || c.customer_name.toLowerCase().includes(clientSearch.toLowerCase()));
     return arr;
  }, [clients, clientSearch]);

  const handleDeleteClient = async (phone: string) => {
      if (confirm("Видалити клієнта та всю історію?")) {
          await supabase.from('bookings').delete().eq('customer_phone', phone);
          fetchClients();
      }
  };

  const handleEditClientSave = async () => { 
      if(!editingClient) return; 
      const oldPhone = selectedClientHistory[0]?.customer_phone; 
      if (oldPhone) { 
          await supabase.from('bookings').update({ customer_name: editingClient.customer_name, customer_phone: editingClient.customer_phone }).eq('customer_phone', oldPhone); 
          setEditingClient(null); setShowHistoryModal(false); fetchClients(); 
      } 
  };

  return (
    <div className="animate-in fade-in">
        <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-2"><Users className="text-[#FFC300]"/> Клієнти</h3>
        <div className="mb-4 relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} /><input type="text" placeholder="Пошук..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-white"/></div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl"><table className="w-full text-left text-sm"><thead className="bg-black text-zinc-500 uppercase font-bold text-xs"><tr><th className="p-4">Ім'я</th><th className="p-4">Телефон</th><th className="p-4">Візитів</th><th className="p-4 text-right">Останній</th><th className="p-4"></th></tr></thead><tbody className="divide-y divide-zinc-800">{uniqueClients.map((c, idx) => (<tr key={idx} className="hover:bg-zinc-800/50 cursor-pointer" onClick={() => { setSelectedClientHistory(clients.filter(x => x.customer_phone === c.customer_phone)); setShowHistoryModal(true); }}><td className="p-4 font-bold text-white text-lg">{c.customer_name}</td><td className="p-4 font-mono text-[#FFC300] font-bold">{c.customer_phone}</td><td className="p-4 text-zinc-400 font-bold">{c.total_visits}</td><td className="p-4 text-right text-zinc-400">{c.booking_date}</td><td className="p-4 text-right flex justify-end gap-2"><button onClick={(e) => { e.stopPropagation(); handleDeleteClient(c.customer_phone); }} className="p-2 rounded bg-red-900/20 text-red-500"><Trash2 size={18} /></button></td></tr>))}</tbody></table></div>
        {showHistoryModal && (
             <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
                 <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-2xl relative shadow-2xl h-[80vh] flex flex-col">
                     <button onClick={() => setShowHistoryModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={24}/></button>
                     {editingClient ? (
                        <div className="mb-6 space-y-3 bg-zinc-800 p-4 rounded-xl border border-zinc-700"><input value={editingClient.customer_name} onChange={e => setEditingClient({...editingClient, customer_name: e.target.value})} className="w-full bg-black p-2 rounded text-white" /><input value={editingClient.customer_phone} onChange={e => setEditingClient({...editingClient, customer_phone: e.target.value})} className="w-full bg-black p-2 rounded text-white" /><div className="flex gap-2"><button onClick={handleEditClientSave} className="bg-green-600 text-white px-4 py-2 rounded">Зберегти</button><button onClick={() => setEditingClient(null)} className="bg-zinc-700 text-white px-4 py-2 rounded">Скасувати</button></div></div>
                     ) : (
                        <div className="mb-6"><h3 className="text-2xl font-black text-white">{selectedClientHistory[0]?.customer_name}</h3><div className="flex items-center gap-2 mt-1"><p className="text-[#FFC300] font-mono text-lg">{selectedClientHistory[0]?.customer_phone}</p><button onClick={() => setEditingClient(selectedClientHistory[0])} className="text-zinc-500 hover:text-white p-1"><Edit2 size={16}/></button></div></div>
                     )}
                     <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                         <table className="w-full text-left text-sm"><thead className="text-zinc-500 border-b border-zinc-800 uppercase text-xs"><tr><th className="pb-2">Дата</th><th className="pb-2">Послуга</th><th className="pb-2">Радіус</th></tr></thead><tbody className="divide-y divide-zinc-800">{selectedClientHistory.map(item => (<tr key={item.id}><td className="py-3 font-mono text-zinc-300">{item.booking_date} {item.start_time}</td><td className="py-3 font-bold text-white">{item.service_label}</td><td className="py-3 text-zinc-400">{item.radius}</td></tr>))}</tbody></table>
                     </div>
                 </div>
             </div>
         )}
    </div>
  );
};

export default ClientsTab;
