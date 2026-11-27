import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flag, HelpCircle, X } from 'lucide-react';
import {
  replay, canDot, canBuild, reach, targets, hireSpots, income, buildingAt, unitAt,
  COST, NAMES_UA, WIN_SCORE, MAX_ROUNDS, type Action, type BuildKind, type UnitKind, type FState,
} from './fortress';

/** The board of «Точки: Фортеці»: what you see and what you press. The rules live in fortress.ts. */
const COLORS = ['', '#ef4444', '#3b82f6'];
const STEP = 22, PAD = 13;
type Tool = 'dot' | BuildKind | UnitKind;

const TOOLS: { k: Tool; label: string; icon: string }[] = [
  { k: 'dot', label: 'Точка', icon: '•' },
  { k: 'tower', label: 'Башта', icon: '🗼' },
  { k: 'barracks', label: 'Казарма', icon: '⛺' },
  { k: 'market', label: 'Ринок', icon: '💰' },
  { k: 'soldier', label: 'Воїн', icon: '🪖' },
  { k: 'tank', label: 'Танк', icon: '🛡️' },
];

const Tank: React.FC<{ x: number; y: number; color: string }> = ({ x, y, color }) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={-8} y={-5} width={16} height={10} rx={2} fill={color} stroke="#111" strokeWidth={1} />
    <rect x={-9} y={4} width={18} height={3} rx={1.5} fill="#27272a" />
    <circle cx={0} cy={-1} r={3.5} fill={color} stroke="#111" strokeWidth={1} />
    <line x1={2} y1={-2} x2={10} y2={-5} stroke="#111" strokeWidth={2} strokeLinecap="round" />
  </g>
);

