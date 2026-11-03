import { fetchJSON } from "./services/api";
import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useEarthquakes from "./hooks/useEarthquakes";
import BootScreen from "./components/BootScreen";
import { shouldBoot } from "./lib/session";
import Starfield from "./components/Starfield";
import CommandPalette from "./components/CommandPalette";
import Ticker from "./components/Ticker";
import { Clock, CountUp, Kbd, Since, Sparkline } from "./components/ui";
import { numeric } from "./components/earthquakeData";
import { WINDOWS, magnitudeColor, relativeTime, summarize, timeline } from "./lib/seismic";
const MagnitudeChart = lazy(() => import("./components/MagnitudeChart"));
const Globe = lazy(() => import("./components/Globe"));
const EarthquakeTable = lazy(() => import("./components/EarthquakeTable"));
const WeatherPanel = lazy(() => import("./components/WeatherPanel"));
const AIChat = lazy(() => import("./components/AIChat"));
const SeismicCharts = lazy(() => import("./components/SeismicCharts").then(module => ({ default: ({ kind, ...props }) => { const Chart = module[kind]; return <Chart {...props} />; } })));

const sections = [
  ["Dashboard", "◈", "Command center", "Command", "Center"],
  ["Earthquakes", "◎", "Seismic observatory", "Seismic", "Observatory"],
  ["Weather", "☁", "Atmospheric intelligence", "Atmospheric", "Intelligence"],
  ["AI Assistant", "✦", "Explore with intelligence", "NEXUS", "Intelligence"],
];

class PanelBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="nx-empty" role="alert">This visualization could not be displayed.<button className="nx-button" onClick={() => this.setState({ failed: false })}>Try again</button></div> : this.props.children;
  }
}

