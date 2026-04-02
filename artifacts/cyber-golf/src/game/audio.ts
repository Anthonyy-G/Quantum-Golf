// Per-level procedural music — 5 distinct cyberpunk soundscapes
// Each level has its own BPM, key, chord voicings, and drum pattern

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let reverbNode: ConvolverNode | null = null;
let delayNode: DelayNode | null = null;
let isPlaying = false;
let loopTimeout: ReturnType<typeof setTimeout> | null = null;
let currentBar = 0;
let activeLevel = 0;

// ── Audio context ──────────────────────────────────────────────────────────

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

// ── FX chain helpers ───────────────────────────────────────────────────────

function createReverb(ac: AudioContext, secs = 2.0, decay = 2.0): ConvolverNode {
  const conv = ac.createConvolver();
  const len = ac.sampleRate * secs;
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  conv.buffer = buf;
  return conv;
}

function createDelay(ac: AudioContext, time = 0.375, fb = 0.28): DelayNode {
  const delay = ac.createDelay(2.0);
  delay.delayTime.value = time;
  const fbGain = ac.createGain();
  fbGain.gain.value = fb;
  delay.connect(fbGain);
  fbGain.connect(delay);
  return delay;
}

function connectToOutput(node: AudioNode, wet = 0.25) {
  node.connect(masterGain!);
  if (reverbNode) {
    const rg = getCtx().createGain(); rg.gain.value = wet;
    node.connect(rg); rg.connect(reverbNode);
  }
  if (delayNode) {
    const dg = getCtx().createGain(); dg.gain.value = wet * 0.4;
    node.connect(dg); dg.connect(delayNode);
  }
}

// ── Note synthesizer ───────────────────────────────────────────────────────

function note(
  freq: number, start: number, dur: number, vol: number,
  type: OscillatorType = 'sawtooth', cutoff = 1200, q = 1.5,
  envAmt = 0, wet = 0.25
) {
  const ac = getCtx();
  const osc  = ac.createOscillator();
  const osc2 = ac.createOscillator();
  const filt = ac.createBiquadFilter();
  const gain = ac.createGain();

  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(cutoff, start);
  filt.frequency.linearRampToValueAtTime(cutoff + envAmt, start + 0.02);
  filt.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.4), start + dur * 0.8);
  filt.Q.value = q;

  osc.type  = type; osc.frequency.setValueAtTime(freq, start);
  osc2.type = type; osc2.frequency.setValueAtTime(freq * 1.004, start);

  gain.gain.setValueAtTime(0.001, start);
  gain.gain.linearRampToValueAtTime(vol, start + 0.012);
  gain.gain.setValueAtTime(vol, start + dur - 0.06);
  gain.gain.linearRampToValueAtTime(0.001, start + dur);

  osc.connect(filt); osc2.connect(filt); filt.connect(gain);
  connectToOutput(gain, wet);
  osc.start(start);  osc.stop(start + dur + 0.05);
  osc2.start(start); osc2.stop(start + dur + 0.05);
}

// ── Drums ──────────────────────────────────────────────────────────────────

function kick(t: number, vol = 0.8, pitchStart = 110, pitchEnd = 42) {
  const ac = getCtx();
  const osc = ac.createOscillator(); const g = ac.createGain();
  osc.frequency.setValueAtTime(pitchStart, t);
  osc.frequency.exponentialRampToValueAtTime(pitchEnd, t + 0.15);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  osc.connect(g); g.connect(masterGain!);
  osc.start(t); osc.stop(t + 0.3);
}

function snare(t: number, vol = 0.4) {
  const ac = getCtx();
  const osc = ac.createOscillator(); const og = ac.createGain();
  osc.frequency.setValueAtTime(220, t); osc.frequency.exponentialRampToValueAtTime(160, t + 0.05);
  og.gain.setValueAtTime(vol * 0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  osc.connect(og); og.connect(masterGain!); osc.start(t); osc.stop(t + 0.1);

  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.12), ac.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(); src.buffer = buf;
  const filt = ac.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 3500; filt.Q.value = 0.8;
  const ng = ac.createGain(); ng.gain.setValueAtTime(vol, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(filt); filt.connect(ng); ng.connect(masterGain!); src.start(t); src.stop(t + 0.15);
}

function hihat(t: number, vol = 0.15, open = false) {
  const ac = getCtx();
  const dur = open ? 0.28 : 0.055;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(); src.buffer = buf;
  const filt = ac.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 7800;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filt); filt.connect(g); g.connect(masterGain!); src.start(t); src.stop(t + dur + 0.01);
}