const FortressBoard: React.FC<{
  actions: Action[]; me: number; vsBot: boolean; joined: boolean; busy: boolean;
  onAct: (a: Action) => void;
  /** «Нова гра» and the invite buttons from the game screen */
  footer?: React.ReactNode;
}> = ({ actions, me, vsBot, joined, busy, onAct, footer }) => {
  const s: FState = useMemo(() => replay(actions), [actions]);
  const [tool, setTool] = useState<Tool>('dot');
  const [sel, setSel] = useState<number | null>(null); // selected unit id
  const [help, setHelp] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const myTurn = !!me && s.turn === me && !s.winner && joined;
  const unit = sel != null ? s.units.find(u => u.id === sel && u.p === me && !u.acted) : undefined;

  // the turn ends by itself after the last action
  const sentEnd = useRef(-1);
  useEffect(() => {
    if (myTurn && s.actions <= 0 && sentEnd.current !== actions.length) { sentEnd.current = actions.length; onAct({ t: 'end' }); }
  }, [myTurn, s.actions, actions.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSel(null); }, [s.turn]);

  const reachSet = useMemo(() => new Set(unit ? reach(s, unit) : []), [s, unit]);
  const targetSet = useMemo(() => new Set(unit ? targets(s, unit) : []), [s, unit]);
  const hireSet = useMemo(() => new Set(tool === 'soldier' || tool === 'tank' ? hireSpots(s, me) : []), [s, tool, me]);

  const tap = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!myTurn || busy) return;
    const svg = svgRef.current!; const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(svg.getScreenCTM()!.inverse());
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

  const W = (s.w - 1) * STEP + PAD * 2, H = (s.h - 1) * STEP + PAD * 2;
  const pos = (i: number) => ({ x: PAD + (i % s.w) * STEP, y: PAD + Math.floor(i / s.w) * STEP });
  // walls: neighbouring dots of a player around his fortress
  const lines: React.ReactNode[] = [];
  const touches = (i: number, p: number) => {
    const x = i % s.w, y = Math.floor(i / s.w);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < s.w && ny < s.h && s.inside[ny * s.w + nx] === p) return true;
    }
    return false;
  };
  for (let i = 0; i < s.dot.length; i++) {
    const p = s.dot[i]; if (!p || !touches(i, p)) continue;
    const x = i % s.w, y = Math.floor(i / s.w);
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || nx >= s.w || ny >= s.h) continue;
      const j = ny * s.w + nx;
      if (s.dot[j] === p && touches(j, p)) { const a = pos(i), b = pos(j); lines.push(<line key={`l${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={COLORS[p]} strokeWidth={3} strokeLinecap="round" />); }
    }
  }

  const opp = me ? 3 - me : 2;
  const status = s.winner
    ? (s.winner === 3 ? 'Нічия!' : s.winner === me ? 'Ви перемогли! 🎉' : vsBot ? 'Переміг бот. Ще раз?' : 'Переміг суперник')
    : !joined ? 'Чекаємо другого гравця'
    : myTurn ? `Ваш хід · дій: ${s.actions}`
    : vsBot ? 'Бот думає…' : 'Хід суперника…';
  const toolOk = (k: Tool) => k === 'dot' || (k === 'soldier' || k === 'tank'
    ? s.buildings.some(b => b.p === me && b.k === 'barracks') && s.gold[me] >= COST[k]
    : s.gold[me] >= COST[k as BuildKind]);

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="font-black" style={{ color: COLORS[me || 1] }}>● {s.score[me || 1]}</span>
        <span className="text-zinc-400 text-xs">Раунд {Math.min(s.round, MAX_ROUNDS)}/{MAX_ROUNDS} · до {WIN_SCORE} очок</span>
        <span className="font-black" style={{ color: COLORS[opp] }}>{s.score[opp]} ●</span>
      </div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[#FFC300] font-black text-sm">💰 {s.gold[me || 1]} <span className="text-zinc-500 font-bold text-xs">(+{income(s, me || 1)} за хід)</span></span>
        <span className={`text-sm font-bold ${myTurn ? 'text-[#FFC300]' : 'text-zinc-400'}`}>{status}</span>
        <button onClick={() => setHelp(true)} aria-label="Правила" className="text-zinc-400"><HelpCircle size={20} /></button>
      </div>
      {s.log && <p className="text-center text-xs text-orange-300 mb-1">{s.log}</p>}

      <div className="bg-white rounded-2xl overflow-hidden shadow-xl touch-manipulation">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block select-none" onClick={tap} role="img" aria-label="Поле гри">
          {Array.from({ length: s.w }, (_, x) => <line key={`v${x}`} x1={PAD + x * STEP} y1={0} x2={PAD + x * STEP} y2={H} stroke="#bfdbfe" strokeWidth={1} />)}
          {Array.from({ length: s.h }, (_, y) => <line key={`h${y}`} x1={0} y1={PAD + y * STEP} x2={W} y2={PAD + y * STEP} stroke="#bfdbfe" strokeWidth={1} />)}
          {Array.from(s.inside).map((p, i) => (p ? <rect key={`a${i}`} x={pos(i).x - STEP / 2} y={pos(i).y - STEP / 2} width={STEP} height={STEP} fill={COLORS[p]} opacity={0.16} /> : null))}
          {lines}
          {[...hireSet].map(i => <circle key={`hs${i}`} cx={pos(i).x} cy={pos(i).y} r={5} fill="#22c55e" opacity={0.5} />)}
          {(tool === 'tower' || tool === 'barracks' || tool === 'market') && myTurn && Array.from(s.inside).map((p, i) => (p === me && !s.dot[i] && !buildingAt(s, i) && !unitAt(s, i) ? <circle key={`bs${i}`} cx={pos(i).x} cy={pos(i).y} r={4} fill="#22c55e" opacity={0.5} /> : null))}
          {[...reachSet].map(i => <circle key={`r${i}`} cx={pos(i).x} cy={pos(i).y} r={4} fill="#eab308" opacity={0.7} />)}
          {Array.from(s.dot).map((p, i) => (p ? <circle key={`d${i}`} cx={pos(i).x} cy={pos(i).y} r={5} fill={COLORS[p]} /> : null))}
          {s.buildings.map(b => {
            const { x, y } = pos(b.i);
            return (
              <g key={`b${b.id}`}>
                <rect x={x - 9} y={y - 9} width={18} height={18} rx={4} fill="#fff" stroke={COLORS[b.p]} strokeWidth={2} />
                <text x={x} y={y + 5} textAnchor="middle" fontSize={13}>{b.k === 'tower' ? '🗼' : b.k === 'barracks' ? '⛺' : '💰'}</text>
                {b.hp > 1 && <text x={x + 9} y={y - 6} fontSize={7} fontWeight={900} fill={COLORS[b.p]}>{b.hp}</text>}
              </g>
            );
          })}
          {s.units.map(u => {
            const { x, y } = pos(u.i);
            return (
              <g key={`u${u.id}`} opacity={u.p === me && u.acted && myTurn ? 0.55 : 1}>
                {u.k === 'tank' ? <Tank x={x} y={y} color={COLORS[u.p]} /> : (
                  <>
                    <circle cx={x} cy={y} r={8} fill={COLORS[u.p]} stroke="#111" strokeWidth={1} />
                    <text x={x} y={y + 4} textAnchor="middle" fontSize={10}>🪖</text>
                  </>
                )}
                {u.hp > 1 && <text x={x + 8} y={y - 6} fontSize={7} fontWeight={900} fill="#111">{u.hp}</text>}
              </g>
            );
          })}
          {[...targetSet].map(i => <circle key={`t${i}`} cx={pos(i).x} cy={pos(i).y} r={10} fill="none" stroke="#dc2626" strokeWidth={2} strokeDasharray="3 2" />)}
          {unit && <circle cx={pos(unit.i).x} cy={pos(unit.i).y} r={11} fill="none" stroke="#eab308" strokeWidth={2.5} />}
          {s.last.map(i => <circle key={`last${i}`} cx={pos(i).x} cy={pos(i).y} r={12} fill="none" stroke="#111" strokeWidth={1} strokeDasharray="2 2" />)}
        </svg>
      </div>

      {/* tools */}
      <div className="grid grid-cols-6 gap-1 mt-2">
        {TOOLS.map(t => (
          <button key={t.k} onClick={() => { setTool(t.k); setSel(null); }} disabled={!myTurn || !toolOk(t.k)}
            className={`rounded-xl py-1.5 flex flex-col items-center border text-[10px] font-bold leading-tight disabled:opacity-35 ${tool === t.k ? 'bg-[#FFC300] text-black border-[#FFC300]' : 'bg-zinc-900 text-zinc-200 border-zinc-700'}`}>
            <span className="text-base leading-none">{t.icon}</span>{t.label}
            {t.k !== 'dot' && <span className="opacity-70">{COST[t.k as keyof typeof COST]}💰</span>}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-zinc-500 text-center mt-1">
        {unit ? `${NAMES_UA[unit.k]}: жовті точки — куди їхати, червоні кола — по кому бити` : tool === 'soldier' || tool === 'tank' ? 'Зелені точки — де з’явиться біля казарми' : tool === 'dot' ? 'Натисніть на перехрестя, щоб поставити точку. Натисніть на свого бійця, щоб ним походити.' : 'Зелені точки — де можна будувати (всередині вашої фортеці)'}
      </p>
      <div className="flex justify-center gap-2 mt-2 flex-wrap">
        {myTurn && <button onClick={() => onAct({ t: 'end' })} className="h-10 px-3 rounded-xl bg-zinc-800 text-white font-bold text-sm flex items-center gap-1 whitespace-nowrap"><Flag size={16} /> Кінець ходу</button>}
        {footer}
      </div>

      {help && (
        <div className="fixed inset-0 z-[300] bg-black/80 flex items-end sm:items-center justify-center p-3" onClick={() => setHelp(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 max-w-md w-full max-h-[85vh] overflow-y-auto text-sm text-zinc-300 space-y-2" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center"><b className="text-white text-base">Правила «Фортеці»</b><button onClick={() => setHelp(false)} aria-label="Закрити"><X size={20} /></button></div>
            <p>• За хід — <b>2 дії</b>: точка, будівля, найм, хід або постріл бійця.</p>
            <p>• Замкнене коло з ваших точок — <b>фортеця</b>. Всередині можна будувати. Фортеця щоходу дає <b>золото</b> (більша — більше).</p>
            <p>• 🗼 <b>Башта</b> (5): наприкінці вашого ходу стріляє по найближчому ворогу на 3 клітинки або збиває точку чужої стіни поруч.</p>
            <p>• ⛺ <b>Казарма</b> (4): біля неї наймаються 🪖 <b>воїни</b> (3: ходять на 2, б'ють поруч) і 🛡️ <b>танки</b> (7: міцні, їдуть на 3, стріляють на 2 клітинки, удар ×2).</p>
            <p>• 💰 <b>Ринок</b> (6): +2 золота щоходу.</p>
            <p>• Бійці виходять крізь свою стіну, а чужу — пробивають. Пробита фортеця не дає золота, її башти мовчать.</p>
            <p>• Обведіть кільцем чужі точки, будівлі чи бійців — усе всередині ваше: точка +1, будівля +5, боєць +2/+4. Знищений боєць +2/+4, будівля +3.</p>
            <p>• Перемога — <b>{WIN_SCORE} очок</b> або більше очок після {MAX_ROUNDS} раундів.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FortressBoard;
