// @ts-nocheck
/**
 * One-off background job: small list pictures (max 400px JPEG) for products whose photo is in our Storage
 * but has no thumbnail yet (tyres.image_thumb_url). Small photos (< 70 KB) are used as their own thumbnail.
 * Called by pg_cron with header x-sync-key, { n } products per call; returns { left } so the cron job can stop itself.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
const PREFIX = '/storage/v1/object/public/galery/';
const SIDE = 400;

Deno.serve(async (req) => {
  let body: any = {}; try { body = await req.json(); } catch { /* empty */ }
  const { data: sync } = await db.rpc('program_sync_state');
  if (!sync?.token || req.headers.get('x-sync-key') !== sync.token) return json({ error: 'forbidden' }, 403);
  const n = Math.min(Math.max(Number(body.n) || 6, 1), 15);
  const { data: rows } = await db.from('tyres').select('id, image_url').like('image_url', `%${PREFIX}%`).is('image_thumb_url', null)
    .is('thumb_error', null).neq('in_stock', false).order('has_photo', { ascending: false }).limit(n);
  const out = { done: 0, same: 0, failed: 0 } as Record<string, number>;
  for (const p of rows || []) {
    try {
      const res = await fetch(p.image_url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length < 70_000) { await db.from('tyres').update({ image_thumb_url: p.image_url }).eq('id', p.id); out.same++; continue; }
      const img = await Image.decode(bytes);
      if (img.width >= img.height) img.resize(Math.min(SIDE, img.width), Image.RESIZE_AUTO); else img.resize(Image.RESIZE_AUTO, Math.min(SIDE, img.height));
      const jpeg = await img.encodeJPEG(78);
      if (jpeg.length >= bytes.length) { await db.from('tyres').update({ image_thumb_url: p.image_url }).eq('id', p.id); out.same++; continue; }
      const path = p.image_url.split(PREFIX)[1].replace(/\.[a-z0-9]+$/i, '') + '-thumb.jpg';
      const up = await db.storage.from('galery').upload(path, jpeg, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
      if (up.error) throw new Error(up.error.message);
      await db.from('tyres').update({ image_thumb_url: db.storage.from('galery').getPublicUrl(path).data.publicUrl }).eq('id', p.id);
      out.done++;
    } catch (e) {
      await db.from('tyres').update({ thumb_error: String(e?.message || e).slice(0, 120) }).eq('id', p.id);
      out.failed++;
    }
  }
  const { count } = await db.from('tyres').select('id', { count: 'exact', head: true }).like('image_url', `%${PREFIX}%`).is('image_thumb_url', null).is('thumb_error', null).neq('in_stock', false);
  return json({ ...out, left: count || 0 });
});
