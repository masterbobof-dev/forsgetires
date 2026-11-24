import { useCallback, useEffect, useState } from 'react';

/**
 * A list of product ids kept in the browser (favourites, compare).
 * All components using the same key stay in sync.
 */
export const useStoredIds = (key: string, max = 200) => {
  const read = () => {
    try {
      const v = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(v) ? v.filter((x: unknown) => typeof x === 'number') as number[] : [];
    } catch { return []; }
  };
  const [ids, setIds] = useState<number[]>(read);

  useEffect(() => {
    const sync = (e: Event) => { if (!(e instanceof CustomEvent) || e.detail === key) setIds(read()); };
    window.addEventListener('forsage:lists', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('forsage:lists', sync); window.removeEventListener('storage', sync); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback((next: number[]) => {
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* private mode */ }
    setIds(next);
    window.dispatchEvent(new CustomEvent('forsage:lists', { detail: key }));
  }, [key]);

  /** Returns false if the list is full. */
  const toggle = useCallback((id: number): boolean => {
    const cur = read();
    if (cur.includes(id)) { save(cur.filter(x => x !== id)); return true; }
    if (cur.length >= max) return false;
    save([...cur, id]);
    return true;
  }, [save, max]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = useCallback((id: number) => save(read().filter(x => x !== id)), [save]); // eslint-disable-line react-hooks/exhaustive-deps
  const clear = useCallback(() => save([]), [save]);

  return { ids, has: (id: number) => ids.includes(id), toggle, remove, clear };
};

export const FAVORITES_KEY = 'forsage_favorites';
export const COMPARE_KEY = 'forsage_compare';
export const COMPARE_MAX = 4;
