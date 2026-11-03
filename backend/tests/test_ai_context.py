"""Offline checks for how the assistant prepares data; no provider calls."""
from app.services import gemini_service


def test_city_candidates_cover_english_and_spanish_comparisons():
    assert gemini_service.extract_dynamic_city_candidates("Compare the weather in Tokyo and Reykjavík right now.") == ["Tokyo", "Reykjavík right now"]
    assert gemini_service.extract_dynamic_city_candidates("¿Qué clima hace en Tokio y en París?") == ["Tokio", "París"]
    assert gemini_service.extract_dynamic_city_candidates("Weather between Lima vs Quito") == ["Lima", "Quito"]


def test_dynamic_cities_trim_trailing_words_and_ignore_accents(monkeypatch):
    geocoded = {"Tokyo": {"name": "Tokyo"}, "Reykjavík": {"name": "Reykjavik"}}
    monkeypatch.setattr(gemini_service, "validate_city", lambda name: geocoded.get(name))
    assert gemini_service.detect_dynamic_cities("Compare the weather in Tokyo and Reykjavík right now.") == ["Tokyo", "Reykjavík"]


def test_earthquake_summary_is_compact_and_ranked():
    events = [
        {"magnitude": 1.2, "place": "A", "time": "2026-11-03T01:00:00+00:00", "url": "x", "tsunami": False},
        {"magnitude": 5.3, "place": "B", "time": "2026-11-02T10:00:00+00:00", "tsunami": True},
        {"magnitude": None, "place": "C", "time": "2026-11-03T02:00:00+00:00"},
    ]
    summary = gemini_service.summarize_earthquake_records(events, size=2)
    assert summary["strongest"][0]["place"] == "B"
    assert summary["most_recent"][0]["place"] == "C"
    assert "url" not in summary["strongest"][0]
    assert summary["magnitude_bands"] == {"below_2": 1, "2_to_3.9": 0, "4_to_5.9": 1, "6_and_above": 0}
    assert summary["tsunami_flags"] == 1
