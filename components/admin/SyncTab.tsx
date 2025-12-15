
import React, { useState, useEffect } from 'react';
import { Globe, Settings, CheckCircle, Database, Box, Briefcase, Search, Download, Bug, ToggleLeft, ToggleRight, Check, Code, Copy, FileText, Loader2, AlertTriangle, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import ApiRequestPanel from './sync/ApiRequestPanel';
import ImportMapper from './sync/ImportMapper';
import PhotoSyncDashboard from './sync/PhotoSyncDashboard';
import { cleanHeaders, requestServerSideUpload, EDGE_FUNCTION_CODE, PHOTO_DEFAULT_CONFIG } from './sync/syncUtils';

const SyncTab: React.FC = () => {
  const [viewMode, setViewMode] = useState<'dashboard' | 'config'>('dashboard');
  
  // CHANGED: 'excel' removed from tabs
  const [activeTab, setActiveTab] = useState<'api' | 'photos'>('api');
  
  const [responseData, setResponseData] = useState<any>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [apiConfig, setApiConfig] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]); 

  // Single Item Test State (Photos)
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
  const [isProductSyncing, setIsProductSyncing] = useState(false);
  const [isPhotoSyncing, setIsPhotoSyncing] = useState(false);
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

  // --- SINGLE TEST LOGIC ---
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

  const handleRunProductSync = () => {
      setViewMode('config');
      setActiveTab('api');
      alert("Для синхронізації товарів перейдіть у вкладку 'API СИНХРОНІЗАЦІЯ' та натисніть 'СИНХРОНІЗУВАТИ ВСЕ'.");
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
                   <Globe className="text-[#FFC300]" /> Центр Синхронізації (API)
               </h3>
               <p className="text-zinc-400 text-sm mt-1">
                   {viewMode === 'dashboard' ? 'Керування онлайн оновленнями' : 'Режим налаштування підключення'}
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

                   {/* MAIN ACTIONS */}
                   <div className="flex flex-col gap-3">
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
                           {isProductSyncing ? 'СИНХРОНІЗАЦІЯ ТОВАРІВ...' : 'СИНХРОНІЗУВАТИ ТОВАРИ (API)'}
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
               
               {/* MAIN TABS NAVIGATION */}
               <div className="flex flex-wrap gap-2 mb-4 shrink-0 border-b border-zinc-800 pb-2">
                   <button 
                        onClick={() => setActiveTab('api')}
                        className={`px-6 py-3 rounded-t-xl font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${activeTab === 'api' ? 'text-[#FFC300] border-[#FFC300] bg-zinc-900' : 'text-zinc-500 border-transparent hover:text-white'}`}
                   >
                       <RefreshCw size={16}/> API (Синхронізація)
                   </button>
                   <button 
                        onClick={() => setActiveTab('photos')}
                        className={`px-6 py-3 rounded-t-xl font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${activeTab === 'photos' ? 'text-blue-400 border-blue-500 bg-zinc-900' : 'text-zinc-500 border-transparent hover:text-white'}`}
                   >
                       <ImageIcon size={16}/> ФОТО
                   </button>
               </div>

               {/* TAB CONTENT */}
               <div className="flex-grow h-full overflow-hidden">
                   
                   {/* 1. API TAB */}
                   {activeTab === 'api' && (
                       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full items-start overflow-hidden">
                           <div className="h-full overflow-y-auto pb-20">
                               <ApiRequestPanel 
                                    onResponse={handleApiResponse} 
                                    storageKey="forsage_sync_config"
                                    title="Крок 1: Налаштування API"
                                    description="Виконайте запит до постачальника (напр. Omega) для отримання списку шин."
                               />
                           </div>
                           <div className="h-full min-h-[600px] overflow-y-auto pb-20">
                               <ImportMapper 
                                  responseData={responseData} 
                                  responseStatus={responseStatus} 
                                  apiConfig={apiConfig}
                               />
                           </div>
                       </div>
                   )}

                   {/* 3. PHOTOS TAB */}
                   {activeTab === 'photos' && (
                       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full items-start overflow-hidden">
                           <div className="h-full overflow-y-auto pb-20">
                               <ApiRequestPanel 
                                    onResponse={handleApiResponse} 
                                    storageKey="forsage_sync_photo_config"
                                    defaultConfig={PHOTO_DEFAULT_CONFIG}
                                    title="Налаштування API Фото"
                                    description="Запит для отримання фото. ProductId буде підставлено автоматично."
                               />
                           </div>
                           <div className="h-full min-h-[600px] overflow-y-auto pb-20">
                               {/* SINGLE ITEM TEST MODE */}
                               <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-6">
                                   <div className="flex justify-between items-center">
                                       <h4 className="text-white font-bold flex items-center gap-2"><ImageIcon size={18}/> Тест одного товару (v2.0 PROXY)</h4>
                                       <div className="flex items-center gap-2">
                                           <button onClick={() => setShowEdgeCode(!showEdgeCode)} className="text-xs text-blue-400 font-bold underline px-2 flex items-center gap-1">
                                               <Code size={12}/> {showEdgeCode ? 'Приховати код' : 'Код Сервера'}
                                           </button>
                                           <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1 rounded-full text-xs">
                                               <span className={isBinaryMode ? "text-[#FFC300] font-bold" : "text-zinc-500"}>Binary</span>
                                               <button onClick={() => { setIsBinaryMode(!isBinaryMode); localStorage.setItem('forsage_sync_binary_mode', String(!isBinaryMode)); }}>
                                                   {isBinaryMode ? <ToggleRight className="text-[#FFC300]" size={24}/> : <ToggleLeft className="text-zinc-500" size={24}/>}
                                               </button>
                                           </div>
                                       </div>
                                   </div>

                                   {showEdgeCode && (
                                       <div className="bg-black border border-zinc-700 rounded-xl p-4 animate-in slide-in-from-top-2">
                                           <div className="flex justify-between items-center mb-2">
                                               <h5 className="text-[#FFC300] font-bold text-xs uppercase">Вставте цей код у Supabase Edge Function "foto"</h5>
                                               <button onClick={() => navigator.clipboard.writeText(EDGE_FUNCTION_CODE)} className="text-zinc-400 hover:text-white flex items-center gap-1 text-xs"><Copy size={12}/> Копіювати</button>
                                           </div>
                                           <textarea readOnly className="w-full h-48 bg-zinc-900 text-green-400 font-mono text-[10px] p-2 rounded border border-zinc-800" value={EDGE_FUNCTION_CODE} />
                                       </div>
                                   )}

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
                           </div>
                       </div>
                   )}
               </div>
           </div>
       )}
    </div>
  );
};

export default SyncTab;
