
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Search, Globe, Save, RefreshCw, CheckCircle, AlertTriangle, Info, BarChart, Image as ImageIcon, Link2, Upload, Loader2 } from 'lucide-react';

const SeoTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
  }, []);

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
                          <label className="block text-zinc-400 text-xs font-bold uppercase mb-1">
                              Ключові слова (Keywords)
                          </label>
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

               {/* ADVANCED SEO */}
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

              {/* Analysis Card */}
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
              
              {/* Google Preview */}
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

               {/* Social Preview */}
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

              {/* Tips */}
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
    </div>
  );
};

export default SeoTab;
