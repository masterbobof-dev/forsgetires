import { useCallback, useEffect, useState, type ComponentType } from 'react';
import {
  Package, CircleDot, Disc, Battery, Droplet, Car, Truck, Tractor, Mountain,
  Wrench, Snowflake, Sun, Flame, ShoppingBag, Lightbulb, Gauge, Cog, Sparkles, Grid,
  Filter, Zap, Fan, Wind, Flashlight, Hammer, Thermometer, CircleStop, Settings2, Link, Plug, Paintbrush, Shield, Fuel, Key, Cable,
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { TyreProduct } from './types';

export type CategoryKind = 'tyre' | 'generic';

export interface ProductCategory {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  icon?: string | null;
  description?: string | null;
  sort_order: number;
  is_active: boolean;
  kind: CategoryKind;
  vehicle_type?: string | null;
  /** 'batteries' | 'wheels' — which characteristic filters this category uses */
  filter_preset?: string | null;
}

/** Icons the admin can choose for a category (key -> component). */
export const CATEGORY_ICONS: Record<string, ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  'package': Package,
  'circle-dot': CircleDot,
  'disc': Disc,
  'battery': Battery,
  'droplet': Droplet,
  'car': Car,
  'truck': Truck,
  'tractor': Tractor,
  'mountain': Mountain,
  'wrench': Wrench,
  'snowflake': Snowflake,
  'sun': Sun,
  'flame': Flame,
  'shopping-bag': ShoppingBag,
  'lightbulb': Lightbulb,
  'gauge': Gauge,
  'cog': Cog,
  'sparkles': Sparkles,
  'grid': Grid,
  'filter': Filter, 'zap': Zap, 'fan': Fan, 'wind': Wind, 'flashlight': Flashlight, 'hammer': Hammer,
  'thermometer': Thermometer, 'brake': CircleStop, 'settings': Settings2, 'link': Link, 'plug': Plug,
  'paintbrush': Paintbrush, 'shield': Shield, 'fuel': Fuel, 'key': Key, 'cable': Cable,
};

export const getCategoryIcon = (icon?: string | null) => CATEGORY_ICONS[icon || ''] || Package;

/**
 * Used until the `product_categories` table is created in Supabase,
 * so the shop keeps working (tyres only) before the SQL migration is run.
 * Negative ids mark them as "not from the database".
 */
const FALLBACK_CATEGORIES: ProductCategory[] = [
  { id: -1, name: 'Шини', slug: 'shyny', parent_id: null, icon: 'circle-dot', sort_order: 10, is_active: true, kind: 'tyre' },
  { id: -2, name: 'Легкові', slug: 'shyny-legkovi', parent_id: -1, icon: 'car', sort_order: 1, is_active: true, kind: 'tyre', vehicle_type: 'car' },
  { id: -3, name: 'SUV / 4x4', slug: 'shyny-suv', parent_id: -1, icon: 'mountain', sort_order: 2, is_active: true, kind: 'tyre', vehicle_type: 'suv' },
  { id: -4, name: 'Буси (C)', slug: 'shyny-busy', parent_id: -1, icon: 'truck', sort_order: 3, is_active: true, kind: 'tyre', vehicle_type: 'cargo' },
  { id: -5, name: 'Вантажні (TIR)', slug: 'shyny-tir', parent_id: -1, icon: 'truck', sort_order: 4, is_active: true, kind: 'tyre', vehicle_type: 'truck' },
  { id: -6, name: 'Агро / Спец', slug: 'shyny-agro', parent_id: -1, icon: 'tractor', sort_order: 5, is_active: true, kind: 'tyre', vehicle_type: 'agro' },
];

const sortCats = (a: ProductCategory, b: ProductCategory) =>
  a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'uk');

/**
 * Loads categories from Supabase.
 * `dbReady` is false when the table does not exist yet (fallback list is used).
 */
export const useCategories = (opts: { includeInactive?: boolean } = {}) => {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [dbReady, setDbReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('product_categories').select('*');
    if (error || !data) {
      setCategories(FALLBACK_CATEGORIES);
      setDbReady(false);
    } else {
      const list = (data as ProductCategory[])
        .filter(c => opts.includeInactive || c.is_active)
        .sort(sortCats);
      setCategories(list);
      setDbReady(true);
    }
    setLoading(false);
  }, [opts.includeInactive]);

  useEffect(() => { reload(); }, [reload]);

  return { categories, dbReady, loading, reload };
};

export const getRootCategories = (all: ProductCategory[]) =>
  all.filter(c => !c.parent_id || !all.some(p => p.id === c.parent_id)).sort(sortCats);

export const getChildren = (all: ProductCategory[], parentId: number) =>
  all.filter(c => c.parent_id === parentId).sort(sortCats);

/** The category itself and all of its nested sub-categories. */
export const getCategoryTree = (all: ProductCategory[], cat: ProductCategory): ProductCategory[] => {
  const result: ProductCategory[] = [cat];
  const queue = [cat.id];
  while (queue.length) {
    const id = queue.shift()!;
    for (const child of all) {
      if (child.parent_id === id && !result.includes(child)) {
        result.push(child);
        queue.push(child.id);
      }
    }
  }
  return result;
};

export const getRootOf = (all: ProductCategory[], cat: ProductCategory): ProductCategory => {
  let current = cat;
  const seen = new Set<number>();
  while (current.parent_id && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = all.find(c => c.id === current.parent_id);
    if (!parent) break;
    current = parent;
  }
  return current;
};

/** Full path like "Шини / Легкові". */
export const getCategoryPath = (all: ProductCategory[], cat: ProductCategory): ProductCategory[] => {
  const path: ProductCategory[] = [cat];
  let current = cat;
  while (current.parent_id) {
    const parent = all.find(c => c.id === current.parent_id);
    if (!parent || path.includes(parent)) break;
    path.unshift(parent);
    current = parent;
  }
  return path;
};

/**
 * Builds a PostgREST `or=(...)` filter that selects products of the category
 * (including sub-categories). Products created before categories existed have
 * no `category_id` and are tyres, so they are matched by `vehicle_type`.
 */
export const buildCategoryFilter = (
  all: ProductCategory[],
  cat: ProductCategory,
  dbReady: boolean,
): string | null => {
  const tree = getCategoryTree(all, cat);
  const vehicleTypes = Array.from(new Set(tree.map(c => c.vehicle_type).filter(Boolean))) as string[];
  const isTyreRoot = cat.kind === 'tyre' && !cat.parent_id;

  if (!dbReady) {
    if (isTyreRoot) return null; // every product is a tyre in the old schema
    return vehicleTypes.length ? `vehicle_type.in.(${vehicleTypes.join(',')})` : null;
  }

  const parts = [`category_id.in.(${tree.map(c => c.id).join(',')})`];
  if (isTyreRoot) parts.push('category_id.is.null');
  else if (cat.kind === 'tyre' && vehicleTypes.length) {
    parts.push(`and(category_id.is.null,vehicle_type.in.(${vehicleTypes.join(',')}))`);
  }
  return parts.join(',');
};

/** A product without a category is a legacy tyre. */
export const isTyreProduct = (p: Pick<TyreProduct, 'category_id'>, all: ProductCategory[]) => {
  if (!p.category_id) return true;
  const cat = all.find(c => c.id === p.category_id);
  return !cat || cat.kind === 'tyre';
};

export const slugify = (text: string) => {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'yi', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
    ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'yu', я: 'ya', ы: 'y', э: 'e', ё: 'yo', ъ: '',
  };
  return text
    .toLowerCase()
    .split('')
    .map(ch => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `cat-${Date.now()}`;
};
