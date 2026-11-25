/**
 * Sends JavaScript errors that happen in customers' browsers to analytics_events (event_type "js_error"),
 * so problems on phones we never see show up in the hourly health check (Telegram alert).
 * At most 3 reports per page load; the same message is sent once.
 */
import { supabase } from './supabaseClient';

const sent = new Set<string>();
const report = (message: string, where: string) => {
  const msg = String(message || 'unknown').slice(0, 300);
  if (sent.size >= 3 || sent.has(msg) || /ResizeObserver|Script error\.?$|chrome-extension|moz-extension|safari-extension/i.test(msg + where)) return;
  sent.add(msg);
  supabase.from('analytics_events').insert({
    event_type: 'js_error', item_name: msg, item_id: where.slice(0, 200),
    path_name: window.location.pathname.slice(0, 200), browser_name: navigator.userAgent.slice(0, 200),
  }).then(() => {});
};

export const installErrorReporter = () => {
  if (typeof window === 'undefined' || location.hostname === 'localhost') return;
  window.addEventListener('error', e => report(e.message, `${e.filename || ''}:${e.lineno || ''}`));
  window.addEventListener('unhandledrejection', e => report(String((e.reason && (e.reason.message || e.reason)) || ''), 'promise'));
};
