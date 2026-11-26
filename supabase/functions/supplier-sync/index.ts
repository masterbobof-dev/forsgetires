// Pulls partner offers (GPL, Omega) from the shop program's site_supplier_offers_export() and shows them on the
// website as "під замовлення". Runs every 5 minutes (pg_cron). The program database is only read.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const PROGRAM_URL = 'https://zuhanlspejgizjbwbnda.supabase.co';
// Public "anon" key of the program project: by itself it can only call the export with a valid token.
const PROGRAM_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1aGFubHNwZWpnaXpqYndibmRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzAyOTEsImV4cCI6MjA5Mzc0NjI5MX0.3FZJmqq-0eWjGqhvVTl3yAVIoOBuMN2g-lR3E5Fxr2U';
// the program's export may run only 3 seconds: start small, halve on a timeout
const PAGE = 400;
const MIN_PAGE = 50;
const TIME_BUDGET_MS = 110_000;

const site = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const started = Date.now();
  const { data: state, error: stErr } = await site.rpc('supplier_sync_state');
  if (stErr || !state) return json({ ok: false, error: stErr?.message || 'no state' }, 500);
  if (req.headers.get('x-sync-key') !== state.token) return json({ ok: false, error: 'forbidden' }, 403);

  let cursorAt: string = state.cursor_at;
  let cursorId: string = state.cursor_id || '';
  let total = 0, inserted = 0, updated = 0, pages = 0, page = PAGE, caughtUp = false;
  try {
    while (Date.now() - started < TIME_BUDGET_MS) {
      const res = await fetch(`${PROGRAM_URL}/rest/v1/rpc/site_supplier_offers_export`, {
        method: 'POST',
        headers: { apikey: PROGRAM_ANON_KEY, Authorization: `Bearer ${PROGRAM_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_token: state.token, p_since: cursorAt, p_after_id: cursorId, p_limit: page }),
      });
      if (!res.ok) {
        const text = (await res.text()).slice(0, 300);
        if (/57014|statement timeout/i.test(text) && page > MIN_PAGE) { page = Math.max(MIN_PAGE, Math.floor(page / 2)); continue; }
        throw new Error(`program ${res.status}: ${text}`);
      }
      const offers: { external_id: string; updated_at: string }[] = (await res.json()).offers || [];
      if (offers.length) {
        const { data: stats, error } = await site.rpc('supplier_sync_apply', { payload: { offers } });
        if (error) {
          if (/timeout/i.test(error.message) && page > MIN_PAGE) { page = Math.max(MIN_PAGE, Math.floor(page / 2)); continue; }
          throw new Error(`apply: ${error.message}`);
        }
        inserted += stats?.inserted || 0; updated += stats?.updated || 0;
        cursorAt = offers[offers.length - 1].updated_at;
        cursorId = offers[offers.length - 1].external_id;
        await site.rpc('supplier_sync_save', { p_cursor_at: cursorAt, p_cursor_id: cursorId, p_count: offers.length, p_error: null });
      }
      pages++; total += offers.length;
      if (offers.length < page) { caughtUp = true; break; }
    }
    if (!total) await site.rpc('supplier_sync_save', { p_cursor_at: null, p_cursor_id: null, p_count: 0, p_error: null });
    // after the nightly full pass: offers the program no longer has are taken off the site
    let hidden = 0;
    if (caughtUp) { const { data } = await site.rpc('supplier_sync_hide_missing'); hidden = data || 0; }
    return json({ ok: true, pages, total, inserted, updated, hidden, caughtUp, cursorAt, ms: Date.now() - started });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await site.rpc('supplier_sync_save', { p_cursor_at: null, p_cursor_id: null, p_count: total, p_error: msg.slice(0, 500) });
    return json({ ok: false, error: msg, total }, 500);
  }
});
