/**
 * Browser test of the forum: replies to a particular message (tree), a person's profile with the garage,
 * following, private messages, and the forum moderator who sees only the forum in the admin panel.
 * The database is the same in-memory fake as in the shop test.
 *
 * Run:  npm run build && npm run e2e          (one scenario:  node tests/e2e/forum.e2e.cjs people)
 */
const assert = require('node:assert/strict');
const { openShop, step, fixtures, actions, until, runScenarios } = require('./harness.cjs');

const expectPath = (page, path) => until(async () => { const u = new URL(page.url()); assert.equal(u.pathname + u.search, path); });
const T0 = '2026-11-20T10:00:00+00:00';

const forumTables = (t) => {
  t.forum_sections = [{ id: 1, parent_id: null, slug: 'shyny', name: 'Шини', description: 'Про шини', sort_order: 1 }];
  t.forum_topics = [{ id: 1, created_at: T0, author_name: 'Олег П.', author_pid: 7, author_avatar: 'emoji:🚙', is_shop: false, category: 'shyny', title: 'Які шини на Ланос?',
    body: 'Порадьте зимові шини R13', images: [], is_pinned: false, is_hidden: false, is_locked: false, replies_count: 2, last_reply_at: T0, views: 5, edited_at: null }];
  t.forum_posts = [
    { id: 10, topic_id: 1, parent_id: null, created_at: T0, author_name: 'Магазин', author_pid: null, is_shop: true, body: 'Беріть 175/70 R13', images: [], is_hidden: false, edited_at: null, author_avatar: null },
    { id: 11, topic_id: 1, parent_id: 10, created_at: T0, author_name: 'Іван К.', author_pid: 8, is_shop: false, body: 'Дякую, а які саме?', images: [], is_hidden: false, edited_at: null, author_avatar: null },
  ];
};
const PROFILE = (over = {}) => ({
  pid: 7, name: 'Олег П.', avatar: 'emoji:🚙', about: 'Їжджу на Ланосі', city: 'Синельникове', joined: T0, topics: 1, posts: 3,
  followers: 2, following: 1, friends: 0, is_me: false, i_follow: false, follows_me: true,
  cars: [{ id: 1, make: 'Daewoo', model: 'Lanos', year: 2008, engine: '1.5 бензин', nickname: 'Ластівка', about: 'Поставив нову гуму', photos: [] }],
  recent: [{ id: 1, title: 'Які шини на Ланос?', created_at: T0 }], ...over,
});

