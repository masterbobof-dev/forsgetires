/**
 * «Точки: Фортеці» — a turn-based strategy on the paper grid, for 2–4 players.
 *
 * - Two actions per turn, players in turn 1 → 2 → … → n.
 * - A closed ring of your dots makes a CITY: its inside is your territory, you build there and it gives gold.
 * - Income at the start of your turn: 1 + 1 per 4 points of your closed cities + 2 per market inside them.
 * - Buildings (inside your city): tower 5 (shoots at the end of your turn), citadel 10 (strong, shoots further and harder),
 *   barracks 4 (soldiers), factory 6 (tanks), market 6 (+2 gold), house 3 (+1 gold), hospital 4 (heals units around it).
 * - Units: soldier 3 (1 hp, walks 2, hits next to it), light tank 6 (3 hp, drives 3, shoots 2 away for 2),
 *   heavy tank 10 (6 hp, drives 2, shoots 3 away for 3).
 * - The land: rocks (nobody passes, no dots, shots do not fly through), forest (tanks do not pass), gold deposits:
 *   a mine (5) on a deposit the player holds (his points or units within 2) digs 3 gold a turn.
 * - Building takes turns (tower 1 … citadel 3); an unfinished building does not work.
 * - Workers (2, hired at a house): next to a building site it builds twice as fast, next to a mine +1 gold,
 *   next to the forest +1 gold (wood). They do not fight.
 *   A unit moves OR attacks once per turn; it passes through its own wall dots (gates) but not between enemy dots.
 * - A broken wall: at the start of the owner's turn the city fights back. If the defence near it (towers, own units)
 *   is at least as strong as the attackers, the wall is rebuilt around the city; if the enemy is stronger, the city
 *   shrinks — its outer row becomes the new wall (buildings there are lost) and it closes again, smaller.
 * - Ring capture as in the old game: a ring around other players' dots, buildings, units or city takes them all
 *   (dot +1, building becomes yours +5, unit destroyed +2/+4). Destroying a unit gives +2/+4, a building +3.
 * - 30 points, or the most points after 40 rounds, wins.
 *
 * The game is a list of actions; every screen replays it the same way.
 */
export type BuildKind = 'tower' | 'barracks' | 'market' | 'house' | 'factory' | 'hospital' | 'citadel' | 'mine';
export type UnitKind = 'soldier' | 'tank' | 'heavy' | 'worker';
export type Action =
  | { t: 'dot'; i: number; p?: number }
  | { t: 'build'; k: BuildKind; i: number; p?: number }
  | { t: 'hire'; k: UnitKind; i: number; p?: number }
  | { t: 'move'; u: number; i: number; p?: number }
  | { t: 'attack'; u: number; i: number; p?: number }
  | { t: 'end'; p?: number };

/** what happened during an action — the screen turns these into animation */
export type FxEvent =
  | { k: 'dot'; i: number; p: number }
  | { k: 'build'; i: number; p: number }
  | { k: 'hire'; i: number; p: number; unit: UnitKind }
  | { k: 'move'; u: number; path: number[]; p: number; unit: UnitKind }
  | { k: 'shot'; from: number; to: number; by: UnitKind | 'tower' | 'citadel'; p: number }
  | { k: 'hit'; i: number }
  | { k: 'boom'; i: number; big: boolean; p: number; what?: UnitKind | BuildKind }
  | { k: 'wall'; i: number; p: number }
  | { k: 'capture'; cells: number[]; p: number }
  | { k: 'shrink'; cells: number[]; p: number }
  | { k: 'repair'; cells: number[]; p: number }
  | { k: 'score'; i: number; p: number; pts: number }
  | { k: 'heal'; i: number; p: number }
  | { k: 'built'; i: number; p: number }
  | { k: 'mined'; i: number; p: number; gold: number }
  | { k: 'chop'; i: number; p: number };

export interface Building { id: number; k: BuildKind; p: number; i: number; hp: number; left?: number }
/** a building works only when it is finished (as in real-time strategies, building takes time) */
export const ready = (b: Building) => !b.left;
export interface Unit { id: number; k: UnitKind; p: number; i: number; hp: number; acted: boolean }
export interface FState {
  n: number; w: number; h: number;
  dot: Int8Array;     // whose dot (0 none)
  ground: Uint8Array; // the land: 0 field, 1 rocks (nobody passes, no dots, shots do not fly through), 2 forest (tanks do not pass)
  terr: Int8Array;    // whose city territory the point is (stays while the city stands, even with a broken wall)
  inside: Int8Array;  // whose CLOSED city the point is in: build here, income, towers work
  gold: number[];
  score: number[];
  buildings: Building[];
  units: Unit[];
  turn: number; actions: number; round: number;
  winner: number;     // 0 playing, 1..4 the winner, 99 a draw
  nextId: number;
  last: number[];     // points touched by the last action (highlight)
  log: string;        // what happened last (for the screen)
  events: FxEvent[];  // what happened during the last action (for the animation)
  fresh?: FxEvent[];  // makeReplayer: what happened in the actions that just came
}

