import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flag, HelpCircle, X, Plus, Minus, Maximize2, Crosshair } from 'lucide-react';
import {
  makeReplayer, canDot, canBuild, reach, targets, hireSpots, income, buildingAt, unitAt, home, players,
  COST, NAMES_UA, WIN_SCORE, MAX_ROUNDS, LAND_PER_POINT, type Action, type BuildKind, type UnitKind, type FState,
} from './fortress';
import { buildFx, useFx, unitPose, aimAt, dropOffset, appearScale, shakeOffset, Tank, Soldier, FxLayer } from './fortressFx';

/**
 * The board of «Точки: Фортеці» drawn like a school notebook: blue squares, a red margin, walls and dots in ballpoint
 * ink, cities hatched with the player's colour. One finger moves the board, two fingers (or the buttons) zoom.
 * The rules live in fortress.ts.
 */
export const PCOLORS = ['', '#dc2626', '#2563eb', '#16a34a', '#ca8a04'];
export const PNAMES = ['', 'Червоні', 'Сині', 'Зелені', 'Жовті'];
const STEP = 20, PAD = 12;
type Tool = 'dot' | BuildKind | UnitKind;
const TOOLS: { k: Tool; label: string; icon: string }[] = [
  { k: 'dot', label: 'Точка', icon: '•' },
  { k: 'tower', label: 'Башта', icon: '🗼' },
  { k: 'barracks', label: 'Казарма', icon: '⛺' },
  { k: 'market', label: 'Ринок', icon: '💰' },
  { k: 'soldier', label: 'Воїн', icon: '🪖' },  // the soldier and tank buttons show the owner's pictures
  { k: 'tank', label: 'Танк', icon: '🛡️' },
];

/** buildings (drawn by the owner): the tower flies the player's flag, the others stand on a base of his colour */
const BPIC: Record<BuildKind, { w: number; h: number; dy: number }> = {
  tower: { w: 16, h: 27.9, dy: 9 }, barracks: { w: 19.5, h: 15.3, dy: 8 }, market: { w: 19.5, h: 14.3, dy: 8 },
};
export const Building: React.FC<{ x: number; y: number; color: string; k: BuildKind; p: number }> = ({ x, y, color, k, p }) => {
  const b = BPIC[k];
  return (
    <>
      <ellipse cx={x} cy={y + 5.5} rx={9.5} ry={3.6} fill={color} opacity={0.35} stroke={color} strokeWidth={1.2} />
      <image href={k === 'tower' ? `/game/tower${p}.webp` : `/game/${k}.webp`} x={x - b.w / 2} y={y + b.dy - b.h} width={b.w} height={b.h} />
    </>
  );
};
const calm = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** the game state, replayed once and then moved forward only by the new actions */
const useFortState = (actions: Action[], n: number, size: [number, number]) => {
  const replayer = useRef(makeReplayer());
  return useMemo(() => replayer.current(actions, n, size), [actions, n, size[0], size[1]]); // eslint-disable-line react-hooks/exhaustive-deps
};

