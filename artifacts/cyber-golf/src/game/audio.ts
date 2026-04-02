// Música cyberpunk generativa con Web Audio API
// Bajo + melodía + acordes + batería + reverb + delay

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let reverbNode: ConvolverNode | null = null;
let delayNode: DelayNode | null = null;
let isPlaying = false;
let loopTimeout: ReturnType<typeof setTimeout> | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

// Reverb sintético con impulse response
function createReverb(ac: AudioContext, seconds = 2.0, decay = 2.0): ConvolverNode {
  const conv = ac.createConvolver();
  const rate = ac.sampleRate;
  const len = rate * seconds;
  const buf = ac.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  conv.buffer = buf;
  return conv;
}

// Delay tipo eco
function createDelay(ac: AudioContext, time = 0.375, feedback = 0.3): DelayNode {
  const delay = ac.createDelay(2.0);
  delay.delayTime.value = time;
  const fb = ac.createGain();
  fb.gain.value = feedback;
  delay.connect(fb);
  fb.connect(delay);
  return delay;
}

function connectToOutput(node: AudioNode, wet = 0.3) {
  const ac = getCtx();
  // Dry
  node.connect(masterGain!);
  // Reverb
  if (reverbNode) {
    const reverbGain = ac.createGain();
    reverbGain.gain.value = wet;
    node.connect(reverbGain);
    reverbGain.connect(reverbNode);
  }
  // Delay
  if (delayNode) {
    const delayGain = ac.createGain();
    delayGain.gain.value = wet * 0.5;
    node.connect(delayGain);
    delayGain.connect(delayNode);
  }
}

function note(
  freq: number, start: number, dur: number,
  vol: number, type: OscillatorType = 'sawtooth',
  cutoff = 1200, resonance = 1.5,
  filterEnvAmt = 0, wetness = 0.25
) {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const osc2 = ac.createOscillator(); // detuned unison
  const gainNode = ac.createGain();
  const filter = ac.createBiquadFilter();

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoff, start);
  filter.frequency.linearRampToValueAtTime(cutoff + filterEnvAmt, start + 0.02);
  filter.frequency.exponentialRampToValueAtTime(Math.max(100, cutoff * 0.4), start + dur * 0.8);
  filter.Q.value = resonance;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  osc2.type = type;
  osc2.frequency.setValueAtTime(freq * 1.003, start); // slight detune for chorus

  gainNode.gain.setValueAtTime(0.001, start);
  gainNode.gain.linearRampToValueAtTime(vol, start + 0.01);
  gainNode.gain.setValueAtTime(vol, start + dur - 0.06);
  gainNode.gain.linearRampToValueAtTime(0.001, start + dur);

  osc.connect(filter);
  osc2.connect(filter);
  filter.connect(gainNode);
  connectToOutput(gainNode, wetness);

  osc.start(start); osc.stop(start + dur + 0.05);
  osc2.start(start); osc2.stop(start + dur + 0.05);
}

function kick(t: number, vol = 0.8) {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.15);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc.connect(gain); gain.connect(masterGain!);
  osc.start(t); osc.stop(t + 0.3);
}

function snare(t: number, vol = 0.4) {
  const ac = getCtx();
  // Tonal body
  const osc = ac.createOscillator();
  const oscGain = ac.createGain();
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(160, t + 0.05);
  oscGain.gain.setValueAtTime(vol * 0.5, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  osc.connect(oscGain); oscGain.connect(masterGain!);
  osc.start(t); osc.stop(t + 0.1);

  // Noise snap
  const bufSize = ac.sampleRate * 0.12;
  const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass'; filter.frequency.value = 3500; filter.Q.value = 0.8;
  const nGain = ac.createGain();
  nGain.gain.setValueAtTime(vol, t);
  nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(filter); filter.connect(nGain); nGain.connect(masterGain!);
  src.start(t); src.stop(t + 0.15);
}

function hihat(t: number, vol = 0.15, open = false) {
  const ac = getCtx();
  const dur = open ? 0.3 : 0.06;
  const bufSize = ac.sampleRate * dur;
  const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'highpass'; filter.frequency.value = 8000;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter); filter.connect(g); g.connect(masterGain!);
  src.start(t); src.stop(t + dur + 0.01);
}

// Escala menor: A2=110 -> A3=220
const BASS_ROOT = 55; // A1
// Progresión: i - VI - III - VII  (Am - F - C - G en A menor)
const BASS_PROG = [
  [55, 55, 55, 55, 82.41, 82.41, 73.42, 73.42],    // i  (A)
  [43.65, 43.65, 65.41, 65.41, 65.41, 65.41, 55, 55], // VI (F)
  [32.70, 32.70, 65.41, 65.41, 82.41, 82.41, 65.41, 65.41], // III (C)
  [48.99, 48.99, 73.42, 73.42, 73.42, 73.42, 65.41, 65.41], // VII (G)
];

