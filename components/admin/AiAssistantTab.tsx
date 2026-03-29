import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Loader2, Save, RefreshCw, Copy, Check, Wand2, ListPlus, Globe, Image as ImageIcon, Search, AlertCircle, ExternalLink, FileText, ChevronRight, Zap, CheckCircle } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { TyreProduct } from '../../types';
import { generateSeoJson, generateSeoBulkJson, normalizeProviderId } from '../../aiSeoClient';
import type { AIProviderId } from '../../aiTypes';
import { fetchAdminAiKeyStatus, hasProviderKey, type AdminAiKeyStatus } from '../../aiProxyClient';

const AiAssistantTab: React.FC = () => {
  const [products, setProducts] = useState<TyreProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingProducts, setFetchingProducts] = useState(true);
  const [enhancementResult, setEnhancementResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'attention' | 'ready'>('attention');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const [aiKeyStatus, setAiKeyStatus] = useState<AdminAiKeyStatus | null>(null);
  const [aiProvider, setAiProvider] = useState<AIProviderId>('gemini');
  const [aiSettingsReady, setAiSettingsReady] = useState(false);

  const hasActiveProviderKey = useCallback(() => {
    if (!aiKeyStatus) return false;
    return hasProviderKey(aiKeyStatus, aiProvider);
  }, [aiProvider, aiKeyStatus]);

  const loadAiSettings = useCallback(async () => {
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .eq('key', 'ai_provider')
      .maybeSingle();
    const providerRaw = data?.value ?? '';
    setAiProvider(normalizeProviderId(providerRaw));
    try {
      const status = await fetchAdminAiKeyStatus();
      setAiKeyStatus(status);
    } catch {
      setAiKeyStatus({ hasGemini: false, hasOpenai: false, hasGroq: false });
    }
    setAiSettingsReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadAiSettings();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [loadAiSettings]);

  const persistAiProvider = async (p: AIProviderId) => {
    setAiProvider(p);
    await supabase.from('settings').upsert({ key: 'ai_provider', value: p });
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setFetchingProducts(true);
    try {
      const { data, error } = await supabase
        .from('tyres')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      console.error("Error fetching products:", err);
      setError("Помилка завантаження товарів");
    } finally {
      setFetchingProducts(false);
    }
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const enhanceProduct = async () => {
    if (!selectedProduct) return;
    if (!hasActiveProviderKey()) {
      setError('Не знайдено API-ключ для обраного провайдера. Відкрийте «Налаштування» → «Безпека / API», додайте ключ і збережіть.');
      return;
    }
    setLoading(true);
    setError('');
    setEnhancementResult(null);

    try {
      const systemPrompt = `
        Ти - SEO-копірайтер магазину "Форсаж". 
        Згенеруй стислі текстові дані для шини: ${selectedProduct.title}.
        
        КРИТИЧНО ВАЖЛИВО (STRICT MODE):
        1. "seo_title": Заголовок (до 60 симв). Формат: [Бренд] [Модель] - купити в Україні | Форсаж.
        2. "seo_description": Опис (до 160 симв) для Google.
        3. "description": Лаконічний опис (200-300 симв) українською мовою про ключові переваги.
        4. "seo_keywords": 5 ключових слів через кому.
        5. "manufacturer": Бренд (наприклад "Nexen", "Michelin").
        6. "width": Ширина шини (тільки цифри, наприклад "245").
        7. "height": Профіль (цифри, наприклад "45").
        8. "radius": Радіус (наприклад "R19" або "R15C").
        9. "season": Сезон ("Зимові", "Літні" або "Всесезонні"). Особлива увага: якщо в назві є ice, snow, winter, spike - Зимові.
        10. "vehicle_type": Тип транспорту (строго одне з цих слів: "car", "suv", "cargo", "truck", "agro").

        Поверни ОДИН JSON-об'єкт з цими полями. ПОЛЯ НЕ МАЮТЬ БУТИ ПОРОЖНІМИ.
      `;

      const parsed = await generateSeoJson({
        provider: aiProvider,
        systemPrompt,
        userPrompt: `Згенеруй повні текстові дані для: ${selectedProduct.title}.`,
      });
      setEnhancementResult(parsed);
    } catch (err: any) {
      console.error("Enhancement Error:", err);
      const msg = err.message || "";
      if (msg.includes('INVALID_API_KEY')) {
        setError("Ключ не працює, надайте інший");
      } else {
        setError(msg || "Сталася помилка при покращенні.");
      }
    } finally {
      setLoading(false);
    }
  };

  const updateProduct = async (fieldUpdates: any) => {
    if (!selectedProductId) return;
    setLoading(true);

    try {
      let finalUpdates = { ...fieldUpdates };
      
      // Handle gallery updates separately to append
      if (fieldUpdates.gallery_item) {
        const currentGallery = selectedProduct?.gallery || [];
        if (!currentGallery.includes(fieldUpdates.gallery_item)) {
          finalUpdates = { gallery: [...currentGallery, fieldUpdates.gallery_item] };
        } else {
          alert("Це зображення вже є у галереї");
          setLoading(false);
          return;
        }
      }

      // Ensure all strings are properly cast and trimmed
      const sanitizedUpdates: any = {};
      Object.keys(finalUpdates).forEach(key => {
        if (key === 'gallery') {
          sanitizedUpdates[key] = finalUpdates[key];
        } else if (typeof finalUpdates[key] === 'string') {
          sanitizedUpdates[key] = finalUpdates[key].trim();
        } else {
          sanitizedUpdates[key] = finalUpdates[key];
        }
      });

      const { data, error } = await supabase
        .from('tyres')
        .update(sanitizedUpdates)
        .eq('id', selectedProductId)
        .select();

      if (error) {
        console.error("Supabase update error detail:", error);
        throw error;
      }

      
      // Update local state immediately
      setProducts(prev => prev.map(p => p.id === selectedProductId ? { ...p, ...sanitizedUpdates } : p));
      
      if (fieldUpdates.gallery_item) {
        alert("Зображення додано до галереї!");
      } else {
        alert("Дані успішно збережено в базі!");
      }
    } catch (err: any) {
      console.error("Update failed with error:", err);
      alert("Помилка оновлення: " + (err.message || "Невідома помилка бази даних"));
    } finally {
      setLoading(false);
    }
  };

  const applyAll = async () => {
    if (!enhancementResult || !selectedProductId) return;
    
    if (!enhancementResult.seo_title || !enhancementResult.seo_description) {
      if (!confirm("Увага: SEO заголовок або опис порожні. Ви впевнені, що хочете зберегти такі дані?")) return;
    }

    const updates = {
      description: String(enhancementResult.description || ''),
      seo_title: String(enhancementResult.seo_title || ''),
      seo_description: String(enhancementResult.seo_description || ''),
      seo_keywords: String(enhancementResult.seo_keywords || ''),
      width: String(enhancementResult.width || ''),
      height: String(enhancementResult.height || ''),
      radius: String(enhancementResult.radius || ''),
      manufacturer: String(enhancementResult.manufacturer || ''),
      season: String(enhancementResult.season || ''),
      vehicle_type: String(enhancementResult.vehicle_type || '')
    };
    
    await updateProduct(updates);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filterMode === 'attention') {
      return !p.description || p.image_url?.includes('picsum.photos') || !p.seo_title;
    }
    if (filterMode === 'ready') {
      return p.description && !p.image_url?.includes('picsum.photos') && p.seo_title;
    }
    return true;
  });

  const productsNeedingAttention = products.filter(p => 
    !p.description || 
    p.image_url?.includes('picsum.photos') || 
    !p.seo_title
  );

  const startBulkEnhance = async () => {
    setShowBulkConfirm(false);
    if (!hasActiveProviderKey()) {
      alert('Не знайдено API-ключ для обраного провайдера. Відкрийте «Налаштування» → «Безпека / API», додайте ключ і збережіть.');
      return;
    }
    const targets = productsNeedingAttention;
    
    setIsBulkProcessing(true);
    setBulkProgress({ current: 0, total: targets.length });

    // Разбиваем товары на группы по 50 штук
    const CHUNK_SIZE = 50;
    const chunks: typeof targets[] = [];
    for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
      chunks.push(targets.slice(i, i + CHUNK_SIZE));
    }

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        const systemPrompt = `
          Ти - SEO-експерт магазину "Форсаж". Тобі надано масив об'єктів (товарів).
          Згенеруй JSON об'єкт з властивістю "results", що містить масив об'єктів для кожного товару.
          ОБОВ'ЯЗКОВО ЗАПОВНИ ВСІ ПОЛЯ ДЛЯ КОЖНОГО ТОВАРУ (STRICT MODE):
          1. id: Залишити той самий id.
          2. description: Лаконічний опис (200-300 симв).
          3. seo_title: SEO заголовок (до 60 симв).
          4. seo_description: SEO опис (до 160 симв).
          5. seo_keywords: 5 ключових слів через кому.
          6. manufacturer: Бренд (наприклад "Nexen").
          7. width: Ширина шини (тільки цифри, наприклад "245").
          8. height: Профіль (цифри, наприклад "45").
          9. radius: Радіус (наприклад "R19" або "R15C").
          10. season: Сезон ("Зимові", "Літні" або "Всесезонні").
          11. vehicle_type: Тип (строго слово зі списку: "car", "suv", "cargo", "truck", "agro").
        `;

        const userPrompt = JSON.stringify(chunk.map(p => ({ id: p.id, title: p.title })));

        const parsedBulk = await generateSeoBulkJson({
          provider: aiProvider,
          systemPrompt,
          userPrompt,
        });

        // Записуємо результати в базу даних
        for (const item of parsedBulk.results) {
          if (!item.id) continue;
          const updates = {
            description: String(item.description ?? ''),
            seo_title: String(item.seo_title ?? ''),
            seo_description: String(item.seo_description ?? ''),
            seo_keywords: String(item.seo_keywords ?? ''),
            width: String(item.width ?? ''),
            height: String(item.height ?? ''),
            radius: String(item.radius ?? ''),
            manufacturer: String(item.manufacturer ?? ''),
            season: String(item.season ?? ''),
            vehicle_type: String(item.vehicle_type ?? '')
          };
          const { error: updateError } = await supabase.from('tyres').update(updates).eq('id', item.id);
          if (updateError) console.error('Помилка оновлення', item.id, updateError);
        }

        const currentCount = Math.min((i + 1) * CHUNK_SIZE, targets.length);
        setBulkProgress({ current: currentCount, total: targets.length });
        
        // Guarantee to stay under 15 RPM for free limits: 1 request per ~4.5 seconds
        await new Promise(r => setTimeout(r, 4500));
      }
    } catch (err: any) {
      console.error('Bulk generate error:', err);
      if (err.message?.includes('INVALID_API_KEY')) {
        alert("Помилка: Ключ не працює, надайте інший. Масову генерацію зупинено.");
      } else {
        alert("Помилка при генерації: " + err.message);
      }
    }

    setIsBulkProcessing(false);
    alert("Масова генерація завершена!");
    fetchProducts();
  };

  const bulkEnhance = () => {
    if (productsNeedingAttention.length === 0) {
      alert("Немає товарів, що потребують уваги.");
      return;
    }
    setShowBulkConfirm(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Sidebar: Product List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col h-[750px]">
            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black uppercase tracking-tight">Товари</h3>
                  <button 
                    onClick={fetchProducts}
                    className="p-1.5 bg-zinc-800 rounded-lg text-white hover:bg-zinc-700 transition-colors"
                    title="Оновити список"
                  >
                    <RefreshCw size={12} className={fetchingProducts ? 'animate-spin' : ''} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={bulkEnhance}
                    disabled={isBulkProcessing || fetchingProducts}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#FFC300] hover:bg-[#e6b000] disabled:bg-zinc-800 text-black text-[10px] font-black uppercase rounded-lg transition-all shadow-lg shadow-[#FFC300]/20"
                  >
                    {isBulkProcessing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                    АВТОМАТИЧНО ОБРОБИТИ ВСІ ({productsNeedingAttention.length})
                  </button>
                </div>
              </div>

              {isBulkProcessing && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase text-orange-500">
                    <span>Обробка товарів...</span>
                    <span>{bulkProgress.current} / {bulkProgress.total}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 transition-all duration-500" 
                      style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex p-1 bg-black border border-zinc-800 rounded-xl">
                <button 
                  onClick={() => setFilterMode('attention')}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${filterMode === 'attention' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Увага ({productsNeedingAttention.length})
                </button>
                <button 
                  onClick={() => setFilterMode('ready')}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${filterMode === 'ready' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Готові ({products.length - productsNeedingAttention.length})
                </button>
                <button 
                  onClick={() => setFilterMode('all')}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${filterMode === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Всі
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <input 
                  type="text"
                  placeholder="Пошук шин за назвою..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-[#FFC300] transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {fetchingProducts ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <Loader2 className="animate-spin mb-2" size={24} />
                  <span className="text-xs">Завантаження бази даних...</span>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-zinc-600 text-sm">Товарів не знайдено</div>
              ) : (
                filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => {
                      setSelectedProductId(product.id);
                      setEnhancementResult(null);
                      setError('');
                      setManualSearchQuery('');
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all group relative overflow-hidden ${
                      selectedProductId === product.id 
                        ? 'bg-[#FFC300] border-[#FFC300] text-black' 
                        : 'bg-black border-zinc-800 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2 relative z-10">
                      <span className="font-bold text-sm line-clamp-2 leading-tight">{product.title}</span>
                      {(!product.description || product.image_url?.includes('picsum.photos') || !product.seo_title) ? (
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${selectedProductId === product.id ? 'bg-black' : 'bg-orange-500'}`} title="Потребує уваги" />
                      ) : (
                        <Check size={14} className={selectedProductId === product.id ? 'text-black' : 'text-green-500'} />
                      )}
                    </div>
                    <div className="flex gap-2 mt-1.5 opacity-60 text-[10px] font-black uppercase relative z-10">
                      <span>{product.manufacturer}</span>
                      <span>•</span>
                      <span>{product.width}/{product.height} {product.radius}</span>
                    </div>
                    {selectedProductId === product.id && (
                      <div className="absolute right-0 top-0 bottom-0 w-1 bg-black/20" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Main Content: Enhancement Area */}
        <div className="lg:col-span-8 space-y-6">
          {!selectedProductId ? (
            <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-2xl h-[750px] flex flex-col items-center justify-center text-zinc-500 p-12 text-center">
              <div className="w-24 h-24 bg-zinc-800 rounded-3xl flex items-center justify-center mb-6 rotate-3">
                <Wand2 size={48} className="text-zinc-600" />
              </div>
              <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tight">Оберіть товар</h3>
              <p className="max-w-md text-sm text-zinc-500 leading-relaxed">
                Виберіть шину зі списку ліворуч. AI допоможе знайти реальні фотографії, створити професійний опис та налаштувати SEO для кращого просування в Google.
              </p>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl h-[750px] flex flex-col overflow-hidden">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-black border border-zinc-800 rounded-2xl overflow-hidden shadow-inner flex-shrink-0">
                    <img 
                      src={selectedProduct?.image_url} 
                      alt="" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black uppercase leading-tight tracking-tight">{selectedProduct?.title}</h2>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-black bg-zinc-800 text-zinc-400 px-2 py-1 rounded uppercase">ID: {selectedProduct?.id}</span>
                      <span className="text-[10px] font-black bg-zinc-800 text-zinc-400 px-2 py-1 rounded uppercase">{selectedProduct?.manufacturer}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => enhanceProduct()}
                  disabled={loading}
                  className="w-full sm:w-auto bg-[#FFC300] hover:bg-[#e6b000] disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black px-8 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-[0_10px_30px_rgba(255,195,0,0.2)]"
                >
                  {loading ? <Loader2 className="animate-spin" size={24} /> : <Sparkles size={24} />}
                  ЗГЕНЕРУВАТИ ОПИС ТА SEO
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-10 pr-2 custom-scrollbar pb-10">
                {error && (
                  <div className="p-5 bg-red-900/10 border border-red-900/30 rounded-2xl text-red-400 text-sm flex items-center gap-4 animate-in shake duration-300">
                    <AlertCircle size={24} />
                    <div>
                      <p className="font-bold">Помилка AI</p>
                      <p className="opacity-80">{error}</p>
                    </div>
                  </div>
                )}

                {enhancementResult ? (
                  <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
                    <div className="flex justify-center pt-4">
                      <button 
                        onClick={applyAll}
                        className="bg-white/10 hover:bg-white/20 text-white font-black px-10 py-4 rounded-2xl flex items-center gap-3 transition-all border border-white/10"
                      >
                        <Check size={20} />
                        ЗАСТОСУВАТИ ВСЕ (ОПИС + SEO)
                      </button>
                    </div>

                    {/* Description Section */}
                    <section className="bg-black/40 border border-zinc-800/50 rounded-3xl p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-500/10 text-blue-500 rounded-lg flex items-center justify-center">
                            <FileText size={18} />
                          </div>
                          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Професійний опис</h3>
                        </div>
                        <button 
                          onClick={() => updateProduct({ description: enhancementResult.description })}
                          className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase px-4 py-2 rounded-full transition-all border border-blue-500/20"
                        >
                          Застосувати опис
                        </button>
                      </div>
                      <div className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap font-medium">
                        {enhancementResult.description}
                      </div>
                    </section>

                    {/* SEO Section */}
                    <section className="bg-black/40 border border-zinc-800/50 rounded-3xl p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-500/10 text-green-500 rounded-lg flex items-center justify-center">
                            <Globe size={18} />
                          </div>
                          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">SEO Оптимізація</h3>
                        </div>
                        <button 
                          onClick={() => updateProduct({ 
                            seo_title: enhancementResult.seo_title,
                            seo_description: enhancementResult.seo_description,
                            seo_keywords: enhancementResult.seo_keywords
                          })}
                          className="bg-green-500/10 hover:bg-green-500/20 text-green-400 text-[10px] font-black uppercase px-4 py-2 rounded-full transition-all border border-green-500/20"
                        >
                          Застосувати SEO дані
                        </button>
                      </div>
                      <div className="space-y-4">
                        <div className={`bg-zinc-900/50 border p-4 rounded-2xl ${!enhancementResult.seo_title ? 'border-red-500/50 bg-red-500/5' : 'border-zinc-800'}`}>
                          <span className="block text-[10px] font-black text-zinc-600 uppercase mb-2 tracking-tighter">Google Search Title</span>
                          <p className="text-sm text-blue-400 font-bold">{enhancementResult.seo_title || 'НЕ ЗГЕНЕРОВАНО'}</p>
                        </div>
                        <div className={`bg-zinc-900/50 border p-4 rounded-2xl ${!enhancementResult.seo_description ? 'border-red-500/50 bg-red-500/5' : 'border-zinc-800'}`}>
                          <span className="block text-[10px] font-black text-zinc-600 uppercase mb-2 tracking-tighter">Meta Description</span>
                          <p className="text-sm text-zinc-400 leading-snug">{enhancementResult.seo_description || 'НЕ ЗГЕНЕРОВАНО'}</p>
                        </div>
                        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
                          <span className="block text-[10px] font-black text-zinc-600 uppercase mb-2 tracking-tighter">Keywords</span>
                          <div className="flex flex-wrap gap-2">
                            {enhancementResult.seo_keywords?.split(',').map((kw: string, i: number) => (
                              <span key={i} className="px-2 py-1 bg-zinc-800 rounded-lg text-[9px] text-zinc-500 border border-zinc-700 font-bold">
                                {kw.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-6 py-20">
                    <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center border border-zinc-800 shadow-inner">
                      <Search size={36} className="text-zinc-700" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-zinc-400 uppercase tracking-tight">Готовий до аналізу</p>
                      <p className="text-xs max-w-[280px] mx-auto mt-2 text-zinc-600 leading-relaxed">
                        Натисніть кнопку генерації, щоб AI проаналізував модель шини та створив професійний опис і SEO дані.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats / Info Footer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl flex items-center gap-5 hover:border-orange-500/30 transition-colors group">
          <div className="w-14 h-14 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <AlertCircle size={28} />
          </div>
          <div>
            <div className="text-3xl font-black tracking-tighter">{productsNeedingAttention.length}</div>
            <div className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Потребують уваги</div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl flex items-center gap-5 hover:border-green-500/30 transition-colors group">
          <div className="w-14 h-14 bg-green-500/10 text-green-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Check size={28} />
          </div>
          <div>
            <div className="text-3xl font-black tracking-tighter">{products.length - productsNeedingAttention.length}</div>
            <div className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Повністю готові</div>
          </div>
        </div>
      </div>

      {/* Helper Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl">
          <div className="w-10 h-10 bg-purple-500/10 text-purple-500 rounded-lg flex items-center justify-center mb-4">
            <FileText size={20} />
          </div>
          <h4 className="font-bold mb-1">Генерація описів</h4>
          <p className="text-xs text-zinc-500">Створення професійних технічних описів українською мовою для кожного товару.</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl">
          <div className="w-10 h-10 bg-green-500/10 text-green-500 rounded-lg flex items-center justify-center mb-4">
            <Globe size={20} />
          </div>
          <h4 className="font-bold mb-1">SEO Оптимізація</h4>
          <p className="text-xs text-zinc-500">Автоматичне створення мета-тегів для кращого ранжування в пошукових системах.</p>
        </div>
      </div>

      {/* Bulk Confirm Modal */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm relative shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="bg-[#FFC300]/10 p-4 rounded-full text-[#FFC300] mb-4 border border-[#FFC300]/20 w-16 h-16 flex items-center justify-center mx-auto">
              <Zap size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">Запустити масову обробку?</h3>
            <p className="text-zinc-400 text-sm mb-6">
              AI автоматично згенерує описи та SEO дані для <span className="text-[#FFC300] font-bold">{productsNeedingAttention.length}</span> товарів. Це може зайняти кілька хвилин.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowBulkConfirm(false)} 
                className="flex-1 py-3 bg-zinc-800 text-white rounded-xl font-bold border border-zinc-700 hover:bg-zinc-700 transition-colors"
              >
                Скасувати
              </button>
              <button 
                onClick={startBulkEnhance} 
                className="flex-1 py-3 bg-[#FFC300] text-black rounded-xl font-bold hover:bg-[#e6b000] transition-colors shadow-lg shadow-[#FFC300]/20"
              >
                Запустити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiAssistantTab;
