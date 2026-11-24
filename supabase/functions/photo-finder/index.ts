// @ts-nocheck
/**
 * Finds a product photo on the internet (Google Images via Serper.dev, key in ai_api_keys.serper_key)
 * for goods from the shop program that have no photo, copies it into our storage as a full image
 * (max 800px) and a small thumbnail (max 320px), and marks it photo_auto = true for review.
 * Called with x-sync-key (same secret as program-sync). Body: { n?: number, ids?: number[] }.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
const BAD_DOMAINS = /(pinterest|aliexpress|alicdn|olx\.|facebook|instagram|youtube|ytimg|tiktok|vk\.com|ok\.ru|lookaside|shutterstock|depositphotos|istockphoto|dreamstime|123rf|freepik)/i;

/** "Масло Моторное ELF 5w40 1л (12)/216645" -> "Масло Моторное ELF 5w40 1л 216645" */
const cleanTitle = (t: string) => t.replace(/\(\d+\)/g, ' ').replace(/[\/\\]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (t: string) => t.toLowerCase().split(/[^0-9a-zа-яіїєґ]+/i).filter(w => w.length >= 3);

const scoreCandidate = (img: any, title: string, sku?: string, brand?: string) => {
  const w = Number(img.imageWidth) || 0, h = Number(img.imageHeight) || 0;
  if (w < 250 || h < 250) return -1;
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

const download = async (url: string) => {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ForsageImageBot/1.0)', Accept: 'image/*' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!/^image\/(jpeg|png|jpg)$/.test(type)) throw new Error(`format ${type || '?'}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > 6_000_000) throw new Error('too big');
    return bytes;
  } finally { clearTimeout(timer); }
};

const resized = async (bytes: Uint8Array, max: number, q: number) => {
  const img = await Image.decode(bytes);
  if (img.width >= img.height) { if (img.width > max) img.resize(max, Image.RESIZE_AUTO); }
  else if (img.height > max) img.resize(Image.RESIZE_AUTO, max);
  return await img.encodeJPEG(q);
};

Deno.serve(async (req) => {
  const { data: st } = await db.rpc('program_sync_state');
  if (!st?.token || req.headers.get('x-sync-key') !== st.token) return json({ error: 'forbidden' }, 403);
  let body: any = {}; try { body = await req.json(); } catch { /* empty */ }

  const { data: keys } = await db.from('ai_api_keys').select('serper_key').eq('id', 1).maybeSingle();
  const serper = String(keys?.serper_key || '').replace(/[^\x20-\x7e]/g, '').trim();
  if (!serper) return json({ error: 'no serper key' }, 500);

  const { data: jobs, error } = await db.rpc('claim_photo_search', { n: Number(body.n) || 4, p_only_ids: body.ids || null });
  if (error) return json({ error: error.message }, 500);

  const results = [];
  for (const p of jobs || []) {
    try {
      const q = cleanTitle(p.manufacturer && !p.title.toLowerCase().includes(p.manufacturer.toLowerCase()) ? `${p.manufacturer} ${p.title}` : p.title);
      const sr = await fetch('https://google.serper.dev/images', {
        method: 'POST', headers: { 'X-API-KEY': serper, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, num: 10, gl: 'ua', hl: 'uk' }),
      });
      if (!sr.ok) throw new Error(`serper ${sr.status}: ${(await sr.text()).slice(0, 120)}`);
      const images = ((await sr.json()).images || [])
        .map((img: any) => ({ img, score: scoreCandidate(img, p.title, p.catalog_number, p.manufacturer) }))
        .filter((x: any) => x.score >= 2)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 4);
      if (!images.length) throw new Error('no matching image');

      let saved = null, lastErr = '';
      for (const { img, score } of images) {
        try {
          const src = await download(img.imageUrl);
          const full = await resized(src, 800, 82);
          const thumb = await resized(src, 320, 75);
          const base = `products/auto/${p.id}-${Date.now().toString(36)}`;
          for (const [suffix, data] of [['', full], ['-thumb', thumb]]) {
            const up = await db.storage.from('galery').upload(`${base}${suffix}.jpg`, data, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
            if (up.error) throw new Error(`upload: ${up.error.message}`);
          }
          const url = (s: string) => db.storage.from('galery').getPublicUrl(`${base}${s}.jpg`).data.publicUrl;
          saved = { full: url(''), thumb: url('-thumb'), source: img.link || img.imageUrl, score, kb: Math.round(full.length / 1024) };
          break;
        } catch (e) { lastErr = String(e?.message || e); }
      }
      if (!saved) throw new Error(`download failed: ${lastErr}`);
      const upd = await db.from('tyres').update({
        image_url: saved.full, image_thumb_url: saved.thumb, gallery: [saved.full], gallery_thumbs: [saved.thumb],
        image_source_url: saved.source, photo_auto: true, photo_search_error: null,
      }).eq('id', p.id).is('image_url', null);
      if (upd.error) throw new Error(upd.error.message);
      results.push({ id: p.id, ok: true, title: p.title, ...saved });
    } catch (e) {
      const msg = String(e?.message || e).slice(0, 300);
      await db.from('tyres').update({ photo_search_error: msg }).eq('id', p.id);
      results.push({ id: p.id, ok: false, title: p.title, error: msg });
    }
  }
  return json({ processed: results.length, results });
});
