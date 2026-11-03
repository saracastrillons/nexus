# NEXUS · Global Intelligence

**A mission-control interface for a living planet.** NEXUS streams real seismic activity from USGS onto an interactive 3D globe, analyses it in real time, adds atmospheric intelligence for any city on Earth and lets you question everything through an AI analyst.

Built with React 19, Vite, Three.js (react-globe.gl), Recharts and FastAPI.

![NEXUS command center: live 3D globe with seismic spikes, tectonic plate boundaries and real-time KPIs](docs/screenshots/command-center.jpg)

## Highlights

- **Live planetary globe.** Every event in the selected window (1 h · 24 h · 7 d) is plotted as a spike whose height and colour follow its magnitude. Strong and recent events pulse, tectonic plate boundaries are drawn as animated paths, and the imagery switches between night lights and satellite views.
- **Real-time analytics.** Animated KPIs with sparklines, an activity timeline coloured by the strongest magnitude per interval, a depth-versus-magnitude crustal profile, regional hotspots and the deduplicated archive stored by the backend.
- **Command palette (Ctrl/⌘ + K).** Jump between sections, change the time window, fly to the strongest or most recent event, search events by place, open the weather for any city or start an AI question — all from the keyboard. Keys `1`–`4` switch sections.
- **Live awareness.** A scrolling feed of the latest events, toast notifications when a new M4.5+ event arrives, UTC and local clocks and a system telemetry panel backed by `/api/system/status`.
- **Seismic observatory.** Filter, sort and page every event in the window, locate any event on the globe, open its USGS page and export the filtered result to CSV (formula-safe).
- **Atmospheric intelligence.** Current conditions with WMO weather icons, a 24-hour strip, a 7-day outlook with temperature range bars, sunrise/sunset, UV, pressure, wind direction, air quality (US AQI, PM2.5, PM10, ozone), geolocation and quick city presets.
- **AI analyst.** Gemini-backed answers grounded in NEXUS data, with Markdown, local history, copy, stop and retry.
- **Cinematic but accessible.** A start-up sequence that runs real health checks, a starfield and aurora backdrop, glass panels — and a single control (or `prefers-reduced-motion`) that pauses all motion. Keyboard navigation, focus management and screen-reader labels throughout.

| | |
|---|---|
| ![Event inspection on the globe](docs/screenshots/event-inspection.jpg) | ![Seismic analytics](docs/screenshots/seismic-analytics.jpg) |
| ![Atmospheric intelligence](docs/screenshots/atmospheric-intelligence.jpg) | ![Command palette](docs/screenshots/command-palette.jpg) |

## Architecture and data

```text
React / Vite
    │ configurable public API address
    ▼
FastAPI ─── USGS: recent earthquakes
    ├────── Open-Meteo: observations, forecasts, geocoding
    ├────── Gemini: conversational explanations
    └────── SQLite locally / PostgreSQL when configured
```

`GET /api/earthquakes/` accepts `window` (`latest`, `hour`, `day`, `week`), `min_magnitude` and `limit` (up to 500); the default remains the 20 most recent events. The interface requests the past hour or day at every magnitude, or the past week at M2.5+. Every fetch stores previously unseen event IDs, so the archive panel summarises everything NEXUS has observed and can differ from the live window.

Other endpoints: `/api/weather/` (observation, 24-hour and 7-day forecast), `/api/weather/air-quality`, `/api/weather/search`, `/api/system/status` and `/api/ai/chat`. Interactive documentation is served by FastAPI at `/docs`. This is observation and exploration software; it does not predict earthquakes. Weather threshold checks are application rules, not official warnings.

Weather observations retain the provider's timezone when supplied. Event occurrence times are displayed in UTC. AI text may contain errors; source citations and retrieval metadata are not currently supplied as structured chat fields.

## Run locally

Requirements: Node.js 22.12+ (Node 24 recommended for parity with validation), Python 3.13+, and internet access to the data providers.

From `backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

The example defaults to SQLite and creates missing tables at startup. Set `DATABASE_URL` to a `postgresql+psycopg://...` URL to use PostgreSQL. Add your own `GEMINI_API_KEY` to `backend/.env` to enable AI; the rest of the app runs without it.

From `frontend`, in a second terminal:

```powershell
npm ci
npm run dev
```

Open the address printed by Vite. Development uses `http://127.0.0.1:8000` by default. To change it, copy `frontend/.env.example` to `.env` and set `VITE_API_URL`. This value is public; never put provider keys in frontend variables.

## Validation

```powershell
# frontend
npm run lint
npm test
npm run build

# backend, with its virtual environment active
python -m pytest tests -q
```

The automated API tests use an isolated in-memory database and mocked provider responses. They do not require an AI key or call paid APIs. See [VALIDATION.md](VALIDATION.md) for the actual checks performed on this copy, including separate live-data checks.

## Demo walkthrough

1. Watch the start-up sequence, then press Ctrl + K and type a region (for example "Alaska") to fly to an event.
2. On the Dashboard switch between 1H, 24H and 7D, toggle globe layers and inspect an event card.
3. Click a regional hotspot to open the Observatory filtered by that region, then export the result as CSV.
4. Search for a city in Weather, or use your location, and compare the hourly and 7-day outlook.
5. Start a new AI chat and select a suggested question. Configure an AI key first for live responses.

## Deployment and practical limits

See [DEPLOYMENT.md](DEPLOYMENT.md) for separate hosting and Docker setup. The app has not been publicly deployed by this update.

- The 3D globe is lazy-loaded but remains a large resource. Earth textures are self-hosted in `frontend/public/textures`; plate boundaries are fetched from jsDelivr and the globe works without them.
- SQLite suits a single-instance demo. Shared/multi-instance deployments should use PostgreSQL and a migration process.
- The AI currently calls NEXUS internally over HTTP. Configure `INTERNAL_API_URL` to the address reachable by its backend process.
- Local chat history is stored in the browser, with up to 200 messages persisted; it is not an account-based history service.
- The included nginx setup limits AI request frequency per IP. Separate API hosting needs equivalent limits and provider spending controls before exposing a public demo.
- Threshold tests cover logic and API contracts; full automated browser coverage and public-host testing remain future work.

## Data providers

- [USGS earthquake service](https://earthquake.usgs.gov/fdsnws/event/1/)
- [Open-Meteo](https://open-meteo.com/)
- [Google Gemini](https://ai.google.dev/)
- Plate boundaries: Bird, P. (2003), *An updated digital model of plate boundaries* (PB2002), via [fraxen/tectonicplates](https://github.com/fraxen/tectonicplates) (ODC-By)
- Earth imagery: NASA Blue Marble and Black Marble, packaged with [three-globe](https://github.com/vasturiano/three-globe) (MIT)
