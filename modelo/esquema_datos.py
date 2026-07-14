"""Validación explícita de registros experimentales."""
from __future__ import annotations
import math
from typing import Any, Iterable
import pandas as pd
from config import (BACTERIAS, COLUMNAS_OBLIGATORIAS, LIMITES, VALORES_CATEGORICOS,
                    VARIABLES_ENTRADA, VARIABLES_NUMERICAS, VARIABLES_OBJETIVO)

class ErrorValidacionDatos(ValueError):
    """Agrupa errores comprensibles de validación."""

def _vacio(valor: Any) -> bool:
    return valor is None or (isinstance(valor, str) and not valor.strip()) or (not isinstance(valor, str) and pd.isna(valor))

def _numero(valor: Any, columna: str, errores: list[str]) -> float | None:
    try:
        numero = float(valor)
        if not math.isfinite(numero):
            raise ValueError
        return numero
    except (TypeError, ValueError):
        errores.append(f"'{columna}' debe ser un número finito; se recibió {valor!r}.")
        return None

def validar_registro(registro: dict[str, Any], incluir_objetivos: bool = True) -> dict[str, Any]:
    """Valida un experimento y devuelve una copia normalizada."""
    requeridas = list(VARIABLES_ENTRADA) + (["id_experimento", "procedencia_dato"] + VARIABLES_OBJETIVO if incluir_objetivos else [])
    errores: list[str] = []
    datos = {str(k).strip().lower(): v for k, v in registro.items()}
    faltantes = [c for c in requeridas if c not in datos or _vacio(datos[c])]
    if faltantes:
        errores.append("Faltan valores obligatorios: " + ", ".join(faltantes) + ".")

    numericas = set(VARIABLES_NUMERICAS) | set(VARIABLES_OBJETIVO)
    for columna in numericas.intersection(datos):
        if _vacio(datos[columna]):
            continue
        numero = _numero(datos[columna], columna, errores)
        if numero is None:
            continue
        datos[columna] = numero
        minimo, maximo = LIMITES.get(columna, (None, None))
        if minimo is not None and numero < minimo:
            errores.append(f"'{columna}' debe ser ≥ {minimo}.")
        if maximo is not None and numero > maximo:
            errores.append(f"'{columna}' debe ser ≤ {maximo}.")

    for columna, permitidos in VALORES_CATEGORICOS.items():
        if columna in datos and not _vacio(datos[columna]):
            datos[columna] = str(datos[columna]).strip().lower()
            if datos[columna] not in permitidos:
                errores.append(f"'{columna}' debe ser uno de: {', '.join(sorted(permitidos))}.")

    volumen_reactor = datos.get("volumen_total_reactor_ml")
    volumen_lixiviado = datos.get("volumen_lixiviado_ml")
    if isinstance(volumen_reactor, float) and isinstance(volumen_lixiviado, float) and volumen_lixiviado > volumen_reactor:
        errores.append("El volumen de lixiviado no puede superar el volumen total del reactor.")
    volumen_cultivos = sum(float(datos.get(f"{b}_volumen_cultivo_ml", 0) or 0) for b in BACTERIAS if isinstance(datos.get(f"{b}_volumen_cultivo_ml", 0), (int, float)))
    if isinstance(volumen_reactor, float) and isinstance(volumen_lixiviado, float) and volumen_lixiviado + volumen_cultivos > volumen_reactor:
        errores.append("Lixiviado + cultivos supera el volumen total del reactor.")

    activas = []
    for b in BACTERIAS:
        aplicada = datos.get(f"{b}_aplicada") == "si"
        if aplicada:
            activas.append(b)
            if datos.get(f"{b}_concentracion_ufc_ml", 0) <= 0 or datos.get(f"{b}_volumen_cultivo_ml", 0) <= 0:
                errores.append(f"{b}: una bacteria aplicada requiere concentración y volumen mayores que cero.")
        elif any(float(datos.get(f"{b}_{s}", 0) or 0) > 0 for s in ("concentracion_ufc_ml", "volumen_cultivo_ml", "proporcion_pct") if isinstance(datos.get(f"{b}_{s}", 0), (int, float))):
            errores.append(f"{b}: está desactivada, pero posee concentración, volumen o proporción positiva.")
    if activas:
        suma = sum(float(datos.get(f"{b}_proporcion_pct", 0) or 0) for b in activas)
        if abs(suma - 100) > 0.01:
            errores.append(f"Las proporciones de bacterias activas deben sumar 100 %; suman {suma:g} %.")
    if errores:
        raise ErrorValidacionDatos("Datos experimentales inválidos:\n- " + "\n- ".join(errores))
    return datos

def validar_dataframe(datos: pd.DataFrame, incluir_objetivos: bool = True) -> pd.DataFrame:
    """Valida todas las filas y conserva el número de fila en los errores."""
    requeridas = COLUMNAS_OBLIGATORIAS if incluir_objetivos else VARIABLES_ENTRADA
    faltantes = [c for c in requeridas if c not in datos.columns]
    if faltantes:
        raise ErrorValidacionDatos("Columnas obligatorias ausentes: " + ", ".join(faltantes))
    validados, errores = [], []
    for indice, fila in datos.iterrows():
        try:
            validados.append(validar_registro(fila.to_dict(), incluir_objetivos))
        except ErrorValidacionDatos as exc:
            errores.append(f"Fila {indice + 2}: {exc}")
    if errores:
        raise ErrorValidacionDatos("\n".join(errores))
    return pd.DataFrame(validados, index=datos.index)
