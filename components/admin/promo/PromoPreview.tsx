
import React from 'react';
import { Megaphone, ChevronRight } from 'lucide-react';
import { Banner, DEFAULT_IMG_CONFIG, DEFAULT_BG_CONFIG } from './shared';

interface PromoPreviewProps {
    banner: Banner;
}

const PromoPreview: React.FC<PromoPreviewProps> = ({ banner }) => {
    const imgConfig = { ...DEFAULT_IMG_CONFIG, ...(banner.imageConfig || {}) };
    const bgConfig = { ...DEFAULT_BG_CONFIG, ...(banner.backgroundConfig || {}) };

    // MASK LOGIC - Properly formatted for inline styles
    let maskImageStyle: React.CSSProperties = {};
    if (imgConfig.vignette) {
        if (imgConfig.maskType === 'linear') {
            const fadeStart = Math.max(0, 50 - (imgConfig.vignetteStrength / 2)); 
            // Direction determines where the transparency starts.
            // to right: starts visible left, fades to transparent right.
            const direction = imgConfig.maskDirection || 'right';
            const val = `linear-gradient(to ${direction}, black 0%, black ${fadeStart}%, transparent 100%)`;
            maskImageStyle = {
                maskImage: val,
                WebkitMaskImage: val
            };
        } else {
            const maskStop = Math.max(0, 95 - imgConfig.vignetteStrength);
            const val = `radial-gradient(circle at center, black ${maskStop}%, transparent 100%)`;
            maskImageStyle = {
                maskImage: val,
                WebkitMaskImage: val
            };
        }
    }

    return (
        <div className={`w-full rounded-3xl p-8 md:p-12 text-white shadow-2xl relative overflow-hidden min-h-[400px] flex items-center transition-colors duration-500 ${banner.color} group`}>
            
            {/* 1. CUSTOM BACKGROUND IMAGE LAYER */}
            {banner.backgroundImage && (
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <img 
                        src={banner.backgroundImage} 
                        className="w-full h-full object-cover transition-opacity duration-300"
                        style={{ 
                            opacity: (bgConfig.opacity ?? 100) / 100,
                            objectPosition: `center ${bgConfig.positionY ?? 50}%`
                        }}
                        alt=""
                    />
                    {/* Dark Overlay for readability */}
                    <div 
                        className="absolute inset-0 bg-black transition-opacity duration-300"
                        style={{ opacity: (bgConfig.overlayOpacity ?? 40) / 100 }}
                    ></div>
                </div>
            )}

            {/* 2. PATTERN LAYER */}
            {banner.pattern && banner.pattern !== 'none' && (
                <div 
                    className="absolute inset-0 z-0 pointer-events-none"
                    style={{ 
                        backgroundImage: banner.pattern,
                        opacity: (banner.patternOpacity || 10) / 100,
                        backgroundSize: 'auto', 
                        backgroundRepeat: 'repeat',
                        mixBlendMode: 'screen'
                    }}
                ></div>
            )}

            {/* 3. CONTENT CONTAINER */}
            <div className="relative z-20 flex flex-col md:flex-row items-center justify-between gap-8 w-full">
                
                {/* TEXT CONTENT */}
                <div className="flex-grow max-w-xl z-20 relative">
                    
                    {/* Modern Badge */}
                    <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-md border border-[#FFC300]/50 text-[#FFC300] px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest mb-6 shadow-[0_0_15px_rgba(255,195,0,0.2)]">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#FFC300] animate-pulse"></div>
                        {banner.id ? 'АКТИВНА ПРОПОЗИЦІЯ' : 'АКЦІЯ'}
                    </div>
                    
                    <h3 className="text-4xl md:text-6xl font-black uppercase italic leading-tight mb-6 drop-shadow-xl tracking-tighter text-white">
                        {banner.title || 'ЗАГОЛОВОК'}
                    </h3>
                    
                    <div className="pl-4 border-l-2 border-[#FFC300] mb-8 max-w-md">
                        <p className="text-lg font-medium text-zinc-300 leading-snug">
                            {banner.text || 'Текст опису...'}
                        </p>
                    </div>

                    <button className="bg-[#FFC300] text-black font-black text-sm md:text-base px-8 py-4 rounded-xl uppercase tracking-widest hover:bg-[#e6b000] hover:shadow-[0_0_20px_rgba(255,195,0,0.5)] active:scale-95 transition-all flex items-center gap-3 group/btn">
                        {banner.buttonText || 'ДЕТАЛЬНІШЕ'}
                        <ChevronRight size={18} className="group-hover/btn:translate-x-1 transition-transform"/>
                    </button>
                </div>
                
                {/* 4. PRODUCT IMAGE COMPONENT */}
                <div className="absolute right-0 top-0 bottom-0 w-1/2 h-full z-10 pointer-events-none hidden md:flex items-center justify-center">
                    {banner.image_url ? (
                        <div 
                            className="relative w-full h-full flex items-center justify-center"
                            style={{
                                // Transform applied to wrapper for positioning/scaling
                                transform: `scale(${imgConfig.scale / 100}) translate(${imgConfig.xOffset}px, ${imgConfig.yOffset}px)`,
                                opacity: (imgConfig.opacity || 100) / 100
                            }}
                        >
                            {/* Glow Effect - Applied behind image */}
                            {imgConfig.glow && (
                                <div 
                                    className="absolute inset-0 bg-[#FFC300]/30 blur-[80px] rounded-full scale-90 pointer-events-none"
                                    style={{ mixBlendMode: 'screen' }}
                                ></div>
                            )}
                            
                            {/* Main Image with Shadow and Mask */}
                            <img 
                                src={banner.image_url} 
                                className={`
                                    max-w-none max-h-none object-contain relative z-10
                                    ${imgConfig.shadow ? 'drop-shadow-[0_25px_50px_rgba(0,0,0,0.8)]' : ''}
                                `}
                                style={{
                                    height: '100%',
                                    // Mask applied directly to IMG
                                    ...maskImageStyle
                                }}
                                alt="Promo" 
                            />
                        </div>
                    ) : (
                        <Megaphone size={200} className="text-white/5 -rotate-12" />
                    )}
                </div>
            </div>
        </div>
    );
};

export default PromoPreview;
