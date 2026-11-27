/**
 * «Точки: Фортеці» — a turn-based strategy on the paper grid.
 *
 * - Two actions per turn. A closed ring of your dots is a FORTRESS; its inside is yours to build on.
 * - Income at the start of your turn: 1 + 1 per 4 inner points of your fortresses + 2 per market inside a fortress.
 * - Buildings (only inside your fortress): tower 5 (shoots at the end of your turn), barracks 4 (hires units), market 6.
 * - Units (next to your barracks): soldier 3 (1 hp, walks 2, hits 1 next to it), tank 7 (3 hp, drives 3, shoots 2 points away for 2).
 *   A unit moves OR attacks once per turn; it passes over its own wall dots (gates) but not between enemy dots.
 * - Attacking a dot of a wall breaks it: the fortress opens, gives no income and its towers stop shooting.
 * - Ring capture as in the old game: a ring around enemy dots, buildings or units takes them all
 *   (dot +1, building becomes yours +5, unit destroyed +2/+4).
 * - Destroying a unit gives +2 (soldier) / +4 (tank), a building +3. 30 points or the most points after 40 rounds wins.
 *
 * The game is a list of actions; both screens replay it the same way.
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
  w: number; h: number;
  dot: Int8Array;     // whose dot (0 none)
  inside: Int8Array;  // whose closed fortress the point is in (0 none)
  gold: [number, number, number];
  score: [number, number, number];
  buildings: Building[];
  units: Unit[];
  turn: number; actions: number; round: number; winner: number;
  nextId: number;
  last: number[];     // points touched by the last action (highlight)
  log: string;        // what happened last (for the screen)
}

export const COST = { tower: 5, barracks: 4, market: 6, soldier: 3, tank: 7 } as const;
export const HP = { tower: 3, barracks: 2, market: 2, soldier: 1, tank: 3 } as const;
export const MOVE = { soldier: 2, tank: 3 } as const;
export const RANGE = { soldier: 1, tank: 2 } as const;
export const DMG = { soldier: 1, tank: 2 } as const;
export const NAMES_UA = { tower: 'башта', barracks: 'казарма', market: 'ринок', soldier: 'воїн', tank: 'танк' } as const;
export const WIN_SCORE = 30, MAX_ROUNDS = 40, ACTIONS = 2;
const TOWER_RANGE = 3;

export const newFortress = (w = 15, h = 19): FState => ({
  w, h, dot: new Int8Array(w * h), inside: new Int8Array(w * h),
  gold: [0, 3, 3], score: [0, 0, 0], buildings: [], units: [],
  turn: 1, actions: ACTIONS, round: 1, winner: 0, nextId: 1, last: [], log: '',
});

export const clone = (s: FState): FState => ({
  ...s, dot: s.dot.slice(), inside: s.inside.slice(), gold: [...s.gold] as any, score: [...s.score] as any,
  buildings: s.buildings.map(b => ({ ...b })), units: s.units.map(u => ({ ...u })), last: [...s.last],
});

const xy = (s: FState, i: number) => [i % s.w, Math.floor(i / s.w)];
export const dist = (s: FState, a: number, b: number) => { const [ax, ay] = xy(s, a), [bx, by] = xy(s, b); return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); };
export const buildingAt = (s: FState, i: number) => s.buildings.find(b => b.i === i);
export const unitAt = (s: FState, i: number) => s.units.find(u => u.i === i);
/** nothing stands on the point */
export const empty = (s: FState, i: number) => !s.dot[i] && !buildingAt(s, i) && !unitAt(s, i);
const n4 = (s: FState, i: number) => {
  const [x, y] = xy(s, i); const out: number[] = [];
  if (x > 0) out.push(i - 1); if (x < s.w - 1) out.push(i + 1); if (y > 0) out.push(i - s.w); if (y < s.h - 1) out.push(i + s.w);
  return out;
};
const n8 = (s: FState, i: number) => {
  const [x, y] = xy(s, i); const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < s.w && ny < s.h) out.push(ny * s.w + nx);
  }
  return out;
};

