import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Copy, Share2, Loader2, Flag, Plus } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { computeDots, canPut, type Move } from './dots';
import { inTelegram, telegramApp } from './telegram';

/**
 * «Точки» for two players by a link (/igra?g=<id>): one starts a game and sends the link, the other opens it.
 * Moves are kept on the server; both screens ask for news every 1.5 s.
 */
type Game = { id: string; w: number; h: number; moves: Move[]; joined: boolean; finished: boolean };
type Seat = { token?: string; player: number };

const COLORS = ['', '#ef4444', '#3b82f6'];
const NAMES = ['', 'Червоні', 'Сині'];
const STEP = 24, PAD = 14;
const seatKey = (id: string) => `dots_${id}`;
const readSeat = (id: string): Seat | null => { try { return JSON.parse(localStorage.getItem(seatKey(id)) || 'null'); } catch { return null; } };
const saveSeat = (id: string, s: Seat) => { try { localStorage.setItem(seatKey(id), JSON.stringify(s)); } catch { /* private mode */ } };

const DotsGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [id, setId] = useState(() => new URLSearchParams(window.location.search).get('g') || '');
  const [game, setGame] = useState<Game | null>(null);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const tg = inTelegram();
  useEffect(() => { document.title = 'Точки — гра для двох'; if (tg) telegramApp(); }, [tg]);

  const load = useCallback(async (gid: string) => {
    const { data, error } = await supabase.rpc('dots_get', { p_id: gid });
    if (error || !data) { setErr('Гру не знайдено'); return; }
    setGame(data as Game);
  }, []);

  // open a game by the link: take the second place if it is free, else watch
  useEffect(() => {
    if (!id) return;
    (async () => {
      let s = readSeat(id);
      if (!s) {
        const { data, error } = await supabase.rpc('dots_join', { p_id: id });
        if (error) { setErr(error.message.includes('не знайдено') ? 'Гру не знайдено' : 'Не вдалося підключитися'); return; }
        s = { token: data.token, player: data.player };
        if (s.player) saveSeat(id, s);
      }
      setSeat(s);
      load(id);
    })();
  }, [id, load]);

  // news from the other player
  useEffect(() => {
    if (!id) return;
    const t = setInterval(() => { if (!document.hidden) load(id); }, 1500);
    return () => clearInterval(t);
  }, [id, load]);

  const newGame = async () => {
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('dots_new', { p_w: 15, p_h: 20 });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    saveSeat(data.id, { token: data.token, player: 1 });
    window.history.pushState({}, '', `/igra?g=${data.id}`);
    setGame(null); setSeat(null); setId(data.id);
  };

  const state = useMemo(() => (game ? computeDots(game.w, game.h, game.moves) : null), [game]);
  const turn = game ? (game.moves.length % 2 === 0 ? 1 : 2) : 0;
  const myTurn = !!seat?.player && seat.player === turn && !!game?.joined && !game?.finished;
  // a friend invited from Telegram also gets the game without the shop around it
  const link = id ? `${window.location.origin}/igra?g=${id}${tg ? '&tg=1' : ''}` : '';

  const put = async (e: React.MouseEvent<SVGSVGElement>) => {
    if (!game || !state || !seat?.token || !myTurn || busy) return;
    const svg = svgRef.current!; const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const x = Math.round((p.x - PAD) / STEP), y = Math.round((p.y - PAD) / STEP);
    if (!canPut(state, x, y)) return;
    setBusy(true); setErr('');
    // shown at once, confirmed by the server
    setGame({ ...game, moves: [...game.moves, [x, y, seat.player]] });
    const { data, error } = await supabase.rpc('dots_move', { p_id: game.id, p_token: seat.token, p_x: x, p_y: y });
    setBusy(false);
    if (error) { setErr(error.message); load(game.id); return; }
    setGame(data as Game);
  };

  const finish = async () => {
    if (!game || !seat?.token || !confirm('Завершити гру і порахувати очки?')) return;
    const { data } = await supabase.rpc('dots_finish', { p_id: game.id, p_token: seat.token });
    if (data) setGame(data as Game);
  };

  const share = async () => {
    if (tg) {
      // Telegram's own «send to a chat» list
      const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Зіграймо в «Точки»! Натисни посилання 👇')}`;
      const app = await telegramApp();
      if (app?.openTelegramLink) app.openTelegramLink(url); else window.open(url, '_blank');
      return;
    }
    try {
      if (navigator.share) { await navigator.share({ title: 'Гра «Точки»', text: 'Зіграймо в «Точки»!', url: link }); return; }
    } catch { /* closed */ }
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* no clipboard */ }
  };

  // --- the start screen ---
  if (!id) {
    return (
      <div data-app-ready className="max-w-md mx-auto px-4 py-10 text-center">
        <h1 className="text-3xl font-black text-white mb-3">Точки</h1>
        <p className="text-zinc-400 mb-8">Гра для двох, як на листочку в клітинку. Ставте точки по черзі й обводьте точки суперника — кожна оточена точка дає очко.</p>
        <button onClick={newGame} disabled={busy} className="inline-flex items-center gap-2 bg-[#FFC300] text-black font-black px-6 py-4 rounded-2xl disabled:opacity-50">
          {busy ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />} Нова гра
        </button>
        {err && <p className="text-red-400 text-sm mt-4">{err}</p>}
        {!tg && <button onClick={onBack} className="block mx-auto mt-10 text-zinc-500 text-sm"><ArrowLeft size={14} className="inline" /> На сайт</button>}
      </div>
    );
  }

  if (!game || !state) {
    return <div data-app-ready className="py-20 text-center text-zinc-400">{err || <Loader2 className="animate-spin mx-auto text-[#FFC300]" size={36} />}</div>;
  }

  const W = (game.w - 1) * STEP + PAD * 2, H = (game.h - 1) * STEP + PAD * 2;
  const pos = (i: number) => ({ x: PAD + (i % game.w) * STEP, y: PAD + Math.floor(i / game.w) * STEP });
  // lines of a closed ring: neighbouring live dots of a player that both touch his captured area
  const touchesArea = (i: number, p: number) => {
    const x = i % game.w, y = Math.floor(i / game.w);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < game.w && ny < game.h && state.area[ny * game.w + nx] === p) return true;
    }
    return false;
  };
  const lines: React.ReactNode[] = [];
  for (let i = 0; i < state.dot.length; i++) {
    const p = state.dot[i];
    if (!p || state.dead[i] || !touchesArea(i, p)) continue;
    const x = i % game.w;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
      const nx = x + dx, ny = Math.floor(i / game.w) + dy;
      if (nx < 0 || nx >= game.w || ny >= game.h) continue;
      const j = ny * game.w + nx;
      if (state.dot[j] === p && !state.dead[j] && touchesArea(j, p)) {
        const a = pos(i), b = pos(j);
        lines.push(<line key={`${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={COLORS[p]} strokeWidth={2.5} strokeLinecap="round" />);
      }
    }
  }

  const me = seat?.player || 0;
  const status = game.finished
    ? (state.score[1] === state.score[2] ? 'Гру завершено: нічия' : `Гру завершено: перемогли ${NAMES[state.score[1] > state.score[2] ? 1 : 2]}`)
    : !game.joined ? 'Чекаємо другого гравця — надішліть йому посилання'
    : !me ? `Ви дивитеся гру. Хід: ${NAMES[turn]}`
    : myTurn ? 'Ваш хід' : 'Хід суперника…';

  return (
    <div data-app-ready className="w-full max-w-lg mx-auto px-3 py-4 overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-2">
        {tg ? <span className="text-sm font-black text-white">Точки</span> : <button onClick={onBack} className="text-zinc-500 text-sm flex items-center gap-1"><ArrowLeft size={14} /> На сайт</button>}
        <div className="flex items-center gap-3 text-lg font-black">
          <span style={{ color: COLORS[1] }}>● {state.score[1]}</span>
          <span className="text-zinc-600">:</span>
          <span style={{ color: COLORS[2] }}>{state.score[2]} ●</span>
        </div>
      </div>
      <p className={`text-center text-sm font-bold mb-2 ${myTurn ? 'text-[#FFC300]' : 'text-zinc-400'}`}>
        {me ? <>Ви граєте <span style={{ color: COLORS[me] }}>{NAMES[me].toLowerCase()}</span> · </> : null}{status}
      </p>
      {!game.joined && (
        <div className="mb-3">
          <button onClick={share} className="w-full h-11 rounded-xl bg-[#FFC300] text-black font-black text-sm flex items-center justify-center gap-2">
            {tg || typeof navigator.share === 'function' ? <Share2 size={16} /> : <Copy size={16} />} {copied ? 'Посилання скопійовано' : tg ? 'Запросити друга в Telegram' : 'Надіслати посилання другу'}
          </button>
          <p className="text-[11px] text-zinc-500 mt-1 truncate text-center">{link}</p>
        </div>
      )}
      <div className="bg-white rounded-2xl overflow-hidden shadow-xl touch-manipulation">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block select-none" onClick={put} role="img" aria-label="Поле гри">
          {Array.from({ length: game.w }, (_, x) => <line key={`v${x}`} x1={PAD + x * STEP} y1={0} x2={PAD + x * STEP} y2={H} stroke="#bfdbfe" strokeWidth={1} />)}
          {Array.from({ length: game.h }, (_, y) => <line key={`h${y}`} x1={0} y1={PAD + y * STEP} x2={W} y2={PAD + y * STEP} stroke="#bfdbfe" strokeWidth={1} />)}
          {Array.from(state.area).map((p, i) => p ? <rect key={`a${i}`} x={pos(i).x - STEP / 2} y={pos(i).y - STEP / 2} width={STEP} height={STEP} fill={COLORS[p]} opacity={0.18} /> : null)}
          {lines}
          {Array.from(state.dot).map((p, i) => p ? (
            <circle key={`d${i}`} cx={pos(i).x} cy={pos(i).y} r={state.dead[i] ? 3.5 : 6} fill={COLORS[p]} opacity={state.dead[i] ? 0.45 : 1} />
          ) : null)}
          {game.moves.length > 0 && (() => { const [x, y] = game.moves[game.moves.length - 1]; return <circle cx={PAD + x * STEP} cy={PAD + y * STEP} r={9} fill="none" stroke="#111" strokeWidth={1.5} />; })()}
        </svg>
      </div>
      {err && <p className="text-red-400 text-sm text-center mt-2">{err}</p>}
      <div className="flex justify-center gap-2 mt-3">
        <button onClick={newGame} disabled={busy} className="h-10 px-4 rounded-xl bg-zinc-800 text-white font-bold text-sm flex items-center gap-1"><Plus size={16} /> Нова гра</button>
        {me > 0 && game.joined && !game.finished && <button onClick={finish} className="h-10 px-4 rounded-xl bg-zinc-800 text-white font-bold text-sm flex items-center gap-1"><Flag size={16} /> Завершити</button>}
      </div>
      {me > 0 && <p className="text-[11px] text-zinc-500 text-center mt-3">Обведіть точки суперника своїми точками (можна по діагоналі) — вони стають вашими. Всередину захопленої області ставити не можна.</p>}
    </div>
  );
};

export default DotsGame;
