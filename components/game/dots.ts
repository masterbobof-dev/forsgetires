/**
 * «Точки» rules: players put dots in turn; a closed chain of your dots (they may touch diagonally) around the other
 * player's dots captures them — one point each — and the inside becomes your area, nobody can put a dot there.
 * An empty ring captures nothing until the other player puts a dot inside it.
 * The whole position is replayed from the list of moves, so both screens always count the same.
 */
export type Move = [number, number, number]; // x, y, player (1 or 2)

export interface DotsState {
  w: number; h: number;
  dot: Int8Array;   // whose dot stands on the point (0 = none)
  dead: Uint8Array; // the dot was captured
  area: Int8Array;  // whose captured area the point is in (0 = none)
  score: [number, number, number];
}

const emptyState = (w: number, h: number): DotsState => ({
  w, h, dot: new Int8Array(w * h), dead: new Uint8Array(w * h), area: new Int8Array(w * h), score: [0, 0, 0],
});
const cloneState = (s: DotsState): DotsState => ({
  w: s.w, h: s.h, dot: s.dot.slice(), dead: s.dead.slice(), area: s.area.slice(), score: [s.score[0], s.score[1], s.score[2]],
});

/** player p closes his rings: live dots of the other player inside are captured, the inside becomes p's area */
const capture = (s: DotsState, p: number) => {
  const { w, h, dot, dead, area, score } = s;
  const n = w * h, opp = 3 - p;
  const wall = (i: number) => dot[i] === p && !dead[i];
  // everything the outside can reach (moving up / down / left / right between the walls) is free
  const free = new Uint8Array(n);
  const stack: number[] = [];
  const push = (i: number) => { if (!free[i] && !wall(i)) { free[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop()!; const x = i % w, y = (i - x) / w;
    if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
  }
  // closed pockets: captured if there is at least one live dot of the other player inside
  const done = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (free[i] || wall(i) || done[i]) continue;
    const pocket: number[] = [i]; done[i] = 1;
    const queue = [i];
    while (queue.length) {
      const c = queue.pop()!; const x = c % w, y = (c - x) / w;
      for (const j of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, y > 0 ? c - w : -1, y < h - 1 ? c + w : -1]) {
        if (j >= 0 && !done[j] && !free[j] && !wall(j)) { done[j] = 1; pocket.push(j); queue.push(j); }
      }
    }
    if (!pocket.some(c => dot[c] === opp && !dead[c])) continue;
    for (const c of pocket) {
      area[c] = p;
      if (dot[c] === opp && !dead[c]) { dead[c] = 1; score[p]++; }
    }
  }
};

/** one move on the board (changes s) */
const play = (s: DotsState, x: number, y: number, p: number) => {
  const i = y * s.w + x;
  if (x < 0 || y < 0 || x >= s.w || y >= s.h || s.dot[i]) return;
  s.dot[i] = p;
  // a dot put into the other player's area is lost at once
  if (s.area[i] && s.area[i] !== p) { s.dead[i] = 1; s.score[s.area[i]]++; return; }
  capture(s, p);
  capture(s, 3 - p);
};

export const computeDots = (w: number, h: number, moves: Move[]): DotsState => {
  const s = emptyState(w, h);
  for (const [x, y, p] of moves) play(s, x, y, p);
  return s;
};

/** may the player put a dot here now (free point, not inside a captured area) */
export const canPut = (s: DotsState, x: number, y: number) => {
  const i = y * s.w + x;
  return x >= 0 && y >= 0 && x < s.w && y < s.h && !s.dot[i] && !s.area[i];
};

/**
 * The computer's move: the point that wins the most — capture now, save its own dots from being surrounded,
 * then close in on the other player's dots and keep its own dots together. A little chance makes games different.
 */
export const botMove = (w: number, h: number, moves: Move[], me: number): [number, number] | null => {
  const now = computeDots(w, h, moves);
  const opp = 3 - me;
  const near = (i: number, who: number, r = 1) => {
    const x = i % w, y = (i - x) / w; let n = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) { const j = ny * w + nx; if (now.dot[j] === who && !now.dead[j]) n++; }
    }
    return n;
  };
  // points worth thinking about: free points next to any dot (or the middle at the start)
  const cand: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (now.dot[i] || now.area[i]) continue;
    if (near(i, me, 2) + near(i, opp, 2) > 0) cand.push(i);
  }
  if (!cand.length) {
    const mid = Math.floor(h / 2) * w + Math.floor(w / 2);
    const free = [mid, mid + 1, mid - 1, mid + w].find(i => !now.dot[i] && !now.area[i]);
    return free !== undefined ? [free % w, Math.floor(free / w)] : null;
  }
  let best = -1e9, bestI = cand[0];
  for (const i of cand) {
    const x = i % w, y = (i - x) / w;
    const mine = cloneState(now); play(mine, x, y, me);
    let v = (mine.score[me] - now.score[me]) * 1000;            // capture now
    if (mine.dead[i]) v -= 800;                                 // the point is inside the other's ring
    const theirs = cloneState(now); play(theirs, x, y, opp);
    v += (theirs.score[opp] - now.score[opp]) * 700;            // the other player would capture here: take it first
    v += near(i, opp, 1) * 14 + near(i, me, 1) * 9 + near(i, opp, 2) * 3;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) v -= 12; // the edge never closes a ring
    v += Math.random() * 6;
    if (v > best) { best = v; bestI = i; }
  }
  return [bestI % w, Math.floor(bestI / w)];
};