export const COST = { tower: 5, barracks: 4, market: 6, house: 3, factory: 6, hospital: 4, citadel: 10, mine: 5, soldier: 3, tank: 6, heavy: 10, worker: 2 } as const;
export const HP = { tower: 3, barracks: 2, market: 2, house: 2, factory: 3, hospital: 2, citadel: 6, mine: 3, soldier: 1, tank: 3, heavy: 6, worker: 1 } as const;
/** turns a building takes to build */
export const BUILD_TURNS: Record<BuildKind, number> = { tower: 1, barracks: 1, market: 1, house: 1, factory: 2, hospital: 1, citadel: 3, mine: 2 };
/** gold a mine digs every turn */
export const MINE_GOLD = 3;
export const MOVE = { soldier: 2, tank: 3, heavy: 2, worker: 3 } as const;
export const RANGE = { soldier: 1, tank: 2, heavy: 3, worker: 0 } as const;
export const DMG = { soldier: 1, tank: 2, heavy: 3, worker: 0 } as const;
export const POWER = { soldier: 1, tank: 3, heavy: 5, worker: 0 } as const;
export const NAMES_UA = {
  tower: 'башта', barracks: 'казарма', market: 'ринок', house: 'житло', factory: 'завод', hospital: 'шпиталь', citadel: 'цитадель', mine: 'шахта',
  soldier: 'воїн', tank: 'легкий танк', heavy: 'важкий танк', worker: 'робітник',
} as const;
/** which building a unit is hired at: soldiers at the barracks, tanks at the factory */
export const HIRED_AT: Record<UnitKind, BuildKind> = { soldier: 'barracks', tank: 'factory', heavy: 'factory', worker: 'house' };
export const ROCK = 1, FOREST = 2, GOLD = 3;
/** points for destroying or capturing a unit */
export const KILL: Record<UnitKind, number> = { soldier: 2, tank: 4, heavy: 6, worker: 1 };
export const WIN_SCORE = 30, MAX_ROUNDS = 40, ACTIONS = 2;
const TOWER_RANGE = 3;

/** a bigger board for more players */
export const boardSize = (n: number): [number, number] => (n <= 2 ? [21, 27] : n === 3 ? [25, 31] : [27, 33]);

/**
 * The land of a board: groups of rocks (mountains) and forests, the same for every game of this size
 * (every screen builds the same map), away from the players' home points. With two players it is mirrored, so it is fair.
 */
export const makeGround = (w: number, h: number, n: number): Uint8Array => {
  const g = new Uint8Array(w * h);
  let seed = (w * 7919 + h * 104729 + n * 1299709) >>> 0;
  const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const shape = { w, h, n } as FState;
  const homes = Array.from({ length: n }, (_, k) => home(shape, k + 1));
  const okAt = (x: number, y: number) => x >= 1 && y >= 1 && x < w - 1 && y < h - 1 && homes.every(([hx, hy]) => Math.max(Math.abs(hx - x), Math.abs(hy - y)) > 4);
  const groups = Math.round((w * h) / (n === 2 ? 55 : 40));
  for (let k = 0; k < groups; k++) {
    const kind = rnd() < 0.45 ? ROCK : FOREST;
    let x = 1 + Math.floor(rnd() * (w - 2)), y = 1 + Math.floor(rnd() * (h - 2));
    const size = 3 + Math.floor(rnd() * 5);
    for (let c = 0; c < size * 3 && c < 40; c++) {
      if (okAt(x, y)) {
        g[y * w + x] = kind;
        if (n === 2 && okAt(w - 1 - x, h - 1 - y)) g[(h - 1 - y) * w + (w - 1 - x)] = kind;
      }
      const d = Math.floor(rnd() * 4); x += d === 0 ? 1 : d === 1 ? -1 : 0; y += d === 2 ? 1 : d === 3 ? -1 : 0;
      if (c >= size) break;
    }
  }
  // gold deposits: one beside every home and a couple in the middle (to fight for); rocks around them are cleared
  const put = (x: number, y: number) => {
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) return;
    g[y * w + x] = GOLD;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[(y + dy) * w + x + dx] === ROCK) g[(y + dy) * w + x + dx] = 0;
  };
  for (const [hx, hy] of homes) put(hx + (hx < w / 2 ? 5 : -5), hy + (hy < h / 2 ? 1 : -1));
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  if (n === 2) { put(3, cy); put(w - 4, cy); } else { put(cx, cy); put(3, cy); put(w - 4, cy); }
  return g;
};
const groundCache = new Map<string, Uint8Array>();

export const newFortress = (n = 2, size?: [number, number]): FState => {
  const [w, h] = size || boardSize(n);
  const key = `${w}x${h}x${n}`;
  if (!groundCache.has(key)) groundCache.set(key, makeGround(w, h, n));
  return {
    n, w, h, dot: new Int8Array(w * h), ground: groundCache.get(key)!, terr: new Int8Array(w * h), inside: new Int8Array(w * h),
    gold: Array(n + 1).fill(3), score: Array(n + 1).fill(0), buildings: [], units: [],
    turn: 1, actions: ACTIONS, round: 1, winner: 0, nextId: 1, last: [], log: '', events: [],
  };
};

export const clone = (s: FState): FState => ({
  ...s, dot: s.dot.slice(), terr: s.terr.slice(), inside: s.inside.slice(), gold: [...s.gold], score: [...s.score],
  buildings: s.buildings.map(b => ({ ...b })), units: s.units.map(u => ({ ...u })), last: [...s.last], events: [],
});

const xy = (s: FState, i: number) => [i % s.w, Math.floor(i / s.w)];
export const dist = (s: FState, a: number, b: number) => { const [ax, ay] = xy(s, a), [bx, by] = xy(s, b); return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); };
export const buildingAt = (s: FState, i: number) => s.buildings.find(b => b.i === i);
export const unitAt = (s: FState, i: number) => s.units.find(u => u.i === i);
/** nothing stands on the point */
export const empty = (s: FState, i: number) => !s.dot[i] && !buildingAt(s, i) && !unitAt(s, i);
/** rocks stop everybody, forest stops tanks (soldiers go through) */
export const passable = (s: FState, k: UnitKind, i: number) => s.ground[i] !== ROCK && !(s.ground[i] === FOREST && k !== 'soldier' && k !== 'worker');
/** a shot flies only if no rocks stand between (a straight line from point to point) */
export const clearShot = (s: FState, a: number, b: number) => {
  let [x0, y0] = [a % s.w, Math.floor(a / s.w)]; const [x1, y1] = [b % s.w, Math.floor(b / s.w)];
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
  for (;;) {
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; }
    if ((x0 !== x1 || y0 !== y1) && s.ground[y0 * s.w + x0] === ROCK) return false;
  }
};
export const players = (s: FState) => Array.from({ length: s.n }, (_, k) => k + 1);
const others = (s: FState, p: number) => players(s).filter(q => q !== p);
const n4 = (s: FState, i: number) => {
  const [x, y] = xy(s, i); const out: number[] = [];
  if (x > 0) out.push(i - 1); if (x < s.w - 1) out.push(i + 1); if (y > 0) out.push(i - s.w); if (y < s.h - 1) out.push(i + s.w);
  return out;
};
export const n8 = (s: FState, i: number) => {
  const [x, y] = xy(s, i); const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < s.w && ny < s.h) out.push(ny * s.w + nx);
  }
  return out;
};

