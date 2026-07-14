"use strict";

const API = location.protocol === "file:" ? "http://127.0.0.1:8000" : location.origin;
const lixiviado = [
  ["ph_inicial", "pH", "adimensional", 4.5, 11.5], ["temperatura_inicial", "Temperatura", "°C", 16, 38],
  ["dqo_inicial", "DQO", "mg/L", 400, 18000], ["dbo5_inicial", "DBO₅", "mg/L", 0, 11000],
  ["oxigeno_disuelto_inicial", "Oxígeno disuelto", "mg/L", 0.1, 7.5], ["amonio_inicial", "Amoniaco / amonio", "mg/L", 10, 1200],
  ["conductividad_inicial", "Conductividad", "µS/cm", 1000, 35000], ["turbidez_inicial", "Turbidez", "NTU", 20, 2500],
  ["indice_toxicidad_inicial", "Índice de toxicidad", "%", 20, 95], ["volumen_lixiviado_ml", "Volumen de lixiviado", "mL", 1, 5000]
];
const bacterias = ["pseudomonas", "bacillus_cereus", "klebsiella", "clostridium"];
const nombres = {pseudomonas: "Pseudomonas", bacillus_cereus: "Bacillus cereus", klebsiella: "Klebsiella", clostridium: "Clostridium"};
const objetivos = [
  ["ph_final", "pH final", "ph_inicial", ""], ["dqo_final", "DQO final", "dqo_inicial", "mg/L"],
  ["dbo5_final", "DBO₅ final", "dbo5_inicial", "mg/L"], ["conductividad_final", "Conductividad final", "conductividad_inicial", "µS/cm"],
  ["turbidez_final", "Turbidez final", "turbidez_inicial", "NTU"], ["indice_toxicidad_final", "Toxicidad final", "indice_toxicidad_inicial", "%"]
];
const formulario = document.querySelector("#formulario");
let pasoActual = 0;
let pasoMaximo = 0;
let ultimoExperimento = null;
let ultimoResultado = null;
let modeloActivo = "gradient boosting";
let bacteriasConfiguradas = new Set();
let bacteriaModalActual = null;
const perfiles = {
  medio: {ph_inicial: 7.8, temperatura_inicial: 25, dqo_inicial: 3500, dbo5_inicial: 1400, oxigeno_disuelto_inicial: 2.5, amonio_inicial: 180, conductividad_inicial: 9000, turbidez_inicial: 320, indice_toxicidad_inicial: 55, volumen_lixiviado_ml: 850},
  alta: {ph_inicial: 8.5, temperatura_inicial: 28, dqo_inicial: 9000, dbo5_inicial: 4000, oxigeno_disuelto_inicial: 1, amonio_inicial: 600, conductividad_inicial: 20000, turbidez_inicial: 900, indice_toxicidad_inicial: 80, volumen_lixiviado_ml: 850},
  baja: {ph_inicial: 7.2, temperatura_inicial: 23, dqo_inicial: 1200, dbo5_inicial: 400, oxigeno_disuelto_inicial: 5, amonio_inicial: 60, conductividad_inicial: 3500, turbidez_inicial: 100, indice_toxicidad_inicial: 30, volumen_lixiviado_ml: 850}
};
const AYUDA_PASOS = [
  {titulo:"Caracterización del lixiviado", intro:"Ingrese los valores medidos antes de aplicar el tratamiento. Puede usar un perfil rápido como punto de partida y luego reemplazarlo con datos de laboratorio.", tip:"DBO₅ debe ser menor o igual que DQO. Utilice siempre las unidades indicadas.", items:[
    ["pH","Acidez o alcalinidad inicial, entre 4,5 y 11,5 dentro del dominio actual."],["Temperatura","Temperatura inicial de la muestra en °C."],["DQO","Demanda química de oxígeno en mg/L; representa la carga total oxidable."],["DBO₅","Demanda bioquímica de oxígeno a cinco días en mg/L."],["Oxígeno disuelto","Oxígeno disponible en la muestra, expresado en mg/L."],["Amoniaco / amonio","Concentración inicial de nitrógeno amoniacal en mg/L."],["Conductividad","Contenido iónico aproximado de la muestra en µS/cm."],["Turbidez","Cantidad de material suspendido, expresada en NTU."],["Índice de toxicidad","Nivel inicial de toxicidad en porcentaje."],["Volumen","Cantidad de lixiviado introducida al reactor, en mL."]]},
  {titulo:"Selección de bacterias", intro:"Seleccione una o varias cepas haciendo clic en sus tarjetas. Una segunda pulsación retira la selección.", tip:"El sistema define automáticamente el tipo: individual, combinación, consorcio o control.", items:[
    ["Pseudomonas","Actívela si formará parte del tratamiento bacteriano."],["Bacillus cereus","Puede utilizarse sola o junto con otras cepas."],["Klebsiella","Seleccione únicamente cuando realmente se aplicará al reactor."],["Clostridium","Su configuración predeterminada utiliza incubación anaerobia."],["Seleccionar todas","Activa las cuatro bacterias para formar un consorcio completo."],["Limpiar selección","Crea una condición de control sin aplicación bacteriana."]]},
  {titulo:"Configuración bacteriana", intro:"Cada bacteria seleccionada debe configurarse y guardarse. Las tarjetas verdes ya están listas; las amarillas permanecen pendientes.", tip:"No podrá avanzar mientras exista una bacteria seleccionada sin guardar.", items:[
    ["Concentración","Densidad del cultivo en UFC/mL."],["Volumen aplicado","Cantidad de cultivo añadida al reactor, en mL."],["Proporción","Participación de la bacteria en el consorcio. Todas deben sumar 100 %."],["Edad del cultivo","Tiempo transcurrido desde la preparación del cultivo, en horas."],["Incubación","Duración de incubación del cultivo en horas."],["Temperatura","Temperatura de incubación en °C."],["Medio de cultivo","Nombre del medio utilizado para desarrollar la bacteria."],["Condición","Indique si la incubación fue aerobia o anaerobia."],["Guardar","Conserva los valores y cambia la tarjeta a CONFIGURADA."]]},
  {titulo:"Condiciones del reactor", intro:"Defina el entorno operativo en el que se realizará el tratamiento completo.", tip:"El volumen de lixiviado más los cultivos no puede superar el volumen total del reactor.", items:[
    ["Temperatura","Temperatura de operación del tratamiento en °C."],["Agitación","Velocidad de mezcla del reactor en revoluciones por minuto."],["Volumen total","Capacidad total utilizada en el reactor, en mL."],["Aireación","Indique si existe suministro activo de aire."],["Tipo de tratamiento","Se completa automáticamente según la cantidad de bacterias elegidas."],["Procesar","Valida los datos y solicita simultáneamente las seis predicciones al modelo."]]},
  {titulo:"Resultados y reporte", intro:"Revise la comparación entre el valor inicial y la estimación final obtenida por el modelo.", tip:"Use “Descargar reporte” para guardar directamente el documento en formato PDF.", items:[
    ["Valor final","Estimación producida para cada variable objetivo."],["Inicial","Valor registrado en el primer paso."],["Δ cambio","Diferencia absoluta entre el valor final y el inicial."],["Porcentaje","Variación relativa respecto al valor inicial."],["Editar","Regresa al reactor conservando todos los datos."],["Reporte","Incluye logos, entradas, bacterias, reactor, resultados y espacios de firma."],["Nueva simulación","Limpia el resultado y comienza un experimento nuevo."]]} 
];

