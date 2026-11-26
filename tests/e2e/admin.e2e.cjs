/**
 * Browser test of the "Товари" tab of the admin panel: list, filters, search, quick edits, bulk actions,
 * the edit window, deleting, photo search. The database is the same in-memory fake as in the shop test.
 *
 * Run:  npm run build && npm run e2e
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { openShop, step, fixtures, actions, until, runScenarios } = require('./harness.cjs');

const OWNER = () => fixtures.session('owner@test.ua', 'owner-1');
const VARTA = 'Акумулятор VARTA Blue Dynamic 60Ah 540A R+';
const HANKOOK = 'Hankook Kinergy Eco2 K435 205/55 R16 91H';
const LAUFENN = 'Laufenn i FIT Ice LW71 205/55 R16 94T';

/** rows of the products table (computers) */
const rows = (page) => page.locator('div.min-w-\\[1030px\\] div.divide-y > div');
const rowOf = (page, title) => rows(page).filter({ has: page.locator('span.truncate.block', { hasText: title }) });
const rowTitles = (page) => rows(page).locator('span.truncate.block').allTextContents();
const expectRows = (page, n) => until(async () => assert.equal(await rows(page).count(), n, 'rows in the products table'));
const toast = (page, text) => until(async () => assert.ok(await page.getByText(text).first().isVisible(), `message "${text}"`));
/** what the site sent to change products: [{ where, set }] */
const updates = (fake) => fake.inserted['tyres:update'] || [];
const lastUpdate = (fake) => updates(fake).at(-1);

const openProducts = async (shop, ui, url) => {
  await ui.goto(`${url}/admin`);
  await ui.click(shop.page.getByRole('navigation').getByRole('button', { name: 'Товари' }).first());
};

