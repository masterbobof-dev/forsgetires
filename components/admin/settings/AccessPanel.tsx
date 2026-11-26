import React from 'react';
import { UserCog, UserCheck, Eye, EyeOff } from 'lucide-react';
import type { SettingsForm } from './useSettingsForm';

/** Part "Менеджер / Доступ": the manager's sign-in and the e-mail of the service employee. */
const AccessPanel: React.FC<{ form: SettingsForm }> = ({ form }) => {
  const {
    managerEmail, setManagerEmail, managerPassword, setManagerPassword, showManagerPassword, setShowManagerPassword, serviceEmail, setServiceEmail,
  } = form;

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4">
        <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2 pb-4 border-b border-zinc-800"><UserCog className="text-[#FFC300]" size={20}/> Доступ та Співробітники</h4>

        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-4">
              <label className="block text-[#FFC300] text-xs font-bold uppercase mb-2 flex items-center gap-2">
                  <UserCheck size={16}/> Вхід для Менеджера
              </label>
              <p className="text-zinc-400 text-sm">
                  Менеджер матиме доступ до товарів, замовлень, маркетингу та статистики, але <strong>НЕ зможе</strong> бачити налаштування (API ключі) та імпортувати/експортувати базу даних.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-zinc-400 text-[10px] font-bold uppercase mb-1">Email Менеджера</label>
                      <input 
                          type="email" 
                          value={managerEmail} 
                          onChange={e => setManagerEmail(e.target.value)} 
                          className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-bold" 
                          placeholder="manager@forsage.com"
                      />
                  </div>
                  <div>
                      <label className="block text-zinc-400 text-[10px] font-bold uppercase mb-1">Новий Пароль Менеджера (опціонально)</label>
                      <div className="relative">
                          <input 
                              type={showManagerPassword ? "text" : "password"} 
                              value={managerPassword} 
                              onChange={e => setManagerPassword(e.target.value)} 
                              className="w-full bg-black border border-zinc-700 rounded-lg p-3 pr-10 text-white font-mono text-sm focus:border-[#FFC300] outline-none" 
                              placeholder="Введіть новий пароль, щоб змінити..."
                          />
                          <button 
                              type="button"
                              onClick={() => setShowManagerPassword(!showManagerPassword)} 
                              className="absolute right-3 top-3 text-zinc-500 hover:text-white"
                              title={showManagerPassword ? "Приховати" : "Показати"}
                          >
                              {showManagerPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                          </button>
                      </div>
                  </div>
              </div>
              {managerPassword.trim() && (
                  <p className="text-[10px] text-amber-400 font-bold">
                      Пароль буде оновлено при збереженні всіх налаштувань.
                  </p>
              )}
        </div>

        <div className="bg-blue-900/10 p-4 rounded-xl border border-blue-900/30">
             <label className="block text-blue-200 text-xs font-bold uppercase mb-2 flex items-center gap-2"><UserCog size={16}/> Вхід для Співробітника</label>
             <p className="text-zinc-400 text-sm mb-3">Користувач з цим email матиме доступ <strong>ТІЛЬКИ</strong> до вкладки "Сервіс" (Розклад/Клієнти).</p>
             <input type="email" value={serviceEmail} onChange={e => setServiceEmail(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white font-bold" placeholder="staff@forsage.com"/>
        </div>
    </div>
  );
};

export default AccessPanel;
