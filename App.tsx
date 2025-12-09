
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
import { Lock, X, Loader2 } from 'lucide-react';
import { supabase } from './supabaseClient';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [shopCategory, setShopCategory] = useState<any>('all'); // State to pass to TyreShop
  const [shopInitialProduct, setShopInitialProduct] = useState<TyreProduct | null>(null); // State for specific product
  
  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState(false);
  const [verifying, setVerifying] = useState(false);
  
  // Admin Mode: 'service' (Schedule/Clients) or 'tyre' (Shop/Orders)
  const [adminMode, setAdminMode] = useState<'service' | 'tyre'>('service');

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
              // Also update OG description
              let ogMeta = document.querySelector('meta[property="og:description"]');
              if (ogMeta) ogMeta.setAttribute('content', item.value);
           }
           if (item.key === 'seo_keywords' && item.value) {
              let meta = document.querySelector('meta[name="keywords"]');
              if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'keywords'); document.head.appendChild(meta); }
              meta.setAttribute('content', item.value);
           }
           // New SEO Fields
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

  const handleAdminAuth = () => {
     setShowAuthModal(true);
     setPinInput('');
     setAuthError(false);
  };

  const submitPin = async () => {
    setVerifying(true);
    setAuthError(false);

    try {
      // Fetch PINs from DB
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['admin_pin', 'tyre_admin_pin']);
      
      const servicePin = data?.find(r => r.key === 'admin_pin')?.value || "1234";
      const tyrePin = data?.find(r => r.key === 'tyre_admin_pin')?.value || "1994";

      if (pinInput.trim() === servicePin) {
        setAdminMode('service');
        setCurrentView('admin');
        setShowAuthModal(false);
      } else if (pinInput.trim() === tyrePin) {
        setAdminMode('tyre');
        setCurrentView('admin');
        setShowAuthModal(false);
      } else {
        setAuthError(true);
        setPinInput('');
      }
    } catch (err) {
      console.error(err);
      // Fallback network error
      if (pinInput.trim() === "1234") {
         setAdminMode('service');
         setCurrentView('admin');
         setShowAuthModal(false);
      } else if (pinInput.trim() === "1994") {
         setAdminMode('tyre');
         setCurrentView('admin');
         setShowAuthModal(false);
      } else {
         setAuthError(true);
      }
    } finally {
      setVerifying(false);
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'admin':
        return <AdminPanel onLogout={() => setCurrentView('home')} mode={adminMode} />;
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
            <Hero onShopRedirect={(tyre) => {
               setShopCategory('hot');
               setShopInitialProduct(tyre);
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
             // Reset category to 'all' if user clicks standard nav buttons, 
             // unless they specifically clicked Hot deal (which is handled in Hero prop)
             if (view === 'shop') {
                if (currentView !== 'home') setShopCategory('all');
                // If navigating to shop manually (via menu), clear the specific product selection
                setShopInitialProduct(null);
             } 
             setCurrentView(view);
          }} 
          onAdminClick={handleAdminAuth} 
        />
      )}
      
      <main className="flex-grow flex flex-col animate-in fade-in duration-500">
        {renderContent()}
      </main>
      
      {currentView !== 'admin' && <Footer />}

      {/* CUSTOM AUTH MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm relative shadow-2xl">
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X size={24} />
            </button>
            
            <div className="flex flex-col items-center gap-4">
              <div className="p-3 bg-zinc-800 rounded-full border border-zinc-700 text-[#FFC300]">
                <Lock size={32} />
              </div>
              <h3 className="text-xl font-bold text-white uppercase italic">Вхід для персоналу</h3>
              
              <input 
                type="password" 
                inputMode="numeric"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setAuthError(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && submitPin()}
                placeholder="Введіть PIN-код"
                className={`w-full bg-black border ${authError ? 'border-red-500' : 'border-zinc-700'} rounded-xl p-3 text-center text-xl font-bold text-white focus:outline-none focus:border-[#FFC300] transition-colors`}
                autoFocus
                disabled={verifying}
              />
              
              {authError && <p className="text-red-500 text-sm font-bold">Невірний код доступу</p>}

              <button 
                onClick={submitPin}
                disabled={verifying}
                className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black py-3 rounded-xl transition-transform active:scale-95 flex items-center justify-center"
              >
                {verifying ? <Loader2 className="animate-spin" /> : 'УВІЙТИ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
