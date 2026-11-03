from app.services.weather_errors import WeatherProviderUnavailable
from app.config import settings
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import errors
import requests
import re
import time
import math



# Localizar el archivo .env dentro de backend
BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


# Leer la clave privada
GEMINI_API_KEY = settings.GEMINI_API_KEY
INTERNAL_API_URL = settings.INTERNAL_API_URL.rstrip("/")


def get_nexus_earthquakes():
    response = requests.get(
        f"{INTERNAL_API_URL}/api/earthquakes/",
        timeout=10
    )

    response.raise_for_status()

    data = response.json()

    return data["data"]


def get_strongest_earthquake(earthquakes: list[dict]):
    valid_earthquakes = [
        earthquake
        for earthquake in earthquakes
        if isinstance(earthquake.get("magnitude"), (int, float))
    ]

    if not valid_earthquakes:
        return None

    return max(
        valid_earthquakes,
        key=lambda earthquake: earthquake["magnitude"]
    )



def get_average_magnitude(earthquakes: list[dict]):
    magnitudes = [
        earthquake["magnitude"]
        for earthquake in earthquakes
        if isinstance(earthquake.get("magnitude"), (int, float))
    ]

    if not magnitudes:
        return None

    return sum(magnitudes) / len(magnitudes)


def get_earthquake_count(earthquakes: list[dict]):
    return len(earthquakes)


def get_nexus_weather(latitude: float, longitude: float):
    response = requests.get(
        f"{INTERNAL_API_URL}/api/weather/",
        params={
            "latitude": latitude,
            "longitude": longitude,
        },
        timeout=25
    )

    if response.status_code == 503:
        try:
            detail = response.json().get("detail", {})
        except ValueError:
            detail = {}
        if isinstance(detail, dict) and detail.get("code") in {"weather_rate_limited", "weather_unavailable"}:
            raise WeatherProviderUnavailable(detail["code"], response.headers.get("Retry-After", 60))
    response.raise_for_status()

    data = response.json()

    return data["data"]



def normalize_city_name(city_name: str) -> str:
    city_aliases = {
        "lisboa": "Lisbon",
        "tokio": "Tokyo",
        "parís": "Paris",
        "medellin": "Medellín",
        "medellín": "Medellín",
        "bogota": "Bogotá",
        "bogotá": "Bogotá",
    }

    return city_aliases.get(
        city_name.strip().casefold(),
        city_name.strip()
    )



def search_city_with_retry(city_name: str):
    try:
        city = search_nexus_city(city_name)

        if city is None:
            print(
                "[NEXUS GEOCODING] Empty response. Retrying..."
            )
            return search_nexus_city(city_name)

        return city

    except (requests.Timeout, requests.ConnectionError):
        print(
            "[NEXUS GEOCODING] Temporary connection error. Retrying..."
        )
        return search_nexus_city(city_name)


def search_nexus_city(city_name: str):
    response = requests.get(
        f"{INTERNAL_API_URL}/api/weather/search",
        params={"name": normalize_city_name(city_name)},
        timeout=10
    )

    response.raise_for_status()
    data = response.json()
    return data.get("data")


def validate_city(city_name: str):
    if not city_name:
        return None

    try:
        city = search_city_with_retry(city_name)


        if city:
            return city

        return None

    except (requests.RequestException, ValueError, TypeError):
        return None


from datetime import datetime, timedelta, timezone


def get_weather_observation_utc(weather: dict):
    current = weather.get("current", {})
    local_time = current.get("time")
    offset_seconds = weather.get("utc_offset_seconds")

    if not local_time or offset_seconds is None:
        return None

    observation_local = datetime.fromisoformat(local_time)

    observation_utc = (
        observation_local - timedelta(seconds=offset_seconds)
    )

    return observation_utc.replace(
        tzinfo=timezone.utc
    ).isoformat()


