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