const campo = ([id, nombre, unidad, min, max]) => `<label>${nombre}<small>${unidad}</small><input required type="number" step="any" value="0" id="${id}" name="${id}" min="${min}" ${max !== undefined ? `max="${max}"` : ""}></label>`;
document.querySelector("#lixiviado").innerHTML = lixiviado.map(campo).join("");

function tarjetaBacteria(bacteria) {
  return `<article class="bacteria off" data-bacteria="${bacteria}">
    <div class="bacteria-head"><h3>${nombres[bacteria]}</h3><label class="toggle-label">Aplicar <input class="switch" type="checkbox" name="${bacteria}_aplicada"></label></div>
    <div class="grid fields">
      ${campo([`${bacteria}_concentracion_ufc_ml`, "Concentración", "UFC/mL", 0])}
      ${campo([`${bacteria}_volumen_cultivo_ml`, "Volumen del cultivo", "mL", 0])}
      ${campo([`${bacteria}_proporcion_pct`, "Proporción", "%", 0, 100])}
      ${campo([`${bacteria}_edad_cultivo_h`, "Edad del cultivo", "h", 0])}
      ${campo([`${bacteria}_tiempo_incubacion_h`, "Tiempo de incubación", "h", 0])}
      ${campo([`${bacteria}_temperatura_incubacion_c`, "Temperatura", "°C", 0, 100])}
      <label>Medio de cultivo<small>nombre</small><input required name="${bacteria}_medio_cultivo" value="no_aplica"></label>
      <label>Condición<small>incubación</small><select name="${bacteria}_condicion_incubacion"><option>aerobia</option><option>anaerobia</option></select></label>
    </div><div class="derived">UFC totales · <b data-ufc>0</b></div>
  </article>`;
}
document.querySelector("#bacterias").innerHTML = bacterias.map(tarjetaBacteria).join("");
document.querySelector("#experimento").innerHTML = [
  campo(["temperatura_tratamiento_c", "Temperatura del tratamiento", "°C", 0, 100]),
  campo(["agitacion_rpm", "Agitación", "rpm", 0]),
  campo(["volumen_total_reactor_ml", "Volumen total del reactor", "mL", 0.000001]),
  `<label>Aireación<small>estado</small><select name="aireacion"><option value="si">Sí</option><option value="no">No</option></select></label>`,
  `<label>Tipo de tratamiento<small>protocolo</small><select name="tipo_tratamiento"><option>individual</option><option>combinacion</option><option>consorcio</option><option>control</option></select></label>`
].join("");

function asignar(nombre, valor) {
  const elemento = document.querySelector(`[name="${nombre}"]`);
  if (elemento) elemento.value = valor;
}
function aplicarPerfil(nombre) {
  Object.entries(perfiles[nombre]).forEach(([campo, valor]) => asignar(campo, valor));
  document.querySelectorAll("[data-preset]").forEach(b => b.classList.toggle("active", b.dataset.preset === nombre));
  actualizarCalculos();
}
document.querySelectorAll("[data-preset]").forEach(b => b.addEventListener("click", () => aplicarPerfil(b.dataset.preset)));

