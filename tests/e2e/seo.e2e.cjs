/**
 * Browser test of the "SEO" tab of the admin panel: the switcher of its parts, "Сайт загалом" (title, description,
 * checks, template, AI, picture for social networks, saving, the sitemap file) and "Товар вручну" (list, search,
 * the window of one product). The database is the same in-memory fake as in the shop test.
 *
 * Run:  npm run build && npm run e2e          (one scenario:  node tests/e2e/seo.e2e.cjs site)
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { openShop, step, fixtures, actions, until, runScenarios } = require('./harness.cjs');

const OWNER = () => fixtures.session('owner@test.ua', 'owner-1');
const VARTA = 'Акумулятор VARTA Blue Dynamic 60Ah 540A R+';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const HEALTH = { products: 80, cats: 9, noindex_cats: 1, no_seo_title: 60, no_seo_desc: 70, dup_products: 4, dup_groups: 2, dup_examples: ['Клема акумуляторна Voice BT-09'], long_title: 3, short_desc: 5, thin: 12, cats_no_title: 2, cats_no_text: 6 };

/** the site tells the owner about results with browser messages: collect them and press OK */
const watchMessages = (page) => {
  const seen = [];
  page.on('dialog', async (d) => { seen.push(d.message()); await d.accept(); });
  return seen;
};
const part = (page, name) => page.getByRole('button', { name, exact: true });
const openSeo = async (shop, ui, url) => {
  shop.fake.rpc.seo_health = () => HEALTH;
  await ui.goto(`${url}/admin`);
  await ui.click(shop.page.getByRole('navigation').getByRole('button', { name: 'SEO', exact: true }).first());
  await until(async () => assert.ok(await shop.page.getByText('Оцінка SEO зі 100').isVisible()));
};

