# Завдання: розділ «Сайт» у програмі (інтеграція з сайтом forsage-tires.com)

## Контекст

У нас дві бази Supabase в одній організації:
- **Програма** (CRM/каса): проєкт `zuhanlspejgizjbwbnda` (crm forsage new). Головна база — SQLite на касі, облако — копія.
- **Сайт** (інтернет-магазин www.forsage-tires.com): проєкт `zzxueclhkhvwdmxflmyx` (Forsagetires).

Розподіл роботи:
- **Синхронізацію товарів, цін і залишків робить сайт сам.** Він кожні 2–3 хвилини читає з облака програми діючі товари (`products`: `is_active`, `deleted_at is null`, `qty_on_hand > 0`, ціна `retail_price` у копійках, категорія, бренд). **Програмі для цього нічого робити не треба**, і не треба змінювати таблицю `products` або логіку синхронізації каси з облаком.
- **Шини** на сайті ведуться окремо, не з програми. Їх не чіпаємо.
- **Програма** отримує новий розділ **«Сайт»**, з якого менеджер сайту керує замовленнями з сайту, клієнтами сайту, фото й описами товарів для сайту, банерами, акціями, головною сторінкою, сторінками і налаштуваннями.

Важливо:
- **Замовлення з сайту живуть у базі сайту** і показуються **тільки у вкладці «Сайт»**. У загальний список замовлень програми (`customer_orders`) вони автоматично **не потрапляють**.
- Гроші приймаються тільки на касі, як і зараз. Онлайн-оплати поки немає.
- Telegram-бот буде пізніше. Зараз його не робимо, але закладіть місце під сповіщення.

## Як програма спілкується з сайтом

Через одну серверну функцію сайту («шлюз»):

```
POST https://zzxueclhkhvwdmxflmyx.supabase.co/functions/v1/site-api
Headers:
  Content-Type: application/json
  x-site-key: <SITE_API_KEY>
Body: { "action": "<назва дії>", ...параметри }
Відповідь: { "ok": true, "data": ... }  або  { "ok": false, "error": "текст помилки" }
```

Правила безпеки:
- `SITE_API_KEY` — секретний ключ. Зберігати **тільки на сервері програми** (Node.js на Vercel, змінна оточення `SITE_API_KEY`). **Не класти в Electron-клієнт і в веб-версію.** Клієнт ходить на свій сервер, а сервер програми проксює запит на шлюз сайту і додає ключ.
- На сервері програми перевіряти, що користувач має роль, якій дозволено розділ «Сайт» (власник і менеджер сайту).
- Кожну зміну, зроблену через розділ «Сайт», записувати в наявний `audit_log` програми (хто, що, коли).

## Дії шлюзу (контракт)

Гроші скрізь у **гривнях** (число з копійками, наприклад `1155.00`), дати — ISO 8601.

### Замовлення сайту
- `orders.list` `{ status?, search?, since?, limit?: 50, offset?: 0 }` → `[{ id, created_at, status, customer_name, customer_phone, customer_email, delivery_method, city, warehouse, comment, total, tracking_number, manager_comment, items: [{ product_id, program_product_id, title, qty, price }] }]`
- `orders.update` `{ id, status?, tracking_number?, manager_comment? }`
  Статуси: `new` (новий) → `confirmed` (підтверджено) → `shipped` (відправлено) → `completed` (виконано); також `canceled` (скасовано).
  Покупець бачить статус і номер ТТН у своєму кабінеті на сайті.
- `orders.unseen_count` `{}` → `{ count }` — кількість нових замовлень, для червоного значка на вкладці. Опитувати раз на 30–60 секунд, поки програма відкрита.

Кнопка **«Створити замовлення в програмі»** в картці замовлення сайту: створює звичайне `customer_orders` у базі програми з `source = 'website'` (позиції з `program_product_id` → `product_id`), щоб зарезервувати товар. Позиції без `program_product_id` (шини) додати текстовою приміткою. Після цього викликати `orders.update` з `manager_comment`, де вказано номер замовлення програми. Замовлення з `source = 'website'` показувати тільки у вкладці «Сайт», а не в загальних списках.

### Клієнти сайту
- `customers.list` `{ search?, limit?, offset? }` → `[{ id, email, full_name, phone, created_at, orders_count }]`

