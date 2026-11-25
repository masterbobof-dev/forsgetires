// @ts-nocheck
/**
 * Telegram bot of the shop (@Forsageshop_bot). Token and webhook secret live in private.integration_secrets.
 *
 * Who calls it:
 *  - Telegram (webhook; header X-Telegram-Bot-Api-Secret-Token): messages and button presses.
 *  - The database (header x-sync-key): { action: "notify_order", id } | { action: "notify_review", id } | { action: "daily" } | { action: "setup" }
 *  - The admin panel (staff login): { action: "status" } | { action: "set_token", token } | { action: "test" } | { action: "setup" }
 *
 * People: table telegram_users (role owner = everything incl. money; staff = orders and goods).
 * Access is given with a one-time code from the admin panel: t.me/<bot>?start=<code>.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-sync-key', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json', ...cors } });
const SITE = 'https://www.forsage-tires.com';

let secrets: { token: string; secret: string; sync: string } | null = null;
const getSecrets = async () => {
  if (secrets) return secrets;
  const { data, error } = await db.rpc('telegram_secrets');
  if (error) throw new Error(error.message);
  return (secrets = data);
};

const tg = async (method: string, payload: Record<string, unknown>) => {
  const { token } = await getSecrets();
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const out = await res.json().catch(() => ({}));
  if (!out.ok) console.error('telegram', method, out.description);
  return out;
};
const send = (chat_id: number, text: string, extra: Record<string, unknown> = {}) =>
  tg('sendMessage', { chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = (n: number) => `${Math.round(n).toLocaleString('uk-UA').replace(/,/g, ' ')} грн`;
const num = (v: unknown) => { const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.]/g, '')); return isFinite(n) ? n : 0; };
const kyivDay = (d = new Date()) => new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
/** start of "today" in Kyiv as an ISO time */
const todayStart = () => {
  const now = new Date(); const k = kyivDay(now);
  const offset = k.getTime() - now.getTime();
  const start = new Date(k.getFullYear(), k.getMonth(), k.getDate());
  return new Date(start.getTime() - offset).toISOString();
};

// ---------- orders ----------
const STATUS: Record<string, string> = { new: '🆕 Нове', confirmed: '✅ Підтверджено', shipped: '📦 Відправлено', completed: '✔️ Виконано', cancelled: '❌ Скасовано' };
const orderTotal = (o: any) => (o.items || []).reduce((s: number, i: any) => s + num(i.price) * (Number(i.quantity) || 1), 0);

const orderText = (o: any, note = '') => {
  const items = (o.items || []).map((i: any) => {
    const price = num(i.price);
    return `• ${esc(i.title)} × ${i.quantity || 1}${price ? ` — ${money(price * (Number(i.quantity) || 1))}` : ' — ціну уточнити'}`;
  }).join('\n');
  const delivery = o.delivery_method === 'newpost'
    ? `🚚 Нова Пошта: ${esc(o.delivery_city || '—')}${o.delivery_warehouse ? `, ${esc(o.delivery_warehouse)}` : ''}`
    : o.delivery_method === 'pickup' ? '🏪 Самовивіз' : '⚡ Швидке замовлення (передзвонити)';
  const pay = o.payment_method === 'full' ? '💳 Повна оплата' : o.payment_method === 'prepayment' ? '💳 Передоплата' : '';
  const total = orderTotal(o);
  const when = new Date(o.created_at).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return [
    `<b>🛒 Замовлення №${o.id}</b> · ${when}`,
    `Статус: <b>${STATUS[o.status] || esc(o.status)}</b>`,
    '',
    `👤 ${esc(o.customer_name || '—')}`,
    `📞 ${esc(o.customer_phone || '—')}`,
    o.customer_email ? `✉️ ${esc(o.customer_email)}` : '',
    delivery, pay,
    o.tracking_number ? `🔢 ТТН: <code>${esc(o.tracking_number)}</code>` : '',
    '',
    items || '—',
    total ? `<b>Разом: ${money(total)}</b>` : '',
    o.comment ? `\n💬 ${esc(o.comment)}` : '',
    o.manager_comment ? `📝 ${esc(o.manager_comment)}` : '',
    note ? `\n<i>${esc(note)}</i>` : '',
  ].filter(l => l !== '').join('\n').replace(/\n{3,}/g, '\n\n');
};

