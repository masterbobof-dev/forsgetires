
import React, { useState, useEffect } from 'react';
import { Globe, Settings, CheckCircle, Database, Box, Briefcase, Search, Download, Bug, ToggleLeft, ToggleRight, Check, Code, Copy, FileText, Loader2, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import ApiRequestPanel from './sync/ApiRequestPanel';
import ImportMapper from './sync/ImportMapper';
import PhotoSyncDashboard from './sync/PhotoSyncDashboard';
import { getValueByPath, safeExtractString, smartExtractPrice, findPriceRecursively, detectSeason, scanForArrays, cleanHeaders, requestServerSideUpload, EDGE_FUNCTION_CODE, PHOTO_DEFAULT_CONFIG } from './sync/syncUtils';

const SyncTab: React.FC = () => {
  const [viewMode, setViewMode] = useState<'dashboard' | 'config'>('dashboard');
  const [configTab, setConfigTab] = useState<'products' | 'photos'>('products');
  
  const [responseData, setResponseData] = useState<any>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [apiConfig, setApiConfig] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]); 

  // Single Item Test State
  const [photoSourceField, setPhotoSourceField] = useState<'product_number' | 'catalog_number'>('product_number');
  const [isBinaryMode, setIsBinaryMode] = useState(true);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  
  const [dbSearch, setDbSearch] = useState('');
  const [foundProducts, setFoundProducts] = useState<any[]>([]);
  const [selectedTestProduct, setSelectedTestProduct] = useState<any | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResultImage, setTestResultImage] = useState<string | null>(null);
  const [testSaveStatus, setTestSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [debugResponse, setDebugResponse] = useState<string | null>(null);
  const [showEdgeCode, setShowEdgeCode] = useState(false);

  // Sync Logic State
  const [importOnlyInStock, setImportOnlyInStock] = useState(true);
  const [isProductSyncing, setIsProductSyncing] = useState(false);
  const [isPhotoSyncing, setIsPhotoSyncing] = useState(false); // Controlled by child component callback
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

  const addLog = (msg: string) => setSyncLogs(prev => [...prev.slice(-20), msg]);

  // --- SINGLE TEST LOGIC (MOVED FROM ORIGINAL FILE) ---
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

  const runSingleTest = async () => {
      if (!selectedTestProduct) return;
      setTestLoading(true);
      setTestResultImage(null);
      setTestSaveStatus('idle');
      setDebugResponse(null);

      try {
          const savedConfigStr = localStorage.getItem('forsage_sync_photo_config') || JSON.stringify(PHOTO_DEFAULT_CONFIG);
          const config = JSON.parse(savedConfigStr);

          const val = selectedTestProduct[photoSourceField];
          if (!val) throw new Error(`Поле ${photoSourceField} пусте для цього товару.`);
          
          let idToSend = parseInt(val) || 0;
          if (idToSend > 0) idToSend = -idToSend;

          const { data: keyData } = await supabase.from('settings').select('value').eq('key', 'supplier_api_key').single();
          const supplierKey = keyData?.value || '';

          let headers = {};
          let bodyStr = config.body;
          try { headers = JSON.parse(config.headers); } catch(e) {}
          headers = cleanHeaders(headers);

          if (config.method !== 'GET' && bodyStr && supplierKey) {
              bodyStr = bodyStr.replace("INSERT_KEY_HERE", supplierKey);
          }

          let requestBody: any = {};
          if (config.method !== 'GET') {
              try { requestBody = JSON.parse(bodyStr); } catch(e) {}
          }

          if (requestBody.hasOwnProperty('ProductId')) {
              requestBody.ProductId = idToSend;
          }

          const { imageUrl } = await requestServerSideUpload({
              url: config.url,
              method: config.method,
              headers: headers,
              body: requestBody
          }, selectedTestProduct.id);

          setTestResultImage(imageUrl);
          
          await supabase.from('tyres').update({ image_url: imageUrl, in_stock: true }).eq('id', selectedTestProduct.id);
          
          setDebugResponse(`[SUCCESS] Server downloaded and saved image.\nURL: ${imageUrl}`);
          setTestSaveStatus('saved');

      } catch (e: any) {
          setDebugResponse(`Error: ${e.message}`);
          if (e.message.includes("limit")) alert("Ліміт запитів! Спробуйте пізніше.");
          else alert("Помилка: " + e.message);
      } finally {
          setTestLoading(false);
      }
  };

  // --- PRODUCT SYNC LOGIC (LEGACY - KEPT IN MAIN COMPONENT FOR NOW) ---
  const handleRunProductSync = async () => {
      const savedConfigStr = localStorage.getItem('forsage_sync_config');
      const savedMapStr = localStorage.getItem('forsage_sync_mapping');
      const savedSupplier = localStorage.getItem('forsage_sync_supplier');

      if (!savedConfigStr || !savedMapStr || !savedSupplier) {
          alert("Налаштування не знайдено!");
          return;
      }

      setIsProductSyncing(true);
      setSyncProgress({ total: 0, processed: 0, updated: 0, inserted: 0 });
      setSyncLogs(['Запуск синхронізації ТОВАРІВ...']);
      setSyncError('');

      try {
          const config = JSON.parse(savedConfigStr);
          const map = JSON.parse(savedMapStr);
          const supplierId = parseInt(savedSupplier);

          const { data: keyData } = await supabase.from('settings').select('value').eq('key', 'supplier_api_key').single();
          const supplierKey = keyData?.value || '';

          let headers = {};
          let requestBody = null;
          try { headers = JSON.parse(config.headers); } catch(e) {}
          headers = cleanHeaders(headers);

          if (config.method !== 'GET') {
              let bodyStr = config.body;
              if (supplierKey && bodyStr.includes("INSERT_KEY_HERE")) {
                  bodyStr = bodyStr.replace("INSERT_KEY_HERE", supplierKey);
              }
              try { requestBody = JSON.parse(bodyStr); } catch(e) {}
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
                  body: { url: config.url, method: config.method, headers: headers, body: requestBody }
              });

              if (error) throw new Error("Помилка мережі: " + error.message);
              const rawData = result.data !== undefined ? result.data : result;
              
              if (typeof rawData === 'string' && (rawData.includes('JFIF') || rawData.startsWith('PNG'))) {
                  throw new Error("API повернуло зображення замість JSON. Перевірте URL.");
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
                  let stock = 0;
                  const rawStock = map.stock ? getValueByPath(item, map.stock) : 0;
                  if (Array.isArray(rawStock)) {
                      stock = rawStock.reduce((acc: number, wh: any) => {
                          const v = wh.Value || wh.value || wh.amount || wh.quantity || wh.rest || 0;
                          return acc + (parseInt(String(v).replace(/[><+\s]/g, '')) || 0);
                      }, 0);
                  } else if (typeof rawStock === 'object' && rawStock !== null) {
                      const v = (rawStock as any).amount || (rawStock as any).quantity || (rawStock as any).Value || 0;
                      stock = parseInt(String(v).replace(/[><+\s]/g, '')) || 0;
                  } else {
                      stock = parseInt(String(rawStock).replace(/[><+\s]/g, '')) || 0;
                  }

                  if (importOnlyInStock && stock <= 0) return null;

                  let rawPrice = getValueByPath(item, map.price);
                  let price = smartExtractPrice(rawPrice);
                  
                  if (item.CustomerPrice) { const cp = smartExtractPrice(item.CustomerPrice); if (cp > 0) price = cp; }
                  if (price === 0 && item.Price) { const p = smartExtractPrice(item.Price); if (p > 0) price = p; }
                  if (price === 0) { const deep = findPriceRecursively(item); if (deep > 0) price = deep; }

                  const rawBasePrice = map.base_price ? getValueByPath(item, map.base_price) : 0;
                  let basePrice = smartExtractPrice(rawBasePrice);

                  if (price === 0 && basePrice > 0) price = Math.round(basePrice * 1.2); 
                  if (basePrice === 0 && price > 0) basePrice = Math.round(price * 0.8);

                  const title = safeExtractString(getValueByPath(item, map.title)) || 'Без назви';
                  const desc = map.description ? safeExtractString(getValueByPath(item, map.description)) : '';
                  const brand = map.brand ? safeExtractString(getValueByPath(item, map.brand)) || 'Unknown' : 'Unknown';
                  const imageUrl = map.image ? safeExtractString(getValueByPath(item, map.image)) : null;
                  
                  let radius='';
                  const sizeMatch = title.match(/(\d{3})[\/\s](\d{2})[\s\w]*R(\d{2}[C|c]?)/);
                  if (sizeMatch) { radius='R'+sizeMatch[3].toUpperCase(); }

                  const season = detectSeason(title + ' ' + desc);
                  let vehicle_type = 'car';
                  if (radius.includes('C') || title.includes('Truck') || title.includes('LT')) vehicle_type = 'cargo';
                  else if (title.includes('SUV') || title.includes('4x4')) vehicle_type = 'suv';

                  const code = map.code ? safeExtractString(getValueByPath(item, map.code)).trim() : null;
                  const prodNum = map.product_number ? safeExtractString(getValueByPath(item, map.product_number)).trim() : null;

                  return {
                      title, manufacturer: brand, price: String(price), base_price: String(basePrice || price),
                      image_url: imageUrl, catalog_number: code, product_number: prodNum,
                      stock_quantity: stock, in_stock: stock > 0, supplier_id: supplierId,
                      description: desc || 'API Import', season, radius, vehicle_type
                  };
              }).filter((item: any) => item !== null);

              const uniqueBatch = new Map();
              mappedBatch.forEach((item: any) => {
                  if (item.catalog_number) uniqueBatch.set(`${item.catalog_number}_${supplierId}`, item);
              });
              const payload = Array.from(uniqueBatch.values());

              if (payload.length > 0) {
                  const { error } = await supabase.from('tyres').upsert(payload, { 
                      onConflict: 'catalog_number,supplier_id', ignoreDuplicates: false 
                  });
                  if (error) addLog(`Batch Error: ${error.message}`);
                  else {
                      setSyncProgress(prev => ({ ...prev, total: prev.total + batchItems.length, processed: prev.processed + batchItems.length, inserted: prev.inserted + payload.length }));
                      addLog(`Processed batch of ${payload.length} items.`);
                  }
              }

              if (batchItems.length < BATCH_SIZE) keepFetching = false;
              else offset += BATCH_SIZE;
          }

          addLog("Готово!");
          const now = new Date().toLocaleString('uk-UA');
          localStorage.setItem('forsage_last_sync', now);
          setLastSyncTime(now);

      } catch (e: any) {
          setSyncError(e.message);
          addLog("ПОМИЛКА: " + e.message);
      } finally {
          setIsProductSyncing(false);
      }
  };

  const handleApiResponse = (data: any, status: number, config: any) => {
      setResponseData(data);
      setResponseStatus(status);
      setApiConfig(config);
      setDebugResponse(typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data));
  };

  const handleFinishConfig = () => {
      setViewMode('dashboard');
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
                           <div className={`w-3 h-3 rounded-full ${isProductSyncing || isPhotoSyncing ? 'bg-[#FFC300] animate-ping' : syncError ? 'bg-red-500' : 'bg-green-500'}`}></div>
                           <span className="text-zinc-400 font-bold uppercase text-xs tracking-widest">
                               {isProductSyncing || isPhotoSyncing ? 'СИНХРОНІЗАЦІЯ...' : syncError ? 'ПОМИЛКА / ЗУПИНЕНО' : 'ГОТОВО ДО РОБОТИ'}
                           </span>
                       </div>
                       {lastSyncTime && <div className="text-xs text-zinc-500">Останнє оновлення: {lastSyncTime}</div>}
                   </div>

                   {/* PRODUCT SYNC PROGRESS (LEGACY VIEW FOR PRODUCTS) */}
                   {isProductSyncing && (
                       <div className="space-y-6 mb-6">
                           <div className="bg-black/50 rounded-xl p-4 font-mono text-xs text-zinc-400 h-32 overflow-y-auto border border-zinc-800 shadow-inner">
                               {syncLogs.map((log, i) => (
                                   <div key={i} className="mb-1 border-b border-zinc-800/50 pb-1 last:border-0">{log}</div>
                               ))}
                               <div className="animate-pulse text-[#FFC300]">Обробка товарів...</div>
                           </div>
                       </div>
                   )}

                   {/* MAIN ACTIONS */}
                   <div className="flex flex-col gap-3">
                       
                       {/* STOCK FILTER UI */}
                       <div className="flex justify-center mb-2">
                           <label className="flex items-center gap-2 cursor-pointer bg-zinc-800/50 px-4 py-2 rounded-lg border border-zinc-700">
                               <input type="checkbox" checked={importOnlyInStock} onChange={e => setImportOnlyInStock(e.target.checked)} className="w-4 h-4 accent-[#FFC300]" />
                               <span className={`text-xs font-bold uppercase transition-colors ${importOnlyInStock ? 'text-green-400' : 'text-zinc-500'}`}>
                                   Імпортувати тільки наявні (Stock > 0)
                               </span>
                           </label>
                       </div>

                       <button 
                           onClick={handleRunProductSync}
                           disabled={isProductSyncing || isPhotoSyncing}
                           className={`w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-lg transition-all active:scale-95 ${
                               isProductSyncing 
                               ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                               : 'bg-gradient-to-r from-[#FFC300] to-[#FFD700] hover:from-[#e6b000] hover:to-[#e6b000] text-black shadow-yellow-900/20'
                           }`}
                       >
                           {isProductSyncing ? <Loader2 className="animate-spin" size={20} /> : <Box size={20} fill="currentColor" className="text-black/50"/>}
                           {isProductSyncing ? 'СИНХРОНІЗАЦІЯ ТОВАРІВ...' : 'СИНХРОНІЗУВАТИ ТОВАРИ (Ціни/Залишки)'}
                       </button>

                       {/* PHOTO SYNC MODULE */}
                       <PhotoSyncDashboard 
                           disabled={isProductSyncing} 
                           onSyncStateChange={setIsPhotoSyncing}
                       />
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
                                description="Запит для отримання фото. ProductId буде підставлено автоматично замість 0."
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
                                   <h4 className="text-white font-bold flex items-center gap-2"><ImageIcon size={18}/> Тест одного товару (v2.0 PROXY)</h4>
                                   <div className="flex items-center gap-2">
                                       <button onClick={() => setShowEdgeCode(!showEdgeCode)} className="text-xs text-blue-400 font-bold underline px-2 flex items-center gap-1">
                                           <Code size={12}/> {showEdgeCode ? 'Приховати код' : 'Код Сервера (Edge Function)'}
                                       </button>
                                       <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1 rounded-full text-xs">
                                           <span className={isBinaryMode ? "text-[#FFC300] font-bold" : "text-zinc-500"}>Binary Mode</span>
                                           <button onClick={() => { setIsBinaryMode(!isBinaryMode); localStorage.setItem('forsage_sync_binary_mode', String(!isBinaryMode)); }}>
                                               {isBinaryMode ? <ToggleRight className="text-[#FFC300]" size={24}/> : <ToggleLeft className="text-zinc-500" size={24}/>}
                                           </button>
                                       </div>
                                   </div>
                               </div>

                               {/* EDGE FUNCTION CODE VIEWER */}
                               {showEdgeCode && (
                                   <div className="bg-black border border-zinc-700 rounded-xl p-4 animate-in slide-in-from-top-2">
                                       <div className="flex justify-between items-center mb-2">
                                           <h5 className="text-[#FFC300] font-bold text-xs uppercase">Вставте цей код у Supabase Edge Function "foto"</h5>
                                           <button onClick={() => navigator.clipboard.writeText(EDGE_FUNCTION_CODE)} className="text-zinc-400 hover:text-white flex items-center gap-1 text-xs"><Copy size={12}/> Копіювати</button>
                                       </div>
                                       <textarea readOnly className="w-full h-48 bg-zinc-900 text-green-400 font-mono text-[10px] p-2 rounded border border-zinc-800" value={EDGE_FUNCTION_CODE} />
                                   </div>
                               )}

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
                                                       onClick={() => { setSelectedTestProduct(p); setTestResultImage(null); setDebugResponse(null); }}
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
                                                   <option value="product_number">product_number (ID)</option>
                                                   <option value="catalog_number">catalog_number (Art)</option>
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
                                           </div>
                                       )}
                                   </div>
                               )}

                               {/* 4. DEBUG RESPONSE BOX (ALWAYS VISIBLE IF DATA EXISTS) */}
                               {debugResponse && (
                                   <div className="bg-black border border-zinc-700 rounded-xl p-4 animate-in fade-in">
                                       <h5 className="text-zinc-400 text-xs font-bold uppercase mb-2 flex items-center gap-2"><Bug size={14}/> Відповідь сервера (Debug)</h5>
                                       <textarea 
                                           readOnly 
                                           value={debugResponse} 
                                           className="w-full h-40 bg-zinc-900 border border-zinc-800 rounded p-2 text-[10px] font-mono text-green-400 outline-none resize-none"
                                       />
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
