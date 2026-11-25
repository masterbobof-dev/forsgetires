import { useEffect } from 'react';
import type { ProductCategory } from '../../../categories';
import type { CategorySelection } from '../CategoryNav';
import { catPath, catSlugFrom } from '../../../api/_paths.js';

/**
 * Keeps the chosen section and the address bar in step: /katalog/<slug> (old ?c=slug links are still understood).
 * The first effect reads the section from the address when the page opens; the second writes the address
 * whenever the section changes. Their order matters: reading must happen before the first write.
 */
export const useCategoryUrl = (
  categories: ProductCategory[], categoriesLoading: boolean,
  activeCategory: CategorySelection, setActiveCategory: (c: CategorySelection) => void,
  categorySlug: (c: CategorySelection) => string,
) => {
  useEffect(() => {
    if (categoriesLoading) return;
    const slug = catSlugFrom(window.location.pathname, window.location.search);
    if (slug === 'akcii') setActiveCategory('hot');
    else if (slug === 'obrane') setActiveCategory('fav');
    else if (slug) {
      const found = categories.find(c => c.slug === slug);
      if (found) setActiveCategory(found.id);
    }
  }, [categoriesLoading]);

  useEffect(() => {
    if (categoriesLoading || window.location.pathname.startsWith('/p/')) return;
    const path = window.location.pathname;
    if (path !== '/' && !path.startsWith('/katalog/')) return;
    const params = new URLSearchParams(window.location.search);
    params.delete('c');
    const slug = categorySlug(activeCategory);
    if (activeCategory !== 'all' && !slug) return;
    const q = params.toString();
    const next = (slug ? catPath(slug) : '/') + (q ? `?${q}` : '');
    if (next !== path + window.location.search) window.history.replaceState(window.history.state, '', next);
  }, [activeCategory, categoriesLoading]);
};