function clap(t: number, vol = 0.35) {
  const ac = getCtx();
  for (let i = 0; i < 3; i++) {
    const dt = i * 0.012;
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.1), ac.sampleRate);
    const d = buf.getChannelData(0); for (let j = 0; j < d.length; j++) d[j] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(); src.buffer = buf;
    const filt = ac.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 1800; filt.Q.value = 1.2;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t + dt); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.1);
    src.connect(filt); filt.connect(g); g.connect(masterGain!); src.start(t + dt); src.stop(t + dt + 0.12);
  }
}

// ── Level music configs ────────────────────────────────────────────────────

interface LevelConfig {
  bpm: number;
  name: string;
  // bass pattern: [freq, freq, …] × 8 steps per bar (for 4 chords)
  bassPatterns: number[][];
  // chord frequencies (3 notes) for 4 chords
  chordFreqs: number[][];
  // melody notes: 16 steps per bar (0 = rest), for 4 bars
  melody: number[][];
  bassType: OscillatorType;
  melType: OscillatorType;
  chordType: OscillatorType;
  bassCutoff: number;
  melCutoff: number;
  drumPattern: 1 | 2 | 3 | 4 | 5;
  reverbSecs: number;
  delayBeatFraction: number;
  masterVol: number;
}

// Frequencies for reference:
// A2=110, B2=123.47, C3=130.81, D3=146.83, E3=164.81, F3=174.61, G3=196
// A3=220, B3=246.94, C4=261.63, D4=293.66, E4=329.63, F4=349.23, G4=392, A4=440

