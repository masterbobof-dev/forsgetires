// Product page /p/<id>-<slug>: serves the normal website, but with the product's own
// <title>, description, canonical link, social preview (og:*) and Product structured
// data already in the HTML — for Google and for link previews in Viber/Telegram/Facebook.
import { SITE_URL, SHOP_NAME, rest, escapeXml as esc, productPath, parsePrice, stripHtml, SEASON_UA, sendUnavailable, DbUnavailable } from './_shop.js';
import { loadAppHtml, setTag, setRootContent, siteSettings, applySite, fillTemplate, findRedirect } from './_html.js';

async function render(req, res) {
  const raw = String(req.query.slug || '');
  const id = (raw.match(/^(\d+)/) || [])[1];
  let html = await loadAppHtml(req);

  let product = null;
  if (id) {
    try {
      const rows = await rest(`tyres?id=eq.${id}&select=id,title,description,seo_title,seo_description,price,old_price,manufacturer,category_id,image_url,in_stock,radius,season,slug,catalog_number,on_order,stock_quantity,program_product_id`);
      product = rows[0] || null;
    } catch (e) {
      if (e instanceof DbUnavailable) throw e; // busy database is not "not found": answered with 503 below
      /* other errors: show the site anyway */
    }
  }

  const site = await siteSettings(rest);
  html = applySite(html, site);
  if (!product) {
    const to = await findRedirect(rest, `/p/${raw}`) || (id ? await findRedirect(rest, `/p/${id}`) : null);
    if (to) { res.setHeader('Location', to); res.setHeader('Cache-Control', 'public, s-maxage=300'); return res.status(301).end(); }
    html = setTag(html, /<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex, follow" />');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(404).send(html);
  }

  const url = `${SITE_URL}${productPath(product)}`;
  const price = parsePrice(product.price);
  const onOrder = !!product.on_order;
  // admin templates (SEO tab): own section's template first, then the general one
  let cats = [];
  try { cats = await rest('product_categories?select=id,parent_id,name,noindex'); } catch (e) { if (e instanceof DbUnavailable) throw e; /* none */ }
  const chain = []; for (let c = cats.find((k) => k.id === product.category_id); c && chain.length < 5; c = cats.find((k) => k.id === c.parent_id)) chain.push(c);
  const tpl = (kind) => [...chain.map((c) => site[`seo_tpl_${kind}_${c.id}`]), site[`seo_tpl_${kind}`]].find((t) => t && t.trim());
  const vars = { 'назва': product.title, 'бренд': product.manufacturer || '', 'ціна': onOrder ? '' : String(price), 'артикул': product.catalog_number || '', 'категорія': chain[0]?.name || '', 'розділ': chain[chain.length - 1]?.name || '', 'місто': 'Синельникове', 'магазин': SHOP_NAME };
  const tplTitle = tpl('title') && fillTemplate(tpl('title'), vars);
  const tplDesc = tpl('desc') && fillTemplate(tpl('desc'), vars);
  const title = product.seo_title || tplTitle || (onOrder ? `${product.title} — під замовлення | ${SHOP_NAME}` : `${product.title} — ціна ${price} грн | ${SHOP_NAME}`);
  const season = SEASON_UA[product.season] ? `${SEASON_UA[product.season]} шина. ` : '';
  const description = (product.seo_description || tplDesc || stripHtml(product.description) ||
    (onOrder ? `${product.title} — під замовлення, ціну і термін постачання уточнюйте у менеджера. ` : `${season}Купити ${product.title} за ${price} грн. `) + `Самовивіз у Синельниковому або доставка Новою Поштою по Україні.`).slice(0, 300);
  const image = product.image_url || `${SITE_URL}/og.jpg`;

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = setTag(html, /<meta name="description"[^>]*>/, `<meta name="description" content="${esc(description)}" />`);
  html = setTag(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(url)}" />`);
  html = setTag(html, /<meta property="og:type"[^>]*>/, '<meta property="og:type" content="product" />');
  html = setTag(html, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(product.title)}" />`);
  html = setTag(html, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(onOrder ? description : `${price} грн. ${description}`)}" />`);
  html = setTag(html, /<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(image)}" />`);
  html = setTag(html, /<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(url)}" />`);
  html = setTag(html, /<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(product.title)}" />`);
  html = setTag(html, /<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(description)}" />`);
  html = setTag(html, /<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(image)}" />`);

  if (chain.some((c) => c.noindex)) html = setTag(html, /<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex, follow" />');

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
  } catch (e) { if (e instanceof DbUnavailable) throw e; /* no reviews table yet */ }
  if (onOrder) delete ld.offers; // price is confirmed by the manager
  html = html.replace('</head>', `    <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n  </head>`);
  html = setRootContent(html, `<h1>${esc(product.title)}</h1><p>${onOrder ? 'Під замовлення — ціну і термін уточнюйте у менеджера' : `Ціна: ${price} грн${product.in_stock === false ? ' (немає в наявності)' : ''}`}</p><p>${esc(description)}</p><p><a href="/">Каталог товарів</a></p>`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  return res.status(200).send(html);
}

export default async function handler(req, res) {
  try {
    return await render(req, res);
  } catch (e) {
    if (!(e instanceof DbUnavailable)) throw e;
    // database busy: the shop still works in the browser; tell Google "come back later"
    console.error('product page: database unavailable', e);
    return sendUnavailable(res, await loadAppHtml(req), 'text/html; charset=utf-8');
  }
}
