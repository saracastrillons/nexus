import { test, expect } from "vitest";
import { calculateWeatherAlerts } from "./weatherAlerts";

test("detects extreme heat correctly", () => {
  const testWeather = {
    temperature_2m: 38,
    wind_speed_10m: 20,
    precipitation: 0,
  };

  const result = calculateWeatherAlerts(testWeather);

  expect(result.isExtremeHeat).toBe(true);
  expect(result.alertCount).toBe(1);
  expect(result.hasTemperatureData).toBe(true);
  expect(result.hasCompleteWeatherData).toBe(true);
});

test("detects strong wind correctly", () => {
  const testWeather = {
    temperature_2m: 25,
    wind_speed_10m: 65,
    precipitation: 0,
  };

  const result = calculateWeatherAlerts(testWeather);

  expect(result.isStrongWind).toBe(true);
  expect(result.isExtremeHeat).toBe(false);
  expect(result.alertCount).toBe(1);
  expect(result.hasWindData).toBe(true);
});

test("detects heavy rain correctly", () => {
  const testWeather = {
    temperature_2m: 24,
    wind_speed_10m: 15,
    precipitation: 12,
  };

  const result = calculateWeatherAlerts(testWeather);

  expect(result.isHeavyRain).toBe(true);
  expect(result.isExtremeHeat).toBe(false);
  expect(result.isStrongWind).toBe(false);
  expect(result.alertCount).toBe(1);
  expect(result.hasPrecipitationData).toBe(true);
  
});

test("detects multiple weather alerts correctly", () => {
  const testWeather = {
    temperature_2m: 38,
    wind_speed_10m: 65,
    precipitation: 12,
  };

  const result = calculateWeatherAlerts(testWeather);

  expect(result.isExtremeHeat).toBe(true);
  expect(result.isStrongWind).toBe(true);
  expect(result.isHeavyRain).toBe(true);
  expect(result.alertCount).toBe(3);
});

test("detects no weather alerts under normal conditions", () => {
  const testWeather = {
    temperature_2m: 24,
    wind_speed_10m: 12,
    precipitation: 0,
  };

  const result = calculateWeatherAlerts(testWeather);

  expect(result.isExtremeHeat).toBe(false);
  expect(result.isStrongWind).toBe(false);
  expect(result.isHeavyRain).toBe(false);
  expect(result.alertCount).toBe(0);
});

test("detects extreme heat at the exact threshold", () => {
  const testWeather = {
    temperature_2m: 35,
    wind_speed_10m: 20,
    precipitation: 0,
  };

  const result = calculateWeatherAlerts(testWeather);

  expect(result.isExtremeHeat).toBe(true);
  expect(result.alertCount).toBe(1);
});

test("does not detect extreme heat below the threshold", () => {
  const testWeather = {
    temperature_2m: 34.9,
    wind_speed_10m: 20,
    precipitation: 0,
  };

  const result = calculateWeatherAlerts(testWeather);

  expect(result.isExtremeHeat).toBe(false);
  expect(result.alertCount).toBe(0);
});

test("detects strong wind at the exact threshold", () => {
  const testWeather = {
    temperature_2m: 25,
    wind_speed_10m: 50,
    precipitation: 0,
  };

  const result = calculateWeatherAlerts(testWeather);

  expect(result.isStrongWind).toBe(true);
  expect(result.isExtremeHeat).toBe(false);
  expect(result.isHeavyRain).toBe(false);
  expect(result.alertCount).toBe(1);
});

test("does not detect strong wind below the threshold", () => {
  const testWeather = {
    temperature_2m: 25,
    wind_speed_10m: 49.9,
    precipitation: 0,
  };

  const result = calculateWeatherAlerts(testWeather);

  expect(result.isStrongWind).toBe(false);
  expect(result.alertCount).toBe(0);
});

test("detects heavy rain at the exact threshold", () => {
  const testWeather = {
    temperature_2m: 25,
    wind_speed_10m: 20,
    precipitation: 10,
  };

  const result = calculateWeatherAlerts(testWeather);

  expect(result.isHeavyRain).toBe(true);
  expect(result.isExtremeHeat).toBe(false);
  expect(result.isStrongWind).toBe(false);
  expect(result.alertCount).toBe(1);
});

test("does not detect heavy rain below the threshold", () => {
  const testWeather = {
    temperature_2m: 25,
    wind_speed_10m: 20,
    precipitation: 9.9,
  };

  const result = calculateWeatherAlerts(testWeather);

  expect(result.isHeavyRain).toBe(false);
  expect(result.alertCount).toBe(0);
});

test("handles missing temperature data", () => {
  const testWeather = {
    wind_speed_10m: 20,
    precipitation: 0,
  };

  const result = calculateWeatherAlerts(testWeather);

  expect(result.isExtremeHeat).toBe(false);
  expect(result.alertCount).toBe(0);
  expect(result.hasTemperatureData).toBe(false);
});

test("handles missing wind data", () => {
  const testWeather = {
    temperature_2m: 25,
    precipitation: 0,
  };

  const result = calculateWeatherAlerts(testWeather);

  expect(result.hasWindData).toBe(false);
  expect(result.isStrongWind).toBe(false);
  expect(result.alertCount).toBe(0);
});

test("handles missing precipitation data", () => {
  const testWeather = {
    temperature_2m: 25,
    wind_speed_10m: 20,
  };

  const result = calculateWeatherAlerts(testWeather);

  expect(result.hasPrecipitationData).toBe(false);
  expect(result.isHeavyRain).toBe(false);
  expect(result.alertCount).toBe(0);
  expect(result.hasCompleteWeatherData).toBe(false);
});

test("rejects temperature provided as text", () => {
  const testWeather = {
    temperature_2m: "35",
    wind_speed_10m: 20,
    precipitation: 0,
  };

  const result = calculateWeatherAlerts(testWeather);

  expect(result.hasTemperatureData).toBe(false);
  expect(result.isExtremeHeat).toBe(false);
  expect(result.hasCompleteWeatherData).toBe(false);
});

test("rejects wind speed provided as text", () => {
  const testWeather = {
    temperature_2m: 25,
    wind_speed_10m: "65",
    precipitation: 0,
  };

  const result = calculateWeatherAlerts(testWeather);

  expect(result.hasWindData).toBe(false);
  expect(result.isStrongWind).toBe(false);
  expect(result.hasCompleteWeatherData).toBe(false);
});

test("rejects precipitation provided as text", () => {
  const testWeather = {
    temperature_2m: 25,
    wind_speed_10m: 20,
    precipitation: "15",
  };

  const result = calculateWeatherAlerts(testWeather);

  expect(result.hasPrecipitationData).toBe(false);
  expect(result.isHeavyRain).toBe(false);
  expect(result.hasCompleteWeatherData).toBe(false);
});

test("rejects infinite weather values", () => {
  const testWeather = {
    temperature_2m: Infinity,
    wind_speed_10m: Infinity,
    precipitation: Infinity,
  };

  const result = calculateWeatherAlerts(testWeather);

  expect(result.hasTemperatureData).toBe(false);
  expect(result.hasWindData).toBe(false);
  expect(result.hasPrecipitationData).toBe(false);
  expect(result.hasCompleteWeatherData).toBe(false);
  expect(result.alertCount).toBe(0);
});