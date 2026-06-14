import React from 'react';
import {
  toDisplayWeight, toKey, parseKey, cycleInfo, isPredictedPeriod,
  MONTHS, DOW, PHASE, addDays, fmtLong, startOfDay, daysBetween,
} from './lib.js';

/* ════════════════════════════════════════════════════════════════
   ui.jsx — shared visual components (uses lib.jsx helpers on window)
   ════════════════════════════════════════════════════════════════ */

/* ── Mood face ──────────────────────────────────────────────── */
function FaceSvg({ level, color, size = 28 }) {
  const mouths = [
    "M8 17 q6 -5 12 0", "M8 16 q6 -2.5 12 0", "M8 15.5 h12",
    "M8 14.5 q6 3 12 0", "M8 13.5 q6 5.5 12 0",
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <circle cx="10" cy="10.5" r="1.1" fill={color} stroke="none" />
      <circle cx="18" cy="10.5" r="1.1" fill={color} stroke="none" />
      <path d={mouths[level]} />
    </svg>
  );
}

const MOOD_NAMES = ["Low", "Meh", "Okay", "Good", "Great"];

function MoodPicker({ value, onChange, size = 46 }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
      {[0,1,2,3,4].map(l => {
        const sel = value === l;
        return (
          <button key={l} className={"mood-opt" + (sel ? " sel" : "")} onClick={() => onChange(sel ? null : l)} aria-label={MOOD_NAMES[l]}>
            <span className={"face" + (sel ? " sel" : "")} style={{ width: size, height: size }}>
              <FaceSvg level={l} color={sel ? "#fff" : "var(--rose-500)"} size={size * 0.6} />
            </span>
            <span className="lbl">{MOOD_NAMES[l]}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Cycle phase ring ────────────────────────────────────────── */
function PhaseRing({ info, size = 200, thickness = 28 }) {
  const { L, P, ovDay, fertileStart, dayInCycle, phase } = info;
  const deg = (d) => (d / L) * 360;
  const C = {
    period: "#D4748F", foll: "#F4C9B9", fertile: "#C9A2D6", ovu: "#C26FA6", luteal: "#F3D9E2",
  };
  const segs = [
    [0, P, C.period],
    [P, fertileStart - 1, C.foll],
    [fertileStart - 1, ovDay - 1, C.fertile],
    [ovDay - 1, ovDay, C.ovu],
    [ovDay, L, C.luteal],
  ].filter(([a,b]) => b > a);
  const grad = "conic-gradient(" + segs.map(([a,b,c]) => `${c} ${deg(a)}deg ${deg(b)}deg`).join(", ") + ")";
  const theta = deg(dayInCycle - 0.5);
  const r = size/2 - thickness/2, cx = size/2, cy = size/2;
  const mx = cx + r * Math.sin(theta*Math.PI/180);
  const my = cy - r * Math.cos(theta*Math.PI/180);
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <div style={{ width: size, height: size, borderRadius: "50%", background: grad }} />
      <div style={{ position: "absolute", inset: thickness, borderRadius: "50%", background: "var(--white)", boxShadow: "inset 0 1px 8px rgba(180,120,140,.12)" }} />
      <div style={{ position: "absolute", left: mx, top: my, transform: "translate(-50%,-50%)",
        width: thickness - 6, height: thickness - 6, borderRadius: "50%", background: "#fff",
        border: "3px solid var(--phase-ovu)", boxShadow: "0 2px 7px rgba(180,120,140,.4)" }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: thickness }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, color: "var(--muted)", textTransform: "uppercase" }}>Cycle day</span>
        <span style={{ fontFamily: "var(--serif)", fontSize: size*0.26, lineHeight: 1, color: "var(--ink)" }}>{dayInCycle}</span>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: phase.key === "luteal" || phase.key === "follicular" ? "var(--rose-600)" : "var(--phase-ovu)" }}>{phase.label}</span>
      </div>
    </div>
  );
}

