/**
 * In-memory stand-in for the shop's Supabase REST API, for browser tests (Playwright route handler).
 * Understands the part of PostgREST the site uses: column filters (eq, neq, in, is, ilike, cs, gt…, not.*),
 * nested or=(…,and(…)), order, offset/limit, exact count, single-object responses, inserts/upserts and RPC.
 * Nothing here talks to the real database.
 */

// ---------- PostgREST filters ----------
const splitTop = (s) => {
  const out = []; let depth = 0, quoted = false, cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) { if (ch === '\\') { cur += ch + s[++i]; continue; } if (ch === '"') quoted = false; cur += ch; continue; }
    if (ch === '"') { quoted = true; cur += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur !== '') out.push(cur);
  return out;
};
const unquote = (v) => (/^".*"$/s.test(v) ? v.slice(1, -1).replace(/\\(.)/g, '$1') : v);
const getCol = (row, col) => {
  const m = col.match(/^(\w+)->>?(\w+)$/);
  if (m) { const v = row[m[1]] == null ? undefined : row[m[1]][m[2]]; return v == null ? null : String(v); }
  return row[col];
};
const likeRe = (pattern) => new RegExp('^' + unquote(pattern).split(/[*%]/).map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '.')).join('.*') + '$', 'is');
const cmp = (a, b) => { const na = Number(a), nb = Number(b); return (a !== '' && b !== '' && Number.isFinite(na) && Number.isFinite(nb)) ? na - nb : String(a).localeCompare(String(b)); };

/** one "col.op.value" condition → predicate; SQL semantics for NULL (a comparison with NULL never matches) */
const columnCond = (col, opValue) => {
  let negate = false;
  if (opValue.startsWith('not.')) { negate = true; opValue = opValue.slice(4); }
  const i = opValue.indexOf('.');
  const op = i < 0 ? opValue : opValue.slice(0, i), raw = i < 0 ? '' : opValue.slice(i + 1);
  let test;
  if (op === 'is') {
    const want = raw === 'null' ? null : raw === 'true';
    test = (v) => (want === null ? v == null : v === want);
    return (row) => { const r = test(getCol(row, col)); return negate ? !r : r; }; // IS / IS NOT never yield NULL
  }
  if (op === 'eq') { const val = unquote(raw); test = (v) => String(v) === val; }
  else if (op === 'neq') { const val = unquote(raw); test = (v) => String(v) !== val; }
  else if (op === 'in') { const list = splitTop(raw.replace(/^\(|\)$/g, '')).map(unquote); test = (v) => list.includes(String(v)); }
  else if (op === 'ilike' || op === 'like') { const re = likeRe(raw); test = (v) => re.test(String(v)); }
  else if (op === 'cs') { const list = splitTop(raw.replace(/^[{[]|[}\]]$/g, '')).map(unquote); test = (v) => Array.isArray(v) && list.every((x) => v.map(String).includes(x)); }
  else if (['gt', 'gte', 'lt', 'lte'].includes(op)) { const val = unquote(raw); test = (v) => { const c = cmp(v, val); return op === 'gt' ? c > 0 : op === 'gte' ? c >= 0 : op === 'lt' ? c < 0 : c <= 0; }; }
  else throw new Error(`fakeSupabase: operator "${op}" is not supported (${col}.${opValue})`);
  return (row) => { const v = getCol(row, col); if (v == null) return false; const r = test(v); return negate ? !r : r; };
};
/** an item inside or=(…) / and=(…) */
const exprCond = (expr) => {
  const g = expr.match(/^(not\.)?(and|or)\((.*)\)$/s);
  if (g) {
    const parts = splitTop(g[3]).map(exprCond);
    const f = g[2] === 'and' ? (row) => parts.every((p) => p(row)) : (row) => parts.some((p) => p(row));
    return g[1] ? (row) => !f(row) : f;
  }
  const i = expr.indexOf('.');
  return columnCond(expr.slice(0, i), expr.slice(i + 1));
};
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
const buildFilter = (params) => {
  const conds = [];
  for (const [key, value] of params) {
    if (RESERVED.has(key)) continue;
    if (key === 'or' || key === 'and' || key === 'not.or' || key === 'not.and') conds.push(exprCond(`${key}${value}`));
    else conds.push(columnCond(key, value));
  }
  return (row) => conds.every((c) => c(row));
};
const sortRows = (rows, order) => {
  if (!order) return rows;
  const keys = order.split(',').map((k) => { const [col, ...mods] = k.split('.'); const desc = mods.includes('desc'); return { col, desc, nullsFirst: mods.includes('nullsfirst') ? true : mods.includes('nullslast') ? false : desc }; });
  const val = (v) => (typeof v === 'boolean' ? Number(v) : v);
  return [...rows].sort((a, b) => {
    for (const k of keys) {
      const x = val(getCol(a, k.col)), y = val(getCol(b, k.col));
      if (x == null && y == null) continue;
      if (x == null) return k.nullsFirst ? -1 : 1;
      if (y == null) return k.nullsFirst ? 1 : -1;
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      if (c) return k.desc ? -c : c;
    }
    return 0;
  });
};
const pickColumns = (rows, select) => {
  if (!select || select === '*' || select.includes('(') || select.includes('*')) return rows;
  const cols = select.split(',').map((c) => c.trim().replace(/^.*:/, '').replace(/::.*$/, ''));
  return rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] === undefined ? null : r[c]])));
};