const orderButtons = (o: any) => {
  const b = (text: string, data: string) => ({ text, callback_data: data });
  const rows: any[] = [];
  if (o.status === 'new') rows.push([b('✅ Підтвердити', `st:${o.id}:confirmed`), b('❌ Скасувати', `st:${o.id}:cancelled`)]);
  if (o.status === 'confirmed') rows.push([b('📦 Відправлено', `st:${o.id}:shipped`), b('✔️ Виконано', `st:${o.id}:completed`)], [b('❌ Скасувати', `st:${o.id}:cancelled`)]);
  if (o.status === 'shipped') rows.push([b('✔️ Виконано', `st:${o.id}:completed`)]);
  if (o.delivery_method === 'newpost' && o.status !== 'cancelled' && o.status !== 'completed') rows.push([b(o.tracking_number ? '🔢 Змінити ТТН' : '🔢 Додати ТТН', `ttn:${o.id}`)]);
  rows.push([b('📝 Коментар', `cm:${o.id}`), b('🔄 Оновити', `rf:${o.id}`)]);
  return { inline_keyboard: rows };
};

const loadOrder = async (id: number) => (await db.from('tyre_orders').select('*').eq('id', id).maybeSingle()).data;

const recipients = async (ownersOnly = false) => {
  let q = db.from('telegram_users').select('chat_id, role').eq('active', true).eq('notify', true);
  if (ownersOnly) q = q.eq('role', 'owner');
  return (await q).data || [];
};

const notifyOrder = async (id: number) => {
  const o = await loadOrder(id);
  if (!o) return { sent: 0 };
  const people = await recipients();
  for (const p of people) await send(p.chat_id, orderText(o), { reply_markup: orderButtons(o) });
  return { sent: people.length };
};

const notifyReview = async (id: number) => {
  const { data: r } = await db.from('product_reviews').select('*, tyres(title)').eq('id', id).maybeSingle();
  if (!r) return { sent: 0 };
  const people = await recipients(true);
  const text = `<b>⭐ Новий відгук — ${'★'.repeat(r.rating || 0)}${'☆'.repeat(5 - (r.rating || 0))}</b>\n` +
    `${esc(r.tyres?.title || 'Товар')}\n👤 ${esc(r.author_name)}\n\n${esc(r.body || '(без тексту)')}`;
  const markup = { inline_keyboard: [[{ text: '✅ Опублікувати', callback_data: `rv:${r.id}:ok` }, { text: '🗑 Відхилити', callback_data: `rv:${r.id}:no` }]] };
  for (const p of people) await send(p.chat_id, text, r.approved ? {} : { reply_markup: markup });
  return { sent: people.length };
};

// ---------- reports ----------
const summary = async (fromIso: string, title: string, withMoney: boolean) => {
  const { data: orders } = await db.from('tyre_orders').select('id, status, items, created_at').gte('created_at', fromIso);
  const list = (orders || []).filter((o: any) => o.status !== 'cancelled');
  const total = list.reduce((s: number, o: any) => s + orderTotal(o), 0);
  const by = (st: string) => (orders || []).filter((o: any) => o.status === st).length;
  const top: Record<string, number> = {};
  for (const o of list) for (const i of o.items || []) top[i.title] = (top[i.title] || 0) + (Number(i.quantity) || 1);
  const topLines = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, n]) => `• ${esc(t)} — ${n} шт`).join('\n');
  return [
    `<b>${title}</b>`,
    `Замовлень: <b>${list.length}</b>${withMoney && total ? ` на <b>${money(total)}</b>` : ''}`,
    `🆕 нових ${by('new')} · ✅ підтв. ${by('confirmed')} · 📦 відпр. ${by('shipped')} · ✔️ викон. ${by('completed')} · ❌ скас. ${by('cancelled')}`,
    topLines ? `\nНайчастіше брали:\n${topLines}` : '',
  ].filter(Boolean).join('\n');
};

