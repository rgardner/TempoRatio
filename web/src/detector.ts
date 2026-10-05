// Threshold + hysteresis + debounce detector over a stream of dBFS levels.

export interface Config {
  onDb: number;
  hysteresisDb: number;
  startMs: number;
  endMs: number;
}

export type Event = { type: 'start'; at: number } | { type: 'end'; at: number };

export const DEFAULT_START_MS = 200;
export const DEFAULT_END_MS = 2500;
export const DEFAULT_HYSTERESIS_DB = 4;

export class Detector {
  private playing = false;
  private soundSince: number | null = null;
  private lastSound = 0;

  constructor(public config: Config) {}

  isPlaying(): boolean {
    return this.playing;
  }

  // Treat the instrument as already playing (manual start) so silence ends it.
  forcePlaying(now: number): void {
    this.playing = true;
    this.lastSound = now;
    this.soundSince = null;
  }

  reset(): void {
    this.playing = false;
    this.soundSince = null;
  }

  update(db: number, now: number): Event | null {
    const c = this.config;
    if (!this.playing) {
      if (db < c.onDb) {
        this.soundSince = null;
        return null;
      }
      this.soundSince ??= now;
      if (now - this.soundSince >= c.startMs) {
        this.playing = true;
        this.lastSound = now;
        return { type: 'start', at: this.soundSince };
      }
      return null;
    }
    if (db >= c.onDb - c.hysteresisDb) {
      this.lastSound = now;
      return null;
    }
    if (now - this.lastSound >= c.endMs) {
      this.playing = false;
      this.soundSince = null;
      return { type: 'end', at: this.lastSound };
    }
    return null;
  }
}

export interface Calibration {
  noiseDb: number;
  playDb: number;
}

export const DEFAULT_CALIBRATION: Calibration = { noiseDb: -60, playDb: -30 };

// Sensitivity 0..100: higher means a lower threshold between noise and playing level.
export function thresholdDb(cal: Calibration, sensitivity: number): number {
  const frac = 0.8 - 0.006 * Math.min(100, Math.max(0, sensitivity));
  return cal.noiseDb + (cal.playDb - cal.noiseDb) * frac;
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return -100;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

export function deriveCalibration(noise: number[], play: number[]): Calibration | null {
  const noiseDb = percentile(noise, 0.9);
  const loud = play.filter((v) => v > noiseDb + 6);
  if (loud.length < 5) return null;
  return { noiseDb, playDb: percentile(loud, 0.5) };
}
