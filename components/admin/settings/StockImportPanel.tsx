import React from 'react';
import { LayoutGrid, Wand2, Upload, Loader2, CheckCircle } from 'lucide-react';
import type { SmartPhotoUpload } from './useSmartPhotoUpload';

/** Part "Склад / Імпорт": photos for goods by the name of the file. */
const StockImportPanel: React.FC<{ smart: SmartPhotoUpload }> = ({ smart }) => {
  const {
    smartInputRef, smartFiles, setSmartFiles, smartOverwrite, setSmartOverwrite, smartExactMatch, setSmartExactMatch, handleSmartUpload, isSmartMatching, smartStatus,
  } = smart;

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4">
        <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2 pb-4 border-b border-zinc-800"><LayoutGrid className="text-[#FFC300]" size={20}/> Керування Складом та Імпортом</h4>

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
  );
};

export default StockImportPanel;
