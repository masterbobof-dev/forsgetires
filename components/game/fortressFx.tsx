import React, { useEffect, useRef, useState } from 'react';
import type { FxEvent, UnitKind, BuildKind } from './fortress';

/**
 * Animation of «Фортеці»: tanks drive and turn, soldiers run, shells fly in an arc, explosions throw debris that
 * falls back under gravity, the paper shakes on big hits, captured land flashes, points float up.
 * The rules (fortress.ts) only say what happened (FxEvent); here it is turned into timed effects and drawn.
 */
type P = { x: number; y: number };
interface Particle { floor?: number; x: number; y: number; vx: number; vy: number; g: number; r: number; color: string; spin: number; kind: 'chunk' | 'spark' | 'smoke' | 'ink' }
export type Fx =
  | { k: 'move'; t0: number; t1: number; u: number; pts: P[]; unit: UnitKind }
  | { k: 'shot'; t0: number; t1: number; from: P; to: P; by: UnitKind | 'tower'; color: string; shooter?: number }
  | { k: 'burst'; t0: number; t1: number; at: P; parts: Particle[]; flash: number; ring: string | null }
  | { k: 'ghost'; t0: number; t1: number; at: P; what: UnitKind | BuildKind; color: string }
  | { k: 'drop'; t0: number; t1: number; i: number }
  | { k: 'appear'; t0: number; t1: number; i: number }
  | { k: 'cells'; t0: number; t1: number; cells: P[]; color: string; strong: boolean }
  | { k: 'text'; t0: number; t1: number; at: P; text: string; color: string }
  | { k: 'shake'; t0: number; t1: number; power: number };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const G = 0.0006; // gravity, board units per ms²

const debris = (at: P, n: number, colors: string[], speed: number, smoke: number): Particle[] => {
  const out: Particle[] = [];
  for (let k = 0; k < n; k++) {
    const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), v = rnd(speed * 0.35, speed);
    out.push({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: G, r: rnd(1, 2.6), color: colors[k % colors.length], spin: rnd(-0.02, 0.02), kind: 'chunk', floor: at.y + rnd(2, 11) });
  }
  for (let k = 0; k < n; k++) {
    const a = rnd(0, Math.PI * 2), v = rnd(speed * 0.5, speed * 1.4);
    out.push({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: G * 0.3, r: rnd(0.5, 1.1), color: k % 2 ? '#fde047' : '#fb923c', spin: 0, kind: 'spark' });
  }
  for (let k = 0; k < smoke; k++) {
    out.push({ x: at.x + rnd(-3, 3), y: at.y + rnd(-3, 3), vx: rnd(-0.008, 0.008), vy: rnd(-0.03, -0.012), g: 0, r: rnd(2.5, 4.5), color: k % 2 ? '#52525b' : '#a1a1aa', spin: 0, kind: 'smoke' });
  }
  return out;
};
const inkSplash = (at: P, color: string): Particle[] => Array.from({ length: 6 }, () => {
  const a = rnd(0, Math.PI * 2), v = rnd(0.02, 0.05);
  return { x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, r: rnd(0.6, 1.2), color, spin: 0, kind: 'ink' as const };
});

