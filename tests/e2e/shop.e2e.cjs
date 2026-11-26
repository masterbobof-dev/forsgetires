/**
 * Browser test of what a customer does in the shop: sections, filters, search, product page,
 * cart and checkout, "buy in 1 click", favourites, compare, direct links, phone layout.
 * The database is replaced by an in-memory fake (fakeSupabase.cjs + fixtures.cjs), so nothing real is touched.
 *
 * Run:  npm run build && npm run e2e
 */
const assert = require('node:assert/strict');
const { openShop, step, fixtures, actions, until, runScenarios } = require('./harness.cjs');

const cards = (page) => page.locator('article');
const titles = (page) => page.locator('article h3').allTextContents().then((t) => t.map((s) => s.trim()));
const expectCards = (page, n) => until(async () => assert.equal(await cards(page).count(), n, `product cards on the page`));
const expectPath = (page, path) => until(async () => assert.equal(new URL(page.url()).pathname, path));
const chip = (page, id) => page.locator(`button[data-chip="${id}"]:visible`);
const stored = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), key);
const modalTitle = (page, text) => page.getByRole('heading', { level: 1, name: text });
/** open a product: click its name (on computers the middle of a card is covered by the "quick order" overlay) */
const openCard = (ui, page, n = 0) => ui.click(cards(page).nth(n).locator('h3'));
const productWindow = (page) => page.locator('div.fixed.z-\\[170\\]');

const VARTA = 'Акумулятор VARTA Blue Dynamic 60Ah 540A R+';
const WESTA = 'Акумулятор Westa 100Ah 850A R+';

