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

// Pentatonic scale frequencies (C, D, E, G, A in multiple octaves)
const PENTA = [
  261.63, 293.66, 329.63, 392.00, 440.00,  // C4-A4
  523.25, 587.33, 659.25, 783.99, 880.00,  // C5-A5
];

// Melody designed to loop seamlessly: ends on degree that resolves back to start (C)
// Uses indices into PENTA: 0=C4,1=D4,2=E4,3=G4,4=A4, 5=C5,6=D5,7=E5,8=G5,9=A5
const BGM_MELODY = [
  0, 2, 4, 3,   // C E A G  — opening phrase
  2, 4, 3, 1,   // E A G D  — develop
  0, 3, 2, 4,   // C G E A  — variation
  3, 1, 2, 0,   // G D E C  — resolve back to C for seamless loop
];

const BGM_NOTE_NORMAL = 0.55;
const BGM_NOTE_FAST = 0.32;

export function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const bgmGainRef = useRef<GainNode | null>(null);
  const seGainRef = useRef<GainNode | null>(null);
  const bgmRunning = useRef(false);
  const bgmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgmScheduledUntil = useRef(0); // audio-time up to which notes are scheduled
  const bgmNoteIndex = useRef(0);      // current position in melody
  const bgmSpeedRef = useRef(BGM_NOTE_NORMAL);
  const [settings, setSettings] = useState<AudioSettings>(loadSettings);

  // Ensure AudioContext exists (must be called after user interaction)
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

    const seGain = ctx.createGain();
    seGain.gain.value = settings.muted ? 0 : settings.seVolume;
    seGain.connect(ctx.destination);
    seGainRef.current = seGain;

    return ctx;
  }, []); // settings read from ref-like state at creation time only

  // Sync gain values when settings change
  useEffect(() => {
    saveSettings(settings);
    if (bgmGainRef.current) {
      bgmGainRef.current.gain.value = settings.muted ? 0 : settings.bgmVolume;
    }
    if (seGainRef.current) {
      seGainRef.current.gain.value = settings.muted ? 0 : settings.seVolume;
    }
  }, [settings]);

  // --- BGM: gentle pentatonic loop with look-ahead scheduling ---
  // Schedules notes ahead of time using AudioContext clock for seamless looping
  const scheduleBGMNotes = useCallback((ctx: AudioContext, gain: GainNode) => {
    if (!bgmRunning.current) return;

    const lookAhead = 2.0; // schedule 2 seconds ahead
    const now = ctx.currentTime;
    let t = bgmScheduledUntil.current;
    if (t < now) t = now; // catch up if behind

    while (t < now + lookAhead) {
      const dur = bgmSpeedRef.current;
      const noteIdx = BGM_MELODY[bgmNoteIndex.current % BGM_MELODY.length];
      const freq = PENTA[noteIdx];

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const noteGain = ctx.createGain();
      // Smooth envelope: fade in, sustain, fade out — overlaps slightly for legato
      noteGain.gain.setValueAtTime(0, t);
      noteGain.gain.linearRampToValueAtTime(0.15, t + dur * 0.08);
      noteGain.gain.setValueAtTime(0.15, t + dur * 0.5);
      noteGain.gain.linearRampToValueAtTime(0, t + dur);

      osc.connect(noteGain);
      noteGain.connect(gain);
      osc.start(t);
      osc.stop(t + dur + 0.01);

      t += dur;
      bgmNoteIndex.current++;
    }

    bgmScheduledUntil.current = t;

    // Re-check periodically (well before look-ahead expires)
    bgmTimerRef.current = setTimeout(() => scheduleBGMNotes(ctx, gain), 800);
  }, []);

  const playBGM = useCallback(() => {
    const ctx = ensureCtx();
    if (bgmRunning.current) return;
    bgmRunning.current = true;
    bgmNoteIndex.current = 0;
    bgmScheduledUntil.current = ctx.currentTime;
    bgmSpeedRef.current = BGM_NOTE_NORMAL;
    scheduleBGMNotes(ctx, bgmGainRef.current!);
  }, [ensureCtx, scheduleBGMNotes]);

  const stopBGM = useCallback(() => {
    bgmRunning.current = false;
    if (bgmTimerRef.current) {
      clearTimeout(bgmTimerRef.current);
      bgmTimerRef.current = null;
    }
  }, []);

  const setBGMFast = useCallback((fast: boolean) => {
    bgmSpeedRef.current = fast ? BGM_NOTE_FAST : BGM_NOTE_NORMAL;
  }, []);

  // --- SE ---
  const playSE = useCallback((name: SEName) => {
    const ctx = ensureCtx();
    const gain = seGainRef.current!;
    const now = ctx.currentTime;

    switch (name) {
      case 'tilePlace': {
        // Short click/knock sound
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
        // Rising chord chime (C-E-G-A)
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
        // Low short buzzer
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
        // Gentle attention chime (two notes)
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
        // Bright fanfare (ascending arpeggio)
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
        // Ending melody (descending)
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

  // Cleanup on unmount
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
