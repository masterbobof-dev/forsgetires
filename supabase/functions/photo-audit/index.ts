// @ts-nocheck
/**
 * Checks the photos stored by photo-finder (galery/products/auto/*): is each file a real, complete, non-empty image?
 * Called by the server only (x-sync-key).
 *   { action: "audit", after_id?: 0, limit?: 25 } → { checked, bad: [{ id, url, reason }], next_after_id }
 *   { action: "peek", path }                      → { type, size, b64 } (small files, for manual inspection)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
const PREFIX = '/storage/v1/object/public/galery/';

export const sniff = (b: Uint8Array) => {
  const s = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && s(1, 3) === 'PNG') return 'png';
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') return 'webp';
  if (s(0, 3) === 'GIF') return 'gif';
  if (s(4, 4) === 'ftyp') return 'avif/heic';
  if (/^\s*</.test(s(0, 20))) return 'html';
  return 'unknown';
};

/** null = fine, otherwise the reason the picture is unusable */
export const problem = async (b: Uint8Array): Promise<string | null> => {
  const kind = sniff(b);
  if (kind !== 'jpeg' && kind !== 'png' && kind !== 'webp') return `not an image (${kind})`;
  if (kind === 'webp') {
    const riff = (b[4] | (b[5] << 8) | (b[6] << 16) | (b[7] << 24)) >>> 0;
    return riff + 8 > b.length + 1 ? 'truncated webp' : null;
  }
  if (kind === 'jpeg') {
    const tail = b.subarray(Math.max(0, b.length - 64));
    let eoi = false; for (let i = 0; i < tail.length - 1; i++) if (tail[i] === 0xff && tail[i + 1] === 0xd9) eoi = true;
    if (!eoi) return 'truncated jpeg';
  }
  // full decoding is heavy: only small files are decoded (an empty picture compresses to a few KB)
  if (b.length > 30000) return null;
  let img;
  try { img = await Image.decode(b); } catch (e) { return `cannot decode: ${String(e?.message || e).slice(0, 60)}`; }
  if (img.width < 200 || img.height < 200) return `too small ${img.width}x${img.height}`;
  // empty picture: (almost) one colour everywhere
  let min = 255, max = 0;
  for (let y = 1; y <= 24; y++) for (let x = 1; x <= 24; x++) {
    const px = img.getPixelAt(Math.max(1, Math.round(x * img.width / 25)), Math.max(1, Math.round(y * img.height / 25)));
    const a = px & 0xff;
    const l = a < 16 ? 255 : Math.round((((px >>> 24) & 0xff) + ((px >>> 16) & 0xff) + ((px >>> 8) & 0xff)) / 3);
    if (l < min) min = l; if (l > max) max = l;
  }
  return max - min < 14 ? 'blank picture' : null;
};

const audit = async (body: any) => {
  const limit = Math.min(Number(body.limit) || 25, 60);
  const { data: rows, error } = await db.from('tyres').select('id, image_url, image_thumb_url, gallery, gallery_thumbs')
    .eq('photo_auto', true).not('image_url', 'is', null).gt('id', Number(body.after_id) || 0).order('id').limit(limit);
  if (error) throw new Error(error.message);
  const bad: any[] = []; let checked = 0;
  for (const p of rows || []) {
    const urls = [...new Set([p.image_url, p.image_thumb_url, ...(p.gallery || []), ...(p.gallery_thumbs || [])].filter((u: string) => u?.includes(PREFIX)))];
    for (const url of urls) {
      checked++;
      try {
        let dl = await db.storage.from('galery').download(url.split(PREFIX)[1]);
        for (let i = 0; i < 3 && dl.error; i++) { await new Promise(r => setTimeout(r, 700)); dl = await db.storage.from('galery').download(url.split(PREFIX)[1]); }
        if (dl.error) { bad.push({ id: p.id, url, reason: `missing: ${dl.error.message}` }); continue; }
        const reason = await problem(new Uint8Array(await dl.data.arrayBuffer()));
        if (reason) bad.push({ id: p.id, url, reason });
      } catch (e) { bad.push({ id: p.id, url, reason: `error: ${String(e?.message || e).slice(0, 60)}` }); }
    }
  }
  return { checked, bad, next_after_id: rows?.length === limit ? rows[rows.length - 1].id : null };
};

const b64 = (bytes: Uint8Array) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const peek = async (body: any) => {
  const dl = await db.storage.from('galery').download(String(body.path));
  if (dl.error) throw new Error(dl.error.message);
  const bytes = new Uint8Array(await dl.data.arrayBuffer());
  return { type: sniff(bytes), size: bytes.length, problem: await problem(bytes), b64: bytes.length < 200000 ? b64(bytes) : null };
};

Deno.serve(async (req) => {
  let body: any = {}; try { body = await req.json(); } catch { /* empty */ }
  try {
    const { data: sync } = await db.rpc('program_sync_state');
    if (!sync?.token || req.headers.get('x-sync-key') !== sync.token) return json({ error: 'forbidden' }, 403);
    if (body.action === 'audit') return json(await audit(body));
    if (body.action === 'peek') return json(await peek(body));
    return json({ error: 'action: audit | peek' }, 400);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
