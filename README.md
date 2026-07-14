# LixiviaLab ML

Aplicación web para estimar seis variables finales del tratamiento bacteriano de lixiviados: pH, DQO, DBO5, conductividad, turbidez e índice de toxicidad.

## Componentes

- Dashboard responsivo para registrar el lixiviado, seleccionar y configurar bacterias, definir el reactor y consultar resultados.
- API FastAPI con validación de entradas y predicción multisalida.
- Modelo Gradient Boosting entrenado para CPU y almacenado en `modelo/modelo_sintetico_cpu.joblib`.
- Generación y descarga directa de reportes PDF.

## Ejecución local

Desde la raíz del proyecto:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn api:app --app-dir modelo --host 127.0.0.1 --port 8000
```

Abra `http://127.0.0.1:8000`. El mismo servicio entrega la interfaz, los archivos estáticos y los endpoints del modelo.

## Endpoints

- `GET /health`
- `GET /model-info`
- `POST /predict`

## Despliegue en Render

El archivo `render.yaml` contiene la configuración completa del servicio.

1. Suba el contenido de esta carpeta a un repositorio Git.
2. En Render seleccione `New` y luego `Blueprint`.
3. Conecte el repositorio.
4. Render detectará `render.yaml` y creará el servicio `lixivialab-ml`.
5. Cuando termine el despliegue, abra la dirección `onrender.com` asignada.

Configuración equivalente para crear un Web Service manualmente:

- Runtime: `Python 3`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn api:app --app-dir modelo --host 0.0.0.0 --port $PORT`
- Health Check Path: `/health`

## Archivos de entrenamiento

El dataset sintético, las evaluaciones CSV, los entornos virtuales y las cachés están excluidos del repositorio mediante `.gitignore`. El archivo del modelo se conserva porque es necesario para realizar predicciones.

Para reentrenar localmente se encuentran disponibles los módulos de generación, preparación, entrenamiento y evaluación dentro de `modelo`.
