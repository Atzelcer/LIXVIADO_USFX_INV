"""API HTTP entre el dashboard y el modelo aprobado."""
from __future__ import annotations
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from config import PERIODO_TRATAMIENTO, RUTA_MODELO, VARIABLES_OBJETIVO
from esquema_datos import ErrorValidacionDatos
from predecir import ModeloNoDisponible, cargar_modelo, predecir_experimento

app = FastAPI(title="Lixiviados ML API", version="0.1.0")
DASHBOARD = Path(__file__).resolve().parents[1] / "dashboard"
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["GET", "POST"], allow_headers=["*"])

@app.get("/")
def inicio():
    """Redirige al dashboard cuando se abre la raíz de la API."""
    return FileResponse(DASHBOARD / "index.html")

@app.get("/health")
def health():
    """Informa disponibilidad del servicio y del modelo."""
    return {"estado": "ok", "modelo_disponible": RUTA_MODELO.exists()}

@app.get("/model-info")
def model_info():
    """Devuelve metadatos reales o un estado controlado si aún no hay modelo."""
    if not RUTA_MODELO.exists():
        return {"disponible": False, "mensaje": "Modelo no disponible o todavía no entrenado", "periodo_tratamiento": PERIODO_TRATAMIENTO}
    artefacto = cargar_modelo()
    metricas = artefacto.get("metricas", {})
    resumen_metricas = {"error_medio_global": metricas.get("error_medio_global"), "advertencias": metricas.get("advertencias", []),
                        "por_objetivo": {nombre: {k: v for k, v in valores.items() if k in {"mae", "rmse", "r2"}}
                                         for nombre, valores in metricas.get("por_objetivo", {}).items()}}
    return {"disponible": True, "modelo": artefacto.get("modelo"), "metricas": resumen_metricas,
            "filas_entrenamiento": artefacto.get("filas_entrenamiento"), "objetivos": VARIABLES_OBJETIVO,
            "procedencia": artefacto.get("procedencia"), "uso_cientifico": artefacto.get("uso_cientifico"),
            "periodo_tratamiento": PERIODO_TRATAMIENTO}

@app.post("/predict")
def predict(registro: dict):
    """Predice seis salidas exclusivamente cuando existe un modelo aprobado."""
    try:
        return predecir_experimento(registro)
    except ModeloNoDisponible as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ErrorValidacionDatos as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

app.mount("/", StaticFiles(directory=DASHBOARD), name="dashboard")
