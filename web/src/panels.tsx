import * as React from 'react';
import * as audio from './audio';
import * as detector from './detector';
import * as session from './session';
import * as storage from './storage';

export function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

type Step = 'intro' | 'noise' | 'play' | 'done' | 'error';

function Calibration(props: { onDone: (c: detector.Calibration) => void }) {
  const [step, setStep] = React.useState<Step>('intro');
  const [message, setMessage] = React.useState('');
  const [level, setLevel] = React.useState(-100);

  const run = async () => {
    const mic = new audio.Mic();
    const samples: number[] = [];
    let collecting = false;
    try {
      await mic.start((db) => {
        setLevel(db);
        if (collecting) samples.push(db);
      });
      const collect = async (next: Step, ms: number) => {
        setStep(next);
        samples.length = 0;
        collecting = true;
        await new Promise((r) => setTimeout(r, ms));
        collecting = false;
        return [...samples];
      };
      const noise = await collect('noise', 3000);
      const play = await collect('play', 5000);
      const cal = detector.deriveCalibration(noise, play);
      if (!cal) {
        setMessage('Playing was too close to the background noise. Try again, closer or louder.');
        setStep('error');
      } else {
        props.onDone(cal);
        setStep('done');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Microphone unavailable.');
      setStep('error');
    } finally {
      mic.stop();
    }
  };

  return (
    <div className="card" role="group" aria-label="Calibration">
      {step === 'intro' && <p>Calibration measures room noise, then your playing level.</p>}
      {step === 'noise' && <p className="big-prompt">Step 1 — Stay quiet for a few seconds.</p>}
      {step === 'play' && <p className="big-prompt">Step 2 — Play a comfortable note or phrase.</p>}
      {step === 'done' && <p>Calibrated. Threshold updated.</p>}
      {step === 'error' && <p role="alert">{message}</p>}
      {(step === 'noise' || step === 'play') && <Meter level={level} />}
      {(step === 'intro' || step === 'done' || step === 'error') && (
        <button className="btn secondary" onClick={run}>
          {step === 'intro' ? 'Start calibration' : 'Recalibrate'}
        </button>
      )}
    </div>
  );
}

export function Meter(props: { level: number; threshold?: number }) {
  const pct = (db: number) => Math.min(100, Math.max(0, ((db + 80) / 80) * 100));
  return (
    <div className="meter" aria-hidden="true">
      <div className="meter-fill" style={{ width: `${pct(props.level)}%` }} />
      {props.threshold !== undefined && <div className="meter-mark" style={{ left: `${pct(props.threshold)}%` }} />}
    </div>
  );
}

export function Settings(props: {
  settings: storage.Settings;
  update: (patch: Partial<storage.Settings>) => void;
  onClose: () => void;
}) {
  const { settings, update } = props;
  const presets: Record<string, session.Ratio> = {
    '1:1': { play: 1, rest: 1 },
    '1:2': { play: 1, rest: 2 },
    '2:1': { play: 2, rest: 1 },
  };
  const current = Object.keys(presets).find(
    (k) => presets[k].play === settings.ratio.play && presets[k].rest === settings.ratio.rest,
  );
  const [custom, setCustom] = React.useState(!current);
  const num = (v: string) => Math.max(0.1, Math.min(20, Number(v) || 1));

  return (
    <section className="screen" aria-label="Settings">
      <h2>Settings</h2>

      <h3>Practice : rest ratio</h3>
      <div className="seg" role="radiogroup">
        {Object.keys(presets).map((k) => (
          <button
            key={k}
            role="radio"
            aria-checked={!custom && current === k}
            className={!custom && current === k ? 'on' : ''}
            onClick={() => {
              setCustom(false);
              update({ ratio: presets[k] });
            }}
          >
            {k}
          </button>
        ))}
        <button role="radio" aria-checked={custom} className={custom ? 'on' : ''} onClick={() => setCustom(true)}>
          Custom
        </button>
      </div>
      {custom && (
        <div className="row">
          <input
            aria-label="Practice parts"
            type="number"
            min="0.1"
            step="0.5"
            value={settings.ratio.play}
            onChange={(e) => update({ ratio: { ...settings.ratio, play: num(e.target.value) } })}
          />
          <span>:</span>
          <input
            aria-label="Rest parts"
            type="number"
            min="0.1"
            step="0.5"
            value={settings.ratio.rest}
            onChange={(e) => update({ ratio: { ...settings.ratio, rest: num(e.target.value) } })}
          />
        </div>
      )}

      <h3>Detection sensitivity</h3>
      <input
        type="range"
        min="0"
        max="100"
        aria-label="Detection sensitivity"
        value={settings.sensitivity}
        onChange={(e) => update({ sensitivity: Number(e.target.value) })}
      />
      <p className="hint">Higher detects quieter playing. {settings.calibrated ? '' : 'Not yet calibrated.'}</p>

      <h3>Microphone</h3>
      <Calibration onDone={(calibration) => update({ calibration, calibrated: true })} />

      <h3>Alerts</h3>
      <label className="check">
        <input type="checkbox" checked={settings.sound} onChange={(e) => update({ sound: e.target.checked })} />
        Sound when rest is complete
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={settings.vibration}
          onChange={(e) => update({ vibration: e.target.checked })}
        />
        Vibration (where supported)
      </label>

      <button className="btn primary" onClick={props.onClose}>
        Done
      </button>
    </section>
  );
}

export function SummaryView(props: { summary: session.Summary; onClose: () => void }) {
  const s = props.summary;
  return (
    <section className="screen" aria-label="Session summary">
      <h2>Session summary</h2>
      <dl className="stats">
        <dt>Session time</dt>
        <dd>{formatMs(s.totalMs)}</dd>
        <dt>Playing time</dt>
        <dd>{formatMs(s.playMs)}</dd>
        <dt>Rest time</dt>
        <dd>{formatMs(s.restMs)}</dd>
        <dt>Practice intervals</dt>
        <dd>{s.intervals.length}</dd>
        <dt>Average interval</dt>
        <dd>{formatMs(s.averagePlayMs)}</dd>
      </dl>
      {s.intervals.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Played</th>
              <th>Recommended rest</th>
              <th>Actual rest</th>
            </tr>
          </thead>
          <tbody>
            {s.intervals.map((i, n) => (
              <tr key={n}>
                <td>{n + 1}</td>
                <td>{formatMs(i.playMs)}</td>
                <td>{i.recommendedRestMs ? formatMs(i.recommendedRestMs) : '–'}</td>
                <td>{i.actualRestMs === null ? '–' : formatMs(i.actualRestMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button className="btn primary" onClick={props.onClose}>
        Close
      </button>
    </section>
  );
}
