// WMO weather interpretation codes (Open-Meteo) mapped to a condition and an inline SVG glyph.
export function describeWeather(code, isDay = true) {
  const value = Number(code);
  if (value === 0) return { label: isDay ? "Clear sky" : "Clear night", kind: isDay ? "sun" : "moon" };
  if (value === 1) return { label: "Mainly clear", kind: isDay ? "sun-cloud" : "moon-cloud" };
  if (value === 2) return { label: "Partly cloudy", kind: isDay ? "sun-cloud" : "moon-cloud" };
  if (value === 3) return { label: "Overcast", kind: "cloud" };
  if (value === 45 || value === 48) return { label: "Fog", kind: "fog" };
  if (value >= 51 && value <= 57) return { label: "Drizzle", kind: "drizzle" };
  if ((value >= 61 && value <= 67) || (value >= 80 && value <= 82)) return { label: value >= 80 ? "Rain showers" : "Rain", kind: "rain" };
  if ((value >= 71 && value <= 77) || value === 85 || value === 86) return { label: "Snow", kind: "snow" };
  if (value >= 95) return { label: "Thunderstorm", kind: "storm" };
  return { label: "Conditions unavailable", kind: "cloud" };
}