// ---------------------------------------------------------------------------------------------
const people = async (browser, url) => {
  const shop = await openShop(browser, url, { user: fixtures.session('buyer@test.ua', 'user-1'), viewport: { width: 1366, height: 900 }, tables: forumTables });
  const { page, fake } = shop;
  const ui = actions(shop);
  const S = 'forum-people';
  const calls = [];
  fake.rpc.forum_me = () => ({ pid: 3, name: 'Тест', avatar: null, about: null, city: null });
  fake.rpc.forum_unread = () => 2;
  fake.rpc.forum_profile = (a) => { calls.push(['profile', a]); return PROFILE(); };
  fake.rpc.forum_follow = (a) => { calls.push(['follow', a]); return PROFILE({ i_follow: a.p_on, friends: a.p_on ? 1 : 0, followers: a.p_on ? 3 : 2 }); };
  const sent = [];
  fake.rpc.forum_thread = () => ({ with: { pid: 7, name: 'Олег П.', avatar: null }, messages: [
    { id: 1, body: 'Привіт! Яка гума стоїть?', at: T0, mine: false, read: true },
    ...sent.map((b, i) => ({ id: 100 + i, body: b, at: T0, mine: true, read: false })),
  ] });
  fake.rpc.forum_send = (a) => { sent.push(a.p_body); calls.push(['send', a]); return 100; };

  await step(shop, S, 'replies as a tree', async () => {
    await ui.goto(`${url}/forum/1-yaki-shyny`);
    await until(async () => assert.ok(await page.getByText('Дякую, а які саме?').isVisible()));
    assert.ok(await page.getByText('у відповідь Магазин').isVisible(), 'the answer says whom it answers');
    assert.ok(await page.getByRole('link', { name: /Повідомлення/ }).getByText('2').isVisible(), 'unread messages in the top bar');
  });

  await step(shop, S, 'answer a particular message', async () => {
    await ui.click(page.locator('#post-11').getByRole('button', { name: 'Відповісти' }));
    await ui.fill(page.getByPlaceholder('Ваша відповідь').first(), 'Nokian Nordman 7, дуже добрі');
    await ui.click(page.getByRole('button', { name: 'Відповісти Іван К.' }));
    await until(async () => assert.equal((fake.inserted.forum_posts || []).length, 1));
    const p = fake.inserted.forum_posts[0];
    assert.deepEqual([p.topic_id, p.parent_id, p.body], [1, 11, 'Nokian Nordman 7, дуже добрі']);
  });

  await step(shop, S, 'author name opens the profile', async () => {
    await ui.click(page.getByRole('link', { name: 'Олег П.', exact: true }).first());
    await expectPath(page, '/forum/user-7');
    await until(async () => assert.ok(await page.getByRole('heading', { name: 'Олег П.' }).isVisible()));
    assert.ok(await page.getByText('Daewoo Lanos 2008').isVisible(), 'the garage shows the car');
    assert.ok(await page.getByText('«Ластівка» · 1.5 бензин').isVisible());
    assert.ok(await page.getByText('підписаний(а) на вас').isVisible());
  });

  await step(shop, S, 'follow back = friends', async () => {
    await ui.click(page.getByRole('button', { name: 'Підписатися у відповідь' }));
    await until(async () => assert.ok(await page.getByText('ви друзі').isVisible()));
    assert.deepEqual(calls.find((c) => c[0] === 'follow')[1], { p_pid: 7, p_on: true });
    assert.ok(await page.getByRole('button', { name: 'Ви підписані' }).isVisible());
  });

  await step(shop, S, 'private message', async () => {
    await ui.click(page.getByRole('button', { name: 'Написати' }));
    await expectPath(page, '/forum/messages?to=7');
    await until(async () => assert.ok(await page.getByText('Привіт! Яка гума стоїть?').isVisible()));
    await ui.fill(page.getByPlaceholder('Повідомлення'), 'Nokian, взимку їде добре');
    await ui.click(page.getByRole('button', { name: 'Надіслати' }));
    await until(async () => assert.ok(calls.find((c) => c[0] === 'send'), 'the message is sent'));
    assert.deepEqual(calls.find((c) => c[0] === 'send')[1], { p_pid: 7, p_body: 'Nokian, взимку їде добре' });
    await until(async () => assert.equal(await page.getByPlaceholder('Повідомлення').inputValue(), ''), 'the field is emptied');
    await until(async () => assert.ok(await page.locator('div.bg-\\[\\#FFC300\\]', { hasText: 'Nokian, взимку їде добре' }).isVisible(), 'my message in the conversation'));
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const garage = async (browser, url) => {
  const shop = await openShop(browser, url, { user: fixtures.session('buyer@test.ua', 'user-1'), device: 'iPhone 13', tables: (t) => { forumTables(t); t.user_cars = []; } });
  const { page, fake } = shop;
  const ui = actions(shop);
  const S = 'forum-garage';
  fake.rpc.forum_me = () => ({ pid: 3, name: 'Тест', avatar: null, about: null, city: null });
  fake.rpc.forum_profile = () => ({ ...PROFILE({ pid: 3, name: 'Тест', is_me: true, cars: [], follows_me: false }) });

  await step(shop, S, 'my profile from the forum', async () => {
    await ui.goto(`${url}/forum`);
    await ui.click(page.getByRole('link', { name: 'Мій профіль і гараж' }));
    await expectPath(page, '/forum/user-3');
    await until(async () => assert.ok(await page.getByText('Додайте своє авто з фото').isVisible()));
  });

  await step(shop, S, 'add a car', async () => {
    await ui.click(page.getByRole('button', { name: 'Додати авто' }));
    await ui.fill(page.getByLabel('Марка'), 'Nissan');
    await ui.fill(page.getByLabel('Модель'), 'Navara D40');
    await ui.fill(page.getByLabel('Рік'), '2008');
    await ui.fill(page.getByLabel('Двигун'), '2.5 dCi');
    await ui.click(page.getByRole('button', { name: 'Зберегти авто' }));
    await until(async () => assert.equal((fake.inserted.user_cars || []).length, 1));
    const c = fake.inserted.user_cars[0];
    assert.deepEqual([c.make, c.model, c.year, c.engine], ['Nissan', 'Navara D40', 2008, '2.5 dCi']);
    await until(async () => assert.ok(await page.getByText('Nissan Navara D40 2008').isVisible()));
  });

  await shop.context.close();
};

// ---------------------------------------------------------------------------------------------
const moderator = async (browser, url) => {
  const shop = await openShop(browser, url, { user: fixtures.session('mod@test.ua', 'mod-1'), viewport: { width: 1366, height: 900 }, tables: forumTables });
  const { page, fake } = shop;
  const ui = actions(shop);
  const S = 'forum-moderator';
  fake.rpc.is_forum_mod = () => true;
  fake.rpc.forum_stats = () => ({ topics: 4, posts: 9, writers: 3, users_total: 12, users_new: 2, top_topics: [], top_authors: [] });

  await step(shop, S, 'admin shows only the forum', async () => {
    await ui.goto(`${url}/admin`);
    await until(async () => assert.ok(await page.getByText('Які шини на Ланос?').first().isVisible()));
    assert.equal(await page.getByRole('button', { name: 'Замовлення', exact: true }).count(), 0, 'no orders for a moderator');
    assert.equal(await page.getByRole('button', { name: 'Модератори' }).count(), 0, 'a moderator cannot add moderators');
  });

  await step(shop, S, 'forum figures', async () => {
    await ui.click(page.getByRole('button', { name: 'Статистика' }));
    await until(async () => assert.ok(await page.getByText('нових тем').isVisible()));
    assert.ok(await page.getByText('нових покупців (усього 12)').isVisible());
  });

  await shop.context.close();
};

const owner = async (browser, url) => {
  const shop = await openShop(browser, url, { user: fixtures.session('owner@test.ua', 'owner-1'), viewport: { width: 1366, height: 900 }, tables: (t) => { forumTables(t); t.forum_moderators = []; t.telegram_invites = []; } });
  const { page, fake } = shop;
  const ui = actions(shop);
  const S = 'forum-owner';

  await step(shop, S, 'add a moderator and invite to Telegram', async () => {
    await ui.goto(`${url}/admin`);
    await ui.click(page.getByRole('navigation').getByRole('button', { name: 'Форум', exact: true }).first());
    await ui.click(page.getByRole('button', { name: 'Модератори' }));
    await ui.fill(page.getByLabel('E-mail модератора'), 'Mod@Test.ua');
    await ui.click(page.getByRole('button', { name: 'Додати', exact: true }));
    await until(async () => assert.deepEqual((fake.inserted.forum_moderators || []).map((r) => r.email), ['mod@test.ua']));
    await ui.click(page.getByRole('button', { name: 'Запросити в Telegram' }));
    await until(async () => assert.equal((fake.inserted.telegram_invites || []).length, 1));
    assert.equal(fake.inserted.telegram_invites[0].role, 'forum');
    await until(async () => assert.ok(await page.getByText(/t\.me\/Forsageshop_bot\?start=/).isVisible()));
  });

  await step(shop, S, 'edit a topic in place: text saves by itself', async () => {
    await ui.click(page.getByRole('button', { name: /Які шини на Ланос\?/ }));
    const title = page.getByLabel('Заголовок теми');
    await ui.fill(title, 'Які шини взяти на Ланос?');
    await until(async () => assert.ok((fake.inserted['forum_topics:update'] || []).some((u) => u.set.title === 'Які шини взяти на Ланос?')), 'the title is saved without a button');
    await until(async () => assert.ok(await page.getByText('збережено').first().isVisible()));
  });

  await step(shop, S, 'paste a photo from the clipboard', async () => {
    await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 20; c.height = 20;
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const dt = new DataTransfer(); dt.items.add(new File([blob], 'shot.png', { type: 'image/png' }));
      document.querySelector('[aria-label="Текст теми"]').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    });
    await until(async () => assert.ok((fake.inserted['forum_topics:update'] || []).some((u) => Array.isArray(u.set.images) && u.set.images.length === 1)), 'the pasted photo is saved to the topic');
    assert.equal(await page.getByRole('button', { name: 'Прибрати фото' }).count(), 1);
  });

  await step(shop, S, 'hiding needs a confirmation', async () => {
    let asked = '';
    page.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
    await ui.click(page.getByRole('button', { name: 'Ще', exact: true }));
    await ui.click(page.getByRole('button', { name: 'Сховати' }).first());
    await until(async () => assert.match(asked, /Сховати тему/));
    assert.ok(!(fake.inserted['forum_topics:update'] || []).some((u) => u.set.is_hidden === true), 'nothing hidden after «no»');
  });

  await shop.context.close();
};

runScenarios('forum', { people, garage, moderator, owner });