const LEVEL_CONFIGS: LevelConfig[] = [

  // ── Level 1: NEON RUNWAY — driving groove, A minor, 120 BPM ──────────────
  {
    bpm: 120, name: 'Neon Runway',
    bassPatterns: [
      [55, 55, 55, 55, 82.41, 82.41, 73.42, 73.42],
      [43.65, 43.65, 65.41, 65.41, 65.41, 65.41, 55, 55],
      [32.70, 32.70, 65.41, 65.41, 82.41, 82.41, 65.41, 65.41],
      [48.99, 48.99, 73.42, 73.42, 73.42, 73.42, 65.41, 65.41],
    ],
    chordFreqs: [
      [220, 261.63, 329.63],
      [174.61, 220, 261.63],
      [130.81, 164.81, 196],
      [196, 246.94, 293.66],
    ],
    melody: [
      [440, 0, 523.25, 0, 587.33, 0, 659.26, 0, 587.33, 0, 523.25, 0, 440, 0, 392, 0],
      [349.23, 0, 392, 0, 440, 0, 523.25, 0, 440, 0, 392, 0, 349.23, 0, 330, 0],
      [261.63, 0, 329.63, 0, 392, 0, 440, 0, 523.25, 0, 440, 0, 392, 0, 329.63, 0],
      [293.66, 0, 349.23, 0, 392, 0, 440, 0, 392, 0, 349.23, 0, 329.63, 0, 293.66, 0],
    ],
    bassType: 'sawtooth', melType: 'square', chordType: 'triangle',
    bassCutoff: 420, melCutoff: 2200, drumPattern: 1, reverbSecs: 2.2, delayBeatFraction: 0.75, masterVol: 0.55,
  },

  // ── Level 2: VOID BRIDGE — slow atmospheric, E minor, 85 BPM ─────────────
  {
    bpm: 85, name: 'Void Bridge',
    bassPatterns: [
      [41.20, 41.20, 0, 61.74, 0, 82.41, 0, 61.74],
      [36.71, 36.71, 0, 55, 0, 73.42, 0, 55],
      [32.70, 32.70, 0, 48.99, 0, 65.41, 0, 48.99],
      [43.65, 43.65, 0, 65.41, 0, 82.41, 0, 65.41],
    ],
    chordFreqs: [
      [164.81, 196, 246.94],
      [146.83, 174.61, 220],
      [130.81, 155.56, 196],
      [174.61, 207.65, 261.63],
    ],
    melody: [
      [659.26, 0, 0, 587.33, 0, 0, 523.25, 0, 0, 587.33, 0, 0, 659.26, 0, 0, 0],
      [587.33, 0, 0, 523.25, 0, 0, 493.88, 0, 0, 523.25, 0, 0, 587.33, 0, 0, 0],
      [523.25, 0, 0, 493.88, 0, 0, 440, 0, 0, 493.88, 0, 0, 523.25, 0, 0, 0],
      [587.33, 0, 0, 659.26, 0, 0, 698.46, 0, 0, 659.26, 0, 0, 587.33, 0, 0, 0],
    ],
    bassType: 'sine', melType: 'triangle', chordType: 'sine',
    bassCutoff: 280, melCutoff: 900, drumPattern: 2, reverbSecs: 3.5, delayBeatFraction: 0.5, masterVol: 0.48,
  },

  // ── Level 3: GRAVITY SHIFT — fast & frantic, D minor, 145 BPM ────────────
  {
    bpm: 145, name: 'Gravity Shift',
    bassPatterns: [
      [73.42, 73.42, 87.31, 73.42, 65.41, 73.42, 87.31, 65.41],
      [65.41, 65.41, 77.78, 65.41, 58.27, 65.41, 77.78, 58.27],
      [87.31, 87.31, 104, 87.31, 77.78, 87.31, 104, 77.78],
      [82.41, 82.41, 98, 82.41, 73.42, 82.41, 98, 73.42],
    ],
    chordFreqs: [
      [293.66, 349.23, 440],
      [261.63, 311.13, 392],
      [349.23, 415.30, 523.25],
      [329.63, 392, 493.88],
    ],
    melody: [
      [587.33, 698.46, 587.33, 0, 523.25, 0, 587.33, 698.46, 587.33, 0, 523.25, 698.46, 587.33, 0, 523.25, 0],
      [523.25, 622.25, 523.25, 0, 466.16, 0, 523.25, 622.25, 523.25, 0, 466.16, 622.25, 523.25, 0, 466.16, 0],
      [698.46, 830.61, 698.46, 0, 622.25, 0, 698.46, 830.61, 698.46, 0, 622.25, 830.61, 698.46, 0, 622.25, 0],
      [659.26, 784, 659.26, 0, 587.33, 0, 659.26, 784, 659.26, 0, 587.33, 784, 659.26, 0, 587.33, 0],
    ],
    bassType: 'sawtooth', melType: 'square', chordType: 'sawtooth',
    bassCutoff: 600, melCutoff: 2800, drumPattern: 3, reverbSecs: 1.4, delayBeatFraction: 0.33, masterVol: 0.58,
  },

  // ── Level 4: CYBER MAZE — dark & dissonant, B minor, 105 BPM ─────────────
  {
    bpm: 105, name: 'Cyber Maze',
    bassPatterns: [
      [61.74, 0, 61.74, 0, 73.42, 0, 65.41, 0],
      [55, 0, 55, 0, 65.41, 0, 58.27, 0],
      [51.91, 0, 51.91, 0, 61.74, 0, 55, 0],
      [65.41, 0, 65.41, 0, 77.78, 0, 69.30, 0],
    ],
    chordFreqs: [
      [246.94, 293.66, 369.99],
      [220, 261.63, 329.63],
      [207.65, 246.94, 311.13],
      [261.63, 311.13, 392],
    ],
    melody: [
      [493.88, 0, 554.37, 0, 523.25, 0, 466.16, 0, 493.88, 0, 0, 415.30, 440, 0, 466.16, 0],
      [440, 0, 493.88, 0, 466.16, 0, 415.30, 0, 440, 0, 0, 369.99, 392, 0, 415.30, 0],
      [415.30, 0, 466.16, 0, 440, 0, 392, 0, 415.30, 0, 0, 349.23, 369.99, 0, 392, 0],
      [523.25, 0, 587.33, 0, 554.37, 0, 493.88, 0, 523.25, 0, 0, 466.16, 493.88, 0, 523.25, 0],
    ],
    bassType: 'sawtooth', melType: 'square', chordType: 'triangle',
    bassCutoff: 350, melCutoff: 1600, drumPattern: 4, reverbSecs: 2.8, delayBeatFraction: 0.66, masterVol: 0.52,
  },

  // ── Level 5: DIMENSION ZERO — epic climax, A major, 132 BPM ──────────────
  {
    bpm: 132, name: 'Dimension Zero',
    bassPatterns: [
      [55, 55, 82.41, 55, 65.41, 55, 82.41, 69.30],
      [61.74, 61.74, 92.50, 61.74, 73.42, 61.74, 92.50, 77.78],
      [43.65, 43.65, 65.41, 43.65, 55, 43.65, 65.41, 58.27],
      [49, 49, 73.42, 49, 61.74, 49, 73.42, 65.41],
    ],
    chordFreqs: [
      [220, 277.18, 329.63],    // A major
      [246.94, 311.13, 369.99], // B minor
      [174.61, 220, 261.63],    // F major
      [196, 246.94, 293.66],    // G major
    ],
    melody: [
      [440, 0, 554.37, 0, 659.26, 0, 880, 0, 659.26, 0, 554.37, 880, 659.26, 0, 554.37, 0],
      [493.88, 0, 622.25, 0, 739.99, 0, 987.77, 0, 739.99, 0, 622.25, 987.77, 739.99, 0, 622.25, 0],
      [349.23, 0, 440, 0, 523.25, 0, 698.46, 0, 523.25, 0, 440, 698.46, 523.25, 0, 440, 0],
      [392, 0, 493.88, 0, 587.33, 0, 784, 0, 587.33, 0, 493.88, 784, 587.33, 0, 493.88, 0],
    ],
    bassType: 'sawtooth', melType: 'square', chordType: 'triangle',
    bassCutoff: 560, melCutoff: 3200, drumPattern: 5, reverbSecs: 2.0, delayBeatFraction: 0.75, masterVol: 0.62,
  },
];