// ---------- the fake ----------
/** pause between two answers, so the page finishes with one before the next arrives */
const ANSWER_GAP_MS = 4;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range' };

/**
 * @param tables  { tableName: rows[] }
 * @param rpc       { fnName: (args, fake) => any }           — database functions
 * @param functions { name: (body, fake) => any }             — edge functions
 * @param user    signed-in user for /auth/v1/user (or null)
 */
const createFake = ({ tables = {}, rpc = {}, functions = {}, user = null } = {}) => {
  const fake = {
    tables, rpc, functions, user,
    /** every request the site made: { method, path, query, body } */
    log: [],
    /** rows the site inserted, per table */
    inserted: {},
    inFlight: 0,
    lastActivity: Date.now(),
    /** requests since the last call, as sorted "METHOD path?query body" lines (for before/after comparisons) */
    takeLog() {
      const lines = fake.log.splice(0).map((r) => `${r.method} ${r.path}${r.query ? `?${r.query}` : ''}${r.body ? ` ${r.body}` : ''}`);
      return lines.sort();
    },
    /**
     * Answers leave one at a time, in the order the requests came, with a short pause between them.
     * Without this, two requests sent in the same instant get their answers in the same millisecond and the browser
     * may handle them in either order — a page that fires two loads of one list would then show a different
     * result from run to run.
     */
    async handle(route) {
      fake.inFlight++;
      const turn = line.then(() => respond(route)).then(() => new Promise((r) => setTimeout(r, ANSWER_GAP_MS)));
      line = turn.catch(() => {});
      try { await turn; } finally { fake.inFlight--; fake.lastActivity = Date.now(); }
    },
  };
  let line = Promise.resolve();

  const respond = async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const json = (data, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers: { ...CORS, ...headers }, body: data === undefined ? '' : JSON.stringify(data) });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });

    let body = null;
    try { body = req.postDataJSON(); } catch { body = req.postData(); }
    const query = decodeURIComponent(url.search.slice(1));
    const entry = { method, path: url.pathname, query, body: body == null ? '' : JSON.stringify(body) };
    // statistics events carry a random session id, the time and the screen size: keep only what is stable
    if (url.pathname.endsWith('/analytics_events') && body) entry.body = JSON.stringify([].concat(body).map((e) => [e.event_type, e.item_id, e.item_name, e.path_name, e.value]));
    entry.body = entry.body.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, '<time>'); // "now" differs from run to run
    // uploaded files get the current time in their name (smart_1795…_photo.png), and the browser separates
    // the parts of an upload with a random mark
    for (const k of ['path', 'query', 'body']) entry[k] = entry[k].replace(/smart_\d{10,}_/g, 'smart_<time>_').replace(/WebKitFormBoundary\w+/g, 'FormBoundary');
    fake.log.push(entry);

    // --- auth ---
    if (url.pathname.startsWith('/auth/v1/')) {
      if (url.pathname.endsWith('/user')) return fake.user ? json(fake.user) : json({ message: 'not signed in' }, 401);
      if (url.pathname.endsWith('/logout')) return json({}, 204);
      return json({});
    }
    // --- edge functions ---
    if (url.pathname.startsWith('/functions/v1/')) {
      const handler = fake.functions[url.pathname.split('/').pop()];
      return json(handler ? await handler(body || {}, fake) : {});
    }
    // --- storage (photos are data: links in the fixtures) ---
    if (url.pathname.startsWith('/storage/v1/')) return json({});

    // --- rpc ---
    const fn = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/);
    if (fn) {
      const handler = fake.rpc[fn[1]];
      const args = method === 'GET' ? Object.fromEntries(url.searchParams) : (body || {});
      const out = handler ? await handler(args, fake) : [];
      // a function that returns table rows can be filtered, ordered and paged like a table (search_rank)
      const listed = method === 'POST' && Array.isArray(out) && [...url.searchParams.keys()].length > 0;
      if (!listed) return json(out);
      const prefer = req.headers()['prefer'] || '';
      const matches = out.filter(buildFilter(url.searchParams));
      const sorted = url.searchParams.get('order') ? sortRows(matches, url.searchParams.get('order')) : matches;
      const offset = Number(url.searchParams.get('offset') || 0);
      const limit = url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : Infinity;
      const page = pickColumns(sorted.slice(offset, offset + limit), url.searchParams.get('select'));
      return json(page, 200, { 'content-range': `${page.length ? `${offset}-${offset + page.length - 1}` : '*'}/${prefer.includes('count=') ? matches.length : '*'}` });
    }

    // --- tables ---
    const t = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
    if (!t) return json({ message: `fakeSupabase: unknown path ${url.pathname}` }, 404);
    const name = t[1];
    const rows = (fake.tables[name] ||= []);
    const prefer = req.headers()['prefer'] || '';

    if (method === 'POST') {
      const list = [].concat(body || []);
      (fake.inserted[name] ||= []).push(...list);
      if (prefer.includes('resolution=merge-duplicates')) {
        for (const r of list) { const i = rows.findIndex((x) => (r.id != null && x.id === r.id) || (r.key != null && x.key === r.key)); if (i >= 0) rows[i] = { ...rows[i], ...r }; else rows.push(r); }
      } else rows.push(...list.map((r, i) => ({ id: r.id ?? 100000 + rows.length + i, ...r })));
      return prefer.includes('return=representation') ? json(list, 201) : json(undefined, 201);
    }

    const matches = rows.filter(buildFilter(url.searchParams));
    if (method === 'PATCH') {
      for (const r of matches) Object.assign(r, body);
      (fake.inserted[`${name}:update`] ||= []).push({ where: query, set: body });
      return prefer.includes('return=representation') ? json(matches) : json(undefined, 204);
    }
    if (method === 'DELETE') {
      fake.tables[name] = rows.filter((r) => !matches.includes(r));
      (fake.inserted[`${name}:delete`] ||= []).push({ where: query, rows: matches.length });
      // .delete().select(…, { count: 'exact' }) gets the deleted rows and their number back
      if (prefer.includes('return=representation')) return json(matches, 200, { 'content-range': `${matches.length ? `0-${matches.length - 1}` : '*'}/${prefer.includes('count=') ? matches.length : '*'}` });
      return json(undefined, 204);
    }

    // GET / HEAD
    const sorted = sortRows(matches, url.searchParams.get('order'));
    const offset = Number(url.searchParams.get('offset') || 0);
    const limit = url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : Infinity;
    const page = pickColumns(sorted.slice(offset, offset + limit), url.searchParams.get('select'));
    const range = { 'content-range': `${page.length ? `${offset}-${offset + page.length - 1}` : '*'}/${prefer.includes('count=') ? matches.length : '*'}` };
    if (method === 'HEAD') return route.fulfill({ status: 200, headers: { ...CORS, ...range } });
    if ((req.headers()['accept'] || '').includes('vnd.pgrst.object')) {
      return page.length === 1 ? json(page[0], 200, range) : json({ code: 'PGRST116', details: `The result contains ${page.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' }, 406);
    }
    return json(page, 200, range);
  };

  return fake;
};

module.exports = { createFake, buildFilter, sortRows, splitTop };