### Відгуки
- `reviews.list` `{ approved?: boolean }` → `[{ id, product_title, author_name, rating, body, created_at, approved }]`
- `reviews.moderate` `{ id, approved: boolean }`
- `reviews.delete` `{ id }`

### Товари з програми на сайті: опис, характеристики, видимість
Товари сайт бере сам. Програма лише **доповнює** їх даними для сайту:
- `products.site_fields.get` `{ program_product_id }` → `{ description, specs, hidden, seo_title, seo_description, photos: [{ full, thumb }] }`
- `products.site_fields.set` `{ program_product_id, description?, specs?: { "ключ": "значення" }, hidden?: boolean, seo_title?, seo_description? }`
  `hidden: true` — сховати товар на сайті, навіть якщо він є в наявності.
  Опис можна генерувати помічником ШІ програми, але менеджер має бачити його і підтвердити перед збереженням.

### Фото товарів (стискає програма, не сервер)
Для кожного фото програма робить **два файли у форматі WebP**:
- **full**: найбільша сторона до 1000 px, якість ~80, бажано до 70 КБ;
- **thumb**: найбільша сторона до 400 px, якість ~75, бажано до 20 КБ.

Порядок:
1. `photos.upload_url` `{ program_product_id, count }` → `[{ full: { upload_url, public_url }, thumb: { upload_url, public_url } }]`
2. Програма завантажує файли запитом `PUT upload_url` (тіло — байти файлу, `Content-Type: image/webp`).
3. `photos.attach` `{ program_product_id, photos: [{ full: public_url, thumb: public_url }] }` — у потрібному порядку, перше фото головне.
4. `photos.remove` `{ program_product_id, full }` — видалити одне фото.

Завантажувати тільки нові або змінені фото, не все підряд. Перше фото товару програма може також записати у свій `products.photo_url`, якщо так зручно.

### Категорії сайту
- `categories.list` `{}` → дерево категорій сайту `[{ id, name, slug, parent_id, icon, sort_order, is_active, program_category_ids: [uuid] }]`
- `categories.upsert` `{ id?, name, parent_id?, icon?, sort_order?, is_active?, program_category_ids?: [uuid] }`
  `program_category_ids` — які категорії програми показувати в цій категорії сайту (наприклад, «Автозапчастини → Фільтри» = категорія програми «Фільтри»). Кілька категорій програми можна об'єднати в одну на сайті (наприклад, «Инструмент ручной» і «Інструмент ручний»).
- `categories.delete` `{ id }`

Екран: зліва категорії програми, справа категорії сайту; менеджер перетягує або вибирає, куди що показувати.

### Банери (слайдер на головній)
- `banners.list` `{}` → `[{ id, title, subtitle, image_url, image_mobile_url, button_text, link, starts_at, ends_at, sort_order, is_active }]`
- `banners.upsert` `{ id?, ...поля }`, `banners.delete` `{ id }`
- Картинки банерів: `photos.upload_url` з `{ kind: "banner", count }` (розміри: ПК 1600×500, телефон 800×600, WebP).

### Акції
- `promos.list` `{}` → `[{ id, title, discount_percent, target_type: "product"|"category"|"brand"|"all", target_ids: [], starts_at, ends_at, badge_text, is_active }]`
- `promos.upsert` `{ id?, ...поля }`, `promos.delete` `{ id }`
  Сайт сам показує стару і нову ціну та значок «−N%» на час дії акції. Ціну в програмі акція **не змінює**.

### Головна сторінка
- `home.get` `{}` → `{ blocks: [{ type, enabled, title? }] }`
- `home.set` `{ blocks: [...] }` — порядок і ввімкнення блоків.
  Типи: `banners`, `size_search` (підбір шин за розміром), `categories`, `hits`, `promos`, `benefits`, `reviews`, `articles`.

### Сторінки і статті
- `pages.list` `{}` → `[{ id, type: "article"|"info", slug, title, content, image_url, created_at }]`
- `pages.upsert` `{ id?, type, title, content, image_url? }`, `pages.delete` `{ id }`
  Інфо-сторінки (`delivery`, `warranty`, `about`, `contacts`, `faq`) — тільки редагування, без видалення.
  Формат тексту: звичайний текст, порожній рядок — новий абзац, короткий рядок без крапки в кінці — підзаголовок.

