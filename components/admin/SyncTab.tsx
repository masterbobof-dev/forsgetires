
import React, { useState, useEffect, useMemo } from 'react';
import { Globe, Settings, Play, CheckCircle, AlertTriangle, Loader2, Database, ArrowRight, X, Terminal, ChevronLeft, Save, Image as ImageIcon, Box, FileImage, Key, UploadCloud, ToggleLeft, ToggleRight, Briefcase, Search, Download } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import ApiRequestPanel from './sync/ApiRequestPanel';
import ImportMapper from './sync/ImportMapper';

// --- HELPERS ---
const getValueByPath = (obj: any, path: string) => {
    if (!path || !obj) return undefined;
    if (path === '.') return obj;
    try {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    } catch (e) {
        return undefined;
    }
};

const safeExtractString = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
        if (val.value) return String(val.value);
        if (val.name) return String(val.name);
        if (val.id) return String(val.id);
        return ''; 
    }
    return String(val);
};

const detectSeason = (text: string): string => {
    const t = String(text).toLowerCase();
    if (t.includes('зима') || t.includes('зимн') || t.includes('winter') || t.includes('snow') || t.includes('ice') || t.includes('stud') || t.includes('w442') || t.includes('ws')) return 'winter';
    if (t.includes('літо') || t.includes('літн') || t.includes('summer') || t.includes('sport') || t.includes('k125') || t.includes('ventu')) return 'summer';
    if (t.includes('всесезон') || t.includes('all season') || t.includes('4s')) return 'all-season';
    return 'summer';
};

const scanForArrays = (obj: any, path = '', depth = 0): { path: string, count: number }[] => {
    if (!obj || typeof obj !== 'object' || depth > 3) return [];
    let candidates: { path: string, count: number }[] = [];
    if (Array.isArray(obj)) {
        if (obj.length > 0) candidates.push({ path: path || 'root', count: obj.length });
        return candidates;
    }
    const keys = Object.keys(obj);
    if (keys.length > 5) {
        const values = Object.values(obj);
        const objectValues = values.filter(v => typeof v === 'object' && v !== null && !Array.isArray(v));
        if (objectValues.length > keys.length * 0.8) candidates.push({ path: path || 'root', count: keys.length });
    }
    for (const key of keys) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            candidates = [...candidates, ...scanForArrays(obj[key], path ? `${path}.${key}` : key, depth + 1)];
        }
    }
    return candidates.sort((a,b) => b.count - a.count);
};

// Convert binary string to Uint8Array
const binaryStringToBytes = (str: string) => {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        bytes[i] = str.charCodeAt(i) & 0xff;
    }
    return bytes;
};

const PHOTO_DEFAULT_CONFIG = {
    method: 'POST',
    url: 'https://public.omega.page/public/api/v1.0/searchcatalog/getTireImages',
    headers: '{\n  "Content-Type": "application/json"\n}',
    body: JSON.stringify({
      "ProductId": 0, // Will be replaced
      "Key": "LYA37jgXHEJy9EOY7fkkIIs5Mg75aueD"
    }, null, 2)
};

