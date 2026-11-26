import React, { useState, useEffect, useCallback } from 'react';
import { Lock, LogOut, ShieldAlert, UserCheck, Loader2, Menu, X as CloseIcon, ChevronRight, Settings as SettingsIcon, ShoppingBag, BarChart3, Globe, Megaphone, FileText, Database, FolderTree, AlertCircle, MessageSquare, Send, MessagesSquare } from 'lucide-react';
import SettingsTab from './admin/SettingsTab';
import ProductsBrowser from './admin/ProductsBrowser';
import OrdersTab from './admin/OrdersTab';
import StatsTab from './admin/StatsTab';
import ReviewsTab from './admin/ReviewsTab';
import TelegramTab from './admin/TelegramTab';
import ForumTab from './admin/ForumTab';
import { supabase } from '../supabaseClient';

interface AdminPanelProps {
  onLogout: () => void;
  onBackToSite?: () => void;
}

type AccessStatus = 'loading' | 'granted_admin' | 'granted_manager' | 'granted_forum' | 'denied' | 'setup_required';

// ── Reusable Confirm Dialog ────────────────────────────────────────────────
interface ConfirmDialogProps {
  message: string;
  subMessage?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  message, subMessage = 'Цю дію неможливо скасувати.', confirmLabel = 'Підтвердити',
  onConfirm, onCancel,
}) => (
  <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <AlertCircle className="text-red-400" size={24} />
        </div>
        <p className="text-white font-semibold text-base">{message}</p>
        {subMessage && <p className="text-zinc-400 text-sm -mt-2">{subMessage}</p>}
        <div className="flex gap-3 w-full mt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors font-bold text-sm"
          >
            Скасувати
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ── useConfirm hook ────────────────────────────────────────────────────────
interface ConfirmOptions {
  message: string;
  subMessage?: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

const useConfirm = () => {
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { onCancel: () => void }) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setConfirmState({
      ...opts,
      onConfirm: () => { opts.onConfirm(); setConfirmState(null); },
      onCancel: () => setConfirmState(null),
    });
  }, []);

  const dialog = confirmState ? <ConfirmDialog {...confirmState} /> : null;

  return { confirm, dialog };
};

