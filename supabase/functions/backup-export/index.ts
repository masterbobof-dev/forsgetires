// @ts-nocheck
/**
 * Nightly copy of the shop's data OUTSIDE the database: every important table is saved as gzipped JSON
 * into the private Storage bucket "backups" (backups/YYYY-MM-DD/<table>.json.gz). Copies older than 30 days are removed.
 * Called by pg_cron with header x-sync-key. { action: "run" } — make today's copy; { action: "list" } — what is stored.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
const TABLES = ['tyres', 'product_categories', 'tyre_orders', 'customer_profiles', 'product_reviews', 'settings', 'suppliers', 'articles',
  'site_pages', 'site_banners', 'site_promos', 'seo_redirects', 'pricing', 'bookings', 'telegram_users'];
const KEEP_DAYS = 30;

const gzip = async (text: string) => new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());

// partner goods (tyres.supplier_offer_id) are not copied: the program sends them again by itself (nightly full refresh)
const base = (table: string) => { const q = db.from(table).select('*'); return table === 'tyres' ? q.is('supplier_offer_id', null) : q; };

const dump = async (table: string) => {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await base(table).order('created_at', { ascending: true, nullsFirst: true }).range(from, from + 999);
    if (error) {
      // tables without created_at
      const r2 = await base(table).range(from, from + 999);
      if (r2.error) throw new Error(`${table}: ${r2.error.message}`);
      rows.push(...(r2.data || [])); if ((r2.data || []).length < 1000) break; continue;
    }
    rows.push(...(data || [])); if ((data || []).length < 1000) break;
  }
  return rows;
};

const run = async () => {
  const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' });
  const out: Record<string, number | string> = {};
  for (const t of TABLES) {
    try {
      const rows = await dump(t);
      const up = await db.storage.from('backups').upload(`${day}/${t}.json.gz`, await gzip(JSON.stringify(rows)), { contentType: 'application/gzip', upsert: true });
      out[t] = up.error ? `error: ${up.error.message}` : rows.length;
    } catch (e) { out[t] = `error: ${String(e?.message || e).slice(0, 100)}`; }
  }
  // remove old days
  const { data: days } = await db.storage.from('backups').list('', { limit: 1000 });
  const cutoff = new Date(Date.now() - KEEP_DAYS * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' });
  for (const d of days || []) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d.name) && d.name < cutoff) {
      const { data: files } = await db.storage.from('backups').list(d.name, { limit: 100 });
      if (files?.length) await db.storage.from('backups').remove(files.map((f: any) => `${d.name}/${f.name}`));
    }
  }
  await db.from('settings').upsert({ key: 'backup_export_at', value: JSON.stringify({ day, at: new Date().toISOString(), tables: out }) });
  return { day, tables: out };
};

Deno.serve(async (req) => {
  let body: any = {}; try { body = await req.json(); } catch { /* empty */ }
  const { data: sync } = await db.rpc('program_sync_state');
  if (!sync?.token || req.headers.get('x-sync-key') !== sync.token) return json({ error: 'forbidden' }, 403);
  try {
    if (body.action === 'list') return json((await db.storage.from('backups').list('', { limit: 100 })).data);
    return json(await run());
  } catch (e) { return json({ error: String(e?.message || e) }, 500); }
});
