
import React, { useState, useEffect, useRef } from 'react';
import { 
    Settings, Briefcase, Plus, PackageX, Trash2, ToggleRight, ToggleLeft, 
    KeyRound, Save, RotateCcw, X, AlertTriangle, Loader2, Phone, MapPin, 
    Link2, Shield, UserCog, Truck, Crown, LayoutGrid, Package, Smartphone,
    Eraser, Database, FileSearch, CheckCircle, Tags, GitMerge, FileSpreadsheet, Stethoscope, Wand2, Upload, FileImage, Sparkles, FileCode, Eye, EyeOff, StopCircle, Tractor
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Supplier } from '../../types';
import { PHONE_NUMBER_1, PHONE_NUMBER_2, MAP_DIRECT_LINK } from '../../constants';
import ExcelImportPanel from './sync/ExcelImportPanel';
import { GoogleGenAI } from "@google/genai";

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
  const [geminiKey, setGeminiKey] = useState(''); // NEW: Google Gemini API Key
  const [showGeminiKey, setShowGeminiKey] = useState(false);
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

  // Storage Cleanup State
  const [cleaningStorage, setCleaningStorage] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [cleanupStatus, setCleanupStatus] = useState<string>('');
  const [cleanupResult, setCleanupResult] = useState<{ total: number, active: number, deleted: number, broken: number } | null>(null);

  // BROKEN IMAGE SCANNER
  const [isScanningImages, setIsScanningImages] = useState(false);
  const [showScanConfirm, setShowScanConfirm] = useState(false);
  const [scanProgress, setScanProgress] = useState({ checked: 0, broken: 0, removed: 0 });
  const [scanStatus, setScanStatus] = useState('');

  // SMART PHOTO MATCHER STATE
  const [smartFiles, setSmartFiles] = useState<File[]>([]);
  const [isSmartMatching, setIsSmartMatching] = useState(false);
  const [smartStatus, setSmartStatus] = useState<string[]>([]);
  const [smartOverwrite, setSmartOverwrite] = useState(false);
  const [smartExactMatch, setSmartExactMatch] = useState(false); // NEW: Exact Match Mode
  const smartInputRef = useRef<HTMLInputElement>(null);

  // Reset Stock State
  const [showResetStockConfirm, setShowResetStockConfirm] = useState(false);
  const [resettingStock, setResettingStock] = useState(false);

  // Categorization State
  const [sortingCategories, setSortingCategories] = useState(false);
  const [showSortConfirm, setShowSortConfirm] = useState(false);

  // AI Description Generator State
  const [aiGenerating, setAiGenerating] = useState(false);
  const aiGeneratingRef = useRef(false); // Ref for immediate stopping
  const [aiProgress, setAiProgress] = useState({ total: 0, current: 0, updated: 0 });
  const [aiStatusLog, setAiStatusLog] = useState<string[]>([]);
  const [aiOverwrite, setAiOverwrite] = useState(false); 

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
                if(r.key === 'google_gemini_api_key') setGeminiKey(r.value); // Fetch Gemini Key
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
  
  const toggleStockQty = async () => {
      const newVal = !enableStockQty;
      setEnableStockQty(newVal);
      await supabase.from('settings').upsert({ key: 'enable_stock_quantity', value: String(newVal) });
  };

  const saveAllSettings = async () => {
       await supabase.from('settings').upsert({ key: 'nova_poshta_key', value: novaPoshtaKey });
       await supabase.from('settings').upsert({ key: 'supplier_api_key', value: supplierKey });
       await supabase.from('settings').upsert({ key: 'google_gemini_api_key', value: geminiKey }); // Save Gemini Key
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

  // --- AUTO CATEGORIZATION LOGIC ---
  const executeAutoCategorization = async () => {
      setShowSortConfirm(false);
      setSortingCategories(true);
      try {
          const allItems = await fetchAllIds('tyres', 'id, title, radius, vehicle_type, season');
          if (!allItems || allItems.length === 0) { showMsg("Немає товарів.", 'error'); return; }

          const updates = [];
          let changedCount = 0;

          const agroBrands = ['OZKA', 'BKT', 'SEHA', 'KNK', 'PETLAS', 'ALLIANCE', 'MITAS', 'CULTOR', 'KABAT', 'ROSAVA'];
          const agroKeywords = ['AGRO', 'TRACTOR', 'IMPLEMENT', 'FARM', 'LOADER', 'INDUSTRIAL', 'SKID', 'BOBCAT', 'FORKLIFT', 'PR ', 'TR-', 'IMP', 'SGP', 'Ф-', 'В-', 'БЦФ', 'ИЯВ', 'ВЛ-', 'К-', 'Л-', 'М-', 'IND'];
          
          const agroRims = ['10', '12', '14.5', '15.3', '15.5', '24', '26', '28', '30', '32', '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54'];
          const truckRims = ['17.5', '19.5', '22.5', '24.5'];
          const overlapRims = ['15', '16', '17', '18', '20', '22.5'];
          const strictCarPattern = /\b\d{3}\/\d{2}[R|Z]?\d{2}\b/; 
          const strictCargoFullProfile = /\b\d{3}R\d{2}(?:C|LT)\b/i;

          for (const item of allItems) {
              let newRadius = item.radius || '';
              let newType = item.vehicle_type || 'car';
              let newSeason = item.season || 'summer';
              let isChanged = false;
              const title = (item.title || '').toUpperCase();
              
              if (!newRadius || newRadius === 'R') {
                  const dashMatch = title.match(/[0-9.,]+[-/](\d{1,2}(?:[.,]\d)?)/);
                  if (dashMatch) { newRadius = `R${dashMatch[1].replace(',', '.')}`; isChanged = true; }
              }
              const decimalMatch = title.match(/R(14\.5|15\.3|15\.5|17\.5|19\.5|22\.5|24\.5)/);
              if (decimalMatch) { 
                  const correctR = decimalMatch[0]; 
                  if (newRadius !== correctR) { newRadius = correctR; isChanged = true; } 
              }

              let detectedType = 'car';
              const radiusVal = newRadius.replace('R', '');
              
              const isAgroBrand = agroBrands.some(b => title.includes(b));
              const isAgroKey = agroKeywords.some(k => title.includes(k));
              const isCargoStrong = newRadius.includes('C') || title.includes('R14C') || title.includes('R15C') || title.includes('R16C') || title.includes(' LT ') || title.includes('(C)') || strictCargoFullProfile.test(title);

              if (isCargoStrong) detectedType = 'cargo';
              else if (truckRims.includes(radiusVal) || title.includes('TIR ') || title.includes('BUS ')) {
                  detectedType = 'truck';
                  if (isAgroKey || isAgroBrand) detectedType = 'agro';
              }
              else if (agroRims.includes(radiusVal)) detectedType = 'agro';
              else if (overlapRims.includes(radiusVal)) {
                  if (strictCarPattern.test(title)) {
                      if (title.includes('TRACTOR') || title.includes('AGRO') || title.includes('IMPLEMENT')) detectedType = 'agro';
                      else detectedType = 'car';
                  } else {
                      const hasPR = /\d+\s*PR/.test(title); 
                      const hasAgroSize = /\d{1,3}\.\d{2}-\d{2}/.test(title) || /\d{1,3}-\d{2}/.test(title);
                      if (isAgroBrand || isAgroKey || hasPR || hasAgroSize) detectedType = 'agro';
                  }
              }
              else if (title.includes('SUV') || title.includes('4X4') || title.includes('JEEP')) detectedType = 'suv';

              if (newType !== detectedType) { newType = detectedType; isChanged = true; }
              
              // Force season for Truck/Agro
              if ((newType === 'agro' || newType === 'truck') && newSeason !== 'all-season') { 
                  newSeason = 'all-season'; 
                  isChanged = true; 
              }

              if (isChanged) { updates.push({ id: item.id, title: item.title, radius: newRadius, vehicle_type: newType, season: newSeason }); changedCount++; }
          }

          if (updates.length > 0) {
              const CHUNK_SIZE = 500;
              for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
                  const chunk = updates.slice(i, i + CHUNK_SIZE);
                  const { error: updErr } = await supabase.from('tyres').upsert(chunk);
                  if (updErr) throw updErr;
              }
              showMsg(`Успішно оновлено ${changedCount} товарів!`);
          } else {
              showMsg("Всі товари вже мають правильні категорії.");
          }
      } catch (e: any) { showMsg("Помилка сортування: " + e.message, 'error'); } finally { setSortingCategories(false); }
  };

  // --- SMART UPLOAD LOGIC ---
  const handleSmartUpload = async () => {
      if (smartFiles.length === 0) return;
      setIsSmartMatching(true);
      setSmartStatus(['Початок обробки...']);
      
      try {
          let updatedCount = 0;
          
          for (const file of smartFiles) {
              const fileNameClean = file.name
                  .replace(/\.[^/.]+$/, "") // Remove extension
                  .replace(/[()]/g, " ")    
                  .replace(/[-_]/g, " ");   
              
              let matches = [];

              if (smartExactMatch) {
                  // --- EXACT MATCH MODE (SPECIAL MACHINERY) ---
                  // Search for exact title OR product_number OR catalog_number match
                  // We remove the extension but keep the full name string
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

  // --- STORAGE CLEANUP LOGIC ---
  const executeStorageCleanup = async () => {
      setShowCleanupConfirm(false);
      setCleaningStorage(true);
      setCleanupStatus('Аналіз бази даних...');
      setCleanupResult(null);

      try {
          const allTyres = await fetchAllIds('tyres', 'image_url');
          const allGallery = await fetchAllIds('gallery', 'url');
          const allArticles = await fetchAllIds('articles', 'image_url');
          const allPromo = await fetchAllIds('settings', 'value', (q) => q.eq('key', 'promo_data'));

          const activeUrls = new Set<string>();
          allTyres.forEach(t => t.image_url && activeUrls.add(t.image_url));
          allGallery.forEach(g => g.url && activeUrls.add(g.url));
          allArticles.forEach(a => a.image_url && activeUrls.add(a.image_url));
          
          if(allPromo.length > 0) {
              try {
                  const promos = JSON.parse(allPromo[0].value);
                  if(Array.isArray(promos)) {
                      promos.forEach((p:any) => {
                          if(p.image_url) activeUrls.add(p.image_url);
                          if(p.backgroundImage) activeUrls.add(p.backgroundImage);
                      });
                  } else if(promos.image_url) {
                      activeUrls.add(promos.image_url);
                  }
              } catch(e) {}
          }

          setCleanupStatus(`Знайдено ${activeUrls.size} активних посилань. Сканування сховища...`);
          
          let allFiles: any[] = [];
          const { data: files, error } = await supabase.storage.from('galery').list('', { limit: 10000 }); 
          if (error) throw error;
          allFiles = files || [];

          const orphans: string[] = [];
          const projectUrl = "https://zzxueclhkhvwdmxflmyx.supabase.co/storage/v1/object/public/galery/";
          
          allFiles.forEach(file => {
              const fullUrl = projectUrl + file.name;
              if (!activeUrls.has(fullUrl)) {
                  orphans.push(file.name);
              }
          });

          setCleanupStatus(`Знайдено ${orphans.length} файлів для видалення.`);

          if (orphans.length > 0) {
              const BATCH = 50;
              for(let i=0; i<orphans.length; i+=BATCH) {
                  const batch = orphans.slice(i, i+BATCH);
                  await supabase.storage.from('galery').remove(batch);
              }
          }

          setCleanupResult({
              total: allFiles.length,
              active: allFiles.length - orphans.length,
              deleted: orphans.length,
              broken: 0
          });
          setCleanupStatus('Завершено успішно.');

      } catch (e: any) {
          setCleanupStatus('Помилка: ' + e.message);
      } finally {
          setCleaningStorage(false);
      }
  };

  // --- BROKEN LINK SCANNER ---
  const executeBrokenLinkScan = async () => {
      setShowScanConfirm(false);
      setIsScanningImages(true);
      setScanStatus('Завантаження списку товарів...');
      setScanProgress({ checked: 0, broken: 0, removed: 0 });

      try {
          const products = await fetchAllIds('tyres', 'id, image_url');
          const productsWithImages = products.filter(p => p.image_url);
          
          setScanStatus(`Перевірка ${productsWithImages.length} зображень...`);
          
          const BATCH_SIZE = 20; 
          let processed = 0;
          let brokenCount = 0;
          let removedCount = 0;

          const checkUrl = async (url: string) => {
              try {
                  const res = await fetch(url, { method: 'HEAD' });
                  return res.ok;
              } catch {
                  return false;
              }
          };

          for (let i = 0; i < productsWithImages.length; i += BATCH_SIZE) {
              const batch = productsWithImages.slice(i, i + BATCH_SIZE);
              
              const results = await Promise.all(batch.map(async (p) => {
                  const isOk = await checkUrl(p.image_url);
                  return { id: p.id, isOk };
              }));

              const brokenIds = results.filter(r => !r.isOk).map(r => r.id);
              
              if (brokenIds.length > 0) {
                  await supabase.from('tyres').update({ image_url: null }).in('id', brokenIds);
                  brokenCount += brokenIds.length;
                  removedCount += brokenIds.length;
              }

              processed += batch.length;
              setScanProgress({ checked: processed, broken: brokenCount, removed: removedCount });
          }

          setScanStatus(`Завершено. Перевірено: ${processed}. Видалено битих: ${removedCount}.`);

      } catch (e: any) {
          setScanStatus('Помилка: ' + e.message);
      } finally {
          setIsScanningImages(false);
      }
  };

  // --- AI DESCRIPTION GENERATOR ---
  const handleStopAi = () => {
      setAiGenerating(false);
      aiGeneratingRef.current = false;
      setAiStatusLog(prev => ["Користувач зупинив генерацію.", ...prev]);
  };

  const generateAiDescriptions = async () => {
      setAiGenerating(true);
      aiGeneratingRef.current = true;
      setAiStatusLog([]);
      setAiProgress({ total: 0, current: 0, updated: 0 });

      try {
          if (!geminiKey) {
              setAiStatusLog(prev => ["ПОМИЛКА: Відсутній Google Gemini API Key. Введіть його у вкладці 'Безпека / API'.", ...prev]);
              setAiGenerating(false);
              return;
          }

          const ai = new GoogleGenAI({ apiKey: geminiKey }); 

          // 1. Fetch products
          const { data: allProducts, error } = await supabase
              .from('tyres')
              .select('id, title, manufacturer, radius, season, vehicle_type, description');

          if (error) throw error;

          if (!allProducts || allProducts.length === 0) {
              setAiStatusLog(prev => ["В базі немає товарів для обробки.", ...prev]);
              setAiGenerating(false);
              return;
          }

          // 2. Client-side filtering logic
          const productsToProcess = allProducts.filter(p => {
              if (aiOverwrite) return true; // Force mode ON = process all

              // Check if description is missing or "bad"
              if (!p.description) return true;
              const desc = p.description.trim();
              if (desc === '') return true;
              if (desc === 'API Import') return true;
              
              // Smart check: treat short descriptions (e.g. "allseason", "winter") as needing update
              if (desc.length < 30) return true;

              return false; // Good description, skip
          });

          if (productsToProcess.length === 0) {
              setAiStatusLog(prev => ["Всі товари вже мають якісний опис (довше 30 символів). Спробуйте увімкнути 'Перезаписувати'.", ...prev]);
              setAiGenerating(false);
              return;
          }

          setAiProgress({ total: productsToProcess.length, current: 0, updated: 0 });
          setAiStatusLog(prev => [`Знайдено ${productsToProcess.length} товарів для оновлення. Починаємо (по 1 шт)...`, ...prev]);

          // RATE LIMIT SETTINGS
          const DELAY_MS = 4500; // ~4.5 seconds delay = ~13 requests per minute (safe for free tier 15 RPM)
          
          for (let i = 0; i < productsToProcess.length; i++) {
              if (!aiGeneratingRef.current) break; // Check manual stop

              const tyre = productsToProcess[i];
              
              try {
                  // Parse size for prompt
                  const sizeRegex = /(\d{3})[\/\s](\d{2})[\s\w]*R(\d{2}(?:\.5|\.3)?[C|c]?)/i;
                  const match = tyre.title.match(sizeRegex);
                  let sizeStr = match ? `${match[1]}/${match[2]} R${match[3]}` : (tyre.radius || '');

                  const seasonName = tyre.season === 'winter' ? 'зимова' : tyre.season === 'summer' ? 'літня' : 'всесезонна';
                  
                  const prompt = `Напиши унікальний, привабливий SEO-опис (2-3 речення) українською мовою для шини: ${tyre.manufacturer || ''} ${tyre.title}. 
                  Розмір: ${sizeStr}. Сезон: ${seasonName}. Тип: ${tyre.vehicle_type || 'легкова'}. 
                  Використовуй слова "купити", "ціна", "Синельникове", "якісний монтаж", "Форсаж". Акцентуй на надійності та комфорті.`;

                  const response = await ai.models.generateContent({
                      model: 'gemini-2.5-flash',
                      contents: prompt,
                  });
                  
                  const newDesc = response.text.trim();
                  
                  if (newDesc) {
                      await supabase.from('tyres').update({ description: newDesc }).eq('id', tyre.id);
                      setAiProgress(p => ({ ...p, updated: p.updated + 1 }));
                  }
                  
                  // Update UI progress
                  setAiProgress(p => ({ ...p, current: i + 1 }));

              } catch (err: any) {
                  const errMsg = err.message || '';
                  if (errMsg.includes('quota') || errMsg.includes('429') || errMsg.includes('exceeded')) {
                      setAiStatusLog(prev => [`ЛІМІТ КВОТИ (429)! Процес зупинено на товарі ${i+1}. Зачекайте хвилину і запустіть знову.`, ...prev]);
                      setAiGenerating(false);
                      aiGeneratingRef.current = false;
                      return; // STOP execution
                  }
                  console.error("AI Error for ID " + tyre.id, err);
              }

              // Delay between requests
              if (i < productsToProcess.length - 1) {
                  await new Promise(r => setTimeout(r, DELAY_MS));
              }
          }

          if (aiGeneratingRef.current) {
              setAiStatusLog(prev => ["Генерацію завершено успішно!", ...prev]);
          }

      } catch (e: any) {
          setAiStatusLog(prev => [`Критична помилка: ${e.message}`, ...prev]);
      } finally {
          setAiGenerating(false);
          aiGeneratingRef.current = false;
      }
  };

  // --- SITEMAP GENERATOR ---
  const generateSitemap = async () => {
      try {
          const { data } = await supabase.from('tyres').select('id, created_at');
          if (!data) return;

          let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://forsage-sinelnikove.com/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;

          data.forEach(item => {
              const date = new Date(item.created_at || Date.now()).toISOString().split('T')[0];
              xml += `
  <url>
    <loc>https://forsage-sinelnikove.com/?product_id=${item.id}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
          });

          xml += `\n</urlset>`;
          
          await navigator.clipboard.writeText(xml);
          alert(`Sitemap згенеровано для ${data.length} товарів та скопійовано в буфер обміну! Створіть файл sitemap.xml в корені сайту.`);
      } catch (e: any) {
          alert("Помилка генерації: " + e.message);
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
                        <div className="md:col-span-2 bg-purple-900/10 p-4 rounded-xl border border-purple-900/30">
                            <label className="block text-purple-300 text-xs font-bold uppercase mb-2 flex items-center gap-2"><Sparkles size={14}/> Google Gemini API Key (AI Generator)</label>
                            <div className="relative">
                                <input 
                                    type={showGeminiKey ? "text" : "password"} 
                                    value={geminiKey} 
                                    onChange={e => setGeminiKey(e.target.value)} 
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 pr-10 text-white font-mono text-sm mb-1 focus:border-purple-500 outline-none" 
                                    placeholder="Вставте ключ AIza..."
                                />
                                <button 
                                    onClick={() => setShowGeminiKey(!showGeminiKey)} 
                                    className="absolute right-3 top-3 text-zinc-500 hover:text-white"
                                    title={showGeminiKey ? "Приховати" : "Показати"}
                                >
                                    {showGeminiKey ? <EyeOff size={18}/> : <Eye size={18}/>}
                                </button>
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-2">
                                Необхідний для генерації описів. Отримати безкоштовно: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline font-bold">aistudio.google.com</a>
                            </p>
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
                   <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-1 mb-6 h-[600px] overflow-hidden">
                       <ExcelImportPanel suppliers={suppliers} />
                   </div>

                   {/* AI DESCRIPTION GENERATOR (NEW) */}
                   <div className="bg-purple-900/10 p-6 rounded-xl border border-purple-900/30 mt-6 relative overflow-hidden">
                       <div className="absolute -right-10 -top-10 text-purple-900/20"><Sparkles size={150} /></div>
                       <div className="relative z-10">
                           <h4 className="text-purple-400 text-lg font-bold mb-1 flex items-center gap-2"><Wand2 size={20}/> AI Генератор Описів (Gemini)</h4>
                           <p className="text-zinc-400 text-sm max-w-2xl mb-4">
                               Автоматично створює унікальні SEO-описи для товарів. 
                               Використовує штучний інтелект для генерації тексту на основі параметрів шини.
                           </p>
                           
                           {/* OVERWRITE TOGGLE */}
                           <label className="flex items-center gap-2 cursor-pointer mb-4 w-fit bg-black/40 px-3 py-2 rounded-lg border border-purple-900/30">
                               <input 
                                   type="checkbox" 
                                   checked={aiOverwrite} 
                                   onChange={e => setAiOverwrite(e.target.checked)} 
                                   className="w-4 h-4 accent-purple-500 rounded"
                               />
                               <span className={`text-sm font-bold ${aiOverwrite ? 'text-white' : 'text-zinc-400'}`}>
                                   Перезаписувати існуючі описи
                               </span>
                           </label>
                           
                           {aiStatusLog.length > 0 && (
                               <div className="bg-black/50 p-3 rounded-lg border border-purple-900/30 font-mono text-xs text-purple-200 mb-4 h-24 overflow-y-auto">
                                   {aiStatusLog.map((log, i) => <div key={i}>{log}</div>)}
                               </div>
                           )}

                           <div className="flex items-center gap-4">
                               {aiGenerating ? (
                                   <div className="flex items-center gap-4 w-full">
                                       <div className="flex-grow h-2 bg-zinc-800 rounded-full overflow-hidden">
                                           <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${(aiProgress.current / (aiProgress.total || 1)) * 100}%` }}></div>
                                       </div>
                                       <span className="text-xs font-bold text-purple-400 whitespace-nowrap">{aiProgress.current} / {aiProgress.total}</span>
                                       <button onClick={handleStopAi} className="p-2 bg-red-900/50 text-red-300 rounded hover:bg-red-900 border border-red-900/50" title="Зупинити"><StopCircle size={16}/></button>
                                   </div>
                               ) : (
                                   <button 
                                       onClick={generateAiDescriptions} 
                                       className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-transform active:scale-95"
                                   >
                                       <Sparkles size={18}/> {aiProgress.current > 0 && aiProgress.current < aiProgress.total ? 'ПРОДОВЖИТИ ГЕНЕРАЦІЮ' : 'ЗАПУСТИТИ ГЕНЕРАЦІЮ'}
                                   </button>
                               )}
                           </div>
                       </div>
                   </div>

                   {/* SITEMAP GENERATOR (NEW) */}
                   <div className="bg-blue-900/10 p-6 rounded-xl border border-blue-900/30 mt-6">
                       <h4 className="text-blue-400 text-lg font-bold mb-1 flex items-center gap-2"><FileCode size={20}/> Генератор Sitemap.xml</h4>
                       <p className="text-zinc-400 text-sm max-w-2xl mb-4">
                           Створює повну карту сайту з усіма посиланнями на товари (`?product_id=...`). 
                           Це необхідно для того, щоб Google міг знайти та проіндексувати кожен окремий товар.
                       </p>
                       <button onClick={generateSitemap} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-transform active:scale-95">
                           <FileSpreadsheet size={18}/> ЗГЕНЕРУВАТИ ТА КОПІЮВАТИ
                       </button>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="bg-black/30 p-6 rounded-xl border border-zinc-800 flex flex-col justify-between">
                            <div>
                                <h4 className="text-lg font-bold text-white mb-1">Відображення залишків</h4>
                                <p className="text-zinc-400 text-sm mb-4">Якщо вимкнено — всі товари вважаються доступними (навіть 0 шт).</p>
                            </div>
                            <button onClick={toggleStockQty} className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-bold transition-colors ${enableStockQty ? 'bg-[#FFC300] text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                                {enableStockQty ? <ToggleRight size={32}/> : <ToggleLeft size={32}/>} 
                                {enableStockQty ? 'Точний облік (ВКЛ)' : 'Все в наявності (ВИКЛ)'}
                            </button>
                       </div>

                       <div className="bg-black/30 p-6 rounded-xl border border-zinc-800 flex flex-col justify-between">
                            <div>
                                <h4 className="text-white text-lg font-bold mb-1 flex items-center gap-2"><Database size={18}/> Обслуговування БД</h4>
                                <p className="text-zinc-400 text-sm mb-4">Масові операції для керування товарами.</p>
                            </div>
                            
                            <div className="space-y-2">
                                {!showResetStockConfirm ? (
                                    <button onClick={() => setShowResetStockConfirm(true)} disabled={resettingStock} className="w-full bg-blue-900/20 text-blue-300 px-6 py-3 rounded-xl font-bold border border-blue-900/50 hover:bg-blue-900/40 flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm">
                                        <RotateCcw size={16}/> Скинути статус (Все в наявності)
                                    </button>
                                ) : (
                                    <div className="flex gap-2 animate-in fade-in">
                                        <button onClick={processResetStock} className="flex-1 bg-red-600 text-white font-bold py-2 rounded-lg">Підтвердити</button>
                                        <button onClick={() => setShowResetStockConfirm(false)} className="flex-1 bg-zinc-700 text-white font-bold py-2 rounded-lg">Скасувати</button>
                                    </div>
                                )}

                                {!showCleanupConfirm ? (
                                    <button onClick={() => setShowCleanupConfirm(true)} disabled={cleaningStorage} className="w-full bg-red-900/20 text-red-300 px-6 py-3 rounded-xl font-bold border border-red-900/50 hover:bg-red-900/40 flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm">
                                        <Eraser size={16}/> Очистити сховище (Видалити зайве)
                                    </button>
                                ) : (
                                    <div className="flex gap-2 animate-in fade-in">
                                        <button onClick={executeStorageCleanup} className="flex-1 bg-red-600 text-white font-bold py-2 rounded-lg">Підтвердити</button>
                                        <button onClick={() => setShowCleanupConfirm(false)} className="flex-1 bg-zinc-700 text-white font-bold py-2 rounded-lg">Скасувати</button>
                                    </div>
                                )}
                                {cleanupStatus && <p className="text-xs text-zinc-400 mt-1">{cleanupStatus}</p>}

                                {!showScanConfirm ? (
                                    <button onClick={() => setShowScanConfirm(true)} disabled={isScanningImages} className="w-full bg-orange-900/20 text-orange-300 px-6 py-3 rounded-xl font-bold border border-orange-900/50 hover:bg-orange-900/40 flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm">
                                        <FileSearch size={16}/> Перевірка битих фото
                                    </button>
                                ) : (
                                    <div className="flex gap-2 animate-in fade-in">
                                        <button onClick={executeBrokenLinkScan} className="flex-1 bg-orange-600 text-white font-bold py-2 rounded-lg">Запуск</button>
                                        <button onClick={() => setShowScanConfirm(false)} className="flex-1 bg-zinc-700 text-white font-bold py-2 rounded-lg">Скасувати</button>
                                    </div>
                                )}
                                {scanStatus && <p className="text-xs text-zinc-400 mt-1">{scanStatus}</p>}

                                {!showSortConfirm ? (
                                    <button onClick={() => setShowSortConfirm(true)} disabled={sortingCategories} className="w-full bg-green-900/20 text-green-300 px-6 py-3 rounded-xl font-bold border border-green-900/50 hover:bg-green-900/40 flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm">
                                        <Tags size={16}/> Авто-сортування категорій
                                    </button>
                                ) : (
                                    <div className="flex gap-2 animate-in fade-in">
                                        <button onClick={executeAutoCategorization} className="flex-1 bg-green-600 text-white font-bold py-2 rounded-lg">Старт</button>
                                        <button onClick={() => setShowSortConfirm(false)} className="flex-1 bg-zinc-700 text-white font-bold py-2 rounded-lg">Скасувати</button>
                                    </div>
                                )}
                            </div>
                       </div>
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

       {/* BROKEN LINK SCANNER CONFIRMATION MODAL */}
       {showScanConfirm && (
           <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
               <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm relative shadow-2xl flex flex-col items-center text-center">
                   <button onClick={() => setShowScanConfirm(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={24}/></button>
                   <div className="bg-orange-900/20 p-4 rounded-full text-orange-500 mb-4 border border-orange-900/50"><Stethoscope size={40} /></div>
                   <h3 className="text-xl font-black text-white mb-2">Запустити сканування фото?</h3>
                   <p className="text-zinc-400 text-sm mb-6">Це перевірить <strong>всі товари</strong> в базі (незалежно від кількості) на наявність посилань, що не працюють.<br/><br/>Якщо фото не завантажується (404 Error), посилання буде <span className="text-red-400 font-bold">автоматично видалено</span>.</p>
                   <div className="flex gap-4 w-full">
                        <button onClick={() => setShowScanConfirm(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl border border-zinc-700">Скасувати</button>
                        <button onClick={executeBrokenLinkScan} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-orange-900/20">Запустити</button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default SettingsTab;
