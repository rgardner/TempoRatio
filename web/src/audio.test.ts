import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Mic, micErrorMessage } from './audio';

class Track {
  readyState = 'live';
  muted = false;
  onended: (() => void) | null = null;
  onmute: (() => void) | null = null;
  stop = vi.fn(() => { this.readyState = 'ended'; });
}
class Context {
  static instances: Context[] = [];
  state = 'running';
  stalled = false;
  onstatechange: (() => void) | null = null;
  get currentTime() { return this.stalled ? 0 : Date.now() / 1000; }
  constructor() { Context.instances.push(this); }
  resume = vi.fn(async () => { this.state = 'running'; });
  close = vi.fn(async () => { this.state = 'closed'; });
  createAnalyser() {
    return { fftSize: 2048, getFloatTimeDomainData: (buf: Float32Array) => buf.fill(0.1) };
  }
  createMediaStreamSource() { return { connect: vi.fn() }; }
}

describe('microphone lifecycle', () => {
  let doc: EventTarget & { visibilityState: string };
  let tracks: Track[];
  let request: ReturnType<typeof vi.fn>;
  let mic: Mic;
  const stream = (track: Track) => ({ getTracks: () => [track], getAudioTracks: () => [track] });
  const visibility = async (state: string) => {
    doc.visibilityState = state;
    doc.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(100);
  };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10000);
    tracks = [];
    Context.instances = [];
    doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    request = vi.fn(async () => {
      const track = new Track();
      tracks.push(track);
      return stream(track);
    });
    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', Object.assign(new EventTarget(), {
      setInterval, clearInterval, setTimeout, clearTimeout,
    }));
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: request } });
    vi.stubGlobal('AudioContext', Context);
    mic = new Mic();
  });
  afterEach(() => { mic.stop(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('reacquires capture on return and never feeds hidden samples', async () => {
    const level = vi.fn();
    const status = vi.fn();
    await mic.start(level, status);
    await vi.advanceTimersByTimeAsync(100);
    expect(status).toHaveBeenLastCalledWith('listening');
    expect(level).toHaveBeenCalled();
    await visibility('hidden');
    const count = level.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(level).toHaveBeenCalledTimes(count);
    expect(tracks[0].stop).toHaveBeenCalled();
    await visibility('visible');
    expect(request).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenLastCalledWith('listening');
  });

  it('detects a running but stalled graph and supports a reconnect tap', async () => {
    const status = vi.fn();
    await mic.start(vi.fn(), status);
    Context.instances[0].stalled = true;
    await vi.advanceTimersByTimeAsync(2000);
    expect(status).toHaveBeenLastCalledWith('unavailable');
    await mic.reconnect();
    await vi.advanceTimersByTimeAsync(100);
    expect(status).toHaveBeenLastCalledWith('listening');
  });

  it('discards a late permission result after hiding without affecting the new capture', async () => {
    let resolve!: (value: ReturnType<typeof stream>) => void;
    request.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const start = mic.start(vi.fn());
    await visibility('hidden');
    await visibility('visible');
    const oldTrack = new Track();
    resolve(stream(oldTrack));
    await start;
    expect(oldTrack.stop).toHaveBeenCalled();
    expect(tracks[0].stop).not.toHaveBeenCalled();
  });

  it('deduplicates reconnect requests and removes lifecycle listeners on stop', async () => {
    await mic.start(vi.fn());
    const a = mic.reconnect();
    const b = mic.reconnect();
    expect(a).toBe(b);
    await a;
    mic.stop();
    await visibility('hidden');
    await visibility('visible');
    expect(request).toHaveBeenCalledTimes(2);
    expect(tracks.every((track) => track.stop.mock.calls.length > 0)).toBe(true);
  });

  it('reports ended tracks and times out unanswered permission prompts', async () => {
    const status = vi.fn();
    await mic.start(vi.fn(), status);
    tracks[0].readyState = 'ended';
    tracks[0].onended?.();
    expect(status).toHaveBeenLastCalledWith('unavailable');
    request.mockImplementationOnce(() => new Promise(() => {}));
    const reconnect = mic.reconnect();
    await vi.advanceTimersByTimeAsync(10001);
    await reconnect;
    expect(status).toHaveBeenLastCalledWith('unavailable', expect.any(Error));
  });

  it('resumes an interrupted context and withholds samples while a track is muted', async () => {
    const status = vi.fn();
    const level = vi.fn();
    await mic.start(level, status);
    await vi.advanceTimersByTimeAsync(100);
    const ctx = Context.instances[0];
    ctx.state = 'interrupted';
    ctx.onstatechange?.();
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(100);
    expect(status).toHaveBeenLastCalledWith('listening');
    tracks[0].muted = true;
    tracks[0].onmute?.();
    const count = level.mock.calls.length;
    await vi.advanceTimersByTimeAsync(500);
    expect(level).toHaveBeenCalledTimes(count);
    tracks[0].muted = false;
    await vi.advanceTimersByTimeAsync(100);
    expect(status).toHaveBeenLastCalledWith('listening');
  });

  it('distinguishes permission denial from an interruption', () => {
    expect(micErrorMessage(new DOMException('Denied', 'NotAllowedError'))).toContain('denied');
    expect(micErrorMessage(new Error('Disconnected'))).toContain('interrupted');
  });
});
