/**
 * Load index / speed index of a tyre, e.g. "75H" or "121/120R" in the title.
 * Load index → maximum load per tyre (kg), speed symbol → maximum speed (km/h).
 */
const LOAD_KG: Record<number, number> = {
  60: 250, 61: 257, 62: 265, 63: 272, 64: 280, 65: 290, 66: 300, 67: 307, 68: 315, 69: 325,
  70: 335, 71: 345, 72: 355, 73: 365, 74: 375, 75: 387, 76: 400, 77: 412, 78: 425, 79: 437,
  80: 450, 81: 462, 82: 475, 83: 487, 84: 500, 85: 515, 86: 530, 87: 545, 88: 560, 89: 580,
  90: 600, 91: 615, 92: 630, 93: 650, 94: 670, 95: 690, 96: 710, 97: 730, 98: 750, 99: 775,
  100: 800, 101: 825, 102: 850, 103: 875, 104: 900, 105: 925, 106: 950, 107: 975, 108: 1000, 109: 1030,
  110: 1060, 111: 1090, 112: 1120, 113: 1150, 114: 1180, 115: 1215, 116: 1250, 117: 1285, 118: 1320, 119: 1360,
  120: 1400, 121: 1450, 122: 1500, 123: 1550, 124: 1600, 125: 1650, 126: 1700, 127: 1750, 128: 1800, 129: 1850,
  130: 1900, 131: 1950, 132: 2000, 133: 2060, 134: 2120, 135: 2180, 136: 2240, 137: 2300, 138: 2360, 139: 2430,
  140: 2500, 141: 2575, 142: 2650, 143: 2725, 144: 2800, 145: 2900, 146: 3000, 147: 3075, 148: 3150, 149: 3250,
  150: 3350, 151: 3450, 152: 3550, 153: 3650, 154: 3750, 155: 3875, 156: 4000, 157: 4125, 158: 4250, 159: 4375, 160: 4500,
};
const SPEED_KMH: Record<string, number> = {
  J: 100, K: 110, L: 120, M: 130, N: 140, P: 150, Q: 160, R: 170, S: 180, T: 190, U: 200, H: 210, V: 240, W: 270, Y: 300,
};

export interface TyreIndex { code: string; load: number; load2?: number; speed: string; kg?: number; kmh?: number }

/** Finds "75H", "102V XL", "121/120R" in a tyre title. */
export const parseTyreIndex = (title: string): TyreIndex | null => {
  const m = (title || '').match(/(?:^|[\s(])(\d{2,3})(?:\/(\d{2,3}))?([JKLMNPQRSTUHVWY])(?=[\s),]|$)/);
  if (!m) return null;
  const load = Number(m[1]);
  if (load < 60 || load > 160) return null;
  const speed = m[3];
  return {
    code: `${m[1]}${m[2] ? `/${m[2]}` : ''}${speed}`,
    load, load2: m[2] ? Number(m[2]) : undefined, speed,
    kg: LOAD_KG[load], kmh: SPEED_KMH[speed],
  };
};

export const describeTyreIndex = (i: TyreIndex): string =>
  [i.kg ? `до ${i.kg} кг на шину` : '', i.kmh ? `до ${i.kmh} км/год` : ''].filter(Boolean).join(', ');
