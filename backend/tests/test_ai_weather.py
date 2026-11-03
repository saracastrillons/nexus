import asyncio
import logging

import httpx
import pytest

from app.services import open_meteo
from app.services.weather_errors import WeatherProviderUnavailable


@pytest.fixture(autouse=True)
def reset_cache(monkeypatch):
    open_meteo._cache.clear()
    monkeypatch.setattr(open_meteo, "_blocked_until", 0.0)
    monkeypatch.setattr(open_meteo, "_weather_lock", asyncio.Lock())


def provider(monkeypatch, statuses):
    responses = iter(statuses)
    calls = []
    real_client = httpx.AsyncClient

    def respond(request):
        calls.append(request)
        status = next(responses)
        return httpx.Response(status, json={"reason": "provider detail"} if status != 200 else {"current": {"temperature_2m": 0}})

    monkeypatch.setattr(open_meteo.httpx, "AsyncClient", lambda **kwargs: real_client(transport=httpx.MockTransport(respond), **kwargs))
    return calls


def test_temporary_failure_recovers(monkeypatch):
    calls = provider(monkeypatch, [503, 200])
    result = asyncio.run(open_meteo.get_current_weather(0, 0))
    assert result["current"]["temperature_2m"] == 0
    assert len(calls) == 2


def test_rate_limit_is_logged_without_retry(monkeypatch, caplog):
    calls = provider(monkeypatch, [429])
    with caplog.at_level(logging.WARNING), pytest.raises(WeatherProviderUnavailable) as caught:
        asyncio.run(open_meteo.get_current_weather(0, 0))
    assert caught.value.code == "weather_rate_limited"
    assert len(calls) == 1
    assert "status=429" in caplog.text
    assert "provider detail" in caplog.text


def test_repeated_failure_stops(monkeypatch):
    calls = provider(monkeypatch, [502, 502])
    with pytest.raises(WeatherProviderUnavailable):
        asyncio.run(open_meteo.get_current_weather(0, 0))
    assert len(calls) == 2


def test_simultaneous_requests_share_one_provider_call(monkeypatch):
    calls = provider(monkeypatch, [200])
    async def requests():
        return await asyncio.gather(*[open_meteo.get_current_weather(0, 0) for _ in range(4)])
    results = asyncio.run(requests())
    assert len(calls) == 1
    assert results[0]["nexus_cache"]["hit"] is False
    assert all(item["nexus_cache"]["hit"] for item in results[1:])


def test_quota_cooldown_prevents_repeated_calls(monkeypatch):
    calls = provider(monkeypatch, [429])
    for _ in range(3):
        with pytest.raises(WeatherProviderUnavailable):
            asyncio.run(open_meteo.get_current_weather(0, 0))
    assert len(calls) == 1


def test_expired_cache_is_not_presented_as_current(monkeypatch):
    calls = provider(monkeypatch, [200, 429])
    asyncio.run(open_meteo.get_current_weather(0, 0))
    _, data = open_meteo._cache[(0, 0)]
    open_meteo._cache[(0, 0)] = (open_meteo.time.monotonic() - open_meteo.CACHE_TTL - 1, data)
    with pytest.raises(WeatherProviderUnavailable):
        asyncio.run(open_meteo.get_current_weather(0, 0))
    assert len(calls) == 2
