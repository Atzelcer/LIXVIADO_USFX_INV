"""Carga, limpieza y preparación reproducible de datos experimentales."""
from __future__ import annotations
from pathlib import Path
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit
from config import (BACTERIAS, PROPORCION_PRUEBA, SEMILLA_ALEATORIA,
                    VARIABLES_CATEGORICAS, VARIABLES_DERIVADAS,
                    VARIABLES_ENTRADA, VARIABLES_NUMERICAS, VARIABLES_OBJETIVO)
from esquema_datos import validar_dataframe

def limpiar_nombre(nombre: object) -> str:
    """Normaliza un encabezado sin alterar los nombres canónicos esperados."""
    return str(nombre).strip().lower().replace(" ", "_").replace("-", "_")

def cargar_datos(ruta: str | Path) -> pd.DataFrame:
    """Carga un CSV o Excel y normaliza sus encabezados."""
    ruta = Path(ruta)
    if ruta.suffix.lower() == ".csv":
        datos = pd.read_csv(ruta)
    elif ruta.suffix.lower() in {".xlsx", ".xls"}:
        datos = pd.read_excel(ruta)
    else:
        raise ValueError("Formato no compatible. Use CSV, XLSX o XLS.")
    datos.columns = [limpiar_nombre(c) for c in datos.columns]
    return datos

def calcular_derivadas(datos: pd.DataFrame) -> pd.DataFrame:
    """Calcula UFC por bacteria y en el reactor a partir de datos medidos."""
    datos = datos.copy()
    for b in BACTERIAS:
        total = datos[f"{b}_concentracion_ufc_ml"] * datos[f"{b}_volumen_cultivo_ml"]
        datos[f"{b}_ufc_totales"] = total
        datos[f"{b}_concentracion_final_reactor_ufc_ml"] = total / datos["volumen_total_reactor_ml"]
    datos["ufc_totales_consorcio"] = datos[[f"{b}_ufc_totales" for b in BACTERIAS]].sum(axis=1)
    datos["concentracion_final_consorcio_ufc_ml"] = datos["ufc_totales_consorcio"] / datos["volumen_total_reactor_ml"]
    datos["suma_proporciones_pct"] = datos[[f"{b}_proporcion_pct" for b in BACTERIAS]].sum(axis=1)
    return datos

def preparar_datos(datos: pd.DataFrame, permitir_simulados: bool = False):
    """Valida datos y devuelve entradas, objetivos y grupos de experimento."""
    datos = datos.copy()
    datos.columns = [limpiar_nombre(c) for c in datos.columns]
    numericas = list(VARIABLES_NUMERICAS) + VARIABLES_OBJETIVO
    for columna in numericas:
        datos[columna] = pd.to_numeric(datos[columna], errors="coerce")
    datos = validar_dataframe(datos)
    procedencias = set(datos["procedencia_dato"])
    permitidas = {"medido", "simulado"} if permitir_simulados else {"medido"}
    if not procedencias <= permitidas or len(procedencias) != 1:
        raise ValueError("No se permite mezclar procedencias. Use solo datos medidos o un lote sintético explícito.")
    datos = calcular_derivadas(datos)
    columnas_x = list(VARIABLES_ENTRADA) + list(VARIABLES_DERIVADAS)
    return datos[columnas_x], datos[VARIABLES_OBJETIVO], datos["id_experimento"].astype(str)

def separar_por_grupos(x, y, grupos):
    """Separa grupos completos para impedir fuga entre entrenamiento y prueba."""
    if grupos.nunique() < 2:
        raise ValueError("Se requieren al menos dos grupos experimento/reactor independientes.")
    divisor = GroupShuffleSplit(n_splits=1, test_size=PROPORCION_PRUEBA, random_state=SEMILLA_ALEATORIA)
    entrenamiento, prueba = next(divisor.split(x, y, grupos))
    return x.iloc[entrenamiento], x.iloc[prueba], y.iloc[entrenamiento], y.iloc[prueba], grupos.iloc[prueba]

def clasificar_columnas_modelo():
    """Devuelve columnas numéricas y categóricas, incluidas las derivadas."""
    return list(VARIABLES_NUMERICAS) + list(VARIABLES_DERIVADAS), list(VARIABLES_CATEGORICAS)