const syncState = async () => {
  const { data } = await db.from('tyres').select('program_synced_at').not('program_synced_at', 'is', null).order('program_synced_at', { ascending: false }).limit(1);
  const last = data?.[0]?.program_synced_at;
  if (!last) return '';
  const min = Math.round((Date.now() - new Date(last).getTime()) / 60000);
  return min > 120 ? `\n⚠️ Синхронізація з програмою не оновлювалась ${Math.round(min / 60)} год.` : '';
};

const healthLine = async () => {
  const { data } = await db.rpc('site_problems_service');
  const p = (data as string[]) || [];
  return p.length ? `\n\n⚠️ <b>Стан сайту:</b>\n• ${p.map(esc).join('\n• ')}` : '\n\n✅ Сайт працює без збоїв: обмін з програмою, резервна копія, фонові задачі.';
};

const alert = async (text: string) => {
  const people = await recipients(true);
  for (const p of people) await send(p.chat_id, String(text).slice(0, 3500));
  return { sent: people.length };
};

const daily = async () => {
  const people = await recipients(true);
  const [{ count: waitingReviews }, { count: newOrders }] = await Promise.all([
    db.from('product_reviews').select('id', { count: 'exact', head: true }).eq('approved', false),
    db.from('tyre_orders').select('id', { count: 'exact', head: true }).eq('status', 'new'),
  ]);
  const text = (await summary(todayStart(), '📊 Підсумок дня', true)) +
    (newOrders ? `\n\n❗ Не оброблено нових замовлень: ${newOrders} — /orders` : '') +
    (waitingReviews ? `\n💬 Відгуків чекають перевірки: ${waitingReviews}` : '') + (await syncState()) + (await healthLine());
  for (const p of people) await send(p.chat_id, text);
  return { sent: people.length };
};

// ---------- goods ----------
const findGoods = async (q: string) => {
  const words = q.trim().split(/\s+/).filter(w => w.length >= 2).slice(0, 4);
  if (!words.length) return 'Напишіть, що шукати: /find фільтр ланос';
  let query = db.from('tyres').select('id, title, price, stock_quantity, in_stock, on_order, catalog_number').neq('in_stock', false);
  for (const w of words) {
    const s = w.replace(/[,()%]/g, '');
    query = query.or(`title.ilike.%${s}%,catalog_number.ilike.%${s}%,search_numbers.ilike.%${s.toUpperCase().replace(/[^0-9A-ZА-ЯІЇЄҐ]/g, '') || s}%`);
  }
  const { data } = await query.order('stock_quantity', { ascending: false }).limit(10);
  if (!data?.length) return `Нічого не знайдено за запитом «${esc(q)}».`;
  return `<b>🔎 ${esc(q)}</b>\n\n` + data.map((p: any) =>
    `• ${esc(p.title)}\n   ${p.on_order ? 'під замовлення' : `${money(num(p.price))} · в наявності: ${p.stock_quantity ?? '?'} шт`}${p.catalog_number ? ` · <code>${esc(p.catalog_number)}</code>` : ''}`).join('\n');
};

// ---------- people ----------
const HELP_STAFF = [
  '<b>Що вміє бот</b>',
  '/orders — нові та підтверджені замовлення',
  '/order 123 — показати замовлення №123',
  '/find фільтр ланос — знайти товар: ціна і наявність',
  '/notify — увімкнути / вимкнути сповіщення',
  '',
  'Під кожним замовленням є кнопки: підтвердити, відправлено, ТТН, коментар.',
];
const HELP_OWNER = [...HELP_STAFF, '', '<b>Для власника</b>', '/today — замовлення і виручка за сьогодні', '/week — за 7 днів', '/team — хто має доступ до бота', '', 'Щовечора о 20:00 — підсумок дня.'];

