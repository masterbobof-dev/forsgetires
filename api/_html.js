// Loads the built website page (dist/app.html) so server functions can fill in
// page-specific <title>, description and text for Google before sending it.
import fs from 'node:fs';
import path from 'node:path';
import { escapeXml as esc } from './_shop.js';

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
