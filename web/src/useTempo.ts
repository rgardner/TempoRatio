import * as React from 'react';
import * as audio from './audio';
import * as detector from './detector';
import * as session from './session';
import * as storage from './storage';

const LISTENING: session.Phase[] = ['waiting', 'playing', 'resting', 'ready'];

export function useTempo() {
  const [settings, setSettingsState] = React.useState(storage.loadSettings);
  const [state, setState] = React.useState(storage.loadSession);
  const [now, setNow] = React.useState(Date.now());
  const [level, setLevel] = React.useState(-100);
  const [micError, setMicError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<session.Summary | null>(null);

  const settingsRef = React.useRef(settings);
  const stateRef = React.useRef(state);
  const det = React.useRef(
    new detector.Detector({
      onDb: -45,
      hysteresisDb: detector.DEFAULT_HYSTERESIS_DB,
      startMs: detector.DEFAULT_START_MS,
      endMs: detector.DEFAULT_END_MS,
    }),
  );

  const apply = React.useCallback((fn: (s: session.State) => session.State) => {
    const next = fn(stateRef.current);
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
    storage.saveSession(next);
  }, []);

  const updateSettings = React.useCallback((patch: Partial<storage.Settings>) => {
    settingsRef.current = { ...settingsRef.current, ...patch };
    setSettingsState(settingsRef.current);
    storage.saveSettings(settingsRef.current);
  }, []);

  det.current.config.onDb = detector.thresholdDb(settings.calibration, settings.sensitivity);

  // Timestamp-based tick: safe against throttling and backgrounding.
  const tick = React.useCallback(() => {
    const n = Date.now();
    const before = stateRef.current.phase;
    apply((s) => session.advance(s, n));
    if (before === 'resting' && stateRef.current.phase === 'ready') {
      if (settingsRef.current.sound) audio.beep();
      if (settingsRef.current.vibration) audio.vibrate();
    }
    setNow(n);
  }, [apply]);

  React.useEffect(() => {
    const id = window.setInterval(tick, 100);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [tick]);

  const beginPlaying = React.useCallback(
    (at: number) => {
      apply((s) => session.beginPlaying(s, at));
      det.current.forcePlaying(Date.now());
    },
    [apply],
  );

  const endPlaying = React.useCallback(
    (at: number) => {
      apply((s) => session.endPlaying(s, at, settingsRef.current.ratio));
      det.current.reset();
    },
    [apply],
  );

  const listening = settings.mode === 'auto' && LISTENING.includes(state.phase);
  React.useEffect(() => {
    if (!listening) {
      setLevel(-100);
      return;
    }
    const mic = new audio.Mic();
    det.current.reset();
    mic
      .start((db) => {
        const n = Date.now();
        setLevel(db);
        const ev = det.current.update(db, n);
        const phase = stateRef.current.phase;
        if (ev?.type === 'start' && phase !== 'playing') {
          apply((s) => session.beginPlaying(s, ev.at));
        } else if (ev?.type === 'end' && phase === 'playing') {
          apply((s) => session.endPlaying(s, ev.at, settingsRef.current.ratio));
        }
      })
      .then(() => setMicError(null))
      .catch((e: unknown) => {
        setMicError(
          `Microphone unavailable (${e instanceof Error ? e.message : 'denied'}). Switched to manual mode.`,
        );
        updateSettings({ mode: 'manual' });
      });
    return () => mic.stop();
  }, [listening, apply, updateSettings]);

  // Keep the screen on while practicing.
  const awake = state.phase !== 'idle' && state.phase !== 'paused';
  React.useEffect(() => {
    if (!awake || !navigator.wakeLock) return;
    let lock: WakeLockSentinel | null = null;
    const request = () => {
      if (document.visibilityState === 'visible') {
        navigator.wakeLock.request('screen').then((l) => (lock = l), () => {});
      }
    };
    request();
    document.addEventListener('visibilitychange', request);
    return () => {
      document.removeEventListener('visibilitychange', request);
      void lock?.release();
    };
  }, [awake]);

  const actions = {
    startSession: () => {
      audio.unlockBeep();
      setSummary(null);
      setMicError(null);
      det.current.reset();
      apply(() => session.start(Date.now()));
    },
    startPlaying: () => beginPlaying(Date.now()),
    stopPlaying: () => endPlaying(Date.now()),
    pause: () => apply((s) => session.pause(s, Date.now())),
    resume: () => {
      det.current.reset();
      apply((s) => session.resume(s, Date.now()));
    },
    endSession: () => {
      setSummary(session.summarize(stateRef.current, Date.now()));
      apply(() => session.create());
    },
    dismissSummary: () => setSummary(null),
    setMode: (mode: 'auto' | 'manual') => {
      setMicError(null);
      updateSettings({ mode });
    },
  };

  return { settings, updateSettings, state, now, level, micError, summary, actions };
}
