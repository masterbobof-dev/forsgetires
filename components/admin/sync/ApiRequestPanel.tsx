
import React, { useState, useEffect } from 'react';
import { Play, Loader2, Code, Save, Trash2, RotateCcw } from 'lucide-react';
import { supabase } from '../../../supabaseClient';

interface ApiRequestPanelProps {
    onResponse: (data: any, status: number, config: any) => void;
    storageKey?: string;
    defaultConfig?: any;
    title?: string;
    description?: string;
}

const DEFAULT_PRODUCT_CONFIG = {
    method: 'POST',
    url: 'https://public.omega.page/public/api/v1.0/searchcatalog/getTires',
    headers: '{\n  "Content-Type": "application/json"\n}',
    body: JSON.stringify({
      "IsSale": 0,
      "Rest": 0,
      "Manufacturers": [],
      "DiameterList": [],
      "FrameSizeList": [],
      "WidthList": [],
      "AxisTypeList": [],
      "SeasonList": [],
      "UsageList": [],
      "From": 0,
      "Count": 100,
      "FormFactor": 0,
      "Key": "LYA37jgXHEJy9EOY7fkkIIs5Mg75aueD"
    }, null, 2)
};

const ApiRequestPanel: React.FC<ApiRequestPanelProps> = ({ 
    onResponse, 
    storageKey = 'forsage_sync_config', 
    defaultConfig = DEFAULT_PRODUCT_CONFIG,
    title = "Налаштування Запиту",
    description = "Зробіть запит, щоб перевірити дані."
}) => {
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState(defaultConfig);

    // Load from LocalStorage on mount or key change
    useEffect(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const merged = { ...defaultConfig, ...parsed };
                
                if (!merged.url || merged.url.trim() === '') merged.url = defaultConfig.url;
                if ((!merged.body || merged.body.trim() === '') && merged.method !== 'GET') merged.body = defaultConfig.body;
                if (!merged.headers || merged.headers.trim() === '') merged.headers = defaultConfig.headers;

                setConfig(merged);
            } catch (e) {
                console.error("Failed to load saved config, using defaults");
                setConfig(defaultConfig);
            }
        } else {
            setConfig(defaultConfig);
        }
    }, [storageKey]);

    // Save to LocalStorage whenever config changes
    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(config));
    }, [config, storageKey]);

    const handleExecute = async () => {
        if (!config.url) { alert("Введіть URL"); return; }
        setLoading(true);

        try {
            // Parse JSON inputs
            let headers = {};
            let requestBody = null;
            try { headers = JSON.parse(config.headers); } catch (e) { alert("Помилка в JSON Заголовків"); setLoading(false); return; }
            
            if (config.method !== 'GET') {
                try { requestBody = JSON.parse(config.body); } catch (e) { alert("Помилка в JSON Тіла запиту"); setLoading(false); return; }
            }

            // Use Supabase Edge Function 'super-endpoint'
            const { data: result, error } = await supabase.functions.invoke('super-endpoint', {
                body: {
                    url: config.url,
                    method: config.method,
                    headers: headers,
                    body: requestBody
                }
            });

            if (error) throw new Error(error.message);
            if (!result) throw new Error("Empty response");

            const responseData = result.data !== undefined ? result.data : result;
            
            onResponse(responseData, result.status || 200, {
                url: config.url,
                method: config.method,
                headers: headers,
                body: requestBody
            });

        } catch (e: any) {
            const msg = e.message || (typeof e === 'string' ? e : 'Unknown network error');
            alert("Помилка запиту: " + msg);
            onResponse(null, 0, null);
        } finally {
            setLoading(false);
        }
    };

    const resetToDefaults = () => {
        if(confirm("Завантажити стандартні налаштування?")) {
            setConfig(defaultConfig);
        }
    };

    const clearConfig = () => {
        if(confirm("Очистити всі поля?")) {
            setConfig({
                method: 'GET',
                url: '',
                headers: '{\n  "Content-Type": "application/json"\n}',
                body: ''
            });
        }
    };

    return (
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h4 className="text-white font-bold flex items-center gap-2"><Code size={18}/> {title}</h4>
                <div className="flex gap-2">
                    <button 
                        onClick={resetToDefaults} 
                        className="text-xs bg-blue-900/30 text-blue-300 px-3 py-1.5 rounded border border-blue-900/50 hover:bg-blue-900/50 flex items-center gap-1 font-bold"
                        title="Відновити замовчування"
                    >
                        <RotateCcw size={14}/> Reset
                    </button>
                    <button onClick={clearConfig} className="text-zinc-500 hover:text-red-500 p-1.5 rounded hover:bg-zinc-800" title="Очистити"><Trash2 size={16}/></button>
                </div>
            </div>
            
            <div className="space-y-4 flex-grow overflow-y-auto pr-2 custom-scrollbar">
                <div className="flex gap-2">
                    <select 
                        value={config.method} 
                        onChange={(e) => setConfig({...config, method: e.target.value})}
                        className="bg-black border border-zinc-700 rounded-lg p-3 text-white font-bold w-24 flex-shrink-0"
                    >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                    </select>
                    <input 
                        type="text" 
                        value={config.url} 
                        onChange={(e) => setConfig({...config, url: e.target.value})}
                        placeholder="https://api.example.com..."
                        className="flex-grow bg-black border border-zinc-700 rounded-lg p-3 text-white font-mono text-sm"
                    />
                </div>

                <div>
                    <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Заголовки (JSON)</label>
                    <textarea 
                        value={config.headers}
                        onChange={(e) => setConfig({...config, headers: e.target.value})}
                        className="w-full h-24 bg-black border border-zinc-700 rounded-lg p-3 text-green-400 font-mono text-xs focus:border-[#FFC300] outline-none"
                    />
                </div>

                {config.method !== 'GET' && (
                    <div>
                        <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Тіло запиту (Body JSON)</label>
                        <textarea 
                            value={config.body}
                            onChange={(e) => setConfig({...config, body: e.target.value})}
                            className="w-full h-48 bg-black border border-zinc-700 rounded-lg p-3 text-blue-300 font-mono text-xs focus:border-[#FFC300] outline-none"
                        />
                    </div>
                )}
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-800">
                <button 
                    onClick={handleExecute} 
                    disabled={loading}
                    className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <Play size={20} />}
                    ТЕСТ ЗАПИТУ
                </button>
                <p className="text-center text-[10px] text-zinc-500 mt-2">{description}</p>
            </div>
        </div>
    );
};

export default ApiRequestPanel;