const me = async (chatId: number) => (await db.from('telegram_users').select('*').eq('chat_id', chatId).eq('active', true).maybeSingle()).data;

const link = async (msg: any, code: string) => {
  const { data: inv } = await db.from('telegram_invites').select('*').eq('code', code).maybeSingle();
  if (!inv || inv.used_at || new Date(inv.expires_at) < new Date()) {
    return send(msg.chat.id, 'Код недійсний або вже використаний. Попросіть у адміністратора новий (Адмінка → Telegram).');
  }
  const name = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || inv.label || 'Без імені';
  await db.from('telegram_users').upsert({ chat_id: msg.chat.id, name: inv.label || name, username: msg.from?.username || null, role: inv.role, active: true, notify: true }, { onConflict: 'chat_id' });
  await db.from('telegram_invites').update({ used_at: new Date().toISOString(), used_by: msg.chat.id }).eq('code', code);
  // tell the owners
  for (const o of await recipients(true)) if (o.chat_id !== msg.chat.id) await send(o.chat_id, `👋 До бота підключився: <b>${esc(inv.label || name)}</b> (${inv.role === 'owner' ? 'власник' : 'працівник'})`);
  return send(msg.chat.id, `Готово! Ви підключені як <b>${inv.role === 'owner' ? 'власник' : 'працівник'}</b> магазину «Форсаж».\nСюди приходитимуть нові замовлення.\n\n${(inv.role === 'owner' ? HELP_OWNER : HELP_STAFF).join('\n')}`);
};

const onMessage = async (msg: any) => {
  const chatId = msg.chat?.id; const text = String(msg.text || '').trim();
  if (!chatId || msg.chat.type !== 'private') return;
  const [cmdRaw, ...rest] = text.split(/\s+/); const cmd = cmdRaw.toLowerCase().replace(/@\w+$/, ''); const arg = rest.join(' ');

  if (cmd === '/start' && arg) return link(msg, arg.trim());
  const user = await me(chatId);
  if (!user) {
    return send(chatId, 'Це службовий бот магазину «Форсаж».\nЩоб отримати доступ, попросіть у адміністратора посилання-запрошення (Адмінка → Telegram).');
  }
  const owner = user.role === 'owner';

  // the answer to "send TTN" / "write a comment"
  if (user.pending && !text.startsWith('/')) {
    const [kind, id] = user.pending.split(':');
    await db.from('telegram_users').update({ pending: null }).eq('chat_id', chatId);
    const field = kind === 'ttn' ? { tracking_number: text.replace(/\s+/g, '').slice(0, 40) } : { manager_comment: text.slice(0, 500) };
    await db.from('tyre_orders').update({ ...field, updated_at: new Date().toISOString(), ...(kind === 'ttn' ? { status: 'shipped' } : {}) }).eq('id', Number(id));
    const o = await loadOrder(Number(id));
    return send(chatId, orderText(o, kind === 'ttn' ? `ТТН збережено (${user.name}), статус «Відправлено»` : `Коментар збережено (${user.name})`), { reply_markup: orderButtons(o) });
  }

  switch (cmd) {
    case '/start': case '/help': case '/menu':
      return send(chatId, (owner ? HELP_OWNER : HELP_STAFF).join('\n'));
    case '/orders': {
      const { data } = await db.from('tyre_orders').select('*').in('status', ['new', 'confirmed']).order('created_at', { ascending: false }).limit(10);
      if (!data?.length) return send(chatId, 'Нових і підтверджених замовлень немає 👍');
      await send(chatId, `<b>Замовлення в роботі: ${data.length}</b>`);
      for (const o of data.reverse()) await send(chatId, orderText(o), { reply_markup: orderButtons(o) });
      return;
    }
    case '/order': {
      const o = await loadOrder(Number(arg.replace(/\D/g, '')));
      return o ? send(chatId, orderText(o), { reply_markup: orderButtons(o) }) : send(chatId, 'Замовлення не знайдено. Приклад: /order 123');
    }
    case '/find': case '/f':
      return send(chatId, await findGoods(arg));
    case '/notify': {
      await db.from('telegram_users').update({ notify: !user.notify }).eq('chat_id', chatId);
      return send(chatId, user.notify ? '🔕 Сповіщення вимкнено. Увімкнути: /notify' : '🔔 Сповіщення увімкнено.');
    }
    case '/today':
      return owner ? send(chatId, await summary(todayStart(), '📊 Сьогодні', true)) : send(chatId, 'Лише для власника.');
    case '/week':
      return owner ? send(chatId, await summary(new Date(Date.now() - 7 * 864e5).toISOString(), '📊 Останні 7 днів', true)) : send(chatId, 'Лише для власника.');
    case '/team': {
      if (!owner) return send(chatId, 'Лише для власника.');
      const { data } = await db.from('telegram_users').select('name, username, role, notify, active').order('created_at');
      return send(chatId, '<b>Доступ до бота</b>\n' + (data || []).map((u: any) =>
        `• ${esc(u.name)}${u.username ? ` (@${esc(u.username)})` : ''} — ${u.role === 'owner' ? 'власник' : 'працівник'}${u.active ? '' : ' · вимкнено'}${u.notify ? '' : ' · 🔕'}`).join('\n') +
        '\n\nДодати або прибрати людину: Адмінка → Telegram.');
    }
    default:
      // plain text = goods search
      if (!text.startsWith('/') && text.length >= 2) return send(chatId, await findGoods(text));
      return send(chatId, 'Не зрозумів команду. /help — список команд.');
  }
};

