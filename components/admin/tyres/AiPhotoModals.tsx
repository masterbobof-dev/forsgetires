import React from 'react';
import { Search, X, Save, Loader2, Sparkles, HelpCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import type { AiPhotoSearch } from './useAiPhotoSearch';

/** Photo search for one product: type a query, tick the pictures, save (the first one becomes the main photo). */
export const AiPhotoSearchModal: React.FC<{ ai: AiPhotoSearch }> = ({ ai }) => {
  const {
    setShowAiSearchModal, targetTyreForAi, aiSearchQuery, setAiSearchQuery, performAiSearch, isSearchingAi, aiSearchError,
    aiSearchResults, selectedAiUrls, toggleAiImage, handleSaveAiImages,
  } = ai;
  return (
    <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col shadow-3xl">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                <div>
                    <h3 className="text-xl font-black text-white flex items-center gap-3">
                        <Sparkles className="text-purple-500 animate-pulse" /> 
                        AI Пошук фото 🌠
                    </h3>
                    <p className="text-zinc-500 text-xs mt-1 truncate max-w-[300px]">{targetTyreForAi?.title}</p>
                </div>
                <button onClick={() => setShowAiSearchModal(false)} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500 hover:text-white"><X size={24}/></button>
            </div>

            <div className="p-4 bg-black/20 flex flex-col gap-3">
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={aiSearchQuery} 
                        onChange={e => setAiSearchQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && performAiSearch(aiSearchQuery)}
                        className="flex-grow bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-purple-500 outline-none"
                        placeholder="Назва для пошуку..."
                    />
                    <button 
                        onClick={() => performAiSearch(aiSearchQuery)}
                        disabled={isSearchingAi}
                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg"
                    >
                        {isSearchingAi ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>}
                        <span>Шукати</span>
                    </button>
                </div>
                {aiSearchError && (
                    <div className="flex items-center gap-2 text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg animate-in fade-in slide-in-from-top-1">
                        <AlertTriangle size={14}/>
                        <span className="text-[11px] font-bold uppercase tracking-tight">{aiSearchError}</span>
                    </div>
                )}
            </div>

            <div className="flex-grow overflow-y-auto p-4 max-h-[60vh] custom-scrollbar bg-black/40">
                {isSearchingAi ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                        <p className="text-zinc-500 font-bold animate-pulse text-sm">Нейромережа підбирає варіанти...</p>
                    </div>
                ) : aiSearchResults.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {aiSearchResults.map((img, idx) => {
                            const isSelected = selectedAiUrls.includes(img.imageUrl);
                            const selectIndex = selectedAiUrls.indexOf(img.imageUrl);
                            return (
                                <div 
                                    key={idx} 
                                    onClick={() => toggleAiImage(img.imageUrl)}
                                    className={`group relative aspect-square bg-black rounded-xl overflow-hidden cursor-pointer border-2 transition-all active:scale-95 ${isSelected ? 'border-purple-500 ring-4 ring-purple-500/20 shadow-2xl' : 'border-zinc-800 hover:border-zinc-600'}`}
                                >
                                    <img src={img.imageUrl} alt={`Result ${idx}`} className="w-full h-full object-contain p-1" />
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <p className="text-[10px] text-zinc-300 truncate">{img.title}</p>
                                    </div>
                                    {isSelected && (
                                        <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center backdrop-blur-[1px]">
                                            <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-black shadow-xl border-2 border-white/50 animate-in zoom-in-50">
                                                {selectIndex === 0 ? <CheckCircle size={16}/> : selectIndex + 1}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-600 gap-4">
                        <HelpCircle size={48} />
                        <p className="text-center font-medium">Результатів поки немає.<br/> Спробуйте змінити запит.</p>
                    </div>
                )}
            </div>

            <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex justify-between items-center sm:flex-row flex-col gap-4">
                <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                    <span className="text-[10px] text-zinc-500 uppercase font-black tracking-tighter">Обрано для галереї</span>
                    <span className="text-white text-sm font-bold">{selectedAiUrls.length} фото</span>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <button onClick={() => setShowAiSearchModal(false)} className="px-6 py-2.5 rounded-xl text-zinc-500 hover:text-white font-bold transition-colors flex-1 sm:flex-none">Скасувати</button>
                    <button 
                        onClick={handleSaveAiImages}
                        disabled={selectedAiUrls.length === 0}
                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-black px-8 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 flex-1 sm:flex-none"
                    >
                        <Save size={18}/>
                        <span>Зберегти {selectedAiUrls.length > 0 && selectedAiUrls.length}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

/** Progress of the photo search for the ticked products. */
export const BulkPhotoOverlay: React.FC<{ bulkPhotoProgress: number; bulkPhotoTotal: number }> = ({ bulkPhotoProgress, bulkPhotoTotal }) => (
  <div className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 text-center animate-in fade-in">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-700 p-8 rounded-3xl shadow-3xl">
          <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full"></div>
              <div 
                  className="absolute inset-0 border-4 border-t-purple-500 rounded-full animate-spin"
                  style={{ animationDuration: '1.5s' }}
              ></div>
              <Sparkles className="absolute inset-0 m-auto text-purple-500 animate-pulse" size={32} />
          </div>

          <h3 className="text-xl font-black text-white mb-2 uppercase tracking-wide">ШІ-Масова обробка</h3>
          <p className="text-zinc-500 text-sm mb-6 font-medium">Пошук та додавання фото для вибраних товарів...</p>

          <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden mb-3">
              <div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all duration-500"
                  style={{ width: `${(bulkPhotoProgress / bulkPhotoTotal) * 100}%` }}
              ></div>
          </div>

          <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest px-1">
              <span className="text-purple-400">Прогрес: {bulkPhotoProgress} / {bulkPhotoTotal}</span>
              <span className="text-zinc-500">{Math.round((bulkPhotoProgress / bulkPhotoTotal) * 100)}%</span>
          </div>

          <p className="mt-8 text-[9px] text-zinc-600 uppercase font-black italic">Будь ласка, не закривайте вкладку до завершення</p>
      </div>
  </div>
);

/** "The photo search key is not set" explanation. */
export const AiKeyHintOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-[700] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in zoom-in-95">
      <div className="max-w-md w-full bg-zinc-900 border-2 border-red-500/50 p-8 rounded-[2.5rem] shadow-[0_0_100px_rgba(239,68,68,0.2)] text-center">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
              <AlertTriangle className="text-red-500" size={40}/>
          </div>
          <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tight italic">Налаштування ШІ не завершене</h3>
          <p className="text-zinc-400 text-sm mb-8 leading-relaxed">Система каже, що у вас не вписано <b>Serper API Key</b> або не виконано SQL-запит до бази даних.</p>

          <div className="flex flex-col gap-3">
              <button 
                  onClick={() => {
                      onClose();
                      // Here we would ideally navigate to settings
                      alert("Будь ласка, перейдіть у вкладку 'API / Синхр.' або 'Налашт.' та вкажіть ключ Serper. Крім того, переконайтеся, що ви виконали SQL запит у Supabase.");
                  }}
                  className="w-full bg-white text-black font-black py-4 rounded-2xl hover:bg-zinc-200 transition-all active:scale-95 text-sm uppercase tracking-widest shadow-lg"
              >
                  Я РОЗУМІЮ
              </button>
              <button 
                  onClick={onClose}
                  className="w-full bg-zinc-800 text-zinc-500 font-bold py-3 rounded-2xl hover:text-white transition-colors"
              >
                  Закрити
              </button>
          </div>
      </div>
  </div>
);
