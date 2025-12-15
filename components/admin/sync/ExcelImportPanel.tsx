
import React, { useState, useRef } from 'react';
import readXlsxFile from 'read-excel-file';
import { Upload, FileSpreadsheet, Save, Loader2, RefreshCw, AlertTriangle, ArrowDown, CheckCircle, HelpCircle } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { safeExtractString, smartExtractPrice, detectSeason } from './syncUtils';

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
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [stats, setStats] = useState({ total: 0, updated: 0, created: 0, errors: 0 });
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        
        let vehicle_type = 'car';
        if (radius.includes('C') || title.includes('Truck') || title.includes('LT')) vehicle_type = 'cargo';
        else if (title.includes('SUV') || title.includes('4x4')) vehicle_type = 'suv';

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
            if (file.name.endsWith('.csv')) {
                allRows = await parseCSV(file);
            } else {
                allRows = await readXlsxFile(file);
            }

            const rowsToProcess = allRows.slice(startRow - 1); // Respect start row
            const batchSize = 100;
            
            // Get existing items for this supplier to decide insert vs update
            // Strategy: Upsert based on (catalog_number, supplier_id) constraint
            
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
                        // Estimate created vs updated is hard with upsert, usually we count total processed
                        // For exact stats we'd need to check created_at vs updated_at but that's expensive
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

    return (
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-6 h-full flex flex-col relative overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 flex-shrink-0">
                <div>
                    <h4 className="text-white font-bold flex items-center gap-2"><FileSpreadsheet size={18} className="text-[#FFC300]"/> Імпорт Прайсу (Excel/CSV)</h4>
                    <p className="text-zinc-400 text-sm mt-1">Оновлення цін та залишків, створення нових карток.</p>
                </div>
                
                {/* 1. SELECT SUPPLIER */}
                <div className="w-full md:w-64">
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
                    <div className="flex justify-end pt-4 border-t border-zinc-800 flex-shrink-0">
                        {importing ? (
                            <button disabled className="bg-zinc-800 text-white font-bold px-8 py-3 rounded-xl flex items-center gap-2 cursor-wait">
                                <Loader2 className="animate-spin"/> Імпорт...
                            </button>
                        ) : (
                            <button 
                                onClick={handleImport} 
                                disabled={!selectedSupplierId}
                                className="bg-[#FFC300] hover:bg-[#e6b000] text-black font-black px-8 py-3 rounded-xl flex items-center gap-2 shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save size={20}/> ЗАВАНТАЖИТИ В БАЗУ
                            </button>
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
        </div>
    );
};

export default ExcelImportPanel;
