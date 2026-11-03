const WEATHER_THRESHOLDS = {
  extremeHeat: 35,
  strongWind: 50,
  heavyRain: 10,
};

export function calculateWeatherAlerts(weather) {
  const hasTemperatureData =
    typeof weather.temperature_2m === "number" &&
    Number.isFinite(weather.temperature_2m);

  const hasWindData =
    typeof weather.wind_speed_10m === "number" &&
    Number.isFinite(weather.wind_speed_10m);

  const hasPrecipitationData =
    typeof weather.precipitation === "number" &&
    Number.isFinite(weather.precipitation);

  const hasCompleteWeatherData =
    hasTemperatureData && hasWindData && hasPrecipitationData;

  const isExtremeHeat =
    hasTemperatureData &&
    weather.temperature_2m >= WEATHER_THRESHOLDS.extremeHeat;

  const isStrongWind =
    hasWindData && weather.wind_speed_10m >= WEATHER_THRESHOLDS.strongWind;

  const isHeavyRain =
    hasPrecipitationData &&
    weather.precipitation >= WEATHER_THRESHOLDS.heavyRain;

  const alertCount =
    Number(isExtremeHeat) + Number(isStrongWind) + Number(isHeavyRain);

  return {
    isExtremeHeat,
    isStrongWind,
    isHeavyRain,
    alertCount,
    hasTemperatureData,
    hasWindData,
    hasPrecipitationData,
    hasCompleteWeatherData,
  };
}
