import { useEffect, useState } from 'react';
import { settingsRows } from './publicSettings';

/**
 * Where a buyer leaves a review about the shop on Google: the «Відгук у Google» address from settings,
 * or else the shop's Google Maps profile (there the buyer presses «Написати відгук»). Empty while unknown.
 */
export const useReviewLink = () => {
  const [link, setLink] = useState('');
  useEffect(() => {
    settingsRows(['contact_review_link', 'contact_map_link']).then(({ data }) => {
      const get = (k: string) => data?.find(r => r.key === k)?.value?.trim() || '';
      const v = get('contact_review_link') || get('contact_map_link');
      if (/^https:\/\//.test(v)) setLink(v);
    });
  }, []);
  return link;
};
