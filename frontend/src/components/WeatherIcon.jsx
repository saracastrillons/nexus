import { describeWeather } from "../lib/weather";

const cloud = <path d="M18 40h26a9 9 0 0 0 0-18 13 13 0 0 0-25-3A10 10 0 0 0 18 40Z" fill="#c7d6ea" fillOpacity="0.92" />;
const sun = (cx = 24, cy = 22, r = 9) => <g><circle cx={cx} cy={cy} r={r} fill="#ffcf5a" />{Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <line key={i} x1={cx + Math.cos(a) * (r + 4)} y1={cy + Math.sin(a) * (r + 4)} x2={cx + Math.cos(a) * (r + 8)} y2={cy + Math.sin(a) * (r + 8)} stroke="#ffcf5a" strokeWidth="2.4" strokeLinecap="round" />; })}</g>;
const moon = (cx = 26, cy = 22) => <path d={`M${cx + 6} ${cy - 12}a13 13 0 1 0 8 20 11 11 0 0 1-8-20Z`} fill="#dfe6ff" />;
const drops = (count, color = "#6cc8ff", length = 6) => Array.from({ length: count }, (_, i) => <line key={i} x1={22 + i * 8} y1={45} x2={19 + i * 8} y2={45 + length} stroke={color} strokeWidth="2.4" strokeLinecap="round" />);

export default function WeatherIcon({ code, isDay = true, size = 48, className = "" }) {
  const { kind, label } = describeWeather(code, isDay);
  return <svg className={`nx-wicon nx-wicon-${kind} ${className}`} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={label}>
    {kind === "sun" && sun(32, 32, 11)}
    {kind === "moon" && moon(28, 32)}
    {kind === "sun-cloud" && <>{sun(24, 22, 8)}<g transform="translate(6 6)">{cloud}</g></>}
    {kind === "moon-cloud" && <>{moon(22, 22)}<g transform="translate(6 6)">{cloud}</g></>}
    {kind === "cloud" && <g transform="translate(2 4)">{cloud}</g>}
    {kind === "fog" && <><g transform="translate(2 -2)">{cloud}</g>{[46, 52, 58].map(y => <line key={y} x1="14" x2="50" y1={y} y2={y} stroke="#9fb2c9" strokeWidth="2.4" strokeLinecap="round" />)}</>}
    {kind === "drizzle" && <><g transform="translate(2 -4)">{cloud}</g>{drops(3, "#8fd3ff", 4)}</>}
    {kind === "rain" && <><g transform="translate(2 -4)">{cloud}</g>{drops(3)}</>}
    {kind === "snow" && <><g transform="translate(2 -4)">{cloud}</g>{[22, 32, 42].map(x => <circle key={x} cx={x} cy="50" r="2.6" fill="#ffffff" />)}</>}
    {kind === "storm" && <><g transform="translate(2 -4)">{cloud}</g><path d="M33 40l-7 11h6l-3 9 10-13h-6l4-7Z" fill="#ffd166" /></>}
  </svg>;
}
