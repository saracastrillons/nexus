import { useEffect, useMemo, useRef, useState } from "react";
import GlobeGL from "react-globe.gl";
import SelectedEventCard from "./SelectedEventCard";
import { numeric, timestamp } from "./earthquakeData";
import { MAGNITUDE_CLASSES, eventId, magnitudeColor } from "../lib/seismic";

const PLATES_URL = "https://cdn.jsdelivr.net/gh/fraxen/tectonicplates@master/GeoJSON/PB2002_boundaries.json";
const TEXTURES = { night: "/textures/earth-night.jpg", satellite: "/textures/earth-blue-marble.jpg" };
const escape = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

let platesPromise = null;
const loadPlates = () => (platesPromise ??= fetch(PLATES_URL).then(response => response.ok ? response.json() : Promise.reject()).then(data => data.features.map(feature => feature.geometry.coordinates)).catch(() => { platesPromise = null; return []; }));

export default function Globe({ events, motion = true, focus, onSelect, height = 560 }) {
  const globeRef = useRef();
  const containerRef = useRef(null);
  const [width, setWidth] = useState(800);
  const [ready, setReady] = useState(false);
  const [picked, setPicked] = useState(null);
  const [lastFocus, setLastFocus] = useState(null);
  if (focus !== lastFocus) { setLastFocus(focus); if (focus?.event) setPicked(focus.event); }
  // Selection follows refreshed feed data and disappears if the event leaves the window.
  const selected = picked ? events.find(event => eventId(event) === eventId(picked)) ?? null : null;
  const setSelected = setPicked;
  const [rotating, setRotating] = useState(true);
  const [minimum, setMinimum] = useState(0);
  const [texture, setTexture] = useState("night");
  const [layers, setLayers] = useState({ plates: true, pulses: true, spikes: true });
  const [plates, setPlates] = useState([]);

  // "ALL" keeps every located event, including valid negative magnitudes.
  const visible = useMemo(() => events.filter(event => numeric(event.latitude) !== null && numeric(event.longitude) !== null && (minimum === 0 || (numeric(event.magnitude) ?? -Infinity) >= minimum)).sort((a, b) => (numeric(b.magnitude) ?? 0) - (numeric(a.magnitude) ?? 0)), [events, minimum]);
  const newest = useMemo(() => visible.reduce((max, event) => Math.max(max, timestamp(event.time) ?? 0), 0), [visible]);
  const pulses = useMemo(() => layers.pulses ? visible.filter(event => (numeric(event.magnitude) ?? 0) >= 4 || (timestamp(event.time) ?? 0) >= newest - 3600000).slice(0, 60) : [], [visible, layers.pulses, newest]);
  const selectedIndex = selected ? visible.findIndex(event => eventId(event) === eventId(selected)) : -1;

  useEffect(() => {
    const observer = new ResizeObserver(entries => { const next = entries[0].contentRect.width; if (next > 0) setWidth(next); });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    if (layers.plates) loadPlates().then(data => { if (active) setPlates(data); });
    return () => { active = false; };
  }, [layers.plates]);

  useEffect(() => {
    const controls = globeRef.current?.controls();
    if (!controls || !ready) return;
    controls.autoRotateSpeed = 0.35;
    controls.enableDamping = true;
    controls.autoRotate = motion && rotating && !selected;
  }, [motion, rotating, selected, ready]);

  const fly = (event, altitude = 1.45) => {
    setSelected(event);
    onSelect?.(event);
    if (event) globeRef.current?.pointOfView({ lat: numeric(event.latitude), lng: numeric(event.longitude), altitude }, motion ? 1800 : 0);
    else globeRef.current?.pointOfView({ altitude: 2.3 }, motion ? 1400 : 0);
  };

  // Camera follows external focus requests (ticker, palette, observatory).
  useEffect(() => {
    const event = focus?.event;
    if (event && ready) globeRef.current?.pointOfView({ lat: numeric(event.latitude), lng: numeric(event.longitude), altitude: 1.45 }, motion ? 1800 : 0);
  }, [focus, ready, motion]);

  const step = direction => {
    if (!visible.length) return;
    const index = selectedIndex < 0 ? 0 : (selectedIndex + direction + visible.length) % visible.length;
    fly(visible[index]);
  };
  const latest = () => fly(visible.reduce((best, event) => !best || (timestamp(event.time) ?? 0) > (timestamp(best.time) ?? 0) ? event : best, null));
  const globeHeight = Math.min(height, Math.max(340, width * 0.8));

  return <div className="nx-earth" style={{ height: globeHeight }}>
    <div ref={containerRef} className="nx-earth-canvas">
      <GlobeGL
        ref={globeRef}
        width={width}
        height={globeHeight}
        onGlobeReady={() => { setReady(true); globeRef.current?.pointOfView({ lat: 12, lng: -60, altitude: 2.3 }, 0); }}
        globeImageUrl={TEXTURES[texture]}
        bumpImageUrl="/textures/earth-topology.png"
        backgroundColor="rgba(0,0,0,0)"
        showAtmosphere
        atmosphereColor="#5fd4ff"
        atmosphereAltitude={0.2}
        pointsData={visible}
        pointLat="latitude"
        pointLng="longitude"
        pointColor={event => magnitudeColor(event.magnitude)}
        pointAltitude={event => layers.spikes ? Math.max(0.01, Math.pow(Math.max(numeric(event.magnitude) ?? 0, 0), 2) / 110) : 0.01}
        pointRadius={event => 0.18 + Math.max(numeric(event.magnitude) ?? 0, 0) * 0.09}
        pointResolution={10}
        pointsTransitionDuration={motion ? 900 : 0}
        onPointClick={event => fly(event)}
        pointLabel={event => `<div class="nx-globe-tip"><b style="color:${magnitudeColor(event.magnitude)}">M ${numeric(event.magnitude)?.toFixed(1) ?? "—"}</b><span>${escape(event.place || "Unknown location")}</span><small>${numeric(event.depth)?.toFixed(1) ?? "—"} km deep · ${timestamp(event.time) ? new Date(event.time).toUTCString().slice(5, 22) + " UTC" : "time unavailable"}</small></div>`}
        ringsData={pulses}
        ringLat="latitude"
        ringLng="longitude"
        ringColor={event => { const color = magnitudeColor(event.magnitude); return t => `${color}${Math.round((1 - t) * 255).toString(16).padStart(2, "0")}`; }}
        ringMaxRadius={event => 1.5 + Math.max(numeric(event.magnitude) ?? 0, 0) * 0.7}
        ringPropagationSpeed={motion ? 1.6 : 0}
        ringRepeatPeriod={event => 2600 - Math.min(6, numeric(event.magnitude) ?? 0) * 250}
        pathsData={layers.plates ? plates : []}
        pathPoints={coordinates => coordinates}
        pathPointLat={point => point[1]}
        pathPointLng={point => point[0]}
        pathColor={() => ["rgba(255,120,90,0.55)", "rgba(255,190,120,0.25)"]}
        pathStroke={0.6}
        pathDashLength={0.4}
        pathDashGap={0.06}
        pathDashAnimateTime={motion ? 24000 : 0}
        pathTransitionDuration={0}
      />
      {!ready && <div className="nx-earth-loading" role="status"><span />Calibrating planetary model…</div>}
    </div>

    <div className="nx-hud nx-hud-tl">
      <p className="nx-hud-title">MAGNITUDE SCALE</p>
      <ul className="nx-legend">{MAGNITUDE_CLASSES.map(item => <li key={item.id}><i style={{ background: item.color, boxShadow: `0 0 10px ${item.color}` }} />{item.label}</li>)}</ul>
      <p className="nx-hud-title">MINIMUM MAGNITUDE</p>
      <div className="nx-chips" role="group" aria-label="Minimum magnitude on globe">{[0, 2.5, 4, 5].map(value => <button key={value} type="button" aria-pressed={minimum === value} onClick={() => { setMinimum(value); setSelected(null); }}>{value ? `M${value}+` : "ALL"}</button>)}</div>
      <p className="nx-hud-title">LAYERS</p>
      <div className="nx-chips" role="group" aria-label="Globe layers">{[["plates", "Plates"], ["pulses", "Pulses"], ["spikes", "Spikes"]].map(([key, label]) => <button key={key} type="button" aria-pressed={layers[key]} onClick={() => setLayers(value => ({ ...value, [key]: !value[key] }))}>{label}</button>)}</div>
      <div className="nx-chips" role="group" aria-label="Globe imagery">{[["night", "Night"], ["satellite", "Satellite"]].map(([key, label]) => <button key={key} type="button" aria-pressed={texture === key} onClick={() => setTexture(key)}>{label}</button>)}</div>
    </div>

    <div className="nx-hud nx-hud-tr" aria-live="polite">
      <strong>{visible.length.toLocaleString()}</strong>
      <span>EVENTS PLOTTED</span>
      {visible[0] && <button type="button" className="nx-hud-link" onClick={() => fly(visible[0])}>◎ Strongest · M{numeric(visible[0].magnitude)?.toFixed(1)}</button>}
      {visible.length > 0 && <button type="button" className="nx-hud-link" onClick={latest}>◷ Most recent</button>}
    </div>

    <div className="nx-hud nx-hud-bl nx-hud-row">
      <button type="button" className="nx-hud-button" disabled={!motion || Boolean(selected)} onClick={() => setRotating(value => !value)} aria-label={rotating ? "Pause globe rotation" : "Resume globe rotation"}>{rotating && motion && !selected ? "❚❚" : "▶"}</button>
      <button type="button" className="nx-hud-button" onClick={() => fly(null)} aria-label="Return to global view">◎</button>
      <button type="button" className="nx-hud-button" onClick={() => step(-1)} disabled={!visible.length} aria-label="Previous event by magnitude">←</button>
      <button type="button" className="nx-hud-button" onClick={() => step(1)} disabled={!visible.length} aria-label="Next event by magnitude">→</button>
    </div>
    {layers.plates && <p className="nx-hud-credit">Plate boundaries · Bird (2003), PB2002</p>}

    {selected && <SelectedEventCard event={selected} index={selectedIndex} count={visible.length} width={width} onFirst={() => fly(visible[0])} onPrevious={() => step(-1)} onNext={() => step(1)} onClose={() => fly(null)} />}
  </div>;
}
