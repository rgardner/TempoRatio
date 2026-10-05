// Microphone level metering via Web Audio. Audio is analyzed in memory only;
// nothing is recorded, stored or transmitted.

const SAMPLE_MS = 50;

export class Mic {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private timer: number | undefined;
  private stopped = false;

  async start(onLevel: (db: number) => void): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone is not supported in this browser.');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    if (this.stopped) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    const ctx = new AudioContext();
    this.ctx = ctx;
    if (ctx.state === 'suspended') await ctx.resume();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    this.timer = window.setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      onLevel(Math.max(-100, 20 * Math.log10(rms || 1e-5)));
    }, SAMPLE_MS);
  }

  stop(): void {
    this.stopped = true;
    window.clearInterval(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.stream = null;
    this.ctx = null;
  }
}

let beepCtx: AudioContext | null = null;

// Call from a user gesture so later alerts are allowed to play.
export function unlockBeep(): void {
  beepCtx ??= new AudioContext();
  if (beepCtx.state === 'suspended') void beepCtx.resume();
}

export function beep(): void {
  const ctx = beepCtx;
  if (!ctx) return;
  [0, 0.18].forEach((offset) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + offset);
    osc.stop(ctx.currentTime + offset + 0.16);
  });
}

export function vibrate(): void {
  navigator.vibrate?.([200, 100, 200]);
}
