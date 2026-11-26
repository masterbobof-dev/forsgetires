import React from 'react';
import { Search, Globe, Save, RefreshCw, CheckCircle, AlertTriangle, Info, BarChart, Image as ImageIcon, Link2, Upload, Loader2, FileCode } from 'lucide-react';
import type { SeoSiteSettings } from './useSeoSiteSettings';

const GeneralSeoPanel: React.FC<{ site: SeoSiteSettings }> = ({ site }) => {
  const { uploadingImage, imageInputRef, settings, analysis, handleChange, generateSmartData, handleImageUpload, handleSave, generateSitemap } = site;
  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-white flex items-center gap-2">
            <Globe className="text-[#FFC300]"/> SEO Оптимізація
          </h3>
          <p className="text-zinc-400 text-sm mt-1">Налаштування відображення сайту в Google та соцмережах.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-4 md:mt-0">
          <button onClick={generateSitemap} className="bg-zinc-800 text-emerald-400 hover:text-white px-4 py-3 rounded-xl border border-emerald-900/50 hover:border-emerald-500 flex flex-1 sm:flex-none items-center justify-center gap-2 font-bold transition-all">
            <FileCode size={18} />
            Sitemap
          </button>
          <button onClick={generateSmartData} className="bg-zinc-800 text-zinc-300 hover:text-white px-4 py-3 rounded-xl border border-zinc-700 hover:border-zinc-500 flex flex-1 sm:flex-none items-center justify-center gap-2 font-bold transition-colors">
            <RefreshCw size={18} /> Шаблон
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
                  <span className="text-[10px] text-gray-500">{settings.seo_canonical || 'https://www.forsage-tires.com'}</span>
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
  );
};

export default GeneralSeoPanel;
