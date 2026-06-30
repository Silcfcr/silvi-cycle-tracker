import React from 'react';
import { createClient } from '@supabase/supabase-js';

/* ════════════════════════════════════════════════════════════════
   lib.jsx — date math, cycle/phase prediction, persistent store
   Exposed on window for the other babel scripts.
   ════════════════════════════════════════════════════════════════ */
const DAY = 86400000;

const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const parseKey = (k) => { const [y,m,da] = k.split("-").map(Number); return new Date(y, m-1, da); };
const toKey = (d) => { const x = startOfDay(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`; };
const addDays = (d, n) => new Date(startOfDay(d).getTime() + n*DAY);
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_S = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const fmtLong = (d) => `${DOW[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
const fmtShort = (d) => `${MONTHS_S[d.getMonth()]} ${d.getDate()}`;

const PHASE = {
  period:     { key: "period",     label: "Period",          color: "var(--phase-period)",   bg: "var(--phase-period-bg)",  note: "Rest and be gentle with yourself." },
  follicular: { key: "follicular", label: "Follicular phase", color: "var(--phase-foll)",     bg: "var(--phase-foll-bg)",    note: "Energy is on the rise." },
  fertile:    { key: "fertile",    label: "Fertile window",   color: "var(--phase-fertile)",  bg: "var(--phase-fertile-bg)", note: "Higher chance of conception." },
  ovulation:  { key: "ovulation",  label: "Ovulation likely", color: "var(--phase-ovu)",      bg: "var(--phase-fertile-bg)", note: "Your most fertile day." },
  luteal:     { key: "luteal",     label: "Luteal phase",     color: "var(--phase-luteal-bg)",bg: "var(--phase-luteal-bg)",  note: "Winding down toward your period." },
};

/* Full cycle info for any date, given setup {lastStart, cycleLength, periodDuration} */
function cycleInfo(setup, date) {
  const L = setup.cycleLength, P = setup.periodDuration;
  const anchor = startOfDay(parseKey(setup.lastStart));
  const d = startOfDay(date);
  const n = Math.floor((d - anchor) / DAY);
  const offset = Math.floor(n / L);
  const dayInCycle = ((n % L) + L) % L + 1;          // 1..L
  const cycleStart = addDays(anchor, offset * L);
  const nextPeriod = addDays(cycleStart, L);
  const ovDay = Math.max(P + 1, L - 14);             // 1-indexed cycle day
  const ovulationDate = addDays(cycleStart, ovDay - 1);
  const fertileStart = Math.max(P + 1, ovDay - 5);
  const fertileEnd = ovDay;
  let key;
  if (dayInCycle <= P) key = "period";
  else if (dayInCycle === ovDay) key = "ovulation";
  else if (dayInCycle >= fertileStart && dayInCycle <= fertileEnd) key = "fertile";
  else if (dayInCycle < fertileStart) key = "follicular";
  else key = "luteal";
  return {
    dayInCycle, L, P, cycleStart, nextPeriod, ovDay, ovulationDate,
    fertileStart, fertileEnd, phase: PHASE[key],
    fertileStartDate: addDays(cycleStart, fertileStart - 1),
    fertileEndDate: addDays(cycleStart, fertileEnd - 1),
  };
}

/* Is `date` part of the NEXT predicted period (for calendar outline)? */
function isPredictedPeriod(setup, date) {
  const info = cycleInfo(setup, date);
  // a future cycle's period days, beyond today
  const todayInfo = cycleInfo(setup, new Date());
  return info.dayInCycle <= setup.periodDuration &&
         startOfDay(date) > startOfDay(new Date()) &&
         info.cycleStart > todayInfo.cycleStart;
}

function daysUntil(setup, refDate) {
  const info = cycleInfo(setup, refDate);
  return daysBetween(refDate, info.nextPeriod);
}

/* ── Persistent store ────────────────────────────────────────── */
const STORE_KEY = "silvi-tracker-v1";
function loadStore() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } }

const KG_TO_LB = 2.2046226218;
const toDisplayWeight = (kg, units) => units === "lb" ? kg * KG_TO_LB : kg;
const fromDisplayWeight = (v, units) => units === "lb" ? v / KG_TO_LB : v;

/* ── Supabase client ─────────────────────────────────────── */
const SUPABASE_URL = 'https://ldxdoakhykxztvqspswp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkeGRvYWtoeWt4enR2cXNwc3dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDA4NjIsImV4cCI6MjA5NjExNjg2Mn0.SUwVlwtaktPT_oxgpprCoXJ0yem2w6XmZaRTYdcC-4I';

let _sb = null;
function initSupabase() {
  if (!_sb) {
    _sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return _sb;
}

async function sendOTP(email) {
  const sb = initSupabase();
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

async function verifyOTP(email, token) {
  const sb = initSupabase();
  const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  return data.user;
}

async function migrateUserData(email, newId) {
  const sb = initSupabase();
  const { error } = await sb.rpc('migrate_to_auth_user', { p_email: email, p_new_id: newId });
  if (error) console.warn('Migration warning:', error.message);
}

async function ensureUserRow(userId, email) {
  const sb = initSupabase();
  // Run server-side migration first (handles old UUID → auth UUID, avoids email UNIQUE conflict)
  await migrateUserData(email, userId);
  // Check if row exists after migration
  const { data } = await sb.from('users').select('id').eq('id', userId).maybeSingle();
  if (!data) {
    const { error } = await sb.from('users')
      .insert({ id: userId, email, units: 'kg' })
      .select().single();
    if (error) throw error;
  }
}

async function loadFromSupabase(userId) {
  const sb = initSupabase();

  const [settingsRes, periodsRes, moodsRes, weightsRes, userRes, measurementsRes] = await Promise.all([
    sb.from('cycle_settings').select('*').eq('user_id', userId).maybeSingle(),
    sb.from('periods').select('*').eq('user_id', userId).order('started_at', { ascending: false }),
    sb.from('moods').select('*').eq('user_id', userId),
    sb.from('weights').select('*').eq('user_id', userId),
    sb.from('users').select('*').eq('id', userId).single(),
    sb.from('measurements').select('*').eq('user_id', userId),
  ]);
  const settings = settingsRes.data;
  const periods = periodsRes.data || [];
  const moodsArr = moodsRes.data || [];
  const weightsArr = weightsRes.data || [];
  const user = userRes.data;
  const measurementsArr = measurementsRes.data || [];

  let setup = null;
  if (periods.length > 0 || settings) {
    const lastPeriod = periods[0];
    let cycleLength = settings ? settings.cycle_length : 28;
    let periodDuration = settings ? settings.period_duration : 5;
    if (periods.length >= 2) {
      const gaps = [];
      for (let i = 0; i < periods.length - 1; i++) {
        const a = new Date(periods[i].started_at);
        const b = new Date(periods[i + 1].started_at);
        gaps.push(Math.round((a - b) / DAY));
      }
      cycleLength = Math.round(gaps.reduce((s, x) => s + x, 0) / gaps.length);
    }
    const completedPeriods = periods.filter(p => p.ended_at);
    if (completedPeriods.length >= 1) {
      const durations = completedPeriods.map(p =>
        Math.round((new Date(p.ended_at) - new Date(p.started_at)) / DAY) + 1
      );
      periodDuration = Math.round(durations.reduce((s, x) => s + x, 0) / durations.length);
    }
    setup = lastPeriod
      ? { lastStart: lastPeriod.started_at, cycleLength, periodDuration }
      : null;
  }

  const moods = {};
  moodsArr.forEach(m => { moods[m.date] = m.level; });
  const weights = {};
  weightsArr.forEach(w => { weights[w.date] = w.kg; });

  const measurements = {};
  measurementsArr.forEach(r => {
    measurements[r.date] = { waist: r.waist_cm, hips: r.hips_cm, arm: r.arm_cm, chest: r.chest_cm };
  });

  return { setup, moods, weights, units: user ? user.units : 'kg', periods, measurements };
}

/* ── useStore (Supabase-backed) ──────────────────────────── */
function useStore(userId) {
  const [ready, setReady] = React.useState(false);
  const [data, setData] = React.useState(() => {
    const s = loadStore();
    return {
      setup: s.setup || null,
      moods: s.moods || {},
      weights: s.weights || {},
      units: s.units || 'kg',
      periods: s.periods || [],
      measurements: s.measurements || {},
    };
  });

  React.useEffect(() => {
    if (!userId) { setReady(true); return; }
    const sb = initSupabase();
    if (!sb) { setReady(true); return; }
    loadFromSupabase(userId).then(remote => {
      if (!remote.measurements) remote.measurements = {};
      setData(remote);
      try { localStorage.setItem(STORE_KEY, JSON.stringify(remote)); } catch {}
    }).catch(console.error).finally(() => setReady(true));
  }, [userId]);

  React.useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch {}
  }, [data]);

  const sb = initSupabase();

  const api = React.useMemo(() => ({
    setSetup: async (setup) => {
      setData(d => ({ ...d, setup }));
    },
    logPeriodStart: async (startedAt) => {
      if (sb && userId) {
        const { data: row, error } = await sb.from('periods')
          .upsert({ user_id: userId, started_at: startedAt }, { onConflict: 'user_id,started_at' })
          .select().single();
        if (!error) {
          setData(d => {
            const periods = [row, ...d.periods.filter(p => p.started_at !== startedAt)];
            periods.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
            const lastPeriod = periods[0];
            const setup = lastPeriod ? { ...d.setup, lastStart: lastPeriod.started_at } : d.setup;
            return { ...d, periods, setup };
          });
        }
      }
    },
    logPeriodEnd: async (periodId, endedAt) => {
      if (sb && userId) {
        const { data: row, error } = await sb.from('periods')
          .update({ ended_at: endedAt })
          .eq('id', periodId)
          .select().single();
        if (!error) {
          setData(d => ({
            ...d,
            periods: d.periods.map(p => p.id === periodId ? row : p),
          }));
        }
      }
    },
    saveCycleSettings: async (cycleLength, periodDuration) => {
      if (sb && userId) {
        await sb.from('cycle_settings').upsert(
          { user_id: userId, cycle_length: cycleLength, period_duration: periodDuration, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
      }
      setData(d => ({ ...d, setup: d.setup ? { ...d.setup, cycleLength, periodDuration } : d.setup }));
    },
    setMood: async (key, level) => {
      if (sb && userId) {
        if (level == null) {
          await sb.from('moods').delete().eq('user_id', userId).eq('date', key);
        } else {
          await sb.from('moods').upsert({ user_id: userId, date: key, level }, { onConflict: 'user_id,date' });
        }
      }
      setData(d => {
        const moods = { ...d.moods };
        if (level == null) delete moods[key]; else moods[key] = level;
        return { ...d, moods };
      });
    },
    setWeight: async (key, val) => {
      if (sb && userId) {
        if (val == null || val === '' || isNaN(val)) {
          await sb.from('weights').delete().eq('user_id', userId).eq('date', key);
        } else {
          await sb.from('weights').upsert({ user_id: userId, date: key, kg: Number(val) }, { onConflict: 'user_id,date' });
        }
      }
      setData(d => {
        const w = { ...d.weights };
        if (val == null || val === '' || isNaN(val)) delete w[key]; else w[key] = Number(val);
        return { ...d, weights: w };
      });
    },
    setUnits: async (units) => {
      if (sb && userId) {
        await sb.from('users').update({ units }).eq('id', userId);
      }
      setData(d => ({ ...d, units }));
    },
    setMeasurement: async (date, field, val) => {
      const sb = initSupabase();
      if (sb && userId) {
        const row = { user_id: userId, date };
        row[field + '_cm'] = val == null || val === '' || isNaN(Number(val)) ? null : Number(val);
        await sb.from('measurements').upsert(row, { onConflict: 'user_id,date', ignoreDuplicates: false });
      }
      setData(d => {
        const measurements = { ...d.measurements };
        const cur = { ...(measurements[date] || {}) };
        if (val == null || val === '' || isNaN(Number(val))) {
          delete cur[field];
        } else {
          cur[field] = Number(val);
        }
        if (Object.keys(cur).length === 0) delete measurements[date];
        else measurements[date] = cur;
        return { ...d, measurements };
      });
    },
    reset: () => setData({ setup: null, moods: {}, weights: {}, units: 'kg', periods: [], measurements: {} }),
  }), [userId]);

  return [data, api, ready];
}

export {
  DAY, startOfDay, parseKey, toKey, addDays, daysBetween,
  MONTHS, MONTHS_S, DOW, fmtLong, fmtShort,
  PHASE, cycleInfo, isPredictedPeriod, daysUntil,
  KG_TO_LB, toDisplayWeight, fromDisplayWeight,
  initSupabase, sendOTP, verifyOTP, migrateUserData, ensureUserRow,
  loadFromSupabase,
  useStore,
};
