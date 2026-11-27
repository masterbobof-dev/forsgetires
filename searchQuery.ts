/**
 * "Smart" search: understands tyre sizes typed in any way (205 55 16, 205/55R16, 2055516),
 * several words at once (hankook 195 65) and brand names typed in Cyrillic (мішлен, бош).
 */

export interface ParsedSearch {
  /** words that must all be found in title / brand / article */
  tokens: string[];
  /** the query looks like a part number (OEM, cross number, barcode, article): letters/digits only, upper-case */
  partNumber?: string;
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

/**
 * The catalogue mixes Russian and Ukrainian names, so a word is searched together with its twin:
 * "масло" also finds "олива", "тормозные" finds "гальмівні". Word roots, so any ending matches.
 */
const TWINS: string[][] = [
  ['масл', 'олив'], ['тормоз', 'гальм'], ['свеч', 'свіч'], ['фильтр', 'фільтр'], ['воздуш', 'повітр'], ['топлив', 'палив'],
  ['ремен', 'ремін'], ['подшипник', 'підшипник'], ['пыльник', 'пильник', 'пильовик'], ['рулев', 'рульов', 'кермов'], ['шаров', 'кульов'],
  ['стойк', 'стійк'], ['щетк', 'щітк', 'дворник', 'склоочис'], ['охлажд', 'охолодж'], ['жидкост', 'рідин'], ['омыват', 'омивач', 'незамерз', 'склоомив'],
  ['аккумулятор', 'акумулятор'], ['зажиган', 'запалюв'], ['сцеплен', 'зчеплен'], ['ступиц', 'маточин'], ['рычаг', 'важіл', 'важел'],
  ['глушител', 'глушник'], ['зеркал', 'дзеркал'], ['стекл', 'скло'], ['провод', 'дрот', 'дріт'], ['предохранител', 'запобіжник'],
  ['смазк', 'мастил', 'змазк'], ['краск', 'фарб'], ['коврик', 'килимк'], ['чехл', 'чохл'], ['двигател', 'двигун'], ['цепь', 'ланцюг'],
  ['кольц', 'кільц'], ['очистител', 'очисник'], ['радиатор', 'радіатор'], ['крышк', 'кришк'], ['лампочк', 'лампа', 'ламп'],
  ['левый', 'левая', 'лівий', 'ліва'], ['правый', 'правая', 'правий', 'права'], ['передн', 'передн'], ['насос', 'помпа'],
  ['клемм', 'клем'], ['компресс', 'компрес'], ['полирол', 'полірол'], ['вонючк', 'ароматиз'], ['антифриз', 'тосол'], ['домкрат', 'домкрат'],
  // one maker under two names: ТМК is the Ternopil exhaust plant
  ['тернопол', 'тернопіл', 'тмк'],
  ['буксир', 'трос'], ['прикуриват', 'прикурюв', 'прикурив'], ['зарядн', 'зарядн'], ['пружин', 'пружин'], ['опор', 'опор'], ['прокладк', 'прокладк'],
];
/** Makers that come under several names (roots). Choosing one in the brand filter shows all of them. */
const BRAND_FAMILIES: string[][] = [['тмк', 'тернопол', 'тернопіл']];
/** the brand without case, spaces, dots and dashes — the same as tyres.brand_key in the database («K-2» → «k2») */
export const brandKey = (brand: string) => brand.toLowerCase().replace(/[^0-9a-zа-яіїєґ]/gi, '');

/** the roots of a brand's family, or [] when the brand has no other names */
export const brandFamily = (brand: string): string[] => {
  const b = brand.toLowerCase().trim();
  return BRAND_FAMILIES.find(f => f.some(r => b.startsWith(r))) || [];
};

/** other spellings of a search word (roots), empty if the word has no twin */
export const twinsOf = (word: string): string[] => {
  const w = word.toLowerCase();
  const group = TWINS.find(g => g.some(r => w.startsWith(r) || (r.length >= 5 && w.length >= 4 && r.startsWith(w))));
  return group ? [...new Set(group)].filter(r => !w.startsWith(r) || r.length < w.length) : [];
};

// Words that don't help to find anything ("шина 205/55 r16" → only the size matters)
const STOP_WORDS = new Set(['шина', 'шини', 'шин', 'резина', 'гума', 'покришка', 'купити', 'для', 'на', 'ціна', 'диск', 'диски', 'акумулятор', 'акб']);

const SIZE_RE = /(?:^|\s)(\d{3})\s*[\/\\\s,.-]?\s*(\d{2})(?:\s*[\/\s-]*\s*z?r?\s*(\d{2}(?:[.,]5)?)\s*(c)?)?(?=\s|$)/i;
const SIZE_COMPACT_RE = /(?:^|\s)(\d{3})(\d{2})(\d{2})(c)?(?=\s|$)/i;
const RADIUS_RE = /(?:^|\s)z?r\s?(\d{2}(?:[.,]5)?)(c)?(?=\s|$)/i;

export const parseSearch = (raw: string): ParsedSearch => {
  let q = ` ${raw.toLowerCase().replace(/[%(),'"]/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const out: ParsedSearch = { tokens: [] };
  // "0 986 452 041", "W712/75", "4820000123456" → one compact number
  const compact = raw.toUpperCase().replace(/[^0-9A-ZА-ЯІЇЄҐ]/g, '');
  if (compact.length >= 4 && /\d/.test(compact) && (compact.match(/\d/g) || []).length >= 3 && raw.trim().split(/\s+/).length <= 5 && !/[а-яіїєґ]{3,}/i.test(raw)) {
    out.partNumber = compact;
  }

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

/**
 * A word that matches its Ukrainian and Russian spellings: the letters that differ between them become «any one letter»
 * («таврия» = «таврія», «тернополь» = «тернопіль», «харьков» → «харк_в»). Short words and words with digits stay as typed.
 */
export const looseWord = (w: string): string => {
  if (w.length < 4 || /\d/.test(w) || !/[а-яіїєґё]/i.test(w)) return w;
  return w.replace(/[иіїыйеєэёгґъ'’ь]/gi, '_').replace(/о/gi, (m, i) => (w.length >= 6 && i > 1 && i < w.length - 1 ? '_' : m));
};

/** PostgREST "or" filters (each must match) for a parsed search. */
export const searchFilters = (s: ParsedSearch): string[] => {
  const filters: string[] = [];
  // values are quoted so spaces and dots are safe inside PostgREST "or(...)"
  const like = (col: string, v: string) => `${col}.ilike."*${v.replace(/["\\*]/g, '')}*"`;
  if (s.partNumber && !s.width) {
    // a part number: any of the product's numbers, or every word in the title
    const words = s.tokens.map(t => {
      const n = t.toUpperCase().replace(/[^0-9A-ZА-ЯІЇЄҐ]/g, '');
      return `or(title.ilike."*${t.replace(/["\\*]/g, '')}*"${n.length >= 3 ? `,search_numbers.ilike."*${n}*"` : ''})`;
    });
    filters.push([like('search_numbers', s.partNumber), like('catalog_number', s.partNumber), like('product_number', s.partNumber),
      words.length > 1 ? `and(${words.join(',')})` : words[0]].filter(Boolean).join(','));
    return filters;
  }
  for (const t of s.tokens) {
    const lw = looseWord(t);
    filters.push([like('title', t), ...(lw !== t ? [like('title', lw), like('manufacturer', lw)] : []), ...twinsOf(t).map(r => like('title', r)), like('manufacturer', t), like('catalog_number', t), like('product_number', t), like('search_numbers', t.toUpperCase().replace(/[^0-9A-ZА-ЯІЇЄҐ]/g, '') || t)].join(','));
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

// ---------- typed in the wrong keyboard layout ----------
const EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
const UA = 'йцукенгшщзхїфівапролджєячсмитьбю\'';
const RU = 'йцукенгшщзхъфывапролджэячсмитьбюё';
const toCyr: Record<string, string> = {}; const toLat: Record<string, string> = {};
for (let i = 0; i < EN.length; i++) { toCyr[EN[i]] = UA[i]; toLat[UA[i]] = EN[i]; toLat[RU[i]] = EN[i]; }

/**
 * The same keys in the other layout: «ащкв» → «ford», «ащкв ащсгы» → «ford focus», «akmnh» → «фільтр».
 * Returns '' when nothing changes. Words with digits (sizes, part numbers) are kept as they are.
 */
export const swapLayout = (raw: string): string => {
  const s = raw.toLowerCase();
  const cyr = (s.match(/[а-яіїєґё]/g) || []).length, lat = (s.match(/[a-z]/g) || []).length;
  if (!cyr && !lat) return '';
  const toLatin = cyr >= lat;
  const out = s.split(/(\s+)/).map(w => (/\d/.test(w) || /^\s+$/.test(w) ? w : [...w].map(ch => (toLatin ? toLat[ch] : toCyr[ch]) ?? ch).join(''))).join('');
  return out === s ? '' : out;
};
