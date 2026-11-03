# Comprobaciones realizadas · 31 de octubre de 2026

Sobre la copia `nexus-project`, extraída del ZIP del usuario sin `.env`, dependencias, historial Git ni entornos virtuales.

## Frontend

- Instalación limpia con `npm ci`: correcta.
- `npm run lint`: correcto, sin advertencias.
- `npm test`: **25 pruebas correctas** (18 existentes de umbrales meteorológicos y 7 de contratos/filtros).
- `npm run build`: correcto.
- Carga separada por módulos: entrada JavaScript de aproximadamente 232 kB sin comprimir, frente a aproximadamente 2.76 MB antes de separar módulos.
- Advertencia pendiente: el módulo del globo sigue pesando aproximadamente 1.95 MB sin comprimir (546 kB comprimido). El aviso de tamaño de Vite permanece visible; no se ocultó.

## Backend

- Instalación limpia con Python 3.13 y las dependencias declaradas: correcta; versiones directas fijadas en `requirements.txt`.
- `python -m pytest tests -q`: **6 pruebas correctas**.
- Pruebas sin red: base vacía, persistencia y deduplicación, estadísticas/distribución, contrato meteorológico y coordenadas inválidas, fallo del proveedor, IA sin clave e historial inválido, y contrato de respuesta de IA simulado.
- Una advertencia de deprecación de Starlette sobre su integración de TestClient con httpx. No impidió las pruebas.
- Arranque real de Uvicorn y creación de tablas con una base SQLite de comprobación independiente: correcto.
- `/health`: HTTP 200.
- `/api/earthquakes/`: HTTP 200 y 20 eventos reales obtenidos de USGS.
- `/api/weather/?latitude=6.2442&longitude=-75.5812`: HTTP 200 con observación de Medellín y pronóstico diario.

Los datos de ejemplo de los tests están aislados en una base en memoria; no se incorporan a los datos de la interfaz.

## Navegador

Revisión local con frontend y backend conectados, sin usar las claves del usuario:

- AI Assistant: se ocultan las estadísticas sísmicas del encabezado, el historial/compositor son más compactos y la bienvenida abre desde arriba.
- Pantalla de 390 px: el documento no presenta desbordamiento horizontal; el canvas del globo ocupa 286 px y los paneles pasan al flujo normal debajo del planeta.
- Weather: aparece Medellín con temperatura real, zona `America/Bogota` y el selector cambia al pronóstico de precipitación.
- Earthquakes: filtro sin coincidencias, reinicio de filtros y navegación a la página 2 de 2, mostrando eventos 11–20.
- AI Assistant sin clave: se muestra el error del backend y el botón de reintento, sin añadir una respuesta ficticia.
- Capturas de revisión en `docs/screenshots/`. La captura móvil corresponde al chat y la de escritorio a una ventana compacta de 800 px.

## Pendiente antes de compartir la demo pública

- Probar respuestas reales de Gemini con la clave configurada por el propietario. No se consumió su API de IA.
- Probar PostgreSQL y los contenedores Docker. Se validó SQLite localmente; Docker no está instalado aquí.
- Probar el dominio público, HTTPS, CORS, límites de acceso/gasto y almacenamiento persistente del alojamiento elegido.
- Grabar el recorrido final y añadir el enlace público al README. No se ha publicado ni modificado ningún repositorio remoto.