function useResource(path, select, enabled = true) {
  const [state, setState] = useState({ data: null, busy: true, error: null, updated: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let running = false;
    async function load() {
      if (running) return;
      running = true;
      setState(previous => ({ ...previous, busy: true }));
      try {
        const data = select(await fetchJSON(path, { signal: controller.signal }));
        if (!controller.signal.aborted) setState({ data, busy: false, error: null, updated: new Date() });
      } catch (error) {
        if (!controller.signal.aborted) setState(previous => ({ ...previous, busy: false, error: error.message }));
      } finally { running = false; }
    }
    load();
    const timer = setInterval(load, 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [path, select, revision, enabled]);
  return { ...state, refresh: useCallback(() => setRevision(value => value + 1), []) };
}

const selectStats = value => {
  if (!value || !["total_earthquakes", "max_magnitude", "avg_magnitude"].every(key => value[key] === null || (typeof value[key] === "number" && Number.isFinite(value[key])))) throw new Error("Invalid statistics response");
  return value;
};
const selectDistribution = value => {
  if (!value || !value.distribution || typeof value.distribution !== "object") throw new Error("Invalid magnitude distribution response");
  return value.distribution;
};
const selectStatus = value => value?.services ? value : (() => { throw new Error("Invalid status response"); })();
const clock = (date, timeZone) => date.toLocaleTimeString("en-GB", { hour12: false, timeZone });

function Panel({ eyebrow, title, extra, children, className = "" }) {
  return <section className={`nx-panel ${className}`}><div className="nx-panel-heading"><div><p className="nx-eyebrow">{eyebrow}</p><h3>{title}</h3></div>{extra}</div><PanelBoundary><Suspense fallback={<div className="nx-empty nx-shimmer" role="status">Loading workspace…</div>}>{children}</Suspense></PanelBoundary></section>;
}

function Kpi({ label, value, digits, unit, color, footer, spark, motion }) {
  return <article className="nx-kpi" style={{ "--accent": color }}>
    <div className="nx-kpi-top"><span className="nx-label">{label}</span></div>
    <div className="nx-kpi-value"><CountUp value={value} digits={digits} motion={motion} /><span className="nx-kpi-unit">{unit}</span></div>
    {spark && <Sparkline values={spark} color={color} />}
    <div className="nx-kpi-bottom">{footer}</div>
  </article>;
}

function App() {
  const [booting, setBooting] = useState(shouldBoot);
  const [active, setActive] = useState("Dashboard");
  const [motion, setMotion] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [feedWindow, setFeedWindow] = useState("day");
  const [focus, setFocus] = useState(null);
  const [weatherQuery, setWeatherQuery] = useState(null);
  const [observatorySearch, setObservatorySearch] = useState("");
  const [aiDraft, setAiDraft] = useState(null);
  const [toasts, setToasts] = useState([]);
  const mainHeading = useRef(null);
  const finishBoot = useCallback(() => setBooting(false), []);

  const pushToast = useCallback(toast => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(previous => [...previous.slice(-2), { ...toast, id }]);
    setTimeout(() => setToasts(previous => previous.filter(item => item.id !== id)), 9000);
  }, []);
  const onNewEvents = useCallback(fresh => {
    const notable = fresh.filter(event => (numeric(event.magnitude) ?? 0) >= 4.5).sort((a, b) => numeric(b.magnitude) - numeric(a.magnitude));
    if (notable[0]) pushToast({ event: notable[0], title: `New M${numeric(notable[0].magnitude).toFixed(1)} event detected`, body: notable[0].place || "Unknown location" });
  }, [pushToast]);

  const feed = useEarthquakes(feedWindow, { onNewEvents });
  const stats = useResource("/api/earthquakes/stats", selectStats, active === "Dashboard");
  const distribution = useResource("/api/earthquakes/magnitude-distribution", selectDistribution, active === "Dashboard");
  const status = useResource("/api/system/status", selectStatus);
  const summary = useMemo(() => summarize(feed.events), [feed.events]);
  const spark = useMemo(() => timeline(feed.events, WINDOWS[feedWindow].hours, feed.updated?.getTime() ?? 0, 24).map(bucket => bucket.count), [feed.events, feed.updated, feedWindow]);
  const section = sections.find(([name]) => name === active);

  const navigate = useCallback(name => { setActive(name); window.scrollTo({ top: 0, behavior: "instant" }); requestAnimationFrame(() => mainHeading.current?.focus({ preventScroll: true })); }, []);
  const locate = useCallback(event => { if (!event) return; navigate("Dashboard"); setFocus({ event, nonce: Date.now() }); }, [navigate]);
  const refreshAll = useCallback(() => { feed.refresh(); stats.refresh(); distribution.refresh(); status.refresh(); }, [feed, stats, distribution, status]);

  useEffect(() => {
    const onKey = event => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen(value => !value); return; }
      if (typing || event.ctrlKey || event.metaKey || event.altKey || booting) return;
      if (event.key === "/") { event.preventDefault(); setPaletteOpen(true); }
      const index = Number(event.key) - 1;
      if (index >= 0 && index < sections.length) navigate(sections[index][0]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, booting]);

  const commands = useMemo(() => [
    ...sections.map(([name, icon, subtitle], index) => ({ group: "Navigate", label: name, detail: subtitle, icon, hint: String(index + 1), run: () => navigate(name) })),
    ...Object.entries(WINDOWS).map(([key, value]) => ({ group: "Seismic window", label: `Show ${value.title.toLowerCase()}`, icon: "◷", keywords: "time range feed window", run: () => setFeedWindow(key) })),
    { group: "Actions", label: "Fly to the strongest event", icon: "◎", keywords: "globe locate magnitude", run: () => locate(summary.strongest) },
    { group: "Actions", label: "Fly to the most recent event", icon: "◷", keywords: "globe locate latest", run: () => locate(summary.latest) },
    { group: "Actions", label: "Refresh all data", icon: "↻", keywords: "reload sync", run: refreshAll },
    { group: "Actions", label: motion ? "Pause interface motion" : "Resume interface motion", icon: "◐", keywords: "animation reduce accessibility", run: () => setMotion(value => !value) },
    { group: "Actions", label: "Replay start-up sequence", icon: "✦", keywords: "boot intro", run: () => setBooting(true) },
  ], [navigate, locate, summary, refreshAll, motion]);

  const dynamicCommands = useCallback(query => {
    const text = query.toLowerCase();
    const matches = feed.events.filter(event => String(event.place ?? "").toLowerCase().includes(text)).sort((a, b) => (numeric(b.magnitude) ?? 0) - (numeric(a.magnitude) ?? 0)).slice(0, 4);
    return [
      ...matches.map(event => ({ group: "Seismic events", label: event.place || "Unknown location", detail: `M ${numeric(event.magnitude)?.toFixed(1) ?? "—"} · ${relativeTime(event.time)}`, icon: "●", color: magnitudeColor(event.magnitude), run: () => locate(event) })),
      { group: "Search", label: `Weather in “${query}”`, icon: "☁", run: () => { setWeatherQuery({ text: query, nonce: Date.now() }); navigate("Weather"); } },
      { group: "Search", label: `Seismic events matching “${query}”`, icon: "◎", run: () => { setObservatorySearch(query); navigate("Earthquakes"); } },
      { group: "Search", label: `Ask NEXUS AI about “${query}”`, icon: "✦", run: () => { setAiDraft({ text: query, nonce: Date.now() }); navigate("AI Assistant"); } },
    ];
  }, [feed.events, locate, navigate]);

  const services = status.data?.services;
  const pills = [
    ["API", status.error ? "error" : status.data ? "ok" : "pending"],
    ["USGS", feed.error ? "error" : feed.updated ? "ok" : "pending"],
    ["DB", services ? services.database === "online" ? "ok" : "error" : "pending"],
    ["AI", services ? services.ai === "configured" ? "ok" : "idle" : "pending"],
  ];
  const strongest = summary.strongest;
  const latest = summary.latest;

  return <div className={`nx-app ${!motion ? "nx-still" : ""}`}>
    <Starfield motion={motion && !booting} />
    <div className="nx-aurora" aria-hidden="true" />
    {booting && <BootScreen onDone={finishBoot} />}
    <a className="nx-skip" href="#main">Skip to content</a>

    <aside className="nx-sidebar">
      <a className="nx-brand" href="#main" onClick={() => navigate("Dashboard")}><span className="nx-brand-mark" aria-hidden="true"><i />✦</span><span>NEX<span className="nx-cyan">US</span><small>GLOBAL INTELLIGENCE</small></span></a>
      <button type="button" className="nx-search-trigger" onClick={() => setPaletteOpen(true)}><span aria-hidden="true">⌕</span>Search or jump to…<span className="nx-search-keys"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span></button>
      <p className="nx-nav-label">OPERATIONS</p>
      <nav aria-label="Main navigation">{sections.map(([name, icon, subtitle], index) => <button key={name} onClick={() => navigate(name)} aria-current={active === name ? "page" : undefined}><span className="nx-nav-icon" aria-hidden="true">{icon}</span><span>{name}<small>{subtitle}</small></span><Kbd>{index + 1}</Kbd></button>)}</nav>
      <div className="nx-sidebar-bottom">
        <p className="nx-nav-label">SYSTEM TELEMETRY</p>
        <ul className="nx-telemetry">{pills.map(([name, state]) => <li key={name} className={`nx-state-${state}`}><i />{name}<span>{state === "ok" ? "ONLINE" : state === "error" ? "FAULT" : state === "idle" ? "STANDBY" : "SYNC"}</span></li>)}</ul>
        <p className="nx-version">v{status.data?.version ?? "2.0.0"} · uptime {status.data ? `${Math.floor(status.data.uptime_seconds / 60)}m` : "—"}</p>
      </div>
    </aside>

    <main id="main" className={`nx-main ${active === "AI Assistant" ? "nx-chat-page" : ""}`}>
      <div className="nx-topbar">
        <p className="nx-crumbs">NEXUS <span>/</span> MISSION CONTROL <span>/</span> <b>{active.toUpperCase()}</b></p>
        <div className="nx-clocks">
          <Clock label="UTC" timeZone="UTC" />
          <Clock label="LOCAL" />
          <button type="button" className="nx-icon-button" aria-pressed={!motion} onClick={() => setMotion(value => !value)} title={motion ? "Pause interface motion" : "Resume interface motion"} aria-label={motion ? "Pause interface motion" : "Resume interface motion"}>{motion ? "◐" : "◑"}</button>
          <button type="button" className="nx-icon-button nx-mobile-only" onClick={() => setPaletteOpen(true)} aria-label="Open command palette">⌕</button>
        </div>
      </div>
      <Ticker events={feed.events} onSelect={locate} />

      <header className="nx-header">
        <div><p className="nx-eyebrow">{section[2].toUpperCase()}</p><h1 tabIndex="-1" ref={mainHeading}>{section[3]} <span>{section[4]}</span></h1><p className="nx-subtitle">{active === "Dashboard" ? "Real-time seismic activity on a living planet — observed, measured and explained." : active === "Earthquakes" ? "Filter, sort and export every event in the live USGS window." : active === "Weather" ? "Observations, forecasts and air quality for any place on Earth." : "Ask questions grounded in the live data NEXUS observes."}</p></div>
        {(active === "Dashboard" || active === "Earthquakes") && <div className="nx-header-actions">
          <div className="nx-segmented" role="group" aria-label="Seismic time window">{Object.entries(WINDOWS).map(([key, value]) => <button key={key} type="button" aria-pressed={feedWindow === key} title={value.title} onClick={() => setFeedWindow(key)}>{value.label}</button>)}</div>
          <button className="nx-button nx-primary" disabled={feed.busy} onClick={refreshAll}><span className={feed.busy ? "nx-spin" : ""}>↻</span> {feed.busy ? "Syncing" : "Refresh"}</button>
        </div>}
      </header>

      {active === "Dashboard" ? <div className="nx-dashboard">
        {feed.error && <p className="nx-notice" role="alert">Live seismic feed unavailable: {feed.error} {feed.events.length ? "Showing the last successful response." : ""}</p>}
        <div className="nx-hero-grid">
          <Panel className="nx-globe-panel" eyebrow={`01 / PLANETARY OBSERVATION · ${WINDOWS[feedWindow].title.toUpperCase()}`} title="Global seismic activity" extra={<span className={`nx-live ${feed.error ? "nx-error" : feed.busy ? "nx-pending" : ""}`}><i />{feed.error ? "FEED ERROR" : feed.busy ? "SYNCING" : `LIVE · ${feed.updated ? clock(feed.updated, "UTC") : "—"} UTC`}</span>}>
            <Globe events={feed.events} motion={motion} focus={focus} height={640} />
          </Panel>
          <div className="nx-pulse">
            <div className="nx-kpis">
              <Kpi label="Events detected" value={summary.count} unit={WINDOWS[feedWindow].label} color="#6ae5ee" spark={spark} motion={motion} footer={<span>Activity across {WINDOWS[feedWindow].title.toLowerCase()}</span>} />
              <Kpi label="Strongest" value={numeric(strongest?.magnitude)} digits={1} unit="MAG" color={magnitudeColor(strongest?.magnitude)} motion={motion} footer={<button type="button" className="nx-link" disabled={!strongest} onClick={() => locate(strongest)}>{strongest?.place ?? "—"} ↗</button>} />
              <Kpi label="Mean magnitude" value={summary.average} digits={2} unit="MAG" color="#a99bff" motion={motion} footer={<span>Mean depth {summary.averageDepth == null ? "—" : `${summary.averageDepth.toFixed(1)} km`}</span>} />
              <Kpi label="Significant ≥ M4.5" value={summary.significant} unit="EVENTS" color="#f7834e" motion={motion} footer={<span>{summary.tsunami ? `⚠ ${summary.tsunami} tsunami flag${summary.tsunami > 1 ? "s" : ""}` : "No tsunami flags in window"}</span>} />
            </div>
            <section className="nx-signal" style={{ "--accent": magnitudeColor(latest?.magnitude) }} aria-label="Most recent signal">
              <p className="nx-eyebrow"><i className="nx-ping" /> MOST RECENT SIGNAL · {latest ? <Since time={latest.time} upper /> : "—"}</p>
              <div className="nx-signal-body"><strong>{numeric(latest?.magnitude)?.toFixed(1) ?? "—"}</strong><div><h4>{latest?.place ?? "Awaiting seismic signal"}</h4><p>{latest ? `${numeric(latest.depth)?.toFixed(1) ?? "—"} km deep · ${new Date(latest.time).toUTCString().slice(17, 25)} UTC · ${latest.magnitude_type?.toUpperCase() ?? "MAG"}` : "The live feed will appear here."}</p></div></div>
              <div className="nx-signal-actions"><button type="button" className="nx-button nx-primary" disabled={!latest} onClick={() => locate(latest)}>◎ Locate on globe</button>{latest?.url && <a className="nx-button" href={latest.url} target="_blank" rel="noopener noreferrer">USGS ↗</a>}</div>
            </section>
          </div>
        </div>
        <div className="nx-bento">
          <Panel className="nx-span-8" eyebrow="02 / TEMPORAL SIGNAL" title="Activity timeline" extra={<span className="nx-tag">{WINDOWS[feedWindow].title.toUpperCase()}</span>}><SeismicCharts kind="ActivityTimeline" events={feed.events} hours={WINDOWS[feedWindow].hours} motion={motion} /></Panel>
          <Panel className="nx-span-4" eyebrow="03 / GEOGRAPHY" title="Regional hotspots" extra={<span className="nx-tag">BY EVENT COUNT</span>}><SeismicCharts kind="Hotspots" events={feed.events} onPick={region => { setObservatorySearch(region); navigate("Earthquakes"); }} /></Panel>
          <Panel className="nx-span-6" eyebrow="04 / CRUSTAL PROFILE" title="Depth vs magnitude"><SeismicCharts kind="DepthScatter" events={feed.events} motion={motion} /></Panel>
          <Panel className="nx-span-6" eyebrow="05 / NEXUS ARCHIVE" title="Stored magnitude distribution" extra={<span className="nx-tag">{distribution.error ? "UPDATE FAILED" : `${stats.data?.total_earthquakes?.toLocaleString() ?? "—"} ARCHIVED`}</span>}>
            <div className="nx-archive-stats"><span>Max <b>{stats.data?.max_magnitude?.toFixed(1) ?? "—"}</b></span><span>Mean <b>{stats.data?.avg_magnitude?.toFixed(2) ?? "—"}</b></span><span>Every event NEXUS has observed, deduplicated in the database.</span></div>
            {distribution.data ? <MagnitudeChart data={distribution.data} motion={motion} /> : <div className="nx-empty">{distribution.busy ? "Receiving magnitude data…" : "No magnitude data available"}</div>}
          </Panel>
        </div>
      </div> : <Panel key={active} className={`nx-workspace ${active === "AI Assistant" ? "nx-chat-workspace" : ""}`} eyebrow="NEXUS / INTELLIGENCE WORKSPACE" title={section[2]}>{active === "Earthquakes" ? <div className="nx-observatory">
          <div className="nx-bento nx-bento-tight">
            <div className="nx-span-8"><SeismicCharts kind="ActivityTimeline" events={feed.events} hours={WINDOWS[feedWindow].hours} motion={motion} /></div>
            <div className="nx-span-4"><SeismicCharts kind="Hotspots" events={feed.events} onPick={setObservatorySearch} /></div>
          </div>
          <EarthquakeTable key={observatorySearch} events={feed.events} loading={feed.busy} error={feed.error} updated={feed.updated} onRefresh={feed.refresh} onLocate={locate} search={observatorySearch} windowTitle={WINDOWS[feedWindow].title} />
        </div> : active === "Weather" ? <WeatherPanel key={weatherQuery?.nonce ?? "default"} motion={motion} query={weatherQuery} /> : <AIChat key={aiDraft?.nonce ?? "chat"} draft={aiDraft?.text} />}</Panel>}
      <footer className="nx-footer"><span><b>✦ NEXUS</b> · Global Intelligence</span><span>Data · USGS Earthquake Hazards Program <i /> Open-Meteo <i /> Google Gemini</span><span>Press <Kbd>Ctrl</Kbd><Kbd>K</Kbd> for commands</span></footer>
    </main>

    {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} commands={commands} dynamic={dynamicCommands} />}
    <div className="nx-toasts" aria-live="polite">{toasts.map(toast => <div className="nx-toast" key={toast.id} style={{ "--accent": magnitudeColor(toast.event?.magnitude) }}>
      <span className="nx-toast-mark" aria-hidden="true">●</span>
      <div><strong>{toast.title}</strong><p>{toast.body}</p></div>
      {toast.event && <button type="button" className="nx-button" onClick={() => { locate(toast.event); setToasts(previous => previous.filter(item => item.id !== toast.id)); }}>Locate</button>}
      <button type="button" className="nx-toast-close" aria-label="Dismiss notification" onClick={() => setToasts(previous => previous.filter(item => item.id !== toast.id))}>×</button>
    </div>)}</div>
  </div>;
}

export default App;
