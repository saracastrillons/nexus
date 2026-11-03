import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { numeric } from "./earthquakeData";
import { hotspots, magnitudeColor, timeline } from "../lib/seismic";

const axis = { stroke: "#5d708a", fontSize: 10, tickLine: false, axisLine: false };
const grid = <CartesianGrid stroke="#8fb4dc" strokeOpacity={0.08} vertical={false} />;

function TipCard({ title, rows }) {
  return <div className="nx-chart-tip"><p>{title}</p>{rows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>;
}

export function ActivityTimeline({ events, hours, motion = true }) {
  const data = timeline(events, hours).map(bucket => ({ ...bucket, label: new Date(bucket.start).toLocaleString("en-GB", hours > 48 ? { weekday: "short", hour: "2-digit", hour12: false } : { hour: "2-digit", minute: "2-digit", hour12: false }) }));
  const peak = data.reduce((best, bucket) => bucket.count > (best?.count ?? -1) ? bucket : best, null);
  return <figure className="nx-figure">
    <div className="nx-figure-meta"><span>{data.reduce((total, bucket) => total + bucket.count, 0).toLocaleString()} events · {data.length} intervals</span>{peak?.count > 0 && <span>Peak · {peak.count} events at {peak.label}</span>}</div>
    <div className="nx-figure-plot" style={{ height: 268 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }} barCategoryGap={2}>
          {grid}
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={28} />
          <YAxis {...axis} allowDecimals={false} />
          <Tooltip cursor={{ fill: "#6ae5ee", fillOpacity: 0.06 }} content={({ active, payload }) => active && payload?.length ? <TipCard title={payload[0].payload.label} rows={[["Events", payload[0].payload.count], ["Strongest", payload[0].payload.max == null ? "—" : `M ${payload[0].payload.max.toFixed(1)}`]]} /> : null} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={motion} animationDuration={700}>
            {data.map(bucket => <Cell key={bucket.start} fill={bucket.max == null ? "#2b3a52" : magnitudeColor(bucket.max)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
    <figcaption>Bar colour shows the strongest magnitude recorded in each interval.</figcaption>
  </figure>;
}

export function DepthScatter({ events, motion = true }) {
  const data = events.map(event => ({ magnitude: numeric(event.magnitude), depth: numeric(event.depth), place: event.place })).filter(point => point.magnitude !== null && point.depth !== null);
  const deep = data.filter(point => point.depth >= 70).length;
  return <figure className="nx-figure">
    <div className="nx-figure-meta"><span>{data.length.toLocaleString()} events</span><span>{data.length ? Math.round((deep / data.length) * 100) : 0}% intermediate or deep (≥ 70 km)</span></div>
    <div className="nx-figure-plot" style={{ height: 230 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 8, left: -14, bottom: 4 }}>
          <CartesianGrid stroke="#8fb4dc" strokeOpacity={0.08} />
          <XAxis type="number" dataKey="magnitude" name="Magnitude" {...axis} domain={["dataMin - 0.3", "dataMax + 0.3"]} tickFormatter={value => value.toFixed(1)} label={{ value: "Magnitude", position: "insideBottomRight", offset: -2, fill: "#5d708a", fontSize: 10 }} />
          <YAxis type="number" dataKey="depth" name="Depth" {...axis} reversed unit=" km" width={62} domain={[min => Math.min(0, Math.floor(min)), max => Math.ceil(max / 50) * 50]} allowDataOverflow={false} />
          <ZAxis range={[36, 36]} />
          <Tooltip cursor={{ stroke: "#6ae5ee", strokeOpacity: 0.3 }} content={({ active, payload }) => active && payload?.length ? <TipCard title={payload[0].payload.place || "Unknown location"} rows={[["Magnitude", `M ${payload[0].payload.magnitude.toFixed(1)}`], ["Depth", `${payload[0].payload.depth.toFixed(1)} km`]]} /> : null} />
          <Scatter data={data} isAnimationActive={motion} animationDuration={700}>
            {data.map((point, index) => <Cell key={index} fill={magnitudeColor(point.magnitude)} fillOpacity={0.85} stroke="#060a12" strokeWidth={1} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
    <figcaption>Depth increases downward, like a cross-section of the crust.</figcaption>
  </figure>;
}

export function Hotspots({ events, onPick }) {
  const rows = hotspots(events, 7);
  const top = rows[0]?.count ?? 1;
  if (!rows.length) return <div className="nx-empty">No regional activity yet.</div>;
  return <ol className="nx-hotspots">{rows.map((row, index) => <li key={row.region}>
    <button type="button" onClick={() => onPick?.(row.region)} title={`Filter the observatory by ${row.region}`}>
      <span className="nx-hotspot-rank">{String(index + 1).padStart(2, "0")}</span>
      <span className="nx-hotspot-name">{row.region}<small>{row.max == null ? "Magnitude unavailable" : `Strongest M ${row.max.toFixed(1)}`}</small></span>
      <span className="nx-hotspot-count">{row.count}</span>
      <span className="nx-hotspot-bar" aria-hidden="true"><i style={{ width: `${(row.count / top) * 100}%`, background: magnitudeColor(row.max) }} /></span>
    </button>
  </li>)}</ol>;
}
