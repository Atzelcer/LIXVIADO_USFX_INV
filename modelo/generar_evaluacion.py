"""Exporta Y frente a Ŷ del conjunto de prueba del modelo sintético."""
import json
import joblib
import numpy as np
import pandas as pd
from config import RUTA_EVALUACION, RUTA_METRICAS, RUTA_MODELO, VARIABLES_OBJETIVO
from preparar_datos import cargar_datos, preparar_datos, separar_por_grupos

def main() -> None:
    x, y, grupos = preparar_datos(cargar_datos("dataset_sintetico_50000.csv"), permitir_simulados=True)
    _, x_prueba, _, y_prueba, grupos_prueba = separar_por_grupos(x, y, grupos)
    artefacto = joblib.load(RUTA_MODELO)
    predicciones = artefacto["pipeline"].predict(x_prueba)
    salida = pd.DataFrame({"id_experimento": grupos_prueba.to_numpy()})
    for i, objetivo in enumerate(VARIABLES_OBJETIVO):
        real = y_prueba.iloc[:, i].to_numpy()
        predicho = predicciones[:, i]
        salida[f"{objetivo}_y"] = real
        salida[f"{objetivo}_yhat"] = predicho
        salida[f"{objetivo}_error_absoluto"] = np.abs(real - predicho)
        error_pct = np.full(real.shape, np.nan, dtype=float)
        np.divide(np.abs(real - predicho) * 100, np.abs(real), out=error_pct, where=real != 0)
        salida[f"{objetivo}_error_pct"] = error_pct
    salida.to_csv(RUTA_EVALUACION, index=False, float_format="%.8g")
    metricas = artefacto["metricas"]
    resumen = {"modelo_seleccionado": artefacto["modelo"], "procedencia": artefacto["procedencia"],
               "uso_cientifico": artefacto["uso_cientifico"], "filas_entrenamiento": artefacto["filas_entrenamiento"],
               "filas_prueba": len(salida), "error_medio_global": metricas["error_medio_global"],
               "advertencias": metricas["advertencias"],
               "por_objetivo": {o: {k: metricas["por_objetivo"][o][k] for k in ("mae", "rmse", "r2")}
                                  for o in VARIABLES_OBJETIVO}}
    RUTA_METRICAS.write_text(json.dumps(resumen, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(resumen, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
