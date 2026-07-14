"""Métricas multisalida y advertencias de suficiencia de datos."""
from __future__ import annotations
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from config import MINIMO_GRUPOS_EVALUACION, VARIABLES_OBJETIVO

def evaluar_predicciones(y_real, y_predicho, grupos=None) -> dict:
    """Calcula métricas por salida y un error global normalizado."""
    pred = np.asarray(y_predicho)
    metricas, errores_normalizados = {}, []
    for i, objetivo in enumerate(VARIABLES_OBJETIVO):
        real = np.asarray(y_real.iloc[:, i], dtype=float)
        estimado = pred[:, i]
        mae = mean_absolute_error(real, estimado)
        rmse = mean_squared_error(real, estimado) ** 0.5
        r2 = r2_score(real, estimado) if len(real) >= 2 else None
        escala = np.ptp(real) or max(abs(np.mean(real)), 1.0)
        errores_normalizados.append(mae / escala)
        metricas[objetivo] = {"mae": float(mae), "rmse": float(rmse), "r2": None if r2 is None else float(r2),
                              "real": real.tolist(), "predicho": estimado.tolist()}
    advertencias = []
    numero_grupos = len(set(grupos)) if grupos is not None else 0
    if numero_grupos < MINIMO_GRUPOS_EVALUACION:
        advertencias.append(f"Evaluación limitada: solo {numero_grupos} grupos experimento/reactor en prueba.")
    return {"por_objetivo": metricas, "error_medio_global": float(np.mean(errores_normalizados)), "advertencias": advertencias}
