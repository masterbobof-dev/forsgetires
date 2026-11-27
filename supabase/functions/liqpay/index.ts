// Online card payment through LiqPay (PrivatBank).
//   POST { action: 'checkout', order: {...} }  from the cart → creates the order, returns the LiqPay payment page address
//   POST { action: 'status', order_id }        from the «оплата» page → { paid }
//   POST form data=…&signature=…               from LiqPay (server_url) → marks the order paid
// Only the shop's own goods that are free in stock can be paid online (see free stock, docs/program-site-integration.md).
// Keys: entered by the owner in the admin panel (Налаштування → Онлайн-оплата), kept in private.integration_secrets.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const SITE = 'https://www.forsage-tires.com';
const SELF = `${Deno.env.get('SUPABASE_URL')}/functions/v1/liqpay`;

const cors = { 'Access-Control-Allow-Origin': SITE, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });

const b64 = (bytes: Uint8Array) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
const b64text = (text: string) => b64(new TextEncoder().encode(text));
const fromB64text = (data: string) => new TextDecoder().decode(Uint8Array.from(atob(data), c => c.charCodeAt(0)));
const sign = async (priv: string, data: string) => b64(new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(priv + data + priv))));
const money = (v: unknown) => { const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : 0; };
const same = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

const keys = async () => {
  const { data, error } = await db.rpc('liqpay_keys');
  if (error) throw error;
  return data as { public: string | null; private: string | null; enabled: boolean };
};

// ---------- the buyer pays: create the order, then send him to LiqPay ----------
const checkout = async (req: Request, body: any) => {
  const k = await keys();
  if (!k.enabled || !k.public || !k.private) return json({ ok: false, error: 'Онлайн-оплата тимчасово недоступна. Оформіть замовлення звичайним способом.' }, 409);
  const o = body?.order || {};
  const items = (Array.isArray(o.items) ? o.items : []).slice(0, 50)
    .map((i: any) => ({ id: Number(i.id), quantity: Math.min(Math.max(Math.floor(Number(i.quantity) || 1), 1), 999) }))
    .filter((i: any) => Number.isFinite(i.id) && i.id > 0);
  if (!items.length) return json({ ok: false, error: 'У замовленні немає товарів' }, 400);

  // only goods that are free in stock right now
  const { data: short, error: e1 } = await db.rpc('order_stock_check', { p_items: items });
  if (e1) throw e1;
  if ((short as any[]).length) {
    return json({ ok: false, short, error: `Товару вже немає в потрібній кількості: ${(short as any[]).map(s => s.title ? `${s.title} (є ${s.free} шт)` : `товар ${s.id}`).join('; ')}. Змініть кількість або оформіть без онлайн-оплати.` }, 409);
  }

  // the order is linked to the account only when the buyer is really signed in
  let userId: string | null = null;
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (token) { const { data } = await db.auth.getUser(token); userId = data?.user?.id ?? null; }

  // the same checks as any order from the site (prices from the catalogue, phone, anti-spam) run in the database
  const { data: row, error: e2 } = await db.from('tyre_orders').insert({
    customer_name: String(o.customer_name || ''), customer_phone: String(o.customer_phone || ''), customer_email: o.customer_email ? String(o.customer_email) : null,
    delivery_method: o.delivery_method === 'newpost' ? 'newpost' : 'pickup', delivery_city: o.delivery_city || null, delivery_warehouse: o.delivery_warehouse || null,
    comment: o.comment || null, payment_method: 'online', status: 'new', user_id: userId, items,
  }).select('id, items').single();
  if (e2) return json({ ok: false, error: /Забагато|телефону|немає товарів/.test(e2.message) ? e2.message : 'Не вдалося створити замовлення. Спробуйте ще раз або зателефонуйте нам.' }, 400);

  const amount = Math.round((row.items as any[]).reduce((s, i) => s + money(i.price) * (Number(i.quantity) || 1), 0) * 100) / 100;
  if (!(amount > 0)) return json({ ok: false, error: 'Не вдалося порахувати суму. Оформіть замовлення звичайним способом.' }, 400);
  const data = b64text(JSON.stringify({
    public_key: k.public, version: 3, action: 'pay', amount, currency: 'UAH', language: 'uk',
    description: `Оплата замовлення №${row.id}, інтернет-магазин Форсаж`, order_id: `forsage-${row.id}`,
    result_url: `${SITE}/oplata?order=${row.id}`, server_url: SELF,
  }));
  const signature = await sign(k.private, data);
  return json({ ok: true, order_id: row.id, amount, url: `https://www.liqpay.ua/api/3/checkout?data=${encodeURIComponent(data)}&signature=${encodeURIComponent(signature)}` });
};

// ---------- LiqPay tells the result ----------
const callback = async (req: Request) => {
  const form = new URLSearchParams(await req.text());
  const data = form.get('data') || '', signature = form.get('signature') || '';
  const k = await keys();
  if (!k.private || !data || !same(await sign(k.private, data), signature)) return new Response('bad signature', { status: 403 });
  const p = JSON.parse(fromB64text(data));
  const id = Number(String(p.order_id || '').replace(/^forsage-/, ''));
  if (!id || p.public_key !== k.public) return new Response('unknown order', { status: 400 });
  const { data: order } = await db.from('tyre_orders').select('id, items, paid, manager_comment').eq('id', id).maybeSingle();
  if (!order) return new Response('unknown order', { status: 404 });
  const total = Math.round((order.items as any[]).reduce((s, i) => s + money(i.price) * (Number(i.quantity) || 1), 0) * 100) / 100;
  const okStatus = p.status === 'success' || (p.status === 'sandbox' && String(k.public).startsWith('sandbox_'));
  const now = new Date().toISOString();

  if (okStatus) {
    if (p.currency !== 'UAH' || Number(p.amount) + 0.009 < total) {
      await db.from('tyre_orders').update({ manager_comment: `${order.manager_comment ? order.manager_comment + '\n' : ''}⚠️ LiqPay: сума ${p.amount} ${p.currency} не збігається із замовленням (${total} грн). Перевірте вручну.`, updated_at: now }).eq('id', id);
    } else if (!order.paid) {
      await db.from('tyre_orders').update({ paid: true, paid_at: now, paid_amount: Number(p.amount), payment_ref: String(p.payment_id ?? p.liqpay_order_id ?? ''), updated_at: now }).eq('id', id);
    }
  } else if (p.status === 'reversed' && order.paid) {
    await db.from('tyre_orders').update({ paid: false, manager_comment: `${order.manager_comment ? order.manager_comment + '\n' : ''}↩️ LiqPay: оплату повернуто.`, updated_at: now }).eq('id', id);
  }
  return new Response('ok');
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  try {
    if ((req.headers.get('content-type') || '').includes('application/x-www-form-urlencoded')) return await callback(req);
    const body = await req.json().catch(() => ({}));
    if (body?.action === 'checkout') return await checkout(req, body);
    if (body?.action === 'status') {
      const { data } = await db.from('tyre_orders').select('paid').eq('id', Number(body.order_id) || 0).maybeSingle();
      return json({ ok: true, found: !!data, paid: !!data?.paid });
    }
    return json({ ok: false, error: 'Невідома дія' }, 400);
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: 'Помилка оплати. Спробуйте ще раз або зателефонуйте нам.' }, 500);
  }
});
