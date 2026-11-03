import { magnitudeColor, eventId } from "../lib/seismic";
import { Since } from "./ui";
import { numeric, timestamp } from "./earthquakeData";

// Scrolling strip of the most recent events; each item flies the globe to its epicenter.
export default function Ticker({ events, onSelect }) {
  const recent = [...events].filter(event => numeric(event.magnitude) !== null).sort((a, b) => (timestamp(b.time) ?? 0) - (timestamp(a.time) ?? 0)).slice(0, 14);
  if (!recent.length) return <div className="nx-ticker nx-ticker-empty"><span className="nx-ticker-label"><i /> LIVE</span><span>Waiting for seismic signals…</span></div>;
  const item = (event, copy) => <button type="button" key={`${copy}-${eventId(event)}`} tabIndex={copy ? -1 : 0} aria-hidden={copy ? "true" : undefined} onClick={() => onSelect(event)}>
    <b style={{ color: magnitudeColor(event.magnitude) }}>M{numeric(event.magnitude).toFixed(1)}</b>
    <span>{event.place || "Unknown location"}</span>
    <small><Since time={event.time} /></small>
  </button>;
  return <div className="nx-ticker" role="region" aria-label="Latest seismic events">
    <span className="nx-ticker-label"><i /> LIVE FEED</span>
    <div className="nx-ticker-viewport"><div className="nx-ticker-track">{recent.map(event => item(event, 0))}{recent.map(event => item(event, 1))}</div></div>
  </div>;
}
