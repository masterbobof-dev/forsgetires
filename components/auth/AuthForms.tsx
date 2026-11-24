import React from 'react';
import { X, Loader2, Mail, Key, ArrowLeft, Send, CheckCircle2, AlertCircle, User, Phone, Lock, ShoppingBag } from 'lucide-react';
import type { AuthState } from '../../useAuth';

// Input with inline validation
export const AuthField = ({
  type, value, onChange, onBlur, placeholder, icon, error, touched, autoComplete, inputMode,
}: {
  type: string; value: string; onChange: (v: string) => void; onBlur: () => void;
  placeholder: string; icon: React.ReactNode; error?: string; touched?: boolean;
  autoComplete?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) => {
  const hasError = touched && error;
  const isValid = touched && !error && value;
  return (
    <div className="w-full space-y-1">
      <div className={`relative flex items-center border rounded-xl transition-colors duration-200 ${
        hasError ? 'border-red-500' : isValid ? 'border-green-500' : 'border-zinc-700 focus-within:border-[#FFC300]'
      } bg-black`}>
        <span className="absolute left-3 text-zinc-500">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          className="w-full bg-transparent p-3 pl-10 pr-10 text-white outline-none text-base"
        />
        {isValid && <CheckCircle2 className="absolute right-3 text-green-500 shrink-0" size={16} />}
        {hasError && <AlertCircle className="absolute right-3 text-red-500 shrink-0" size={16} />}
      </div>
      {hasError && <p className="text-red-400 text-xs pl-1 animate-in fade-in slide-in-from-top-1 duration-200">{error}</p>}
    </div>
  );
};

const Message: React.FC<{ auth: AuthState }> = ({ auth }) =>
  auth.authError || auth.authSuccess ? (
    <div className={`text-center p-3 rounded-xl text-xs font-bold animate-in fade-in zoom-in-95 w-full ${
      auth.authError ? 'bg-red-900/20 text-red-400 border border-red-900/50' : 'bg-green-900/20 text-green-400 border border-green-900/50'
    }`}>
      {auth.authError || auth.authSuccess}
    </div>
  ) : null;

/** Email + password (+ name / phone on registration) form, or the "forgot password" form. */
export const AuthFormBody: React.FC<{ auth: AuthState; allowRegister: boolean; accent?: 'yellow' | 'white' }> = ({ auth, allowRegister }) => {
  if (auth.authMode === 'forgot') {
    return (
      <form className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-right-4 duration-300" onSubmit={e => { e.preventDefault(); auth.handlePasswordReset(); }}>
        <p className="text-zinc-400 text-sm text-center">Введіть email — надішлемо посилання для нового пароля.</p>
        <AuthField type="email" value={auth.email} onChange={auth.setEmail} onBlur={() => auth.touchField('email')}
          placeholder="Email" icon={<Mail size={18} />} error={auth.fieldErrors.email} touched={auth.touched.email} autoComplete="email" inputMode="email" />
        <button type="submit" disabled={auth.verifying}
          className="w-full bg-[#FFC300] hover:bg-[#e6b000] text-black font-black py-3 rounded-xl transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60">
          {auth.verifying ? <Loader2 className="animate-spin" /> : <><Send size={18} /> ВІДПРАВИТИ</>}
        </button>
        <button type="button" onClick={() => { auth.resetForm(); auth.setAuthMode('login'); }} className="text-zinc-500 hover:text-white text-sm font-bold flex items-center gap-2">
          <ArrowLeft size={16} /> Назад до входу
        </button>
        <Message auth={auth} />
      </form>
    );
  }

  const isRegister = auth.authMode === 'register';
  return (
    <form className="flex flex-col items-center gap-3 animate-in fade-in duration-300" onSubmit={e => { e.preventDefault(); auth.handleAuthAction(); }}>
      {isRegister && (
        <>
          <AuthField type="text" value={auth.fullName} onChange={auth.setFullName} onBlur={() => auth.touchField('fullName')}
            placeholder="Ім'я та прізвище" icon={<User size={18} />} error={auth.fieldErrors.fullName} touched={auth.touched.fullName} autoComplete="name" />
          <AuthField type="tel" value={auth.phone} onChange={auth.setPhone} onBlur={() => auth.touchField('phone')}
            placeholder="Телефон, напр. 067 123 45 67" icon={<Phone size={18} />} error={auth.fieldErrors.phone} touched={auth.touched.phone} autoComplete="tel" inputMode="tel" />
        </>
      )}
      <AuthField type="email" value={auth.email} onChange={auth.setEmail} onBlur={() => auth.touchField('email')}
        placeholder="Email" icon={<Mail size={18} />} error={auth.fieldErrors.email} touched={auth.touched.email} autoComplete="email" inputMode="email" />
      <AuthField type="password" value={auth.password} onChange={auth.setPassword} onBlur={() => auth.touchField('password')}
        placeholder={isRegister ? 'Придумайте пароль (мін. 6 символів)' : 'Пароль'} icon={<Key size={18} />}
        error={auth.fieldErrors.password} touched={auth.touched.password} autoComplete={isRegister ? 'new-password' : 'current-password'} />

      <button type="submit" disabled={auth.verifying}
        className="w-full mt-1 bg-[#FFC300] hover:bg-white text-black font-black py-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-60 uppercase tracking-wide">
        {auth.verifying ? <Loader2 className="animate-spin mx-auto" /> : isRegister ? 'Створити акаунт' : 'Увійти'}
      </button>

      {isRegister && (
        <p className="text-[11px] text-zinc-500 text-center leading-snug">
          Реєструючись, ви погоджуєтесь з <a href="/oferta" target="_blank" className="underline hover:text-zinc-300">публічною офертою</a> та{' '}
          <a href="/privacy" target="_blank" className="underline hover:text-zinc-300">політикою конфіденційності</a>.
        </p>
      )}

      <div className="flex flex-col gap-2 items-center mt-1">
        {allowRegister && (
          <button type="button" onClick={() => { auth.resetForm(); auth.setAuthMode(isRegister ? 'login' : 'register'); }}
            className="text-zinc-300 hover:text-[#FFC300] text-sm font-bold transition-colors">
            {isRegister ? 'Вже є акаунт? Увійти' : 'Немає акаунту? Зареєструватися'}
          </button>
        )}
        {!isRegister && (
          <button type="button" onClick={() => { auth.resetForm(); auth.setAuthMode('forgot'); }}
            className="text-zinc-500 hover:text-zinc-300 text-[11px] uppercase tracking-widest font-bold">
            Забули пароль?
          </button>
        )}
      </div>
      <Message auth={auth} />
    </form>
  );
};

/** Customer sign-in / registration window. */
export const CustomerAuthModal: React.FC<{ auth: AuthState }> = ({ auth }) => {
  if (!auth.showAuthModal || auth.session) return null;
  const title = auth.authMode === 'register' ? 'Реєстрація' : auth.authMode === 'forgot' ? 'Відновлення пароля' : 'Вхід у кабінет';
  return (
    <div className="fixed inset-0 z-[190] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200" onClick={auth.closeAuthModal}>
      <div className="bg-zinc-900 border border-zinc-700 p-5 sm:p-6 rounded-t-3xl sm:rounded-2xl w-full max-w-sm relative shadow-2xl flex flex-col gap-4 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom sm:slide-in-from-bottom-8 sm:zoom-in-95 duration-300 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <button onClick={auth.closeAuthModal} className="absolute top-4 right-4 text-zinc-500 hover:text-white" aria-label="Закрити"><X size={24} /></button>
        <div className="flex flex-col items-center gap-2 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-[#FFC300]/10 text-[#FFC300] flex items-center justify-center"><ShoppingBag size={24} /></div>
          <h3 className="text-xl font-black text-white uppercase italic">{title}</h3>
          {auth.authMode === 'register' && (
            <p className="text-zinc-400 text-xs text-center">Зберігайте адресу доставки, дивіться свої замовлення та їхній статус.</p>
          )}
        </div>
        <AuthFormBody auth={auth} allowRegister />
      </div>
    </div>
  );
};

/** Separate staff sign-in page (address /admin). No registration. */
export const StaffLogin: React.FC<{ auth: AuthState; onBack: () => void }> = ({ auth, onBack }) => (
  <div className="min-h-screen flex items-center justify-center p-4 bg-[#09090b]">
    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-2xl bg-zinc-800 text-[#FFC300] flex items-center justify-center"><Lock size={22} /></div>
        <h1 className="text-xl font-black text-white uppercase">Вхід для персоналу</h1>
      </div>
      <AuthFormBody auth={auth} allowRegister={false} />
      <button onClick={onBack} className="text-zinc-600 hover:text-zinc-300 text-xs font-bold flex items-center justify-center gap-1"><ArrowLeft size={14} /> На сайт</button>
    </div>
  </div>
);
