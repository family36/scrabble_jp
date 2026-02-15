import { useRef, useCallback, useState, useEffect } from 'react';

type SEName = 'tilePlace' | 'wordSuccess' | 'wordError' | 'turnStart' | 'gameStart' | 'gameOver';

interface AudioSettings {
  bgmVolume: number;
  seVolume: number;
  muted: boolean;
}

const STORAGE_KEY = 'scrabble-audio-settings';

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { bgmVolume: 0.3, seVolume: 0.5, muted: false };
}

function saveSettings(s: AudioSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ---- Lo-fi Hip-Hop BGM Constants ----

const BPM_NORMAL = 72;
const BPM_FAST = 88;
const LOOP_BARS = 16;

function beatDur(bpm: number) { return 60 / bpm; }
function barDur(bpm: number) { return beatDur(bpm) * 4; }
function loopDur(bpm: number) { return barDur(bpm) * LOOP_BARS; }

// Lo-fi filter cutoff
const LOFI_CUTOFF = 900;

// Chord voicings (jazz 7ths, mid-low register for warmth)
// Each chord lasts 4 bars
const CHORD_PROG: number[][] = [
  [164.81, 196.00, 246.94, 293.66],  // Em7:   E3, G3, B3, D4
  [130.81, 164.81, 196.00, 246.94],  // Cmaj7: C3, E3, G3, B3
  [110.00, 130.81, 164.81, 196.00],  // Am7:   A2, C3, E3, G3
  [123.47, 146.83, 185.00, 220.00],  // Bm7:   B2, D3, F#3, A3
];

// Bass root for each chord section
const BASS_ROOTS = [82.41, 65.41, 55.00, 61.74]; // E2, C2, A1, B1

// Melody: Em pentatonic
const MEL = [329.63, 392.00, 440.00, 493.88, 587.33]; // E4, G4, A4, B4, D5

// Melody sequence: [barInLoop, beatInBar, melodyIndex, durationInBeats]
const MELODY_SEQ: [number, number, number, number][] = [
  // Bars 0-3 (Em7)
  [0, 0.5, 2, 1.5],
  [0, 3, 4, 1],
  [1, 1, 3, 2],
  [2, 0, 2, 1],
  [2, 2, 1, 2],
  [3, 0.5, 0, 1.5],
  [3, 3, 1, 1],
  // Bars 4-7 (Cmaj7)
  [4, 0, 4, 2],
  [4, 2.5, 3, 1.5],
  [5, 1, 2, 1.5],
  [5, 3, 1, 1],
  [6, 0.5, 0, 2],
  [6, 3, 2, 1],
  [7, 0, 3, 1.5],
  [7, 2.5, 1, 1.5],
  // Bars 8-11 (Am7)
  [8, 0, 3, 2],
  [8, 2.5, 4, 1.5],
  [9, 0.5, 2, 2],
  [9, 3, 1, 1],
  [10, 0, 0, 1.5],
  [10, 2, 2, 2],
  [11, 0.5, 3, 1.5],
  [11, 2.5, 4, 1.5],
  // Bars 12-15 (Bm7) — resolves back for loop
  [12, 0, 2, 2],
  [12, 2.5, 3, 1.5],
  [13, 0.5, 4, 1.5],
  [13, 2.5, 2, 1.5],
  [14, 0, 1, 2],
  [14, 3, 0, 1],
  [15, 0, 1, 2],
  [15, 2.5, 0, 1.5],
];

// Drum pattern per bar: [beatOffset, type]
// 'K' = kick, 'S' = snare, 'H' = hi-hat
const DRUM_PATTERN: [number, 'K' | 'S' | 'H'][] = [
  [0, 'K'], [0, 'H'],
  [0.5, 'H'],
  [1, 'S'], [1, 'H'],
  [1.5, 'H'],
  [2, 'K'], [2, 'H'],
  [2.75, 'K'],           // ghost kick for swing
  [2.5, 'H'],
  [3, 'S'], [3, 'H'],
  [3.5, 'H'],
];

// ---- Audio scheduling helpers ----

function scheduleChordPad(
  ctx: AudioContext, dest: AudioNode,
  freqs: number[], time: number, dur: number,
) {
  for (const freq of freqs) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    // Slight random detune for lo-fi warmth
    osc.detune.value = (Math.random() - 0.5) * 12;
    osc.frequency.value = freq;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(0.035, time + 0.3);
    env.gain.setValueAtTime(0.035, time + dur - 0.5);
    env.gain.linearRampToValueAtTime(0, time + dur);

    osc.connect(env);
    env.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }
}

function scheduleBass(
  ctx: AudioContext, dest: AudioNode,
  rootFreq: number, sectionStart: number, sectionDur: number, beat: number,
) {
  // Play bass on beats 1 and 3 of each bar
  const barsInSection = 4;
  const bar = beat * 4;
  for (let b = 0; b < barsInSection; b++) {
    for (const offset of [0, 2]) {
      const t = sectionStart + b * bar + offset * beat;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = rootFreq;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.12, t + 0.05);
      env.gain.setValueAtTime(0.12, t + beat * 1.2);
      env.gain.linearRampToValueAtTime(0, t + beat * 1.8);

      osc.connect(env);
      env.connect(dest);
      osc.start(t);
      osc.stop(t + beat * 2 + 0.05);
    }
  }
}

