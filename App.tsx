
import React, { useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import Services from './components/Services';
import Contact from './components/Contact';
import Footer from './components/Footer';
import Gallery from './components/Gallery';
import Prices from './components/Prices';
import AdminPanel from './components/AdminPanel';
import { ViewState } from './types';
import { Lock, X, Loader2 } from 'lucide-react';
import { supabase } from './supabaseClient';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  
  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleAdminAuth = () => {
     setShowAuthModal(true);
     setPinInput('');
     setAuthError(false);
  };

  const submitPin = async () => {
    setVerifying(true);
    setAuthError(false);

    try {
      // Fetch PIN from DB
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'admin_pin')
        .single();
      
      const dbPin = data?.value || "1234"; // Fallback to 1234 if not set

      if (pinInput.trim() === dbPin) {
        setCurrentView('admin');
        setShowAuthModal(false);
      } else {
        setAuthError(true);
        setPinInput('');
      }
    } catch (err) {
      console.error(err);
      // Fallback in case of network error
      if (pinInput.trim() === "1234") {
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
        return <AdminPanel onLogout={() => setCurrentView('home')} />;
      case 'prices':
        return <Prices />;
      case 'gallery':
        return <Gallery />;
      case 'home':
      default:
        return (
          <>
            <Hero />
            <Services />
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
          onChangeView={setCurrentView} 
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
