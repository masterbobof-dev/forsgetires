import type { TyreProduct } from '../../types';
import { type ProductCategory, isTyreProduct } from '../../categories';
import { type SitePromo, applyPromo } from '../../sitePromos';

/**
 * A product row from the database → what the shop shows:
 * tyres get their size (width / height / radius) read from the name, the "bus" type for C tyres,
 * and every product gets its real availability (with stock tracking on, zero quantity = not available).
 */
export const withSpecs = (tyre: TyreProduct, categories: ProductCategory[], enableStockQty: boolean): TyreProduct => {
  if (!isTyreProduct(tyre, categories)) {
    const in_stock = enableStockQty ? (tyre.in_stock !== false && (tyre.stock_quantity ?? 0) > 0) : tyre.in_stock !== false;
    return { ...tyre, season: undefined, width: undefined, height: undefined, in_stock };
  }
  const m = tyre.title.match(/(\d{3})[\/\s](\d{2})[\s\w]*R(\d{2}(?:\.5|\.3)?[C|c]?)/);
  let width = '', height = '', parsedRadius = tyre.radius || '', vehicle_type = tyre.vehicle_type || 'car';
  if (m) {
      width = m[1]; height = m[2];
      const r = m[3].toUpperCase();
      if (!parsedRadius) parsedRadius = `R${r}`;
      if (vehicle_type === 'car' && r.endsWith('C')) vehicle_type = 'cargo';
  }
  // unknown season stays unknown (no "всесезонна" badge instead of a guess)
  const season = tyre.season || undefined;
  const in_stock = enableStockQty ? (tyre.in_stock !== false && (tyre.stock_quantity ?? 0) > 0) : tyre.in_stock !== false;
  return { ...tyre, width, height, radius: parsedRadius, season, vehicle_type, in_stock };
};

/** the same plus the promo price (old price crossed out, badge) */
export const prepareProduct = (tyre: TyreProduct, categories: ProductCategory[], promos: SitePromo[], enableStockQty: boolean): TyreProduct =>
  applyPromo(withSpecs(tyre, categories, enableStockQty), promos, categories);
