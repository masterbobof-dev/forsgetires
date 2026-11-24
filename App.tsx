import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import { ViewState, TyreProduct, CartItem } from './types';
import { Loader2, ShieldAlert, LogOut } from 'lucide-react';
import { supabase } from './supabaseClient';
import { useAuth } from './useAuth';
import { logAnalyticsEvent } from './components/admin/analytics';
import { CustomerAuthModal, StaffLogin } from './components/auth/AuthForms';
import { initExternalAnalytics } from './externalAnalytics';

const AdminPanel = lazy(() => import('./components/AdminPanel'));
const TyreShop = lazy(() => import('./components/TyreShop'));
const AccountPage = lazy(() => import('./components/AccountPage'));
const LegalPage = lazy(() => import('./components/LegalPage'));
const InfoPages = lazy(() => import('./components/InfoPages'));
const ArticlesPage = lazy(() => import('./components/ArticlesPage'));

const PageLoader = () => (
  <div className="flex h-[60vh] items-center justify-center">
    <Loader2 className="animate-spin text-[#FFC300]" size={48} />
  </div>
);

/** URL path <-> page */
const PATHS: Record<ViewState, string> = {
  home: '/', admin: '/admin', account: '/account', oferta: '/oferta', privacy: '/privacy', articles: '/statti',
  delivery: '/dostavka-i-oplata', warranty: '/garantiya-i-povernennya', about: '/pro-nas', contacts: '/kontakty', faq: '/faq',
};
const viewFromPath = (path: string): ViewState => {
  const p = path.replace(/\/+$/, '') || '/';
  if (p.startsWith('/statti/')) return 'articles';
  const found = (Object.entries(PATHS) as [ViewState, string][]).find(([, v]) => v === p);
  return found ? found[0] : 'home';
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(() => viewFromPath(window.location.pathname));
  const [shopInitialProduct, setShopInitialProduct] = useState<TyreProduct | null>(null);
  const [isStaff, setIsStaff] = useState<boolean | null>(null);

  // Cart state - lifted to App level for header badge
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('forsage_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('forsage_cart', JSON.stringify(cartItems));
    } catch (e) {
      console.error('Error saving cart to localStorage:', e);
    }
  }, [cartItems]);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  /** Navigate inside the site, keeping real addresses (/account, /oferta ...) */
  const navigate = useCallback((view: ViewState, opts: { replace?: boolean } = {}) => {
    const path = PATHS[view];
    if (window.location.pathname !== path) {
      const url = path + (view === 'home' ? window.location.search : '');
      if (opts.replace) window.history.replaceState({}, '', url);
      else window.history.pushState({}, '', url);
    }
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  useEffect(() => {
    const onPop = () => setCurrentView(viewFromPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const auth = useAuth({
    onLogout: () => {
      setIsStaff(false);
      if (window.location.pathname === PATHS.account) navigate('home');
    },
  });

  // Is the signed-in user a staff member (admin / manager)? Customers never see the admin panel.
  useEffect(() => {
    if (!auth.session) { setIsStaff(false); return; }
    setIsStaff(null);
    supabase.rpc('is_staff').then(({ data, error }) => setIsStaff(!error && data === true));
  }, [auth.session?.user?.id]);

  // Google Analytics / Meta Pixel (only if their IDs are set in settings)
  useEffect(() => { if (viewFromPath(window.location.pathname) !== 'admin') initExternalAnalytics(); }, []);

  // Dynamic SEO loader
  useEffect(() => {
    const loadSeo = async () => {
      const { data } = await supabase.from('settings').select('key, value').in('key', [
        'seo_title', 'seo_description', 'seo_keywords', 'seo_image', 'seo_robots', 'seo_canonical',
      ]);
      if (!data) return;

      const updateMeta = (name: string, content: string, attr: 'name' | 'property' = 'name') => {
        let meta = document.querySelector(`meta[${attr}="${name}"]`);
        if (!meta) { meta = document.createElement('meta'); meta.setAttribute(attr, name); document.head.appendChild(meta); }
        meta.setAttribute('content', content);
      };

      // Category (?c=), product (?p=) and service pages set their own title/description/canonical
      const params = new URLSearchParams(window.location.search);
      const isInnerPage = params.has('c') || params.has('p') || params.has('product') || window.location.pathname !== '/';

      data.forEach(item => {
        if (isInnerPage && ['seo_title', 'seo_description', 'seo_canonical'].includes(item.key)) return;
        if (item.key === 'seo_title' && item.value) { document.title = item.value; updateMeta('og:title', item.value, 'property'); updateMeta('twitter:title', item.value); }
        if (item.key === 'seo_description' && item.value) { updateMeta('description', item.value); updateMeta('og:description', item.value, 'property'); updateMeta('twitter:description', item.value); }
        if (item.key === 'seo_keywords' && item.value) { updateMeta('keywords', item.value); }
        if (item.key === 'seo_robots' && item.value) { updateMeta('robots', item.value); }
        if (item.key === 'seo_canonical' && item.value) {
          let link = document.querySelector('link[rel="canonical"]');
          if (!link) { link = document.createElement('link'); link.setAttribute('rel', 'canonical'); document.head.appendChild(link); }
          link.setAttribute('href', item.value);
        }
        if (item.key === 'seo_image' && item.value) { updateMeta('og:image', item.value, 'property'); updateMeta('twitter:image', item.value); }
      });
    };
    loadSeo();
  }, []);

  // Service pages must not be indexed by Google
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'robots'); document.head.appendChild(meta); }
    meta.setAttribute('content', currentView === 'admin' || currentView === 'account' ? 'noindex, nofollow' : 'index, follow');
  }, [currentView]);

  useEffect(() => {
    if (currentView === 'admin') return;
    logAnalyticsEvent('page_view', undefined, undefined, PATHS[currentView]);
  }, [currentView]);

  // The staff sign-in page has no registration
  useEffect(() => {
    if (currentView === 'admin' && auth.authMode === 'register') auth.setAuthMode('login');
  }, [currentView, auth.authMode]);

  const goHome = () => {
    setShopInitialProduct(null);
    navigate('home');
  };

  const handleAccountClick = () => {
    if (auth.session && !isStaff) navigate('account');
    else if (auth.session && isStaff) navigate('admin');
    else auth.openAuthModal('login');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'admin':
        if (!auth.sessionLoaded) return <PageLoader />;
        if (!auth.session) return <StaffLogin auth={auth} onBack={goHome} />;
        if (isStaff === null) return <PageLoader />;
        if (!isStaff) {
          return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center gap-4">
              <ShieldAlert size={48} className="text-red-500" />
              <h1 className="text-2xl font-black uppercase">Доступ лише для персоналу</h1>
              <p className="text-zinc-400 max-w-sm">Ви увійшли як покупець ({auth.session.user?.email}).</p>
              <div className="flex gap-2">
                <button onClick={goHome} className="bg-zinc-800 text-white font-bold px-5 py-3 rounded-xl">На сайт</button>
                <button onClick={auth.logout} className="bg-red-600 text-white font-bold px-5 py-3 rounded-xl flex items-center gap-2"><LogOut size={16} /> Вийти</button>
              </div>
            </div>
          );
        }
        return <AdminPanel onLogout={() => { auth.logout(); goHome(); }} onBackToSite={goHome} />;
      case 'account':
        return <AccountPage auth={auth} onBack={goHome} />;
      case 'oferta':
      case 'privacy':
        return <LegalPage doc={currentView} onBack={goHome} />;
      case 'articles':
        return <ArticlesPage onBack={goHome} />;
      case 'delivery':
      case 'warranty':
      case 'about':
      case 'contacts':
      case 'faq':
        return <InfoPages page={currentView} onBack={goHome} />;
      case 'home':
      default:
        return (
          <TyreShop
            onBack={goHome}
            initialProduct={shopInitialProduct}
            cartItems={cartItems}
            onCartChange={setCartItems}
            userId={auth.session && !isStaff ? auth.session.user?.id : undefined}
            userEmail={auth.session?.user?.email}
            onRequireLogin={() => auth.openAuthModal('login')}
          />
        );
    }
  };

  const isAdminView = currentView === 'admin';

  return (
    <div className="min-h-screen flex flex-col bg-[#09090b] text-white selection:bg-[#FFC300] selection:text-black">
      {!isAdminView && (
        <Header
          currentView={currentView}
          onChangeView={(v) => (v === 'home' ? goHome() : navigate(v))}
          onAccountClick={handleAccountClick}
          isLoggedIn={!!auth.session && !isStaff}
          cartCount={cartCount}
        />
      )}

      <main className="flex-grow flex flex-col">
        <Suspense fallback={<PageLoader />}>
          {renderContent()}
        </Suspense>
      </main>

      {!isAdminView && <Footer onNavigate={navigate} />}

      {!isAdminView && <CustomerAuthModal auth={auth} />}
    </div>
  );
};

export default App;
