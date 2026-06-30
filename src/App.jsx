import React from 'react';
import { useStore, initSupabase } from './lib.js';
import { Dashboard, LoginScreen } from './Dashboard.jsx';
import { Onboarding } from './Onboarding.jsx';
import { useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio } from './tweaks.jsx';

const ACCENTS = {
  rose:  ["#ECA9BF", "#D4748F", "#D4748F", "#B85C77", "#F9C6D8", "#E79CB4"],
  coral: ["#F1B6A6", "#E08A84", "#DD8A86", "#C26F6B", "#F8CFC4", "#EBA398"],
  mauve: ["#D7B7DA", "#B97FAC", "#BE7CA0", "#9C5F86", "#E6CCEC", "#CDA3D4"],
};
const CORNERS = { soft: "26px", rounder: "34px", crisp: "16px" };

const TWEAK_DEFAULTS = {
  accent: ["#ECA9BF", "#D4748F", "#D4748F", "#B85C77", "#F9C6D8", "#E79CB4"],
  corners: "soft",
  calStyle: "dots",
};

export default function App() {
  const [userId, setUserId] = React.useState(null);
  const [authChecked, setAuthChecked] = React.useState(false);

  React.useEffect(() => {
    const sb = initSupabase();
    sb.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
      setAuthChecked(true);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const [data, api, ready] = useStore(userId);
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    const r = document.documentElement.style;
    const [ga, gb, rose, deep, pink, rose4] = t.accent || ACCENTS.rose;
    r.setProperty("--grad-a", ga); r.setProperty("--grad-b", gb);
    r.setProperty("--rose-500", rose); r.setProperty("--rose-600", deep);
    r.setProperty("--pink-300", pink); r.setProperty("--rose-400", rose4);
    r.setProperty("--r-card", CORNERS[t.corners] || "26px");
  }, [t.accent, t.corners]);

  return (
    <React.Fragment>
      {!authChecked
        ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted)', fontSize: 14 }}>Loading…</div>
        : !userId
          ? <LoginScreen />
          : !ready
            ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted)', fontSize: 14 }}>Loading…</div>
            : !data.setup
              ? <Onboarding onDone={api.setSetup} userId={userId} />
              : <Dashboard data={data} api={api} tweaks={t} userId={userId} />}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Accent" />
        <TweakColor label="Palette" value={t.accent}
          options={[ACCENTS.rose, ACCENTS.coral, ACCENTS.mauve]}
          onChange={(v) => setTweak("accent", v)} />
        <TweakSection label="Shape" />
        <TweakRadio label="Card corners" value={t.corners}
          options={["soft", "rounder", "crisp"]}
          onChange={(v) => setTweak("corners", v)} />
        <TweakSection label="Calendar" />
        <TweakRadio label="Phase style" value={t.calStyle}
          options={["filled", "dots"]}
          onChange={(v) => setTweak("calStyle", v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}
