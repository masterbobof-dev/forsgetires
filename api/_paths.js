// Category addresses: /katalog/<slug> (old links /?c=<slug> are redirected here).
export const catPath = (slug) => `/katalog/${slug}`;
/** Category slug from a path like /katalog/masla, or from the old ?c= parameter. */
export const catSlugFrom = (pathname, search) => {
  const m = String(pathname || '').match(/^\/katalog\/([^/?#]+)/);
  if (m) return decodeURIComponent(m[1]);
  return new URLSearchParams(search || '').get('c') || '';
};