function configurarBacteria(b, activa) {
  document.querySelector(`[name="${b}_aplicada"]`).checked = activa;
  if (activa) {
    if (numero(`${b}_concentracion_ufc_ml`) <= 0) asignar(`${b}_concentracion_ufc_ml`, 100000000);
    if (numero(`${b}_volumen_cultivo_ml`) <= 0) asignar(`${b}_volumen_cultivo_ml`, 25);
    if (numero(`${b}_edad_cultivo_h`) <= 0) asignar(`${b}_edad_cultivo_h`, 24);
    if (numero(`${b}_tiempo_incubacion_h`) <= 0) asignar(`${b}_tiempo_incubacion_h`, 24);
    if (numero(`${b}_temperatura_incubacion_c`) <= 0) asignar(`${b}_temperatura_incubacion_c`, 30);
    asignar(`${b}_medio_cultivo`, "caldo_nutritivo");
    asignar(`${b}_condicion_incubacion`, b === "clostridium" ? "anaerobia" : "aerobia");
  } else {
    bacteriasConfiguradas.delete(b);
    ["concentracion_ufc_ml", "volumen_cultivo_ml", "proporcion_pct", "edad_cultivo_h", "tiempo_incubacion_h", "temperatura_incubacion_c"].forEach(s => asignar(`${b}_${s}`, 0));
    asignar(`${b}_medio_cultivo`, "no_aplica");
    asignar(`${b}_condicion_incubacion`, "aerobia");
  }
}
function repartirProporciones() {
  const activas = bacterias.filter(b => document.querySelector(`[name="${b}_aplicada"]`).checked);
  bacterias.forEach(b => asignar(`${b}_proporcion_pct`, activas.includes(b) ? 100 / activas.length : 0));
  const tipo = activas.length === 0 ? "control" : activas.length === 1 ? "individual" : activas.length === 4 ? "consorcio" : "combinacion";
  asignar("tipo_tratamiento", tipo);
}
function alternarBacteria(b) {
  const activa = !document.querySelector(`[name="${b}_aplicada"]`).checked;
  configurarBacteria(b, activa);
  repartirProporciones();
  renderizarConfiguracionBacterias();
  actualizarCalculos();
}
document.querySelectorAll("[data-select-bacteria]").forEach(boton => boton.addEventListener("click", () => alternarBacteria(boton.dataset.selectBacteria)));
document.querySelectorAll(".switch").forEach(control => control.addEventListener("change", evento => {
  const b = evento.target.name.replace("_aplicada", "");
  configurarBacteria(b, evento.target.checked); repartirProporciones(); renderizarConfiguracionBacterias(); actualizarCalculos();
}));
document.querySelector("#consorcio-completo").addEventListener("click", () => {
  bacterias.forEach(b => configurarBacteria(b, true)); repartirProporciones(); renderizarConfiguracionBacterias(); actualizarCalculos();
});
document.querySelector("#tratamiento-control").addEventListener("click", () => {
  bacterias.forEach(b => configurarBacteria(b, false)); repartirProporciones(); renderizarConfiguracionBacterias(); actualizarCalculos();
});
document.querySelector("#reactor-recomendado").addEventListener("click", () => {
  asignar("temperatura_tratamiento_c", 30);
  asignar("agitacion_rpm", 120);
  asignar("volumen_total_reactor_ml", 1000);
  asignar("aireacion", "si");
  actualizarCalculos();
});

function mostrarPaso(indice, forzar = false) {
  if (!forzar && indice > pasoMaximo) return;
  pasoActual = Math.max(0, Math.min(4, indice));
  document.querySelectorAll(".wizard-panel").forEach((panel, i) => panel.classList.toggle("active", i === pasoActual));
  document.querySelectorAll(".step").forEach((step, i) => {
    step.classList.toggle("active", i === pasoActual);
    step.classList.toggle("done", i < pasoActual);
  });
  const scrollInterno = document.querySelector(`[data-step="${pasoActual}"] .panel-scroll`);
  if (scrollInterno) scrollInterno.scrollTop = 0;
  actualizarAyuda();
  document.querySelector(".stepper").scrollIntoView({behavior: "smooth", block: "start"});
}