const onButton = async (cb: any) => {
  const chatId = cb.message?.chat?.id;
  const user = chatId && await me(chatId);
  if (!user) return tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Немає доступу', show_alert: true });
  const [kind, idStr, value] = String(cb.data || '').split(':');
  const id = Number(idStr);

  if (kind === 'st') {
    await db.from('tyre_orders').update({ status: value, updated_at: new Date().toISOString(), seen_at: new Date().toISOString() }).eq('id', id);
    const o = await loadOrder(id);
    await tg('editMessageText', { chat_id: chatId, message_id: cb.message.message_id, text: orderText(o, `${STATUS[value]} — ${user.name}`), parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: orderButtons(o) });
    // the others see who took the order
    if (value === 'confirmed') for (const p of await recipients()) if (p.chat_id !== chatId) await send(p.chat_id, `✅ Замовлення №${id} підтвердив(ла) ${esc(user.name)}`);
    return tg('answerCallbackQuery', { callback_query_id: cb.id, text: STATUS[value] });
  }
  if (kind === 'rf') {
    const o = await loadOrder(id);
    await tg('editMessageText', { chat_id: chatId, message_id: cb.message.message_id, text: orderText(o), parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: orderButtons(o) });
    return tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Оновлено' });
  }
  if (kind === 'ttn' || kind === 'cm') {
    await db.from('telegram_users').update({ pending: `${kind}:${id}` }).eq('chat_id', chatId);
    await send(chatId, kind === 'ttn' ? `Надішліть номер ТТН для замовлення №${id}:` : `Напишіть коментар до замовлення №${id}:`, { reply_markup: { force_reply: true } });
    return tg('answerCallbackQuery', { callback_query_id: cb.id });
  }
  if (kind === 'rv') {
    if (user.role !== 'owner') return tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Лише для власника', show_alert: true });
    if (value === 'ok') await db.from('product_reviews').update({ approved: true }).eq('id', id);
    else await db.from('product_reviews').delete().eq('id', id);
    await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } });
    return tg('answerCallbackQuery', { callback_query_id: cb.id, text: value === 'ok' ? 'Опубліковано' : 'Відхилено' });
  }
  return tg('answerCallbackQuery', { callback_query_id: cb.id });
};

