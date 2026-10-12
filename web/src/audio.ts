// Microphone level metering. Audio never leaves the device.
const SAMPLE_MS = 50;
export type MicStatus = 'connecting' | 'listening' | 'interrupted' | 'unavailable';

export function micErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'NotAllowedError') {
    return 'Microphone access was denied. Allow access in your browser settings, then reconnect.';
  }
  return 'Microphone interrupted. Reconnect to continue automatic detection.';
}

export class Mic {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private timer: number | undefined;
  private stopped = false;
  private generation = 0;
  private onLevel: (db: number) => void = () => {};
  private onStatus: (status: MicStatus, error?: unknown) => void = () => {};
  private pending: Promise<void> | null = null;
  private removeListeners: (() => void) | null = null;

  async start(onLevel: (db: number) => void,
    onStatus: (status: MicStatus, error?: unknown) => void = () => {}): Promise<void> {
    this.onLevel = onLevel;
    this.onStatus = onStatus;
    const visibility = () => {
      if (document.visibilityState !== 'visible') {
        // Release capture deliberately: iOS may otherwise leave a live but silent stream.
        this.release();
        this.onStatus('interrupted');
      } else {
        resumeBeep();
        void this.reconnect();
      }
    };
    const hide = () => {
      this.release();
      this.onStatus('interrupted');
    };
    const show = () => { if (document.visibilityState === 'visible') visibility(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    this.removeListeners = () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
    };
    if (document.visibilityState === 'visible') await this.reconnect();
    else this.onStatus('interrupted');
  }

  reconnect(): Promise<void> {
    if (this.stopped || document.visibilityState !== 'visible') return Promise.resolve();
    if (this.pending) return this.pending;
    this.release();
    const generation = this.generation;
    this.onStatus('connecting');
    const current = () => !this.stopped && generation === this.generation;
    const operation = this.connect(current).catch((error: unknown) => {
      if (current()) {
        this.release();
        this.onStatus('unavailable', error);
      }
    });
    this.pending = operation;
    void operation.finally(() => { if (this.pending === operation) this.pending = null; });
    return operation;
  }

  private async connect(current: () => boolean): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone is not supported.');
    // Create/resume synchronously so a reconnect tap can unlock Web Audio.
    const ctx = new AudioContext();
    this.ctx = ctx;
    const resume = ctx.resume();
    void resume.catch(() => {});
    let timeout: number | undefined;
    const request = navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    // A dismissed/ignored permission prompt must not leave the reconnect control stuck.
    void request.then((stream) => {
      if (!current()) stream.getTracks().forEach((track) => track.stop());
    }, () => {});
    const stream = await Promise.race([
      request,
      new Promise<MediaStream>((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error('Microphone connection timed out.')), 10000);
      }),
    ]).finally(() => window.clearTimeout(timeout));
    if (!current()) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let lastTime = ctx.currentTime;
    let lastProgress = Date.now();
    let listening = false;
    let recovering = false;
    let mutedSince: number | null = null;
    const unavailable = () => {
      if (!current()) return;
      this.release();
      this.onStatus('unavailable');
    };
    const interrupted = () => {
      if (!current()) return;
      listening = false;
      this.onStatus('interrupted');
      if (!recovering && ctx.state !== 'closed') {
        recovering = true;
        void ctx.resume().catch(() => {});
      }
    };
    stream.getAudioTracks().forEach((track) => {
      track.onended = unavailable;
      track.onmute = interrupted;
    });
    ctx.onstatechange = () => { if (ctx.state !== 'running') interrupted(); };
    this.timer = window.setInterval(() => {
      if (!current() || document.visibilityState !== 'visible') return;
      const now = Date.now();
      const track = stream.getAudioTracks()[0];
      const progressing = ctx.currentTime > lastTime;
      if (progressing) lastProgress = now;
      lastTime = ctx.currentTime;
      mutedSince = track?.muted ? (mutedSince ?? now) : null;
      if (!track || track.readyState === 'ended') { unavailable(); return; }
      if (ctx.state !== 'running' || track.muted || !progressing) {
        if (listening) interrupted();
        if (now - lastProgress > 1500 || (mutedSince !== null && now - mutedSince > 1500)) unavailable();
        return;
      }
      if (!listening) {
        listening = true;
        recovering = false;
        this.onStatus('listening');
      }
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      this.onLevel(Math.max(-100, 20 * Math.log10(Math.sqrt(sum / buf.length) || 1e-5)));
    }, SAMPLE_MS);
  }

  private release(): void {
    this.generation++;
    this.pending = null;
    window.clearInterval(this.timer);
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.onmute = null;
      track.stop();
    });
    if (this.ctx) {
      this.ctx.onstatechange = null;
      void this.ctx.close().catch(() => {});
    }
    this.stream = null;
    this.ctx = null;
  }

  stop(): void {
    this.stopped = true;
    this.removeListeners?.();
    this.release();
  }
}

let beepCtx: AudioContext | null = null;

// Call from a user gesture so later alerts are allowed to play.
export function unlockBeep(): void {
  beepCtx ??= new AudioContext();
  resumeBeep();
}

export function resumeBeep(): void {
  if (beepCtx && beepCtx.state !== 'running' && beepCtx.state !== 'closed') {
    void beepCtx.resume().catch(() => {});
  }
}

export function beep(): void {
  resumeBeep();
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