/** the events of one or more actions → effects that play one after another */
export const buildFx = (events: FxEvent[], pos: (i: number) => P, colors: string[], start: number): Fx[] => {
  const out: Fx[] = [];
  let t = start;
  let hitAt = start; // when the last shell lands (the hit, the explosion and the points come then)
  for (const e of events) {
    switch (e.k) {
      case 'dot': {
        const at = pos(e.i);
        out.push({ k: 'burst', t0: t, t1: t + 450, at, parts: inkSplash(at, colors[e.p]), flash: 0, ring: colors[e.p] });
        break;
      }
      case 'build':
        out.push({ k: 'drop', t0: t, t1: t + 520, i: e.i });
        out.push({ k: 'burst', t0: t + 380, t1: t + 1100, at: pos(e.i), parts: debris({ ...pos(e.i), y: pos(e.i).y + 7 }, 0, [], 0.05, 5).map(p => ({ ...p, vy: rnd(-0.012, -0.004), vx: rnd(-0.04, 0.04), color: '#d6d3d1' })), flash: 0, ring: null });
        out.push({ k: 'shake', t0: t + 400, t1: t + 600, power: 1.2 });
        t += 300;
        break;
      case 'hire': {
        out.push({ k: 'appear', t0: t, t1: t + 450, i: e.i });
        out.push({ k: 'burst', t0: t, t1: t + 600, at: pos(e.i), parts: inkSplash(pos(e.i), '#a8a29e'), flash: 0, ring: colors[e.p] });
        t += 250;
        break;
      }
      case 'move': {
        const pts = e.path.map(pos);
        const dur = Math.max(1, pts.length - 1) * (e.unit === 'tank' ? 190 : 140);
        out.push({ k: 'move', t0: t, t1: t + dur, u: e.u, pts, unit: e.unit });
        t += dur;
        break;
      }
      case 'shot': {
        const from = pos(e.from), to = pos(e.to);
        const dist = Math.hypot(to.x - from.x, to.y - from.y);
        const dur = e.by === 'tank' ? 260 + dist * 6 : e.by === 'tower' ? 220 + dist * 5 : 140 + dist * 4;
        out.push({ k: 'shot', t0: t + 120, t1: t + 120 + dur, from, to, by: e.by, color: colors[e.p] });
        hitAt = t + 120 + dur;
        t = hitAt + 80;
        break;
      }
      case 'hit': {
        const at = pos(e.i);
        out.push({ k: 'burst', t0: hitAt, t1: hitAt + 700, at, parts: debris(at, 5, ['#78716c', '#a8a29e'], 0.07, 2), flash: 7, ring: null });
        out.push({ k: 'shake', t0: hitAt, t1: hitAt + 180, power: 1 });
        break;
      }
      case 'boom': {
        const at = pos(e.i), c = colors[e.p] || '#57534e';
        if (e.what) out.push({ k: 'ghost', t0: Math.min(t, hitAt) - 5000, t1: hitAt, at, what: e.what, color: c });
        out.push({ k: 'burst', t0: hitAt, t1: hitAt + 1500, at, parts: debris(at, e.big ? 16 : 9, [c, '#44403c', '#78716c'], e.big ? 0.16 : 0.11, e.big ? 7 : 4), flash: e.big ? 16 : 10, ring: '#f97316' });
        out.push({ k: 'shake', t0: hitAt, t1: hitAt + (e.big ? 450 : 250), power: e.big ? 3.2 : 1.6 });
        break;
      }
      case 'wall': {
        const at = pos(e.i);
        out.push({ k: 'burst', t0: hitAt, t1: hitAt + 900, at, parts: debris(at, 8, [colors[e.p], '#1e293b'], 0.1, 2), flash: 8, ring: null });
        out.push({ k: 'shake', t0: hitAt, t1: hitAt + 220, power: 1.3 });
        break;
      }
      case 'capture':
        out.push({ k: 'cells', t0: Math.max(t, hitAt), t1: Math.max(t, hitAt) + 900, cells: e.cells.map(pos), color: colors[e.p], strong: true });
        break;
      case 'shrink':
        out.push({ k: 'cells', t0: t, t1: t + 900, cells: e.cells.map(pos), color: '#7f1d1d', strong: true });
        out.push({ k: 'shake', t0: t, t1: t + 350, power: 2 });
        t += 300;
        break;
      case 'repair':
        e.cells.forEach((c, k) => {
          const at = pos(c);
          out.push({ k: 'burst', t0: t + k * 70, t1: t + k * 70 + 450, at, parts: inkSplash(at, colors[e.p]), flash: 0, ring: colors[e.p] });
        });
        t += e.cells.length * 70;
        break;
      case 'score':
        out.push({ k: 'text', t0: Math.max(t, hitAt), t1: Math.max(t, hitAt) + 1200, at: pos(e.i), text: `+${e.pts}`, color: colors[e.p] });
        break;
    }
  }
  return out;
};

