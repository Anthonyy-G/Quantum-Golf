// Generador de música ambiental cyberpunk usando Web Audio API
// No necesita archivos externos - todo se genera en tiempo real

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let isPlaying = false;
let stopCallbacks: Array<() => void> = [];

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function playNote(
  frequency: number,
  startTime: number,
  duration: number,
  gain: number,
  type: OscillatorType = 'sawtooth',
  filterFreq = 800
) {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gainNode = ac.createGain();
  const filter = ac.createBiquadFilter();

  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = 2.0;

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.05);
  gainNode.gain.setValueAtTime(gain, startTime + duration - 0.05);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(masterGain!);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playDrum(frequency: number, startTime: number, gainVal: number, duration = 0.15) {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gainNode = ac.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, startTime);
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.3, startTime + duration);

  gainNode.gain.setValueAtTime(gainVal, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gainNode);
  gainNode.connect(masterGain!);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

function playNoise(startTime: number, gainVal: number, duration = 0.05) {
  const ac = getCtx();
  const bufferSize = ac.sampleRate * duration;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const source = ac.createBufferSource();
  source.buffer = buffer;

  const filter = ac.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 4000;

  const gainNode = ac.createGain();
  gainNode.gain.setValueAtTime(gainVal, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(masterGain!);

  source.start(startTime);
  source.stop(startTime + duration + 0.01);
}

// Secuencia de notas (escala menor de Do)
const BASS_NOTES = [65.41, 73.42, 82.41, 87.31, 98.00, 82.41, 73.42, 65.41];
const PAD_NOTES  = [130.81, 155.56, 196.00, 174.61];

function scheduleLoop(startTime: number, bpm = 120): number {
  const ac = getCtx();
  const beat = 60 / bpm;
  const bar = beat * 4;
  const loopEnd = startTime + bar * 2; // 2 compases por loop

  // --- BAJO PULSANTE ---
  BASS_NOTES.forEach((freq, i) => {
    playNote(freq, startTime + i * beat * 0.5, beat * 0.4, 0.25, 'sawtooth', 300);
  });

  // --- PAD AMBIENTE ---
  PAD_NOTES.forEach((freq, i) => {
    playNote(freq, startTime + i * bar * 0.25, bar * 0.3, 0.08, 'sine', 600);
    playNote(freq * 1.5, startTime + i * bar * 0.25, bar * 0.3, 0.05, 'triangle', 800);
  });

  // --- BATERÍA ---
  for (let b = 0; b < 8; b++) {
    const t = startTime + b * beat * 0.5;
    // Kick en tiempos 1 y 3
    if (b % 4 === 0) playDrum(80, t, 0.5, 0.3);
    // Snare en tiempos 2 y 4
    if (b % 4 === 2) {
      playDrum(200, t, 0.3, 0.08);
      playNoise(t, 0.25, 0.12);
    }
    // Hi-hat cada corchea
    playNoise(t, 0.06, 0.03);
  }

  // Acento final de hi-hat
  playNoise(startTime + beat * 3.75, 0.1, 0.04);

  return loopEnd;
}

let loopTimeout: ReturnType<typeof setTimeout> | null = null;

function runLoop() {
  if (!isPlaying || !ctx || !masterGain) return;
  const now = ctx.currentTime;
  const nextLoopEnd = scheduleLoop(now + 0.05, 118);
  const delay = (nextLoopEnd - now - 0.1) * 1000;
  loopTimeout = setTimeout(runLoop, Math.max(100, delay));
}

export function startMusic(): void {
  if (isPlaying) return;
  const ac = getCtx();

  masterGain = ac.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(ac.destination);

  // Fade in
  masterGain.gain.linearRampToValueAtTime(0.6, ac.currentTime + 1.5);

  isPlaying = true;
  runLoop();
}

export function stopMusic(): void {
  if (!isPlaying || !masterGain || !ctx) return;
  isPlaying = false;

  if (loopTimeout) {
    clearTimeout(loopTimeout);
    loopTimeout = null;
  }

  // Fade out
  masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
}

export function toggleMusic(): boolean {
  if (isPlaying) {
    stopMusic();
    return false;
  } else {
    startMusic();
    return true;
  }
}

export function isMusicPlaying(): boolean {
  return isPlaying;
}
