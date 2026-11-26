import React, { useState, useRef } from 'react';
import { supabase } from '../../../supabaseClient';

/** "Сайт загалом": the site's meta tags, their score, template filling, social picture, saving, sitemap download. */
export const useSeoSiteSettings = () => {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState({
    seo_title: 'Шиномонтаж Форсаж Синельникове',
    seo_description: 'Шиномонтаж з 8:00 до 19:00, продаж шин та дисків. Якісний ремонт, зварювання аргоном. вул. Квітнева 9.',
    seo_keywords: 'шиномонтаж, синельникове, купити шини, ремонт дисків',
    seo_image: '',
    seo_robots: 'index, follow',
    seo_canonical: 'https://www.forsage-tires.com'
  });

  const [analysis, setAnalysis] = useState({
    titleLength: 0,
    descLength: 0,
    score: 0,
    issues: [] as string[]
  });

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
      const city = "Дніпро, Синельникове";
      const region = "Дніпропетровська область";
      const brand = "Форсаж";
      const services = ["Шиномонтаж", "Купити Шини", "Ремонт Дисків", "Зварювання Аргоном"];
      
      const newTitle = `${brand} | ${city} | ${services[1]} | ${services[0]}`;
      const newDesc = `Професійний ${services[0].toLowerCase()} у м. ${city} та по всій ${region}. 🚗 ${services[1]} за кращою ціною, ${services[2].toLowerCase()}, ${services[3].toLowerCase()}. ☎️ Шиномонтаж з 8:00 до 19:00.`;
      const newKeywords = `купити шини дніпро, купити шини синельникове, гума днепр, ${services.map(s => s.toLowerCase()).join(', ')}, ${region}`;

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

  const generateSitemap = async () => {
      setLoading(true);
      try {
          const baseUrl = settings.seo_canonical || 'https://www.forsage-tires.com';
          const pages = ['', '/prices', '/gallery'];
          
          let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
          
          pages.forEach(p => {
              xml += `  <url>\n    <loc>${baseUrl}${p}</loc>\n    <changefreq>daily</changefreq>\n    <priority>${p === '' ? '1.0' : '0.8'}</priority>\n  </url>\n`;
          });

          const { data: tyres } = await supabase.from('tyres').select('id, slug').neq('in_stock', false);
          if (tyres) {
              tyres.forEach(t => {
                  if (t.slug) {
                    xml += `  <url>\n    <loc>${baseUrl}/product/${t.slug}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
                  }
              });
          }

          xml += `</urlset>`;
          
          // In a real localized app, we'd save this to the public folder if we had a backend.
          // Since we're client-side, we'll offer a download or show a message.
          const blob = new Blob([xml], { type: 'text/xml' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'sitemap.xml';
          a.click();
          
          alert("Sitemap згенеровано! Завантажте його та покладіть у папку public вашого проекту.");
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  return {
    loading, uploadingImage, imageInputRef, settings, analysis,
    fetchSeoSettings, handleChange, analyzeSeo, generateSmartData, handleImageUpload, handleSave, generateSitemap,
  };
};

export type SeoSiteSettings = ReturnType<typeof useSeoSiteSettings>;
