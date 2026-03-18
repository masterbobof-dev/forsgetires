
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import Services from './components/Services';
import Tips from './components/Tips';
import Contact from './components/Contact';
import Footer from './components/Footer';
import Gallery from './components/Gallery';
import Prices from './components/Prices';
import AdminPanel from './components/AdminPanel';
import TyreShop from './components/TyreShop';
import { ViewState, TyreProduct } from './types';
import { Lock, X, Loader2, Mail, Key, Briefcase, ArrowLeft, Send, Wrench } from 'lucide-react';
import { supabase } from './supabaseClient';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [shopCategory, setShopCategory] = useState<any>('all'); 
  const [shopInitialProduct, setShopInitialProduct] = useState<TyreProduct | null>(null);
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [authTab, setAuthTab] = useState<'admin' | 'service'>('admin');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [verifying, setVerifying] = useState(false);
  
  const [session, setSession] = useState<any>(null);
  const [adminPanelMode, setAdminPanelMode] = useState<'service' | 'tyre'>('tyre');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session && showAuthModal) {
          setShowAuthModal(false);
          setCurrentView('admin');
          setEmail('');
          setPassword('');
      }
      if (!session && currentView === 'admin') {
          setCurrentView('home');
      }
    });

    return () => subscription.unsubscribe();
  }, [currentView, showAuthModal]);

  // --- DYNAMIC SEO LOADER ---
  useEffect(() => {
    const loadSeo = async () => {
      const { data } = await supabase.from('settings').select('key, value').in('key', [
        'seo_title', 'seo_description', 'seo_keywords', 'seo_image', 'seo_robots', 'seo_canonical'
      ]);
      
      if (data) {
        data.forEach(item => {
           const updateMeta = (name: string, content: string, attr: 'name' | 'property' = 'name') => {
              let meta = document.querySelector(`meta[${attr}="${name}"]`);
              if (!meta) {
                 meta = document.createElement('meta');
                 meta.setAttribute(attr, name);
                 document.head.appendChild(meta);
              }
              meta.setAttribute('content', content);
           };

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
              if (!link) { link = document.createElement('link'); link.setAttribute('rel', 'canonical'); document.head.appendChild(link); }
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
     if (session) {
         setCurrentView('admin');
     } else {
         setShowAuthModal(true);
         setAuthMode('login');
         setAuthError('');
         setAuthSuccess('');
     }
  };

  const handleAuthAction = async () => {
    setVerifying(true);
    setAuthError('');
    setAuthSuccess('');

    try {
        if (authMode === 'register') {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            setAuthSuccess('Акаунт створено! Спробуйте увійти.');
            setAuthMode('login');
        } else if (authMode === 'login') {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (authTab === 'service') setAdminPanelMode('service');
            else setAdminPanelMode('tyre');
        }
    } catch (error: any) {
        setAuthError(error.message);
    } finally {
        setVerifying(false);
    }
  };

  const handlePasswordReset = async () => {
      if (!email) { setAuthError('Введіть Email для відновлення.'); return; }
      setVerifying(true);
      try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
          if (error) throw error;
          setAuthSuccess('Лист для відновлення паролю відправлено на вашу пошту!');
      } catch (error: any) {
          setAuthError(error.message);
      } finally {
          setVerifying(false);
      }
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const renderContent = () => {
    switch (currentView) {
      case 'admin':
        return session ? <AdminPanel onLogout={() => supabase.auth.signOut()} onBackToSite={handleBackToHome} mode={adminPanelMode} setMode={setAdminPanelMode} /> : <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-[#FFC300]" size={48}/></div>;
      case 'prices':
        return <Prices />;
      case 'gallery':
        return <Gallery />;
      case 'shop':
        return <TyreShop onBack={handleBackToHome} initialCategory={shopCategory} initialProduct={shopInitialProduct} isAdmin={!!session} onAdminClick={() => setCurrentView('admin')} />;
      case 'home':
      default:
        return (
          <>
            <Hero onShopRedirect={(category, tyre) => {
               setShopCategory(category);
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
        {renderContent()}
      </main>
      
      {currentView !== 'admin' && <Footer />}

      {/* AUTH MODAL */}
      {showAuthModal && !session && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm relative shadow-2xl flex flex-col gap-4">
            <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white">
              <X size={24} />
            </button>
            
            {authMode === 'forgot' ? (
                <div className="flex flex-col items-center gap-4 animate-in slide-in-from-right">
                    <h3 className="text-xl font-bold text-white uppercase italic mt-2">Відновлення паролю</h3>
                    <div className="w-full relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18}/>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full bg-black border border-zinc-700 rounded-xl p-3 pl-10 text-white focus:border-[#FFC300] outline-none" />
                    </div>
                    <button onClick={handlePasswordReset} disabled={verifying} className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black py-3 rounded-xl transition-transform active:scale-95 flex items-center justify-center gap-2">
                        {verifying ? <Loader2 className="animate-spin" /> : <><Send size={18}/> ВІДПРАВИТИ</>}
                    </button>
                    <button onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccess(''); }} className="text-zinc-500 hover:text-white text-sm font-bold flex items-center gap-2">
                        <ArrowLeft size={16}/> Назад
                    </button>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-4 animate-in slide-in-from-left">
                    <div className="flex w-full bg-black p-1 rounded-xl border border-zinc-800 mb-2">
                        <button onClick={() => setAuthTab('admin')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase transition-all ${authTab === 'admin' ? 'bg-[#FFC300] text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}>
                            <Briefcase size={14}/> Магазин шин
                        </button>
                        <button onClick={() => setAuthTab('service')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase transition-all ${authTab === 'service' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}>
                            <Wrench size={14}/> Сервіс
                        </button>
                    </div>
                    <h3 className="text-xl font-bold text-white uppercase italic">
                        {authMode === 'register' ? 'Реєстрація' : 'Вхід'}
                    </h3>
                    <div className="w-full space-y-3">
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18}/>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full bg-black border border-zinc-700 rounded-xl p-3 pl-10 text-white focus:border-[#FFC300] outline-none" />
                        </div>
                        <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18}/>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAuthAction()} placeholder="Пароль" className="w-full bg-black border border-zinc-700 rounded-xl p-3 pl-10 text-white focus:border-[#FFC300] outline-none" />
                        </div>
                    </div>
                    <button onClick={handleAuthAction} disabled={verifying} className={`w-full font-black py-3 rounded-xl transition-transform active:scale-95 ${authMode === 'register' ? 'bg-white text-black' : (authTab === 'service' ? 'bg-blue-600 text-white' : 'bg-[#FFC300] text-black')}`}>
                        {verifying ? <Loader2 className="animate-spin mx-auto" /> : (authMode === 'register' ? 'СТВОРИТИ АКАУНТ' : 'УВІЙТИ')}
                    </button>

                    <div className="flex flex-col gap-2 items-center mt-2">
                        <button 
                            onClick={() => {
                                setAuthMode(authMode === 'login' ? 'register' : 'login');
                                setAuthError('');
                                setAuthSuccess('');
                            }}
                            className="text-zinc-400 hover:text-white text-xs font-bold transition-colors"
                        >
                            {authMode === 'login' ? 'Немає акаунту? Реєстрація' : 'Вже є акаунт? Увійти'}
                        </button>
                        {authMode === 'login' && (
                            <button 
                                onClick={() => {
                                    setAuthMode('forgot');
                                    setAuthError('');
                                    setAuthSuccess('');
                                }}
                                className="text-zinc-500 hover:text-zinc-300 text-[10px] uppercase tracking-widest font-bold"
                            >
                                Забули пароль?
                            </button>
                        )}
                    </div>

                    {(authError || authSuccess) && (
                        <div className={`text-center p-3 rounded-xl text-xs font-bold animate-in fade-in zoom-in ${authError ? 'bg-red-900/20 text-red-400 border border-red-900/50' : 'bg-green-900/20 text-green-400 border border-green-900/50'}`}>
                            {authError || authSuccess}
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
