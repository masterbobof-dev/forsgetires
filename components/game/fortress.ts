/**
 * «Точки: Фортеці» — a turn-based strategy on the paper grid, for 2–4 players.
 *
 * - Two actions per turn, players in turn 1 → 2 → … → n.
 * - A closed ring of your dots makes a CITY: its inside is your territory, you build there and it gives gold.
 * - Income at the start of your turn: 1 + 1 per 4 points of your closed cities + 2 per market inside them.
 * - Buildings (inside your city): tower 5 (shoots at the end of your turn), barracks 4 (hires units), market 6.
 * - Units (next to your barracks): soldier 3 (1 hp, walks 2, hits next to it), tank 7 (3 hp, drives 3, shoots 2 points away for 2).
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
export type BuildKind = 'tower' | 'barracks' | 'market';
export type UnitKind = 'soldier' | 'tank';
export type Action =
  | { t: 'dot'; i: number; p?: number }
  | { t: 'build'; k: BuildKind; i: number; p?: number }
  | { t: 'hire'; k: UnitKind; i: number; p?: number }
  | { t: 'move'; u: number; i: number; p?: number }
  | { t: 'attack'; u: number; i: number; p?: number }
  | { t: 'end'; p?: number };

export interface Building { id: number; k: BuildKind; p: number; i: number; hp: number }
export interface Unit { id: number; k: UnitKind; p: number; i: number; hp: number; acted: boolean }
export interface FState {
  n: number; w: number; h: number;
  dot: Int8Array;     // whose dot (0 none)
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
}

export const COST = { tower: 5, barracks: 4, market: 6, soldier: 3, tank: 7 } as const;
export const HP = { tower: 3, barracks: 2, market: 2, soldier: 1, tank: 3 } as const;
export const MOVE = { soldier: 2, tank: 3 } as const;
export const RANGE = { soldier: 1, tank: 2 } as const;
export const DMG = { soldier: 1, tank: 2 } as const;
export const POWER = { soldier: 1, tank: 3 } as const;
export const NAMES_UA = { tower: 'башта', barracks: 'казарма', market: 'ринок', soldier: 'воїн', tank: 'танк' } as const;
export const WIN_SCORE = 30, MAX_ROUNDS = 40, ACTIONS = 2;
const TOWER_RANGE = 3;

/** a bigger board for more players */
export const boardSize = (n: number): [number, number] => (n <= 2 ? [21, 27] : n === 3 ? [25, 31] : [27, 33]);

export const newFortress = (n = 2, size?: [number, number]): FState => {
  const [w, h] = size || boardSize(n);
  return {
    n, w, h, dot: new Int8Array(w * h), terr: new Int8Array(w * h), inside: new Int8Array(w * h),
    gold: Array(n + 1).fill(3), score: Array(n + 1).fill(0), buildings: [], units: [],
    turn: 1, actions: ACTIONS, round: 1, winner: 0, nextId: 1, last: [], log: '',
  };
};

export const clone = (s: FState): FState => ({
  ...s, dot: s.dot.slice(), terr: s.terr.slice(), inside: s.inside.slice(), gold: [...s.gold], score: [...s.score],
  buildings: s.buildings.map(b => ({ ...b })), units: s.units.map(u => ({ ...u })), last: [...s.last],
});

const xy = (s: FState, i: number) => [i % s.w, Math.floor(i / s.w)];
export const dist = (s: FState, a: number, b: number) => { const [ax, ay] = xy(s, a), [bx, by] = xy(s, b); return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); };
export const buildingAt = (s: FState, i: number) => s.buildings.find(b => b.i === i);
export const unitAt = (s: FState, i: number) => s.units.find(u => u.i === i);
/** nothing stands on the point */
export const empty = (s: FState, i: number) => !s.dot[i] && !buildingAt(s, i) && !unitAt(s, i);
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

const recountInside = (s: FState) => {
  s.inside.fill(0);
  for (const p of players(s)) for (const pocket of pockets(s, p)) for (const c of pocket) if (s.terr[c] === p) s.inside[c] = p;
};

/** rings take what the other players have inside them; the inside becomes the ring owner's city */
const enclose = (s: FState, first: number) => {
  const order = [first, ...others(s, first)];
  for (const p of order) {
    for (const pocket of pockets(s, p)) {
      for (const c of pocket) {
        const d = s.dot[c];
        if (d && d !== p) { s.dot[c] = 0; s.score[p] += 1; }
        const b = buildingAt(s, c);
        if (b && b.p !== p) { b.p = p; s.score[p] += 5; s.log = `Захоплено: ${NAMES_UA[b.k]}`; }
        const u = unitAt(s, c);
        if (u && u.p !== p) { s.units = s.units.filter(x => x !== u); s.score[p] += u.k === 'tank' ? 4 : 2; }
        s.terr[c] = p;
      }
    }
  }
  recountInside(s);
};