/** points the outside reaches (moving up / down / left / right) without crossing p's dots */
const outside = (s: FState, p: number) => {
  const n = s.w * s.h, wall = (i: number) => s.dot[i] === p;
  const free = new Uint8Array(n); const stack: number[] = [];
  const push = (i: number) => { if (!free[i] && !wall(i)) { free[i] = 1; stack.push(i); } };
  for (let x = 0; x < s.w; x++) { push(x); push((s.h - 1) * s.w + x); }
  for (let y = 0; y < s.h; y++) { push(y * s.w); push(y * s.w + s.w - 1); }
  while (stack.length) for (const j of n4(s, stack.pop()!)) push(j);
  return free;
};
/** p's rings: the pockets the outside can't reach */
const pockets = (s: FState, p: number): number[][] => {
  const free = outside(s, p); const done = new Uint8Array(s.w * s.h); const out: number[][] = [];
  for (let i = 0; i < s.w * s.h; i++) {
    if (free[i] || s.dot[i] === p || done[i]) continue;
    const pocket = [i]; done[i] = 1; const q = [i];
    while (q.length) for (const j of n4(s, q.pop()!)) if (!done[j] && !free[j] && s.dot[j] !== p) { done[j] = 1; pocket.push(j); q.push(j); }
    out.push(pocket);
  }
  return out;
};

/**
 * What is drawn as a wall: neighbouring points of one player that are part of a closed figure (any ring of points,
 * even a small square with nothing inside) or that stand next to his city. A diagonal is drawn only where the square
 * has no corner of the same player (otherwise the wall would cross itself). Loose tails of points are not walls.
 */
/** a point of p deep inside his fortress: all eight neighbours are his points or his city (old inner walls) */
export const innerDot = (s: FState, i: number) => {
  const p = s.dot[i]; if (!p) return false;
  const nb = n8(s, i); return nb.length === 8 && nb.every(j => s.dot[j] === p || s.terr[j] === p);
};
export const wallEdges = (s: FState): { a: number; b: number; p: number }[] => {
  const own = (i: number, p: number) => s.dot[i] === p;
  const touches = (i: number, p: number) => n8(s, i).some(j => s.terr[j] === p);
  const cand: { a: number; b: number; p: number }[] = [];
  for (let i = 0; i < s.dot.length; i++) {
    const p = s.dot[i]; if (!p) continue;
    const x = i % s.w, y = Math.floor(i / s.w);
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || nx >= s.w || ny >= s.h) continue;
      const j = ny * s.w + nx; if (!own(j, p)) continue;
      if (dx && dy && (own(y * s.w + nx, p) || own(ny * s.w + x, p))) continue;
      if (innerDot(s, i) && innerDot(s, j)) continue; // old walls inside the city are not drawn
      cand.push({ a: i, b: j, p });
    }
  }
  // an edge is in a closed figure if its ends stay connected without it
  const adj = new Map<number, number[]>();
  for (const e of cand) { (adj.get(e.a) || adj.set(e.a, []).get(e.a)!).push(e.b); (adj.get(e.b) || adj.set(e.b, []).get(e.b)!).push(e.a); }
  const inRing = (e: { a: number; b: number }) => {
    const seen = new Set([e.a]); const q = [e.a];
    while (q.length) {
      const c = q.pop()!;
      for (const d of adj.get(c) || []) {
        if ((c === e.a && d === e.b) || (c === e.b && d === e.a) || seen.has(d)) continue;
        if (d === e.b) return true;
        seen.add(d); q.push(d);
      }
    }
    return false;
  };
  return cand.filter(e => (touches(e.a, e.p) && touches(e.b, e.p)) || inRing(e));
};

/** small closed squares of four points of one player (nothing inside, but it is a closed part of the fortress) */
export const closedSquares = (s: FState): { i: number; p: number }[] => {
  const out: { i: number; p: number }[] = [];
  for (let y = 0; y < s.h - 1; y++) for (let x = 0; x < s.w - 1; x++) {
    const i = y * s.w + x, p = s.dot[i];
    if (p && s.dot[i + 1] === p && s.dot[i + s.w] === p && s.dot[i + s.w + 1] === p) out.push({ i, p });
  }
  return out;
};

const recountInside = (s: FState) => {
  s.inside.fill(0);
  for (const p of players(s)) for (const pocket of pockets(s, p)) for (const c of pocket) if (s.terr[c] === p) s.inside[c] = p;
};

/** rings take what the other players have inside them; the inside becomes the ring owner's city */
const enclose = (s: FState, first: number) => {
  const order = [first, ...others(s, first)];
  for (const p of order) {
    for (const pocket of pockets(s, p)) {
      const before = s.score[p]; let fresh = false;
      for (const c of pocket) {
        const d = s.dot[c];
        if (d && d !== p) { s.dot[c] = 0; s.score[p] += 1; }
        const b = buildingAt(s, c);
        if (b && b.p !== p) { b.p = p; s.score[p] += 5; s.log = `Захоплено: ${NAMES_UA[b.k]}`; }
        const u = unitAt(s, c);
        if (u && u.p !== p) { s.units = s.units.filter(x => x !== u); s.score[p] += KILL[u.k]; }
        if (s.terr[c] !== p) fresh = true;
        s.terr[c] = p;
      }
      if (fresh || s.score[p] > before) {
        s.events.push({ k: 'capture', cells: pocket, p });
        if (s.score[p] > before) s.events.push({ k: 'score', i: pocket[Math.floor(pocket.length / 2)], p, pts: s.score[p] - before });
      }
    }
  }
  recountInside(s);
};

