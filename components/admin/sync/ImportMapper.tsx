
import React, { useState, useEffect, useMemo } from 'react';
import { Database, CheckCircle, Save, Loader2, AlertTriangle, FileJson, Wand2, Code, ArrowRight, MousePointer2, ListTree, RefreshCw, Zap } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { Supplier } from '../../../types';

interface ImportMapperProps {
    responseData: any;
    responseStatus: number | null;
    apiConfig: any; // URL, Body, Headers to run loops
}

const STORAGE_KEY_MAP = 'forsage_sync_mapping';
const STORAGE_KEY_SUPPLIER = 'forsage_sync_supplier';

// Helper to get value deep in object using "path.to.key"
const getValueByPath = (obj: any, path: string) => {
    if (!path || !obj) return undefined;
    if (path === '.') return obj; // Self reference
    try {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    } catch (e) {
        return undefined;
    }
};

// Helper to safely extract string from potentially object values
const safeExtractString = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
        if (val.value) return String(val.value);
        if (val.name) return String(val.name);
        if (val.id) return String(val.id);
        if (val.code) return String(val.code);
        return ''; 
    }
    return String(val);
};

// Flatten object keys
const getFlattenedKeys = (obj: any, prefix = '', depth = 0): string[] => {
    if (!obj || typeof obj !== 'object' || depth > 3) return []; 
    let keys: string[] = [];
    Object.keys(obj).forEach(k => {
        const val = obj[k];
        const currentKey = prefix ? `${prefix}.${k}` : k;
        keys.push(currentKey);
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            keys = [...keys, ...getFlattenedKeys(val, currentKey, depth + 1)];
        }
    });
    return keys;
};

// Scan for arrays
const scanForArrays = (obj: any, path = '', depth = 0): { path: string, count: number, type: 'array' | 'object' }[] => {
    if (!obj || typeof obj !== 'object' || depth > 3) return [];
    
    let candidates: { path: string, count: number, type: 'array' | 'object' }[] = [];

    if (Array.isArray(obj)) {
        if (obj.length > 0) candidates.push({ path: path || 'root', count: obj.length, type: 'array' });
        return candidates;
    }

    const keys = Object.keys(obj);
    if (keys.length > 5) {
        const values = Object.values(obj);
        const objectValues = values.filter(v => typeof v === 'object' && v !== null && !Array.isArray(v));
        if (objectValues.length > keys.length * 0.8) {
             candidates.push({ path: path || 'root', count: keys.length, type: 'object' });
        }
    }

    for (const key of keys) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            candidates = [...candidates, ...scanForArrays(obj[key], path ? `${path}.${key}` : key, depth + 1)];
        }
    }

    return candidates.sort((a,b) => b.count - a.count);
};

const KEYWORD_MAP = {
    title: ['name', 'title', 'model', 'nazva', 'tovar', 'productname', 'n', 'nom', 'caption', 'label', 'displayname', 'description'],
    desc: ['description', 'desc', 'info', 'details', 'season', 'param', 'feature', 'opys', 'descriptionukr'],
    price: ['price', 'retail', 'uah', 'tsina', 'retailprice', 'price_uah', 'p', 'cena', 'rrc', 'roznytsia', 'customerprice'],
    base_price: ['base', 'purchase', 'cost', 'zakupka', 'in', 'opt', 'wholesale', 'input', 'price_base', 'zakup'],
    brand: ['brand', 'manuf', 'vendor', 'brend', 'manufacturer', 'm', 'proizvoditel', 'make', 'brandname', 'branddescription'],
    stock: ['stock', 'qty', 'quant', 'count', 'rest', 'zalishok', 'quantity', 'amount', 'q', 'r', 'ostatok', 'rests'],
    code: ['code', 'art', 'sku', 'id', 'num', 'articul', 'article', 'c', 'kod', 'itemid', 'number', 'card'],
    product_number: ['productid', 'product_id', 'p_id', 'pn', 'item_no', 'part_number', 'id'],
    image: ['img', 'photo', 'url', 'picture', 'foto', 'image', 'i', 'pic', 'link', 'guid']
};

