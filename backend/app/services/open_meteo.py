import asyncio
import logging
import time
from collections import OrderedDict
from copy import deepcopy
from datetime import datetime, timezone

import httpx
from .weather_errors import WeatherProviderUnavailable

logger = logging.getLogger("uvicorn.error")
CACHE_TTL = 600
_cache = OrderedDict()
_weather_lock = asyncio.Lock()
_blocked_until = 0.0


async def fetch_weather_json(url: str, params: dict):
    """Retry brief upstream failures and report their real cause in Render logs."""
    async with httpx.AsyncClient(timeout=httpx.Timeout(8.0, connect=4.0)) as client:
        for attempt in range(2):
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as error:
                response = error.response
                try:
                    detail = str(response.json().get("reason", "No reason supplied"))[:240]
                except (ValueError, AttributeError):
                    detail = "Non-JSON response from provider"
                logger.warning("[OPEN-METEO] host=%s status=%s attempt=%s reason=%s", response.url.host, response.status_code, attempt + 1, detail)
                # Do not repeatedly hit a provider that is rejecting or rate-limiting us.
                if response.status_code not in {500, 502, 503, 504} or attempt == 1:
                    raise
            except httpx.RequestError as error:
                logger.warning("[OPEN-METEO] host=%s error=%s attempt=%s", httpx.URL(url).host, type(error).__name__, attempt + 1)
                if attempt == 1:
                    raise
            await asyncio.sleep(0.4)


OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


async def get_current_weather(latitude: float, longitude: float):
    global _blocked_until
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": [
            "temperature_2m",
            "relative_humidity_2m",
            "apparent_temperature",
            "precipitation",
            "wind_speed_10m",
            "wind_direction_10m",
            "weather_code",
            "is_day",
            "cloud_cover",
            "pressure_msl",
        ],
        "hourly": [
            "temperature_2m",
            "precipitation_probability",
            "weather_code",
        ],
        "daily": [
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "precipitation_probability_max",
            "weather_code",
            "sunrise",
            "sunset",
            "uv_index_max",
        ],
        "forecast_days": 7,
        "forecast_hours": 24,
        "timezone": "auto",
    }

    key = (round(latitude, 4), round(longitude, 4))
    # Serialize cache misses so simultaneous chat/panel requests share one fetch.
    async with _weather_lock:
        now = time.monotonic()
        cached = _cache.get(key)
        if cached and now - cached[0] < CACHE_TTL:
            _cache.move_to_end(key)
            data = deepcopy(cached[1])
            data["nexus_cache"]["hit"] = True
            return data
        if now < _blocked_until:
            raise WeatherProviderUnavailable("weather_rate_limited", _blocked_until - now)
        try:
            data = await fetch_weather_json(OPEN_METEO_URL, params)
        except httpx.HTTPStatusError as error:
            if error.response.status_code == 429:
                try:
                    wait = min(86400, max(60, int(error.response.headers.get("Retry-After", "3600"))))
                except ValueError:
                    wait = 3600
                _blocked_until = time.monotonic() + wait
                raise WeatherProviderUnavailable("weather_rate_limited", wait) from error
            raise WeatherProviderUnavailable() from error
        except (httpx.RequestError, ValueError) as error:
            raise WeatherProviderUnavailable() from error
        if not isinstance(data, dict) or not isinstance(data.get("current"), dict):
            raise WeatherProviderUnavailable()
        data["nexus_cache"] = {"hit": False, "fetched_at": datetime.now(timezone.utc).isoformat(), "max_age_seconds": CACHE_TTL}
        _cache[key] = (time.monotonic(), deepcopy(data))
        while len(_cache) > 128:
            _cache.popitem(last=False)
        return data

AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
_air_cache = OrderedDict()


async def get_air_quality(latitude: float, longitude: float):
    """Current air quality; cached like observations to respect provider limits."""
    key = (round(latitude, 4), round(longitude, 4))
    cached = _air_cache.get(key)
    if cached and time.monotonic() - cached[0] < CACHE_TTL:
        return deepcopy(cached[1])
    try:
        data = await fetch_weather_json(AIR_QUALITY_URL, {
            "latitude": latitude,
            "longitude": longitude,
            "current": ["us_aqi", "european_aqi", "pm2_5", "pm10", "ozone", "nitrogen_dioxide"],
            "timezone": "auto",
        })
    except (httpx.HTTPError, ValueError) as error:
        raise WeatherProviderUnavailable() from error
    if not isinstance(data, dict) or not isinstance(data.get("current"), dict):
        raise WeatherProviderUnavailable()
    _air_cache[key] = (time.monotonic(), deepcopy(data))
    while len(_air_cache) > 128:
        _air_cache.popitem(last=False)
    return data


async def search_city(city_name: str):
    url = "https://geocoding-api.open-meteo.com/v1/search"

    params = {
        "name": city_name,
        "count": 1,
        "language": "en",
        "format": "json"
    }

    data = await fetch_weather_json(url, params)

    results = data.get("results", [])

    if not results:
        return None

    return results[0]
