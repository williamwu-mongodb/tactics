let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let currentMusic: { stop: () => void } | null = null;
let muted = false;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.4;
    masterGain.connect(audioCtx.destination);

    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.3;
    musicGain.connect(masterGain);

    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = 0.5;
    sfxGain.connect(masterGain);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function initAudio(): void {
  getCtx();
}

export function toggleMute(): boolean {
  muted = !muted;
  if (masterGain) {
    masterGain.gain.value = muted ? 0 : 0.4;
  }
  return muted;
}

export function isMuted(): boolean {
  return muted;
}

function playNote(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  type: OscillatorType,
  startTime: number,
  duration: number,
  volume: number = 0.3,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// Chiptune melody notes (C major pentatonic-ish)
const PLAYER_MELODY = [
  262, 294, 330, 392, 440, 392, 330, 294,
  330, 392, 440, 524, 440, 392, 330, 262,
  294, 330, 392, 440, 524, 440, 392, 330,
  262, 294, 330, 262, 220, 262, 294, 330,
];

const ENEMY_MELODY = [
  196, 220, 262, 220, 196, 175, 196, 220,
  262, 294, 262, 220, 196, 175, 165, 175,
  196, 220, 262, 294, 330, 294, 262, 220,
  196, 175, 165, 175, 196, 220, 196, 175,
];

const BASS_PATTERN_PLAYER = [131, 131, 165, 165, 175, 175, 131, 131];
const BASS_PATTERN_ENEMY  = [98, 98, 110, 110, 131, 131, 98, 98];

export function playMusic(variant: 'player' | 'enemy'): void {
  stopMusic();
  const ctx = getCtx();
  if (!musicGain) return;

  const melody = variant === 'player' ? PLAYER_MELODY : ENEMY_MELODY;
  const bass = variant === 'player' ? BASS_PATTERN_PLAYER : BASS_PATTERN_ENEMY;
  const noteLen = 0.2;
  const loopLen = melody.length * noteLen;

  let running = true;
  let nextStart = ctx.currentTime + 0.1;

  function scheduleLoop() {
    if (!running || !musicGain) return;

    for (let i = 0; i < melody.length; i++) {
      const t = nextStart + i * noteLen;
      playNote(ctx, musicGain, melody[i], 'square', t, noteLen * 0.8, 0.15);
      // Harmony (fifth above, quieter)
      playNote(ctx, musicGain, melody[i] * 1.5, 'triangle', t, noteLen * 0.6, 0.06);
    }
    // Bass line
    for (let i = 0; i < bass.length; i++) {
      const t = nextStart + i * (loopLen / bass.length);
      playNote(ctx, musicGain, bass[i], 'triangle', t, loopLen / bass.length * 0.9, 0.12);
    }

    nextStart += loopLen;
    setTimeout(scheduleLoop, (loopLen - 0.5) * 1000);
  }

  scheduleLoop();

  currentMusic = {
    stop: () => { running = false; },
  };
}

export function stopMusic(): void {
  if (currentMusic) {
    currentMusic.stop();
    currentMusic = null;
  }
}

export function playSFX(type: 'move' | 'attack' | 'destroy' | 'select' | 'turnChange'): void {
  const ctx = getCtx();
  if (!sfxGain) return;
  const now = ctx.currentTime;

  switch (type) {
    case 'move':
      playNote(ctx, sfxGain, 440, 'square', now, 0.08, 0.2);
      playNote(ctx, sfxGain, 550, 'square', now + 0.06, 0.08, 0.2);
      break;
    case 'select':
      playNote(ctx, sfxGain, 660, 'square', now, 0.06, 0.15);
      playNote(ctx, sfxGain, 880, 'square', now + 0.05, 0.08, 0.15);
      break;
    case 'attack': {
      // Noise burst + low tone
      const bufSize = ctx.sampleRate * 0.15;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufSize);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.3;
      noise.connect(noiseGain);
      noiseGain.connect(sfxGain);
      noise.start(now);
      playNote(ctx, sfxGain, 110, 'sawtooth', now, 0.2, 0.25);
      playNote(ctx, sfxGain, 90, 'sawtooth', now + 0.1, 0.15, 0.2);
      break;
    }
    case 'destroy':
      playNote(ctx, sfxGain, 440, 'sawtooth', now, 0.1, 0.3);
      playNote(ctx, sfxGain, 330, 'sawtooth', now + 0.08, 0.1, 0.25);
      playNote(ctx, sfxGain, 220, 'sawtooth', now + 0.16, 0.15, 0.2);
      playNote(ctx, sfxGain, 110, 'sawtooth', now + 0.25, 0.3, 0.15);
      break;
    case 'turnChange':
      playNote(ctx, sfxGain, 524, 'square', now, 0.12, 0.2);
      playNote(ctx, sfxGain, 660, 'square', now + 0.1, 0.12, 0.2);
      playNote(ctx, sfxGain, 786, 'square', now + 0.2, 0.2, 0.25);
      break;
  }
}
