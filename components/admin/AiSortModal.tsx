import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Loader2, MessageSquare, AlertCircle, CheckCircle, Database, Send, Wrench, LayoutDashboard } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { TyreProduct } from '../../types';
import { generatePlainDescription, generateSeoBulkJson, normalizeProviderId } from '../../aiSeoClient';
import type { AIProviderId } from '../../aiTypes';
import { fetchAdminAiKeyStatus, hasProviderKey } from '../../aiProxyClient';

interface AiSortModalProps {
  onClose: () => void;
  onRefreshTyres: () => void;
}

const AiSortModal: React.FC<AiSortModalProps> = ({ onClose, onRefreshTyres }) => {
  const [tyres, setTyres] = useState<TyreProduct[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  
  const [problemTyres, setProblemTyres] = useState<TyreProduct[]>([]);
  const [isSorting, setIsSorting] = useState(false);
  const [sortProgress, setSortProgress] = useState({ current: 0, total: 0 });
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'assistant', text: string}[]>([
    { role: 'assistant', text: 'Привіт! Я ваш AI-асистент. Я бачу вашу базу шин і можу відповісти на питання по асортименту або допомогти відсортувати товари.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [aiProvider, setAiProvider] = useState<AIProviderId>('gemini');
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    const init = async () => {
      // 1. Get AI Settings
      const { data: setObj } = await supabase.from('settings').select('value').eq('key', 'ai_provider').maybeSingle();

      const p = normalizeProviderId(setObj?.value);
      setAiProvider(p);
      try {
        const s = await fetchAdminAiKeyStatus();
        setHasKey(hasProviderKey(s, p));
      } catch { setHasKey(false); }

      // 2. Fetch all required fields of Tyres to analyze
      const { data: allTyres } = await supabase.from('tyres').select('id, title, manufacturer, width, height, radius, season, vehicle_type');
      if (allTyres) {
        setTyres(allTyres);
        const problems = allTyres.filter(t => {
            const isMissing = !t.width || !t.height || !t.radius || !t.manufacturer;
            const isBadRadius = t.radius && !t.radius.startsWith('R');
            const isCargoUnmarked = t.title.toLowerCase().includes('c') && t.radius && t.radius.includes('C') && t.vehicle_type !== 'cargo';
            return isMissing || isBadRadius || isCargoUnmarked;
        });
        setProblemTyres(problems);
      }
      setLoadingInitial(false);
    };
    init();
  }, []);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !hasKey) return;
    const userText = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsChatting(true);

    try {
        const statsInfo = `Статистика бази: Всього шин: ${tyres.length}. Шини з проблемами заповнення характеристик: ${problemTyres.length}.`;
        const prompt = `Ти - експерт з шин та особистих асистент CRM магазину шин.
        Ось контекст: ${statsInfo}
        Користувач запитує: ${userText}
        Відповідай коротко і по суті українською мовою.`;

        const response = await generatePlainDescription({
            provider: aiProvider,
            prompt: prompt
        });

        setChatMessages(prev => [...prev, { role: 'assistant', text: response }]);
    } catch (e: any) {
        setChatMessages(prev => [...prev, { role: 'assistant', text: `❌ Помилка: ${e.message}` }]);
    } finally {
        setIsChatting(false);
    }
  };

  const startSorting = async (mode: 'all' | 'problems') => {
    if (!hasKey) {
        alert("Немає API ключа!");
        return;
    }
    
    const targets = mode === 'problems' ? problemTyres : tyres;
    if (targets.length === 0) {
        alert("Немає шин для сортування!");
        return;
    }

    if (!confirm(`Відправити ${targets.length} шин на AI сортування? Це може зайняти кілька хвилин.`)) return;

    setIsSorting(true);
    setSortProgress({ current: 0, total: targets.length });

    try {
        const systemPrompt = `Ти - професійний помічник зі складу шин. Твоє завдання: витягнути характеристики з назви шини.
Поверни JSON з масивом "results". Кожен об'єкт містить:
"id" (обов'язково!), "width" (напр "205"), "height" (напр "55"), "radius" (напр "R16"), 
"season" ("winter", "summer", "all-season"),
"vehicle_type" ("car", "cargo", "suv", "truck", "agro"), 
"manufacturer" (бренд).
Якщо тип авто не зрозумілий: якщо в радіусі є C — це cargo. Якщо 4x4 — suv.
Обов'язково повертай id який я тобі передаю.`;

        const CHUNK_SIZE = 50;
        for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
            const chunk = targets.slice(i, i + CHUNK_SIZE);
            const userPrompt = JSON.stringify(chunk.map(c => ({
                id: c.id, 
                title: c.title
            })));

            const data = await generateSeoBulkJson({
                provider: aiProvider,
                systemPrompt,
                userPrompt
            });

            if (data.results && Array.isArray(data.results)) {
                for (const item of data.results) {
                    if (!item.id) continue;
                    const updates = {
                        width: String(item.width ?? ''),
                        height: String(item.height ?? ''),
                        radius: String(item.radius ?? ''),
                        manufacturer: String(item.manufacturer ?? ''),
                        season: String(item.season ?? ''),
                        vehicle_type: String(item.vehicle_type ?? '')
                    };
                    await supabase.from('tyres').update(updates).eq('id', item.id);
                }
            }

            setSortProgress({ current: Math.min(i + CHUNK_SIZE, targets.length), total: targets.length });
            await new Promise(r => setTimeout(r, 4500));
        }

        alert("Сортування успішно завершено!");
        onRefreshTyres();
        onClose();
    } catch (err: any) {
        alert("Помилка при сортуванні: " + err.message);
    } finally {
        setIsSorting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl relative overflow-hidden animate-in zoom-in-95">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-zinc-800 bg-zinc-950/50">
                <div className="flex items-center gap-3">
                    <div className="bg-purple-900/40 p-2 rounded-xl text-purple-400">
                        <Sparkles size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-wider">AI Аналітика та Сортування</h2>
                        <p className="text-zinc-500 text-xs font-bold uppercase mt-1">Швидке виправлення характеристик та консультант</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white bg-zinc-800 hover:bg-red-600 rounded-xl transition-colors">
                    <X size={24} />
                </button>
            </div>

            {loadingInitial ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                    <Loader2 className="animate-spin mb-4" size={48} />
                    <p>Аналізуємо базу шин...</p>
                </div>
            ) : (
                <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
                    {/* Left Panel: Analytics & Sorting */}
                    <div className="md:w-1/2 p-6 overflow-y-auto border-r border-zinc-800 flex flex-col gap-6 custom-scrollbar bg-zinc-950/30">
                        <div className="p-4 border-b border-zinc-800 bg-zinc-950/20 mb-2">
                             <div className="flex items-center gap-2 text-white font-bold text-xs uppercase opacity-70">
                                <LayoutDashboard size={14} /> Аналіз поточного складу
                             </div>
                        </div>

                        <div className="flex flex-col gap-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black/50 border border-green-900/30 p-4 rounded-2xl flex flex-col justify-center items-center text-center">
                                    <div className="text-green-500 mb-2"><CheckCircle size={32} /></div>
                                    <div className="text-3xl font-black text-white">{tyres.length - problemTyres.length}</div>
                                    <div className="text-[10px] font-bold uppercase text-zinc-500 mt-1">Коректних шин</div>
                                </div>
                                <div className="bg-red-900/10 border border-red-900/30 p-4 rounded-2xl flex flex-col justify-center items-center text-center relative overflow-hidden">
                                    {problemTyres.length > 0 && <div className="absolute top-0 right-0 p-2"><AlertCircle size={16} className="text-red-500 animate-pulse" /></div>}
                                    <div className="text-red-400 mb-2"><Wrench size={32} /></div>
                                    <div className="text-3xl font-black text-red-500">{problemTyres.length}</div>
                                    <div className="text-[10px] font-bold uppercase text-red-400 mt-1">Потребують сортування</div>
                                </div>
                            </div>

                            <div className="bg-blue-900/10 border border-blue-900/30 rounded-2xl p-5 space-y-4">
                                <h3 className="text-white font-bold flex items-center gap-2"><Database size={18} className="text-blue-400"/> AI Сортування Бази</h3>
                                <p className="text-zinc-400 text-xs leading-relaxed">
                                    AI швидко просканує назви шин та витягне ширину, профіль, радіус, сезон і тип транспорту. Дані запишуться мінуючи SEO-описи для неймовірної швидкості.
                                </p>
                                
                                {isSorting ? (
                                    <div className="bg-black/40 p-4 rounded-xl space-y-2 border border-blue-900/30">
                                        <div className="flex justify-between text-xs font-bold text-blue-400 uppercase">
                                            <span>Аналіз та запис...</span>
                                            <span>{sortProgress.current} / {sortProgress.total}</span>
                                        </div>
                                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(sortProgress.current / sortProgress.total) * 100}%` }}></div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        <button 
                                            onClick={() => startSorting('problems')}
                                            disabled={problemTyres.length === 0 || !hasKey}
                                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white p-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                                        >
                                            <Sparkles size={18} />
                                            Сортувати ТІЛЬКИ проблемні ({problemTyres.length})
                                        </button>
                                        <button 
                                            onClick={() => startSorting('all')}
                                            disabled={!hasKey || tyres.length === 0}
                                            className="w-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white p-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border border-zinc-700"
                                        >
                                            Пересортувати абсолютно всі ({tyres.length})
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: AI Chat */}
                    <div className="md:w-1/2 flex flex-col h-full bg-zinc-900 relative">
                        <div className="p-4 border-b border-zinc-800 flex items-center gap-2 bg-zinc-950/20">
                            <MessageSquare size={18} className="text-purple-400" />
                            <span className="font-bold text-white uppercase text-xs">Чат з Асистентом</span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {chatMessages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-2xl p-4 text-sm whitespace-pre-wrap ${
                                        msg.role === 'user' 
                                            ? 'bg-purple-600 text-white rounded-br-none' 
                                            : 'bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-bl-none'
                                    }`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            {isChatting && (
                                <div className="flex justify-start">
                                    <div className="bg-zinc-800 rounded-2xl rounded-bl-none p-4 w-16 flex items-center justify-center">
                                        <div className="flex gap-1">
                                            <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        <div className="p-4 border-t border-zinc-800 bg-zinc-950/20">
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Задайте питання (напр. Як додати шину?)..."
                                    className="w-full bg-black border border-zinc-700 rounded-xl pr-12 pl-4 py-3 text-white focus:border-purple-500 outline-none placeholder-zinc-500 text-sm"
                                    disabled={!hasKey || isChatting}
                                />
                                <button 
                                    onClick={handleSendMessage}
                                    disabled={!hasKey || isChatting || !chatInput.trim()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 text-white rounded-lg transition-colors"
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default AiSortModal;
