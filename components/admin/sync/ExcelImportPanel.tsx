
import React, { useState, useRef, useEffect } from 'react';
import readXlsxFile from 'read-excel-file';
import { 
    Upload, FileSpreadsheet, Save, Loader2, RefreshCw, AlertTriangle, 
    ArrowDown, CheckCircle, HelpCircle, Sparkles, Info, 
    Image, X, Trash2, Camera, Download 
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { safeExtractString, smartExtractPrice, detectSeason, normalizeQuery } from './syncUtils';
import { generateSeoBulkJson, normalizeProviderId, type AIProviderId } from '../../../aiSeoClient';
import { fetchAdminAiKeyStatus, hasProviderKey, invokeAiProxy } from '../../../aiProxyClient';

interface ExcelImportPanelProps {
    suppliers: any[];
}

const COLUMN_TYPES = [
    { id: 'ignore', label: '-- Ігнорувати --', color: 'text-zinc-500' },
    { id: 'catalog_number', label: 'Артикул (Унікальний код)*', color: 'text-blue-400 font-bold' },
    { id: 'title', label: 'Назва товару*', color: 'text-white font-bold' },
    { id: 'price', label: 'Ціна (Роздріб)', color: 'text-green-400 font-bold' },
    { id: 'base_price', label: 'Ціна (Закупка)', color: 'text-blue-300' },
    { id: 'stock', label: 'Залишок (Кількість)', color: 'text-orange-400' },
    { id: 'brand', label: 'Бренд', color: 'text-zinc-300' },
    { id: 'radius', label: 'Радіус (R)', color: 'text-zinc-300' },
    { id: 'width', label: 'Ширина', color: 'text-zinc-300' },
    { id: 'height', label: 'Висота', color: 'text-zinc-300' },
    { id: 'season', label: 'Сезон', color: 'text-zinc-300' },
];

const ExcelImportPanel: React.FC<ExcelImportPanelProps> = ({ suppliers }) => {
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[][]>([]);
    const [columnMapping, setColumnMapping] = useState<Record<number, string>>({});
    const [startRow, setStartRow] = useState(1);
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [defaultCategory, setDefaultCategory] = useState(''); // NEW STATE
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [stats, setStats] = useState({ total: 0, updated: 0, created: 0, errors: 0 });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // AI States
    const [aiProvider, setAiProvider] = useState<AIProviderId>('gemini');
    const [hasKey, setHasKey] = useState(false);
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [aiProgress, setAiProgress] = useState({ current: 0, total: 0 });

    // PHOTO MANAGER STATE
    const [isPhotoProcessing, setIsPhotoProcessing] = useState(false);
    const [photoProgress, setPhotoProgress] = useState({ current: 0, total: 0 });

    useEffect(() => {
        const init = async () => {
            const { data } = await supabase.from('settings').select('value').eq('key', 'ai_provider').maybeSingle();
            const p = normalizeProviderId(data?.value);
            setAiProvider(p);
            try {
                const s = await fetchAdminAiKeyStatus();
                setHasKey(hasProviderKey(s, p));
            } catch { setHasKey(false); }
        };
        init();
    }, []);

    const parseCSV = async (file: File): Promise<any[][]> => {
        const text = await file.text();
        // Simple CSV parser handling semicolon or comma
        const lines = text.split(/\r?\n/);
        const delimiter = lines[0].includes(';') ? ';' : ',';
        return lines.map(line => line.split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, '')));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;
        
        setFile(selectedFile);
        setLoading(true);
        setPreviewData([]);
        setColumnMapping({});
        setStats({ total: 0, updated: 0, created: 0, errors: 0 });

        try {
            let rows: any[][] = [];
            if (selectedFile.name.endsWith('.csv')) {
                rows = await parseCSV(selectedFile);
            } else {
                rows = await readXlsxFile(selectedFile);
            }
            // Filter empty rows
            const cleanRows = rows.filter(row => row.some(cell => cell !== null && cell !== '' && cell !== undefined));
            // Show up to 200 rows for preview/scrolling
            setPreviewData(cleanRows.slice(0, 200)); 
        } catch (err: any) {
            alert("Помилка читання файлу: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleColumnChange = (colIndex: number, type: string) => {
        setColumnMapping(prev => ({ ...prev, [colIndex]: type }));
    };

    const processRow = (row: any[]) => {
        const data: any = {};
        
        Object.entries(columnMapping).forEach(([colIndex, type]) => {
            if (type === 'ignore') return;
            const val = row[parseInt(colIndex)];
            data[type as string] = val;
        });

        // Validation
        if (!data.catalog_number) return null; // Mandatory

        // Cleaning
        const price = smartExtractPrice(data.price);
        const basePrice = smartExtractPrice(data.base_price);
        const stockRaw = data.stock ? String(data.stock).replace(/[><\s+]/g, '') : '0';
        const stock = parseInt(stockRaw) || 0;
        
        // Title Construction if missing
        let title = safeExtractString(data.title);
        if (!title && data.brand && data.width && data.height && data.radius) {
            title = `${data.brand} ${data.width}/${data.height} ${data.radius}`;
        }
        
        // Auto-detect fields if not mapped but present in title
        let radius = safeExtractString(data.radius);
        let width = safeExtractString(data.width);
        let height = safeExtractString(data.height);
        
        // Regex extract from title if columns are missing
        if ((!radius || !width || !height) && title) {
            const sizeMatch = title.match(/(\d{3})[\/\s](\d{2})[\s\w]*R(\d{2}(?:\.5)?[C|c]?)/);
            if (sizeMatch) {
                if(!width) width = sizeMatch[1];
                if(!height) height = sizeMatch[2];
                if(!radius) radius = 'R'+sizeMatch[3].toUpperCase();
            }
        }

        const season = data.season ? detectSeason(data.season) : detectSeason(title);
        
        // --- CATEGORY LOGIC ---
        let vehicle_type = 'car';
        if (defaultCategory) {
            vehicle_type = defaultCategory;
        } else {
            // Auto Detect
            if (radius.includes('C') || title.includes('Truck') || title.includes('LT')) vehicle_type = 'cargo';
            else if (title.includes('SUV') || title.includes('4x4')) vehicle_type = 'suv';
        }

        return {
            catalog_number: safeExtractString(data.catalog_number),
            title: title || 'Товар без назви',
            manufacturer: safeExtractString(data.brand) || 'Unknown',
            price: String(price),
            base_price: String(basePrice),
            stock_quantity: stock,
            in_stock: stock > 0,
            radius,
            season,
            vehicle_type,
            supplier_id: parseInt(selectedSupplierId)
        };
    };

    const handleImport = async () => {
        if (!selectedSupplierId) { alert("Оберіть постачальника!"); return; }
        if (!Object.values(columnMapping).includes('catalog_number')) { alert("Будь ласка, вкажіть стовпець 'Артикул'!"); return; }
        if (!file) return;

        setImporting(true);
        let created = 0;
        let updated = 0;
        let errors = 0;

        try {
            // Re-read full file for import
            let allRows: any[][] = [];
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (ext === 'csv') {
                allRows = await parseCSV(file);
            } else {
                allRows = await readXlsxFile(file);
            }

            const rowsToProcess = allRows.slice(startRow - 1).filter(r => r.some(c => !!c)); // Respect start row & not empty
            const batchSize = 100;
            
            for (let i = 0; i < rowsToProcess.length; i += batchSize) {
                const batch = rowsToProcess.slice(i, i + batchSize);
                const payload = [];

                for (const row of batch) {
                    const item = processRow(row);
                    if (item) payload.push(item);
                }

                if (payload.length > 0) {
                    const { data, error } = await supabase.from('tyres').upsert(payload, { 
                        onConflict: 'catalog_number,supplier_id',
                        ignoreDuplicates: false 
                    }).select();

                    if (error) {
                        console.error("Batch error", error);
                        errors += payload.length;
                    } else {
                        updated += payload.length; 
                    }
                }
            }

            setStats({ total: rowsToProcess.length, updated, created: 0, errors });
            alert(`Імпорт завершено! Оброблено: ${rowsToProcess.length}`);

        } catch (e: any) {
            alert("Критична помилка: " + e.message);
        } finally {
            setImporting(false);
        }
    };

    const handleAiImport = async () => {
        if (!selectedSupplierId) { alert("Оберіть постачальника!"); return; }
        if (!Object.values(columnMapping).includes('catalog_number')) { alert("Будь ласка, вкажіть стовпець 'Артикул'!"); return; }
        if (!hasKey) { alert("API ключ не активний. Перевірте налаштування."); return; }
        if (!file) return;

        try {
            let allRows: any[][] = [];
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (ext === 'csv') {
                allRows = await parseCSV(file);
            } else {
                allRows = await readXlsxFile(file);
            }

            const dataRows = allRows.slice(startRow - 1).filter(r => r.some(c => !!c));
            if (dataRows.length === 0) return;

            if (!confirm(`🧠 Почати AI Імпорт для ${dataRows.length} товарів? \n\nAI Створе опис, SEO та характеристики. \nЦе займе приблизно ${Math.ceil((dataRows.length / 15) * 5)} секунд.`)) return;

            setIsAiProcessing(true);
            setAiProgress({ current: 0, total: dataRows.length });

            const systemPrompt = `Ти - професійний SEO та спеціаліст з шин. Оброби список товарів.
Для кожного товару ПОВЕРНИ JSON у масиві "results":
- "id": унікальний артикул (який я дам нижче)
- "width", "height", "radius" (напр "205", "55", "R16")
- "manufacturer" (бренд)
- "season" ("winter", "summer", "all-season")
- "vehicle_type" ("car", "cargo", "suv", "truck", "agro")
- "description": КОРОТКИЙ ОПИС ДО 300 СИМВОЛІВ. БЕЗ ВОДИ. Тільки реальні переваги зачеплення, гальмування та комфорту.
- "seo_title", "seo_description", "seo_keywords" (мовлення: українська).
ОБОВ'ЯЗКОВО поверни "id" який відповідає артикулу.`;

            // Helper to get col index by type
            const getCol = (type: string) => {
                const entry = Object.entries(columnMapping).find(([_, t]) => t === type);
                return entry ? parseInt(entry[0]) : -1;
            };

            const artIdx = getCol('catalog_number');
            const titleIdx = getCol('title');
            const priceIdx = getCol('price');

            const CHUNK_SIZE = 15;
            for (let i = 0; i < dataRows.length; i += CHUNK_SIZE) {
                const chunk = dataRows.slice(i, i + CHUNK_SIZE);
                const userPrompt = JSON.stringify(chunk.map(r => ({
                    id: String(r[artIdx] ?? ''),
                    title: String(r[titleIdx] ?? ''),
                    price: String(r[priceIdx] ?? '')
                })));

                const aiData = await generateSeoBulkJson({
                    provider: aiProvider,
                    systemPrompt,
                    userPrompt
                });

                if (aiData.results && Array.isArray(aiData.results)) {
                    const upserts = chunk.map((r) => {
                        const art = String(r[artIdx] ?? '');
                        const title = String(r[titleIdx] ?? '');
                        const price = smartExtractPrice(r[priceIdx]);
                        const aiMatch = aiData.results.find((a: any) => String(a.id) === art);
                        
                        return {
                            catalog_number: art,
                            title: title,
                            price: String(price),
                            base_price: String(price),
                            supplier_id: parseInt(selectedSupplierId),
                            stock_quantity: 10,
                            in_stock: true,
                            // AI Predicted Fields
                            width: aiMatch?.width || '',
                            height: aiMatch?.height || '',
                            radius: aiMatch?.radius || '',
                            manufacturer: aiMatch?.manufacturer || '',
                            season: aiMatch?.season || detectSeason(title),
                            vehicle_type: aiMatch?.vehicle_type || defaultCategory || 'car',
                            description: aiMatch?.description || '',
                            seo_title: aiMatch?.seo_title || '',
                            seo_description: aiMatch?.seo_description || '',
                            seo_keywords: aiMatch?.seo_keywords || ''
                        };
                    });

                    await supabase.from('tyres').upsert(upserts, { onConflict: 'catalog_number,supplier_id' });
                }

                setAiProgress({ current: Math.min(i + CHUNK_SIZE, dataRows.length), total: dataRows.length });
                await new Promise(r => setTimeout(r, 4500)); 
            }

            alert("✨ AI Імпорт завершено!");
            setStats({ total: dataRows.length, updated: dataRows.length, created: 0, errors: 0 });

        } catch (e: any) {
            alert("Помилка AI Імпорту: " + e.message);
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleBulkAiPhotos = async (mode: 'missing' | 'replace') => {
        if (!hasKey) { alert("API ключ не активний. Перевірте налаштування."); return; }
        
        const confirmMsg = mode === 'missing' 
            ? "🔍 Знайти фото для всіх товарів БЕЗ зображень?" 
            : "⚠️ УВАГА! Це ЗАМІНИТЬ існуючі фото новими для ВСІХ товарів. Продовжити?";
            
        if (!confirm(confirmMsg)) return;

        setIsPhotoProcessing(true);
        try {
            // 1. Fetch tyres
            let queryBuilder = supabase.from('tyres').select('id, title, image_url');
            if (mode === 'missing') {
                queryBuilder = queryBuilder.or('image_url.is.null,image_url.eq.""');
            }
            
            const { data: tyres, error } = await queryBuilder;
            if (error) throw error;
            if (!tyres || tyres.length === 0) {
                alert("Нічого обробляти!");
                return;
            }

            setPhotoProgress({ current: 0, total: tyres.length });

            for (let i = 0; i < tyres.length; i++) {
                const tyre = tyres[i];
                const normalizedQ = normalizeQuery(tyre.title);
                
                try {
                    const res = await invokeAiProxy({
                        mode: 'image_search',
                        query: normalizedQ
                    });

                    if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
                        const newUrl = res.data[0].imageUrl;
                        await supabase.from('tyres').update({ image_url: newUrl }).eq('id', tyre.id);
                    }
                } catch (e) {
                    console.error(`Error for tyre ${tyre.id}:`, e);
                }

                setPhotoProgress(prev => ({ ...prev, current: i + 1 }));
                // Rate limiting delay
                await new Promise(r => setTimeout(r, 600));
            }

            alert("🌠 Масовий пошук фото завершено!");
        } catch (e: any) {
            alert("Помилка: " + e.message);
        } finally {
            setIsPhotoProcessing(false);
        }
    };

    const handleClearAllPhotos = async () => {
        if (!confirm("🚨 Ви впевнені? Це ВИДАЛИТЬ посилання на фото та галереї для ВСІХ товарів у базі!")) return;
        
        setIsPhotoProcessing(true);
        try {
            const { error } = await supabase.from('tyres').update({ 
                image_url: null,
                gallery: null 
            }).not('id', 'is', null);
            
            if (error) throw error;
            alert("🧹 Базу фото очищено.");
        } catch (e: any) {
            alert("Помилка очищення: " + e.message);
        } finally {
            setIsPhotoProcessing(false);
        }
    };

    return (
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-6 h-full flex flex-col relative overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 flex-shrink-0">
                <div>
                    <h4 className="text-white font-bold flex items-center gap-2"><FileSpreadsheet size={18} className="text-[#FFC300]"/> Імпорт Прайсу (Excel/CSV)</h4>
                    <p className="text-zinc-400 text-sm mt-1">Оновлення цін та залишків, створення нових карток.</p>
                </div>
                
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                    {/* CATEGORY SELECTOR */}
                    <div className="w-full md:w-40">
                        <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Категорія (опц.)</label>
                        <select 
                            value={defaultCategory}
                            onChange={(e) => setDefaultCategory(e.target.value)}
                            className="w-full bg-black border border-zinc-600 rounded-lg p-2 text-white font-bold text-sm focus:border-[#FFC300] outline-none"
                        >
                            <option value="">Авто-визначення</option>
                            <option value="car">Легкова</option>
                            <option value="suv">SUV</option>
                            <option value="cargo">Вантажна (C)</option>
                            <option value="truck">TIR (Вантаж)</option>
                            <option value="agro">Спецтехніка</option>
                        </select>
                    </div>

                    {/* SUPPLIER SELECTOR */}
                    <div className="w-full md:w-48">
                        <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Постачальник</label>
                        <select 
                            value={selectedSupplierId}
                            onChange={(e) => setSelectedSupplierId(e.target.value)}
                            className="w-full bg-black border border-zinc-600 rounded-lg p-2 text-white font-bold text-sm focus:border-[#FFC300] outline-none"
                        >
                            <option value="">-- Оберіть --</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* 2. FILE UPLOAD */}
            {!previewData.length && (
                <div className="border-2 border-dashed border-zinc-700 rounded-xl p-6 text-center hover:bg-zinc-800/30 transition-colors flex-grow flex flex-col items-center justify-center">
                    <input 
                        type="file" 
                        accept=".xlsx, .xls, .csv" 
                        onChange={handleFileUpload} 
                        className="hidden" 
                        ref={fileInputRef}
                    />
                    <div className="flex flex-col items-center gap-3 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <Upload size={32} className="text-zinc-500" />
                        <div>
                            <button className="text-[#FFC300] font-bold hover:underline">Оберіть файл</button>
                            <span className="text-zinc-400"> або перетягніть сюди</span>
                        </div>
                        <p className="text-xs text-zinc-500">Підтримуються формати: .xlsx, .xls, .csv</p>
                    </div>
                </div>
            )}

            {/* 3. MAPPING UI */}
            {previewData.length > 0 && (
                <div className="animate-in fade-in flex flex-col flex-grow overflow-hidden gap-4">
                    
                    {/* Header Controls */}
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between flex-shrink-0 bg-black/20 p-2 rounded-lg border border-zinc-800">
                        <div className="flex items-center gap-2">
                            {file && (
                                <div className="flex items-center gap-2 text-white bg-zinc-800 py-1.5 px-3 rounded-lg text-sm">
                                    <FileSpreadsheet size={16} className="text-green-500"/>
                                    {file.name}
                                    <button onClick={() => { setFile(null); setPreviewData([]); }} className="ml-2 text-zinc-500 hover:text-red-500"><AlertTriangle size={14}/></button>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-zinc-400 font-bold whitespace-nowrap">Старт з рядка:</label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    value={startRow} 
                                    onChange={(e) => setStartRow(parseInt(e.target.value) || 1)}
                                    className="w-16 bg-black border border-zinc-600 rounded p-1 text-center text-white font-bold text-sm"
                                />
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-blue-300 bg-blue-900/10 px-3 py-1.5 rounded border border-blue-900/30">
                            <HelpCircle size={14}/>
                            <span>Вкажіть <strong>Артикул</strong> та <strong>Назву</strong></span>
                        </div>
                    </div>

                    {/* SCROLLABLE TABLE AREA - Forced Height for visibility */}
                    <div className="overflow-auto border border-zinc-700 rounded-xl bg-black relative flex-grow h-[600px] custom-scrollbar">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="sticky top-0 z-10 shadow-lg">
                                <tr>
                                    <th className="p-2 border-b border-r border-zinc-700 w-10 text-center bg-zinc-900 text-zinc-500 font-bold">#</th>
                                    {previewData[0].map((_, colIndex) => (
                                        <th key={colIndex} className="p-2 border-b border-r border-zinc-700 min-w-[150px] bg-zinc-900">
                                            <select 
                                                value={columnMapping[colIndex] || 'ignore'}
                                                onChange={(e) => handleColumnChange(colIndex, e.target.value)}
                                                className={`w-full bg-black border border-zinc-600 rounded p-1.5 text-xs font-bold outline-none cursor-pointer ${COLUMN_TYPES.find(t => t.id === (columnMapping[colIndex] || 'ignore'))?.color}`}
                                            >
                                                {COLUMN_TYPES.map(t => (
                                                    <option key={t.id} value={t.id} className="text-black bg-white">{t.label}</option>
                                                ))}
                                            </select>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="text-zinc-300">
                                {previewData.slice(startRow - 1, startRow + 99).map((row, rowIndex) => (
                                    <tr key={rowIndex} className="hover:bg-zinc-900/50">
                                        <td className="p-2 border-b border-r border-zinc-800 text-center text-zinc-600 font-mono bg-zinc-950/50">{rowIndex + startRow}</td>
                                        {row.map((cell, cellIndex) => (
                                            <td key={cellIndex} className={`p-2 border-b border-r border-zinc-800 truncate max-w-[200px] ${columnMapping[cellIndex] && columnMapping[cellIndex] !== 'ignore' ? 'text-white bg-zinc-900/20' : ''}`}>
                                                {safeExtractString(cell)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-col md:flex-row justify-end items-center gap-4 pt-4 border-t border-zinc-800 flex-shrink-0">
                        {isAiProcessing ? (
                             <div className="flex-1 w-full flex items-center gap-4 bg-purple-900/20 p-3 rounded-xl border border-purple-500/30">
                                <Sparkles className="text-purple-400 animate-pulse shrink-0" size={20} />
                                <div className="flex-1">
                                    <div className="flex justify-between text-[10px] font-bold text-purple-400 uppercase mb-1">
                                        <span>AI Оброблено</span>
                                        <span>{aiProgress.current} / {aiProgress.total}</span>
                                    </div>
                                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${(aiProgress.current / aiProgress.total) * 100}%` }}></div>
                                    </div>
                                </div>
                             </div>
                        ) : (
                            <>
                                <button 
                                    onClick={handleAiImport} 
                                    disabled={!selectedSupplierId || importing || !hasKey}
                                    className="w-full md:w-auto bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-black px-8 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    <Sparkles size={18} className="group-hover:animate-spin" /> ✨ AI ІМПОРТ (Опис + SEO)
                                </button>

                                {importing ? (
                                    <button disabled className="w-full md:w-auto bg-zinc-800 text-white font-bold px-8 py-3 rounded-xl flex items-center justify-center gap-2 cursor-wait">
                                        <Loader2 className="animate-spin"/> Імпорт...
                                    </button>
                                ) : (
                                    <button 
                                        onClick={handleImport} 
                                        disabled={!selectedSupplierId || isAiProcessing}
                                        className="w-full md:w-auto bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-8 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 disabled:opacity-50 border border-zinc-700"
                                    >
                                        <Save size={18}/> ЗВИЧАЙНИЙ ІМПОРТ
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                    
                    {stats.total > 0 && (
                        <div className="bg-green-900/20 border border-green-900/50 p-4 rounded-xl text-green-400 text-sm font-bold flex items-center gap-2 flex-shrink-0">
                            <CheckCircle size={18}/>
                            Готово! Оброблено {stats.total} рядків. (Оновлено/Створено: {stats.updated})
                        </div>
                    )}
                </div>
            )}

            {/* 🌠 AI PHOTO MANAGER PULT */}
            <div className="bg-black/30 p-6 rounded-2xl border border-zinc-800 space-y-6">
                <div>
                    <h4 className="text-white font-black flex items-center gap-2 uppercase tracking-tighter">
                        <Camera size={20} className="text-purple-500" />
                        🌠 ШІ Фото Менеджер
                    </h4>
                    <p className="text-zinc-500 text-xs mt-1">Автоматичне наповнення бази зображеннями через Google Images (Serper).</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button 
                        onClick={() => handleBulkAiPhotos('missing')}
                        disabled={isPhotoProcessing || !hasKey}
                        className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white p-4 rounded-xl border border-zinc-700 flex flex-col items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 group"
                    >
                        <Download className="text-green-500 group-hover:animate-bounce" />
                        <span className="font-bold text-sm">ШІ: Тільки нові</span>
                        <span className="text-[10px] text-zinc-500">Для товарів без фото</span>
                    </button>

                    <button 
                        onClick={() => handleBulkAiPhotos('replace')}
                        disabled={isPhotoProcessing || !hasKey}
                        className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white p-4 rounded-xl border border-zinc-700 flex flex-col items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 group"
                    >
                        <RefreshCw className="text-blue-500 group-hover:rotate-180 transition-transform duration-500" />
                        <span className="font-bold text-sm">ШІ: Повне оновлення</span>
                        <span className="text-[10px] text-zinc-500">Замінити ВСІ фото</span>
                    </button>

                    <button 
                        onClick={handleClearAllPhotos}
                        disabled={isPhotoProcessing}
                        className="bg-zinc-900/50 hover:bg-red-950/30 disabled:opacity-50 text-zinc-400 hover:text-red-400 p-4 rounded-xl border border-zinc-800 hover:border-red-900/50 flex flex-col items-center gap-2 transition-all active:scale-95"
                    >
                        <Trash2 size={20} />
                        <span className="font-bold text-sm">Очистити все</span>
                        <span className="text-[10px] opacity-60">Видалити фото з бази</span>
                    </button>
                </div>

                {isPhotoProcessing && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 bg-purple-900/20 p-5 rounded-2xl border border-purple-500/30">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-3">
                                <Loader2 className="animate-spin text-purple-400" size={20} />
                                <span className="text-white font-black text-sm uppercase tracking-tighter">Йде масова обробка...</span>
                            </div>
                            <span className="text-purple-300 font-mono text-xs">{photoProgress.current} / {photoProgress.total}</span>
                        </div>
                        <div className="h-3 bg-black rounded-full overflow-hidden border border-white/5">
                            <div 
                                className="h-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all duration-300" 
                                style={{ width: `${(photoProgress.current / photoProgress.total) * 100}%` }}
                            ></div>
                        </div>
                        <p className="text-[9px] text-zinc-500 mt-2 uppercase text-right tracking-widest">Будь ласка, не закривайте вікно</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExcelImportPanel;
