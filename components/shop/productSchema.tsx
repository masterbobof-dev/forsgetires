import React from 'react';
import type { TyreProduct } from '../../types';
import { SITE_URL } from '../../constants';
import { productPath } from '../../productUrl';
import { safeParsePrice } from './shopUtils';

/** Product description for Google (schema.org JSON-LD), rendered inside the product window. */
export const renderProductSchema = (product: TyreProduct) => {
  const schema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.title,
    "image": [product.image_url, ...(product.gallery || [])].filter(Boolean),
    "description": product.description || `${product.title} — в наявності в інтернет-магазині Forsage.`,
    "sku": `product-${product.id}`,
    "brand": {
      "@type": "Brand",
      "name": product.manufacturer || "Forsage Tires"
    },
    "offers": {
      "@type": "Offer",
      "url": `${SITE_URL}${productPath(product)}`,
      "priceCurrency": "UAH",
      "price": safeParsePrice(product.price),
      "priceValidUntil": "2026-12-31",
      "availability": product.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "itemCondition": "https://schema.org/NewCondition"
    }
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />;
};
