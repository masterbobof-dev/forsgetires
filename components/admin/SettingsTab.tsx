
import React, { useState, useEffect } from 'react';
import { 
    Settings, Briefcase, Plus, PackageX, Trash2, ToggleRight, ToggleLeft, 
    KeyRound, Save, RotateCcw, X, AlertTriangle, Loader2, Phone, MapPin, 
    Link2, Shield, UserCog, Truck, Crown, LayoutGrid, Package, Smartphone,
    Eraser, Database, FileSearch, CheckCircle
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Supplier } from '../../types';
import { PHONE_NUMBER_1, PHONE_NUMBER_2, MAP_DIRECT_LINK } from '../../constants';

type SettingsSubTab = 'general' | 'security' | 'suppliers' | 'system';

const SettingsTab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsSubTab>('suppliers');
  
  // Data State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierCounts, setSupplierCounts] = useState<Record<number, number>>({});
  const [enableStockQty, setEnableStockQty] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  
  // Security Settings
  const [novaPoshtaKey, setNovaPoshtaKey] = useState('');
  const [supplierKey, setSupplierKey] = useState('');
  const [serviceEmail, setServiceEmail] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Contact Settings
  const [contactSettings, setContactSettings] = useState({
      phone1: PHONE_NUMBER_1,
      phone2: PHONE_NUMBER_2,
      address: 'м. Синельникове, вул. Квітнева 9',
      mapLink: MAP_DIRECT_LINK
  });

  // Modal State for Deletion (Unified for Products Only OR Full Cascade)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'products_only' | 'full_supplier'>('products_only');
  const [deleteData, setDeleteData] = useState<{ id: number, name: string, count: number } | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Storage Cleanup State
  const [cleaningStorage, setCleaningStorage] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [cleanupStatus, setCleanupStatus] = useState<string>('');
  const [cleanupResult, setCleanupResult] = useState<{ total: number, active: number, deleted: number } | null>(null);

  // Reset Stock State
  const [showResetStockConfirm, setShowResetStockConfirm] = useState(false);
  const [resettingStock, setResettingStock] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchSuppliersAndCounts();
  }, []);

  const showMsg = (msg: string, type: 'error' | 'success' = 'success') => {
      if (type === 'error') {
          setErrorMessage(msg);
          setTimeout(() => setErrorMessage(''), 5000);
      } else {
          setSuccessMessage(msg);
          setTimeout(() => setSuccessMessage(''), 3000);
      }
  };

  const fetchSettings = async () => {
    try {
        const { data } = await supabase.from('settings').select('*');
        if (data) {
            const newContacts = { ...contactSettings };
            data.forEach((r: any) => {
                if(r.key === 'enable_stock_quantity') setEnableStockQty(r.value === 'true');
                
                // Keys & Security
                if(r.key === 'nova_poshta_key') setNovaPoshtaKey(r.value);
                if(r.key === 'supplier_api_key') setSupplierKey(r.value);
                if(r.key === 'service_staff_email') setServiceEmail(r.value);
                if(r.key === 'admin_email') setAdminEmail(r.value);

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

  const fetchSuppliersAndCounts = async () => {
      // 1. Fetch Suppliers
      const { data: suppData } = await supabase.from('suppliers').select('*').order('name');
      if (suppData) setSuppliers(suppData);

      // 2. Fetch Item Counts (Optimized)
      try {
          // We select just supplier_id to minimize data transfer
          const { data: allTyres, error } = await supabase.from('tyres').select('supplier_id');
          
          if (!error && allTyres) {
              const counts: Record<number, number> = {};
              allTyres.forEach((t: any) => {
                  if (t.supplier_id) {
                      counts[t.supplier_id] = (counts[t.supplier_id] || 0) + 1;
                  }
              });
              setSupplierCounts(counts);
          }
      } catch (e) { console.error(e); }
  };

  const handleAddSupplier = async () => {
      if (!newSupplierName.trim()) return;
      const { error } = await supabase.from('suppliers').insert([{ name: newSupplierName }]);
      if (error) showMsg("Помилка: " + error.message, 'error');
      else { 
          setNewSupplierName(''); 
          fetchSuppliersAndCounts(); 
          showMsg("Постачальника додано");
      }
  };

  // --- DELETE LOGIC ---

  const initiateDelete = (mode: 'products_only' | 'full_supplier', id: number, name: string) => {
      const count = supplierCounts[id] || 0;
      
      // Generate random confirmation code
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      
      setDeleteMode(mode);
      setDeleteData({ id, name, count });
      setGeneratedCode(code);
      setInputCode('');
      setShowDeleteModal(true);
  };

  const executeDelete = async () => {
      if (!deleteData) return;
      if (inputCode !== generatedCode) { 
          showMsg("Невірний код підтвердження.", 'error'); 
          return; 
      }

      setIsDeleting(true);
      try {
          if (deleteMode === 'products_only') {
              // Delete only products
              const { error, count } = await supabase.from('tyres').delete().eq('supplier_id', deleteData.id).select('*', { count: 'exact' });
              if (error) throw error;
              showMsg(`Очищено склад постачальника "${deleteData.name}" (${count} шин).`);
          } else {
              // Full Cascade Delete: Products THEN Supplier
              // 1. Delete Products
              await supabase.from('tyres').delete().eq('supplier_id', deleteData.id);
              
              // 2. Delete Supplier
              const { error } = await supabase.from('suppliers').delete().eq('id', deleteData.id);
              if (error) throw error;
              
              showMsg(`Постачальника "${deleteData.name}" видалено разом з товарами.`);
          }
          
          fetchSuppliersAndCounts();
          setShowDeleteModal(false);
      } catch (err: any) {
          showMsg(err.message, 'error');
      } finally {
          setIsDeleting(false);
          setDeleteData(null);
      }
  };
  
  const toggleStockQty = async () => {
      const newVal = !enableStockQty;
      setEnableStockQty(newVal);
      await supabase.from('settings').upsert({ key: 'enable_stock_quantity', value: String(newVal) });
  };

  const saveAllSettings = async () => {
       await supabase.from('settings').upsert({ key: 'nova_poshta_key', value: novaPoshtaKey });
       await supabase.from('settings').upsert({ key: 'supplier_api_key', value: supplierKey });
       await supabase.from('settings').upsert({ key: 'service_staff_email', value: serviceEmail });
       await supabase.from('settings').upsert({ key: 'admin_email', value: adminEmail });

       await supabase.from('settings').upsert({ key: 'contact_phone1', value: contactSettings.phone1 });
       await supabase.from('settings').upsert({ key: 'contact_phone2', value: contactSettings.phone2 });
       await supabase.from('settings').upsert({ key: 'contact_address', value: contactSettings.address });
       await supabase.from('settings').upsert({ key: 'contact_map_link', value: contactSettings.mapLink });

       showMsg("Всі налаштування збережено!");
  };

  const processResetStock = async () => {
     setShowResetStockConfirm(false);
     setResettingStock(true);
     try {
        const { error } = await supabase.from('tyres').update({ in_stock: true }).neq('in_stock', true);
        if (error) throw error;
        showMsg("Всі товари відмічені як 'В наявності'!");
     } catch (e: any) { showMsg(e.message, 'error'); }
     finally { setResettingStock(false); }
  };

  // --- IMPROVED STORAGE CLEANUP LOGIC ---
  const executeStorageCleanup = async () => {
      setShowCleanupConfirm(false);
      setCleaningStorage(true);
      setCleanupStatus("Підготовка до сканування...");
      setCleanupResult(null);

      try {
          const activeFiles = new Set<string>();
          const getFileName = (url: string) => {
              if(!url) return null;
              try {
                  const parts = url.split('/');
                  // Decode URI to handle %20 vs spaces
                  return decodeURIComponent(parts[parts.length - 1]); 
              } catch { return null; }
          };

          // 1. SCAN TYRES
          setCleanupStatus("Крок 1/4: Сканування товарів...");
          const { data: tyres } = await supabase.from('tyres').select('image_url, gallery');
          tyres?.forEach(t => {
              if (t.image_url) { const n = getFileName(t.image_url); if(n) activeFiles.add(n); }
              if (t.gallery && Array.isArray(t.gallery)) {
                  t.gallery.forEach((g: string) => { const n = getFileName(g); if(n) activeFiles.add(n); });
              }
          });

          // 2. SCAN GALLERY & ARTICLES & SETTINGS
          setCleanupStatus(`Крок 2/4: Сканування медіа (Знайдено активних: ${activeFiles.size})...`);
          
          const { data: gallery } = await supabase.from('gallery').select('url');
          gallery?.forEach(g => { const n = getFileName(g.url); if(n) activeFiles.add(n); });

          const { data: articles } = await supabase.from('articles').select('image_url');
          articles?.forEach(a => { const n = getFileName(a.image_url); if(n) activeFiles.add(n); });

          const { data: settings } = await supabase.from('settings').select('value').eq('key', 'promo_data').single();
          if (settings && settings.value) {
              try {
                  const promos = JSON.parse(settings.value);
                  const promoArr = Array.isArray(promos) ? promos : [promos];
                  promoArr.forEach((p: any) => {
                      if(p.image_url) { const n = getFileName(p.image_url); if(n) activeFiles.add(n); }
                      if(p.backgroundImage) { const n = getFileName(p.backgroundImage); if(n) activeFiles.add(n); }
                  });
              } catch {}
          }

          // 3. SCAN STORAGE (FULL LOOP)
          setCleanupStatus(`Крок 3/4: Отримання списку файлів (Активних: ${activeFiles.size})...`);
          
          let allFiles: any[] = [];
          let offset = 0;
          let keepFetching = true;
          const BATCH = 1000; // Max allowed by Supabase per request

          while (keepFetching) {
              const { data: files, error } = await supabase.storage.from('galery').list('', { limit: BATCH, offset: offset });
              if (error) throw error;
              
              if (!files || files.length === 0) {
                  keepFetching = false;
              } else {
                  allFiles = [...allFiles, ...files];
                  offset += BATCH;
                  setCleanupStatus(`Знайдено файлів: ${allFiles.length}...`);
                  // Safety break for crazy loops
                  if (allFiles.length > 50000) keepFetching = false; 
              }
          }

          // 4. FIND & DELETE ORPHANS
          const filesToDelete = allFiles
              .filter(f => f.name !== '.emptyFolderPlaceholder' && !activeFiles.has(f.name))
              .map(f => f.name);

          setCleanupStatus(`Крок 4/4: Видалення ${filesToDelete.length} файлів...`);

          if (filesToDelete.length > 0) {
              // Delete in batches of 100 to be safe
              for (let i = 0; i < filesToDelete.length; i += 100) {
                  const chunk = filesToDelete.slice(i, i + 100);
                  await supabase.storage.from('galery').remove(chunk);
                  setCleanupStatus(`Видалено ${Math.min(i + 100, filesToDelete.length)} з ${filesToDelete.length}...`);
              }
          }

          setCleanupResult({
              total: allFiles.length,
              active: activeFiles.size,
              deleted: filesToDelete.length
          });
          setCleanupStatus("Завершено!");

      } catch (e: any) {
          setCleanupStatus("Помилка!");
          showMsg("Помилка очищення: " + e.message, 'error');
      } finally {
          setCleaningStorage(false);
      }
  };

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
           <div className="bg-zinc-900 rounded-2xl p-2 border border-zinc-800 space-y-1">
               <NavButton id="general" label="Контакти" icon={Smartphone} />
               <NavButton id="security" label="Безпека / API" icon={Shield} />
               <NavButton id="suppliers" label="Постачальники" icon={Briefcase} />
               <NavButton id="system" label="Склад / Система" icon={LayoutGrid} />
           </div>
           
           <button onClick={saveAllSettings} className="mt-4 bg-zinc-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-700 border border-zinc-700">
               <Save size={18}/> Зберегти зміни
           </button>
       </div>

       {/* MAIN CONTENT AREA */}
       <div className="flex-grow bg-zinc-900 rounded-2xl border border-zinc-800 p-6 shadow-xl overflow-y-auto">
           
           {/* --- TAB: GENERAL --- */}
           {activeTab === 'general' && (
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
           )}

           {/* --- TAB: SECURITY --- */}
           {activeTab === 'security' && (
               <div className="space-y-6 animate-in slide-in-from-right-4">
                   <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2 pb-4 border-b border-zinc-800"><Shield className="text-[#FFC300]" size={20}/> Безпека та Ключі</h4>
                   
                   <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                        <label className="block text-[#FFC300] text-xs font-bold uppercase mb-2 flex items-center gap-2"><Crown size={16}/> Email Власника (Головний Адмін)</label>
                        <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white font-bold" placeholder="admin@forsage.com"/>
                   </div>

                   <div className="bg-blue-900/10 p-4 rounded-xl border border-blue-900/30">
                        <label className="block text-blue-200 text-xs font-bold uppercase mb-2 flex items-center gap-2"><UserCog size={16}/> Вхід для Співробітника</label>
                        <p className="text-zinc-400 text-sm mb-3">Користувач з цим email матиме доступ <strong>ТІЛЬКИ</strong> до вкладки "Сервіс" (Розклад/Клієнти).</p>
                        <input type="email" value={serviceEmail} onChange={e => setServiceEmail(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-bold" placeholder="staff@forsage.com"/>
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
               </div>
           )}

           {/* --- TAB: SUPPLIERS --- */}
           {activeTab === 'suppliers' && (
               <div className="space-y-6 animate-in slide-in-from-right-4">
                   <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2 pb-4 border-b border-zinc-800"><Briefcase className="text-[#FFC300]" size={20}/> Керування Постачальниками</h4>
                   
                   <div className="flex gap-4 mb-6">
                       <input type="text" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="Назва нового постачальника" className="bg-black border border-zinc-700 rounded-lg p-3 text-white flex-grow font-bold" />
                       <button onClick={handleAddSupplier} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2 justify-center"><Plus size={18} /> Додати</button>
                   </div>

                   <div className="grid grid-cols-1 gap-3">
                       {suppliers.map(s => {
                           const count = supplierCounts[s.id] || 0;
                           return (
                               <div key={s.id} className="bg-black/40 p-4 rounded-xl border border-zinc-800 flex justify-between items-center hover:border-zinc-600 transition-colors group">
                                   <div className="flex items-center gap-3">
                                       <div className="bg-zinc-800 p-2 rounded-lg text-zinc-400">
                                           <Briefcase size={20}/>
                                       </div>
                                       <div>
                                           <h5 className="font-bold text-white text-lg">{s.name}</h5>
                                           <span className={`text-xs px-2 py-0.5 rounded font-bold ${count > 0 ? 'bg-green-900/30 text-green-400 border border-green-900/50' : 'bg-zinc-800 text-zinc-500'}`}>
                                               {count} позицій
                                           </span>
                                       </div>
                                   </div>
                                   
                                   <div className="flex gap-2">
                                       {/* DELETE PRODUCTS ONLY */}
                                       <button 
                                            onClick={() => initiateDelete('products_only', s.id, s.name)}
                                            className="p-2 bg-zinc-800 text-zinc-400 hover:text-orange-500 hover:bg-orange-900/20 rounded-lg border border-zinc-700 hover:border-orange-500 transition-all"
                                            title="Очистити склад (видалити товари)"
                                            disabled={count === 0}
                                       >
                                           <PackageX size={20}/>
                                       </button>
                                       
                                       {/* FULL DELETE (SUPPLIER + PRODUCTS) */}
                                       <button 
                                            onClick={() => initiateDelete('full_supplier', s.id, s.name)}
                                            className="p-2 bg-zinc-800 text-zinc-400 hover:text-red-500 hover:bg-red-900/20 rounded-lg border border-zinc-700 hover:border-red-500 transition-all"
                                            title="Видалити постачальника"
                                       >
                                           <Trash2 size={20}/>
                                       </button>
                                   </div>
                               </div>
                           );
                       })}
                   </div>
               </div>
           )}

           {/* --- TAB: SYSTEM --- */}
           {activeTab === 'system' && (
               <div className="space-y-6 animate-in slide-in-from-right-4">
                   <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2 pb-4 border-b border-zinc-800"><LayoutGrid className="text-[#FFC300]" size={20}/> Склад та Система</h4>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="bg-black/30 p-6 rounded-xl border border-zinc-800 flex flex-col justify-between">
                            <div>
                                <h4 className="text-lg font-bold text-white mb-1">Відображення залишків</h4>
                                <p className="text-zinc-400 text-sm mb-4">Якщо увімкнено, на сайті буде показано точну кількість шин. Якщо вимкнено — просто "В наявності".</p>
                            </div>
                            <button onClick={toggleStockQty} className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-bold transition-colors ${enableStockQty ? 'bg-[#FFC300] text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                                {enableStockQty ? <ToggleRight size={32}/> : <ToggleLeft size={32}/>} 
                                {enableStockQty ? 'УВІМКНЕНО' : 'ВИМКНЕНО'}
                            </button>
                       </div>

                       <div className="bg-black/30 p-6 rounded-xl border border-zinc-800 flex flex-col justify-between">
                            <div>
                                <h4 className="text-white text-lg font-bold mb-1 flex items-center gap-2"><Database size={18}/> Обслуговування БД</h4>
                                <p className="text-zinc-400 text-sm mb-4">Масові операції для відновлення статусів товарів.</p>
                            </div>
                            
                            {!showResetStockConfirm ? (
                                <button 
                                    onClick={() => setShowResetStockConfirm(true)} 
                                    disabled={resettingStock}
                                    className="w-full bg-blue-900/20 text-blue-300 px-6 py-3 rounded-xl font-bold border border-blue-900/50 hover:bg-blue-900/40 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                >
                                    <RotateCcw size={18}/> 
                                    Скинути статус (Все в наявності)
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={processResetStock} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl text-xs">Підтвердити</button>
                                    <button onClick={() => setShowResetStockConfirm(false)} className="flex-1 bg-zinc-700 text-white font-bold py-3 rounded-xl text-xs">Скасувати</button>
                                </div>
                            )}
                       </div>
                   </div>

                   {/* STORAGE CLEANUP */}
                   <div className="bg-red-900/10 p-6 rounded-xl border border-red-900/30 mt-6">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                            <div className="flex-grow">
                                <h4 className="text-red-400 text-lg font-bold mb-1 flex items-center gap-2"><Eraser size={20}/> Очищення Файлів (Garbage Collector)</h4>
                                <p className="text-zinc-400 text-sm max-w-xl mb-4">
                                    Сканує всі файли в сховищі, порівнює їх з базою даних (Товари, Статті, Банери) і видаляє ті, що не використовуються.
                                </p>
                                
                                {cleanupStatus && (
                                    <div className="bg-black/50 p-3 rounded-lg border border-zinc-700 font-mono text-xs text-zinc-300 mb-2 max-w-2xl">
                                        <div className="flex items-center gap-2 text-[#FFC300] mb-1">
                                            {cleaningStorage ? <Loader2 className="animate-spin" size={12}/> : <FileSearch size={12}/>}
                                            Статус:
                                        </div>
                                        {cleanupStatus}
                                    </div>
                                )}

                                {cleanupResult && (
                                    <div className="grid grid-cols-3 gap-2 max-w-lg mt-3">
                                        <div className="bg-zinc-800 p-2 rounded text-center">
                                            <div className="text-xs text-zinc-500 uppercase">Всього файлів</div>
                                            <div className="font-bold text-white">{cleanupResult.total}</div>
                                        </div>
                                        <div className="bg-zinc-800 p-2 rounded text-center">
                                            <div className="text-xs text-zinc-500 uppercase">Активних</div>
                                            <div className="font-bold text-blue-400">{cleanupResult.active}</div>
                                        </div>
                                        <div className="bg-zinc-800 p-2 rounded text-center border border-red-900/50 bg-red-900/10">
                                            <div className="text-xs text-red-400 uppercase">Видалено</div>
                                            <div className="font-bold text-red-500">{cleanupResult.deleted}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {!showCleanupConfirm && !cleaningStorage ? (
                                <button 
                                    onClick={() => setShowCleanupConfirm(true)} 
                                    disabled={cleaningStorage}
                                    className="w-full md:w-auto bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed h-fit whitespace-nowrap"
                                >
                                    <Trash2 size={20}/> Очистити сирітські фото
                                </button>
                            ) : cleaningStorage ? (
                                <button disabled className="w-full md:w-auto bg-zinc-800 text-zinc-400 font-bold px-6 py-4 rounded-xl flex items-center justify-center gap-2 h-fit whitespace-nowrap cursor-wait">
                                    <Loader2 className="animate-spin" size={20}/> Працюємо...
                                </button>
                            ) : (
                                <div className="flex flex-col gap-2 bg-black/50 p-4 rounded-xl border border-red-500 animate-in fade-in">
                                    <p className="text-red-400 font-bold text-xs">Видалити файли безповоротно?</p>
                                    <div className="flex gap-2">
                                        <button onClick={executeStorageCleanup} className="bg-red-600 text-white px-4 py-2 rounded font-bold text-xs hover:bg-red-500">Так, видалити</button>
                                        <button onClick={() => setShowCleanupConfirm(false)} className="bg-zinc-700 text-white px-4 py-2 rounded font-bold text-xs hover:bg-zinc-600">Скасувати</button>
                                    </div>
                                </div>
                            )}
                        </div>
                   </div>
               </div>
           )}

       </div>

       {/* UNIFIED DELETE MODAL */}
       {showDeleteModal && deleteData && (
           <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
               <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm relative shadow-2xl flex flex-col items-center text-center">
                   <button onClick={() => setShowDeleteModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={24}/></button>
                   
                   <div className="bg-red-900/20 p-4 rounded-full text-red-500 mb-4 border border-red-900/50">
                       <AlertTriangle size={40} />
                   </div>
                   
                   <h3 className="text-xl font-black text-white mb-2">
                       {deleteMode === 'products_only' ? 'Очищення Складу' : 'Видалення Постачальника'}
                   </h3>
                   
                   <p className="text-zinc-400 text-sm mb-4">
                       {deleteMode === 'products_only' 
                         ? <>Ви збираєтесь видалити <span className="text-white font-bold">{deleteData.count}</span> товарів від постачальника <span className="text-[#FFC300]">{deleteData.name}</span>.</>
                         : <>Увага! Видалення постачальника <span className="text-[#FFC300]">{deleteData.name}</span> призведе до видалення всіх його товарів (<span className="text-white font-bold">{deleteData.count} шт.</span>).</>
                       }
                       <br/><br/>
                       <span className="text-red-400 font-bold uppercase">Цю дію неможливо скасувати!</span>
                   </p>

                   <div className="bg-black border border-zinc-700 rounded-xl p-4 mb-4 w-full">
                       <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Код підтвердження:</p>
                       <p className="text-3xl font-mono font-black text-[#FFC300] tracking-widest">{generatedCode}</p>
                   </div>

                   <input 
                       type="text" 
                       value={inputCode} 
                       onChange={(e) => setInputCode(e.target.value)} 
                       placeholder="Введіть код" 
                       className="w-full bg-zinc-800 border border-zinc-600 rounded-xl p-3 text-center text-white font-bold text-lg mb-4 outline-none focus:border-red-500"
                   />

                   <button 
                       onClick={executeDelete} 
                       disabled={inputCode !== generatedCode || isDeleting}
                       className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                   >
                       {isDeleting ? <Loader2 className="animate-spin" /> : (deleteMode === 'products_only' ? 'ВИДАЛИТИ ТОВАРИ' : 'ВИДАЛИТИ ВСЕ')}
                   </button>
               </div>
           </div>
       )}
    </div>
  );
};

export default SettingsTab;
