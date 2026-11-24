/**
 * "Smart" search: understands tyre sizes typed in any way (205 55 16, 205/55R16, 2055516),
 * several words at once (hankook 195 65) and brand names typed in Cyrillic (мішлен, бош).
 */

export interface ParsedSearch {
  /** words that must all be found in title / brand / article */
  tokens: string[];
  width?: string;
  height?: string;
  radius?: string;
}

const BRAND_ALIASES: Record<string, string> = {
  'мішлен': 'michelin', 'мишлен': 'michelin', 'мішелін': 'michelin',
  'континенталь': 'continental', 'континентал': 'continental', 'конті': 'continental',
  'бріджстоун': 'bridgestone', 'бриджстоун': 'bridgestone', 'бріджстон': 'bridgestone',
  'гудієр': 'goodyear', 'гудиер': 'goodyear', 'гудір': 'goodyear',
  'пірелі': 'pirelli', 'пирелли': 'pirelli', 'пірелли': 'pirelli',
  'ханкук': 'hankook', 'хенкук': 'hankook',
  'нокіан': 'nokian', 'нокиан': 'nokian',
  'йокогама': 'yokohama', 'йокохама': 'yokohama',
  'кумхо': 'kumho', 'нексен': 'nexen', 'данлоп': 'dunlop', 'тойо': 'toyo',
  'лауфен': 'laufenn', 'лауфенн': 'laufenn', 'матадор': 'matador', 'барум': 'barum',
  'белшина': 'belshina', 'бєлшина': 'belshina', 'росава': 'rosava', 'преміорі': 'premiorri', 'премиорри': 'premiorri',
  'тріангл': 'triangle', 'триангл': 'triangle', 'сайлун': 'sailun', 'лінглонг': 'linglong', 'линглонг': 'linglong',
  'кордіант': 'cordiant', 'кордиант': 'cordiant', 'петлас': 'petlas', 'фульда': 'fulda', 'сава': 'sava', 'дебіка': 'debica',
  'озка': 'ozka', 'кабат': 'kabat',
  'варта': 'varta', 'бош': 'bosch', 'вестa': 'westa', 'веста': 'westa', 'мутлу': 'mutlu', 'топла': 'topla',
  'екзайд': 'exide', 'ексайд': 'exide', 'амарон': 'amaron', 'шелл': 'shell', 'мобіл': 'mobil', 'кастрол': 'castrol',
  'мотюль': 'motul', 'ліквімолі': 'liqui moly', 'ліквімолі ': 'liqui moly',
};

// Words that don't help to find anything ("шина 205/55 r16" → only the size matters)
const STOP_WORDS = new Set(['шина', 'шини', 'шин', 'резина', 'гума', 'покришка', 'купити', 'для', 'на', 'ціна', 'диск', 'диски', 'акумулятор', 'акб']);

const SIZE_RE = /(?:^|\s)(\d{3})\s*[\/\\\s,.-]?\s*(\d{2})(?:\s*[\/\s-]*\s*z?r?\s*(\d{2}(?:[.,]5)?)\s*(c)?)?(?=\s|$)/i;
const SIZE_COMPACT_RE = /(?:^|\s)(\d{3})(\d{2})(\d{2})(c)?(?=\s|$)/i;
const RADIUS_RE = /(?:^|\s)z?r\s?(\d{2}(?:[.,]5)?)(c)?(?=\s|$)/i;

export const parseSearch = (raw: string): ParsedSearch => {
  let q = ` ${raw.toLowerCase().replace(/[%(),'"]/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const out: ParsedSearch = { tokens: [] };

  const size = q.match(SIZE_COMPACT_RE) || q.match(SIZE_RE);
  if (size) {
    out.width = size[1];
    out.height = size[2];
    if (size[3]) out.radius = `R${size[3].replace(',', '.')}${size[4] ? 'C' : ''}`.toUpperCase();
    q = q.replace(size[0], ' ');
  }
  if (!out.radius) {
    const r = q.match(RADIUS_RE);
    if (r) { out.radius = `R${r[1].replace(',', '.')}${r[2] ? 'C' : ''}`.toUpperCase(); q = q.replace(r[0], ' '); }
  }

  for (const word of q.trim().split(' ')) {
    if (!word || STOP_WORDS.has(word)) continue;
    const token = BRAND_ALIASES[word] || word;
    if (token.length >= 2 || /\d/.test(token)) out.tokens.push(token);
  }
  return out;
};

/** PostgREST "or" filters (each must match) for a parsed search. */
export const searchFilters = (s: ParsedSearch): string[] => {
  const filters: string[] = [];
  // values are quoted so spaces and dots are safe inside PostgREST "or(...)"
  const like = (col: string, v: string) => `${col}.ilike."*${v.replace(/["\\*]/g, '')}*"`;
  for (const t of s.tokens) {
    filters.push([like('title', t), like('manufacturer', t), like('catalog_number', t), like('product_number', t)].join(','));
  }
  if (s.width && s.height) {
    filters.push([like('title', `${s.width}/${s.height}`), like('title', `${s.width} ${s.height}`), like('title', `${s.width}x${s.height}`)].join(','));
  }
  if (s.radius) {
    const n = s.radius.replace(/^R/, '').replace(/C$/, '');
    filters.push([`radius.eq."${s.radius}"`, `radius.eq."${n}"`, `radius.eq."R${n}C"`, like('title', `R${n} `), like('title', `R${n}C`)].join(','));
  }
  return filters;
};
