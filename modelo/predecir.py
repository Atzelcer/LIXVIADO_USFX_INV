"""Predicción validada mediante el modelo expresamente aprobado."""
from __future__ import annotations
import joblib
import pandas as pd
from config import RUTA_MODELO, SALIDAS_NO_NEGATIVAS, VARIABLES_ENTRADA, VARIABLES_OBJETIVO
from esquema_datos import validar_registro
from preparar_datos import calcular_derivadas

class ModeloNoDisponible(RuntimeError):
    """Indica que todavía no existe un modelo entrenado y aprobado."""

def cargar_modelo():
    """Carga el artefacto aprobado o falla sin inventar resultados."""
    if not RUTA_MODELO.exists():
        raise ModeloNoDisponible("Modelo no disponible o todavía no entrenado")
    return joblib.load(RUTA_MODELO)

def predecir_experimento(registro: dict) -> dict[str, float]:
    """Valida entradas, calcula derivadas y limita salidas físicamente válidas."""
    artefacto = cargar_modelo()
    datos = validar_registro(registro, incluir_objetivos=False)
    fila = calcular_derivadas(pd.DataFrame([{c: datos[c] for c in VARIABLES_ENTRADA}]))
    valores = artefacto["pipeline"].predict(fila)[0]
    resultado = dict(zip(VARIABLES_OBJETIVO, map(float, valores)))
    resultado["ph_final"] = min(14.0, max(0.0, resultado["ph_final"]))
    for variable in SALIDAS_NO_NEGATIVAS:
        resultado[variable] = max(0.0, resultado[variable])
    return resultado
