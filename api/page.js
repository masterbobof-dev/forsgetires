// Home, category (?c=slug), article and info pages: serves the normal website with the
// page's own <title>, description, canonical link and readable text already in the HTML,
// so Google sees real content without running JavaScript.
import { SITE_URL, SHOP_NAME, rest, escapeXml as esc, productPath, parsePrice, slugify } from './_shop.js';
import { loadAppHtml, setHead, addJsonLd, setRootContent } from './_html.js';

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
    title: 'Часті питання',
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
const navBlock = (cats) => `<nav><ul>${cats.filter((c) => !c.parent_id).map((c) => `<li>${link(`/?c=${c.slug}`, c.name)}</li>`).join('')}<li>${link('/?c=akcii', 'Хіти та акції')}</li></ul><ul>${Object.entries(INFO).map(([h, i]) => `<li>${link(h, i.title)}</li>`).join('')}<li>${link('/statti', 'Корисні статті')}</li></ul></nav>`;

const subtreeIds = (cats, id) => { const out = [id]; for (const c of cats) if (c.parent_id === id) out.push(...subtreeIds(cats, c.id)); return out; };

const PRODUCT_FIELDS = 'id,title,slug,price,image_url';

async function build(pathname, query) {
  let cats = [];
  try { cats = await rest('product_categories?select=id,name,slug,parent_id,kind,description&is_active=eq.true&order=sort_order'); } catch { /* ignore */ }

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

  // --- info pages ---
  if (INFO[pathname]) {
    const i = INFO[pathname];
    return {
      title: `${i.title} — інтернет-магазин ${SHOP_NAME}`, description: i.description, url: SITE_URL + pathname,
      content: `<h1>${esc(i.title)}</h1><p>${esc(i.description)}</p>${i.body.map((b) => `<p>${esc(b)}</p>`).join('')}${navBlock(cats)}`,
    };
  }

  // --- category (?c=slug) ---
  const slug = String(query.c || '');
  if (slug === 'akcii') {
    const items = await rest(`tyres?select=${PRODUCT_FIELDS}&is_hot=eq.true&in_stock=not.is.false&order=created_at.desc&limit=60`);
    return {
      title: `Хіти продажу та акції — шини, диски, акумулятори | ${SHOP_NAME}`,
      description: `Товари зі знижкою та хіти продажу. ${DELIVERY}`,
      url: `${SITE_URL}/?c=akcii`,
      content: `<h1>Хіти та акції</h1>${productList(items)}${navBlock(cats)}`,
    };
  }
  const cat = slug && cats.find((c) => c.slug === slug);
  if (cat) {
    const ids = subtreeIds(cats, cat.id);
    let filter = `category_id.in.(${ids.join(',')})`;
    if (cat.kind === 'tyre' && !cat.parent_id) filter += ',category_id.is.null';
    const items = await rest(`tyres?select=${PRODUCT_FIELDS}&in_stock=not.is.false&or=(${encodeURIComponent(filter)})&order=created_at.desc&limit=60`);
    const parent = cat.parent_id && cats.find((c) => c.id === cat.parent_id);
    const name = parent ? `${parent.name} — ${cat.name}` : cat.name;
    const kids = cats.filter((c) => c.parent_id === cat.id);
    return {
      title: `${name} — купити в ${CITY}, ціни | ${SHOP_NAME}`,
      description: (cat.description || `${name} в інтернет-магазині «${SHOP_NAME}». ${DELIVERY}`).slice(0, 300),
      url: `${SITE_URL}/?c=${cat.slug}`,
      ld: { '@context': 'https://schema.org', '@type': 'ItemList', name, itemListElement: items.slice(0, 30).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE_URL + productPath(p), name: p.title })) },
      content: `<h1>${esc(name)}</h1>${cat.description ? `<p>${esc(cat.description)}</p>` : ''}${kids.length ? `<ul>${kids.map((k) => `<li>${link(`/?c=${k.slug}`, k.name)}</li>`).join('')}</ul>` : ''}${items.length ? productList(items) : '<p>Товари цієї категорії скоро з\'являться в каталозі.</p>'}${navBlock(cats)}`,
    };
  }

  // --- home ---
  const [hot, articles] = await Promise.all([
    rest(`tyres?select=${PRODUCT_FIELDS}&is_hot=eq.true&in_stock=not.is.false&order=created_at.desc&limit=24`).catch(() => []),
    rest('articles?select=id,title&order=created_at.desc&limit=6').catch(() => []),
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
  try {
    const page = await build(pathname, req.query);
    status = page.status || 200;
    if (!page.keepHead) html = setHead(html, page);
    if (page.noindex) html = html.replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex, follow" />');
    if (page.ld) html = addJsonLd(html, page.ld);
    if (page.content) html = setRootContent(html, page.content);
  } catch (e) {
    console.error('page render failed', e);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  return res.status(status).send(html);
}
