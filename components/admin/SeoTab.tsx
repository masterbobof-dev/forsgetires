
import React, { useState, useEffect } from 'react';
import SeoProPanel, { SEO_VIEWS, type SeoView } from './SeoProPanel';
import { useSeoSiteSettings } from './seo/useSeoSiteSettings';
import GeneralSeoPanel from './seo/GeneralSeoPanel';

// Admin tab "SEO": site-wide meta tags (useSeoSiteSettings + GeneralSeoPanel) and the health, templates, sections... views (SeoProPanel).
// Product titles and descriptions for Google come from the program (its AI helper writes them), so they are not edited here.
const SeoTab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | SeoView>('health');
  const site = useSeoSiteSettings();

  // effects in the same order as before the split
  useEffect(() => {
    site.fetchSeoSettings();
  }, []);

  useEffect(() => {
    site.analyzeSeo();
  }, [site.settings]);

  return (
    <div className="animate-in fade-in space-y-8 pb-20">
      {/* Tab Switcher */}
      <div className="flex flex-wrap gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
        {[...SEO_VIEWS, { id: 'general', label: 'Сайт загалом' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-3 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all ${activeTab === t.id ? 'bg-[#FFC300] text-black shadow-lg' : 'text-zinc-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab !== 'general' ? <SeoProPanel view={activeTab} onOpen={(v) => setActiveTab(v as any)} /> : <GeneralSeoPanel site={site} />}
    </div>
  );
};

export default SeoTab;