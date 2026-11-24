import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

export type AuthMode = 'login' | 'register' | 'forgot';

export interface FieldErrors {
  email?: string;
  password?: string;
  fullName?: string;
  phone?: string;
}

interface UseAuthOptions {
  /** called after a successful sign-in that was started from the auth form */
  onLogin?: () => void;
  onLogout?: () => void;
}

const validateEmail = (email: string): string | undefined => {
  if (!email) return 'Email обов\'язковий';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Невірний формат email';
};

const validatePassword = (password: string, mode: AuthMode): string | undefined => {
  if (!password) return 'Пароль обов\'язковий';
  if (mode === 'register' && password.length < 6) return 'Мінімум 6 символів';
};

const validatePhone = (phone: string): string | undefined => {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return 'Телефон обов\'язковий';
  if (digits.length < 10) return 'Введіть номер повністю, напр. 067 123 45 67';
};

/** Human friendly Ukrainian messages for common Supabase auth errors. */
const translateAuthError = (message: string): string => {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Невірний email або пароль';
  if (m.includes('email not confirmed')) return 'Email ще не підтверджено. Перевірте пошту (і папку «Спам»).';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Такий email вже зареєстровано. Спробуйте увійти або відновити пароль.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Забагато спроб. Зачекайте хвилину і спробуйте ще раз.';
  if (m.includes('password should be')) return 'Пароль занадто простий — мінімум 6 символів.';
  if (m.includes('signups not allowed')) return 'Реєстрація тимчасово вимкнена.';
  return message;
};

export const useAuth = ({ onLogin, onLogout }: UseAuthOptions = {}) => {
  const [session, setSession] = useState<any>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [verifying, setVerifying] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FieldErrors, boolean>>>({});

  useEffect(() => {
    setFieldErrors({
      email: touched.email ? validateEmail(email) : undefined,
      password: touched.password && authMode !== 'forgot' ? validatePassword(password, authMode) : undefined,
      fullName: touched.fullName && authMode === 'register' && !fullName.trim() ? 'Вкажіть ім\'я' : undefined,
      phone: touched.phone && authMode === 'register' ? validatePhone(phone) : undefined,
    });
  }, [email, password, fullName, phone, authMode, touched]);

  const touchField = (field: keyof FieldErrors) => setTouched(prev => ({ ...prev, [field]: true }));

  const isFormValid = () => {
    if (validateEmail(email)) return false;
    if (authMode !== 'forgot' && validatePassword(password, authMode)) return false;
    if (authMode === 'register' && (!fullName.trim() || validatePhone(phone))) return false;
    return true;
  };

  // Refs to read latest state inside the auth listener without re-subscribing
  const showAuthModalRef = useRef(showAuthModal);
  const onLoginRef = useRef(onLogin);
  const onLogoutRef = useRef(onLogout);
  const loginStartedRef = useRef(false);
  useEffect(() => { showAuthModalRef.current = showAuthModal; }, [showAuthModal]);
  useEffect(() => { onLoginRef.current = onLogin; }, [onLogin]);
  useEffect(() => { onLogoutRef.current = onLogout; }, [onLogout]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setSessionLoaded(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setSessionLoaded(true);
      if (session && (showAuthModalRef.current || loginStartedRef.current)) {
        loginStartedRef.current = false;
        setShowAuthModal(false);
        onLoginRef.current?.();
        resetForm();
      }
      if (!session) onLogoutRef.current?.();
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setEmail(''); setPassword(''); setFullName(''); setPhone('');
    setAuthError(''); setAuthSuccess('');
    setFieldErrors({}); setTouched({});
  };

  const openAuthModal = (mode: AuthMode = 'login') => {
    resetForm();
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const closeAuthModal = () => {
    setShowAuthModal(false);
    resetForm();
  };

  const handleAuthAction = async () => {
    if (verifying) return;
    setTouched({ email: true, password: true, fullName: true, phone: true });
    if (!isFormValid()) return;

    setVerifying(true);
    setAuthError('');
    setAuthSuccess('');
    try {
      if (authMode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim(), phone: phone.trim() },
            emailRedirectTo: `${window.location.origin}/account`,
          },
        });
        if (error) throw error;
        if (data.session) {
          loginStartedRef.current = true; // the listener closes the form
        } else {
          setAuthSuccess('Майже готово! Ми надіслали лист на вашу пошту — натисніть у ньому кнопку підтвердження, потім увійдіть.');
          setAuthMode('login');
          setPassword('');
          setTouched({});
        }
      } else if (authMode === 'login') {
        loginStartedRef.current = true;
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          loginStartedRef.current = false;
          setPassword('');
          throw error;
        }
      }
    } catch (error: any) {
      setAuthError(translateAuthError(error.message || String(error)));
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
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/account`,
      });
      if (error) throw error;
      setAuthSuccess('Лист для відновлення паролю відправлено! Перевірте пошту.');
    } catch (error: any) {
      setAuthError(translateAuthError(error.message || String(error)));
    } finally {
      setVerifying(false);
    }
  };

  const logout = () => supabase.auth.signOut();

  return {
    session, sessionLoaded,
    showAuthModal, authMode,
    email, password, fullName, phone,
    authError, authSuccess, verifying,
    fieldErrors, touched,
    isFormValid, touchField,
    setAuthMode, setEmail, setPassword, setFullName, setPhone,
    setAuthError, setAuthSuccess,
    openAuthModal, closeAuthModal,
    handleAuthAction, handlePasswordReset,
    logout, resetForm,
  };
};

export type AuthState = ReturnType<typeof useAuth>;
