
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Search, Globe, Save, RefreshCw, CheckCircle, AlertTriangle, Info, BarChart, Image as ImageIcon, Link2, Upload, Loader2, Edit2, LayoutGrid, List, CheckSquare, X } from 'lucide-react';
import { TyreProduct } from '../../types';

const SeoTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'general' | 'products'>('general');
  const [products, setProducts] = useState<TyreProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<TyreProduct | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  const [settings, setSettings] = useState({
    seo_title: 'Шиномонтаж Форсаж Синельникове',
    seo_description: 'Цілодобовий шиномонтаж, продаж шин та дисків. Якісний ремонт, зварювання аргоном. вул. Квітнева 9.',
    seo_keywords: 'шиномонтаж, синельникове, купити шини, ремонт дисків',
    seo_image: '',
    seo_robots: 'index, follow',
    seo_canonical: 'https://forsage-sinelnikove.com'
  });

  const [analysis, setAnalysis] = useState({
    titleLength: 0,
    descLength: 0,
    score: 0,
    issues: [] as string[]
  });

  useEffect(() => {
    fetchSeoSettings();
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
          let query = supabase.from('tyres').select('*').order('created_at', { ascending: false });
          if (productSearch) {
              query = query.ilike('title', `%${productSearch}%`);
          }
          const { data } = await query.limit(100);
          if (data) setProducts(data);
      } catch (e) { console.error(e); }
      finally { setLoadingProducts(false); }
  };

  useEffect(() => {
      const timer = setTimeout(() => {
          if (activeTab === 'products') fetchProducts();
      }, 500);
      return () => clearTimeout(timer);
  }, [productSearch]);

  const handleSaveProductSeo = async () => {
      if (!editingProduct) return;
      setIsSavingProduct(true);
      try {
          const { error } = await supabase.from('tyres').update({
              seo_title: editingProduct.seo_title,
              seo_description: editingProduct.seo_description,
              seo_keywords: editingProduct.seo_keywords,
              slug: editingProduct.slug
          }).eq('id', editingProduct.id);
          
          if (error) throw error;
          
          setProducts(prev => prev.map(p => p.id === editingProduct.id ? editingProduct : p));
          setEditingProduct(null);
          alert("SEO для товару оновлено!");
      } catch (e: any) {
          alert("Помилка: " + e.message);
      } finally {
          setIsSavingProduct(false);
      }
  };

  const generateProductSlug = (title: string) => {
      return title
          .toLowerCase()
          .replace(/[^\w\sа-яіїєґ]/gi, '')
          .replace(/\s+/g, '-')
          .replace(/--+/g, '-')
          .trim();
  };

  const autoFillProductSeo = (product: TyreProduct) => {
      const slug = generateProductSlug(product.title);
      const seo_title = `${product.title} | Купити в Синельникове | Форсаж`;
      const seo_description = `Купити ${product.title} за вигідною ціною в шиномонтажі Форсаж (Синельникове). Гарантія якості, професійний підбір.`;
      const seo_keywords = `${product.manufacturer}, ${product.radius}, купити шини синельникове, ${product.title}`;
      
      setEditingProduct({
          ...product,
          slug,
          seo_title,
          seo_description,
          seo_keywords
      });
  };

  useEffect(() => {
    analyzeSeo();
  }, [settings]);

  const fetchSeoSettings = async () => {
    setLoading(true);
    const { data } = await supabase.from('settings').select('key, value').in('key', ['seo_title', 'seo_description', 'seo_keywords', 'seo_image', 'seo_robots', 'seo_canonical']);
    
    if (data) {
        const newSettings: any = { ...settings };
        data.forEach((item: any) => {
            if (newSettings.hasOwnProperty(item.key)) {
                newSettings[item.key] = item.value;
            }
        });
        setSettings(newSettings);
    }
    setLoading(false);
  };

  const handleChange = (field: string, value: string) => {
      setSettings(prev => ({ ...prev, [field]: value }));
  };

  const analyzeSeo = () => {
      const issues = [];
      let score = 100;

      // Title Analysis (Optimal: 30-60 chars)
      const tLen = settings.seo_title.length;
      if (tLen < 10) { issues.push("Заголовок занадто короткий"); score -= 20; }
      else if (tLen > 60) { issues.push("Заголовок занадто довгий (Google обріже)"); score -= 10; }

      // Description Analysis (Optimal: 120-160 chars)
      const dLen = settings.seo_description.length;
      if (dLen < 50) { issues.push("Опис занадто короткий. Додайте деталі."); score -= 20; }
      else if (dLen > 160) { issues.push("Опис довший за 160 символів (буде обрізано)."); score -= 5; }

      // Keywords Check
      if (!settings.seo_keywords.includes(',')) { issues.push("Розділяйте ключові слова комою."); score -= 10; }
      const keywords = settings.seo_keywords.split(',').map(s => s.trim().toLowerCase());
      
      // Image Check
      if (!settings.seo_image) { issues.push("Не встановлено фото для соцмереж (OG Image)."); score -= 15; }

      // Check if main keywords exist in description
      const descLower = settings.seo_description.toLowerCase();
      let keywordsInDesc = 0;
      keywords.forEach(k => {
          if (k.length > 3 && descLower.includes(k)) keywordsInDesc++;
      });

      if (keywords.length > 0 && keywordsInDesc === 0) {
          issues.push("Ключові слова не знайдені в описі. Використайте їх у тексті.");
          score -= 20;
      }

      setAnalysis({ titleLength: tLen, descLength: dLen, score: Math.max(0, score), issues });
  };

  const generateSmartData = () => {
      // Logic specific to this business
      const city = "Синельникове";
      const brand = "Форсаж";
      const services = ["Шиномонтаж 24/7", "Купити Шини", "Ремонт Дисків", "Зварювання Аргоном"];
      
      const newTitle = `${brand} ${city} | ${services[0]} | ${services[1]}`;
      const newDesc = `Професійний ${services[0].toLowerCase()} у м. ${city}. 🚗 ${services[1]}, ${services[2].toLowerCase()}, ${services[3].toLowerCase()}. ☎️ Записуйтесь онлайн!`;
      const newKeywords = `${services.map(s => s.toLowerCase()).join(', ')}, шини ${city}, автосервіс ${city}, вулканізація`;

      setSettings({
          ...settings,
          seo_title: newTitle,
          seo_description: newDesc,
          seo_keywords: newKeywords
      });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      setUploadingImage(true);
      try {
          const file = e.target.files[0];
          const fileName = `seo_og_${Date.now()}`;
          const { error } = await supabase.storage.from('galery').upload(fileName, file);
          if (error) throw error;
          
          const { data } = supabase.storage.from('galery').getPublicUrl(fileName);
          setSettings(prev => ({ ...prev, seo_image: data.publicUrl }));
      } catch (err: any) {
          alert("Помилка завантаження: " + err.message);
      } finally {
          setUploadingImage(false);
      }
  };

  const handleSave = async () => {
      setLoading(true);
      const updates = Object.keys(settings).map(key => ({
          key, 
          value: (settings as any)[key]
      }));

      const { error } = await supabase.from('settings').upsert(updates);
      if (error) alert("Помилка: " + error.message);
      else alert("SEO налаштування оновлено! Зміни з'являться на сайті миттєво, а в Google - після наступної індексації.");
      setLoading(false);
  };

  return (
    <div className="animate-in fade-in space-y-8 pb-20">
      {/* Tab Switcher */}
      <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800 w-fit">
        <button 
          onClick={() => setActiveTab('general')}
          className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'general' ? 'bg-[#FFC300] text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}
        >
          Загальне SEO
        </button>
        <button 
          onClick={() => setActiveTab('products')}
          className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'products' ? 'bg-[#FFC300] text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}
        >
          SEO Товарів
        </button>
      </div>

      {activeTab === 'general' ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-2xl font-black text-white flex items-center gap-2">
                <Globe className="text-[#FFC300]"/> SEO Оптимізація
              </h3>
              <p className="text-zinc-400 text-sm mt-1">Налаштування відображення сайту в Google та соцмережах.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={generateSmartData} className="bg-zinc-800 text-zinc-300 hover:text-white px-4 py-3 rounded-xl border border-zinc-700 hover:border-[#FFC300] flex items-center gap-2 font-bold transition-colors">
                <RefreshCw size={18} /> Авто-Генерація
              </button>
              <button onClick={handleSave} className="bg-[#FFC300] text-black font-black px-6 py-3 rounded-xl hover:bg-[#e6b000] flex items-center gap-2 shadow-lg shadow-yellow-900/20">
                <Save size={20} /> Зберегти
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* EDITOR COLUMN */}
            <div className="space-y-6">
              <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl">
                <h4 className="text-white font-bold mb-4 flex items-center gap-2">Основні Мета-теги</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-zinc-400 text-xs font-bold uppercase mb-1 flex justify-between">
                      Заголовок (Title)
                      <span className={`${analysis.titleLength > 60 ? 'text-red-500' : 'text-green-500'}`}>{analysis.titleLength}/60</span>
                    </label>
                    <input 
                      type="text" 
                      value={settings.seo_title}
                      onChange={(e) => handleChange('seo_title', e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-bold focus:border-[#FFC300] outline-none"
                      placeholder="Назва вашого сайту в пошуку"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-xs font-bold uppercase mb-1 flex justify-between">
                      Опис (Description)
                      <span className={`${analysis.descLength > 160 ? 'text-red-500' : 'text-green-500'}`}>{analysis.descLength}/160</span>
                    </label>
                    <textarea 
                      rows={3}
                      value={settings.seo_description}
                      onChange={(e) => handleChange('seo_description', e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white text-sm focus:border-[#FFC300] outline-none"
                      placeholder="Короткий опис, який побачать користувачі під заголовком"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">Ключові слова (Keywords)</label>
                    <textarea 
                      rows={2}
                      value={settings.seo_keywords}
                      onChange={(e) => handleChange('seo_keywords', e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-zinc-300 text-sm focus:border-[#FFC300] outline-none"
                      placeholder="шиномонтаж, шини, ремонт..."
                    />
                    <p className="text-[10px] text-zinc-500 mt-1">Слова, за якими вас можуть шукати. Розділяйте комою.</p>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl">
                <h4 className="text-white font-bold mb-4 flex items-center gap-2 text-sm uppercase opacity-70">Розширені налаштування</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-zinc-400 text-xs font-bold uppercase mb-1 flex items-center gap-2"><Link2 size={14}/> Canonical URL</label>
                    <input 
                      type="text" 
                      value={settings.seo_canonical}
                      onChange={(e) => handleChange('seo_canonical', e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-zinc-300 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-xs font-bold uppercase mb-1 flex items-center gap-2">Robots Tag</label>
                    <select 
                      value={settings.seo_robots} 
                      onChange={(e) => handleChange('seo_robots', e.target.value)}
                      className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-bold"
                    >
                      <option value="index, follow">Index, Follow (Рекомендовано)</option>
                      <option value="noindex, nofollow">NoIndex, NoFollow (Приховати сайт)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
                <h4 className="text-white font-bold mb-4 flex items-center gap-2"><BarChart className="text-[#FFC300]" size={18}/> Аналіз якості (SEO Score)</h4>
                <div className="mb-4">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-2xl font-black text-white">{analysis.score}/100</span>
                    <span className={`text-sm font-bold ${analysis.score > 80 ? 'text-green-500' : analysis.score > 50 ? 'text-orange-500' : 'text-red-500'}`}>
                      {analysis.score > 80 ? 'Чудово!' : analysis.score > 50 ? 'Можна краще' : 'Погано'}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-black rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${analysis.score > 80 ? 'bg-green-500' : analysis.score > 50 ? 'bg-orange-500' : 'bg-red-500'}`} 
                      style={{ width: `${analysis.score}%` }}
                    ></div>
                  </div>
                </div>
                {analysis.issues.length > 0 ? (
                  <ul className="space-y-2">
                    {analysis.issues.map((issue, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-red-400 bg-red-900/10 p-2 rounded">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0"/> {issue}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-center gap-2 text-green-400 bg-green-900/10 p-3 rounded-lg">
                    <CheckCircle size={18} /> Все налаштовано ідеально!
                  </div>
                )}
              </div>
            </div>

            {/* PREVIEW COLUMN */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-zinc-300 shadow-xl">
                <h4 className="text-black font-bold mb-4 flex items-center gap-2 text-sm uppercase opacity-50"><Search size={16}/> Попередній перегляд Google</h4>
                <div className="font-sans">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-600">F</div>
                    <div className="flex flex-col">
                      <span className="text-xs text-black">Forsage Sinelnikove</span>
                      <span className="text-[10px] text-gray-500">{settings.seo_canonical || 'https://forsage-sinelnikove.com'}</span>
                    </div>
                  </div>
                  <h3 className="text-[#1a0dab] text-xl cursor-pointer hover:underline truncate">
                    {settings.seo_title || "Заголовок вашого сайту"}
                  </h3>
                  <p className="text-[#4d5156] text-sm mt-1 line-clamp-2">
                    {settings.seo_description || "Тут буде опис вашого сайту, який допоможе клієнтам зрозуміти, чим ви займаєтесь..."}
                  </p>
                </div>
              </div>

              <div className="bg-[#18191b] p-6 rounded-2xl border border-zinc-700 shadow-xl">
                <h4 className="text-white font-bold mb-4 flex items-center gap-2 text-sm uppercase opacity-50"><ImageIcon size={16}/> Соцмережі (Facebook/Viber)</h4>
                <div className="border border-zinc-700 rounded-lg overflow-hidden bg-black">
                  <div className="aspect-[1.91/1] bg-zinc-800 relative group">
                    {settings.seo_image ? (
                      <img src={settings.seo_image} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600">
                        <ImageIcon size={48} />
                        <span className="text-xs mt-2">Немає зображення</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button onClick={() => imageInputRef.current?.click()} className="bg-white text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                        {uploadingImage ? <Loader2 className="animate-spin"/> : <Upload size={16}/>} Змінити
                      </button>
                      <input type="file" ref={imageInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                    </div>
                  </div>
                  <div className="p-3 bg-[#242526]">
                    <div className="text-zinc-400 text-[10px] uppercase font-bold mb-1">FORSAGE-SINELNIKOVE.COM</div>
                    <div className="text-white font-bold leading-tight mb-1 truncate">{settings.seo_title}</div>
                    <div className="text-zinc-400 text-xs line-clamp-1">{settings.seo_description}</div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-900/20 p-6 rounded-2xl border border-blue-900/50">
                <h4 className="text-blue-200 font-bold mb-3 flex items-center gap-2"><Info size={18}/> Як потрапити в ТОП?</h4>
                <ul className="space-y-3 text-sm text-zinc-300">
                  <li className="flex gap-2"><span className="text-[#FFC300] font-bold">1.</span> Вказуйте назву міста (Синельникове) в заголовку.</li>
                  <li className="flex gap-2"><span className="text-[#FFC300] font-bold">2.</span> Перерахуйте основні послуги на початку опису.</li>
                  <li className="flex gap-2"><span className="text-[#FFC300] font-bold">3.</span> Додайте фото для соцмереж, щоб посилання виглядало гарно у Viber.</li>
                  <li className="flex gap-2"><span className="text-[#FFC300] font-bold">4.</span> Попросіть клієнтів залишати відгуки на Google Картах.</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* PRODUCTS SEO TAB */
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-2xl font-black text-white flex items-center gap-2">
                <Globe className="text-[#FFC300]"/> SEO Товарів
              </h3>
              <p className="text-zinc-400 text-sm mt-1">Налаштування мета-тегів для кожного товару окремо.</p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18}/>
              <input 
                type="text" 
                placeholder="Пошук товару..." 
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-white outline-none focus:border-[#FFC300]"
              />
            </div>
          </div>

          {loadingProducts ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#FFC300]" size={48} /></div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden overflow-x-auto no-scrollbar">
              <div className="min-w-[600px]">
                <table className="w-full text-left">
                  <thead className="bg-black text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4">Товар</th>
                      <th className="px-6 py-4">SEO Статус</th>
                      <th className="px-6 py-4 text-right">Дії</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {products.map(product => {
                      const hasSeo = product.seo_title && product.seo_description;
                      return (
                        <tr key={product.id} className="hover:bg-zinc-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-black rounded border border-zinc-800 overflow-hidden flex-shrink-0">
                                {product.image_url ? <img src={product.image_url} className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-2 text-zinc-700"/>}
                              </div>
                              <div>
                                <div className="text-white font-bold text-sm line-clamp-1">{product.title}</div>
                                <div className="text-zinc-500 text-[10px] font-mono">{product.catalog_number}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {hasSeo ? (
                              <span className="flex items-center gap-1 text-green-500 text-xs font-bold bg-green-900/10 px-2 py-1 rounded-full w-fit">
                                <CheckCircle size={12}/> Налаштовано
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-orange-500 text-xs font-bold bg-orange-900/10 px-2 py-1 rounded-full w-fit">
                                <AlertTriangle size={12}/> Потребує уваги
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => setEditingProduct(product)}
                              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
                            >
                              <Edit2 size={16}/>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Product SEO Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
          <div className="bg-zinc-900 border-0 sm:border sm:border-zinc-700 rounded-none sm:rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh]">
            <div className="p-4 sm:p-6 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h4 className="text-lg sm:text-xl font-black text-white">SEO для товару</h4>
                <p className="text-zinc-500 text-[10px] sm:text-xs truncate max-w-[200px] sm:max-w-[400px]">{editingProduct.title}</p>
              </div>
              <button onClick={() => setEditingProduct(null)} className="p-2 bg-zinc-800 rounded-full text-zinc-500 hover:text-white"><X size={24}/></button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">
              <div className="flex justify-end">
                <button 
                  onClick={() => autoFillProductSeo(editingProduct)}
                  className="text-[#FFC300] text-xs font-bold flex items-center gap-1 hover:underline bg-[#FFC300]/10 px-3 py-1.5 rounded-full"
                >
                  <RefreshCw size={12}/> Авто-заповнення
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-zinc-400 text-[10px] font-black uppercase mb-1">SEO Заголовок (Title)</label>
                  <input 
                    type="text" 
                    value={editingProduct.seo_title || ''}
                    onChange={e => setEditingProduct({...editingProduct, seo_title: e.target.value})}
                    className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white font-bold focus:border-[#FFC300] outline-none text-sm"
                    placeholder="Напр. Michelin Alpin 6 205/55 R16 купити в Синельникове"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 text-[10px] font-black uppercase mb-1">SEO Опис (Description)</label>
                  <textarea 
                    rows={3}
                    value={editingProduct.seo_description || ''}
                    onChange={e => setEditingProduct({...editingProduct, seo_description: e.target.value})}
                    className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white text-sm focus:border-[#FFC300] outline-none"
                    placeholder="Напр. Купуйте якісні зимові шини Michelin Alpin 6 за найкращою ціною..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-zinc-400 text-[10px] font-black uppercase mb-1">Slug (URL шлях)</label>
                    <input 
                      type="text" 
                      value={editingProduct.slug || ''}
                      onChange={e => setEditingProduct({...editingProduct, slug: e.target.value})}
                      className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white font-mono text-xs focus:border-[#FFC300] outline-none"
                      placeholder="michelin-alpin-6-205-55-r16"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-[10px] font-black uppercase mb-1">Ключові слова</label>
                    <input 
                      type="text" 
                      value={editingProduct.seo_keywords || ''}
                      onChange={e => setEditingProduct({...editingProduct, seo_keywords: e.target.value})}
                      className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white text-xs focus:border-[#FFC300] outline-none"
                      placeholder="шини, michelin, купити"
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-white p-4 rounded-xl border border-zinc-300">
                <div className="text-[10px] text-gray-500 mb-2 uppercase font-bold">Google Preview</div>
                <div className="text-[#1a0dab] text-base sm:text-lg font-medium truncate">{editingProduct.seo_title || editingProduct.title}</div>
                <div className="text-green-700 text-[10px] sm:text-xs truncate">forsage.com.ua › products › {editingProduct.slug || '...'}</div>
                <div className="text-gray-600 text-[10px] sm:text-xs line-clamp-2 mt-1">{editingProduct.seo_description || 'Опис ще не додано...'}</div>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-zinc-800 flex gap-3 mt-auto">
              <button onClick={() => setEditingProduct(null)} className="flex-1 py-3 bg-zinc-800 text-white font-bold rounded-xl hover:bg-zinc-700 transition-colors">Скасувати</button>
              <button onClick={handleSaveProductSeo} disabled={isSavingProduct} className="flex-1 py-3 bg-[#FFC300] text-black font-black rounded-xl hover:bg-[#e6b000] transition-colors flex items-center justify-center gap-2">
                {isSavingProduct ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Зберегти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeoTab;
