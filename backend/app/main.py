from fastapi import FastAPI
from app.routers import earthquakes, weather, ai
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from fastapi.responses import JSONResponse
import httpx
import time
from datetime import datetime, timezone
from sqlalchemy import text
from app.config import settings
from app.database import Base, engine

STARTED_AT = time.monotonic()


@asynccontextmanager
async def lifespan(app):
    # Creates missing tables; migrations are required for future schema changes.
    Base.metadata.create_all(bind=engine)
    yield



# Creamos nuestra aplicación
app = FastAPI(
    title="NEXUS API",
    description="Backend del sistema NEXUS",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    
    allow_origins=settings.CORS_ORIGINS,

    allow_credentials=True,
    
    allow_methods=["GET", "POST", "OPTIONS"],

    allow_headers=["*"],
)

app.include_router(earthquakes.router)
app.include_router(weather.router)
app.include_router(ai.router)


@app.exception_handler(httpx.HTTPError)
async def upstream_error(request, error):
    return JSONResponse(status_code=502, content={"detail": "The upstream data service is unavailable. Please try again."})


# Ruta principal
@app.get("/")
def home():
    return {
        "message": "NEXUS SYSTEM ONLINE",
        "status": "success"
    }

# Ruta para comprobar el estado del sistema
@app.get("/health")
def health():
    return {
        "status": "ok",
        "system": "NEXUS"
    }


# Estado agregado para la secuencia de arranque y la barra de estado del frontend
@app.get("/api/system/status")
def system_status():
    database = "online"
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        database = "offline"

    return {
        "status": "ok" if database == "online" else "degraded",
        "version": app.version,
        "uptime_seconds": round(time.monotonic() - STARTED_AT),
        "server_time": datetime.now(timezone.utc).isoformat(),
        "services": {
            "api": "online",
            "database": database,
            "database_engine": engine.dialect.name,
            "ai": "configured" if settings.GEMINI_API_KEY else "not_configured",
        },
    }
