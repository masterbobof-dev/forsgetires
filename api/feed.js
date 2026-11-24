// Product feeds for marketplaces, always built from the current database:
//   /feeds/google.xml  — Google Merchant Center (Google Покупки)
//   /feeds/prom.xml    — Prom.ua (YML format, also accepted by Rozetka, Epicentr and others)
//   /feeds/hotline.xml — Hotline.ua
import { SITE_URL, SHOP_NAME, restAll, rest, escapeXml as esc, productPath, parsePrice, stripHtml, SEASON_UA } from './_shop.js';

const COMPANY = 'Інтернет-магазин Форсаж (м. Синельникове)';

const GOOGLE_CATEGORY = {
  tyre: 'Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Wheel Systems > Motor Vehicle Tires',
  wheels: 'Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Wheel Systems > Motor Vehicle Rims & Wheels',
  batteries: 'Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Power & Electrical Systems',
  generic: 'Vehicles & Parts > Vehicle Parts & Accessories',
};

const ATTR_LABELS = {
  capacity: ['Ємність', ' Ah'], polarity: ['Полярність', ''], body: ['Корпус', ''], current: ['Пусковий струм', ' A'],
  size: ['Розміри (Д×Ш×В), мм', ''], voltage: ['Напруга', ' V'],
  diameter: ['Діаметр', ''], pcd: ['PCD', ''], width: ['Ширина', ' J'], et: ['Виліт ET', ''], dia: ['DIA', ' мм'], type: ['Тип диска', ''],
};
const ATTR_VALUES = { right: 'Плюс праворуч', left: 'Плюс ліворуч', euro: 'Європа', asia: 'Азія', alloy: 'Литий', steel: 'Сталевий', forged: 'Кований' };

const loadData = async () => {
  let categories = [];
  try { categories = await rest('product_categories?select=id,name,parent_id,kind,filter_preset,is_active'); } catch { /* none */ }
  const products = await restAll(
    'tyres?select=id,title,description,price,old_price,manufacturer,image_url,gallery,in_stock,category_id,vehicle_type,radius,season,catalog_number,attributes,slug,stock_quantity' +
    '&in_stock=not.is.false&image_url=not.is.null&order=id'
  );
  const byId = new Map(categories.map((c) => [c.id, c]));
  const rootOf = (c) => { let cur = c; const seen = new Set(); while (cur?.parent_id && byId.has(cur.parent_id) && !seen.has(cur.id)) { seen.add(cur.id); cur = byId.get(cur.parent_id); } return cur; };
  const tyreRoot = categories.find((c) => c.kind === 'tyre' && !c.parent_id);
  const enrich = products
    .filter((p) => parsePrice(p.price) > 0)
    .map((p) => {
      const cat = byId.get(p.category_id) || tyreRoot || null;
      const root = cat ? rootOf(cat) : null;
      const kind = !cat || cat.kind === 'tyre' ? 'tyre' : (root?.filter_preset || cat.filter_preset || 'generic');
      const params = [];
      if (kind === 'tyre') {
        if (p.radius) params.push(['Радіус', p.radius]);
        const size = (p.title || '').match(/(\d{3})[\/\s](\d{2})/);
        if (size) { params.push(['Ширина', size[1]]); params.push(['Висота профілю', size[2]]); }
        if (SEASON_UA[p.season]) params.push(['Сезон', SEASON_UA[p.season]]);
      }
      for (const [k, v] of Object.entries(p.attributes || {})) {
        if (!ATTR_LABELS[k] || v === null || v === '') continue;
        params.push([ATTR_LABELS[k][0], `${ATTR_VALUES[v] || v}${ATTR_VALUES[v] ? '' : ATTR_LABELS[k][1]}`]);
      }
      const description = stripHtml(p.description) || p.title;
      return { ...p, cat, root, kind, params, description, url: SITE_URL + productPath(p), price: parsePrice(p.price), oldPrice: parsePrice(p.old_price) };
    });
  return { categories: categories.filter((c) => c.is_active !== false), products: enrich };
};

const googleFeed = ({ products }) => {
  let x = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n<channel>\n';
  x += `<title>${esc(SHOP_NAME)}</title>\n<link>${SITE_URL}</link>\n<description>${esc(COMPANY)}</description>\n`;
  for (const p of products) {
    const sale = p.oldPrice > p.price;
    x += '<item>\n';
    x += `  <g:id>${p.id}</g:id>\n  <g:title>${esc(p.title.slice(0, 150))}</g:title>\n`;
    x += `  <g:description>${esc(p.description.slice(0, 4900))}</g:description>\n`;
    x += `  <g:link>${esc(p.url)}</g:link>\n  <g:image_link>${esc(p.image_url)}</g:image_link>\n`;
    for (const extra of (p.gallery || []).filter((g) => g && g !== p.image_url).slice(0, 10)) x += `  <g:additional_image_link>${esc(extra)}</g:additional_image_link>\n`;
    x += `  <g:availability>in_stock</g:availability>\n  <g:condition>new</g:condition>\n`;
    x += `  <g:price>${sale ? p.oldPrice : p.price}.00 UAH</g:price>\n`;
    if (sale) x += `  <g:sale_price>${p.price}.00 UAH</g:sale_price>\n`;
    if (p.manufacturer) x += `  <g:brand>${esc(p.manufacturer)}</g:brand>\n`; else x += '  <g:identifier_exists>no</g:identifier_exists>\n';
    if (p.catalog_number) x += `  <g:mpn>${esc(p.catalog_number)}</g:mpn>\n`;
    x += `  <g:google_product_category>${esc(GOOGLE_CATEGORY[p.kind] || GOOGLE_CATEGORY.generic)}</g:google_product_category>\n`;
    if (p.cat) x += `  <g:product_type>${esc([p.root?.name, p.cat.name].filter((v, i, a) => v && a.indexOf(v) === i).join(' > '))}</g:product_type>\n`;
    x += '</item>\n';
  }
  return x + '</channel>\n</rss>\n';
};

