
import React, { useState, useEffect, useRef } from 'react';
import { Globe, Settings, CheckCircle, AlertTriangle, Loader2, Database, Save, Image as ImageIcon, Box, Briefcase, Search, Download, Bug, ToggleLeft, ToggleRight, StopCircle, EyeOff, FileText, Ban, Check, Code, Copy, Play, SkipForward, RefreshCw } from 'lucide-react';
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

const cleanHeaders = (headers: any) => {
    const cleaned: any = {};
    if (!headers) return cleaned;
    Object.keys(headers).forEach(key => {
        const lower = key.toLowerCase();
        if (lower !== 'host' && lower !== 'content-length' && lower !== 'connection' && lower !== 'accept-encoding') {
            cleaned[key] = headers[key];
        }
    });
    return cleaned;
};

// --- NEW SERVER-SIDE SAVE LOGIC ---
const requestServerSideUpload = async (bodyPayload: any, productId: string | number): Promise<{ imageUrl: string, status: number }> => {
    // We send a flag "saveToStorage: true" and the filename to the Edge Function
    const requestData = {
        ...bodyPayload,
        _saveToStorage: true,
        _fileName: `tyre_${productId}_${Date.now()}.jpg`
    };

    const { data, error } = await supabase.functions.invoke('foto', {
        body: requestData
    });

    if (error) {
        throw new Error("Edge Function Error: " + error.message);
    }

    if (!data) {
        throw new Error("SERVER ERROR: Порожня відповідь.");
    }

    // Check for Logic Errors returned by our function
    if (data.error) {
        const errLower = data.error.toLowerCase();
        if (errLower.includes("limit") || errLower.includes("exceeded")) throw new Error("LIMIT_EXCEEDED");
        throw new Error("API/Server Error: " + data.error);
    }

    if (!data.imageUrl) {
        // Fallback: If function returned generic success but no URL
        throw new Error("Сервер не повернув посилання на фото.");
    }

    return { imageUrl: data.imageUrl, status: 200 };
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

// UPDATED EDGE FUNCTION CODE (SERVER-SIDE UPLOAD)
const EDGE_FUNCTION_CODE = `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url, method, headers, body, _saveToStorage, _fileName } = await req.json()

    if (!url) throw new Error("Missing URL");

    // 1. Prepare Headers for Omega
    const upstreamHeaders = new Headers(headers || {})
    const forbidden = ['host', 'content-length', 'connection', 'origin', 'referer'];
    forbidden.forEach(k => upstreamHeaders.delete(k));
    upstreamHeaders.set('Accept', 'image/jpeg, image/png, application/json');
    if (body) upstreamHeaders.set('Content-Type', 'application/json');

    console.log(\`Fetching: \${method} \${url}\`);

    // 2. Fetch from Omega
    const res = await fetch(url, {
      method: method || 'GET',
      headers: upstreamHeaders,
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null
    })

    // 3. Get Binary Data
    const arrayBuffer = await res.arrayBuffer();

    // 4. Validate Data (Check if it's JSON error or HTML)
    if (arrayBuffer.byteLength < 500) {
        const text = new TextDecoder().decode(arrayBuffer);
        // Check for specific Omega errors
        if (text.includes('request_limit_exceeded')) throw new Error("request_limit_exceeded");
        if (text.includes('Error') || text.includes('false')) throw new Error("API Error: " + text);
        if (arrayBuffer.byteLength === 0) throw new Error("Empty response from API");
    }

    // Check Magic Numbers (Simple JPEG/PNG check)
    const view = new Uint8Array(arrayBuffer);
    const isJpeg = view[0] === 0xFF && view[1] === 0xD8;
    const isPng = view[0] === 0x89 && view[1] === 0x50;
    
    if (!isJpeg && !isPng && view[0] !== 0x00) {
       // If it's not an image, try to return text for debugging
       const text = new TextDecoder().decode(view.slice(0, 100));
       throw new Error("Not an image. Response start: " + text);
    }

    // 5. SERVER-SIDE UPLOAD (If requested)
    if (_saveToStorage && _fileName) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        
        if (!supabaseKey) throw new Error("Server Config Error: Missing Service Role Key");

        const supabase = createClient(supabaseUrl, supabaseKey);

        const contentType = isPng ? 'image/png' : 'image/jpeg';
        
        const { data, error } = await supabase.storage
            .from('galery')
            .upload(_fileName, arrayBuffer, { contentType: contentType, upsert: true });

        if (error) throw error;

        const { data: publicUrlData } = supabase.storage
            .from('galery')
            .getPublicUrl(_fileName);

        return new Response(JSON.stringify({ imageUrl: publicUrlData.publicUrl }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Fallback: Return binary (Legacy Mode)
    return new Response(arrayBuffer, {
      status: res.status,
      headers: {
        ...corsHeaders,
        'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Length': String(arrayBuffer.byteLength)
      }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // Return 200 so client can parse JSON error safely
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})`;

interface DetailedLogItem {
    id: number;
    productId: string;
    status: 'success' | 'error' | 'skipped';
    message: string;
    details?: string;
    timestamp: string;
}

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
  
  // --- OPTIONS ---
  const [forceOverwritePhotos, setForceOverwritePhotos] = useState(false);
  const [skipOutOfStock, setSkipOutOfStock] = useState(true); // For Photo Sync
  const [customStartId, setCustomStartId] = useState(''); // NEW: Resume feature
  const [lastSuccessCursor, setLastSuccessCursor] = useState(''); // Auto-save cursor
  const [fixBrokenLinks, setFixBrokenLinks] = useState(false); // NEW: Only replace broken images
  const [importOnlyInStock, setImportOnlyInStock] = useState(true); // NEW: For Product Sync

  const [dbSearch, setDbSearch] = useState('');
  const [foundProducts, setFoundProducts] = useState<any[]>([]);
  const [selectedTestProduct, setSelectedTestProduct] = useState<any | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResultImage, setTestResultImage] = useState<string | null>(null);
  
  const [testSaveStatus, setTestSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [debugResponse, setDebugResponse] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isPhotoSyncing, setIsPhotoSyncing] = useState(false);
  const isPhotoSyncingRef = useRef(false); // To handle stop button

  const [syncProgress, setSyncProgress] = useState({ total: 0, processed: 0, updated: 0, inserted: 0 });
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  
  // NEW: Detailed Logs for Table
  const [detailedLogs, setDetailedLogs] = useState<DetailedLogItem[]>([]);
  
  const [syncError, setSyncError] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [showEdgeCode, setShowEdgeCode] = useState(false);

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

      // LOAD LAST CURSOR
      const savedCursor = localStorage.getItem('forsage_photo_last_id');
      if (savedCursor) setLastSuccessCursor(savedCursor);

      if (hasConfig && hasMap && hasSupplier) {
          setViewMode('dashboard');
      } else {
          setViewMode('config');
      }
  }, []);

  const addLog = (msg: string) => setSyncLogs(prev => [...prev.slice(-20), msg]);
  
  const addDetailedLog = (item: Omit<DetailedLogItem, 'timestamp'>) => {
      setDetailedLogs(prev => {
          const newItem = { ...item, timestamp: new Date().toLocaleTimeString() };
          return [newItem, ...prev].slice(0, 500); // Keep last 500 logs
      });
  };

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

          // SERVER SIDE UPLOAD & RETURN LINK
          const { imageUrl } = await requestServerSideUpload({
              url: config.url,
              method: config.method,
              headers: headers,
              body: requestBody
          }, selectedTestProduct.id);

          setTestResultImage(imageUrl);
          
          // Auto Update DB for test
          await supabase.from('tyres').update({ image_url: imageUrl, in_stock: true }).eq('id', selectedTestProduct.id);
          
          let debugMsg = `[SUCCESS] Server downloaded and saved image.\nURL: ${imageUrl}`;
          setDebugResponse(debugMsg);
          setTestSaveStatus('saved');

      } catch (e: any) {
          setDebugResponse(`Error: ${e.message}`);
          if (e.message.includes("limit")) {
              alert("Ліміт запитів! Спробуйте пізніше.");
          } else {
              alert("Помилка: " + e.message);
          }
      } finally {
          setTestLoading(false);
      }
  };

  const saveTestImage = async () => {
      if (!selectedTestProduct || !testResultImage) return;
      setTestSaveStatus('saving');
      try {
          const { error } = await supabase.from('tyres').update({ image_url: testResultImage, in_stock: true }).eq('id', selectedTestProduct.id);
          if (error) throw error;
          setTestSaveStatus('saved');
      } catch (e: any) {
          alert("Помилка збереження: " + e.message);
          setTestSaveStatus('error');
      }
  };

  const handleStopSync = () => {
      isPhotoSyncingRef.current = false;
      addLog("Зупинка процесу користувачем...");
  };

  const handleRunPhotoSync = async () => {
      const savedSupplier = localStorage.getItem('forsage_sync_supplier');
      if (!savedSupplier) { alert("Оберіть постачальника!"); return; }
      
      const savedConfigStr = localStorage.getItem('forsage_sync_photo_config') || JSON.stringify(PHOTO_DEFAULT_CONFIG);
      let config: any;
      try { config = JSON.parse(savedConfigStr); } catch (e) { alert("Помилка конфігу"); return; }

      // Get API Key
      const { data: keyData } = await supabase.from('settings').select('value').eq('key', 'supplier_api_key').single();
      const supplierKey = keyData?.value || '';

      // Initialize State
      isPhotoSyncingRef.current = true;
      setIsPhotoSyncing(true);
      setSyncProgress({ total: 0, processed: 0, updated: 0, inserted: 0 });
      setSyncLogs(['Запуск масової синхронізації...']);
      setDetailedLogs([]); // CLEAR PREVIOUS LOGS
      setSyncError('');

      // Determine starting Count estimate
      let countQuery = supabase.from('tyres').select('*', { count: 'exact', head: true }).eq('supplier_id', parseInt(savedSupplier));
      if (skipOutOfStock) countQuery = countQuery.neq('in_stock', false);
      const { count } = await countQuery;
      setSyncProgress(p => ({ ...p, total: count || 0 }));

      // Batch logic
      // --- CUSTOM START ID ---
      let lastProcessedId = 0;
      if (customStartId) {
          const parsedId = parseInt(customStartId);
          if (!isNaN(parsedId) && parsedId > 0) {
              lastProcessedId = parsedId;
              addLog(`Відновлення з ID: ${lastProcessedId}...`);
          }
      }

      let keepGoing = true;
      const BATCH_SIZE = 1000; // Large batch size to minimize DB requests

      // Counters for reporting
      let skippedCount = 0;
      let errorCount = 0;
      let requestsInThisSession = 0; // Track requests to pause for hourly limit

      try {
          while (keepGoing && isPhotoSyncingRef.current) {
              
              // Construct query: Get next batch of items
              let query = supabase.from('tyres')
                  .select('id, product_number, title, image_url') // Select image_url to check for broken links
                  .eq('supplier_id', parseInt(savedSupplier))
                  .gt('id', lastProcessedId) // Cursor pagination
                  .not('product_number', 'is', null)
                  .order('id', { ascending: true })
                  .limit(BATCH_SIZE);

              // Filter logic
              if (!forceOverwritePhotos && !fixBrokenLinks) {
                  // Only fetch items without photos if overwrite is OFF and fixMode is OFF
                  query = query.or('image_url.is.null,image_url.eq.""');
              }
              // If fixBrokenLinks is ON, we fetch EVERYTHING (or overwrite) and filter in JS

              // SKIP OUT OF STOCK
              if (skipOutOfStock) {
                  query = query.neq('in_stock', false);
              }

              const { data: itemsBatch, error } = await query;

              if (error) throw error;
              
              if (!itemsBatch || itemsBatch.length === 0) {
                  // --- FIX: DETECT EMPTY START ---
                  if (lastProcessedId === 0 && !customStartId) {
                      const msg = skipOutOfStock 
                        ? "Не знайдено товарів (увімкнено 'Тільки в наявності'). Можливо всі товари мають фото або на залишку 0." 
                        : "Не знайдено товарів для обробки. Всі товари мають фото?";
                      
                      addLog(msg);
                      setSyncError(msg); // Set Error to keep UI open
                  } else {
                      addLog("Всі товари оброблено (або кінець списку).");
                  }
                  keepGoing = false;
                  break;
              }

              addLog(`Завантажено пакет: ${itemsBatch.length} шт. (Start ID > ${lastProcessedId})`);

              // Process Batch Loop
              for (const product of itemsBatch) {
                  // Check stop flag inside inner loop
                  if (!isPhotoSyncingRef.current) { keepGoing = false; break; }

                  lastProcessedId = product.id; // Advance cursor
                  setSyncProgress(p => ({ ...p, processed: p.processed + 1 }));

                  // --- SMART FILTER: FIX BROKEN LINKS ---
                  // If "Fix Broken" is ON, we skip items that ALREADY HAVE GOOD PHOTOS
                  if (fixBrokenLinks && !forceOverwritePhotos) {
                      const url = product.image_url;
                      // Assume a valid photo is at least 25 chars (e.g. Supabase storage URL) and starts with http
                      if (url && url.length > 25 && url.startsWith('http')) {
                          // Skip good items to save API calls
                          continue;
                      }
                      // If we are here, the link is either missing, empty, or short/broken. Proceed to download.
                  }

                  // --- HOURLY LIMIT PROTECTION ---
                  // If we approach 300 requests, take a LONG pause because limit is usually 300/hour
                  if (requestsInThisSession > 0 && requestsInThisSession % 290 === 0) {
                      addLog(`[LIMIT WARNING] Виконано ${requestsInThisSession} запитів. Проактивна пауза 3 хв (щоб не зловити бан)...`);
                      await new Promise(r => setTimeout(r, 180000)); // 3 minutes wait
                  }

                  let idToSend = parseInt(product.product_number);
                  
                  // Skip invalid IDs
                  if (!idToSend) {
                      skippedCount++;
                      addDetailedLog({ id: product.id, productId: 'N/A', status: 'skipped', message: 'Немає product_number' });
                      continue;
                  }
                  // Standard Logic: Omega IDs are often positive in DB but negative for Image API
                  if (idToSend > 0) idToSend = -idToSend;

                  // Prepare Body
                  let requestBody: any = {};
                  try {
                      let bodyStr = config.body;
                      if (supplierKey) bodyStr = bodyStr.replace("INSERT_KEY_HERE", supplierKey);
                      requestBody = JSON.parse(bodyStr);
                      requestBody.ProductId = idToSend;
                  } catch(e) { 
                      skippedCount++;
                      addDetailedLog({ id: product.id, productId: String(idToSend), status: 'error', message: 'Config JSON error' });
                      continue; 
                  }

                  // --- RETRY LOGIC FOR LIMITS ---
                  let success = false;
                  let attempts = 0;
                  
                  while(!success && attempts < 5 && isPhotoSyncingRef.current) {
                      attempts++;
                      try {
                          // Increment request counter
                          requestsInThisSession++;

                          // Prepare headers
                          const cleanH = cleanHeaders(JSON.parse(config.headers || '{}'));

                          // USE SERVER-SIDE UPLOAD
                          const { imageUrl } = await requestServerSideUpload({
                              url: config.url,
                              method: config.method,
                              headers: cleanH,
                              body: requestBody
                          }, product.id);
                          
                          // Update DB with URL returned from server
                          await supabase.from('tyres').update({ image_url: imageUrl, in_stock: true }).eq('id', product.id);
                          
                          // --- SUCCESS: AUTO-SAVE CURSOR ---
                          localStorage.setItem('forsage_photo_last_id', String(product.id));
                          setLastSuccessCursor(String(product.id));

                          setSyncProgress(p => ({ ...p, updated: p.updated + 1 }));
                          addDetailedLog({ id: product.id, productId: String(idToSend), status: 'success', message: 'Завантажено', details: 'OK' });
                          success = true;

                      } catch (apiErr: any) {
                          // CASE INSENSITIVE CHECK FOR LIMIT
                          const msg = apiErr.message ? apiErr.message.toLowerCase() : '';
                          
                          if (msg.includes("limit") || msg.includes("429") || msg.includes("exceeded")) {
                              // Exponential backoff or long pause
                              const waitTime = attempts * 120000; // 2 min, 4 min, 6 min...
                              addLog(`[LIMIT HIT] Сервер повернув ліміт. Пауза ${(waitTime/60000).toFixed(1)} хв (Спроба ${attempts}/5)...`);
                              
                              // Wait loop to allow interrupt
                              const step = 1000;
                              let waited = 0;
                              while(waited < waitTime && isPhotoSyncingRef.current) {
                                  await new Promise(r => setTimeout(r, step));
                                  waited += step;
                              }
                              // Loop will continue (retry)
                          } else {
                              // Real error, log and break
                              errorCount++;
                              const errTxt = apiErr.message || "Unknown error";
                              // Expand log message display limit
                              addDetailedLog({ id: product.id, productId: String(idToSend), status: 'error', message: 'API Fail', details: errTxt.length > 100 ? errTxt.substring(0,100)+'...' : errTxt });
                              success = true; // Stop retrying this item
                          }
                      }
                  }

                  // 3000ms DELAY = ~20 requests per minute (Safe Mode)
                  await new Promise(r => setTimeout(r, 3000));
              }
              
              if (errorCount > 0 || skippedCount > 0) {
                  addLog(`Пакет завершено. Пропущено: ${skippedCount}, Помилок/Без фото: ${errorCount}`);
                  // Reset batch counters
                  errorCount = 0;
                  skippedCount = 0;
              }
          }
      } catch (e: any) {
          setSyncError(e.message);
          addLog("CRITICAL ERROR: " + e.message);
      } finally { 
          setIsPhotoSyncing(false);
          isPhotoSyncingRef.current = false;
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
          
          // CLEAN HEADERS
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

              // --- PREPARE DATA ---
              const mappedBatch = batchItems.map((item: any, idx: number) => {
                  // --- STOCK CALCULATION ---
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

                  // --- SKIP IF STOCK FILTER IS ON ---
                  if (importOnlyInStock && stock <= 0) {
                      return null; // Will be filtered out
                  }

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
                  let basePrice = smartExtractPrice(rawBasePrice);

                  if (price === 0 && basePrice > 0) {
                      price = Math.round(basePrice * 1.2); 
                  }
                  if (basePrice === 0 && price > 0) {
                      basePrice = Math.round(price * 0.8);
                  }

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
              }).filter((item: any) => item !== null);

              // --- DEDUPLICATE BATCH IN MEMORY ---
              const uniqueBatch = new Map();
              
              mappedBatch.forEach((item: any) => {
                  if (item.catalog_number) {
                      // Use constraint columns as key
                      const key = `${item.catalog_number}_${supplierId}`;
                      uniqueBatch.set(key, item);
                  }
              });

              const payload = Array.from(uniqueBatch.values());

              if (payload.length > 0) {
                  // --- UPSERT EVERYTHING (Insert or Update) ---
                  const { error, count } = await supabase.from('tyres').upsert(payload, { 
                      onConflict: 'catalog_number,supplier_id',
                      ignoreDuplicates: false // Update if exists
                  });

                  if (error) {
                      addLog(`Batch Error: ${error.message}`);
                  } else {
                      setSyncProgress(prev => ({
                          total: prev.total + batchItems.length,
                          processed: prev.processed + batchItems.length,
                          updated: prev.updated, 
                          inserted: prev.inserted + payload.length 
                      }));
                      addLog(`Processed batch of ${payload.length} items.`);
                  }
              } else {
                  addLog("Skipping batch: No valid items found (checked stock filter?).");
                  setSyncProgress(prev => ({ ...prev, processed: prev.processed + batchItems.length }));
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
                               {isSyncing || isPhotoSyncing ? 'СИНХРОНІЗАЦІЯ...' : syncError ? 'ПОМИЛКА / ЗУПИНЕНО' : 'ГОТОВО ДО РОБОТИ'}
                           </span>
                       </div>
                       {lastSyncTime && <div className="text-xs text-zinc-500">Останнє оновлення: {lastSyncTime}</div>}
                   </div>

                   {/* PROGRESS SECTION - FIXED VISIBILITY LOGIC */}
                   {isSyncing || isPhotoSyncing || syncProgress.processed > 0 || syncLogs.length > 0 || syncError ? (
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
                           <div className="bg-black/50 rounded-xl p-4 font-mono text-xs text-zinc-400 h-32 overflow-y-auto border border-zinc-800 shadow-inner">
                               {syncLogs.map((log, i) => (
                                   <div key={i} className={`mb-1 border-b border-zinc-800/50 pb-1 last:border-0 break-words ${log.includes('[HINT]') ? 'text-[#FFC300] font-bold' : ''}`}>
                                       <span className="text-zinc-600 mr-2">{'>'}</span>{log}
                                   </div>
                               ))}
                               {(isSyncing || isPhotoSyncing) && <div className="animate-pulse text-[#FFC300]">Обробка даних...</div>}
                           </div>
                           
                           {/* DETAILED LOG TABLE FOR PHOTOS */}
                           {detailedLogs.length > 0 && (
                               <div className="mt-4">
                                   <h5 className="text-white font-bold mb-2 flex items-center gap-2 text-sm"><FileText size={14}/> Детальний звіт по фото</h5>
                                   <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden h-64 overflow-y-auto custom-scrollbar">
                                       <table className="w-full text-left text-[10px] text-zinc-400">
                                           <thead className="bg-zinc-900 text-zinc-500 sticky top-0">
                                               <tr>
                                                   <th className="p-2">ID товару</th>
                                                   <th className="p-2">Req ID</th>
                                                   <th className="p-2">Статус</th>
                                                   <th className="p-2">Деталі</th>
                                                   <th className="p-2 text-right">Час</th>
                                               </tr>
                                           </thead>
                                           <tbody>
                                               {detailedLogs.map((log, i) => (
                                                   <tr key={i} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/50">
                                                       <td className="p-2 font-mono">{log.id}</td>
                                                       <td className="p-2 font-mono text-blue-400">{log.productId}</td>
                                                       <td className="p-2">
                                                           {log.status === 'success' && <span className="text-green-500 flex items-center gap-1"><Check size={10}/> OK</span>}
                                                           {log.status === 'error' && <span className="text-red-500 flex items-center gap-1"><Ban size={10}/> Error</span>}
                                                           {log.status === 'skipped' && <span className="text-zinc-500 flex items-center gap-1"><Box size={10}/> Skip</span>}
                                                       </td>
                                                       <td className="p-2 max-w-[150px] truncate" title={log.details || log.message}>
                                                           {log.message} <span className="opacity-50">{log.details}</span>
                                                       </td>
                                                       <td className="p-2 text-right opacity-50">{log.timestamp}</td>
                                                   </tr>
                                               ))}
                                           </tbody>
                                       </table>
                                   </div>
                               </div>
                           )}

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
                       <div className="bg-zinc-800/50 p-3 rounded-2xl border border-zinc-700 mt-2">
                           <div className="flex flex-col gap-3 mb-3">
                               <div className="flex flex-wrap justify-between gap-2 px-3 py-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                                   <label className="flex items-center gap-2 cursor-pointer group">
                                       <input type="checkbox" checked={forceOverwritePhotos} onChange={e => { setForceOverwritePhotos(e.target.checked); if(e.target.checked) setFixBrokenLinks(false); }} className="w-4 h-4 accent-[#FFC300]" />
                                       <span className={`text-xs font-bold uppercase select-none transition-colors ${forceOverwritePhotos ? 'text-[#FFC300]' : 'text-zinc-500'}`}>Перезаписати існуючі</span>
                                   </label>
                                   
                                   <label className="flex items-center gap-2 cursor-pointer group">
                                       <input type="checkbox" checked={skipOutOfStock} onChange={e => setSkipOutOfStock(e.target.checked)} className="w-4 h-4 accent-[#FFC300]" />
                                       <span className={`text-xs font-bold uppercase select-none transition-colors ${skipOutOfStock ? 'text-white' : 'text-zinc-500'}`}>В наявності</span>
                                   </label>

                                   <label className="flex items-center gap-2 cursor-pointer group">
                                       <input type="checkbox" checked={fixBrokenLinks} onChange={e => { setFixBrokenLinks(e.target.checked); if(e.target.checked) setForceOverwritePhotos(false); }} className="w-4 h-4 accent-blue-500" />
                                       <span className={`text-xs font-bold uppercase select-none transition-colors ${fixBrokenLinks ? 'text-blue-400' : 'text-zinc-500'}`}>Тільки биті посилання</span>
                                   </label>
                               </div>

                               <div className="flex flex-col gap-2 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800">
                                   <div className="flex items-center gap-2">
                                       <span className="text-zinc-500 text-xs font-bold whitespace-nowrap px-2">Почати з ID:</span>
                                       <input 
                                           type="number" 
                                           value={customStartId} 
                                           onChange={(e) => setCustomStartId(e.target.value)} 
                                           className="bg-black border border-zinc-700 rounded px-2 py-1 text-white text-sm font-mono w-full focus:border-[#FFC300] outline-none"
                                           placeholder="0"
                                       />
                                   </div>
                                   {lastSuccessCursor && (
                                       <div 
                                           onClick={() => setCustomStartId(lastSuccessCursor)}
                                           className="text-[10px] text-green-500 font-mono text-center cursor-pointer hover:underline bg-green-900/10 rounded py-1 border border-green-900/30"
                                       >
                                           Останній успішний ID: {lastSuccessCursor} (Натисніть для продовження)
                                       </div>
                                   )}
                               </div>
                           </div>
                           
                           {isPhotoSyncing ? (
                               <button 
                                   onClick={handleStopSync}
                                   className="w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-3 border border-red-500 bg-red-900/50 text-red-200 hover:bg-red-900/80 animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                               >
                                   <StopCircle size={20} /> ЗУПИНИТИ ЗАВАНТАЖЕННЯ (Поточний ID: {syncProgress.processed > 0 ? detailedLogs[0]?.id : '-'})
                               </button>
                           ) : (
                               <button 
                                   onClick={handleRunPhotoSync}
                                   disabled={isSyncing}
                                   className={`w-full py-4 rounded-xl font-black text-sm flex items-center justify-center gap-3 border transition-all active:scale-95 shadow-lg ${
                                       isSyncing 
                                       ? 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed' 
                                       : 'bg-zinc-800 text-white border-zinc-600 hover:border-[#FFC300] hover:bg-zinc-700 hover:text-[#FFC300]'
                                   }`}
                               >
                                   <ImageIcon size={20} />
                                   {fixBrokenLinks ? `ВИПРАВИТИ БИТІ ФОТО ${customStartId ? '(З ID '+customStartId+')' : ''}` : 
                                    forceOverwritePhotos ? (customStartId ? `ВІДНОВИТИ ПЕРЕЗАПИС (З ID ${customStartId})` : 'ПЕРЕЗАПИСАТИ ВСІ ФОТО') 
                                    : (customStartId ? `ПРОДОВЖИТИ (З ID ${customStartId})` : 'ЗАВАНТАЖИТИ ФОТО (ТІЛЬКИ НОВІ)')}
                               </button>
                           )}
                           <div className="text-center mt-2 text-[10px] text-zinc-500 font-mono">
                               Ліміт API: ~20 фото/хв. Авто-пауза кожні 290 запитів.
                           </div>
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
                                               
                                               <button 
                                                   onClick={saveTestImage}
                                                   disabled={testSaveStatus === 'saving' || testSaveStatus === 'saved'}
                                                   className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${testSaveStatus === 'saved' ? 'bg-green-600 text-white' : 'bg-white text-black hover:bg-zinc-200'}`}
                                               >
                                                   {testSaveStatus === 'saving' ? <Loader2 className="animate-spin"/> : testSaveStatus === 'saved' ? <CheckCircle/> : <Save/>}
                                                   {testSaveStatus === 'saved' ? 'Збережено (В наявності)' : 'Зберегти до товару'}
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