function scheduleKick(ctx: AudioContext, dest: AudioNode, t: number) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.35, t);
  env.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

  osc.connect(env);
  env.connect(dest);
  osc.start(t);
  osc.stop(t + 0.3);
}

function scheduleSnare(ctx: AudioContext, dest: AudioNode, t: number) {
  // Noise burst through bandpass
  const bufferSize = ctx.sampleRate * 0.12;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3000;
  filter.Q.value = 0.8;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.2, t);
  env.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

  noise.connect(filter);
  filter.connect(env);
  env.connect(dest);
  noise.start(t);
  noise.stop(t + 0.15);
}

function scheduleHiHat(ctx: AudioContext, dest: AudioNode, t: number) {
  const bufferSize = ctx.sampleRate * 0.04;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 7000;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.06, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

  noise.connect(filter);
  filter.connect(env);
  env.connect(dest);
  noise.start(t);
  noise.stop(t + 0.06);
}

function scheduleMelodyNote(
  ctx: AudioContext, dest: AudioNode,
  freq: number, t: number, dur: number,
) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;

  // Gentle low-pass per note for extra softness
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1200;
  filter.Q.value = 0.5;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(0.09, t + 0.06);
  env.gain.setValueAtTime(0.09, t + dur * 0.6);
  env.gain.linearRampToValueAtTime(0, t + dur);

  osc.connect(filter);
  filter.connect(env);
  env.connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function scheduleVinylNoise(
  ctx: AudioContext, dest: AudioNode,
  startTime: number, dur: number,
) {
  const bufferSize = Math.ceil(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  // Sparse crackle: mostly silence with occasional tiny pops
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() < 0.002 ? (Math.random() - 0.5) * 0.3 : 0;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const env = ctx.createGain();
  env.gain.value = 0.15;

  noise.connect(env);
  env.connect(dest);
  noise.start(startTime);
  noise.stop(startTime + dur + 0.01);
}

// Schedule one full BGM loop
function scheduleBGMLoop(
  ctx: AudioContext, masterGain: GainNode,
  lofiFilter: BiquadFilterNode, startTime: number, bpm: number,
) {
  const beat = beatDur(bpm);
  const bar = barDur(bpm);
  const totalDur = loopDur(bpm);

  // Chord pads + bass
  for (let ci = 0; ci < 4; ci++) {
    const secStart = startTime + ci * 4 * bar;
    const secDur = 4 * bar;
    scheduleChordPad(ctx, lofiFilter, CHORD_PROG[ci], secStart, secDur);
    scheduleBass(ctx, lofiFilter, BASS_ROOTS[ci], secStart, secDur, beat);
  }

  // Drums per bar
  for (let b = 0; b < LOOP_BARS; b++) {
    const barStart = startTime + b * bar;
    for (const [offset, type] of DRUM_PATTERN) {
      const t = barStart + offset * beat;
      if (type === 'K') scheduleKick(ctx, lofiFilter, t);
      else if (type === 'S') scheduleSnare(ctx, lofiFilter, t);
      else scheduleHiHat(ctx, lofiFilter, t);
    }
  }

  // Melody
  for (const [barIdx, beatOff, melIdx, durBeats] of MELODY_SEQ) {
    const t = startTime + barIdx * bar + beatOff * beat;
    scheduleMelodyNote(ctx, lofiFilter, MEL[melIdx], t, durBeats * beat);
  }

  // Vinyl crackle
  scheduleVinylNoise(ctx, lofiFilter, startTime, totalDur);
}

// ---- Hook ----

export function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const bgmGainRef = useRef<GainNode | null>(null);
  const seGainRef = useRef<GainNode | null>(null);
  const lofiFilterRef = useRef<BiquadFilterNode | null>(null);
  const bgmRunning = useRef(false);
  const bgmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgmNextLoopTime = useRef(0);
  const bgmBpmRef = useRef(BPM_NORMAL);
  const [settings, setSettings] = useState<AudioSettings>(loadSettings);

  const ensureCtx = useCallback(() => {
    if (ctxRef.current) {
      if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
      return ctxRef.current;
    }
    const ctx = new AudioContext();
    ctxRef.current = ctx;

    const bgmGain = ctx.createGain();
    bgmGain.gain.value = settings.muted ? 0 : settings.bgmVolume;
    bgmGain.connect(ctx.destination);
    bgmGainRef.current = bgmGain;

    // Master lo-fi filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = LOFI_CUTOFF;
    filter.Q.value = 0.7;
    filter.connect(bgmGain);
    lofiFilterRef.current = filter;

    const seGain = ctx.createGain();
    seGain.gain.value = settings.muted ? 0 : settings.seVolume;
    seGain.connect(ctx.destination);
    seGainRef.current = seGain;

    return ctx;
  }, []);

  useEffect(() => {
    saveSettings(settings);
    if (bgmGainRef.current) {
      bgmGainRef.current.gain.value = settings.muted ? 0 : settings.bgmVolume;
    }
    if (seGainRef.current) {
      seGainRef.current.gain.value = settings.muted ? 0 : settings.seVolume;
    }
  }, [settings]);

  // BGM loop scheduler: schedules the next loop ~4s before current ends
  const scheduleNextLoop = useCallback(() => {
    if (!bgmRunning.current) return;
    const ctx = ctxRef.current!;
    const gain = bgmGainRef.current!;
    const filter = lofiFilterRef.current!;

    const now = ctx.currentTime;
    let nextStart = bgmNextLoopTime.current;
    if (nextStart < now) nextStart = now;

    const bpm = bgmBpmRef.current;
    scheduleBGMLoop(ctx, gain, filter, nextStart, bpm);
    bgmNextLoopTime.current = nextStart + loopDur(bpm);

    // Schedule next check ~4s before loop ends
    const msUntilEnd = (bgmNextLoopTime.current - ctx.currentTime - 4) * 1000;
    bgmTimerRef.current = setTimeout(
      () => scheduleNextLoop(),
      Math.max(msUntilEnd, 1000),
    );
  }, []);

  const playBGM = useCallback(() => {
    const ctx = ensureCtx();
    if (bgmRunning.current) return;
    bgmRunning.current = true;
    bgmBpmRef.current = BPM_NORMAL;
    bgmNextLoopTime.current = ctx.currentTime;
    scheduleNextLoop();
  }, [ensureCtx, scheduleNextLoop]);

  const stopBGM = useCallback(() => {
    bgmRunning.current = false;
    if (bgmTimerRef.current) {
      clearTimeout(bgmTimerRef.current);
      bgmTimerRef.current = null;
    }
  }, []);

  const setBGMFast = useCallback((fast: boolean) => {
    bgmBpmRef.current = fast ? BPM_FAST : BPM_NORMAL;
  }, []);

  // --- SE ---
  const playSE = useCallback((name: SEName) => {
    const ctx = ensureCtx();
    const gain = seGainRef.current!;
    const now = ctx.currentTime;

    switch (name) {
      case 'tilePlace': {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 800;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.4, now);
        env.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.connect(env);
        env.connect(gain);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case 'wordSuccess': {
        const freqs = [523.25, 659.25, 783.99, 880.00];
        freqs.forEach((f, i) => {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = f;
          const env = ctx.createGain();
          const t = now + i * 0.1;
          env.gain.setValueAtTime(0, t);
          env.gain.linearRampToValueAtTime(0.3, t + 0.05);
          env.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
          osc.connect(env);
          env.connect(gain);
          osc.start(t);
          osc.stop(t + 0.5);
        });
        break;
      }
      case 'wordError': {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 150;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.25, now);
        env.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.connect(env);
        env.connect(gain);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }
      case 'turnStart': {
        [659.25, 880.00].forEach((f, i) => {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = f;
          const env = ctx.createGain();
          const t = now + i * 0.12;
          env.gain.setValueAtTime(0, t);
          env.gain.linearRampToValueAtTime(0.25, t + 0.03);
          env.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
          osc.connect(env);
          env.connect(gain);
          osc.start(t);
          osc.stop(t + 0.35);
        });
        break;
      }
      case 'gameStart': {
        const notes = [523.25, 659.25, 783.99, 880.00, 1046.50];
        notes.forEach((f, i) => {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = f;
          const env = ctx.createGain();
          const t = now + i * 0.12;
          env.gain.setValueAtTime(0, t);
          env.gain.linearRampToValueAtTime(0.3, t + 0.04);
          env.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
          osc.connect(env);
          env.connect(gain);
          osc.start(t);
          osc.stop(t + 0.55);
        });
        break;
      }
      case 'gameOver': {
        const notes = [880.00, 783.99, 659.25, 523.25];
        notes.forEach((f, i) => {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = f;
          const env = ctx.createGain();
          const t = now + i * 0.25;
          env.gain.setValueAtTime(0, t);
          env.gain.linearRampToValueAtTime(0.3, t + 0.05);
          env.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
          osc.connect(env);
          env.connect(gain);
          osc.start(t);
          osc.stop(t + 0.65);
        });
        break;
      }
    }
  }, [ensureCtx]);

  const toggleMute = useCallback(() => {
    setSettings(prev => ({ ...prev, muted: !prev.muted }));
  }, []);

  const setVolume = useCallback((bgm: number, se: number) => {
    setSettings(prev => ({ ...prev, bgmVolume: bgm, seVolume: se }));
  }, []);

  useEffect(() => {
    return () => {
      bgmRunning.current = false;
      if (bgmTimerRef.current) {
        clearTimeout(bgmTimerRef.current);
      }
      if (ctxRef.current) {
        ctxRef.current.close();
      }
    };
  }, []);

  return {
    playBGM,
    stopBGM,
    setBGMFast,
    playSE,
    toggleMute,
    setVolume,
    muted: settings.muted,
  };
}
