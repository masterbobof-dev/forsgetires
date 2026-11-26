import { supabase } from './supabaseClient';

/**
 * Shop pages read shop settings (phones, SEO texts, home blocks...) from several places at once.
 * Asking for them one by one cost the database 4–7 requests per page; here all keys asked within
 * the same moment go in ONE request, and each key is kept for the rest of the visit.
 * Not for the admin panel: there settings must always be fresh.
 */
type Row = { key: string; value: string };

const cache = new Map<string, Promise<Row[] | null>>();
let batch: { keys: Set<string>; result: Promise<Row[] | null> } | null = null;

const startBatch = () => {
  const keys = new Set<string>();
  const result = new Promise<Row[] | null>((resolve) => {
    setTimeout(async () => {
      batch = null;
      try {
        const { data, error } = await supabase.from('settings').select('key, value').in('key', [...keys]);
        if (error) throw error;
        resolve((data as Row[]) || []);
      } catch {
        for (const k of keys) cache.delete(k); // try again next time
        resolve(null);
      }
    }, 0);
  });
  return { keys, result };
};

/** Same answer shape as supabase: { data: [{ key, value }] } or { data: null } if the database didn't answer. */
export const settingsRows = async (keys: string[]): Promise<{ data: Row[] | null }> => {
  for (const k of keys) {
    if (cache.has(k)) continue;
    batch ??= startBatch();
    batch.keys.add(k);
    cache.set(k, batch.result);
  }
  const lists = await Promise.all(keys.map((k) => cache.get(k)!));
  if (lists.some((l) => l === null)) return { data: null };
  const rows = new Map<string, Row>();
  for (const list of lists) for (const r of list!) if (keys.includes(r.key)) rows.set(r.key, r);
  return { data: [...rows.values()] };
};

/** One setting (like .maybeSingle()): { data: { value } | null }. */
export const settingValue = async (key: string): Promise<{ data: { value: string } | null }> => {
  const { data } = await settingsRows([key]);
  const row = data?.find((r) => r.key === key);
  return { data: row ? { value: row.value } : null };
};
