import React from 'react';
import type { FilterPreset } from '../../productAttributes';
import type { FilterOptions } from './FilterToolbar';

interface QuickFiltersProps {
  /** a tyre section: the size picker is shown instead of the characteristics */
  showTyreFilters: boolean;
  preset: FilterPreset | null;
  /** values found in the goods of the section, per characteristic */
  attrValues: Record<string, string[]>;
  attrFilters: Record<string, string>;
  onAttrChange: (key: string, value: string) => void;
  filterWidth: string;
  setFilterWidth: (v: string) => void;
  filterHeight: string;
  setFilterHeight: (v: string) => void;
  filterRadius: string;
  setFilterRadius: (v: string) => void;
  filterOptions: FilterOptions;
}

/** The main filters right under the sections row: tyre size, or the main characteristics of the section. */
const QuickFilters: React.FC<QuickFiltersProps> = ({ showTyreFilters, preset, attrValues, attrFilters, onAttrChange, filterWidth, setFilterWidth, filterHeight, setFilterHeight, filterRadius, setFilterRadius, filterOptions }) => (
  <>
    {/* Batteries / oils / wheels: the main characteristics right under the sections */}
    {!showTyreFilters && preset && (() => {
      const fields = preset.fields.filter(f => f.filter !== 'none' && !(preset.id === 'batteries' && (f.key === 'size' || f.key === 'voltage')))
        .map(f => ({ f, values: f.options ? f.options.filter(o => (attrValues[f.key] || []).includes(o.value)) : (attrValues[f.key] || []).map(v => ({ value: v, label: f.unit ? `${v} ${f.unit}` : v })) }))
        .filter(x => x.values.length > 1 || attrFilters[x.f.key]);
      if (!fields.length) return null;
      return (
        <div className={`grid gap-2 mb-4 ${fields.length >= 4 ? 'grid-cols-2 md:grid-cols-4' : fields.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {fields.map(({ f, values }) => {
            const val = attrFilters[f.key] || '';
            return (
              <select key={f.key} aria-label={f.label} value={val} onChange={e => onAttrChange(f.key, e.target.value)}
                className={`w-full min-w-0 bg-zinc-900 border rounded-xl px-3 py-3 font-bold text-sm outline-none focus:border-[#FFC300] ${val ? 'border-[#FFC300] text-[#FFC300]' : 'border-zinc-800 text-white'}`}>
                <option value="">{f.label}</option>
                {values.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            );
          })}
        </div>
      );
    })()}

    {/* Tyres: size picker right under the sections (only sizes that are in stock) */}
    {showTyreFilters && (
      <div className="grid grid-cols-3 gap-2 mb-4">
        {([['Ширина', filterWidth, setFilterWidth, filterOptions.widths], ['Висота', filterHeight, setFilterHeight, filterOptions.heights], ['R', filterRadius, setFilterRadius, filterOptions.radii.filter(x => /^R\d/i.test(x))]] as const).map(([label, val, set, opts]) => (
          <select key={label} aria-label={label === 'R' ? 'Радіус' : label} value={val} onChange={e => (set as (v: string) => void)(e.target.value)}
            className={`w-full bg-zinc-900 border rounded-xl px-3 py-3 font-bold text-sm outline-none focus:border-[#FFC300] ${val ? 'border-[#FFC300] text-[#FFC300]' : 'border-zinc-800 text-white'}`}>
            <option value="">{label}</option>
            {(opts as readonly string[]).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        ))}
      </div>
    )}
  </>
);

export default QuickFilters;
