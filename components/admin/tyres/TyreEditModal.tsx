import React from 'react';
import { X, Upload, Save, Loader2, Flame, Snowflake, Sun, CloudSun, CircleDot, Globe } from 'lucide-react';
import type { Supplier } from '../../../types';
import type { ProductCategory } from '../../../categories';
import { suggestTitle } from '../../../productAttributes';
import type { TyreEditor } from './useTyreEditor';
import { KNOWN_BRANDS, AXIS_OPTIONS, getRadiiOptions } from './tyreAdminUtils';

interface TyreEditModalProps {
  editor: TyreEditor;
  categories: ProductCategory[];
  categoryOptions: { cat: ProductCategory; label: string }[];
  dbReady: boolean;
  suppliers: Supplier[];
  setSuccessMessage: (msg: string) => void;
}

/** The edit window: section, name, tyre fields or characteristics, photos (also pasted with Ctrl+V), prices, SEO. */
const TyreEditModal: React.FC<TyreEditModalProps> = ({ editor, categories, categoryOptions, dbReady, suppliers, setSuccessMessage }) => {
  const {
    setShowAddTyreModal, editingTyreId, editingFromProgram, tyreForm, setTyreForm, attrForm, setAttrForm, isTyreForm, formPreset,
    tyreUploadFiles, setTyreUploadFiles, existingGallery, setExistingGallery, uploading, applyDiscount, handleSaveTyre,
  } = editor;

  return (
    <div 
        className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 outline-none" 
        onPaste={(e: React.ClipboardEvent) => {
            if (e.clipboardData.files.length > 0) {
                e.preventDefault();
                const newFiles = Array.from(e.clipboardData.files).filter((f: any) => f.type.startsWith('image/'));
                if (newFiles.length > 0) {
                    setTyreUploadFiles(prev => [...prev, ...newFiles]);
                    setSuccessMessage(`Додано ${newFiles.length} фото з буферу!`);
                    setTimeout(() => setSuccessMessage(''), 2000);
                }
            }
        }}
        tabIndex={0}
    >
        <div className="bg-zinc-900 border-0 sm:border sm:border-zinc-700 p-4 sm:p-6 rounded-none sm:rounded-2xl w-full max-w-4xl h-full sm:h-[90vh] flex flex-col shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h3 className="text-xl sm:text-2xl font-black text-white">{editingTyreId ? 'Редагування' : 'Новий товар'}</h3>
                <button onClick={() => setShowAddTyreModal(false)} className="p-2 text-zinc-500 hover:text-white bg-zinc-800 rounded-full"><X size={24}/></button>
            </div>
            {editingFromProgram && (
                <div className="mb-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200 text-sm">
                    Цей товар приходить з програми. <b>Назва, ціна, кількість, артикул, бренд і категорія</b> змінюються тільки в програмі — тут їх зміни не збережуться. Тут можна змінити фото, опис, характеристики та SEO.
                </div>
            )}
            <div className="flex-grow overflow-y-auto pr-1 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-4">
                        {dbReady && (
                            <div>
                                <label className="block text-[#FFC300] text-xs font-bold uppercase mb-1">Категорія</label>
                                <select
                                    value={tyreForm.category_id}
                                    onChange={e => {
                                        const cat = categories.find(c => String(c.id) === e.target.value);
                                        const next: any = { ...tyreForm, category_id: e.target.value };
                                        if (cat?.vehicle_type) {
                                            next.vehicle_type = cat.vehicle_type;
                                            next.radius = getRadiiOptions(cat.vehicle_type as any)[0];
                                            if (cat.vehicle_type === 'truck' || cat.vehicle_type === 'agro') next.season = 'all-season';
                                        }
                                        setTyreForm(next);
                                    }}
                                    className="w-full bg-black border border-[#FFC300]/50 rounded-lg p-3 text-white font-bold"
                                >
                                    <option value="">Шини (без категорії)</option>
                                    {categoryOptions.map(({ cat, label }) => <option key={cat.id} value={cat.id}>{label}</option>)}
                                </select>
                            </div>
                        )}
                        <div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Виробник (Бренд)</label><input list="brands" value={tyreForm.manufacturer} onChange={e => setTyreForm({...tyreForm, manufacturer: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-bold" placeholder="Напр. Michelin"/><datalist id="brands">{KNOWN_BRANDS.map(b => <option key={b} value={b}/>)}</datalist></div>
                        <div><label className="block text-[#FFC300] text-xs font-bold uppercase mb-1">{isTyreForm ? 'Назва (Модель)' : 'Назва товару'}</label><input type="text" value={tyreForm.name} onChange={e => setTyreForm({...tyreForm, name: e.target.value})} className="w-full bg-black border border-[#FFC300]/50 rounded-lg p-3 text-white font-bold" placeholder={isTyreForm ? 'Напр. Alpin 6' : formPreset ? 'Можна залишити порожнім' : 'Напр. Акумулятор 6СТ-60 Аз'}/>
                            {formPreset && !tyreForm.name.trim() && (
                                <p className="text-[11px] text-zinc-500 mt-1">Назва складеться сама: <span className="text-zinc-300">{suggestTitle(formPreset, tyreForm.manufacturer.trim(), attrForm)}</span></p>
                            )}
                        </div>
                        {formPreset && (
                            <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-3 space-y-3 animate-in fade-in slide-in-from-top-1">
                                <p className="text-xs font-black uppercase tracking-widest text-emerald-400">Характеристики (для фільтрів на сайті)</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {formPreset.fields.map(f => (
                                        <div key={f.key} className={f.type === 'select' && (f.options?.length || 0) <= 3 ? 'col-span-2' : ''}>
                                            <label className="block text-zinc-400 text-[11px] font-bold uppercase mb-1">{f.label}{f.unit ? `, ${f.unit}` : ''}</label>
                                            {f.type === 'select' && f.options ? (
                                                (f.options.length <= 3) ? (
                                                    <div className="flex gap-1.5">
                                                        {f.options.map(o => (
                                                            <button key={o.value} type="button" onClick={() => setAttrForm(prev => ({ ...prev, [f.key]: prev[f.key] === o.value ? '' : o.value }))}
                                                                className={`flex-1 px-2 py-2 rounded-lg border text-xs font-bold transition-colors ${attrForm[f.key] === o.value ? 'bg-[#FFC300] text-black border-[#FFC300]' : 'bg-black border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}>
                                                                {o.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <select value={attrForm[f.key] || ''} onChange={e => setAttrForm(prev => ({ ...prev, [f.key]: e.target.value }))} className="w-full bg-black border border-zinc-700 rounded-lg p-2.5 text-white text-sm">
                                                        <option value="">—</option>
                                                        {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                    </select>
                                                )
                                            ) : (
                                                <input type="text" inputMode={f.type === 'number' ? 'decimal' : 'text'} value={attrForm[f.key] || ''} placeholder={f.placeholder}
                                                    onChange={e => setAttrForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                                    className="w-full bg-black border border-zinc-700 rounded-lg p-2.5 text-white text-sm" />
                                            )}
                                            {f.hint && <p className="text-[10px] text-zinc-500 mt-0.5">{f.hint}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {isTyreForm && <>
                        <div className="grid grid-cols-3 gap-2">
                            <div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Ширина</label><input type="text" value={tyreForm.width} onChange={e => setTyreForm({...tyreForm, width: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white text-center" placeholder="205"/></div>
                            <div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Висота</label><input type="text" value={tyreForm.height} onChange={e => setTyreForm({...tyreForm, height: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white text-center" placeholder="55"/></div>
                            <div>
                                <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Радіус</label>
                                <select 
                                    value={tyreForm.radius} 
                                    onChange={e => setTyreForm({...tyreForm, radius: e.target.value})} 
                                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white"
                                >
                                    {getRadiiOptions(tyreForm.vehicle_type).map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Тип авто</label>
                            <select 
                                value={tyreForm.vehicle_type} 
                                onChange={e => {
                                    const vType = e.target.value as any;
                                    const newRadius = getRadiiOptions(vType)[0];
                                    // Force season to all-season if Truck or Agro
                                    const newSeason = (vType === 'truck' || vType === 'agro') ? 'all-season' : tyreForm.season;
                                    setTyreForm({...tyreForm, vehicle_type: vType, radius: newRadius, season: newSeason, axis: vType !== 'truck' ? '' : tyreForm.axis });
                                }} 
                                className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white"
                            >
                                <option value="car">Легкова</option>
                                <option value="suv">Позашляховик</option>
                                <option value="cargo">Вантажна (C)</option>
                                <option value="truck">Вантажна (TIR)</option>
                                <option value="agro">Агро / Спец</option>
                            </select>
                        </div>

                        {tyreForm.vehicle_type === 'truck' && (
                            <div className="animate-in fade-in slide-in-from-top-1">
                                <label className="block text-blue-400 text-xs font-bold uppercase mb-1 flex items-center gap-1"><CircleDot size={12}/> Вісь (Тільки TIR)</label>
                                <select 
                                    value={tyreForm.axis} 
                                    onChange={e => setTyreForm({...tyreForm, axis: e.target.value})} 
                                    className="w-full bg-black border border-blue-900 rounded-lg p-3 text-white font-bold"
                                >
                                    <option value="">-- Оберіть вісь --</option>
                                    {AXIS_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="bg-zinc-800 p-3 rounded-lg border border-zinc-700">
                            <label className="block text-zinc-400 text-xs font-bold uppercase mb-2 text-center">Сезонність</label>
                            <div className="grid grid-cols-3 gap-2">
                                <button type="button" onClick={() => setTyreForm({...tyreForm, season: 'winter'})} disabled={tyreForm.vehicle_type === 'truck' || tyreForm.vehicle_type === 'agro'} className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${tyreForm.season === 'winter' ? 'bg-blue-900/40 border-blue-500 text-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-black border-zinc-700 text-zinc-500 hover:text-white hover:bg-zinc-900'}`}><Snowflake size={24}/> <span className="text-xs font-black uppercase tracking-wide">Зима</span></button>
                                <button type="button" onClick={() => setTyreForm({...tyreForm, season: 'summer'})} disabled={tyreForm.vehicle_type === 'truck' || tyreForm.vehicle_type === 'agro'} className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${tyreForm.season === 'summer' ? 'bg-orange-900/40 border-orange-500 text-orange-200 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'bg-black border-zinc-700 text-zinc-500 hover:text-white hover:bg-zinc-900'}`}><Sun size={24}/> <span className="text-xs font-black uppercase tracking-wide">Літо</span></button>
                                <button type="button" onClick={() => setTyreForm({...tyreForm, season: 'all-season'})} className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all hover:scale-[1.02] active:scale-95 ${tyreForm.season === 'all-season' ? 'bg-green-900/40 border-green-500 text-green-200 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-black border-zinc-700 text-zinc-500 hover:text-white hover:bg-zinc-900'}`}><CloudSun size={24}/> <span className="text-xs font-black uppercase tracking-wide">Всесезон</span></button>
                            </div>
                            {(tyreForm.vehicle_type === 'truck' || tyreForm.vehicle_type === 'agro') && <p className="text-center text-[10px] text-zinc-500 mt-2">Для TIR та Спецтехніки тільки "Всесезон"</p>}
                        </div>
                        </>}

                        <div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Постачальник</label><select value={tyreForm.supplier_id} onChange={e => setTyreForm({...tyreForm, supplier_id: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white"><option value="">Не обрано</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                        <div className="border-2 border-dashed border-zinc-700 rounded-xl p-4 text-center">
                            <input type="file" multiple onChange={e => setTyreUploadFiles(Array.from(e.target.files || []))} className="hidden" id="tyre-files" />
                            <label htmlFor="tyre-files" className="cursor-pointer flex flex-col items-center gap-2 text-zinc-400 hover:text-white">
                                <Upload size={32} />
                                <span className="text-sm font-bold">Натисніть щоб додати фото</span>
                            </label>
                            <p className="text-[10px] text-zinc-500 mt-2">або натисніть <span className="text-[#FFC300] font-bold">Ctrl+V</span> для вставки з буферу</p>
                            {tyreUploadFiles.length > 0 && <div className="mt-2 text-[#FFC300] text-sm font-bold">{tyreUploadFiles.length} файлів обрано</div>}
                        </div>
                        {existingGallery.length > 0 && (<div className="flex gap-2 overflow-x-auto pb-2">{existingGallery.map((url, idx) => (<div key={idx} className="w-16 h-16 rounded border border-zinc-700 flex-shrink-0 relative group"><img src={url} className="w-full h-full object-cover" /><button onClick={() => setExistingGallery(prev => prev.filter(u => u !== url))} className="absolute top-0 right-0 bg-red-600 text-white p-0.5 rounded opacity-0 group-hover:opacity-100"><X size={12}/></button></div>))}</div>)}
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 bg-zinc-800/50 p-4 rounded-xl border border-zinc-800">
                            <div>
                                <label className="block text-green-400 text-xs font-bold uppercase mb-1">Роздріб (Продаж)</label>
                                <input type="number" value={tyreForm.price} onChange={e => setTyreForm({...tyreForm, price: e.target.value})} className="w-full bg-black border border-green-900/50 rounded-lg p-3 text-white font-bold text-xl" placeholder="0"/>
                            </div>
                            <div>
                                <label className="block text-zinc-500 text-xs font-bold uppercase mb-1">Стара ціна</label>
                                <input type="number" value={tyreForm.old_price} onChange={e => setTyreForm({...tyreForm, old_price: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-zinc-400" placeholder="0"/>
                            </div>
                            <div>
                                <label className="block text-blue-400 text-xs font-bold uppercase mb-1">Закупка (База)</label>
                                <input type="number" value={tyreForm.base_price} onChange={e => setTyreForm({...tyreForm, base_price: e.target.value})} className="w-full bg-black border border-blue-900/50 rounded-lg p-3 text-white" placeholder="0"/>
                            </div>
                            <div>
                                <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Залишок (шт)</label>
                                <input type="number" value={tyreForm.stock_quantity} onChange={e => setTyreForm({...tyreForm, stock_quantity: e.target.value})} className={`w-full bg-black border rounded-lg p-3 text-white font-bold ${parseInt(tyreForm.stock_quantity) < 4 ? 'border-red-500 text-red-500' : 'border-zinc-700'}`} placeholder="0"/>
                                {parseInt(tyreForm.stock_quantity) < 4 && <span className="text-[10px] text-red-500 font-bold uppercase mt-1 block">Мало залишку!</span>}
                            </div>

                            {/* Profit Calculator */}
                            {tyreForm.price && tyreForm.base_price && (
                                <div className="col-span-2 bg-black/50 p-2 rounded border border-zinc-700 flex justify-between items-center">
                                    <span className="text-xs text-zinc-400 uppercase font-bold">Прибуток:</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-green-400 font-bold">{parseInt(tyreForm.price) - parseInt(tyreForm.base_price)} грн</span>
                                        <span className="bg-green-900/30 text-green-400 px-2 py-0.5 rounded text-[10px] font-black">
                                            {(((parseInt(tyreForm.price) - parseInt(tyreForm.base_price)) / parseInt(tyreForm.price)) * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4"><div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Артикул (Код)</label><input type="text" value={tyreForm.catalog_number} onChange={e => setTyreForm({...tyreForm, catalog_number: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-mono" /></div><div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Номер товару</label><input type="text" value={tyreForm.product_number} onChange={e => setTyreForm({...tyreForm, product_number: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-mono" /></div></div>
                        <div><label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Опис</label><textarea value={tyreForm.description} onChange={e => setTyreForm({...tyreForm, description: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white h-24 text-sm" /></div>

                        {/* SEO SECTION */}
                        <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 space-y-4">
                            <h4 className="text-zinc-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <Globe size={14} className="text-[#FFC300]"/> SEO Налаштування (Google)
                            </h4>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-zinc-400 text-[10px] font-bold uppercase mb-1">SEO Заголовок (Title)</label>
                                    <input type="text" value={tyreForm.seo_title} onChange={e => setTyreForm({...tyreForm, seo_title: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-white text-xs" placeholder="Залиште порожнім для авто-генерації"/>
                                </div>
                                <div>
                                    <label className="block text-zinc-400 text-[10px] font-bold uppercase mb-1">SEO Опис (Description)</label>
                                    <textarea rows={2} value={tyreForm.seo_description} onChange={e => setTyreForm({...tyreForm, seo_description: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-white text-xs" placeholder="Короткий опис для пошуковика"/>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-zinc-400 text-[10px] font-bold uppercase mb-1">Slug (URL)</label>
                                        <input type="text" value={tyreForm.slug} onChange={e => setTyreForm({...tyreForm, slug: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-white text-xs font-mono" placeholder="michelin-alpin-6"/>
                                    </div>
                                    <div>
                                        <label className="block text-zinc-400 text-[10px] font-bold uppercase mb-1">Ключові слова</label>
                                        <input type="text" value={tyreForm.seo_keywords} onChange={e => setTyreForm({...tyreForm, seo_keywords: e.target.value})} className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-white text-xs" placeholder="шина, купити, зимова"/>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div><label className="flex items-center gap-2 cursor-pointer bg-zinc-800 px-4 py-2 rounded-lg border border-zinc-700 w-fit"><input type="checkbox" checked={tyreForm.is_hot} onChange={e => setTyreForm({...tyreForm, is_hot: e.target.checked})} className="w-5 h-5 accent-[#FFC300]"/><span className="font-bold text-white"><Flame className="inline text-orange-500 mr-1" size={16}/> HOT Пропозиція</span></label>{tyreForm.is_hot && (<div className="flex gap-2 mt-2 animate-in fade-in slide-in-from-top-1">{[2, 3, 5, 10].map(pct => (<button key={pct} onClick={() => applyDiscount(pct)} className="flex-1 bg-red-900/20 border border-red-800 text-red-400 hover:bg-red-900/40 py-1 rounded text-xs font-bold">-{pct}%</button>))}</div>)}</div>
                    </div>
                </div>
            </div>
            <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-end gap-4"><button onClick={() => setShowAddTyreModal(false)} className="px-6 py-3 bg-zinc-800 text-white font-bold rounded-xl hover:bg-zinc-700">Скасувати</button><button onClick={handleSaveTyre} disabled={uploading} className="px-8 py-3 bg-[#FFC300] text-black font-black rounded-xl hover:bg-[#e6b000] flex items-center gap-2">{uploading ? <Loader2 className="animate-spin"/> : <Save size={20}/>} Зберегти</button></div>
        </div>
    </div>
  );
};

export default TyreEditModal;
