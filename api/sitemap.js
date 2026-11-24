// Always-fresh sitemap.xml built from Supabase: home, categories, legal pages and
// every product in stock (/p/<id>-<slug>). Served at /sitemap.xml via vercel.json.
import { SITE_URL, rest, restAll, escapeXml, productPath, slugify } from './_shop.js';
import { CITIES, cityPath } from './_cities.js';

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);
const urlTag = (loc, { lastmod, changefreq, priority }) =>
  `  <url>\n    <loc>${escapeXml(loc)}</loc>\n` +
  (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : '') +
  `    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;

export default async function handler(req, res) {
  try {
    let categories = [];
    try { categories = await rest('product_categories?select=slug&is_active=eq.true&order=sort_order'); } catch { /* table missing */ }
    const products = await restAll('tyres?select=id,title,slug,created_at&in_stock=not.is.false&order=id');

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    xml += urlTag(`${SITE_URL}/`, { changefreq: 'daily', priority: '1.0' });
    xml += urlTag(`${SITE_URL}/katalog/akcii`, { changefreq: 'daily', priority: '0.8' });
    for (const c of categories) xml += urlTag(`${SITE_URL}/katalog/${c.slug}`, { changefreq: 'daily', priority: '0.9' });
    for (const p of ['/dostavka-i-oplata', '/garantiya-i-povernennya', '/faq', '/kontakty', '/pro-nas']) xml += urlTag(SITE_URL + p, { changefreq: 'monthly', priority: '0.5' });
    for (const c of CITIES) xml += urlTag(SITE_URL + cityPath(c), { changefreq: 'weekly', priority: c.home ? '0.9' : '0.7' });
    xml += urlTag(`${SITE_URL}/statti`, { changefreq: 'weekly', priority: '0.6' });
    let articles = [];
    try { articles = await rest('articles?select=id,title,created_at&order=id'); } catch { /* no articles */ }
    for (const a of articles) xml += urlTag(`${SITE_URL}/statti/${a.id}-${slugify(String(a.title).replace(/[^\p{L}\p{N}\s-]/gu, ' '))}`, { lastmod: day(a.created_at), changefreq: 'monthly', priority: '0.6' });
    xml += urlTag(`${SITE_URL}/oferta`, { changefreq: 'yearly', priority: '0.2' });
    xml += urlTag(`${SITE_URL}/privacy`, { changefreq: 'yearly', priority: '0.2' });
    for (const p of products) xml += urlTag(SITE_URL + productPath(p), { lastmod: day(p.created_at), changefreq: 'weekly', priority: '0.7' });
    xml += '</urlset>\n';

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(xml);
  } catch (err) {
    res.status(500).setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(`Sitemap error: ${err.message}`);
  }
}
