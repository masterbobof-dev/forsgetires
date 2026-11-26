import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import type { TyreProduct } from '../../../types';
import type { ProductCategory } from '../../../categories';
import type { CategorySelection } from '../CategoryNav';
import { productPath, productIdFromLocation } from '../../../productUrl';
import { catPath, catSlugFrom } from '../../../api/_paths.js';

interface ProductRouteParams {
  /** products already loaded in the list (opened without asking the database again) */
  tyres: TyreProduct[];
  /** database row → product as the shop shows it */
  prepare: (p: TyreProduct) => TyreProduct;
  categories: ProductCategory[];
  categoriesLoading: boolean;
  activeCategory: CategorySelection;
  changeCategory: (c: CategorySelection) => void;
  categorySlug: (c: CategorySelection) => string;
  /** a product the page should open right away (given by the app) */
  initialProduct?: TyreProduct | null;
}

/**
 * The product window and the address bar: opening a product gives it its own address /p/<id>-<name>,
 * the browser's Back / Forward close and reopen it, and a product address (or an old ?p=123 link) opens it on load.
 */
export const useProductRoute = ({ tyres, prepare, categories, categoriesLoading, activeCategory, changeCategory, categorySlug, initialProduct }: ProductRouteParams) => {
  const [selectedProduct, setSelectedProduct] = useState<TyreProduct | null>(null);

  /** Open the product window and give it its own address; "Back" closes it again. */
  const openProduct = (p: TyreProduct, opts: { replace?: boolean } = {}) => {
    setSelectedProduct(p);
    const path = productPath(p);
    if (window.location.pathname === path) return;
    const state = { forsageProduct: p.id };
    if (opts.replace || window.history.state?.forsageProduct) window.history.replaceState(state, '', path);
    else window.history.pushState(state, '', path);
  };
  const closeProduct = () => {
    if (window.history.state?.forsageProduct) { window.history.back(); return; } // popstate closes the window
    setSelectedProduct(null);
    const params = new URLSearchParams(window.location.search);
    params.delete('p'); params.delete('product'); params.delete('c');
    const q = params.toString();
    const slug = categorySlug(activeCategory);
    window.history.replaceState({}, '', `${slug ? catPath(slug) : '/'}${q ? `?${q}` : ''}`);
  };

  /** Show a product by id (from the address): use the loaded list or ask the database. */
  const showProductById = async (id: number) => {
    const local = tyres.find(t => t.id === id);
    if (local) { setSelectedProduct(local); return; }
    const { data } = await supabase.from('tyres').select('*').eq('id', id).maybeSingle();
    if (data) setSelectedProduct(prepare(data as TyreProduct));
  };

  // Product address in the URL when the page opens (also old links ?p=123)
  const initialProductHandled = useRef(false);
  useEffect(() => {
    if (initialProductHandled.current || categoriesLoading) return;
    initialProductHandled.current = true;
    const id = productIdFromLocation();
    if (id) {
      showProductById(id).then(() => {
        // turn old ?p=123 links into the new address
        if (!window.location.pathname.startsWith('/p/')) {
          supabase.from('tyres').select('id, title, slug').eq('id', id).maybeSingle().then(({ data }) => {
            if (data) window.history.replaceState({}, '', productPath(data as TyreProduct));
          });
        }
      });
    } else if (initialProduct) {
      openProduct(initialProduct, { replace: true });
    }
  }, [categoriesLoading, initialProduct]);

  // Browser "Back" / "Forward" (subscribed again on every render, so it always sees the current section and list)
  useEffect(() => {
    const onPop = () => {
      const id = productIdFromLocation();
      if (id) { showProductById(id); return; }
      setSelectedProduct(null);
      // category links from the header menu (/katalog/<slug>)
      const slug = catSlugFrom(window.location.pathname, window.location.search);
      const next: CategorySelection = !slug ? 'all' : slug === 'akcii' ? 'hot' : slug === 'obrane' ? 'fav' : (categories.find(c => c.slug === slug)?.id ?? activeCategory);
      if ((window.location.pathname === '/' || window.location.pathname.startsWith('/katalog/')) && next !== activeCategory) changeCategory(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });

  return { selectedProduct, openProduct, closeProduct };
};