const damage = (s: FState, attacker: number, i: number, dmg: number): boolean => {
  const u = unitAt(s, i);
  if (u && u.p !== attacker) {
    u.hp -= dmg;
    if (u.hp <= 0) { s.units = s.units.filter(x => x !== u); s.score[attacker] += u.k === 'tank' ? 4 : 2; s.log = `Знищено: ${NAMES_UA[u.k]}`; }
    return true;
  }
  const b = buildingAt(s, i);
  if (b && b.p !== attacker) {
    b.hp -= dmg;
    if (b.hp <= 0) { s.buildings = s.buildings.filter(x => x !== b); s.score[attacker] += 3; s.log = `Зруйновано: ${NAMES_UA[b.k]}`; }
    return true;
  }
  if (s.dot[i] && s.dot[i] !== attacker) { s.dot[i] = 0; s.log = 'Стіну пробито'; return true; }
  return false;
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
      if (!empty(s, j) && !gate) continue;
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
    const i = y * s.w + x; if (i === u.i) continue;
    if ((s.dot[i] && s.dot[i] !== u.p) || (buildingAt(s, i) && buildingAt(s, i)!.p !== u.p) || (unitAt(s, i) && unitAt(s, i)!.p !== u.p)) out.push(i);
  }
  return out;
};
/** free points next to the player's barracks */
export const hireSpots = (s: FState, p: number): number[] => {
  const out = new Set<number>();
  for (const b of s.buildings) if (b.p === p && b.k === 'barracks') for (const j of n8(s, b.i)) if (empty(s, j)) out.add(j);
  return [...out];
};
export const canDot = (s: FState, p: number, i: number) => empty(s, i) && (!s.inside[i] || s.inside[i] === p);
export const canBuild = (s: FState, p: number, k: BuildKind, i: number) => empty(s, i) && s.inside[i] === p && s.gold[p] >= COST[k];

export const income = (s: FState, p: number) => {
  let inner = 0; for (let i = 0; i < s.inside.length; i++) if (s.inside[i] === p) inner++;
  const markets = s.buildings.filter(b => b.p === p && b.k === 'market' && s.inside[b.i] === p).length;
  return 1 + Math.floor(inner / 4) + markets * 2;
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
    for (const b of s.buildings) if (b.p === p && b.k === 'tower' && region.includes(b.i)) defence += 2;
    const inRegion = new Set(region);
    if (defence >= attack) {
      // rebuild the wall around the whole city
      for (const c of region) for (const j of n8(s, c)) if (!inRegion.has(j) && empty(s, j)) s.dot[j] = p;
      recountInside(s);
      if (region.every(c => s.inside[c] === p)) { msgs.push('Стіну відновлено'); continue; }
    }
    // the enemy is stronger (or the gap is blocked): the outer row of the city becomes the new wall
    const free = outside(s, p);
    const rim = region.filter(c => n4(s, c).some(j => free[j] && !inRegion.has(j)) || n4(s, c).length < 4);
    for (const c of rim) {
      if (unitAt(s, c)) continue;
      const b = buildingAt(s, c); if (b) s.buildings = s.buildings.filter(x => x !== b);
      s.dot[c] = p; s.terr[c] = 0;
    }
    recountInside(s);
    msgs.push('Місто стискається під натиском');
  }
  if (msgs.length) s.log = msgs[0];
};

const checkWin = (s: FState) => {
  const best = Math.max(...players(s).map(p => s.score[p]));
  if (best >= WIN_SCORE) s.winner = players(s).find(p => s.score[p] === best)!;
};

const endTurn = (s: FState) => {
  const p = s.turn;
  // towers of a closed city shoot: the nearest enemy unit, else a dot of an enemy wall nearby
  for (const t of s.buildings.filter(b => b.p === p && b.k === 'tower' && s.inside[b.i] === p)) {
    let best = -1, bd = 99;
    for (const u of s.units) if (u.p !== p) { const d = dist(s, t.i, u.i); if (d <= TOWER_RANGE && d < bd) { bd = d; best = u.i; } }
    if (best < 0) for (let i = 0; i < s.dot.length; i++) if (s.dot[i] && s.dot[i] !== p) { const d = dist(s, t.i, i); if (d <= 2 && d < bd) { bd = d; best = i; } }
    if (best >= 0) { damage(s, p, best, 1); s.last.push(best); }
  }
  enclose(s, p);
  checkWin(s);
  const next = (p % s.n) + 1;
  s.turn = next; s.actions = ACTIONS;
  if (next === 1) {
    s.round++;
    if (s.round > MAX_ROUNDS && !s.winner) {
      const best = Math.max(...players(s).map(q => s.score[q]));
      const top = players(s).filter(q => s.score[q] === best);
      s.winner = top.length > 1 ? 99 : top[0];
    }
  }
  settleCities(s, next);
  s.gold[next] += income(s, next);
  for (const u of s.units) if (u.p === next) u.acted = false;
};

