from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
from app.config import settings
import requests
import re
from app.services.weather_errors import WeatherProviderUnavailable
from google.genai import errors
from app.services.gemini_service import generate_ai_response


router = APIRouter(prefix="/api/ai", tags=["AI"])



class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=100000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=200)




@router.get("/status")
def ai_status():
    return {
        "status": "success",
        "configured": bool(settings.GEMINI_API_KEY),
        "message": "AI key configured" if settings.GEMINI_API_KEY else "AI key not configured"
    }




@router.post("/chat")
def chat(request: ChatRequest):
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="AI chat is not configured on this server. Earthquake and weather data remain available.")
    try:
        ai_response = generate_ai_response(
            request.message,
            history=[item.model_dump() for item in request.history]
        )

    except WeatherProviderUnavailable as error:
        spanish = bool(re.search(r"[¿ñáéíóú]|\b(clima|temperatura|lluvia|pronostico|hace|tiempo)\b", request.message, re.IGNORECASE))
        raise HTTPException(status_code=503, detail=error.user_message(spanish), headers={"Retry-After": str(error.retry_after)}) from error

    except errors.ServerError as error:
        if error.code == 503:
            raise HTTPException(
                status_code=503,
                detail=(
                    "NEXUS AI is temporarily unavailable due to "
                    "high demand. Please try again shortly."
                )
            ) from error

        raise HTTPException(status_code=502, detail="The AI provider could not complete the request.") from error

    except errors.ClientError as error:
        status = 429 if error.code == 429 else 502
        raise HTTPException(status_code=status, detail="The AI provider could not accept the request. Please try again later.") from error

    except requests.RequestException as error:
        raise HTTPException(status_code=502, detail="The data service used by the assistant is unavailable. Please try again.") from error

    return {
        "status": "success",
        "message_received": request.message,
        "ai_response": ai_response
    }