const damage = (s: FState, attacker: number, i: number, dmg: number): boolean => {
  const u = unitAt(s, i);
  if (u && u.p !== attacker) {
    u.hp -= dmg;
    if (u.hp <= 0) {
      const pts = KILL[u.k];
      s.units = s.units.filter(x => x !== u); s.score[attacker] += pts; s.log = `Знищено: ${NAMES_UA[u.k]}`;
      s.events.push({ k: 'boom', i, big: u.k !== 'soldier', p: u.p, what: u.k }, { k: 'score', i, p: attacker, pts });
    } else s.events.push({ k: 'hit', i });
    return true;
  }
  const b = buildingAt(s, i);
  if (b && b.p !== attacker) {
    b.hp -= dmg;
    if (b.hp <= 0) {
      s.buildings = s.buildings.filter(x => x !== b); s.score[attacker] += 3; s.log = `Зруйновано: ${NAMES_UA[b.k]}`;
      s.events.push({ k: 'boom', i, big: true, p: b.p, what: b.k }, { k: 'score', i, p: attacker, pts: 3 });
    } else s.events.push({ k: 'hit', i });
    return true;
  }
  if (s.dot[i] && s.dot[i] !== attacker) { s.events.push({ k: 'wall', i, p: s.dot[i] }); s.dot[i] = 0; s.log = 'Стіну пробито'; return true; }
  return false;
};

/** the way a unit drives to a point (the same steps as reach), for the animation */
export const pathTo = (s: FState, u: Unit, to: number): number[] => {
  const prev = new Map<number, number>([[u.i, -1]]); const q = [u.i];
  while (q.length) {
    const c = q.shift()!;
    if (c === to) break;
    for (const j of n4(s, c)) {
      if (prev.has(j)) continue;
      const gate = s.dot[j] === u.p && !buildingAt(s, j) && !unitAt(s, j);
      if ((!empty(s, j) && !gate) || !passable(s, u.k, j)) continue;
      prev.set(j, c); q.push(j);
    }
  }
  if (!prev.has(to)) return [u.i, to];
  const path: number[] = []; for (let c = to; c !== -1; c = prev.get(c)!) path.unshift(c);
  return path;
};

/** points a unit can drive to this turn (up / down / left / right over free points; own wall dots are gates) */
export const reach = (s: FState, u: Unit): number[] => {
  const steps = MOVE[u.k]; const seen = new Map<number, number>([[u.i, 0]]); const q = [u.i]; const out: number[] = [];
  while (q.length) {
    const c = q.shift()!; const d = seen.get(c)!;
    if (d === steps) continue;
    for (const j of n4(s, c)) {
      if (seen.has(j)) continue;
      const gate = s.dot[j] === u.p && !buildingAt(s, j) && !unitAt(s, j);
      if ((!empty(s, j) && !gate) || !passable(s, u.k, j)) continue;
      seen.set(j, d + 1); q.push(j);
      if (!gate) out.push(j);
    }
  }
  return out;
};
/** what a unit can hit from where it stands */
export const targets = (s: FState, u: Unit): number[] => {
  const out: number[] = [];
  const [ux, uy] = xy(s, u.i); const r = RANGE[u.k];
  for (let y = Math.max(0, uy - r); y <= Math.min(s.h - 1, uy + r); y++) for (let x = Math.max(0, ux - r); x <= Math.min(s.w - 1, ux + r); x++) {
    const i = y * s.w + x; if (i === u.i || !clearShot(s, u.i, i)) continue;
    if ((s.dot[i] && s.dot[i] !== u.p) || (buildingAt(s, i) && buildingAt(s, i)!.p !== u.p) || (unitAt(s, i) && unitAt(s, i)!.p !== u.p)) out.push(i);
  }
  return out;
};
/** free points next to the building where this kind of unit is hired (soldiers: barracks, tanks: factory) */
export const hireSpots = (s: FState, p: number, k: UnitKind = 'soldier'): number[] => {
  const out = new Set<number>();
  for (const b of s.buildings) if (b.p === p && b.k === HIRED_AT[k] && ready(b)) for (const j of n8(s, b.i)) if (empty(s, j) && passable(s, k, j)) out.add(j);
  return [...out];
};
export const canDot = (s: FState, p: number, i: number) => empty(s, i) && s.ground[i] !== ROCK && s.ground[i] !== GOLD && (!s.inside[i] || s.inside[i] === p);
/** p holds the point: his city, or his points or units within two steps */
const holds = (s: FState, p: number, i: number) => {
  if (s.inside[i] === p) return true;
  const x0 = i % s.w, y0 = Math.floor(i / s.w);
  for (let y = Math.max(0, y0 - 2); y <= Math.min(s.h - 1, y0 + 2); y++) for (let x = Math.max(0, x0 - 2); x <= Math.min(s.w - 1, x0 + 2); x++) {
    const j = y * s.w + x; if (s.dot[j] === p || unitAt(s, j)?.p === p) return true;
  }
  return false;
};
/** buildings stand inside the own closed city; a mine — on a gold deposit that p holds (not inside someone else's city) */
export const canBuild = (s: FState, p: number, k: BuildKind, i: number) => {
  if (!empty(s, i) || s.gold[p] < COST[k]) return false;
  if (k === 'mine') return s.ground[i] === GOLD && (!s.inside[i] || s.inside[i] === p) && holds(s, p, i);
  return !s.ground[i] && s.inside[i] === p;
};

/** cells inside the closed cities of p */
export const landOf = (s: FState, p: number) => { let n = 0; for (let i = 0; i < s.inside.length; i++) if (s.inside[i] === p) n++; return n; };
export const LAND_PER_POINT = 12;

