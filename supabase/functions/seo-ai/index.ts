// @ts-nocheck
/**
 * AI texts for SEO (Gemini, key in ai_api_keys.gemini_key). Staff only (Authorization: Bearer <user JWT>).
 *   { action: "generate", category_id?, n?: 20 }      — drafts for products without a description: description,
 *                                                       seo_title, seo_description → tyres.seo_draft (to be reviewed)
 *   { action: "save", items: [{ id, description, seo_title, seo_description }] } — publish reviewed drafts
 *   { action: "discard", ids: [] }                      — drop drafts
 *   { action: "generate_categories", ids?: [] }         — drafts for category texts → product_categories.seo_draft
 *   { action: "save_categories", items: [{ id, description, seo_title, seo_description }] }
 * The AI only uses facts from the product name / characteristics; it must not invent numbers or car models.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-sync-key', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json', ...cors } });
const CITY = 'Синельникове';

const staffEmail = async (req: Request) => {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await db.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (!email) return null;
  const { data: rows } = await db.from('settings').select('value').in('key', ['admin_email', 'manager_email', 'service_staff_email']);
  return (rows || []).some((r: any) => String(r.value || '').trim().toLowerCase() === email) ? email : null;
};

const gemini = async (prompt: string) => {
  const { data } = await db.from('ai_api_keys').select('gemini_key').eq('id', 1).maybeSingle();
  const key = String(data?.gemini_key || '').replace(/[^\x20-\x7e]/g, '').trim();
  if (!key) throw new Error('Не вказано ключ Gemini (Налаштування → AI ключі)');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (res.status === 429) throw new Error('ШІ перевантажений — спробуйте за хвилину');
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = (await res.json())?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
  return JSON.parse(text);
};

const RULES = `Правила:
- пиши українською мовою, живо і по суті, без води і без перебільшень;
- використовуй ЛИШЕ факти з назви та характеристик; НЕ вигадуй цифри, допуски, марки і моделі авто, країну виробництва, гарантійні строки;
- якщо назва російською — перекладай терміни українською, але бренди, артикули, в'язкість (5W-40), об'єми (1 л, 4 л) лишай як є;
- не згадуй ціну і наявність;
- магазин «Форсаж», м. ${CITY} (самовивіз), доставка Новою Поштою по Україні.`;

const subtree = async (id: number) => {
  const { data } = await db.from('product_categories').select('id, parent_id');
  const all = data || [];
  const out = [id];
  for (let i = 0; i < out.length; i++) for (const c of all) if (c.parent_id === out[i]) out.push(c.id);
  return out;
};

const generate = async (body: any) => {
  const n = Math.min(Math.max(Number(body.n) || 20, 1), 25);
  let q = db.from('tyres').select('id, title, manufacturer, catalog_number, attributes, category_id, product_categories(name)')
    .neq('in_stock', false).eq('on_order', false).is('seo_draft', null)
    .or('description.is.null,description.eq.').order('stock_quantity', { ascending: false }).limit(n);
  if (body.category_id) q = q.in('category_id', await subtree(Number(body.category_id)));
  const { data: items, error } = await q;
  if (error) throw new Error(error.message);
  if (!items?.length) return { generated: 0 };
  const input = items.map((p: any) => ({
    id: p.id, name: p.title, brand: p.manufacturer || undefined, article: p.catalog_number || undefined,
    category: p.product_categories?.name || undefined,
    specs: p.attributes && Object.keys(p.attributes).length ? p.attributes : undefined,
  }));
  const prompt = `Ти — копірайтер інтернет-магазину автотоварів і автозапчастин. Для кожного товару зі списку напиши:
"description": опис для картки товару, 2–4 короткі абзаци (300–600 символів): що це, для чого, переваги, як обрати/застосувати;
"seo_title": заголовок для Google до 65 символів: назва українською + бренд/артикул, без лапок і капсу;
"seo_description": опис для Google 140–160 символів із закликом купити, згадкою «${CITY}» або «доставка по Україні».
${RULES}
Поверни JSON-масив об'єктів {"id", "description", "seo_title", "seo_description"} для кожного товару в тому ж порядку.
Товари: ${JSON.stringify(input)}`;
  const out = await gemini(prompt);
  let generated = 0;
  for (const r of Array.isArray(out) ? out : []) {
    const id = Number(r.id);
    if (!items.some((p: any) => p.id === id) || !r.description) continue;
    await db.from('tyres').update({ seo_draft: { description: String(r.description).trim(), seo_title: String(r.seo_title || '').trim().slice(0, 90), seo_description: String(r.seo_description || '').trim().slice(0, 200) }, seo_ai_at: new Date().toISOString() }).eq('id', id);
    generated++;
  }
  // products the AI skipped are marked so the loop does not get stuck on them
  const skipped = items.filter((p: any) => !(out || []).some((r: any) => Number(r.id) === p.id));
  for (const p of skipped) await db.from('tyres').update({ seo_draft: { skipped: true } }).eq('id', p.id);
  return { generated };
};

const save = async (body: any) => {
  let saved = 0;
  for (const it of (body.items || []).slice(0, 200)) {
    const upd: any = { seo_draft: null };
    if (it.description) upd.description = String(it.description).trim();
    if (it.seo_title) upd.seo_title = String(it.seo_title).trim();
    if (it.seo_description) upd.seo_description = String(it.seo_description).trim();
    const { error } = await db.from('tyres').update(upd).eq('id', Number(it.id));
    if (!error) saved++;
  }
  return { saved };
};

const discard = async (body: any) => {
  const ids = (body.ids || []).map(Number).slice(0, 500);
  if (ids.length) await db.from('tyres').update({ seo_draft: { skipped: true } }).in('id', ids);
  return { discarded: ids.length };
};

const generateCategories = async (body: any) => {
  let q = db.from('product_categories').select('id, name, parent_id, description').eq('is_active', true).is('seo_draft', null);
  if (Array.isArray(body.ids) && body.ids.length) q = q.in('id', body.ids.map(Number));
  else q = q.or('description.is.null,description.eq.');
  const { data: cats, error } = await q.limit(15);
  if (error) throw new Error(error.message);
  if (!cats?.length) return { generated: 0 };
  const { data: all } = await db.from('product_categories').select('id, name');
  const input = cats.map((c: any) => ({ id: c.id, name: c.name, parent: all?.find((x: any) => x.id === c.parent_id)?.name }));
  const prompt = `Ти — SEO-копірайтер інтернет-магазину автотоварів і автозапчастин «Форсаж» (м. ${CITY}). Для кожної категорії напиши:
"description": текст для сторінки категорії, 3–5 абзаців (700–1200 символів): що входить у категорію, як правильно вибрати, на що звернути увагу, коли міняти; наприкінці — що в магазині «Форсаж» у ${CITY} є самовивіз і доставка Новою Поштою по Україні;
"seo_title": до 65 символів, напр. «Масляні фільтри — купити в ${CITY} | Форсаж»;
"seo_description": 140–160 символів із закликом купити.
${RULES}
Поверни JSON-масив {"id", "description", "seo_title", "seo_description"}.
Категорії: ${JSON.stringify(input)}`;
  const out = await gemini(prompt);
  let generated = 0;
  for (const r of Array.isArray(out) ? out : []) {
    const id = Number(r.id);
    if (!cats.some((c: any) => c.id === id) || !r.description) continue;
    await db.from('product_categories').update({ seo_draft: { description: String(r.description).trim(), seo_title: String(r.seo_title || '').trim(), seo_description: String(r.seo_description || '').trim() } }).eq('id', id);
    generated++;
  }
  return { generated };
};

const saveCategories = async (body: any) => {
  let saved = 0;
  for (const it of (body.items || []).slice(0, 100)) {
    const upd: any = { seo_draft: null };
    if (it.description) upd.description = String(it.description).trim();
    if (it.seo_title) upd.seo_title = String(it.seo_title).trim();
    if (it.seo_description) upd.seo_description = String(it.seo_description).trim();
    const { error } = await db.from('product_categories').update(upd).eq('id', Number(it.id));
    if (!error) saved++;
  }
  return { saved };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  let body: any = {}; try { body = await req.json(); } catch { /* empty */ }
  try {
    // background job (header x-sync-key): next 15 category texts
    if (body.action === 'auto_categories') {
      const { data: sync } = await db.rpc('program_sync_state');
      if (!sync?.token || req.headers.get('x-sync-key') !== sync.token) return json({ error: 'forbidden' }, 403);
      return json(await generateCategories({}));
    }
    // background job: drafts for the next 25 best-stocked products without a description
    if (body.action === 'auto_products') {
      const { data: sync } = await db.rpc('program_sync_state');
      if (!sync?.token || req.headers.get('x-sync-key') !== sync.token) return json({ error: 'forbidden' }, 403);
      return json(await generate({ n: 25 }));
    }
    if (!(await staffEmail(req))) return json({ error: 'Лише для персоналу' }, 403);
    if (body.action === 'generate') return json(await generate(body));
    if (body.action === 'save') return json(await save(body));
    if (body.action === 'discard') return json(await discard(body));
    if (body.action === 'generate_categories') return json(await generateCategories(body));
    if (body.action === 'save_categories') return json(await saveCategories(body));
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
