import { useEffect, useState } from 'react';
import { logAnalyticsEvent } from '../../admin/analytics';
import { type FilterState, type SortValue, countActiveFilters } from '../FilterToolbar';

/**
 * What the customer typed and chose in the catalogue: search text, sorting, tyre size / season / brand,
 * characteristics (attributes) and "only in stock".
 */
export const useShopFilters = () => {
  const [attrFilters, setAttrFilters] = useState<Record<string, string>>({});
  const [activeSort, setActiveSort] = useState<SortValue>('recommended');
  const [searchQuery, setSearchQuery] = useState('');
  // search runs 350 ms after the customer stops typing
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(searchQuery), 350); return () => clearTimeout(t); }, [searchQuery]);
  // statistics: what people search for
  useEffect(() => { if (debouncedSearch.trim().length >= 3) logAnalyticsEvent('search', undefined, debouncedSearch.trim()); }, [debouncedSearch]);
  const [showOnlyInStock, setShowOnlyInStock] = useState(false);

  const [filterWidth, setFilterWidth] = useState('');
  const [filterHeight, setFilterHeight] = useState('');
  const [filterRadius, setFilterRadius] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterSeason, setFilterSeason] = useState('');

  const resetFilters = () => {
    setSearchQuery(''); setFilterWidth(''); setFilterHeight(''); setFilterRadius(''); setFilterBrand(''); setFilterSeason(''); setAttrFilters({}); setShowOnlyInStock(false);
  };

  const filterState: FilterState = { searchQuery, showOnlyInStock, filterWidth, filterHeight, filterRadius, filterBrand, filterSeason, attrFilters };
  const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    const setters: Record<string, (v: any) => void> = {
      searchQuery: setSearchQuery, showOnlyInStock: setShowOnlyInStock, filterWidth: setFilterWidth, filterHeight: setFilterHeight,
      filterRadius: setFilterRadius, filterBrand: setFilterBrand, filterSeason: setFilterSeason, attrFilters: setAttrFilters,
    };
    setters[key](value);
  };
  /** set one characteristic; an empty value removes it */
  const setAttr = (key: string, value: string) => setAttrFilters(prev => {
    const next = { ...prev };
    if (value) next[key] = value; else delete next[key];
    return next;
  });
  const activeFilterCount = countActiveFilters(filterState);

  return {
    filterState, setFilter, setAttr, resetFilters, activeFilterCount,
    activeSort, setActiveSort,
    searchQuery, setSearchQuery, debouncedSearch, setDebouncedSearch,
    showOnlyInStock,
    filterWidth, setFilterWidth, filterHeight, setFilterHeight, filterRadius, setFilterRadius,
    filterBrand, setFilterBrand, filterSeason, setFilterSeason,
    attrFilters, setAttrFilters,
  };
};
