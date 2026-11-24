import React, { useCallback, useEffect, useState } from 'react';
import { Send, Loader2, Copy, Check, Trash2, Bell, BellOff, UserPlus, KeyRound, RefreshCw, ExternalLink, ShieldCheck, User } from 'lucide-react';
import { supabase } from '../../supabaseClient';

/**
 * Telegram bot: who gets orders in Telegram, invitations for owners / workers, bot status.
 * The bot itself is the edge function "telegram-bot".
 */
interface TgUser { id: number; chat_id: number; name: string | null; username: string | null; role: 'owner' | 'staff'; notify: boolean; active: boolean; created_at: string }
interface Invite { code: string; role: 'owner' | 'staff'; label: string | null; expires_at: string; used_at: string | null }

const BOT_FALLBACK = 'Forsageshop_bot';
const ROLE: Record<string, string> = { owner: 'Власник', staff: 'Працівник' };

const call = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('telegram-bot', { body });
  if (error) {
    let msg = error.message;
    try { msg = (await (error as any).context?.json())?.error || msg; } catch { /* keep */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
};
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join('');

const TelegramTab: React.FC = () => {
  const [bot, setBot] = useState<{ ok: boolean; username?: string; webhook?: string; last_error?: string } | null>(null);
  const [users, setUsers] = useState<TgUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [label, setLabel] = useState('');
  const [role, setRole] = useState<'staff' | 'owner'>('staff');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [token, setToken] = useState('');
  const botName = bot?.username || BOT_FALLBACK;
  const inviteLink = (code: string) => `https://t.me/${botName}?start=${code}`;

  const load = useCallback(async () => {
    const [{ data: u }, { data: i }] = await Promise.all([
      supabase.from('telegram_users').select('*').order('created_at'),
      supabase.from('telegram_invites').select('*').is('used_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
    ]);
    setUsers((u as TgUser[]) || []); setInvites((i as Invite[]) || []);
  }, []);
  const loadBot = useCallback(async () => { try { setBot(await call({ action: 'status' })); } catch (e: any) { setBot({ ok: false, last_error: e.message }); } }, []);
  useEffect(() => { load(); loadBot(); }, [load, loadBot]);

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key); setMsg('');
    try { const m = await fn(); if (m) setMsg(m); } catch (e: any) { setMsg(`Помилка: ${e.message}`); }
    setBusy(''); load();
  };

  const invite = () => run('invite', async () => {
    const code = newCode();
    const { error } = await supabase.from('telegram_invites').insert({ code, role, label: label.trim() || null });
    if (error) throw error;
    setLabel('');
    return `Посилання створено — надішліть його людині. Діє 24 години, спрацює один раз.`;
  });
  const update = (u: TgUser, patch: Partial<TgUser>) => run(`u${u.id}`, async () => {
    const { error } = await supabase.from('telegram_users').update(patch).eq('id', u.id);
    if (error) throw error;
  });
  const remove = (u: TgUser) => {
    if (!window.confirm(`Забрати доступ до бота у «${u.name || u.username || u.chat_id}»?`)) return;
    run(`u${u.id}`, async () => { const { error } = await supabase.from('telegram_users').delete().eq('id', u.id); if (error) throw error; return 'Доступ забрано.'; });
  };
  const dropInvite = (c: string) => run(`i${c}`, async () => { await supabase.from('telegram_invites').delete().eq('code', c); });
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); setCopied(text); setTimeout(() => setCopied(''), 1500); } catch { /* no clipboard */ } };

  const card = 'bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-5';
  const btn = 'h-10 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50';

  return (
    <div className="space-y-5 max-w-4xl animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-black text-white flex items-center gap-2"><Send className="text-[#FFC300]" /> Telegram-бот</h2>
        <p className="text-zinc-400 text-sm mt-1">Нові замовлення й відгуки приходять у Telegram. Там же можна підтвердити замовлення, додати ТТН і знайти товар.</p>
      </div>

      {/* Bot status */}
      <div className={`${card} flex flex-wrap items-center gap-3`}>
        {bot === null ? <Loader2 className="animate-spin text-zinc-500" /> : (
          <>
            <span className={`w-2.5 h-2.5 rounded-full ${bot.ok && bot.webhook ? 'bg-green-500' : 'bg-red-500'}`} />
            <div className="flex-1 min-w-[200px]">
              <p className="text-white font-bold">{bot.ok ? `@${bot.username}` : 'Бот не підключено'}</p>
              <p className="text-xs text-zinc-500">{bot.ok && bot.webhook ? 'Працює: повідомлення доходять' : bot.last_error || 'Перевірте токен'}</p>
            </div>
            {bot.ok && <a href={`https://t.me/${botName}`} target="_blank" rel="noreferrer" className={`${btn} bg-zinc-800 hover:bg-zinc-700 text-zinc-200`}><ExternalLink size={14} /> Відкрити бота</a>}
            <button onClick={() => run('test', async () => { const r = await call({ action: 'test' }); return r.sent ? `Тест надіслано: ${r.sent} людям.` : 'Ще ніхто не підключений — створіть запрошення нижче.'; })}
              disabled={!!busy} className={`${btn} bg-zinc-800 hover:bg-zinc-700 text-zinc-200`}>{busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />} Тест</button>
          </>
        )}
      </div>

      {msg && <p className="text-sm text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">{msg}</p>}

      {/* Invite */}
      <div className={card}>
        <h3 className="text-base font-black text-white flex items-center gap-2 mb-3"><UserPlus size={18} className="text-[#FFC300]" /> Дати доступ людині</h3>
        <div className="grid sm:grid-cols-[1fr_180px_auto] gap-2">
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ім'я (наприклад: Олег, менеджер)"
            className="h-11 bg-black border border-zinc-700 rounded-xl px-3 text-sm text-white outline-none focus:border-[#FFC300] min-w-0" />
          <select value={role} onChange={e => setRole(e.target.value as 'staff' | 'owner')} className="h-11 bg-black border border-zinc-700 rounded-xl px-3 text-sm text-white outline-none focus:border-[#FFC300]">
            <option value="staff">Працівник</option>
            <option value="owner">Власник</option>
          </select>
          <button onClick={invite} disabled={!!busy} className={`${btn} h-11 bg-[#FFC300] hover:bg-white text-black`}>{busy === 'invite' ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Створити посилання</button>
        </div>
        <p className="text-xs text-zinc-500 mt-2"><b className="text-zinc-300">Працівник</b> бачить замовлення, змінює статуси, додає ТТН, шукає товари. <b className="text-zinc-300">Власник</b> — те саме + виручка, звіти, відгуки, список людей.</p>

        {invites.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Очікують підключення</p>
            {invites.map(i => (
              <div key={i.code} className="flex flex-wrap items-center gap-2 bg-black/40 border border-zinc-800 rounded-xl p-3">
                <span className="text-sm text-white font-bold">{i.label || 'Без імені'}</span>
                <span className="text-[11px] text-zinc-400 bg-zinc-800 rounded px-1.5 py-0.5">{ROLE[i.role]}</span>
                <code className="flex-1 min-w-[180px] text-xs text-[#FFC300] truncate">{inviteLink(i.code)}</code>
                <button onClick={() => copy(inviteLink(i.code))} className="h-8 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  {copied === inviteLink(i.code) ? <><Check size={12} /> Скопійовано</> : <><Copy size={12} /> Копіювати</>}
                </button>
                <button onClick={() => dropInvite(i.code)} className="h-8 w-8 rounded-lg hover:bg-red-900/30 text-zinc-500 hover:text-red-400 flex items-center justify-center" aria-label="Видалити"><Trash2 size={14} /></button>
              </div>
            ))}
            <p className="text-xs text-zinc-500">Людина відкриває посилання на телефоні → натискає «Start» у Telegram → готово.</p>
          </div>
        )}
      </div>

      {/* People */}
      <div className={card}>
        <h3 className="text-base font-black text-white mb-3">Хто має доступ ({users.length})</h3>
        {users.length === 0 ? <p className="text-sm text-zinc-500">Поки нікого. Створіть посилання вище.</p> : (
          <div className="divide-y divide-zinc-800">
            {users.map(u => (
              <div key={u.id} className={`flex flex-wrap items-center gap-2 py-3 ${u.active ? '' : 'opacity-50'}`}>
                <span className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-[#FFC300] shrink-0">{u.role === 'owner' ? <ShieldCheck size={16} /> : <User size={16} />}</span>
                <div className="flex-1 min-w-[140px]">
                  <p className="text-sm text-white font-bold">{u.name || 'Без імені'}</p>
                  <p className="text-xs text-zinc-500">{u.username ? `@${u.username}` : `ID ${u.chat_id}`}</p>
                </div>
                <select value={u.role} onChange={e => update(u, { role: e.target.value as TgUser['role'] })}
                  className="h-9 bg-black border border-zinc-700 rounded-lg px-2 text-xs text-white outline-none">
                  <option value="staff">Працівник</option>
                  <option value="owner">Власник</option>
                </select>
                <button onClick={() => update(u, { notify: !u.notify })} title={u.notify ? 'Сповіщення увімкнені' : 'Сповіщення вимкнені'}
                  className={`h-9 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 ${u.notify ? 'bg-green-500/15 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                  {u.notify ? <Bell size={14} /> : <BellOff size={14} />} <span className="hidden sm:inline">{u.notify ? 'Сповіщення' : 'Без сповіщень'}</span>
                </button>
                <button onClick={() => remove(u)} className="h-9 w-9 rounded-lg hover:bg-red-900/30 text-zinc-500 hover:text-red-400 flex items-center justify-center" aria-label="Забрати доступ"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* What the bot does */}
      <div className={`${card} text-sm text-zinc-400 space-y-1.5`}>
        <h3 className="text-base font-black text-white mb-2">Що робить бот</h3>
        <p>🛒 <b className="text-zinc-200">Нове замовлення</b> — одразу всім: товари, сума, телефон, доставка. Кнопки: Підтвердити / Відправлено / Виконано / Скасувати, ТТН, коментар.</p>
        <p>⭐ <b className="text-zinc-200">Новий відгук</b> — власникам, з кнопками «Опублікувати» / «Відхилити».</p>
        <p>📊 <b className="text-zinc-200">Щовечора о 20:00</b> — власникам підсумок дня: замовлення, виручка, що не оброблено, чи працює синхронізація з програмою.</p>
        <p>🔎 <b className="text-zinc-200">Пошук товару</b> — просто напишіть боту назву або артикул: ціна і залишок.</p>
        <p>Команди: /orders, /order 123, /find, /today, /week, /team, /notify, /help.</p>
      </div>

      {/* Token */}
      <div className={card}>
        <button onClick={() => setShowToken(v => !v)} className="w-full flex items-center gap-2 text-left text-sm text-zinc-400 hover:text-white">
          <KeyRound size={16} /> <span className="flex-1">Замінити токен бота</span><span className="text-xs text-[#FFC300] font-bold">{showToken ? 'Згорнути' : 'Відкрити'}</span>
        </button>
        {showToken && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-zinc-500">Якщо токен потрапив до сторонніх: у Telegram відкрийте @BotFather → /revoke → виберіть бота → вставте новий токен сюди.</p>
            <div className="flex gap-2">
              <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="123456789:AA..." autoComplete="off"
                className="flex-1 min-w-0 h-11 bg-black border border-zinc-700 rounded-xl px-3 text-sm text-white outline-none focus:border-[#FFC300]" />
              <button onClick={() => run('token', async () => { await call({ action: 'set_token', token }); setToken(''); await loadBot(); return 'Токен збережено, бот перепідключений.'; })}
                disabled={!!busy || token.length < 20} className={`${btn} h-11 bg-white hover:bg-[#FFC300] text-black shrink-0`}>
                {busy === 'token' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Зберегти
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TelegramTab;