def are_weather_observations_simultaneous(weather_records: list[dict]):
    if len(weather_records) < 2:
        return None

    observation_times = [
        record.get("observation_utc")
        for record in weather_records
    ]

    if any(observation_time is None for observation_time in observation_times):
        return None

    normalized_times = [
        datetime.fromisoformat(observation_time)
        for observation_time in observation_times
    ]

    return len(set(normalized_times)) == 1


def get_weather_with_retry(latitude: float, longitude: float):
    try:
        return get_nexus_weather(latitude, longitude)
    except (requests.Timeout, requests.ConnectionError):
        print("[NEXUS WEATHER] Temporary connection error. Retrying...")
        return get_nexus_weather(latitude, longitude)


def get_weather_by_city(city_name: str, city_data=None):
    try:
        city = city_data

        if city is None:
            city = search_city_with_retry(city_name)

        if not city:
            return None

        latitude = city["latitude"]
        longitude = city["longitude"]

        
        weather = get_weather_with_retry(latitude, longitude)
        
        temperature = weather.get("current", {}).get("temperature_2m")

        
        if (
            not isinstance(temperature, (int, float))
            or isinstance(temperature, bool)
            or not math.isfinite(temperature)
        ):

            print(
                f"[NEXUS WEATHER] Missing or invalid temperature "
                f"for city: {city_name}"
            )
            return None

        
        return {
            "city": city["name"],
            "state": city.get("admin1"),
            "country": city["country"],
            "observation_utc": get_weather_observation_utc(weather),
            "weather": weather
        }


    
    except (requests.RequestException, KeyError, TypeError, ValueError) as error:
        print(
            f"[NEXUS WEATHER ERROR] "
            f"City: {city_name} | "
            f"Error: {type(error).__name__} | "
            f"Details: {error}"
        )
        return None





def detect_city(message: str):
    cities = [
        "London",
        "Medellin",
        "Medellín",
        "Bogota",
        "Bogotá",
        "New York",
        "Tokyo",
        "Tokio",
        "Lisbon",
        "Lisboa",
        "Paris",
        "París",
        "Madrid",
        "Miami",
    ]

    for city in cities:
        if re.search(r"\b" + re.escape(city) + r"\b", message, re.IGNORECASE):
            return city

    return None



def extract_dynamic_city_candidates(message: str) -> list[str]:
    match = re.search(
        r"\bde\s+([^.!?¿]+)|:\s*([^.!?¿]+)",
        message,
        re.IGNORECASE
    )

    if not match:
        return []

    city_text = match.group(1) or match.group(2)

    candidates = re.split(
        r"\s*,\s*|\s+(?:y|o)\s+",
        city_text,
        flags=re.IGNORECASE
    )

    return [
        candidate.strip()
        for candidate in candidates
        if candidate.strip()
    ]



def detect_dynamic_cities(message: str) -> list[str]:
    candidates = extract_dynamic_city_candidates(message)
    valid_cities = []

    for candidate in candidates:
        city_name = normalize_city_name(candidate)
        city_data = validate_city(city_name)

        if not city_data:
            continue

        if city_name.casefold() != city_data.get("name", "").casefold():
            continue

        if city_name not in valid_cities:
            valid_cities.append(city_name)

    return valid_cities


