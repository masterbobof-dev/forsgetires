// Product page /p/<id>-<slug>: serves the normal website, but with the product's own
// <title>, description, canonical link, social preview (og:*) and Product structured
// data already in the HTML — for Google and for link previews in Viber/Telegram/Facebook.
import fs from 'node:fs';
import path from 'node:path';
import { SITE_URL, SHOP_NAME, rest, escapeXml as esc, productPath, parsePrice, stripHtml, SEASON_UA } from './_shop.js';

let cachedHtml = null;
const loadIndexHtml = async (req) => {
  if (cachedHtml) return cachedHtml;
  for (const p of [path.join(process.cwd(), 'dist', 'index.html'), path.join(process.cwd(), 'index.html')]) {
    try {
      const html = fs.readFileSync(p, 'utf8');
      if (html.includes('/assets/')) { cachedHtml = html; return html; }
    } catch { /* try next */ }
  }
  const res = await fetch(`https://${req.headers.host}/index.html`);
  cachedHtml = await res.text();
  return cachedHtml;
};

const setTag = (html, re, tag) => (re.test(html) ? html.replace(re, tag) : html.replace('</head>', `    ${tag}\n  </head>`));

export default async function handler(req, res) {
  const raw = String(req.query.slug || '');
  const id = (raw.match(/^(\d+)/) || [])[1];
  let html = await loadIndexHtml(req);

  let product = null;
  if (id) {
    try {
      const rows = await rest(`tyres?id=eq.${id}&select=id,title,description,seo_title,seo_description,price,old_price,manufacturer,image_url,in_stock,radius,season,slug,catalog_number`);
      product = rows[0] || null;
    } catch { /* show the site anyway */ }
  }

  if (!product) {
    html = setTag(html, /<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex, follow" />');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(404).send(html);
  }

  const url = `${SITE_URL}${productPath(product)}`;
  const price = parsePrice(product.price);
  const title = product.seo_title || `${product.title} — ціна ${price} грн | ${SHOP_NAME}`;
  const season = SEASON_UA[product.season] ? `${SEASON_UA[product.season]} шина. ` : '';
  const description = (product.seo_description || stripHtml(product.description) ||
    `${season}Купити ${product.title} за ${price} грн. Самовивіз у Синельниковому або доставка Новою Поштою по Україні.`).slice(0, 300);
  const image = product.image_url || `${SITE_URL}/favicon.svg`;

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = setTag(html, /<meta name="description"[^>]*>/, `<meta name="description" content="${esc(description)}" />`);
  html = setTag(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(url)}" />`);
  html = setTag(html, /<meta property="og:type"[^>]*>/, '<meta property="og:type" content="product" />');
  html = setTag(html, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(product.title)}" />`);
  html = setTag(html, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(`${price} грн. ${description}`)}" />`);
  html = setTag(html, /<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(image)}" />`);
  html = setTag(html, /<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(url)}" />`);
  html = setTag(html, /<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(product.title)}" />`);
  html = setTag(html, /<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(description)}" />`);
  html = setTag(html, /<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(image)}" />`);

  const ld = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.title,
    image: [image],
    description,
    sku: product.catalog_number || `product-${product.id}`,
    brand: { '@type': 'Brand', name: product.manufacturer || SHOP_NAME },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'UAH',
      price,
      availability: product.in_stock === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: SHOP_NAME },
    },
  };
  try {
    const reviews = await rest(`product_reviews?product_id=eq.${product.id}&approved=eq.true&select=rating`);
    if (reviews.length > 0) {
      const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(avg.toFixed(1)), reviewCount: reviews.length, bestRating: 5, worstRating: 1 };
    }
  } catch { /* no reviews table yet */ }
  html = html.replace('</head>', `    <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n  </head>`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  return res.status(200).send(html);
}