export const income = (s: FState, p: number) => {
  let inner = 0; for (let i = 0; i < s.inside.length; i++) if (s.inside[i] === p) inner++;
  const has = (k: BuildKind) => s.buildings.filter(b => b.p === p && b.k === k && ready(b) && s.inside[b.i] === p).length;
  const mines = s.buildings.filter(b => b.p === p && b.k === 'mine' && ready(b)).length;
  return 1 + Math.floor(inner / 4) + has('market') * 2 + has('house') + mines * MINE_GOLD;
};

/** the cities of p whose wall is broken: rebuilt if the defence holds, else they shrink by one row */
const settleCities = (s: FState, p: number) => {
  const n = s.w * s.h; const seen = new Uint8Array(n); const msgs: string[] = [];
  for (let i = 0; i < n; i++) {
    if (seen[i] || s.terr[i] !== p) continue;
    const region = [i]; seen[i] = 1; const q = [i];
    while (q.length) for (const j of n4(s, q.pop()!)) if (!seen[j] && s.terr[j] === p) { seen[j] = 1; region.push(j); q.push(j); }
    if (region.every(c => s.inside[c] === p)) continue; // closed: nothing to do
    const near = (c: number) => region.some(r => dist(s, r, c) <= 2);
    let attack = 0, defence = 1;
    for (const u of s.units) if (near(u.i)) { if (u.p === p) defence += POWER[u.k]; else attack += POWER[u.k]; }
    for (const b of s.buildings) if (b.p === p && ready(b) && region.includes(b.i)) defence += b.k === 'citadel' ? 4 : b.k === 'tower' ? 2 : 0;
    const inRegion = new Set(region);
    if (defence >= attack) {
      // rebuild the wall around the whole city
      const built: number[] = [];
      for (const c of region) for (const j of n8(s, c)) if (!inRegion.has(j) && empty(s, j) && s.ground[j] !== ROCK) { s.dot[j] = p; built.push(j); }
      recountInside(s);
      if (built.length) s.events.push({ k: 'repair', cells: built, p });
      if (region.every(c => s.inside[c] === p)) { msgs.push('Стіну відновлено'); continue; }
    }
    // the enemy is stronger (or the gap is blocked): the outer row of the city becomes the new wall
    const free = outside(s, p);
    const rim = region.filter(c => n4(s, c).some(j => free[j] && !inRegion.has(j)) || n4(s, c).length < 4);
    const moved: number[] = [];
    for (const c of rim) {
      if (unitAt(s, c) || s.ground[c] === ROCK) continue;
      const b = buildingAt(s, c); if (b) { s.buildings = s.buildings.filter(x => x !== b); s.events.push({ k: 'boom', i: c, big: true, p, what: b.k }); }
      s.dot[c] = p; s.terr[c] = 0; moved.push(c);
    }
    recountInside(s);
    s.events.push({ k: 'shrink', cells: moved, p });
    msgs.push('Місто стискається під натиском');
  }
  if (msgs.length) s.log = msgs[0];
};

const checkWin = (s: FState) => {
  const best = Math.max(...players(s).map(p => s.score[p]));
  if (best >= WIN_SCORE) s.winner = players(s).find(p => s.score[p] === best)!;
};

/** what a unit shoots at first: units, then buildings, then wall points */
const targetRank = (s: FState, i: number) => (unitAt(s, i) ? 3 : buildingAt(s, i) ? 2 : 1);
export const bestTarget = (s: FState, u: Unit): number | null => {
  const t = targets(s, u);
  return t.length ? t.reduce((a, b) => (targetRank(s, b) > targetRank(s, a) ? b : a)) : null;
};
/** a unit can still do something this turn */
export const canAct = (s: FState, u: Unit) => !u.acted && (reach(s, u).length > 0 || targets(s, u).length > 0);
/**
 * One step of a march order (as in real-time strategies): shoot an enemy unit in range, else go towards the goal;
 * near the goal — shoot whatever is in range. null when there is nothing to do.
 */
export const march = (s: FState, u: Unit, goal: number): Action | null => {
  if (u.acted) return null;
  const t = bestTarget(s, u);
  if (t != null && (unitAt(s, t) || dist(s, u.i, goal) <= RANGE[u.k] + 1)) return { t: 'attack', u: u.id, i: t };
  const r = reach(s, u);
  if (r.length && u.i !== goal) {
    const to = r.reduce((a, b) => (dist(s, b, goal) < dist(s, a, goal) || (dist(s, b, goal) === dist(s, a, goal) && pathTo(s, u, b).length < pathTo(s, u, a).length) ? b : a));
    if (dist(s, to, goal) < dist(s, u.i, goal)) return { t: 'move', u: u.id, i: to };
  }
  if (t != null) return { t: 'attack', u: u.id, i: t };
  return null;
};

