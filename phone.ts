/**
 * Ukrainian phone number helpers: the customer types "0991674424", "380 99..." or "+38(099)…",
 * the field shows "+380 99 167 44 24".
 */
export const phoneDigits = (value: string): string => {
  let d = value.replace(/\D/g, '');
  if (d.startsWith('0')) d = '38' + d;          // 099… → 38099…
  else if (d.startsWith('80')) d = '3' + d;     // 8099… → 38099…
  else if (d && !d.startsWith('3')) d = '380' + d;
  return d.slice(0, 12);
};

export const formatUaPhone = (value: string): string => {
  if (!value.trim()) return '';
  const d = phoneDigits(value);
  const parts = [d.slice(0, 3), d.slice(3, 5), d.slice(5, 8), d.slice(8, 10), d.slice(10, 12)].filter(Boolean);
  return '+' + parts.join(' ');
};

/** +380 + 9 digits */
export const isValidUaPhone = (value: string): boolean => /^380\d{9}$/.test(phoneDigits(value));
