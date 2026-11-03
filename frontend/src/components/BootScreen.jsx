import { useEffect, useState } from "react";
import { fetchJSON } from "../services/api";

import { SEEN_KEY } from "../lib/session";

// Cinematic start-up sequence that runs real health checks against the API.
export default function BootScreen({ onDone }) {
  const [lines, setLines] = useState([]);
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let active = true;
    const push = (label, state) => active && setLines(previous => [...previous, { label, state }]);
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    async function run() {
      push("Initialising planetary observation kernel", "OK");
      setProgress(18);
      await wait(260);
      let status = null;
      try { status = await fetchJSON("/api/system/status", { timeout: 4000 }); } catch { /* reported below */ }
      push("Handshake with NEXUS API", status ? `v${status.version}` : "OFFLINE");
      setProgress(42);
      await wait(220);
      push(`Database link · ${status?.services?.database_engine ?? "unknown"}`, status?.services?.database === "online" ? "ONLINE" : "DEGRADED");
      setProgress(64);
      await wait(220);
      push("Seismic feed · USGS FDSN", "STREAMING");
      push("Atmospheric feed · Open-Meteo", "STREAMING");
      setProgress(84);
      await wait(220);
      push("Intelligence module · Gemini", status?.services?.ai === "configured" ? "ARMED" : "STANDBY");
      setProgress(100);
      await wait(520);
      if (!active) return;
      setLeaving(true);
      try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* storage unavailable */ }
      await wait(650);
      if (active) onDone();
    }
    run();
    return () => { active = false; };
  }, [onDone]);

  const skip = () => { try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* storage unavailable */ } onDone(); };

  return <div className={`nx-boot ${leaving ? "nx-boot-leave" : ""}`} role="dialog" aria-label="NEXUS is starting" aria-live="polite">
    <div className="nx-boot-core">
      <div className="nx-boot-orbit" aria-hidden="true"><span /><span /><span /><i>✦</i></div>
      <h1 className="nx-boot-title">NEX<span>US</span></h1>
      <p className="nx-boot-sub">GLOBAL INTELLIGENCE · PLANETARY OBSERVATION SYSTEM</p>
      <div className="nx-boot-bar" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
      <ul className="nx-boot-log">{lines.map(line => <li key={line.label}><span>› {line.label}</span><b className={/OFFLINE|DEGRADED/.test(line.state) ? "nx-boot-warn" : ""}>{line.state}</b></li>)}</ul>
    </div>
    <button type="button" className="nx-boot-skip" onClick={skip}>Skip intro ↵</button>
  </div>;
}
