import { useEffect, useRef, useState } from "react";
import useNow from "../hooks/useNow";
import { relativeTime } from "../lib/seismic";

// Animated number that eases from its previous value to the next one.
export function CountUp({ value, digits = 0, duration = 900, motion = true }) {
  const [shown, setShown] = useState(value ?? 0);
  const from = useRef(value ?? 0);
  useEffect(() => {
    if (value == null || !Number.isFinite(value) || !motion) { from.current = value ?? 0; return; }
    const start = performance.now();
    const origin = from.current;
    let frame;
    const tick = now => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      setShown(origin + (value - origin) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); from.current = value; };
  }, [value, duration, motion]);
  if (value == null || !Number.isFinite(value)) return "—";
  return (motion ? shown : value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function Sparkline({ values, color = "var(--nx-cyan)", height = 36 }) {
  const points = values.filter(value => Number.isFinite(value));
  if (points.length < 2) return <svg className="nx-spark" viewBox="0 0 100 36" aria-hidden="true" />;
  const max = Math.max(...points, 1);
  const step = 100 / (values.length - 1);
  const path = values.map((value, index) => `${index ? "L" : "M"}${(index * step).toFixed(2)},${(height - 3 - ((Number.isFinite(value) ? value : 0) / max) * (height - 8)).toFixed(2)}`).join(" ");
  const id = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;
  return <svg className="nx-spark" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.35" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
    <path d={`${path} L100,${height} L0,${height} Z`} fill={`url(#${id})`} />
    <path d={path} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
  </svg>;
}

// Ticking leaves keep the per-second clock from re-rendering the whole app.
export function Clock({ label, timeZone }) {
  const now = useNow(1000);
  return <span><small>{label}</small>{now.toLocaleTimeString("en-GB", { hour12: false, timeZone })}</span>;
}

export function Since({ time, upper = false }) {
  const now = useNow(15000);
  const text = relativeTime(time, now.getTime());
  return upper ? text.toUpperCase() : text;
}

export function Kbd({ children }) {
  return <kbd className="nx-kbd">{children}</kbd>;
}
