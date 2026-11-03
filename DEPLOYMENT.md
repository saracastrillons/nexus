# Preparar la demo pública

Esta copia no contiene claves, bases de datos privadas ni los archivos `.env` del ZIP original. Tu proyecto y ZIP originales permanecen intactos.

## Probar primero

1. Usa esta carpeta completa como una copia nueva del proyecto. No mezcles el `node_modules` o `.venv` antiguos con ella.
2. Sigue la instalación del README. Para recuperar tu configuración de PostgreSQL/Gemini, copia tus valores privados a `backend/.env` localmente.
3. Comprueba Dashboard, Earthquakes, Weather y AI Assistant, tanto en escritorio como con la ventana estrecha.
4. Ejecuta las pruebas y `npm run build` antes de publicar.

## Opción A: frontend y API en servicios separados

- Backend: ejecutar desde `backend` con `uvicorn app.main:app --host 0.0.0.0 --port <puerto del servicio>`.
- Configurar `DATABASE_URL` (PostgreSQL con almacenamiento persistente), `GEMINI_API_KEY` opcional y `GEMINI_MODEL` en el entorno del servidor.
- Configurar `INTERNAL_API_URL` para que los llamados internos de IA lleguen al mismo servicio; el puerto debe coincidir con el de Uvicorn.
- Configurar `CORS_ORIGINS` como una lista JSON de los dominios exactos del frontend, por ejemplo `["https://tu-dominio.example"]`.
- Frontend: configurar `VITE_API_URL=https://tu-api.example` **antes de compilar**, ejecutar `npm ci` y `npm run build`; publicar `frontend/dist`.
- Mantener HTTPS en ambas partes. Aplicar límites a las solicitudes de IA en el servidor o en el proxy de la plataforma y limitar el gasto en el proveedor.

Si `VITE_API_URL` está vacío en producción, el frontend llama `/api` en su propio dominio: hace falta un proxy hacia FastAPI. Cambiar una variable de Vite después del build no modifica los archivos ya compilados.

## Opción B: Docker Compose

Hay Dockerfiles para frontend/backend, nginx con proxy de `/api` y un volumen persistente para SQLite:

```powershell
docker compose up --build
```

Abrir `http://localhost:8080`. Para habilitar IA, definir `GEMINI_API_KEY` en el entorno antes de ejecutar Compose. No está publicada la puerta 8000 del backend; nginx conecta ambos servicios internamente.

Esta configuración de Docker se preparó como alternativa de despliegue, pero no se ejecutó en este entorno porque Docker no está instalado. Antes de publicar, probar los contenedores y colocar HTTPS delante de nginx. El límite de IA por IP del proxy no sustituye una política de acceso ni los límites del proveedor.

## Antes de compartir con un reclutador

- Enlace público que abra sin instrucciones ni claves.
- Comprobar desde una sesión nueva que llegan eventos y clima reales.
- Confirmar que una ciudad inexistente y un servicio desconectado muestran errores útiles.
- Grabar un recorrido de 45–60 segundos con las cuatro secciones.
- Añadir al README el enlace público y capturas de esa demo, sin credenciales ni datos personales.
