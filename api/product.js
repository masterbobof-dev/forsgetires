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
      const rows = await rest(`tyres?id=eq.${id}&select=id,title,description,seo_title,seo_description,price,old_price,manufacturer,category_id,image_url,gallery,in_stock,radius,season,slug,catalog_number,on_order,stock_quantity,program_product_id,supplier_offer_id,lead_days`);
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
  // partner offers are on order but with a real retail price and delivery days
  const partner = !!product.on_order && !!product.supplier_offer_id;
  const onOrder = !!product.on_order && !partner;
  const leadText = partner ? `доставка ${product.lead_days ? `${product.lead_days} дн.` : 'кілька днів'}` : '';
  // admin templates (SEO tab): own section's template first, then the general one
  let cats = [];
  try { cats = await rest('product_categories?select=id,parent_id,name,noindex'); } catch (e) { if (e instanceof DbUnavailable) throw e; /* none */ }
  const chain = []; for (let c = cats.find((k) => k.id === product.category_id); c && chain.length < 5; c = cats.find((k) => k.id === c.parent_id)) chain.push(c);
  const tpl = (kind) => [...chain.map((c) => site[`seo_tpl_${kind}_${c.id}`]), site[`seo_tpl_${kind}`]].find((t) => t && t.trim());
  const vars = { 'назва': product.title, 'бренд': product.manufacturer || '', 'ціна': onOrder ? '' : String(price), 'артикул': product.catalog_number || '', 'категорія': chain[0]?.name || '', 'розділ': chain[chain.length - 1]?.name || '', 'місто': 'Синельникове', 'магазин': SHOP_NAME };
  const tplTitle = tpl('title') && fillTemplate(tpl('title'), vars);
  const tplDesc = tpl('desc') && fillTemplate(tpl('desc'), vars);
  const title = product.seo_title || tplTitle || (onOrder ? `${product.title} — під замовлення | ${SHOP_NAME}` : `${product.title} — ціна ${price} грн${partner ? ', під замовлення' : ''} | ${SHOP_NAME}`);
  const season = SEASON_UA[product.season] ? `${SEASON_UA[product.season]} шина. ` : '';
  const description = (product.seo_description || tplDesc || stripHtml(product.description) ||
    (onOrder ? `${product.title} — під замовлення, ціну і термін постачання уточнюйте у менеджера. ` : `${season}Купити ${product.title} за ${price} грн${partner ? ` (під замовлення, ${leadText})` : ''}. `) + `Самовивіз у Синельниковому або доставка Новою Поштою по Україні.`).slice(0, 300);
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
    // all photos of the product (Google may show any of them)
    image: [image, ...(Array.isArray(product.gallery) ? product.gallery : [])].filter((u, i, a) => u && a.indexOf(u) === i).slice(0, 10),
    description,
    sku: product.catalog_number || `product-${product.id}`,
    ...(product.catalog_number ? { mpn: product.catalog_number } : {}),
    // the real maker only; the shop's own name here would be a wrong brand
    ...(product.manufacturer ? { brand: { '@type': 'Brand', name: product.manufacturer } } : {}),
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'UAH',
      price,
      availability: product.in_stock === false ? 'https://schema.org/OutOfStock' : partner ? 'https://schema.org/BackOrder' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: SHOP_NAME },
      // the same terms as on the "Гарантія і повернення" page: return within 14 days
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'UA',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 14,
      },
    },
  };
  try {
    const reviews = await rest(`product_reviews?product_id=eq.${product.id}&approved=eq.true&select=rating`);
    if (reviews.length > 0) {
      const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(avg.toFixed(1)), reviewCount: reviews.length, bestRating: 5, worstRating: 1 };
    }
  } catch (e) { if (e instanceof DbUnavailable) throw e; /* no reviews table yet */ }
  if (onOrder || !(price > 0)) delete ld.offers; // price is confirmed by the manager / no price: Google rejects a 0 price
  html = html.replace('</head>', `    <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n  </head>`);
  // links for Google (and people without JavaScript): the same tyre size from other brands, then the same section
  let related = [];
  try {
    const size = (product.title || '').match(/(\d{3})[\/\s](\d{2})\D{0,3}R?\s?(\d{2}(?:[.,]5)?C?)/i);
    if (size) {
      const like = encodeURIComponent(`*${size[1]}/${size[2]}*`);
      related = await rest(`tyres?select=id,title,slug,price,manufacturer,on_order&title=ilike.${like}&id=neq.${product.id}&in_stock=not.is.false&order=on_order.asc,stock_quantity.desc&limit=12`);
      if (product.radius) related = related.filter((p) => !p.title.match(/R\s?\d{2}/i) || p.title.replace(/\s/g, '').toUpperCase().includes(String(product.radius).replace(/\s/g, '').toUpperCase()));
    }
    if (related.length < 4 && product.category_id) {
      const more = await rest(`tyres?select=id,title,slug,price,manufacturer,on_order&category_id=eq.${product.category_id}&id=neq.${product.id}&in_stock=not.is.false&order=on_order.asc,stock_quantity.desc&limit=8`);
      related = [...related, ...more.filter((m) => !related.some((r) => r.id === m.id))];
    }
  } catch (e) { if (e instanceof DbUnavailable) throw e; /* no links */ }
  const relatedHtml = related.length
    ? `<h2>Схожі товари</h2><ul>${related.slice(0, 10).map((p) => `<li><a href="${esc(productPath(p))}">${esc(p.title)}</a>${p.on_order ? ' — під замовлення' : ` — ${parsePrice(p.price)} грн`}</li>`).join('')}</ul>`
    : '';
  const crumbs = [...chain].reverse().map((c) => esc(c.name)).join(' › ');
  html = setRootContent(html, `${crumbs ? `<nav>${crumbs}</nav>` : ''}<h1>${esc(product.title)}</h1><p>${onOrder ? 'Під замовлення — ціну і термін уточнюйте у менеджера' : `Ціна: ${price} грн${product.in_stock === false ? ' (немає в наявності)' : partner ? ` — під замовлення, ${leadText}` : ''}`}</p><p>${esc(description)}</p>${relatedHtml}<p><a href="/">Каталог товарів</a></p>`);

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