def detect_multiple_cities(message: str):
    
    cities = [
        "London",
        "Medellin",
        "Medellín",
        "Bogota",
        "Bogotá",
        "New York",
        "Tokyo",
        "Tokio",
        "Lisbon",
        "Lisboa",
        "Paris",
        "París",
        "Madrid",
        "Miami",
    ]


    
    detected_matches = []

    for city in cities:
        match = re.search(
            r"\b" + re.escape(city) + r"\b",
            message,
            re.IGNORECASE
        )

        if match:
            detected_matches.append((match.start(), city))

    detected_matches.sort(key=lambda item: item[0])

    detected_cities = [
        city for _, city in detected_matches
    ]


    
    unique_cities = list(dict.fromkeys(
        normalize_city_name(city)
        for city in detected_cities
    ))

    
    
    dynamic_cities = detect_dynamic_cities(message)

    combined_cities = list(dict.fromkeys(
        unique_cities + dynamic_cities
    ))

    
    def get_city_position(city_name: str) -> int:
        aliases = {
            "Tokyo": ["Tokyo", "Tokio"],
            "Paris": ["Paris", "París"],
            "Lisbon": ["Lisbon", "Lisboa"],
            "Medellín": ["Medellín", "Medellin"],
            "Bogotá": ["Bogotá", "Bogota"],
        }

        possible_names = aliases.get(city_name, [city_name])
        positions = []

        for name in possible_names:
            match = re.search(
                r"\b" + re.escape(name) + r"\b",
                message,
                re.IGNORECASE
            )

            if match:
                positions.append(match.start())

        return min(positions) if positions else len(message)

    combined_cities.sort(key=get_city_position)


    return combined_cities




def extract_city_from_question(message: str):
    pattern = r"\b(?:in|en|for|para)\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,2})"


    match = re.search(pattern, message, re.IGNORECASE)
    
    
    if not match:
        short_message = message.strip(" ?!.,")

        excluded_words = [
            "hello",
            "hi",
            "hey",
            "hola",
            "thanks",
            "thank you",
            "gracias",
            "good morning",
            "good evening",
            "buenos días",
            "buenas tardes",
            "buenas noches",
        ]

        if short_message.lower() in excluded_words:
            return None

        if (
            1 <= len(short_message.split()) <= 3
            and re.fullmatch(r"[A-Za-zÀ-ÿ\s]+", short_message)
        ):
            return short_message



    if match:
        city = match.group(1).strip(" ?!.,")
        invalid_city_phrases = {
                    "your help",
                    "your time",
                    "your response",
                    "your answer",
                    "your support",
                    "more information",
                    "more details",
                }

        if city.lower() in invalid_city_phrases:
            return None
        time_words = [
            "tomorrow",
            "today",
            "tonight",
            "yesterday",
            "mañana",
            "hoy",
            "ayer",
        ]

        words = city.split()

        while words and words[-1].lower() in time_words:
            words.pop()

        return " ".join(words) or None

    return None


def extract_validated_city(message: str):
    candidate = extract_city_from_question(message)

    if not candidate:
        return None

    words = candidate.split()
    
    invalid_start_words = {
        "your", "my", "our", "their", "his", "her",
        "the", "a", "an", "this", "that", "these", "those",
        "tu", "mi", "mis", "su", "sus", "nuestro",
        "el", "la", "los", "las", "un", "una",
        "more", "some", "any", "más"
    }

    if words[0].casefold() in invalid_start_words:
        return None


    for length in range(len(words), 0, -1):
        city_name = " ".join(words[:length])
        city_data = validate_city(city_name)

        if city_data and city_data["name"].casefold() == city_name.casefold():
            return city_name

    return None


def generate_content_with_retry(client, **kwargs):
    max_attempts = 3

    for attempt in range(max_attempts):
        try:
            return client.models.generate_content(**kwargs)

        except errors.ServerError as error:
            if error.code != 503 or attempt == max_attempts - 1:
                raise

            wait_seconds = 2 ** attempt
            print(
                f"Gemini temporarily unavailable (503). "
                f"Retrying in {wait_seconds} seconds..."
            )
            time.sleep(wait_seconds)


def get_gemini_client():
    if not GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured"
        )

    return genai.Client(api_key=GEMINI_API_KEY)


