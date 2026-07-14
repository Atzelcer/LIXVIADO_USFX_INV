"""Genera datos sintéticos coherentes para probar el flujo, no para conclusiones científicas."""
from __future__ import annotations
import argparse
from pathlib import Path
import numpy as np
import pandas as pd
from config import BACTERIAS, COLUMNAS_OBLIGATORIAS, SEMILLA_ALEATORIA

MEDIOS = np.array(["caldo_nutritivo", "lb", "tsb", "medio_minimo"])
CONDICIONES = np.array(["aerobia", "anaerobia"])

def generar_dataset(n: int = 50_000, semilla: int = SEMILLA_ALEATORIA) -> pd.DataFrame:
    """Crea experimentos independientes con relaciones no lineales y ruido controlado."""
    rng = np.random.default_rng(semilla)
    reactor = rng.uniform(1_000, 5_000, n)
    dqo = rng.lognormal(np.log(3_500), 0.55, n).clip(400, 18_000)
    tipo = rng.choice(["individual", "combinacion", "consorcio", "control"], n, p=[.18, .27, .45, .10])
    cantidad_activas = np.select([tipo == "control", tipo == "individual", tipo == "combinacion"], [0, 1, 2], default=4)
    orden = np.argsort(rng.random((n, len(BACTERIAS))), axis=1)
    activas = np.zeros((n, len(BACTERIAS)), dtype=bool)
    for i in range(len(BACTERIAS)):
        activas[np.arange(n), orden[:, i]] = cantidad_activas > i
    pesos = rng.gamma(2.2, 1, (n, len(BACTERIAS))) * activas
    suma = pesos.sum(axis=1, keepdims=True)
    proporciones = np.divide(pesos, suma, out=np.zeros_like(pesos), where=suma > 0) * 100
    volumen_cultivo_total = reactor * rng.uniform(.015, .075, n) * (cantidad_activas > 0)

    datos = pd.DataFrame({
        "id_experimento": [f"EXP-SIM-{i:06d}" for i in range(1, n + 1)],
        "ph_inicial": rng.normal(7.9, 1.35, n).clip(4.5, 11.5),
        "temperatura_inicial": rng.uniform(16, 38, n),
        "dqo_inicial": dqo,
        "dbo5_inicial": dqo * rng.uniform(.22, .62, n),
        "oxigeno_disuelto_inicial": rng.uniform(.1, 7.5, n),
        "amonio_inicial": rng.lognormal(np.log(180), .65, n).clip(10, 1_200),
        "conductividad_inicial": rng.lognormal(np.log(9_000), .5, n).clip(1_000, 35_000),
        "turbidez_inicial": rng.lognormal(np.log(320), .65, n).clip(20, 2_500),
        "indice_toxicidad_inicial": rng.uniform(20, 95, n),
        "volumen_lixiviado_ml": reactor * rng.uniform(.76, .90, n),
    })
    ufc_reactor = np.zeros(n)
    efectos = np.array([1.05, .95, .88, .82])
    efecto_bacteriano = np.zeros(n)
    for j, bacteria in enumerate(BACTERIAS):
        aplicada = activas[:, j]
        concentracion = np.where(aplicada, 10 ** rng.uniform(6, 10, n), 0)
        volumen = volumen_cultivo_total * proporciones[:, j] / 100
        datos[f"{bacteria}_aplicada"] = np.where(aplicada, "si", "no")
        datos[f"{bacteria}_concentracion_ufc_ml"] = concentracion
        datos[f"{bacteria}_volumen_cultivo_ml"] = volumen
        datos[f"{bacteria}_proporcion_pct"] = proporciones[:, j]
        datos[f"{bacteria}_edad_cultivo_h"] = np.where(aplicada, rng.uniform(8, 48, n), 0)
        datos[f"{bacteria}_tiempo_incubacion_h"] = np.where(aplicada, rng.uniform(12, 72, n), 0)
        datos[f"{bacteria}_temperatura_incubacion_c"] = np.where(aplicada, rng.uniform(24, 39, n), 0)
        datos[f"{bacteria}_medio_cultivo"] = np.where(aplicada, rng.choice(MEDIOS, n), "no_aplica")
        condicion = rng.choice(CONDICIONES, n)
        if bacteria == "clostridium":
            condicion = np.where(aplicada, "anaerobia", "aerobia")
        datos[f"{bacteria}_condicion_incubacion"] = np.where(aplicada, condicion, "aerobia")
        ufc_reactor += concentracion * volumen / reactor
        efecto_bacteriano += aplicada * efectos[j] * proporciones[:, j] / 100

    temperatura = rng.uniform(18, 40, n)
    aireacion = rng.choice(["si", "no"], n, p=[.7, .3])
    agitacion = np.where(aireacion == "si", rng.uniform(40, 240, n), rng.uniform(0, 100, n))
    datos["temperatura_tratamiento_c"] = temperatura
    datos["aireacion"] = aireacion
    datos["agitacion_rpm"] = agitacion
    datos["volumen_total_reactor_ml"] = reactor
    datos["tipo_tratamiento"] = tipo

    dosis = np.log10(ufc_reactor + 1)
    factor_temp = np.exp(-((temperatura - 31) / 9) ** 2)
    factor_operacion = .08 * (aireacion == "si") + .06 * np.tanh(agitacion / 130)
    eficacia = np.clip(.04 + .56 / (1 + np.exp(-(dosis - 6.2))) * factor_temp * efecto_bacteriano + factor_operacion, 0, .78)
    eficacia = np.where(tipo == "control", rng.uniform(0, .055, n), eficacia)
    ruido = lambda escala: rng.normal(0, escala, n)
    datos["ph_final"] = np.clip(datos["ph_inicial"] + (7.1 - datos["ph_inicial"]) * eficacia + ruido(.12), 0, 14)
    datos["dqo_final"] = np.clip(dqo * (1 - eficacia) + ruido(90), 0, None)
    dbo_final = datos["dbo5_inicial"] * (1 - eficacia * 1.08) + ruido(45)
    datos["dbo5_final"] = np.minimum(np.clip(dbo_final, 0, None), datos["dqo_final"])
    datos["conductividad_final"] = np.clip(datos["conductividad_inicial"] * (1 - eficacia * .22) + ruido(180), 0, None)
    datos["turbidez_final"] = np.clip(datos["turbidez_inicial"] * (1 - eficacia * .92) + ruido(18), 0, None)
    datos["indice_toxicidad_final"] = np.clip(datos["indice_toxicidad_inicial"] * (1 - eficacia * .86) + ruido(2.3), 0, 100)
    datos["procedencia_dato"] = "simulado"
    return datos[COLUMNAS_OBLIGATORIAS]

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--filas", type=int, default=50_000)
    parser.add_argument("--salida", type=Path, default=Path(__file__).with_name("dataset_sintetico_50000.csv"))
    args = parser.parse_args()
    datos = generar_dataset(args.filas)
    datos.to_csv(args.salida, index=False, float_format="%.8g")
    print(f"Dataset creado: {args.salida} | filas={len(datos)} | columnas={len(datos.columns)}")

if __name__ == "__main__":
    main()