// ── Drum patterns (5 distinct styles) ─────────────────────────────────────

function scheduleDrums(t0: number, barIdx: number, beat: number, pat: 1 | 2 | 3 | 4 | 5) {
  const B = beat;

  if (pat === 1) {
    // Standard 4-on-floor with 8th hi-hats
    for (let s = 0; s < 8; s++) {
      const t = t0 + s * B * 0.5;
      if (s === 0 || s === 4) kick(t);
      if (s === 2 || s === 6) snare(t);
      hihat(t, 0.17);
    }
    if (barIdx % 4 === 3) {
      for (let s = 0; s < 16; s++) hihat(t0 + s * B * 0.25, 0.08);
    }
  }

  if (pat === 2) {
    // Slow atmospheric — half-time feel, sparse
    for (let s = 0; s < 8; s++) {
      const t = t0 + s * B * 0.5;
      if (s === 0) kick(t, 0.7);
      if (s === 4) kick(t, 0.4);
      if (s === 6) snare(t, 0.3);
      if (s % 2 === 0) hihat(t, 0.10);
    }
    if (barIdx % 2 === 1) hihat(t0 + 3 * B * 0.5, 0.14, true);
  }

  if (pat === 3) {
    // Breakbeat / frantic 16th pattern
    for (let s = 0; s < 16; s++) {
      const t = t0 + s * B * 0.25;
      if (s === 0 || s === 8) kick(t, 0.88);
      if (s === 4 || s === 10 || s === 14) kick(t, 0.45);
      if (s === 4 || s === 12) snare(t, 0.5);
      if (s % 2 === 0) hihat(t, 0.14);
      else hihat(t, 0.07);
    }
  }

  if (pat === 4) {
    // Industrial — heavy kick, clap, sparse hats
    for (let s = 0; s < 8; s++) {
      const t = t0 + s * B * 0.5;
      if (s === 0 || s === 5) kick(t, 0.9, 80, 30);
      if (s === 2 || s === 6) clap(t, 0.42);
      if (s === 1 || s === 3 || s === 7) hihat(t, 0.09);
    }
    if (barIdx % 4 === 2) {
      kick(t0 + 7 * B * 0.5 + B * 0.25, 0.55, 80, 30);
    }
  }

  if (pat === 5) {
    // Epic double-time — kick + clap + 16ths
    for (let s = 0; s < 16; s++) {
      const t = t0 + s * B * 0.25;
      if (s === 0 || s === 8) kick(t, 0.92, 130, 50);
      if (s === 4 || s === 12) { snare(t, 0.45); clap(t, 0.3); }
      if (s % 2 === 0) hihat(t, 0.16);
      else if (barIdx % 2 === 1) hihat(t, 0.07);
    }
    // Extra ghost kicks
    if (barIdx % 4 === 3) {
      kick(t0 + 14 * B * 0.25, 0.5, 130, 50);
      kick(t0 + 15 * B * 0.25, 0.3, 130, 50);
    }
  }
}

