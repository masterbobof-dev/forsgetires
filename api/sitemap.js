// Always-fresh sitemaps built from Supabase. /sitemap.xml is an index of parts (one file of 31k goods was ~4 MB,
// close to the 4.5 MB answer limit and slow for Google to read):
//   /sitemap-pages.xml          home, sections, info pages, cities, articles, forum
//   /sitemap-products-N.xml     goods in stock (own and partner), 5000 per file, by id
// Served via vercel.json rewrites.
import { SITE_URL, rest, restAll, escapeXml, productPath, slugify, sendUnavailable, DbUnavailable, forumPath } from './_shop.js';
import { CITIES, cityPath } from './_cities.js';

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);
const urlTag = (loc, { lastmod, changefreq, priority }) =>
  `  <url>\n    <loc>${escapeXml(loc)}</loc>\n` +
  (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : '') +
  `    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;

const PER_FILE = 5000;
const send = (res, xml) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // the CDN keeps the last good copy for a week: if the database is down, Google still gets it (a 503 is never cached)
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=604800');
  res.status(200).send(xml);
};

export default async function handler(req, res) {
  const part = String(req.query?.part || '');
  try {
    if (!part) {
      // the index: which parts there are
      const ids = await restAll('tyres?select=id&in_stock=not.is.false&hidden_on_site=not.is.true&order=id');
      const files = Math.max(1, Math.ceil(ids.length / PER_FILE));
      const today = new Date().toISOString().slice(0, 10);
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      xml += `  <sitemap><loc>${SITE_URL}/sitemap-pages.xml</loc><lastmod>${today}</lastmod></sitemap>\n`;
      for (let n = 1; n <= files; n++) xml += `  <sitemap><loc>${SITE_URL}/sitemap-products-${n}.xml</loc><lastmod>${today}</lastmod></sitemap>\n`;
      return send(res, xml + '</sitemapindex>\n');
    }
    if (part === 'products') {
      const n = Math.max(1, parseInt(String(req.query?.n || '1'), 10) || 1);
      // the database gives at most 1000 rows at a time
      const products = [];
      for (let from = (n - 1) * PER_FILE; from < n * PER_FILE; from += 1000) {
        const page = await rest('tyres?select=id,title,slug,created_at&in_stock=not.is.false&hidden_on_site=not.is.true&order=id', from, Math.min(from + 999, n * PER_FILE - 1));
        products.push(...page);
        if (page.length < 1000) break;
      }
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      for (const p of products) xml += urlTag(SITE_URL + productPath(p), { lastmod: day(p.created_at), changefreq: 'weekly', priority: '0.7' });
      return send(res, xml + '</urlset>\n');
    }
    let categories = [];
    try { categories = await rest('product_categories?select=slug&is_active=eq.true&noindex=is.false&order=sort_order'); } catch (e) { if (e instanceof DbUnavailable) throw e; /* table missing */ }

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    xml += urlTag(`${SITE_URL}/`, { changefreq: 'daily', priority: '1.0' });
    xml += urlTag(`${SITE_URL}/katalog/akcii`, { changefreq: 'daily', priority: '0.8' });
    for (const c of categories) xml += urlTag(`${SITE_URL}/katalog/${c.slug}`, { changefreq: 'daily', priority: '0.9' });
    for (const p of ['/dostavka-i-oplata', '/garantiya-i-povernennya', '/faq', '/kontakty', '/pro-nas']) xml += urlTag(SITE_URL + p, { changefreq: 'monthly', priority: '0.5' });
    for (const c of CITIES) xml += urlTag(SITE_URL + cityPath(c), { changefreq: 'weekly', priority: c.home ? '0.9' : '0.7' });
    xml += urlTag(`${SITE_URL}/statti`, { changefreq: 'weekly', priority: '0.6' });
    let articles = [];
    try { articles = await rest('articles?select=id,title,created_at&order=id'); } catch (e) { if (e instanceof DbUnavailable) throw e; /* no articles */ }
    for (const a of articles) xml += urlTag(`${SITE_URL}/statti/${a.id}-${slugify(String(a.title).replace(/[^\p{L}\p{N}\s-]/gu, ' '))}`, { lastmod: day(a.created_at), changefreq: 'monthly', priority: '0.6' });
    xml += urlTag(`${SITE_URL}/forum`, { changefreq: 'daily', priority: '0.6' });
    let topics = [];
    try { topics = await rest('forum_topics?select=id,title,last_reply_at&is_hidden=is.false&order=id'); } catch (e) { if (e instanceof DbUnavailable) throw e; /* no forum */ }
    for (const t of topics) xml += urlTag(SITE_URL + forumPath(t), { lastmod: day(t.last_reply_at), changefreq: 'weekly', priority: '0.5' });
    // forum sections and subsections (/forum?c=...)
    let fsec = [];
    try { fsec = await rest('forum_sections?select=slug&order=sort_order'); } catch (e) { if (e instanceof DbUnavailable) throw e; }
    for (const f of fsec) xml += urlTag(`${SITE_URL}/forum?c=${encodeURIComponent(f.slug)}`, { changefreq: 'weekly', priority: '0.4' });
    xml += urlTag(`${SITE_URL}/oferta`, { changefreq: 'yearly', priority: '0.2' });
    xml += urlTag(`${SITE_URL}/privacy`, { changefreq: 'yearly', priority: '0.2' });
    xml += '</urlset>\n';
    send(res, xml);
  } catch (err) {
    console.error('sitemap failed', err);
    // 503 + Retry-After: Google keeps the previous sitemap and comes back later
    return sendUnavailable(res, `Sitemap temporarily unavailable: ${err.message}`);
  }
}
