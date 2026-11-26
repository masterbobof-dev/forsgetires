import { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { TyreProduct } from '../../../types';

/** "Товар вручну": list of goods, search, the edit window and its saving. */
export const useSeoProducts = () => {
  const [products, setProducts] = useState<TyreProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<TyreProduct | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
          let query = supabase.from('tyres').select('*').order('created_at', { ascending: false });
          if (productSearch) {
              query = query.ilike('title', `%${productSearch}%`);
          }
          const { data } = await query.limit(100);
          if (data) setProducts(data);
      } catch (e) { console.error(e); }
      finally { setLoadingProducts(false); }
  };

  const handleSaveProductSeo = async () => {
      if (!editingProduct) return;
      setIsSavingProduct(true);
      try {
          const { error } = await supabase.from('tyres').update({
              seo_title: editingProduct.seo_title,
              seo_description: editingProduct.seo_description,
              seo_keywords: editingProduct.seo_keywords,
              slug: editingProduct.slug
          }).eq('id', editingProduct.id);
          
          if (error) throw error;
          
          setProducts(prev => prev.map(p => p.id === editingProduct.id ? editingProduct : p));
          setEditingProduct(null);
          alert("SEO для товару оновлено!");
      } catch (e: any) {
          alert("Помилка: " + e.message);
      } finally {
          setIsSavingProduct(false);
      }
  };

  const generateProductSlug = (title: string) => {
      return title
          .toLowerCase()
          .replace(/[^\w\sа-яіїєґ]/gi, '')
          .replace(/\s+/g, '-')
          .replace(/--+/g, '-')
          .trim();
  };

  const autoFillProductSeo = (product: TyreProduct) => {
      const slug = generateProductSlug(product.title);
      const seo_title = `${product.title} | Купити в Синельникове | Форсаж`;
      const seo_description = `Купити ${product.title} за вигідною ціною в шиномонтажі Форсаж (Синельникове). Гарантія якості, професійний підбір.`;
      const seo_keywords = `${product.manufacturer}, ${product.radius}, купити шини синельникове, ${product.title}`;
      
      setEditingProduct({
          ...product,
          slug,
          seo_title,
          seo_description,
          seo_keywords
      });
  };

  return {
    products, loadingProducts, productSearch, setProductSearch, editingProduct, setEditingProduct, isSavingProduct,
    fetchProducts, handleSaveProductSeo, generateProductSlug, autoFillProductSeo,
  };
};

export type SeoProducts = ReturnType<typeof useSeoProducts>;
