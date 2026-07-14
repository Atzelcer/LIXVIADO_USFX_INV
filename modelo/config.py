"""Configuración central del sistema de aprendizaje para lixiviados."""
from pathlib import Path

RAIZ_PROYECTO = Path(__file__).resolve().parents[1]
RUTA_MODELO = Path(__file__).resolve().parent / "modelo_sintetico_cpu.joblib"
RUTA_METRICAS = Path(__file__).resolve().parent / "metricas_modelo_sintetico.json"
RUTA_EVALUACION = Path(__file__).resolve().parent / "evaluacion_y_yhat.csv"
SEMILLA_ALEATORIA = 42
PROPORCION_PRUEBA = 0.20
PERIODO_TRATAMIENTO = "Periodo estandarizado definido por el protocolo experimental"

BACTERIAS = ("pseudomonas", "bacillus_cereus", "klebsiella", "clostridium")

VARIABLES_LIXIVIADO = [
    "ph_inicial", "temperatura_inicial", "dqo_inicial", "dbo5_inicial",
    "oxigeno_disuelto_inicial", "amonio_inicial", "conductividad_inicial",
    "turbidez_inicial", "indice_toxicidad_inicial", "volumen_lixiviado_ml",
]
VARIABLES_BACTERIA = [
    f"{b}_{s}" for b in BACTERIAS for s in (
        "aplicada", "concentracion_ufc_ml", "volumen_cultivo_ml",
        "proporcion_pct", "edad_cultivo_h", "tiempo_incubacion_h",
        "temperatura_incubacion_c", "medio_cultivo", "condicion_incubacion",
    )
]
VARIABLES_EXPERIMENTO = [
    "temperatura_tratamiento_c", "aireacion", "agitacion_rpm",
    "volumen_total_reactor_ml", "tipo_tratamiento",
]
IDENTIFICADORES = ["id_experimento"]
VARIABLE_PROCEDENCIA = "procedencia_dato"
VARIABLES_OBJETIVO = [
    "ph_final", "dqo_final", "dbo5_final", "conductividad_final",
    "turbidez_final", "indice_toxicidad_final",
]
VARIABLES_ENTRADA = VARIABLES_LIXIVIADO + VARIABLES_BACTERIA + VARIABLES_EXPERIMENTO
COLUMNAS_OBLIGATORIAS = IDENTIFICADORES + VARIABLES_ENTRADA + VARIABLES_OBJETIVO + [VARIABLE_PROCEDENCIA]

VARIABLES_CATEGORICAS = (
    [f"{b}_aplicada" for b in BACTERIAS]
    + [f"{b}_medio_cultivo" for b in BACTERIAS]
    + [f"{b}_condicion_incubacion" for b in BACTERIAS]
    + ["aireacion", "tipo_tratamiento"]
)
VARIABLES_NUMERICAS = [c for c in VARIABLES_ENTRADA if c not in VARIABLES_CATEGORICAS]
VARIABLES_DERIVADAS = (
    [f"{b}_ufc_totales" for b in BACTERIAS]
    + [f"{b}_concentracion_final_reactor_ufc_ml" for b in BACTERIAS]
    + ["ufc_totales_consorcio", "concentracion_final_consorcio_ufc_ml", "suma_proporciones_pct"]
)

UNIDADES = {
    "ph_inicial": "adimensional", "temperatura_inicial": "°C", "dqo_inicial": "mg/L",
    "dbo5_inicial": "mg/L", "oxigeno_disuelto_inicial": "mg/L", "amonio_inicial": "mg/L",
    "conductividad_inicial": "µS/cm", "turbidez_inicial": "NTU",
    "indice_toxicidad_inicial": "%", "volumen_lixiviado_ml": "mL",
    "temperatura_tratamiento_c": "°C", "agitacion_rpm": "rpm",
    "volumen_total_reactor_ml": "mL", "ph_final": "adimensional", "dqo_final": "mg/L",
    "dbo5_final": "mg/L", "conductividad_final": "µS/cm", "turbidez_final": "NTU",
    "indice_toxicidad_final": "%",
}
for bacteria in BACTERIAS:
    UNIDADES.update({
        f"{bacteria}_concentracion_ufc_ml": "UFC/mL", f"{bacteria}_volumen_cultivo_ml": "mL",
        f"{bacteria}_proporcion_pct": "%", f"{bacteria}_edad_cultivo_h": "h",
        f"{bacteria}_tiempo_incubacion_h": "h", f"{bacteria}_temperatura_incubacion_c": "°C",
    })

LIMITES = {
    "ph_inicial": (0, 14), "ph_final": (0, 14),
    "temperatura_inicial": (0, 100), "temperatura_tratamiento_c": (0, 100),
    "indice_toxicidad_inicial": (0, 100), "indice_toxicidad_final": (0, 100),
    "agitacion_rpm": (0, None), "volumen_lixiviado_ml": (0.000001, None),
    "volumen_total_reactor_ml": (0.000001, None),
}
for columna in VARIABLES_NUMERICAS + VARIABLES_OBJETIVO:
    LIMITES.setdefault(columna, (0, None))
for bacteria in BACTERIAS:
    LIMITES[f"{bacteria}_temperatura_incubacion_c"] = (0, 100)
    LIMITES[f"{bacteria}_proporcion_pct"] = (0, 100)

VALORES_CATEGORICOS = {
    **{f"{b}_aplicada": {"si", "no"} for b in BACTERIAS},
    **{f"{b}_condicion_incubacion": {"aerobia", "anaerobia"} for b in BACTERIAS},
    "aireacion": {"si", "no"},
    "tipo_tratamiento": {"individual", "combinacion", "consorcio", "control"},
    "procedencia_dato": {"medido", "simulado", "predicho"},
}

SALIDAS_NO_NEGATIVAS = [v for v in VARIABLES_OBJETIVO if v != "ph_final"]
MINIMO_GRUPOS_EVALUACION = 5
