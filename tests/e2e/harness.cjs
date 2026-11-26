/**
 * Helpers for the browser tests: serve the built site (dist/), open a page whose Supabase requests go to
 * the in-memory fake, wait until the page is quiet, and (optionally) save "what the customer sees" snapshots.
 *
 * Environment:
 *   E2E_DIST      folder with the built site (default: dist)
 *   E2E_BASE_URL  use an already running site instead of serving dist (e.g. the Vite dev server)
 *   E2E_SNAP_DIR  if set, every step saves a screenshot, the page HTML and the list of requests there
 *   E2E_CHROMIUM  path to a Chromium binary (optional)
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');
const { createFake } = require('./fakeSupabase.cjs');
const fixtures = require('./fixtures.cjs');

const ROOT = path.resolve(__dirname, '../..');
const SNAP_DIR = process.env.E2E_SNAP_DIR ? path.resolve(process.env.E2E_SNAP_DIR) : null;
const ARTIFACTS = path.join(__dirname, '.artifacts');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.txt': 'text/plain', '.json': 'application/json', '.woff2': 'font/woff2' };

/** dist/ over http; any address that is not a file gets the app page (like the hosting does) */
const serveDist = async () => {
  if (process.env.E2E_BASE_URL) return { url: process.env.E2E_BASE_URL.replace(/\/$/, ''), close: async () => {} };
  const dist = path.resolve(ROOT, process.env.E2E_DIST || 'dist');
  const page = ['app.html', 'index.html'].map((f) => path.join(dist, f)).find((f) => fs.existsSync(f));
  if (!page) throw new Error(`No built site in ${dist} — run "npm run build" first`);
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(dist, pathname);
    const isFile = file.startsWith(dist) && fs.existsSync(file) && fs.statSync(file).isFile();
    if (pathname.startsWith('/api/')) { res.writeHead(404).end(); return; }
    const target = isFile ? file : page;
    res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(target).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
};

const launch = () => chromium.launch(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {});

const NP = {
  searchSettlements: { success: true, data: [{ Addresses: [{ Present: 'м. Дніпро, Дніпропетровська обл.', DeliveryCity: 'ref-dnipro' }, { Present: 'м. Дніпрорудне, Запорізька обл.', DeliveryCity: 'ref-dniprorudne' }] }] },
  getWarehouses: { success: true, data: [{ Description: 'Відділення №1: вул. Тестова, 1' }, { Description: 'Відділення №2: просп. Перевірки, 2' }] },
};

/**
 * A browser page of the shop with all outside requests answered locally.
 * opts: { device?: 'iPhone 13', viewport?, user?: session(email), tables?: (t) => void, storage?: { key: value } }
 */
const openShop = async (browser, baseUrl, opts = {}) => {
  const tables = fixtures.tables();
  if (opts.tables) opts.tables(tables);
  const fake = createFake({ tables, rpc: { ...fixtures.rpc }, functions: { ...fixtures.functions }, user: opts.user ? opts.user.user : null });
  const context = await browser.newContext({
    ...(opts.device ? devices[opts.device] : { viewport: opts.viewport || { width: 1366, height: 900 } }),
    locale: 'uk-UA', timezoneId: 'Europe/Kyiv',
  });
  const storage = { ...(opts.storage || {}), ...(opts.user ? { [opts.user.storageKey]: opts.user.value } : {}) };
  if (Object.keys(storage).length) {
    // once per tab (not on every reload); frames without storage access (blocked map) are skipped
    await context.addInitScript((items) => {
      try {
        if (sessionStorage.getItem('__e2e_seeded')) return;
        for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
        sessionStorage.setItem('__e2e_seeded', '1');
      } catch { /* no storage in this frame */ }
    }, storage);
  }
  const unexpected = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === baseUrl) {
      if (url.pathname === '/api/geo') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ country: 'UA', city: 'Синельникове', region: '12' }) });
      return route.continue();
    }
    if (url.hostname.endsWith('.supabase.co')) return fake.handle(route);
    if (url.hostname === 'api.novaposhta.ua') {
      const body = route.request().postDataJSON() || {};
      fake.log.push({ method: 'POST', path: 'novaposhta', query: body.calledMethod, body: JSON.stringify(body.methodProperties) });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(NP[body.calledMethod] || { success: false }) });
    }
    if (url.protocol === 'data:' || url.protocol === 'blob:') return route.continue();
    if (!/fonts\.(googleapis|gstatic)\.com|google\.com\/maps/.test(url.href)) unexpected.push(url.href);
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  return { page, context, fake, errors, unexpected, baseUrl };
};

