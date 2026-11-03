import { fetchJSON } from "../services/api";
import { useEffect, useId, useState } from "react";
import WeatherForecastChart from "./WeatherForecastChart";
import PrecipitationChart from "./PrecipitationChart";
import WeatherAlerts from "./WeatherAlerts";
import WeatherIcon from "./WeatherIcon";
import { describeWeather } from "../lib/weather";
import { calculateWeatherAlerts } from "../utils/weatherAlerts";
import { readCity, readWeather, weatherNumber, weatherValue } from "./weatherData";

const DEFAULT_LOCATION = { coordinates: { latitude: 6.2442, longitude: -75.5812 }, label: "Medellín, Colombia" };
const QUICK_CITIES = ["Medellín", "Tokyo", "Reykjavík", "New York", "Cairo", "Sydney"];
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const AQI_LEVELS = [[50, "Good", "#5ee0a0"], [100, "Moderate", "#ffd166"], [150, "Unhealthy for sensitive groups", "#ffa45c"], [200, "Unhealthy", "#ff6b6b"], [300, "Very unhealthy", "#c77dff"], [Infinity, "Hazardous", "#9d2b4c"]];

const clock = value => typeof value === "string" && value.includes("T") ? value.split("T")[1].slice(0, 5) : "—";
const weekday = value => { const [year, month, day] = String(value).split("-").map(Number); return new Date(year, month - 1, day).toLocaleDateString("en-US", { weekday: "short" }); };

