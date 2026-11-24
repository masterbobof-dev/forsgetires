// @ts-nocheck
/**
 * Product photos from the internet (Google Images via Serper.dev) checked by AI (Gemini).
 * Settings (table settings, edited in the admin panel "Фото ШІ"):
 *   photo_finder_mode        'review' (staff approves photos first) | 'auto' (attach automatically)
 *   photo_finder_max_photos  1..5  — several photos (angles / sets) per product
 *   photo_finder_white_bg    '1' | '0' — require a white background
 *   photo_finder_no_text     '1' | '0' — reject watermarks / prices / shop names
 *   photo_finder_min_size    min width and height in px
 * Background job (pg_cron, header x-sync-key): { action: "search" | "download" | "purge" | "status" }
 * Admin panel (staff login, Authorization: Bearer <user JWT>):
 *   { action: "staff.find",   product_id, query? }          — search one product now, candidates with AI verdicts
 *   { action: "staff.attach", product_id, urls[], mode? }   — save chosen photos (first = main) as the product gallery
 *   { action: "staff.reject", product_id }                  — no suitable photo, remove from the review queue
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-sync-key', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json', ...cors } });
const BAD_DOMAINS = /(pinterest|aliexpress|alicdn|olx\.|facebook|instagram|youtube|ytimg|tiktok|vk\.com|ok\.ru|lookaside|shutterstock|depositphotos|istockphoto|dreamstime|123rf|freepik)/i;
const SMALL_ENOUGH = 180_000;

// ---------- settings ----------
const loadSettings = async () => {
  const { data } = await db.from('settings').select('key, value').like('key', 'photo_finder_%');
  const m = Object.fromEntries((data || []).map((r: any) => [r.key, String(r.value ?? '')]));
  return {
    mode: m.photo_finder_mode === 'auto' ? 'auto' : 'review',
    maxPhotos: Math.min(Math.max(Number(m.photo_finder_max_photos) || 3, 1), 5),
    whiteBg: m.photo_finder_white_bg !== '0',
    noText: m.photo_finder_no_text !== '0',
    minSize: Math.min(Math.max(Number(m.photo_finder_min_size) || 600, 200), 1500),
  };
};
type Settings = Awaited<ReturnType<typeof loadSettings>>;

const cleanTitle = (t: string) => t.replace(/\(\d+\)/g, ' ').replace(/[\/\\]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (t: string) => t.toLowerCase().split(/[^0-9a-zа-яіїєґ]+/i).filter(w => w.length >= 3);
const queryFor = (p: any) => cleanTitle(p.manufacturer && !p.title.toLowerCase().includes(p.manufacturer.toLowerCase()) ? `${p.manufacturer} ${p.title}` : p.title);

const scoreCandidate = (img: any, p: any, st: Settings) => {
  const w = Number(img.imageWidth) || 0, h = Number(img.imageHeight) || 0;
  if (w < st.minSize || h < st.minSize || w * h > 9_000_000) return -1;
  const ratio = w / h;
  if (ratio < 0.7 || ratio > 1.45) return -1;
  if (BAD_DOMAINS.test(img.imageUrl || '') || BAD_DOMAINS.test(img.domain || '') || BAD_DOMAINS.test(img.link || '')) return -1;
  const text = `${img.title || ''} ${img.link || ''}`.toLowerCase();
  let s = 0;
  for (const t of tokens(p.title)) if (text.includes(t)) s += /\d/.test(t) ? 3 : 1;
  const sku = p.catalog_number;
  if (sku && sku.length >= 4 && text.replace(/[^0-9a-z]/g, '').includes(sku.toLowerCase().replace(/[^0-9a-z]/g, ''))) s += 6;
  if (p.manufacturer && text.includes(p.manufacturer.toLowerCase())) s += 2;
  if (w >= 800 && h >= 800) s += 1;
  return s;
};
const toCandidates = (images: any[], p: any, st: Settings, limit: number) => {
  const seen = new Set<string>();
  return (images || [])
    .map((img: any) => ({ url: img.imageUrl, link: img.link || img.imageUrl, title: img.title || '', w: img.imageWidth, h: img.imageHeight, score: scoreCandidate(img, p, st) }))
    .filter((x: any) => x.score >= 2 && x.url && !seen.has(x.url) && seen.add(x.url))
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, limit);
};

const serper = async (queries: any[]) => {
  const { data } = await db.from('ai_api_keys').select('serper_key').eq('id', 1).maybeSingle();
  const key = String(data?.serper_key || '').replace(/[^\x20-\x7e]/g, '').trim();
  if (!key) throw new Error('Не вказано ключ Serper (Налаштування → AI ключі)');
  const res = await fetch('https://google.serper.dev/images', { method: 'POST', headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, body: JSON.stringify(queries) });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(/credits/i.test(t) ? 'У Serper закінчились кредити — поповніть баланс на serper.dev' : `serper ${res.status}: ${t.slice(0, 150)}`);
  }
  return await res.json();
};

// ---------- AI verdict ----------
class RetryLater extends Error {}
let geminiKeyCache: string | null = null;
const geminiKey = async () => {
  if (geminiKeyCache !== null) return geminiKeyCache;
  const { data } = await db.from('ai_api_keys').select('gemini_key').eq('id', 1).maybeSingle();
  return (geminiKeyCache = String(data?.gemini_key || '').replace(/[^\x20-\x7e]/g, '').trim());
};
const b64 = (bytes: Uint8Array) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };

type Verdict = { match: boolean; white_background: boolean; no_extra_text: boolean; good_quality: boolean };
const verdictFor = async (bytes: Uint8Array, type: string, p: any): Promise<Verdict | null> => {
  const key = await geminiKey();
  if (!key) return null;
  const prompt = `Назва товару в автомагазині: «${p.title}»${p.manufacturer ? `. Бренд: ${p.manufacturer}` : ''}.\n` +
    'Оціни фото для картки товару в інтернет-магазині. Поверни JSON з полями:\n' +
    '"match": на фото САМЕ цей товар (інший ракурс чи комплектація цього ж товару — true; якщо видно ІНШИЙ бренд або інший тип товару — false; логотип, схема, автомобіль, людина — false; бренд не видно, але тип і вигляд відповідають — true);\n' +
    '"white_background": фон чисто білий або майже білий, без інтер\'єру, столу, полиці, руки;\n' +
    '"no_extra_text": на зображенні НЕМАЄ доданого тексту — водяних знаків, цін, назв магазинів, адрес сайтів, рекламних написів, рамок, колажів (текст і етикетка на самій упаковці товару — дозволено);\n' +
    '"good_quality": фото чітке, не розмите, товар видно повністю і він займає більшу частину кадру.\n' +
    'Відповідай лише JSON, наприклад {"match": true, "white_background": true, "no_extra_text": true, "good_quality": true}.';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: type, data: b64(bytes) } }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (res.status === 429 || res.status === 503) throw new RetryLater(`gemini ${res.status}`);
  if (!res.ok) return null;
  try {
    const r = JSON.parse((await res.json())?.candidates?.[0]?.content?.parts?.[0]?.text || '');
    return { match: r.match === true, white_background: r.white_background === true, no_extra_text: r.no_extra_text === true, good_quality: r.good_quality === true };
  } catch { return null; }
};
const passes = (v: Verdict | null, st: Settings) => !!v && v.match && v.good_quality && (!st.whiteBg || v.white_background) && (!st.noText || v.no_extra_text);

// ---------- images ----------
const fetchImage = async (url: string) => {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ForsageImageBot/1.0)', Accept: 'image/*' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().replace('image/jpg', 'image/jpeg');
    if (!/^image\/(jpeg|png|webp)$/.test(type)) throw new Error(`format ${type || '?'}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 3000) throw new Error('too small');
    if (bytes.length > 2_500_000) throw new Error('too big');
    return { bytes, type };
  } finally { clearTimeout(timer); }
};
const shrink = async (bytes: Uint8Array) => {
  const img = await Image.decode(bytes);
  const fit = (max: number) => { if (img.width >= img.height) { if (img.width > max) img.resize(max, Image.RESIZE_AUTO); } else if (img.height > max) img.resize(Image.RESIZE_AUTO, max); };
  fit(1000); const full = await img.encodeJPEG(84);
  fit(320); const thumb = await img.encodeJPEG(75);
  return { full, thumb };
};
const upload = async (path: string, data: Uint8Array, type: string) => {
  const up = await db.storage.from('galery').upload(path, data, { contentType: type, upsert: true, cacheControl: '31536000' });
  if (up.error) throw new Error(`upload: ${up.error.message}`);
  return db.storage.from('galery').getPublicUrl(path).data.publicUrl;
};
/** stores one image (full + thumbnail) in our storage */
const store = async (productId: number, bytes: Uint8Array, type: string, i: number) => {
  const base = `products/auto/${productId}-${Date.now().toString(36)}-${i}`;
  if (bytes.length <= SMALL_ENOUGH || type === 'image/webp') {
    const url = await upload(`${base}.${type.split('/')[1].replace('jpeg', 'jpg')}`, bytes, type);
    return { full: url, thumb: url };
  }
  const s = await shrink(bytes);
  return { full: await upload(`${base}.jpg`, s.full, 'image/jpeg'), thumb: await upload(`${base}-thumb.jpg`, s.thumb, 'image/jpeg') };
};
const removeAutoFiles = async (p: any) => {
  const prefix = '/storage/v1/object/public/galery/';
  const urls = [...(p.gallery || []), ...(p.gallery_thumbs || []), p.image_url, p.image_thumb_url].filter((u: string) => u?.includes(`${prefix}products/auto/`));
  if (urls.length) await db.storage.from('galery').remove([...new Set(urls.map((u: string) => u.split(prefix)[1]))]);
};
const saveGallery = async (p: any, photos: { full: string; thumb: string }[], sourceLink: string | null) => {
  const upd = await db.from('tyres').update({
    image_url: photos[0].full, image_thumb_url: photos[0].thumb, gallery: photos.map(x => x.full), gallery_thumbs: photos.map(x => x.thumb),
    image_source_url: sourceLink, photo_auto: true, photo_verified: true, photo_verified_at: new Date().toISOString(),
    photo_review: false, photo_search_error: null,
  }).eq('id', p.id);
  if (upd.error) throw new Error(upd.error.message);
};

