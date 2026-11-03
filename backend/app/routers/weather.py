from fastapi import APIRouter, Query, HTTPException
from app.services.weather_errors import WeatherProviderUnavailable
from app.services.open_meteo import get_air_quality, get_current_weather, search_city

router = APIRouter(
    prefix="/api/weather",
    tags=["Weather"]
)


@router.get("/")
async def get_weather(latitude: float = Query(ge=-90, le=90), longitude: float = Query(ge=-180, le=180)):
    try:
        weather_data = await get_current_weather(latitude, longitude)
    except WeatherProviderUnavailable as error:
        raise HTTPException(status_code=503, detail={"code": error.code, "message": error.message}, headers={"Retry-After": str(error.retry_after)}) from error

    return {
        "status": "success",
        "data": weather_data
    }

@router.get("/air-quality")
async def air_quality(latitude: float = Query(ge=-90, le=90), longitude: float = Query(ge=-180, le=180)):
    try:
        data = await get_air_quality(latitude, longitude)
    except WeatherProviderUnavailable as error:
        raise HTTPException(status_code=503, detail={"code": error.code, "message": error.message}, headers={"Retry-After": str(error.retry_after)}) from error

    return {
        "status": "success",
        "data": data
    }

@router.get("/search")
async def search_weather_city(name: str = Query(min_length=1, max_length=200)):
    city = await search_city(name)

    if city is None:
        return {
            "status": "error",
            "message": "City not found"
        }

    return {
        "status": "success",
        "data": city
    }
