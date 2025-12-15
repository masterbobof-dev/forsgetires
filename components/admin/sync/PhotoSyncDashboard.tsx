
import React, { useState, useRef, useEffect } from 'react';
import { ImageIcon, StopCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { cleanHeaders, requestServerSideUpload, PHOTO_DEFAULT_CONFIG } from './syncUtils';

interface DetailedLogItem {
    id: number;
    productId: string;
    status: 'success' | 'error' | 'skipped';
    message: string;
    details?: string;
    timestamp: string;
}

interface PhotoSyncDashboardProps {
    disabled: boolean;
    onSyncStateChange: (isSyncing: boolean) => void;
}

const PhotoSyncDashboard: React.FC<PhotoSyncDashboardProps> = ({ disabled, onSyncStateChange }) => {
    const [isPhotoSyncing, setIsPhotoSyncing] = useState(false);
    const isPhotoSyncingRef = useRef(false);
    
    // Options
    const [forceOverwritePhotos, setForceOverwritePhotos] = useState(false);
    const [skipOutOfStock, setSkipOutOfStock] = useState(true);
    const [fixBrokenLinks, setFixBrokenLinks] = useState(false);
    const [customStartId, setCustomStartId] = useState('');
    const [lastSuccessCursor, setLastSuccessCursor] = useState('');

    // Logs & Progress
    const [syncProgress, setSyncProgress] = useState({ total: 0, processed: 0, updated: 0, inserted: 0 });
    const [syncLogs, setSyncLogs] = useState<string[]>([]);
    const [detailedLogs, setDetailedLogs] = useState<DetailedLogItem[]>([]);
    const [syncError, setSyncError] = useState('');

    useEffect(() => {
        const savedCursor = localStorage.getItem('forsage_photo_last_id');
        if (savedCursor) setLastSuccessCursor(savedCursor);
    }, []);

    const addLog = (msg: string) => setSyncLogs(prev => [...prev.slice(-20), msg]);
    const addDetailedLog = (item: Omit<DetailedLogItem, 'timestamp'>) => {
        setDetailedLogs(prev => {
            const newItem = { ...item, timestamp: new Date().toLocaleTimeString() };
            return [newItem, ...prev].slice(0, 500); 
        });
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

        const { data: keyData } = await supabase.from('settings').select('value').eq('key', 'supplier_api_key').single();
        const supplierKey = keyData?.value || '';

        // Init
        isPhotoSyncingRef.current = true;
        setIsPhotoSyncing(true);
        onSyncStateChange(true);
        setSyncProgress({ total: 0, processed: 0, updated: 0, inserted: 0 });
        setSyncLogs(['Запуск масової синхронізації...']);
        setDetailedLogs([]); 
        setSyncError('');

        // Estimate Count
        let countQuery = supabase.from('tyres').select('*', { count: 'exact', head: true }).eq('supplier_id', parseInt(savedSupplier));
        if (skipOutOfStock) countQuery = countQuery.neq('in_stock', false);
        const { count } = await countQuery;
        setSyncProgress(p => ({ ...p, total: count || 0 }));

        // Start Cursor
        let lastProcessedId = 0;
        if (customStartId) {
            const parsedId = parseInt(customStartId);
            if (!isNaN(parsedId) && parsedId > 0) {
                lastProcessedId = parsedId;
                addLog(`Відновлення з ID: ${lastProcessedId}...`);
            }
        }

        let keepGoing = true;
        const BATCH_SIZE = 1000;
        let skippedCount = 0;
        let errorCount = 0;
        let requestsInThisSession = 0; 

        try {
            while (keepGoing && isPhotoSyncingRef.current) {
                let query = supabase.from('tyres')
                    .select('id, product_number, title, image_url')
                    .eq('supplier_id', parseInt(savedSupplier))
                    .gt('id', lastProcessedId)
                    .not('product_number', 'is', null)
                    .order('id', { ascending: true })
                    .limit(BATCH_SIZE);

                if (!forceOverwritePhotos && !fixBrokenLinks) {
                    query = query.or('image_url.is.null,image_url.eq.""');
                }
                
                if (skipOutOfStock) {
                    query = query.neq('in_stock', false);
                }

                const { data: itemsBatch, error } = await query;

                if (error) throw error;
                
                if (!itemsBatch || itemsBatch.length === 0) {
                    if (lastProcessedId === 0 && !customStartId) {
                        const msg = skipOutOfStock 
                          ? "Не знайдено товарів (увімкнено 'Тільки в наявності'). Можливо всі товари мають фото або на залишку 0." 
                          : "Не знайдено товарів для обробки. Всі товари мають фото?";
                        addLog(msg);
                        setSyncError(msg);
                    } else {
                        addLog("Всі товари оброблено (або кінець списку).");
                    }
                    keepGoing = false;
                    break;
                }

                addLog(`Завантажено пакет: ${itemsBatch.length} шт. (Start ID > ${lastProcessedId})`);

                for (const product of itemsBatch) {
                    if (!isPhotoSyncingRef.current) { keepGoing = false; break; }

                    lastProcessedId = product.id;
                    setSyncProgress(p => ({ ...p, processed: p.processed + 1 }));

                    // FIX BROKEN LINKS FILTER
                    if (fixBrokenLinks && !forceOverwritePhotos) {
                        const url = product.image_url;
                        if (url && url.length > 25 && url.startsWith('http')) {
                            continue; // Valid link, skip
                        }
                    }

                    // Hourly Limit Pause (Proactive)
                    if (requestsInThisSession > 0 && requestsInThisSession % 290 === 0) {
                        addLog(`[LIMIT WARNING] Виконано ${requestsInThisSession} запитів. Проактивна пауза 3 хв...`);
                        await new Promise(r => setTimeout(r, 180000));
                    }

                    let idToSend = parseInt(product.product_number);
                    if (!idToSend) {
                        skippedCount++;
                        addDetailedLog({ id: product.id, productId: 'N/A', status: 'skipped', message: 'Немає product_number' });
                        continue;
                    }
                    if (idToSend > 0) idToSend = -idToSend;

                    let requestBody: any = {};
                    try {
                        let bodyStr = config.body;
                        if (supplierKey) bodyStr = bodyStr.replace("INSERT_KEY_HERE", supplierKey);
                        requestBody = JSON.parse(bodyStr);
                        requestBody.ProductId = idToSend;
                    } catch(e) { 
                        skippedCount++;
                        continue; 
                    }

                    let success = false;
                    let attempts = 0;
                    
                    while(!success && attempts < 5 && isPhotoSyncingRef.current) {
                        attempts++;
                        try {
                            requestsInThisSession++;
                            const cleanH = cleanHeaders(JSON.parse(config.headers || '{}'));

                            const { imageUrl } = await requestServerSideUpload({
                                url: config.url,
                                method: config.method,
                                headers: cleanH,
                                body: requestBody
                            }, product.id);
                            
                            await supabase.from('tyres').update({ image_url: imageUrl, in_stock: true }).eq('id', product.id);
                            
                            localStorage.setItem('forsage_photo_last_id', String(product.id));
                            setLastSuccessCursor(String(product.id));

                            setSyncProgress(p => ({ ...p, updated: p.updated + 1 }));
                            addDetailedLog({ id: product.id, productId: String(idToSend), status: 'success', message: 'Завантажено' });
                            success = true;

                        } catch (apiErr: any) {
                            const msg = apiErr.message ? apiErr.message.toLowerCase() : '';
                            
                            if (msg.includes("limit") || msg.includes("429") || msg.includes("exceeded")) {
                                const waitTime = attempts * 120000;
                                addLog(`[LIMIT HIT] Пауза ${(waitTime/60000).toFixed(1)} хв (Спроба ${attempts}/5)...`);
                                let waited = 0;
                                while(waited < waitTime && isPhotoSyncingRef.current) {
                                    await new Promise(r => setTimeout(r, 1000));
                                    waited += 1000;
                                }
                            } else {
                                errorCount++;
                                const errTxt = apiErr.message || "Unknown";
                                addDetailedLog({ id: product.id, productId: String(idToSend), status: 'error', message: 'API Fail', details: errTxt.substring(0,50) });
                                success = true; // Skip
                            }
                        }
                    }
                    await new Promise(r => setTimeout(r, 3000));
                }
                
                if (errorCount > 0 || skippedCount > 0) {
                    addLog(`Пакет завершено. Пропущено: ${skippedCount}, Помилок: ${errorCount}`);
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
            onSyncStateChange(false);
        }
    };

    return (
        <div className="bg-zinc-800/50 p-3 rounded-2xl border border-zinc-700 mt-2">
            <h4 className="text-white font-bold mb-3 flex items-center gap-2 text-sm uppercase"><ImageIcon size={16} className="text-[#FFC300]"/> Фото Синхронізація</h4>
            
            {/* LOGS AND PROGRESS */}
            {(isPhotoSyncing || syncProgress.processed > 0 || syncLogs.length > 0) && (
                <div className="mb-4 space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-center bg-black/30 p-2 rounded-lg">
                        <div><div className="text-xl font-black text-white">{syncProgress.processed}</div><div className="text-[9px] text-zinc-500 uppercase">Оброблено</div></div>
                        <div><div className="text-xl font-black text-green-400">{syncProgress.updated}</div><div className="text-[9px] text-zinc-500 uppercase">Нових</div></div>
                        <div><div className="text-xl font-black text-blue-400">{syncProgress.total}</div><div className="text-[9px] text-zinc-500 uppercase">Всього</div></div>
                    </div>
                    
                    <div className="bg-black/50 rounded-lg p-2 font-mono text-[10px] text-zinc-400 h-24 overflow-y-auto border border-zinc-800">
                        {syncLogs.map((log, i) => <div key={i} className="border-b border-zinc-800/30 pb-0.5">{log}</div>)}
                    </div>

                    {detailedLogs.length > 0 && (
                        <div className="bg-zinc-950 rounded-lg border border-zinc-800 h-32 overflow-y-auto">
                            <table className="w-full text-left text-[9px] text-zinc-400">
                                <tbody>
                                    {detailedLogs.map((log, i) => (
                                        <tr key={i} className="border-b border-zinc-800/30">
                                            <td className="p-1 font-mono">{log.id}</td>
                                            <td className="p-1">
                                                {log.status === 'success' && <span className="text-green-500">OK</span>}
                                                {log.status === 'error' && <span className="text-red-500">ERR</span>}
                                                {log.status === 'skipped' && <span className="text-zinc-500">SKIP</span>}
                                            </td>
                                            <td className="p-1 truncate max-w-[100px]">{log.message}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {syncError && <div className="text-red-400 text-xs bg-red-900/20 p-2 rounded border border-red-900/50 flex items-center gap-2"><AlertTriangle size={14}/> {syncError}</div>}
                </div>
            )}

            {/* CONTROLS */}
            <div className="flex flex-col gap-3 mb-3">
                <div className="flex flex-wrap gap-2 px-3 py-2 bg-zinc-900/50 rounded-lg border border-zinc-800 justify-between">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" checked={forceOverwritePhotos} onChange={e => { setForceOverwritePhotos(e.target.checked); if(e.target.checked) setFixBrokenLinks(false); }} className="w-4 h-4 accent-[#FFC300]" />
                        <span className={`text-xs font-bold uppercase select-none transition-colors ${forceOverwritePhotos ? 'text-[#FFC300]' : 'text-zinc-500'}`}>Перезаписати всі</span>
                    </label>
                    
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" checked={skipOutOfStock} onChange={e => setSkipOutOfStock(e.target.checked)} className="w-4 h-4 accent-[#FFC300]" />
                        <span className={`text-xs font-bold uppercase select-none transition-colors ${skipOutOfStock ? 'text-white' : 'text-zinc-500'}`}>Тільки в наявності</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" checked={fixBrokenLinks} onChange={e => { setFixBrokenLinks(e.target.checked); if(e.target.checked) setForceOverwritePhotos(false); }} className="w-4 h-4 accent-blue-500" />
                        <span className={`text-xs font-bold uppercase select-none transition-colors ${fixBrokenLinks ? 'text-blue-400' : 'text-zinc-500'}`}>Тільки биті</span>
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
                    <StopCircle size={20} /> ЗУПИНИТИ
                </button>
            ) : (
                <button 
                    onClick={handleRunPhotoSync}
                    disabled={disabled}
                    className={`w-full py-4 rounded-xl font-black text-sm flex items-center justify-center gap-3 border transition-all active:scale-95 shadow-lg ${
                        disabled 
                        ? 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed' 
                        : 'bg-zinc-800 text-white border-zinc-600 hover:border-[#FFC300] hover:bg-zinc-700 hover:text-[#FFC300]'
                    }`}
                >
                    <ImageIcon size={20} />
                    {fixBrokenLinks ? `ВИПРАВИТИ БИТІ` : forceOverwritePhotos ? 'ПЕРЕЗАПИСАТИ ВСІ' : 'ЗАВАНТАЖИТИ НОВІ'}
                </button>
            )}
            <div className="text-center mt-2 text-[10px] text-zinc-500 font-mono">
                Ліміт API: ~20 фото/хв.
            </div>
        </div>
    );
};

export default PhotoSyncDashboard;
