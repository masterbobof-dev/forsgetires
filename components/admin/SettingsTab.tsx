
import React, { useState, useEffect } from 'react';
import { Settings, Briefcase, Plus, PackageX, Trash2, ToggleRight, ToggleLeft, KeyRound, Save, RotateCcw, X, AlertTriangle, Loader2, Phone, MapPin, Link2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Supplier } from '../../types';
import { PHONE_NUMBER_1, PHONE_NUMBER_2, MAP_DIRECT_LINK } from '../../constants';

const SettingsTab: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [enableStockQty, setEnableStockQty] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [tyrePin, setTyrePin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Contact Settings
  const [contactSettings, setContactSettings] = useState({
      phone1: PHONE_NUMBER_1,
      phone2: PHONE_NUMBER_2,
      address: 'м. Синельникове, вул. Квітнева 9',
      mapLink: MAP_DIRECT_LINK
  });

  // Modal State for Deletion
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteData, setDeleteData] = useState<{ id: number, name: string, code: string } | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchSuppliers();
  }, []);

  const showError = (msg: string) => { setErrorMessage(msg); setTimeout(() => setErrorMessage(''), 6000); };

  const fetchSettings = async () => {
    try {
        const { data } = await supabase.from('settings').select('*');
        if (data) {
            const newContacts = { ...contactSettings };
            data.forEach((r: any) => {
                if(r.key === 'enable_stock_quantity') setEnableStockQty(r.value === 'true');
                if(r.key === 'admin_pin') setAdminPin(r.value);
                if(r.key === 'tyre_admin_pin') setTyrePin(r.value);
                
                // Contacts
                if(r.key === 'contact_phone1') newContacts.phone1 = r.value;
                if(r.key === 'contact_phone2') newContacts.phone2 = r.value;
                if(r.key === 'contact_address') newContacts.address = r.value;
                if(r.key === 'contact_map_link') newContacts.mapLink = r.value;
            });
            setContactSettings(newContacts);
        }
    } catch (e) { console.error(e); }
  };

  const fetchSuppliers = async () => {
      const { data } = await supabase.from('suppliers').select('*').order('name');
      if (data) setSuppliers(data);
  };

  const handleAddSupplier = async () => {
      if (!newSupplierName.trim()) return;
      const { error } = await supabase.from('suppliers').insert([{ name: newSupplierName }]);
      if (error) showError("Помилка: " + error.message);
      else { setNewSupplierName(''); fetchSuppliers(); }
  };

  const handleDeleteSupplier = async (id: number) => {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) showError("Помилка (неможливо видалити, якщо є товари): " + error.message);
      else fetchSuppliers();
  };

  const openDeleteProductsModal = (e: React.MouseEvent, id: number, name: string) => {
      e.stopPropagation();
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      setDeleteData({ id, name, code });
      setInputCode('');
      setShowDeleteModal(true);
  };

  const executeDeleteProducts = async () => {
      if (!deleteData) return;
      
      if (inputCode !== deleteData.code) {
          showError("Невірний код підтвердження.");
          return;
      }

      setIsDeleting(true);
      try {
          const { error, count } = await supabase.from('tyres').delete().eq('supplier_id', deleteData.id).select('*', { count: 'exact' });
          
          if (error) {
              if (error.code === '23503') {
                  showError("Неможливо видалити: товари цього постачальника є в замовленнях.");
              } else {
                  showError("Помилка: " + error.message);
              }
          } else {
              showError(`Успішно видалено ${count} товарів.`);
          }
      } catch (err: any) {
          showError(err.message);
      } finally {
          setIsDeleting(false);
          setShowDeleteModal(false);
          setDeleteData(null);
      }
  };
  
  const toggleStockQty = async () => {
      const newVal = !enableStockQty;
      setEnableStockQty(newVal);
      await supabase.from('settings').upsert({ key: 'enable_stock_quantity', value: String(newVal) });
  };

  const saveAllSettings = async () => {
       if (adminPin) await supabase.from('settings').upsert({ key: 'admin_pin', value: adminPin });
       if (tyrePin) await supabase.from('settings').upsert({ key: 'tyre_admin_pin', value: tyrePin });
       
       await supabase.from('settings').upsert({ key: 'contact_phone1', value: contactSettings.phone1 });
       await supabase.from('settings').upsert({ key: 'contact_phone2', value: contactSettings.phone2 });
       await supabase.from('settings').upsert({ key: 'contact_address', value: contactSettings.address });
       await supabase.from('settings').upsert({ key: 'contact_map_link', value: contactSettings.mapLink });

       showError("Всі налаштування збережено!");
  };

  const processResetStock = async () => {
     try {
        const { data } = await supabase.from('tyres').select('id').eq('in_stock', false);
        if (data && data.length > 0) {
           const chunkSize = 50;
           for (let i = 0; i < data.length; i += chunkSize) {
              const chunk = data.slice(i, i + chunkSize).map(d => d.id);
              await supabase.from('tyres').update({ in_stock: true }).in('id', chunk);
           }
        }
        showError("Всі товари тепер в наявності!");
     } catch (e: any) { showError(e.message); }
  };

  return (
    <div className="animate-in fade-in max-w-4xl mx-auto space-y-8 pb-20">
        {errorMessage && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-red-900/90 text-white px-6 py-3 rounded-full border border-red-500 shadow-xl">{errorMessage}</div>}
       
       <h3 className="text-2xl font-black text-white flex items-center gap-2 mb-6"><Settings className="text-[#FFC300]"/> Глобальні Налаштування</h3>
       
       {/* CONTACTS SETTINGS */}
       <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl">
          <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Phone className="text-[#FFC300]" size={20}/> Контакти та Адреса</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
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

       {/* SUPPLIERS */}
       <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl">
          <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Briefcase className="text-[#FFC300]" size={20}/> Постачальники</h4>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
              <input type="text" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="Назва постачальника" className="bg-black border border-zinc-700 rounded-lg p-3 text-white flex-grow font-bold" />
              <button onClick={handleAddSupplier} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2 justify-center"><Plus size={18} /> Додати</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {suppliers.map(s => (
                  <div key={s.id} className="bg-black/50 p-3 rounded-lg border border-zinc-800 flex justify-between items-center group">
                      <span className="font-bold text-zinc-300">{s.name}</span>
                      <div className="flex gap-2 items-center">
                          <button 
                            onClick={(e) => openDeleteProductsModal(e, s.id, s.name)} 
                            className="text-zinc-500 hover:text-orange-500 p-2 bg-zinc-900 rounded border border-zinc-700 hover:border-orange-500 transition-all hover:bg-orange-900/20" 
                            title="Видалити ВСІ товари цього постачальника"
                          >
                              <PackageX size={18}/>
                          </button>
                          <button 
                            onClick={() => handleDeleteSupplier(s.id)} 
                            className="text-zinc-500 hover:text-red-500 p-2 bg-zinc-900 rounded border border-zinc-700 hover:border-red-500 transition-all hover:bg-red-900/20"
                            title="Видалити самого постачальника"
                          >
                              <Trash2 size={18}/>
                          </button>
                      </div>
                  </div>
              ))}
          </div>
       </div>

       <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <div><h4 className="text-lg font-bold text-white mb-1">Відображення залишків</h4><p className="text-zinc-400 text-sm">Показувати точну кількість на складі.</p></div>
          <button onClick={toggleStockQty} className={`flex items-center gap-3 px-6 py-3 rounded-xl font-bold transition-colors ${enableStockQty ? 'bg-[#FFC300] text-black' : 'bg-zinc-800 text-zinc-400'}`}>{enableStockQty ? <ToggleRight size={28}/> : <ToggleLeft size={28}/>} {enableStockQty ? 'Увімкнено' : 'Вимкнено'}</button>
       </div>

       <div className="bg-red-900/10 p-6 rounded-2xl border border-red-900/50 relative shadow-2xl">
          <h4 className="text-red-400 text-lg font-black uppercase mb-4 flex items-center gap-2"><KeyRound size={24}/> PIN Паролі</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
             <div><label className="block text-sm text-zinc-300 font-bold mb-2">PIN Сервіс</label><input type="text" value={adminPin} onChange={e => setAdminPin(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-xl p-4 text-white font-mono font-bold text-xl text-center" /></div>
             <div><label className="block text-sm text-zinc-300 font-bold mb-2">PIN Магазин</label><input type="text" value={tyrePin} onChange={e => setTyrePin(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-xl p-4 text-white font-mono font-bold text-xl text-center" /></div>
          </div>
          <div className="mt-6 flex justify-end"><button onClick={saveAllSettings} className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-xl flex items-center gap-2 shadow-lg"><Save size={20} /> Зберегти налаштування</button></div>
       </div>

       <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
          <h4 className="text-white text-lg font-bold mb-4">Дії</h4>
          <div className="flex flex-col md:flex-row gap-4 flex-wrap">
             <button onClick={() => { if(confirm("Скинути склад?")) processResetStock(); }} className="flex-1 bg-blue-900/30 text-blue-200 px-6 py-3 rounded-xl font-bold border border-blue-900/50 hover:bg-blue-900/50 flex items-center justify-center gap-2"><RotateCcw size={20}/> Всі в наявності</button>
          </div>
       </div>

       {/* CUSTOM MODAL FOR DELETE CONFIRMATION */}
       {showDeleteModal && deleteData && (
           <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
               <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm relative shadow-2xl flex flex-col items-center text-center">
                   <button onClick={() => setShowDeleteModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={24}/></button>
                   
                   <div className="bg-red-900/20 p-4 rounded-full text-red-500 mb-4 border border-red-900/50">
                       <AlertTriangle size={40} />
                   </div>
                   
                   <h3 className="text-xl font-black text-white mb-2">Видалення Товарів</h3>
                   <p className="text-zinc-400 text-sm mb-4">
                       Ви збираєтесь видалити ВСІ товари постачальника <span className="text-white font-bold">"{deleteData.name}"</span>. Це неможливо скасувати.
                   </p>

                   <div className="bg-black border border-zinc-700 rounded-xl p-4 mb-4 w-full">
                       <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Код підтвердження:</p>
                       <p className="text-3xl font-mono font-black text-[#FFC300] tracking-widest">{deleteData.code}</p>
                   </div>

                   <input 
                       type="text" 
                       value={inputCode} 
                       onChange={(e) => setInputCode(e.target.value)} 
                       placeholder="Введіть код" 
                       className="w-full bg-zinc-800 border border-zinc-600 rounded-xl p-3 text-center text-white font-bold text-lg mb-4 outline-none focus:border-red-500"
                   />

                   <button 
                       onClick={executeDeleteProducts} 
                       disabled={inputCode !== deleteData.code || isDeleting}
                       className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                   >
                       {isDeleting ? <Loader2 className="animate-spin" /> : 'ВИДАЛИТИ НАЗАВЖДИ'}
                   </button>
               </div>
           </div>
       )}
    </div>
  );
};

export default SettingsTab;
