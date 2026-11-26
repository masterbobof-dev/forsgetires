/**
 * Test data for the browser tests: a small shop that looks like the real one
 * (tyres with sizes and seasons, batteries and wheels with characteristics, a section with more than one page of goods).
 * Rows have the same columns the real `tyres` table returns, including generated ones (has_photo, price_num).
 */
const svg = (color, text = '') => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${color}"/><circle cx="200" cy="200" r="140" fill="#ffffff55"/><text x="200" y="215" font-size="48" text-anchor="middle" font-family="sans-serif">${text}</text></svg>`)}`;

const cat = (id, name, slug, parent_id, kind, extra = {}) => ({
  id, name, slug, parent_id, kind, icon: null, description: null, seo_title: null, seo_description: null, sort_order: id, is_active: true,
  vehicle_type: null, filter_preset: null, noindex: false, program_category_ids: null, seo_draft: null, created_at: '2026-01-01T00:00:00+00:00', ...extra,
});
const categories = [
  cat(1, 'Шини', 'shyny', null, 'tyre', { icon: 'circle-dot', description: 'Літні, зимові та всесезонні шини.\nПідберемо за розміром.', seo_title: 'Автомобільні шини — купити у Синельниковому | Форсаж' }),
  cat(6, 'Легкові', 'shyny-legkovi', 1, 'tyre', { icon: 'car', vehicle_type: 'car' }),
  cat(7, 'SUV / 4x4', 'shyny-suv', 1, 'tyre', { icon: 'mountain', vehicle_type: 'suv' }),
  cat(10, 'Агро / Спец', 'shyny-agro', 1, 'tyre', { icon: 'tractor', vehicle_type: 'agro' }),
  cat(2, 'Диски', 'dysky', null, 'generic', { icon: 'disc', filter_preset: 'wheels' }),
  cat(3, 'Акумулятори', 'akumulyatory', null, 'generic', { icon: 'battery', filter_preset: 'batteries', seo_description: 'Акумулятори для авто в наявності.' }),
  cat(5, 'Автотовари', 'avtotovary', null, 'generic', { icon: 'package' }),
  cat(115, 'Клеми', 'klemy', 5, 'generic', { icon: 'plug', filter_preset: 'terminals' }),
  cat(99, 'Порожній розділ', 'porozhniy', null, 'generic'),
];

let minute = 0;
const product = (id, title, price, extra = {}) => {
  const p = {
    id, title, description: null, price: Number(price).toFixed(2), old_price: null, base_price: null,
    catalog_number: `ART-${id}`, product_number: null, manufacturer: null,
    image_url: null, image_thumb_url: null, gallery: [], gallery_thumbs: [],
    radius: null, season: null, vehicle_type: null, axis: null,
    created_at: new Date(Date.UTC(2026, 10, 20, 10, 0, 0) - (minute++) * 60000).toISOString(),
    in_stock: true, is_hot: false, stock_quantity: 5, supplier_id: null,
    category_id: null, attributes: {}, auto_approvals: [],
    seo_title: null, seo_description: null, seo_keywords: null, slug: null,
    program_product_id: `prog-${id}`, on_order: false, hidden_on_site: null, search_numbers: `ART${id}`,
    ...extra,
  };
  p.has_photo = !!p.image_url;
  p.price_num = Number(p.price);
  return p;
};
const tyre = (id, title, price, manufacturer, radius, season, category_id, extra = {}) =>
  product(id, title, price, { manufacturer, radius, season, category_id, vehicle_type: { 6: 'car', 7: 'suv', 10: 'agro' }[category_id] || 'car', ...extra });

