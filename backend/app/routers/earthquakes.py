from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.dialects.postgresql import insert as postgres_insert

from app.database import get_db
from app.models import Earthquake
from app.services.usgs import get_recent_earthquakes


router = APIRouter(
    prefix="/api/earthquakes",
    tags=["Earthquakes"]
)


def save_earthquakes(db: Session, earthquakes: list):
    saved_count = 0

    columns = {column.name for column in Earthquake.__table__.columns}

    try:
        for earthquake in earthquakes:
            # The feed carries extra context (USGS url, alerts...) that is not stored.
            earthquake_data = {key: value for key, value in earthquake.items() if key in columns}
            # Both the globe and table can request the same feed concurrently.
            # Enforce deduplication at the database boundary, not only via SELECT.
            dialect = db.get_bind().dialect.name
            if dialect in {"sqlite", "postgresql"}:
                insert = sqlite_insert if dialect == "sqlite" else postgres_insert
                statement = insert(Earthquake).values(**earthquake_data).on_conflict_do_nothing(index_elements=["usgs_id"])
                result = db.execute(statement)
                saved_count += max(result.rowcount, 0)
                continue

            existing = (
                db.query(Earthquake)
                .filter(
                    Earthquake.usgs_id == earthquake_data["usgs_id"]
                )
                .first()
            )

            if existing:
                continue

            new_earthquake = Earthquake(**earthquake_data)

            db.add(new_earthquake)
            saved_count += 1

        db.commit()

    except Exception:
        db.rollback()
        raise

    return saved_count


@router.get("/")
async def list_earthquakes(
    db: Session = Depends(get_db),
    window: Literal["latest", "hour", "day", "week"] = "latest",
    min_magnitude: float | None = Query(None, ge=-1, le=10),
    limit: int = Query(20, ge=1, le=500),
):
    # 1. Obtener terremotos reales de USGS
    earthquakes = await get_recent_earthquakes(limit=limit, window=window, min_magnitude=min_magnitude)

    # 2. Guardar los terremotos nuevos en PostgreSQL
    saved_count = save_earthquakes(db, earthquakes)

    # 3. Devolver los datos al frontend
    return {
        "status": "success",
        "window": window,
        "count": len(earthquakes),
        "saved": saved_count,
        "data": earthquakes
    }

from sqlalchemy import func
@router.get("/stats")
def earthquake_stats(db: Session = Depends(get_db)):

    total = db.query(
        func.count(Earthquake.id)
    ).scalar()

    max_magnitude = db.query(
        func.max(Earthquake.magnitude)
    ).scalar()

    avg_magnitude = db.query(
        func.avg(Earthquake.magnitude)
    ).scalar()

    return {
        "status": "success",
        "total_earthquakes": total,
        "max_magnitude": max_magnitude,
        "avg_magnitude": round(float(avg_magnitude), 2)
        if avg_magnitude is not None else None
    }

@router.get("/magnitude-distribution")
def magnitude_distribution(db: Session = Depends(get_db)):

    magnitudes = db.query(Earthquake.magnitude).all()

    distribution = {
        "minor": 0,
        "light": 0,
        "moderate": 0,
        "strong": 0,
        "major": 0,
        "great": 0
    }

    for (magnitude,) in magnitudes:

        if magnitude is None:
            continue

        if magnitude < 4:
            distribution["minor"] += 1
        elif magnitude < 5:
            distribution["light"] += 1
        elif magnitude < 6:
            distribution["moderate"] += 1
        elif magnitude < 7:
            distribution["strong"] += 1
        elif magnitude < 8:
            distribution["major"] += 1
        else:
            distribution["great"] += 1

    return {
        "status": "success",
        "distribution": distribution
    }
