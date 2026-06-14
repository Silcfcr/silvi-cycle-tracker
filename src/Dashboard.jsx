import React from 'react';
import {
  toKey, parseKey, addDays, daysBetween, fmtLong, fmtShort,
  MONTHS, DOW, PHASE, cycleInfo, isPredictedPeriod, daysUntil,
  KG_TO_LB, toDisplayWeight, fromDisplayWeight,
  initSupabase, lookupUserByEmail, createSupabaseUser,
  useStore, startOfDay,
} from './lib.js';
import { FaceSvg, MOOD_NAMES, MoodPicker, PhaseRing, CycleBar, Calendar, WeightChart, Stepper } from './components.jsx';

/* ════════════════════════════════════════════════════════════════
   dashboard.jsx — main single-scroll dashboard (Petal style)
   ════════════════════════════════════════════════════════════════ */

function Greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/* ── Settings sheet ──────────────────────────────────────────── */
function SettingsModal({ data, api, onClose, userId }) {
  const [cycleLength, setCycleLength] = React.useState(data.setup.cycleLength);
  const [periodDuration, setPeriodDuration] = React.useState(data.setup.periodDuration);
  const [confirmReset, setConfirmReset] = React.useState(false);

  const save = async () => { await api.saveCycleSettings(cycleLength, periodDuration); onClose(); };

  return (
    <div className="modal-wrap">
      <div className="modal-scrim" onClick={onClose} />
      <div className="modal">
        <div className="grabber" />
        <h2 style={{ fontSize: 23, marginBottom: 4 }}>Cycle settings</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0, marginBottom: 22 }}>Update these whenever your body changes.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          <div className="field"><label>Average cycle length</label><Stepper value={cycleLength} onChange={setCycleLength} min={21} max={40} suffix="days" /></div>
          <div className="field"><label>Period duration</label><Stepper value={periodDuration} onChange={setPeriodDuration} min={1} max={10} suffix="days" /></div>

          <div className="field">
            <label>Weight units</label>
            <div style={{ display: "flex", gap: 10 }}>
              {["kg","lb"].map(u => (
                <button key={u} onClick={() => api.setUnits(u)}
                  style={{ flex: 1, padding: "12px 0", borderRadius: 14, border: "1.5px solid " + (data.units===u ? "var(--rose-500)" : "var(--line)"),
                    background: data.units===u ? "var(--blush-50)" : "var(--white)", color: data.units===u ? "var(--rose-600)" : "var(--ink-soft)", fontWeight: 800, fontSize: 14 }}>
                  {u === "kg" ? "Kilograms" : "Pounds"}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Log a period</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="input" type="date" id="period-start-input"
                max={toKey(new Date())}
                defaultValue={toKey(new Date())} />
              <button className="btn" style={{ padding: '0 18px', flexShrink: 0 }}
                onClick={() => {
                  const val = document.getElementById('period-start-input').value;
                  if (val) api.logPeriodStart(val);
                }}>Log start</button>
            </div>
          </div>

          {data.periods && data.periods.length > 0 && (
            <div className="field">
              <label>Recent periods</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.periods.slice(0, 5).map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 14, background: 'var(--blush-50)',
                    fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600 }}>
                    <span>Started {fmtShort(parseKey(p.started_at))}</span>
                    {p.ended_at
                      ? <span style={{ color: 'var(--muted)' }}>Ended {fmtShort(parseKey(p.ended_at))}</span>
                      : <button className="btn" style={{ padding: '4px 12px', fontSize: 12 }}
                          onClick={() => api.logPeriodEnd(p.id, toKey(new Date()))}>
                          End today
                        </button>
                    }
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="btn block" onClick={save}>Save changes</button>
          <button className="btn ghost block" style={{ color: confirmReset ? "#fff" : "var(--rose-600)", background: confirmReset ? "var(--rose-600)" : "var(--blush-50)", border: "none" }}
            onClick={() => { if (confirmReset) { api.reset(); onClose(); } else setConfirmReset(true); }}>
            {confirmReset ? "Tap again to erase everything" : "Reset all data"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Weight quick-log + chart ────────────────────────────────── */
function WeightCard({ data, api }) {
  const todayKey = toKey(new Date());
  const units = data.units;
  const todayKg = data.weights[todayKey];
  const [draft, setDraft] = React.useState(todayKg != null ? toDisplayWeight(todayKg, units).toFixed(1) : "");
  React.useEffect(() => { setDraft(todayKg != null ? toDisplayWeight(todayKg, units).toFixed(1) : ""); }, [units, todayKg]);

  const measurements = data.measurements || {};
  const todayMeas = measurements[todayKey] || {};
  const [mDraft, setMDraft] = React.useState({ waist: "", hips: "", arm: "", chest: "" });
  React.useEffect(() => {
    setMDraft({
      waist: todayMeas.waist != null ? String(todayMeas.waist) : "",
      hips:  todayMeas.hips  != null ? String(todayMeas.hips)  : "",
      arm:   todayMeas.arm   != null ? String(todayMeas.arm)   : "",
      chest: todayMeas.chest != null ? String(todayMeas.chest) : "",
    });
  }, [todayKey, JSON.stringify(todayMeas)]);

  const entries = Object.keys(data.weights).sort().map(k => ({ key: k, date: parseKey(k), kg: data.weights[k] }));
  const logged = entries.length;
  const save = () => { const v = parseFloat(draft); if (!isNaN(v)) api.setWeight(todayKey, fromDisplayWeight(v, units)); };
  const saveMeas = (field) => {
    const v = mDraft[field];
    api.setMeasurement(todayKey, field, v === "" ? null : v);
  };

  let trend = null;
  if (logged >= 2) {
    const diff = toDisplayWeight(entries[logged-1].kg - entries[0].kg, units);
    trend = diff;
  }

  const MEAS_LABELS = [
    { key: 'waist', label: 'Waist', color: '#a855f7' },
    { key: 'hips',  label: 'Hips',  color: '#f97316' },
    { key: 'arm',   label: 'Arm',   color: '#14b8a6' },
    { key: 'chest', label: 'Chest', color: '#3b82f6' },
  ];

  return (
    <div className="card" style={{ padding: "20px 20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="section-label" style={{ margin: 0 }}>Body</div>
        {trend != null && (
          <span className="chip" style={{ background: "var(--blush-50)" }}>
            {trend > 0 ? "▲" : trend < 0 ? "▼" : "•"} {Math.abs(trend).toFixed(1)} {units} overall
          </span>
        )}
      </div>

      {logged === 0 ? (
        <div className="empty" style={{ marginTop: 16 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 17, color: "var(--ink)", marginBottom: 4 }}>No weigh-ins yet</div>
          <div style={{ fontSize: 12.5 }}>Add today's weight to start your trend line.</div>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "var(--serif)", fontSize: 34, color: "var(--ink)", lineHeight: 1 }}>
              {toDisplayWeight(entries[logged-1].kg, units).toFixed(1)}
            </span>
            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>{units} · latest</span>
          </div>
          <div style={{ marginTop: 10 }}><WeightChart entries={entries} units={units} measurements={measurements} /></div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input className="input" inputMode="decimal" placeholder={"Today's weight"} value={draft}
            onChange={e => setDraft(e.target.value.replace(/[^0-9.]/g, ""))}
            onKeyDown={e => { if (e.key === "Enter") save(); }} />
          <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>{units}</span>
        </div>
        <button className="btn" style={{ padding: "0 22px" }} onClick={save}>{todayKg != null ? "Update" : "Log"}</button>
      </div>

      <div style={{ marginTop: 14, borderTop: "1px solid var(--line-soft)", paddingTop: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Measurements (cm)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {MEAS_LABELS.map(({ key, label, color }) => (
            <div key={key} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div style={{ width: 3, height: 28, borderRadius: 2, background: color, flexShrink: 0 }} />
              <div style={{ position: "relative", flex: 1 }}>
                <input className="input" inputMode="decimal" placeholder={label}
                  value={mDraft[key]}
                  onChange={e => setMDraft(d => ({ ...d, [key]: e.target.value.replace(/[^0-9.]/g, "") }))}
                  onBlur={() => saveMeas(key)}
                  onKeyDown={e => { if (e.key === "Enter") { saveMeas(key); e.target.blur(); } }}
                  style={{ paddingRight: 32, fontSize: 13 }} />
                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>cm</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Recent mood & phase strip ───────────────────────────────── */
function DayEditSheet({ date, data, api, onClose }) {
  const key = toKey(date);
  const units = data.units;
  const existingKg = data.weights[key];
  const [weightDraft, setWeightDraft] = React.useState(
    existingKg != null ? toDisplayWeight(existingKg, units).toFixed(1) : ""
  );
  const mood = data.moods[key] != null ? data.moods[key] : null;

  const saveWeight = function() {
    const v = parseFloat(weightDraft);
    if (!isNaN(v)) api.setWeight(key, fromDisplayWeight(v, units));
    else if (weightDraft === "" && existingKg != null) api.setWeight(key, null);
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(30,10,20,0.32)" }} onClick={onClose} />
      <div style={{ position: "relative", background: "#fff", borderRadius: "24px 24px 0 0", padding: "24px 20px 44px", boxShadow: "0 -4px 32px rgba(180,80,120,0.10)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 20, color: "var(--ink)" }}>{fmtLong(date)}</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "var(--blush-50)", color: "var(--rose-500)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>✕</button>
        </div>
        <div style={{ marginBottom: 22 }}>
          <div className="section-label" style={{ margin: "0 0 12px" }}>Mood</div>
          <MoodPicker value={mood} onChange={function(l) { api.setMood(key, l); }} size={42} />
        </div>
        <div>
          <div className="section-label" style={{ margin: "0 0 12px" }}>Weight</div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input className="input" inputMode="decimal" placeholder="Weight" value={weightDraft}
                onChange={function(e) { setWeightDraft(e.target.value.replace(/[^0-9.]/g, "")); }}
                onKeyDown={function(e) { if (e.key === "Enter") { saveWeight(); onClose(); } }} />
              <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>{units}</span>
            </div>
            <button className="btn" style={{ padding: "0 22px" }} onClick={function() { saveWeight(); onClose(); }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecentStrip({ data, onDaySelect }) {
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(addDays(new Date(), -i));
  const phaseColor = { period: "#D4748F", follicular: "#F4C9B9", fertile: "#C9A2D6", ovulation: "#C26FA6", luteal: "#F3D9E2" };
  return (
    <div className="card" style={{ padding: "20px 6px 18px" }}>
      <div className="section-label" style={{ margin: "0 14px 6px" }}>Last 14 days</div>
      <div style={{ fontSize: 12, color: "var(--muted)", margin: "0 14px 16px", lineHeight: 1.4 }}>Tap any day to log or edit mood and weight.</div>
      <div style={{ display: "flex", gap: 4, overflowX: "auto", padding: "0 12px 4px", scrollbarWidth: "none" }}>
        {days.map(function(d, i) {
          const key = toKey(d);
          const info = cycleInfo(data.setup, d);
          const mood = data.moods[key];
          const isToday = i === days.length - 1;
          return (
            <button key={key} onClick={function() { onDaySelect(d); }}
              style={{ flex: "0 0 auto", width: 34, display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
                cursor: "pointer", background: "none", border: "none", padding: 0, touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: isToday ? "var(--rose-600)" : "var(--muted)" }}>{DOW[d.getDay()][0]}</span>
              <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: mood != null ? "var(--blush-50)" : "transparent",
                border: mood != null ? "none" : "1.5px dashed var(--line)" }}>
                {mood != null ? <FaceSvg level={mood} color="var(--rose-500)" size={20} /> : <span style={{ width: 4, height: 4, borderRadius: 2, background: "var(--line)" }} />}
              </div>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: phaseColor[info.phase.key], border: "1px solid rgba(0,0,0,.04)" }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}


/* ── Login screen ──────────────────────────────────────────────────────────── */
function LoginScreen({ onLogin }) {
  const [email, setEmail] = React.useState('');
  const [step, setStep] = React.useState('email'); // 'email' | 'name' | 'loading' | 'error'
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState('');

  const handleEmail = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStep('loading');
    try {
      const user = await lookupUserByEmail(email.trim().toLowerCase());
      if (user) {
        localStorage.setItem('silvi_user_id', user.id);
        onLogin(user.id);
      } else {
        setStep('name');
      }
    } catch (err) {
      setErrorMsg('Could not connect to server. Check your connection.');
      setStep('error');
    }
  };

  const handleName = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setStep('loading');
    try {
      const user = await createSupabaseUser(email.trim().toLowerCase(), firstName.trim(), lastName.trim());
      localStorage.setItem('silvi_user_id', user.id);
      onLogin(user.id);
    } catch (err) {
      setErrorMsg('Could not create account. Try again.');
      setStep('error');
    }
  };

  return (
    <div className="app">
      <div className="band" style={{ paddingBottom: 64 }}>
        <div className="blob" style={{ width: 150, height: 150, top: -40, right: -36 }} />
        <div className="blob" style={{ width: 70, height: 70, top: 54, right: 36 }} />
        <div style={{ position: 'relative', paddingTop: 34 }}>
          <div className="eyebrow on-band">Silvi</div>
          <h1 style={{ fontSize: 30, color: '#fff', marginTop: 10, lineHeight: 1.12, letterSpacing: '-0.01em' }}>
            {step === 'name' ? 'Nice to meet you.' : 'Welcome back.'}
          </h1>
        </div>
      </div>

      <div className="sheet rise">
        {step === 'loading' && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 14 }}>
            Just a moment...
          </div>
        )}

        {step === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ color: 'var(--rose-600)', fontSize: 14, textAlign: 'center' }}>{errorMsg}</p>
            <button className="btn block" onClick={() => setStep('email')}>Try again</button>
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="field">
              <label>Your email</label>
              <input className="input" type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} autoFocus required />
            </div>
            <button className="btn block" type="submit" disabled={!email.trim()}>Continue</button>
          </form>
        )}

        {step === 'name' && (
          <form onSubmit={handleName} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
              No account found for <strong>{email}</strong>. Let's create one.
            </p>
            <div className="field">
              <label>First name</label>
              <input className="input" type="text" value={firstName}
                onChange={e => setFirstName(e.target.value)} autoFocus required />
            </div>
            <div className="field">
              <label>Last name</label>
              <input className="input" type="text" value={lastName}
                onChange={e => setLastName(e.target.value)} required />
            </div>
            <button className="btn block" type="submit"
              disabled={!firstName.trim() || !lastName.trim()}>Create account</button>
            <button type="button" className="btn ghost block"
              onClick={() => setStep('email')}>Back</button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── Dashboard ───────────────────────────────────────────────── */
function Dashboard({ data, api, tweaks, userId }) {
  const today = new Date();
  const todayKey = toKey(today);
  const info = cycleInfo(data.setup, today);
  const until = daysUntil(data.setup, today);
  const [monthOffset, setMonthOffset] = React.useState(0);
  const [settings, setSettings] = React.useState(false);
  const [editDay, setEditDay] = React.useState(null);

  const mood = data.moods[todayKey];
  const phaseChipColor = { period: "var(--phase-period)", follicular: "var(--phase-foll)", fertile: "var(--phase-fertile)", ovulation: "var(--phase-ovu)", luteal: "#E9B9C8" }[info.phase.key];

  return (
    <div className="app">
      {/* Header band */}
      <div className="band">
        <div className="blob" style={{ width: 160, height: 160, top: -50, right: -40 }} />
        <div className="blob" style={{ width: 64, height: 64, top: 50, right: 40 }} />
        <div style={{ position: "relative", paddingTop: 22, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,.9)", letterSpacing: .2 }}>{fmtLong(today)}</div>
            <h1 style={{ fontSize: 25, color: "#fff", marginTop: 4 }}><Greeting />, Silvi</h1>
            <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: "#fff", background: "rgba(255,255,255,.16)", padding: "6px 13px", borderRadius: 999 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />
              Cycle day {info.dayInCycle} · {info.phase.label}
            </div>
          </div>
          <button className="icon-btn" onClick={() => setSettings(true)} aria-label="Settings">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      </div>

      {/* Sheet */}
      <div className="sheet">
        <div className="content-grid">
          <div className="col-left">

          {/* Hero ring */}
          <div className="card rise" style={{ padding: "26px 20px 22px", display: "flex", flexDirection: "column", alignItems: "center", boxShadow: "var(--shadow-card)" }}>
            <PhaseRing info={info} size={206} />
            <div style={{ marginTop: 18, textAlign: "center" }}>
              <div style={{ fontFamily: "var(--serif)", fontSize: 20, color: "var(--ink)" }}>
                {until <= 0 ? "Period expected today" : <>Next period in <span style={{ color: "var(--rose-600)" }}>{until} day{until===1?"":"s"}</span></>}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>around {fmtLong(info.nextPeriod)}</div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
              <span className="chip"><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--phase-fertile)" }} />Fertile {fmtShort(info.fertileStartDate)}–{fmtShort(info.fertileEndDate)}</span>
              <span className="chip"><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--phase-ovu)" }} />Ovulation {fmtShort(info.ovulationDate)}</span>
            </div>
          </div>

          {/* Mood */}
          <div className="card" style={{ padding: "20px 18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div className="section-label" style={{ margin: 0 }}>Today's mood</div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 800, color: "var(--ink-soft)" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: phaseChipColor }} />{info.phase.label}
              </span>
            </div>
            <MoodPicker value={mood == null ? null : mood} onChange={(l) => api.setMood(todayKey, l)} />
            <div style={{ marginTop: 16, fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
              {mood == null ? "Tap a face to log your mood." : info.phase.note}
            </div>
          </div>

          </div>
          <div className="col-right">

          {/* Weight */}
          <WeightCard data={data} api={api} />

          {/* Recent mood & phase */}
          <RecentStrip data={data} onDaySelect={setEditDay} />

          {/* Calendar */}
          <div className="card" style={{ padding: "22px 18px 22px" }}>
            <div className="section-label">Your month</div>
            <Calendar setup={data.setup} monthOffset={monthOffset} onNav={(d) => setMonthOffset(o => o + d)} info={info} mode={(tweaks && tweaks.calStyle) || "filled"} />
          </div>

          </div>
        </div>
        <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", margin: "0 0 4px", lineHeight: 1.5 }}>
          Estimates for wellness, not medical or contraceptive advice.
        </p>
      </div>

      {editDay && <DayEditSheet date={editDay} data={data} api={api} onClose={function() { setEditDay(null); }} />}
      {settings && <SettingsModal data={data} api={api} onClose={() => setSettings(false)} userId={userId} />}
    </div>
  );
}


export { Dashboard, LoginScreen };
