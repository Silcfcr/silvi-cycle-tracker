import React from 'react';
import { toKey, cycleInfo, fmtLong, PHASE, initSupabase } from './lib.js';
import { Stepper } from './components.jsx';

/* ════════════════════════════════════════════════════════════════
   onboarding.jsx — first-run cycle setup (Petal style)
   ════════════════════════════════════════════════════════════════ */
function Onboarding({ onDone, userId }) {
  const today = new Date();
  const def = toKey(addDays(today, -14));
  const [lastStart, setLastStart] = React.useState(def);
  const [cycleLength, setCycleLength] = React.useState(28);
  const [periodDuration, setPeriodDuration] = React.useState(5);

  const valid = !!lastStart && cycleLength >= 21 && cycleLength <= 40 && periodDuration >= 1 && periodDuration <= 10;

  return (
    <div className="app">
      <div className="band" style={{ paddingBottom: 64 }}>
        <div className="blob" style={{ width: 150, height: 150, top: -40, right: -36 }} />
        <div className="blob" style={{ width: 70, height: 70, top: 54, right: 36 }} />
        <div className="blob" style={{ width: 40, height: 40, top: 120, right: 120, background: "rgba(255,255,255,.07)" }} />
        <div style={{ position: "relative", paddingTop: 34 }}>
          <div className="eyebrow on-band">Welcome to Silvi</div>
          <h1 style={{ fontSize: 30, color: "#fff", marginTop: 10, lineHeight: 1.12, letterSpacing: "-0.01em" }}>
            Let's get to know<br />your <em style={{ fontStyle: "italic" }}>rhythm</em>.
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,.9)", marginTop: 12, lineHeight: 1.5, maxWidth: 320 }}>
            A few gentle details and I'll map your cycle, fertile window, and the days ahead.
          </p>
        </div>
      </div>

      <div className="sheet rise">
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div className="field">
            <label>When did your last period start?</label>
            <input className="input" type="date" value={lastStart} max={toKey(today)} onChange={e => setLastStart(e.target.value)} />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Day one of bleeding — a best guess is fine.</span>
          </div>

          <div className="field">
            <label>Average cycle length</label>
            <Stepper value={cycleLength} onChange={setCycleLength} min={21} max={40} suffix="days" />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>First day of one period to the next. Most are 24–32.</span>
          </div>

          <div className="field">
            <label>How long does your period last?</label>
            <Stepper value={periodDuration} onChange={setPeriodDuration} min={1} max={10} suffix="days" />
          </div>

          <button className="btn block" disabled={!valid} onClick={async () => {
            const sb = initSupabase();
            if (sb && userId) {
              await Promise.all([
                sb.from('periods').upsert(
                  { user_id: userId, started_at: lastStart },
                  { onConflict: 'user_id,started_at' }
                ),
                sb.from('cycle_settings').upsert(
                  { user_id: userId, cycle_length: cycleLength, period_duration: periodDuration, updated_at: new Date().toISOString() },
                  { onConflict: 'user_id' }
                ),
              ]);
            }
            onDone({ lastStart, cycleLength, periodDuration });
          }}>
            Start tracking
          </button>
          <p style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "center", margin: 0, lineHeight: 1.5 }}>
            Predictions are estimates for wellness, not medical or contraceptive advice. Everything stays on this device.
          </p>
        </div>
      </div>
    </div>
  );
}


export { Onboarding };
