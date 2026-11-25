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