/** rings of player p: pockets the outside can't reach between p's dots (moving up / down / left / right) */
const pockets = (s: FState, p: number): number[][] => {
  const n = s.w * s.h, wall = (i: number) => s.dot[i] === p;
  const free = new Uint8Array(n); const stack: number[] = [];
  const push = (i: number) => { if (!free[i] && !wall(i)) { free[i] = 1; stack.push(i); } };
  for (let x = 0; x < s.w; x++) { push(x); push((s.h - 1) * s.w + x); }
  for (let y = 0; y < s.h; y++) { push(y * s.w); push(y * s.w + s.w - 1); }
  while (stack.length) for (const j of n4(s, stack.pop()!)) push(j);
  const done = new Uint8Array(n); const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (free[i] || wall(i) || done[i]) continue;
    const pocket = [i]; done[i] = 1; const q = [i];
    while (q.length) for (const j of n4(s, q.pop()!)) if (!done[j] && !free[j] && !wall(j)) { done[j] = 1; pocket.push(j); q.push(j); }
    out.push(pocket);
  }
  return out;
};

/** recount the fortresses: rings take what the other player has inside them */
const enclose = (s: FState, first: number) => {
  for (const p of [first, 3 - first]) {
    const opp = 3 - p;
    for (const pocket of pockets(s, p)) {
      for (const c of pocket) {
        if (s.dot[c] === opp) { s.dot[c] = 0; s.score[p] += 1; }
        const b = buildingAt(s, c);
        if (b && b.p === opp) { b.p = p; s.score[p] += 5; s.log = `Захоплено: ${NAMES_UA[b.k]}`; }
        const u = unitAt(s, c);
        if (u && u.p === opp) { s.units = s.units.filter(x => x !== u); s.score[p] += u.k === 'tank' ? 4 : 2; }
      }
    }
  }
  s.inside.fill(0);
  for (const p of [1, 2]) for (const pocket of pockets(s, p)) for (const c of pocket) s.inside[c] = p;
};

const damage = (s: FState, attacker: number, i: number, dmg: number): boolean => {
  const opp = 3 - attacker;
  const u = unitAt(s, i);
  if (u && u.p === opp) {
    u.hp -= dmg;
    if (u.hp <= 0) { s.units = s.units.filter(x => x !== u); s.score[attacker] += u.k === 'tank' ? 4 : 2; s.log = `Знищено: ${NAMES_UA[u.k]}`; }
    return true;
  }
  const b = buildingAt(s, i);
  if (b && b.p === opp) {
    b.hp -= dmg;
    if (b.hp <= 0) { s.buildings = s.buildings.filter(x => x !== b); s.score[attacker] += 3; s.log = `Зруйновано: ${NAMES_UA[b.k]}`; }
    return true;
  }
  if (s.dot[i] === opp) { s.dot[i] = 0; s.log = 'Стіну пробито'; return true; }
  return false;
};

