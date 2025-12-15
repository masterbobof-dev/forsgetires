
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
import { Lock, X, Loader2, Mail, Key, UserPlus, LogIn, AlertCircle, Wrench, Briefcase, ArrowLeft, Send } from 'lucide-react';
import { supabase } from './supabaseClient';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [shopCategory, setShopCategory] = useState<any>('all'); 
  const [shopInitialProduct, setShopInitialProduct] = useState<TyreProduct | null>(null);
  
  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login'); // login, register, forgot
  const [authTab, setAuthTab] = useState<'admin' | 'service'>('admin'); // Role selection
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [verifying, setVerifying] = useState(false);
  
  // Session State
  const [session, setSession] = useState<any>(null);

  // Admin Mode: 'service' (Schedule/Clients) or 'tyre' (Shop/Orders)
  const [adminPanelMode, setAdminPanelMode] = useState<'service' | 'tyre'>('tyre');

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session && showAuthModal) {
          setShowAuthModal(false);
          setCurrentView('admin');
          // Reset form
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
      const { data } = await supabase.from('settings').select('key, value').in('key', ['seo_title', 'seo_description', 'seo_keywords', 'seo_image', 'seo_robots', 'seo_canonical']);
      
      if (data) {
        data.forEach(item => {
           if (item.key === 'seo_title' && item.value) {
               document.title = item.value;
               let ogTitle = document.querySelector('meta[property="og:title"]');
               if (ogTitle) ogTitle.setAttribute('content', item.value);
           }
           if (item.key === 'seo_description' && item.value) {
              let meta = document.querySelector('meta[name="description"]');
              if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'description'); document.head.appendChild(meta); }
              meta.setAttribute('content', item.value);
              let ogMeta = document.querySelector('meta[property="og:description"]');
              if (ogMeta) ogMeta.setAttribute('content', item.value);
           }
           if (item.key === 'seo_keywords' && item.value) {
              let meta = document.querySelector('meta[name="keywords"]');
              if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'keywords'); document.head.appendChild(meta); }
              meta.setAttribute('content', item.value);
           }
           if (item.key === 'seo_robots' && item.value) {
              let meta = document.querySelector('meta[name="robots"]');
              if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'robots'); document.head.appendChild(meta); }
              meta.setAttribute('content', item.value);
           }
           if (item.key === 'seo_canonical' && item.value) {
              let link = document.querySelector('link[rel="canonical"]');
              if (!link) { link = document.createElement('link'); link.setAttribute('rel', 'canonical'); document.head.appendChild(link); }
              link.setAttribute('href', item.value);
           }
           if (item.key === 'seo_image' && item.value) {
               let ogImage = document.querySelector('meta[property="og:image"]');
               if (ogImage) ogImage.setAttribute('content', item.value);
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
            // REGISTER
            const { error } = await supabase.auth.signUp({
                email: email,
                password: password,
            });

            if (error) throw error;
            
            setAuthSuccess('Акаунт створено! Спробуйте увійти.');
            setAuthMode('login'); // Switch back to login for UX
        } else if (authMode === 'login') {
            // LOGIN
            const { error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;
            
            // Set context based on which tab was used
            if (authTab === 'service') {
                setAdminPanelMode('service');
            } else {
                setAdminPanelMode('tyre');
            }
        }
    } catch (error: any) {
        console.error("Auth Error:", error);
        
        let msg = error.message;
        
        if (msg.includes('Invalid login') || msg.includes('Invalid credentials')) {
            msg = 'Невірний Email або Пароль.';
        } else if (msg.includes('Email not confirmed')) {
            msg = 'Пошта не підтверджена! Вимкніть "Confirm Email" в налаштуваннях Supabase.';
        } else if (msg.includes('User already registered')) {
            msg = 'Користувач вже існує. Спробуйте увійти.';
        } else if (msg.includes('weak password')) {
            msg = 'Пароль занадто простий. Мінімум 6 символів.';
        }

        setAuthError(msg);
    } finally {
        setVerifying(false);
    }
  };

  const handlePasswordReset = async () => {
      if (!email) {
          setAuthError('Введіть Email для відновлення.');
          return;
      }
      setVerifying(true);
      try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: window.location.origin, // Redirect back to this site
          });
          if (error) throw error;
          setAuthSuccess('Лист для відновлення паролю відправлено на вашу пошту!');
      } catch (error: any) {
          setAuthError(error.message);
      } finally {
          setVerifying(false);
      }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'admin':
        return session ? <AdminPanel onLogout={() => supabase.auth.signOut()} mode={adminPanelMode} setMode={setAdminPanelMode} /> : <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-[#FFC300]" size={48}/></div>;
      case 'prices':
        return <Prices />;
      case 'gallery':
        return <Gallery />;
      case 'shop':
        return <TyreShop initialCategory={shopCategory} initialProduct={shopInitialProduct} />;
      case 'home':
      default:
        return (
          <>
            <Hero onShopRedirect={(category, tyre) => {
               setShopCategory(category);
               setShopInitialProduct(tyre || null);
               setCurrentView('shop');
               window.scrollTo({ top: 0, behavior: 'smooth' });
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
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X size={24} />
            </button>
            
            {/* --- FORGOT PASSWORD VIEW --- */}
            {authMode === 'forgot' ? (
                <div className="flex flex-col items-center gap-4 animate-in slide-in-from-right">
                    <h3 className="text-xl font-bold text-white uppercase italic mt-2">Відновлення паролю</h3>
                    <p className="text-zinc-400 text-sm text-center">Введіть вашу електронну пошту, щоб отримати посилання для скидання пароля.</p>
                    
                    <div className="w-full relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18}/>
                        <input 
                          type="email" 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Email"
                          className="w-full bg-black border border-zinc-700 rounded-xl p-3 pl-10 text-white focus:border-[#FFC300] outline-none"
                        />
                    </div>

                    {authError && <div className="text-red-400 text-xs font-bold bg-red-900/10 p-3 rounded-lg w-full border border-red-900/30">{authError}</div>}
                    {authSuccess && <div className="text-green-400 text-xs font-bold bg-green-900/10 p-3 rounded-lg w-full border border-green-900/30 text-center">{authSuccess}</div>}

                    <button 
                        onClick={handlePasswordReset}
                        disabled={verifying}
                        className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black py-3 rounded-xl transition-transform active:scale-95 flex items-center justify-center gap-2"
                    >
                        {verifying ? <Loader2 className="animate-spin" /> : <><Send size={18}/> ВІДПРАВИТИ</>}
                    </button>

                    <button 
                        onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccess(''); }}
                        className="text-zinc-500 hover:text-white text-sm font-bold flex items-center gap-2"
                    >
                        <ArrowLeft size={16}/> Повернутися назад
                    </button>
                </div>
            ) : (
                /* --- LOGIN / REGISTER VIEW --- */
                <div className="flex flex-col items-center gap-4 animate-in slide-in-from-left">
                    
                    {/* Role Tabs */}
                    <div className="flex w-full bg-black p-1 rounded-xl border border-zinc-800 mb-2">
                        <button 
                            onClick={() => setAuthTab('admin')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase transition-all ${authTab === 'admin' ? 'bg-[#FFC300] text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}
                        >
                            <Briefcase size={14}/> Магазин
                        </button>
                        <button 
                            onClick={() => setAuthTab('service')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase transition-all ${authTab === 'service' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
                        >
                            <Wrench size={14}/> Сервіс
                        </button>
                    </div>

                    <div className={`p-3 rounded-full border border-zinc-700 ${authTab === 'admin' ? 'bg-zinc-800 text-[#FFC300]' : 'bg-blue-900/20 text-blue-400'}`}>
                        {authMode === 'register' ? <UserPlus size={32} /> : <Lock size={32} />}
                    </div>
                    
                    <h3 className="text-xl font-bold text-white uppercase italic">
                        {authMode === 'register' ? 'Реєстрація' : 'Вхід в систему'}
                        <span className={`block text-xs font-normal text-center mt-1 normal-case ${authTab === 'service' ? 'text-blue-400' : 'text-[#FFC300]'}`}>
                            {authTab === 'service' ? '(Персонал Сервісу)' : '(Адміністрація Магазину)'}
                        </span>
                    </h3>
                  
                    <div className="w-full space-y-3">
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18}/>
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email"
                                className="w-full bg-black border border-zinc-700 rounded-xl p-3 pl-10 text-white focus:border-[#FFC300] outline-none"
                            />
                        </div>
                        <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18}/>
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAuthAction()}
                                placeholder="Пароль"
                                className="w-full bg-black border border-zinc-700 rounded-xl p-3 pl-10 text-white focus:border-[#FFC300] outline-none"
                            />
                        </div>
                    </div>
                    
                    {authError && (
                        <div className="text-red-400 text-xs font-bold bg-red-900/10 p-3 rounded-lg w-full border border-red-900/30 flex items-start gap-2">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>{authError}</span>
                        </div>
                    )}
                    
                    {authSuccess && (
                        <div className="text-green-400 text-xs font-bold bg-green-900/10 p-3 rounded-lg w-full border border-green-900/30 text-center">
                            {authSuccess}
                        </div>
                    )}

                    <div className="w-full flex justify-end">
                        <button 
                            onClick={() => { setAuthMode('forgot'); setAuthError(''); setAuthSuccess(''); }}
                            className="text-xs text-zinc-500 hover:text-[#FFC300] font-bold"
                        >
                            Забули пароль?
                        </button>
                    </div>

                    <button 
                        onClick={handleAuthAction}
                        disabled={verifying}
                        className={`w-full font-black py-3 rounded-xl transition-transform active:scale-95 flex items-center justify-center gap-2 
                            ${authMode === 'register' ? 'bg-white text-black hover:bg-zinc-200' : (authTab === 'service' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-[#FFC300] hover:bg-[#e6b000] text-black')}
                        `}
                    >
                        {verifying ? <Loader2 className="animate-spin" /> : (authMode === 'register' ? 'СТВОРИТИ АКАУНТ' : 'УВІЙТИ')}
                    </button>

                    <div className="pt-2 border-t border-zinc-800 w-full text-center">
                        <button 
                            onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); setAuthSuccess(''); }}
                            className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 mx-auto"
                        >
                            {authMode === 'register' ? <><LogIn size={14}/> Вже є акаунт? Увійти</> : <><UserPlus size={14}/> Немає акаунту? Реєстрація</>}
                        </button>
                    </div>
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
