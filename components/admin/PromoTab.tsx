
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Megaphone, Save, Plus, Trash2, Eye, Type, CheckCircle, X, Search, Tractor, ArrowRight, Loader2 } from 'lucide-react';
import { Banner, DEFAULT_IMG_CONFIG, DEFAULT_BG_CONFIG, PRESET_COLORS } from './promo/shared';
import PromoEditor from './promo/PromoEditor';
import PromoPreview from './promo/PromoPreview';
import { TyreProduct } from '../../types';
import { normalizeQuery } from './sync/syncUtils';

const PromoTab: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [banners, setBanners] = useState<Banner[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    // Hero Text State
    const [heroTitle, setHeroTitle] = useState('');
    const [heroSubtitle, setHeroSubtitle] = useState('');

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [bannerToDelete, setBannerToDelete] = useState<number | null>(null);

    // Agro Marketing State
    const [agroSearch, setAgroSearch] = useState('');
    const [agroResults, setAgroResults] = useState<TyreProduct[]>([]);
    const [selectedAgroProducts, setSelectedAgroProducts] = useState<TyreProduct[]>([]);
    const [searchingAgro, setSearchingAgro] = useState(false);

    useEffect(() => {
        fetchPromo();
        fetchHeroText();
        fetchAgroMarketing();
    }, []);

    const fetchAgroMarketing = async () => {
        const { data: settingData } = await supabase.from('settings').select('value').eq('key', 'agro_featured_ids').single();
        if (settingData && settingData.value) {
            const ids = settingData.value.split(',').map(Number);
            const { data: tyreData } = await supabase.from('tyres').select('*').in('id', ids);
            if (tyreData) {
                const sorted = ids.map(id => tyreData.find(t => t.id === id)).filter(Boolean) as TyreProduct[];
                setSelectedAgroProducts(sorted);
            }
        }
    };

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            if (agroSearch.trim().length > 2) searchAgroTyres();
            else setAgroResults([]);
        }, 500);
        return () => clearTimeout(delayDebounce);
    }, [agroSearch]);

    const searchAgroTyres = async () => {
        const rawQ = agroSearch.trim();
        if (rawQ.length < 2) return;
        
        setSearchingAgro(true);
        try {
            const q = normalizeQuery(rawQ); 
            // Split into keywords for broader matching
            const words = q.split(/\s+/).filter(w => w.length > 1);
            
            let query = supabase.from('tyres').select('*');
            
            if (words.length > 0) {
                // Combine words into a search pattern: %word1%word2%
                const pattern = `%${words.join('%')}%`;
                query = query.or(`title.ilike.${pattern},catalog_number.ilike.${pattern},manufacturer.ilike.${pattern}`);
            } else {
                query = query.or(`title.ilike.%${q}%,catalog_number.ilike.%${q}%,manufacturer.ilike.%${q}%`);
            }
            
            const { data } = await query.limit(20);
            
            if (data) {
                // Prioritize 'agro' type
                const sorted = [...data].sort((a, b) => {
                    const aIsAgro = a.vehicle_type === 'agro' ? 1 : 0;
                    const bIsAgro = b.vehicle_type === 'agro' ? 1 : 0;
                    return bIsAgro - aIsAgro;
                });
                setAgroResults(sorted.slice(0, 10));
            } else {
                setAgroResults([]);
            }
        } catch (e) {
            console.error(e);
            setAgroResults([]);
        } finally {
            setSearchingAgro(false);
        }
    };

    const handleSaveAgroMarketing = async () => {
        setLoading(true);
        const idsString = selectedAgroProducts.map(p => p.id).join(',');
        await supabase.from('settings').upsert({ key: 'agro_featured_ids', value: idsString });
        alert("Маркетинг агро-банера оновлено!");
        setLoading(false);
    };

    const fetchHeroText = async () => {
        const { data } = await supabase.from('settings').select('key, value').in('key', ['hero_title', 'hero_subtitle']);
        if (data) {
            data.forEach(item => {
                if (item.key === 'hero_title') setHeroTitle(item.value);
                if (item.key === 'hero_subtitle') setHeroSubtitle(item.value);
            });
        }
    };

    const fetchPromo = async () => {
        setLoading(true);
        const { data } = await supabase.from('settings').select('value').eq('key', 'promo_data').single();
        if (data && data.value) {
            try {
                const parsed = JSON.parse(data.value);
                let loadedBanners = Array.isArray(parsed) ? parsed : [parsed];
                
                loadedBanners = loadedBanners.map((b: any) => ({
                    ...b,
                    id: b.id || Date.now(),
                    pattern: b.pattern || 'none',
                    patternOpacity: b.patternOpacity !== undefined ? b.patternOpacity : 10,
                    imageConfig: { ...DEFAULT_IMG_CONFIG, ...(b.imageConfig || {}) },
                    backgroundConfig: { ...DEFAULT_BG_CONFIG, ...(b.backgroundConfig || {}) }
                }));

                setBanners(loadedBanners);
                if (loadedBanners.length > 0) setSelectedId(loadedBanners[0].id);
            } catch (e) {
                console.error("Error parsing promo data", e);
                setBanners([]);
            }
        }
        setLoading(false);
    };

    const handleSaveBanners = async (updatedBanners?: Banner[]) => {
        const dataToSave = updatedBanners || banners;
        setLoading(true);
        try {
            await supabase.from('settings').upsert({ key: 'promo_data', value: JSON.stringify(dataToSave) });
            if (!updatedBanners) alert("Слайдер акцій оновлено!");
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleSaveHeroText = async () => {
        setLoading(true);
        await supabase.from('settings').upsert([
            { key: 'hero_title', value: heroTitle },
            { key: 'hero_subtitle', value: heroSubtitle }
        ]);
        alert("Текст головного блоку оновлено!");
        setLoading(false);
    };

    const addNewBanner = () => {
        const newBanner: Banner = {
            id: Date.now(), active: true, title: 'Нова акція', text: 'Опис акції...',
            buttonText: 'Детальніше', link: 'shop', color: PRESET_COLORS[0].value,
            pattern: 'none', patternOpacity: 10, image_url: '',
            imageConfig: { ...DEFAULT_IMG_CONFIG }, backgroundConfig: { ...DEFAULT_BG_CONFIG }
        };
        setBanners([...banners, newBanner]);
        setSelectedId(newBanner.id);
    };

    const initiateDelete = (id: number) => {
        setBannerToDelete(id);
        setShowDeleteModal(true);
    };

    const executeDelete = async () => {
        if (bannerToDelete !== null) {
            const newBanners = banners.filter(b => b.id !== bannerToDelete);
            setBanners(newBanners);
            if (selectedId === bannerToDelete) setSelectedId(newBanners.length > 0 ? newBanners[0].id : null);
            await handleSaveBanners(newBanners);
        }
        setShowDeleteModal(false);
        setBannerToDelete(null);
    };

    const updateBanner = (id: number, field: keyof Banner, value: any) => {
        setBanners(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
    };

    const updateImageConfig = (id: number, field: string, value: any) => {
        setBanners(prev => prev.map(b => {
            if (b.id === id) {
                const currentConfig = b.imageConfig || { ...DEFAULT_IMG_CONFIG };
                return { ...b, imageConfig: { ...currentConfig, [field]: value } };
            }
            return b;
        }));
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !selectedId) return;
        setUploading(true);
        try {
            const file = e.target.files[0];
            const fileName = `promo_${selectedId}_${Date.now()}`;
            const { error } = await supabase.storage.from('galery').upload(fileName, file);
            if (error) throw error;
            const { data } = supabase.storage.from('galery').getPublicUrl(fileName);
            updateBanner(selectedId, 'image_url', data.publicUrl);
        } catch (err: any) { alert("Помилка завантаження: " + err.message); }
        finally { setUploading(false); }
    };

    const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !selectedId) return;
        setUploading(true);
        try {
            const file = e.target.files[0];
            const fileName = `promo_bg_${selectedId}_${Date.now()}`;
            const { error } = await supabase.storage.from('galery').upload(fileName, file);
            if (error) throw error;
            const { data } = supabase.storage.from('galery').getPublicUrl(fileName);
            updateBanner(selectedId, 'backgroundImage', data.publicUrl);
        } catch (err: any) { alert("Помилка завантаження фону: " + err.message); }
        finally { setUploading(false); }
    };

    const selectedBanner = banners.find(b => b.id === selectedId);

    return (
        <div className="animate-in fade-in space-y-8 pb-20">
            
            {/* HERO TEXT EDITOR SECTION */}
            <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 bg-[#FFC300] h-full"></div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-black text-white flex items-center gap-2 uppercase italic">
                        <Type className="text-[#FFC300]" /> Текст Головного Екрану
                    </h3>
                    <button onClick={handleSaveHeroText} disabled={loading} className="bg-zinc-800 text-white font-bold px-4 py-2 rounded-lg hover:bg-zinc-700 flex items-center gap-2 border border-zinc-700">
                        <Save size={16} /> Зберегти текст
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Рядок 1 (Жовтий)</label>
                        <input 
                            type="text" value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} 
                            placeholder="ЦІЛОДОБОВИЙ ШИНОМОНТАЖ"
                            className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-[#FFC300] font-black uppercase text-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Рядок 2 (Білий)</label>
                        <input 
                            type="text" value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} 
                            placeholder="В М. СИНЕЛЬНИКОВЕ (24/7)"
                            className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-black uppercase text-lg"
                        />
                    </div>
                </div>
            </div>

            {/* AGRO MARKETING SECTION */}
            <div className="bg-emerald-900/10 p-6 rounded-2xl border border-emerald-800/30 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 bg-emerald-500 h-full"></div>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-white flex items-center gap-2 uppercase italic">
                        <Tractor className="text-emerald-500" /> Маркетинг Агро-банера (Макс 3)
                    </h3>
                    <button 
                        onClick={handleSaveAgroMarketing} disabled={loading}
                        className="bg-emerald-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-emerald-500 flex items-center gap-2 border border-emerald-500 shadow-lg shadow-emerald-900/20"
                    >
                        <Save size={16} /> Зберегти вибір
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                            <input 
                                type="text" value={agroSearch} onChange={(e) => setAgroSearch(e.target.value)}
                                placeholder="Пошук агрошин за назвою або кодом..."
                                className="w-full bg-black border border-zinc-700 rounded-xl p-3 pl-10 text-white outline-none focus:border-emerald-500 transition-all"
                            />
                            {searchingAgro && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-zinc-500" size={18} />}
                            
                            {/* NEW: Absolute results dropdown */}
                            {agroSearch.trim().length > 2 && !searchingAgro && (
                                <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl max-h-[300px] overflow-y-auto divide-y divide-zinc-800">
                                    {agroResults.length > 0 ? (
                                        agroResults.map(p => (
                                            <div 
                                                key={p.id} className="p-3 flex items-center justify-between hover:bg-zinc-800 cursor-pointer transition-colors"
                                                onClick={() => {
                                                    if (selectedAgroProducts.find(x => x.id === p.id)) return;
                                                    if (selectedAgroProducts.length >= 3) { alert("Макс 3 товари"); return; }
                                                    setSelectedAgroProducts([...selectedAgroProducts, p]);
                                                    setAgroSearch(''); setAgroResults([]);
                                                }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <img src={p.image_url} alt="" className="w-10 h-10 object-cover rounded-lg bg-black" />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-xs font-bold text-white truncate">{p.title}</p>
                                                            <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-black ${p.vehicle_type === 'agro' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                                                {p.vehicle_type}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-zinc-500 uppercase">{p.catalog_number || p.manufacturer}</p>
                                                    </div>
                                                </div>
                                                <Plus size={16} className="text-emerald-500" />
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center text-zinc-500 text-xs italic">Товарів не знайдено за вашим запитом</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Обрані товари:</h4>
                        {selectedAgroProducts.length === 0 && <div className="py-8 text-center text-zinc-600 border border-dashed border-zinc-800 rounded-xl">Товари не обрані</div>}
                        <div className="space-y-2">
                            {selectedAgroProducts.map((p, idx) => (
                                <div key={p.id} className="bg-zinc-800/50 border border-emerald-500/20 p-3 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-emerald-500 font-black text-xs">{idx + 1}</span>
                                        <img src={p.image_url} alt="" className="w-12 h-12 object-cover rounded-lg bg-black" />
                                        <div>
                                            <p className="text-sm font-bold text-white line-clamp-1">{p.title}</p>
                                            <p className="text-xs text-[#FFC300] font-black">{p.price} грн</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedAgroProducts(selectedAgroProducts.filter(x => x.id !== p.id))} className="text-zinc-500 hover:text-red-500 p-2"><X size={18} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* SLIDER EDITOR SECTION */}
            <div className="flex justify-between items-center border-t border-zinc-800 pt-8">
                <h3 className="text-2xl font-black text-white flex items-center gap-2">
                    <Megaphone className="text-[#FFC300]" /> Слайдер Акцій
                </h3>
                <button onClick={() => handleSaveBanners()} className="bg-[#FFC300] text-black font-black px-6 py-3 rounded-xl hover:bg-[#e6b000] flex items-center gap-2 shadow-lg shadow-yellow-900/20">
                    <Save size={20} /> Зберегти акції
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-zinc-400 font-bold uppercase text-xs">Список банерів</h4>
                        <button onClick={addNewBanner} className="text-xs bg-zinc-800 hover:bg-white hover:text-black text-white px-3 py-1 rounded-lg font-bold transition-colors flex items-center gap-1">
                            <Plus size={14}/> Додати
                        </button>
                    </div>
                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                        {banners.map((b) => (
                            <div key={b.id} onClick={() => setSelectedId(b.id)} className={`p-4 rounded-xl border cursor-pointer transition-all relative group ${selectedId === b.id ? 'bg-zinc-800 border-[#FFC300]' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'}`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${b.active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                        <div>
                                            <h5 className="font-bold text-white text-sm line-clamp-1">{b.title}</h5>
                                            <p className="text-xs text-zinc-500 line-clamp-1">{b.text}</p>
                                        </div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); initiateDelete(b.id); }} className="text-zinc-400 hover:text-white bg-zinc-800 hover:bg-red-600 p-2 rounded-lg transition-colors z-20"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-8 space-y-8">
                    {selectedBanner ? (
                        <>
                            <div className="flex justify-end mb-2">
                                <button onClick={() => initiateDelete(selectedBanner.id)} className="text-xs font-bold text-red-500 hover:text-red-400 flex items-center gap-1 bg-red-900/10 px-3 py-1 rounded-lg border border-red-900/30 hover:bg-red-900/20"><Trash2 size={12}/> Видалити цей банер</button>
                            </div>
                            <PromoEditor banner={selectedBanner} onUpdate={(field, val) => updateBanner(selectedBanner.id, field, val)} onUpdateImageConfig={(field, val) => updateImageConfig(selectedBanner.id, field, val)} onUploadImage={handleImageUpload} onUploadBackground={handleBackgroundUpload} uploading={uploading} />
                            <div>
                                <h4 className="text-zinc-400 font-bold uppercase text-sm flex items-center gap-2 mb-4"><Eye size={16}/> Попередній перегляд (Слайдер)</h4>
                                <PromoPreview banner={selectedBanner} />
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-500 border-2 border-dashed border-zinc-800 rounded-2xl min-h-[400px]">
                            <p>Оберіть банер зліва або створіть новий</p>
                        </div>
                    )}
                </div>
            </div>

            {showDeleteModal && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                   <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm relative shadow-2xl text-center animate-in zoom-in duration-200">
                       <button onClick={() => setShowDeleteModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={24}/></button>
                       <div className="w-16 h-16 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-900/50"><Trash2 size={32} /></div>
                       <h3 className="text-xl font-bold text-white mb-2">Видалити акцію?</h3>
                       <div className="flex gap-4 mt-6">
                           <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 bg-zinc-800 text-white font-bold rounded-xl border border-zinc-700 hover:bg-zinc-700 transition-colors">Ні</button>
                           <button onClick={executeDelete} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-500 shadow-lg shadow-red-900/20 transition-colors">Так, видалити</button>
                       </div>
                   </div>
                </div>
            )}
        </div>
    );
};

export default PromoTab;
