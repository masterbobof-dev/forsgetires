// @ts-nocheck
/**
 * Product photos from the internet for goods without a photo (Google Images via Serper.dev,
 * key in ai_api_keys.serper_key). Two fast phases, called by pg_cron with x-sync-key:
 *   { action: "search",   n: 100 } — one batched Serper request for up to 100 products;
 *                                     the best matching image links are saved to tyres.photo_candidates
 *   { action: "download", n: 4 }   — copies the first working candidate into our storage
 *                                     (small images as they are, big ones shrunk to 800px + 320px thumbnail)
 * Found photos are marked photo_auto = true (can be replaced later with supplier / own photos).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
const BAD_DOMAINS = /(pinterest|aliexpress|alicdn|olx\.|facebook|instagram|youtube|ytimg|tiktok|vk\.com|ok\.ru|lookaside|shutterstock|depositphotos|istockphoto|dreamstime|123rf|freepik)/i;
const SMALL_ENOUGH = 180_000; // store as is (no decoding) when the file is already this small

const cleanTitle = (t: string) => t.replace(/\(\d+\)/g, ' ').replace(/[\/\\]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (t: string) => t.toLowerCase().split(/[^0-9a-zа-яіїєґ]+/i).filter(w => w.length >= 3);

const scoreCandidate = (img: any, title: string, sku?: string, brand?: string) => {
  const w = Number(img.imageWidth) || 0, h = Number(img.imageHeight) || 0;
  if (w < 250 || h < 250 || w * h > 6_000_000) return -1;
  const ratio = w / h;
  if (ratio < 0.5 || ratio > 2.2) return -1;
  if (BAD_DOMAINS.test(img.imageUrl || '') || BAD_DOMAINS.test(img.domain || '') || BAD_DOMAINS.test(img.link || '')) return -1;
  const text = `${img.title || ''} ${img.link || ''}`.toLowerCase();
  let s = 0;
  for (const t of tokens(title)) if (text.includes(t)) s += /\d/.test(t) ? 3 : 1;
  if (sku && sku.length >= 4 && text.replace(/[^0-9a-z]/g, '').includes(sku.toLowerCase().replace(/[^0-9a-z]/g, ''))) s += 6;
  if (brand && text.includes(brand.toLowerCase())) s += 2;
  if (w >= 500 && h >= 500) s += 1;
  return s;
};

const serperKey = async () => {
  const { data } = await db.from('ai_api_keys').select('serper_key').eq('id', 1).maybeSingle();
  return String(data?.serper_key || '').replace(/[^\x20-\x7e]/g, '').trim();
};

// ---------- phase 1: batched search ----------
const search = async (n: number, ids?: number[]) => {
  const key = await serperKey();
  if (!key) throw new Error('no serper key');
  const { data: jobs, error } = await db.rpc('claim_photo_search', { n, p_only_ids: ids || null });
  if (error) throw new Error(error.message);
  if (!jobs?.length) return { searched: 0 };

  const queries = jobs.map((p: any) => ({
    q: cleanTitle(p.manufacturer && !p.title.toLowerCase().includes(p.manufacturer.toLowerCase()) ? `${p.manufacturer} ${p.title}` : p.title),
    num: 10, gl: 'ua', hl: 'uk',
  }));
  const res = await fetch('https://google.serper.dev/images', {
    method: 'POST', headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, body: JSON.stringify(queries),
  });
  if (!res.ok) {
    // give the products back so a later run retries them
    await db.from('tyres').update({ photo_search_at: null }).in('id', jobs.map((p: any) => p.id));
    throw new Error(`serper ${res.status}: ${(await res.text()).slice(0, 150)}`);
  }
  const answers = await res.json();
  let withCandidates = 0;
  await Promise.all(jobs.map(async (p: any, i: number) => {
    const images = (answers[i]?.images || [])
      .map((img: any) => ({ url: img.imageUrl, link: img.link || img.imageUrl, w: img.imageWidth, h: img.imageHeight, score: scoreCandidate(img, p.title, p.catalog_number, p.manufacturer) }))
      .filter((x: any) => x.score >= 2)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 4);
    if (images.length) withCandidates++;
    await db.from('tyres').update(images.length
      ? { photo_candidates: images, photo_search_error: null }
      : { photo_candidates: [], photo_search_error: 'no matching image' }).eq('id', p.id);
  }));
  return { searched: jobs.length, with_candidates: withCandidates };
};

// ---------- phase 2: download ----------
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
  fit(800); const full = await img.encodeJPEG(82);
  fit(320); const thumb = await img.encodeJPEG(75);
  return { full, thumb };
};

const upload = async (path: string, data: Uint8Array, type: string) => {
  const up = await db.storage.from('galery').upload(path, data, { contentType: type, upsert: true, cacheControl: '31536000' });
  if (up.error) throw new Error(`upload: ${up.error.message}`);
  return db.storage.from('galery').getPublicUrl(path).data.publicUrl;
};

const downloadOne = async (p: any) => {
  let lastErr = '';
  for (const c of p.photo_candidates || []) {
    try {
      const { bytes, type } = await fetchImage(c.url);
      const base = `products/auto/${p.id}-${Date.now().toString(36)}`;
      let full: string, thumb: string;
      if (bytes.length <= SMALL_ENOUGH || type === 'image/webp') {
        // already light: keep the file, the card uses the same image
        const ext = type.split('/')[1].replace('jpeg', 'jpg');
        full = thumb = await upload(`${base}.${ext}`, bytes, type);
      } else {
        const s = await shrink(bytes);
        full = await upload(`${base}.jpg`, s.full, 'image/jpeg');
        thumb = await upload(`${base}-thumb.jpg`, s.thumb, 'image/jpeg');
      }
      const upd = await db.from('tyres').update({
        image_url: full, image_thumb_url: thumb, gallery: [full], gallery_thumbs: [thumb],
        image_source_url: c.link, photo_auto: true, photo_search_error: null,
      }).eq('id', p.id).is('image_url', null);
      if (upd.error) throw new Error(upd.error.message);
      return { id: p.id, ok: true };
    } catch (e) { lastErr = String(e?.message || e).slice(0, 120); }
  }
  await db.from('tyres').update({ photo_search_error: `download failed: ${lastErr}` }).eq('id', p.id);
  return { id: p.id, ok: false, error: lastErr };
};

const download = async (n: number) => {
  const { data: jobs, error } = await db.rpc('claim_photo_download', { n });
  if (error) throw new Error(error.message);
  const results = [];
  for (const p of jobs || []) results.push(await downloadOne(p)); // one at a time: keeps memory low
  return { downloaded: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length };
};

Deno.serve(async (req) => {
  const { data: st } = await db.rpc('program_sync_state');
  if (!st?.token || req.headers.get('x-sync-key') !== st.token) return json({ error: 'forbidden' }, 403);
  let body: any = {}; try { body = await req.json(); } catch { /* empty */ }
  try {
    if (body.action === 'search') return json(await search(Math.min(Number(body.n) || 100, 100), body.ids));
    if (body.action === 'download') return json(await download(Math.min(Number(body.n) || 4, 8)));
    if (body.action === 'status') return json((await db.rpc('photo_job_status')).data);
    return json({ error: 'action: search | download | status' }, 400);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
