import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

export type AuthMode = 'login' | 'register' | 'forgot';
export type AuthTab = 'admin' | 'service';

export interface FieldErrors {
  email?: string;
  password?: string;
}

interface UseAuthOptions {
  onLogin?: (tab: AuthTab) => void;
  onLogout?: () => void;
}

const validateEmail = (email: string): string | undefined => {
  if (!email) return 'Email обов\'язковий';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Невірний формат email';
};

const validatePassword = (password: string, mode: AuthMode): string | undefined => {
  if (!password) return 'Пароль обов\'язковий';
  if (mode === 'register' && password.length < 6) return 'Мінімум 6 символів';
};

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

  // Real-time validation
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});

  // Validate on change if field was touched
  useEffect(() => {
    if (touched.email) {
      const err = validateEmail(email);
      setFieldErrors(prev => ({ ...prev, email: err }));
    }
  }, [email, touched.email]);

  useEffect(() => {
    if (touched.password && authMode !== 'forgot') {
      const err = validatePassword(password, authMode);
      setFieldErrors(prev => ({ ...prev, password: err }));
    }
  }, [password, authMode, touched.password]);

  const touchField = (field: 'email' | 'password') => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const isFormValid = () => {
    const emailErr = validateEmail(email);
    const passwordErr = authMode !== 'forgot' ? validatePassword(password, authMode) : undefined;
    return !emailErr && !passwordErr;
  };

  // Refs to read latest state inside auth listener without re-subscribing
  const showAuthModalRef = useRef(showAuthModal);
  const authTabRef = useRef(authTab);
  const onLoginRef = useRef(onLogin);
  const onLogoutRef = useRef(onLogout);

  useEffect(() => { showAuthModalRef.current = showAuthModal; }, [showAuthModal]);
  useEffect(() => { authTabRef.current = authTab; }, [authTab]);
  useEffect(() => { onLoginRef.current = onLogin; }, [onLogin]);
  useEffect(() => { onLogoutRef.current = onLogout; }, [onLogout]);

  // Subscribe once on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session && showAuthModalRef.current) {
        setShowAuthModal(false);
        onLoginRef.current?.(authTabRef.current);
        resetForm();
      }
      if (!session) {
        onLogoutRef.current?.();
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setAuthError('');
    setAuthSuccess('');
    setFieldErrors({});
    setTouched({});
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
    if (verifying) return;
    // Touch all fields to show errors
    setTouched({ email: true, password: true });
    if (!isFormValid()) return;

    setVerifying(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      if (authMode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setAuthSuccess('Акаунт створено! Спробуйте увійти.');
        setAuthMode('login');
        setPassword('');
        setTouched({});
      } else if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setPassword('');
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
    setTouched({ email: true });
    if (validateEmail(email)) { setAuthError('Введіть коректний Email.'); return; }
    if (verifying) return;
    setVerifying(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setAuthSuccess('Лист для відновлення паролю відправлено!');
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
    fieldErrors,
    touched,
    isFormValid,
    touchField,
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
