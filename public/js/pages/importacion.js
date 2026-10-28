/* ===== IMPORTACION DESDE OPUS ===== */

const importacionState = {
  id: null,
  archivo: null,
  expira_en: null,
  preview: null,
  subiendo: false,
  confirmando: false,
  descartando: false
};

const ZONAS_IMPORTACION = ['Norte', 'Frontera', 'Turístico', 'Centro', 'Sur'];

/* ===== VISTA PRINCIPAL ===== */
function renderImportacion() {
  const content = $('page-content');
  const esAdmin = Boolean(API.user && API.user.rol === 'administrador');

  if (!esAdmin) {
    content.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Importar desde Opus</div>
          <div class="page-subtitle">Acceso restringido</div>
        </div>
      </div>
      <div class="alert alert-warn">Solo los administradores pueden importar presupuestos desde Opus.</div>`;
    return;
  }

  const tienePreview = Boolean(importacionState.preview);

  content.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Importar desde Opus</div>
        <div class="page-subtitle">${tienePreview
          ? 'Revisa y ajusta los datos detectados antes de conservar el proyecto'
          : 'Sube un presupuesto en Excel y revísalo antes de crear el proyecto'}</div>
      </div>
    </div>
    ${tienePreview ? renderPreviewImportacion() : renderDropZoneImportacion()}`;

  if (!tienePreview && !importacionState.subiendo) {
    bindImportacionDropZone();
  }
}

/* ===== ZONA DE ARRASTRE ===== */
function renderDropZoneImportacion() {
  if (importacionState.subiendo) {
    return `<div class="import-drop import-drop-busy" aria-busy="true">
      <div class="spinner"></div>
      <div class="import-drop-title">Analizando archivo…</div>
      <div class="import-drop-sub">Detectando metadatos, columnas y materiales</div>
    </div>`;
  }

  return `
    <input type="file" id="import-file" accept=".xlsx,.xls" hidden />
    <div class="import-drop" id="import-drop" role="button" tabindex="0"
         aria-label="Seleccionar un archivo de Excel para importar desde Opus">
      <div class="import-drop-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4a7.48 7.48 0 0 0-6.64 4.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
        </svg>
      </div>
      <div class="import-drop-title">Arrastra aquí tu presupuesto de Opus</div>
      <div class="import-drop-sub">o haz clic para seleccionar el archivo</div>
      <div class="import-drop-hint">Excel .xlsx o .xls · Se analiza en el servidor</div>
    </div>`;
}

function bindImportacionDropZone() {
  const drop = $('import-drop');
  const input = $('import-file');
  if (!drop || !input) return;

  const abrirSelector = () => input.click();

  drop.addEventListener('click', abrirSelector);
  drop.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      abrirSelector();
    }
  });

  input.addEventListener('change', () => {
    const archivo = input.files && input.files[0];
    input.value = '';
    if (archivo) subirArchivoImportacion(archivo);
  });

  ['dragenter', 'dragover'].forEach((evento) => {
    drop.addEventListener(evento, (event) => {
      event.preventDefault();
      event.stopPropagation();
      drop.classList.add('dragover');
    });
  });

  ['dragleave', 'dragend'].forEach((evento) => {
    drop.addEventListener(evento, (event) => {
      event.preventDefault();
      event.stopPropagation();
      drop.classList.remove('dragover');
    });
  });

  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    drop.classList.remove('dragover');

    const archivo = event.dataTransfer && event.dataTransfer.files
      ? event.dataTransfer.files[0]
      : null;

    if (archivo) subirArchivoImportacion(archivo);
  });
}

/* Evita que el navegador abra un Excel si se suelta fuera de la zona. */
document.addEventListener('dragover', (event) => {
  if (typeof currentPage !== 'undefined' && currentPage === 'importacion') {
    event.preventDefault();
  }
});

document.addEventListener('drop', (event) => {
  if (typeof currentPage !== 'undefined' && currentPage === 'importacion') {
    event.preventDefault();
  }
});

