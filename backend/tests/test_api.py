"""Offline API contract checks; no external provider calls or AI credits."""
from datetime import datetime, timezone

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.routers import earthquakes, weather, ai
from app.services.weather_errors import WeatherProviderUnavailable


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine)
    def test_db():
        with sessions() as session:
            yield session
    app.dependency_overrides[get_db] = test_db
    # No lifespan: this test intentionally uses only its isolated in-memory DB.
    yield TestClient(app)
    app.dependency_overrides.clear()
    engine.dispose()


def test_empty_database(client):
    assert client.get("/health").json()["status"] == "ok"
    stats = client.get("/api/earthquakes/stats").json()
    assert stats["total_earthquakes"] == 0
    assert stats["avg_magnitude"] is None


def test_feed_persistence_deduplication_and_statistics(client, monkeypatch):
    async def feed(**_):
        return [dict(usgs_id="test-event", magnitude=4.4, place="Test location", longitude=-75.5, latitude=6.2, depth=5.9, time=datetime(2026, 10, 30, tzinfo=timezone.utc), url="https://example.test/event", tsunami=False)]
    monkeypatch.setattr(earthquakes, "get_recent_earthquakes", feed)
    assert client.get("/api/earthquakes/").json()["saved"] == 1
    assert client.get("/api/earthquakes/").json()["saved"] == 0
    stats = client.get("/api/earthquakes/stats").json()
    assert stats["total_earthquakes"] == 1
    assert stats["max_magnitude"] == 4.4
    assert client.get("/api/earthquakes/magnitude-distribution").json()["distribution"]["light"] == 1


def test_weather_contract(client, monkeypatch):
    async def observation(latitude, longitude):
        return {"current": {"temperature_2m": 0, "precipitation": 0}, "timezone": "UTC"}
    monkeypatch.setattr(weather, "get_current_weather", observation)
    response = client.get("/api/weather/?latitude=0&longitude=0")
    assert response.json()["data"]["current"]["temperature_2m"] == 0
    assert client.get("/api/weather/?latitude=91&longitude=0").status_code == 422
    assert client.get("/api/weather/?latitude=0&longitude=181").status_code == 422


def test_upstream_failure_is_actionable(client, monkeypatch):
    async def unavailable(latitude, longitude):
        raise httpx.ConnectError("provider unavailable")
    monkeypatch.setattr(weather, "get_current_weather", unavailable)
    assert client.get("/api/weather/?latitude=0&longitude=0").status_code == 502


def test_ai_without_key_and_invalid_history(client, monkeypatch):
    monkeypatch.setattr(ai.settings, "GEMINI_API_KEY", "")
    assert client.post("/api/ai/chat", json={"message": "Hello", "history": []}).status_code == 503
    assert client.post("/api/ai/chat", json={"message": "Hello", "history": [{"role": "system", "content": "invalid"}]}).status_code == 422


def test_ai_contract_without_provider_call(client, monkeypatch):
    monkeypatch.setattr(ai.settings, "GEMINI_API_KEY", "test-placeholder")
    monkeypatch.setattr(ai, "generate_ai_response", lambda message, history: "Test response")
    response = client.post("/api/ai/chat", json={"message": "Hello", "history": []})
    assert response.status_code == 200
    assert response.json()["ai_response"] == "Test response"


def test_weather_quota_is_distinct_from_city_not_found(client, monkeypatch):
    async def limited(latitude, longitude):
        raise WeatherProviderUnavailable("weather_rate_limited", 3600)
    monkeypatch.setattr(weather, "get_current_weather", limited)
    response = client.get("/api/weather/?latitude=0&longitude=0")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "weather_rate_limited"
    assert response.headers["retry-after"] == "3600"


def test_ai_reports_quota_in_spanish_without_fabricating_answer(client, monkeypatch):
    def limited(message, history):
        raise WeatherProviderUnavailable("weather_rate_limited")
    monkeypatch.setattr(ai.settings, "GEMINI_API_KEY", "test-placeholder")
    monkeypatch.setattr(ai, "generate_ai_response", limited)
    response = client.post("/api/ai/chat", json={"message": "¿Qué clima hace en Medellín?", "history": []})
    assert response.status_code == 503
    assert "límite de consultas" in response.json()["detail"]
    assert "ai_response" not in response.json()


def test_feed_window_parameters_are_forwarded_and_validated(client, monkeypatch):
    received = {}
    async def feed(**kwargs):
        received.update(kwargs)
        return []
    monkeypatch.setattr(earthquakes, "get_recent_earthquakes", feed)
    response = client.get("/api/earthquakes/?window=day&min_magnitude=2.5&limit=300")
    assert response.status_code == 200
    assert response.json()["window"] == "day"
    assert received == {"limit": 300, "window": "day", "min_magnitude": 2.5}
    assert client.get("/api/earthquakes/?window=year").status_code == 422
    assert client.get("/api/earthquakes/?limit=5000").status_code == 422


def test_system_status_reports_services(client):
    body = client.get("/api/system/status").json()
    assert body["services"]["api"] == "online"
    assert body["version"] == "2.0.0"
    assert body["services"]["ai"] in {"configured", "not_configured"}


def test_air_quality_contract(client, monkeypatch):
    async def air(latitude, longitude):
        return {"current": {"us_aqi": 42, "pm2_5": 8.1}}
    monkeypatch.setattr(weather, "get_air_quality", air)
    assert client.get("/api/weather/air-quality?latitude=6.2&longitude=-75.5").json()["data"]["current"]["us_aqi"] == 42
    assert client.get("/api/weather/air-quality?latitude=95&longitude=0").status_code == 422
