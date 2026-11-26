
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import SeoProPanel, { SEO_VIEWS, type SeoView } from './SeoProPanel';
import { normalizeProviderId } from '../../aiSeoClient';
import type { AIProviderId } from '../../aiTypes';
import { useSeoSiteSettings } from './seo/useSeoSiteSettings';
import { useSeoProducts } from './seo/useSeoProducts';
import GeneralSeoPanel from './seo/GeneralSeoPanel';
import ProductsSeoPanel from './seo/ProductsSeoPanel';
import ProductSeoModal from './seo/ProductSeoModal';

// Admin tab "SEO". Parts live in ./seo: site-wide meta tags (useSeoSiteSettings + GeneralSeoPanel),
// per-product meta tags (useSeoProducts + ProductsSeoPanel + ProductSeoModal); the AI/health views are SeoProPanel.
const SeoTab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'products' | SeoView>('health');
  const [aiProvider, setAiProvider] = useState<AIProviderId>('gemini');
  const site = useSeoSiteSettings(aiProvider);
  const prod = useSeoProducts();

  // effects in the same order as before the split
  useEffect(() => {
    site.fetchSeoSettings();
    prod.fetchProducts();
    fetchAiProvider();
  }, []);

  const fetchAiProvider = async () => {
    const { data } = await supabase.from('settings').select('value').eq('key', 'ai_provider').maybeSingle();
    setAiProvider(normalizeProviderId(data?.value));
  };

  useEffect(() => {
      const timer = setTimeout(() => {
          if (activeTab === 'products') prod.fetchProducts();
      }, 500);
      return () => clearTimeout(timer);
  }, [prod.productSearch]);

  useEffect(() => {
    site.analyzeSeo();
  }, [site.settings]);

  return (
    <div className="animate-in fade-in space-y-8 pb-20">
      {/* Tab Switcher */}
      <div className="flex flex-wrap gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
        {[...SEO_VIEWS, { id: 'general', label: 'Сайт загалом' }, { id: 'products', label: 'Товар вручну' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-3 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all ${activeTab === t.id ? 'bg-[#FFC300] text-black shadow-lg' : 'text-zinc-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab !== 'general' && activeTab !== 'products' ? <SeoProPanel view={activeTab} onOpen={(v) => setActiveTab(v as any)} /> : activeTab === 'general' ? (
        <GeneralSeoPanel site={site} />
      ) : (
        /* PRODUCTS SEO TAB */
        <ProductsSeoPanel prod={prod} />
      )}

      {/* Product SEO Modal */}
      <ProductSeoModal prod={prod} />
    </div>
  );
};

export default SeoTab;