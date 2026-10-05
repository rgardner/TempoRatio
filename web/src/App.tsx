import * as React from 'react';
import * as detector from './detector';
import * as panels from './panels';
import * as session from './session';
import * as useTempo from './useTempo';

const LABELS: Record<string, { label: string; glyph: string }> = {
  waiting: { label: 'LISTENING', glyph: '◉' },
  playing: { label: 'PLAYING', glyph: '▶' },
  resting: { label: 'REST', glyph: '❚❚' },
  ready: { label: 'READY', glyph: '✓' },
  paused: { label: 'PAUSED', glyph: '⏸' },
};

const R = 130;
const CIRC = 2 * Math.PI * R;

export function App() {
  const t = useTempo.useTempo();
  const { state, settings, now, actions } = t;
  const [showSettings, setShowSettings] = React.useState(false);
  const phase = state.phase;
  const auto = settings.mode === 'auto';

  if (t.summary) return <main><panels.SummaryView summary={t.summary} onClose={actions.dismissSummary} /></main>;
  if (showSettings && phase === 'idle') {
    return (
      <main>
        <panels.Settings settings={settings} update={t.updateSettings} onClose={() => setShowSettings(false)} />
      </main>
    );
  }

  const shown = phase === 'paused' ? (state.pausedFrom ?? 'waiting') : phase;
  let big = '';
  let sub = '';
  let ring: number | null = null;
  if (shown === 'playing') {
    big = panels.formatMs(session.playingMs(state, now));
    sub = auto && phase !== 'paused' ? 'Listening…' : '';
  } else if (shown === 'resting') {
    big = panels.formatMs(Math.ceil(session.restRemainingMs(state, now) / 1000) * 1000);
    sub = `of ${panels.formatMs(state.recommendedRestMs)} recommended`;
    ring = state.recommendedRestMs
      ? session.restRemainingMs(state, now) / state.recommendedRestMs
      : 0;
  } else if (shown === 'ready') {
    big = '0:00';
    sub = 'Rest complete';
  } else if (shown === 'waiting') {
    big = '0:00';
    sub = auto ? 'Start playing when ready' : 'Press Start Playing';
  }
  const info = LABELS[phase];

  return (
    <main className={`phase-${phase}`}>
      <header>
        <h1>TempoRatio</h1>
        <div className="seg small" role="radiogroup" aria-label="Detection mode">
          <button
            role="radio"
            aria-checked={auto}
            className={auto ? 'on' : ''}
            onClick={() => actions.setMode('auto')}
          >
            Auto
          </button>
          <button
            role="radio"
            aria-checked={!auto}
            className={!auto ? 'on' : ''}
            onClick={() => actions.setMode('manual')}
          >
            Manual
          </button>
        </div>
        {phase === 'idle' && (
          <button className="icon" aria-label="Settings" onClick={() => setShowSettings(true)}>
            ⚙
          </button>
        )}
      </header>

      {t.micError && <p className="alert" role="alert">{t.micError}</p>}

      {phase === 'idle' ? (
        <section className="idle">
          <p className="lede">Start playing and TempoRatio times your practice, then tells you how long to rest.</p>
          <button className="btn primary huge" onClick={actions.startSession}>
            Start Session
          </button>
          <p className="hint">
            {auto
              ? 'Auto mode listens through your microphone to detect when you play. Audio is analyzed on this device only — never recorded or uploaded.'
              : 'Manual mode: you start and stop each interval with the buttons.'}
          </p>
        </section>
      ) : (
        <>
          <section className="dash" aria-live="polite">
            <div className="state-label">
              <span aria-hidden="true">{info.glyph}</span> {info.label}
            </div>
            <div className="timer-wrap">
              {ring !== null && (
                <svg viewBox="0 0 300 300" className="ring" aria-hidden="true">
                  <circle cx="150" cy="150" r={R} className="track" />
                  <circle
                    cx="150"
                    cy="150"
                    r={R}
                    className="progress"
                    strokeDasharray={CIRC}
                    strokeDashoffset={CIRC * (1 - ring)}
                    transform="rotate(-90 150 150)"
                  />
                </svg>
              )}
              <div className="timer" aria-label={`${info.label} ${big}`}>{big}</div>
            </div>
            <div className="sub">{phase === 'paused' ? 'Session paused' : sub}</div>
            {auto && phase !== 'paused' && (
              <div className="listening">
                <span className="dot" aria-hidden="true" /> Microphone on
                <panels.Meter
                  level={t.level}
                  threshold={detector.thresholdDb(settings.calibration, settings.sensitivity)}
                />
              </div>
            )}
          </section>

          <section className="controls">
            {phase === 'playing' && (
              <button className="btn primary huge" onClick={actions.stopPlaying}>
                Stop
              </button>
            )}
            {(phase === 'waiting' || phase === 'resting' || phase === 'ready') && (
              <button className="btn primary huge" onClick={actions.startPlaying}>
                {phase === 'resting' ? 'Start Playing Early' : 'Start Playing'}
              </button>
            )}
            {phase === 'paused' ? (
              <button className="btn primary huge" onClick={actions.resume}>
                Resume
              </button>
            ) : (
              <button className="btn secondary" onClick={actions.pause}>
                Pause Session
              </button>
            )}
            <button className="btn danger" onClick={actions.endSession}>
              End Session
            </button>
          </section>
        </>
      )}
    </main>
  );
}