// ── Bar scheduler ──────────────────────────────────────────────────────────

function scheduleBar(t0: number, barIdx: number, cfg: LevelConfig) {
  const beat = 60 / cfg.bpm;
  const bar  = beat * 4;
  const prog = barIdx % 4;

  // Bass
  const bassPat = cfg.bassPatterns[prog];
  for (let i = 0; i < 8; i++) {
    const f = bassPat[i];
    if (f > 0) note(f, t0 + i * beat * 0.5, beat * 0.44, 0.26, cfg.bassType, cfg.bassCutoff, 3.5, 600, 0.07);
  }

  // Chord pad
  for (const f of cfg.chordFreqs[prog]) {
    note(f, t0, bar * 0.96, 0.05, cfg.chordType, 900, 1.0, 150, 0.65);
  }

  // Melody (skip first bar of each 4-block)
  if (barIdx % 4 !== 0) {
    const mel = cfg.melody[prog];
    for (let i = 0; i < 16; i++) {
      const f = mel[i];
      if (f > 0) note(f, t0 + i * beat * 0.25, beat * 0.21, 0.11, cfg.melType, cfg.melCutoff, 2.2, 1400, 0.45);
    }
  }

  // Drums
  scheduleDrums(t0, barIdx, beat, cfg.drumPattern);
}

// ── Loop ──────────────────────────────────────────────────────────────────

function runLoop() {
  if (!isPlaying || !ctx || !masterGain) return;
  const cfg = LEVEL_CONFIGS[activeLevel];
  const beat = 60 / cfg.bpm;
  const bar  = beat * 4;
  const now = ctx.currentTime;

  scheduleBar(now + 0.1, currentBar, cfg);
  scheduleBar(now + 0.1 + bar, currentBar + 1, cfg);
  currentBar += 2;

  loopTimeout = setTimeout(runLoop, (bar * 2 - 0.15) * 1000);
}

// ── Shared output setup ────────────────────────────────────────────────────

function buildOutputChain(cfg: LevelConfig) {
  const ac = getCtx();

  masterGain = ac.createGain();
  masterGain.gain.value = 0;

  reverbNode = createReverb(ac, cfg.reverbSecs, 2.2);
  const rg = ac.createGain(); rg.gain.value = 0.2;
  reverbNode.connect(rg); rg.connect(masterGain);

  const beat = 60 / cfg.bpm;
  delayNode = createDelay(ac, beat * cfg.delayBeatFraction, 0.26);
  const dg = ac.createGain(); dg.gain.value = 0.12;
  delayNode.connect(dg); dg.connect(masterGain);

  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 10;
  comp.ratio.value = 4;      comp.attack.value = 0.003; comp.release.value = 0.25;
  masterGain.connect(comp); comp.connect(ac.destination);

  masterGain.gain.linearRampToValueAtTime(cfg.masterVol, ac.currentTime + 2.2);
}

// ── Public API ────────────────────────────────────────────────────────────

export function startMusicForLevel(levelIndex: number): void {
  // Stop any existing music first
  hardStop();

  activeLevel = Math.max(0, Math.min(levelIndex, LEVEL_CONFIGS.length - 1));
  currentBar  = 0;
  isPlaying   = true;

  buildOutputChain(LEVEL_CONFIGS[activeLevel]);
  runLoop();
}

export function stopMusic(): void {
  if (!isPlaying || !masterGain || !ctx) return;
  isPlaying = false;
  if (loopTimeout) { clearTimeout(loopTimeout); loopTimeout = null; }
  masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
}

function hardStop() {
  isPlaying = false;
  if (loopTimeout) { clearTimeout(loopTimeout); loopTimeout = null; }
  if (masterGain && ctx) {
    try { masterGain.gain.setValueAtTime(0, ctx.currentTime); } catch {}
    masterGain.disconnect();
  }
  if (reverbNode) { try { reverbNode.disconnect(); } catch {} }
  if (delayNode)  { try { delayNode.disconnect();  } catch {} }
  masterGain = null; reverbNode = null; delayNode = null;
}

export function toggleMusic(levelIndex = 0): boolean {
  if (isPlaying) { stopMusic(); return false; }
  startMusicForLevel(levelIndex);
  return true;
}

export function isMusicPlaying(): boolean {
  return isPlaying;
}