// ---------- setup ----------
const setup = async () => {
  const { secret } = await getSecrets();
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-bot`;
  const hook = await tg('setWebhook', { url, secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true });
  const cmds = [
    { command: 'orders', description: 'Нові та підтверджені замовлення' },
    { command: 'find', description: 'Знайти товар: ціна і наявність' },
    { command: 'order', description: 'Показати замовлення за номером' },
    { command: 'today', description: 'Підсумок дня (власник)' },
    { command: 'week', description: 'Підсумок тижня (власник)' },
    { command: 'team', description: 'Хто має доступ (власник)' },
    { command: 'notify', description: 'Увімкнути / вимкнути сповіщення' },
    { command: 'help', description: 'Допомога' },
  ];
  await tg('setMyCommands', { commands: cmds });
  await tg('setMyDescription', { description: 'Службовий бот магазину «Форсаж»: нові замовлення, статуси, пошук товарів. Доступ — за запрошенням адміністратора.' });
  return { webhook: hook.ok, description: hook.description };
};

const status = async () => {
  const [meRes, hook] = await Promise.all([tg('getMe', {}), tg('getWebhookInfo', {})]);
  return { ok: !!meRes.ok, username: meRes.result?.username, name: meRes.result?.first_name, webhook: hook.result?.url || '', pending: hook.result?.pending_update_count || 0, last_error: hook.result?.last_error_message || '' };
};

const staffEmail = async (req: Request) => {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await db.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (!email) return null;
  const { data: rows } = await db.from('settings').select('key, value').in('key', ['admin_email', 'manager_email', 'service_staff_email']);
  return (rows || []).some((r: any) => String(r.value || '').trim().toLowerCase() === email) ? email : null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  let body: any = {}; try { body = await req.json(); } catch { /* empty */ }
  try {
    const s = await getSecrets();
    // 1) Telegram
    const tgSecret = req.headers.get('x-telegram-bot-api-secret-token');
    if (tgSecret !== null) {
      if (tgSecret !== s.secret) return json({ error: 'forbidden' }, 403);
      if (body.message) await onMessage(body.message);
      else if (body.callback_query) await onButton(body.callback_query);
      return json({ ok: true });
    }
    // 2) the database / cron
    if (req.headers.get('x-sync-key')) {
      if (req.headers.get('x-sync-key') !== s.sync) return json({ error: 'forbidden' }, 403);
      if (body.action === 'notify_order') return json(await notifyOrder(Number(body.id)));
      if (body.action === 'notify_review') return json(await notifyReview(Number(body.id)));
      if (body.action === 'daily') return json(await daily());
      if (body.action === 'alert') return json(await alert(body.text));
      if (body.action === 'setup') return json(await setup());
      return json({ error: 'unknown action' }, 400);
    }
    // 3) the admin panel
    if (!(await staffEmail(req))) return json({ error: 'Лише для персоналу' }, 403);
    if (body.action === 'status') return json(await status());
    if (body.action === 'setup') return json(await setup());
    if (body.action === 'set_token') {
      const t = String(body.token || '').trim();
      if (!/^\d+:[\w-]{30,}$/.test(t)) return json({ error: 'Це не схоже на токен бота (вигляд: 123456:ABC...)' }, 400);
      const { error } = await db.rpc('telegram_set_token', { p_token: t });
      if (error) throw new Error(error.message);
      secrets = null;
      const st = await status();
      if (!st.ok) return json({ error: 'Telegram не прийняв цей токен' }, 400);
      await setup();
      return json(await status());
    }
    if (body.action === 'test') {
      const people = await recipients();
      for (const p of people) await send(p.chat_id, '🔔 Тестове повідомлення з адмінки сайту. Все працює!');
      return json({ sent: people.length });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String(e?.message || e) }, 500);
  }
});
