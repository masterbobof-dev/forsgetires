// @ts-nocheck
/**
 * One-off job: copy product photos hosted on third-party sites into our own
 * Storage bucket ("galery/products/…"), shrinking big JPEG/PNG files to max 900px.
 * The original link is kept in tyres.image_source_url so the change can be undone.
 *
 * Called from the database (pg_net) with a secret job key; processes a few
 * products per call (parallel calls are safe — claim_image_jobs uses SKIP LOCKED).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

const MAX_SIDE = 900;
const MAX_BYTES = 8 * 1024 * 1024;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(supabaseUrl, serviceKey);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  const { data: keyRow } = await db.from('settings').select('value').eq('key', 'image_job_key').maybeSingle();
  if (!keyRow?.value || body.key !== keyRow.value) return json({ error: 'Forbidden' }, 403);

  const n = Math.min(Math.max(Number(body.n) || 3, 1), 10);
  const { data: jobs, error } = await db.rpc('claim_image_jobs', { n });
  if (error) return json({ error: error.message }, 500);

  const results: any[] = [];
  for (const job of jobs || []) {
    const src: string = job.image_url;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(src, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ForsageImageBot/1.0)', Accept: 'image/*' },
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = (res.headers.get('content-type') || '').split(';')[0].trim();
      if (!type.startsWith('image/')) throw new Error(`not an image: ${type || 'unknown'}`);
      let bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length > MAX_BYTES) throw new Error('too big');

      let outType = type;
      let ext = (type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
      // Shrink JPEG / PNG; other formats (webp, avif) are usually small already — keep as is
      if (type === 'image/jpeg' || type === 'image/png') {
        try {
          const img = await Image.decode(bytes);
          if (img.width > MAX_SIDE || img.height > MAX_SIDE || bytes.length > 250_000) {
            if (img.width >= img.height) img.resize(Math.min(MAX_SIDE, img.width), Image.RESIZE_AUTO);
            else img.resize(Image.RESIZE_AUTO, Math.min(MAX_SIDE, img.height));
            const jpeg = await img.encodeJPEG(82);
            if (jpeg.length < bytes.length) { bytes = jpeg; outType = 'image/jpeg'; ext = 'jpg'; }
          }
        } catch (_) { /* keep the original bytes */ }
      }

      const path = `products/${job.id}-${Date.now().toString(36)}.${ext}`;
      const up = await db.storage.from('galery').upload(path, bytes, { contentType: outType, upsert: true, cacheControl: '31536000' });
      if (up.error) throw new Error(`upload: ${up.error.message}`);
      const publicUrl = db.storage.from('galery').getPublicUrl(path).data.publicUrl;

      const gallery = Array.isArray(job.gallery) ? job.gallery.map((g: string) => (g === src ? publicUrl : g)) : job.gallery;
      const upd = await db.from('tyres').update({
        image_url: publicUrl,
        image_source_url: src,
        gallery,
        image_job_error: null,
      }).eq('id', job.id).eq('image_url', src);
      if (upd.error) throw new Error(`update: ${upd.error.message}`);
      results.push({ id: job.id, ok: true, kb: Math.round(bytes.length / 1024) });
    } catch (e) {
      const msg = String(e?.message || e).slice(0, 300);
      await db.from('tyres').update({ image_job_error: msg }).eq('id', job.id);
      results.push({ id: job.id, ok: false, error: msg });
    }
  }
  return json({ processed: results.length, results });
});