/** wait until the site stopped asking the (fake) server, finished its animations and stopped scrolling */
const settle = async (shop, quietMs = 350) => {
  const { page, fake } = shop;
  const deadline = Date.now() + 15000;
  let lastY = null, stableSince = Date.now();
  while (Date.now() < deadline) {
    const { y, animating } = await page.evaluate(() => ({
      y: Math.round(window.scrollY),
      // finite animations / transitions still running (endless ones like spinners do not count)
      animating: document.getAnimations().some((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations !== Infinity),
    })).catch(() => ({ y: 0, animating: true }));
    if (y !== lastY || animating) { lastY = y; stableSince = Date.now(); }
    const quiet = fake.inFlight === 0 && Date.now() - fake.lastActivity >= quietMs && Date.now() - stableSince >= quietMs;
    if (quiet) return;
    await page.waitForTimeout(50);
  }
  throw new Error('page did not settle in 15 s');
};

/**
 * Actions that first wait for a quiet page. A click scrolls its target into view, and where it ends up depends on
 * the layout at that moment — acting on a settled page makes every run look exactly the same.
 */
const actions = (shop) => {
  const calm = () => settle(shop, 150);
  return {
    click: async (locator, opts) => { await calm(); await locator.click(opts); },
    hover: async (locator) => { await calm(); await locator.hover(); },
    select: async (locator, value) => { await calm(); await locator.selectOption(value); },
    fill: async (locator, value) => { await calm(); await locator.fill(value); },
    press: async (locator, key) => { await calm(); await locator.press(key); },
    goto: async (url) => { await shop.page.goto(url); await calm(); },
  };
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** repeat a check until it passes (the page needs a moment after every click) */
const until = async (fn, timeout = 8000) => {
  const start = Date.now(); let last;
  for (;;) {
    try { return await fn(); } catch (e) { last = e; }
    if (Date.now() - start > timeout) throw last;
    await sleep(80);
  }
};

/** steps are numbered inside their scenario, so a scenario run alone writes the same file names as in a full run */
const stepNo = {};
/** one named step of a scenario; with E2E_SNAP_DIR it also records what the customer sees */
const step = async (shop, scenario, name, fn) => {
  const label = `${scenario} › ${name}`;
  try {
    await fn();
    await settle(shop);
    if (shop.errors.length) throw new Error(`JavaScript error on the page: ${shop.errors.join(' | ')}`);
    if (SNAP_DIR) { stepNo[scenario] = (stepNo[scenario] || 0) + 1; await snapshot(shop, `${scenario}-${String(stepNo[scenario]).padStart(2, '0')}-${name}`.replace(/[^\wа-яіїєґ-]+/gi, '_')); }
    console.log(`  ✓ ${label}`);
  } catch (e) {
    fs.mkdirSync(ARTIFACTS, { recursive: true });
    const shot = path.join(ARTIFACTS, `${label.replace(/[^\w-]+/g, '_')}.png`);
    await shop.page.screenshot({ path: shot }).catch(() => {});
    console.log(`  ✗ ${label}\n    ${String(e.stack || e).split('\n').slice(0, 6).join('\n    ')}\n    screenshot: ${shot}`);
    throw e;
  }
};

/** screenshot + HTML + requests + address + browser storage → files for a before/after comparison */
const snapshot = async (shop, name) => {
  const { page, fake } = shop;
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  // toasts hide on a timer: wait for them so that every run records the same picture
  // (shop: the cart toast; admin: the green / red message at the top — some of those stay until the next one)
  await page.waitForFunction(() => !document.querySelector('.fixed.bottom-\\[100px\\], .fixed.top-20.rounded-full'), null, { timeout: 7000 }).catch(() => {});
  const state = await page.evaluate(() => ({
    url: location.pathname + location.search,
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
    robots: document.querySelector('meta[name="robots"]')?.getAttribute('content') || '',
    scrollY: Math.round(window.scrollY),
    // the browser's Back list: a product opened in a new entry or in place of the current one
    history: `${history.length} ${JSON.stringify(history.state)}`,
    headerH: getComputedStyle(document.documentElement).getPropertyValue('--header-h').trim(),
    // inner scroll positions (side panels, rows of chips, windows)
    scrolls: [...document.querySelectorAll('#root *')].filter((e) => e.scrollTop || e.scrollLeft).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)} top=${e.scrollTop} left=${e.scrollLeft}`),
    storage: Object.fromEntries(['forsage_cart', 'forsage_favorites', 'forsage_compare', 'recent_tyres'].map((k) => [k, localStorage.getItem(k)])),
    html: document.getElementById('root')?.innerHTML || '',
  }));
  const { html, ...meta } = state;
  fs.writeFileSync(path.join(SNAP_DIR, `${name}.html`), html);
  fs.writeFileSync(path.join(SNAP_DIR, `${name}.json`), JSON.stringify({ ...meta, requests: fake.takeLog() }, null, 1));
  await page.screenshot({ path: path.join(SNAP_DIR, `${name}.png`), animations: 'disabled' });
};

/** run the scenarios of a test file one after another (or only the one named on the command line), then report */
const runScenarios = async (title, scenarios) => {
  const site = await serveDist();
  const browser = await launch();
  const only = process.argv[2];
  let failed = 0;
  for (const [name, run] of Object.entries(scenarios)) {
    if (only && only !== name) continue;
    console.log(`\n${title} ${name}`);
    try { await run(browser, site.url); } catch { failed++; }
  }
  await browser.close();
  await site.close();
  console.log(failed ? `\n${failed} scenario(s) failed` : '\nAll scenarios passed');
  process.exit(failed ? 1 : 0);
};

module.exports = { serveDist, launch, openShop, settle, actions, step, until, sleep, runScenarios, fixtures, SNAP_DIR };
