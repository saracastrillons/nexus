import { formatMeasurement } from "./measurements";
import { magnitudeColor, relativeTime } from "../lib/seismic";

export default function SelectedEventCard({ event, index, count, width, onClose, onFirst, onPrevious, onNext }) {
  const magnitude = formatMeasurement(event.magnitude);
  const depth = formatMeasurement(event.depth, 1);
  const latitude = formatMeasurement(event.latitude, 4);
  const longitude = formatMeasurement(event.longitude, 4);
  const date = event.time ? new Date(event.time) : null;
  const validDate = date && Number.isFinite(date.getTime());
  const accent = magnitudeColor(event.magnitude);

  return <section className="nx-event-card" aria-label="Selected seismic event" style={{ "--event-accent": accent, width: Math.min(320, Math.max(0, width - 32)) }}>
    <header className="nx-event-header"><div><p className="nx-event-label">NEXUS / SEISMIC INTELLIGENCE</p><h3>Event details <small>{relativeTime(event.time)}</small></h3></div><button type="button" className="nx-event-close" aria-label={`Close details for ${event.place ?? "selected earthquake"}`} onClick={onClose}>×</button></header>
    <div className="nx-event-body">
      <div className="nx-event-location"><span aria-hidden="true">◎</span><div><p className="nx-event-label">EVENT LOCATION</p><p className="nx-event-place">{event.place || "Unknown location"}</p></div></div>
      <div className="nx-event-reading"><div><p className="nx-event-label">MAGNITUDE</p><p className="nx-event-magnitude">{magnitude}<span>MAG</span></p></div><div className="nx-event-depth"><p className="nx-event-label">DEPTH</p><p>{depth}<span>{depth !== "—" ? "km" : ""}</span></p></div></div>
      <dl className="nx-event-facts"><div><dt>DATE & TIME · UTC</dt><dd>{validDate ? <time dateTime={date.toISOString()}><span>{date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}</span><span className="nx-event-time">{date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" })} UTC</span></time> : "Unavailable"}</dd></div><div><dt>EPICENTER COORDINATES</dt><dd className="nx-event-coordinates">{latitude !== "—" && longitude !== "—" ? <><span>{latitude}° <small>LAT</small></span><span>{longitude}° <small>LON</small></span></> : "Unavailable"}</dd></div></dl>
      {(event.tsunami || event.url) && <div className="nx-event-extra">{event.tsunami && <span className="nx-event-tsunami">⚠ Tsunami flag issued</span>}{event.url && <a href={event.url} target="_blank" rel="noopener noreferrer">Open USGS event page ↗</a>}</div>}
    </div>
    <footer className="nx-event-navigation"><div><button type="button" aria-label="Previous earthquake" onClick={onPrevious} disabled={index < 0 || count <= 1}>←</button><span>{index >= 0 ? index + 1 : "—"} <small>/ {count}</small></span><button type="button" aria-label="Next earthquake" onClick={onNext} disabled={index < 0 || count <= 1}>→</button></div><button type="button" onClick={onFirst} disabled={count === 0 || index === 0}>First event ↗</button></footer>
  </section>;
}
