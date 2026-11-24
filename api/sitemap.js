// Vercel serverless function: always-fresh sitemap.xml built from Supabase
// (home page, every active category and every product in stock).
// Served at /sitemap.xml via the rewrite in vercel.json.

const SITE_URL = 'https://www.forsage-tires.com';
const SUPABASE_URL = 'https://zzxueclhkhvwdmxflmyx.supabase.co';
// Public "anon" key (same one the website uses in the browser); read-only by database rules.
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6eHVlY2xoa2h2d2RteGZsbXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjEzMTAsImV4cCI6MjA4MDIzNzMxMH0.yJW-HC03EwyYPpyWTrDbTN4t0YrlNe1H40fwLZ_ZxfU';
const PAGE = 1000;

const rest = async (path, from, to) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(from !== undefined ? { Range: `${from}-${to}`, 'Range-Unit': 'items' } : {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
};

const escapeXml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);

const urlTag = (loc, { lastmod, changefreq, priority }) =>
  `  <url>\n    <loc>${escapeXml(loc)}</loc>\n` +
  (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : '') +
  `    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;

export default async function handler(req, res) {
  try {
    let categories = [];
    try {
      categories = await rest('product_categories?select=slug,created_at&is_active=eq.true&order=sort_order');
    } catch { /* categories table missing — skip */ }

    const products = [];
    for (let from = 0; ; from += PAGE) {
      const page = await rest('tyres?select=id,created_at&in_stock=not.is.false&order=id', from, from + PAGE - 1);
      products.push(...page);
      if (page.length < PAGE) break;
    }

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    xml += urlTag(`${SITE_URL}/`, { changefreq: 'daily', priority: '1.0' });
    xml += urlTag(`${SITE_URL}/?c=akcii`, { changefreq: 'daily', priority: '0.8' });
    for (const c of categories) xml += urlTag(`${SITE_URL}/?c=${c.slug}`, { changefreq: 'daily', priority: '0.9' });
    for (const p of products) xml += urlTag(`${SITE_URL}/?p=${p.id}`, { lastmod: day(p.created_at), changefreq: 'weekly', priority: '0.7' });
    xml += '</urlset>\n';

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    // Cache at Vercel's edge for 1 hour, serve stale up to a day while refreshing
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(xml);
  } catch (err) {
    res.status(500).setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(`Sitemap error: ${err.message}`);
  }
}