### Налаштування сайту
- `settings.get` `{}` → `{ "ключ": "значення" }`
- `settings.set` `{ values: { "ключ": "значення" } }`
  Дозволені ключі: `contact_phone1`, `contact_phone2`, `contact_address`, `contact_viber`, `contact_telegram`, `seo_title`, `seo_description`, `legal_seller_name`, `legal_seller_code`, `legal_seller_address`, `legal_seller_email`, `ga_measurement_id`, `fb_pixel_id`.

## Що зробити в програмі

1. **Сервер програми**: модуль-проксі `siteApi(action, params)` з ключем із `SITE_API_KEY`, перевіркою ролі, записом в `audit_log`, тайм-аутом 15 с і зрозумілими повідомленнями про помилки (українською).
2. **Роль «Менеджер сайту»**: бачить тільки розділ «Сайт» (і, якщо треба, перегляд товарів і залишків). Власник бачить усе.
3. **Розділ «Сайт»** з вкладками:
   - **Замовлення** — список зі статусами, фільтрами, пошуком; картка замовлення; зміна статусу, ТТН, коментар; кнопка «Створити замовлення в програмі»; червоний значок кількості нових.
   - **Клієнти** — список зареєстрованих покупців сайту.
   - **Товари на сайті** — пошук товару програми; опис (з кнопкою «Згенерувати ШІ»), характеристики, «Сховати на сайті», SEO; фото з перетягуванням, автоматичним стисненням у full і thumb та зміною порядку.
   - **Категорії** — відповідність категорій програми категоріям сайту.
   - **Банери**, **Акції**, **Головна сторінка**, **Сторінки і статті**, **Відгуки**, **Налаштування**.
   - Кнопка **«Відкрити сайт»** (https://www.forsage-tires.com) у шапці розділу.
4. **Масове завантаження фото**: вибрати папку, де файли названі артикулом (sku) або штрихкодом товару, і програма сама знайде товари, стисне фото й завантажить.
5. Під майбутній Telegram-бот: функція «нове замовлення з сайту» має викликати одне місце в коді (`notifyNewSiteOrder(order)`), яке поки нічого не робить.

## Чого НЕ робити
- Не змінювати таблицю `products`, синхронізацію каси з облаком і RLS-правила облака програми.
- Не зберігати `SITE_API_KEY` у клієнтській частині та в git.
- Не писати в базу сайту напряму, тільки через шлюз `site-api`.
- Не показувати на сайті закупівельні, оптові та мінімальні ціни (сайт їх і так не бере).

## Як перевірити
1. Дія `orders.list` повертає `ok: true` (якщо замовлень немає, порожній список).
2. Завантажити фото для одного товару: воно з'являється на сайті протягом ~3 хвилин.
3. Створити банер з датами на сьогодні: він з'являється на головній сайту.
4. Змінити статус тестового замовлення: покупець бачить його в кабінеті на сайті.

## Доповнення (шлюз уже працює)
- Дія `ping` `{}` → `{ site, time, catalog_sync: { last_ok_at, last_error } }` — перевірка зв'язку і стану синхронізації товарів.
- `orders.list` повертає також `payment_method` і `is_new` (замовлення ще не переглядали). Після виклику `orders.list` показані замовлення позначаються як переглянуті.
- `pages.list` для інфо-сторінок повертає `title: null, content: null, customized: false`, поки текст не змінювали з програми — тоді сайт показує свій стандартний текст.
- `photos.upload_url` для банера (`kind: "banner"`) повертає пари `{ full, mobile }`.
- `reviews.moderate` приймає також `admin_reply` (відповідь магазину).
- `categories.upsert` з `program_category_ids` одразу переносить у цю категорію вже синхронізовані товари.

## Доповнення 3: фото, знайдені сайтом → у програму
- Дія `photos.auto_list` `{ since?, limit?: 200 }` → `[{ program_product_id, full, thumb, found_at }]` — фото, які сайт знайшов в інтернеті і які пройшли перевірку ШІ (той самий товар, білий фон, без написів).
- Програма раз на годину (або кнопкою) забирає нові: передає в `since` останній отриманий `found_at`, завантажує файли `full` у своє сховище/локальну базу і прив'язує до товару з позначкою «авто-фото».
- Якщо в програмі в товару є своє фото (`products.photo_url` / `product_photos`), сайт показує саме його — воно завжди важливіше за знайдене автоматично. Так само `photos.attach` з програми замінює авто-фото.

## Доповнення 4: крос-номери та допуски масел

**Крос-номери.** Масив `numbers` у `site_catalog_export` (OEM, крос-номери, артикул, штрихкод) уже передається. Сайт вважає товари точними аналогами, якщо в них збігається хоча б один номер довжиною від 4 символів. Такий аналог позначається значком «Точний аналог». Тож у програмі достатньо зберігати крос-номери товару — нічого більше не потрібно.

**Допуски масел.** Додайте в кожен товар `site_catalog_export` поле `approvals` — масив рядків, наприклад:

```json
"approvals": ["ACEA A3/B4", "API SN/CF", "VW 502 00", "VW 505 00", "MB 229.5", "BMW LL-01", "RN0700"]
```

- Писати можна як завгодно: «VW 502 00», «VW 502.00», «MB 229.5». Сайт сам приводить їх до одного вигляду, а «ACEA A3/B4» розкладає на «ACEA A3» і «ACEA B4».
- Також приймаються `specs.approvals` (масив) або рядок `approvals` через кому чи крапку з комою.
- Поки поля немає, сайт бере допуски з назви товару.

**Порядок аналогів масла на сайті:**

1. точний аналог за крос-номером;
2. те саме масло іншого об'єму;
3. та сама в'язкість і ті самі допуски інших фірм — що більше спільних допусків, то вище;
4. просто та сама в'язкість.

## Доповнення 5: форум і просування сайту (SEO) через шлюз

Усе через той самий шлюз `site-api` з ключем `x-site-key`. Програма пише на форум **від імені магазину** («Форсаж (магазин)»).
ШІ на самому сайті вимкнено: заголовки й описи для Google тепер пише ШІ-помічник програми.

### Форум
- `forum.sections.list` `{}` → `[{ id, parent_id, slug, name, description, sort_order }]`
- `forum.sections.upsert` `{ id?, name, description?, parent_id?, sort_order?, slug? }` — створити або змінити розділ
- `forum.sections.delete` `{ id }` — лише порожній розділ
- `forum.topics.list` `{ section?, since?, search?, hidden?, from_shop?, limit?: 50, offset? }` → `[{ id, title, section, author_name, is_shop, is_pinned, is_locked, is_hidden, replies_count, views, last_reply_at, url }]`
- `forum.topic.get` `{ id }` → тема з `body` і `posts: [{ id, parent_id, author_name, is_shop, body, images, is_hidden, created_at }]`
- `forum.topics.create` `{ section (slug або id), title, body, images?: [url], pinned?, locked? }` → нова тема з `url`
- `forum.topics.update` `{ id, title?, body?, images?, section?, pinned?, locked?, hidden? }`
- `forum.topics.delete` `{ id }`
- `forum.posts.create` `{ topic_id, body, parent_id?, images? }` — відповідь (з `parent_id` — відповідь на конкретне повідомлення)
- `forum.posts.update` `{ id, body?, images?, hidden? }`, `forum.posts.delete` `{ id }`
- `forum.stats` `{ days?: 7 }` → нові теми, відповіді, хто писав, нові покупці, популярні теми, найактивніші
- `forum.photos.upload_url` `{ count?: 1, ext?: 'jpg' | 'webp' }` → `[{ upload_url, public_url }]`: фото стиснути в програмі (до ~1600 px), завантажити PUT-запитом на `upload_url`, у тему передати `public_url`.

Текст теми — звичайний текст, абзаци через порожній рядок. Пишіть корисно і чесно, з прив'язкою до Синельникового там, де це доречно
(адреса вул. Квітнева, 9, телефони). Не вигадуйте відгуків і діалогів від імені «покупців».

### SEO товарів
- `seo.products.missing` `{ limit?: 100, offset?, field?: 'description' }` → товари на сайті без заголовка/опису для Google:
  `[{ program_product_id, title, brand, price, category, has_description, seo_title, seo_description }]`
- `seo.products.set` `{ items: [{ program_product_id, seo_title?, seo_description?, seo_keywords?, description? }] }` (до 500 за раз) → `{ saved, not_on_site }`
  - `seo_title` — до 60 символів: назва + головна перевага + «Синельникове/Форсаж» за потреби
  - `seo_description` — 140–160 символів: що це, для чого, наявність/доставка
  - `description` — текст опису на сторінці товару (без вигаданих характеристик)
- Ще можна надсилати ці поля разом із товаром у `site_catalog_export` (`seo_title`, `seo_description`, `seo_keywords`) — синхронізація підхопить.
- Також працює для одного товару: `products.site_fields.set` (є `seo_keywords`).

### SEO розділів каталогу
- `seo.categories.list` `{}` → `[{ id, name, slug, url, description, seo_title, seo_description, noindex, faq }]`
- `seo.categories.set` `{ id, seo_title?, seo_description?, description? (текст під товарами), faq?: [{ q, a }] (до 20), noindex? }`

### SEO сайту загалом
- `seo.settings.get` `{}` → усі ключі `seo_*`
- `seo.settings.set` `{ values: { seo_title, seo_description, seo_keywords, seo_image, seo_hours: "Mo-Su 08:00-19:00", seo_founded, seo_tpl_title, seo_tpl_desc, seo_gsc_verify ... } }` — лише ключі, що починаються з `seo_`
- `seo.health` `{}` → оцінка: скільки товарів без заголовка/опису, дублі назв, задовгі заголовки, товари без фото й тексту, розділи без тексту
- `seo.redirects.list` / `seo.redirects.set { from_path, to_path }` / `seo.redirects.delete { from_path }` — перенаправлення старих адрес

### Статті й сторінки
Як і раніше: `pages.list`, `pages.upsert`, `pages.delete` (статті та інфо-сторінки доставка/гарантія/про нас/контакти/FAQ).

## Доповнення 6. Рекомендовані товари обирає програма

Рекомендовані товари показуються на головній у блоці «Рекомендуємо / Хіти та акції» і першими в порядку «Рекомендовані» в кожному розділі.

Два способи (будь-який):

1. **В експорті каталогу** (`site_catalog_export`): поле `recommended: true | false` у товару. Якщо поля немає — сайт нічого не змінює.
2. **Через шлюз** `site-api`:
   - `products.recommended.list` → список рекомендованих: `id, program_product_id, supplier_offer_id, title, price, in_stock`.
   - `products.recommended.set` `{ program_product_ids?: uuid[], supplier_offer_ids?: string[], ids?: number[], on?: true|false, replace?: true }`
     - `on: false` — прибрати з рекомендованих;
     - `replace: true` — рекомендованими стають рівно ці товари, решта знімається.
     - Відповідь: `{ changed, not_found, recommended_total }`.

Партнерські товари (GPL / Omega) теж можна рекомендувати — через `supplier_offer_ids` (= external_id пропозиції).

## Доповнення 7. Свободный остаток: бронь под заказы

Сайт продаёт только СВОБОДНЫЙ остаток:
`свободно = qty_on_hand − бронь программы (products.reserved.set) − оплаченные заказы сайта, которые программа ещё не забрала`.
Отрицательное значение считается как 0. Наличие, количество (`stock_mode = qty`), фильтр «в наличии», фиды и карта сайта — всё по свободному остатку.
Неоплаченные заказы товар не бронируют. Таблицы программы сайт не трогает.

- `products.reserved.set` `{ replace_all: boolean, items: [{ program_product_id, qty }] }` → `{ saved }`
  - `qty` ≥ 0, до 3 знаков после запятой; `qty: 0` — бронь снята.
  - `replace_all: true` — полный список: товары, которых в нём нет, получают бронь 0. Шлите при запуске и раз в 3–10 минут.
  - `replace_all: false` — только перечисленные товары. Шлите сразу после создания, выдачи или отмены заказа.
  - Не больше 1000 позиций за вызов. Если больше: первый вызов `replace_all: true`, остальные `false`.
  - Частота: изменения — сразу, сколько нужно; полный список — не чаще раза в минуту.
- `orders.list` — новые фильтры `paid: true|false`, `synced: true|false` и поля `paid, paid_at, paid_amount, program_order_id, program_order_number, synced_at`.
  Оплаченные и ещё не забранные: `orders.list { paid: true, synced: false }`.
- `orders.mark_synced` `{ id, program_order_id, program_order_number? }` → заказ забран; с этого момента его товар считается в брони программы и второй раз не вычитается.
  Сначала создайте заказ и пришлите бронь (`products.reserved.set` с `replace_all: false`), потом `orders.mark_synced`.
- Перед созданием онлайн-платежа сайт проверяет свободный остаток каждой позиции; если не хватает — платёж не создаётся («Товару вже немає в потрібній кількості»).
- Отметить заказ оплаченным может только сервер сайта (платёжный модуль) или персонал; покупатель — нет.
