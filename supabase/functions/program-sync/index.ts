// Pulls catalog changes (products, prices, stock, categories) from the shop program's
// Supabase project and applies them to the website. Runs every 2 minutes (pg_cron).
// The program database is only read, through its token-protected site_catalog_export().
import { createClient } from 'jsr:@supabase/supabase-js@2';

const PROGRAM_URL = 'https://zuhanlspejgizjbwbnda.supabase.co';
// Public "anon" key of the program project: by itself it can only call the export with a valid token.
const PROGRAM_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1aGFubHNwZWpnaXpqYndibmRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzAyOTEsImV4cCI6MjA5Mzc0NjI5MX0.3FZJmqq-0eWjGqhvVTl3yAVIoOBuMN2g-lR3E5Fxr2U';
const PAGE = 1000;
const TIME_BUDGET_MS = 100_000;

const site = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const started = Date.now();
  const { data: state, error: stErr } = await site.rpc('program_sync_state');
  if (stErr || !state) return json({ ok: false, error: stErr?.message || 'no state' }, 500);
  if (req.headers.get('x-sync-key') !== state.token) return json({ ok: false, error: 'forbidden' }, 403);

  let cursorAt: string = state.cursor_at;
  let cursorId: string = state.cursor_id;
  let total = 0, inserted = 0, updated = 0, pages = 0;

  try {
    while (Date.now() - started < TIME_BUDGET_MS) {
      const res = await fetch(`${PROGRAM_URL}/rest/v1/rpc/site_catalog_export`, {
        method: 'POST',
        headers: { apikey: PROGRAM_ANON_KEY, Authorization: `Bearer ${PROGRAM_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_token: state.token, p_since: cursorAt, p_after_id: cursorId, p_limit: PAGE }),
      });
      if (!res.ok) throw new Error(`program ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const payload = await res.json();
      const products: { id: string; updated_at: string }[] = payload.products || [];
      // categories only need to be sent with the first page of a run
      const { data: stats, error } = await site.rpc('program_sync_apply', { payload: pages === 0 ? payload : { products } });
      if (error) throw new Error(`apply: ${error.message}`);
      pages++;
      total += products.length; inserted += stats?.inserted || 0; updated += stats?.updated || 0;
      if (products.length) {
        cursorAt = products[products.length - 1].updated_at;
        cursorId = products[products.length - 1].id;
        await site.rpc('program_sync_save', { p_cursor_at: cursorAt, p_cursor_id: cursorId, p_count: products.length, p_error: null });
      }
      if (products.length < PAGE) break;
    }
    if (!total) await site.rpc('program_sync_save', { p_cursor_at: null, p_cursor_id: null, p_count: 0, p_error: null });
    // Full pass finished (nightly reset): products not seen since the reset were deleted in the program -> hide them
    let hidden = 0;
    const caughtUp = Date.now() - started < TIME_BUDGET_MS;
    if (caughtUp && state.full_resync_at && (!state.missing_checked_at || state.missing_checked_at < state.full_resync_at)) {
      const { data: n, error } = await site.rpc('program_sync_hide_missing', { p_before: state.full_resync_at });
      if (error) throw new Error(`hide_missing: ${error.message}`);
      hidden = n || 0;
    }
    const result = { ok: true, pages, total, inserted, updated, hidden, cursorAt, ms: Date.now() - started };
    // journal: only runs that changed something (every 2 minutes would be noise)
    if (total || hidden) await site.rpc('program_sync_log', { p: result });
    return json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await site.rpc('program_sync_save', { p_cursor_at: null, p_cursor_id: null, p_count: total, p_error: msg.slice(0, 500) });
    await site.rpc('program_sync_log', { p: { total, inserted, updated, ms: Date.now() - started, error: msg.slice(0, 500) } });
    return json({ ok: false, error: msg, total }, 500);
  }
});