const products = [
  // --- tyres ---
  tyre(1001, 'Hankook Kinergy Eco2 K435 205/55 R16 91H', 2890, 'Hankook', 'R16', 'summer', 6, { is_hot: true, image_url: svg('#3b82f6', 'K435'), gallery: [svg('#3b82f6', 'K435'), svg('#1d4ed8', '2'), svg('#1e3a8a', '3')], old_price: '3200.00', description: 'Літня шина для легкових авто.\nТиха та економна.' }),
  tyre(1002, 'Laufenn i FIT Ice LW71 205/55 R16 94T', 3150, 'Laufenn', 'R16', 'winter', 6, { is_hot: true, image_url: svg('#0ea5e9', 'LW71') }),
  tyre(1003, 'Michelin Alpin 6 195/65 R15 91T', 3990, 'Michelin', 'R15', 'winter', 6, { image_url: svg('#64748b', 'A6') }),
  tyre(1004, 'Premiorri Solazo 185/65 R14 86H', 1650, 'Premiorri', 'R14', 'summer', 6),
  tyre(1005, 'Hankook Ventus Prime3 K125 195/65 R15 91V', 2740, 'Hankook', 'R15', 'summer', 6, { image_url: svg('#22c55e', 'K125') }),
  tyre(1006, 'Rosava Itegro 175/70 R13 82H', 1290, 'Rosava', 'R13', 'summer', 6, { stock_quantity: 2 }),
  tyre(1007, 'Nokian Hakkapeliitta R3 205/55 R16 94R', 4800, 'Nokian', 'R16', 'winter', 6, { on_order: true, price: '0.00', program_product_id: null, stock_quantity: 0 }),
  tyre(1008, 'Barum Polaris 5 185/65 R15 88T', 2100, 'Barum', 'R15', 'winter', 6, { in_stock: false, stock_quantity: 0 }),
  tyre(1009, 'Belshina Artmotion 195/65 R15 91H', 1500, 'Belshina', 'R15', 'all-season', null, { program_product_id: null }), // old tyre without a section
  tyre(1010, 'Kumho Road Venture AT52 215/65 R16 98T', 4619, 'Kumho', 'R16', 'all-season', 7, { image_url: svg('#a16207', 'AT52') }),
  tyre(1011, 'Hankook Dynapro HP2 RA33 225/65 R17 102H', 5120, 'Hankook', 'R17', 'summer', 7),
  tyre(1020, 'Шина 9,5-24 6PR KNK50 (OZKA)', 8024, 'OZKA', 'R24', null, 10, { image_url: svg('#854d0e', 'KNK50') }),
  tyre(1021, 'Шина 12,4-32 8PR SGP-04 (Kabat)', 13213, 'Kabat', 'R32', null, 10),
  tyre(1022, 'Шина 10,5/80-18 12PR KNK48 (OZKA)', 6929, 'OZKA', 'R18', null, 10),
  // --- batteries ---
  product(2001, 'Акумулятор VARTA Blue Dynamic 60Ah 540A R+', 3890, { manufacturer: 'VARTA', category_id: 3, is_hot: true, image_url: svg('#1e40af', '60Ah'), attributes: { capacity: '60', polarity: 'right', body: 'euro', current: '540', size: '242×175×175', voltage: '12' } }),
  product(2002, 'Акумулятор Bosch S4 74Ah 680A L+', 4650, { manufacturer: 'Bosch', category_id: 3, attributes: { capacity: '74', polarity: 'left', body: 'euro', current: '680', voltage: '12' } }),
  product(2003, 'Акумулятор FORSE Asia 45Ah 330A R+', 2790, { manufacturer: 'FORSE', category_id: 3, image_url: svg('#b91c1c', '45Ah'), attributes: { capacity: '45', polarity: 'right', body: 'asia', current: '330', voltage: '12' } }),
  product(2004, 'Акумулятор Westa 100Ah 850A R+', 5200, { manufacturer: 'Westa', category_id: 3, is_hot: true, image_url: svg('#15803d', '100Ah'), attributes: { capacity: '100', polarity: 'right', body: 'euro', current: '850', voltage: '12' } }),
  // --- wheels ---
  product(3001, 'Диск литий Replica R16 6.5J 5x112 ET46', 4200, { manufacturer: 'Replica', category_id: 2, image_url: svg('#9ca3af', 'R16'), is_hot: true, attributes: { diameter: '16', pcd: '5x112', width: '6.5', et: '46', dia: '57.1', type: 'alloy' } }),
  product(3002, 'Диск сталевий KFZ R15 6J 4x100 ET40', 1350, { manufacturer: 'KFZ', category_id: 2, attributes: { diameter: '15', pcd: '4x100', width: '6', et: '40', dia: '60.1', type: 'steel' } }),
  // --- terminals (sub-section of "Автотовари") ---
  product(4001, 'Клема акумуляторна Voice BT-09 (+)', 295, { manufacturer: 'Voice', category_id: 115, attributes: { term_pole: 'plus', material: 'brass' } }),
  product(4002, 'Клема акумуляторна Voice BT-09 (-)', 295, { manufacturer: 'Voice', category_id: 115, attributes: { term_pole: 'minus', material: 'brass' } }),
  product(4003, 'Клеми акумуляторні свинцеві (комплект 2 шт)', 120, { category_id: 115, attributes: { term_pole: 'pair', material: 'lead' }, image_url: svg('#52525b', '±') }),
  // --- "Автотовари": more than one page (60) ---
  ...Array.from({ length: 65 }, (_, i) => product(5001 + i, `Автотовар тестовий №${String(i + 1).padStart(2, '0')}`, 50 + i * 10, { category_id: 5, manufacturer: i % 2 ? 'Winso' : 'Elegant', image_url: i < 3 ? svg('#7c3aed', String(i + 1)) : null })),
];

const settings = [
  { key: 'contact_phone1', value: '099 167 44 24' },
  { key: 'contact_phone2', value: '063 582 38 58' },
  { key: 'contact_address', value: 'м. Синельникове, вул. Квітнева 9' },
  { key: 'enable_stock_quantity', value: 'false' },
  { key: 'nova_poshta_key', value: 'test-np-key' },
  { key: 'agro_featured_ids', value: '1020,1021' },
  { key: 'seo_title', value: 'Форсаж — інтернет-магазин шин, дисків та автотоварів | Синельникове' },
  { key: 'seo_description', value: 'Шини, диски, акумулятори, масла та автотовари в наявності.' },
  { key: 'seo_robots', value: 'index, follow' },
  { key: 'seo_canonical', value: 'https://www.forsage-tires.com/' },
  { key: 'admin_email', value: 'owner@test.ua' },
];

