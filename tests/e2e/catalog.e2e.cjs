/**
 * Browser test of the catalogue: the folder-tree menu (phone and computer), partner goods (GPL, Omega) in lists
 * and on the home page, and a section that has only partner goods.
 *
 * Run:  npm run build && npm run e2e          (one scenario:  node tests/e2e/catalog.e2e.cjs tree)
 */
const assert = require('node:assert/strict');
const { openShop, step, fixtures, actions, until, runScenarios } = require('./harness.cjs');

const expectPath = (page, path) => until(async () => assert.equal(new URL(page.url()).pathname, path));
const titles = (page) => page.locator('article h3').allTextContents().then((t) => t.map((s) => s.trim()));

/** partner offers: on order, with a price, a photo and delivery days, like the ones the program sends */
const withPartners = (t) => {
  const base = t.tyres.find((p) => p.category_id === 115) || t.tyres[0];
  const make = (i, category_id) => {
    const p = { ...base, id: 9000 + i, title: `Партнер товар ${i}`, slug: null, category_id, on_order: true, in_stock: true, supplier_offer_id: `omega-${i}`,
      program_product_id: null, lead_days: '2', image_url: fixtures.svg('#f59e0b', 'P'), is_hot: false,
      created_at: new Date(Date.UTC(2026, 10, 25, 10, i)).toISOString(), catalog_number: `PRT-${i}`, search_numbers: `PRT${i}` };
    p.has_photo = !!p.image_url; p.ask_price = false; p.list_rank = 1;
    return p;
  };
  for (let i = 1; i <= 6; i++) t.tyres.push(make(i, 115));
  // own goods: one name in Ukrainian («Таврія»), found when it is typed in Russian
  t.tyres.push({ ...make(8, 115), title: 'Труба приймальна ТМК ЗАЗ 1102 Таврія 220202', manufacturer: 'ТМК', supplier_offer_id: null, on_order: false, list_rank: 0, ask_price: false, created_at: '2025-01-01T00:00:00Z' });
  // the same maker written with a Cyrillic «К» and a Latin «K»; a lamp whose code only contains «K2»
  t.tyres.push({ ...make(10, 115), title: 'Очисник пластику К2 OSKAR 750ml', manufacturer: null, supplier_offer_id: null, on_order: false, list_rank: 0 });
  t.tyres.push({ ...make(11, 115), title: 'Полироль кузова K-2 TURBO 250 гр', manufacturer: 'K-2', supplier_offer_id: null, on_order: false, list_rank: 0 });
  t.tyres.push({ ...make(12, 115), title: 'Автолампа H3 12V 55W PK22S OSRAM', manufacturer: null, supplier_offer_id: null, on_order: false, list_rank: 0, catalog_number: 'LMP-1', search_numbers: 'LMP1' });
  t.tyres.push({ ...make(13, 115), title: 'Колодки гальмівні передні Ланос', manufacturer: null, supplier_offer_id: null, on_order: false, list_rank: 0, catalog_number: 'BRK-1', search_numbers: 'BRK1' });
  // a section where only partner goods are
  t.product_categories.push({ ...t.product_categories.find((c) => c.id === 115), id: 116, name: 'Свічки', slug: 'svichky', parent_id: 5 });
  t.tyres.push(make(7, 116));
};

