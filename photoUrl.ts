/**
 * List pictures of partner goods (GPL, Omega) come in 1500 px from the partners' servers. In lists they are shown
 * through a free picture service (wsrv.nl) that makes a small WebP copy on the fly and keeps it for a year:
 * 4–5 times lighter, and still shown when the partner's server is slow or down. Own photos go the same way: their
 * "small" copies are up to 800 px, and some photos found automatically have none (150 KB each on the home page).
 * If the service does not answer, index.tsx puts the original back.
 */
export const WSRV = 'https://wsrv.nl/?url=';

export const smallPhoto = (url: string | null | undefined, w = 400): string | undefined => {
  if (!url) return undefined;
  if (!/^https:\/\//.test(url)) return url;
  return `${WSRV}${encodeURIComponent(url.replace(/^https:\/\//, ''))}&w=${w}&h=${w}&fit=inside&output=webp&q=78`;
};

/** the small list picture of a product: its own small copy, or a small copy of the partner's photo */
export const listPhoto = (p: { image_thumb_url?: string | null; image_url?: string | null }, w = 400) =>
  smallPhoto(p.image_thumb_url || p.image_url, w);

/** the original address behind a small copy (used when the picture service fails) */
export const originalOf = (src: string): string | null => {
  if (!src.startsWith(WSRV)) return null;
  const u = new URL(src).searchParams.get('url');
  return u ? `https://${u.replace(/^https?:\/\//, '')}` : null;
};
