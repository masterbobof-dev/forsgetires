/**
 * Sounds of «Фортеці», made on the fly (no sound files): shots, explosions, building, capture.
 * The phone lets a page play sound only after the player touched it, so the sound starts on the first touch.
 * The player can switch it off (remembered on this phone).
 */
export type Sfx = 'click' | 'shot' | 'tank' | 'hit' | 'boom' | 'bigboom' | 'build' | 'hire' | 'capture' | 'heal';

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
const KEY = 'forsage_game_sound';

export const soundOn = (): boolean => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
export const setSoundOn = (on: boolean) => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode */ } };

/** call on a touch: creates (or wakes up) the sound of the page */
export const unlockSound = () => {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* no sound on this device */ }
};

const env = (g: GainNode, t: number, peak: number, attack: number, decay: number) => {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
};
/** a burst of noise through a filter: shots, explosions, knocks */
const burst = (t: number, freq: number, q: number, peak: number, decay: number, type: BiquadFilterType = 'bandpass') => {
  const src = ctx!.createBufferSource(); src.buffer = noise;
  const f = ctx!.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx!.createGain(); env(g, t, peak, 0.004, decay);
  src.connect(f).connect(g).connect(ctx!.destination);
  src.start(t, Math.random() * 0.5); src.stop(t + decay + 0.05);
};
/** a short tone: a thump under an explosion, notes of a capture */
const tone = (t: number, from: number, to: number, peak: number, decay: number, type: OscillatorType = 'sine') => {
  const o = ctx!.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(Math.max(to, 20), t + decay);
  const g = ctx!.createGain(); env(g, t, peak, 0.005, decay);
  o.connect(g).connect(ctx!.destination); o.start(t); o.stop(t + decay + 0.05);
};

export const play = (s: Sfx, delayMs = 0) => {
  if (!ctx || !noise || ctx.state !== 'running' || !soundOn()) return;
  const t = ctx.currentTime + Math.max(0, delayMs) / 1000;
  switch (s) {
    case 'click': burst(t, 3200, 4, 0.08, 0.04); break;
    case 'shot': burst(t, 1800, 1.2, 0.25, 0.09); break;
    case 'tank': burst(t, 600, 0.8, 0.45, 0.25); tone(t, 140, 50, 0.35, 0.25); break;
    case 'hit': burst(t, 900, 1, 0.25, 0.15); break;
    case 'boom': burst(t, 400, 0.7, 0.5, 0.5, 'lowpass'); tone(t, 110, 35, 0.4, 0.4); break;
    case 'bigboom': burst(t, 300, 0.6, 0.7, 0.9, 'lowpass'); tone(t, 90, 28, 0.6, 0.7); break;
    case 'build': burst(t, 500, 3, 0.3, 0.08); burst(t + 0.12, 450, 3, 0.25, 0.08); break;
    case 'hire': tone(t, 520, 520, 0.08, 0.08, 'square'); tone(t + 0.09, 780, 780, 0.08, 0.1, 'square'); break;
    case 'capture': [523, 659, 784].forEach((f, k) => tone(t + k * 0.09, f, f, 0.12, 0.22, 'triangle')); break;
    case 'heal': tone(t, 660, 990, 0.06, 0.18, 'sine'); break;
  }
};
