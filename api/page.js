// Home, category (?c=slug), article and info pages: serves the normal website with the
// page's own <title>, description, canonical link and readable text already in the HTML,
// so Google sees real content without running JavaScript.
import { SITE_URL, SHOP_NAME, rest, escapeXml as esc, productPath, parsePrice, slugify, sendUnavailable, DbUnavailable } from './_shop.js';
import { loadAppHtml, setHead, addJsonLd, setRootContent, siteSettings, applySite, findRedirect } from './_html.js';
import { CITIES, cityFromPath, cityPath, cityTexts } from './_cities.js';
import { catPath, catSlugFrom } from './_paths.js';

const CITY = 'Синельникове';
const DELIVERY = `Самовивіз у м. ${CITY} (вул. Квітнева, 9) або доставка Новою Поштою по всій Україні.`;

const INFO = {
  '/dostavka-i-oplata': {
    title: 'Доставка і оплата',
    description: `${DELIVERY} Оплата при отриманні, карткою або на рахунок.`,
    body: ['Самовивіз: м. Синельникове, вул. Квітнева, 9 — після дзвінка менеджера з підтвердженням.', 'Нова Пошта: у відділення, поштомат або кур\'єром, зазвичай протягом 1–3 робочих днів після підтвердження. Вартість — за тарифами перевізника.', 'Оплата: готівкою або карткою при самовивозі, накладений платіж Новою Поштою або передоплата на рахунок.'],
  },
  '/garantiya-i-povernennya': {
    title: 'Гарантія і повернення',
    description: 'Гарантія виробника на всі товари. Повернення та обмін протягом 14 днів згідно із законом.',
    body: ['На всі товари діє гарантія виробника.', 'Повернення протягом 14 днів, якщо товар не використовувався і збережено вигляд та упаковку. Змонтовані шини й диски та встановлені акумулятори як товар належної якості не повертаються.'],
  },
  '/pro-nas': {
    title: 'Про магазин',
    description: `Інтернет-магазин «${SHOP_NAME}» у м. ${CITY}: шини, диски, акумулятори та автотовари з доставкою по Україні.`,
    body: [`«${SHOP_NAME}» — інтернет-магазин у місті ${CITY} Дніпропетровської області. Шини для легкових авто, позашляховиків, бусів, вантажівок і сільгосптехніки, диски, акумулятори й автотовари.`, DELIVERY],
  },
  '/kontakty': {
    title: 'Контакти',
    description: `Телефони, Viber, Telegram та адреса магазину «${SHOP_NAME}»: м. ${CITY}, вул. Квітнева, 9.`,
    body: ['Адреса: м. Синельникове, вул. Квітнева, 9.', 'Телефони: 099 167 44 24, 063 582 38 58.'],
  },
  '/faq': {
    title: 'Поширені питання',
    description: 'Відповіді на популярні питання: як оформити замовлення, доставка, оплата, підбір розміру шин, повернення.',
    body: ['Як оформити замовлення? Додайте товар у кошик або натисніть «Купити в 1 клік» — менеджер зателефонує.', 'Як дізнатися розмір шини? Він написаний на боковині, наприклад 205/55 R16 91V.', 'Які способи оплати? Готівка або картка при самовивозі, накладений платіж, передоплата на рахунок.'],
  },
};

const articleSlugPath = (a) => `/statti/${a.id}-${slugify(String(a.title).replace(/[^\p{L}\p{N}\s-]/gu, ' '))}`;
const excerpt = (t, n = 160) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n).replace(/\s\S*$/, '')}…` : s; };
const paragraphs = (t) => String(t || '').replace(/\r/g, '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  .map((p) => (p.length < 80 && !/[.!?:]$/.test(p) && !p.includes('\n') ? `<h2>${esc(p)}</h2>` : `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)).join('\n');
const link = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;
const productList = (items) => `<ul>${items.map((p) => `<li>${link(productPath(p), p.title)} — ${parsePrice(p.price)} грн</li>`).join('')}</ul>`;
const navBlock = (cats) => `<nav><ul>${cats.filter((c) => !c.parent_id).map((c) => `<li>${link(catPath(c.slug), c.name)}</li>`).join('')}<li>${link(catPath('akcii'), 'Хіти та акції')}</li></ul><ul>${Object.entries(INFO).map(([h, i]) => `<li>${link(h, i.title)}</li>`).join('')}<li>${link('/statti', 'Корисні статті')}</li></ul><ul>${CITIES.map((c) => `<li>${link(cityPath(c), `Автозапчастини в ${c.in}`)}</li>`).join('')}</ul></nav>`;

