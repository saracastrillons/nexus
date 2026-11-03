class WeatherProviderUnavailable(Exception):
    """An unavailable upstream provider, never a misspelled city."""

    def __init__(self, code="weather_unavailable", retry_after=60):
        self.code = code
        self.retry_after = max(1, int(retry_after))
        self.message = (
            "The weather provider has reached its request limit. No new observation can be retrieved right now."
            if code == "weather_rate_limited" else
            "The weather provider is temporarily unavailable. No new observation can be verified right now."
        )
        super().__init__(self.message)

    def user_message(self, spanish=False):
        if not spanish:
            return self.message + " This is a provider availability issue, not an invalid city name. I cannot confirm current measurements without data."
        if self.code == "weather_rate_limited":
            return "El proveedor meteorológico alcanzó su límite de consultas. La ciudad es válida, pero ahora no puedo recuperar una observación nueva ni confirmar sus mediciones. Esto no es un problema con tu pregunta."
        return "El proveedor meteorológico está temporalmente fuera de servicio. La ciudad es válida, pero ahora no puedo verificar sus mediciones. No voy a inventar datos actuales."
