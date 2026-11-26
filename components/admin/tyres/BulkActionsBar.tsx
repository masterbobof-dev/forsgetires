import React from 'react';
import { X, Loader2, Sparkles, RefreshCw, Flame, Settings, ArrowRight, Image as ImageIcon, Trash2 } from 'lucide-react';
import type { ProductCategory } from '../../../categories';
import type { TyresList } from './useTyresList';
import type { BulkActions } from './useBulkActions';

interface BulkActionsBarProps {
  list: TyresList;
  bulk: BulkActions;
  dbReady: boolean;
  categoryOptions: { cat: ProductCategory; label: string }[];
}

/** The bar shown while some products are ticked: move to a section, AI photos, hits, delete. */
const BulkActionsBar: React.FC<BulkActionsBarProps> = ({ list, bulk, dbReady, categoryOptions }) => {
  const { selectedTyreIds, setSelectedTyreIds } = list;
  const {
    bulkCategory, handleBulkCategoryUpdate, handleBulkAiSearch, handleBulkDeletePhotos,
    bulkMarkup, setBulkMarkup, handleBulkPriceUpdate, handleBulkHotUpdate, handleBulkDelete, isApplyingBulk,
  } = bulk;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:relative md:bottom-auto md:left-auto md:right-auto z-[90] md:z-0 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-zinc-900/95 backdrop-blur-md border border-[#FFC300]/30 md:border-zinc-700 rounded-2xl p-3 shadow-2xl overflow-hidden">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="flex items-center justify-between w-full md:w-auto gap-4">
                    <div className="text-zinc-400 font-bold text-[10px] uppercase flex items-center gap-2">
                        <Settings size={14} className="text-[#FFC300]" /> <span>Масове управління</span>
                        <span className="text-[10px] text-white bg-zinc-700 px-2 py-0.5 rounded-full">обрано: {selectedTyreIds.size}</span>
                    </div>
                    <button onClick={() => setSelectedTyreIds(new Set())} className="md:hidden text-zinc-500 hover:text-white"><X size={18}/></button>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                    <div className="border-r border-zinc-700 pr-2">
                        <select 
                            value={bulkCategory}
                            onChange={(e) => handleBulkCategoryUpdate(e.target.value)}
                            className="bg-black border border-zinc-700 rounded-lg p-2 text-white text-[10px] font-bold w-40 outline-none focus:border-[#FFC300]"
                        >
                            <option value="">Перенести в категорію...</option>
                            {dbReady ? categoryOptions.map(({ cat, label }) => <option key={cat.id} value={`cat:${cat.id}`}>{label}</option>) : <>
                            <option value="car">Легкова</option>
                            <option value="suv">SUV</option>
                            <option value="cargo">Вантажна C</option>
                            <option value="truck">TIR</option>
                            <option value="agro">Агро</option>
                            </>}
                        </select>
                    </div>

                    <div className="flex gap-1.5 border-r border-zinc-700 pr-2">
                        <button 
                            onClick={() => handleBulkAiSearch(true)} 
                            className="p-2 bg-purple-900/30 hover:bg-purple-600 border border-purple-500/30 text-purple-200 rounded-lg text-[9px] font-black flex items-center gap-1.5"
                            title="Тільки де немає фото"
                        >
                            <Sparkles size={14}/> ШІ НОВІ
                        </button>
                        <button 
                            onClick={() => handleBulkAiSearch(false)} 
                            className="p-2 bg-zinc-800 hover:bg-purple-600 border border-zinc-700 text-zinc-300 rounded-lg text-[9px] font-black flex items-center gap-1.5"
                            title="Замінити наявні через ШІ"
                        >
                            <RefreshCw size={14}/> ШІ ЗАМІНА
                        </button>
                        <button 
                            onClick={handleBulkDeletePhotos} 
                            className="p-2 bg-zinc-800 hover:bg-red-600 border border-zinc-700 text-zinc-400 rounded-lg text-[9px] font-black flex items-center gap-1.5"
                            title="Видалити фото"
                        >
                            <ImageIcon size={14}/> ОЧИСТИТИ
                        </button>
                    </div>

                    <div className="flex items-center gap-1.5 flex-grow md:flex-none">
                        <input type="text" value={bulkMarkup} onChange={e => setBulkMarkup(e.target.value)} placeholder="%" className="w-12 h-9 p-0 rounded-lg bg-black border border-zinc-700 text-white text-center font-bold text-xs outline-none focus:border-[#FFC300]" />
                        <button onClick={() => handleBulkPriceUpdate(1)} className="flex-grow md:flex-none h-9 bg-green-900/30 text-green-400 px-3 rounded-lg font-bold border border-green-800/50 hover:bg-green-800/50 flex items-center justify-center gap-1 transition-colors text-[10px] uppercase"><ArrowRight size={12} className="-rotate-45"/> Ціна</button>
                        <button onClick={() => handleBulkPriceUpdate(-1)} className="flex-grow md:flex-none h-9 bg-red-900/30 text-red-400 px-3 rounded-lg font-bold border border-red-800/50 hover:bg-red-800/50 flex items-center justify-center gap-1 transition-colors text-[10px] uppercase"><ArrowRight size={12} className="rotate-45"/> Ціна</button>
                    </div>

                    <div className="flex items-center gap-1.5 w-full md:w-auto">
                        <button onClick={() => handleBulkHotUpdate('add')} className="flex-1 md:flex-none h-9 bg-orange-900/30 text-orange-400 px-3 rounded-lg font-bold border border-orange-800/50 hover:bg-orange-800/50 flex items-center justify-center gap-1 transition-colors text-[10px] uppercase"><Flame size={12} /> HOT</button>
                        <button onClick={handleBulkDelete} disabled={isApplyingBulk} className="flex-1 md:flex-none h-9 bg-red-600/20 text-red-500 px-3 rounded-lg font-bold hover:bg-red-600 hover:text-white border border-red-900/30 flex items-center justify-center gap-1 transition-colors text-[10px] uppercase">
                            {isApplyingBulk ? <Loader2 className="animate-spin text-red-500" size={14}/> : <Trash2 size={12} />} 
                            Видалити
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default BulkActionsBar;