const detectSeason = (text: string): string => {
    const t = String(text).toLowerCase();
    if (t.includes('зима') || t.includes('зимн') || t.includes('winter') || t.includes('snow') || t.includes('ice') || t.includes('stud') || t.includes('w442') || t.includes('ws')) return 'winter';
    if (t.includes('літо') || t.includes('літн') || t.includes('summer') || t.includes('sport') || t.includes('k125') || t.includes('ventu')) return 'summer';
    if (t.includes('всесезон') || t.includes('all season') || t.includes('4s')) return 'all-season';
    return 'summer';
};

const ImportMapper: React.FC<ImportMapperProps> = ({ responseData, responseStatus, apiConfig }) => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [targetSupplierId, setTargetSupplierId] = useState('');
    const [jsonPath, setJsonPath] = useState('');
    const [showRawJson, setShowRawJson] = useState(false);
    const [manualMode, setManualMode] = useState(false); 
    const [detectedArrays, setDetectedArrays] = useState<{ path: string, count: number, type: 'array'|'object' }[]>([]);
    
    const [fieldMapping, setFieldMapping] = useState({
        title: '',
        description: '', 
        price: '',
        base_price: '',
        brand: '',
        image: '',
        code: '',
        product_number: '',
        stock: ''
    });

    const [importing, setImporting] = useState(false);
    const [previewItem, setPreviewItem] = useState<any>(null);
    const [availableKeys, setAvailableKeys] = useState<string[]>([]);
    const [arrayCount, setArrayCount] = useState(0);

    const [fullSyncProgress, setFullSyncProgress] = useState({ total: 0, processed: 0, updated: 0, inserted: 0 });
    const [isFullSync, setIsFullSync] = useState(false);

    useEffect(() => {
        const fetchSuppliers = async () => {
            const { data } = await supabase.from('suppliers').select('*').order('name');
            if (data) setSuppliers(data);
        };
        fetchSuppliers();

        const savedMap = localStorage.getItem(STORAGE_KEY_MAP);
        if (savedMap) setFieldMapping(JSON.parse(savedMap));
        
        const savedSupp = localStorage.getItem(STORAGE_KEY_SUPPLIER);
        if (savedSupp) setTargetSupplierId(savedSupp);
    }, []);

    useEffect(() => { localStorage.setItem(STORAGE_KEY_MAP, JSON.stringify(fieldMapping)); }, [fieldMapping]);
    useEffect(() => { localStorage.setItem(STORAGE_KEY_SUPPLIER, targetSupplierId); }, [targetSupplierId]);

    useEffect(() => {
        if (!responseData) {
            setDetectedArrays([]);
            return;
        }
        
        let data = responseData;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) {}
        }

        const arrays = scanForArrays(data);
        setDetectedArrays(arrays);

        if (!jsonPath && arrays.length > 0) {
            const best = arrays[0];
            if (best.path !== 'root') setJsonPath(best.path);
        }
    }, [responseData]);

    const itemsToImport = useMemo(() => {
        if (!responseData) return [];
        let data = responseData;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) {}
        }

        let targetData = data;
        if (jsonPath && jsonPath !== 'root') {
            targetData = getValueByPath(data, jsonPath);
        }

        if (Array.isArray(targetData)) return targetData;
        if (typeof targetData === 'object' && targetData !== null) {
            return Object.values(targetData);
        }
        
        return [];
    }, [responseData, jsonPath]);

    useEffect(() => {
        setArrayCount(itemsToImport.length);
        
        if (itemsToImport.length > 0) {
            const first = itemsToImport[0];
            setPreviewItem(first);
            const keys = getFlattenedKeys(first);
            setAvailableKeys(keys);
            setShowRawJson(false); 
        } else {
            setPreviewItem(null);
            setAvailableKeys([]);
            if (responseData) setShowRawJson(true);
        }
    }, [itemsToImport]);

    const autoMapFields = (showAlert = true) => {
        if (availableKeys.length === 0) return;
        
        const newMap = { ...fieldMapping };
        const findKey = (keywords: string[]) => {
            let match = availableKeys.find(k => keywords.includes(k.toLowerCase())); 
            if (!match) match = availableKeys.find(k => keywords.some(word => k.toLowerCase().includes(word))); 
            return match || '';
        };

        if (!newMap.title) newMap.title = findKey(KEYWORD_MAP.title);
        if (!newMap.description) newMap.description = findKey(KEYWORD_MAP.desc);
        if (!newMap.price) newMap.price = findKey(KEYWORD_MAP.price);
        if (!newMap.base_price) newMap.base_price = findKey(KEYWORD_MAP.base_price);
        if (!newMap.brand) newMap.brand = findKey(KEYWORD_MAP.brand);
        if (!newMap.stock) newMap.stock = findKey(KEYWORD_MAP.stock);
        if (!newMap.code) newMap.code = findKey(KEYWORD_MAP.code);
        if (!newMap.product_number) newMap.product_number = findKey(KEYWORD_MAP.product_number);
        if (!newMap.image) newMap.image = findKey(KEYWORD_MAP.image);

        setFieldMapping(newMap);
        if (showAlert) alert("Поля підібрано! Перевірте правильність.");
    };

    // Updated Preview Helper to show Array Sums
    const getPreviewValueText = (key: string) => {
        if (!previewItem || !key) return null;
        const val = getValueByPath(previewItem, key);
        if (val === null || val === undefined) return 'не знайдено';
        
        if (Array.isArray(val)) {
            // Try to calculate sum if it looks like stock
            const sum = val.reduce((acc: number, item: any) => {
                const v = item.Value || item.value || item.amount || item.quantity || item.rest || 0;
                // Parse ">5" as 5
                const clean = String(v).replace(/[><+\s]/g, '');
                return acc + (parseInt(clean) || 0);
            }, 0);
            return `[Масив ${val.length} ел.] Сума: ${sum}`;
        }
        
        if (typeof val === 'object') return JSON.stringify(val).substring(0, 20) + '...';
        return String(val);
    };

    // --- TRANSFORMATION LOGIC ---
    const transformItem = (item: any) => {
        const rawPrice = getValueByPath(item, fieldMapping.price);
        const price = parseFloat(String(rawPrice).replace(/[^\d.]/g, '')) || 0;
        
        const rawBasePrice = fieldMapping.base_price ? getValueByPath(item, fieldMapping.base_price) : 0;
        const basePrice = parseFloat(String(rawBasePrice).replace(/[^\d.]/g, '')) || 0;

        const title = safeExtractString(getValueByPath(item, fieldMapping.title)) || 'Без назви';
        const desc = fieldMapping.description ? safeExtractString(getValueByPath(item, fieldMapping.description)) : '';
        const brand = fieldMapping.brand ? safeExtractString(getValueByPath(item, fieldMapping.brand)) || 'Unknown' : 'Unknown';
        const imageUrl = fieldMapping.image ? safeExtractString(getValueByPath(item, fieldMapping.image)) : null;
        
        let radius='';
        const sizeMatch = title.match(/(\d{3})[\/\s](\d{2})[\s\w]*R(\d{2}[C|c]?)/);
        if (sizeMatch) { radius='R'+sizeMatch[3].toUpperCase(); }

        // --- STOCK PARSING IMPROVED ---
        let stock = 0;
        const rawStock = fieldMapping.stock ? getValueByPath(item, fieldMapping.stock) : 0;
        
        if (Array.isArray(rawStock)) {
            // Case: "Rests": [{"Key": "Kyiv", "Value": ">5"}]
            stock = rawStock.reduce((acc: number, wh: any) => {
                const val = wh.Value || wh.value || wh.amount || wh.quantity || wh.rest || 0;
                // Remove '>', '<', '+' and spaces to parse ">5" as 5
                const cleanVal = String(val).replace(/[><+\s]/g, '');
                return acc + (parseInt(cleanVal) || 0);
            }, 0);
        } else if (typeof rawStock === 'object' && rawStock !== null) {
            const val = (rawStock as any).amount || (rawStock as any).quantity || (rawStock as any).Value || 0;
            const cleanVal = String(val).replace(/[><+\s]/g, '');
            stock = parseInt(cleanVal) || 0;
        } else {
            const cleanVal = String(rawStock).replace(/[><+\s]/g, '');
            stock = parseInt(cleanVal) || 0;
        }

        const fullTextForSeason = (title + ' ' + desc).toLowerCase();
        const season = detectSeason(fullTextForSeason);

        let vehicle_type = 'car';
        if (radius.includes('C') || title.includes('Truck') || title.includes('Bus') || title.includes('LT')) vehicle_type = 'cargo';
        else if (title.includes('SUV') || title.includes('4x4')) vehicle_type = 'suv';

        const code = fieldMapping.code ? safeExtractString(getValueByPath(item, fieldMapping.code)).trim() : null;
        const prodNum = fieldMapping.product_number ? safeExtractString(getValueByPath(item, fieldMapping.product_number)).trim() : null;

        return {
            title: title,
            manufacturer: brand,
            price: String(price),
            base_price: String(basePrice || price),
            image_url: imageUrl,
            catalog_number: code, 
            product_number: prodNum,
            stock_quantity: stock,
            in_stock: stock > 0,
            supplier_id: parseInt(targetSupplierId),
            description: desc || 'API Import',
            season,
            radius,
            vehicle_type
        };
    };

    const executeImport = async () => {
        if (!targetSupplierId) { alert("Оберіть постачальника!"); return; }
        setImporting(true);
        try {
            const mappedData = itemsToImport.map(transformItem);
            const { error } = await supabase.from('tyres').insert(mappedData);
            
            if (error) throw error;
            
            alert(`Імпортовано ${mappedData.length} товарів!`);
        } catch (e: any) {
            const msg = e.message || (typeof e === 'string' ? e : 'Невідома помилка');
            alert("Помилка (DB Error): " + msg);
        } finally {
            setImporting(false);
        }
    };

    const executeFullSync = async () => {
        if (!apiConfig) { alert("Спочатку зробіть тестовий запит!"); return; }
        if (!targetSupplierId) { alert("Оберіть постачальника!"); return; }
        if (!fieldMapping.code) { alert("Поле 'Артикул' обов'язкове!"); return; }

        setIsFullSync(true);
        setFullSyncProgress({ total: 0, processed: 0, updated: 0, inserted: 0 });

        try {
            const loopConfig = { ...apiConfig };
            if (typeof loopConfig.body === 'string') {
                try { loopConfig.body = JSON.parse(loopConfig.body); } catch(e) {}
            }

            let offset = 0;
            const BATCH_SIZE = 1000;
            let keepFetching = true;

            while (keepFetching) {
                if (loopConfig.body && typeof loopConfig.body === 'object') {
                    loopConfig.body.From = offset;
                    loopConfig.body.Count = BATCH_SIZE;
                }

                const { data: result, error } = await supabase.functions.invoke('super-endpoint', {
                    body: {
                        url: loopConfig.url,
                        method: loopConfig.method,
                        headers: loopConfig.headers,
                        body: loopConfig.body
                    }
                });

                if (error) throw new Error("API Network Error: " + error.message);
                
                const rawData = result.data !== undefined ? result.data : result;
                let batchItems: any[] = [];
                
                if (jsonPath && jsonPath !== 'root') {
                    const extracted = getValueByPath(rawData, jsonPath);
                    if (Array.isArray(extracted)) batchItems = extracted;
                } else if (Array.isArray(rawData)) {
                    batchItems = rawData;
                } else {
                    const scan = scanForArrays(rawData);
                    if (scan.length > 0) {
                        const path = scan[0].path;
                        const extracted = path === 'root' ? rawData : getValueByPath(rawData, path);
                        if (Array.isArray(extracted)) batchItems = extracted;
                    }
                }

                if (batchItems.length === 0) {
                    keepFetching = false;
                    break;
                }

                const mappedBatch = batchItems.map(transformItem);
                const codes = mappedBatch.map(i => i.catalog_number).filter(c => c);
                
                const { data: existingDB } = await supabase
                    .from('tyres')
                    .select('id, catalog_number')
                    .eq('supplier_id', parseInt(targetSupplierId))
                    .in('catalog_number', codes);

                const existingMap = new Map();
                existingDB?.forEach((item: any) => existingMap.set(item.catalog_number, item));

                const itemsToUpdate = [];
                const itemsToInsert = [];
                
                for (const item of mappedBatch) {
                    if (!item.catalog_number) continue;
                    const existing = existingMap.get(item.catalog_number);
                    if (existing) {
                        itemsToUpdate.push({ ...item, id: existing.id });
                    } else {
                        itemsToInsert.push(item);
                    }
                }

                let currentUpdated = 0;
                let currentInserted = 0;

                if (itemsToUpdate.length > 0) {
                    const { error: updErr } = await supabase.from('tyres').upsert(itemsToUpdate);
                    if (updErr) throw new Error("DB Update Failed: " + updErr.message);
                    currentUpdated = itemsToUpdate.length;
                }
                
                if (itemsToInsert.length > 0) {
                    const { error: insErr } = await supabase.from('tyres').insert(itemsToInsert);
                    if (insErr) throw new Error("DB Insert Failed: " + insErr.message);
                    currentInserted = itemsToInsert.length;
                }

                setFullSyncProgress(prev => ({
                    total: prev.total + batchItems.length,
                    processed: prev.processed + batchItems.length,
                    updated: prev.updated + currentUpdated,
                    inserted: prev.inserted + currentInserted
                }));

                if (batchItems.length < BATCH_SIZE) {
                    keepFetching = false;
                } else {
                    offset += BATCH_SIZE;
                }
            }
            alert("Синхронізація завершена успішно!");
        } catch (e: any) {
            alert("Збій синхронізації: " + e.message);
        } finally {
            setIsFullSync(false);
        }
    };

    return (
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl h-full flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-center mb-4 shrink-0">
                <h4 className="text-white font-bold flex items-center gap-2"><Database size={18}/> Мапінг (Співставлення)</h4>
                {responseStatus && (
                    <span className={`text-xs font-bold px-2 py-1 rounded ${responseStatus >= 200 && responseStatus < 300 ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                        HTTP {responseStatus}
                    </span>
                )}
            </div>

            {!responseData ? (
                <div className="flex-grow flex flex-col items-center justify-center text-zinc-600 border-2 border-dashed border-zinc-800 rounded-xl m-4">
                    <FileJson size={48} className="mb-4 opacity-20" />
                    <p className="text-center">Зробіть запит зліва,<br/>щоб отримати дані.</p>
                </div>
            ) : (
                <>
                    {/* SCROLLABLE AREA */}
                    <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar pb-20">
                        <div className="flex flex-col gap-6">
                            
                            {/* DATA SOURCE SELECTOR */}
                            <div className="bg-black/40 p-4 rounded-xl border border-zinc-700">
                                <div className="flex justify-between items-start mb-3">
                                    <label className="text-zinc-400 text-xs font-bold uppercase flex items-center gap-2"><ListTree size={14}/> Джерело даних (Масив)</label>
                                    {arrayCount > 0 && <span className="text-green-400 text-xs font-bold bg-green-900/20 px-2 py-1 rounded">Знайдено: {arrayCount} шт</span>}
                                </div>
                                
                                {detectedArrays.length > 0 && (
                                    <div className="mb-3 flex flex-wrap gap-2">
                                        {detectedArrays.map((arr, idx) => (
                                            <button 
                                                key={idx}
                                                onClick={() => setJsonPath(arr.path === 'root' ? '' : arr.path)}
                                                className={`text-xs px-3 py-1.5 rounded border flex items-center gap-2 transition-colors ${jsonPath === (arr.path === 'root' ? '' : arr.path) ? 'bg-[#FFC300] text-black border-[#FFC300] font-bold' : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500'}`}
                                            >
                                                <span className="font-mono">{arr.path === 'root' ? 'ROOT' : arr.path}</span>
                                                <span className="bg-black/20 px-1.5 rounded text-[10px]">{arr.count}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={jsonPath}
                                        onChange={(e) => setJsonPath(e.target.value)}
                                        placeholder="Введіть шлях вручну (напр. data.list)"
                                        className="w-full bg-black border border-zinc-600 rounded p-2 text-white text-sm font-mono focus:border-[#FFC300] outline-none"
                                    />
                                    <button 
                                        onClick={() => setShowRawJson(!showRawJson)} 
                                        className={`px-3 py-2 rounded border border-zinc-600 transition-colors flex items-center gap-2 font-bold text-xs whitespace-nowrap ${showRawJson ? 'bg-[#FFC300] text-black border-[#FFC300]' : 'bg-black text-zinc-400 hover:text-white'}`}
                                    >
                                        <Code size={16}/> JSON
                                    </button>
                                </div>
                                
                                {showRawJson && (
                                    <div className="mt-2 text-[10px] text-zinc-300 font-mono bg-black p-3 rounded border border-zinc-700 max-h-60 overflow-auto whitespace-pre-wrap shadow-inner">
                                        {JSON.stringify(responseData, null, 2)}
                                    </div>
                                )}
                                
                                {previewItem && !showRawJson && (
                                    <div className="mt-2 bg-zinc-900/50 p-2 rounded border border-zinc-800">
                                        <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Приклад даних першого товару:</span>
                                        <div className="text-[10px] text-zinc-400 font-mono overflow-x-auto whitespace-nowrap">
                                            {JSON.stringify(previewItem).substring(0, 200)}...
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* SUPPLIER */}
                            <div>
                                <label className="block text-white text-sm font-bold mb-2">Постачальник (для прив'язки товарів)</label>
                                <select 
                                    value={targetSupplierId} 
                                    onChange={e => setTargetSupplierId(e.target.value)}
                                    className="w-full bg-black border border-zinc-600 rounded-lg p-3 text-white font-bold"
                                >
                                    <option value="">-- Оберіть зі списку --</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>

                            {/* MAPPING FIELDS */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <h5 className="text-zinc-400 text-xs font-bold uppercase flex items-center gap-2">Співставлення полів</h5>
                                    <div className="flex gap-2">
                                        <button onClick={() => setManualMode(!manualMode)} className="text-xs text-zinc-500 hover:text-white underline">
                                            {manualMode ? 'Увімкнути список' : 'Ввести вручну'}
                                        </button>
                                        <button onClick={() => autoMapFields(true)} className="text-xs bg-blue-900/30 text-blue-300 hover:bg-blue-900/50 px-3 py-1 rounded border border-blue-900/50 flex items-center gap-1 transition-colors">
                                            <Wand2 size={12}/> Авто-підбір
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-3">
                                    {[
                                        { label: 'ID для Фото (ProductId)*', key: 'product_number', desc: 'ID для запиту фото (-1476057)' },
                                        { label: 'Артикул (Number/Card)', key: 'code', desc: 'Видимий код/артикул (1104600)' },
                                        { label: 'Назва (Full Name)*', key: 'title', desc: 'Повна назва товару' },
                                        { label: 'Залишок (Stock/Rests)*', key: 'stock', desc: 'Поле з кількістю (може бути масивом Rests)' },
                                        { label: 'Ціна Продаж (Retail)*', key: 'price', desc: 'Ціна для клієнта' },
                                        { label: 'Ціна Закупка (Base)', key: 'base_price', desc: 'Собівартість' },
                                        { label: 'Бренд (Brand)', key: 'brand', desc: 'Виробник' },
                                        { label: 'Опис', key: 'description', desc: 'Для визначення сезону' },
                                        { label: 'Фото URL', key: 'image', desc: 'Якщо є пряме посилання' },
                                    ].map((field) => (
                                        <div key={field.key} className="flex flex-col bg-black/20 p-2.5 rounded border border-zinc-800 hover:border-zinc-600 transition-colors">
                                            <div className="flex justify-between mb-1 items-center">
                                                <label className="text-xs text-white font-bold">{field.label}</label>
                                                <span className="text-[10px] text-zinc-500">{field.desc}</span>
                                            </div>
                                            
                                            {manualMode ? (
                                                <input 
                                                    value={(fieldMapping as any)[field.key]} 
                                                    onChange={e => setFieldMapping({...fieldMapping, [field.key]: e.target.value})} 
                                                    className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-sm font-bold focus:border-[#FFC300] outline-none" 
                                                    placeholder="Ключ з JSON..." 
                                                />
                                            ) : (
                                                <select 
                                                    value={(fieldMapping as any)[field.key]} 
                                                    onChange={e => setFieldMapping({...fieldMapping, [field.key]: e.target.value})} 
                                                    className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-sm font-mono focus:border-[#FFC300] outline-none cursor-pointer"
                                                >
                                                    <option value="">-- Не обрано --</option>
                                                    {availableKeys.map(k => {
                                                        const val = getPreviewValueText(k);
                                                        return (
                                                            <option key={k} value={k}>
                                                                {k} {val ? `(Приклад: ${val})` : ''}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            )}

                                            <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
                                                <ArrowRight size={10}/>
                                                <span className={`font-mono truncate ${(fieldMapping as any)[field.key] && getPreviewValueText((fieldMapping as any)[field.key]) !== 'не знайдено' ? 'text-green-500' : 'text-zinc-600'}`}>
                                                    {getPreviewValueText((fieldMapping as any)[field.key]) || '...'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* FIXED FOOTER WITH BUTTONS - ALWAYS VISIBLE */}
                    <div className="shrink-0 pt-4 border-t border-zinc-800 bg-zinc-900 sticky bottom-0 z-20 space-y-3">
                        {isFullSync ? (
                            <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700 animate-pulse">
                                <h5 className="text-[#FFC300] font-bold text-center mb-2 flex justify-center items-center gap-2"><Loader2 className="animate-spin"/> СИНХРОНІЗАЦІЯ...</h5>
                                <div className="text-xs text-zinc-400 space-y-1">
                                    <div className="flex justify-between"><span>Оброблено:</span> <span className="text-white">{fullSyncProgress.processed}</span></div>
                                    <div className="flex justify-between"><span>Оновлено:</span> <span className="text-blue-400">{fullSyncProgress.updated}</span></div>
                                    <div className="flex justify-between"><span>Нових:</span> <span className="text-green-400">{fullSyncProgress.inserted}</span></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <button 
                                    onClick={executeFullSync}
                                    disabled={importing || !apiConfig}
                                    title={!apiConfig ? "Спочатку зробіть тестовий запит!" : "Запустити повний цикл"}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                                >
                                    <Zap size={20} />
                                    СИНХРОНІЗУВАТИ ВСЕ (SMART SYNC)
                                </button>
                                
                                <button 
                                    onClick={executeImport}
                                    disabled={importing || isFullSync || arrayCount === 0}
                                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 border border-zinc-700"
                                >
                                    {importing ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                                    Імпортувати тільки поточні ({arrayCount} шт)
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default ImportMapper;
