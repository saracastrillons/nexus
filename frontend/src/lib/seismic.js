import { numeric, timestamp } from "../components/earthquakeData";

// Ordinal magnitude scale: lightness rises with magnitude so the strongest events glow on dark surfaces.
export const MAGNITUDE_CLASSES = [
  { id: "micro", label: "M < 2", min: -Infinity, color: "#6a5fd1" },
  { id: "minor", label: "M 2 – 3.9", min: 2, color: "#c55aa8" },
  { id: "moderate", label: "M 4 – 5.9", min: 4, color: "#f7834e" },
  { id: "strong", label: "M 6+", min: 6, color: "#ffd166" },
];

export const WINDOWS = {
  hour: { label: "1H", title: "Past hour", query: "window=hour&limit=500", hours: 1 },
  day: { label: "24H", title: "Past 24 hours", query: "window=day&limit=500", hours: 24 },
  week: { label: "7D", title: "Past 7 days · M2.5+", query: "window=week&limit=500&min_magnitude=2.5", hours: 168 },
};

export function magnitudeClass(value) {
  const magnitude = numeric(value);
  if (magnitude === null) return null;
  return [...MAGNITUDE_CLASSES].reverse().find(item => magnitude >= item.min);
}

export function magnitudeColor(value) {
  return magnitudeClass(value)?.color ?? "#64748b";
}

export const eventId = event => event?.usgs_id ?? event?.id ?? null;

// "12 km SW of Ocotillo, CA" -> "CA"; "Fiji region" -> "Fiji region"
// USGS abbreviates US states and a few countries in place names.
const REGION_NAMES = { CA: "California", AK: "Alaska", NV: "Nevada", HI: "Hawaii", WA: "Washington", OR: "Oregon", UT: "Utah", MT: "Montana", ID: "Idaho", WY: "Wyoming", TX: "Texas", OK: "Oklahoma", NM: "New Mexico", AZ: "Arizona", CO: "Colorado", KS: "Kansas", TN: "Tennessee", MX: "Mexico", PR: "Puerto Rico", "B.C.": "Baja California" };

export function regionOf(place) {
  if (typeof place !== "string" || !place.trim()) return "Unknown region";
  const parts = place.split(",");
  const tail = parts[parts.length - 1].trim().replace(/^\d+\s*km\s+[NSEW]{1,3}\s+of\s+/i, "");
  return REGION_NAMES[tail] ?? (tail || "Unknown region");
}

export function summarize(events) {
  const magnitudes = events.map(event => numeric(event.magnitude)).filter(value => value !== null);
  const strongest = events.reduce((best, event) => numeric(event.magnitude) !== null && (!best || numeric(event.magnitude) > numeric(best.magnitude)) ? event : best, null);
  const latest = events.reduce((last, event) => timestamp(event.time) !== null && (!last || timestamp(event.time) > timestamp(last.time)) ? event : last, null);
  const depths = events.map(event => numeric(event.depth)).filter(value => value !== null);
  return {
    count: events.length,
    strongest,
    latest,
    average: magnitudes.length ? magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length : null,
    averageDepth: depths.length ? depths.reduce((a, b) => a + b, 0) / depths.length : null,
    significant: magnitudes.filter(value => value >= 4.5).length,
    tsunami: events.filter(event => event.tsunami).length,
  };
}

// Buckets events into equal time slots ending now; returns counts and the slot's strongest magnitude.
export function timeline(events, hours, now = Date.now(), slots = Math.min(hours, 48)) {
  const span = hours * 3600000;
  const size = span / slots;
  const start = now - span;
  const buckets = Array.from({ length: slots }, (_, index) => ({ start: start + index * size, count: 0, max: null }));
  for (const event of events) {
    const time = timestamp(event.time);
    if (time === null || time < start || time > now) continue;
    const bucket = buckets[Math.min(slots - 1, Math.floor((time - start) / size))];
    bucket.count += 1;
    const magnitude = numeric(event.magnitude);
    if (magnitude !== null && (bucket.max === null || magnitude > bucket.max)) bucket.max = magnitude;
  }
  return buckets;
}

export function hotspots(events, size = 6) {
  const regions = new Map();
  for (const event of events) {
    const region = regionOf(event.place);
    const entry = regions.get(region) ?? { region, count: 0, max: null };
    entry.count += 1;
    const magnitude = numeric(event.magnitude);
    if (magnitude !== null && (entry.max === null || magnitude > entry.max)) entry.max = magnitude;
    regions.set(region, entry);
  }
  return [...regions.values()].sort((a, b) => b.count - a.count || (b.max ?? 0) - (a.max ?? 0)).slice(0, size);
}

const csvCell = value => {
  const text = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
  // Neutralise spreadsheet formulas and quote every field.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function toCSV(events) {
  const columns = ["usgs_id", "time", "magnitude", "magnitude_type", "place", "latitude", "longitude", "depth", "tsunami", "url"];
  return [columns.join(","), ...events.map(event => columns.map(column => csvCell(event[column])).join(","))].join("\r\n");
}

export function downloadCSV(events, now = new Date()) {
  const url = URL.createObjectURL(new Blob([toCSV(events)], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `nexus-earthquakes-${now.toISOString().slice(0, 16).replace(/[:T]/g, "-")}.csv` });
  link.click();
  URL.revokeObjectURL(url);
}

export function relativeTime(value, now = Date.now()) {
  const time = timestamp(value);
  if (time === null) return "—";
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