export default function WeatherPanel({ motion = true, query }) {
  const [snapshot, setSnapshot] = useState(null);
  const [air, setAir] = useState(null);
  // The parent remounts this panel (key) when a new query arrives from the command palette.
  const [city, setCity] = useState(query?.text ?? "");
  const [request, setRequest] = useState(() => query?.text ? { query: query.text } : DEFAULT_LOCATION);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);
  const [locating, setLocating] = useState(false);
  const [forecastView, setForecastView] = useState("temperature");
  const searchId = useId();

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function load() {
      setBusy(true);
      setError(null);
      try {
        const location = request.query ? readCity(await fetchJSON(`/api/weather/search?name=${encodeURIComponent(request.query)}`, { signal: controller.signal, timeout: 20000 })) : request;
        const params = new URLSearchParams({ latitude: location.coordinates.latitude, longitude: location.coordinates.longitude });
        const data = readWeather(await fetchJSON(`/api/weather/?${params}`, { signal: controller.signal, timeout: 20000 }));
        if (!active) return;
        setSnapshot({ ...data, ...location, updated: new Date() });
        setAir(null);
        // Air quality is supplementary: its failure never blocks the observation.
        fetchJSON(`/api/weather/air-quality?${params}`, { signal: controller.signal }).then(result => active && setAir(result.data?.current ?? null)).catch(() => active && setAir(false));
      } catch (failure) {
        if (active) setError(failure.name === "TimeoutError" ? "The weather request timed out. Please try again." : failure.message || "Unable to connect to the weather service.");
      } finally {
        if (active) setBusy(false);
      }
    }
    load();
    return () => { active = false; controller.abort(); };
  }, [request]);

  const locate = () => {
    if (!navigator.geolocation) { setError("Geolocation is not available in this browser."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      setLocating(false);
      setRequest({ coordinates: { latitude: Number(position.coords.latitude.toFixed(4)), longitude: Number(position.coords.longitude.toFixed(4)) }, label: "Your location" });
    }, () => { setLocating(false); setError("Location permission was denied or unavailable."); }, { timeout: 10000, maximumAge: 600000 });
  };

  const weather = snapshot?.weather;
  const alerts = weather ? calculateWeatherAlerts(weather) : null;
  const label = snapshot?.label ?? DEFAULT_LOCATION.label;
  const isDay = weather?.is_day !== 0;
  const condition = describeWeather(weather?.weather_code, isDay);
  const refresh = () => setRequest({ coordinates: snapshot?.coordinates ?? DEFAULT_LOCATION.coordinates, label });
  const forecast = snapshot?.forecast;
  const hourly = snapshot?.hourly;
  const hasForecast = Array.isArray(forecast?.time) && forecast.time.length > 0;
  const hasSeries = hasForecast && (forecastView === "temperature" ? Array.isArray(forecast.temperature_2m_max) && Array.isArray(forecast.temperature_2m_min) : Array.isArray(forecast.precipitation_sum));
  const lows = hasForecast ? forecast.temperature_2m_min.map(weatherNumber).filter(value => value !== null) : [];
  const highs = hasForecast ? forecast.temperature_2m_max.map(weatherNumber).filter(value => value !== null) : [];
  const range = { min: Math.min(...lows), max: Math.max(...highs) };
  const windDirection = weatherNumber(weather?.wind_direction_10m);
  const uv = weatherNumber(forecast?.uv_index_max?.[0]);
  const aqi = weatherNumber(air?.us_aqi);
  const aqiLevel = aqi === null ? null : AQI_LEVELS.find(([limit]) => aqi <= limit);
  const metrics = [
    ["Feels like", weatherValue(weather?.apparent_temperature), "°C", "Apparent temperature"],
    ["Humidity", weatherValue(weather?.relative_humidity_2m, 0), "%", "Relative humidity"],
    ["Wind", weatherValue(weather?.wind_speed_10m), "km/h", windDirection === null ? "Direction unavailable" : `From the ${COMPASS[Math.round(windDirection / 45) % 8]} · ${windDirection}°`, windDirection],
    ["Pressure", weatherValue(weather?.pressure_msl, 0), "hPa", "Mean sea level"],
    ["Cloud cover", weatherValue(weather?.cloud_cover, 0), "%", "Sky obscured"],
    ["Precipitation", weatherValue(weather?.precipitation), "mm", "Current interval"],
    ["UV index", uv === null ? "—" : uv.toFixed(1), "max", uv === null ? "Not supplied" : uv >= 8 ? "Very high today" : uv >= 6 ? "High today" : uv >= 3 ? "Moderate today" : "Low today"],
  ];

  return <div className="nx-weather">
    <form className="nx-weather-search" onSubmit={event => { event.preventDefault(); if (!busy && city.trim()) setRequest({ query: city.trim() }); }}>
      <label htmlFor={searchId}>EXPLORE A LOCATION<input id={searchId} type="search" autoComplete="off" placeholder="Search any city on Earth…" value={city} onChange={event => setCity(event.target.value)} /></label>
      <button className="nx-button nx-primary" type="submit" disabled={busy || !city.trim()}>{busy && request.query ? "Searching…" : "Search ↗"}</button>
      <button className="nx-button" type="button" disabled={busy || locating} onClick={locate}>{locating ? "Locating…" : "⌖ My location"}</button>
      <button className="nx-button" type="button" disabled={busy} onClick={refresh} aria-label="Refresh weather">↻</button>
    </form>
    <div className="nx-chips nx-city-chips" role="group" aria-label="Quick cities">{QUICK_CITIES.map(name => <button key={name} type="button" disabled={busy} aria-pressed={label.startsWith(name)} onClick={() => { setCity(name); setRequest({ query: name }); }}>{name}</button>)}</div>
    {error && <div className="nx-notice" role="alert">{error} {snapshot ? `Showing the last successful observation for ${label}.` : "No weather observation has been received."}</div>}

    <section className={`nx-weather-stage ${isDay ? "nx-day" : "nx-night"} nx-sky-${condition.kind}`} aria-label="Current weather" aria-busy={busy}>
      <div className="nx-weather-now">
        <p className="nx-eyebrow">{busy ? "RECEIVING OBSERVATION…" : `CURRENT OBSERVATION · ${snapshot?.timezone ?? "LOCAL TIME"}`}</p>
        <h3>{label}</h3>
        <div className="nx-weather-reading">
          <WeatherIcon code={weather?.weather_code} isDay={isDay} size={104} className={motion ? "nx-float" : ""} />
          <p className="nx-weather-temperature">{weatherValue(weather?.temperature_2m)}<span>°C</span></p>
        </div>
        <p className="nx-weather-condition">{condition.label}{hasForecast && Number.isFinite(range.min) && <span> · H {weatherValue(forecast.temperature_2m_max[0], 0)}° · L {weatherValue(forecast.temperature_2m_min[0], 0)}°</span>}</p>
        <div className="nx-weather-facts">
          <span>☀ Sunrise <b>{clock(forecast?.sunrise?.[0])}</b></span>
          <span>☾ Sunset <b>{clock(forecast?.sunset?.[0])}</b></span>
          <span>⌖ <b>{snapshot ? `${weatherValue(snapshot.coordinates.latitude, 2)}°, ${weatherValue(snapshot.coordinates.longitude, 2)}°` : "—"}</b></span>
          <span>Observed <b>{typeof weather?.time === "string" ? weather.time.replace("T", " ") : "—"}</b></span>
        </div>
      </div>
      <div className="nx-aqi" aria-label="Air quality">
        <p className="nx-eyebrow">AIR QUALITY · US AQI</p>
        <div className="nx-aqi-gauge" style={{ "--aqi": Math.min(aqi ?? 0, 300) / 300, "--aqi-color": aqiLevel?.[2] ?? "#3a4a62" }}><span>{aqi === null ? "—" : Math.round(aqi)}</span></div>
        <strong style={{ color: aqiLevel?.[2] }}>{air === false ? "Unavailable" : aqiLevel?.[1] ?? (busy ? "Measuring…" : "Awaiting data")}</strong>
        <dl><div><dt>PM2.5</dt><dd>{weatherValue(air?.pm2_5)} <small>µg/m³</small></dd></div><div><dt>PM10</dt><dd>{weatherValue(air?.pm10)} <small>µg/m³</small></dd></div><div><dt>O₃</dt><dd>{weatherValue(air?.ozone, 0)} <small>µg/m³</small></dd></div></dl>
      </div>
    </section>

    {Array.isArray(hourly?.time) && <section className="nx-hourly" aria-label="Next 24 hours">
      <p className="nx-eyebrow">NEXT 24 HOURS</p>
      <ol>{hourly.time.map((time, index) => { const hour = Number(clock(time).slice(0, 2)); const dayHour = hour >= 6 && hour < 18; return <li key={time} className={index === 0 ? "nx-now" : ""}><span>{index === 0 ? "Now" : clock(time)}</span><WeatherIcon code={hourly.weather_code?.[index]} isDay={dayHour} size={30} /><b>{weatherValue(hourly.temperature_2m?.[index], 0)}°</b><small>{weatherNumber(hourly.precipitation_probability?.[index]) ? `${hourly.precipitation_probability[index]}%` : " "}</small></li>; })}</ol>
    </section>}

    <div className="nx-weather-grid">
      <section className="nx-daily" aria-label="Seven day forecast">
        <p className="nx-eyebrow">7-DAY OUTLOOK</p>
        {hasForecast ? <ol>{forecast.time.map((day, index) => { const low = weatherNumber(forecast.temperature_2m_min?.[index]); const high = weatherNumber(forecast.temperature_2m_max?.[index]); const span = range.max - range.min || 1; return <li key={day}>
          <span className="nx-daily-day">{index === 0 ? "Today" : weekday(day)}</span>
          <WeatherIcon code={forecast.weather_code?.[index]} size={28} />
          <small className="nx-daily-rain">{weatherNumber(forecast.precipitation_probability_max?.[index]) ? `${forecast.precipitation_probability_max[index]}%` : ""}</small>
          <span className="nx-daily-low">{weatherValue(low, 0)}°</span>
          <span className="nx-range" aria-hidden="true">{low !== null && high !== null && <i style={{ left: `${((low - range.min) / span) * 100}%`, right: `${100 - ((high - range.min) / span) * 100}%` }} />}</span>
          <span className="nx-daily-high">{weatherValue(high, 0)}°</span>
        </li>; })}</ol> : <div className="nx-empty">{busy ? "Receiving forecast…" : "Forecast unavailable."}</div>}
      </section>
      <section className="nx-weather-tiles" aria-label="Atmospheric measurements">{metrics.map(([title, value, unit, description, direction]) => <article className="nx-weather-tile" key={title}>
        <p>{title}</p>
        <strong>{value}<span>{unit}</span></strong>
        <small>{description}</small>
        {title === "Wind" && direction != null && <span className="nx-compass" aria-hidden="true"><i style={{ transform: `rotate(${direction + 180}deg)` }} /></span>}
      </article>)}</section>
    </div>

    <section className="nx-weather-checks" aria-label="Configured weather threshold checks"><div><p className="nx-eyebrow">CONFIGURED THRESHOLD CHECKS</p><h4>{!alerts ? "Awaiting measurements" : !alerts.hasCompleteWeatherData ? "Some measurements are unavailable" : alerts.alertCount ? `${alerts.alertCount} threshold ${alerts.alertCount === 1 ? "check" : "checks"} triggered` : "No configured thresholds exceeded"}</h4><p>Application rules for temperature, wind and precipitation. These are not official weather warnings.</p></div>{alerts && <span className={`nx-tag ${alerts.alertCount ? "nx-weather-flag" : ""}`}>{alerts.hasCompleteWeatherData ? "COMPLETE INPUTS" : "PARTIAL INPUTS"}</span>}</section>
    {alerts && <details className="nx-weather-alert-details"><summary>Inspect threshold checks</summary><WeatherAlerts weather={weather} {...alerts} /></details>}
    <section className="nx-weather-forecast" aria-label="Weather forecast chart"><header><div><p className="nx-eyebrow">FORECAST / TREND</p><h4>{hasForecast ? `${forecast.time.length}-day trend` : "Daily trend"}</h4></div><div className="nx-weather-switch" role="group" aria-label="Forecast visualization"><button type="button" aria-pressed={forecastView === "temperature"} onClick={() => setForecastView("temperature")}>Temperature · °C</button><button type="button" aria-pressed={forecastView === "precipitation"} onClick={() => setForecastView("precipitation")}>Precipitation · mm</button></div></header><div className="nx-weather-chart">{hasSeries ? forecastView === "temperature" ? <WeatherForecastChart data={forecast} motion={motion} /> : <PrecipitationChart data={forecast} motion={motion} /> : <div className="nx-empty">{busy && !snapshot ? "Receiving forecast data…" : "This forecast series is unavailable from the service."}</div>}</div></section>
    <footer className="nx-weather-note">Source: Open-Meteo forecast and air-quality APIs via the NEXUS service · Last received {snapshot ? `${snapshot.updated.toLocaleTimeString("en-GB", { timeZone: "UTC", hour12: false })} UTC` : "—"} · Observations may be cached for up to 10 minutes.</footer>
  </div>;
}