function actualizarAyuda() {
  const ayuda = AYUDA_PASOS[pasoActual];
  document.querySelector("#ayuda-paso-indicador").textContent = pasoActual + 1;
  document.querySelector("#ayuda-etiqueta").textContent = `GUÍA DEL PASO ${String(pasoActual + 1).padStart(2,"0")}`;
  document.querySelector("#ayuda-titulo").textContent = ayuda.titulo;
  document.querySelector("#ayuda-contenido").innerHTML = `<p class="help-intro">${ayuda.intro}</p><div class="help-list">${ayuda.items.map(([titulo, texto], i) => `<article class="help-item"><span>${i + 1}</span><div><h3>${titulo}</h3><p>${texto}</p></div></article>`).join("")}</div><div class="help-tip"><b>Importante:</b> ${ayuda.tip}</div>`;
}
function abrirAyuda() {
  actualizarAyuda(); document.querySelector("#panel-ayuda").hidden = false;
  document.querySelector("#ayuda-flotante").setAttribute("aria-expanded","true"); document.body.classList.add("modal-open");
}
function cerrarAyuda() {
  document.querySelector("#panel-ayuda").hidden = true;
  document.querySelector("#ayuda-flotante").setAttribute("aria-expanded","false"); document.body.classList.remove("modal-open");
}
document.querySelector("#ayuda-flotante").addEventListener("click", abrirAyuda);
document.querySelectorAll("[data-close-help]").forEach(boton => boton.addEventListener("click", cerrarAyuda));
document.addEventListener("keydown", evento => {
  if (evento.key !== "Escape") return;
  if (!document.querySelector("#panel-ayuda").hidden) cerrarAyuda();
  else if (!document.querySelector("#modal-bacteria").hidden) cerrarModalBacteria();
});

function validarPaso(indice) {
  const panel = document.querySelector(`[data-step="${indice}"]`);
  const campos = [...panel.querySelectorAll("input[required],select[required]")];
  campos.forEach(c => c.classList.add("touched"));
  const invalido = campos.find(c => !c.checkValidity());
  if (invalido) { invalido.reportValidity(); invalido.focus(); return false; }
  if (indice === 0 && numero("dbo5_inicial") > numero("dqo_inicial")) {
    alert("La DBO₅ inicial no puede superar la DQO inicial."); return false;
  }
  if (indice === 1) {
    renderizarConfiguracionBacterias();
  }
  if (indice === 2) {
    const activas = bacterias.filter(b => document.querySelector(`[name="${b}_aplicada"]`).checked);
    const pendientes = activas.filter(b => !bacteriasConfiguradas.has(b));
    if (pendientes.length) { alert(`Debe guardar la configuración de: ${pendientes.map(b => nombres[b]).join(", ")}.`); return false; }
    const suma = activas.reduce((total, b) => total + numero(`${b}_proporcion_pct`), 0);
    const incompleta = activas.find(b => numero(`${b}_concentracion_ufc_ml`) <= 0 || numero(`${b}_volumen_cultivo_ml`) <= 0);
    if (incompleta) { alert(`${nombres[incompleta]} requiere concentración y volumen mayores que cero.`); return false; }
    if (activas.length && Math.abs(suma - 100) > 0.01) { alert(`Las proporciones activas deben sumar 100 %. Actualmente suman ${suma.toFixed(2)} %.`); return false; }
  }
  if (indice === 3) {
    const volumenCultivos = bacterias.reduce((total, b) => total + (document.querySelector(`[name="${b}_aplicada"]`).checked ? numero(`${b}_volumen_cultivo_ml`) : 0), 0);
    if (numero("volumen_lixiviado_ml") + volumenCultivos > numero("volumen_total_reactor_ml")) {
      alert("El volumen de lixiviado más los cultivos supera el volumen total del reactor."); return false;
    }
  }
  return true;
}

function renderizarConfiguracionBacterias() {
  const activas = bacterias.filter(b => document.querySelector(`[name="${b}_aplicada"]`)?.checked);
  const contenedor = document.querySelector("#configuracion-bacterias");
  document.querySelector("#sin-bacterias").hidden = activas.length !== 0;
  contenedor.innerHTML = activas.map(b => {
    const configurada = bacteriasConfiguradas.has(b);
    return `<article class="configuration-card ${configurada ? "configured" : "pending"}"><div class="configuration-symbol">${b === "bacillus_cereus" ? "BC" : b.slice(0,2).toUpperCase()}</div><div class="configuration-copy"><small>CEPA SELECCIONADA</small><h3>${nombres[b]}</h3><p>${configurada ? `Concentración ${numero(`${b}_concentracion_ufc_ml`).toExponential(2)} UFC/mL · ${numero(`${b}_proporcion_pct`).toFixed(1)} %` : "Complete los parámetros del cultivo"}</p></div><span class="configuration-status">${configurada ? "✓ CONFIGURADA" : "PENDIENTE"}</span><button type="button" data-configurar-bacteria="${b}">${configurada ? "Editar" : "Configurar"} →</button></article>`;
  }).join("");
  contenedor.querySelectorAll("[data-configurar-bacteria]").forEach(boton => boton.addEventListener("click", () => abrirModalBacteria(boton.dataset.configurarBacteria)));
}
function abrirModalBacteria(b) {
  bacteriaModalActual = b;
  const modal = document.querySelector("#modal-bacteria"), contenido = document.querySelector("#modal-bacteria-contenido");
  const tarjeta = document.querySelector(`[data-bacteria="${b}"]`);
  document.querySelector("#modal-bacteria-titulo").textContent = nombres[b];
  contenido.appendChild(tarjeta); tarjeta.classList.remove("off"); modal.hidden = false;
  document.body.classList.add("modal-open");
}
function cerrarModalBacteria() {
  if (bacteriaModalActual) {
    const tarjeta = document.querySelector(`[data-bacteria="${bacteriaModalActual}"]`);
    document.querySelector("#bacterias").appendChild(tarjeta);
  }
  document.querySelector("#modal-bacteria").hidden = true; document.body.classList.remove("modal-open");
  bacteriaModalActual = null; renderizarConfiguracionBacterias(); actualizarCalculos();
}
document.querySelectorAll("[data-close-modal]").forEach(boton => boton.addEventListener("click", cerrarModalBacteria));
document.querySelector("#guardar-bacteria").addEventListener("click", () => {
  const b = bacteriaModalActual;
  if (!b) return;
  if (numero(`${b}_concentracion_ufc_ml`) <= 0 || numero(`${b}_volumen_cultivo_ml`) <= 0 || numero(`${b}_proporcion_pct`) <= 0) {
    alert("Concentración, volumen y proporción deben ser mayores que cero."); return;
  }
  bacteriasConfiguradas.add(b); cerrarModalBacteria();
});
document.querySelector("#modal-bacteria-contenido").addEventListener("input", actualizarCalculos);