const FortressBoard: React.FC<{
  actions: Action[]; n: number; size: [number, number]; me: number; vsBot: boolean; joined: boolean; busy: boolean;
  onAct: (a: Action) => void;
  footer?: React.ReactNode;
}> = ({ actions, n, size, me, vsBot, joined, busy, onAct, footer }) => {
  const s = useFortState(actions, n, size);
  const { fx, now, add, busyUntil } = useFx();
  // the pictures are loaded at once, so the first explosion is not empty
  useEffect(() => { for (const f of ['wall', 'pillar', 'wallbroken', 'boom', 'smoke', 'shell', 'wreck', 'soldier-dead', 'rubble', 'crater', 'market', 'barracks', ...players(s).flatMap(p => [`tank${p}`, `tower${p}`, `soldier${p}`, `soldier${p}-fire`, ...[0, 1, 2, 3].map(k => `soldier${p}-run${k}`)])]) new Image().src = `/game/${f}.webp`; }, []);
  const [tool, setTool] = useState<Tool>('dot');
  const [sel, setSel] = useState<number | null>(null);
  const [help, setHelp] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const heading = useRef(new Map<number, number>());
  const boxRef = useRef<HTMLDivElement>(null);
  const myTurn = !!me && s.turn === me && !s.winner && joined;
  const unit = sel != null ? s.units.find(u => u.id === sel && u.p === me && !u.acted) : undefined;

  // ---- the turn ends by itself after the last action
  const sentEnd = useRef(-1);
  useEffect(() => {
    if (myTurn && s.actions <= 0 && sentEnd.current !== actions.length) { sentEnd.current = actions.length; onAct({ t: 'end' }); }
  }, [myTurn, s.actions, actions.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSel(null); }, [s.turn]);

  // ---- view: which part of the board is shown (zoom and move)
  const W = (s.w - 1) * STEP + PAD * 2, H = (s.h - 1) * STEP + PAD * 2;
  const pos = (i: number) => ({ x: PAD + (i % s.w) * STEP, y: PAD + Math.floor(i / s.w) * STEP });
  const startView = () => {
    const [hx, hy] = home(s, me || 1); const vw = Math.min(W, 13 * STEP), vh = vw * 1.25;
    return { x: Math.max(0, Math.min(W - vw, PAD + hx * STEP - vw / 2)), y: Math.max(0, Math.min(H - vh, PAD + hy * STEP - vh / 2)), w: vw };
  };
  const [view, setView] = useState(startView);
  const vh = view.w * 1.25;
  const clampView = (v: { x: number; y: number; w: number }) => {
    const w = Math.max(6 * STEP, Math.min(Math.max(W, H / 1.25), v.w)); const h = w * 1.25;
    return { w, x: Math.max(-STEP, Math.min(W - w + STEP, v.x)), y: Math.max(-STEP, Math.min(H - h + STEP, v.y)) };
  };
  const zoom = (k: number, cx?: number, cy?: number) => setView(v => {
    const w = v.w * k; const ax = cx ?? v.x + v.w / 2, ay = cy ?? v.y + (v.w * 1.25) / 2;
    return clampView({ w, x: ax - (ax - v.x) * k, y: ay - (ay - v.y) * k });
  });
  const toBoard = (clientX: number, clientY: number) => {
    const svg = svgRef.current!; const pt = svg.createSVGPoint(); pt.x = clientX; pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM()!.inverse());
  };

  // ---- fingers: one moves the board (or taps a point), two zoom
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; startX: number; startY: number; view: typeof view; dist?: number; mid?: { x: number; y: number } } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const list = [...ptrs.current.values()];
    if (list.length === 1) gesture.current = { moved: false, startX: e.clientX, startY: e.clientY, view };
    if (list.length === 2) {
      const [a, b] = list;
      gesture.current = { moved: true, startX: 0, startY: 0, view, dist: Math.hypot(a.x - b.x, a.y - b.y), mid: toBoard((a.x + b.x) / 2, (a.y + b.y) / 2) };
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId) || !gesture.current) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current; const list = [...ptrs.current.values()];
    const box = boxRef.current!.getBoundingClientRect(); const perPx = g.view.w / box.width;
    if (list.length === 1 && g.dist == null) {
      const dx = e.clientX - g.startX, dy = e.clientY - g.startY;
      if (!g.moved && Math.hypot(dx, dy) > 7) g.moved = true;
      if (g.moved) setView(clampView({ ...g.view, x: g.view.x - dx * perPx, y: g.view.y - dy * perPx }));
    } else if (list.length === 2 && g.dist && g.mid) {
      const [a, b] = list; const d = Math.hypot(a.x - b.x, a.y - b.y);
      const k = g.dist / Math.max(d, 1); const w = g.view.w * k;
      setView(clampView({ w, x: g.mid.x - (g.mid.x - g.view.x) * k, y: g.mid.y - (g.mid.y - g.view.y) * k }));
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const g = gesture.current; const wasSingle = ptrs.current.size === 1;
    ptrs.current.delete(e.pointerId);
    if (wasSingle && g && !g.moved && g.dist == null) tapAt(e.clientX, e.clientY);
    if (!ptrs.current.size) gesture.current = null;
  };
  const onWheel = (e: React.WheelEvent) => { const q = toBoard(e.clientX, e.clientY); zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, q.x, q.y); };

  // ---- animation: what just happened is played out (each new action after the ones still playing)
  const seen = useRef<FState | null>(null);
  useEffect(() => {
    if (seen.current === s) return;
    seen.current = s;
    const ev = s.fresh || [];
    if (!ev.length || calm || ev.length > 80) return;
    add(buildFx(ev, pos, PCOLORS, busyUntil()));
  }, [s]); // eslint-disable-line react-hooks/exhaustive-deps
  const shake = shakeOffset(fx, now);

  const reachSet = useMemo(() => new Set(unit ? reach(s, unit) : []), [s, unit]);
  const targetSet = useMemo(() => new Set(unit ? targets(s, unit) : []), [s, unit]);
  const hireSet = useMemo(() => new Set(myTurn && (tool === 'soldier' || tool === 'tank') ? hireSpots(s, me) : []), [s, tool, me, myTurn]);

  const tapAt = (clientX: number, clientY: number) => {
    if (!myTurn || busy) return;
    const q = toBoard(clientX, clientY);
    const x = Math.round((q.x - PAD) / STEP), y = Math.round((q.y - PAD) / STEP);
    if (x < 0 || y < 0 || x >= s.w || y >= s.h) return;
    const i = y * s.w + x;
    const own = unitAt(s, i);
    if (own && own.p === me && !own.acted) { setSel(own.id === sel ? null : own.id); return; }
    if (unit) {
      if (targetSet.has(i)) { onAct({ t: 'attack', u: unit.id, i }); setSel(null); return; }
      if (reachSet.has(i)) { onAct({ t: 'move', u: unit.id, i }); setSel(null); return; }
      setSel(null); return;
    }
    if (tool === 'dot' && canDot(s, me, i)) onAct({ t: 'dot', i });
    else if ((tool === 'tower' || tool === 'barracks' || tool === 'market') && canBuild(s, me, tool, i)) { onAct({ t: 'build', k: tool, i }); setTool('dot'); }
    else if ((tool === 'soldier' || tool === 'tank') && hireSet.has(i) && s.gold[me] >= COST[tool]) { onAct({ t: 'hire', k: tool, i }); setTool('dot'); }
  };

  // ---- city walls: neighbouring dots of a player around his city, drawn as pen strokes
  const segs: { a: number; b: number; p: number }[] = [];
  const touches = (i: number, p: number) => {
    const x = i % s.w, y = Math.floor(i / s.w);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < s.w && ny < s.h && s.terr[ny * s.w + nx] === p) return true;
    }
    return false;
  };
  for (let i = 0; i < s.dot.length; i++) {
    const p = s.dot[i]; if (!p || !touches(i, p)) continue;
    const x = i % s.w, y = Math.floor(i / s.w);
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || nx >= s.w || ny >= s.h) continue;
      const j = ny * s.w + nx;
      if (s.dot[j] === p && touches(j, p)) segs.push({ a: i, b: j, p });
    }
  }

  const status = s.winner
    ? (s.winner === 99 ? 'Нічия!' : s.winner === me ? 'Ви перемогли! 🎉' : `Перемогли ${PNAMES[s.winner].toLowerCase()}`)
    : !joined ? 'Чекаємо всіх гравців'
    : myTurn ? `Ваш хід · дій: ${s.actions}`
    : vsBot ? `Ходять ${PNAMES[s.turn].toLowerCase()} (бот)…` : `Ходять ${PNAMES[s.turn].toLowerCase()}…`;
  const toolOk = (k: Tool) => k === 'dot' || (k === 'soldier' || k === 'tank'
    ? s.buildings.some(b => b.p === me && b.k === 'barracks') && s.gold[me] >= COST[k]
    : s.gold[me] >= COST[k as BuildKind]);
  const mine = me || 1;

  return (
    <div>
      {/* scores of all players; the one whose turn it is is outlined */}
      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
        {players(s).map(p => (
          <span key={p} className={`px-2 py-0.5 rounded-lg text-sm font-black border ${s.turn === p && !s.winner ? 'border-[#FFC300]' : 'border-transparent'}`} style={{ color: PCOLORS[p] }}>
            ● {s.score[p]}{p === me ? ' (ви)' : ''}
          </span>
        ))}
        <span className="ml-auto text-zinc-500 text-[11px]">Раунд {Math.min(s.round, MAX_ROUNDS)}/{MAX_ROUNDS} · до {WIN_SCORE}</span>
      </div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[#FFC300] font-black text-sm">💰 {s.gold[mine]} <span className="text-zinc-500 font-bold text-xs">(+{income(s, mine)})</span></span>
        <span className={`text-sm font-bold ${myTurn ? 'text-[#FFC300]' : 'text-zinc-400'}`}>{status}</span>
        <button onClick={() => setHelp(true)} aria-label="Правила" className="text-zinc-400"><HelpCircle size={20} /></button>
      </div>
      {s.log && <p className="text-center text-xs text-orange-300 mb-1">{s.log}</p>}

      <div ref={boxRef} className="relative rounded-2xl overflow-hidden shadow-xl bg-[#fdfdf8]" style={{ touchAction: 'none', aspectRatio: '4 / 5' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
        <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.w} ${vh}`} className="w-full h-full block select-none" role="img" aria-label="Поле гри">
          <defs>
            {/* a slight tremble of the hand */}
            <filter id="pen" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves={2} seed={3} result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale={1.6} />
            </filter>
            {players(s).map(p => (
              <pattern key={p} id={`hatch${p}`} width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1={0} y1={0} x2={0} y2={5} stroke={PCOLORS[p]} strokeWidth={1.1} opacity={0.45} />
              </pattern>
            ))}
          </defs>
          <g transform={`translate(${shake.x},${shake.y})`}>
          <rect x={-STEP * 2} y={-STEP * 2} width={W + STEP * 4} height={H + STEP * 4} fill="#fdfdf8" />
          {Array.from({ length: s.w + 4 }, (_, x) => <line key={`v${x}`} x1={PAD + (x - 2) * STEP} y1={-STEP * 2} x2={PAD + (x - 2) * STEP} y2={H + STEP * 2} stroke="#a5c8ec" strokeWidth={0.7} />)}
          {Array.from({ length: s.h + 4 }, (_, y) => <line key={`h${y}`} x1={-STEP * 2} y1={PAD + (y - 2) * STEP} x2={W + STEP * 2} y2={PAD + (y - 2) * STEP} stroke="#a5c8ec" strokeWidth={0.7} />)}
          <line x1={-STEP * 0.6} y1={-STEP * 2} x2={-STEP * 0.6} y2={H + STEP * 2} stroke="#ef4444" strokeWidth={1} opacity={0.7} />
          {/* cities: hatched like in a notebook (darker where the wall is closed) */}
          {Array.from(s.terr).map((p, i) => (p ? <rect key={`a${i}`} x={pos(i).x - STEP / 2} y={pos(i).y - STEP / 2} width={STEP} height={STEP} fill={`url(#hatch${p})`} opacity={s.inside[i] === p ? 1 : 0.45} /> : null))}
          {/* city walls: the owner's colour drawn in ink underneath, the stone wall on top */}
          <g filter="url(#pen)">
            {segs.map(({ a, b, p }) => { const A = pos(a), B = pos(b); return <line key={`c${a}-${b}`} x1={A.x} y1={A.y + 2} x2={B.x} y2={B.y + 2} stroke={PCOLORS[p]} strokeWidth={3.4} strokeLinecap="round" opacity={0.85} />; })}
          </g>
          {[...segs].sort((u, v) => Math.max(pos(u.a).y, pos(u.b).y) - Math.max(pos(v.a).y, pos(v.b).y)).map(({ a, b }) => {
            const A = pos(a), B = pos(b); const len = Math.hypot(B.x - A.x, B.y - A.y) + 2;
            const deg = (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI;
            return (
              <g key={`w${a}-${b}`} transform={`translate(${(A.x + B.x) / 2},${(A.y + B.y) / 2}) rotate(${deg})`}>
                <image href="/game/wall.webp" x={-len / 2} y={-5} width={len} height={len * 0.325} preserveAspectRatio="none" />
              </g>
            );
          })}
          {/* every point is a stone pillar on a base of the player's colour */}
          {Array.from(s.dot).map((p, i) => (p ? (
            <g key={`d${i}`}>
              <ellipse cx={pos(i).x} cy={pos(i).y + 2.2} rx={4.6} ry={2.4} fill={PCOLORS[p]} opacity={0.9} />
              <image href="/game/pillar.webp" x={pos(i).x - 3.4} y={pos(i).y - 8.6} width={6.8} height={11.2} />
            </g>
          ) : null))}
          {[...hireSet].map(i => <circle key={`hs${i}`} cx={pos(i).x} cy={pos(i).y} r={4.5} fill="#22c55e" opacity={0.55} />)}
          {(tool === 'tower' || tool === 'barracks' || tool === 'market') && myTurn && Array.from(s.inside).map((p, i) => (p === me && !s.dot[i] && !buildingAt(s, i) && !unitAt(s, i) ? <circle key={`bs${i}`} cx={pos(i).x} cy={pos(i).y} r={3.5} fill="#22c55e" opacity={0.55} /> : null))}
          {[...reachSet].map(i => <circle key={`r${i}`} cx={pos(i).x} cy={pos(i).y} r={3.5} fill="#eab308" opacity={0.75} />)}
          <FxLayer fx={fx} now={now} ground />
          {s.buildings.map(b => {
            const { x } = pos(b.i); const y = pos(b.i).y + dropOffset(fx, now, b.i);
            return (
              <g key={`b${b.id}`}>
                <Building x={x} y={y} color={PCOLORS[b.p]} k={b.k} p={b.p} />
                {b.hp > 1 && <text x={x + 8} y={y - 5} fontSize={6.5} fontWeight={900} fill={PCOLORS[b.p]}>{b.hp}</text>}
              </g>
            );
          })}
          {s.units.map(u => {
            const pose = unitPose(fx, now, u.id);
            const { x, y } = pose.p || pos(u.i);
            const dir = pose.dir ?? heading.current.get(u.id) ?? (u.p === 1 || u.p === 4 ? -Math.PI / 2 : Math.PI / 2);
            const aim = pose.p ? null : aimAt(fx, now, pos(u.i));
            heading.current.set(u.id, aim ? aim.dir : dir); // after a shot the tank stays turned to the enemy
            const sc = appearScale(fx, now, u.i);
            return (
              <g key={`u${u.id}`} opacity={u.p === me && u.acted && myTurn && !pose.p ? 0.55 : 1}>
                {u.k === 'tank'
                  ? <g transform={sc !== 1 ? `translate(${x},${y}) scale(${Math.max(0, sc)}) translate(${-x},${-y})` : undefined}><Tank x={x} y={y} p={u.p} dir={dir} aim={aim?.dir} kick={aim?.kick} hop={pose.hop} /></g>
                  : <Soldier x={x} y={y - pose.hop} p={u.p} dir={dir} run={pose.run} aim={aim?.dir} scale={Math.max(0, sc)} />}
                {u.hp > 1 && <text x={x + 7} y={y - 5} fontSize={6.5} fontWeight={900} fill="#1e293b">{u.hp}</text>}
              </g>
            );
          })}
          <FxLayer fx={fx} now={now} drawGhost={(what, at, color) => what === 'tank' ? <Tank x={at.x} y={at.y} p={Math.max(1, PCOLORS.indexOf(color))} /> : what === 'soldier' ? <Soldier x={at.x} y={at.y} p={Math.max(1, PCOLORS.indexOf(color))} /> : <Building x={at.x} y={at.y} color={color} k={what} p={Math.max(1, PCOLORS.indexOf(color))} />} />
          {[...targetSet].map(i => <circle key={`t${i}`} cx={pos(i).x} cy={pos(i).y} r={9} fill="none" stroke="#dc2626" strokeWidth={1.8} strokeDasharray="3 2" />)}
          {unit && <circle cx={pos(unit.i).x} cy={pos(unit.i).y} r={10} fill="none" stroke="#eab308" strokeWidth={2.2} />}
          {s.last.map(i => <circle key={`last${i}`} cx={pos(i).x} cy={pos(i).y} r={10.5} fill="none" stroke="#1e293b" strokeWidth={0.9} strokeDasharray="2 2" />)}
          </g>
        </svg>
        <div className="absolute right-2 bottom-2 flex flex-col gap-1.5" onPointerDown={e => e.stopPropagation()}>
          <button onClick={() => zoom(1 / 1.3)} aria-label="Ближче" className="w-9 h-9 rounded-full bg-white/90 shadow text-zinc-700 flex items-center justify-center"><Plus size={18} /></button>
          <button onClick={() => zoom(1.3)} aria-label="Далі" className="w-9 h-9 rounded-full bg-white/90 shadow text-zinc-700 flex items-center justify-center"><Minus size={18} /></button>
          <button onClick={() => setView(clampView({ x: -STEP / 2, y: -STEP / 2, w: Math.max(W, H / 1.25) + STEP }))} aria-label="Усе поле" className="w-9 h-9 rounded-full bg-white/90 shadow text-zinc-700 flex items-center justify-center"><Maximize2 size={16} /></button>
          <button onClick={() => setView(startView())} aria-label="До мого міста" className="w-9 h-9 rounded-full bg-white/90 shadow text-zinc-700 flex items-center justify-center"><Crosshair size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1 mt-2">
        {TOOLS.map(t => (
          <button key={t.k} onClick={() => { setTool(t.k); setSel(null); }} disabled={!myTurn || !toolOk(t.k)}
            className={`rounded-xl py-1.5 flex flex-col items-center border text-[10px] font-bold leading-tight disabled:opacity-35 ${tool === t.k ? 'bg-[#FFC300] text-black border-[#FFC300]' : 'bg-zinc-900 text-zinc-200 border-zinc-700'}`}>
            {t.k === 'tank' || t.k === 'soldier'
              ? <img src={t.k === 'tank' ? `/game/tank${mine}.webp` : `/game/soldier${mine}.webp`} alt="" className={`h-4 w-auto my-0.5 ${t.k === 'tank' ? 'rotate-90' : ''}`} />
              : <span className="text-base leading-none">{t.icon}</span>}{t.label}
            {t.k !== 'dot' && <span className="opacity-70">{COST[t.k as keyof typeof COST]}💰</span>}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-zinc-500 text-center mt-1">
        {unit ? `${NAMES_UA[unit.k]}: жовті точки — куди їхати, червоні кола — по кому бити`
          : tool === 'soldier' || tool === 'tank' ? 'Зелені точки — де з’явиться біля казарми'
          : tool === 'dot' ? 'Торкніться перехрестя — точка. Торкніться свого бійця — хід ним. Поле рухається пальцем, два пальці — масштаб.'
          : 'Зелені точки — де можна будувати (всередині вашого міста)'}
      </p>
      <div className="flex justify-center gap-2 mt-2 flex-wrap">
        {myTurn && <button onClick={() => onAct({ t: 'end' })} className="h-10 px-3 rounded-xl bg-zinc-800 text-white font-bold text-sm flex items-center gap-1 whitespace-nowrap"><Flag size={16} /> Кінець ходу</button>}
        {footer}
      </div>

      {help && (
        <div className="fixed inset-0 z-[300] bg-black/80 flex items-end sm:items-center justify-center p-3" onClick={() => setHelp(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 max-w-md w-full max-h-[85vh] overflow-y-auto text-sm text-zinc-300 space-y-2" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center"><b className="text-white text-base">Правила «Фортеці»</b><button onClick={() => setHelp(false)} aria-label="Закрити"><X size={20} /></button></div>
            <p>• Грають 2–4 гравці по черзі. За хід — <b>2 дії</b>: точка, будівля, найм, хід або постріл бійця.</p>
            <p>• Замкнене коло з ваших точок — <b>місто</b> (заштриховане вашим кольором). Всередині можна будувати, місто щоходу дає <b>золото</b>.</p>
            <p>• 🗼 <b>Башта</b> (5) стріляє наприкінці вашого ходу. ⛺ <b>Казарма</b> (4) — біля неї наймаються 🪖 <b>воїни</b> (3) і 🛡️ <b>танки</b> (7: міцні, стріляють на 2 клітинки, удар ×2). 💰 <b>Ринок</b> (6) — +2 золота.</p>
            <p>• Бійці проходять крізь свою стіну, а чужу — пробивають.</p>
            <p>• <b>Пробите місто</b> на початку вашого ходу обороняється: якщо башти й ваші бійці поруч не слабші за ворога — стіна відновлюється; якщо ворог сильніший — місто <b>стискається</b>: крайній ряд стає новою стіною, будівлі там гинуть.</p>
            <p>• Обведіть кільцем чужі точки, будівлі, бійців чи місто — усе всередині ваше.</p>
            <p>• Поле рухається пальцем, два пальці — збільшити / зменшити. Кнопки праворуч: ближче, далі, усе поле, до мого міста.</p>
            <p>• <b>Земля дає очки</b>: щоходу +1 очко за кожні {LAND_PER_POINT} клітинок ваших замкнених міст. Чим більше місто — тим швидше ростуть очки.</p>
            <p>• Перемога — <b>{WIN_SCORE} очок</b> або найбільше очок після {MAX_ROUNDS} раундів. Якщо очок порівну — перемагає той, у кого більше землі.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FortressBoard;