/* ===== SUBIDA Y ANALISIS ===== */
async function subirArchivoImportacion(archivo) {
  if (!archivo || importacionState.subiendo) return;

  const nombre = String(archivo.name || '');
  if (!/\.(xlsx|xls)$/i.test(nombre)) {
    toast('Formato no permitido. Sube un archivo .xlsx o .xls.', 'error');
    return;
  }

  importacionState.subiendo = true;
  if (importacionActiva()) renderImportacion();

  try {
    const formulario = new FormData();
    formulario.append('archivo', archivo, archivo.name);

    const respuesta = await fetch('/api/importacion/preview', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + API.token },
      body: formulario
    });

    let datos = null;
    try {
      datos = await respuesta.json();
    } catch (_error) {
      datos = null;
    }

    if (respuesta.status === 401) {
      API.logout();
      location.reload();
      return;
    }

    if (!respuesta.ok) {
      throw new Error((datos && datos.error) || 'No se pudo procesar el archivo.');
    }

    if (!datos || !datos.id || !datos.preview) {
      throw new Error('El servidor no devolvió una vista previa válida.');
    }

    importacionState.id = datos.id;
    importacionState.archivo = datos.archivo || archivo.name;
    importacionState.expira_en = datos.expira_en || null;
    importacionState.preview = datos.preview;
    importacionState.subiendo = false;

    if (importacionActiva()) renderImportacion();

    const total = Array.isArray(datos.preview.materiales) ? datos.preview.materiales.length : 0;
    toast(`Archivo analizado: ${total} material(es) detectado(s).`, 'success');
  } catch (error) {
    importacionState.subiendo = false;
    if (importacionActiva()) renderImportacion();
    toast(error.message || 'No se pudo procesar el archivo.', 'error');
  }
}