// ---------------------------------------------------------------------------------------------
const catalogue = async (browser, url) => {
  const shop = await openShop(browser, url);
  const { page } = shop;
  const ui = actions(shop);
  const S = 'catalogue';

  await step(shop, S, 'home', async () => {
    await ui.goto(`${url}/`);
    await expectCards(page, 60);
    assert.match(await page.locator('p', { hasText: 'Знайдено:' }).textContent(), /86/);
    await until(async () => assert.equal(await page.title(), 'Форсаж — інтернет-магазин шин, дисків та автотоварів | Синельникове'));
    await until(async () => assert.ok(await page.getByRole('heading', { name: 'Хіти та акції' }).isVisible(), 'home shows the hits block'));
    assert.deepEqual(await page.locator('button[data-chip]:visible').evaluateAll((els) => els.map((e) => e.getAttribute('data-chip'))), ['all', '1', '2', '3', '5', 'hot']);
  });

  await step(shop, S, 'section tyres', async () => {
    await ui.click(chip(page, 1));
    await expectPath(page, '/katalog/shyny');
    await expectCards(page, 13);
    assert.equal((await page.locator('h1').first().textContent()).trim(), 'Шини');
    await until(async () => assert.equal(await page.title(), 'Автомобільні шини — купити у Синельниковому | Форсаж'));
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://www.forsage-tires.com/katalog/shyny');
    assert.ok(!(await titles(page)).includes('Barum Polaris 5 185/65 R15 88T'), 'sold-out goods from the program are hidden');
  });

  await step(shop, S, 'size guide', async () => {
    await ui.click(page.locator('aside').getByRole('button', { name: 'Як дізнатися свій розмір?' }));
    await until(async () => assert.ok(await page.getByRole('heading', { name: 'Як прочитати розмір шини' }).isVisible()));
    await ui.click(page.locator('div.fixed.z-\\[185\\]').getByRole('button', { name: 'Закрити' }));
    await until(async () => assert.equal(await page.getByRole('heading', { name: 'Як прочитати розмір шини' }).count(), 0));
  });

  await step(shop, S, 'sub-section car tyres', async () => {
    await ui.click(chip(page, 6));
    await expectPath(page, '/katalog/shyny-legkovi');
    await expectCards(page, 8);
    assert.ok((await titles(page)).includes('Belshina Artmotion 195/65 R15 91H'), 'old tyres without a section are shown by vehicle type');
    assert.equal((await titles(page)).at(-1), 'Nokian Hakkapeliitta R3 205/55 R16 94R', '"on order" goods go last');
  });

  await step(shop, S, 'size picker', async () => {
    await ui.select(page.locator('select[aria-label="Ширина"]'), '205');
    await expectCards(page, 3);
    await ui.select(page.locator('select[aria-label="Висота"]'), '55');
    await ui.select(page.locator('select[aria-label="Радіус"]'), 'R16');
    await expectCards(page, 3);
  });

  await step(shop, S, 'season filter', async () => {
    await ui.click(page.getByRole('button', { name: '❄ Зимові' }));
    await expectCards(page, 2);
    assert.deepEqual(await titles(page), ['Laufenn i FIT Ice LW71 205/55 R16 94T', 'Nokian Hakkapeliitta R3 205/55 R16 94R']);
  });

  await step(shop, S, 'reset filters', async () => {
    await ui.click(page.getByRole('button', { name: /Скинути фільтри \(4\)/ }));
    await expectCards(page, 8);
  });

  await step(shop, S, 'brand filter', async () => {
    await ui.select(page.locator('aside select').filter({ has: page.locator('option', { hasText: 'Усі бренди' }) }), 'Hankook');
    await expectCards(page, 2);
    await ui.click(page.getByRole('button', { name: /Скинути фільтри \(1\)/ }));
    await expectCards(page, 8);
  });

  await step(shop, S, 'sort cheapest first', async () => {
    await ui.select(page.locator('select[aria-label="Сортування"]'), 'price_asc');
    await until(async () => assert.equal((await titles(page))[0], 'Rosava Itegro 175/70 R13 82H'));
    await ui.select(page.locator('select[aria-label="Сортування"]'), 'recommended');
    await until(async () => assert.equal((await titles(page))[0], 'Hankook Kinergy Eco2 K435 205/55 R16 91H'));
  });

  await step(shop, S, 'search with a brand typed in Cyrillic', async () => {
    await ui.fill(page.locator('input[type="search"]'), 'ханкук');
    await expectCards(page, 2);
    await until(async () => assert.ok(await page.locator('button', { hasText: 'Hankook Dynapro HP2' }).isVisible(), 'search hints show goods from other sections too'));
    await ui.press(page.locator('input[type="search"]'), 'Enter');
  });

  await step(shop, S, 'search finds nothing', async () => {
    await ui.fill(page.locator('input[type="search"]'), 'неіснуючийтовар');
    await until(async () => assert.ok(await page.getByText('Нічого не знайдено').isVisible()));
    await page.locator('input[type="search"]').blur();
  });

  await step(shop, S, 'search in all sections, then reset', async () => {
    await ui.click(page.getByRole('button', { name: 'Шукати в усіх розділах' }));
    await expectPath(page, '/');
    await until(async () => assert.equal(await page.locator('input[type="search"]').inputValue(), 'неіснуючийтовар'));
    await until(async () => assert.ok(await page.getByText('Нічого не знайдено').isVisible()));
    await ui.click(page.getByRole('button', { name: 'Скинути фільтри' }));
    await expectCards(page, 60);
  });

  await step(shop, S, 'batteries with a promo', async () => {
    await ui.click(chip(page, 3));
    await expectPath(page, '/katalog/akumulyatory');
    await expectCards(page, 4);
    const first = cards(page).first();
    assert.equal((await first.locator('h3').textContent()).trim(), VARTA);
    assert.match(await first.textContent(), /3501/, 'promo −10% is applied to the price');
    assert.match(await first.textContent(), /60 Ah/);
    await until(async () => assert.equal(await page.locator('meta[name="description"]').getAttribute('content'), 'Акумулятори для авто в наявності.'));
  });

  await step(shop, S, 'characteristic filter', async () => {
    await ui.select(page.locator('select[aria-label="Ємність"]'), '60');
    await expectCards(page, 1);
    await ui.select(page.locator('select[aria-label="Ємність"]'), '');
    await expectCards(page, 4);
    await ui.click(page.locator('aside').getByRole('button', { name: /Плюс ліворуч/ }));
    await expectCards(page, 1);
    await ui.click(page.locator('aside').getByRole('button', { name: /Плюс ліворуч/ }));
    await expectCards(page, 4);
  });

  await step(shop, S, 'more than one page', async () => {
    await ui.click(chip(page, 5));
    await expectPath(page, '/katalog/avtotovary');
    await expectCards(page, 60);
    assert.match(await page.getByText(/Показано 60 з 68/).textContent(), /68/);
    await ui.click(page.getByRole('button', { name: 'Показати ще' }));
    await expectCards(page, 68);
    assert.equal(await page.getByRole('button', { name: 'Показати ще' }).count(), 0);
  });

  await step(shop, S, 'sub-section with its own filters', async () => {
    await ui.click(chip(page, 115));
    await expectPath(page, '/katalog/klemy');
    await expectCards(page, 3);
    await ui.select(page.locator('select[aria-label="Полюс"]'), 'plus');
    await expectCards(page, 1);
  });

  await step(shop, S, 'hits', async () => {
    await ui.click(chip(page, 'hot'));
    await expectPath(page, '/katalog/akcii');
    await expectCards(page, 5);
    await until(async () => assert.equal(await page.title(), 'Акції та знижки — інтернет-магазин Форсаж'));
  });

  await step(shop, S, 'catalogue menu in the header', async () => {
    await ui.click(page.getByRole('banner').getByRole('button', { name: 'Каталог' }));
    await ui.click(page.locator('a[href="/katalog/dysky"]:visible').first());
    await expectPath(page, '/katalog/dysky');
    await expectCards(page, 2);
    assert.equal((await page.locator('h1').first().textContent()).trim(), 'Диски');
  });

  await step(shop, S, 'breadcrumb home', async () => {
    await ui.click(page.getByRole('navigation', { name: 'Навігація' }).getByRole('button', { name: 'Головна' }));
    await expectPath(page, '/');
    await expectCards(page, 60);
  });

  await step(shop, S, 'open a hit from the home page', async () => {
    const hits = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Хіти та акції' }) });
    await ui.click(hits.locator('button', { hasText: 'Laufenn i FIT Ice LW71' }));
    await until(async () => assert.ok(await modalTitle(page, 'Laufenn i FIT Ice LW71 205/55 R16 94T').isVisible()));
    await expectPath(page, '/p/1002-laufenn-i-fit-ice-lw71-205-55-r16-94t');
    await page.goBack();
    await expectPath(page, '/');
    await until(async () => assert.equal(await modalTitle(page, 'Laufenn i FIT Ice LW71 205/55 R16 94T').count(), 0));
  });

  await step(shop, S, 'recently viewed block', async () => {
    const recent = page.locator('div.max-w-7xl').filter({ has: page.getByRole('heading', { name: /Ви нещодавно переглядали/ }) }).last();
    await ui.click(recent.locator('h4', { hasText: 'Laufenn i FIT Ice LW71' }));
    await until(async () => assert.ok(await modalTitle(page, 'Laufenn i FIT Ice LW71 205/55 R16 94T').isVisible()));
    await ui.click(productWindow(page).getByRole('button', { name: 'Закрити', exact: true }).first());
    await until(async () => assert.equal(await modalTitle(page, 'Laufenn i FIT Ice LW71 205/55 R16 94T').count(), 0));
    await expectPath(page, '/');
  });

  await step(shop, S, 'agro banner product goes first in its section', async () => {
    await ui.click(page.getByText('Шина 12,4-32 8PR SGP-04 (Kabat)').first());
    await expectPath(page, '/katalog/shyny-agro');
    await expectCards(page, 3);
    await until(async () => assert.equal((await titles(page))[0], 'Шина 12,4-32 8PR SGP-04 (Kabat)'));
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const purchase = async (browser, url) => {
  const shop = await openShop(browser, url);
  const { page, fake } = shop;
  const ui = actions(shop);
  const S = 'purchase';
  const drawer = page.locator('div.max-w-md').filter({ has: page.getByRole('heading', { name: 'Кошик' }) });

  await step(shop, S, 'open a product', async () => {
    await ui.goto(`${url}/katalog/akumulyatory`);
    await expectCards(page, 4);
    await openCard(ui, page);
    await expectPath(page, '/p/2001-akumulyator-varta-blue-dynamic-60ah-540a-r');
    await until(async () => assert.ok(await modalTitle(page, VARTA).isVisible()));
    await until(async () => assert.equal(await page.title(), `${VARTA} — купити в Україні | Forsage`));
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://www.forsage-tires.com/p/2001-akumulyator-varta-blue-dynamic-60ah-540a-r');
    const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').last().textContent());
    assert.equal(schema['@type'], 'Product'); assert.equal(schema.offers.price, 3501);
    await until(async () => assert.ok(await page.getByRole('heading', { name: 'З цим купують' }).isVisible()));
    assert.ok(await page.getByText('Характеристики', { exact: true }).isVisible());
    assert.deepEqual((await stored(page, 'recent_tyres')).map((p) => p.id), [2001]);
  });

  await step(shop, S, 'browser Back closes the product', async () => {
    await page.goBack();
    await expectPath(page, '/katalog/akumulyatory');
    await until(async () => assert.equal(await modalTitle(page, VARTA).count(), 0));
    await until(async () => assert.match(await page.title(), /^Акумулятори — купити/));
    await until(async () => assert.ok(await page.getByRole('heading', { name: /Ви нещодавно переглядали/ }).isVisible(), 'the viewed product appears in "recently viewed"'));
  });

  await step(shop, S, 'browser Forward opens it again', async () => {
    await page.goForward();
    await expectPath(page, '/p/2001-akumulyator-varta-blue-dynamic-60ah-540a-r');
    await until(async () => assert.ok(await modalTitle(page, VARTA).isVisible()));
    await page.goBack();
    await expectPath(page, '/katalog/akumulyatory');
    await until(async () => assert.equal(await modalTitle(page, VARTA).count(), 0));
  });

  await step(shop, S, 'add to the cart from the product window', async () => {
    await openCard(ui, page);
    await until(async () => assert.ok(await modalTitle(page, VARTA).isVisible()));
    await ui.click(productWindow(page).getByRole('button', { name: 'Додати у кошик' }));
    await until(async () => assert.equal(await modalTitle(page, VARTA).count(), 0));
    await until(async () => assert.ok(await page.getByText('У кошику', { exact: true }).isVisible(), 'a toast confirms the product is in the cart'));
    await expectPath(page, '/katalog/akumulyatory');
    assert.deepEqual((await stored(page, 'forsage_cart')).map((i) => [i.id, i.quantity, i.price]), [[2001, 1, '3501']]);
  });

  await step(shop, S, 'add to the cart from the list', async () => {
    await ui.click(cards(page).nth(1).locator('button[title="Додати у кошик"]'));
    await until(async () => assert.equal((await page.locator('button[aria-label="Відкрити кошик"] span').textContent()).trim(), '2'));
  });

  await step(shop, S, 'cart', async () => {
    await ui.click(page.locator('button[aria-label="Відкрити кошик"]'));
    await until(async () => assert.ok(await drawer.isVisible()));
    assert.match(await drawer.textContent(), /2 позицій у списку/);
    assert.match(await drawer.textContent(), /8181 грн/);
    await ui.click(drawer.locator('button:has(svg.lucide-plus)').first());
    await until(async () => assert.match(await drawer.textContent(), /11682 грн/));
  });

  await step(shop, S, 'checkout needs a full name', async () => {
    await ui.click(drawer.getByRole('button', { name: /ОФОРМИТИ ЗАМОВЛЕННЯ/ }));
    await until(async () => assert.ok(await drawer.getByText(/Вкажіть прізвище та ім'я повністю/).isVisible()));
    assert.equal((fake.inserted.tyre_orders || []).length, 0);
  });

  await step(shop, S, 'checkout needs a full phone', async () => {
    await ui.fill(drawer.getByPlaceholder("Прізвище Ім'я По батькові"), 'Тестенко Тест');
    await ui.fill(drawer.getByPlaceholder('+380 __ ___ __ __'), '09911');
    await ui.click(drawer.getByRole('button', { name: /ОФОРМИТИ ЗАМОВЛЕННЯ/ }));
    await until(async () => assert.ok(await drawer.getByText(/Введіть телефон повністю/).isVisible()));
    assert.equal((fake.inserted.tyre_orders || []).length, 0);
  });

  await step(shop, S, 'Nova Poshta city and warehouse', async () => {
    await ui.fill(drawer.getByPlaceholder('+380 __ ___ __ __'), '0991112233');
    assert.equal(await drawer.getByPlaceholder('+380 __ ___ __ __').inputValue(), '+380 99 111 22 33');
    await ui.click(drawer.getByRole('button', { name: 'Нова Пошта' }));
    await ui.fill(drawer.getByPlaceholder('Введіть місто...'), 'Дніп');
    await ui.click(drawer.getByRole('button', { name: 'м. Дніпро, Дніпропетровська обл.' }));
    await until(async () => assert.equal(await drawer.locator('select option').count(), 3));
    await ui.select(drawer.locator('select'), 'Відділення №2: просп. Перевірки, 2');
    await ui.click(drawer.getByRole('button', { name: 'Повна оплата' }));
  });

  await step(shop, S, 'order is sent', async () => {
    await ui.click(drawer.getByRole('button', { name: /ОФОРМИТИ ЗАМОВЛЕННЯ/ }));
    await until(async () => assert.ok(await drawer.getByRole('heading', { name: 'Дякуємо!' }).isVisible()));
    assert.deepEqual(fake.inserted.tyre_orders, [{
      customer_name: 'Тестенко Тест', customer_phone: '+380 99 111 22 33', status: 'new',
      delivery_method: 'newpost', delivery_city: 'м. Дніпро, Дніпропетровська обл.', delivery_warehouse: 'Відділення №2: просп. Перевірки, 2',
      payment_method: 'full', user_id: null, customer_email: null,
      items: [{ id: 2001, title: VARTA, quantity: 2, price: '3501' }, { id: 2004, title: WESTA, quantity: 1, price: '4680' }],
    }]);
    assert.ok(await drawer.getByText('Повна оплата.').isVisible());
    assert.deepEqual(await stored(page, 'forsage_cart'), []);
    assert.equal(fake.inserted.customer_profiles, undefined, 'a guest has no profile to update');
  });

  await step(shop, S, 'continue shopping', async () => {
    await ui.click(drawer.getByRole('button', { name: 'ПРОДОВЖИТИ ПОКУПКИ' }));
    await until(async () => assert.equal(await drawer.count(), 0));
    assert.equal(await page.locator('button[aria-label="Відкрити кошик"]').count(), 0);
  });

  await step(shop, S, 'buy in 1 click needs a full phone', async () => {
    await ui.hover(cards(page).first());
    await ui.click(cards(page).first().getByRole('button', { name: 'Швидке замовлення' }));
    await until(async () => assert.ok(await page.getByRole('heading', { name: 'Купити в 1 клік' }).isVisible()));
    await ui.click(page.getByRole('button', { name: 'Замовити дзвінок' }));
    await until(async () => assert.ok(await page.getByText('Введіть номер повністю: +380 XX XXX XX XX').isVisible()));
    assert.equal(fake.inserted.tyre_orders.length, 1);
  });

  await step(shop, S, 'buy in 1 click is sent', async () => {
    await ui.fill(page.locator('input[type="tel"]'), '0671234567');
    await ui.click(page.getByRole('button', { name: 'Замовити дзвінок' }));
    await until(async () => assert.equal(fake.inserted.tyre_orders.length, 2));
    assert.deepEqual(fake.inserted.tyre_orders[1], {
      customer_name: 'Тестенко Тест', customer_phone: '+380 67 123 45 67', status: 'new', user_id: null, customer_email: null,
      items: [{ id: 2001, title: VARTA, quantity: 1, price: '3501' }],
    });
    await until(async () => assert.equal(await page.getByRole('heading', { name: 'Купити в 1 клік' }).count(), 0));
  });

  await step(shop, S, 'cart icon in the header', async () => {
    await ui.click(page.getByRole('banner').locator('button[aria-label="Кошик"]:visible'));
    await until(async () => assert.ok(await drawer.isVisible()));
    await ui.click(drawer.locator('button:has(svg.lucide-x)'));
    await until(async () => assert.equal(await drawer.count(), 0));
  });

  await step(shop, S, 'ask the price of an "on order" product', async () => {
    await ui.goto(`${url}/katalog/shyny-legkovi`);
    await expectCards(page, 8);
    await ui.click(cards(page).last().getByRole('button', { name: /Дізнатися ціну/ }).last());
    await until(async () => assert.ok(await page.getByRole('heading', { name: 'Дізнатися ціну' }).isVisible()));
    await ui.fill(page.locator('input[type="tel"]'), '0501234567');
    await ui.click(page.getByRole('button', { name: 'Замовити дзвінок' }));
    await until(async () => assert.equal(fake.inserted.tyre_orders.length, 3));
    assert.deepEqual(fake.inserted.tyre_orders[2], {
      customer_name: 'Швидке замовлення', customer_phone: '+380 50 123 45 67', status: 'new', user_id: null, customer_email: null,
      items: [{ id: 1007, title: 'Nokian Hakkapeliitta R3 205/55 R16 94R', quantity: 1, price: '0' }],
      comment: 'Запит ціни і терміну постачання (товар під замовлення)',
    });
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const lists = async (browser, url) => {
  const shop = await openShop(browser, url);
  const { page } = shop;
  const ui = actions(shop);
  const S = 'lists';

  await step(shop, S, 'add to favourites', async () => {
    await ui.goto(`${url}/katalog/akumulyatory`);
    await expectCards(page, 4);
    await ui.click(cards(page).first().locator('button[aria-label="Додати в обране"]'));
    await until(async () => assert.ok(await page.getByText(`В обраному: ${VARTA}`).isVisible()));
    assert.deepEqual(await stored(page, 'forsage_favorites'), [2001]);
    await until(async () => assert.match(await chip(page, 'fav').textContent(), /Обране \(1\)/));
  });

  await step(shop, S, 'favourites page', async () => {
    await ui.click(chip(page, 'fav'));
    await expectPath(page, '/katalog/obrane');
    await expectCards(page, 1);
    assert.equal((await page.locator('h1').first().textContent()).trim(), 'Обране');
  });

  await step(shop, S, 'remove from favourites', async () => {
    await ui.click(cards(page).first().locator('button[aria-label="Прибрати з обраного"]'));
    await until(async () => assert.ok(await page.getByText('Нічого не знайдено').isVisible()));
    assert.deepEqual(await stored(page, 'forsage_favorites'), []);
  });

  await step(shop, S, 'compare two products', async () => {
    await ui.click(chip(page, 3));
    await expectCards(page, 4);
    await ui.click(cards(page).nth(0).locator('button[aria-label="Додати до порівняння"]'));
    await ui.click(cards(page).nth(1).locator('button[aria-label="Додати до порівняння"]'));
    await ui.click(page.getByRole('button', { name: 'Порівняти (2)' }));
    await until(async () => assert.ok(await page.getByRole('heading', { name: 'Порівняння' }).isVisible()));
    await until(async () => assert.equal(await page.locator('table thead th').count(), 3));
    assert.match(await page.locator('table').textContent(), /Пусковий струм/);
  });

  await step(shop, S, 'product from the comparison', async () => {
    await ui.click(page.locator('table thead').getByRole('button', { name: WESTA }).last());
    await until(async () => assert.ok(await modalTitle(page, WESTA).isVisible()));
    assert.equal(await page.getByRole('heading', { name: 'Порівняння' }).count(), 0);
    await page.goBack();
    await until(async () => assert.equal(await modalTitle(page, WESTA).count(), 0));
  });

  await step(shop, S, 'add to the cart from the comparison', async () => {
    await ui.click(page.getByRole('button', { name: 'Порівняти (2)' }));
    await until(async () => assert.equal(await page.locator('table thead th').count(), 3));
    await ui.click(page.locator('table thead').getByRole('button', { name: 'У кошик' }).first());
    await until(async () => assert.deepEqual((await stored(page, 'forsage_cart')).map((i) => i.id), [2001]));
  });

  await step(shop, S, 'clear the comparison', async () => {
    await ui.click(page.getByRole('button', { name: 'Очистити' }));
    await until(async () => assert.equal(await page.getByRole('heading', { name: 'Порівняння' }).count(), 0));
    assert.deepEqual(await stored(page, 'forsage_compare'), []);
    assert.equal(await page.getByRole('button', { name: /Порівняти \(/ }).count(), 0);
  });

  await step(shop, S, 'photo viewer', async () => {
    await ui.goto(`${url}/p/1001`);
    await until(async () => assert.ok(await modalTitle(page, 'Hankook Kinergy Eco2 K435 205/55 R16 91H').isVisible()));
    await ui.click(productWindow(page).locator('img[alt="Hankook Kinergy Eco2 K435 205/55 R16 91H"]').first());
    await until(async () => assert.ok(await page.getByText('1 / 3', { exact: true }).isVisible()));
    await ui.click(page.getByRole('button', { name: 'Наступне фото' }).last());
    await until(async () => assert.ok(await page.getByText('2 / 3', { exact: true }).isVisible()));
    await ui.click(page.getByText('2 / 3', { exact: true })); // a click anywhere closes the viewer
    await until(async () => assert.equal(await page.getByText('2 / 3', { exact: true }).count(), 0));
    assert.ok(await modalTitle(page, 'Hankook Kinergy Eco2 K435 205/55 R16 91H').isVisible(), 'the product window stays open');
  });

  await step(shop, S, 'favourite and compare inside the product window', async () => {
    await ui.click(productWindow(page).getByRole('button', { name: 'В обране' }));
    await until(async () => assert.ok(await productWindow(page).getByRole('button', { name: 'В обраному' }).isVisible()));
    await ui.click(productWindow(page).getByRole('button', { name: 'Порівняти', exact: true }));
    await until(async () => assert.ok(await productWindow(page).getByRole('button', { name: 'У порівнянні' }).isVisible()));
    assert.deepEqual(await stored(page, 'forsage_favorites'), [1001]);
    assert.deepEqual(await stored(page, 'forsage_compare'), [1001]);
  });

  await step(shop, S, 'similar product replaces the window', async () => {
    await until(async () => assert.ok(await page.getByRole('heading', { name: 'Схожі пропозиції' }).isVisible()));
    await ui.click(productWindow(page).locator('button', { hasText: 'Laufenn i FIT Ice LW71' }).first());
    await until(async () => assert.ok(await modalTitle(page, 'Laufenn i FIT Ice LW71 205/55 R16 94T').isVisible()));
    await expectPath(page, '/p/1002-laufenn-i-fit-ice-lw71-205-55-r16-94t');
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const links = async (browser, url) => {
  const S = 'links';
  {
    const shop = await openShop(browser, url);
    const { page } = shop;
    const ui = actions(shop);
    await step(shop, S, 'product address opens the product', async () => {
      await ui.goto(`${url}/p/2001-old-name-in-the-link`);
      await until(async () => assert.ok(await modalTitle(page, VARTA).isVisible()));
      await until(async () => assert.equal(await page.title(), `${VARTA} — купити в Україні | Forsage`));
      await expectCards(page, 60);
    });
    await step(shop, S, 'closing it leads to the catalogue', async () => {
      await ui.click(page.getByRole('button', { name: 'Закрити', exact: true }).first());
      await until(async () => assert.equal(await modalTitle(page, VARTA).count(), 0));
      await expectPath(page, '/');
    });
    await shop.context.close();
  }
  {
    const shop = await openShop(browser, url);
    const { page } = shop;
    const ui = actions(shop);
    await step(shop, S, 'old link with p=', async () => {
      await ui.goto(`${url}/?p=2001`);
      await until(async () => assert.ok(await modalTitle(page, VARTA).isVisible()));
      await expectPath(page, '/p/2001-akumulyator-varta-blue-dynamic-60ah-540a-r');
    });
    await shop.context.close();
  }
  {
    const shop = await openShop(browser, url, { storage: { forsage_favorites: '[1003,3001]' } });
    const { page } = shop;
    const ui = actions(shop);
    await step(shop, S, 'section address', async () => {
      await ui.goto(`${url}/katalog/dysky`);
      await expectCards(page, 2);
      await expectPath(page, '/katalog/dysky');
      assert.equal((await page.locator('h1').first().textContent()).trim(), 'Диски');
    });
    await step(shop, S, 'favourites address', async () => {
      await ui.goto(`${url}/katalog/obrane`);
      await expectCards(page, 2);
      await expectPath(page, '/katalog/obrane');
    });
    await step(shop, S, 'unknown section address shows the catalogue', async () => {
      await ui.goto(`${url}/katalog/takogo-rozdilu-nemaye`);
      await expectCards(page, 60);
      await expectPath(page, '/');
    });
    await shop.context.close();
  }
};

// ---------------------------------------------------------------------------------------------
const homeBlocks = async (browser, url) => {
  const all = ['banners', 'size_search', 'categories', 'hits', 'promos', 'benefits', 'reviews', 'articles'].map((type) => ({ type, enabled: true }));
  const shop = await openShop(browser, url, { tables: (t) => t.settings.push({ key: 'home_blocks', value: JSON.stringify(all) }) });
  const { page } = shop;
  const ui = actions(shop);
  const S = 'home';

  await step(shop, S, 'all blocks of the home page', async () => {
    await ui.goto(`${url}/`);
    await expectCards(page, 60);
    for (const name of ['Підбір шин за розміром', 'Каталог', 'Хіти та акції', 'Акції', 'Відгуки покупців']) {
      await until(async () => assert.ok(await page.getByRole('heading', { name, exact: true }).isVisible(), `block "${name}"`));
    }
  });

  await step(shop, S, 'tyre search by size', async () => {
    const block = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Підбір шин за розміром' }) });
    await ui.select(block.locator('select[aria-label="Ширина"]'), '205');
    await ui.select(block.locator('select[aria-label="Висота"]'), '55');
    await ui.select(block.locator('select[aria-label="Радіус"]'), 'R16');
    await ui.click(block.getByRole('button', { name: 'Знайти шини' }));
    await expectPath(page, '/katalog/shyny');
    await expectCards(page, 3);
    assert.equal(await page.locator('select[aria-label="Ширина"]').inputValue(), '205');
  });

  await step(shop, S, 'section tile', async () => {
    await ui.click(page.getByRole('navigation', { name: 'Навігація' }).getByRole('button', { name: 'Головна' }));
    await expectCards(page, 60);
    const tiles = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Каталог', exact: true }) });
    await ui.click(tiles.getByRole('button', { name: /Акумулятори/ }));
    await expectPath(page, '/katalog/akumulyatory');
    await expectCards(page, 4);
  });

  await step(shop, S, 'all hits link', async () => {
    await ui.click(page.getByRole('navigation', { name: 'Навігація' }).getByRole('button', { name: 'Головна' }));
    await expectCards(page, 60);
    const hits = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Хіти та акції' }) });
    await ui.click(hits.getByRole('button', { name: 'Усі' }));
    await expectPath(page, '/katalog/akcii');
    await expectCards(page, 5);
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const customer = async (browser, url) => {
  const shop = await openShop(browser, url, { user: fixtures.session('buyer@test.ua') });
  const { page, fake } = shop;
  const ui = actions(shop);
  const S = 'customer';
  const drawer = page.locator('div.max-w-md').filter({ has: page.getByRole('heading', { name: 'Кошик' }) });

  await step(shop, S, 'checkout is prefilled from the profile', async () => {
    await ui.goto(`${url}/katalog/dysky`);
    await expectCards(page, 2);
    await ui.click(cards(page).first().locator('button[title="Додати у кошик"]'));
    await ui.click(page.locator('button[aria-label="Відкрити кошик"]'));
    await until(async () => assert.equal(await drawer.getByPlaceholder("Прізвище Ім'я По батькові").inputValue(), 'Петренко Іван'));
    assert.equal(await drawer.getByPlaceholder('+380 __ ___ __ __').inputValue(), '+380 67 111 22 33');
  });

  await step(shop, S, 'order is linked to the account', async () => {
    await ui.click(drawer.getByRole('button', { name: /ОФОРМИТИ ЗАМОВЛЕННЯ/ }));
    await until(async () => assert.ok(await drawer.getByRole('heading', { name: 'Дякуємо!' }).isVisible()));
    assert.deepEqual(fake.inserted.tyre_orders, [{
      customer_name: 'Петренко Іван', customer_phone: '+380 67 111 22 33', status: 'new',
      delivery_method: 'pickup', delivery_city: 'м. Дніпро, Дніпропетровська обл.', delivery_warehouse: 'Відділення №1: вул. Тестова, 1',
      payment_method: 'prepayment', user_id: 'user-1', customer_email: 'buyer@test.ua',
      items: [{ id: 3001, title: 'Диск литий Replica R16 6.5J 5x112 ET46', quantity: 1, price: '4200.00' }],
    }]);
    await until(async () => assert.equal((fake.inserted.customer_profiles || []).length, 1));
    const { updated_at, ...profile } = fake.inserted.customer_profiles[0];
    assert.deepEqual(profile, { id: 'user-1', full_name: 'Петренко Іван', phone: '+380 67 111 22 33' });
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const phone = async (browser, url) => {
  const shop = await openShop(browser, url, { device: 'iPhone 13' });
  const { page, fake } = shop;
  const ui = actions(shop);
  const S = 'phone';

  await step(shop, S, 'home', async () => {
    await ui.goto(`${url}/`);
    await expectCards(page, 60);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `the page must not scroll sideways (overflow ${overflow}px)`);
  });

  await step(shop, S, 'sections list', async () => {
    await ui.click(page.getByRole('button', { name: /усі категорії/ }));
    await ui.click(page.getByRole('button', { name: 'Акумулятори', exact: true }));
    await expectPath(page, '/katalog/akumulyatory');
    await expectCards(page, 4);
  });

  await step(shop, S, 'filters sheet', async () => {
    await ui.click(page.getByRole('button', { name: 'Фільтри', exact: true }));
    const sheet = page.getByRole('dialog', { name: 'Фільтри' });
    await ui.click(sheet.getByRole('button', { name: /Плюс ліворуч/ }));
    await until(async () => assert.ok(await sheet.getByRole('button', { name: 'Показати 1 товарів' }).isVisible()));
    await ui.click(sheet.getByRole('button', { name: 'Показати 1 товарів' }));
    await expectCards(page, 1);
    await ui.click(page.getByRole('button', { name: 'Фільтри', exact: true }));
    await ui.click(sheet.getByRole('button', { name: /Скинути фільтри \(1\)/ }));
    await ui.click(sheet.getByRole('button', { name: 'Закрити' }));
    await expectCards(page, 4);
  });

  await step(shop, S, 'swipe to the next section', async () => {
    await page.evaluate(() => {
      const list = document.querySelector('article').closest('.min-w-0');
      const touch = (x) => new Touch({ identifier: 1, target: list, clientX: x, clientY: 300 });
      list.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(320)], changedTouches: [touch(320)] }));
      list.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [touch(120)] }));
    });
    await expectPath(page, '/katalog/avtotovary');
    await expectCards(page, 60);
  });

  await step(shop, S, 'product window and buy bar', async () => {
    await ui.goto(`${url}/katalog/dysky`);
    await expectCards(page, 2);
    await openCard(ui, page);
    await until(async () => assert.ok(await modalTitle(page, 'Диск литий Replica R16 6.5J 5x112 ET46').isVisible()));
    await ui.click(productWindow(page).locator('div.sticky.bottom-0').getByRole('button', { name: 'У кошик' }));
    await until(async () => assert.equal((await stored(page, 'forsage_cart')).length, 1));
    await expectPath(page, '/katalog/dysky');
  });

  await step(shop, S, 'contact button', async () => {
    await ui.click(page.getByRole('button', { name: "Зв'язатися з нами" }));
    await until(async () => assert.ok(await page.getByRole('link', { name: /Viber/ }).isVisible()));
    assert.equal(await page.getByRole('link', { name: /Подзвонити 099 167 44 24/ }).getAttribute('href'), 'tel:+380991674424');
    await ui.click(page.getByRole('button', { name: 'Закрити', exact: true }).last());
  });

  await step(shop, S, 'pickup order from the phone', async () => {
    await ui.click(page.locator('button[aria-label="Відкрити кошик"]'));
    const drawer = page.locator('div.max-w-md').filter({ has: page.getByRole('heading', { name: 'Кошик' }) });
    await ui.fill(drawer.getByPlaceholder("Прізвище Ім'я По батькові"), 'Коваль Олена');
    await ui.fill(drawer.getByPlaceholder('+380 __ ___ __ __'), '380931234567');
    await ui.click(drawer.getByRole('button', { name: /ОФОРМИТИ ЗАМОВЛЕННЯ/ }));
    await until(async () => assert.ok(await drawer.getByRole('heading', { name: 'Дякуємо!' }).isVisible()));
    assert.deepEqual(fake.inserted.tyre_orders, [{
      customer_name: 'Коваль Олена', customer_phone: '+380 93 123 45 67', status: 'new', delivery_method: 'pickup', delivery_city: '', delivery_warehouse: '',
      payment_method: 'prepayment', user_id: null, customer_email: null, items: [{ id: 3001, title: 'Диск литий Replica R16 6.5J 5x112 ET46', quantity: 1, price: '4200.00' }],
    }]);
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const stockTracking = async (browser, url) => {
  const shop = await openShop(browser, url, { tables: (t) => { t.settings.find((s) => s.key === 'enable_stock_quantity').value = 'true'; } });
  const { page } = shop;
  const ui = actions(shop);
  await step(shop, 'stock', 'quantities are shown when stock tracking is on', async () => {
    await ui.goto(`${url}/katalog/shyny-legkovi`);
    await expectCards(page, 8);
    await until(async () => assert.ok(await page.getByText('Залишилося: 2 шт').isVisible()));
    await until(async () => assert.ok(await cards(page).last().getByText('Архів').isVisible(), 'zero quantity = not available'));
  });
  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
runScenarios('shop', { catalogue, purchase, lists, links, homeBlocks, customer, phone, stockTracking });