const subtreeIds = (cats, id) => { const out = [id]; for (const c of cats) if (c.parent_id === id) out.push(...subtreeIds(cats, c.id)); return out; };

const PRODUCT_FIELDS = 'id,title,slug,price,image_url';

async function build(pathname, query) {
  let cats = [];
  let allCats = [];
  try { cats = allCats = await rest('product_categories?select=id,name,slug,parent_id,kind,description,seo_title,seo_description,noindex&is_active=eq.true&order=sort_order'); } catch (e) { if (e instanceof DbUnavailable) throw e; /* ignore */ }
  // only categories with goods in stock (same as the site menu), biggest first
  try {
    const counts = await rest('rpc/category_counts');
    const own = new Map(counts.map((r) => [Number(r.category_id), Number(r.n)]));
    const total = (c) => (own.get(c.id) || 0) + cats.filter((k) => k.parent_id === c.id).reduce((s, k) => s + total(k), 0);
    cats = cats.map((c) => ({ ...c, available: total(c) })).filter((c) => c.available > 0).sort((a, b) => b.available - a.available);
  } catch (e) { if (e instanceof DbUnavailable) throw e; /* keep all */ }

  // --- an address that does not exist ---
  if (pathname === '/404') {
    return { status: 404, noindex: true, title: `Сторінку не знайдено | ${SHOP_NAME}`, description: `Каталог інтернет-магазину. ${DELIVERY}`, url: `${SITE_URL}/`,
      content: `<h1>Сторінку не знайдено</h1><p>Такої сторінки немає. Перейдіть до каталогу:</p>${navBlock(cats)}` };
  }

  // --- articles ---
  if (pathname === '/statti' || pathname.startsWith('/statti/')) {
    const id = (pathname.match(/^\/statti\/(\d+)/) || [])[1];
    const list = await rest('articles?select=id,title,content,image_url,created_at&order=created_at.desc');
    if (id) {
      const a = list.find((x) => String(x.id) === id);
      if (!a) return { status: 404, title: `Статтю не знайдено | ${SHOP_NAME}`, noindex: true, content: navBlock(cats) };
      const title = String(a.title).trim();
      const url = SITE_URL + articleSlugPath(a);
      return {
        title: `${title} — ${SHOP_NAME}`, description: excerpt(a.content), url, image: a.image_url, type: 'article',
        ld: { '@context': 'https://schema.org', '@type': 'Article', headline: title, image: a.image_url ? [a.image_url] : undefined, datePublished: a.created_at, author: { '@type': 'Organization', name: SHOP_NAME }, publisher: { '@type': 'Organization', name: SHOP_NAME }, mainEntityOfPage: url },
        content: `<article><h1>${esc(title)}</h1>${paragraphs(a.content)}</article><h2>Читайте також</h2><ul>${list.filter((x) => x.id !== a.id).slice(0, 5).map((x) => `<li>${link(articleSlugPath(x), String(x.title).trim())}</li>`).join('')}</ul>${navBlock(cats)}`,
      };
    }
    return {
      title: `Корисно знати: статті про шини, диски та акумулятори — ${SHOP_NAME}`,
      description: 'Поради про вибір, зберігання та обслуговування шин, дисків і акумуляторів від магазину «Форсаж».',
      url: `${SITE_URL}/statti`,
      content: `<h1>Корисно знати</h1><ul>${list.map((a) => `<li>${link(articleSlugPath(a), String(a.title).trim())} — ${esc(excerpt(a.content, 140))}</li>`).join('')}</ul>${navBlock(cats)}`,
    };
  }

  // --- local pages "Автозапчастини в <місті>" ---
  const city = cityFromPath(pathname);
  if (city) {
    const t = cityTexts(city);
    const hits = await rest(`tyres?select=${PRODUCT_FIELDS}&in_stock=not.is.false&on_order=is.false&has_photo=is.true&order=stock_quantity.desc&limit=24`).catch((e) => { if (e instanceof DbUnavailable) throw e; return []; });
    const subs = cats.filter((c) => c.parent_id).slice(0, 30);
    return {
      title: t.title, description: t.description, url: SITE_URL + cityPath(city),
      ld: { '@context': 'https://schema.org', '@type': 'AutoPartsStore', name: SHOP_NAME, url: SITE_URL + cityPath(city), telephone: '+380991674424',
        address: { '@type': 'PostalAddress', streetAddress: 'вул. Квітнева, 9', addressLocality: 'Синельникове', addressRegion: 'Дніпропетровська область', postalCode: '52500', addressCountry: 'UA' },
        geo: { '@type': 'GeoCoordinates', latitude: 48.317541, longitude: 35.513511 }, areaServed: { '@type': 'City', name: city.name } },
      content: `<h1>${esc(t.h1)}</h1><p>${esc(t.intro)}</p>`
        + `<h2>Що є в наявності</h2><ul>${subs.map((c) => `<li>${link(catPath(c.slug), c.name)}</li>`).join('')}</ul>`
        + (hits.length ? `<h2>Популярні товари</h2>${productList(hits)}` : '')
        + `<h2>Питання та відповіді</h2>${t.faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}`
        + `<h2>Доставляємо також</h2><ul>${CITIES.filter((c) => c.slug !== city.slug).map((c) => `<li>${link(cityPath(c), `Автозапчастини в ${c.in}`)}</li>`).join('')}</ul>`
        + navBlock(cats),
    };
  }

  // --- legal pages (the text itself is shown by the website; here: own title and address for Google) ---
  const LEGAL = {
    '/oferta': ['Публічна оферта', `Умови купівлі товарів в інтернет-магазині «${SHOP_NAME}»: оформлення замовлення, оплата, доставка, повернення.`],
    '/privacy': ['Політика конфіденційності', `Як інтернет-магазин «${SHOP_NAME}» збирає, зберігає та захищає персональні дані покупців.`],
  };
  if (LEGAL[pathname]) {
    const [t, d] = LEGAL[pathname];
    return { title: `${t} — інтернет-магазин ${SHOP_NAME}`, description: d, url: SITE_URL + pathname, content: `<h1>${esc(t)}</h1><p>${esc(d)}</p>${navBlock(cats)}` };
  }

  // --- info pages ---
  if (INFO[pathname]) {
    const i = INFO[pathname];
    // text edited in the shop program (site_pages) replaces the built-in summary
    const slug = { '/dostavka-i-oplata': 'delivery', '/garantiya-i-povernennya': 'warranty', '/pro-nas': 'about', '/kontakty': 'contacts', '/faq': 'faq' }[pathname];
    const custom = (await rest(`site_pages?slug=eq.${slug}&select=title,content`).catch((e) => { if (e instanceof DbUnavailable) throw e; return []; }))[0];
    if (custom) {
      return {
        title: `${custom.title} — інтернет-магазин ${SHOP_NAME}`, description: excerpt(custom.content), url: SITE_URL + pathname,
        content: `<h1>${esc(custom.title)}</h1>${paragraphs(custom.content)}${navBlock(cats)}`,
      };
    }
    // questions and answers for Google's results page
    const qa = pathname === '/faq' ? i.body.map((b) => b.match(/^(.+?\?)\s+(.+)$/)).filter(Boolean) : [];
    return {
      ld: qa.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa.map((m) => ({ '@type': 'Question', name: m[1], acceptedAnswer: { '@type': 'Answer', text: m[2] } })) } : undefined,
      title: `${i.title} — інтернет-магазин ${SHOP_NAME}`, description: i.description, url: SITE_URL + pathname,
      content: `<h1>${esc(i.title)}</h1><p>${esc(i.description)}</p>${i.body.map((b) => `<p>${esc(b)}</p>`).join('')}${navBlock(cats)}`,
    };
  }

  // --- category (/katalog/<slug>, old ?c=slug) ---
  const slug = pathname.startsWith('/katalog/') ? catSlugFrom(pathname) : String(query.c || '');
  if (slug === 'akcii') {
    const items = await rest(`tyres?select=${PRODUCT_FIELDS}&is_hot=eq.true&in_stock=not.is.false&order=created_at.desc&limit=60`);
    return {
      title: `Хіти продажу та акції — шини, диски, акумулятори | ${SHOP_NAME}`,
      description: `Товари зі знижкою та хіти продажу. ${DELIVERY}`,
      url: SITE_URL + catPath('akcii'),
      content: `<h1>Хіти та акції</h1>${productList(items)}${navBlock(cats)}`,
    };
  }
  // sections whose goods are all "on order" (e.g. car tyres) are hidden from the menu but are real pages
  const cat = slug && (cats.find((c) => c.slug === slug) || allCats.find((c) => c.slug === slug));
  if (cat) {
    const ids = subtreeIds(allCats.length ? allCats : cats, cat.id);
    let filter = `category_id.in.(${ids.join(',')})`;
    if (cat.kind === 'tyre' && !cat.parent_id) filter += ',category_id.is.null';
    const items = await rest(`tyres?select=${PRODUCT_FIELDS}&in_stock=not.is.false&or=(${encodeURIComponent(filter)})&order=on_order.asc,created_at.desc&limit=60`);
    const parent = cat.parent_id && (cats.find((c) => c.id === cat.parent_id) || allCats.find((c) => c.id === cat.parent_id));
    const name = parent ? `${parent.name} — ${cat.name}` : cat.name;
    const kids = cats.filter((c) => c.parent_id === cat.id);
    return {
      noindex: !!cat.noindex,
      title: cat.seo_title || `${name} — купити в ${CITY}, ціни | ${SHOP_NAME}`,
      description: (cat.seo_description || cat.description || `${name} в інтернет-магазині «${SHOP_NAME}». ${DELIVERY}`).slice(0, 300),
      url: SITE_URL + catPath(cat.slug),
      crumbs: [...(parent ? [{ name: parent.name, url: SITE_URL + catPath(parent.slug) }] : []), { name: cat.name, url: SITE_URL + catPath(cat.slug) }],
      ld: items.length ? { '@context': 'https://schema.org', '@type': 'ItemList', name, itemListElement: items.slice(0, 30).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE_URL + productPath(p), name: p.title })) } : null,
      content: `<nav>${link('/', 'Головна')}${parent ? ` › ${link(catPath(parent.slug), parent.name)}` : ''} › ${esc(cat.name)}</nav><h1>${esc(name)}</h1>${kids.length ? `<ul>${kids.map((k) => `<li>${link(catPath(k.slug), k.name)}</li>`).join('')}</ul>` : ''}${items.length ? productList(items) : '<p>Товари цієї категорії скоро з\'являться в каталозі.</p>'}${cat.description ? String(cat.description).split(/\n+/).filter(Boolean).map((t) => `<p>${esc(t)}</p>`).join('') : ''}${navBlock(cats)}`,
    };
  }

  // an address of a section that does not exist (or is empty now): show the catalogue, but keep it out of Google
  if (pathname.startsWith('/katalog/') && slug !== 'obrane') {
    return { title: `Розділ не знайдено | ${SHOP_NAME}`, description: `Каталог інтернет-магазину. ${DELIVERY}`, url: `${SITE_URL}/`, noindex: true,
      content: `<h1>Розділ не знайдено</h1><p>Такого розділу немає або в ньому зараз немає товарів. Оберіть інший:</p>${navBlock(cats)}` };
  }

  // --- home ---
  const [hot, articles] = await Promise.all([
    rest(`tyres?select=${PRODUCT_FIELDS}&is_hot=eq.true&in_stock=not.is.false&order=created_at.desc&limit=24`).catch((e) => { if (e instanceof DbUnavailable) throw e; return []; }),
    rest('articles?select=id,title&order=created_at.desc&limit=6').catch((e) => { if (e instanceof DbUnavailable) throw e; return []; }),
  ]);
  return {
    url: `${SITE_URL}/`, keepHead: true,
    content: `<h1>${SHOP_NAME} — інтернет-магазин шин, дисків, акумуляторів та автотоварів</h1>`
      + `<p>Шини для легкових авто, позашляховиків, бусів, вантажівок і сільгосптехніки, диски, акумулятори, масла та автотовари. ${DELIVERY} Оплата при отриманні або передоплата.</p>`
      + navBlock(cats)
      + (hot.length ? `<h2>Хіти та акції</h2>${productList(hot)}` : '')
      + (articles.length ? `<h2>Корисно знати</h2><ul>${articles.map((a) => `<li>${link(articleSlugPath(a), String(a.title).trim())}</li>`).join('')}</ul>` : ''),
  };
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'https://x');
  const pathname = (String(req.query.path ?? url.pathname) || '/').replace(/\/+$/, '') || '/';
  let html = await loadAppHtml(req);
  let status = 200;
  let failed = false;
  try {
    const page = await build(pathname, req.query);
    if (page.status === 404 || page.noindex) {
      const asked = String(req.query.path ?? '') === '/404' ? String(req.query.from || '') : pathname;
      const to = await findRedirect(rest, String(asked).replace(/\/+$/, '') || '/');
      if (to) { res.setHeader('Location', to); res.setHeader('Cache-Control', 'public, s-maxage=300'); return res.status(301).end(); }
    }
    html = applySite(html, await siteSettings(rest));
    status = page.status || 200;
    if (!page.keepHead) html = setHead(html, page);
    if (page.noindex) html = html.replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex, follow" />');
    if (page.ld) html = addJsonLd(html, page.ld);
    if (page.crumbs) {
      html = addJsonLd(html, { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ name: 'Головна', url: `${SITE_URL}/` }, ...page.crumbs].map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })) });
    }
    if (page.content) html = setRootContent(html, page.content);
  } catch (e) {
    console.error('page render failed', e);
    failed = true;
  }
  // database busy: the shop still works in the browser; tell Google "come back later", don't cache
  if (failed) return sendUnavailable(res, html, 'text/html; charset=utf-8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  return res.status(status).send(html);
}
