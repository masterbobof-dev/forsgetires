
import React, { useState, useEffect, useMemo } from 'react';
import { Globe, Settings, Play, CheckCircle, AlertTriangle, Loader2, Database, ArrowRight, X, Terminal, ChevronLeft, Save, Image as ImageIcon, Box, FileImage, Key, UploadCloud, ToggleLeft, ToggleRight, Briefcase, Search, Download, Bug, RefreshCw, FileQuestion } from 'lucide-react';
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
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
        if (val.value !== undefined) return String(val.value);
        if (val.name !== undefined) return String(val.name);
        if (val.id !== undefined) return String(val.id);
        if (val.code !== undefined) return String(val.code);
        return ''; 
    }
    return String(val).trim();
};

const smartExtractPrice = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;

    let str = '';

    if (Array.isArray(val)) {
        if (val.length === 0) return 0;
        return smartExtractPrice(val[0]);
    }

    if (typeof val === 'object') {
        if (val.CustomerPrice) return smartExtractPrice(val.CustomerPrice);
        if (val.Price) return smartExtractPrice(val.Price);
        
        const candidates = [
            val.Value, val.value, val.Amount, val.amount, val.Retail, val.retail,
            val.Cost, val.cost, val.Rrc, val.rrc, val.Uah, val.uah
        ];
        const found = candidates.find(c => c !== undefined && c !== null && smartExtractPrice(c) > 0);
        if (found !== undefined) return smartExtractPrice(found);
        
        const values = Object.values(val);
        const numVal = values.find(v => typeof v === 'number' && v > 0);
        if (numVal) return numVal as number;
        
        return 0; 
    }

    str = String(val).trim();
    str = str.replace(/\s/g, '').replace(/\u00A0/g, '');
    if (str.includes(',')) {
        const parts = str.split(',');
        if (parts[parts.length-1].length === 2) {
             str = str.split('.').join(''); 
             str = str.replace(',', '.');   
        } else {
             str = str.split(',').join('');
        }
    } else {
        if ((str.match(/\./g) || []).length > 1) {
             str = str.replace(/\./g, '');
        }
    }
    str = str.replace(/[^\d.-]/g, '');
    return parseFloat(str) || 0;
};

const findPriceRecursively = (obj: any): number => {
    if (!obj || typeof obj !== 'object') return 0;
    if (obj.CustomerPrice !== undefined) {
        const cp = smartExtractPrice(obj.CustomerPrice);
        if (cp > 0) return cp;
    }
    if (obj.Price !== undefined) {
        const p = smartExtractPrice(obj.Price);
        if (p > 0) return p;
    }
    const priorityKeys = ['price', 'retail', 'cost', 'value', 'uah'];
    for (const key of Object.keys(obj)) {
        const lowerKey = key.toLowerCase();
        if (priorityKeys.some(pk => lowerKey.includes(pk))) {
             const val = smartExtractPrice(obj[key]);
             if (val > 0) return val;
        }
    }
    for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object') {
            const res = findPriceRecursively(obj[key]);
            if (res > 0) return res;
        }
    }
    return 0;
}

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

