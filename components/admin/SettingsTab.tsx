
import React, { useState, useEffect, useRef } from 'react';
import { 
    Settings, Briefcase, Plus, PackageX, Trash2, ToggleRight, ToggleLeft, 
    KeyRound, Save, RotateCcw, X, AlertTriangle, Loader2, Phone, MapPin, 
    Link2, Shield, UserCog, Truck, Crown, LayoutGrid, Package, Smartphone,
    Eraser, Database, FileSearch, CheckCircle, Tags, GitMerge, FileSpreadsheet, Stethoscope, Wand2, Upload, FileImage, Sparkles, FileCode, Eye, EyeOff, StopCircle, Tractor, Download
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Supplier } from '../../types';
import { PHONE_NUMBER_1, PHONE_NUMBER_2, MAP_DIRECT_LINK } from '../../constants';
import ExcelImportPanel from './sync/ExcelImportPanel';

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
  const [geminiKey, setGeminiKey] = useState(''); 
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

  // SMART PHOTO MATCHER STATE
  const [smartFiles, setSmartFiles] = useState<File[]>([]);
  const [isSmartMatching, setIsSmartMatching] = useState(false);
  const [smartStatus, setSmartStatus] = useState<string[]>([]);
  const [smartOverwrite, setSmartOverwrite] = useState(true); // Default to true for better UX
  const [smartExactMatch, setSmartExactMatch] = useState(false); 
  const smartInputRef = useRef<HTMLInputElement>(null);

  // Deletion Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'products_only' | 'full_supplier'>('products_only');
  const [deleteData, setDeleteData] = useState<{ id: number, name: string, count: number } | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

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
                if(r.key === 'nova_poshta_key') setNovaPoshtaKey(r.value);
                if(r.key === 'supplier_api_key') setSupplierKey(r.value);
                if(r.key === 'google_gemini_api_key') setGeminiKey(r.value);
                if(r.key === 'admin_email') setAdminEmail(r.value);
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
      const { data: suppData } = await supabase.from('suppliers').select('*').order('name');
      if (suppData) setSuppliers(suppData);
      const { data: tyreData } = await supabase.from('tyres').select('supplier_id');
      const counts: Record<number, number> = {};
      tyreData?.forEach((t: any) => { if (t.supplier_id) counts[t.supplier_id] = (counts[t.supplier_id] || 0) + 1; });
      setSupplierCounts(counts);
  };

  const handleAddSupplier = async () => {
      if (!newSupplierName.trim()) return;
      const { error } = await supabase.from('suppliers').insert([{ name: newSupplierName }]);
      if (error) showMsg("Помилка: " + error.message, 'error');
      else { setNewSupplierName(''); fetchSuppliersAndCounts(); showMsg("Постачальника додано"); }
  };

  const executeDelete = async () => {
      if (!deleteData) return;
      if (inputCode !== generatedCode) { showMsg("Невірний код.", 'error'); return; }
      setIsDeleting(true);
      try {
          if (deleteMode === 'products_only') {
              await supabase.from('tyres').delete().eq('supplier_id', deleteData.id);
              showMsg(`Очищено склад "${deleteData.name}".`);
          } else {
              await supabase.from('tyres').delete().eq('supplier_id', deleteData.id);
              await supabase.from('suppliers').delete().eq('id', deleteData.id);
              showMsg(`Видалено постачальника "${deleteData.name}".`);
          }
          fetchSuppliersAndCounts();
          setShowDeleteModal(false);
      } catch (err: any) { showMsg(err.message, 'error'); } finally { setIsDeleting(false); setDeleteData(null); }
  };

  const saveAllSettings = async () => {
       await supabase.from('settings').upsert([
           { key: 'nova_poshta_key', value: novaPoshtaKey },
           { key: 'supplier_api_key', value: supplierKey },
           { key: 'admin_email', value: adminEmail },
           { key: 'contact_phone1', value: contactSettings.phone1 },
           { key: 'contact_phone2', value: contactSettings.phone2 },
           { key: 'contact_address', value: contactSettings.address },
           { key: 'contact_map_link', value: contactSettings.mapLink }
       ]);
       showMsg("Налаштування збережено!");
  };

  const handleSmartUpload = async () => {
      if (smartFiles.length === 0) return;
      setIsSmartMatching(true);
      setSmartStatus(['Початок обробки...']);
      
      try {
          let updatedCount = 0;
          
          for (const file of smartFiles) {
              const lastDotIndex = file.name.lastIndexOf('.');
              const fileNameOnly = lastDotIndex !== -1 ? file.name.substring(0, lastDotIndex) : file.name;
              const fileNameClean = fileNameOnly.replace(/[()]/g, " ").replace(/[-_.,]/g, " ").trim();
              
              let matches: any[] = [];
              if (smartExactMatch) {
                  const { data: exact } = await supabase.from('tyres').select('id, title, image_url')
                      .or(`title.ilike."${fileNameOnly}",product_number.eq."${fileNameOnly}",catalog_number.eq."${fileNameOnly}"`);
                  matches = exact || [];
              } else {
                  const keywords = fileNameClean.split(/\s+/).filter(w => w.length >= 3);
                  if (keywords.length > 0) {
                      const searchTerm = keywords.sort((a,b) => b.length - a.length)[0];
                      const { data: potential } = await supabase.from('tyres').select('id, title, image_url').ilike('title', `%${searchTerm}%`);
                      if (potential) {
                          matches = potential.filter(p => {
                              const titleLower = p.title.toLowerCase();
                              const matchCount = keywords.reduce((acc, k) => titleLower.includes(k.toLowerCase()) ? acc + 1 : acc, 0);
                              return matchCount >= Math.min(2, keywords.length);
                          });
                      }
                  }
              }

              if (matches.length === 0) {
                  setSmartStatus(prev => [`НЕ ЗНАЙДЕНО: ${file.name}`, ...prev]);
                  continue;
              }

              // Filter products that actually need update
              const idsToUpdate = matches.filter(p => {
                  const currentUrl = (p.image_url || '').trim().toLowerCase();
                  const isEmpty = !currentUrl || currentUrl === 'null' || currentUrl === 'undefined' || currentUrl === '';
                  return smartOverwrite || isEmpty;
              }).map(p => p.id);

              if (idsToUpdate.length > 0) {
                  const storageName = `smart_${Date.now()}_${file.name.replace(/\s/g, '_')}`;
                  const { error: uploadError } = await supabase.storage.from('galery').upload(storageName, file);
                  
                  if (!uploadError) {
                      const { data: urlData } = supabase.storage.from('galery').getPublicUrl(storageName);
                      const publicUrl = urlData.publicUrl;
                      
                      const { error: updError } = await supabase.from('tyres')
                          .update({ image_url: publicUrl, in_stock: true })
                          .in('id', idsToUpdate);
                          
                      if (!updError) {
                          updatedCount += idsToUpdate.length;
                          setSmartStatus(prev => [`УСПІХ: ${file.name} -> ${idsToUpdate.length} тов.`, ...prev]);
                      } else {
                          setSmartStatus(prev => [`ПОМИЛКА БД: ${file.name}`, ...prev]);
                      }
                  } else {
                      setSmartStatus(prev => [`ПОМИЛКА ЗАВАНТАЖЕННЯ: ${file.name}`, ...prev]);
                  }
              } else {
                  setSmartStatus(prev => [`ПРОПУЩЕНО (вже є фото): ${file.name}`, ...prev]);
              }
          }
          
          setSmartStatus(prev => [`ЗАВЕРШЕНО. Оновлено товарів: ${updatedCount}`, ...prev]);
          setSmartFiles([]);
          showMsg(`Готово! Оновлено ${updatedCount} товарів.`);
          fetchSuppliersAndCounts();
      } catch (e: any) {
          setSmartStatus(prev => [`КРИТИЧНА ПОМИЛКА: ${e.message}`, ...prev]);
      } finally {
          setIsSmartMatching(false);
      }
  };

  const generateAndDownloadSitemap = async () => {
      try {
          const { data } = await supabase.from('tyres').select('id, created_at').order('id', { ascending: true });
          if (!data) return;
          const date = new Date().toISOString().split('T')[0];
          let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://forsage-sinelnikove.com/</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`;
          data.forEach(item => {
              const itemDate = new Date(item.created_at || Date.now()).toISOString().split('T')[0];
              xml += `\n  <url>\n    <loc>https://forsage-sinelnikove.com/?product_id=${item.id}</loc>\n    <lastmod>${itemDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
          });
          xml += `\n</urlset>`;
          const blob = new Blob([xml], { type: 'text/xml' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'sitemap.xml';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          showMsg("Sitemap згенеровано!");
      } catch (e: any) { showMsg("Помилка: " + e.message, 'error'); }
  };

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
       
       <div className="md:w-64 flex-shrink-0 flex flex-col gap-2">
           <h3 className="text-xl font-black text-white px-4 mb-2 flex items-center gap-2"><Settings className="text-[#FFC300]"/> Налаштування</h3>
           <div className="bg-zinc-950 rounded-2xl p-2 border border-zinc-800 space-y-1">
               <NavButton id="general" label="Контакти" icon={Smartphone} />
               <NavButton id="security" label="Безпека / API" icon={Shield} />
               <NavButton id="suppliers" label="Постачальники" icon={Briefcase} />
               <NavButton id="system" label="Склад / SEO" icon={LayoutGrid} />
           </div>
           <button onClick={saveAllSettings} className="mt-4 bg-zinc-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-700 border border-zinc-700"><Save size={18}/> Зберегти зміни</button>
       </div>

       <div className="flex-grow bg-zinc-900 rounded-2xl border border-zinc-800 p-6 shadow-xl overflow-y-auto min-h-[500px]">
           {activeTab === 'general' && (
               <div className="space-y-6 animate-in slide-in-from-right-4">
                   <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2 pb-4 border-b border-zinc-800"><Phone className="text-[#FFC300]" size={20}/> Контактна Інформація</h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Телефон 1</label><input type="text" value={contactSettings.phone1} onChange={e => setContactSettings({...contactSettings, phone1: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-bold" /></div>
                      <div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Телефон 2</label><input type="text" value={contactSettings.phone2} onChange={e => setContactSettings({...contactSettings, phone2: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-bold" /></div>
                   </div>
               </div>
           )}

           {activeTab === 'suppliers' && (
               <div className="space-y-6 animate-in slide-in-from-right-4">
                   <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2 pb-4 border-b border-zinc-800"><Briefcase className="text-[#FFC300]" size={20}/> Керування Постачальниками</h4>
                   <div className="flex gap-4 mb-6">
                       <input type="text" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="Назва постачальника" className="bg-black border border-zinc-700 rounded-lg p-3 text-white flex-grow font-bold" />
                       <button onClick={handleAddSupplier} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2"><Plus size={18} /> Додати</button>
                   </div>
                   <div className="grid grid-cols-1 gap-3">
                       {suppliers.map(s => (
                           <div key={s.id} className="bg-black/40 p-4 rounded-xl border border-zinc-800 flex justify-between items-center group">
                               <div><h5 className="font-bold text-white text-lg">{s.name}</h5><span className="text-xs text-zinc-500">{supplierCounts[s.id] || 0} позицій</span></div>
                               <div className="flex gap-2">
                                   <button onClick={() => { setDeleteMode('products_only'); setDeleteData({id: s.id, name: s.name, count: supplierCounts[s.id] || 0}); setGeneratedCode(Math.floor(1000+Math.random()*9000).toString()); setShowDeleteModal(true); }} className="p-2 bg-zinc-800 text-zinc-400 hover:text-orange-500 rounded-lg" title="Очистити склад"><PackageX size={20}/></button>
                                   <button onClick={() => { setDeleteMode('full_supplier'); setDeleteData({id: s.id, name: s.name, count: supplierCounts[s.id] || 0}); setGeneratedCode(Math.floor(1000+Math.random()*9000).toString()); setShowDeleteModal(true); }} className="p-2 bg-zinc-800 text-zinc-400 hover:text-red-500 rounded-lg" title="Видалити"><Trash2 size={20}/></button>
                               </div>
                           </div>
                       ))}
                   </div>
               </div>
           )}

           {activeTab === 'system' && (
               <div className="space-y-6 animate-in slide-in-from-right-4">
                   <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2 pb-4 border-b border-zinc-800"><LayoutGrid className="text-[#FFC300]" size={20}/> Склад та Робота з Фото</h4>
                   
                   <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-1 mb-6 h-[500px] overflow-hidden">
                       <ExcelImportPanel suppliers={suppliers} />
                   </div>

                   <div className="bg-blue-900/10 p-6 rounded-xl border border-blue-900/30">
                       <h4 className="text-blue-400 text-lg font-bold mb-1 flex items-center gap-2"><FileCode size={20}/> Sitemap.xml</h4>
                       <p className="text-zinc-400 text-sm mb-6">Згенеруйте файл та завантажте його на хостинг для індексації Google.</p>
                       <button onClick={generateAndDownloadSitemap} className="bg-blue-600 hover:bg-blue-500 text-white font-black px-8 py-4 rounded-xl flex items-center gap-3"><Download size={20}/> ЗАВАНТАЖИТИ SITEMAP</button>
                   </div>

                   {/* SMART PHOTO MATCHING UI */}
                   <div className="mt-6 bg-black/30 p-6 rounded-xl border border-zinc-800 relative overflow-hidden group">
                        <div className="absolute -right-6 -top-6 text-[#FFC300]/10 group-hover:scale-110 transition-transform"><Wand2 size={120} /></div>
                        <div className="relative z-10">
                            <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Wand2 size={18} className="text-[#FFC300]"/> Розумне завантаження фото</h4>
                            <p className="text-zinc-400 text-sm mb-4">Назва файлу має містити бренд та модель (напр. `Michelin Alpin 6.jpg`).</p>
                            
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-4 bg-zinc-900 p-4 rounded-xl border border-dashed border-zinc-700 hover:border-[#FFC300] cursor-pointer" onClick={() => smartInputRef.current?.click()}>
                                    <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-500 transition-colors"><Upload size={24}/></div>
                                    <div>
                                        <span className="text-zinc-300 text-sm font-bold block">Вибрати файли</span>
                                        <span className="text-zinc-500 text-xs">{smartFiles.length > 0 ? `Обрано: ${smartFiles.length} шт.` : 'JPG, PNG'}</span>
                                    </div>
                                    <input type="file" multiple ref={smartInputRef} onChange={e => setSmartFiles(Array.from(e.target.files || []))} className="hidden" accept="image/*" />
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 bg-zinc-800/30 p-3 rounded-lg">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={smartOverwrite} onChange={e => setSmartOverwrite(e.target.checked)} className="w-5 h-5 accent-[#FFC300]" />
                                        <span className="text-zinc-300 text-sm font-bold">Завжди перезаписувати існуючі фото</span>
                                    </label>
                                </div>

                                <button onClick={handleSmartUpload} disabled={isSmartMatching || smartFiles.length === 0} className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black py-4 rounded-xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50">
                                    {isSmartMatching ? <Loader2 className="animate-spin" size={20}/> : <Sparkles size={20}/>}
                                    РОЗПОЧАТИ ПРИВ'ЯЗКУ
                                </button>

                                {smartStatus.length > 0 && (
                                    <div className="bg-black border border-zinc-700 rounded-xl p-3 max-h-60 overflow-y-auto text-xs font-mono">
                                        {smartStatus.map((s, i) => (
                                            <div key={i} className={`py-1 ${s.includes('УСПІХ') ? 'text-green-400' : s.includes('НЕ ЗНАЙДЕНО') ? 'text-red-400' : 'text-zinc-500'}`}>
                                                {s}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                   </div>
               </div>
           )}
       </div>

       {/* Delete Modal */}
       {showDeleteModal && deleteData && (
           <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm text-center relative shadow-2xl">
                   <h3 className="text-xl font-black text-white mb-2">{deleteMode === 'products_only' ? 'Очищення Складу' : 'Видалення Постачальника'}</h3>
                   <div className="bg-black border border-zinc-700 rounded-xl p-4 mb-4 w-full font-mono text-[#FFC300] tracking-widest text-2xl">{generatedCode}</div>
                   <input type="text" value={inputCode} onChange={(e) => setInputCode(e.target.value)} placeholder="Введіть код" className="w-full bg-zinc-800 border border-zinc-600 rounded-xl p-3 text-center text-white font-bold mb-4"/>
                   <div className="flex gap-2">
                       <button onClick={() => setShowDeleteModal(false)} className="flex-1 bg-zinc-800 text-white font-bold py-3 rounded-xl">СКАСУВАТИ</button>
                       <button onClick={executeDelete} disabled={inputCode !== generatedCode || isDeleting} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl">ВИДАЛИТИ</button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default SettingsTab;
