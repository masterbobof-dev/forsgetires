import { useRef } from 'react';
import type React from 'react';
import type { CategorySelection } from '../CategoryNav';

/**
 * Phones: a horizontal swipe over the product list switches to the next / previous section
 * (in the order of the sections row) and brings the top of the list into view.
 */
export const useCategorySwipe = (
  categoryOrder: CategorySelection[], activeCategory: CategorySelection,
  changeCategory: (c: CategorySelection) => void, listTopRef: React.RefObject<HTMLDivElement | null>,
) => {
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x, dy = t.clientY - start.y;
    if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - start.t > 700) return;
    const idx = categoryOrder.indexOf(activeCategory);
    const nextIdx = idx + (dx < 0 ? 1 : -1);
    if (nextIdx >= 0 && nextIdx < categoryOrder.length) {
      changeCategory(categoryOrder[nextIdx]);
      window.scrollTo({ top: Math.min(window.scrollY, listTopRef.current ? listTopRef.current.getBoundingClientRect().top + window.scrollY - 140 : 0), behavior: 'smooth' });
    }
  };
  return { onTouchStart, onTouchEnd };
};