/* ===== VISTA PREVIA ===== */
function renderPreviewImportacion() {
  const preview = importacionState.preview || {};
  const materiales = Array.isArray(preview.materiales) ? preview.materiales : [];
  const meta = preview.meta && typeof preview.meta === 'object' ? preview.meta : {};

  const confianza = Math.max(0, Math.min(100, Number(preview.confianza_parseo) || 0));
  const claseConfianza = confianza >= 80 ? 'green' : confianza >= 50 ? 'yellow' : 'red';
  const etiquetaConfianza = confianza >= 80 ? 'Alta' : confianza >= 50 ? 'Media' : 'Baja';

  const sumaCalculada = materiales.reduce(
    (total, material) => total + (Number(material.total) || 0),
    0
  );
  const sumaMeta = Number(meta.suma_totales);
  const sumaMateriales = Number.isFinite(sumaMeta) ? sumaMeta : sumaCalculada;

  const presupuesto = Number(preview.presupuesto_total);
  const presupuestoValor = Number.isFinite(presupuesto) ? presupuesto : sumaMateriales;
  const presupuestoDeclarado = meta.presupuesto_declarado;
  const presupuestoSub = presupuestoDeclarado === null || presupuestoDeclarado === undefined
    ? 'Calculado de los materiales'
    : 'Declarado en el archivo';

  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(preview.fecha_inicio || ''))
    ? preview.fecha_inicio
    : '';
  const archivo = importacionState.archivo || 'Archivo de Opus';
  const expira = fechaHoraImportacion(importacionState.expira_en);
  const advertencias = Array.isArray(preview.advertencias) ? preview.advertencias : [];

  const metaPartes = [];
  if (meta.hoja) metaPartes.push(`Hoja <strong>${escHtml(meta.hoja)}</strong>`);
  if (meta.fila_encabezado) {
    metaPartes.push(`Encabezado en fila <strong>${escHtml(meta.fila_encabezado)}</strong>`);
  }
  if (meta.filas_leidas !== undefined && meta.filas_leidas !== null) {
    const importadas = meta.filas_importadas !== undefined
      ? meta.filas_importadas
      : materiales.length;
    metaPartes.push(
      `<strong>${escHtml(importadas)}</strong> de <strong>${escHtml(meta.filas_leidas)}</strong> filas importadas`
    );
  }
  if (meta.filas_omitidas) {
    metaPartes.push(`<strong>${escHtml(meta.filas_omitidas)}</strong> omitidas`);
  }

  const filas = materiales.map((material, indice) => `<tr>
    <td class="import-idx">${indice + 1}</td>
    <td class="import-desc">${escHtml(material.descripcion || 'Sin descripción')}</td>
    <td>${escHtml(material.unidades || 'pza')}</td>
    <td class="import-num">${fmtN(Number(material.cantidad) || 0, 3)}</td>
    <td class="import-num">${moneyImportacion(material.precio_unitario)}</td>
    <td class="import-num">${moneyImportacion(material.total)}</td>
  </tr>`).join('');

  const bloqueAdvertencias = advertencias.length
    ? `<div class="alert alert-warn import-warnings">
        <div class="import-warnings-title">Advertencias del parseo (${advertencias.length})</div>
        <ul>${advertencias.map((aviso) => `<li>${escHtml(aviso)}</li>`).join('')}</ul>
      </div>`
    : `<div class="alert alert-ok">Sin advertencias: el archivo se interpretó correctamente.</div>`;

  const zonaActual = ZONAS_IMPORTACION.includes(preview.zona) ? preview.zona : 'Centro';
  const opcionesZona = ZONAS_IMPORTACION.map((zona) => {
    const seleccionada = zona === zonaActual ? ' selected' : '';
    return `<option value="${escHtml(zona)}"${seleccionada}>${escHtml(zona)}</option>`;
  }).join('');

  const ocupado = importacionState.confirmando || importacionState.descartando;
  const deshabilitado = ocupado ? 'disabled' : '';
  const textoConfirmar = importacionState.confirmando
    ? 'Creando proyecto…'
    : 'Conservar proyecto';
  const textoDescartar = importacionState.descartando ? 'Descartando…' : 'Descartar';

  return `
    <div class="card import-card">
      <div class="card-header">
        <div>
          <div class="card-title">${escHtml(archivo)}</div>
          <div class="import-file-meta">
            ${metaPartes.length ? `<span>${metaPartes.join(' · ')}</span>` : ''}
            ${expira ? `<span class="import-expira">Vista previa temporal · expira a las ${escHtml(expira)}</span>` : ''}
          </div>
        </div>
        <span class="badge badge-borrador">Sin confirmar</span>
      </div>
    </div>

    <div class="kpi-grid import-summary">
      <div class="kpi-card">
        <div class="kpi-label">Materiales</div>
        <div class="kpi-value">${materiales.length}</div>
        <div class="kpi-sub">Productos a crear</div>
      </div>
      <div class="kpi-card blue">
        <div class="kpi-label">Presupuesto detectado</div>
        <div class="kpi-value">${moneyImportacion(presupuestoValor)}</div>
        <div class="kpi-sub">${presupuestoSub}</div>
      </div>
      <div class="kpi-card purple">
        <div class="kpi-label">Suma de materiales</div>
        <div class="kpi-value">${moneyImportacion(sumaMateriales)}</div>
        <div class="kpi-sub">Verificación del archivo</div>
      </div>
      <div class="kpi-card ${claseConfianza}">
        <div class="kpi-label">Confianza del parseo</div>
        <div class="kpi-value">${confianza}%</div>
        <div class="kpi-sub">${etiquetaConfianza} · columnas y filas</div>
        ${progressBar(confianza, claseConfianza, false)}
      </div>
    </div>

    ${bloqueAdvertencias}

    <div class="card import-card">
      <div class="card-header">
        <div class="card-title">Datos del proyecto</div>
        <span class="import-edit-hint">Puedes editarlos antes de conservar</span>
      </div>
      <div class="card-body">
        <div class="import-form-grid">
          <div class="form-group import-field-full">
            <label for="imp-nombre">Nombre de la obra *</label>
            <input id="imp-nombre" type="text" maxlength="200"
                   value="${escHtml(preview.nombre_obra || '')}"
                   placeholder="Nombre de la obra" />
          </div>
          <div class="form-group">
            <label for="imp-fecha">Fecha de inicio *</label>
            <input id="imp-fecha" type="date" value="${escHtml(fecha)}" />
          </div>
          <div class="form-group">
            <label for="imp-presupuesto">Presupuesto total (MXN) *</label>
            <input id="imp-presupuesto" type="number" min="0" step="0.01"
                   value="${presupuestoValor.toFixed(2)}" />
          </div>
          <div class="form-group">
            <label for="imp-zona">Zona geográfica</label>
            <select id="imp-zona">${opcionesZona}</select>
          </div>
        </div>
      </div>
    </div>

    <div class="card import-card import-table-card">
      <div class="card-header">
        <div class="card-title">Materiales detectados</div>
        <span class="import-edit-hint">${materiales.length} material(es)</span>
      </div>
      <div class="card-body">
        <div class="table-wrap import-table-scroll">
          <table class="import-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Descripción</th>
                <th>Unidad</th>
                <th class="text-right">Cantidad</th>
                <th class="text-right">Precio unitario</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${filas || `<tr><td colspan="6" class="text-center td-small">No hay materiales en la vista previa.</td></tr>`}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="5" class="text-right">Total de materiales</td>
                <td class="import-num import-total">${moneyImportacion(sumaMateriales)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <div class="import-actions">
      <div class="import-actions-note">
        Se creará un proyecto en estado <span class="badge badge-borrador">borrador</span> con
        <strong>${materiales.length}</strong> producto(s) y su cotización en el proveedor de importación.
      </div>
      <div class="import-actions-buttons">
        <button type="button" class="btn-ghost" id="imp-descartar"
                onclick="descartarImportacionUI()" ${deshabilitado}>${textoDescartar}</button>
        <button type="button" class="btn-primary" id="imp-confirmar"
                onclick="confirmarImportacionUI()" ${deshabilitado}>${textoConfirmar}</button>
      </div>
    </div>`;
}

