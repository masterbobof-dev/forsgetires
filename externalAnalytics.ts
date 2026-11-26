/**
 * Google Analytics 4 and Meta (Facebook/Instagram) Pixel.
 * Turned on by putting the IDs into the settings table:
 *   ga_measurement_id = G-XXXXXXXXXX
 *   fb_pixel_id       = 1234567890
 * Nothing is loaded while the IDs are empty.
 */
import { supabase } from './supabaseClient';
import { settingsRows } from './publicSettings';

declare global {
  interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; fbq?: any; _fbq?: any }
}

let started = false;

export const initExternalAnalytics = async () => {
  if (started || typeof window === 'undefined') return;
  started = true;
  const { data } = await settingsRows(['ga_measurement_id', 'fb_pixel_id']);
  const get = (k: string) => (data || []).find((r: any) => r.key === k)?.value?.trim();

  const ga = get('ga_measurement_id');
  if (ga && /^G-[A-Z0-9]+$/i.test(ga)) {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga)}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer!.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ga);
  }

  const fb = get('fb_pixel_id');
  if (fb && /^\d{6,20}$/.test(fb)) {
    /* Meta Pixel base code */
    (function (f: any, b: Document, e: string, v: string) {
      if (f.fbq) return;
      const n: any = (f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); });
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      const t = b.createElement(e) as HTMLScriptElement; t.async = true; t.src = v;
      const s0 = b.getElementsByTagName(e)[0]; s0.parentNode!.insertBefore(t, s0);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', fb);
    window.fbq('track', 'PageView');
  }
};

const GA_EVENTS: Record<string, string> = { view_item: 'view_item', add_to_cart: 'add_to_cart', add_to_wishlist: 'add_to_wishlist', search: 'search', purchase: 'purchase' };
const FB_EVENTS: Record<string, string> = { view_item: 'ViewContent', add_to_cart: 'AddToCart', add_to_wishlist: 'AddToWishlist', search: 'Search', purchase: 'Purchase' };

/** Forward a shop event to GA4 / Meta Pixel (if they are on). */
export const trackExternal = (event: string, params: { id?: string; name?: string; value?: number; query?: string } = {}) => {
  try {
    if (event === 'page_view') {
      window.gtag?.('event', 'page_view', { page_path: window.location.pathname + window.location.search });
      window.fbq?.('track', 'PageView');
      return;
    }
    const items = params.id ? [{ item_id: params.id, item_name: params.name }] : undefined;
    if (GA_EVENTS[event]) window.gtag?.('event', GA_EVENTS[event], { currency: 'UAH', value: params.value, items, search_term: params.query });
    if (FB_EVENTS[event]) window.fbq?.('track', FB_EVENTS[event], { currency: 'UAH', value: params.value, content_ids: params.id ? [params.id] : undefined, content_name: params.name, search_string: params.query });
  } catch { /* analytics must never break the shop */ }
};
