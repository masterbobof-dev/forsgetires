/** Small helpers of the shop page: prices, season names, page <head> tags. */

/** products loaded per page of the list */
export const PAGE_SIZE = 60;

export const safeParsePrice = (val: string | undefined | null): number => {
    if (!val) return 0;
    const clean = String(val).replace(/,/g, '.').replace(/[^\d.]/g, '');
    return parseFloat(clean) || 0;
};

export const formatPrice = (priceStr: string | undefined) => {
  if (!priceStr) return '0';
  const num = safeParsePrice(priceStr);
  return num ? Math.round(num).toString() : priceStr;
};

export const getSeasonLabel = (s: string | undefined) => {
    if(s === 'winter') return 'Зимова';
    if(s === 'summer') return 'Літня';
    if(s === 'all-season') return 'Всесезонна';
    return 'Універсальна';
};

const setHeadTag = (selector: string, create: () => HTMLElement, attr: string, value: string) => {
  let el = document.head.querySelector(selector) as HTMLElement | null;
  if (!el) { el = create(); document.head.appendChild(el); }
  el.setAttribute(attr, value);
};
export const setCanonical = (url: string) => {
  setHeadTag('link[rel="canonical"]', () => { const l = document.createElement('link'); l.setAttribute('rel', 'canonical'); return l; }, 'href', url);
  setHeadTag('meta[property="og:url"]', () => { const m = document.createElement('meta'); m.setAttribute('property', 'og:url'); return m; }, 'content', url);
};
export const setMetaDescription = (text: string) => {
  setHeadTag('meta[name="description"]', () => { const m = document.createElement('meta'); m.setAttribute('name', 'description'); return m; }, 'content', text);
};

/** A range filter value like "60..82" (set by the car picker): its bounds and every whole number in between. */
export const parseAttrRange = (v: string) => {
  const m = v.match(/^(\d{1,4})\.\.(\d{1,4})$/);
  if (!m) return null;
  const from = Number(m[1]), to = Number(m[2]);
  if (to < from || to - from > 300) return null;
  return { from, to, values: Array.from({ length: to - from + 1 }, (_, i) => String(from + i)) };
};
/** "60..82" → "60–82 Ah" for the filter boxes */
export const attrRangeLabel = (v: string, unit?: string) => {
  const r = parseAttrRange(v);
  return r ? `${r.from}–${r.to}${unit ? ` ${unit}` : ''}` : null;
};
