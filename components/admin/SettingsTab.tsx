
import React, { useState, useEffect, useRef } from 'react';
import { 
    Settings, Briefcase, Plus, PackageX, Trash2, 
    KeyRound, Save, X, AlertTriangle, Loader2, Phone, MapPin, 
    Link2, Shield, UserCog, Truck, Crown, LayoutGrid, Smartphone,
    CheckCircle, Wand2, Upload, Sparkles, Eye, EyeOff, Globe
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Supplier } from '../../types';
import { PHONE_NUMBER_1, PHONE_NUMBER_2, MAP_DIRECT_LINK } from '../../constants';
import ExcelImportPanel from './sync/ExcelImportPanel';
import { normalizeProviderId, type AIProviderId } from '../../aiSeoClient';
import { fetchAdminAiKeyStatus, saveAdminAiKeys } from '../../aiProxyClient';

type SettingsSubTab = 'general' | 'security' | 'suppliers' | 'system';

const SettingsTab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsSubTab>('suppliers');
  
  // Data State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierCounts, setSupplierCounts] = useState<Record<number, number>>({});
  const [newSupplierName, setNewSupplierName] = useState('');
  
  // Security Settings
  const [novaPoshtaKey, setNovaPoshtaKey] = useState('');
  const [supplierKey, setSupplierKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('https://api.openai.com/v1');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [groqKey, setGroqKey] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [aiProvider, setAiProvider] = useState<AIProviderId>('gemini');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showCustomKey, setShowCustomKey] = useState(false);
  const [showSerperKey, setShowSerperKey] = useState(false);
  const [serperKey, setSerperKey] = useState('');
  const [hasKeyGemini, setHasKeyGemini] = useState(false);
  const [hasKeyOpenai, setHasKeyOpenai] = useState(false);
  const [hasKeyGroq, setHasKeyGroq] = useState(false);
  const [hasKeyCustom, setHasKeyCustom] = useState(false);
  const [hasKeySerper, setHasKeySerper] = useState(false);
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

  // Modal State for Deletion
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'products_only' | 'full_supplier'>('products_only');
  const [deleteData, setDeleteData] = useState<{ id: number, name: string, count: number } | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // SMART PHOTO MATCHER STATE
  const [smartFiles, setSmartFiles] = useState<File[]>([]);
  const [isSmartMatching, setIsSmartMatching] = useState(false);
  const [smartStatus, setSmartStatus] = useState<string[]>([]);
  const [smartOverwrite, setSmartOverwrite] = useState(false);
  const [smartExactMatch, setSmartExactMatch] = useState(false);
  const smartInputRef = useRef<HTMLInputElement>(null);

  const refreshAiKeyFlags = async () => {
    try {
      const s = await fetchAdminAiKeyStatus();
      setHasKeyGemini(s.hasGemini);
      setHasKeyOpenai(s.hasOpenai);
      setHasKeyGroq(s.hasGroq);
      setHasKeyCustom(s.hasCustom);
      setHasKeySerper(s.hasSerper);
      if (s.customUrl) setCustomBaseUrl(s.customUrl);
      if (s.customModel) setCustomModel(s.customModel);
    } catch {
      setHasKeyGemini(false);
      setHasKeyOpenai(false);
      setHasKeyGroq(false);
      setHasKeyCustom(false);
      setHasKeySerper(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchSuppliersAndCounts();
    refreshAiKeyFlags();
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
                // Keys & Security
                if(r.key === 'nova_poshta_key') setNovaPoshtaKey(r.value);
                if(r.key === 'supplier_api_key') setSupplierKey(r.value);
                if(r.key === 'ai_provider') setAiProvider(normalizeProviderId(r.value));
                if(r.key === 'service_staff_email') setServiceEmail(r.value);
                if(r.key === 'admin_email') setAdminEmail(r.value);
                if(r.key === 'ai_openai_base_url') setOpenaiBaseUrl(r.value);
                if(r.key === 'ai_openai_model') setOpenaiModel(r.value);
                if(r.key === 'ai_custom_base_url') setCustomBaseUrl(r.value);
                if(r.key === 'ai_custom_model') setCustomModel(r.value);

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

  // Helper to fetch ALL rows with pagination
  const fetchAllIds = async (table: string, columns: string = 'id', filter: (q: any) => any = q => q) => {
      let allData: any[] = [];
      let page = 0;
      const size = 1000;
      while(true) {
          let q = supabase.from(table).select(columns);
          q = filter(q);
          const { data, error } = await q.range(page*size, (page+1)*size - 1);
          if(error) throw error;
          if(!data || data.length === 0) break;
          allData.push(...data);
          if(data.length < size) break;
          page++;
      }
      return allData;
  };

  const fetchSuppliersAndCounts = async () => {
      const { data: suppData } = await supabase.from('suppliers').select('*').order('name');
      if (suppData) setSuppliers(suppData);

      try {
          const allTyres = await fetchAllIds('tyres', 'supplier_id');
          const counts: Record<number, number> = {};
          allTyres.forEach((t: any) => {
              if (t.supplier_id) {
                  counts[t.supplier_id] = (counts[t.supplier_id] || 0) + 1;
              }
          });
          setSupplierCounts(counts);
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

  const initiateDelete = (mode: 'products_only' | 'full_supplier', id: number, name: string) => {
      const count = supplierCounts[id] || 0;
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      setDeleteMode(mode);
      setDeleteData({ id, name, count });
      setGeneratedCode(code);
      setInputCode('');
      setShowDeleteModal(true);
  };

  const executeDelete = async () => {
      if (!deleteData) return;
      if (inputCode !== generatedCode) { showMsg("Невірний код.", 'error'); return; }
      setIsDeleting(true);
      try {
          if (deleteMode === 'products_only') {
              const { error, count } = await supabase.from('tyres').delete().eq('supplier_id', deleteData.id).select('*', { count: 'exact' });
              if (error) throw error;
              showMsg(`Очищено склад постачальника "${deleteData.name}" (${count} шин).`);
          } else {
              await supabase.from('tyres').delete().eq('supplier_id', deleteData.id);
              const { error } = await supabase.from('suppliers').delete().eq('id', deleteData.id);
              if (error) throw error;
              showMsg(`Постачальника "${deleteData.name}" видалено.`);
          }
          fetchSuppliersAndCounts();
          setShowDeleteModal(false);
      } catch (err: any) { showMsg(err.message, 'error'); } finally { setIsDeleting(false); setDeleteData(null); }
  };

  const saveAllSettings = async () => {
        await supabase.from('settings').upsert({ key: 'nova_poshta_key', value: novaPoshtaKey });
        await supabase.from('settings').upsert({ key: 'supplier_api_key', value: supplierKey });
        await supabase.from('settings').upsert({ key: 'ai_provider', value: aiProvider });
        await supabase.from('settings').upsert({ key: 'service_staff_email', value: serviceEmail });
        await supabase.from('settings').upsert({ key: 'admin_email', value: adminEmail });
        await supabase.from('settings').upsert({ key: 'ai_openai_base_url', value: openaiBaseUrl });
        await supabase.from('settings').upsert({ key: 'ai_openai_model', value: openaiModel });
        await supabase.from('settings').upsert({ key: 'ai_custom_base_url', value: customBaseUrl });
        await supabase.from('settings').upsert({ key: 'ai_custom_model', value: customModel });
        await supabase.from('settings').upsert({ key: 'contact_phone1', value: contactSettings.phone1 });
        await supabase.from('settings').upsert({ key: 'contact_phone2', value: contactSettings.phone2 });
        await supabase.from('settings').upsert({ key: 'contact_address', value: contactSettings.address });
        await supabase.from('settings').upsert({ key: 'contact_map_link', value: contactSettings.mapLink });

        const aiPayload: Record<string, string> = {};
        if (geminiKey.trim()) aiPayload.gemini = geminiKey.trim();
        if (openaiKey.trim()) aiPayload.openai = openaiKey.trim();
        if (groqKey.trim()) aiPayload.groq = groqKey.trim();
        if (customKey.trim()) aiPayload.custom = customKey.trim();
        if (serperKey.trim()) aiPayload.serper = serperKey.trim();
        if (customBaseUrl.trim()) aiPayload.customUrl = customBaseUrl.trim();
        if (customModel.trim()) aiPayload.customModel = customModel.trim();
        if (Object.keys(aiPayload).length > 0) {
          await saveAdminAiKeys(aiPayload);
          setGeminiKey('');
          setOpenaiKey('');
          setGroqKey('');
          setCustomKey('');
          setSerperKey('');
          await refreshAiKeyFlags();
        }

        showMsg("Всі налаштування збережено!");
  };

  // --- SMART UPLOAD LOGIC ---
  const handleSmartUpload = async () => {
      if (smartFiles.length === 0) return;
      setIsSmartMatching(true);
      setSmartStatus(['Початок обробки...']);
      
      try {
          let updatedCount = 0;
          
          for (const file of smartFiles) {
              const fileNameNoExt = file.name.replace(/\.[^/.]+$/, "");
              const fileNameClean = fileNameNoExt
                  .replace(/[()]/g, " ")    
                  .replace(/[-_]/g, " ");   
              
              let matches = [];

              // --- BRAND.MODEL MODE ---
              if (fileNameNoExt.includes('.') && !smartExactMatch) {
                  const dotIndex = fileNameNoExt.indexOf('.');
                  const brand = fileNameNoExt.substring(0, dotIndex).trim();
                  const model = fileNameNoExt.substring(dotIndex + 1).trim();
                  
                  if (brand.length >= 2 && model.length >= 2) {
                      const { data: bmMatches } = await supabase
                          .from('tyres')
                          .select('id, title, image_url')
                          .ilike('manufacturer', `%${brand}%`)
                          .ilike('title', `%${model.replace(/[-_]/g, ' ')}%`);
                      
                      if (bmMatches && bmMatches.length > 0) {
                          matches = bmMatches;
                          setSmartStatus(prev => [`Знайдено за Брендом.Моделлю: ${brand} ${model} (${matches.length} шт)`, ...prev]);
                      }
                  }
              }

              if (matches.length === 0) {
                  if (smartExactMatch) {
                  // --- EXACT MATCH MODE (SPECIAL MACHINERY) ---
                  const exactName = file.name.replace(/\.[^/.]+$/, "").trim();
                  
                  const { data: exactMatches } = await supabase
                      .from('tyres')
                      .select('id, title, image_url')
                      .or(`title.ilike."${exactName}",product_number.eq."${exactName}",catalog_number.eq."${exactName}"`)
                      .limit(5);
                  
                  matches = exactMatches || [];
                  
                  if (matches.length === 0) {
                      setSmartStatus(prev => [`NOT FOUND (Exact): ${file.name}`, ...prev]);
                      continue;
                  }
              } else {
                  // --- KEYWORD MATCH MODE (DEFAULT) ---
                  const keywords = fileNameClean.split(/\s+/).filter(w => w.length >= 2);
                  
                  if (keywords.length < 2) {
                      setSmartStatus(prev => [`SKIP: ${file.name} (мало ключових слів)`, ...prev]);
                      continue;
                  }

                  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
                  const searchTerm = sortedKeywords[0]; 

                  const { data: potentialMatches } = await supabase
                      .from('tyres')
                      .select('id, title, image_url')
                      .ilike('title', `%${searchTerm}%`)
                      .limit(50);

                  if (!potentialMatches || potentialMatches.length === 0) {
                      setSmartStatus(prev => [`NOT FOUND (By '${searchTerm}'): ${file.name}`, ...prev]);
                      continue;
                  }

                  matches = potentialMatches.filter(p => {
                      const titleLower = p.title.toLowerCase();
                      const matchCount = keywords.reduce((acc, k) => {
                          return titleLower.includes(k.toLowerCase()) ? acc + 1 : acc;
                      }, 0);
                      
                      return matchCount >= 2; 
                  });

                  if (matches.length === 0) {
                      setSmartStatus(prev => [`NO MATCH (2+ keywords): ${file.name}`, ...prev]);
                      continue;
                  }
              }
              }

              // --- COMMON UPLOAD LOGIC ---
              const storageName = `smart_${Date.now()}_${file.name.replace(/\s/g, '_')}`;
              const { error: uploadError } = await supabase.storage.from('galery').upload(storageName, file);
              if (uploadError) {
                  setSmartStatus(prev => [`ERR UPLOAD: ${file.name}`, ...prev]);
                  continue;
              }
              
              const { data: urlData } = supabase.storage.from('galery').getPublicUrl(storageName);
              const publicUrl = urlData.publicUrl;

              const idsToUpdate = matches
                  .filter(p => smartOverwrite || !p.image_url)
                  .map(p => p.id);

              if (idsToUpdate.length > 0) {
                  await supabase.from('tyres').update({ image_url: publicUrl, in_stock: true }).in('id', idsToUpdate);
                  updatedCount += idsToUpdate.length;
                  setSmartStatus(prev => [`MATCHED (${smartExactMatch ? 'Exact' : 'Fuzzy'}): ${file.name} -> ${idsToUpdate.length} товарів`, ...prev]);
              } else {
                  setSmartStatus(prev => [`SKIPPED (Has Image): ${file.name}`, ...prev]);
              }
          }
          
          setSmartStatus(prev => [`ЗАВЕРШЕНО. Оновлено товарів: ${updatedCount}`, ...prev]);
          setSmartFiles([]);

      } catch (e: any) {
          setSmartStatus(prev => [`CRITICAL ERROR: ${e.message}`, ...prev]);
      } finally {
          setIsSmartMatching(false);
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
           <div className="bg-zinc-950 rounded-2xl p-2 border border-zinc-800 space-y-1">
               <NavButton id="general" label="Контакти" icon={Smartphone} />
               <NavButton id="security" label="Безпека / API" icon={Shield} />
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
                        <div className="md:col-span-2 bg-zinc-950/80 p-4 rounded-xl border border-zinc-800 space-y-4">
                            <label className="block text-[#FFC300] text-xs font-bold uppercase mb-1 flex items-center gap-2"><Sparkles size={14}/> Провайдер AI за замовчуванням</label>
                            <p className="text-[11px] text-zinc-500 mb-2">
                              Використовується в AI помічнику та масовій генерації. Ключі після збереження зберігаються на сервері (таблиця{' '}
                              <code className="text-zinc-400">ai_api_keys</code>, без читання з браузера) і підхоплюються функцією{' '}
                              <code className="text-zinc-400">ai-proxy</code>.
                            </p>
                            <select
                                value={aiProvider}
                                onChange={e => setAiProvider(e.target.value as AIProviderId)}
                                className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-bold text-sm"
                            >
                                <option value="gemini">Google Gemini</option>
                                <option value="openai">OpenAI (ChatGPT Oficial)</option>
                                <option value="groq">Groq (швидкі моделі Llama тощо)</option>
                                <option value="custom">Custom AI (Zenmux / Будь-який провайдер)</option>
                            </select>
                        </div>

                        <div className="md:col-span-2 bg-purple-900/10 p-4 rounded-xl border border-purple-900/30">
                            <label className="block text-purple-300 text-xs font-bold uppercase mb-2 flex items-center gap-2"><Sparkles size={14}/> Google Gemini API Key</label>
                            <div className="relative">
                                <input 
                                    type={showGeminiKey ? "text" : "password"} 
                                    value={geminiKey} 
                                    onChange={e => setGeminiKey(e.target.value)} 
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 pr-10 text-white font-mono text-sm mb-1 focus:border-purple-500 outline-none" 
                                    placeholder="AIza..."
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowGeminiKey(!showGeminiKey)} 
                                    className="absolute right-3 top-3 text-zinc-500 hover:text-white"
                                    title={showGeminiKey ? "Приховати" : "Показати"}
                                >
                                    {showGeminiKey ? <EyeOff size={18}/> : <Eye size={18}/>}
                                </button>
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-2">
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline font-bold">aistudio.google.com</a>
                            </p>
                            {hasKeyGemini && (
                              <p className="text-[10px] text-emerald-500 font-bold mt-1">Ключ збережено на сервері. Введіть новий лише щоб замінити.</p>
                            )}
                        </div>

                        <div className="md:col-span-2 bg-emerald-900/10 p-4 rounded-xl border border-emerald-900/30">
                            <label className="block text-emerald-300 text-xs font-bold uppercase mb-2 flex items-center gap-2"><KeyRound size={14}/> OpenAI API Key (sk-...)</label>
                            <div className="relative">
                                <input 
                                    type={showOpenaiKey ? "text" : "password"} 
                                    value={openaiKey} 
                                    onChange={e => setOpenaiKey(e.target.value)} 
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 pr-10 text-white font-mono text-sm mb-1 focus:border-emerald-500 outline-none" 
                                    placeholder="sk-..."
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowOpenaiKey(!showOpenaiKey)} 
                                    className="absolute right-3 top-3 text-zinc-500 hover:text-white"
                                    title={showOpenaiKey ? "Приховати" : "Показати"}
                                >
                                    {showOpenaiKey ? <EyeOff size={18}/> : <Eye size={18}/>}
                                </button>
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-2 mb-3">Офіційний ключ: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-bold">platform.openai.com</a></p>
                            
                            <label className="block text-zinc-500 text-[10px] font-bold uppercase mb-1 flex items-center gap-2">Вибір офіційної моделі OpenAI</label>
                            <select 
                                value={['gpt-5.4-pro', 'gpt-5.4-mini', 'gpt-5.3-instant', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'o1-mini'].includes(openaiModel) ? openaiModel : 'custom'} 
                                onChange={e => {
                                    if (e.target.value !== 'custom') setOpenaiModel(e.target.value);
                                }} 
                                className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-zinc-300 font-mono text-xs focus:border-emerald-500 outline-none mb-2"
                            >
                                <option value="gpt-5.4-pro">gpt-5.4-pro (Найновіша та найпотужніша 🔥)</option>
                                <option value="gpt-5.4-mini">gpt-5.4-mini (Швидка та розумна v5.4)</option>
                                <option value="gpt-5.3-instant">gpt-5.3-instant (Оптимізована v5.3)</option>
                                <option value="gpt-4o">gpt-4o (Стабільна флагманська)</option>
                                <option value="gpt-4o-mini">gpt-4o-mini (Економна)</option>
                                <option value="o1-mini">o1-mini (Для складних задач)</option>
                                <option value="custom">-- Власна модель (введіть нижче) --</option>
                            </select>

                            <label className="block text-zinc-600 text-[9px] font-bold uppercase mb-1">ID моделі (ID з сайту OpenAI)</label>
                            <input 
                                type="text" 
                                value={openaiModel} 
                                onChange={e => setOpenaiModel(e.target.value)} 
                                className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-zinc-300 font-mono text-xs focus:border-emerald-500 outline-none" 
                                placeholder="Наприклад: gpt-5.3-instant"
                            />
                            
                            {hasKeyOpenai && (
                              <p className="text-[10px] text-emerald-500 font-bold mt-2">Офіційний ключ збережено на сервері.</p>
                            )}
                        </div>

                        <div className="md:col-span-2 bg-blue-900/10 p-4 rounded-xl border border-blue-900/30 line-dashed">
                            <label className="block text-blue-300 text-xs font-bold uppercase mb-2 flex items-center gap-2"><Globe size={14}/> Custom AI Провайдер (Zenmux, OpenRouter тощо)</label>
                            
                            <div className="relative mb-3">
                                <label className="block text-zinc-500 text-[10px] font-bold uppercase mb-1">API Key провайдера</label>
                                <input 
                                    type={showCustomKey ? "text" : "password"} 
                                    value={customKey} 
                                    onChange={e => setCustomKey(e.target.value)} 
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 pr-10 text-white font-mono text-sm focus:border-blue-500 outline-none" 
                                    placeholder="Ключ доступу..."
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowCustomKey(!showCustomKey)} 
                                    className="absolute right-3 top-8 text-zinc-500 hover:text-white"
                                    title={showCustomKey ? "Приховати" : "Показати"}
                                >
                                    {showCustomKey ? <EyeOff size={18}/> : <Eye size={18}/>}
                                </button>
                                {hasKeyCustom && (
                                  <p className="text-[10px] text-emerald-500 font-bold mt-1">Ключ збережено на сервері.</p>
                                )}
                            </div>
                            
                            <div className="mb-3">
                                <label className="block text-zinc-500 text-[10px] font-bold uppercase mb-1">Base URL (Посилання на сервер)</label>
                                <input 
                                    type="text" 
                                    value={customBaseUrl} 
                                    onChange={e => setCustomBaseUrl(e.target.value)} 
                                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-zinc-300 font-mono text-sm focus:border-blue-500 outline-none" 
                                    placeholder="https://api.zenmux.ai/v1"
                                />
                            </div>

                            <div>
                                <label className="block text-zinc-500 text-[10px] font-bold uppercase mb-1">Model ID (Назва моделі)</label>
                                <input 
                                    type="text" 
                                    value={customModel} 
                                    onChange={e => setCustomModel(e.target.value)} 
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-zinc-300 font-mono text-sm focus:border-blue-500 outline-none" 
                                    placeholder="Наприклад: kuaishou/kat-coder-pro-v1-free"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2 bg-orange-900/10 p-4 rounded-xl border border-orange-900/30">
                            <label className="block text-orange-300 text-xs font-bold uppercase mb-2 flex items-center gap-2"><KeyRound size={14}/> Groq API Key</label>
                            <div className="relative">
                                <input 
                                    type={showGroqKey ? "text" : "password"} 
                                    value={groqKey} 
                                    onChange={e => setGroqKey(e.target.value)} 
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 pr-10 text-white font-mono text-sm mb-1 focus:border-orange-500 outline-none" 
                                    placeholder="gsk_..."
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowGroqKey(!showGroqKey)} 
                                    className="absolute right-3 top-3 text-zinc-500 hover:text-white"
                                    title={showGroqKey ? "Приховати" : "Показати"}
                                >
                                    {showGroqKey ? <EyeOff size={18}/> : <Eye size={18}/>}
                                </button>
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-2">Модель: llama-3.3-70b-versatile. Безкоштовний рівень: <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-bold">console.groq.com</a></p>
                            {hasKeyGroq && (
                              <p className="text-[10px] text-emerald-500 font-bold mt-1">Ключ збережено на сервері.</p>
                            )}
                        </div>

                        <div className="md:col-span-2 bg-[#FFC300]/5 p-4 rounded-xl border border-[#FFC300]/20">
                            <label className="block text-[#FFC300] text-xs font-bold uppercase mb-2 flex items-center gap-2"><Sparkles size={14}/> Serper.dev API Key (Google Images Search)</label>
                            <div className="relative">
                                <input 
                                    type={showSerperKey ? "text" : "password"} 
                                    value={serperKey} 
                                    onChange={e => setSerperKey(e.target.value)} 
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 pr-10 text-white font-mono text-sm mb-1 focus:border-[#FFC300] outline-none" 
                                    placeholder="Ваш Serper API Key..."
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowSerperKey(!showSerperKey)} 
                                    className="absolute right-3 top-3 text-zinc-500 hover:text-white"
                                    title={showSerperKey ? "Приховати" : "Показати"}
                                >
                                    {showSerperKey ? <EyeOff size={18}/> : <Eye size={18}/>}
                                </button>
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-2">
                                Отримати безкоштовно (2500 запитів): <a href="https://serper.dev" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-bold">serper.dev</a>
                            </p>
                            {hasKeySerper && (
                              <p className="text-[10px] text-emerald-500 font-bold mt-1">Ключ пошуку збережено на сервері.</p>
                            )}
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
                                       <button onClick={() => initiateDelete('products_only', s.id, s.name)} className="p-2 bg-zinc-800 text-zinc-400 hover:text-orange-500 hover:bg-orange-900/20 rounded-lg border border-zinc-700 hover:border-orange-500 transition-all" title="Очистити склад" disabled={count === 0}><PackageX size={20}/></button>
                                       <button onClick={() => initiateDelete('full_supplier', s.id, s.name)} className="p-2 bg-zinc-800 text-zinc-400 hover:text-red-500 hover:bg-red-900/20 rounded-lg border border-zinc-700 hover:border-red-500 transition-all" title="Видалити постачальника"><Trash2 size={20}/></button>
                                   </div>
                               </div>
                           );
                       })}
                   </div>
               </div>
           )}

           {/* --- TAB: SYSTEM / WAREHOUSE / IMPORT / AI --- */}
           {activeTab === 'system' && (
               <div className="space-y-6 animate-in slide-in-from-right-4">
                   <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2 pb-4 border-b border-zinc-800"><LayoutGrid className="text-[#FFC300]" size={20}/> Керування Складом та Імпортом</h4>
                   
                   {/* EXCEL IMPORT SECTION */}
                   <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-1 mb-6 ">
                       <ExcelImportPanel suppliers={suppliers} />
                   </div>

                   {/* SMART PHOTO MATCHING */}
                   <div className="mt-6 bg-black/30 p-6 rounded-xl border border-zinc-800">
                        <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Wand2 size={18} className="text-[#FFC300]"/> Розумне завантаження фото</h4>
                        <p className="text-zinc-400 text-sm mb-4">Завантажте файли, і система знайде відповідні товари за назвою файлу.</p>
                        
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-4 bg-zinc-900 p-4 rounded-xl border border-dashed border-zinc-700">
                                <button onClick={() => smartInputRef.current?.click()} className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 border border-zinc-600">
                                    <Upload size={16}/> Обрати файли
                                </button>
                                <input type="file" multiple ref={smartInputRef} onChange={e => setSmartFiles(Array.from(e.target.files || []))} className="hidden" accept="image/*" />
                                <span className="text-zinc-400 text-sm">{smartFiles.length > 0 ? `Обрано ${smartFiles.length} файлів` : 'Файли не обрано'}</span>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <label className="flex items-center gap-2 cursor-pointer w-fit">
                                    <input type="checkbox" checked={smartOverwrite} onChange={e => setSmartOverwrite(e.target.checked)} className="w-4 h-4 rounded accent-[#FFC300]" />
                                    <span className="text-zinc-300 text-sm font-bold">Перезаписувати існуючі фото</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer w-fit">
                                    <input type="checkbox" checked={smartExactMatch} onChange={e => setSmartExactMatch(e.target.checked)} className="w-4 h-4 rounded accent-green-500" />
                                    <span className={`text-sm font-bold ${smartExactMatch ? 'text-green-400' : 'text-zinc-400'}`}>
                                        Точний збіг назви (для спецтехніки)
                                    </span>
                                </label>
                            </div>

                            <button onClick={handleSmartUpload} disabled={isSmartMatching || smartFiles.length === 0} className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                                {isSmartMatching ? <Loader2 className="animate-spin"/> : <CheckCircle size={18}/>}
                                Розпочати обробку
                            </button>

                            {smartStatus.length > 0 && (
                                <div className="bg-black border border-zinc-700 rounded-xl p-3 max-h-40 overflow-y-auto custom-scrollbar text-xs font-mono text-zinc-400">
                                    {smartStatus.map((s, i) => <div key={i}>{s}</div>)}
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
                   <div className="bg-red-900/20 p-4 rounded-full text-red-500 mb-4 border border-red-900/50"><AlertTriangle size={40} /></div>
                   <h3 className="text-xl font-black text-white mb-2">{deleteMode === 'products_only' ? 'Очищення Складу' : 'Видалення Постачальника'}</h3>
                   <p className="text-zinc-400 text-sm mb-4">{deleteMode === 'products_only' ? <>Ви збираєтесь видалити <span className="text-white font-bold">{deleteData.count}</span> товарів від постачальника <span className="text-[#FFC300]">{deleteData.name}</span>.</> : <>Увага! Видалення постачальника <span className="text-[#FFC300]">{deleteData.name}</span> призведе до видалення всіх його товарів (<span className="text-white font-bold">{deleteData.count} шт.</span>).</>}<br/><br/><span className="text-red-400 font-bold uppercase">Цю дію неможливо скасувати!</span></p>
                   <div className="bg-black border border-zinc-700 rounded-xl p-4 mb-4 w-full"><p className="text-xs text-zinc-500 uppercase font-bold mb-1">Код підтвердження:</p><p className="text-3xl font-mono font-black text-[#FFC300] tracking-widest">{generatedCode}</p></div>
                   <input type="text" value={inputCode} onChange={(e) => setInputCode(e.target.value)} placeholder="Введіть код" className="w-full bg-zinc-800 border border-zinc-600 rounded-xl p-3 text-center text-white font-bold text-lg mb-4 outline-none focus:border-red-500"/>
                   <button onClick={executeDelete} disabled={inputCode !== generatedCode || isDeleting} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2">{isDeleting ? <Loader2 className="animate-spin" /> : (deleteMode === 'products_only' ? 'ВИДАЛИТИ ТОВАРИ' : 'ВИДАЛИТИ ВСЕ')}</button>
               </div>
           </div>
       )}
    </div>
  );
};

export default SettingsTab;
