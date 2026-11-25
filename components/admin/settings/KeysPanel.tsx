import React from 'react';
import { Shield, Crown, Truck, KeyRound, Sparkles, Eye, EyeOff, Globe } from 'lucide-react';
import type { AIProviderId } from '../../../aiSeoClient';
import type { SettingsForm } from './useSettingsForm';

/** Part "API Ключі / AI": the owner's e-mail, delivery and supplier keys, the AI provider and its keys. */
const KeysPanel: React.FC<{ form: SettingsForm }> = ({ form }) => {
  const {
    adminEmail, setAdminEmail, novaPoshtaKey, setNovaPoshtaKey, supplierKey, setSupplierKey, aiProvider, setAiProvider, geminiKey, setGeminiKey, showGeminiKey, setShowGeminiKey, hasKeyGemini, openaiKey, setOpenaiKey, showOpenaiKey, setShowOpenaiKey, hasKeyOpenai, openaiModel, setOpenaiModel, customKey, setCustomKey, showCustomKey, setShowCustomKey, hasKeyCustom, customBaseUrl, setCustomBaseUrl, customModel, setCustomModel, groqKey, setGroqKey, showGroqKey, setShowGroqKey, hasKeyGroq, serperKey, setSerperKey, showSerperKey, setShowSerperKey, hasKeySerper,
  } = form;

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4">
        <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2 pb-4 border-b border-zinc-800"><Shield className="text-[#FFC300]" size={20}/> Безпека та Ключі</h4>
        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
             <label className="block text-[#FFC300] text-xs font-bold uppercase mb-2 flex items-center gap-2"><Crown size={16}/> Email Власника (Головний Адмін)</label>
             <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white font-bold" placeholder="admin@forsage.com"/>
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
             <div className="md:col-span-2 bg-zinc-950/80 p-4 rounded-xl border border-zinc-800 space-y-4">
                 <label className="block text-[#FFC300] text-xs font-bold uppercase mb-1 flex items-center gap-2"><Sparkles size={14}/> Провайдер AI за замовчуванням</label>
                 <p className="text-[11px] text-zinc-500 mb-2">
                   Використовується в AI помічнику та масовій генерації. Ключі після збереження зберігаються на сервері (таблиця{' '}
                   <code className="text-zinc-400">ai_api_keys</code>, без читання з браузера) і підхоплюються функцією{' '}
                   <code className="text-zinc-400">ai-proxy</code>.
                 </p>
                 <select
                     value={aiProvider}
                     onChange={e => setAiProvider(e.target.value as AIProviderId)}
                     className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-bold text-sm"
                 >
                     <option value="gemini">Google Gemini</option>
                     <option value="openai">OpenAI (ChatGPT Oficial)</option>
                     <option value="groq">Groq (швидкі моделі Llama тощо)</option>
                     <option value="custom">Custom AI (Zenmux / Будь-який провайдер)</option>
                 </select>
             </div>

             <div className="md:col-span-2 bg-purple-900/10 p-4 rounded-xl border border-purple-900/30">
                 <label className="block text-purple-300 text-xs font-bold uppercase mb-2 flex items-center gap-2"><Sparkles size={14}/> Google Gemini API Key</label>
                 <div className="relative">
                     <input 
                         type={showGeminiKey ? "text" : "password"} 
                         value={geminiKey} 
                         onChange={e => setGeminiKey(e.target.value)} 
                         className="w-full bg-black border border-zinc-700 rounded-lg p-3 pr-10 text-white font-mono text-sm mb-1 focus:border-purple-500 outline-none" 
                         placeholder="AIza..."
                     />
                     <button 
                         type="button"
                         onClick={() => setShowGeminiKey(!showGeminiKey)} 
                         className="absolute right-3 top-3 text-zinc-500 hover:text-white"
                         title={showGeminiKey ? "Приховати" : "Показати"}
                     >
                         {showGeminiKey ? <EyeOff size={18}/> : <Eye size={18}/>}
                     </button>
                 </div>
                 <p className="text-[10px] text-zinc-400 mt-2">
                     <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline font-bold">aistudio.google.com</a>
                 </p>
                 {hasKeyGemini && (
                   <p className="text-[10px] text-emerald-500 font-bold mt-1">Ключ збережено на сервері. Введіть новий лише щоб замінити.</p>
                 )}
             </div>

             <div className="md:col-span-2 bg-emerald-900/10 p-4 rounded-xl border border-emerald-900/30">
                 <label className="block text-emerald-300 text-xs font-bold uppercase mb-2 flex items-center gap-2"><KeyRound size={14}/> OpenAI API Key (sk-...)</label>
                 <div className="relative">
                     <input 
                         type={showOpenaiKey ? "text" : "password"} 
                         value={openaiKey} 
                         onChange={e => setOpenaiKey(e.target.value)} 
                         className="w-full bg-black border border-zinc-700 rounded-lg p-3 pr-10 text-white font-mono text-sm mb-1 focus:border-emerald-500 outline-none" 
                         placeholder="sk-..."
                     />
                     <button 
                         type="button"
                         onClick={() => setShowOpenaiKey(!showOpenaiKey)} 
                         className="absolute right-3 top-3 text-zinc-500 hover:text-white"
                         title={showOpenaiKey ? "Приховати" : "Показати"}
                     >
                         {showOpenaiKey ? <EyeOff size={18}/> : <Eye size={18}/>}
                     </button>
                 </div>
                 <p className="text-[10px] text-zinc-400 mt-2 mb-3">Офіційний ключ: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-bold">platform.openai.com</a></p>

                 <label className="block text-zinc-500 text-[10px] font-bold uppercase mb-1 flex items-center gap-2">Вибір офіційної моделі OpenAI</label>
                 <select 
                     value={['gpt-5.4-pro', 'gpt-5.4-mini', 'gpt-5.3-instant', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'o1-mini'].includes(openaiModel) ? openaiModel : 'custom'} 
                     onChange={e => {
                         if (e.target.value !== 'custom') setOpenaiModel(e.target.value);
                     }} 
                     className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-zinc-300 font-mono text-xs focus:border-emerald-500 outline-none mb-2"
                 >
                     <option value="gpt-5.4-pro">gpt-5.4-pro (Найновіша та найпотужніша 🔥)</option>
                     <option value="gpt-5.4-mini">gpt-5.4-mini (Швидка та розумна v5.4)</option>
                     <option value="gpt-5.3-instant">gpt-5.3-instant (Оптимізована v5.3)</option>
                     <option value="gpt-4o">gpt-4o (Стабільна флагманська)</option>
                     <option value="gpt-4o-mini">gpt-4o-mini (Економна)</option>
                     <option value="o1-mini">o1-mini (Для складних задач)</option>
                     <option value="custom">-- Власна модель (введіть нижче) --</option>
                 </select>

                 <label className="block text-zinc-600 text-[9px] font-bold uppercase mb-1">ID моделі (ID з сайту OpenAI)</label>
                 <input 
                     type="text" 
                     value={openaiModel} 
                     onChange={e => setOpenaiModel(e.target.value)} 
                     className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-zinc-300 font-mono text-xs focus:border-emerald-500 outline-none" 
                     placeholder="Наприклад: gpt-5.3-instant"
                 />

                 {hasKeyOpenai && (
                   <p className="text-[10px] text-emerald-500 font-bold mt-2">Офіційний ключ збережено на сервері.</p>
                 )}
             </div>

             <div className="md:col-span-2 bg-blue-900/10 p-4 rounded-xl border border-blue-900/30 line-dashed">
                 <label className="block text-blue-300 text-xs font-bold uppercase mb-2 flex items-center gap-2"><Globe size={14}/> Custom AI Провайдер (Zenmux, OpenRouter тощо)</label>

                 <div className="relative mb-3">
                     <label className="block text-zinc-500 text-[10px] font-bold uppercase mb-1">API Key провайдера</label>
                     <input 
                         type={showCustomKey ? "text" : "password"} 
                         value={customKey} 
                         onChange={e => setCustomKey(e.target.value)} 
                         className="w-full bg-black border border-zinc-700 rounded-lg p-3 pr-10 text-white font-mono text-sm focus:border-blue-500 outline-none" 
                         placeholder="Ключ доступу..."
                     />
                     <button 
                         type="button"
                         onClick={() => setShowCustomKey(!showCustomKey)} 
                         className="absolute right-3 top-8 text-zinc-500 hover:text-white"
                         title={showCustomKey ? "Приховати" : "Показати"}
                     >
                         {showCustomKey ? <EyeOff size={18}/> : <Eye size={18}/>}
                     </button>
                     {hasKeyCustom && (
                       <p className="text-[10px] text-emerald-500 font-bold mt-1">Ключ збережено на сервері.</p>
                     )}
                 </div>

                 <div className="mb-3">
                     <label className="block text-zinc-500 text-[10px] font-bold uppercase mb-1">Base URL (Посилання на сервер)</label>
                     <input 
                         type="text" 
                         value={customBaseUrl} 
                         onChange={e => setCustomBaseUrl(e.target.value)} 
                         className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-zinc-300 font-mono text-sm focus:border-blue-500 outline-none" 
                         placeholder="https://api.zenmux.ai/v1"
                     />
                 </div>

                 <div>
                     <label className="block text-zinc-500 text-[10px] font-bold uppercase mb-1">Model ID (Назва моделі)</label>
                     <input 
                         type="text" 
                         value={customModel} 
                         onChange={e => setCustomModel(e.target.value)} 
                         className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-zinc-300 font-mono text-sm focus:border-blue-500 outline-none" 
                         placeholder="Наприклад: kuaishou/kat-coder-pro-v1-free"
                     />
                 </div>
             </div>

             <div className="md:col-span-2 bg-orange-900/10 p-4 rounded-xl border border-orange-900/30">
                 <label className="block text-orange-300 text-xs font-bold uppercase mb-2 flex items-center gap-2"><KeyRound size={14}/> Groq API Key</label>
                 <div className="relative">
                     <input 
                         type={showGroqKey ? "text" : "password"} 
                         value={groqKey} 
                         onChange={e => setGroqKey(e.target.value)} 
                         className="w-full bg-black border border-zinc-700 rounded-lg p-3 pr-10 text-white font-mono text-sm mb-1 focus:border-orange-500 outline-none" 
                         placeholder="gsk_..."
                     />
                     <button 
                         type="button"
                         onClick={() => setShowGroqKey(!showGroqKey)} 
                         className="absolute right-3 top-3 text-zinc-500 hover:text-white"
                         title={showGroqKey ? "Приховати" : "Показати"}
                     >
                         {showGroqKey ? <EyeOff size={18}/> : <Eye size={18}/>}
                     </button>
                 </div>
                 <p className="text-[10px] text-zinc-400 mt-2">Модель: llama-3.3-70b-versatile. Безкоштовний рівень: <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-bold">console.groq.com</a></p>
                 {hasKeyGroq && (
                   <p className="text-[10px] text-emerald-500 font-bold mt-1">Ключ збережено на сервері.</p>
                 )}
             </div>

             <div className="md:col-span-2 bg-[#FFC300]/5 p-4 rounded-xl border border-[#FFC300]/20">
                 <label className="block text-[#FFC300] text-xs font-bold uppercase mb-2 flex items-center gap-2"><Sparkles size={14}/> Serper.dev API Key (Google Images Search)</label>
                 <div className="relative">
                     <input 
                         type={showSerperKey ? "text" : "password"} 
                         value={serperKey} 
                         onChange={e => setSerperKey(e.target.value)} 
                         className="w-full bg-black border border-zinc-700 rounded-lg p-3 pr-10 text-white font-mono text-sm mb-1 focus:border-[#FFC300] outline-none" 
                         placeholder="Ваш Serper API Key..."
                     />
                     <button 
                         type="button"
                         onClick={() => setShowSerperKey(!showSerperKey)} 
                         className="absolute right-3 top-3 text-zinc-500 hover:text-white"
                         title={showSerperKey ? "Приховати" : "Показати"}
                     >
                         {showSerperKey ? <EyeOff size={18}/> : <Eye size={18}/>}
                     </button>
                 </div>
                 <p className="text-[10px] text-zinc-400 mt-2">
                     Отримати безкоштовно (2500 запитів): <a href="https://serper.dev" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-bold">serper.dev</a>
                 </p>
                 {hasKeySerper && (
                   <p className="text-[10px] text-emerald-500 font-bold mt-1">Ключ пошуку збережено на сервері.</p>
                 )}
             </div>
        </div>
    </div>
  );
};

export default KeysPanel;
