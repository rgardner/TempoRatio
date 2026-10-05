import * as detector from './detector';
import * as session from './session';

export interface Settings {
  mode: 'auto' | 'manual';
  ratio: session.Ratio;
  sensitivity: number;
  calibration: detector.Calibration;
  calibrated: boolean;
  sound: boolean;
  vibration: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'auto',
  ratio: { play: 1, rest: 1 },
  sensitivity: 50,
  calibration: detector.DEFAULT_CALIBRATION,
  calibrated: false,
  sound: true,
  vibration: true,
};

const SETTINGS_KEY = 'temporatio.settings.v1';
const SESSION_KEY = 'temporatio.session.v1';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private mode); the app still works.
  }
}

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(SETTINGS_KEY) };
}

export function saveSettings(s: Settings): void {
  write(SETTINGS_KEY, s);
}

export function loadSession(): session.State {
  const s = read<session.State>(SESSION_KEY);
  return s && typeof s.phase === 'string' ? { ...session.create(), ...s } : session.create();
}

export function saveSession(s: session.State): void {
  write(SESSION_KEY, s);
}