// ── Main Component ─────────────────────────────────────────────────────────
const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout, onBackToSite }) => {
  // the open section is remembered while the browser tab is open (coming back from the site opens the same one)
  // "Категорії" now live inside "Товари" (left column), so an old saved tab opens there
  const [activeTab, setActiveTabState] = useState<string>(() => { try { const t = sessionStorage.getItem('admin_tab') || 'orders'; return t === 'categories' ? 'tyres' : ['ai', 'photos', 'seoai', 'seo', 'promo', 'articles'].includes(t) ? 'orders' : t; } catch { return 'orders'; } });
  const setActiveTab = (t: string) => { setActiveTabState(t); try { sessionStorage.setItem('admin_tab', t); } catch { /* private mode */ } window.scrollTo({ top: 0 }); };
  const [accessStatus, setAccessStatus] = useState<AccessStatus>('loading');
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { confirm, dialog: confirmDialog } = useConfirm();

  // Confirm before logout
  const handleLogout = () => {
    confirm({
      message: 'Вийти з адмін-панелі?',
      subMessage: 'Ви будете перенаправлені на сайт.',
      confirmLabel: 'Вийти',
      onConfirm: onLogout,
    });
  };

  useEffect(() => { checkAccess(); }, []);

  const checkAccess = async () => {
    setAccessStatus('loading');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user || !user.email) { onLogout(); return; }

      const email = user.email.trim().toLowerCase();
      setCurrentUserEmail(email);

      const { data: settings, error: settingsError } = await supabase
        .from('settings').select('key, value').in('key', ['admin_email', 'manager_email']);
      if (settingsError) throw settingsError;

      const adminEmail = settings?.find(s => s.key === 'admin_email')?.value?.trim().toLowerCase();
      const managerEmail = settings?.find(s => s.key === 'manager_email')?.value?.trim().toLowerCase();

      // people who are not staff do not see the staff e-mails at all: check the forum moderator role first
      const { data: mod } = (adminEmail && (email === adminEmail || email === managerEmail)) ? { data: false } : await supabase.rpc('is_forum_mod');
      if (mod === true && email !== adminEmail && email !== managerEmail) {
        setAccessStatus('granted_forum'); setActiveTab('forum');
      } else if (!adminEmail) {
        setAccessStatus('setup_required');
      } else if (email === adminEmail) {
        setAccessStatus('granted_admin');
      } else if (email === managerEmail) {
        setAccessStatus('granted_manager');
        setActiveTab('orders');
      } else {
        setAccessStatus('denied');
      }
    } catch (error: any) {
      console.error('Access check error:', error);
      setAccessStatus('denied');
    }
  };

  const claimOwnership = async () => {
    if (!currentUserEmail) return;
    const { error } = await supabase.from('settings').insert([{ key: 'admin_email', value: currentUserEmail }]);
    if (!error) {
      alert(`Вітаємо! Ваш email (${currentUserEmail}) встановлено як Адміністратора.`);
      checkAccess();
    } else {
      alert('Помилка: ' + error.message);
    }
  };

  // ── Access states ──────────────────────────────────────────────────────

  if (accessStatus === 'loading') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-[#FFC300] p-4 text-center">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p className="font-bold animate-pulse mb-2">Перевірка прав доступу...</p>
        <p className="text-zinc-500 text-xs max-w-xs">Це може зайняти кілька секунд.</p>
        <button onClick={() => window.location.reload()} className="mt-8 text-zinc-500 hover:text-white text-xs underline">
          Оновити сторінку
        </button>
      </div>
    );
  }

  if (accessStatus === 'denied') {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4 text-center animate-in zoom-in">
        <div className="w-24 h-24 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-6 border-2 border-red-900/50 shadow-[0_0_50px_rgba(220,38,38,0.2)]">
          <ShieldAlert size={48} />
        </div>
        <h2 className="text-3xl font-black text-white mb-2 uppercase">Доступ заборонено</h2>
        <p className="text-zinc-400 max-w-md mb-8 text-lg">
          Ваш акаунт <span className="text-white font-mono bg-zinc-800 px-2 py-1 rounded text-sm">{currentUserEmail}</span> не має прав адміністратора.
        </p>
        <button onClick={onLogout} className="bg-zinc-100 hover:bg-white text-black font-black py-4 px-8 rounded-xl flex items-center gap-2 transition-transform active:scale-95">
          <LogOut size={20} /> Вийти з акаунту
        </button>
      </div>
    );
  }

  if (accessStatus === 'setup_required') {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4 text-center animate-in fade-in">
        <div className="w-24 h-24 bg-[#FFC300]/20 text-[#FFC300] rounded-full flex items-center justify-center mb-6 border-2 border-[#FFC300]/50 shadow-[0_0_50px_rgba(255,195,0,0.2)]">
          <UserCheck size={48} />
        </div>
        <h2 className="text-3xl font-black text-white mb-2 uppercase">Налаштування Власника</h2>
        <p className="text-zinc-400 max-w-md mb-8">
          Система ще не має адміністратора. Призначити акаунт{' '}
          <span className="text-white font-mono bg-zinc-800 px-2 py-1 rounded text-sm">{currentUserEmail}</span> власником?
        </p>
        <button
          onClick={claimOwnership}
          className="bg-[#FFC300] hover:bg-[#e6b000] text-black font-black py-4 px-8 rounded-xl flex items-center gap-2 transition-transform active:scale-95 shadow-lg"
        >
          <UserCheck size={20} /> ТАК, Я ВЛАСНИК
        </button>
      </div>
    );
  }

  // ── Main Panel ─────────────────────────────────────────────────────────
  const isAdmin = accessStatus === 'granted_admin';
  const isManager = accessStatus === 'granted_manager';
  const isForumMod = accessStatus === 'granted_forum';

  const getTabLabel = (tab: string) => {
    const labels: Record<string, string> = {
      categories: 'Категорії', reviews: 'Відгуки',
      tyres: 'Товари', orders: 'Замовлення', promo: 'Маркетинг', sync: 'API / Синхр.',
      seo: 'SEO', articles: 'Статті', settings: 'Налаштування', stats: 'Статистика',
      telegram: 'Telegram', forum: 'Форум',
    };
    return labels[tab] ?? tab;
  };

  const getTabIcon = (tab: string) => {
    const icons: Record<string, React.ReactNode> = {
      categories: <FolderTree size={18} />, reviews: <MessageSquare size={18} />, tyres: <ShoppingBag size={18} />, orders: <FileText size={18} />,
      promo: <Megaphone size={18} />, sync: <Database size={18} />, seo: <Globe size={18} />,
      articles: <FileText size={18} />, settings: <SettingsIcon size={18} />, stats: <BarChart3 size={18} />,
      telegram: <Send size={18} />, forum: <MessagesSquare size={18} />,
    };
    return icons[tab] ?? null;
  };

  const currentTabs = isAdmin
    ? ['orders', 'tyres', 'reviews', 'forum', 'stats', 'telegram', 'settings']
    : isManager
      ? ['orders', 'tyres', 'reviews', 'forum', 'stats']
      : isForumMod ? ['forum'] : [];

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20 lg:pb-6 animate-in fade-in duration-500">
      {/* Confirm dialog */}
      {confirmDialog}

      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50 shadow-md print:hidden">
        {/* Row 1: who is logged in, back to the site, log out */}
        <div className="max-w-[1800px] mx-auto flex items-center gap-2 md:gap-3 px-2 md:px-4 h-14">
          <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 bg-zinc-800 rounded-lg text-zinc-300 hover:text-white" aria-label="Меню">
            <Menu size={22} />
          </button>
          <h1 className="text-base md:text-lg font-black uppercase flex items-center gap-2 shrink-0">
            <Lock size={18} className="text-[#FFC300]" /> {isManager ? 'Менеджер' : 'Адмін'}
          </h1>
          {/* phones and tablets: the open section */}
          <span className="lg:hidden flex items-center gap-1.5 min-w-0 bg-black/50 px-3 py-1.5 rounded-full border border-zinc-800">
            <span className="text-[#FFC300] shrink-0">{getTabIcon(activeTab)}</span>
            <span className="text-[11px] font-black uppercase truncate">{getTabLabel(activeTab)}</span>
          </span>
          <span className="flex-1" />
          {currentUserEmail && <span className="hidden lg:block text-xs text-zinc-500 truncate max-w-[220px]">{currentUserEmail}</span>}
          {onBackToSite && (
            <button onClick={onBackToSite} className="flex items-center gap-1.5 h-9 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-bold border border-zinc-700 shrink-0" title="Перейти на сайт (вхід збережеться)">
              <ChevronRight size={14} className="rotate-180" /> <span className="hidden sm:inline">На сайт</span>
            </button>
          )}
          <button onClick={handleLogout} className="flex items-center gap-1.5 h-9 px-3 text-red-400 hover:bg-red-900/20 rounded-lg text-xs font-bold border border-red-900/30 shrink-0" title="Вийти з акаунту">
            <LogOut size={14} /> <span className="hidden sm:inline">Вийти</span>
          </button>
        </div>

        {/* Row 2 (computer): every section in one line. Spacing, icons and letters shrink with the window —
            the sizes are in index.css (.admin-tabs). Narrower than 1024 px the phone menu is used instead. */}
        <nav className="hidden lg:block border-t border-zinc-800/70">
          <div className="admin-tabs no-scrollbar max-w-[1800px] mx-auto py-2">
            {currentTabs.map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`h-9 rounded-lg font-bold text-xs uppercase whitespace-nowrap transition-colors flex items-center shrink-0 ${
                  activeTab === t ? 'bg-[#FFC300] text-black' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {getTabIcon(t)}
                {getTabLabel(t)}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* Mobile Sidebar */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-zinc-900 border-r border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Lock className="text-[#FFC300]" size={20} />
                <span className="font-black uppercase tracking-tighter text-lg">Меню</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-zinc-800 rounded-lg text-zinc-400">
                <CloseIcon size={20} />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-1">
              <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-3 mb-2">Розділи</div>
              {currentTabs.map(t => (
                <button
                  key={t}
                  onClick={() => { setActiveTab(t); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                    activeTab === t ? 'bg-[#FFC300] text-black font-black' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {getTabIcon(t)}
                    <span className="text-sm uppercase tracking-wide">{getTabLabel(t)}</span>
                  </div>
                  {activeTab === t && <ChevronRight size={16} />}
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-zinc-800 space-y-2">
              {onBackToSite && (
                <button onClick={() => { setIsMobileMenuOpen(false); onBackToSite(); }} className="w-full flex items-center gap-3 p-4 rounded-xl bg-zinc-800 text-zinc-200 font-bold">
                  <ChevronRight size={20} className="rotate-180" /> <span>На сайт</span>
                </button>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-900/10 text-red-500 font-bold hover:bg-red-900/20 transition-colors"
              >
                <LogOut size={20} />
                <span>Вийти з акаунту</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1800px] mx-auto p-2 md:p-4 print:hidden">
        {isAdmin && activeTab === 'settings' && <SettingsTab />}
        {activeTab === 'tyres' && <ProductsBrowser />}
        {activeTab === 'reviews' && <ReviewsTab />}
        {activeTab === 'orders' && <OrdersTab />}
        {activeTab === 'stats' && <StatsTab />}
        {activeTab === 'forum' && <ForumTab isStaff={!isForumMod} />}
        {isAdmin && activeTab === 'telegram' && <TelegramTab />}
      </main>

      {/* Phones and tablets: the main sections at the bottom, the rest in "Ще" */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-800 shadow-2xl print:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {currentTabs.filter(t => ['orders', 'tyres', 'forum', 'reviews'].includes(t)).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 ${activeTab === t ? 'text-[#FFC300]' : 'text-zinc-500'}`}>
              {getTabIcon(t)}
              <span className="text-[10px] font-bold whitespace-nowrap">{getTabLabel(t)}</span>
            </button>
          ))}
          <button onClick={() => setIsMobileMenuOpen(true)}
            className={`flex flex-col items-center justify-center gap-1 py-2.5 ${!['orders', 'tyres', 'forum', 'reviews'].includes(activeTab) ? 'text-[#FFC300]' : 'text-zinc-500'}`}>
            <Menu size={18} />
            <span className="text-[10px] font-bold">Ще</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default AdminPanel;