// --- ADVANCED BINARY PROCESSOR ---
// Detects if the response is actually JSON, Base64, or Raw Binary
const processBinaryData = (data: any): Blob | null => {
    try {
        if (!data) return null;
        if (data instanceof Blob) return data;

        let buffer: Uint8Array;

        // 1. Convert to Uint8Array
        if (data instanceof ArrayBuffer) {
            buffer = new Uint8Array(data);
        } else if (typeof data === 'object' && data.type === 'Buffer' && Array.isArray(data.data)) {
            buffer = new Uint8Array(data.data);
        } else if (typeof data === 'string') {
            // Check if it's Base64 String directly
            if (data.length > 100 && !data.includes(' ') && (data.startsWith('/9j/') || data.startsWith('iVBOR'))) {
                 const binStr = atob(data);
                 buffer = new Uint8Array(binStr.length);
                 for (let i = 0; i < binStr.length; i++) buffer[i] = binStr.charCodeAt(i);
            } else {
                 // Assume raw binary string
                 buffer = new Uint8Array(data.length);
                 for (let i = 0; i < data.length; i++) buffer[i] = data.charCodeAt(i) & 0xff;
            }
        } else {
            return null;
        }

        // 2. CHECK MAGIC NUMBERS (JPEG/PNG)
        if (buffer.length > 3) {
            // JPEG: FF D8 FF
            if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
                return new Blob([buffer], { type: 'image/jpeg' });
            }
            // PNG: 89 50 4E 47
            if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
                return new Blob([buffer], { type: 'image/png' });
            }
        }

        // 3. SPECIAL HANDLING FOR JSON WRAPPED BINARY STRING (Proxy Case)
        // If buffer starts with '{' (123) or '[' (91)
        if (buffer[0] === 123 || buffer[0] === 91) {
            try {
                const text = new TextDecoder('utf-8').decode(buffer);
                const json = JSON.parse(text);
                
                // Recursively find a string value that looks like a binary image (JFIF header)
                // "" usually maps to EF BF BD EF BF BD in UTF8 if misinterpreted, or FF D8 in raw
                // We look for a string property that is long and contains JFIF or PNG signature
                
                const findImageString = (obj: any): string | null => {
                    if (typeof obj === 'string') {
                        // Check for JFIF signature "JFIF" (4A 46 49 46) inside the first 20 chars
                        if (obj.length > 100 && obj.substring(0, 20).includes('JFIF')) return obj;
                        // Check for PNG signature
                        if (obj.length > 100 && obj.startsWith('PNG')) return obj;
                        // Check Base64 signature
                        if (obj.startsWith('/9j/') || obj.startsWith('iVBOR')) return obj;
                        return null;
                    }
                    if (typeof obj === 'object' && obj !== null) {
                        for (const key in obj) {
                            const found = findImageString(obj[key]);
                            if (found) return found;
                        }
                    }
                    return null;
                };
                
                const imgStr = findImageString(json);
                
                if (imgStr) {
                    if (imgStr.startsWith('/9j/') || imgStr.startsWith('iVBOR')) {
                        // Base64
                        const binStr = atob(imgStr);
                        const imgBuffer = new Uint8Array(binStr.length);
                        for (let i = 0; i < binStr.length; i++) imgBuffer[i] = binStr.charCodeAt(i);
                        return new Blob([imgBuffer], { type: 'image/jpeg' });
                    } else {
                        // Raw Binary String inside JSON
                        const imgBuffer = new Uint8Array(imgStr.length);
                        for (let i = 0; i < imgStr.length; i++) imgBuffer[i] = imgStr.charCodeAt(i) & 0xff;
                        return new Blob([imgBuffer], { type: 'image/jpeg' });
                    }
                }
            } catch (e) {
                // Not valid JSON or parse error, continue to fallback
            }
        }

        // 4. Fallback: Return as JPEG anyway if size > 500 bytes (might be headerless or offset)
        if (buffer.length > 500) {
            return new Blob([buffer], { type: 'image/jpeg' });
        }

        return null;
    } catch (e) {
        console.error("Binary processing error", e);
        return null;
    }
};

const getHexHeader = (buffer: ArrayBuffer) => {
    const view = new Uint8Array(buffer).slice(0, 20);
    return Array.from(view).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
};

const PHOTO_DEFAULT_CONFIG = {
    method: 'POST',
    url: 'https://public.omega.page/public/api/v1.0/product/image',
    headers: '{\n  "Content-Type": "application/json",\n  "Accept": "image/jpeg"\n}',
    body: JSON.stringify({
      "ProductId": 0,
      "Number": 1,
      "Key": "INSERT_KEY_HERE"
    }, null, 2)
};