// ---------- background job ----------
const search = async (n: number, st: Settings) => {
  const { data: jobs, error } = await db.rpc('claim_photo_search', { n, p_only_ids: null });
  if (error) throw new Error(error.message);
  if (!jobs?.length) return { searched: 0 };
  let answers;
  try { answers = await serper(jobs.map((p: any) => ({ q: queryFor(p), num: 20, gl: 'ua', hl: 'uk' }))); }
  catch (e) { await db.from('tyres').update({ photo_search_at: null }).in('id', jobs.map((p: any) => p.id)); throw e; }
  let withCandidates = 0;
  await Promise.all(jobs.map(async (p: any, i: number) => {
    const c = toCandidates(answers[i]?.images, p, st, Math.max(6, st.maxPhotos + 4));
    if (c.length) withCandidates++;
    await db.from('tyres').update(c.length ? { photo_candidates: c, photo_search_error: null } : { photo_candidates: [], photo_search_error: 'no matching image' }).eq('id', p.id);
  }));
  return { searched: jobs.length, with_candidates: withCandidates };
};

/** checks the candidates of one product with AI; auto mode attaches the good ones, review mode queues them for staff */
const processOne = async (p: any, st: Settings) => {
  const checked: any[] = [];
  const good: { full: string; thumb: string; link: string }[] = [];
  for (const [i, c] of (p.photo_candidates || []).entries()) {
    if (st.mode === 'auto' && good.length >= st.maxPhotos) break;
    try {
      const { bytes, type } = await fetchImage(c.url);
      const v = bytes.length <= 1_500_000 ? await verdictFor(bytes, type, p) : null;
      const ok = passes(v, st);
      checked.push({ ...c, ai: v, ok });
      if (ok && st.mode === 'auto') good.push({ ...(await store(p.id, bytes, type, i)), link: c.link });
    } catch (e) {
      if (e instanceof RetryLater) throw e;
      checked.push({ ...c, ai: null, ok: false, error: String(e?.message || e).slice(0, 80) });
    }
  }
  if (st.mode === 'auto') {
    if (good.length) { await saveGallery(p, good, good[0].link); return 'attached'; }
    await db.from('tyres').update({ photo_candidates: checked, photo_search_error: 'no good photo' }).eq('id', p.id);
    return 'none';
  }
  // review: keep only images that can be shown; good ones first
  const visible = checked.filter(c => !c.error).sort((a, b) => Number(b.ok) - Number(a.ok) || b.score - a.score);
  await db.from('tyres').update(visible.length
    ? { photo_candidates: visible, photo_review: true, photo_search_error: null }
    : { photo_candidates: [], photo_review: false, photo_search_error: 'no good photo' }).eq('id', p.id);
  return visible.length ? 'review' : 'none';
};

