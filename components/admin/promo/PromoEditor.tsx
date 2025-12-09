
import React, { useRef } from 'react';
import { Palette, Trash2, Image as ImageIcon, Loader2, X, CheckCircle, Upload, MoveVertical, MoveHorizontal, Maximize, Wand2, Grid as GridIcon, Layers, Sun, MousePointer2, ImagePlus, ArrowRight, ArrowLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { Banner, DEFAULT_IMG_CONFIG, DEFAULT_BG_CONFIG, PRESET_COLORS, PATTERNS } from './shared';

interface PromoEditorProps {
    banner: Banner;
    onUpdate: (field: keyof Banner, value: any) => void;
    onUpdateImageConfig: (field: string, value: any) => void;
    onUploadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onUploadBackground: (e: React.ChangeEvent<HTMLInputElement>) => void;
    uploading: boolean;
}

const PromoEditor: React.FC<PromoEditorProps> = ({ banner, onUpdate, onUpdateImageConfig, onUploadImage, onUploadBackground, uploading }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const bgInputRef = useRef<HTMLInputElement>(null);
    
    const imgConfig = { ...DEFAULT_IMG_CONFIG, ...(banner.imageConfig || {}) };
    const bgConfig = { ...DEFAULT_BG_CONFIG, ...(banner.backgroundConfig || {}) };

    const updateBgConfig = (field: string, value: any) => {
        const newConfig = { ...bgConfig, [field]: value };
        onUpdate('backgroundConfig', newConfig);
    };

    return (
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-6">
            
            {/* STATUS TOGGLE */}
            <div className="flex items-center justify-between bg-black p-4 rounded-xl border border-zinc-700">
                <span className="font-bold text-white">Статус показу</span>
                <button 
                    onClick={() => onUpdate('active', !banner.active)}
                    className={`px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 ${banner.active ? 'bg-green-500 text-black' : 'bg-red-900/50 text-red-500'}`}
                >
                    {banner.active ? <CheckCircle size={16}/> : <X size={16}/>}
                    {banner.active ? 'АКТИВНИЙ' : 'ПРИХОВАНО'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Заголовок</label>
                        <input 
                            type="text" 
                            value={banner.title} 
                            onChange={e => onUpdate('title', e.target.value)}
                            className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-bold" 
                        />
                    </div>
                    <div>
                        <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Текст опису</label>
                        <textarea 
                            value={banner.text} 
                            onChange={e => onUpdate('text', e.target.value)}
                            className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white h-24 text-sm" 
                        />
                    </div>
                </div>
                <div className="space-y-4">
                        <div>
                        <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Зображення (Товар)</label>
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 bg-black rounded-lg border border-zinc-700 flex items-center justify-center overflow-hidden relative group">
                                {banner.image_url ? (
                                    <>
                                        <img src={banner.image_url} className="w-full h-full object-cover" />
                                        <button 
                                            onClick={() => onUpdate('image_url', '')}
                                            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                                        >
                                            <Trash2 size={20}/>
                                        </button>
                                    </>
                                ) : (
                                    <ImageIcon className="text-zinc-600" />
                                )}
                            </div>
                            <div className="flex-grow">
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg font-bold text-sm w-full border border-zinc-700 flex items-center justify-center gap-2"
                                >
                                    {uploading ? <Loader2 className="animate-spin" size={16}/> : <Upload size={16}/>}
                                    Завантажити фото
                                </button>
                                <input type="file" ref={fileInputRef} onChange={onUploadImage} className="hidden" accept="image/*" />
                                <p className="text-[10px] text-zinc-500 mt-2 leading-tight">PNG з прозорим фоном найкраще.</p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Кнопка</label>
                            <input 
                                type="text" 
                                value={banner.buttonText} 
                                onChange={e => onUpdate('buttonText', e.target.value)}
                                className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white text-sm" 
                            />
                        </div>
                        <div>
                            <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Дія</label>
                            <select 
                                value={banner.link}
                                onChange={e => onUpdate('link', e.target.value)}
                                className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white text-sm font-bold"
                            >
                                <option value="shop">Магазин</option>
                                <option value="booking">Запис</option>
                                <option value="phone">Дзвінок</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* PRODUCT IMAGE EFFECTS */}
            {banner.image_url && (
                <div className="bg-black/40 p-4 rounded-xl border border-zinc-700 animate-in fade-in">
                    <h4 className="text-zinc-400 font-bold uppercase text-xs mb-3 flex items-center gap-2"><MousePointer2 size={14}/> Налаштування фото товару</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                                    <span>Розмір (Scale)</span>
                                    <span>{imgConfig.scale}%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Maximize size={16} className="text-zinc-500"/>
                                    <input 
                                        type="range" min="50" max="250" step="5"
                                        value={imgConfig.scale}
                                        onChange={e => onUpdateImageConfig('scale', parseInt(e.target.value))}
                                        className="w-full accent-[#FFC300]"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                                    <span>Зсув X (Вліво/Вправо)</span>
                                    <span>{imgConfig.xOffset || 0}px</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MoveHorizontal size={16} className="text-zinc-500"/>
                                    <input 
                                        type="range" min="-300" max="300" step="10"
                                        value={imgConfig.xOffset || 0}
                                        onChange={e => onUpdateImageConfig('xOffset', parseInt(e.target.value))}
                                        className="w-full accent-[#FFC300]"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                                    <span>Зсув Y (Вгору/Вниз)</span>
                                    <span>{imgConfig.yOffset}px</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MoveVertical size={16} className="text-zinc-500"/>
                                    <input 
                                        type="range" min="-150" max="150" step="10"
                                        value={imgConfig.yOffset}
                                        onChange={e => onUpdateImageConfig('yOffset', parseInt(e.target.value))}
                                        className="w-full accent-[#FFC300]"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <button 
                                    onClick={() => onUpdateImageConfig('shadow', !imgConfig.shadow)}
                                    className={`px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${imgConfig.shadow ? 'bg-zinc-800 border-[#FFC300] text-white' : 'bg-transparent border-zinc-700 text-zinc-500'}`}
                                >
                                    Тінь (Shadow)
                                </button>
                                <button 
                                    onClick={() => onUpdateImageConfig('glow', !imgConfig.glow)}
                                    className={`px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${imgConfig.glow ? 'bg-zinc-800 border-[#FFC300] text-white' : 'bg-transparent border-zinc-700 text-zinc-500'}`}
                                >
                                    Світіння (Glow)
                                </button>
                            </div>

                            <div className={`p-3 rounded-lg border transition-colors ${imgConfig.vignette ? 'bg-zinc-800 border-[#FFC300]' : 'border-zinc-700'}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <button 
                                        onClick={() => onUpdateImageConfig('vignette', !imgConfig.vignette)}
                                        className={`text-xs font-bold flex items-center gap-2 ${imgConfig.vignette ? 'text-white' : 'text-zinc-500'}`}
                                    >
                                        <div className={`w-3 h-3 rounded-full ${imgConfig.vignette ? 'bg-[#FFC300]' : 'bg-zinc-600'}`}></div>
                                        Розмиття (Mask)
                                    </button>
                                    
                                    {imgConfig.vignette && (
                                        <div className="flex bg-black rounded p-1">
                                            <button 
                                                onClick={() => onUpdateImageConfig('maskType', 'linear')}
                                                className={`px-2 py-0.5 text-[10px] rounded ${imgConfig.maskType === 'linear' ? 'bg-white text-black' : 'text-zinc-500'}`}
                                            >
                                                Лінійне
                                            </button>
                                            <button 
                                                onClick={() => onUpdateImageConfig('maskType', 'radial')}
                                                className={`px-2 py-0.5 text-[10px] rounded ${imgConfig.maskType !== 'linear' ? 'bg-white text-black' : 'text-zinc-500'}`}
                                            >
                                                Кругове
                                            </button>
                                        </div>
                                    )}
                                </div>
                                
                                {imgConfig.vignette && (
                                    <div className="pt-2 space-y-3">
                                        {imgConfig.maskType === 'linear' && (
                                            <div>
                                                <div className="text-[10px] text-zinc-400 mb-1">Напрямок згасання (куди зникає):</div>
                                                <div className="flex gap-2">
                                                    {[
                                                        { dir: 'left', icon: ArrowLeft },
                                                        { dir: 'right', icon: ArrowRight },
                                                        { dir: 'top', icon: ArrowUp },
                                                        { dir: 'bottom', icon: ArrowDown },
                                                    ].map((item) => (
                                                        <button 
                                                            key={item.dir}
                                                            onClick={() => onUpdateImageConfig('maskDirection', item.dir)}
                                                            className={`p-2 rounded flex-1 flex justify-center ${imgConfig.maskDirection === item.dir ? 'bg-[#FFC300] text-black' : 'bg-black text-zinc-500'}`}
                                                            title={`Зникає в ${item.dir}`}
                                                        >
                                                            <item.icon size={14} />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                                                <span>Сила розмиття</span>
                                                <span>{imgConfig.vignetteStrength || 30}%</span>
                                            </div>
                                            <input 
                                                type="range" min="0" max="100" step="5"
                                                value={imgConfig.vignetteStrength || 30}
                                                onChange={e => onUpdateImageConfig('vignetteStrength', parseInt(e.target.value))}
                                                className="w-full accent-[#FFC300] h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                                    <span>Прозорість фото</span>
                                    <span>{imgConfig.opacity || 100}%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Sun size={16} className="text-zinc-500"/>
                                    <input 
                                        type="range" min="10" max="100" step="5"
                                        value={imgConfig.opacity || 100}
                                        onChange={e => onUpdateImageConfig('opacity', parseInt(e.target.value))}
                                        className="w-full accent-[#FFC300]"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* BACKGROUND SETTINGS */}
            <div>
                <h4 className="text-zinc-400 font-bold uppercase text-xs mb-3 flex items-center gap-2"><Palette size={14}/> Стиль фону</h4>
                
                <div className="flex gap-2 flex-wrap mb-4">
                    {PRESET_COLORS.map((c, idx) => (
                        <button 
                            key={idx}
                            onClick={() => onUpdate('color', c.value)}
                            className={`w-10 h-10 rounded-full border-2 transition-all shadow-lg ${c.value} ${banner.color === c.value ? 'border-white scale-110 ring-2 ring-[#FFC300] ring-offset-2 ring-offset-black' : 'border-transparent opacity-70 hover:opacity-100'}`}
                            title={c.name}
                        />
                    ))}
                </div>

                <div className="bg-black/40 p-4 rounded-xl border border-zinc-700 space-y-6">
                    {/* CUSTOM BG IMAGE */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-zinc-400 text-xs font-bold uppercase flex items-center gap-2">
                                <ImagePlus size={14}/> Фонове зображення
                            </label>
                            {banner.backgroundImage && (
                                <button onClick={() => onUpdate('backgroundImage', '')} className="text-red-500 text-xs font-bold hover:underline">Видалити фон</button>
                            )}
                        </div>
                        
                        {banner.backgroundImage ? (
                            <div className="space-y-4 animate-in fade-in">
                                <div className="h-24 w-full rounded-lg overflow-hidden border border-zinc-600 relative">
                                    <img src={banner.backgroundImage} className="w-full h-full object-cover opacity-50" />
                                    <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs drop-shadow-md">Завантажено</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                                            <span>Прозорість фону</span>
                                            <span>{bgConfig.opacity}%</span>
                                        </div>
                                        <input type="range" min="0" max="100" value={bgConfig.opacity} onChange={e => updateBgConfig('opacity', parseInt(e.target.value))} className="w-full accent-[#FFC300]" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                                            <span>Позиція Y (Верх/Низ)</span>
                                            <span>{bgConfig.positionY}%</span>
                                        </div>
                                        <input type="range" min="0" max="100" value={bgConfig.positionY} onChange={e => updateBgConfig('positionY', parseInt(e.target.value))} className="w-full accent-[#FFC300]" />
                                    </div>
                                    <div className="col-span-2">
                                        <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                                            <span>Затемнення (Overlay)</span>
                                            <span>{bgConfig.overlayOpacity}%</span>
                                        </div>
                                        <input type="range" min="0" max="90" value={bgConfig.overlayOpacity} onChange={e => updateBgConfig('overlayOpacity', parseInt(e.target.value))} className="w-full accent-[#FFC300]" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-zinc-700 rounded-lg p-6 text-center hover:border-[#FFC300] transition-colors cursor-pointer" onClick={() => bgInputRef.current?.click()}>
                                <input type="file" ref={bgInputRef} onChange={onUploadBackground} className="hidden" accept="image/*" />
                                <ImagePlus className="mx-auto text-zinc-500 mb-2" />
                                <span className="text-zinc-400 text-sm font-bold block">Завантажити свій фон</span>
                                <span className="text-zinc-600 text-[10px] block mt-1">Рекомендовано: 1920x600px або 16:5</span>
                            </div>
                        )}
                    </div>

                    <div className="w-full h-px bg-zinc-700"></div>

                    {/* PATTERNS */}
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-grow">
                            <label className="block text-zinc-400 text-xs font-bold uppercase mb-2 flex items-center gap-2"><GridIcon size={14}/> Візерунок (Pattern)</label>
                            <select 
                                value={banner.pattern || 'none'}
                                onChange={e => onUpdate('pattern', e.target.value)}
                                className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-white text-sm"
                            >
                                {PATTERNS.map((p, i) => (
                                    <option key={i} value={p.value}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-full md:w-1/3">
                            <label className="block text-zinc-400 text-xs font-bold uppercase mb-2 flex items-center gap-2"><Layers size={14}/> Прозорість візерунка {banner.patternOpacity || 10}%</label>
                            <input 
                                type="range" min="0" max="50" step="1"
                                value={banner.patternOpacity || 10}
                                onChange={e => onUpdate('patternOpacity', parseInt(e.target.value))}
                                className="w-full accent-[#FFC300]"
                                disabled={!banner.pattern || banner.pattern === 'none'}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PromoEditor;
