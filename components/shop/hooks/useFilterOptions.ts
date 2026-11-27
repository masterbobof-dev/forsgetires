import { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { type ProductCategory, buildCategoryFilter, getCategoryTree } from '../../../categories';
import { sortAttrValues } from '../../../productAttributes';
import type { CategorySelection } from '../CategoryNav';
import type { FilterOptions } from '../FilterToolbar';

/**
 * Values the filters of the current section can offer — only what really is in stock there:
 * brands, tyre widths / heights / radii, and every characteristic (capacity, polarity, approvals…).
 */
export const useFilterOptions = (
  categories: ProductCategory[], categoriesLoading: boolean, dbReady: boolean,
  activeCategory: CategorySelection, activeCat: ProductCategory | undefined,
) => {
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ widths: [], heights: [], radii: [], brands: [] });
  const [attrValues, setAttrValues] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (categoriesLoading) return;
    let cancelled = false;
    (async () => {
      // counted in the database: every product of the section (the browser used to see only the first 5000)
      if (dbReady) {
        const cats = activeCat ? getCategoryTree(categories, activeCat).map(c => c.id) : null;
        const { data: o, error } = await supabase.rpc('filter_options', {
          p_cats: activeCategory === 'hot' ? null : cats, p_null_cat: !!activeCat && activeCat.kind === 'tyre' && !activeCat.parent_id, p_hot: activeCategory === 'hot',
        });
        if (cancelled) return;
        if (!error && o) {
          const num = (v: string) => parseFloat(v.replace(/[^\d.]/g, ''));
          setFilterOptions({
            brands: [...(o.brands || [])].sort((a: string, b: string) => a.localeCompare(b)),
            radii: [...(o.radii || [])].sort((a: string, b: string) => num(a) - num(b)),
            widths: [...(o.widths || [])].sort((a: string, b: string) => +a - +b),
            heights: [...(o.heights || [])].sort((a: string, b: string) => +a - +b),
          });
          const attrs: Record<string, string[]> = { ...(o.attrs || {}) };
          if ((o.approvals || []).length) attrs.approval = o.approvals;
          setAttrValues(Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, sortAttrValues(v as string[])])));
          return;
        }
      }
      let q = supabase.from('tyres').select(dbReady ? 'manufacturer, radius, title, attributes, auto_approvals' : 'manufacturer, radius, title').neq('in_stock', false);
      if (activeCategory === 'hot') q = q.eq('is_hot', true);
      else if (activeCat) {
        const f = buildCategoryFilter(categories, activeCat, dbReady);
        if (f) q = q.or(f);
      }
      const { data } = await q.limit(5000);
      if (cancelled || !data) return;
      const brands = new Set<string>(), radii = new Set<string>(), widths = new Set<string>(), heights = new Set<string>();
      const attrs: Record<string, Set<string>> = {};
      (data as any[]).forEach(item => {
        if (item.manufacturer?.trim()) brands.add(item.manufacturer.trim());
        if (item.radius) radii.add(item.radius.trim());
        const m = (item.title || '').match(/(\d{3})[\/\s](\d{2})/);
        if (m) { widths.add(m[1]); heights.add(m[2]); }
        for (const a of item.auto_approvals || []) (attrs.approval ||= new Set()).add(a);
        if (item.attributes && typeof item.attributes === 'object') {
          for (const [k, v] of Object.entries(item.attributes)) {
            if (v === null || v === undefined || String(v).trim() === '') continue;
            (attrs[k] ||= new Set()).add(String(v).trim());
          }
        }
      });
      setFilterOptions({
        brands: Array.from(brands).sort((a, b) => a.localeCompare(b)),
        radii: Array.from(radii).sort((a, b) => parseFloat(a.replace(/[^\d.]/g, '')) - parseFloat(b.replace(/[^\d.]/g, ''))),
        widths: Array.from(widths).sort((a, b) => +a - +b),
        heights: Array.from(heights).sort((a, b) => +a - +b),
      });
      setAttrValues(Object.fromEntries(Object.entries(attrs).map(([k, set]) => [k, sortAttrValues(Array.from(set))])));
    })();
    return () => { cancelled = true; };
  }, [categoriesLoading, activeCategory, dbReady]);

  return { filterOptions, attrValues };
};