const endTurn = (s: FState) => {
  const p = s.turn;
  // soldiers and tanks that did nothing this turn fire at the nearest enemy in range by themselves
  for (const u of s.units.filter(x => x.p === p && !x.acted)) {
    const t = bestTarget(s, u);
    if (t == null) continue;
    u.acted = true; s.events.push({ k: 'shot', from: u.i, to: t, by: u.k, p }); damage(s, p, t, DMG[u.k]); s.last.push(t);
  }
  // towers and citadels of a closed city shoot: the nearest enemy unit, else a dot of an enemy wall nearby
  // (not through rocks); a citadel shoots further and harder
  for (const t of s.buildings.filter(b => b.p === p && (b.k === 'tower' || b.k === 'citadel') && ready(b) && s.inside[b.i] === p)) {
    const range = t.k === 'citadel' ? TOWER_RANGE + 1 : TOWER_RANGE;
    let best = -1, bd = 99;
    for (const u of s.units) if (u.p !== p) { const d = dist(s, t.i, u.i); if (d <= range && d < bd && clearShot(s, t.i, u.i)) { bd = d; best = u.i; } }
    if (best < 0) for (let i = 0; i < s.dot.length; i++) if (s.dot[i] && s.dot[i] !== p) { const d = dist(s, t.i, i); if (d <= 2 && d < bd && clearShot(s, t.i, i)) { bd = d; best = i; } }
    if (best >= 0) { s.events.push({ k: 'shot', from: t.i, to: best, by: t.k === 'citadel' ? 'citadel' : 'tower', p }); damage(s, p, best, t.k === 'citadel' ? 2 : 1); s.last.push(best); }
  }
  enclose(s, p);
  checkWin(s);
  const next = (p % s.n) + 1;
  s.turn = next; s.actions = ACTIONS;
  if (next === 1) {
    s.round++;
    if (s.round > MAX_ROUNDS && !s.winner) {
      // the most points wins; equal points — the bigger land; still equal — a draw
      const key = (q: number) => s.score[q] * 1000 + landOf(s, q);
      const best = Math.max(...players(s).map(key));
      const top = players(s).filter(q => key(q) === best);
      s.winner = top.length > 1 ? 99 : top[0];
    }
  }
  settleCities(s, next);
  // workers (as the peasants of real-time strategies): next to a building site they build twice as fast,
  // next to a working mine they dig +1 gold, next to the forest they chop wood (+1 gold); each worker does one job
  const workers = s.units.filter(u => u.p === next && u.k === 'worker');
  const busy = new Set<number>();
  const helper = (i: number) => workers.find(w => !busy.has(w.id) && dist(s, w.i, i) <= 1);
  // building goes on: one turn less for every unfinished building of the next player (two with a worker)
  for (const b of s.buildings) if (b.p === next && b.left) {
    const w = helper(b.i); if (w) busy.add(w.id);
    b.left = Math.max(0, b.left - (w ? 2 : 1));
    if (!b.left) s.events.push({ k: 'built', i: b.i, p: next });
  }
  s.gold[next] += income(s, next);
  for (const b of s.buildings) if (b.p === next && b.k === 'mine' && ready(b)) {
    let extra = 0;
    for (let k = 0; k < 2; k++) { const w = helper(b.i); if (w) { busy.add(w.id); extra++; } }
    s.gold[next] += extra;
    s.events.push({ k: 'mined', i: b.i, p: next, gold: MINE_GOLD + extra });
  }
  for (const w of workers) if (!busy.has(w.id) && n8(s, w.i).some(j => s.ground[j] === FOREST)) {
    busy.add(w.id); s.gold[next] += 1; s.events.push({ k: 'chop', i: w.i, p: next });
  }
  // land is worth points too: +1 for every full LAND_PER_POINT cells of closed city, every turn
  const land = landOf(s, next);
  if (land >= LAND_PER_POINT && !s.winner) { s.score[next] += Math.floor(land / LAND_PER_POINT); checkWin(s); }
  for (const u of s.units) if (u.p === next) u.acted = false;
  // wounded soldiers and tanks inside their own closed city or next to their hospital get +1 health a turn
  const hospitals = s.buildings.filter(b => b.p === next && b.k === 'hospital' && ready(b));
  for (const u of s.units) if (u.p === next && u.hp < HP[u.k] && (s.inside[u.i] === next || hospitals.some(h => dist(s, h.i, u.i) <= 2))) { u.hp++; s.events.push({ k: 'heal', i: u.i, p: next }); }
};

/** apply one action of the player whose turn it is; returns false (state unchanged) if it is not allowed */
export const apply = (s: FState, a: Action): boolean => {
  if (s.winner) return false;
  const p = s.turn;
  if (a.p && a.p !== p) return false;
  s.last = []; s.log = ''; s.events = [];
  if (a.t === 'end') { endTurn(s); return true; }
  // orders to soldiers and tanks do not use the player's actions: every unit moves or shoots once a turn
  const unitOrder = a.t === 'move' || a.t === 'attack';
  if (!unitOrder && s.actions <= 0) return false;
  switch (a.t) {
    case 'dot':
      if (!canDot(s, p, a.i)) return false;
      s.dot[a.i] = p; s.last = [a.i]; s.events.push({ k: 'dot', i: a.i, p }); break;
    case 'build':
      if (!canBuild(s, p, a.k, a.i)) return false;
      s.gold[p] -= COST[a.k]; s.buildings.push({ id: s.nextId++, k: a.k, p, i: a.i, hp: HP[a.k], left: BUILD_TURNS[a.k] }); s.last = [a.i]; s.events.push({ k: 'build', i: a.i, p }); break;
    case 'hire':
      if (s.gold[p] < COST[a.k] || !hireSpots(s, p, a.k).includes(a.i)) return false;
      s.gold[p] -= COST[a.k]; s.units.push({ id: s.nextId++, k: a.k, p, i: a.i, hp: HP[a.k], acted: true }); s.last = [a.i]; s.events.push({ k: 'hire', i: a.i, p, unit: a.k }); break;
    case 'move': {
      const u = s.units.find(x => x.id === a.u);
      if (!u || u.p !== p || u.acted || !reach(s, u).includes(a.i)) return false;
      s.events.push({ k: 'move', u: u.id, path: pathTo(s, u, a.i), p, unit: u.k });
      u.i = a.i; u.acted = true; s.last = [a.i]; break;
    }
    case 'attack': {
      const u = s.units.find(x => x.id === a.u);
      if (!u || u.p !== p || u.acted || !targets(s, u).includes(a.i)) return false;
      u.acted = true; s.events.push({ k: 'shot', from: u.i, to: a.i, by: u.k, p }); damage(s, p, a.i, DMG[u.k]); s.last = [a.i]; break;
    }
    default: return false;
  }
  if (!unitOrder) s.actions--;
  enclose(s, p);
  checkWin(s);
  // the turn passes only with an explicit {t:'end'} (the screen sends it by itself after the last action)
  return true;
};

export const replay = (actions: Action[], n = 2, size?: [number, number]): FState => {
  const s = newFortress(n, size);
  for (const a of actions) apply(s, a);
  return s;
};