// ---------------------------------------------------------------------------------------------
const tree = async (browser, url) => {
  const shop = await openShop(browser, url, { device: 'iPhone 13', tables: withPartners });
  const { page } = shop;
  const ui = actions(shop);
  const S = 'catalog-tree';

  await step(shop, S, 'the catalogue opens as a folder tree', async () => {
    await ui.goto(url);
    await ui.click(page.getByRole('button', { name: 'Відкрити меню' }).first());
    await ui.click(page.getByRole('button', { name: /Каталог товарів/ }));
    const nav = page.getByRole('navigation', { name: 'Каталог товарів' });
    await until(async () => assert.ok(await nav.isVisible()));
    assert.ok(await nav.getByRole('button', { name: /Автотовари/ }).first().isVisible(), 'a folder with subfolders');
    assert.ok(await nav.locator('a[href="/katalog/dysky"]').isVisible(), 'a folder without subfolders is a link');
    assert.equal(await nav.locator('a[href="/katalog/klemy"]').count(), 0, 'subfolders are hidden until the folder opens');
  });

  await step(shop, S, 'a section with only partner goods is in the menu', async () => {
    const nav = page.getByRole('navigation', { name: 'Каталог товарів' });
    await ui.click(nav.getByRole('button', { name: 'Розгорнути Автотовари' }));
    await until(async () => assert.ok(await nav.locator('a[href="/katalog/svichky"]').isVisible()));
    assert.ok(await nav.locator('a[href="/katalog/avtotovary"]', { hasText: 'Усі товари розділу' }).isVisible());
  });

  await step(shop, S, 'a subfolder opens its goods and closes the menu', async () => {
    await ui.click(page.getByRole('navigation', { name: 'Каталог товарів' }).locator('a[href="/katalog/svichky"]'));
    await expectPath(page, '/katalog/svichky');
    await until(async () => assert.deepEqual(await titles(page), ['Партнер товар 7']));
    assert.equal(await page.getByRole('navigation', { name: 'Каталог товарів' }).count(), 0);
  });

  await step(shop, S, 'find a folder by name', async () => {
    await ui.click(page.getByRole('button', { name: 'Відкрити меню' }).first());
    await ui.click(page.getByRole('button', { name: /Каталог товарів/ }));
    await ui.fill(page.getByLabel('Знайти розділ'), 'клем');
    const nav = page.getByRole('navigation', { name: 'Каталог товарів' });
    await until(async () => assert.ok(await nav.locator('a[href="/katalog/klemy"]').isVisible()));
    await ui.click(page.getByRole('button', { name: 'Закрити каталог' }));
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const partners = async (browser, url) => {
  const shop = await openShop(browser, url, { viewport: { width: 1366, height: 900 }, tables: withPartners });
  const { page } = shop;
  const ui = actions(shop);
  const S = 'catalog-partners';

  await step(shop, S, 'home page: own and partner goods take turns', async () => {
    await ui.goto(url);
    await until(async () => assert.ok((await titles(page)).length > 6));
    const list = await titles(page);
    const firstPartner = list.findIndex((t) => t.startsWith('Партнер'));
    assert.ok(firstPartner >= 0 && firstPartner <= 2, `a partner product near the top (at ${firstPartner})`);
    assert.ok(!list[0].startsWith('Партнер'), 'own goods first');
  });

  await step(shop, S, 'in a section partner goods come after own goods with a photo', async () => {
    await ui.goto(`${url}/katalog/klemy`);
    await until(async () => assert.ok((await titles(page)).some((t) => t.startsWith('Партнер'))));
    const list = await titles(page);
    const own = list.filter((t) => !t.startsWith('Партнер'));
    assert.ok(own.length >= 1, 'own goods are there');
    assert.ok(await page.getByText(/під замовлення/i).first().isVisible(), 'partner goods say «під замовлення»');
  });

  await step(shop, S, 'a partner product is found by its number', async () => {
    await ui.goto(`${url}/?q=PRT3`);
    await page.getByPlaceholder(/Пошук/).first().fill('PRT3');
    await until(async () => assert.deepEqual(await titles(page), ['Партнер товар 3']));
  });

  await step(shop, S, 'Russian and Ukrainian spellings are the same word', async () => {
    await page.getByPlaceholder(/Пошук/).first().fill('труба таврия');
    await until(async () => assert.deepEqual(await titles(page), ['Труба приймальна ТМК ЗАЗ 1102 Таврія 220202']));
  });

  await step(shop, S, 'ТМК is found as Тернопіль', async () => {
    await page.getByPlaceholder(/Пошук/).first().fill('тернополь таврия');
    await until(async () => assert.deepEqual(await titles(page), ['Труба приймальна ТМК ЗАЗ 1102 Таврія 220202']));
  });

  await step(shop, S, 'wrong keyboard layout is understood', async () => {
    const box = page.getByPlaceholder(/Пошук/).first();
    await box.fill('gfhnyth');
    await until(async () => assert.ok((await titles(page)).filter((t) => t.startsWith('Партнер')).length >= 6));
    assert.ok(await page.getByText(/інша розкладка клавіатури/).isVisible(), 'the buyer is told why');
  });

  await step(shop, S, '«k2» and «к2» find the maker K2 / K-2, not codes with K2 inside', async () => {
    const box = page.getByPlaceholder(/Пошук/).first();
    const want = ['Очисник пластику К2 OSKAR 750ml', 'Полироль кузова K-2 TURBO 250 гр'];
    for (const q of ['k2', 'к2', 'K-2']) {
      await box.fill(q);
      await until(async () => assert.deepEqual((await titles(page)).sort(), [...want].sort()));
    }
  });

  await step(shop, S, 'Russian words find Ukrainian names, a mistyped word and the other layout too', async () => {
    const box = page.getByPlaceholder(/Пошук/).first();
    const want = ['Колодки гальмівні передні Ланос'];
    for (const q of ['тормозные колодки', 'калодки ланос', 'rjkjlrb ланос']) {
      await box.fill(q);
      await until(async () => assert.deepEqual(await titles(page), want, q));
    }
  });

  await step(shop, S, 'a typo shows close names', async () => {
    await page.getByPlaceholder(/Пошук/).first().fill('Партенр товар');
    await until(async () => assert.ok(await page.getByText(/Показуємо схожі товари/).isVisible()));
    assert.ok((await titles(page)).some((t) => t.startsWith('Партнер')));
  });

  await shop.context.close();
};

runScenarios('catalog', { tree, partners });
