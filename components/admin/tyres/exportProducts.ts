import { supabase } from '../../../supabaseClient';
import { type ProductCategory, buildCategoryFilter } from '../../../categories';
import { downloadCsv } from '../exportCsv';

/** Price list for Excel: all goods of the chosen section (or everything), by name. Throws if the database refuses. */
export const exportProductsCsv = async (categories: ProductCategory[], dbReady: boolean, filterCategoryId: string) => {
  const rows: any[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    let q = supabase.from('tyres').select('catalog_number, title, manufacturer, price, stock_quantity, in_stock, category_id').order('title').range(from, from + 999);
    if (filterCategoryId !== 'all') {
      const cat = categories.find(c => String(c.id) === String(filterCategoryId));
      const f = cat ? buildCategoryFilter(categories, cat, dbReady) : null;
      if (f) q = q.or(f);
    }
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const catName = (id: number) => categories.find(c => c.id === id)?.name || '';
  downloadCsv(`tovary-${new Date().toISOString().slice(0, 10)}.csv`,
    ['Код', 'Назва', 'Бренд', 'Категорія', 'Ціна, грн', 'Залишок', 'В наявності'],
    rows.map(r => [r.catalog_number, r.title, r.manufacturer, catName(r.category_id), r.price, r.stock_quantity, r.in_stock === false ? 'ні' : 'так']));
};