def resolve_city_from_context(client, message: str, history: list[dict] | None = None):
    """
    Identifica una ciudad mencionada anteriormente cuando el usuario
    hace una referencia contextual a ella.
    """
    previous_messages = history or []

    known_cities = []

    for item in previous_messages:
        if item.get("role") != "user":
            continue

        
        previous_text = item.get("content", "")
        city = detect_city(previous_text)

        if not city:
            city = extract_validated_city(previous_text)


        if city and city.lower() not in [c.lower() for c in known_cities]:
            known_cities.append(city)

    if not known_cities:
        return None

    conversation = "\n".join(
        f"{item.get('role', 'unknown')}: {item.get('content', '')}"
        for item in previous_messages[-12:]
    )

    prompt = f"""
You are a geographic reference resolver for NEXUS.

Identify which previously mentioned city the user's latest
message refers to.

Available cities:
{', '.join(known_cities)}

Recent conversation:
{conversation}

Latest user message:
{message}

Rules:
- Use the conversation context to resolve references.
- Only select a city from the available cities.
- Do not invent city names.
- If the reference is ambiguous, return NONE.
- Return ONLY the city name or NONE.
"""

    response = generate_content_with_retry(
        client,
        model=settings.GEMINI_MODEL,
        contents=prompt
    )

    resolved = (response.text or "").strip().strip("\"'`")

    for city in known_cities:
        if resolved.lower() == city.lower():
            return city

    return None



