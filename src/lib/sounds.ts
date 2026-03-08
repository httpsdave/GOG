'use client';

class GameSounds {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private volume = 0.3;

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  isEnabled() { return this.enabled; }
  setEnabled(v: boolean) { this.enabled = v; }
  getVolume() { return this.volume; }
  setVolume(v: number) { this.volume = Math.max(0, Math.min(1, v)); }

  private playTone(freq: number, dur: number, type: OscillatorType = 'sine', vol?: number) {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.value = freq;
      const v = (vol ?? this.volume) * 0.15;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + dur + 0.01);
    } catch { /* audio not available */ }
  }

  private playNoise(dur: number, vol: number = 0.08) {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      const bufferSize = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      source.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(vol * this.volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      source.start(ctx.currentTime);
    } catch { /* audio not available */ }
  }

  select() {
    this.playTone(880, 0.06, 'sine');
  }

  move() {
    this.playTone(440, 0.08, 'triangle');
    setTimeout(() => this.playTone(580, 0.05, 'triangle'), 40);
  }

  capture() {
    this.playNoise(0.12, 0.12);
    setTimeout(() => {
      this.playTone(180, 0.2, 'sawtooth');
      this.playTone(140, 0.25, 'square', 0.12);
    }, 40);
  }

  arbiter() {
    this.playTone(220, 0.5, 'triangle', 0.2);
    setTimeout(() => this.playTone(330, 0.35, 'triangle', 0.15), 300);
  }

  victory() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.35, 'sine', 0.2), i * 180);
    });
  }

  defeat() {
    [350, 300, 250, 180].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.45, 'triangle', 0.18), i * 250);
    });
  }

  click() {
    this.playTone(1100, 0.03, 'sine', 0.08);
  }
}

let _sounds: GameSounds | null = null;

export function getSounds(): GameSounds {
  if (!_sounds) {
    _sounds = new GameSounds();
  }
  return _sounds;
}
