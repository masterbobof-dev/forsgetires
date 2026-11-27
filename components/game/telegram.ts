/**
 * The game opened as a Telegram Mini App (a button in the shop's bot): Telegram adds #tgWebAppData… to the address.
 * Then the page shows only the game (no shop header) and talks to Telegram through its small script.
 */
declare global { interface Window { Telegram?: { WebApp?: any } } }

const KEY = 'forsage_tg';
export const inTelegram = (): boolean => {
  try {
    if (/tgWebApp/.test(window.location.hash) || new URLSearchParams(window.location.search).has('tg')) sessionStorage.setItem(KEY, '1');
    return sessionStorage.getItem(KEY) === '1';
  } catch { return /tgWebApp/.test(window.location.hash); }
};

let loading: Promise<any> | null = null;
/** Telegram's own script: makes the window full height and lets the game open Telegram's «share» list */
export const telegramApp = (): Promise<any> => {
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp);
  loading ??= new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-web-app.js';
    s.onload = () => {
      const app = window.Telegram?.WebApp;
      try { app?.ready(); app?.expand(); app?.setHeaderColor?.('#09090b'); app?.setBackgroundColor?.('#09090b'); } catch { /* old Telegram */ }
      resolve(app || null);
    };
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return loading;
};