const promFeed = ({ categories, products }) => {
  const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
  let x = `<?xml version="1.0" encoding="UTF-8"?>\n<yml_catalog date="${date}">\n<shop>\n`;
  x += `<name>${esc(SHOP_NAME)}</name>\n<company>${esc(COMPANY)}</company>\n<url>${SITE_URL}</url>\n`;
  x += '<currencies><currency id="UAH" rate="1"/></currencies>\n<categories>\n';
  for (const c of categories) x += `  <category id="${c.id}"${c.parent_id ? ` parentId="${c.parent_id}"` : ''}>${esc(c.name)}</category>\n`;
  x += '</categories>\n<offers>\n';
  for (const p of products) {
    x += `<offer id="${p.id}" available="true">\n`;
    x += `  <url>${esc(p.url)}</url>\n  <price>${p.price}</price>\n`;
    if (p.oldPrice > p.price) x += `  <oldprice>${p.oldPrice}</oldprice>\n`;
    x += `  <currencyId>UAH</currencyId>\n`;
    if (p.cat) x += `  <categoryId>${p.cat.id}</categoryId>\n`;
    x += `  <picture>${esc(p.image_url)}</picture>\n`;
    for (const extra of (p.gallery || []).filter((g) => g && g !== p.image_url).slice(0, 9)) x += `  <picture>${esc(extra)}</picture>\n`;
    if (p.manufacturer) x += `  <vendor>${esc(p.manufacturer)}</vendor>\n`;
    if (p.catalog_number) x += `  <vendorCode>${esc(p.catalog_number)}</vendorCode>\n`;
    if (Number.isFinite(p.stock_quantity) && p.stock_quantity > 0) x += `  <quantity_in_stock>${p.stock_quantity}</quantity_in_stock>\n`;
    x += `  <name>${esc(p.title)}</name>\n  <description><![CDATA[${p.description.replace(/]]>/g, ']]&gt;')}]]></description>\n`;
    for (const [n, v] of p.params) x += `  <param name="${esc(n)}">${esc(v)}</param>\n`;
    x += '</offer>\n';
  }
  return x + '</offers>\n</shop>\n</yml_catalog>\n';
};

const hotlineFeed = ({ categories, products }) => {
  const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
  let x = `<?xml version="1.0" encoding="UTF-8"?>\n<price>\n<date>${date}</date>\n<firm>${esc(SHOP_NAME)}</firm>\n<rate></rate>\n<categories>\n`;
  for (const c of categories) x += `  <category><id>${c.id}</id>${c.parent_id ? `<parentId>${c.parent_id}</parentId>` : ''}<name>${esc(c.name)}</name></category>\n`;
  x += '</categories>\n<items>\n';
  for (const p of products) {
    x += '<item>\n';
    x += `  <id>${p.id}</id>\n`;
    if (p.cat) x += `  <categoryId>${p.cat.id}</categoryId>\n`;
    if (p.catalog_number) x += `  <code>${esc(p.catalog_number)}</code>\n`;
    if (p.manufacturer) x += `  <vendor>${esc(p.manufacturer)}</vendor>\n`;
    x += `  <name>${esc(p.title)}</name>\n  <description>${esc(p.description.slice(0, 1000))}</description>\n`;
    x += `  <url>${esc(p.url)}</url>\n  <image>${esc(p.image_url)}</image>\n`;
    x += `  <priceRUAH>${p.price}</priceRUAH>\n`;
    if (p.oldPrice > p.price) x += `  <oldprice>${p.oldPrice}</oldprice>\n`;
    x += '  <stock>В наявності</stock>\n  <condition>0</condition>\n';
    for (const [n, v] of p.params) x += `  <param name="${esc(n)}">${esc(v)}</param>\n`;
    x += '</item>\n';
  }
  return x + '</items>\n</price>\n';
};

export default async function handler(req, res) {
  const type = String(req.query.type || 'google');
  const build = { google: googleFeed, prom: promFeed, hotline: hotlineFeed }[type];
  if (!build) return res.status(404).send('Unknown feed');
  try {
    const xml = build(await loadData());
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(xml);
  } catch (err) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(500).send(`Feed error: ${err.message}`);
  }
}