/* ── Horizontal cycle bar ────────────────────────────────────── */
function CycleBar({ info, width }) {
  const { L, P, fertileStart, ovDay, dayInCycle } = info;
  const pct = (d) => (d / L) * 100;
  const segs = [
    { from: 0, to: P, c: "var(--phase-period)" },
    { from: P, to: fertileStart - 1, c: "var(--phase-foll)" },
    { from: fertileStart - 1, to: ovDay, c: "var(--phase-fertile)" },
    { from: ovDay, to: L, c: "var(--phase-luteal-bg)" },
  ].filter(s => s.to > s.from);
  const markerL = pct(dayInCycle - 0.5);
  return (
    <div style={{ width: width || "100%" }}>
      <div style={{ position: "relative", height: 22 }}>
        <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", position: "absolute", bottom: 4, width: "100%", border: "1px solid var(--line-soft)" }}>
          {segs.map((s,i) => <div key={i} style={{ width: `${pct(s.to-s.from)}%`, background: s.c }} />)}
        </div>
        <div style={{ position: "absolute", left: `${markerL}%`, bottom: 0, transform: "translateX(-50%)" }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", border: "3px solid var(--phase-ovu)", boxShadow: "0 2px 5px rgba(180,120,140,.4)" }} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 9, fontSize: 9.5, fontWeight: 800, letterSpacing: .4, textTransform: "uppercase", color: "var(--muted)" }}>
        <span>Period</span><span>Follicular</span><span style={{ color: "var(--phase-ovu)" }}>Ovulation</span><span>Luteal</span>
      </div>
    </div>
  );
}

/* ── Month calendar (soft filled days) + cycle bar ───────────── */
function Calendar({ setup, monthOffset, onNav, info, mode = "filled" }) {
  const today = startOfDay(new Date());
  const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = base.getFullYear(), month = base.getMonth();
  const firstDow = base.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i+7));

  const C = { period: "#D4748F", periodBg: "var(--phase-period-bg)", fertileBg: "var(--phase-fertile-bg)", ovu: "var(--phase-ovu)" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button className="icon-btn" style={{ background: "var(--blush-50)", color: "var(--rose-500)", width: 34, height: 34 }} onClick={() => onNav(-1)} aria-label="Previous month">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 2L4 7l5 5"/></svg>
        </button>
        <div style={{ fontFamily: "var(--serif)", fontSize: 19, color: "var(--ink)" }}>{MONTHS[month]} {year}</div>
        <button className="icon-btn" style={{ background: "var(--blush-50)", color: "var(--rose-500)", width: 34, height: 34 }} onClick={() => onNav(1)} aria-label="Next month">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 2l5 5-5 5"/></svg>
        </button>
      </div>

      <table className="cal">
        <thead><tr>{["S","M","T","W","T","F","S"].map((d,i) => <th key={i}>{d}</th>)}</tr></thead>
        <tbody key={mode}>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((date, ci) => {
                if (!date) return <td key={ci}></td>;
                const ci2 = cycleInfo(setup, date);
                const ph = ci2.phase.key;
                const isToday = +startOfDay(date) === +today;
                const predicted = isPredictedPeriod(setup, date);
                const st = { background: "transparent", border: "none" };
                let color = "var(--ink-soft)";
                let dot = null;
                if (mode === "dots") {
                  const dotColor = ph === "period" ? C.period : ph === "ovulation" ? C.ovu : ph === "fertile" ? "var(--phase-fertile)" : ph === "follicular" ? "var(--phase-foll)" : null;
                  if (predicted) dot = <span className="dot" style={{ background: "transparent", border: "1.5px solid var(--phase-period)", width: 6, height: 6 }} />;
                  else if (dotColor) dot = <span className="dot" style={{ background: dotColor }} />;
                } else {
                  if (ph === "period") { st.background = C.periodBg; }
                  else if (ph === "ovulation") { st.background = C.ovu; color = "#fff"; }
                  else if (ph === "fertile") { st.background = C.fertileBg; }
                  if (predicted) { st.background = "transparent"; st.border = "1.5px dashed var(--phase-period)"; }
                }
                return (
                  <td key={ci}>
                    <div className={"day" + (isToday ? " today-ring" : "")} style={{ ...st, color, fontWeight: isToday ? 800 : 600 }}>
                      {date.getDate()}{dot}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ margin: "18px 0", height: 1, background: "var(--line)" }} />
      {info && <CycleBar info={info} />}

      <div style={{ marginTop: 18 }}>
        <div className="legend">
          <div className="item"><span className="sw" style={{ background: "var(--phase-period)" }} />Period</div>
          <div className="item"><span className="sw" style={{ background: "var(--phase-fertile)" }} />Fertile window</div>
          <div className="item"><span className="sw" style={{ background: "var(--phase-ovu)" }} />Ovulation</div>
          <div className="item"><span className="sw" style={{ background: "transparent", border: "1.5px dashed var(--phase-period)" }} />Predicted</div>
        </div>
      </div>
    </div>
  );
}

