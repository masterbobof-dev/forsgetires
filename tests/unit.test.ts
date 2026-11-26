// Quick checks of the shop's logic that must never break (run: npm test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSearch, twinsOf } from '../searchQuery';
import { phoneDigits, isValidUaPhone, formatUaPhone } from '../phone';
import { fillTemplate, applySite } from '../api/_html.js';
import { productPath, parsePrice, slugify } from '../api/_shop.js';

test('tyre size typed in different ways', () => {
  for (const q of ['205/55 R16', '205 55 16', '2055516', '205/55r16']) {
    const p = parseSearch(q);
    assert.equal(p.width, '205', q); assert.equal(p.height, '55', q); assert.equal(p.radius, 'R16', q);
  }
});
test('russian / ukrainian twins', () => {
  assert.ok(twinsOf('масло').includes('олив'));
  assert.ok(twinsOf('тосол').includes('антифриз'));
  assert.ok(twinsOf('незамерзайка').includes('омивач'));
});
test('ukrainian phone numbers', () => {
  assert.equal(phoneDigits('099 167 44 24'), '380991674424');
  assert.equal(phoneDigits('+38(099)1674424'), '380991674424');
  assert.ok(isValidUaPhone('0991674424'));
  assert.ok(!isValidUaPhone('099167'));
  assert.equal(formatUaPhone('0991674424'), '+380 99 167 44 24');
});
test('prices and product links', () => {
  assert.equal(parsePrice('1 250,50 грн'), 1251);
  assert.equal(parsePrice(''), 0);
  assert.equal(slugify('Шини Зимові 205/55'), 'shyny-zymovi-205-55');
  assert.equal(productPath({ id: 7, title: 'Акумулятор 60Ah' }), '/p/7-akumulyator-60ah');
});
test('SEO templates and shop data', () => {
  assert.equal(fillTemplate('{назва} — {ціна} грн | {магазин}', { 'назва': 'Шина', 'ціна': '100', 'магазин': 'Форсаж' }), 'Шина — 100 грн | Форсаж');
  const html = applySite('<head>"@type": "AutoPartsStore",</head>', { seo_hours: 'Mo-Su 08:00-18:00', seo_founded: '2012' });
  assert.ok(html.includes('"openingHours": "Mo-Su 08:00-18:00"') && html.includes('"foundingDate": "2012"'));
});

// --- what the shop shows for a product (components/shop/productSpecs.ts) ---
import { withSpecs, prepareProduct } from '../components/shop/productSpecs';
import { formatPrice, safeParsePrice } from '../components/shop/shopUtils';
import type { ProductCategory } from '../categories';
import type { TyreProduct } from '../types';

const cats = [
  { id: 1, name: 'Шини', slug: 'shyny', parent_id: null, kind: 'tyre', sort_order: 1, is_active: true },
  { id: 3, name: 'Акумулятори', slug: 'akb', parent_id: null, kind: 'generic', sort_order: 2, is_active: true },
] as ProductCategory[];
const item = (extra: Partial<TyreProduct>): TyreProduct => ({ id: 1, title: 'Товар', description: '', price: '100.00', image_url: '', in_stock: true, stock_quantity: 5, ...extra });

test('tyre size is read from the name', () => {
  const t = withSpecs(item({ title: 'Hankook K435 205/55 R16 91H', category_id: 1, radius: 'R16', season: 'summer' }), cats, false);
  assert.deepEqual([t.width, t.height, t.radius, t.season, t.vehicle_type], ['205', '55', 'R16', 'summer', 'car']);
  const bus = withSpecs(item({ title: 'Doublestar 215/75 R16C 113R', category_id: null }), cats, false);
  assert.deepEqual([bus.radius, bus.vehicle_type], ['R16C', 'cargo'], 'a "C" tyre without a section is a bus tyre');
  assert.equal(withSpecs(item({ title: 'Шина 9,5-24 6PR', category_id: 1 }), cats, false).width, '', 'no size in the name → no guess');
});
test('goods that are not tyres have no tyre fields', () => {
  const b = withSpecs(item({ title: 'Акумулятор 60Ah 205/55', category_id: 3, season: 'winter' }), cats, false);
  assert.deepEqual([b.width, b.height, b.season], [undefined, undefined, undefined]);
});
test('availability with and without stock tracking', () => {
  const sold = item({ category_id: 3, stock_quantity: 0 });
  assert.equal(withSpecs(sold, cats, false).in_stock, true, 'tracking off: the "in stock" flag decides');
  assert.equal(withSpecs(sold, cats, true).in_stock, false, 'tracking on: zero pieces = not available');
  assert.equal(withSpecs(item({ category_id: 3, in_stock: false }), cats, false).in_stock, false);
});
test('promo price', () => {
  const promo = [{ id: 1, title: '', discount_percent: 10, target_type: 'category' as const, target_ids: ['3'] }];
  const p = prepareProduct(item({ category_id: 3, price: '3890.00' }), cats, promo, false);
  assert.deepEqual([p.price, p.old_price, p.promo_badge], ['3501', '3890', '−10%']);
  assert.equal(prepareProduct(item({ category_id: 1, price: '3890.00', title: 'Шина 205/55 R16' }), cats, promo, false).price, '3890.00', 'other sections keep their price');
});
test('prices on the page', () => {
  assert.equal(formatPrice('3890.00'), '3890');
  assert.equal(formatPrice('1 250,50'), '1251');
  assert.equal(formatPrice(undefined), '0');
  assert.equal(safeParsePrice('12 300 грн'), 12300);
});
