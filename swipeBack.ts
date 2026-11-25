/**
 * Phone: swipe right anywhere = go back one step inside the site (close a product card, previous section / page).
 * Every history entry remembers its depth, so we never swipe the visitor out of the site.
 */
let installed = false;
export const installSwipeBack = () => {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const depth = () => Number(window.history.state?.__d) || 0;
  const push = window.history.pushState.bind(window.history);
  const replace = window.history.replaceState.bind(window.history);
  window.history.pushState = (state: any, title: string, url?: string | URL | null) => push({ ...(state || {}), __d: depth() + 1 }, title, url);
  window.history.replaceState = (state: any, title: string, url?: string | URL | null) => replace({ ...(state || {}), __d: depth() }, title, url);

  /** the finger started on something that itself scrolls sideways (photo gallery, product rows, map, slider) */
  const scrollsSideways = (el: HTMLElement | null) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.tagName === 'IFRAME' || n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.dataset.noSwipe !== undefined) return true;
      if (n.scrollWidth > n.clientWidth + 4 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return true;
    }
    return false;
  };
  let sx = 0, sy = 0, st = 0, ok = false, lastBack = 0;
  window.addEventListener('popstate', () => { lastBack = Date.now(); });
  window.addEventListener('touchstart', e => {
    const t = e.touches[0];
    // the very edge of the screen belongs to the phone's own "back" gesture — reacting too would go back twice (the page blinks)
    ok = e.touches.length === 1 && t.clientX > 32 && t.clientX < window.innerWidth - 32 && !scrollsSideways(e.target as HTMLElement);
    sx = t.clientX; sy = t.clientY; st = Date.now();
  }, { passive: true });
  window.addEventListener('touchend', e => {
    if (!ok) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    if (dx > 90 && dy < 45 && dx > dy * 2.5 && Date.now() - st < 600 && depth() > 0 && Date.now() - lastBack > 700) window.history.back();
  }, { passive: true });
};