document.querySelectorAll(".next").forEach(boton => boton.addEventListener("click", () => {
  if (!validarPaso(pasoActual)) return;
  pasoMaximo = Math.max(pasoMaximo, pasoActual + 1);
  mostrarPaso(pasoActual + 1, true);
}));
document.querySelectorAll(".prev").forEach(boton => boton.addEventListener("click", () => mostrarPaso(pasoActual - 1, true)));
document.querySelectorAll(".step").forEach(boton => boton.addEventListener("click", () => mostrarPaso(Number(boton.dataset.go))));

function numero(nombre) { return Number(document.querySelector(`[name="${nombre}"]`)?.value || 0); }
function actualizarCalculos() {
  let total = 0, proporcion = 0, activas = 0;
  bacterias.forEach(b => {
    const tarjeta = document.querySelector(`[data-bacteria="${b}"]`);
    const activa = tarjeta.querySelector(".switch").checked;
    tarjeta.classList.toggle("off", !activa);
    const selector = document.querySelector(`[data-select-bacteria="${b}"]`);
    selector.classList.toggle("selected", activa);
    selector.setAttribute("aria-pressed", String(activa));
    const ufc = activa ? numero(`${b}_concentracion_ufc_ml`) * numero(`${b}_volumen_cultivo_ml`) : 0;
    if (activa) activas++;
    total += ufc;
    proporcion += activa ? numero(`${b}_proporcion_pct`) : 0;
    tarjeta.querySelector("[data-ufc]").textContent = ufc.toExponential(3);
  });
  const reactor = numero("volumen_total_reactor_ml");
  document.querySelector("#ufc-total").textContent = total.toExponential(3);
  document.querySelector("#concentracion-final").textContent = `${reactor ? (total / reactor).toExponential(3) : 0} UFC/mL`;
  const proporcionEl = document.querySelector("#proporcion-total");
  proporcionEl.textContent = `${proporcion.toFixed(2)} %`;
  proporcionEl.classList.toggle("warning", Math.abs(proporcion - 100) > 0.01 && proporcion > 0);
  document.querySelector("#resumen-bacterias").textContent = activas;
  document.querySelector("#resumen-ufc").textContent = total.toExponential(2);
  document.querySelector("#resumen-proporcion").textContent = `${proporcion.toFixed(1)} %`;
  document.querySelector("#seleccionadas-count").textContent = activas;
  document.querySelector("#modo-tratamiento").textContent = activas === 0 ? "Control" : activas === 1 ? "Individual" : activas === 4 ? "Consorcio" : "Combinación";
}
formulario.addEventListener("input", actualizarCalculos);

async function estadoModelo() {
  const estado = document.querySelector("#estado");
  try {
    const respuesta = await fetch(`${API}/model-info`), datos = await respuesta.json();
    if (datos.modelo) modeloActivo = datos.modelo.replaceAll("_", " ");
    estado.innerHTML = `<span class="status-dot"></span><b>${datos.disponible ? "CONECTADO" : "NO CONECTADO"}</b>`;
    estado.className = `status main-status ${datos.disponible ? "ready" : "error"}`;
  } catch {
    estado.innerHTML = '<span class="status-dot"></span><b>NO CONECTADO</b>';
    estado.className = "status main-status error";
  }
}

function construirRegistro() {
  const fd = new FormData(formulario), datos = {};
  for (const [clave, valor] of fd) datos[clave] = valor;
  [...lixiviado.map(x => x[0]), "temperatura_tratamiento_c", "agitacion_rpm", "volumen_total_reactor_ml"].forEach(k => datos[k] = Number(datos[k]));
  bacterias.forEach(b => {
    datos[`${b}_aplicada`] = document.querySelector(`[name="${b}_aplicada"]`).checked ? "si" : "no";
    ["concentracion_ufc_ml", "volumen_cultivo_ml", "proporcion_pct", "edad_cultivo_h", "tiempo_incubacion_h", "temperatura_incubacion_c"].forEach(s => datos[`${b}_${s}`] = Number(datos[`${b}_${s}`] || 0));
  });
  return datos;
}