const download = async (n: number, st: Settings) => {
  const { data: jobs, error } = await db.rpc('claim_photo_download', { n });
  if (error) throw new Error(error.message);
  const out: Record<string, number> = {};
  for (const p of jobs || []) {
    try { const r = await processOne(p, st); out[r] = (out[r] || 0) + 1; }
    catch (e) {
      if (e instanceof RetryLater) { await db.from('tyres').update({ photo_download_at: null }).eq('id', p.id); out.retry = (out.retry || 0) + 1; continue; }
      await db.from('tyres').update({ photo_search_error: String(e?.message || e).slice(0, 200) }).eq('id', p.id);
      out.error = (out.error || 0) + 1;
    }
  }
  return out;
};

const purge = async () => {
  let removed = 0;
  for (let round = 0; round < 50; round++) {
    const { data: files, error } = await db.storage.from('galery').list('products/auto', { limit: 1000 });
    if (error) throw new Error(error.message);
    if (!files?.length) break;
    const { error: rmErr } = await db.storage.from('galery').remove(files.map(f => `products/auto/${f.name}`));
    if (rmErr) throw new Error(rmErr.message);
    removed += files.length;
  }
  return { removed };
};

// ---------- admin panel ----------
const staffEmail = async (req: Request) => {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await db.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (!email) return null;
  const { data: rows } = await db.from('settings').select('value').in('key', ['admin_email', 'manager_email', 'service_staff_email']);
  return (rows || []).some((r: any) => String(r.value || '').trim().toLowerCase() === email) ? email : null;
};
const productById = async (id: number) => {
  const { data } = await db.from('tyres').select('*').eq('id', id).maybeSingle();
  if (!data) throw new Error('Товар не знайдено');
  return data;
};

