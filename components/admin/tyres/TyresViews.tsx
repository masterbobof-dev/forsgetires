import React from 'react';
import { Sparkles, CheckSquare, Edit2, Car, Truck, Mountain, Flame, ArrowRight, Copy, Image as ImageIcon, Trash2, CheckCircle, Tractor, CircleDot, ShoppingCart } from 'lucide-react';
import type { TyreProduct } from '../../../types';
import type { TyresList } from './useTyresList';
import type { RowActions } from './useRowActions';
import { isProductReady } from './tyreAdminUtils';

interface TyresViewProps {
  list: TyresList;
  row: RowActions;
  onEdit: (t: TyreProduct) => void;
  onAiSearch: (t: TyreProduct) => void;
  setSuccessMessage: (msg: string) => void;
}

/** the icon keeps the `title` attribute it always had (lucide's types do not list it) */
const READY_TITLE = { title: 'Товар повністю готовий' } as object;

/** Phones: the list as compact cards. */
export const TyresMobileList: React.FC<TyresViewProps> = ({ list, row, onEdit, setSuccessMessage }) => {
  const { tyres, selectedTyreIds, toggleSelection } = list;
  const { setTyreToDelete, setShowDeleteModal } = row;
  const openEditTyreModal = onEdit;
  return (
    <div className="md:hidden space-y-2">
        {tyres.map(tyre => {
            const isSelected = selectedTyreIds.has(tyre.id);
            const isOutOfStock = tyre.in_stock === false;
            return (
                <div key={tyre.id} className={`bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 flex gap-3 relative transition-all ${isSelected ? 'ring-2 ring-[#FFC300] bg-[#FFC300]/5' : ''} ${isOutOfStock ? 'opacity-70' : ''}`}>
                    <div className="w-16 h-16 bg-black rounded-lg border border-zinc-800 flex-shrink-0 relative overflow-hidden cursor-pointer shadow-inner" onClick={() => openEditTyreModal(tyre)}>
                        {tyre.image_url ? (
                            <img src={tyre.image_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-800"><ImageIcon size={20}/></div>
                        )}
                        {isOutOfStock && <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center"><span className="text-[7px] font-black bg-red-600 text-white px-1 rounded uppercase">Немає</span></div>}
                    </div>
                    <div className="flex-grow min-w-0 flex flex-col justify-between py-0.5">
                        <div className="cursor-pointer" onClick={() => openEditTyreModal(tyre)}>
                            <div className="flex justify-between items-start gap-2 mb-0.5">
                                <div className="flex items-center gap-1 min-w-0">
                                    <span className="text-[9px] text-zinc-500 font-black uppercase truncate tracking-wider">{tyre.manufacturer || 'Товар'}</span>
                                    {isProductReady(tyre) && <CheckCircle size={10} className="text-green-500 flex-shrink-0" />}
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); toggleSelection(tyre.id); }} className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${isSelected ? 'bg-[#FFC300] border-[#FFC300] text-black scale-110 shadow-lg shadow-yellow-900/20' : 'border-zinc-700 bg-black/40'}`}>
                                    {isSelected && <CheckSquare size={12}/>}
                                </button>
                            </div>
                            <h4 onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(tyre.title); setSuccessMessage('Назву скопійовано'); setTimeout(() => setSuccessMessage(''), 1500); }}
                              className="text-[12px] font-bold text-white line-clamp-2 mb-1 leading-tight active:text-[#FFC300]" title="Натисніть, щоб скопіювати назву">{tyre.title} <Copy size={10} className="inline text-zinc-600" /></h4>
                            {(tyre.catalog_number || tyre.product_number) && (
                              <p className="text-[10px] text-zinc-500 font-mono truncate mb-1">{tyre.catalog_number && <>Арт: {tyre.catalog_number}</>}{tyre.catalog_number && tyre.product_number && ' · '}{tyre.product_number && <>▮▮ {tyre.product_number}</>}</p>
                            )}
                            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[10px]">
                                <span className="text-[#FFC300] font-black">{tyre.price} грн</span>
                                <span className="text-zinc-600">/</span>
                                <span className="text-zinc-400 font-medium">{tyre.radius}</span>
                                {tyre.stock_quantity !== undefined && (
                                    <>
                                        <span className="text-zinc-600">/</span>
                                        <span className={`font-black ${parseInt(String(tyre.stock_quantity)) < 4 ? 'text-red-500' : 'text-zinc-500'}`}>
                                            {tyre.stock_quantity} шт
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="mt-2 flex gap-1.5">
                            <button 
                                onClick={() => {
                                    const msg = `Нове замовлення: ${tyre.title} (${tyre.price} грн)`;
                                    navigator.clipboard.writeText(msg);
                                    setSuccessMessage("Дані копійовано!");
                                    setTimeout(() => setSuccessMessage(''), 2000);
                                }} 
                                className="h-8 w-8 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg text-blue-400 shrink-0 border border-zinc-700/50" 
                            >
                                <ShoppingCart size={14}/>
                            </button>
                            <button onClick={() => openEditTyreModal(tyre)} className="flex-grow h-8 bg-[#FFC300] text-black text-[10px] font-black rounded-lg uppercase tracking-wider flex items-center justify-center gap-1 active:scale-95 transition-transform shadow-md shadow-yellow-900/10">
                                <Edit2 size={12}/> Редагувати
                            </button>
                            <button onClick={() => { setTyreToDelete(tyre.id); setShowDeleteModal(true); }} className="h-8 w-8 flex items-center justify-center bg-zinc-800/50 text-red-500 rounded-lg border border-red-900/10 active:bg-red-900/20 shrink-0">
                                <Trash2 size={14}/>
                            </button>
                        </div>
                    </div>
                </div>
            );
        })}
    </div>
  );
};

/** Computers: the list as a table with quick edits of price, stock and "hit". */
export const TyresTable: React.FC<TyresViewProps> = ({ list, row, onEdit, onAiSearch, setSuccessMessage }) => {
  const { tyres, selectedTyreIds, toggleSelection, handleSelectAllOnPage, suppliers } = list;
  const {
    editingPriceId, setEditingPriceId, editingStockId, setEditingStockId, inlineValue, setInlineValue, handleInlineUpdate,
    handleQuickHotToggle, handleCopyTitle, handleShareProduct, setTyreToDelete, setShowDeleteModal,
  } = row;
  const openEditTyreModal = onEdit, handleOpenAiSearch = onAiSearch;
  return (
    <div className="hidden md:block bg-black border border-zinc-800 rounded-xl overflow-hidden shadow-xl overflow-x-auto no-scrollbar">
        <div className="min-w-[1030px]">
            {/* Header */}
            <div className="grid grid-cols-[40px_100px_120px_40px_50px_80px_100px_minmax(0,1fr)_50px_80px_60px_150px] gap-2 p-3 bg-black border-b border-zinc-800 text-zinc-500 text-xs font-bold uppercase items-center sticky top-0 z-20">
                <div className="flex justify-center">
                    <button onClick={handleSelectAllOnPage} className={`w-5 h-5 rounded border flex items-center justify-center ${tyres.every(t => selectedTyreIds.has(t.id)) ? 'bg-[#FFC300] border-[#FFC300] text-black' : 'border-zinc-600 hover:border-zinc-400'}`}>
                        {tyres.every(t => selectedTyreIds.has(t.id)) && <CheckSquare size={14}/>}
                    </button>
                </div>
                <div className="text-center">Фото</div>
                <div>Код</div>
                <div className="text-center text-orange-500 flex justify-center"><Flame size={16}/></div>
                <div className="text-center">Кат.</div>
                <div className="text-center font-bold">Сезон</div>
                <div>Пост.</div>
                <div className="min-w-0">Назва</div>
                <div className="text-center">R</div>
                <div className="text-right">Ціна</div>
                <div className="text-center">Зал.</div>
                <div className="text-center">Дії</div>
            </div>

            {/* Body */}
            <div className="divide-y divide-zinc-800">
                {tyres.map(tyre => {
                    const isSelected = selectedTyreIds.has(tyre.id);
                    const supplierName = suppliers.find(s => s.id === tyre.supplier_id)?.name || '-';
                    const isOutOfStock = tyre.in_stock === false;

                    return (
                        <div key={tyre.id} className={`grid grid-cols-[40px_100px_120px_40px_50px_80px_100px_minmax(0,1fr)_50px_80px_60px_150px] gap-2 p-2 items-center hover:bg-zinc-900 transition-colors ${isSelected ? 'bg-zinc-800/50' : ''} ${isOutOfStock ? 'opacity-80' : ''}`}>
                            <div className="flex justify-center">
                                <button onClick={() => toggleSelection(tyre.id)} className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-[#FFC300] border-[#FFC300] text-black' : 'border-zinc-600 hover:border-zinc-400'}`}>
                                    {isSelected && <CheckSquare size={12}/>}
                                </button>
                            </div>
                            <div className="relative flex justify-center group h-20 w-20 mx-auto">
                                <div className="w-20 h-20 bg-black rounded border border-zinc-700 overflow-visible relative flex items-center justify-center">
                                    {tyre.image_url ? (
                                        <img src={tyre.image_url} className="absolute left-0 top-0 w-full h-full object-cover rounded z-10 transition-all duration-200 group-hover:scale-[2.5] group-hover:z-50 group-hover:border-2 group-hover:border-[#FFC300] group-hover:shadow-2xl cursor-zoom-in" alt="" />
                                    ) : (
                                        <ImageIcon size={24} className="text-zinc-600"/>
                                    )}
                                    {isOutOfStock && <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"><div className="bg-red-600 text-white text-[9px] px-2 py-0.5 font-bold uppercase -rotate-12 border border-red-900 shadow-md">Немає</div></div>}
                                </div>
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs text-zinc-400 font-mono truncate" title={tyre.catalog_number}>{tyre.catalog_number || '-'}</div>
                                {tyre.product_number && <div className="text-[10px] text-zinc-500 font-mono truncate" title={`Штрихкод: ${tyre.product_number}`}>▮▮ {tyre.product_number}</div>}
                            </div>
                            <div className="flex justify-center"><input type="checkbox" checked={!!tyre.is_hot} onChange={() => handleQuickHotToggle(tyre)} className="w-5 h-5 accent-orange-600 cursor-pointer bg-zinc-800 border-zinc-600 rounded" /></div>
                            <div className="flex justify-center">
                                {tyre.vehicle_type === 'cargo' ? <Truck size={16} className="text-blue-400"/> : tyre.vehicle_type === 'suv' ? <Mountain size={16} className="text-green-400"/> : tyre.vehicle_type === 'truck' ? <Truck size={16} className="text-blue-800"/> : tyre.vehicle_type === 'agro' ? <Tractor size={16} className="text-green-600"/> : <Car size={16} className="text-blue-300"/>}
                            </div>
                            <div className="text-center flex justify-center text-[10px] font-bold uppercase">
                                {tyre.season === 'winter' ? <span className="bg-blue-900/30 text-blue-300 px-2 py-1 rounded border border-blue-900/50">Зима</span> : 
                                tyre.season === 'summer' ? <span className="bg-orange-900/30 text-orange-300 px-2 py-1 rounded border border-orange-900/50">Літо</span> : 
                                tyre.season === 'all-season' ? <span className="bg-green-900/30 text-green-300 px-2 py-1 rounded border border-green-900/50">Всесезон</span> : 
                                <span className="text-zinc-600">-</span>}
                            </div>
                            <div className="text-xs text-white font-bold truncate min-w-0" title={supplierName}>{supplierName}</div>
                            <div className="flex flex-col min-w-0 overflow-hidden">
                                <div onClick={() => handleCopyTitle(tyre.title)} className="text-sm text-white font-bold leading-tight flex items-center gap-2 cursor-pointer hover:text-[#FFC300] active:scale-95 transition-all group/title overflow-hidden" title={`${tyre.title} (Натисніть, щоб скопіювати)`}>
                                    <span className="truncate block flex-grow">{tyre.title}</span>
                                    {isProductReady(tyre) && <CheckCircle size={14} className="text-green-500 flex-shrink-0" {...READY_TITLE} />}
                                    <Copy size={12} className="flex-shrink-0 opacity-0 group-hover/title:opacity-100 text-[#FFC300] transition-opacity"/>
                                </div>
                                {tyre.axis && <span className="text-[10px] text-zinc-500 flex items-center gap-1"><CircleDot size={10} className="text-blue-400"/> {tyre.axis}</span>}
                            </div>
                            <div className="text-center font-bold text-[#FFC300] text-sm">
                                {tyre.radius?.replace('R','')}
                            </div>
                            <div className="text-right font-mono text-white text-sm">
                                {editingPriceId === tyre.id ? (
                                    <input 
                                        autoFocus
                                        type="number"
                                        value={inlineValue}
                                        onChange={e => setInlineValue(e.target.value)}
                                        onBlur={() => handleInlineUpdate(tyre.id, 'price', inlineValue)}
                                        onKeyDown={e => e.key === 'Enter' && handleInlineUpdate(tyre.id, 'price', inlineValue)}
                                        className="w-full bg-zinc-800 border border-[#FFC300] rounded px-1 text-right text-white outline-none"
                                    />
                                ) : (
                                    <div 
                                        onClick={() => { setEditingPriceId(tyre.id); setInlineValue(String(tyre.price)); }}
                                        className="cursor-pointer hover:text-[#FFC300] transition-colors"
                                        title="Натисніть, щоб змінити ціну"
                                    >
                                        {tyre.price}
                                    </div>
                                )}
                            </div>
                            <div className="text-center font-mono text-sm">
                                {editingStockId === tyre.id ? (
                                    <input 
                                        autoFocus
                                        type="number"
                                        value={inlineValue}
                                        onChange={e => setInlineValue(e.target.value)}
                                        onBlur={() => handleInlineUpdate(tyre.id, 'stock_quantity', inlineValue)}
                                        onKeyDown={e => e.key === 'Enter' && handleInlineUpdate(tyre.id, 'stock_quantity', inlineValue)}
                                        className="w-full bg-zinc-800 border border-[#FFC300] rounded px-1 text-center text-white outline-none"
                                    />
                                ) : (
                                    <div 
                                        onClick={() => { setEditingStockId(tyre.id); setInlineValue(String(tyre.stock_quantity || 0)); }}
                                        className={`cursor-pointer hover:text-[#FFC300] transition-colors font-bold ${parseInt(String(tyre.stock_quantity)) < 4 ? 'text-red-500' : 'text-zinc-400'}`}
                                        title="Натисніть, щоб змінити залишок"
                                    >
                                        {tyre.stock_quantity || 0}
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-center gap-1">
                                <button 
                                    onClick={() => {
                                        const msg = `Нове замовлення: ${tyre.title} (${tyre.price} грн)`;
                                        navigator.clipboard.writeText(msg);
                                        setSuccessMessage("Дані для замовлення скопійовано!");
                                        setTimeout(() => setSuccessMessage(''), 2000);
                                    }} 
                                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-blue-400" 
                                    title="Швидке замовлення"
                                >
                                    <ShoppingCart size={14}/>
                                </button>
                                <button onClick={() => handleShareProduct(tyre)} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-green-400" title="Поділитися в месенджер">
                                    <ArrowRight size={14} className="-rotate-45"/>
                                </button>
                                {!tyre.image_url && (
                                    <button onClick={() => handleOpenAiSearch(tyre)} className="p-1.5 bg-purple-900/40 border border-purple-500/30 text-purple-300 hover:bg-purple-600 hover:text-white rounded transition-colors" title="Знайти фото ШІ">
                                        <Sparkles size={14}/>
                                    </button>
                                )}
                                <button onClick={() => openEditTyreModal(tyre)} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300" title="Редагувати">
                                    <Edit2 size={14}/>
                                </button>
                                <button onClick={() => { setTyreToDelete(tyre.id); setShowDeleteModal(true); }} className="p-1.5 bg-zinc-800 hover:bg-red-900/50 text-zinc-500 hover:text-red-500 rounded" title="Видалити">
                                    <Trash2 size={14}/>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
  );
};

/** Tiles with big photos. */
export const TyresGrid: React.FC<TyresViewProps> = ({ list, row, onEdit, onAiSearch }) => {
  const { tyres, selectedTyreIds, toggleSelection } = list;
  const { handleCopyTitle, setTyreToDelete, setShowDeleteModal } = row;
  const openEditTyreModal = onEdit, handleOpenAiSearch = onAiSearch;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {tyres.map(tyre => (
            <div key={tyre.id} className={`bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group relative ${selectedTyreIds.has(tyre.id) ? 'ring-2 ring-[#FFC300]' : ''} ${tyre.in_stock === false ? 'opacity-80' : ''}`}>
                <div className="aspect-square bg-black relative cursor-pointer" onClick={() => openEditTyreModal(tyre)}>
                    {tyre.image_url ? (
                        <img src={tyre.image_url} alt={tyre.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                            <ImageIcon className="text-zinc-800" size={32}/>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleOpenAiSearch(tyre); }}
                                className="bg-purple-900/40 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 hover:bg-purple-800 transition-colors"
                            >
                                <Sparkles size={12}/> Знайти ШІ
                            </button>
                        </div>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); toggleSelection(tyre.id); }} className={`absolute top-2 left-2 w-6 h-6 rounded border flex items-center justify-center z-20 ${selectedTyreIds.has(tyre.id) ? 'bg-[#FFC300] border-[#FFC300] text-black' : 'bg-black/50 border-white/50'}`}><CheckSquare size={14}/></button>
                    {tyre.is_hot && <div className="absolute top-2 right-2 bg-orange-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded z-10 shadow-sm">HOT</div>}
                    {tyre.in_stock === false && <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"><span className="text-red-500 font-bold uppercase text-xs border border-red-500 px-2 py-1 -rotate-12 bg-black/20 shadow-lg">Немає</span></div>}
                </div>
                <div className="p-3">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold">{tyre.manufacturer}</div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                        <div onClick={() => openEditTyreModal(tyre)} className="text-xs font-bold text-white line-clamp-2 h-8 cursor-pointer hover:text-[#FFC300] transition-colors flex-grow">{tyre.title}</div>
                        <button onClick={(e) => { e.stopPropagation(); handleCopyTitle(tyre.title); }} className="p-1 text-zinc-600 hover:text-[#FFC300] transition-colors" title="Копіювати назву"><Copy size={12}/></button>
                    </div>
                    {tyre.axis && <div className="text-[9px] text-blue-300 font-bold mb-1 flex items-center gap-1"><CircleDot size={8}/> {tyre.axis}</div>}
                    <div className="flex justify-between items-end cursor-pointer" onClick={() => openEditTyreModal(tyre)}><div className="text-[#FFC300] font-mono font-bold">{tyre.price}</div><div className="text-[10px] text-zinc-500">{tyre.radius}</div></div>
                    <div className="mt-2 flex gap-1">
                        <button onClick={() => openEditTyreModal(tyre)} className="flex-1 bg-[#FFC300] hover:bg-[#e6b000] text-black font-black text-xs py-2 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1">
                            <Edit2 size={12}/> Редагувати
                        </button>
                        <button onClick={() => { setTyreToDelete(tyre.id); setShowDeleteModal(true); }} className="px-3 bg-zinc-800 hover:bg-red-900/50 text-red-500 rounded-lg transition-colors">
                            <Trash2 size={14}/>
                        </button>
                    </div>
                </div>
            </div>
        ))}
    </div>
  );
};