// ---------------------------------------------------------------------------------------------
const site = async (browser, url) => {
  const shop = await openShop(browser, url, { user: OWNER(), viewport: { width: 1440, height: 900 } });
  const { page, fake } = shop;
  const ui = actions(shop);
  const S = 'seo-site';
  const messages = watchMessages(page);
  // the uploaded picture gets the current time in its name: the same "now" in every run
  await page.clock.setFixedTime(new Date('2026-11-01T10:00:00Z'));
  const aiCalls = [];
  fake.functions['ai-proxy'] = (body) => {
    aiCalls.push(body);
    return { ok: true, text: 'Ось результат:\n{"seo_title": "Шини та шиномонтаж 24/7 — Дніпро, Синельникове", "seo_description": "Купити шини у Дніпрі та Синельниковому. Шиномонтаж 24/7, ремонт дисків, зварювання аргоном. Телефонуйте!", "seo_keywords": "купити шини дніпро, шиномонтаж синельникове"}' };
  };
  const title = page.getByPlaceholder('Назва вашого сайту в пошуку');
  const description = page.getByPlaceholder('Короткий опис, який побачать користувачі під заголовком');
  const keywords = page.getByPlaceholder('шиномонтаж, шини, ремонт...');
  const FIXTURE_TITLE = 'Форсаж — інтернет-магазин шин, дисків та автотоварів | Синельникове';

  await step(shop, S, 'seo tab', async () => {
    await openSeo(shop, ui, url);
    assert.ok(await page.getByText('товарів з однаковими заголовками (2 груп)').isVisible());
  });

  await step(shop, S, 'a "fix" link opens another part', async () => {
    await ui.click(page.locator('div.flex.gap-3', { hasText: 'заголовків довших за 70 символів' }).getByRole('button', { name: 'Виправити →' }));
    await until(async () => assert.ok(await page.getByText('SEO Товарів').isVisible()));
  });

  await step(shop, S, 'site in general', async () => {
    await ui.click(part(page, 'Сайт загалом'));
    await until(async () => assert.equal(await title.inputValue(), FIXTURE_TITLE));
    assert.equal(await description.inputValue(), 'Шини, диски, акумулятори, масла та автотовари в наявності.');
    assert.equal(await keywords.inputValue(), 'шиномонтаж, синельникове, купити шини, ремонт дисків');
    assert.ok(await page.getByText(`${FIXTURE_TITLE.length}/60`).isVisible());
    assert.ok(await page.getByText('Заголовок занадто довгий (Google обріже)').isVisible());
    assert.ok(await page.getByText('Не встановлено фото для соцмереж (OG Image).').isVisible());
    assert.ok(await page.getByText('Ключові слова не знайдені в описі. Використайте їх у тексті.').isVisible());
    assert.ok(await page.getByText('55/100').isVisible());
  });

  await step(shop, S, 'a short title', async () => {
    await ui.fill(title, 'Шини');
    await until(async () => assert.ok(await page.getByText('Заголовок занадто короткий').isVisible()));
    assert.ok(await page.getByText('4/60').isVisible());
    assert.ok(await page.getByText('45/100').isVisible());
  });

  await step(shop, S, 'template', async () => {
    await ui.click(part(page, 'Шаблон'));
    await until(async () => assert.equal(await title.inputValue(), 'Форсаж | Дніпро, Синельникове | Купити Шини | Шиномонтаж'));
    assert.match(await description.inputValue(), /^Професійний шиномонтаж у м\. Дніпро, Синельникове/);
    assert.match(await keywords.inputValue(), /^купити шини дніпро, купити шини синельникове/);
  });

  await step(shop, S, 'AI', async () => {
    await ui.click(part(page, 'AI Оптимізація'));
    await until(async () => assert.equal(await title.inputValue(), 'Шини та шиномонтаж 24/7 — Дніпро, Синельникове'));
    assert.equal(await keywords.inputValue(), 'купити шини дніпро, шиномонтаж синельникове');
    assert.equal(aiCalls.length, 1);
    assert.equal(aiCalls[0].mode, 'plain');
    assert.equal(aiCalls[0].provider, 'gemini');
    assert.match(aiCalls[0].prompt, /^Ти - провідний SEO-експерт для локального бізнесу/);
    await until(async () => assert.deepEqual(messages, ['Авто-генерація за допомогою AI успішно завершена!']));
  });

  await step(shop, S, 'picture for social networks', async () => {
    await page.locator('input[type="file"]').setInputFiles({ name: 'og.png', mimeType: 'image/png', buffer: PNG });
    const picture = page.locator('div.aspect-\\[1\\.91\\/1\\] img');
    await until(async () => assert.match((await picture.getAttribute('src')) || '', /\/storage\/v1\/object\/public\/galery\/seo_og_\d+$/));
    assert.equal(await page.getByText('Не встановлено фото для соцмереж (OG Image).').count(), 0);
  });

  await step(shop, S, 'robots and address', async () => {
    await ui.select(page.locator('select').filter({ has: page.locator('option', { hasText: 'Index, Follow (Рекомендовано)' }) }), 'noindex, nofollow');
    await ui.fill(page.locator('label:has-text("Canonical URL") + input'), 'https://example.test');
    await until(async () => assert.ok(await page.getByText('https://example.test', { exact: true }).isVisible()));
  });

  await step(shop, S, 'save', async () => {
    fake.inserted.settings = [];
    await ui.click(part(page, 'Зберегти'));
    await until(async () => assert.equal(messages.length, 2));
    assert.match(messages[1], /^SEO налаштування оновлено!/);
    const sent = Object.fromEntries(fake.inserted.settings.map((r) => [r.key, r.value]));
    assert.deepEqual(Object.keys(sent), ['seo_title', 'seo_description', 'seo_keywords', 'seo_image', 'seo_robots', 'seo_canonical']);
    assert.equal(sent.seo_title, 'Шини та шиномонтаж 24/7 — Дніпро, Синельникове');
    assert.equal(sent.seo_robots, 'noindex, nofollow');
    assert.equal(sent.seo_canonical, 'https://example.test');
    assert.match(sent.seo_image, /seo_og_\d+$/);
  });

  await step(shop, S, 'sitemap file', async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), ui.click(part(page, 'Sitemap'))]);
    assert.equal(download.suggestedFilename(), 'sitemap.xml');
    const xml = fs.readFileSync(await download.path(), 'utf8');
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset /);
    assert.ok(xml.includes('<loc>https://example.test</loc>'), 'the address from the field is used');
    await until(async () => assert.equal(messages.length, 3));
    assert.match(messages[2], /^Sitemap згенеровано!/);
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const products = async (browser, url) => {
  const shop = await openShop(browser, url, {
    user: OWNER(), viewport: { width: 1440, height: 900 },
    tables: (t) => { const p = t.tyres.find((x) => x.id === 1001); p.seo_title = 'Готовий заголовок'; p.seo_description = 'Готовий опис'; },
  });
  const { page, fake } = shop;
  const ui = actions(shop);
  const S = 'seo-products';
  const messages = watchMessages(page);
  const rows = page.locator('table tbody tr');
  const search = page.getByPlaceholder('Пошук товару...');
  const win = page.locator('div.fixed.z-\\[200\\]');
  const updates = () => fake.inserted['tyres:update'] || [];

  await step(shop, S, 'product by hand', async () => {
    await openSeo(shop, ui, url);
    await ui.click(part(page, 'Товар вручну'));
    await until(async () => assert.equal(await rows.count(), 88));
    assert.equal(await page.getByText('Налаштовано', { exact: true }).count(), 1);
    assert.equal(await page.getByText('Потребує уваги', { exact: true }).count(), 87);
  });

  await step(shop, S, 'search', async () => {
    await ui.fill(search, 'varta');
    await until(async () => assert.equal(await rows.count(), 1));
    assert.match(await rows.first().textContent(), new RegExp(VARTA.replace(/[+]/g, '\\+')));
  });

  await step(shop, S, 'window of a product', async () => {
    await ui.click(rows.first().locator('button'));
    await until(async () => assert.ok(await win.getByText('SEO для товару').isVisible()));
    assert.ok(await win.getByText(VARTA, { exact: true }).first().isVisible());
    assert.equal(await win.getByPlaceholder('michelin-alpin-6-205-55-r16').inputValue(), '');
  });

  await step(shop, S, 'auto fill', async () => {
    await ui.click(win.getByRole('button', { name: 'Авто-заповнення' }));
    await until(async () => assert.equal(await win.getByPlaceholder('Напр. Michelin Alpin 6 205/55 R16 купити в Синельникове').inputValue(), `${VARTA} | Купити в Синельникове | Форсаж`));
    assert.equal(await win.getByPlaceholder('michelin-alpin-6-205-55-r16').inputValue(), 'акумулятор-varta-blue-dynamic-60ah-540a-r');
    assert.equal(await win.getByPlaceholder('шини, michelin, купити').inputValue(), `VARTA, null, купити шини синельникове, ${VARTA}`);
  });

  await step(shop, S, 'save the product', async () => {
    await ui.fill(win.getByPlaceholder('Напр. Michelin Alpin 6 205/55 R16 купити в Синельникове'), 'VARTA Blue Dynamic 60Ah — купити');
    await ui.click(win.getByRole('button', { name: 'Зберегти' }));
    await until(async () => assert.deepEqual(messages, ['SEO для товару оновлено!']));
    await until(async () => assert.equal(await win.count(), 0));
    assert.equal(updates().length, 1);
    assert.equal(updates()[0].where, 'id=eq.2001');
    assert.deepEqual(Object.keys(updates()[0].set), ['seo_title', 'seo_description', 'seo_keywords', 'slug']);
    assert.equal(updates()[0].set.seo_title, 'VARTA Blue Dynamic 60Ah — купити');
    assert.equal(updates()[0].set.slug, 'акумулятор-varta-blue-dynamic-60ah-540a-r');
    assert.equal(await page.getByText('Налаштовано', { exact: true }).count(), 1, 'the row shows the new status');
  });

  await step(shop, S, 'cancel', async () => {
    await ui.fill(search, '');
    await until(async () => assert.equal(await rows.count(), 88));
    await ui.click(rows.nth(1).locator('button'));
    await until(async () => assert.ok(await win.getByText('SEO для товару').isVisible()));
    await ui.fill(win.getByPlaceholder('шини, michelin, купити'), 'не зберігати');
    await ui.click(win.getByRole('button', { name: 'Скасувати' }));
    await until(async () => assert.equal(await win.count(), 0));
    assert.equal(updates().length, 1, 'nothing is sent on cancel');
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const parts = async (browser, url) => {
  const shop = await openShop(browser, url, { user: OWNER(), viewport: { width: 1440, height: 900 } });
  const { page } = shop;
  const ui = actions(shop);
  const S = 'seo-parts';

  await step(shop, S, 'check', async () => { await openSeo(shop, ui, url); });
  for (const [name, mark] of [
    ['ШІ або вручну', 'Хто заповнює SEO'],
    ['Шаблони', null], ['Розділи', null], ['Перенаправлення', null], ['Магазин', null], ['Google і лічильники', null],
    ['Перевірка', 'Оцінка SEO зі 100'],
  ]) {
    await step(shop, S, name, async () => {
      await ui.click(part(page, name));
      if (mark) await until(async () => assert.ok(await page.getByText(mark).first().isVisible()));
      // the chosen part is highlighted in the switcher
      await until(async () => assert.match(await part(page, name).getAttribute('class'), /bg-\[#FFC300\]/));
    });
  }

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const phone = async (browser, url) => {
  const shop = await openShop(browser, url, { user: OWNER(), device: 'iPhone 13' });
  const { page } = shop;
  const ui = actions(shop);
  const S = 'seo-phone';
  shop.fake.rpc.seo_health = () => HEALTH;

  await step(shop, S, 'seo on a phone', async () => {
    await ui.goto(`${url}/admin`);
    await ui.click(page.getByRole('button', { name: 'Ще' }));
    await ui.click(page.locator('div.fixed.inset-0').getByRole('button', { name: 'SEO', exact: true }));
    await until(async () => assert.ok(await page.getByText('Оцінка SEO зі 100').isVisible()));
  });

  await step(shop, S, 'site in general', async () => {
    await ui.click(part(page, 'Сайт загалом'));
    await until(async () => assert.ok(await page.getByText('Основні Мета-теги').isVisible()));
  });

  await step(shop, S, 'window of a product', async () => {
    await ui.click(part(page, 'Товар вручну'));
    await until(async () => assert.equal(await page.locator('table tbody tr').count(), 88));
    await ui.click(page.locator('table tbody tr').first().locator('button'));
    await until(async () => assert.ok(await page.getByText('SEO для товару').isVisible()));
  });

  await shop.context.close();
};

runScenarios('seo', { site, products, parts, phone });
