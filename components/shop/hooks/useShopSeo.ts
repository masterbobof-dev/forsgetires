import { useEffect } from 'react';
import type { TyreProduct } from '../../../types';
import type { ProductCategory } from '../../../categories';
import type { CategorySelection } from '../CategoryNav';
import { SITE_URL } from '../../../constants';
import { productPath, productIdFromLocation } from '../../../productUrl';
import { catPath } from '../../../api/_paths.js';
import { logAnalyticsEvent } from '../../admin/analytics';
import { formatPrice, setCanonical, setMetaDescription } from '../shopUtils';

/**
 * Page title, description and canonical link for what is on the screen: an open product or the chosen section
 * (the home page keeps the values from the admin SEO settings). Also counts product views for the statistics.
 */
export const useShopSeo = (selectedProduct: TyreProduct | null, activeCat: ProductCategory | undefined, activeCategory: CategorySelection) => {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedProduct) {
      // SEO: Dynamic Title
      document.title = `${selectedProduct.title} — купити в Україні | Forsage`;

      // SEO: Meta Description + canonical link of the product page
      setMetaDescription(selectedProduct.seo_description || `Купити ${selectedProduct.title}. Ціна: ${formatPrice(selectedProduct.price)} грн. В наявності. Доставка по Україні.`);
      setCanonical(`${SITE_URL}${productPath(selectedProduct)}`);
      logAnalyticsEvent('view_item', String(selectedProduct.id), selectedProduct.title);
    } else {
      // Only touch SEO tags on category pages; the home page keeps the values from admin SEO settings
      if (activeCat) {
        document.title = activeCat.seo_title || `${activeCat.name} — купити в інтернет-магазині Форсаж | Синельникове`;
        setMetaDescription(activeCat.seo_description || activeCat.description?.slice(0, 300) || `${activeCat.name} в наявності в інтернет-магазині Форсаж. Самовивіз у Синельниковому, доставка Новою Поштою по всій Україні.`);
        setCanonical(SITE_URL + catPath(activeCat.slug));
      } else if (activeCategory === 'hot') {
        document.title = 'Акції та знижки — інтернет-магазин Форсаж';
        setCanonical(SITE_URL + catPath('akcii'));
      }
      if (url.searchParams.has('p') && !productIdFromLocation()) { url.searchParams.delete('p'); window.history.replaceState({}, '', url.toString()); }
    }
  }, [selectedProduct, activeCat, activeCategory]);
};
