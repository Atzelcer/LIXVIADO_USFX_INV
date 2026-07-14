"""Comparación de modelos clásicos para regresión multisalida."""
from __future__ import annotations
import argparse
import json
import joblib
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.multioutput import MultiOutputRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from config import RUTA_METRICAS, RUTA_MODELO, SEMILLA_ALEATORIA
from evaluar import evaluar_predicciones
from preparar_datos import cargar_datos, clasificar_columnas_modelo, preparar_datos, separar_por_grupos

def crear_preprocesador() -> ColumnTransformer:
    """Crea imputación y transformación sin fuga desde el conjunto de prueba."""
    numericas, categoricas = clasificar_columnas_modelo()
    pipeline_num = Pipeline([("imputar", SimpleImputer(strategy="median")), ("escalar", StandardScaler())])
    pipeline_cat = Pipeline([("imputar", SimpleImputer(strategy="most_frequent")), ("codificar", OneHotEncoder(handle_unknown="ignore", sparse_output=False))])
    return ColumnTransformer([("numericas", pipeline_num, numericas), ("categoricas", pipeline_cat, categoricas)])

def modelos_candidatos() -> dict:
    """Define candidatos sin asumir cuál resultará ganador."""
    return {
        "ridge": MultiOutputRegressor(Ridge(alpha=1.0)),
        "random_forest": RandomForestRegressor(n_estimators=160, min_samples_leaf=2, max_features=0.8,
                                                 random_state=SEMILLA_ALEATORIA, n_jobs=-1),
        "gradient_boosting": MultiOutputRegressor(GradientBoostingRegressor(random_state=SEMILLA_ALEATORIA)),
    }

def entrenar_y_comparar(ruta_datos: str, guardar: bool = False, sintetico: bool = False) -> dict:
    """Entrena candidatos, selecciona por error global y opcionalmente persiste el aprobado."""
    x, y, grupos = preparar_datos(cargar_datos(ruta_datos), permitir_simulados=sintetico)
    x_ent, x_pru, y_ent, y_pru, grupos_pru = separar_por_grupos(x, y, grupos)
    resultados, pipelines = {}, {}
    for nombre, modelo in modelos_candidatos().items():
        pipeline = Pipeline([("preprocesamiento", crear_preprocesador()), ("modelo", modelo)])
        pipeline.fit(x_ent, y_ent)
        resultados[nombre] = evaluar_predicciones(y_pru, pipeline.predict(x_pru), grupos_pru)
        pipelines[nombre] = pipeline
    ganador = min(resultados, key=lambda n: resultados[n]["error_medio_global"])
    if guardar:
        artefacto = {"pipeline": pipelines[ganador], "modelo": ganador, "metricas": resultados[ganador],
                     "filas_entrenamiento": len(x_ent), "procedencia": "simulado" if sintetico else "medido",
                     "uso_cientifico": False if sintetico else "requiere_aprobacion_experta"}
        joblib.dump(artefacto, RUTA_MODELO)
    resumen = {"modelo_seleccionado": ganador, "modelos": resultados, "modelo_guardado": guardar,
               "procedencia": "simulado" if sintetico else "medido", "ruta_modelo": str(RUTA_MODELO) if guardar else None}
    if guardar:
        RUTA_METRICAS.write_text(json.dumps(resumen, ensure_ascii=False, indent=2), encoding="utf-8")
    return resumen

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Entrena y compara modelos con datos experimentales medidos.")
    parser.add_argument("datos", help="Ruta CSV/XLSX")
    parser.add_argument("--aprobar", action="store_true", help="Guarda el ganador como modelo aprobado")
    parser.add_argument("--sintetico", action="store_true", help="Permite un lote exclusivamente sintético y lo etiqueta")
    args = parser.parse_args()
    print(json.dumps(entrenar_y_comparar(args.datos, args.aprobar, args.sintetico), ensure_ascii=False, indent=2))