const tables = () => ({
  product_categories: categories.map((c) => ({ ...c })),
  // price_num is a generated column in the real database (the number from the price text)
  tyres: products.map((p) => ({ ...p, price_num: p.price ? Number(String(p.price).replace(/[^\d.]/g, '')) || null : null })),
  settings: settings.map((s) => ({ ...s })),
  site_promos: [{ id: 1, title: 'Мінус 10% на акумулятори', discount_percent: 10, target_type: 'category', target_ids: ['3'], badge_text: null, ends_at: null }],
  site_banners: [{ id: 1, title: 'Зимові шини в наявності', subtitle: 'Доставка Новою Поштою', image_url: svg('#27272a', 'Банер'), image_mobile_url: null, button_text: 'Дивитись', link: '/katalog/shyny', sort_order: 0 }],
  site_pages: [],
  articles: [{ id: 8, title: 'Коли міняти шини на зимові', content: 'Коли температура нижче +7°C.', image_url: null, created_at: '2026-10-01T10:00:00+00:00' }],
  product_reviews: [{ id: 1, product_id: 1001, user_id: null, author_name: 'Олег', rating: 5, body: 'Все чудово, швидка доставка', approved: true, created_at: '2026-11-01T10:00:00+00:00', tyres: { title: 'Hankook Kinergy Eco2 K435 205/55 R16 91H' } }],
  customer_profiles: [{ id: 'user-1', full_name: 'Петренко Іван', phone: '+380 67 111 22 33', city: 'м. Дніпро, Дніпропетровська обл.', warehouse: 'Відділення №1: вул. Тестова, 1', updated_at: '2026-11-01T10:00:00+00:00' }],
  tyre_orders: [],
  analytics_events: [],
  bookings: [],
  suppliers: [{ id: 1, name: 'Програма' }],
});

const light = (p) => ({ id: p.id, title: p.title, slug: p.slug, price: p.price, image_url: p.image_url, image_thumb_url: p.image_thumb_url, on_order: p.on_order, radius: p.radius, manufacturer: p.manufacturer });
const rpc = {
  category_counts: (_args, fake) => {
    const by = {};
    for (const p of fake.tables.tyres) {
      if (!p.in_stock || p.on_order || p.category_id == null) continue;
      const c = (by[p.category_id] ||= { category_id: p.category_id, n: 0, with_photo: 0 });
      c.n++; if (p.has_photo) c.with_photo++;
    }
    return Object.values(by);
  },
  home_recommended: ({ p_n, p_skip }, fake) => fake.tables.tyres.filter((p) => p.in_stock && !p.on_order && p.has_photo && !(p_skip || []).includes(p.id)).slice(0, p_n),
  product_related: ({ p_id }, fake) => {
    const me = fake.tables.tyres.find((p) => p.id === p_id);
    if (!me) return { analogs: [], companions: [], approvals: [] };
    const same = fake.tables.tyres.filter((p) => p.id !== p_id && p.category_id === me.category_id && p.in_stock);
    const other = fake.tables.tyres.filter((p) => p.category_id === 115);
    return { analogs: same.slice(0, 3).map((p, i) => ({ ...light(p), reason: i === 0 ? 'cross' : 'volume' })), companions: other.slice(0, 2).map(light), approvals: me.auto_approvals || [] };
  },
  // purchase price: kept privately, staff read it through this function
  tyre_cost: ({ p_id }) => (p_id === 1002 ? 2100 : null),
  is_staff: (_args, fake) => !!fake.user && fake.user.email === 'owner@test.ua',
  is_admin: (_args, fake) => !!fake.user && fake.user.email === 'owner@test.ua',
};

/** edge functions the admin panel calls */
const functions = {
  'ai-proxy': (body) => (body.mode === 'image_search'
    ? { ok: true, data: [0, 1, 2].map((i) => ({ imageUrl: svg(['#0f766e', '#1d4ed8', '#be123c'][i], `AI${i}`), title: `Знайдене фото ${i}` })) }
    : { ok: true, text: '' }),
};

/** fake signed-in session for localStorage (the site reads it without asking the server) */
const session = (email, id = 'user-1') => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const user = { id, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { full_name: 'Тест' }, created_at: '2026-01-01T00:00:00Z' };
  const access_token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, email, role: 'authenticated', exp: 4102444800 })}.sig`;
  return { user, storageKey: 'sb-zzxueclhkhvwdmxflmyx-auth-token', value: JSON.stringify({ access_token, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user }) };
};

module.exports = { tables, rpc, functions, session, svg, categories, products };
