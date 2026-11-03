function WeatherAlerts({
  weather,
  isExtremeHeat,
  isStrongWind,
  isHeavyRain,
  alertCount,
  hasTemperatureData,
  hasWindData,
  hasPrecipitationData,
  hasCompleteWeatherData,
}) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between rounded-lg border border-cyan-900/40 bg-[#060a12] p-4">
        <div>
          <p className="font-semibold text-gray-200">Weather Data Status</p>
          <p className="mt-1 text-sm text-gray-400">
            Temperature, wind and precipitation measurements
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            hasCompleteWeatherData
              ? "bg-green-500/10 text-green-400"
              : "bg-yellow-500/10 text-yellow-400"
          }`}
        >
          {hasCompleteWeatherData ? "Complete" : "Incomplete"}
        </span>
      </div>
      <div className="mb-6 rounded-lg border border-cyan-900/40 bg-[#060a12] p-4">
        <p className="text-sm text-gray-400">Active Weather Alerts</p>

        <p
          className={`mt-2 text-3xl font-bold ${
            alertCount === 0 ? "text-green-400" : "text-red-400"
          }`}
        >
          {alertCount}
        </p>
      </div>
      {!hasTemperatureData && (
        <div className="mb-6 rounded-lg border border-yellow-500 bg-yellow-500/10 p-4">
          <p className="font-semibold text-yellow-400">
            ⚠️ Temperature Data Unavailable
          </p>

          <p className="mt-2 text-sm text-gray-300">
            Temperature could not be verified. Heat alert status is unknown.
          </p>
        </div>
      )}

      {!hasWindData && (
        <div className="mb-6 rounded-lg border border-yellow-500 bg-yellow-500/10 p-4">
          <p className="font-semibold text-yellow-400">
            ⚠️ Wind Data Unavailable
          </p>

          <p className="mt-2 text-sm text-gray-300">
            Wind speed could not be verified. Strong wind alert status is
            unknown.
          </p>
        </div>
      )}

      {!hasPrecipitationData && (
        <div className="mb-6 rounded-lg border border-yellow-500 bg-yellow-500/10 p-4">
          <p className="font-semibold text-yellow-400">
            ⚠️ Precipitation Data Unavailable
          </p>

          <p className="mt-2 text-sm text-gray-300">
            Precipitation could not be verified. Heavy rain alert status is
            unknown.
          </p>
        </div>
      )}

      {isExtremeHeat && (
        <div className="mb-6 rounded-lg border border-red-500 bg-red-500/10 p-4">
          <p className="font-semibold text-red-400">⚠️ Extreme Heat Alert</p>
          <p className="mt-2 text-sm text-gray-300">
            High temperature detected: {weather.temperature_2m} °C. Exercise
            caution during outdoor activities.
          </p>
        </div>
      )}

      {isStrongWind && (
        <div className="mb-6 rounded-lg border border-orange-500 bg-orange-500/10 p-4">
          <p className="font-semibold text-orange-400">🌪️ Strong Wind Alert</p>
          <p className="mt-2 text-sm text-gray-300">
            Strong winds detected: {weather.wind_speed_10m} km/h. Exercise
            caution during outdoor activities.
          </p>
        </div>
      )}

      {isHeavyRain && (
        <div className="mb-6 rounded-lg border border-blue-500 bg-blue-500/10 p-4">
          <p className="font-semibold text-blue-400">🌧️ Heavy Rain Alert</p>
          <p className="mt-2 text-sm text-gray-300">
            Heavy rainfall detected: {weather.precipitation} mm. Exercise
            caution in areas prone to flooding.
          </p>
        </div>
      )}

      {hasCompleteWeatherData &&
        !isExtremeHeat &&
        !isStrongWind &&
        !isHeavyRain && (
          <div className="mb-6 rounded-lg border border-green-500 bg-green-500/10 p-4">
            <p className="font-semibold text-green-400">
              ✅ No Weather Alerts Detected
            </p>
            <p className="mt-2 text-sm text-gray-300">
              No configured weather thresholds have been exceeded for the
              selected city.
            </p>
          </div>
        )}
    </div>
  );
}

export default WeatherAlerts;
