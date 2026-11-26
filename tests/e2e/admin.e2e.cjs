/**
 * Browser test of the "Товари" tab of the admin panel. Goods are only found and looked at here — names, quantity,
 * photos, barcodes, prices and stock are edited in the shop program. The sections menu slides out from the left.
 * The database is the same in-memory fake as in the shop test.
 *
 * Run:  npm run build && npm run e2e
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { openShop, step, fixtures, actions, until, runScenarios } = require('./harness.cjs');

const OWNER = () => fixtures.session('owner@test.ua', 'owner-1');
const VARTA = 'Акумулятор VARTA Blue Dynamic 60Ah 540A R+';
const BARCODE = '4820000000017';

const rows = (page) => page.locator('main ul > li');
const titles = (page) => rows(page).locator('button:first-of-type').allTextContents();
const expectRows = (page, n) => until(async () => assert.equal(await rows(page).count(), n, 'goods in the list'));
const heading = (page) => page.locator('main p.font-black').first();
const menu = (page) => page.getByRole('navigation', { name: 'Категорії товарів' });
const withBarcode = (t) => { t.tyres.find((p) => p.id === 2001).product_number = BARCODE; };

const openProducts = async (shop, ui, url) => {
  await ui.goto(`${url}/admin`);
  await ui.click(shop.page.getByRole('navigation').getByRole('button', { name: 'Товари' }).first());
};

// ---------------------------------------------------------------------------------------------
const browse = async (browser, url) => {
  const shop = await openShop(browser, url, { user: OWNER(), viewport: { width: 1440, height: 900 }, tables: withBarcode });
  const { page } = shop;
  const ui = actions(shop);
  const S = 'admin-goods';

  await step(shop, S, 'goods tab', async () => {
    await openProducts(shop, ui, url);
    await expectRows(page, 50);
    await until(async () => assert.match(await heading(page).textContent(), /Усі товари · 88/));
    assert.ok(await page.getByRole('button', { name: /Показати ще \(38\)/ }).isVisible());
  });

  await step(shop, S, 'load more', async () => {
    await ui.click(page.getByRole('button', { name: /Показати ще \(38\)/ }));
    await expectRows(page, 88);
  });

  await step(shop, S, 'nothing to edit here', async () => {
    for (const name of ['Редагувати', 'Видалити', 'Зберегти', 'Характеристики з Excel']) assert.equal(await page.getByRole('button', { name }).count(), 0, `no "${name}"`);
    assert.equal(await page.locator('main input[type="number"]').count(), 0, 'no price / stock boxes');
  });

  await step(shop, S, 'sections menu: a section opens its subsections', async () => {
    await ui.click(page.getByRole('button', { name: 'Категорії', exact: true }));
    await until(async () => assert.ok(await menu(page).isVisible()));
    await ui.click(menu(page).getByRole('button', { name: /^Шини/ }));
    await until(async () => assert.ok(await menu(page).getByRole('button', { name: /Легкові/ }).isVisible()));
    assert.match(await menu(page).getByRole('button', { name: /Легкові/ }).textContent(), /Шини/, 'the root section in small letters');
    assert.ok(await menu(page).isVisible(), 'the menu stays open on a section with subsections');
    await until(async () => assert.match(await heading(page).textContent(), /^Шини/));
  });

  await step(shop, S, 'a subsection shows its goods and closes the menu', async () => {
    await ui.click(menu(page).getByRole('button', { name: /Легкові/ }));
    await until(async () => assert.equal(await menu(page).count(), 0));
    // the same goods the shop shows in this section (8 in it + an old tyre without a section that is a car tyre)
    await until(async () => assert.match(await heading(page).textContent(), /^Легкові · 9/));
    await expectRows(page, 9);
  });

  await step(shop, S, 'tap outside closes the menu', async () => {
    await ui.click(page.getByRole('button', { name: 'Категорії', exact: true }));
    await until(async () => assert.ok(await menu(page).isVisible()));
    await page.mouse.click(1400, 450);
    await until(async () => assert.equal(await menu(page).count(), 0));
  });

  await step(shop, S, 'all goods again', async () => {
    await ui.click(page.getByRole('button', { name: 'Категорії', exact: true }));
    await ui.click(menu(page).getByRole('button', { name: 'Усі товари' }));
    await until(async () => assert.match(await heading(page).textContent(), /Усі товари · 88/));
  });

  await step(shop, S, 'search by barcode', async () => {
    await ui.fill(page.getByPlaceholder('Пошук: назва, артикул, штрихкод'), BARCODE);
    await expectRows(page, 1);
    assert.match((await titles(page))[0], new RegExp(VARTA.replace(/[+]/g, '\\+')));
    assert.ok(await rows(page).first().getByText(`▮▮ ${BARCODE}`).isVisible());
  });

  await step(shop, S, 'search by article', async () => {
    await ui.fill(page.getByPlaceholder('Пошук: назва, артикул, штрихкод'), 'ART-2003');
    await until(async () => assert.match((await titles(page))[0] || '', /FORSE Asia/));
    await expectRows(page, 1);
  });

  await step(shop, S, 'search by name', async () => {
    await ui.fill(page.getByPlaceholder('Пошук: назва, артикул, штрихкод'), 'клема voice');
    await until(async () => assert.match((await titles(page))[0] || '', /Voice/));
    await expectRows(page, 2);
    await ui.fill(page.getByPlaceholder('Пошук: назва, артикул, штрихкод'), '');
    await expectRows(page, 50);
  });

  await step(shop, S, 'tap the name copies it', async () => {
    await ui.click(rows(page).first().locator('button').first());
    await until(async () => assert.ok(await page.getByText(/Назву скопійовано/).isVisible()));
  });

  await step(shop, S, 'photo filter', async () => {
    await ui.select(page.getByLabel('Фото'), 'without');
    await until(async () => assert.match(await heading(page).textContent(), /· 7\d/));
    const n = Number((await heading(page).textContent()).match(/· (\d+)/)[1]);
    await ui.select(page.getByLabel('Фото'), 'with');
    await until(async () => assert.equal(Number((await heading(page).textContent()).match(/· (\d+)/)[1]), 88 - n));
    await ui.select(page.getByLabel('Фото'), 'all');
  });

  await step(shop, S, 'price from the biggest', async () => {
    await ui.select(page.getByLabel('Сортування'), 'price_desc');
    await until(async () => assert.match((await titles(page))[0], /12,4-32/), 'the most expensive (13 213 грн) first');
    await ui.select(page.getByLabel('Сортування'), 'price_asc');
    await until(async () => assert.match((await titles(page))[0], /Нокіан|Nokian|Автотовар тестовий №01/));
    await ui.select(page.getByLabel('Сортування'), 'newest');
  });

  await step(shop, S, 'price list for Excel', async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), ui.click(page.getByTitle('Вивантажити в Excel'))]);
    const text = fs.readFileSync(await download.path(), 'utf8');
    assert.equal(text.replace(/^﻿/, '').split('\r\n')[0], '"Код";"Назва";"Бренд";"Категорія";"Ціна, грн";"Залишок";"В наявності"');
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const phone = async (browser, url) => {
  const shop = await openShop(browser, url, { user: OWNER(), device: 'iPhone 13' });
  const { page } = shop;
  const ui = actions(shop);
  const S = 'admin-goods-phone';

  await step(shop, S, 'goods on a phone', async () => {
    await ui.goto(`${url}/admin`);
    await ui.click(page.getByRole('button', { name: 'Товари' }).last());
    await until(async () => assert.ok(await rows(page).first().isVisible()));
    await ui.click(page.getByRole('button', { name: 'Категорії', exact: true }));
    await until(async () => assert.ok(await menu(page).isVisible()));
    await ui.click(menu(page).getByRole('button', { name: /^Акумулятори/ }));
    await until(async () => assert.equal(await menu(page).count(), 0), 'a section without subsections closes the menu');
    await expectRows(page, 4);
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
runScenarios('admin', { browse, phone });
