// Shared helpers for Vercel functions (files starting with "_" are not exposed as endpoints).

export const SITE_URL = 'https://www.forsage-tires.com';
export const SHOP_NAME = 'Форсаж';
export const SUPABASE_URL = 'https://zzxueclhkhvwdmxflmyx.supabase.co';
// Public "anon" key (same one the website uses in the browser); read-only by database rules.
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6eHVlY2xoa2h2d2RteGZsbXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjEzMTAsImV4cCI6MjA4MDIzNzMxMH0.yJW-HC03EwyYPpyWTrDbTN4t0YrlNe1H40fwLZ_ZxfU';

export const rest = async (path, from, to) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(from !== undefined ? { Range: `${from}-${to}`, 'Range-Unit': 'items' } : {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
};

/** All rows of a query, 1000 at a time. */
export const restAll = async (path) => {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const page = await rest(path, from, from + 999);
    out.push(...page);
    if (page.length < 1000) return out;
  }
};

export const escapeXml = (s) =>
  String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]))
    // remove characters that are invalid in XML 1.0
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'yi', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'yu', я: 'ya', ы: 'y', э: 'e', ё: 'yo', ъ: '',
};
export const slugify = (text) =>
  String(text || '').toLowerCase().split('').map((ch) => TRANSLIT[ch] ?? ch).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);

/** Same as productPath() in productUrl.ts on the website. */
export const productPath = (p) => {
  const slug = slugify(p.slug || p.title);
  return `/p/${p.id}${slug ? `-${slug}` : ''}`;
};

export const parsePrice = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
};

export const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export const SEASON_UA = { winter: 'Зимова', summer: 'Літня', 'all-season': 'Всесезонна' };
