/**
 * Browser test of the "Налаштування" tab of the admin panel: contacts, keys, staff access, suppliers
 * (adding, clearing the stock, deleting — both behind a confirmation code) and photos by file name.
 * The database is the same in-memory fake as in the shop test, so nothing real is touched.
 *
 * Run:  npm run build && npm run e2e          (one scenario:  node tests/e2e/settings.e2e.cjs suppliers)
 */
const assert = require('node:assert/strict');
const { openShop, step, fixtures, actions, until, runScenarios } = require('./harness.cjs');

const OWNER = () => fixtures.session('owner@test.ua', 'owner-1');
const toast = (page, text) => until(async () => assert.ok(await page.getByText(text).first().isVisible(), `message "${text}"`));
/** "key=value" of everything the tab saved into the settings table, in the order it was sent */
const saved = (fake) => (fake.inserted.settings || []).map((r) => `${r.key}=${r.value}`);
/** the input that stands right after its label */
const field = (page, label) => page.locator(`label:has-text("${label}") + input`);

const openSettings = async (shop, ui, url) => {
  await ui.goto(`${url}/admin`);
  await ui.click(shop.page.getByRole('navigation').getByRole('button', { name: 'Налаштування' }).first());
  await until(async () => assert.ok(await shop.page.getByPlaceholder('Назва постачальника').isVisible()));
};
const part = (page, name) => page.getByRole('button', { name, exact: true });