const SyncTab: React.FC = () => {
  const [viewMode, setViewMode] = useState<'dashboard' | 'config'>('dashboard');
  const [configTab, setConfigTab] = useState<'products' | 'photos'>('products');
  
  // Config State
  const [responseData, setResponseData] = useState<any>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [apiConfig, setApiConfig] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]); 

  // Photo Config State
  const [photoMap, setPhotoMap] = useState({ idKey: 'id', urlKey: 'photoUrl' });
  const [photoSourceField, setPhotoSourceField] = useState<'product_number' | 'catalog_number'>('product_number');
  const [isBinaryMode, setIsBinaryMode] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');

  // --- SINGLE TEST STATE ---
  const [dbSearch, setDbSearch] = useState('');
  const [foundProducts, setFoundProducts] = useState<any[]>([]);
  const [selectedTestProduct, setSelectedTestProduct] = useState<any | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResultImage, setTestResultImage] = useState<string | null>(null);
  const [testResultBlob, setTestResultBlob] = useState<Blob | null>(null); // To save later
  const [testSaveStatus, setTestSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Sync Process State
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPhotoSyncing, setIsPhotoSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ total: 0, processed: 0, updated: 0, inserted: 0 });
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncError, setSyncError] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
      const fetchSuppliers = async () => {
          const { data } = await supabase.from('suppliers').select('*').order('name');
          if (data) setSuppliers(data);
      };
      fetchSuppliers();

      const savedTime = localStorage.getItem('forsage_last_sync');
      if (savedTime) setLastSyncTime(savedTime);

      const hasConfig = localStorage.getItem('forsage_sync_config');
      const hasMap = localStorage.getItem('forsage_sync_mapping');
      const hasSupplier = localStorage.getItem('forsage_sync_supplier');
      if (hasSupplier) setSelectedSupplierId(hasSupplier);

      const savedPhotoMap = localStorage.getItem('forsage_sync_photo_map');
      if (savedPhotoMap) setPhotoMap(JSON.parse(savedPhotoMap));
      
      const savedSourceField = localStorage.getItem('forsage_sync_photo_source');
      if (savedSourceField) setPhotoSourceField(savedSourceField as any);

      const savedBinaryMode = localStorage.getItem('forsage_sync_binary_mode');
      if (savedBinaryMode) setIsBinaryMode(savedBinaryMode === 'true');

      if (hasConfig && hasMap && hasSupplier) {
          setViewMode('dashboard');
      } else {
          setViewMode('config');
      }
  }, []);

  const addLog = (msg: string) => setSyncLogs(prev => [...prev.slice(-4), msg]);

  // Search DB for Test Product
  const searchDbProduct = async () => {
      if (!dbSearch.trim() || !selectedSupplierId) return;
      const { data } = await supabase
          .from('tyres')
          .select('id, title, product_number, catalog_number, image_url')
          .eq('supplier_id', parseInt(selectedSupplierId))
          .or(`title.ilike.%${dbSearch}%,catalog_number.ilike.%${dbSearch}%,product_number.ilike.%${dbSearch}%`)
          .limit(5);
      setFoundProducts(data || []);
  };

  // Run Test for Single Product
  const runSingleTest = async () => {
      if (!selectedTestProduct) return;
      setTestLoading(true);
      setTestResultImage(null);
      setTestResultBlob(null);
      setTestSaveStatus('idle');

      try {
          const savedConfigStr = localStorage.getItem('forsage_sync_photo_config');
          if (!savedConfigStr) throw new Error("Немає конфігурації API");
          const config = JSON.parse(savedConfigStr);

          // Get ID
          const val = selectedTestProduct[photoSourceField];
          const idToSend = parseInt(val) || val;

          let headers = {};
          let requestBody = {};
          try { headers = JSON.parse(config.headers); } catch(e) {}
          if (config.method !== 'GET') {
              try { requestBody = JSON.parse(config.body); } catch(e) {}
          }

          // Inject ID
          // Try to find array key or "ProductId"
          let listKey = Object.keys(requestBody).find(k => Array.isArray((requestBody as any)[k])) || 
                        Object.keys(requestBody).find(k => k.toLowerCase().includes('id')) || 
                        'ProductId';
          
          const currentBody: any = { ...requestBody };
          // If body has an array, put single ID in array? or just ID?
          // If binary mode, usually simple ID or array of 1.
          if (Array.isArray(currentBody[listKey])) {
              currentBody[listKey] = [idToSend];
          } else {
              currentBody[listKey] = idToSend;
          }

          const { data: result, error } = await supabase.functions.invoke('super-endpoint', {
              body: {
                  url: config.url,
                  method: config.method,
                  headers: headers,
                  body: currentBody
              }
          });

          if (error) throw new Error(error.message);

          const rawData = result.data !== undefined ? result.data : result;

          // Check if Binary
          const isImage = typeof rawData === 'string' && (rawData.includes('JFIF') || rawData.includes('PNG') || rawData.includes('Exif'));

          if (isImage) {
              const bytes = binaryStringToBytes(rawData);
              const blob = new Blob([bytes], { type: 'image/jpeg' });
              const url = URL.createObjectURL(blob);
              setTestResultImage(url);
              setTestResultBlob(blob);
              if (!isBinaryMode) {
                  alert("API повернуло зображення! Автоматично вмикаю Binary Mode.");
                  setIsBinaryMode(true);
                  localStorage.setItem('forsage_sync_binary_mode', 'true');
              }
          } else {
              // It's JSON?
              if (isBinaryMode) {
                  alert("Увага: Очікували файл, а прийшов JSON/Текст. Можливо вимкніть Binary Mode?");
                  console.log(rawData);
              }
              // Try to find URL in JSON if we are NOT in binary mode
              // ... (simple fallback logic)
              if (typeof rawData === 'object' && !isBinaryMode) {
                   alert("Отримано JSON (див. консоль). Налаштуйте мапінг якщо там є URL.");
                   console.log(rawData);
              }
          }

      } catch (e: any) {
          alert("Помилка тесту: " + e.message);
      } finally {
          setTestLoading(false);
      }
  };

  // Save Test Image
  const saveTestImage = async () => {
      if (!testResultBlob || !selectedTestProduct) return;
      setTestSaveStatus('saving');
      try {
          const fileName = `api_test_${selectedTestProduct.id}_${Date.now()}.jpg`;
          const { error } = await supabase.storage.from('galery').upload(fileName, testResultBlob, {
              contentType: 'image/jpeg',
              upsert: true
          });
          if (error) throw error;
          
          const { data } = supabase.storage.from('galery').getPublicUrl(fileName);
          await supabase.from('tyres').update({ image_url: data.publicUrl }).eq('id', selectedTestProduct.id);
          
          setTestSaveStatus('saved');
          // Update local view
          setSelectedTestProduct({...selectedTestProduct, image_url: data.publicUrl});
      } catch (e: any) {
          console.error(e);
          setTestSaveStatus('error');
          alert("Помилка збереження: " + e.message);
      }
  };

  const handleFinishConfig = () => {
      setViewMode('dashboard');
  };

  // --- PRODUCT SYNC LOGIC (Keep existing) ---
  const handleRunAutoSync = async () => {
      const savedConfigStr = localStorage.getItem('forsage_sync_config');
      const savedMapStr = localStorage.getItem('forsage_sync_mapping');
      const savedSupplier = localStorage.getItem('forsage_sync_supplier');

      if (!savedConfigStr || !savedMapStr || !savedSupplier) {
          alert("Налаштування не знайдено! Переходимо в режим налаштування.");
          setViewMode('config');
          return;
      }

      setIsSyncing(true);
      setSyncProgress({ total: 0, processed: 0, updated: 0, inserted: 0 });
      setSyncLogs(['Запуск синхронізації ТОВАРІВ...']);
      setSyncError('');

      try {
          const config = JSON.parse(savedConfigStr);
          const map = JSON.parse(savedMapStr);
          const supplierId = parseInt(savedSupplier);

          let headers = {};
          let requestBody = null;
          try { headers = JSON.parse(config.headers); } catch(e) {}
          if (config.method !== 'GET') {
              try { requestBody = JSON.parse(config.body); } catch(e) {}
          }

          let offset = 0;
          const BATCH_SIZE = 1000;
          let keepFetching = true;
          let jsonPath = '';

          addLog(`API: ${config.method} ${config.url}`);

          while (keepFetching) {
              if (requestBody && typeof requestBody === 'object') {
                  requestBody.From = offset;
                  requestBody.Count = BATCH_SIZE;
              }

              addLog(`Завантаження пакету (offset: ${offset})...`);
              const { data: result, error } = await supabase.functions.invoke('super-endpoint', {
                  body: {
                      url: config.url,
                      method: config.method,
                      headers: headers,
                      body: requestBody
                  }
              });

              if (error) throw new Error("Помилка мережі: " + error.message);
              
              const rawData = result.data !== undefined ? result.data : result;
              
              if (typeof rawData === 'string' && (rawData.includes('JFIF') || rawData.startsWith('PNG'))) {
                  throw new Error("API повернуло зображення замість JSON даних. Перевірте налаштування URL.");
              }

              let batchItems: any[] = [];

              if (!jsonPath) {
                  const arrays = scanForArrays(rawData);
                  if (arrays.length > 0) {
                      jsonPath = arrays[0].path;
                      addLog(`Шлях даних: ${jsonPath}`);
                  } else {
                      jsonPath = 'root';
                  }
              }

              if (jsonPath && jsonPath !== 'root') {
                  const extracted = getValueByPath(rawData, jsonPath);
                  if (Array.isArray(extracted)) batchItems = extracted;
              } else if (Array.isArray(rawData)) {
                  batchItems = rawData;
              }

              if (batchItems.length === 0) {
                  addLog("Отримано порожній пакет. Завершення.");
                  keepFetching = false;
                  break;
              }

              const mappedBatch = batchItems.map((item: any) => {
                  const rawPrice = getValueByPath(item, map.price);
                  const price = parseFloat(String(rawPrice).replace(/[^\d.]/g, '')) || 0;
                  const rawBasePrice = map.base_price ? getValueByPath(item, map.base_price) : 0;
                  const basePrice = parseFloat(String(rawBasePrice).replace(/[^\d.]/g, '')) || 0;
                  const title = safeExtractString(getValueByPath(item, map.title)) || 'Без назви';
                  const desc = map.description ? safeExtractString(getValueByPath(item, map.description)) : '';
                  const brand = map.brand ? safeExtractString(getValueByPath(item, map.brand)) || 'Unknown' : 'Unknown';
                  const imageUrl = map.image ? safeExtractString(getValueByPath(item, map.image)) : null;
                  
                  let radius='';
                  const sizeMatch = title.match(/(\d{3})[\/\s](\d{2})[\s\w]*R(\d{2}[C|c]?)/);
                  if (sizeMatch) { radius='R'+sizeMatch[3].toUpperCase(); }

                  let stock = 0;
                  const rawStock = map.stock ? getValueByPath(item, map.stock) : 0;
                  if (Array.isArray(rawStock)) {
                      stock = rawStock.reduce((acc: number, wh: any) => acc + (parseInt(wh.amount || wh.quantity || wh.rest || 0) || 0), 0);
                  } else if (typeof rawStock === 'object' && rawStock !== null) {
                      stock = parseInt((rawStock as any).amount || (rawStock as any).quantity || 0) || 0;
                  } else {
                      stock = parseInt(String(rawStock).replace(/[^\d]/g, '')) || 0;
                  }

                  const season = detectSeason(title + ' ' + desc);
                  let vehicle_type = 'car';
                  if (radius.includes('C') || title.includes('Truck') || title.includes('LT')) vehicle_type = 'cargo';
                  else if (title.includes('SUV') || title.includes('4x4')) vehicle_type = 'suv';

                  const code = map.code ? safeExtractString(getValueByPath(item, map.code)).trim() : null;
                  const prodNum = map.product_number ? safeExtractString(getValueByPath(item, map.product_number)).trim() : null;

                  return {
                      title,
                      manufacturer: brand,
                      price: String(price),
                      base_price: String(basePrice || price),
                      image_url: imageUrl,
                      catalog_number: code,
                      product_number: prodNum,
                      stock_quantity: stock,
                      in_stock: stock > 0,
                      supplier_id: supplierId,
                      description: desc || 'API Import',
                      season,
                      radius,
                      vehicle_type
                  };
              });

              const codes = mappedBatch.map((i: any) => i.catalog_number).filter((c: any) => c);
              const { data: existingDB } = await supabase
                  .from('tyres')
                  .select('id, catalog_number')
                  .eq('supplier_id', supplierId)
                  .in('catalog_number', codes);

              const existingMap = new Map();
              existingDB?.forEach((item: any) => existingMap.set(item.catalog_number, item));

              const toUpdate = [];
              const toInsert = [];

              for (const item of mappedBatch) {
                  if (!item.catalog_number) continue;
                  const existing = existingMap.get(item.catalog_number);
                  if (existing) {
                      toUpdate.push({ ...item, id: existing.id });
                  } else {
                      toInsert.push(item);
                  }
              }

              if (toUpdate.length > 0) await supabase.from('tyres').upsert(toUpdate);
              if (toInsert.length > 0) await supabase.from('tyres').insert(toInsert);

              setSyncProgress(prev => ({
                  total: prev.total + batchItems.length,
                  processed: prev.processed + batchItems.length,
                  updated: prev.updated + toUpdate.length,
                  inserted: prev.inserted + toInsert.length
              }));

              if (batchItems.length < BATCH_SIZE) {
                  keepFetching = false;
              } else {
                  offset += BATCH_SIZE;
              }
          }

          addLog("Готово!");
          const now = new Date().toLocaleString('uk-UA');
          localStorage.setItem('forsage_last_sync', now);
          setLastSyncTime(now);

      } catch (e: any) {
          console.error(e);
          setSyncError(e.message);
          addLog("ПОМИЛКА: " + e.message);
      } finally {
          setIsSyncing(false);
      }
  };

  const handleApiResponse = (data: any, status: number, config: any) => {
      setResponseData(data);
      setResponseStatus(status);
      setApiConfig(config);
  };

  return (
    <div className="animate-in fade-in pb-20 h-full flex flex-col">
       
       {/* HEADER */}
       <div className="mb-6 shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div>
               <h3 className="text-2xl font-black text-white flex items-center gap-2">
                   <Globe className="text-[#FFC300]" /> API Синхронізація
               </h3>
               <p className="text-zinc-400 text-sm mt-1">
                   {viewMode === 'dashboard' ? 'Центр керування оновленнями' : 'Режим налаштування підключення'}
               </p>
           </div>
           
           {viewMode === 'dashboard' ? (
                <button 
                    onClick={() => setViewMode('config')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold border bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-white transition-colors"
                >
                    <Settings size={18}/> Налаштування API
                </button>
           ) : (
                <button 
                    onClick={handleFinishConfig}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-black border bg-green-600 border-green-500 text-white hover:bg-green-500 transition-colors shadow-lg active:scale-95"
                >
                    <CheckCircle size={20}/> ЗБЕРЕГТИ ТА ВИЙТИ
                </button>
           )}
       </div>

       {viewMode === 'dashboard' ? (
           // --- DASHBOARD VIEW ---
           <div className="flex-grow flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
               
               {/* MAIN CARD */}
               <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 w-full shadow-2xl relative overflow-hidden">
                   
                   {/* Status Indicator */}
                   <div className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4">
                       <div className="flex items-center gap-3">
                           <div className={`w-3 h-3 rounded-full ${isSyncing || isPhotoSyncing ? 'bg-[#FFC300] animate-ping' : syncError ? 'bg-red-500' : 'bg-green-500'}`}></div>
                           <span className="text-zinc-400 font-bold uppercase text-xs tracking-widest">
                               {isSyncing || isPhotoSyncing ? 'СИНХРОНІЗАЦІЯ...' : syncError ? 'ПОМИЛКА' : 'ГОТОВО ДО РОБОТИ'}
                           </span>
                       </div>
                       {lastSyncTime && <div className="text-xs text-zinc-500">Останнє оновлення: {lastSyncTime}</div>}
                   </div>

                   {/* PROGRESS SECTION */}
                   {isSyncing || isPhotoSyncing || syncProgress.processed > 0 ? (
                       <div className="space-y-6">
                           <div className="grid grid-cols-3 gap-4 text-center">
                               <div className="bg-zinc-800 p-3 rounded-xl">
                                   <div className="text-2xl font-black text-white">{syncProgress.processed}</div>
                                   <div className="text-[10px] text-zinc-500 uppercase font-bold">Оброблено</div>
                               </div>
                               <div className="bg-zinc-800 p-3 rounded-xl">
                                   <div className="text-2xl font-black text-blue-400">{syncProgress.updated}</div>
                                   <div className="text-[10px] text-zinc-500 uppercase font-bold">Оновлено</div>
                               </div>
                               <div className="bg-zinc-800 p-3 rounded-xl">
                                   <div className="text-2xl font-black text-green-400">{syncProgress.inserted}</div>
                                   <div className="text-[10px] text-zinc-500 uppercase font-bold">Нових</div>
                               </div>
                           </div>

                           {/* LOGS */}
                           <div className="bg-black/50 rounded-xl p-4 font-mono text-xs text-zinc-400 h-32 overflow-y-auto border border-zinc-800 shadow-inner">
                               {syncLogs.map((log, i) => (
                                   <div key={i} className="mb-1 border-b border-zinc-800/50 pb-1 last:border-0">
                                       <span className="text-[#FFC300] mr-2">{'>'}</span>{log}
                                   </div>
                               ))}
                               {(isSyncing || isPhotoSyncing) && <div className="animate-pulse text-[#FFC300]">Обробка даних...</div>}
                           </div>

                           {!(isSyncing || isPhotoSyncing) && !syncError && (
                               <div className="flex items-center gap-2 text-green-400 bg-green-900/20 p-3 rounded-xl border border-green-900/50 justify-center">
                                   <CheckCircle size={20} /> Успішно завершено!
                               </div>
                           )}
                           
                           {syncError && (
                               <div className="flex items-center gap-2 text-red-400 bg-red-900/20 p-3 rounded-xl border border-red-900/50 justify-center text-sm font-bold">
                                   <AlertTriangle size={20} /> {syncError}
                               </div>
                           )}
                       </div>
                   ) : (
                       /* IDLE STATE */
                       <div className="text-center py-8">
                           <div className="bg-zinc-800/50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border border-zinc-700">
                                <Database size={40} className="text-zinc-500" />
                           </div>
                           <h2 className="text-xl font-bold text-white mb-2">Оновлення Складу</h2>
                           <p className="text-zinc-400 text-sm mb-8 max-w-sm mx-auto">
                               Автоматична синхронізація цін та залишків працює.
                           </p>
                       </div>
                   )}

                   {/* ACTION BUTTONS */}
                   <div className="mt-8 flex flex-col gap-3">
                       <button 
                           onClick={handleRunAutoSync}
                           disabled={isSyncing || isPhotoSyncing}
                           className={`w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-lg transition-all active:scale-95 ${
                               isSyncing 
                               ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                               : 'bg-gradient-to-r from-[#FFC300] to-[#FFD700] hover:from-[#e6b000] hover:to-[#e6b000] text-black shadow-yellow-900/20'
                           }`}
                       >
                           {isSyncing ? <Loader2 className="animate-spin" size={20} /> : <Box size={20} fill="currentColor" className="text-black/50"/>}
                           {isSyncing ? 'СИНХРОНІЗАЦІЯ ТОВАРІВ...' : 'СИНХРОНІЗУВАТИ ТОВАРИ (Ціни/Залишки)'}
                       </button>
                   </div>

               </div>
           </div>
       ) : (
           // --- CONFIGURATION VIEW (Split Panel) ---
           <div className="flex flex-col h-full">
               
               {/* CONFIG TABS */}
               <div className="flex gap-4 mb-4 shrink-0 border-b border-zinc-800 pb-2">
                   <button 
                        onClick={() => setConfigTab('products')}
                        className={`px-6 py-2 rounded-t-lg font-bold text-sm transition-colors border-b-2 ${configTab === 'products' ? 'text-[#FFC300] border-[#FFC300] bg-zinc-900' : 'text-zinc-500 border-transparent hover:text-white'}`}
                   >
                       ТОВАРИ (Основне)
                   </button>
                   <button 
                        onClick={() => setConfigTab('photos')}
                        className={`px-6 py-2 rounded-t-lg font-bold text-sm transition-colors border-b-2 ${configTab === 'photos' ? 'text-[#FFC300] border-[#FFC300] bg-zinc-900' : 'text-zinc-500 border-transparent hover:text-white'}`}
                   >
                       ФОТОГРАФІЇ
                   </button>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-grow items-start overflow-hidden">
                   <div className="h-full overflow-y-auto">
                       {configTab === 'products' ? (
                           <ApiRequestPanel 
                                onResponse={handleApiResponse} 
                                storageKey="forsage_sync_config"
                                title="Налаштування API Товарів"
                                description="Запит для отримання списку шин (getTires)"
                           />
                       ) : (
                           <ApiRequestPanel 
                                onResponse={handleApiResponse} 
                                storageKey="forsage_sync_photo_config"
                                defaultConfig={PHOTO_DEFAULT_CONFIG}
                                title="Налаштування API Фото"
                                description="Запит для отримання фото (getTireImages). ProductId буде підставлено автоматично."
                           />
                       )}
                   </div>
                   
                   <div className="h-full min-h-[600px] overflow-y-auto">
                       {configTab === 'products' ? (
                           <ImportMapper 
                              responseData={responseData} 
                              responseStatus={responseStatus} 
                              apiConfig={apiConfig}
                           />
                       ) : (
                           /* NEW SINGLE ITEM TEST MODE */
                           <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-6">
                               <div className="flex justify-between items-center">
                                   <h4 className="text-white font-bold flex items-center gap-2"><ImageIcon size={18}/> Тест одного товару</h4>
                                   <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1 rounded-full text-xs">
                                       <span className={isBinaryMode ? "text-[#FFC300] font-bold" : "text-zinc-500"}>Binary Mode</span>
                                       <button onClick={() => { setIsBinaryMode(!isBinaryMode); localStorage.setItem('forsage_sync_binary_mode', String(!isBinaryMode)); }}>
                                           {isBinaryMode ? <ToggleRight className="text-[#FFC300]" size={24}/> : <ToggleLeft className="text-zinc-500" size={24}/>}
                                       </button>
                                   </div>
                               </div>

                               {/* 1. SELECT SUPPLIER */}
                               <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700">
                                   <label className="text-zinc-300 text-xs font-bold uppercase mb-2 block flex items-center gap-2"><Briefcase size={14}/> Постачальник</label>
                                   <select 
                                       value={selectedSupplierId}
                                       onChange={(e) => {
                                           setSelectedSupplierId(e.target.value);
                                           localStorage.setItem('forsage_sync_supplier', e.target.value);
                                           setFoundProducts([]);
                                           setSelectedTestProduct(null);
                                       }}
                                       className="w-full bg-black border border-zinc-600 rounded-lg p-3 text-white font-bold text-sm"
                                   >
                                       <option value="">-- Оберіть --</option>
                                       {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                   </select>
                               </div>

                               {/* 2. SEARCH PRODUCT */}
                               {selectedSupplierId && (
                                   <div className="space-y-4 animate-in fade-in">
                                       <div>
                                           <label className="text-zinc-300 text-xs font-bold uppercase mb-2 block flex items-center gap-2"><Search size={14}/> Знайти товар у базі</label>
                                           <div className="flex gap-2">
                                               <input 
                                                   type="text" 
                                                   value={dbSearch} 
                                                   onChange={e => setDbSearch(e.target.value)} 
                                                   className="flex-grow bg-black border border-zinc-600 rounded-lg p-3 text-white" 
                                                   placeholder="Назва, код або артикул..."
                                                   onKeyDown={e => e.key === 'Enter' && searchDbProduct()}
                                               />
                                               <button onClick={searchDbProduct} className="bg-zinc-800 hover:bg-zinc-700 text-white p-3 rounded-lg"><Search/></button>
                                           </div>
                                       </div>

                                       {foundProducts.length > 0 && (
                                           <div className="bg-black/30 rounded-xl border border-zinc-800 overflow-hidden">
                                               {foundProducts.map(p => (
                                                   <div 
                                                       key={p.id} 
                                                       onClick={() => { setSelectedTestProduct(p); setTestResultImage(null); }}
                                                       className={`p-3 border-b border-zinc-800 cursor-pointer hover:bg-zinc-800 flex items-center gap-3 ${selectedTestProduct?.id === p.id ? 'bg-[#FFC300]/10 border-l-4 border-l-[#FFC300]' : ''}`}
                                                   >
                                                       <div className="w-10 h-10 bg-black rounded border border-zinc-700 flex-shrink-0 overflow-hidden">
                                                           {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover"/> : <ImageIcon className="m-2 text-zinc-600"/>}
                                                       </div>
                                                       <div className="overflow-hidden">
                                                           <div className="text-white font-bold text-sm truncate">{p.title}</div>
                                                           <div className="text-xs text-zinc-500 font-mono">ID: {p.product_number} | ART: {p.catalog_number}</div>
                                                       </div>
                                                   </div>
                                               ))}
                                           </div>
                                       )}
                                   </div>
                               )}

                               {/* 3. TEST ACTIONS */}
                               {selectedTestProduct && (
                                   <div className="bg-blue-900/10 border border-blue-900/30 rounded-xl p-4 space-y-4 animate-in slide-in-from-bottom-2">
                                       <div className="flex items-center justify-between">
                                           <div className="text-sm text-blue-200">
                                               <span className="font-bold block">Обрано: {selectedTestProduct.title}</span>
                                               <span className="text-xs opacity-70">Відправляємо: {photoSourceField === 'product_number' ? selectedTestProduct.product_number : selectedTestProduct.catalog_number} ({photoSourceField})</span>
                                           </div>
                                           <div className="flex flex-col gap-1 items-end">
                                               <label className="text-[10px] text-zinc-400 uppercase">Поле для запиту</label>
                                               <select 
                                                   value={photoSourceField}
                                                   onChange={(e) => {
                                                       const val = e.target.value as any;
                                                       setPhotoSourceField(val);
                                                       localStorage.setItem('forsage_sync_photo_source', val);
                                                   }}
                                                   className="bg-black border border-zinc-700 rounded text-xs p-1 text-white"
                                               >
                                                   <option value="product_number">product_number</option>
                                                   <option value="catalog_number">catalog_number</option>
                                               </select>
                                           </div>
                                       </div>

                                       <button 
                                           onClick={runSingleTest}
                                           disabled={testLoading}
                                           className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black py-3 rounded-xl flex items-center justify-center gap-2"
                                       >
                                           {testLoading ? <Loader2 className="animate-spin"/> : <Download size={20}/>}
                                           Отримати фото (API)
                                       </button>

                                       {testResultImage && (
                                           <div className="bg-black p-4 rounded-xl border border-zinc-700 text-center animate-in zoom-in">
                                               <p className="text-green-400 text-xs font-bold mb-2 uppercase">Успішно отримано!</p>
                                               <img src={testResultImage} alt="Result" className="max-h-48 mx-auto rounded border border-zinc-800 mb-4"/>
                                               
                                               <button 
                                                   onClick={saveTestImage}
                                                   disabled={testSaveStatus === 'saving' || testSaveStatus === 'saved'}
                                                   className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${testSaveStatus === 'saved' ? 'bg-green-600 text-white' : 'bg-white text-black hover:bg-zinc-200'}`}
                                               >
                                                   {testSaveStatus === 'saving' ? <Loader2 className="animate-spin"/> : testSaveStatus === 'saved' ? <CheckCircle/> : <Save/>}
                                                   {testSaveStatus === 'saved' ? 'Збережено!' : 'Зберегти до товару'}
                                               </button>
                                           </div>
                                       )}
                                   </div>
                               )}
                           </div>
                       )}
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default SyncTab;
