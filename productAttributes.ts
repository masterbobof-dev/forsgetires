/**
 * Characteristics ("attributes") of non-tyre products, stored in tyres.attributes (jsonb).
 * Each category can use a filter preset (product_categories.filter_preset) that defines
 * which fields the admin fills in and which filters customers see.
 */
import { ProductCategory, getRootOf } from './categories';
import type { TyreProduct } from './types';

export type FilterPresetId = 'batteries' | 'wheels';

export interface AttrOption { value: string; label: string; short?: string }

export interface AttrField {
  key: string;
  label: string;
  /** select = fixed options; number / text = free input (filter options come from existing products) */
  type: 'select' | 'number' | 'text';
  options?: AttrOption[];
  unit?: string;
  placeholder?: string;
  hint?: string;
  /** chips = big toggle buttons in the filter panel (for 2-4 options); select = dropdown */
  filter: 'chips' | 'select' | 'none';
  /** shown as a small badge on the product card */
  onCard?: boolean;
}

export interface FilterPreset {
  id: FilterPresetId;
  label: string;
  fields: AttrField[];
}

const opts = (values: string[], unit = ''): AttrOption[] => values.map(v => ({ value: v, label: `${v}${unit}` }));

export const FILTER_PRESETS: Record<FilterPresetId, FilterPreset> = {
  batteries: {
    id: 'batteries',
    label: 'Акумулятори (ємність, полярність, корпус, розміри)',
    fields: [
      { key: 'capacity', label: 'Ємність', type: 'number', unit: 'Ah', placeholder: '60', filter: 'select', onCard: true },
      {
        key: 'polarity', label: 'Полярність', type: 'select', filter: 'chips', onCard: true,
        hint: 'Де знаходиться «+», якщо дивитися на клеми спереду',
        options: [
          { value: 'right', label: 'Плюс праворуч (−  +)', short: '+ праворуч' },
          { value: 'left', label: 'Плюс ліворуч (+  −)', short: '+ ліворуч' },
        ],
      },
      {
        key: 'body', label: 'Корпус', type: 'select', filter: 'chips', onCard: true,
        options: [
          { value: 'euro', label: 'Європа', short: 'Європа' },
          { value: 'asia', label: 'Азія', short: 'Азія' },
        ],
      },
      { key: 'current', label: 'Пусковий струм', type: 'number', unit: 'A', placeholder: '540', filter: 'select', onCard: true },
      { key: 'size', label: 'Розміри (Д×Ш×В)', type: 'text', unit: 'мм', placeholder: '242×175×190', filter: 'select', hint: 'Довжина × ширина × висота в мм' },
      { key: 'voltage', label: 'Напруга', type: 'select', filter: 'select', options: opts(['12', '6', '24'], 'V') },
    ],
  },
  wheels: {
    id: 'wheels',
    label: 'Диски (діаметр, кріплення, ширина, виліт)',
    fields: [
      { key: 'diameter', label: 'Діаметр', type: 'select', filter: 'select', onCard: true, options: opts(['13', '14', '15', '16', '17', '18', '19', '20', '21', '22']).map(o => ({ ...o, label: `R${o.value}` })) },
      { key: 'pcd', label: 'Кріплення (PCD)', type: 'text', placeholder: '5x112', filter: 'select', onCard: true, hint: 'Кількість болтів × діаметр, напр. 4x100, 5x112' },
      { key: 'width', label: 'Ширина', type: 'text', unit: 'J', placeholder: '7', filter: 'select', onCard: true },
      { key: 'et', label: 'Виліт (ET)', type: 'text', placeholder: '45', filter: 'select' },
      { key: 'dia', label: 'Центральний отвір (DIA)', type: 'text', unit: 'мм', placeholder: '57.1', filter: 'select' },
      {
        key: 'type', label: 'Тип диска', type: 'select', filter: 'chips', onCard: true,
        options: [
          { value: 'alloy', label: 'Литий', short: 'Литий' },
          { value: 'steel', label: 'Сталевий', short: 'Сталевий' },
          { value: 'forged', label: 'Кований', short: 'Кований' },
        ],
      },
    ],
  },
};

export const PRESET_OPTIONS: { value: '' | FilterPresetId; label: string }[] = [
  { value: '', label: 'Без спеціальних фільтрів' },
  { value: 'batteries', label: FILTER_PRESETS.batteries.label },
  { value: 'wheels', label: FILTER_PRESETS.wheels.label },
];

/** The preset of a category: its own, or inherited from the top-level category. */
export const getPresetForCategory = (all: ProductCategory[], cat?: ProductCategory | null): FilterPreset | null => {
  if (!cat) return null;
  const id = (cat.filter_preset || getRootOf(all, cat).filter_preset) as FilterPresetId | null | undefined;
  return id && FILTER_PRESETS[id] ? FILTER_PRESETS[id] : null;
};

export const getPresetForProduct = (all: ProductCategory[], p: Pick<TyreProduct, 'category_id'>): FilterPreset | null =>
  getPresetForCategory(all, all.find(c => c.id === p.category_id));

/** Human readable value, e.g. "60 Ah", "+ праворуч", "R16". */
export const formatAttr = (field: AttrField, raw: unknown, short = false): string => {
  const value = raw === null || raw === undefined ? '' : String(raw).trim();
  if (!value) return '';
  const opt = field.options?.find(o => o.value === value);
  if (opt) return short && opt.short ? opt.short : opt.label;
  return field.unit ? `${value} ${field.unit}` : value;
};

/** Small badges for the product card. */
export const getCardChips = (preset: FilterPreset | null, attributes?: Record<string, unknown> | null): string[] => {
  if (!preset || !attributes) return [];
  return preset.fields
    .filter(f => f.onCard)
    .map(f => formatAttr(f, attributes[f.key], true))
    .filter(Boolean);
};

/** Sort filter values: numbers numerically, everything else alphabetically. */
export const sortAttrValues = (values: string[]) =>
  [...values].sort((a, b) => {
    const na = parseFloat(a.replace(',', '.')), nb = parseFloat(b.replace(',', '.'));
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    return a.localeCompare(b, 'uk', { numeric: true });
  });

/** Suggested product title from attributes, used when the admin leaves the name empty. */
export const suggestTitle = (preset: FilterPreset | null, brand: string, attrs: Record<string, string>): string => {
  if (!preset) return brand;
  const f = (k: string) => preset.fields.find(x => x.key === k)!;
  if (preset.id === 'batteries') {
    return [
      'Акумулятор', brand,
      attrs.capacity && `${attrs.capacity}Ah`,
      attrs.current && `${attrs.current}A`,
      formatAttr(f('polarity'), attrs.polarity, true) && `(${formatAttr(f('polarity'), attrs.polarity, true)})`,
      attrs.body === 'asia' ? 'Asia' : '',
    ].filter(Boolean).join(' ');
  }
  return [
    'Диск', formatAttr(f('type'), attrs.type, true).toLowerCase(), brand,
    attrs.diameter && `R${attrs.diameter}`,
    attrs.width && `${attrs.width}J`,
    attrs.pcd, attrs.et && `ET${attrs.et}`, attrs.dia && `DIA${attrs.dia}`,
  ].filter(Boolean).join(' ');
};
