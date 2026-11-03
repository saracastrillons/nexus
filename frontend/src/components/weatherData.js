export function weatherNumber(value) {
  if (value == null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function weatherValue(value, digits = 1) {
  const number = weatherNumber(value);
  return number === null ? "—" : number.toFixed(digits);
}

export function readWeather(payload) {
  const data = payload?.data;
  if (!data?.current || typeof data.current !== "object" || Array.isArray(data.current)) throw new Error("The weather service returned an invalid observation.");
  const current = { ...data.current };
  for (const key of ["temperature_2m", "relative_humidity_2m", "wind_speed_10m", "apparent_temperature", "precipitation"]) current[key] = weatherNumber(current[key]);
  const hourly = data.hourly && typeof data.hourly === "object" && !Array.isArray(data.hourly) && Array.isArray(data.hourly.time) ? data.hourly : null;
  return { weather: current, hourly, forecast: data.daily && typeof data.daily === "object" && !Array.isArray(data.daily) ? data.daily : null, timezone: typeof data.timezone === "string" ? data.timezone : null };
}

export function readCity(payload) {
  const city = payload?.data;
  const latitude = weatherNumber(city?.latitude);
  const longitude = weatherNumber(city?.longitude);
  if (payload?.status !== "success" || latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || typeof city?.name !== "string" || !city.name.trim()) throw new Error("City not found. Try a more specific city name.");
  return { coordinates: { latitude, longitude }, label: [city.name, city.country].filter(value => typeof value === "string" && value.trim()).join(", ") };
}