function mostrarResultados(datos, entrada) {
  document.querySelector("#result-grid").innerHTML = objetivos.map(([id, nombre, inicial, unidad]) => {
    const antes = Number(entrada[inicial]), despues = Number(datos[id]), cambio = despues - antes, porcentaje = antes ? cambio / antes * 100 : null;
    return `<article class="result"><small>${nombre}</small><strong>${despues.toLocaleString("es-BO", {maximumFractionDigits: 3})} ${unidad}</strong><span>Inicial: ${antes.toLocaleString("es-BO", {maximumFractionDigits: 2})} · Δ ${cambio.toFixed(2)} ${porcentaje === null ? "" : `· ${porcentaje.toFixed(1)} %`}</span></article>`;
  }).join("");
}

function escapar(valor) {
  return String(valor ?? "—").replace(/[&<>'"]/g, caracter => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[caracter]));
}
function formatoReporte(valor, maximo = 3) {
  const numeroValor = Number(valor);
  return Number.isFinite(numeroValor) ? numeroValor.toLocaleString("es-BO", {maximumFractionDigits: maximo}) : escapar(valor);
}
async function generarReporte() {
  if (!ultimoExperimento || !ultimoResultado) return;
  const e = ultimoExperimento, r = ultimoResultado;
  const logoFcyt = new URL("logo_fcyt.png", location.href).href;
  const logoAmbiental = new URL("logo_ambiental.png", location.href).href;
  const logoCico = new URL("logo_cico.png", location.href).href;
  const fecha = new Date().toLocaleString("es-BO", {dateStyle:"long", timeStyle:"short"});
  const filasLixiviado = lixiviado.map(([id, nombre, unidad]) => `<tr><th>${nombre}</th><td>${formatoReporte(e[id])}</td><td>${unidad}</td></tr>`).join("");
  const camposBacteria = [
    ["concentracion_ufc_ml","Concentración","UFC/mL"],["volumen_cultivo_ml","Volumen aplicado","mL"],
    ["proporcion_pct","Proporción","%"],["edad_cultivo_h","Edad del cultivo","h"],
    ["tiempo_incubacion_h","Tiempo de incubación","h"],["temperatura_incubacion_c","Temperatura de incubación","°C"],
    ["medio_cultivo","Medio de cultivo",""],["condicion_incubacion","Condición de incubación",""]
  ];
  const bacteriasReporte = bacterias.map(b => {
    const activa = e[`${b}_aplicada`] === "si";
    const detalle = activa ? `<table><tbody>${camposBacteria.map(([s, etiqueta, unidad]) => `<tr><th>${etiqueta}</th><td>${formatoReporte(e[`${b}_${s}`])}</td><td>${unidad}</td></tr>`).join("")}</tbody></table>` : '<p class="not-applied">No aplicada en este tratamiento.</p>';
    return `<article class="bacteria-report ${activa ? "active" : "inactive"}"><header><h3>${nombres[b]}</h3><span>${activa ? "APLICADA" : "NO APLICADA"}</span></header>${detalle}</article>`;
  }).join("");
  const condiciones = [
    ["Temperatura del tratamiento",e.temperatura_tratamiento_c,"°C"],["Aireación",e.aireacion,""],
    ["Agitación",e.agitacion_rpm,"rpm"],["Volumen total del reactor",e.volumen_total_reactor_ml,"mL"],
    ["Tipo de tratamiento",e.tipo_tratamiento,""]
  ].map(([nombre, valor, unidad]) => `<tr><th>${nombre}</th><td>${formatoReporte(valor)}</td><td>${unidad}</td></tr>`).join("");
  const resultados = objetivos.map(([id, nombre, inicial, unidad]) => {
    const antes = Number(e[inicial]), despues = Number(r[id]), cambio = despues - antes, porcentaje = antes ? cambio / antes * 100 : null;
    return `<tr><th>${nombre}</th><td>${formatoReporte(antes)}</td><td>${formatoReporte(despues)}</td><td class="${cambio <= 0 ? "good" : "attention"}">${cambio >= 0 ? "+" : ""}${formatoReporte(cambio)}${porcentaje === null ? "" : ` (${porcentaje.toFixed(1)} %)`}</td><td>${unidad}</td></tr>`;
  }).join("");
  const reporte = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Reporte Biolix</title><style>
  @page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;background:#eef4f7;color:#183b51;font:12px Arial,sans-serif}.toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:center;gap:10px;padding:10px;background:#052f58}.toolbar button{padding:9px 16px;border:0;border-radius:7px;background:#fff;color:#073858;font-weight:700;cursor:pointer}.report{width:min(210mm,100%);margin:18px auto;background:#fff;box-shadow:0 15px 45px #17394d25}.cover{position:relative;display:grid;grid-template-columns:1fr auto;gap:22px;padding:25px 28px;border-top:7px solid #f20d2f;border-bottom:4px solid #78d9eb;background:#052f58;color:#fff}.cover:after{content:"";position:absolute;left:0;right:0;bottom:-9px;height:3px;background:#f20d2f}.cover h1{margin:8px 0 5px;font-size:29px}.cover p{margin:0;color:#dbeaf3}.cover small{letter-spacing:.13em;color:#bcd6e5}.logos{display:flex;align-items:center;gap:7px}.logos img{width:62px;height:62px;object-fit:contain;padding:4px;border-radius:9px;background:#fff}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:22px 28px 8px}.meta div{padding:11px;border:1px solid #d6e4eb;border-radius:8px;background:#f7fafc}.meta small{display:block;color:#78909e;font-size:9px}.meta b{text-transform:capitalize}.content{padding:10px 28px 28px}.section{margin-top:18px;break-inside:avoid}.section-title{display:flex;align-items:center;gap:9px;margin-bottom:9px;padding-bottom:7px;border-bottom:2px solid #d8e8ef}.section-title b{display:grid;place-items:center;width:25px;height:25px;border-radius:7px;background:#0b6c9e;color:#fff}.section-title h2{margin:0;font-size:16px}table{width:100%;border-collapse:collapse}th,td{padding:7px 8px;border-bottom:1px solid #e1ebf0;text-align:left}th{width:48%;color:#355970;font-weight:600}td:last-child{color:#718996;font-size:10px}.bacteria-layout{display:grid;grid-template-columns:1fr 1fr;gap:10px}.bacteria-report{border:1px solid #d3e2e9;border-radius:9px;overflow:hidden;break-inside:avoid}.bacteria-report header{display:flex;justify-content:space-between;align-items:center;padding:9px 11px;background:#f3f8fa}.bacteria-report.active{border-left:4px solid #43b95f}.bacteria-report.inactive{opacity:.65}.bacteria-report h3{margin:0;font-size:13px}.bacteria-report header span{padding:3px 6px;border-radius:5px;background:#e5f4e9;color:#25813c;font-size:8px;font-weight:700}.bacteria-report.inactive header span{background:#edf1f3;color:#70838d}.not-applied{padding:8px 11px;margin:0;color:#718996}.results th{width:auto}.results thead th{background:#edf6fa;color:#244e66}.results .good{color:#24843d;font-weight:700}.results .attention{color:#b34a3d;font-weight:700}.disclaimer{margin-top:18px;padding:11px;border-left:4px solid #f0c44c;background:#fff9e6;color:#66551d}.signature{display:grid;grid-template-columns:1fr 1fr;gap:70px;margin-top:45px;text-align:center}.signature div{padding-top:7px;border-top:1px solid #78909e}@media(max-width:700px){.cover{grid-template-columns:1fr}.meta,.bacteria-layout{grid-template-columns:1fr}.report{margin:0}.content,.cover,.meta{padding-inline:16px}}@media print{body{background:#fff}.toolbar{display:none}.report{width:100%;margin:0;box-shadow:none}.section{break-inside:avoid}.bacteria-report{break-inside:avoid}}
  </style></head><body><div class="toolbar"><button onclick="window.print()">Imprimir / Guardar como PDF</button><button onclick="window.close()">Cerrar vista</button></div><main class="report"><header class="cover"><div><small>REPORTE TÉCNICO DE PREDICCIÓN</small><h1>Biolix</h1><p>Tratamiento bacteriano de lixiviados</p></div><div class="logos"><img src="${logoFcyt}" alt="Facultad de Ciencias y Tecnología"><img src="${logoAmbiental}" alt="Ingeniería Ambiental"><img src="${logoCico}" alt="ING. Ciencias de la Computación"></div></header><section class="meta"><div><small>FECHA DE EMISIÓN</small><b>${fecha}</b></div><div><small>MODELO UTILIZADO</small><b>${escapar(modeloActivo)}</b></div><div><small>TIPO DE TRATAMIENTO</small><b>${escapar(e.tipo_tratamiento)}</b></div></section><div class="content"><section class="section"><div class="section-title"><b>1</b><h2>Caracterización inicial del lixiviado</h2></div><table><tbody>${filasLixiviado}</tbody></table></section><section class="section"><div class="section-title"><b>2</b><h2>Configuración bacteriana</h2></div><div class="bacteria-layout">${bacteriasReporte}</div></section><section class="section"><div class="section-title"><b>3</b><h2>Condiciones del reactor</h2></div><table><tbody>${condiciones}</tbody></table></section><section class="section"><div class="section-title"><b>4</b><h2>Resultados estimados</h2></div><table class="results"><thead><tr><th>Variable</th><th>Inicial</th><th>Final estimado</th><th>Cambio</th><th>Unidad</th></tr></thead><tbody>${resultados}</tbody></table></section><div class="disclaimer"><b>Nota:</b> Este reporte documenta una predicción generada por el modelo y debe conservarse junto con los registros experimentales correspondientes.</div><div class="signature"><div>Responsable del análisis</div><div>Responsable del laboratorio</div></div></div></main></body></html>`;
  const boton = document.querySelector("#generar-reporte"), texto = boton.querySelector("b"), detalle = boton.querySelector("small");
  const textoOriginal = texto.textContent, detalleOriginal = detalle.textContent;
  const analizador = new DOMParser().parseFromString(reporte, "text/html");
  const estiloReporte = document.createElement("style");
  estiloReporte.textContent = analizador.querySelector("style").textContent.replace("*{box-sizing:border-box}", "#pdf-export,#pdf-export *{box-sizing:border-box}").replace("body{margin:0", "#pdf-export{margin:0").replace(/@media\(max-width:700px\)\{[^}]+\{[^}]*\}[^}]*\}/g, "");
  estiloReporte.textContent += ".report .section{break-inside:auto!important;page-break-inside:auto!important}.report .content>.section:nth-of-type(2),.report .content>.section:nth-of-type(3){break-before:page!important;page-break-before:always!important}";
  document.head.appendChild(estiloReporte);
  const contenedor = document.createElement("div");
  contenedor.id = "pdf-export";
  contenedor.style.cssText = "position:absolute;left:-100000px;top:0;width:210mm;background:#fff;z-index:-1";
  const hoja = document.importNode(analizador.querySelector(".report"), true);
  hoja.style.width = "210mm";
  hoja.style.margin = "0";
  hoja.style.boxShadow = "none";
  contenedor.appendChild(hoja);
  document.body.appendChild(contenedor);
  boton.disabled = true; texto.textContent = "Generando PDF…"; detalle.textContent = "Mantenga esta página abierta";
  try {
    await Promise.all([...hoja.querySelectorAll("img")].map(imagen => imagen.complete ? imagen.decode().catch(() => {}) : new Promise(resolve => { imagen.onload = resolve; imagen.onerror = resolve; })));
    const id = String(e.id_experimento || "experimento").replace(/[^a-zA-Z0-9_-]+/g, "-");
    await html2pdf().set({margin:0, filename:`reporte-${id}.pdf`, image:{type:"jpeg",quality:.98}, html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff",logging:false,windowWidth:794,scrollX:0,scrollY:0}, jsPDF:{unit:"mm",format:"a4",orientation:"portrait"}, pagebreak:{mode:["css","legacy"],avoid:[".bacteria-report"]}}).from(hoja).save();
  } catch {
    alert("No fue posible descargar el reporte PDF. Inténtelo nuevamente.");
  } finally {
    contenedor.remove(); estiloReporte.remove(); boton.disabled = false; texto.textContent = textoOriginal; detalle.textContent = detalleOriginal;
  }
}

function actualizarProcesamiento(indice, texto) {
  document.querySelector("#processing-text").textContent = texto;
  document.querySelectorAll(".processing-steps span").forEach((paso, i) => paso.classList.toggle("active", i <= indice));
}
function iniciarProcesamiento() {
  const overlay = document.querySelector("#procesando"), boton = document.querySelector("#ejecutar-prediccion");
  overlay.hidden = false; boton.disabled = true;
  boton.querySelector(".process-copy b").textContent = "Procesando…";
  boton.querySelector(".process-copy small").textContent = "Espere un momento";
  actualizarProcesamiento(0, "Validando variables de entrada…");
}
function finalizarProcesamiento() {
  const overlay = document.querySelector("#procesando"), boton = document.querySelector("#ejecutar-prediccion");
  overlay.hidden = true; boton.disabled = false;
  boton.querySelector(".process-copy b").textContent = "Procesar tratamiento";
  boton.querySelector(".process-copy small").textContent = "Generar las seis predicciones";
}

formulario.addEventListener("submit", async evento => {
  evento.preventDefault();
  if (!validarPaso(3)) return;
  const mensaje = document.querySelector("#mensaje"), datos = construirRegistro();
  mensaje.textContent = ""; iniciarProcesamiento();
  try {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    actualizarProcesamiento(1, "Preparando variables y concentraciones…");
    await new Promise(resolve => requestAnimationFrame(resolve));
    actualizarProcesamiento(2, "Consultando el modelo multisalida…");
    const respuesta = await fetch(`${API}/predict`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(datos)});
    const resultado = await respuesta.json();
    if (!respuesta.ok) throw new Error(resultado.detail || "No fue posible generar la predicción.");
    actualizarProcesamiento(3, "Organizando los seis resultados…");
    ultimoExperimento = datos; ultimoResultado = resultado;
    mostrarResultados(resultado, datos);
    document.querySelector("#generar-reporte").disabled = false;
    finalizarProcesamiento(); mensaje.textContent = "";
    pasoMaximo = 4;
    mostrarPaso(4, true);
  } catch (error) {
    finalizarProcesamiento();
    mensaje.textContent = error.message.includes("Failed to fetch") ? "No se pudo conectar con el servicio. Inténtelo nuevamente en unos segundos." : error.message;
  }
});

document.querySelector("#editar").addEventListener("click", () => mostrarPaso(3, true));
document.querySelector("#generar-reporte").addEventListener("click", generarReporte);
document.querySelector("#nuevo").addEventListener("click", () => {
  formulario.reset(); pasoMaximo = 0; bacteriasConfiguradas.clear(); ultimoExperimento = null; ultimoResultado = null; document.querySelector("#generar-reporte").disabled = true; document.querySelector("#consorcio-completo").click(); actualizarCalculos(); mostrarPaso(0, true);
  document.querySelector("#result-grid").innerHTML = '<div class="empty"><span>⌁</span><h3>Aún no hay una predicción</h3><p>Complete los pasos anteriores para consultar el modelo.</p></div>';
});

aplicarPerfil("medio");
document.querySelector("#reactor-recomendado").click();
document.querySelector("#consorcio-completo").click();
actualizarCalculos();
actualizarAyuda();
estadoModelo();
