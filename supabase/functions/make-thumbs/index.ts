// @ts-nocheck
/**
 * Background job: list pictures (up to 800 px JPEG, good quality) for products whose photo is in our Storage.
 * Photos up to 300 KB are used as they are. Old small 400 px thumbnails ("-thumb.jpg", made by the rough
 * pixel-dropping shrink, they looked pixelated) are made again; the old one is shown until the new one is ready.
 * Called by pg_cron with header x-sync-key, { n } products per call; returns { left } so the cron job can stop itself.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import decodeWebp, { init as initWebp } from 'https://esm.sh/@jsquash/webp@1.4.0/decode.js';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
const PREFIX = '/storage/v1/object/public/galery/';
const SIDE = 800;
const QUALITY = 85;
const KEEP_AS_IS = 300_000;
/** products still to do: no thumbnail yet, or the old pixelated one */
const TODO = 'image_thumb_url.is.null,image_thumb_url.like.*-thumb.jpg';

// imagescript can't read WebP: those photos are decoded by a separate small decoder
let webpReady: Promise<void> | null = null;
const isWebp = (b: Uint8Array) => b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP';
const decodeAny = async (bytes: Uint8Array): Promise<{ data: Uint8Array | Uint8ClampedArray; width: number; height: number }> => {
  if (!isWebp(bytes)) { const im = await Image.decode(bytes); return { data: im.bitmap, width: im.width, height: im.height }; }
  webpReady ??= fetch('https://esm.sh/@jsquash/webp@1.4.0/codec/dec/webp_dec.wasm')
    .then((r) => r.arrayBuffer()).then((b) => WebAssembly.compile(b)).then((m) => initWebp(m));
  await webpReady;
  return await decodeWebp(bytes.buffer);
};

/** Smooth shrink to SIDE: every new pixel is the average of the block of old pixels it covers
 *  (imagescript's own resize just drops pixels, which looked pixelated). See-through parts become white. */
const shrink = (src: Uint8Array | Uint8ClampedArray, sw: number, sh: number) => {
  const k = Math.min(1, SIDE / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
  const out = new Image(w, h); const o = out.bitmap;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * sh / h), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sh / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * sw / w), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sw / w));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        const i = (yy * sw + xx) * 4, a = src[i + 3] / 255;
        r += src[i] * a + 255 * (1 - a); g += src[i + 1] * a + 255 * (1 - a); b += src[i + 2] * a + 255 * (1 - a); n++;
      }
      const j = (y * w + x) * 4; o[j] = r / n; o[j + 1] = g / n; o[j + 2] = b / n; o[j + 3] = 255;
    }
  }
  return out;
};

Deno.serve(async (req) => {
  let body: any = {}; try { body = await req.json(); } catch { /* empty */ }
  const { data: sync } = await db.rpc('program_sync_state');
  if (!sync?.token || req.headers.get('x-sync-key') !== sync.token) return json({ error: 'forbidden' }, 403);
  const n = Math.min(Math.max(Number(body.n) || 6, 1), 15);
  const { data: rows } = await db.from('tyres').select('id, image_url').like('image_url', `%${PREFIX}%`).or(TODO)
    .is('thumb_error', null).neq('in_stock', false).order('has_photo', { ascending: false }).limit(n);
  const out = { done: 0, same: 0, failed: 0 } as Record<string, number>;
  for (const p of rows || []) {
    try {
      const res = await fetch(p.image_url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length <= KEEP_AS_IS) { await db.from('tyres').update({ image_thumb_url: p.image_url }).eq('id', p.id); out.same++; continue; }
      // marked before the heavy part: if the worker is killed on this photo (too big for its limits),
      // the mark stays and the next run skips it instead of failing on it again and again
      await db.from('tyres').update({ thumb_error: 'не вдалося обробити (завелике фото)' }).eq('id', p.id);
      const d = await decodeAny(bytes);
      const jpeg = await shrink(d.data, d.width, d.height).encodeJPEG(QUALITY);
      if (jpeg.length >= bytes.length) { await db.from('tyres').update({ image_thumb_url: p.image_url, thumb_error: null }).eq('id', p.id); out.same++; continue; }
      const path = p.image_url.split(PREFIX)[1].replace(/\.[a-z0-9]+$/i, '') + '-t800.jpg';
      const up = await db.storage.from('galery').upload(path, jpeg, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
      if (up.error) throw new Error(up.error.message);
      await db.from('tyres').update({ image_thumb_url: db.storage.from('galery').getPublicUrl(path).data.publicUrl, thumb_error: null }).eq('id', p.id);
      out.done++;
    } catch (e) {
      await db.from('tyres').update({ thumb_error: String(e?.message || e).slice(0, 120) }).eq('id', p.id);
      out.failed++;
    }
  }
  const { count } = await db.from('tyres').select('id', { count: 'exact', head: true }).like('image_url', `%${PREFIX}%`).or(TODO).is('thumb_error', null).neq('in_stock', false);
  return json({ ...out, left: count || 0 });
});