// ---------------------------------------------------------------------------------------------
const keys = async (browser, url) => {
  const shop = await openShop(browser, url, {
    user: OWNER(), viewport: { width: 1440, height: 900 },
    tables: (t) => t.settings.push({ key: 'manager_email', value: 'manager@test.ua' }, { key: 'contact_map_link', value: 'https://maps.example/forsage' }),
  });
  const { page, fake } = shop;
  const ui = actions(shop);
  const S = 'settings-keys';
  fake.managerCalls = [];
  fake.rpc.set_manager_credentials = (args) => { fake.managerCalls.push(args); return null; };
  const save = page.getByRole('button', { name: 'Зберегти зміни' });

  await step(shop, S, 'settings tab', async () => {
    await openSettings(shop, ui, url);
  });

  await step(shop, S, 'contacts', async () => {
    await ui.click(part(page, 'Контакти'));
    await until(async () => assert.equal(await page.getByPlaceholder('099 167 44 24').inputValue(), '099 167 44 24'));
    assert.equal(await page.getByPlaceholder('https://maps.google...').inputValue(), 'https://maps.example/forsage');
    await ui.fill(page.getByPlaceholder('099 167 44 24'), '050 111 22 33');
    await ui.fill(page.getByPlaceholder('м. Синельникове, вул. Квітнева 9'), 'м. Дніпро, вул. Тестова 1');
  });

  await step(shop, S, 'keys', async () => {
    await ui.click(part(page, 'API Ключі'));
    await until(async () => assert.equal(await page.getByPlaceholder('admin@forsage.com').inputValue(), 'owner@test.ua'));
    assert.equal(await page.getByPlaceholder('Ключ API Нової Пошти').inputValue(), 'test-np-key');
    // AI works in the program: no AI keys or provider on the site
    assert.equal(await page.getByText('Провайдер AI').count(), 0);
    await ui.fill(page.getByPlaceholder('Ключ API Нової Пошти'), 'np-new');
  });

  await step(shop, S, 'staff access', async () => {
    await ui.click(part(page, 'Менеджер / Доступ'));
    await until(async () => assert.equal(await page.getByPlaceholder('manager@forsage.com').inputValue(), 'manager@test.ua'));
    assert.equal(await page.getByText('Пароль буде оновлено').count(), 0);
    await ui.fill(page.getByPlaceholder('Введіть новий пароль, щоб змінити...'), 'Secret123');
    assert.ok(await page.getByText('Пароль буде оновлено при збереженні всіх налаштувань.').isVisible());
    await ui.fill(page.getByPlaceholder('staff@forsage.com'), 'staff@test.ua');
  });

  await step(shop, S, 'save everything', async () => {
    await ui.click(save);
    await toast(page, 'Всі налаштування збережено!');
    assert.deepEqual(saved(fake), [
      'nova_poshta_key=np-new', 'supplier_api_key=', 'service_staff_email=staff@test.ua', 'admin_email=owner@test.ua',
      'hide_tire_service=false',
      // the manager got a new password, so the e-mail goes through the server function, not into the table
      'contact_phone1=050 111 22 33', 'contact_phone2=063 582 38 58', 'contact_address=м. Дніпро, вул. Тестова 1', 'contact_map_link=https://maps.example/forsage',
    ]);
    assert.deepEqual(fake.managerCalls, [{ m_email: 'manager@test.ua', m_password: 'Secret123' }]);
    // the password field is emptied after saving
    assert.equal(await page.getByPlaceholder('Введіть новий пароль, щоб змінити...').inputValue(), '');
  });

  await step(shop, S, 'save again without a password', async () => {
    // the message of the first saving hides by itself
    await until(async () => assert.equal(await page.getByText('Всі налаштування збережено!').count(), 0));
    fake.inserted.settings = [];
    await ui.click(save);
    await toast(page, 'Всі налаштування збережено!');
    assert.equal(saved(fake).length, 10);
    assert.ok(saved(fake).includes('manager_email=manager@test.ua'), 'without a new password the e-mail is saved into the table');
    assert.equal(fake.managerCalls.length, 1, 'the manager password is not sent again');
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const suppliers = async (browser, url) => {
  const shop = await openShop(browser, url, {
    user: OWNER(), viewport: { width: 1440, height: 900 },
    tables: (t) => {
      t.suppliers.push({ id: 2, name: 'Omega' }, { id: 3, name: 'Без товарів' });
      for (const p of t.tyres) {
        if (p.id >= 1001 && p.id <= 1005) p.supplier_id = 1;
        if (p.id >= 5001 && p.id <= 5003) p.supplier_id = 2;
      }
    },
  });
  const { page, fake } = shop;
  const ui = actions(shop);
  const S = 'settings-suppliers';
  // the confirmation code is random: the same one in every run
  await shop.context.addInitScript(() => { Math.random = () => 0.4242; });
  const CODE = '4817';
  const rows = page.locator('div.grid.grid-cols-1.gap-3 > div');
  const rowOf = (name) => rows.filter({ has: page.locator('h5', { hasText: name }) });
  const names = () => rows.locator('h5').allTextContents();
  const win = page.locator('div.fixed.z-\\[200\\]');

  await step(shop, S, 'suppliers', async () => {
    await openSettings(shop, ui, url);
    await until(async () => assert.deepEqual(await names(), ['Omega', 'Без товарів', 'Програма']));
    await until(async () => assert.match(await rowOf('Omega').textContent(), /3 позицій/));
    assert.match(await rowOf('Програма').textContent(), /5 позицій/);
    assert.match(await rowOf('Без товарів').textContent(), /0 позицій/);
    assert.ok(await rowOf('Без товарів').getByTitle('Очистити склад').isDisabled());
  });

  await step(shop, S, 'add a supplier', async () => {
    await ui.fill(page.getByPlaceholder('Назва постачальника'), 'Michelin UA');
    await ui.click(page.getByRole('button', { name: 'Додати' }));
    await toast(page, 'Постачальника додано');
    await until(async () => assert.deepEqual(await names(), ['Michelin UA', 'Omega', 'Без товарів', 'Програма']));
    assert.deepEqual(fake.inserted.suppliers, [{ name: 'Michelin UA' }]);
    assert.equal(await page.getByPlaceholder('Назва постачальника').inputValue(), '');
  });

  await step(shop, S, 'clear the stock: window', async () => {
    await ui.click(rowOf('Omega').getByTitle('Очистити склад'));
    await until(async () => assert.ok(await win.getByRole('heading', { name: 'Очищення Складу' }).isVisible()));
    assert.match(await win.textContent(), /видалити 3 товарів від постачальника Omega/);
    assert.match(await win.textContent(), new RegExp(`Код підтвердження:${CODE}`));
    assert.ok(await win.getByRole('button', { name: 'ВИДАЛИТИ ТОВАРИ' }).isDisabled());
    await ui.fill(win.getByPlaceholder('Введіть код'), '0000');
    assert.ok(await win.getByRole('button', { name: 'ВИДАЛИТИ ТОВАРИ' }).isDisabled(), 'a wrong code does not unlock the button');
  });

  await step(shop, S, 'clear the stock: confirmed', async () => {
    await ui.fill(win.getByPlaceholder('Введіть код'), CODE);
    await ui.click(win.getByRole('button', { name: 'ВИДАЛИТИ ТОВАРИ' }));
    await toast(page, /Очищено склад постачальника "Omega"/);
    await until(async () => assert.equal(await win.count(), 0));
    await until(async () => assert.match(await rowOf('Omega').textContent(), /0 позицій/));
    assert.equal(fake.tables.tyres.filter((p) => p.supplier_id === 2).length, 0);
    assert.equal(fake.tables.tyres.filter((p) => p.supplier_id === 1).length, 5, 'other suppliers keep their goods');
    assert.equal(fake.tables.suppliers.some((s) => s.id === 2), true, 'the supplier itself stays');
  });

  await step(shop, S, 'delete a supplier: window', async () => {
    await ui.click(rowOf('Програма').getByTitle('Видалити постачальника'));
    await until(async () => assert.ok(await win.getByRole('heading', { name: 'Видалення Постачальника' }).isVisible()));
    assert.match(await win.textContent(), /Видалення постачальника Програма призведе до видалення всіх його товарів \(5 шт\.\)/);
  });

  await step(shop, S, 'delete a supplier: confirmed', async () => {
    await ui.fill(win.getByPlaceholder('Введіть код'), CODE);
    await ui.click(win.getByRole('button', { name: 'ВИДАЛИТИ ВСЕ' }));
    await toast(page, 'Постачальника "Програма" видалено.');
    await until(async () => assert.deepEqual(await names(), ['Michelin UA', 'Omega', 'Без товарів']));
    assert.equal(fake.tables.tyres.filter((p) => p.supplier_id === 1).length, 0);
    assert.equal(fake.tables.suppliers.some((s) => s.id === 1), false);
    assert.equal(fake.tables.tyres.length, 88 - 3 - 5);
  });

  await step(shop, S, 'close the window without deleting', async () => {
    await ui.click(rowOf('Omega').getByTitle('Видалити постачальника'));
    await until(async () => assert.ok(await win.getByRole('heading', { name: 'Видалення Постачальника' }).isVisible()));
    await ui.click(win.locator('button').first());
    await until(async () => assert.equal(await win.count(), 0));
    assert.equal(fake.tables.suppliers.some((s) => s.id === 2), true);
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const file = (name) => ({ name, mimeType: 'image/png', buffer: PNG });

const photos = async (browser, url) => {
  const shop = await openShop(browser, url, { user: OWNER(), viewport: { width: 1440, height: 900 } });
  const { page, fake } = shop;
  const ui = actions(shop);
  const S = 'settings-photos';
  const input = page.locator('input[type="file"]');
  const start = page.getByRole('button', { name: 'Розпочати обробку' });
  const journal = page.locator('div.font-mono.max-h-40 > div');
  const photoUpdates = () => (fake.inserted['tyres:update'] || []).filter((u) => 'image_url' in u.set);

  await step(shop, S, 'stock and import', async () => {
    await openSettings(shop, ui, url);
    await ui.click(part(page, 'Склад / Імпорт'));
    await until(async () => assert.ok(await page.getByText('Розумне завантаження фото').isVisible()));
    assert.ok(await page.getByText('Файли не обрано').isVisible());
    assert.ok(await start.isDisabled());
  });

  await step(shop, S, 'choose files', async () => {
    await input.setInputFiles([file('Laufenn.i FIT Ice.png'), file('hankook dynapro.png'), file('x.png'), file('zzz unknown thing.png')]);
    await until(async () => assert.ok(await page.getByText('Обрано 4 файлів').isVisible()));
    assert.ok(await start.isEnabled());
  });

  await step(shop, S, 'photos by file name', async () => {
    await ui.click(start);
    await until(async () => assert.match((await journal.allTextContents())[0] || '', /^ЗАВЕРШЕНО\. Оновлено товарів: 1$/), 20000);
    const lines = await journal.allTextContents();
    // "Brand.Model" file name: the product is found, but it already has a photo
    assert.ok(lines.includes('Знайдено за Брендом.Моделлю: Laufenn i FIT Ice (1 шт)'), lines.join(' | '));
    assert.ok(lines.includes('SKIPPED (Has Image): Laufenn.i FIT Ice.png'), lines.join(' | '));
    // two words of the name: the one product that has both and no photo yet
    assert.ok(lines.includes('MATCHED (Fuzzy): hankook dynapro.png -> 1 товарів'), lines.join(' | '));
    assert.ok(lines.includes('SKIP: x.png (мало ключових слів)'), lines.join(' | '));
    assert.ok(lines.includes("NOT FOUND (By 'unknown'): zzz unknown thing.png"), lines.join(' | '));
    assert.equal(photoUpdates().length, 1);
    assert.match(photoUpdates()[0].where, /id=in\.\(1011\)/);
    assert.match(photoUpdates()[0].set.image_url, /\/storage\/v1\/object\/public\/galery\/smart_/);
    assert.ok(await page.getByText('Файли не обрано').isVisible(), 'the list of files is emptied when done');
  });

  await step(shop, S, 'exact name, replace photos', async () => {
    await ui.click(page.getByText('Перезаписувати існуючі фото'));
    await ui.click(page.getByText('Точний збіг назви (для спецтехніки)'));
    await input.setInputFiles([file('ART-1010.png'), file('NO-SUCH-CODE.png')]);
    await until(async () => assert.ok(await page.getByText('Обрано 2 файлів').isVisible()));
    const before = photoUpdates().length;
    await ui.click(start);
    await until(async () => assert.match((await journal.allTextContents())[0] || '', /^ЗАВЕРШЕНО\. Оновлено товарів: 1$/), 20000);
    const lines = await journal.allTextContents();
    assert.ok(lines.includes('MATCHED (Exact): ART-1010.png -> 1 товарів'), lines.join(' | '));
    assert.ok(lines.includes('NOT FOUND (Exact): NO-SUCH-CODE.png'), lines.join(' | '));
    assert.equal(photoUpdates().length, before + 1);
    assert.match(photoUpdates().at(-1).where, /id=in\.\(1010\)/);
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const phone = async (browser, url) => {
  const shop = await openShop(browser, url, { user: OWNER(), device: 'iPhone 13', tables: (t) => t.suppliers.push({ id: 2, name: 'Omega' }) });
  const { page, fake } = shop;
  const ui = actions(shop);
  const S = 'settings-phone';

  await step(shop, S, 'settings on a phone', async () => {
    await ui.goto(`${url}/admin`);
    await ui.click(page.getByRole('button', { name: 'Ще' }));
    await ui.click(page.locator('div.fixed.inset-0').getByRole('button', { name: 'Налаштування' }));
    await until(async () => assert.ok(await page.getByPlaceholder('Назва постачальника').isVisible()));
    await until(async () => assert.equal(await page.locator('h5').count(), 2));
  });

  for (const [name, title, mark] of [
    ['contacts', 'Контакти', 'Контактна Інформація'],
    ['keys', 'API Ключі', 'Безпека та Ключі'],
    ['staff access', 'Менеджер / Доступ', 'Вхід для Менеджера'],
    ['stock and import', 'Склад / Імпорт', 'Розумне завантаження фото'],
  ]) {
    await step(shop, S, name, async () => {
      await ui.click(part(page, title));
      await until(async () => assert.ok(await page.getByText(mark).first().isVisible()));
    });
  }

  await shop.context.close();
};

runScenarios('settings', { keys, suppliers, photos, phone });