def generate_ai_response(
    message: str,
    history: list[dict] | None = None
) -> str:
    
    client = get_gemini_client()
    
    
    earthquake_keywords = [
        "earthquake",
        "earthquakes",
        "seismic",
        "quake",
        "quakes",
        "tremor",
        "tremors",
        "terremoto",
        "terremotos",
        "sismo",
        "sismos",
        "temblor",
        "temblores",
        "actividad sísmica",
    ]

    
    weather_keywords = [
        "weather",
        "temperature",
        "forecast",
        "rain",
        "raining",
        "humidity",
        "warmer",
        "colder",
        "hotter",
        "cooler",
        "celsius",
        "fahrenheit",
        "degrees",
        "más cálido",
        "más frío",
        "grados",
        "climate",
        "clima",
        "temperatura",
        "pronóstico",
        "lluvia",
        "lloviendo",
        "humedad",
        "temperatures",
        "warmest",
        "coldest",
        "hottest",

    ]



    
    conversation_text = message.lower()

    for item in (history or [])[-4:]:
        if item["role"] == "user":
            conversation_text += " " + item["content"].lower()

    
    needs_earthquake_data = any(
        re.search(r"\b" + re.escape(keyword) + r"\b", conversation_text)
        for keyword in earthquake_keywords
    )

    
    needs_weather_data = any(
        re.search(r"\b" + re.escape(keyword) + r"\b", conversation_text)
        for keyword in weather_keywords
    )

    
    
    
    
    weather_data = None
    
    multiple_cities = detect_multiple_cities(message)

    if needs_weather_data and len(multiple_cities) > 1:
        weather_data = []
        missing_cities = []

        
        for city in multiple_cities:
            city_weather = get_weather_by_city(city)

            if city_weather is not None:
                weather_data.append(city_weather)
            else:
                missing_cities.append(city)


        
        observations_simultaneous = are_weather_observations_simultaneous(weather_data)

        weather_data = {
            "cities": weather_data,
            "missing_cities": missing_cities,
            "observations_simultaneous": observations_simultaneous
        }




    ambiguous_city_request = bool(
        re.search(
            r"\b(?:one of those cities|either city|any of those cities|one of them|either of them|any of them)\b",
            message,
            re.IGNORECASE
        )
    )

    explicit_city = detect_city(message)

    if explicit_city:
        ambiguous_city_request = False





    
    
    
    
    if needs_weather_data and not ambiguous_city_request and len(multiple_cities) <= 1:


        
        full_location_match = re.search(
            r"\b(?:in|en)\s+([A-Za-zÀ-ÿ\s]+,\s*[A-Za-zÀ-ÿ\s]+(?:,\s*[A-Za-zÀ-ÿ\s]+)?)",
            message,
            re.IGNORECASE
        )

        if full_location_match:
            city_name = full_location_match.group(1).strip()
        else:
            city_name = detect_city(message)


        
        if not city_name and re.search(
            r"\b(?:in|en|for|para)\s+",
            message,
            re.IGNORECASE
        ):
            city_name = extract_validated_city(message)

        if not city_name and history:
            city_name = resolve_city_from_context(
                client,
                message,
                history
            )


        
        if not city_name:
            last_assistant_message = ""

            for item in reversed(history or []):
                if item["role"] == "assistant":
                    last_assistant_message = item["content"].lower()
                    break

            asking_for_city = any(
                phrase in last_assistant_message
                for phrase in [
                    "which city",
                    "what city",
                    "specify a city",
                    "qué ciudad",
                    "que ciudad",
                    "indica la ciudad",
                ]
            )

            
            if asking_for_city:
                city_name = extract_validated_city(message)

            
            
            elif re.search(r"\b(?:in|en|for|para)\s+", message, re.IGNORECASE):
                city_name = extract_validated_city(message)


        
        if not city_name:
            for item in reversed(history or []):
                if item["role"] == "user":
                    previous_message = item["content"]

                    city_name = detect_city(previous_message)

                    
                    if not city_name and re.search(
                        r"\b(?:in|en|for|para)\s+",
                        previous_message,
                        re.IGNORECASE
                    ):
                        city_name = extract_validated_city(
                            previous_message
                        )


                    if city_name:
                        break


        
        if city_name:
            validated_city = validate_city(city_name)

            if validated_city:
                weather_data = get_weather_by_city(city_name, city_data=validated_city)






    earthquakes = get_nexus_earthquakes() if needs_earthquake_data else []
    strongest_earthquake = get_strongest_earthquake(earthquakes)
    average_magnitude = get_average_magnitude(earthquakes)
    earthquake_count = get_earthquake_count(earthquakes)





    
    
    if needs_earthquake_data:
        earthquake_context = (
            "The following earthquake records were retrieved "
            "from the NEXUS earthquake API:\n"
            f"{earthquakes}\n\n"
            "The strongest earthquake in these records was "
            "calculated directly by Python:\n"
            f"{strongest_earthquake}\n\n"
            "The average earthquake magnitude was calculated "
            "directly by Python:\n"
            f"{average_magnitude}\n\n"
            "The total number of earthquake records was calculated "
            "directly by Python:\n"
            f"{earthquake_count}\n\n"
            "Use these records when answering questions about "
            "earthquakes in NEXUS. "
            "When asked about the strongest earthquake, use "
            "the Python-calculated result. "
            "When asked about the average magnitude, use "
            "the Python-calculated average. "
            "If the average is None, explain that there are "
            "no valid magnitudes available. "
            "Do not invent earthquake data."
        )

    else:
        earthquake_context = (
            "No earthquake records were requested for this message. "
            "Do not assume that no earthquakes have occurred."
        )

    
    
    if weather_data is not None:
        weather_context = (
            "The following weather information was retrieved "
            "from the NEXUS weather API:\n"
            f"{weather_data}\n"
            "Use these records when answering weather questions. "
            "Weather may come from a cache of up to 10 minutes; use current.time as the observation time, not nexus_cache.fetched_at. "
            "State the observation time when describing current conditions. "
            "Answer only the weather information requested by the user. "
            "If the user asks about one specific city, focus on that city. "
            "Do not mention missing data for other cities unless the user "
            "explicitly requests a comparison involving those cities. "
            "Do not confuse data that was not requested with data "
            "that is unavailable. "
            "Do not invent temperatures, forecasts, or weather conditions. "
            "For multi-city comparisons, check the missing_cities field. "
            "If missing_cities is not empty, explicitly identify "
            "which requested cities could not be retrieved. "
            "Explain that the comparison is incomplete. "
            "Only compare temperatures from cities with available data. "
            "Never invent values for missing cities. "
            "If observations_simultaneous is True, this only confirms "
            "simultaneity among the successfully retrieved cities. "
            "Do not claim that missing cities were observed. "
            "For multi-city weather comparisons, the field "
            "observations_simultaneous contains the result "
            "calculated directly by Python. "
            "If it is True, confirm that all observations "
            "were taken at the same instant. "
            "If it is False, explain that the observations "
            "were taken at different instants. "
            "If it is None, explain that simultaneity "
            "could not be determined from the available data. "
            "Treat this Python-calculated result as authoritative. "
            "Do not override it with your own interpretation. "
            "When comparing weather observations across cities, "
            "use the observation_utc field calculated by Python. "
            "This field represents the observation time in UTC. "
            "If all observation_utc values are identical, "
            "the measurements represent the same instant, "
            "even if their local times are different. "
            "If the UTC values differ, explain that the "
            "observations were taken at different times. "
            "Never determine simultaneity by comparing local "
            "clock times or timezone abbreviations. "
            "If observation_utc is missing, do not claim "
            "that the measurements are simultaneous. "


        )

    
    elif ambiguous_city_request:
        weather_context = (
            "The user's weather request is ambiguous because "
            "it does not identify a specific city. "
            "No weather lookup was attempted for this request. "
            "Ask the user to clarify which city they mean. "
            "Do not claim that weather data is unavailable."
        )

    else:
        weather_context = (
            "No weather data was retrieved for this message. "
            "Do not invent current weather conditions or forecasts. "
            "If the user provided a city name, explain that weather "
            "information could not be retrieved for that location "
            "and suggest checking the city name or trying again later. "
            "If the user did not specify a city, ask them which "
            "city they want to check."
        )



    conversation = []


    for item in history or []:
        role = "model" if item["role"] == "assistant" else "user"

        conversation.append({
            "role": role,
            "parts": [{"text": item["content"]}]
        })

    conversation.append({
        "role": "user",
        "parts": [{"text": message}]
    })

    
    
    response = generate_content_with_retry(
        client,
        model=settings.GEMINI_MODEL,
        contents=conversation,
        config={
            "system_instruction": (
                "You are NEXUS AI, the intelligent assistant of "
                "NEXUS Global Intelligence Monitoring System. "
                "You specialize in explaining earthquakes, weather, "
                "natural hazards, and global environmental information. "
                "Provide clear, accurate, and helpful explanations. "
                "Use plain text for weather measurements and units. "
                "Do not use LaTeX or mathematical notation for temperatures, "
                "precipitation, wind speed, or humidity. "
                "Maintain the context of the conversation. "
                "If you previously asked the user to specify a city "
                "for a weather request, and the user replies with "
                "a greeting or an unrelated message, respond naturally "
                "and gently remind them that you still need the city "
                "to provide the weather information. "
                "Do not interpret greetings or unrelated phrases "
                "as city names. "
                "The earthquake records below are a limited sample "
                "retrieved from the NEXUS API, not a complete global catalog. "
                "Only make claims supported by these records. "
                "Never invent weather observations or forecasts. "
                "Clearly distinguish current weather observations "
                "from future weather forecasts. "
                "Zero current precipitation does not guarantee "
                "that it will not rain later. "
                "Only claim that rain or other weather conditions "
                "are forecast when the supplied weather data "
                "explicitly supports that claim. "
                "If forecast data is unavailable, clearly say "
                "that the future conditions cannot be confirmed. "
                "Daily precipitation_sum values from the weather API "
                "are daily forecast totals, not proof that the rain "
                "has already fallen. "
                "Never claim that forecast precipitation has already "
                "occurred unless observed historical data confirms it. "
                "Clearly distinguish current weather observations "
                "from daily weather forecasts. "
                "Do not invent earthquake data.\n\n"
                + earthquake_context
                + "\n\n" + weather_context

            )
        }
    )


    if not response.text:
        raise RuntimeError("Gemini did not return a text response")

    return response.text



if __name__ == "__main__":
    response = generate_ai_response("Hello NEXUS")
    print(response)

