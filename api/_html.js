// Loads the built website page (dist/app.html) so server functions can fill in
// page-specific <title>, description and text for Google before sending it.
import fs from 'node:fs';
import path from 'node:path';
import { escapeXml as esc, SUPABASE_URL, SUPABASE_ANON_KEY, DbUnavailable } from './_shop.js';

let cachedHtml = null;
export const loadAppHtml = async (req) => {
  if (cachedHtml) return cachedHtml;
  for (const p of [path.join(process.cwd(), 'dist', 'app.html'), path.join(process.cwd(), 'dist', 'index.html')]) {
    try {
      const html = fs.readFileSync(p, 'utf8');
      if (html.includes('/assets/')) { cachedHtml = html; return html; }
    } catch { /* try next */ }
  }
  const res = await fetch(`https://${req.headers.host}/app.html`);
  cachedHtml = await res.text();
  return cachedHtml;
};

export const setTag = (html, re, tag) => (re.test(html) ? html.replace(re, tag) : html.replace('</head>', `    ${tag}\n  </head>`));

/** Title, description, canonical and social preview tags. */
export const setHead = (html, { title, description, url, image, type }) => {
  if (title) {
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
    html = setTag(html, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}" />`);
    html = setTag(html, /<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(title)}" />`);
  }
  if (description) {
    html = setTag(html, /<meta name="description"[^>]*>/, `<meta name="description" content="${esc(description)}" />`);
    html = setTag(html, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(description)}" />`);
    html = setTag(html, /<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(description)}" />`);
  }
  if (url) {
    html = setTag(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(url)}" />`);
    html = setTag(html, /<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(url)}" />`);
  }
  if (image) {
    html = setTag(html, /<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(image)}" />`);
    html = setTag(html, /<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(image)}" />`);
  }
  if (type) html = setTag(html, /<meta property="og:type"[^>]*>/, `<meta property="og:type" content="${esc(type)}" />`);
  return html;
};

export const addJsonLd = (html, data) =>
  html.replace('</head>', `    <script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>\n  </head>`);

/** Puts plain HTML into <div id="root"> — visible to Google; React replaces it once the app starts. */
export const setRootContent = (html, inner) =>
  html.replace(/<div id="root">\s*<\/div>/, `<div id="root"><div class="max-w-5xl mx-auto px-4 py-8 text-zinc-300">${inner}</div></div>`);

/** SEO settings from the admin "SEO" tab (settings.seo_*), cached for a minute per server instance. */
let siteCache = null;
export const siteSettings = async (rest) => {
  if (siteCache && siteCache.at > Date.now() - 60000) return siteCache.s;
  let s = {};
  try { s = Object.fromEntries((await rest('settings?select=key,value&key=like.seo_*')).map((r) => [r.key, String(r.value ?? '')])); } catch (e) { if (e instanceof DbUnavailable) throw e; /* defaults */ }
  siteCache = { at: Date.now(), s };
  return s;
};

/** Google Search Console verification and opening hours / founding year in the shop's structured data. */
export const applySite = (html, s) => {
  const gsc = (s.seo_gsc_verify || '').replace(/.*content="([^"]+)".*/s, '$1').trim();
  if (gsc && /^[\w-]{10,100}$/.test(gsc)) html = setTag(html, /<meta name="google-site-verification"[^>]*>/, `<meta name="google-site-verification" content="${esc(gsc)}" />`);
  const extra = [];
  if (s.seo_hours) extra.push(`"openingHours": ${JSON.stringify(s.seo_hours)}`);
  if (/^\d{4}$/.test(s.seo_founded || '')) extra.push(`"foundingDate": "${s.seo_founded}"`);
  if (extra.length) html = html.replace(/("@type":\s*"AutoPartsStore",)/, `$1 ${extra.join(', ')},`);
  return html;
};

/** "{назва} — ціна {ціна} грн" → filled text; unknown/empty placeholders disappear. */
export const fillTemplate = (tpl, vars) => String(tpl || '')
  .replace(/\{([^}]+)\}/g, (_, k) => String(vars[k.trim().toLowerCase()] ?? ''))
  .replace(/\s{2,}/g, ' ').replace(/\s+([,.|—-])\s*\1/g, '$1').trim();

/** Redirect set up in the admin for an old address, or null. */
export const findRedirect = async (rest, path) => {
  try {
    const rows = await rest(`seo_redirects?select=to_path&from_path=eq.${encodeURIComponent(path)}`);
    if (rows[0]?.to_path) {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/seo_redirect_hit`, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p: path }) }).catch(() => {});
      return rows[0].to_path;
    }
  } catch (e) { if (e instanceof DbUnavailable) throw e; /* table missing */ }
  return null;
};