// ---------------------------------------------------------------------------------------------
const list = async (browser, url) => {
  const shop = await openShop(browser, url, { user: OWNER(), viewport: { width: 1440, height: 900 } });
  const { page, fake } = shop;
  const ui = actions(shop);
  const S = 'admin-list';
  const menuButton = page.locator('div.relative.flex-grow > button').first();
  const sectionSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Всі категорії' }) });
  const sortSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Ціна: від меншої' }) });
  const search = page.getByPlaceholder('Пошук: назва, артикул, штрихкод…');

  await step(shop, S, 'products tab', async () => {
    await openProducts(shop, ui, url);
    await expectRows(page, 50);
    await until(async () => assert.match(await menuButton.textContent(), /Всі \(88\)/));
    assert.equal((await rowTitles(page))[0], HANKOOK);
    assert.ok(await page.getByRole('button', { name: /Завантажити ще \(38\)/ }).isVisible());
  });

  await step(shop, S, 'load more', async () => {
    await ui.click(page.getByRole('button', { name: /Завантажити ще \(38\)/ }));
    await expectRows(page, 88);
    assert.equal(await page.getByRole('button', { name: /Завантажити ще/ }).count(), 0);
  });

  await step(shop, S, 'bucket SUV', async () => {
    await ui.click(menuButton);
    await ui.click(page.getByRole('button', { name: /^SUV \(2\)/ }));
    await expectRows(page, 2);
    await until(async () => assert.match(await menuButton.textContent(), /SUV \(2\)/));
  });

  await step(shop, S, 'bucket all', async () => {
    await ui.click(menuButton);
    await ui.click(page.getByRole('button', { name: /^Всі \(88\)/ }).last());
    await expectRows(page, 50);
  });

  await step(shop, S, 'section filter', async () => {
    await ui.select(sectionSelect, '3');
    await expectRows(page, 4);
  });

  await step(shop, S, 'search', async () => {
    await ui.fill(search, 'varta');
    await ui.press(search, 'Enter');
    await expectRows(page, 1);
    await ui.fill(search, '');
    await ui.press(search, 'Enter');
    await expectRows(page, 4);
  });

  await step(shop, S, 'sort by price', async () => {
    await ui.select(sortSelect, 'price_asc');
    // by the number (the list is filtered to batteries here): the cheapest battery first
    await until(async () => assert.equal((await rowTitles(page))[0], 'Акумулятор FORSE Asia 45Ah 330A R+'));
    await ui.select(sortSelect, 'newest');
    await until(async () => assert.equal((await rowTitles(page))[0], VARTA));
  });

  await step(shop, S, 'only in stock', async () => {
    await ui.select(sectionSelect, '6');
    await expectRows(page, 9); // the admin list also shows sold-out goods
    await ui.click(page.locator('button', { has: page.locator('svg.lucide-eye-off') }));
    await expectRows(page, 8);
    await ui.click(page.locator('button', { has: page.locator('svg.lucide-eye') }));
    await expectRows(page, 9);
  });

  await step(shop, S, 'tiles view', async () => {
    await ui.click(page.locator('button', { has: page.locator('svg.lucide-layout-grid') }));
    await until(async () => assert.equal(await page.locator('div.grid > div.bg-zinc-900 div.aspect-square').count(), 9));
    await ui.click(page.locator('button', { has: page.locator('svg.lucide-list') }));
    await expectRows(page, 9);
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const quickEdits = async (browser, url) => {
  const shop = await openShop(browser, url, { user: OWNER(), viewport: { width: 1440, height: 900 } });
  const { page, fake } = shop;
  const ui = actions(shop);
  const S = 'admin-quick';
  await shop.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: url });
  page.on('dialog', (d) => d.accept());
  const sectionSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Всі категорії' }) });
  const select = (title) => rowOf(page, title).locator('button').first();
  const bar = page.locator('div.rounded-2xl', { hasText: 'Масове управління' });

  await step(shop, S, 'price in the table', async () => {
    await openProducts(shop, ui, url);
    await ui.select(sectionSelect, '3');
    await expectRows(page, 4);
    await ui.click(rowOf(page, VARTA).locator('div.text-right.font-mono > div'));
    const input = rowOf(page, VARTA).locator('input[type="number"]');
    await ui.fill(input, '3999');
    await ui.press(input, 'Enter');
    await toast(page, 'Оновлено!');
    assert.deepEqual(lastUpdate(fake), { where: 'id=eq.2001', set: { price: 3999 } });
  });

  await step(shop, S, 'stock in the table', async () => {
    await ui.click(rowOf(page, VARTA).locator('div.text-center.font-mono.text-sm > div'));
    const input = rowOf(page, VARTA).locator('input[type="number"]');
    await ui.fill(input, '12');
    await ui.press(input, 'Enter');
    await until(async () => assert.deepEqual(lastUpdate(fake), { where: 'id=eq.2001', set: { stock_quantity: 12 } }));
  });

  await step(shop, S, 'hit checkbox', async () => {
    await ui.click(rowOf(page, 'Акумулятор Bosch S4 74Ah 680A L+').locator('input[type="checkbox"]'));
    await until(async () => assert.deepEqual(lastUpdate(fake), { where: 'id=eq.2002', set: { is_hot: true } }));
  });

  await step(shop, S, 'copy the name', async () => {
    await ui.click(rowOf(page, VARTA).locator('span.truncate.block'));
    await toast(page, `Скопійовано: ${VARTA}`);
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), VARTA);
  });

  await step(shop, S, 'text for a messenger', async () => {
    await ui.click(rowOf(page, VARTA).locator('button[title="Поділитися в месенджер"]'));
    await toast(page, 'Текст для месенджера скопійовано!');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(text, /Акумулятор VARTA Blue Dynamic/);
  });

  await step(shop, S, 'order text', async () => {
    await ui.click(rowOf(page, VARTA).locator('button[title="Швидке замовлення"]'));
    await toast(page, 'Дані для замовлення скопійовано!');
  });

  await step(shop, S, 'move the chosen goods to a section', async () => {
    await ui.click(select('Акумулятор Westa 100Ah 850A R+'));
    await ui.click(select('Акумулятор FORSE Asia 45Ah 330A R+'));
    await until(async () => assert.match(await bar.textContent(), /обрано: 2/));
    await ui.select(bar.locator('select'), 'cat:2');
    await toast(page, '2 товарів перенесено в «Диски».');
    const u = lastUpdate(fake);
    assert.deepEqual(u.set, { category_id: 2 });
    assert.match(u.where, /^id=in\.\((2004,2003|2003,2004)\)$/);
    await expectRows(page, 2);
  });

  await step(shop, S, 'mark the chosen goods as hits', async () => {
    await ui.click(select(VARTA));
    await ui.click(bar.getByRole('button', { name: 'HOT' }));
    await toast(page, 'Оновлено 1 товарів');
    assert.deepEqual(lastUpdate(fake), { where: 'id=eq.2001', set: { id: 2001, is_hot: true } });
  });

  await step(shop, S, 'remove photos of the chosen goods', async () => {
    await ui.click(select(VARTA));
    await ui.click(bar.getByRole('button', { name: 'ОЧИСТИТИ' }));
    await toast(page, 'Видалено фото для 1 товарів.');
    assert.deepEqual(lastUpdate(fake), { where: 'id=in.(2001)', set: { image_url: null, gallery: [] } });
  });

  await step(shop, S, 'delete the chosen goods', async () => {
    await ui.click(select('Акумулятор Bosch S4 74Ah 680A L+'));
    await ui.click(bar.getByRole('button', { name: 'Видалити' }));
    await until(async () => assert.ok(await page.getByRole('heading', { name: 'Видалити 1 товарів?' }).isVisible()));
    await ui.click(page.locator('div.max-w-sm').getByRole('button', { name: 'Видалити' }));
    await toast(page, 'Успішно видалено 1 товарів.');
    await expectRows(page, 1);
    assert.equal(fake.tables.tyres.some((p) => p.id === 2002), false);
  });

  await step(shop, S, 'delete one product', async () => {
    await ui.click(rowOf(page, VARTA).locator('button[title="Видалити"]'));
    await until(async () => assert.ok(await page.getByRole('heading', { name: 'Видалити?' }).isVisible()));
    await ui.click(page.getByRole('button', { name: 'Так' }));
    await until(async () => assert.equal(fake.tables.tyres.some((p) => p.id === 2001), false));
    await until(async () => assert.ok(await page.getByText('Шин не знайдено').isVisible()));
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const editWindow = async (browser, url) => {
  const shop = await openShop(browser, url, { user: OWNER(), viewport: { width: 1440, height: 900 } });
  const { page, fake } = shop;
  const ui = actions(shop);
  const S = 'admin-edit';
  const sectionSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Всі категорії' }) });
  const win = page.locator('div.max-w-4xl');
  const field = (label) => win.locator('div', { has: page.locator(`> label:text-is("${label}")`) }).last();

  await step(shop, S, 'tyre from the shop program', async () => {
    await openProducts(shop, ui, url);
    await expectRows(page, 50);
    await ui.click(rowOf(page, LAUFENN).locator('button[title="Редагувати"]'));
    await until(async () => assert.ok(await win.getByRole('heading', { name: 'Редагування' }).isVisible()));
    assert.ok(await win.getByText('Цей товар приходить з програми.').isVisible());
    assert.equal(await field('Виробник (Бренд)').locator('input').inputValue(), 'Laufenn');
    assert.equal(await field('Назва (Модель)').locator('input').inputValue(), 'i FIT Ice LW71 94T');
    assert.equal(await field('Ширина').locator('input').inputValue(), '205');
    assert.equal(await field('Висота').locator('input').inputValue(), '55');
    await until(async () => assert.equal(await field('Закупка (База)').locator('input').inputValue(), '2100'));
  });

  await step(shop, S, 'save: only what the site owns is sent', async () => {
    await ui.fill(field('Опис').locator('textarea'), 'Новий опис шини');
    await ui.fill(field('SEO Заголовок (Title)').locator('input'), 'Laufenn LW71 205/55 R16 — купити');
    await ui.click(win.getByRole('button', { name: 'Зберегти' }));
    await until(async () => assert.equal(await win.count(), 0));
    const u = lastUpdate(fake);
    assert.equal(u.where, 'id=eq.1002');
    assert.deepEqual(Object.keys(u.set).sort(), ['axis', 'description', 'gallery', 'image_url', 'is_hot', 'old_price', 'radius', 'season', 'seo_description', 'seo_keywords', 'seo_title', 'slug', 'supplier_id', 'vehicle_type']);
    assert.equal(u.set.description, 'Новий опис шини');
    assert.equal(u.set.seo_title, 'Laufenn LW71 205/55 R16 — купити');
    assert.equal(u.set.season, 'winter');
  });

  await step(shop, S, 'battery with characteristics', async () => {
    await ui.select(sectionSelect, '3');
    await expectRows(page, 4);
    await ui.click(rowOf(page, VARTA).locator('button[title="Редагувати"]'));
    await until(async () => assert.ok(await win.getByText('Характеристики (для фільтрів на сайті)').isVisible()));
    assert.equal(await field('Ємність, Ah').locator('input').inputValue(), '60');
    assert.equal(await field('Назва товару').locator('input').inputValue(), 'Акумулятор VARTA Blue Dynamic 60Ah 540A R+');
    await ui.fill(field('Ємність, Ah').locator('input'), '62');
    await ui.click(win.getByRole('button', { name: 'Азія' }));
    await ui.click(win.getByRole('button', { name: 'Зберегти' }));
    await until(async () => assert.equal(await win.count(), 0));
    const u = lastUpdate(fake);
    assert.equal(u.where, 'id=eq.2001');
    assert.deepEqual(u.set.attributes, { capacity: '62', polarity: 'right', body: 'asia', current: '540', size: '242×175×175', voltage: '12' });
    assert.equal('title' in u.set, false);
    assert.equal('price' in u.set, false);
  });

  await step(shop, S, 'product that is not from the program', async () => {
    await ui.select(sectionSelect, 'all');
    await ui.fill(page.getByPlaceholder('Пошук: назва, артикул, штрихкод…'), 'Belshina');
    await ui.press(page.getByPlaceholder('Пошук: назва, артикул, штрихкод…'), 'Enter');
    await expectRows(page, 1);
    await ui.click(rows(page).first().locator('button[title="Редагувати"]'));
    await until(async () => assert.ok(await win.getByRole('heading', { name: 'Редагування' }).isVisible()));
    assert.equal(await win.getByText('Цей товар приходить з програми.').count(), 0);
    await ui.fill(field('Роздріб (Продаж)').locator('input'), '1600');
    await ui.click(win.getByRole('button', { name: 'Зберегти' }));
    await until(async () => assert.equal(await win.count(), 0));
    const u = lastUpdate(fake);
    assert.equal(u.where, 'id=eq.1009');
    assert.equal(u.set.price, '1600');
    assert.equal(u.set.title, 'Belshina Artmotion 195/65 R15 91H');
    assert.equal(u.set.in_stock, true);
  });

  await step(shop, S, 'close without saving', async () => {
    const before = updates(fake).length;
    await ui.click(rows(page).first().locator('button[title="Редагувати"]'));
    await until(async () => assert.ok(await win.isVisible()));
    await ui.click(win.getByRole('button', { name: 'Скасувати' }));
    await until(async () => assert.equal(await win.count(), 0));
    assert.equal(updates(fake).length, before);
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const photosAndFiles = async (browser, url) => {
  const shop = await openShop(browser, url, { user: OWNER(), viewport: { width: 1440, height: 900 } });
  const { page, fake } = shop;
  const ui = actions(shop);
  const S = 'admin-photos';
  const sectionSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Всі категорії' }) });
  const select = (title) => rowOf(page, title).locator('button').first();
  const bar = page.locator('div.rounded-2xl', { hasText: 'Масове управління' });

  await step(shop, S, 'photo search for one product', async () => {
    await openProducts(shop, ui, url);
    await ui.select(sectionSelect, '115');
    await expectRows(page, 3);
    await ui.click(rowOf(page, 'Клема акумуляторна Voice BT-09 (+)').locator('button[title="Знайти фото ШІ"]'));
    await until(async () => assert.equal(await page.locator('img[alt^="Result "]').count(), 3));
    await ui.click(page.locator('img[alt="Result 0"]'));
    await ui.click(page.locator('img[alt="Result 2"]'));
    await ui.click(page.getByRole('button', { name: 'Зберегти 2' }));
    await toast(page, 'Фото та галерею оновлено!');
    const u = lastUpdate(fake);
    assert.equal(u.where, 'id=eq.4001');
    assert.equal(u.set.gallery.length, 1);
    assert.ok(u.set.image_url.startsWith('data:image'));
  });

  await step(shop, S, 'photo search for the chosen goods', async () => {
    await ui.click(select('Клема акумуляторна Voice BT-09 (-)'));
    await ui.click(bar.getByRole('button', { name: 'ШІ НОВІ' }));
    await toast(page, 'Оброблено! Додано фото для 1 товарів.');
    assert.equal(lastUpdate(fake).where, 'id=eq.4002');
  });

  await step(shop, S, 'price list for Excel', async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), ui.click(page.getByRole('button', { name: 'Вивантажити в Excel' }))]);
    const text = fs.readFileSync(await download.path(), 'utf8');
    const lines = text.replace(/^﻿/, '').split('\r\n');
    assert.equal(lines[0], '"Код";"Назва";"Бренд";"Категорія";"Ціна, грн";"Залишок";"В наявності"');
    assert.equal(lines.length, 4, 'header + the three goods of the chosen section');
    assert.match(lines[1], /"Клеми"/);
  });

  await step(shop, S, 'characteristics import window', async () => {
    await ui.click(page.getByRole('button', { name: 'Характеристики з Excel' }));
    await until(async () => assert.ok(await page.getByRole('heading', { name: /Імпорт з Excel/ }).isVisible()));
    await ui.click(page.getByRole('button', { name: 'Закрити' }));
    await until(async () => assert.equal(await page.getByRole('heading', { name: /Імпорт з Excel/ }).count(), 0));
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const phone = async (browser, url) => {
  const shop = await openShop(browser, url, { user: OWNER(), device: 'iPhone 13' });
  const { page, fake } = shop;
  const ui = actions(shop);
  const S = 'admin-phone';
  const cards = page.locator('div.md\\:hidden.space-y-2 > div');
  const win = page.locator('div.max-w-4xl');

  await step(shop, S, 'products list', async () => {
    await ui.goto(`${url}/admin`);
    await ui.click(page.getByRole('navigation').getByRole('button', { name: 'Товари' }).last());
    await until(async () => assert.equal(await cards.count(), 50));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `the page must not scroll sideways (overflow ${overflow}px)`);
  });

  await step(shop, S, 'filters', async () => {
    await ui.click(page.locator('div.flex.gap-1\\.5.md\\:hidden > button'));
    await ui.select(page.locator('select').filter({ has: page.locator('option', { hasText: 'Всі категорії' }) }), '2');
    await until(async () => assert.equal(await cards.count(), 2));
  });

  await step(shop, S, 'edit window', async () => {
    await ui.click(cards.first().getByRole('button', { name: 'Редагувати' }));
    await until(async () => assert.ok(await win.getByRole('heading', { name: 'Редагування' }).isVisible()));
    await ui.fill(win.locator('textarea').first(), 'Опис з телефону');
    await ui.click(win.getByRole('button', { name: 'Зберегти' }));
    await until(async () => assert.equal(await win.count(), 0));
    assert.equal(lastUpdate(fake).set.description, 'Опис з телефону');
  });

  await step(shop, S, 'choose a product', async () => {
    await ui.click(cards.first().locator('button').first());
    await until(async () => assert.ok(await page.getByText('обрано: 1').isVisible()));
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
runScenarios('admin', { list, quickEdits, editWindow, photosAndFiles, phone });
