// Dawn Courier — sound, made only with the Web Audio API.
// No audio files: the engine is oscillators through a filter, the ring chime
// is a short two-note sine, and landings and crashes are low thuds. Everything
// starts on the first user gesture, so the browser's autoplay rules are happy.

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineGain = null;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.windGain = null;
    this.windSource = null;
    this.started = false;
  }

  // Call from a user gesture (Enter, click). Safe to call more than once.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this._buildEngine();
    this._buildWind();
    this.started = true;
  }

  _buildEngine() {
    const ctx = this.ctx;
    // A sawtooth for the prop buzz and a sine an octave down for body.
    this.engineOsc1 = ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 55;
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'sine';
    this.engineOsc2.frequency.value = 28;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineFilter.Q.value = 0.8;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(ctx.destination);
    this.engineOsc1.start();
    this.engineOsc2.start();
  }

  _buildWind() {
    const ctx = this.ctx;
    // Looping filtered noise for the slipstream; its gain follows airspeed.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.windSource = ctx.createBufferSource();
    this.windSource.buffer = buf;
    this.windSource.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 900;
    band.Q.value = 0.4;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.0;
    this.windSource.connect(band);
    band.connect(this.windGain);
    this.windGain.connect(ctx.destination);
    this.windSource.start();
  }

  // Call every frame: throttle 0..1, speed in m/s, flying true when airborne.
  update(throttle, speed, flying) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const on = flying || throttle > 0.03;
    const target = on ? 0.045 + throttle * 0.075 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.12);
    const f = 52 + throttle * 95;
    this.engineOsc1.frequency.setTargetAtTime(f, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(320 + throttle * 900, t, 0.1);
    const wind = flying ? Math.min(0.09, speed * 0.0011) : 0.0;
    this.windGain.gain.setTargetAtTime(wind, t, 0.2);
  }

  setMuted(m) {
    this.muted = m;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.engineGain) this.engineGain.gain.setTargetAtTime(m ? 0 : 0.06, t, 0.05);
    if (this.windGain) this.windGain.gain.setTargetAtTime(0, t, 0.05);
  }

  // A master volume for the whole game (0 silent to 1 full). The engine and
  // wind gains are relative to it, so it scales everything at once.
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(this.volume * 0.06, t, 0.05);
  }

  // A bright two-note chime when a ring is flown through. Silent when the
  // context is suspended (no gesture yet) so it never throws.
  chime() {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const notes = [880, 1318.5];
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const g = ctx.createGain();
      const start = t + i * 0.09;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(start);
      o.stop(start + 0.55);
    });
  }

  // A low thud for a gentle touchdown.
  thud(strength = 1) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35 * strength, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.4);
  }

  // A heavier crunch for a crash: a low burst plus a short noise hit.
  crash() {
    if (!this.ctx || this.muted) return;
    this.thud(1.6);
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const len = ctx.sampleRate * 0.25;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    src.connect(f);
    f.connect(g);
    g.connect(ctx.destination);
    src.start(t);
  }

  // A soft rising arpeggio for finishing the course.
  fanfare() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const g = ctx.createGain();
      const start = t + i * 0.12;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.18, start + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(start);
      o.stop(start + 0.65);
    });
  }

  // A short low-fuel warning beep. Call it at most once every few seconds.
  fuelWarning() {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [660, 660].forEach((freq, i) => {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = freq;
      const g = ctx.createGain();
      const start = t + i * 0.16;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.07, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(start);
      o.stop(start + 0.14);
    });
  }

  // The cargo going away: a short whoosh as the crate drops.
  drop() {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const len = ctx.sampleRate * 0.3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.3);
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    src.connect(f);
    f.connect(g);
    g.connect(ctx.destination);
    src.start(t);
  }

  // A warm two-note chime when the hiker is picked up.
  pickup() {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [659.25, 987.77].forEach((freq, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const g = ctx.createGain();
      const start = t + i * 0.11;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(start);
      o.stop(start + 0.6);
    });
  }
}