/* ===== CONFIRMAR ===== */
async function confirmarImportacionUI() {
  if (importacionState.confirmando || importacionState.descartando) return;

  if (!importacionState.preview || !importacionState.id) {
    toast('La vista previa no está disponible. Vuelve a subir el archivo.', 'error');
    return;
  }

  const nombreInput = $('imp-nombre');
  const fechaInput = $('imp-fecha');
  const presupuestoInput = $('imp-presupuesto');
  const zonaInput = $('imp-zona');

  if (!nombreInput || !fechaInput || !presupuestoInput || !zonaInput) {
    toast('No se encontraron los campos de la vista previa.', 'error');
    return;
  }

  const nombre = nombreInput.value.trim();
  const fecha = fechaInput.value;
  const presupuestoTexto = presupuestoInput.value.trim();
  const presupuesto = Number(presupuestoTexto);
  const zona = zonaInput.value;

  if (!nombre) {
    toast('El nombre de la obra es obligatorio.', 'error');
    nombreInput.focus();
    return;
  }

  if (!fecha) {
    toast('Selecciona la fecha de inicio.', 'error');
    fechaInput.focus();
    return;
  }

  if (presupuestoTexto === '' || !Number.isFinite(presupuesto) || presupuesto < 0) {
    toast('El presupuesto debe ser un número mayor o igual a 0.', 'error');
    presupuestoInput.focus();
    return;
  }

  if (!ZONAS_IMPORTACION.includes(zona)) {
    toast('Selecciona una zona válida.', 'error');
    zonaInput.focus();
    return;
  }

  importacionState.confirmando = true;
  actualizarBotonesImportacion();

  try {
    const respuesta = await API.post('/api/importacion/confirmar', {
      id: importacionState.id,
      nombre_obra: nombre,
      fecha_inicio: fecha,
      presupuesto_total: presupuesto,
      zona
    });

    limpiarEstadoImportacion();
    toast(
      `Proyecto "${respuesta.nombre_obra}" conservado como borrador ` +
      `(${respuesta.materiales_importados} material(es)).`,
      'success'
    );
    navigate('proyectos');
  } catch (error) {
    toast(error.message || 'No se pudo confirmar la importación.', 'error');
  } finally {
    importacionState.confirmando = false;
    if (importacionActiva() && importacionState.preview) actualizarBotonesImportacion();
  }
}

/* ===== DESCARTAR ===== */
async function descartarImportacionUI() {
  if (importacionState.confirmando || importacionState.descartando) return;

  const id = importacionState.id;

  if (!id) {
    limpiarEstadoImportacion();
    if (importacionActiva()) renderImportacion();
    return;
  }

  importacionState.descartando = true;
  actualizarBotonesImportacion();

  try {
    await API.delete('/api/importacion/' + encodeURIComponent(id));
    toast('Vista previa descartada.', 'success');
  } catch (error) {
    toast('La vista previa ya no estaba disponible: ' + error.message, 'error');
  } finally {
    limpiarEstadoImportacion();
    if (importacionActiva()) renderImportacion();
  }
}

/* ===== ESTADO Y UTILIDADES ===== */
function limpiarEstadoImportacion() {
  importacionState.id = null;
  importacionState.archivo = null;
  importacionState.expira_en = null;
  importacionState.preview = null;
  importacionState.subiendo = false;
  importacionState.confirmando = false;
  importacionState.descartando = false;
}

function actualizarBotonesImportacion() {
  const confirmar = $('imp-confirmar');
  const descartar = $('imp-descartar');
  const ocupado = importacionState.confirmando || importacionState.descartando;

  if (confirmar) {
    confirmar.disabled = ocupado;
    confirmar.textContent = importacionState.confirmando
      ? 'Creando proyecto…'
      : 'Conservar proyecto';
  }

  if (descartar) {
    descartar.disabled = ocupado;
    descartar.textContent = importacionState.descartando ? 'Descartando…' : 'Descartar';
  }
}

function importacionActiva() {
  return typeof currentPage === 'undefined' || currentPage === 'importacion';
}

function moneyImportacion(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '—';

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numero);
}

function fechaHoraImportacion(iso) {
  if (!iso) return '';

  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return '';

  const ahora = new Date();
  if (fecha.toDateString() === ahora.toDateString()) {
    return fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }

  return fecha.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}