const SyncTab: React.FC = () => {
  const [viewMode, setViewMode] = useState<'dashboard' | 'config'>('dashboard');
  const [configTab, setConfigTab] = useState<'products' | 'photos'>('products');
  
  const [responseData, setResponseData] = useState<any>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [apiConfig, setApiConfig] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]); 

  const [photoMap, setPhotoMap] = useState({ idKey: 'id', urlKey: 'photoUrl' });
  const [photoSourceField, setPhotoSourceField] = useState<'product_number' | 'catalog_number'>('product_number');
  const [isBinaryMode, setIsBinaryMode] = useState(true);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [forceOverwritePhotos, setForceOverwritePhotos] = useState(false);

  const [dbSearch, setDbSearch] = useState('');
  const [foundProducts, setFoundProducts] = useState<any[]>([]);
  const [selectedTestProduct, setSelectedTestProduct] = useState<any | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResultImage, setTestResultImage] = useState<string | null>(null);
  const [testResultBlob, setTestResultBlob] = useState<Blob | null>(null);
  const [testSaveStatus, setTestSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [debugResponse, setDebugResponse] = useState<string | null>(null);

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

  const addLog = (msg: string) => setSyncLogs(prev => [...prev.slice(-20), msg]);

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
      setTestResultBlob(null);
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

          const { data: result, error } = await supabase.functions.invoke('super-endpoint', {
              body: {
                  url: config.url,
                  method: config.method,
                  headers: headers,
                  body: requestBody
                  // NOTE: responseType arraybuffer handles binary data properly
              },
              responseType: 'arraybuffer'
          });

          if (error) throw new Error(error.message);

          const rawData = result; // ArrayBuffer
          
          let debugMsg = '';
          const blob = processBinaryData(rawData);

          if (rawData instanceof ArrayBuffer) {
              const hex = getHexHeader(rawData);
              debugMsg = `[Raw Header (Hex)]: ${hex}\n`;
              debugMsg += `Total Size: ${rawData.byteLength} bytes\n`;
              
              if (blob) {
                  debugMsg += `\n[SUCCESS] Detected Valid Image: ${blob.type.toUpperCase()}`;
                  debugMsg += `\nSize: ${blob.size} bytes`;
              } else {
                  try {
                      const text = new TextDecoder('utf-8').decode(rawData);
                      const isJson = text.trim().startsWith('{') || text.trim().startsWith('[');
                      if (isJson) {
                          debugMsg += `\n[WARNING] Response appears to be JSON text, not binary image.`;
                          try {
                              const json = JSON.parse(text);
                              debugMsg += `\nJSON Content Preview:\n${JSON.stringify(json, null, 2).substring(0, 500)}`;
                          } catch {}
                      } else {
                          debugMsg += `\n[ERROR] Unknown Format. Text Preview:\n${text.substring(0, 200)}`;
                      }
                  } catch {
                      debugMsg += `\n[ERROR] Could not decode as text either.`;
                  }
              }
          }
          setDebugResponse(debugMsg);

          if (blob) {
              if (blob.size < 500) {
                  alert("Файл занадто малий (<500b). Це, ймовірно, помилка або пустий файл.");
              }
              const url = URL.createObjectURL(blob);
              setTestResultImage(url);
              setTestResultBlob(blob);
          } else {
              alert("Не вдалося розпізнати зображення. Перевірте Debug лог.");
          }

      } catch (e: any) {
          setDebugResponse(`Error: ${e.message}`);
          alert("Помилка тесту: " + e.message);
      } finally {
          setTestLoading(false);
      }
  };

  const saveTestImage = async () => {
      if (!testResultBlob || !selectedTestProduct) return;
      setTestSaveStatus('saving');
      try {
          const ext = testResultBlob.type === 'image/png' ? 'png' : 'jpg';
          const fileName = `tyre_${selectedTestProduct.id}_${Date.now()}.${ext}`;
          
          const { error } = await supabase.storage.from('galery').upload(fileName, testResultBlob, {
              contentType: testResultBlob.type,
              upsert: true
          });
          if (error) throw error;
          
          const { data } = supabase.storage.from('galery').getPublicUrl(fileName);
          await supabase.from('tyres').update({ image_url: data.publicUrl }).eq('id', selectedTestProduct.id);
          
          setTestSaveStatus('saved');
          setSelectedTestProduct({...selectedTestProduct, image_url: data.publicUrl});
      } catch (e: any) {
          setTestSaveStatus('error');
          alert("Помилка збереження: " + e.message);
      }
  };

  const handleRunPhotoSync = async () => {
      const savedSupplier = localStorage.getItem('forsage_sync_supplier');
      if (!savedSupplier) { alert("Оберіть постачальника в налаштуваннях!"); return; }

      const savedConfigStr = localStorage.getItem('forsage_sync_photo_config') || JSON.stringify(PHOTO_DEFAULT_CONFIG);
      let config: any;
      try { config = JSON.parse(savedConfigStr); } catch (e) { alert("Помилка конфігу фото"); return; }

      setIsPhotoSyncing(true);
      setSyncProgress({ total: 0, processed: 0, updated: 0, inserted: 0 });
      setSyncLogs(['Пошук товарів...']);
      setSyncError('');

      try {
          let query = supabase
              .from('tyres')
              .select('id, product_number')
              .eq('supplier_id', parseInt(savedSupplier))
              .not('product_number', 'is', null)
              .limit(50);
          
          // CRITICAL FIX: Explicitly handle overwrite logic
          if (!forceOverwritePhotos) {
              query = query.is('image_url', null);
          }

          const { data: itemsToUpdate, error } = await query;

          if (error) throw error;
          
          if (!itemsToUpdate || itemsToUpdate.length === 0) {
              if (!forceOverwritePhotos) {
                  addLog("Всі товари вже мають фото.");
                  addLog("Увімкніть 'Перезаписати', щоб оновити існуючі.");
              } else {
                  addLog("Товарів не знайдено.");
              }
              setIsPhotoSyncing(false);
              return;
          }

          setSyncProgress(p => ({ ...p, total: itemsToUpdate.length }));
          addLog(`Обробка ${itemsToUpdate.length} товарів...`);

          const { data: keyData } = await supabase.from('settings').select('value').eq('key', 'supplier_api_key').single();
          const supplierKey = keyData?.value || '';

          for (const product of itemsToUpdate) {
              let idToSend = parseInt(product.product_number);
              if (!idToSend) continue;
              if (idToSend > 0) idToSend = -idToSend;

              let requestBody: any = {};
              try {
                  let bodyStr = config.body;
                  if (supplierKey) bodyStr = bodyStr.replace("INSERT_KEY_HERE", supplierKey);
                  requestBody = JSON.parse(bodyStr);
                  requestBody.ProductId = idToSend;
              } catch(e) { continue; }

              const { data: result, error: apiError } = await supabase.functions.invoke('super-endpoint', {
                  body: {
                      url: config.url,
                      method: config.method,
                      headers: JSON.parse(config.headers || '{}'),
                      body: requestBody
                  },
                  responseType: 'arraybuffer'
              });

              if (apiError || !result) {
                  addLog(`API Fail for ${idToSend}`);
                  continue;
              }

              const rawData = result;
              const blob = processBinaryData(rawData);
              
              if (blob && blob.size > 500) {
                  const ext = blob.type === 'image/png' ? 'png' : 'jpg';
                  const fileName = `tyre_${product.id}_${Date.now()}.${ext}`;
                  
                  const { error: uploadError } = await supabase.storage.from('galery').upload(fileName, blob, {
                      contentType: blob.type,
                      upsert: true
                  });

                  if (!uploadError) {
                      const { data: publicUrlData } = supabase.storage.from('galery').getPublicUrl(fileName);
                      await supabase.from('tyres').update({ image_url: publicUrlData.publicUrl }).eq('id', product.id);
                      setSyncProgress(p => ({ ...p, updated: p.updated + 1 }));
                  } else {
                      addLog(`Storage Error: ${uploadError.message}`);
                  }
              } else {
                  addLog(`Bad Data/No Image for ${idToSend}`);
              }
              
              setSyncProgress(p => ({ ...p, processed: p.processed + 1 }));
              await new Promise(r => setTimeout(r, 300));
          }

          addLog("Готово.");

      } catch (e: any) {
          setSyncError(e.message);
          addLog("Error: " + e.message);
      } finally {
          setIsPhotoSyncing(false);
      }
  };

  const handleFinishConfig = () => {
      setViewMode('dashboard');
  };

  // --- PRODUCT SYNC LOGIC ---
  const handleRunAutoSync = async () => {
      const savedConfigStr = localStorage.getItem('forsage_sync_config');
      const savedMapStr = localStorage.getItem('forsage_sync_mapping');
      const savedSupplier = localStorage.getItem('forsage_sync_supplier');

      if (!savedConfigStr || !savedMapStr || !savedSupplier) {
          alert("Налаштування не знайдено!");
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

          const { data: keyData } = await supabase.from('settings').select('value').eq('key', 'supplier_api_key').single();
          const supplierKey = keyData?.value || '';

          let headers = {};
          let requestBody = null;
          try { headers = JSON.parse(config.headers); } catch(e) {}
          
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

              const mappedBatch = batchItems.map((item: any, idx: number) => {
                  let rawPrice = getValueByPath(item, map.price);
                  let price = smartExtractPrice(rawPrice);
                  
                  // --- FORCE PRICE RECOVERY ---
                  if (item.CustomerPrice) {
                      const cp = smartExtractPrice(item.CustomerPrice);
                      if (cp > 0) price = cp;
                  }
                  if (price === 0 && item.Price) {
                      const p = smartExtractPrice(item.Price);
                      if (p > 0) price = p;
                  }
                  if (price === 0) {
                      const deep = findPriceRecursively(item);
                      if (deep > 0) price = deep;
                  }

                  const rawBasePrice = map.base_price ? getValueByPath(item, map.base_price) : 0;
                  const basePrice = smartExtractPrice(rawBasePrice);

                  const title = safeExtractString(getValueByPath(item, map.title)) || 'Без назви';
                  const desc = map.description ? safeExtractString(getValueByPath(item, map.description)) : '';
                  const brand = map.brand ? safeExtractString(getValueByPath(item, map.brand)) || 'Unknown' : 'Unknown';
                  const imageUrl = map.image ? safeExtractString(getValueByPath(item, map.image)) : null;
                  
                  if (idx < 5 && price === 0) {
                      addLog(`[WARN] Price 0 for ${title.substring(0,10)}... (Raw: ${JSON.stringify(item.CustomerPrice || item.Price)})`);
                  }

                  let radius='';
                  const sizeMatch = title.match(/(\d{3})[\/\s](\d{2})[\s\w]*R(\d{2}[C|c]?)/);
                  if (sizeMatch) { radius='R'+sizeMatch[3].toUpperCase(); }

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

              // --- STRICT DEDUPLICATION ---
              const pIds = mappedBatch.map((i: any) => i.product_number).filter((c: any) => c);
              const cIds = mappedBatch.map((i: any) => i.catalog_number).filter((c: any) => c);

              let existingMap = new Map();

              if (pIds.length > 0) {
                  const { data: byPid } = await supabase
                      .from('tyres')
                      .select('id, product_number')
                      .eq('supplier_id', supplierId)
                      .in('product_number', pIds);
                  byPid?.forEach((row: any) => {
                      if(row.product_number) existingMap.set(`PID:${String(row.product_number).trim()}`, row.id);
                  });
              }

              if (cIds.length > 0) {
                  const { data: byCid } = await supabase
                      .from('tyres')
                      .select('id, catalog_number')
                      .eq('supplier_id', supplierId)
                      .in('catalog_number', cIds);
                  byCid?.forEach((row: any) => {
                      if(row.catalog_number) existingMap.set(`CID:${String(row.catalog_number).trim()}`, row.id);
                  });
              }

              const updatesById = new Map<number, any>();
              const insertsByKey = new Map<string, any>();

              for (const item of mappedBatch) {
                  const pidKey = item.product_number ? `PID:${String(item.product_number).trim()}` : null;
                  const cidKey = item.catalog_number ? `CID:${String(item.catalog_number).trim()}` : null;

                  let existingId = pidKey ? existingMap.get(pidKey) : undefined;
                  if (!existingId && cidKey) {
                      existingId = existingMap.get(cidKey);
                  }

                  if (existingId) {
                      updatesById.set(existingId, { ...item, id: existingId });
                  } else {
                      const uniqueKey = pidKey || cidKey || JSON.stringify(item.title);
                      insertsByKey.set(uniqueKey, item);
                  }
              }

              const toUpdate = Array.from(updatesById.values());
              const toInsert = Array.from(insertsByKey.values());

              if (toUpdate.length > 0) {
                  const { error } = await supabase.from('tyres').upsert(toUpdate);
                  if (error) addLog(`Update Error: ${error.message}`);
              }
              if (toInsert.length > 0) {
                  const { error } = await supabase.from('tyres').upsert(toInsert, { onConflict: 'catalog_number,supplier_id' });
                  if (error) addLog(`Insert Error: ${error.message}`);
              }

              setSyncProgress(prev => ({
                  total: prev.total + batchItems.length,
                  processed: prev.processed + batchItems.length,
                  updated: prev.updated + toUpdate.length,
                  inserted: prev.inserted + toInsert.length
              }));
              
              if(toUpdate.length > 0 || toInsert.length > 0) {
                  addLog(`Upd: ${toUpdate.length}, New: ${toInsert.length}`);
              }

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
      setDebugResponse(typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data));
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
                                   <div className="text-[10px] text-zinc-500 uppercase font-bold">Нових/Фото</div>
                               </div>
                           </div>

                           {/* LOGS */}
                           <div className="bg-black/50 rounded-xl p-4 font-mono text-xs text-zinc-400 h-64 overflow-y-auto border border-zinc-800 shadow-inner">
                               {syncLogs.map((log, i) => (
                                   <div key={i} className={`mb-1 border-b border-zinc-800/50 pb-1 last:border-0 break-words ${log.includes('[HINT]') ? 'text-[#FFC300] font-bold' : ''}`}>
                                       <span className="text-zinc-600 mr-2">{'>'}</span>{log}
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
                               Автоматична синхронізація цін, залишків та фотографій.
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

                       {/* MASS PHOTO SYNC BUTTON */}
                       <div className="bg-zinc-800/50 p-2 rounded-2xl border border-zinc-700">
                           <label className="flex items-center gap-2 px-3 py-2 cursor-pointer mb-2 group">
                               <input type="checkbox" checked={forceOverwritePhotos} onChange={e => setForceOverwritePhotos(e.target.checked)} className="w-4 h-4 accent-[#FFC300]" />
                               <span className={`text-xs font-bold uppercase select-none transition-colors ${forceOverwritePhotos ? 'text-[#FFC300]' : 'text-zinc-300'}`}>Перезаписати існуючі фото</span>
                           </label>
                           <button 
                               onClick={handleRunPhotoSync}
                               disabled={isSyncing || isPhotoSyncing}
                               className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-3 border transition-all active:scale-95 ${
                                   isPhotoSyncing 
                                   ? 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed' 
                                   : 'bg-zinc-800 text-white border-zinc-700 hover:border-[#FFC300] hover:bg-zinc-700'
                               }`}
                           >
                               {isPhotoSyncing ? <Loader2 className="animate-spin" size={16} /> : <ImageIcon size={16} />}
                               {isPhotoSyncing ? 'ЗАВАНТАЖЕННЯ ФОТО...' : forceOverwritePhotos ? 'ОНОВИТИ ФОТО (ПЕРЕЗАПИС)' : 'СИНХРОНІЗУВАТИ ФОТО (ТІЛЬКИ НОВІ)'}
                           </button>
                       </div>
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
