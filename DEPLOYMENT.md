# Deployment

NEXUS can be deployed as two separate services or as a single Docker Compose stack. In both cases provider keys stay on the server; the front end never receives them.

## Configuration

Back-end environment variables (see `backend/.env.example`):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | `sqlite:///./nexus.db` by default. Use a `postgresql+psycopg://` URL for persistent hosting. |
| `CORS_ORIGINS` | JSON list of the exact front-end origins, for example `["https://nexus.example.com"]`. |
| `GEMINI_API_KEY` | Optional. Enables the AI analyst. |
| `GEMINI_MODEL` | Gemini model name. Defaults to `gemini-flash-lite-latest`. |
| `INTERNAL_API_URL` | Address the back end uses to call its own API when answering AI questions. Must match the port Uvicorn listens on. |

Front-end build variable (see `frontend/.env.example`):

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Public HTTPS address of the API. Leave empty to call `/api` on the same domain through a proxy. It is read at build time, so rebuild after changing it. |

## Option A: separate services

**API**

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Set the variables above in the hosting provider and attach a PostgreSQL database for persistence.

**Front end**

```bash
cd frontend
npm ci
VITE_API_URL=https://your-api.example.com npm run build
```

Publish the `frontend/dist` folder on any static host. Configure the host to serve `index.html` for unknown paths.

## Option B: Docker Compose

The repository includes Dockerfiles for both services and an nginx configuration that serves the front end, proxies `/api` to FastAPI and keeps SQLite on a persistent volume.

```bash
GEMINI_API_KEY=your-key docker compose up --build
```

The application is available at `http://localhost:8080`. The API port is not exposed; nginx connects both containers internally.

## Production checklist

- Serve both parts over HTTPS.
- Restrict `CORS_ORIGINS` to the real front-end domain.
- Keep a rate limit on `POST /api/ai/chat`. The bundled nginx configuration allows six requests per minute per IP; add an equivalent limit on other platforms, and set a spending limit with the AI provider.
- Use PostgreSQL when running more than one instance.