/** replay with memory: when the list only grew, only the new actions are played (keeps long 4-player games fast) */
export const makeReplayer = () => {
  let memo: { key: string; len: number; lastJson: string; st: FState } | null = null;
  return (actions: Action[], n: number, size: [number, number]): FState => {
    const key = `${n}:${size.join('x')}`;
    let st: FState; let from = 0;
    if (memo && memo.key === key && actions.length >= memo.len && (memo.len === 0 || JSON.stringify(actions[memo.len - 1]) === memo.lastJson)) {
      st = clone(memo.st); from = memo.len;
    } else st = newFortress(n, size);
    const fresh: FxEvent[] = [];
    for (let k = from; k < actions.length; k++) { apply(st, actions[k]); fresh.push(...st.events); }
    memo = { key, len: actions.length, lastJson: actions.length ? JSON.stringify(actions[actions.length - 1]) : '', st };
    // only the actions that just came are animated (a whole replay on opening shows the board still)
    st.fresh = from > 0 ? fresh : [];
    return st;
  };
};

// ------------------------------------------------------------------ the computer player
/** where player p builds its first city */
export const home = (s: FState, p: number): [number, number] => {
  const { w, h, n } = s;
  const spots: [number, number][] = n <= 2
    ? [[Math.floor(w / 2), Math.floor((3 * h) / 4)], [Math.floor(w / 2), Math.floor(h / 4)]]
    : n === 3
      ? [[Math.floor(w / 2), Math.floor((4 * h) / 5)], [Math.floor(w / 4), Math.floor(h / 4)], [Math.floor((3 * w) / 4), Math.floor(h / 4)]]
      : [[Math.floor(w / 4), Math.floor((3 * h) / 4)], [Math.floor((3 * w) / 4), Math.floor(h / 4)], [Math.floor(w / 4), Math.floor(h / 4)], [Math.floor((3 * w) / 4), Math.floor((3 * h) / 4)]];
  return spots[p - 1];
};