/** points a unit can drive to this turn (up / down / left / right over free points) */
export const reach = (s: FState, u: Unit): number[] => {
  const steps = MOVE[u.k]; const seen = new Map<number, number>([[u.i, 0]]); const q = [u.i]; const out: number[] = [];
  while (q.length) {
    const c = q.shift()!; const d = seen.get(c)!;
    if (d === steps) continue;
    // own wall dots are gates: a unit passes over them but can't stop on them
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
  const out: number[] = []; const opp = 3 - u.p;
  for (let i = 0; i < s.w * s.h; i++) {
    if (dist(s, u.i, i) > RANGE[u.k] || i === u.i) continue;
    if (s.dot[i] === opp || buildingAt(s, i)?.p === opp || unitAt(s, i)?.p === opp) out.push(i);
  }
  return out;
};
/** free points next to the player's barracks */
export const hireSpots = (s: FState, p: number): number[] => {
  const out = new Set<number>();
  for (const b of s.buildings) if (b.p === p && b.k === 'barracks') for (const j of n8(s, b.i)) if (empty(s, j)) out.add(j);
  return [...out];
};
export const canDot = (s: FState, p: number, i: number) => empty(s, i) && s.inside[i] !== 3 - p;
export const canBuild = (s: FState, p: number, k: BuildKind, i: number) => empty(s, i) && s.inside[i] === p && s.gold[p] >= COST[k];

export const income = (s: FState, p: number) => {
  let inner = 0; for (let i = 0; i < s.inside.length; i++) if (s.inside[i] === p) inner++;
  const markets = s.buildings.filter(b => b.p === p && b.k === 'market' && s.inside[b.i] === p).length;
  return 1 + Math.floor(inner / 4) + markets * 2;
};

const checkWin = (s: FState) => {
  if (s.score[1] >= WIN_SCORE || s.score[2] >= WIN_SCORE) s.winner = s.score[1] >= s.score[2] ? 1 : 2;
};

const endTurn = (s: FState) => {
  const p = s.turn, opp = 3 - p;
  // towers of a closed fortress shoot: the nearest enemy unit, else a dot of an enemy wall nearby
  for (const t of s.buildings.filter(b => b.p === p && b.k === 'tower' && s.inside[b.i] === p)) {
    let best = -1, bd = 99;
    for (const u of s.units) if (u.p === opp) { const d = dist(s, t.i, u.i); if (d <= TOWER_RANGE && d < bd) { bd = d; best = u.i; } }
    if (best < 0) for (let i = 0; i < s.dot.length; i++) if (s.dot[i] === opp) { const d = dist(s, t.i, i); if (d <= 2 && d < bd) { bd = d; best = i; } }
    if (best >= 0) { damage(s, p, best, 1); s.last.push(best); }
  }
  enclose(s, p);
  checkWin(s);
  s.turn = opp; s.actions = ACTIONS;
  if (opp === 1) { s.round++; if (s.round > MAX_ROUNDS && !s.winner) s.winner = s.score[1] === s.score[2] ? 3 : s.score[1] > s.score[2] ? 1 : 2; }
  s.gold[opp] += income(s, opp);
  for (const u of s.units) if (u.p === opp) u.acted = false;
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

export const replay = (actions: Action[], w = 15, h = 19): FState => {
  const s = newFortress(w, h);
  for (const a of actions) apply(s, a);
  return s;
};

// ------------------------------------------------------------------ the computer player
/** the best next action for the player whose turn it is (one action at a time) */
export const botAction = (s: FState): Action => {
  const p = s.turn, opp = 3 - p;
  if (s.actions <= 0) return { t: 'end' };
  const tryA = (a: Action) => { const c = clone(s); return apply(c, a) ? c : null; };
  const gain = (c: FState | null) => (c ? c.score[p] - s.score[p] : -1);

  // 1. a dot that captures right now
  let bestA: Action | null = null, bestV = 0;
  const free: number[] = [];
  for (let i = 0; i < s.dot.length; i++) if (canDot(s, p, i)) free.push(i);
  const nearDots = free.filter(i => n8(s, i).some(j => s.dot[j]) || s.units.some(u => dist(s, u.i, i) <= 1));
  for (const i of nearDots) { const v = gain(tryA({ t: 'dot', i })); if (v > bestV) { bestV = v; bestA = { t: 'dot', i }; } }
  if (bestA) return bestA;

  // 2. units: hit what is in range (units first, then buildings, then wall dots), else drive to the nearest target
  for (const u of s.units.filter(x => x.p === p && !x.acted)) {
    const t = targets(s, u).sort((a, b) => (unitAt(s, b) ? 3 : buildingAt(s, b) ? 2 : 1) - (unitAt(s, a) ? 3 : buildingAt(s, a) ? 2 : 1));
    if (t.length) return { t: 'attack', u: u.id, i: t[0] };
    const goals: number[] = [];
    for (const b of s.buildings) if (b.p === opp) goals.push(b.i);
    for (let i = 0; i < s.dot.length; i++) if (s.dot[i] === opp && n8(s, i).some(j => s.inside[j] === opp)) goals.push(i);
    if (!goals.length) for (let i = 0; i < s.dot.length; i++) if (s.dot[i] === opp) goals.push(i);
    const r = reach(s, u);
    if (goals.length && r.length) {
      const score = (i: number) => Math.min(...goals.map(g => dist(s, i, g)));
      const to = r.reduce((a, b) => (score(b) < score(a) ? b : a));
      if (score(to) < score(u.i)) return { t: 'move', u: u.id, i: to };
    }
  }

  // 3. danger: the other player could capture with his next dot — put ours there first
  let threatI = -1, threatV = 0;
  for (const i of nearDots) {
    const c = clone(s); c.turn = opp; c.actions = 1;
    if (apply(c, { t: 'dot', i })) { const v = c.score[opp] - s.score[opp]; if (v > threatV) { threatV = v; threatI = i; } }
  }
  if (threatI >= 0) return { t: 'dot', i: threatI };

  // 4. economy: tower, barracks, a tank, a market, soldiers
  const mine = (k: BuildKind) => s.buildings.filter(b => b.p === p && b.k === k).length;
  const spots = free.filter(i => s.inside[i] === p);
  const enemyUnitsNear = s.units.some(u => u.p === opp && spots.some(i => dist(s, i, u.i) <= 4));
  // towers stand by the wall (they shoot further out), the rest in the middle
  const pickSpot = (pref: 'edge' | 'middle') => {
    const walls = (i: number) => n8(s, i).filter(j => s.dot[j] === p).length;
    return spots.reduce((a, b) => (pref === 'edge' ? walls(b) > walls(a) : walls(b) < walls(a)) ? b : a);
  };
  if (spots.length) {
    if ((mine('tower') === 0 || (enemyUnitsNear && mine('tower') < 3) || (s.gold[p] >= 20 && mine('tower') < 4)) && s.gold[p] >= COST.tower) return { t: 'build', k: 'tower', i: pickSpot('edge') };
    if (mine('barracks') === 0 && s.gold[p] >= COST.barracks) return { t: 'build', k: 'barracks', i: pickSpot('middle') };
  }
  const hs = hireSpots(s, p); const myUnits = s.units.filter(u => u.p === p).length;
  if (hs.length && myUnits < 8) {
    const enemyDot = s.dot.findIndex(d => d === opp);
    const forward = enemyDot < 0 ? hs[0] : hs.reduce((a, b) => (dist(s, b, enemyDot) < dist(s, a, enemyDot) ? b : a));
    if (s.gold[p] >= COST.tank) return { t: 'hire', k: 'tank', i: forward };
    if (s.gold[p] >= COST.soldier && myUnits < 2 && mine('market') > 0) return { t: 'hire', k: 'soldier', i: forward };
  }
  if (spots.length && mine('market') < 2 && s.gold[p] >= COST.market) return { t: 'build', k: 'market', i: pickSpot('middle') };

  // 5. build or grow a fortress: a diamond ring around a centre on our side of the board
  const cx = Math.floor(s.w / 2), cy = p === 2 ? Math.floor(s.h / 4) : Math.floor((3 * s.h) / 4);
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
      // the point next to the most of our dots closes the ring fastest
      return { t: 'dot', i: ok.reduce((a, b) => (n8(s, b).filter(j => s.dot[j] === p).length > n8(s, a).filter(j => s.dot[j] === p).length ? b : a)) };
    }
  }

  // 6. otherwise: a dot close to the other player's dots (to start surrounding them) or the end of the turn
  if (nearDots.length) {
    const v = (i: number) => n8(s, i).filter(j => s.dot[j] === opp).length * 3 + n8(s, i).filter(j => s.dot[j] === p).length * 2 + Math.random();
    return { t: 'dot', i: nearDots.reduce((a, b) => (v(b) > v(a) ? b : a)) };
  }
  if (free.length) return { t: 'dot', i: free[Math.floor(Math.random() * free.length)] };
  return { t: 'end' };
};
