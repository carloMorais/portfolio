/**
 * The race's sound, synthesised with the Web Audio API (no audio files): an
 * engine hum that rises with your speed, the start lights' beeps, a whoosh
 * on nitro, a thud on a hit, a chirp on a pickup. Off by default — a
 * portfolio page that starts making noise on its own is a bad page — and
 * switched on by a button (a click is also what browsers need before they
 * let a page play sound).
 */
export class RaceSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOsc: OscillatorNode[] = [];
  private noise: AudioBuffer | null = null;
  enabled = false;

  /** Turns sound on or off. Must be called from a click or key press the first time. */
  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) {
      this.ensure();
      void this.ctx?.resume();
    } else {
      this.engine(0, false);
    }
  }

  /** Call on a user gesture (start, a key): browsers keep audio suspended until one. */
  wake() {
    if (this.enabled) void this.ctx?.resume();
  }

  private ensure() {
    if (this.ctx || typeof window === "undefined" || !window.AudioContext) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);

    // Engine: two detuned saws through a low-pass, near-silent until you move.
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    filter.connect(this.engineGain).connect(this.master);
    this.engineOsc = [0, 7].map((detune) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 55;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start();
      return osc;
    });

    // One second of white noise, reused by the whoosh and the thud.
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  private get live() {
    return this.enabled && this.ctx && this.master ? this.ctx : null;
  }

  /** Every frame: your speed (0–8) sets the engine's pitch; silent when not racing. */
  engine(speed: number, racing: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.engineGain) return;
    const t = ctx.currentTime;
    const on = this.enabled && racing;
    this.engineGain.gain.setTargetAtTime(on ? 0.03 + speed * 0.004 : 0, t, 0.08);
    for (const osc of this.engineOsc) osc.frequency.setTargetAtTime(48 + speed * 16, t, 0.06);
  }

  /** A start light: short and low; the last one (lights out) higher. */
  beep(high = false) {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = high ? 880 : 440;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (high ? 0.35 : 0.15));
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  /** Nitro: a rising whoosh of filtered noise. */
  whoosh() {
    const ctx = this.live;
    if (!ctx || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 1.2;
    band.frequency.setValueAtTime(400, t);
    band.frequency.exponentialRampToValueAtTime(2600, t + 0.5);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(band).connect(gain).connect(this.master!);
    src.start(t);
    src.stop(t + 0.75);
  }

  /** A hit (wall or obstacle), `strength` 0–1: a low thump with a little crunch. */
  thud(strength: number) {
    const ctx = this.live;
    if (!ctx || !this.noise) return;
    const t = ctx.currentTime;
    const level = 0.05 + 0.2 * Math.min(1, strength);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.2);

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 1200;
    const crunch = ctx.createGain();
    crunch.gain.setValueAtTime(level * 0.6, t);
    crunch.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    src.connect(low).connect(crunch).connect(this.master!);
    src.start(t);
    src.stop(t + 0.1);
  }

  /** Picking up a nitro: two quick rising notes. */
  chirp() {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    [660, 990].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      const at = t + i * 0.07;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.09, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
      osc.connect(gain).connect(this.master!);
      osc.start(at);
      osc.stop(at + 0.15);
    });
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
  }
}