const staffFind = async (body: any, st: Settings) => {
  const p = await productById(Number(body.product_id));
  const q = String(body.query || '').trim() || queryFor(p);
  const [answer] = await serper([{ q, num: 30, gl: 'ua', hl: 'uk' }]);
  const candidates = toCandidates(answer?.images, p, { ...st, minSize: Math.min(st.minSize, 400) }, 10);
  const checked: any[] = [];
  for (const c of candidates) {
    try {
      const { bytes, type } = await fetchImage(c.url);
      const v = bytes.length <= 1_500_000 ? await verdictFor(bytes, type, p) : null;
      checked.push({ ...c, ai: v, ok: passes(v, st) });
    } catch (e) {
      if (e instanceof RetryLater) { checked.push({ ...c, ai: null, ok: false, error: 'ШІ перевантажений, спробуйте за хвилину' }); continue; }
      /* the image can't be downloaded: skip it */
    }
  }
  checked.sort((a, b) => Number(b.ok) - Number(a.ok) || b.score - a.score);
  await db.from('tyres').update({ photo_candidates: checked, photo_review: checked.length > 0, photo_search_at: new Date().toISOString() }).eq('id', p.id);
  return { product_id: p.id, query: q, candidates: checked };
};

const staffAttach = async (body: any) => {
  const p = await productById(Number(body.product_id));
  const urls: string[] = (body.urls || []).slice(0, 8);
  if (!urls.length) throw new Error('Не вибрано жодного фото');
  const photos: { full: string; thumb: string; link: string }[] = [];
  for (const [i, url] of urls.entries()) {
    const { bytes, type } = await fetchImage(url);
    const cand = (p.photo_candidates || []).find((c: any) => c.url === url);
    photos.push({ ...(await store(p.id, bytes, type, i)), link: cand?.link || url });
  }
  const append = body.mode === 'append';
  if (!append) await removeAutoFiles(p);
  const keep = append ? (p.gallery || []).map((f: string, i: number) => ({ full: f, thumb: p.gallery_thumbs?.[i] || f })) : [];
  await saveGallery(p, [...keep, ...photos], photos[0].link);
  return { product_id: p.id, photos: photos.length };
};

const staffReject = async (body: any) => {
  const p = await productById(Number(body.product_id));
  await db.from('tyres').update({ photo_review: false, photo_candidates: [], photo_search_error: 'rejected by staff' }).eq('id', p.id);
  return { product_id: p.id };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  let body: any = {}; try { body = await req.json(); } catch { /* empty */ }
  try {
    const st = await loadSettings();
    if (String(body.action || '').startsWith('staff.')) {
      if (!(await staffEmail(req))) return json({ error: 'Лише для персоналу' }, 403);
      if (body.action === 'staff.find') return json(await staffFind(body, st));
      if (body.action === 'staff.attach') return json(await staffAttach(body));
      if (body.action === 'staff.reject') return json(await staffReject(body));
      return json({ error: 'unknown action' }, 400);
    }
    const { data: sync } = await db.rpc('program_sync_state');
    if (!sync?.token || req.headers.get('x-sync-key') !== sync.token) return json({ error: 'forbidden' }, 403);
    if (body.action === 'search') return json(await search(Math.min(Number(body.n) || 100, 100), st));
    if (body.action === 'download') return json(await download(Math.min(Number(body.n) || 3, 6), st));
    if (body.action === 'purge') return json(await purge());
    if (body.action === 'status') return json((await db.rpc('photo_job_status')).data);
    return json({ error: 'action: search | download | purge | status | staff.*' }, 400);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