/* ── Weight line chart ───────────────────────────────────────── */
function WeightChart({ entries, units, measurements }) {
  const W = 300, H = 170, padL = 40, padR = 40, padT = 18, padB = 18;
  const CM_MIN = 25, CM_MAX = 105;

  const MEAS_FIELDS = [
    { key: 'waist', label: 'Waist', color: '#a855f7' },
    { key: 'hips',  label: 'Hips',  color: '#f97316' },
    { key: 'arm',   label: 'Arm',   color: '#14b8a6' },
    { key: 'chest', label: 'Chest', color: '#3b82f6' },
  ];

  const meas = measurements || {};
  const measDates = Object.keys(meas);
  const allDates = [...new Set([...entries.map(e => e.key), ...measDates])].sort();
  const n = allDates.length;
  if (n === 0) return null;

  const xPos = i => padL + (n === 1 ? (W - padL - padR) / 2 : (i / (n - 1)) * (W - padL - padR));
  const dateIndex = Object.fromEntries(allDates.map((d, i) => [d, i]));

  // Left axis: weight
  const wVals = entries.map(e => toDisplayWeight(e.kg, units));
  let wMin = Math.min(...wVals), wMax = Math.max(...wVals);
  if (wMin === wMax) { wMin -= 1; wMax += 1; }
  const wSpan = wMax - wMin;
  wMin -= wSpan * 0.15; wMax += wSpan * 0.15;
  const wY = v => padT + (1 - (v - wMin) / (wMax - wMin)) * (H - padT - padB);
  const wPts = entries.map(e => [xPos(dateIndex[e.key]), wY(toDisplayWeight(e.kg, units))]);
  const wLine = wPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const wArea = wPts.length > 1
    ? `${wLine} L${wPts[wPts.length-1][0].toFixed(1)} ${H-padB} L${wPts[0][0].toFixed(1)} ${H-padB} Z`
    : null;

  // Right axis: fixed 25–105 cm, gridlines every 10cm
  const cY = v => padT + (1 - (v - CM_MIN) / (CM_MAX - CM_MIN)) * (H - padT - padB);
  const cmSteps = [];
  for (let v = CM_MIN; v <= CM_MAX; v += 10) cmSteps.push(v);
  // Show labels every 20cm: 25, 45, 65, 85, 105
  const cmLabels = cmSteps.filter(v => (v - CM_MIN) % 20 === 0);

  const measWithLines = MEAS_FIELDS.map(({ key, label, color }) => {
    const pts = [];
    allDates.forEach((d, i) => {
      const v = (meas[d] || {})[key];
      if (v != null) pts.push([xPos(i), cY(Number(v))]);
    });
    if (pts.length === 0) return null;
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    return { key, label, color, pts, line };
  }).filter(Boolean);

  const hasMeas = measWithLines.length > 0;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="wfill2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--pink-300)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--pink-300)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* cm gridlines every 10cm */}
        {cmSteps.map(v => (
          <line key={v} x1={padL} x2={W - padR} y1={cY(v)} y2={cY(v)}
            stroke="var(--line-soft)" strokeWidth={v % 20 === (CM_MIN % 20) ? "1" : "0.5"} />
        ))}

        {/* axis lines */}
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--line-soft)" strokeWidth="1" />
        {hasMeas && <line x1={W - padR} y1={padT} x2={W - padR} y2={H - padB} stroke="var(--line-soft)" strokeWidth="1" />}

        {/* right axis: tick marks + labels every 20cm */}
        {hasMeas && cmLabels.map(v => (
          <g key={v}>
            <line x1={W - padR} x2={W - padR + 4} y1={cY(v)} y2={cY(v)} stroke="#d1d5db" strokeWidth="1.5" />
            <text x={W - padR + 7} y={cY(v) + 3.5} textAnchor="start" fontFamily="var(--sans)" fontSize="9.5" fill="#9ca3af">{v}</text>
          </g>
        ))}

        {/* left axis: 3 weight labels */}
        {[wMax, (wMin + wMax) / 2, wMin].map((v, i) => (
          <g key={i}>
            <line x1={padL - 4} x2={padL} y1={wY(v)} y2={wY(v)} stroke="var(--rose-300)" strokeWidth="1.5" />
            <text x={padL - 7} y={wY(v) + 3.5} textAnchor="end" fontFamily="var(--sans)" fontSize="9.5" fill="var(--rose-400)">{v.toFixed(1)}</text>
          </g>
        ))}

        {/* axis unit labels */}
        <text x={padL} y={padT - 5} textAnchor="middle" fontFamily="var(--sans)" fontSize="9" fontWeight="700" fill="var(--rose-400)">{units}</text>
        {hasMeas && <text x={W - padR} y={padT - 5} textAnchor="middle" fontFamily="var(--sans)" fontSize="9" fontWeight="700" fill="#9ca3af">cm</text>}

        {/* weight area + line */}
        {wArea && <path d={wArea} fill="url(#wfill2)" />}
        <path d={wLine} fill="none" stroke="var(--rose-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {wPts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={i === wPts.length - 1 ? 4 : 2.5}
            fill={i === wPts.length - 1 ? 'var(--rose-500)' : 'var(--white)'}
            stroke="var(--rose-500)" strokeWidth="1.5" />
        ))}

        {/* measurement lines */}
        {measWithLines.map(s => (
          <g key={s.key}>
            {s.pts.length > 1 && <path d={s.line} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
            {s.pts.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={i === s.pts.length - 1 ? 3.5 : 2}
                fill={i === s.pts.length - 1 ? s.color : 'var(--white)'}
                stroke={s.color} strokeWidth="1.5" />
            ))}
          </g>
        ))}
      </svg>

      {hasMeas && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 12px', marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="16" height="3"><line x1="0" y1="1.5" x2="16" y2="1.5" stroke="var(--rose-500)" strokeWidth="2.5" /></svg>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Weight</span>
          </div>
          {measWithLines.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="16" height="3"><line x1="0" y1="1.5" x2="16" y2="1.5" stroke={s.color} strokeWidth="2" /></svg>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Number stepper ──────────────────────────────────────────── */
function Stepper({ value, onChange, min, max, suffix }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - 1))} aria-label="decrease">–</button>
      <div className="val">{value} <small>{suffix}</small></div>
      <button onClick={() => onChange(Math.min(max, value + 1))} aria-label="increase">+</button>
    </div>
  );
}


export { FaceSvg, MOOD_NAMES, MoodPicker, PhaseRing, CycleBar, Calendar, WeightChart, Stepper };
