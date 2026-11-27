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

export const computeDots = (w: number, h: number, moves: Move[]): DotsState => {
  const n = w * h;
  const dot = new Int8Array(n), dead = new Uint8Array(n), area = new Int8Array(n);
  const score: [number, number, number] = [0, 0, 0];

  const capture = (p: number) => {
    const opp = 3 - p;
    const wall = (i: number) => dot[i] === p && !dead[i];
    // everything the outside can reach (moving up / down / left / right between the walls) is free
    const free = new Uint8Array(n);
    const stack: number[] = [];
    const push = (i: number) => { if (!free[i] && !wall(i)) { free[i] = 1; stack.push(i); } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    const spread = (list: number[], seen: Uint8Array, ok: (i: number) => boolean) => {
      while (list.length) {
        const i = list.pop()!; const x = i % w, y = (i - x) / w;
        const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
        for (const j of nb) if (j >= 0 && !seen[j] && ok(j)) { seen[j] = 1; list.push(j); }
      }
    };
    spread(stack, free, (j) => !wall(j));
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

  for (const [x, y, p] of moves) {
    const i = y * w + x;
    if (x < 0 || y < 0 || x >= w || y >= h || dot[i]) continue;
    dot[i] = p;
    // a dot put into the other player's area is lost at once
    if (area[i] && area[i] !== p) { dead[i] = 1; score[area[i]]++; continue; }
    capture(p);
    capture(3 - p);
  }
  return { w, h, dot, dead, area, score };
};

/** may the player put a dot here now (free point, not inside a captured area) */
export const canPut = (s: DotsState, x: number, y: number) => {
  const i = y * s.w + x;
  return x >= 0 && y >= 0 && x < s.w && y < s.h && !s.dot[i] && !s.area[i];
};
