import * as vitest from 'vitest';
import * as detector from './detector';
import * as session from './session';

const { describe, expect, it } = vitest;

const ratio = { play: 1, rest: 1 };

describe('session', () => {
  it('rests for the backdated playing duration (1:1)', () => {
    let s = session.start(0);
    s = session.beginPlaying(s, 1000);
    s = session.endPlaying(s, 49000, ratio);
    expect(s.phase).toBe('resting');
    expect(s.recommendedRestMs).toBe(48000);
    expect(session.restRemainingMs(s, 49000 + 3000)).toBe(45000);
  });

  it('applies ratios', () => {
    expect(session.restFor(30000, { play: 2, rest: 1 })).toBe(15000);
    expect(session.restFor(30000, { play: 1, rest: 2 })).toBe(60000);
  });

  it('becomes ready, then records actual rest on resume of playing', () => {
    let s = session.beginPlaying(session.start(0), 0);
    s = session.endPlaying(s, 10000, ratio);
    s = session.advance(s, 15000);
    expect(s.phase).toBe('resting');
    s = session.advance(s, 20000);
    expect(s.phase).toBe('ready');
    s = session.beginPlaying(s, 25000);
    expect(s.intervals[0].actualRestMs).toBe(15000);
  });

  it('records early rest termination', () => {
    let s = session.beginPlaying(session.start(0), 0);
    s = session.endPlaying(s, 45000, ratio);
    s = session.beginPlaying(s, 73000);
    expect(s.phase).toBe('playing');
    expect(s.intervals[0]).toEqual({ playMs: 45000, recommendedRestMs: 45000, actualRestMs: 28000 });
  });

  it('excludes paused time', () => {
    let s = session.beginPlaying(session.start(0), 0);
    s = session.pause(s, 10000);
    expect(session.playingMs(s, 99999)).toBe(10000);
    s = session.resume(s, 70000);
    expect(session.playingMs(s, 75000)).toBe(15000);
    expect(session.summarize(s, 75000).totalMs).toBe(15000);
  });

  it('summarizes an in-progress session', () => {
    let s = session.beginPlaying(session.start(0), 0);
    s = session.endPlaying(s, 20000, ratio);
    s = session.beginPlaying(s, 30000);
    const sum = session.summarize(s, 40000);
    expect(sum.playMs).toBe(30000);
    expect(sum.restMs).toBe(10000);
    expect(sum.intervals).toHaveLength(2);
  });
});

describe('detector', () => {
  const cfg = { onDb: -40, hysteresisDb: 4, startMs: 200, endMs: 2500 };
  const feed = (d: detector.Detector, from: number, to: number, db: number) => {
    const events: detector.Event[] = [];
    for (let t = from; t <= to; t += 50) {
      const e = d.update(db, t);
      if (e) events.push(e);
    }
    return events;
  };

  it('ignores brief transients', () => {
    const d = new detector.Detector(cfg);
    expect(feed(d, 0, 100, -20)).toEqual([]);
    expect(feed(d, 150, 3000, -80)).toEqual([]);
  });

  it('bridges breaths and ends at last sound', () => {
    const d = new detector.Detector(cfg);
    expect(feed(d, 0, 300, -20)).toEqual([{ type: 'start', at: 0 }]);
    expect(feed(d, 350, 1800, -80)).toEqual([]);
    expect(feed(d, 1850, 5000, -20)).toEqual([]);
    const ev = feed(d, 5050, 8000, -80);
    expect(ev).toEqual([{ type: 'end', at: 5000 }]);
  });

  it('uses hysteresis to stay playing just below the on threshold', () => {
    const d = new detector.Detector(cfg);
    feed(d, 0, 300, -20);
    expect(feed(d, 350, 6000, -42)).toEqual([]);
  });

  it('derives calibration', () => {
    const cal = detector.deriveCalibration(Array(20).fill(-60), Array(20).fill(-30));
    expect(cal).toEqual({ noiseDb: -60, playDb: -30 });
    expect(detector.deriveCalibration(Array(20).fill(-60), Array(20).fill(-59))).toBeNull();
    expect(detector.thresholdDb(cal!, 50)).toBeCloseTo(-45);
  });
});