/** keeps the effects and a clock that ticks every frame while something is playing */
export const useFx = () => {
  const list = useRef<Fx[]>([]);
  const [now, setNow] = useState(() => performance.now());
  const raf = useRef(0);
  const tick = () => {
    const t = performance.now();
    list.current = list.current.filter(f => f.t1 > t);
    setNow(t);
    raf.current = list.current.length ? requestAnimationFrame(tick) : 0;
  };
  const add = (fx: Fx[]) => {
    if (!fx.length) return;
    list.current = [...list.current, ...fx];
    if (!raf.current) raf.current = requestAnimationFrame(tick);
  };
  /** when the effects already queued are over (the next ones wait for them) */
  const busyUntil = () => list.current.reduce((m, f) => (f.k === 'ghost' ? m : Math.max(m, f.t1 - (f.k === 'burst' || f.k === 'text' || f.k === 'cells' ? 600 : 0))), performance.now());
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return { fx: list.current, now, add, busyUntil };
};

const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const along = (pts: P[], k: number): { p: P; dir: number } => {
  if (pts.length < 2) return { p: pts[0], dir: 0 };
  const seg = Math.min(pts.length - 2, Math.floor(k * (pts.length - 1)));
  const f = k * (pts.length - 1) - seg;
  const a = pts[seg], b = pts[seg + 1];
  return { p: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }, dir: Math.atan2(b.y - a.y, b.x - a.x) };
};

/** where a unit is drawn right now (it may still be driving), its heading, and how much it bounces */
export const unitPose = (fx: Fx[], now: number, id: number): { p?: P; dir?: number; hop: number } => {
  const mv = fx.filter((f): f is Extract<Fx, { k: 'move' }> => f.k === 'move' && f.u === id);
  if (!mv.length) return { hop: 0 };
  const cur = mv.find(f => now >= f.t0 && now < f.t1) || mv.find(f => now < f.t0);
  if (!cur) return { hop: 0 };
  if (now < cur.t0) return { p: cur.pts[0], dir: along(cur.pts, 0).dir, hop: 0 };
  const k = ease((now - cur.t0) / (cur.t1 - cur.t0));
  const { p, dir } = along(cur.pts, k);
  const steps = cur.pts.length - 1;
  const hop = cur.unit === 'soldier' ? Math.abs(Math.sin(k * steps * Math.PI * 2)) * 3 : Math.sin(k * steps * Math.PI * 6) * 0.4;
  return { p, dir, hop };
};

/** a shot that a unit at this point fires now or soon (to turn the turret and kick the barrel back) */
export const aimAt = (fx: Fx[], now: number, at: P): { dir: number; kick: number } | null => {
  for (const f of fx) {
    if (f.k !== 'shot' || Math.abs(f.from.x - at.x) > 0.5 || Math.abs(f.from.y - at.y) > 0.5) continue;
    if (now > f.t1 + 300 || now < f.t0 - 250) continue;
    const dir = Math.atan2(f.to.y - f.from.y, f.to.x - f.from.x);
    const since = now - f.t0;
    return { dir, kick: since >= 0 && since < 180 ? 1 - since / 180 : 0 };
  }
  return null;
};

