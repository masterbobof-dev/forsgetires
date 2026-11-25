/**
 * Characteristics ("attributes") of non-tyre products, stored in tyres.attributes (jsonb).
 * Each category can use a filter preset (product_categories.filter_preset) that defines
 * which fields the admin fills in and which filters customers see.
 */
import { ProductCategory, getRootOf } from './categories';
import type { TyreProduct } from './types';

export type FilterPresetId = 'batteries' | 'wheels' | 'oils' | 'lamps' | 'wipers' | 'coolant' | 'brakefluid' | 'fuses' | 'filters' | 'belts';

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
  oils: {
    id: 'oils',
    label: 'Масла та рідини (вʼязкість, обʼєм, допуски, тип)',
    fields: [
      {
        key: 'oil_type', label: 'Тип', type: 'select', filter: 'select',
        options: [
          { value: 'engine', label: 'Моторне', short: 'Моторне' },
          { value: 'trans', label: 'Трансмісійне', short: 'Трансм.' },
          { value: 'atf', label: 'ATF / АКПП', short: 'ATF' },
          { value: 'brake', label: 'Гальмівна рідина', short: 'Гальмівна' },
          { value: 'coolant', label: 'Антифриз', short: 'Антифриз' },
        ],
      },
      { key: 'viscosity', label: 'Вʼязкість', type: 'text', placeholder: '5W30', filter: 'select', onCard: true },
      { key: 'volume', label: 'Обʼєм', type: 'number', unit: 'л', placeholder: '4', filter: 'select', onCard: true },
      { key: 'approval', label: 'Допуск', type: 'text', placeholder: 'VW 502.00', filter: 'select', hint: 'Береться з назви товару або з програми' },
    ],
  },
  lamps: {
    id: 'lamps',
    label: 'Лампочки (цоколь, напруга, потужність, тип)',
    fields: [
      { key: 'lamp_base', label: 'Цоколь / тип', type: 'text', placeholder: 'H7', filter: 'select', onCard: true, hint: 'H1, H4, H7, W5W, P21W…' },
      { key: 'lamp_tech', label: 'Вид лампи', type: 'select', filter: 'select', onCard: true, options: [
        { value: 'halogen', label: 'Галогенова', short: 'Галоген' }, { value: 'led', label: 'LED (світлодіодна)', short: 'LED' },
        { value: 'xenon', label: 'Ксенонова', short: 'Ксенон' }, { value: 'bulb', label: 'Звичайна', short: 'Звичайна' }] },
      { key: 'voltage', label: 'Напруга', type: 'select', filter: 'select', onCard: true, options: opts(['12', '24', '6'], 'V') },
      { key: 'power', label: 'Потужність', type: 'text', unit: 'W', placeholder: '55', filter: 'select', onCard: true },
      { key: 'color_temp', label: 'Колір світла', type: 'number', unit: 'K', placeholder: '6000', filter: 'none' },
    ],
  },
  wipers: {
    id: 'wipers',
    label: 'Щітки склоочисника (довжина, тип)',
    fields: [
      { key: 'length', label: 'Довжина', type: 'text', unit: 'мм', placeholder: '500', filter: 'select', onCard: true },
      { key: 'wiper_type', label: 'Тип', type: 'select', filter: 'select', onCard: true, options: [
        { value: 'flat', label: 'Безкаркасна', short: 'Безкаркасна' }, { value: 'frame', label: 'Каркасна', short: 'Каркасна' }, { value: 'hybrid', label: 'Гібридна', short: 'Гібридна' }] },
      { key: 'pack', label: 'Комплект', type: 'select', filter: 'none', onCard: true, options: [{ value: 'kit', label: 'Комплект (2 шт)', short: 'Комплект' }] },
    ],
  },
  coolant: {
    id: 'coolant',
    label: 'Охолоджуюча рідина (стандарт, колір, обʼєм)',
    fields: [
      { key: 'coolant_kind', label: 'Вид', type: 'select', filter: 'select', options: [
        { value: 'ready', label: 'Антифриз готовий', short: 'Готовий' }, { value: 'concentrate', label: 'Концентрат', short: 'Концентрат' },
        { value: 'tosol', label: 'Тосол', short: 'Тосол' }, { value: 'water', label: 'Дистильована вода', short: 'Вода' }] },
      { key: 'coolant_std', label: 'Стандарт', type: 'text', placeholder: 'G12+', filter: 'select', onCard: true },
      { key: 'color', label: 'Колір', type: 'select', filter: 'select', onCard: true, options: [
        { value: 'red', label: 'Червоний' }, { value: 'green', label: 'Зелений' }, { value: 'blue', label: 'Синій' },
        { value: 'yellow', label: 'Жовтий' }, { value: 'violet', label: 'Фіолетовий' }, { value: 'orange', label: 'Помаранчевий' }] },
      { key: 'volume', label: 'Обʼєм', type: 'number', unit: 'л', placeholder: '5', filter: 'select', onCard: true },
    ],
  },
  brakefluid: {
    id: 'brakefluid',
    label: 'Гальмівна рідина (клас DOT, обʼєм)',
    fields: [
      { key: 'dot', label: 'Клас', type: 'text', placeholder: 'DOT 4', filter: 'select', onCard: true },
      { key: 'volume', label: 'Обʼєм', type: 'number', unit: 'л', placeholder: '1', filter: 'select', onCard: true },
    ],
  },
  fuses: {
    id: 'fuses',
    label: 'Запобіжники (струм, тип)',
    fields: [
      { key: 'fuse_type', label: 'Тип', type: 'select', filter: 'select', onCard: true, options: [
        { value: 'standard', label: 'Плоский євро', short: 'Євро' }, { value: 'mini', label: 'Міні', short: 'Міні' }, { value: 'micro', label: 'Супер міні', short: 'Супер міні' },
        { value: 'maxi', label: 'Максі', short: 'Максі' }, { value: 'cartridge', label: 'Картриджний', short: 'Картридж' }, { value: 'old', label: 'Старого зразка', short: 'Старий' }] },
      { key: 'amp', label: 'Струм', type: 'number', unit: 'A', placeholder: '15', filter: 'select', onCard: true },
    ],
  },
  filters: {
    id: 'filters',
    label: 'Фільтри (вид фільтра)',
    fields: [
      { key: 'filter_type', label: 'Вид фільтра', type: 'select', filter: 'chips', onCard: true, options: [
        { value: 'oil', label: 'Масляний', short: 'Масляний' }, { value: 'air', label: 'Повітряний', short: 'Повітряний' },
        { value: 'cabin', label: 'Салону', short: 'Салону' }, { value: 'fuel', label: 'Паливний', short: 'Паливний' }, { value: 'gas', label: 'Газовий (ГБО)', short: 'ГБО' }] },
    ],
  },
  belts: {
    id: 'belts',
    label: 'Ремені та ролики (вид, розмір)',
    fields: [
      { key: 'belt_type', label: 'Вид', type: 'select', filter: 'chips', onCard: true, options: [
        { value: 'timing', label: 'Ремінь ГРМ', short: 'ГРМ' }, { value: 'poly', label: 'Ремінь поліклиновий', short: 'Поліклиновий' },
        { value: 'roller', label: 'Ролик', short: 'Ролик' }, { value: 'tensioner', label: 'Натягувач', short: 'Натягувач' }, { value: 'other', label: 'Інший ремінь', short: 'Ремінь' }] },
      { key: 'belt_size', label: 'Розмір', type: 'text', placeholder: '6PK1198', filter: 'select', onCard: true },
    ],
  },
};

export const PRESET_OPTIONS: { value: '' | FilterPresetId; label: string }[] = [
  { value: '', label: 'Без спеціальних фільтрів' },
  { value: 'batteries', label: FILTER_PRESETS.batteries.label },
  { value: 'wheels', label: FILTER_PRESETS.wheels.label },
  { value: 'oils', label: FILTER_PRESETS.oils.label },
  ...(['lamps', 'wipers', 'coolant', 'brakefluid', 'fuses', 'filters', 'belts'] as FilterPresetId[]).map(id => ({ value: id, label: FILTER_PRESETS[id].label })),
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
