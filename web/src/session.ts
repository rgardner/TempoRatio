// Pure session state machine. All elapsed/remaining values are derived from
// timestamps (ms since epoch), never from accumulated ticks.

export type Phase = 'idle' | 'waiting' | 'playing' | 'resting' | 'ready' | 'paused';

export interface Ratio {
  play: number;
  rest: number;
}

export interface Interval {
  playMs: number;
  recommendedRestMs: number;
  actualRestMs: number | null;
}

export interface State {
  phase: Phase;
  sessionStartedAt: number;
  // Start of the playing interval, or of the rest period (kept through `ready`).
  phaseStartedAt: number;
  recommendedRestMs: number;
  pausedAt: number | null;
  pausedFrom: Phase | null;
  pausedTotalMs: number;
  intervals: Interval[];
}

export interface Summary {
  totalMs: number;
  playMs: number;
  restMs: number;
  intervals: Interval[];
  averagePlayMs: number;
}

export function create(): State {
  return {
    phase: 'idle',
    sessionStartedAt: 0,
    phaseStartedAt: 0,
    recommendedRestMs: 0,
    pausedAt: null,
    pausedFrom: null,
    pausedTotalMs: 0,
    intervals: [],
  };
}

export function isActive(s: State): boolean {
  return s.phase !== 'idle';
}

export function restFor(playMs: number, ratio: Ratio): number {
  return Math.round((playMs * ratio.rest) / ratio.play);
}

export function start(now: number): State {
  return { ...create(), phase: 'waiting', sessionStartedAt: now, phaseStartedAt: now };
}

function closeRest(s: State, now: number): Interval[] {
  if (s.phase !== 'resting' && s.phase !== 'ready') return s.intervals;
  const last = s.intervals[s.intervals.length - 1];
  if (!last || last.actualRestMs !== null) return s.intervals;
  return [...s.intervals.slice(0, -1), { ...last, actualRestMs: Math.max(0, now - s.phaseStartedAt) }];
}

// Starts a practice interval (from waiting, resting or ready). `at` may be
// backdated to the detected sound onset.
export function beginPlaying(s: State, at: number): State {
  if (s.phase !== 'waiting' && s.phase !== 'resting' && s.phase !== 'ready') return s;
  return { ...s, intervals: closeRest(s, at), phase: 'playing', phaseStartedAt: at, recommendedRestMs: 0 };
}

// Ends the practice interval at `at` (the last moment of sound) and starts rest.
export function endPlaying(s: State, at: number, ratio: Ratio): State {
  if (s.phase !== 'playing') return s;
  const playMs = Math.max(0, at - s.phaseStartedAt);
  const recommendedRestMs = restFor(playMs, ratio);
  return {
    ...s,
    phase: 'resting',
    phaseStartedAt: at,
    recommendedRestMs,
    intervals: [...s.intervals, { playMs, recommendedRestMs, actualRestMs: null }],
  };
}

export function advance(s: State, now: number): State {
  if (s.phase === 'resting' && now - s.phaseStartedAt >= s.recommendedRestMs) {
    return { ...s, phase: 'ready' };
  }
  return s;
}

export function pause(s: State, now: number): State {
  if (!isActive(s) || s.phase === 'paused') return s;
  return { ...s, phase: 'paused', pausedFrom: s.phase, pausedAt: now };
}

// Shifts timestamps forward so paused time is excluded from every timer.
export function resume(s: State, now: number): State {
  if (s.phase !== 'paused' || s.pausedAt === null || s.pausedFrom === null) return s;
  const gap = now - s.pausedAt;
  return {
    ...s,
    phase: s.pausedFrom,
    phaseStartedAt: s.phaseStartedAt + gap,
    pausedTotalMs: s.pausedTotalMs + gap,
    pausedAt: null,
    pausedFrom: null,
  };
}

function clock(s: State, now: number): number {
  return s.pausedAt ?? now;
}

export function playingMs(s: State, now: number): number {
  return Math.max(0, clock(s, now) - s.phaseStartedAt);
}

export function restElapsedMs(s: State, now: number): number {
  return Math.max(0, clock(s, now) - s.phaseStartedAt);
}

export function restRemainingMs(s: State, now: number): number {
  return Math.max(0, s.recommendedRestMs - restElapsedMs(s, now));
}

export function summarize(s: State, now: number): Summary {
  const t = clock(s, now);
  let intervals = s.intervals;
  const phase = s.phase === 'paused' ? s.pausedFrom : s.phase;
  if (phase === 'resting' || phase === 'ready') {
    intervals = closeRest({ ...s, phase }, t);
  }
  let playMs = intervals.reduce((a, i) => a + i.playMs, 0);
  if (phase === 'playing') {
    const current = Math.max(0, t - s.phaseStartedAt);
    playMs += current;
    intervals = [...intervals, { playMs: current, recommendedRestMs: 0, actualRestMs: null }];
  }
  const restMs = intervals.reduce((a, i) => a + (i.actualRestMs ?? 0), 0);
  return {
    totalMs: Math.max(0, t - s.sessionStartedAt - s.pausedTotalMs),
    playMs,
    restMs,
    intervals,
    averagePlayMs: intervals.length ? playMs / intervals.length : 0,
  };
}