/** extra offset for a building that is falling into place, and the scale of a unit that is appearing */
export const dropOffset = (fx: Fx[], now: number, i: number): number => {
  const f = fx.find(e => e.k === 'drop' && e.i === i) as Extract<Fx, { k: 'drop' }> | undefined;
  if (!f) return 0;
  if (now < f.t0) return -400;
  const k = ease((now - f.t0) / (f.t1 - f.t0));
  // falls, then bounces twice
  if (k < 0.6) { const q = k / 0.6; return -40 * (1 - q * q); }
  const b = (k - 0.6) / 0.4;
  return -Math.abs(Math.sin(b * Math.PI * 2)) * 5 * (1 - b);
};
export const appearScale = (fx: Fx[], now: number, i: number): number => {
  const f = fx.find(e => e.k === 'appear' && e.i === i) as Extract<Fx, { k: 'appear' }> | undefined;
  if (!f) return 1;
  if (now < f.t0) return 0;
  const k = ease((now - f.t0) / (f.t1 - f.t0));
  return 1 + Math.sin(k * Math.PI * 2.5) * (1 - k) * 0.5 - (1 - k) * (1 - k) * 0.9;
};

/** the paper trembling after a big hit */
export const shakeOffset = (fx: Fx[], now: number): P => {
  let x = 0, y = 0;
  for (const f of fx) {
    if (f.k !== 'shake' || now < f.t0 || now > f.t1) continue;
    const left = 1 - (now - f.t0) / (f.t1 - f.t0);
    x += Math.sin(now * 0.09) * f.power * left;
    y += Math.cos(now * 0.13) * f.power * left;
  }
  return { x, y };
};

/** the tank: body turned to where it drives, turret to where it shoots */
export const Tank: React.FC<{ x: number; y: number; color: string; dir?: number; aim?: number; kick?: number; hop?: number }> = ({ x, y, color, dir = 0, aim, kick = 0, hop = 0 }) => {
  const body = (dir * 180) / Math.PI, turret = (((aim ?? dir) - dir) * 180) / Math.PI;
  return (
    <g transform={`translate(${x},${y + hop}) rotate(${body})`}>
      <rect x={-8} y={-7.5} width={16} height={3.2} rx={1.5} fill="#334155" />
      <rect x={-8} y={4.3} width={16} height={3.2} rx={1.5} fill="#334155" />
      <rect x={-7} y={-5} width={14} height={10} rx={2} fill={color} stroke="#1e293b" strokeWidth={1} />
      <g transform={`rotate(${turret})`}>
        <line x1={2} y1={0} x2={10 - kick * 3} y2={0} stroke="#1e293b" strokeWidth={2} strokeLinecap="round" />
        <circle cx={0} cy={0} r={3.3} fill={color} stroke="#1e293b" strokeWidth={1} />
        {kick > 0.5 && <circle cx={12} cy={0} r={2.5 + kick * 2} fill="#fde047" opacity={kick} />}
      </g>
    </g>
  );
};

