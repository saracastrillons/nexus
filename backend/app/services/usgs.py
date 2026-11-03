import httpx
from datetime import datetime, timedelta, timezone

USGS_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"

# Observation windows exposed by the API. "latest" keeps the original behaviour.
WINDOWS = {
    "hour": timedelta(hours=1),
    "day": timedelta(days=1),
    "week": timedelta(days=7),
}


async def get_recent_earthquakes(limit: int = 20, window: str = "latest", min_magnitude: float | None = None):

    params = {
        "format": "geojson",
        "orderby": "time",
        "limit": limit
    }

    if window in WINDOWS:
        params["starttime"] = (datetime.now(timezone.utc) - WINDOWS[window]).strftime("%Y-%m-%dT%H:%M:%S")

    if min_magnitude is not None:
        params["minmagnitude"] = min_magnitude

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(USGS_URL, params=params)
        response.raise_for_status()
        data = response.json()

    earthquakes = []

    for feature in data["features"]:

        properties = feature["properties"]
        coordinates = feature["geometry"]["coordinates"]

        earthquake = {
            "usgs_id": feature["id"],
            "magnitude": properties["mag"],
            "place": properties["place"],
            "longitude": coordinates[0],
            "latitude": coordinates[1],
            "depth": coordinates[2],
            "time": datetime.fromtimestamp(
                properties["time"] / 1000,
                tz=timezone.utc
            ),
            # Context returned to the client only; not persisted.
            "url": properties.get("url"),
            "felt": properties.get("felt"),
            "tsunami": bool(properties.get("tsunami")),
            "alert": properties.get("alert"),
            "significance": properties.get("sig"),
            "magnitude_type": properties.get("magType"),
        }

        earthquakes.append(earthquake)

    return earthquakes
