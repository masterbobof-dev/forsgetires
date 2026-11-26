/** Constants and small helpers of the admin "Товари" tab. */
import type { TyreProduct } from '../../../types';
import { CAR_RADII, CARGO_RADII, TRUCK_RADII, AGRO_RADII } from '../../../constants';

export const PAGE_SIZE = 50;

export const KNOWN_BRANDS = [
    'NOKIAN', 'MICHELIN', 'CONTINENTAL', 'BRIDGESTONE', 'GOODYEAR', 'PIRELLI', 'HANKOOK', 'YOKOHAMA', 
    'TOYO', 'KUMHO', 'NEXEN', 'DUNLOP', 'PREMIORRI', 'ROSAVA', 'BELSHINA', 'TRIANGLE', 'SAILUN', 
    'LINGLONG', 'LAUFENN', 'COOPER', 'MATADOR', 'BARUM', 'SAVA', 'FULDA', 'KELLY', 'DEBICA', 
    'GENERAL', 'GISLAVED', 'VIKING', 'RIKEN', 'KORMORAN', 'KLEBER', 'BFGOODRICH', 'TIGAR', 
    'UNIROYAL', 'FIRESTONE', 'DAYTON', 'LASSA', 'STARMAXX', 'PETLAS', 'HIFLY', 'DOUBLESTAR', 'ETERNITY', 'OZKA', 'BKT', 'SEHA'
];

export const AXIS_OPTIONS = [
    'Ведуча',
    'Причіпна',
    'Рульова',
    'Рульова, автобусна',
    'Рульова/Причіпна',
    'Універсальна'
];

export const detectSeason = (title: string, description: string): string | null => {
    const text = (title + ' ' + (description || '')).toLowerCase();
    if (text.includes('зима') || text.includes('зимн') || text.includes('winter') || text.includes('snow') || text.includes('ice') || text.includes('stud') || text.includes('spike') || text.includes('alpin') || text.includes('nord') || text.includes('arct') || text.includes('blizzak') || text.includes('w442') || text.includes('w452') || text.includes('i fit') || text.includes('i*fit') || text.includes('kw31') || text.includes('rw') || text.includes('ws') || text.includes('dm')) return 'winter';
    if (text.includes('літо') || text.includes('літн') || text.includes('summer') || text.includes('sport') || text.includes('energy') || text.includes('premium') || text.includes('contact') || text.includes('control') || text.includes('turismo') || text.includes('potenza') || text.includes('ventu') || text.includes('lk01') || text.includes('lk41') || text.includes('s fit') || text.includes('g fit') || text.includes('k125') || text.includes('k115') || text.includes('k127') || text.includes('prime') || text.includes('blue')) return 'summer';
    if (text.includes('всесезон') || text.includes('all season') || text.includes('allseason') || text.includes('4s') || text.includes('quatrac') || text.includes('cross') || text.includes('weather') || text.includes('as')) return 'all-season';
    return null;
};

/** product name → text for a photo search (no "Шина", brackets, DOT codes, year) */
export const normalizeQuery = (title: string): string => {
    return title
        .replace(/^Шина\s+/i, '')
        .replace(/\(.*\)/g, '')
        .replace(/DOT\d{4}/gi, '')
        .replace(/Шина/gi, '')
        .replace(/\d{4}$/, '') // remove year at the end
        .replace(/\s+/g, ' ')
        .trim();
};

/** Radii offered in the edit window for a vehicle type. */
export const getRadiiOptions = (type: string) => {
    switch(type) {
        case 'truck': return TRUCK_RADII;
        case 'agro': return AGRO_RADII;
        case 'cargo': return CARGO_RADII;
        case 'car': 
        case 'suv':
        default: return CAR_RADII;
    }
};

/** green tick: the product has a description, SEO texts and a real photo */
export const isProductReady = (tyre: TyreProduct) => {
  return !!(tyre.description && tyre.seo_title && tyre.seo_description && tyre.image_url && !tyre.image_url.includes('picsum.photos'));
};

/** "buckets" of the products menu: by vehicle type or by state */
export type TyreBucket = 'all' | 'car' | 'cargo' | 'truck' | 'agro' | 'suv' | 'hot' | 'out_of_stock' | 'no_photo' | 'ready';

/** Adds the conditions of a bucket to a Supabase query on `tyres`. */
export const applyBucketFilter = (query: any, bucket: TyreBucket) => {
  if (bucket === 'car') query = query.or('vehicle_type.eq.car,vehicle_type.is.null').neq('vehicle_type', 'cargo').neq('vehicle_type', 'suv').not('radius', 'ilike', '%C%');
  else if (bucket === 'cargo') query = query.or('vehicle_type.eq.cargo,radius.ilike.%C%').not('radius', 'in', '("R17.5","R19.5","R22.5")');
  else if (bucket === 'truck') query = query.or('radius.eq.R17.5,radius.eq.R19.5,radius.eq.R22.5,title.ilike.%TIR%,title.ilike.%R17.5%,title.ilike.%R19.5%,title.ilike.%R22.5%');
  else if (bucket === 'agro') {
      const strictAgroRadii = [
          "R10","R12","R14.5","R15.3","R15.5","R24","R26","R28","R30","R32","R34","R36","R38","R40","R42","R44","R46","R48","R50","R52"
      ];
      const specKeywords = "title.ilike.%PR%,title.ilike.%OZKA%,title.ilike.%BKT%,title.ilike.%KNK%,title.ilike.%MPT%,title.ilike.%IND%,title.ilike.%TR-%,title.ilike.%IMP%,title.ilike.%Ф-%,title.ilike.%В-%";
      // Strong exclusion of Cargo terms
      query = query.or(`vehicle_type.eq.agro,and(vehicle_type.neq.car,vehicle_type.neq.suv,vehicle_type.neq.cargo,or(radius.in.("${strictAgroRadii.join('","')}"),${specKeywords}))`)
                   .not('title', 'ilike', '%(C)%')
                   .not('title', 'ilike', '% LT%')
                   .not('title', 'ilike', '%R14C%')
                   .not('title', 'ilike', '%R15C%')
                   .not('title', 'ilike', '%R16C%');
  }
  else if (bucket === 'suv') query = query.eq('vehicle_type', 'suv');
  else if (bucket === 'hot') query = query.eq('is_hot', true);
  else if (bucket === 'out_of_stock') query = query.eq('in_stock', false);
  else if (bucket === 'no_photo') query = query.is('image_url', null);
  else if (bucket === 'ready') {
      query = query.not('description', 'is', null)
                   .not('seo_title', 'is', null)
                   .not('seo_description', 'is', null)
                   .not('image_url', 'is', null)
                   .not('image_url', 'ilike', '%picsum.photos%');
  }
  return query;
};