/** everything that flies: shells, debris, smoke, flashes, rings, points */
export const FxLayer: React.FC<{ fx: Fx[]; now: number; drawGhost: (what: UnitKind | BuildKind, at: P, color: string) => React.ReactNode }> = ({ fx, now, drawGhost }) => {
  const out: React.ReactNode[] = [];
  fx.forEach((f, n) => {
    if (now < f.t0 || now > f.t1) return;
    const dt = now - f.t0, k = dt / (f.t1 - f.t0);
    switch (f.k) {
      case 'ghost': out.push(<g key={n}>{drawGhost(f.what, f.at, f.color)}</g>); break;
      case 'shot': {
        const x = f.from.x + (f.to.x - f.from.x) * k;
        const lift = f.by === 'tank' ? 22 : f.by === 'tower' ? 14 : 3; // a shell flies in an arc
        const y = f.from.y + (f.to.y - f.from.y) * k - Math.sin(k * Math.PI) * lift;
        const k0 = Math.max(0, k - 0.12);
        const x0 = f.from.x + (f.to.x - f.from.x) * k0, y0 = f.from.y + (f.to.y - f.from.y) * k0 - Math.sin(k0 * Math.PI) * lift;
        out.push(
          <g key={n}>
            <line x1={x0} y1={y0} x2={x} y2={y} stroke={f.by === 'soldier' ? '#facc15' : '#a8a29e'} strokeWidth={f.by === 'soldier' ? 1 : 1.6} strokeLinecap="round" opacity={0.7} />
            <circle cx={x} cy={y} r={f.by === 'tank' ? 2.4 : f.by === 'tower' ? 2 : 1.2} fill={f.by === 'soldier' ? '#facc15' : '#1c1917'} />
            {dt < 90 && <circle cx={f.from.x} cy={f.from.y - (f.by === 'tower' ? 8 : 0)} r={4 * (1 - dt / 90) + 1} fill="#fde047" opacity={0.9} />}
          </g>,
        );
        break;
      }
      case 'burst': {
        if (f.flash && dt < 160) out.push(<circle key={`${n}f`} cx={f.at.x} cy={f.at.y} r={f.flash * (0.5 + dt / 320)} fill="#fde68a" opacity={1 - dt / 160} />);
        if (f.flash && dt < 260) out.push(<circle key={`${n}o`} cx={f.at.x} cy={f.at.y} r={f.flash * 0.6 * (0.4 + dt / 260)} fill="#f97316" opacity={0.8 * (1 - dt / 260)} />);
        if (f.ring) out.push(<circle key={`${n}r`} cx={f.at.x} cy={f.at.y} r={3 + k * 12} fill="none" stroke={f.ring} strokeWidth={1.4 * (1 - k)} opacity={1 - k} />);
        f.parts.forEach((p, j) => {
          let x = p.x + p.vx * dt, y = p.y + p.vy * dt + 0.5 * p.g * dt * dt;
          if (p.floor != null && y > p.floor && dt > -p.vy / p.g) {
            // the piece has fallen on the paper: it stays where it landed
            const land = (-p.vy + Math.sqrt(p.vy * p.vy + 2 * p.g * (p.floor - p.y))) / p.g;
            x = p.x + p.vx * land; y = p.floor;
          }
          if (p.kind === 'smoke') out.push(<circle key={`${n}-${j}`} cx={x} cy={y} r={p.r * (1 + k * 1.8)} fill={p.color} opacity={0.45 * (1 - k)} />);
          else if (p.kind === 'spark') { if (k < 0.45) out.push(<circle key={`${n}-${j}`} cx={x} cy={y} r={p.r} fill={p.color} opacity={1 - k / 0.45} />); }
          else if (p.kind === 'ink') out.push(<circle key={`${n}-${j}`} cx={x} cy={y} r={p.r * (1 - k)} fill={p.color} />);
          else out.push(<rect key={`${n}-${j}`} x={x - p.r} y={y - p.r} width={p.r * 2} height={p.r * 1.4} fill={p.color} opacity={Math.min(1, 2.2 * (1 - k))} transform={`rotate(${p.spin * dt * 57},${x},${y})`} />);
        });
        break;
      }
      case 'cells': {
        const o = (f.strong ? 0.55 : 0.3) * Math.sin(Math.min(1, k * 3) * Math.PI / 2) * (1 - k);
        out.push(<g key={n} opacity={o}>{f.cells.map((c, j) => <rect key={j} x={c.x - 10} y={c.y - 10} width={20} height={20} fill={f.color} />)}</g>);
        break;
      }
      case 'text': {
        const y = f.at.y - 8 - k * 22, s = k < 0.15 ? 0.6 + k * 2.7 : 1;
        out.push(<text key={n} x={f.at.x} y={y} textAnchor="middle" fontSize={11 * s} fontWeight={900} fill={f.color} stroke="#fff" strokeWidth={2.5} paintOrder="stroke" opacity={k > 0.7 ? (1 - k) / 0.3 : 1}>{f.text}</text>);
        break;
      }
    }
  });
  return <g pointerEvents="none">{out}</g>;
};