/** the best next action for the player whose turn it is (one action at a time) */
export const botAction = (s: FState): Action => {
  const p = s.turn;
  const tryA = (a: Action) => { const c = clone(s); return apply(c, a) ? c : null; };
  // what an action brings: points, plus taken land (it brings points every turn later)
  const worth = (c: FState) => c.score[p] + landOf(c, p) / LAND_PER_POINT;
  const base = worth(s);
  const gain = (c: FState | null) => (c ? worth(c) - base : -1);
  const isEnemy = (q: number) => q && q !== p;

  const free: number[] = [];
  for (let i = 0; i < s.dot.length; i++) if (canDot(s, p, i)) free.push(i);
  const nearDots = free.filter(i => n8(s, i).some(j => s.dot[j]) || s.units.some(u => dist(s, u.i, i) <= 1));

  // 0. the army: every unit marches on the nearest enemy building or city wall, shooting on the way
  const unitStep = (): Action | null => {
    // workers: to a building site, a mine that needs hands, else to the forest nearest home
    for (const u of s.units.filter(x => x.p === p && !x.acted && x.k === 'worker')) {
      const jobs: number[] = [];
      for (const b of s.buildings) if (b.p === p && (b.left || b.k === 'mine')) jobs.push(b.i);
      if (!jobs.length) for (let i = 0; i < s.ground.length; i++) if (s.ground[i] === FOREST && dist(s, i, home(s, p)[1] * s.w + home(s, p)[0]) <= 9) jobs.push(i);
      if (!jobs.length) continue;
      const job = jobs.reduce((a, b) => (dist(s, u.i, b) < dist(s, u.i, a) ? b : a));
      if (dist(s, u.i, job) <= 1) continue; // at work
      const r = reach(s, u); if (!r.length) continue;
      const to = r.reduce((a, b) => (dist(s, b, job) < dist(s, a, job) ? b : a));
      if (dist(s, to, job) < dist(s, u.i, job)) return { t: 'move', u: u.id, i: to };
    }
    for (const u of s.units.filter(x => x.p === p && !x.acted && x.k !== 'worker')) {
      const goals: number[] = [];
      for (const b of s.buildings) if (b.p !== p) goals.push(b.i);
      for (const e of s.units) if (e.p !== p) goals.push(e.i);
      for (let i = 0; i < s.dot.length; i++) if (isEnemy(s.dot[i]) && n8(s, i).some(j => s.terr[j] === s.dot[i])) goals.push(i);
      if (!goals.length) for (let i = 0; i < s.dot.length; i++) if (isEnemy(s.dot[i])) goals.push(i);
      const goal = goals.length ? goals.reduce((a, b) => (dist(s, u.i, b) < dist(s, u.i, a) ? b : a)) : u.i;
      const a = march(s, u, goal);
      if (a) return a;
    }
    return null;
  };
  if (s.actions <= 0) return unitStep() || { t: 'end' };

  // 1. a dot that captures right now
  let bestA: Action | null = null, bestV = 0;
  for (const i of nearDots) { const v = gain(tryA({ t: 'dot', i })); if (v > bestV) { bestV = v; bestA = { t: 'dot', i }; } }
  if (bestA && bestV >= 1) return bestA;

  // 1b. two dots this turn that close a ring around someone else's dots, units or city
  if (s.actions >= 2) {
    const enemyNear = (i: number) => n8(s, i).filter(j => isEnemy(s.dot[j]) || isEnemy(s.terr[j]) || (unitAt(s, j)?.p ?? p) !== p).length;
    const cand = nearDots.filter(i => enemyNear(i) > 0 || n8(s, i).some(j => n8(s, j).some(k => isEnemy(s.dot[k]))))
      .sort((a, b) => enemyNear(b) - enemyNear(a)).slice(0, 22);
    let pair: Action | null = null, pairV = 0;
    for (const a of cand) {
      const c1 = tryA({ t: 'dot', i: a }); if (!c1) continue;
      for (const b of cand) {
        if (b === a) continue;
        const c2 = clone(c1);
        if (!apply(c2, { t: 'dot', i: b })) continue;
        const v = worth(c2) - base;
        if (v > pairV) { pairV = v; pair = { t: 'dot', i: a }; }
      }
    }
    if (pair && pairV >= 1) return pair;
  }
  if (bestA) return bestA;

  // 2. the army moves (free: it does not use the two actions)
  const us = unitStep();
  if (us) return us;

  // 3. danger: another player could capture with his next dot — put ours there first
  let threatI = -1, threatV = 0;
  for (const q of others(s, p)) for (const i of nearDots) {
    const c = clone(s); c.turn = q; c.actions = 1;
    if (apply(c, { t: 'dot', i })) { const v = c.score[q] - s.score[q]; if (v > threatV) { threatV = v; threatI = i; } }
  }
  if (threatI >= 0) return { t: 'dot', i: threatI };

  // 4. economy: tower, barracks, a tank, a market, soldiers
  const mine = (k: BuildKind) => s.buildings.filter(b => b.p === p && b.k === k).length;
  const spots = free.filter(i => s.inside[i] === p);
  const enemyUnitsNear = s.units.some(u => u.p !== p && spots.some(i => dist(s, i, u.i) <= 4));
  // towers stand by the wall (they shoot further out), the rest in the middle
  const pickSpot = (pref: 'edge' | 'middle') => {
    const walls = (i: number) => n8(s, i).filter(j => s.dot[j] === p).length;
    return spots.reduce((a, b) => ((pref === 'edge' ? walls(b) > walls(a) : walls(b) < walls(a)) ? b : a));
  };
  // a gold deposit it holds: a mine there pays off fast
  if (s.gold[p] >= COST.mine && mine('mine') < 3) {
    for (let i = 0; i < s.ground.length; i++) if (s.ground[i] === GOLD && canBuild(s, p, 'mine', i)) return { t: 'build', k: 'mine', i };
  }
  if (spots.length) {
    if ((mine('tower') === 0 || (enemyUnitsNear && mine('tower') < 3) || (s.gold[p] >= 20 && mine('tower') < 4)) && s.gold[p] >= COST.tower) return { t: 'build', k: 'tower', i: pickSpot('edge') };
    if (mine('house') === 0 && s.gold[p] >= COST.house) return { t: 'build', k: 'house', i: pickSpot('middle') };
    if (mine('barracks') === 0 && s.gold[p] >= COST.barracks) return { t: 'build', k: 'barracks', i: pickSpot('middle') };
    if (mine('factory') === 0 && mine('barracks') > 0 && s.round >= 5 && s.gold[p] >= COST.factory) return { t: 'build', k: 'factory', i: pickSpot('middle') };
    if (mine('citadel') === 0 && s.gold[p] >= COST.citadel + 4) return { t: 'build', k: 'citadel', i: pickSpot('edge') };
  }
  const myUnits = s.units.filter(u => u.p === p && u.k !== 'worker').length;
  const myWorkers = s.units.filter(u => u.p === p && u.k === 'worker').length;
  const ws = hireSpots(s, p, 'worker');
  if (ws.length && myWorkers < 1 + mine('mine') && s.gold[p] >= COST.worker + 2) return { t: 'hire', k: 'worker', i: ws[0] };
  // an army that grows with the game: heavy and light tanks from the factory, soldiers from the barracks
  if (myUnits < 4 + Math.floor(s.round / 4)) {
    const enemyDot = s.dot.findIndex(d => isEnemy(d));
    const forward = (hs: number[]) => (enemyDot < 0 ? hs[0] : hs.reduce((a, b) => (dist(s, b, enemyDot) < dist(s, a, enemyDot) ? b : a)));
    const ts = hireSpots(s, p, 'tank'), ss = hireSpots(s, p, 'soldier');
    if (ts.length && s.gold[p] >= COST.heavy && s.round >= 8) return { t: 'hire', k: 'heavy', i: forward(ts) };
    if (ts.length && s.gold[p] >= COST.tank) return { t: 'hire', k: 'tank', i: forward(ts) };
    if (ss.length && s.gold[p] >= COST.soldier && (myUnits < 2 || s.round >= 6)) return { t: 'hire', k: 'soldier', i: forward(ss) };
  }
  if (spots.length) {
    if (mine('market') < 2 && s.gold[p] >= COST.market) return { t: 'build', k: 'market', i: pickSpot('middle') };
    if (mine('house') < 3 && s.gold[p] >= COST.house + 3) return { t: 'build', k: 'house', i: pickSpot('middle') };
    if (mine('hospital') === 0 && myUnits >= 3 && s.gold[p] >= COST.hospital) return { t: 'build', k: 'hospital', i: pickSpot('middle') };
  }

  // 5. build or grow a city: a diamond ring around the home point
  const [cx, cy] = home(s, p);
  for (const r of [2, 3, 4, 5, 6]) {
    const ring: number[] = [];
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
      if (Math.abs(x - cx) + Math.abs(y - cy) === r) ring.push(y * s.w + x);
    }
    const missing = ring.filter(i => s.dot[i] !== p);
    if (!missing.length) continue;
    const ok = missing.filter(i => canDot(s, p, i));
    if (ok.length === missing.length && ok.length) {
      return { t: 'dot', i: ok.reduce((a, b) => (n8(s, b).filter(j => s.dot[j] === p).length > n8(s, a).filter(j => s.dot[j] === p).length ? b : a)) };
    }
  }

  // 6. otherwise: a dot close to other players' dots (to start surrounding them)
  if (nearDots.length) {
    const v = (i: number) => n8(s, i).filter(j => isEnemy(s.dot[j])).length * 3 + n8(s, i).filter(j => s.dot[j] === p).length * 2 + Math.random();
    return { t: 'dot', i: nearDots.reduce((a, b) => (v(b) > v(a) ? b : a)) };
  }
  if (free.length) return { t: 'dot', i: free[Math.floor(Math.random() * free.length)] };
  return { t: 'end' };
};
