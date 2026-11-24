import type React from 'react';
/** Go to another page of the site without reloading (App listens to popstate). */
export const navigateTo = (path: string) => {
  if (window.location.pathname + window.location.search === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
};

/** onClick handler for <a href> links inside the site (keeps Ctrl/Cmd+click = new tab). */
export const linkClick = (path: string) => (e: React.MouseEvent) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  navigateTo(path);
};
