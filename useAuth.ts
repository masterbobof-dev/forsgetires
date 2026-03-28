import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export type AuthMode = 'login' | 'register' | 'forgot';
export type AuthTab = 'admin' | 'service';

interface UseAuthOptions {
  onLogin?: (tab: AuthTab) => void;
  onLogout?: () => void;
}

export const useAuth = ({ onLogin, onLogout }: UseAuthOptions = {}) => {
  const [session, setSession] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authTab, setAuthTab] = useState<AuthTab>('admin');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session && showAuthModal) {
        setShowAuthModal(false);
        onLogin?.(authTab);
        resetForm();
      }
      if (!session) {
        onLogout?.();
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAuthModal, authTab]);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setAuthError('');
    setAuthSuccess('');
  };

  const openAuthModal = () => {
    resetForm();
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const closeAuthModal = () => {
    setShowAuthModal(false);
    resetForm();
  };

  const handleAuthAction = async () => {
    if (verifying) return; // Prevent double submit
    setVerifying(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      if (authMode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setAuthSuccess('Акаунт створено! Спробуйте увійти.');
        setAuthMode('login');
        setPassword(''); // Clear password after registration
      } else if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setPassword(''); // Clear password on error
          throw error;
        }
      }
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setVerifying(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) { setAuthError('Введіть Email для відновлення.'); return; }
    if (verifying) return;
    setVerifying(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setAuthSuccess('Лист для відновлення паролю відправлено на вашу пошту!');
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setVerifying(false);
    }
  };

  const logout = () => supabase.auth.signOut();

  return {
    session,
    showAuthModal,
    authMode,
    authTab,
    email,
    password,
    authError,
    authSuccess,
    verifying,
    setAuthMode,
    setAuthTab,
    setEmail,
    setPassword,
    setAuthError,
    setAuthSuccess,
    openAuthModal,
    closeAuthModal,
    handleAuthAction,
    handlePasswordReset,
    logout,
    resetForm,
  };
};