// Arpeggio melódico (octava más alta)
const MELODY = [
  [440, 0, 523.25, 0, 587.33, 0, 659.26, 0, 587.33, 0, 523.25, 0, 440, 0, 392, 0],
  [349.23, 0, 392, 0, 440, 0, 523.25, 0, 440, 0, 392, 0, 349.23, 0, 330, 0],
  [261.63, 0, 329.63, 0, 392, 0, 440, 0, 523.25, 0, 440, 0, 392, 0, 329.63, 0],
  [293.66, 0, 349.23, 0, 392, 0, 440, 0, 392, 0, 349.23, 0, 329.63, 0, 293.66, 0],
];

const BPM = 120;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;

function scheduleBar(startTime: number, barIndex: number) {
  const progIdx = barIndex % 4;
  const bassNotes = BASS_PROG[progIdx];
  const melNotes = MELODY[progIdx];

  // --- BAJO (sawtooth, filtro bajo, resonante) ---
  for (let i = 0; i < 8; i++) {
    const t = startTime + i * BEAT * 0.5;
    const freq = bassNotes[i];
    if (freq > 0) {
      note(freq, t, BEAT * 0.45, 0.28, 'sawtooth', 400, 3.0, 600, 0.08);
    }
  }

  // --- ACORDES (pad atmosférico, octava media) ---
  const chordFreqs = [
    [220, 261.63, 329.63],   // Am
    [174.61, 220, 261.63],   // F
    [130.81, 164.81, 196],   // C
    [196, 246.94, 293.66],   // G
  ][progIdx];

  for (const f of chordFreqs) {
    note(f, startTime, BAR * 0.95, 0.055, 'triangle', 900, 1.0, 200, 0.6);
  }

  // --- MELODÍA (arpeggio synth) - solo en bares 2,3,4 de cada 4 ---
  if (barIndex % 4 !== 0) {
    for (let i = 0; i < 16; i++) {
      const t = startTime + i * BEAT * 0.25;
      const f = melNotes[i];
      if (f > 0) {
        note(f, t, BEAT * 0.22, 0.12, 'square', 2200, 2.0, 1200, 0.45);
      }
    }
  }

  // --- BATERÍA ---
  for (let b = 0; b < 8; b++) {
    const t = startTime + b * BEAT * 0.5;
    // Kick: beats 1 y 3, y variación en beat 4.75
    if (b === 0 || b === 4) kick(t, 0.85);
    if (b === 7 && barIndex % 2 === 1) kick(t + BEAT * 0.375, 0.5); // ghost kick

    // Snare: beats 2 y 4
    if (b === 2 || b === 6) snare(t, 0.45);

    // Hi-hat cerrado cada corchea
    hihat(t, 0.18);
    // Hi-hat semi-abierto en contratiempos del compás 4 del bloque
    if (barIndex % 4 === 3 && (b === 1 || b === 3 || b === 5)) {
      hihat(t, 0.12, true);
    }
  }
  // hi-hat en semicorcheas para el último compás de cada bloque
  if (barIndex % 4 === 3) {
    for (let s = 0; s < 16; s++) {
      hihat(startTime + s * BEAT * 0.25, 0.07);
    }
  }
}

let currentBar = 0;

function runLoop() {
  if (!isPlaying || !ctx || !masterGain) return;
  const now = ctx.currentTime;
  // Schedule 2 bars at a time to avoid gaps
  scheduleBar(now + 0.1, currentBar);
  scheduleBar(now + 0.1 + BAR, currentBar + 1);
  currentBar += 2;

  const nextSchedule = BAR * 2 - 0.15;
  loopTimeout = setTimeout(runLoop, nextSchedule * 1000);
}

export function startMusic(): void {
  if (isPlaying) return;
  const ac = getCtx();

  masterGain = ac.createGain();
  masterGain.gain.value = 0;

  // Reverb
  reverbNode = createReverb(ac, 2.5, 2.5);
  const reverbGain = ac.createGain();
  reverbGain.gain.value = 0.22;
  reverbNode.connect(reverbGain);
  reverbGain.connect(masterGain);

  // Delay
  delayNode = createDelay(ac, 60 / BPM * 0.75, 0.28);
  const delayOutGain = ac.createGain();
  delayOutGain.gain.value = 0.15;
  delayNode.connect(delayOutGain);
  delayOutGain.connect(masterGain);

  // Compresor suave para que todo quede en rango
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 10;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  masterGain.connect(comp);
  comp.connect(ac.destination);

  // Fade in suave
  masterGain.gain.linearRampToValueAtTime(0.55, ac.currentTime + 2.0);

  currentBar = 0;
  isPlaying = true;
  runLoop();
}

export function stopMusic(): void {
  if (!isPlaying || !masterGain || !ctx) return;
  isPlaying = false;
  if (loopTimeout) { clearTimeout(loopTimeout); loopTimeout = null; }
  masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
}

export function toggleMusic(): boolean {
  if (isPlaying) { stopMusic(); return false; }
  startMusic(); return true;
}

export function isMusicPlaying(): boolean {
  return isPlaying;
}