/** apply one action of the player whose turn it is; returns false (state unchanged) if it is not allowed */
export const apply = (s: FState, a: Action): boolean => {
  if (s.winner) return false;
  const p = s.turn;
  if (a.p && a.p !== p) return false;
  s.last = []; s.log = '';
  if (a.t === 'end') { endTurn(s); return true; }
  if (s.actions <= 0) return false;
  switch (a.t) {
    case 'dot':
      if (!canDot(s, p, a.i)) return false;
      s.dot[a.i] = p; s.last = [a.i]; break;
    case 'build':
      if (!canBuild(s, p, a.k, a.i)) return false;
      s.gold[p] -= COST[a.k]; s.buildings.push({ id: s.nextId++, k: a.k, p, i: a.i, hp: HP[a.k] }); s.last = [a.i]; break;
    case 'hire':
      if (s.gold[p] < COST[a.k] || !hireSpots(s, p).includes(a.i)) return false;
      s.gold[p] -= COST[a.k]; s.units.push({ id: s.nextId++, k: a.k, p, i: a.i, hp: HP[a.k], acted: true }); s.last = [a.i]; break;
    case 'move': {
      const u = s.units.find(x => x.id === a.u);
      if (!u || u.p !== p || u.acted || !reach(s, u).includes(a.i)) return false;
      u.i = a.i; u.acted = true; s.last = [a.i]; break;
    }
    case 'attack': {
      const u = s.units.find(x => x.id === a.u);
      if (!u || u.p !== p || u.acted || !targets(s, u).includes(a.i)) return false;
      u.acted = true; damage(s, p, a.i, DMG[u.k]); s.last = [a.i]; break;
    }
    default: return false;
  }
  s.actions--;
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
    for (let k = from; k < actions.length; k++) apply(st, actions[k]);
    memo = { key, len: actions.length, lastJson: actions.length ? JSON.stringify(actions[actions.length - 1]) : '', st };
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
  if (s.actions <= 0) return { t: 'end' };
  const tryA = (a: Action) => { const c = clone(s); return apply(c, a) ? c : null; };
  const gain = (c: FState | null) => (c ? c.score[p] - s.score[p] : -1);
  const isEnemy = (q: number) => q && q !== p;

  const free: number[] = [];
  for (let i = 0; i < s.dot.length; i++) if (canDot(s, p, i)) free.push(i);
  const nearDots = free.filter(i => n8(s, i).some(j => s.dot[j]) || s.units.some(u => dist(s, u.i, i) <= 1));

  // 1. a dot that captures right now
  let bestA: Action | null = null, bestV = 0;
  for (const i of nearDots) { const v = gain(tryA({ t: 'dot', i })); if (v > bestV) { bestV = v; bestA = { t: 'dot', i }; } }
  if (bestA) return bestA;

  // 2. units: hit what is in range (units first, then buildings, then wall dots), else drive to the nearest target
  for (const u of s.units.filter(x => x.p === p && !x.acted)) {
    const rank = (i: number) => (unitAt(s, i) ? 3 : buildingAt(s, i) ? 2 : 1);
    const t = targets(s, u).sort((a, b) => rank(b) - rank(a));
    if (t.length) return { t: 'attack', u: u.id, i: t[0] };
    const goals: number[] = [];
    for (const b of s.buildings) if (b.p !== p) goals.push(b.i);
    for (let i = 0; i < s.dot.length; i++) if (isEnemy(s.dot[i]) && n8(s, i).some(j => s.terr[j] === s.dot[i])) goals.push(i);
    if (!goals.length) for (let i = 0; i < s.dot.length; i++) if (isEnemy(s.dot[i])) goals.push(i);
    const r = reach(s, u);
    if (goals.length && r.length) {
      const score = (i: number) => Math.min(...goals.map(g => dist(s, i, g)));
      const to = r.reduce((a, b) => (score(b) < score(a) ? b : a));
      if (score(to) < score(u.i)) return { t: 'move', u: u.id, i: to };
    }
  }

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
  if (spots.length) {
    if ((mine('tower') === 0 || (enemyUnitsNear && mine('tower') < 3) || (s.gold[p] >= 20 && mine('tower') < 4)) && s.gold[p] >= COST.tower) return { t: 'build', k: 'tower', i: pickSpot('edge') };
    if (mine('barracks') === 0 && s.gold[p] >= COST.barracks) return { t: 'build', k: 'barracks', i: pickSpot('middle') };
  }
  const hs = hireSpots(s, p); const myUnits = s.units.filter(u => u.p === p).length;
  if (hs.length && myUnits < 8) {
    const enemyDot = s.dot.findIndex(d => isEnemy(d));
    const forward = enemyDot < 0 ? hs[0] : hs.reduce((a, b) => (dist(s, b, enemyDot) < dist(s, a, enemyDot) ? b : a));
    if (s.gold[p] >= COST.tank) return { t: 'hire', k: 'tank', i: forward };
    if (s.gold[p] >= COST.soldier && myUnits < 2 && mine('market') > 0) return { t: 'hire', k: 'soldier', i: forward };
  }
  if (spots.length && mine('market') < 2 && s.gold[p] >= COST.market) return { t: 'build', k: 'market', i: pickSpot('middle') };

  // 5. build or grow a city: a diamond ring around the home point
  const [cx, cy] = home(s, p);
  for (const r of [2, 3, 4]) {
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
