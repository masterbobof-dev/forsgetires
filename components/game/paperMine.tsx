import React from 'react';

/**
 * Gold deposits and mines drawn as if dug right into the notebook sheet: a crack in the paper with gold showing
 * through, and a mine — a torn hole in the paper with a dark pit, a wooden headframe whose wheel turns while it works,
 * a bucket going up and down and a heap of ore.
 */

/** a deposit nobody digs yet: the paper is cracked, gold nuggets show through */
export const OreDeposit: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x},${y}) scale(1.35)`} pointerEvents="none">
    <path d="M-8,-2 L-5,-5 L-1,-4 L2,-6 L6,-3 L8,1 L5,4 L1,3 L-3,6 L-7,3 Z" fill="#e7e2cf" stroke="#8b7d5a" strokeWidth={0.6} />
    <path d="M-6,0 L-2,-1 L1,1 L4,-1 M-1,-1 L0,-4 M1,1 L2,4" fill="none" stroke="#5b4a2a" strokeWidth={0.5} strokeLinecap="round" />
    {[[-4, -2, 1.5], [2.5, -2.5, 1.2], [3.5, 1.5, 1.7], [-2, 2.5, 1.3], [0, -0.5, 1]].map(([cx, cy, r], k) => (
      <g key={k}>
        <circle cx={cx} cy={cy} r={r} fill="#fbbf24" stroke="#92400e" strokeWidth={0.4} />
        <circle cx={cx - r * 0.35} cy={cy - r * 0.35} r={r * 0.35} fill="#fef3c7" />
      </g>
    ))}
    {/* a glint that comes and goes */}
    <path d="M3.5,-5 l0.6,1.6 l1.6,0.6 l-1.6,0.6 l-0.6,1.6 l-0.6,-1.6 l-1.6,-0.6 l1.6,-0.6 z" fill="#fff">
      <animate attributeName="opacity" values="0;1;0" dur="2.4s" repeatCount="indefinite" />
    </path>
  </g>
);

/** the torn hole in the paper with the pit (shared by the mine and its icon) */
const Pit: React.FC = () => (
  <>
    {/* torn edge of the sheet, a little lifted (a shadow under it) */}
    <path d="M-10,1 L-8,-3 L-9,-5 L-5,-6 L-3,-8 L0,-6 L3,-8 L6,-6 L9,-6 L8,-2 L10,1 L8,4 L9,6 L5,6 L2,8 L-1,6 L-4,8 L-7,6 L-9,5 Z"
      fill="#f5f1e4" stroke="#a8a29e" strokeWidth={0.6} />
    <path d="M-7,1 L-6,-2 L-3,-4 L1,-4 L5,-4 L7,-1 L6,3 L2,5 L-2,5 L-6,4 Z" fill="#3f2d1a" />
    <path d="M-5,1 L-4,-1 L0,-2 L4,-2 L5,1 L2,3 L-2,3 Z" fill="#1c140b" />
  </>
);

/** a mine; working = the wheel turns and the bucket goes up and down */
export const MineSite: React.FC<{ x: number; y: number; color: string; working: boolean; scale?: number }> = ({ x, y, color, working, scale = 1.45 }) => (
  <g transform={`translate(${x},${y + 2}) scale(${scale})`}>
    <ellipse cx={0} cy={6} rx={11} ry={3} fill={color} opacity={0.3} />
    <Pit />
    {/* heap of ore beside the pit */}
    <path d="M6,6 Q9,1 12,6 Z" fill="#78716c" />
    {[[8, 5], [10, 5.2], [9, 3.6]].map(([cx, cy], k) => <circle key={k} cx={cx} cy={cy} r={0.9} fill="#fbbf24" stroke="#92400e" strokeWidth={0.3} />)}
    {/* wooden headframe */}
    <g stroke="#7c4a1e" strokeWidth={1.3} strokeLinecap="round">
      <line x1={-6} y1={2} x2={-1.5} y2={-13} />
      <line x1={6} y1={2} x2={1.5} y2={-13} />
      <line x1={-4.6} y1={-3} x2={4.6} y2={-3} />
      <line x1={-3.3} y1={-8} x2={3.3} y2={-8} />
    </g>
    {/* the wheel on top */}
    <g transform="translate(0,-13)">
      <circle r={3.6} fill="none" stroke="#57534e" strokeWidth={1} />
      <g stroke="#57534e" strokeWidth={0.7}>
        <line x1={-3.4} y1={0} x2={3.4} y2={0} /><line x1={0} y1={-3.4} x2={0} y2={3.4} />
        {working && <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="2s" repeatCount="indefinite" />}
      </g>
      <circle r={0.9} fill={color} />
    </g>
    {/* the rope and the bucket */}
    <g>
      <line x1={3.4} y1={-13} x2={3.4} y2={-4} stroke="#44403c" strokeWidth={0.4} />
      <rect x={2.2} y={-4} width={2.4} height={2.2} fill="#a16207" stroke="#44403c" strokeWidth={0.3} />
      {working && <animateTransform attributeName="transform" type="translate" values="0,0;0,-5;0,0" dur="2s" repeatCount="indefinite" />}
    </g>
    {/* a small flag of the owner */}
    <line x1={-1.5} y1={-13} x2={-1.5} y2={-18} stroke="#44403c" strokeWidth={0.5} />
    <path d="M-1.5,-18 l4,1.2 l-4,1.2 z" fill={color} />
  </g>
);

/** wooden scaffolding over a building that is not finished; the number of turns left */
export const Scaffold: React.FC<{ x: number; y: number; w: number; h: number; left: number }> = ({ x, y, w, h, left }) => (
  <g pointerEvents="none">
    <g stroke="#92400e" strokeWidth={0.8} opacity={0.9}>
      <line x1={x - w / 2} y1={y + 6} x2={x - w / 2} y2={y + 6 - h} />
      <line x1={x + w / 2} y1={y + 6} x2={x + w / 2} y2={y + 6 - h} />
      <line x1={x - w / 2} y1={y + 6 - h / 2} x2={x + w / 2} y2={y + 6 - h / 2} />
      <line x1={x - w / 2} y1={y + 6 - h} x2={x + w / 2} y2={y + 6 - h} />
      <line x1={x - w / 2} y1={y + 6} x2={x + w / 2} y2={y + 6 - h / 2} />
      <line x1={x + w / 2} y1={y + 6 - h / 2} x2={x - w / 2} y2={y + 6 - h} />
    </g>
    <g transform={`translate(${x + w / 2 - 1},${y + 6 - h - 1})`}>
      <circle r={4.2} fill="#fef3c7" stroke="#92400e" strokeWidth={0.6} />
      <text y={1.8} textAnchor="middle" fontSize={5} fontWeight={900} fill="#92400e">{left}</text>
    </g>
  </g>
);

/** the mine for the bar below the board */
export const MineIcon: React.FC = () => (
  <svg viewBox="-13 -21 26 30" width={34} height={34} aria-hidden="true">
    <MineSite x={0} y={0} color="#ca8a04" working scale={1} />
  </svg>
);
