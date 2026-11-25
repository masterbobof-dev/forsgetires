// After a production deploy: the main pages answer and contain what Google needs.
// Usage: node tests/smoke.mjs https://www.forsage-tires.com
const base = (process.argv[2] || 'https://www.forsage-tires.com').replace(/\/$/, '');
let failed = 0;
const check = async (path, { status = 200, has = [], type } = {}) => {
  try {
    const res = await fetch(base + path, { redirect: 'manual' });
    const body = await res.text();
    const problems = [];
    if (res.status !== status) problems.push(`status ${res.status} (expected ${status})`);
    if (type && !(res.headers.get('content-type') || '').includes(type)) problems.push(`type ${res.headers.get('content-type')}`);
    for (const h of has) if (!body.includes(h)) problems.push(`missing "${h}"`);
    if (problems.length) { failed++; console.log(`✗ ${path}: ${problems.join(', ')}`); } else console.log(`✓ ${path}`);
    return body;
  } catch (e) { failed++; console.log(`✗ ${path}: ${e.message}`); return ''; }
};

await check('/', { has: ['<title>', 'AutoPartsStore', '/katalog/'] });
const sitemap = await check('/sitemap.xml', { type: 'xml', has: ['<urlset', '/p/'] });
const product = (sitemap.match(/<loc>[^<]+(\/p\/[^<]+)<\/loc>/) || [])[1];
if (product) await check(product, { has: ['"@type":"Product"', 'og:image', 'rel="canonical"'] }); else { failed++; console.log('✗ no product in sitemap'); }
const cat = (sitemap.match(/<loc>[^<]+(\/katalog\/(?!akcii)[^<]+)<\/loc>/) || [])[1];
if (cat) await check(cat, { has: ['BreadcrumbList', '<h1>'] });
await check('/feeds/google.xml', { type: 'xml', has: ['<g:price>'] });
await check('/robots.txt', { has: ['Sitemap:'] });
await check('/og.jpg', { type: 'image' });
await check('/storinka-yakoyi-nemaye-12345', { status: 404, has: ['noindex'] });
await check('/admin', { has: ['<div id="root">'] });

console.log(failed ? `\n${failed} problem(s)` : '\nAll good');
process.exit(failed ? 1 : 0);
