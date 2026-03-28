import React, { useState, useEffect, lazy, Suspense } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import Services from './components/Services';
import Tips from './components/Tips';
import Contact from './components/Contact';
import Footer from './components/Footer';
import { ViewState, TyreProduct } from './types';
import { X, Loader2, Mail, Key, Briefcase, ArrowLeft, Send, Wrench } from 'lucide-react';
import { supabase } from './supabaseClient';
import { useAuth } from './useAuth';

// Lazy load heavy components for better performance
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const Gallery = lazy(() => import('./components/Gallery'));
const Prices = lazy(() => import('./components/Prices'));
const TyreShop = lazy(() => import('./components/TyreShop'));

// Proper type for shop category
type ShopCategory = 'all' | 'car' | 'cargo' | 'suv' | 'truck' | 'agro';

const PageLoader = () => (
  <div className="flex h-screen items-center justify-center">
    <Loader2 className="animate-spin text-[#FFC300]" size={48} />
  </div>
);

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [shopCategory, setShopCategory] = useState<ShopCategory>('all');
  const [shopInitialProduct, setShopInitialProduct] = useState<TyreProduct | null>(null);
  const [adminPanelMode, setAdminPanelMode] = useState<'service' | 'tyre'>('tyre');

  const auth = useAuth({
    onLogin: (tab) => {
      setAdminPanelMode(tab === 'service' ? 'service' : 'tyre');
      setCurrentView('admin');
    },
    onLogout: () => {
      if (currentView === 'admin') setCurrentView('home');
    },
  });

  // --- DYNAMIC SEO LOADER ---
  useEffect(() => {
    const loadSeo = async () => {
      const { data } = await supabase.from('settings').select('key, value').in('key', [
        'seo_title', 'seo_description', 'seo_keywords', 'seo_image', 'seo_robots', 'seo_canonical',
      ]);

      if (data) {
        const updateMeta = (name: string, content: string, attr: 'name' | 'property' = 'name') => {
          let meta = document.querySelector(`meta[${attr}="${name}"]`);
          if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute(attr, name);
            document.head.appendChild(meta);
          }
          meta.setAttribute('content', content);
        };

        data.forEach(item => {
          if (item.key === 'seo_title' && item.value) {
            document.title = item.value;
            updateMeta('og:title', item.value, 'property');
            updateMeta('twitter:title', item.value);
          }
          if (item.key === 'seo_description' && item.value) {
            updateMeta('description', item.value);
            updateMeta('og:description', item.value, 'property');
            updateMeta('twitter:description', item.value);
          }
          if (item.key === 'seo_keywords' && item.value) {
            updateMeta('keywords', item.value);
          }
          if (item.key === 'seo_robots' && item.value) {
            updateMeta('robots', item.value);
          }
          if (item.key === 'seo_canonical' && item.value) {
            let link = document.querySelector('link[rel="canonical"]');
            if (!link) {
              link = document.createElement('link');
              link.setAttribute('rel', 'canonical');
              document.head.appendChild(link);
            }
            link.setAttribute('href', item.value);
          }
          if (item.key === 'seo_image' && item.value) {
            updateMeta('og:image', item.value, 'property');
            updateMeta('twitter:image', item.value);
          }
        });
      }
    };
    loadSeo();
  }, []);

  const handleAdminAuthClick = () => {
    if (auth.session) {
      setCurrentView('admin');
    } else {
      auth.openAuthModal();
    }
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const renderContent = () => {
    switch (currentView) {
      case 'admin':
        return auth.session ? (
          <AdminPanel
            onLogout={auth.logout}
            onBackToSite={handleBackToHome}
            mode={adminPanelMode}
            setMode={setAdminPanelMode}
          />
        ) : <PageLoader />;
      case 'prices':
        return <Prices />;
      case 'gallery':
        return <Gallery />;
      case 'shop':
        return (
          <TyreShop
            onBack={handleBackToHome}
            initialCategory={shopCategory}
            initialProduct={shopInitialProduct}
            isAdmin={!!auth.session}
            onAdminClick={() => setCurrentView('admin')}
          />
        );
      case 'home':
      default:
        return (
          <>
            <Hero onShopRedirect={(category, tyre) => {
              setShopCategory((category as ShopCategory) || 'all');
              setShopInitialProduct(tyre || null);
              setCurrentView('shop');
              window.scrollTo({ top: 0, behavior: 'instant' });
            }} />
            <Services />
            <Tips />
            <Contact />
          </>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#09090b] text-white selection:bg-[#FFC300] selection:text-black">
      {currentView !== 'admin' && (
        <Header
          currentView={currentView}
          onChangeView={(view) => {
            if (view === 'shop') {
              if (currentView !== 'home') setShopCategory('all');
              setShopInitialProduct(null);
            }
            setCurrentView(view);
          }}
          onAdminClick={handleAdminAuthClick}
        />
      )}

      <main className="flex-grow flex flex-col animate-in fade-in duration-500">
        <Suspense fallback={<PageLoader />}>
          {renderContent()}
        </Suspense>
      </main>

      {currentView !== 'admin' && <Footer />}

      {/* AUTH MODAL */}
      {auth.showAuthModal && !auth.session && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm relative shadow-2xl flex flex-col gap-4">
            <button
              onClick={auth.closeAuthModal}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
              aria-label="Закрити"
            >
              <X size={24} />
            </button>

            {auth.authMode === 'forgot' ? (
              <div className="flex flex-col items-center gap-4 animate-in slide-in-from-right">
                <h3 className="text-xl font-bold text-white uppercase italic mt-2">Відновлення паролю</h3>
                <div className="w-full relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input
                    type="email"
                    value={auth.email}
                    onChange={(e) => auth.setEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full bg-black border border-zinc-700 rounded-xl p-3 pl-10 text-white focus:border-[#FFC300] outline-none"
                  />
                </div>
                <button
                  onClick={auth.handlePasswordReset}
                  disabled={auth.verifying}
                  className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black py-3 rounded-xl transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {auth.verifying ? <Loader2 className="animate-spin" /> : <><Send size={18} /> ВІДПРАВИТИ</>}
                </button>
                <button
                  onClick={() => { auth.setAuthMode('login'); auth.setAuthError(''); auth.setAuthSuccess(''); }}
                  className="text-zinc-500 hover:text-white text-sm font-bold flex items-center gap-2"
                >
                  <ArrowLeft size={16} /> Назад
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 animate-in slide-in-from-left">
                <div className="flex w-full bg-black p-1 rounded-xl border border-zinc-800 mb-2">
                  <button
                    onClick={() => auth.setAuthTab('admin')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase transition-all ${auth.authTab === 'admin' ? 'bg-[#FFC300] text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}
                  >
                    <Briefcase size={14} /> Магазин шин
                  </button>
                  <button
                    onClick={() => auth.setAuthTab('service')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase transition-all ${auth.authTab === 'service' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
                  >
                    <Wrench size={14} /> Сервіс
                  </button>
                </div>

                <h3 className="text-xl font-bold text-white uppercase italic">
                  {auth.authMode === 'register' ? 'Реєстрація' : 'Вхід'}
                </h3>

                <div className="w-full space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="email"
                      value={auth.email}
                      onChange={(e) => auth.setEmail(e.target.value)}
                      placeholder="Email"
                      className="w-full bg-black border border-zinc-700 rounded-xl p-3 pl-10 text-white focus:border-[#FFC300] outline-none"
                    />
                  </div>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="password"
                      value={auth.password}
                      onChange={(e) => auth.setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !auth.verifying && auth.handleAuthAction()}
                      placeholder="Пароль"
                      className="w-full bg-black border border-zinc-700 rounded-xl p-3 pl-10 text-white focus:border-[#FFC300] outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={auth.handleAuthAction}
                  disabled={auth.verifying}
                  className={`w-full font-black py-3 rounded-xl transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${auth.authMode === 'register' ? 'bg-white text-black' : (auth.authTab === 'service' ? 'bg-blue-600 text-white' : 'bg-[#FFC300] text-black')}`}
                >
                  {auth.verifying
                    ? <Loader2 className="animate-spin mx-auto" />
                    : (auth.authMode === 'register' ? 'СТВОРИТИ АКАУНТ' : 'УВІЙТИ')}
                </button>

                <div className="flex flex-col gap-2 items-center mt-2">
                  <button
                    onClick={() => {
                      auth.setAuthMode(auth.authMode === 'login' ? 'register' : 'login');
                      auth.setAuthError('');
                      auth.setAuthSuccess('');
                    }}
                    className="text-zinc-400 hover:text-white text-xs font-bold transition-colors"
                  >
                    {auth.authMode === 'login' ? 'Немає акаунту? Реєстрація' : 'Вже є акаунт? Увійти'}
                  </button>
                  {auth.authMode === 'login' && (
                    <button
                      onClick={() => {
                        auth.setAuthMode('forgot');
                        auth.setAuthError('');
                        auth.setAuthSuccess('');
                      }}
                      className="text-zinc-500 hover:text-zinc-300 text-[10px] uppercase tracking-widest font-bold"
                    >
                      Забули пароль?
                    </button>
                  )}
                </div>

                {(auth.authError || auth.authSuccess) && (
                  <div className={`text-center p-3 rounded-xl text-xs font-bold animate-in fade-in zoom-in ${auth.authError ? 'bg-red-900/20 text-red-400 border border-red-900/50' : 'bg-green-900/20 text-green-400 border border-green-900/50'}`}>
                    {auth.authError || auth.authSuccess}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
