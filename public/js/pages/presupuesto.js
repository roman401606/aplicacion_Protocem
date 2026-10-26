/* ===== PÁGINA: PRESUPUESTO DESGLOSADO ===== */

let _presProyectoActual = null;
let _presProyectos = [];

async function renderPresupuesto() {
  const content = $('page-content');
  const isAdmin = API.user.rol === 'administrador';
  const canEdit = ['administrador','encargado'].includes(API.user.rol);

  try {
    _presProyectos = await API.get('/api/proyectos');
    const activos = _presProyectos.filter(p => p.estado !== 'finalizado');

    content.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Presupuesto de Obra</div>
          <div class="page-subtitle">Desglose por partidas y conceptos — estilo OPUS CMS</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-body">
          <div class="form-row" style="align-items:flex-end;gap:12px;">
            <div class="form-group" style="flex:1;margin:0;">
              <label>Selecciona un proyecto</label>
              <select id="pres-selector">
                <option value="">— Elige un proyecto —</option>
                ${_presProyectos.map(p => `<option value="${p.id_proyecto}">${p.nombre_obra} (${p.estado})</option>`).join('')}
              </select>
            </div>
            ${canEdit ? `<button class="btn-primary" onclick="presNuevaPartida()">+ Partida</button>` : ''}
          </div>
        </div>
      </div>

      <div id="pres-content">${empty('Selecciona un proyecto para ver su presupuesto')}</div>`;

    $('pres-selector').addEventListener('change', async e => {
      const id = e.target.value;
      if (!id) { $('pres-content').innerHTML = empty('Selecciona un proyecto'); return; }
      _presProyectoActual = parseInt(id);
      await cargarPresupuesto(id);
    });

    if (_presProyectoActual) {
      $('pres-selector').value = _presProyectoActual;
      await cargarPresupuesto(_presProyectoActual);
    }
  } catch (e) {
    content.innerHTML = `<div class="alert alert-warn">${e.message}</div>`;
  }
}

async function cargarPresupuesto(id) {
  $('pres-content').innerHTML = loading();
  try {
    const canEdit = ['administrador','encargado'].includes(API.user.rol);
    const resumen = await API.get(`/api/partidas/proyecto/${id}/resumen`);
    const { partidas, totales } = resumen;

    const pctConceptos = totales.presupuesto > 0
      ? ((totales.total_conceptos / totales.presupuesto) * 100).toFixed(1)
      : 0;
    const pctGasto = totales.total_conceptos > 0
      ? ((totales.gasto_real / totales.total_conceptos) * 100).toFixed(1)
      : 0;

    const semColor = pctGasto > 90 ? 'red' : pctGasto > 70 ? 'yellow' : 'green';

    $('pres-content').innerHTML = `
      <!-- KPIs del presupuesto -->
      <div class="kpi-grid" style="margin-bottom:20px;">
        <div class="kpi-card blue">
          <div class="kpi-label">Presupuesto total</div>
          <div class="kpi-value">${fmt(totales.presupuesto)}</div>
          <div class="kpi-sub">Monto de contrato</div>
        </div>
        <div class="kpi-card green">
          <div class="kpi-label">Total en conceptos</div>
          <div class="kpi-value">${fmt(totales.total_conceptos)}</div>
          <div class="kpi-sub">${pctConceptos}% del presupuesto asignado</div>
        </div>
        <div class="kpi-card ${semColor}">
          <div class="kpi-label">Gasto real vs presupuesto</div>
          <div class="kpi-value">${fmt(totales.gasto_real)}</div>
          <div class="kpi-sub">${pctGasto}% ejecutado</div>
        </div>
        <div class="kpi-card purple">
          <div class="kpi-label">Saldo disponible</div>
          <div class="kpi-value">${fmt(totales.presupuesto - totales.gasto_real)}</div>
          <div class="kpi-sub">Por ejercer</div>
        </div>
      </div>

      <!-- Tabla de partidas -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Desglose de partidas</span>
          <span class="badge badge-blue">${partidas.length} partida(s)</span>
        </div>
        <div class="card-body" style="padding:0;">
          ${partidas.length === 0 ? `<div style="padding:24px;color:var(--text2);text-align:center;">Sin partidas. ${canEdit ? '<button class="btn-ghost btn-sm" onclick="presNuevaPartida()">+ Agregar primera partida</button>' : ''}</div>` :
          partidas.map(pa => renderPartidaRow(pa, canEdit)).join('')}
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;justify-content:flex-end;">
        ${canEdit ? `<button class="btn-primary" onclick="presNuevaPartida()">+ Nueva partida</button>` : ''}
        <button class="btn-ghost" onclick="presVerExplosion(${id})">Explosión de insumos</button>
      </div>`;
  } catch (e) {
    $('pres-content').innerHTML = `<div class="alert alert-warn">${e.message}</div>`;
  }
}

function renderPartidaRow(pa, canEdit) {
  const pctPartida = pa.total_partida > 0
    ? Math.min(100, (pa.avance_financiero / pa.total_partida) * 100).toFixed(1)
    : 0;
  const colorPart = pctPartida > 90 ? 'red' : pctPartida > 70 ? 'yellow' : 'accent';

  return `<div style="border-bottom:1px solid var(--border);">
    <!-- Cabecera de partida -->
    <div style="display:flex;align-items:center;gap:12px;padding:14px 20px;cursor:pointer;background:var(--bg2);"
         onclick="togglePartida(${pa.id_partida})">
      <span style="font-size:0.75rem;font-weight:700;color:var(--accent);min-width:28px;">${pa.numero}</span>
      <span style="font-weight:600;flex:1;">${pa.nombre}</span>
      <span style="font-size:0.82rem;color:var(--text2);margin-right:8px;">${pa.num_conceptos} concepto(s)</span>
      <span style="font-weight:700;color:var(--blue);min-width:110px;text-align:right;">${fmt(pa.total_partida)}</span>
      <div style="min-width:120px;">${progressBar(pctPartida, colorPart, false)}</div>
      ${canEdit ? `
        <button class="btn-ghost btn-sm" onclick="event.stopPropagation();presNuevoConcepto(${pa.id_partida},'${pa.nombre}')">+ Concepto</button>
        <button class="btn-ghost btn-sm" onclick="event.stopPropagation();presEditarPartida(${pa.id_partida},'${pa.numero}','${pa.nombre}')">✏</button>
      ` : ''}
      <span id="arrow-${pa.id_partida}" style="color:var(--text2);font-size:0.9rem;">▼</span>
    </div>
    <!-- Conceptos (colapsable) -->
    <div id="conceptos-${pa.id_partida}" style="display:none;">
      <div id="conceptos-body-${pa.id_partida}">${loading()}</div>
    </div>
  </div>`;
}

async function togglePartida(id_partida) {
  const container = $(`conceptos-${id_partida}`);
  const arrow     = $(`arrow-${id_partida}`);
  if (container.style.display !== 'none') {
    container.style.display = 'none';
    arrow.textContent = '▼';
    return;
  }
  container.style.display = 'block';
  arrow.textContent = '▲';
  await cargarConceptos(id_partida);
}

async function cargarConceptos(id_partida) {
  const body = $(`conceptos-body-${id_partida}`);
  body.innerHTML = loading();
  const canEdit = ['administrador','encargado'].includes(API.user.rol);
  try {
    const conceptos = await API.get(`/api/partidas/${id_partida}/conceptos`);
    if (!window._conceptoEdit) window._conceptoEdit = {};
    conceptos.forEach(co => { window._conceptoEdit[co.id_concepto] = { ...co, _partida: id_partida }; });
    if (!conceptos.length) {
      body.innerHTML = `<div style="padding:16px 40px;color:var(--text2);font-size:0.85rem;">Sin conceptos en esta partida.</div>`;
      return;
    }
    body.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Clave</th>
              <th>Descripción</th>
              <th>Unidad</th>
              <th style="text-align:right;">Cantidad</th>
              <th style="text-align:right;">P.U.</th>
              <th style="text-align:right;">Importe</th>
              <th style="text-align:right;">Ejecutado</th>
              <th>Avance</th>
              ${canEdit ? '<th></th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${conceptos.map(co => `<tr>
              <td><span style="font-size:0.75rem;color:var(--accent);">${co.clave||'—'}</span></td>
              <td style="max-width:280px;white-space:normal;font-size:0.82rem;">${co.descripcion}</td>
              <td>${co.unidad}</td>
              <td style="text-align:right;">${fmtN(co.cantidad,3)}</td>
              <td style="text-align:right;">${fmt(co.precio_unitario)}</td>
              <td style="text-align:right;font-weight:600;color:var(--blue);">${fmt(co.importe)}</td>
              <td style="text-align:right;">${fmtN(co.cantidad_ejecutada,3)}</td>
              <td style="min-width:80px;">${progressBar(co.pct_ejecutado||0,'auto',false)}</td>
              ${canEdit ? `<td style="white-space:nowrap;">
                <button class="btn-ghost btn-sm" onclick="presVerAPU(${co.id_concepto})">APU</button>
                <button class="btn-ghost btn-sm" onclick="presVerGenerador(${co.id_concepto},'${co.clave||co.descripcion.substring(0,20)}')">Gen.</button>
                <button class="btn-ghost btn-sm" onclick="presEditarConcepto(${co.id_concepto})">✏</button>
              </td>` : ''}
            </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5" style="text-align:right;font-weight:700;padding:10px 12px;">Subtotal partida:</td>
              <td style="text-align:right;font-weight:700;color:var(--blue);">${fmt(conceptos.reduce((s,c)=>s+parseFloat(c.importe||0),0))}</td>
              <td colspan="${canEdit ? 3 : 2}"></td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  } catch (e) {
    body.innerHTML = `<div style="padding:16px;color:var(--red);">Error: ${e.message}</div>`;
  }
}

/* ── MODALES ── */

async function presNuevaPartida() {
  if (!_presProyectoActual) return toast('Primero selecciona un proyecto', 'error');
  const html = `
    <div class="form-row">
      <div class="form-group" style="flex:0 0 100px;">
        <label>Número *</label>
        <input type="text" id="pp-num" placeholder="01" maxlength="10"/>
      </div>
      <div class="form-group" style="flex:1;">
        <label>Nombre de la partida *</label>
        <input type="text" id="pp-nombre" placeholder="Trabajos Preliminares"/>
      </div>
    </div>
    <div class="form-group">
      <label>Descripción</label>
      <input type="text" id="pp-desc" placeholder="Descripción opcional"/>
    </div>
    <div class="form-group">
      <label>Orden</label>
      <input type="number" id="pp-orden" value="0" min="0"/>
    </div>
    <div class="modal-footer" style="padding:0;border:none;margin-top:8px;">
      <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn-primary" onclick="presSavePartida()">Crear partida</button>
    </div>`;
  openModal('Nueva partida', html);
}

async function presSavePartida() {
  const numero      = $('pp-num').value.trim();
  const nombre      = $('pp-nombre').value.trim();
  const descripcion = $('pp-desc').value.trim();
  const orden       = parseInt($('pp-orden').value) || 0;
  if (!numero || !nombre) return toast('Número y nombre son obligatorios', 'error');
  try {
    await API.post(`/api/partidas/proyecto/${_presProyectoActual}`, { numero, nombre, descripcion, orden });
    toast('Partida creada', 'success');
    closeModal();
    await cargarPresupuesto(_presProyectoActual);
  } catch (e) { toast(e.message, 'error'); }
}

async function presNuevoConcepto(id_partida, nombrePartida) {
  let catalogoOptions = '';
  try {
    const cat = await API.get('/api/catalogo');
    catalogoOptions = `<option value="">— Concepto libre —</option>` +
      cat.map(c => `<option value="${c.id_catalogo}" data-desc="${c.descripcion}" data-unidad="${c.unidad}" data-precio="${c.precio_ref||0}">
        [${c.clave}] ${c.descripcion.substring(0,60)} — ${c.unidad} — ${fmt(c.precio_ref)}
      </option>`).join('');
  } catch(_) {}

  const html = `
    <div class="form-group">
      <label>Seleccionar del catálogo CMIC/BIMSA (opcional)</label>
      <select id="pc-catalogo" onchange="presAutoFillConcepto(this)">
        ${catalogoOptions}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:0 0 120px;">
        <label>Clave</label>
        <input type="text" id="pc-clave" placeholder="CIM-01"/>
      </div>
      <div class="form-group" style="flex:1;">
        <label>Descripción *</label>
        <input type="text" id="pc-desc" placeholder="Descripción del concepto"/>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Unidad *</label>
        <input type="text" id="pc-unidad" placeholder="m2, m3, ml, pza..."/>
      </div>
      <div class="form-group">
        <label>Cantidad *</label>
        <input type="number" id="pc-cantidad" min="0" step="0.001" placeholder="0.000"/>
      </div>
      <div class="form-group">
        <label>Precio unitario *</label>
        <input type="number" id="pc-precio" min="0" step="0.01" placeholder="0.00"/>
      </div>
    </div>
    <div style="background:var(--bg2);border-radius:8px;padding:12px;margin-bottom:8px;">
      <span style="font-size:0.82rem;color:var(--text2);">Importe estimado: </span>
      <span id="pc-importe-preview" style="font-weight:700;color:var(--blue);">$0.00</span>
    </div>
    <div class="modal-footer" style="padding:0;border:none;margin-top:8px;">
      <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn-primary" onclick="presSaveConcepto(${id_partida})">Agregar concepto</button>
    </div>`;
  openModal(`Nuevo concepto — ${nombrePartida}`, html, true);

  ['pc-cantidad','pc-precio'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', () => {
      const cant = parseFloat($('pc-cantidad').value)||0;
      const pu   = parseFloat($('pc-precio').value)||0;
      $('pc-importe-preview').textContent = fmt(cant * pu);
    });
  });
}

function presAutoFillConcepto(sel) {
  const opt = sel.options[sel.selectedIndex];
  if (!opt.value) return;
  $('pc-desc').value   = opt.dataset.desc || '';
  $('pc-unidad').value = opt.dataset.unidad || '';
  $('pc-precio').value = opt.dataset.precio || '';
  const cant = parseFloat($('pc-cantidad').value)||0;
  const pu   = parseFloat(opt.dataset.precio)||0;
  $('pc-importe-preview').textContent = fmt(cant * pu);
}

async function presSaveConcepto(id_partida) {
  const id_catalogo   = $('pc-catalogo')?.value || null;
  const clave         = $('pc-clave').value.trim();
  const descripcion   = $('pc-desc').value.trim();
  const unidad        = $('pc-unidad').value.trim();
  const cantidad      = parseFloat($('pc-cantidad').value);
  const precio_unitario = parseFloat($('pc-precio').value);
  if (!descripcion || !unidad || isNaN(cantidad) || isNaN(precio_unitario))
    return toast('Completa todos los campos obligatorios', 'error');
  try {
    await API.post(`/api/partidas/${id_partida}/conceptos`, {
      id_catalogo: id_catalogo || null,
      clave, descripcion, unidad, cantidad, precio_unitario
    });
    toast('Concepto agregado', 'success');
    closeModal();
    await cargarConceptos(id_partida);
    await cargarPresupuesto(_presProyectoActual);
  } catch (e) { toast(e.message, 'error'); }
}

/* ── APU VIEWER ── */
async function presVerAPU(id_concepto) {
  openModal('Análisis de Precio Unitario', loading(), true);
  const canEdit = ['administrador','encargado'].includes(API.user.rol);
  try {
    const d = await API.get(`/api/partidas/conceptos/${id_concepto}/apu`);
    const { concepto, materiales, mano_obra, maquinaria, totales } = d;

    const renderTabla = (titulo, rows, cols, addBtn) => {
      if (!rows.length && !canEdit) return '';
      return `
        <div style="margin-bottom:16px;">
          <div style="font-weight:600;font-size:0.88rem;color:var(--text2);margin-bottom:8px;display:flex;justify-content:space-between;">
            <span>${titulo}</span>
            ${canEdit ? `<button class="btn-ghost btn-sm" onclick="${addBtn}">${addBtn.startsWith('apuAddMat') ? '+ Material' : addBtn.startsWith('apuAddMO') ? '+ Mano de Obra' : '+ Maquinaria'}</button>` : ''}
          </div>
          ${rows.length ? `<div class="table-wrap"><table>
            <thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(r => `<tr>${Object.values(r).slice(0,cols.length).map(v=>
              `<td style="font-size:0.82rem;">${typeof v === 'number' ? fmt(v) : (v||'—')}</td>`
            ).join('')}</tr>`).join('')}</tbody>
          </table></div>` : `<div style="font-size:0.82rem;color:var(--text2);padding:8px 0;">Sin registros.</div>`}
        </div>`;
    };

    const html = `
      <div style="background:var(--bg2);border-radius:8px;padding:16px;margin-bottom:16px;">
        <div style="font-weight:700;font-size:0.95rem;margin-bottom:4px;">${concepto.descripcion}</div>
        <div style="font-size:0.82rem;color:var(--text2);">Unidad: ${concepto.unidad} · Clave: ${concepto.clave||'—'}</div>
      </div>

      ${renderTabla('MATERIALES',
        materiales.map(m=>({desc:m.descripcion,und:m.unidad,cant:m.cantidad,pu:m.precio_unit,imp:parseFloat(m.importe)})),
        ['Descripción','Unidad','Cantidad','P.U.','Importe'],
        `apuAddMat(${id_concepto})`)}

      ${renderTabla('MANO DE OBRA',
        mano_obra.map(m=>({cat:m.categoria,rend:m.rendimiento,sal:m.salario_real,imp:parseFloat(m.importe)})),
        ['Categoría','Rendimiento','Salario real','Importe'],
        `apuAddMO(${id_concepto})`)}

      ${renderTabla('MAQUINARIA Y EQUIPO',
        maquinaria.map(m=>({desc:m.descripcion,rend:m.rendimiento,ch:m.costo_hora,imp:parseFloat(m.importe)})),
        ['Equipo','Hr/unidad','Costo/hora','Importe'],
        `apuAddMaq(${id_concepto})`)}

      <div class="stats-row" style="background:var(--bg2);border-radius:8px;padding:16px;">
        <div class="stat-box"><div class="stat-label">Materiales</div><div class="stat-value" style="color:var(--blue);font-size:1rem;">${fmt(totales.materiales)}</div></div>
        <div class="stat-box"><div class="stat-label">Mano de Obra</div><div class="stat-value" style="color:var(--green);font-size:1rem;">${fmt(totales.mano_obra)}</div></div>
        <div class="stat-box"><div class="stat-label">Herramienta (3%)</div><div class="stat-value" style="font-size:1rem;">${fmt(totales.herramienta)}</div></div>
        <div class="stat-box"><div class="stat-label">Maquinaria</div><div class="stat-value" style="font-size:1rem;">${fmt(totales.maquinaria)}</div></div>
        <div class="stat-box"><div class="stat-label" style="font-weight:700;">TOTAL APU</div><div class="stat-value" style="color:var(--accent);font-size:1.1rem;font-weight:700;">${fmt(totales.total_apu)}</div></div>
      </div>`;

    openModal(`APU — ${concepto.clave || concepto.descripcion.substring(0,30)}`, html, true);
  } catch (e) {
    openModal('Error', `<p style="color:var(--red)">${e.message}</p>`);
  }
}

/* ── GENERADOR ── */
async function presVerGenerador(id_concepto, titulo) {
  openModal(`Generador: ${titulo}`, loading(), true);
  const canEdit = ['administrador','encargado'].includes(API.user.rol);
  try {
    const d = await API.get(`/api/partidas/conceptos/${id_concepto}/generadores`);
    const { generadores, resumen } = d;
    const r = resumen || {};

    const html = `
      <div class="stats-row" style="margin-bottom:16px;">
        <div class="stat-box"><div class="stat-label">Contratada</div><div class="stat-value" style="color:var(--blue);">${fmtN(r.cantidad_contratada,3)}</div></div>
        <div class="stat-box"><div class="stat-label">Ejecutada</div><div class="stat-value" style="color:var(--green);">${fmtN(r.cantidad_ejecutada,3)}</div></div>
        <div class="stat-box"><div class="stat-label">Por ejecutar</div><div class="stat-value" style="color:var(--text);">${fmtN(r.cantidad_por_ejecutar,3)}</div></div>
        <div class="stat-box"><div class="stat-label">% Avance</div><div class="stat-value" style="color:var(--accent);">${fmtN(r.pct_avance,1)}%</div></div>
      </div>
      ${progressBar(r.pct_avance||0,'auto',false)}
      <div style="height:16px;"></div>
      ${generadores.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Estimación</th><th>Fecha</th><th>Descripción</th><th style="text-align:right;">Cantidad</th></tr></thead>
        <tbody>${generadores.map(g=>`<tr>
          <td>Est. ${g.numero_estimacion}</td>
          <td>${fmtDate(g.fecha_generador)}</td>
          <td>${g.descripcion||'—'}</td>
          <td style="text-align:right;">${fmtN(g.cantidad_periodo,3)}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : `<p style="color:var(--text2);font-size:0.85rem;">Sin cantidades registradas.</p>`}
      ${canEdit ? `
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
          <div style="font-weight:600;font-size:0.88rem;margin-bottom:10px;">Registrar nueva cantidad</div>
          <div class="form-row">
            <div class="form-group"><label>No. Estimación</label><input type="number" id="gen-num" min="1" placeholder="1"/></div>
            <div class="form-group"><label>Cantidad</label><input type="number" id="gen-cant" min="0" step="0.001" placeholder="0.000"/></div>
            <div class="form-group"><label>Fecha</label><input type="date" id="gen-fecha" value="${today()}"/></div>
          </div>
          <div class="form-group"><label>Descripción</label><input type="text" id="gen-desc" placeholder="Descripción del período"/></div>
          <button class="btn-primary" onclick="genSaveGenerador(${id_concepto})">Registrar</button>
        </div>` : ''}`;

    openModal(`Generador: ${titulo}`, html, true);
  } catch (e) { openModal('Error', `<p style="color:var(--red)">${e.message}</p>`); }
}

async function genSaveGenerador(id_concepto) {
  const numero_estimacion = parseInt($('gen-num').value);
  const cantidad_periodo  = parseFloat($('gen-cant').value);
  const fecha_generador   = $('gen-fecha').value;
  const descripcion       = $('gen-desc').value.trim();
  if (!numero_estimacion || isNaN(cantidad_periodo) || !fecha_generador)
    return toast('Completa los campos', 'error');
  try {
    await API.post(`/api/partidas/conceptos/${id_concepto}/generadores`, {
      numero_estimacion, cantidad_periodo, fecha_generador, descripcion
    });
    toast('Cantidad registrada', 'success');
    closeModal();
    await cargarPresupuesto(_presProyectoActual);
  } catch (e) { toast(e.message, 'error'); }
}

/* ── EXPLOSIÓN DE INSUMOS ── */
async function presVerExplosion(id) {
  openModal('Explosión de Insumos', loading(), true);
  try {
    const d = await API.get(`/api/partidas/proyecto/${id}/explosion`);
    const html = `
      <div style="font-size:0.85rem;color:var(--text2);margin-bottom:16px;">
        Cantidades totales requeridas por el presupuesto completo del proyecto.
      </div>
      <div style="font-weight:600;margin-bottom:8px;">MATERIALES</div>
      <div class="table-wrap" style="margin-bottom:20px;"><table>
        <thead><tr><th>Insumo</th><th>Unidad</th><th style="text-align:right;">Cantidad Total</th><th style="text-align:right;">Precio Ref.</th><th style="text-align:right;">Importe Est.</th></tr></thead>
        <tbody>${d.materiales.map(m=>`<tr>
          <td style="font-size:0.82rem;">${m.descripcion}</td>
          <td>${m.unidad}</td>
          <td style="text-align:right;">${fmtN(m.cantidad_total,3)}</td>
          <td style="text-align:right;">${fmt(m.precio_unit)}</td>
          <td style="text-align:right;font-weight:600;">${fmt(m.importe_total)}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div style="font-weight:600;margin-bottom:8px;">MANO DE OBRA</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Categoría</th><th>Unidad</th><th style="text-align:right;">Jornales Totales</th><th style="text-align:right;">Salario Real</th><th style="text-align:right;">Importe Est.</th></tr></thead>
        <tbody>${d.mano_obra.map(m=>`<tr>
          <td style="font-size:0.82rem;">${m.descripcion}</td>
          <td>${m.unidad}</td>
          <td style="text-align:right;">${fmtN(m.cantidad_total,2)}</td>
          <td style="text-align:right;">${fmt(m.precio_unit)}</td>
          <td style="text-align:right;font-weight:600;">${fmt(m.importe_total)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
    openModal('Explosión de Insumos', html, true);
  } catch (e) { openModal('Error', `<p style="color:var(--red)">${e.message}</p>`); }
}

async function apuAddMat(id_concepto) {
  let prodOpts = '';
  try {
    const prods = await API.get('/api/productos');
    prodOpts = prods.filter(p=>p.tipo_producto==='Material').map(p =>
      `<option value="${p.id_producto}" data-precio="${p.precio_referencia||0}">${p.descripcion} (${p.unidades})</option>`).join('');
  } catch(_) {}
  const html = `
    <div class="form-group"><label>Producto del inventario</label>
      <select id="am-prod" onchange="var o=this.options[this.selectedIndex];$('am-precio').value=o.dataset.precio||0;">
        <option value="">— Libre —</option>${prodOpts}
      </select></div>
    <div class="form-group"><label>Descripción *</label><input type="text" id="am-desc" placeholder="Descripción"/></div>
    <div class="form-row">
      <div class="form-group"><label>Unidad *</label><input type="text" id="am-und" placeholder="kg, m3..."/></div>
      <div class="form-group"><label>Cantidad *</label><input type="number" id="am-cant" step="0.0001" placeholder="0"/></div>
      <div class="form-group"><label>Precio unitario *</label><input type="number" id="am-precio" step="0.01" placeholder="0.00"/></div>
    </div>
    <div class="modal-footer" style="padding:0;border:none;margin-top:8px;">
      <button class="btn-ghost" onclick="presVerAPU(${id_concepto})">Cancelar</button>
      <button class="btn-primary" onclick="apuSaveMat(${id_concepto})">Agregar</button>
    </div>`;
  openModal('Agregar Material al APU', html);
}

async function apuSaveMat(id_concepto) {
  const id_producto = $('am-prod')?.value || null;
  const descripcion = $('am-desc').value.trim();
  const unidad      = $('am-und').value.trim();
  const cantidad    = parseFloat($('am-cant').value);
  const precio_unit = parseFloat($('am-precio').value);
  if (!descripcion || !unidad || isNaN(cantidad) || isNaN(precio_unit))
    return toast('Completa todos los campos', 'error');
  try {
    await API.post(`/api/partidas/conceptos/${id_concepto}/apu/material`,
      { id_producto: id_producto||null, descripcion, unidad, cantidad, precio_unit });
    toast('Material agregado al APU', 'success');
    presVerAPU(id_concepto);
  } catch (e) { toast(e.message, 'error'); }
}

async function presEditarPartida(id_partida, numero, nombre) {
  const html = `
    <div class="form-row">
      <div class="form-group" style="flex:0 0 100px;"><label>Número</label><input type="text" id="ep-num" value="${numero}"/></div>
      <div class="form-group" style="flex:1;"><label>Nombre</label><input type="text" id="ep-nombre" value="${nombre}"/></div>
    </div>
    <div class="modal-footer" style="padding:0;border:none;margin-top:8px;">
      <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn-primary" onclick="presUpdatePartida(${id_partida})">Guardar</button>
    </div>`;
  openModal('Editar partida', html);
}

async function presUpdatePartida(id_partida) {
  const numero = $('ep-num').value.trim();
  const nombre = $('ep-nombre').value.trim();
  if (!numero || !nombre) return toast('Número y nombre requeridos', 'error');
  try {
    await API.put(`/api/partidas/${id_partida}`, { numero, nombre });
    toast('Partida actualizada', 'success');
    closeModal();
    await cargarPresupuesto(_presProyectoActual);
  } catch (e) { toast(e.message, 'error'); }
}

/* ── P4: EDITAR CONCEPTO ── */
function presEditarConcepto(id_concepto) {
  const co = (window._conceptoEdit || {})[id_concepto];
  if (!co) return toast('Error al cargar concepto', 'error');
  const html = `
    <div class="form-row">
      <div class="form-group" style="flex:0 0 120px;"><label>Clave</label>
        <input type="text" id="ec-clave" value="${(co.clave||'').replace(/"/g,'&quot;')}"/></div>
      <div class="form-group" style="flex:1;"><label>Descripción *</label>
        <input type="text" id="ec-desc" value="${co.descripcion.replace(/"/g,'&quot;')}"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Unidad *</label>
        <input type="text" id="ec-unidad" value="${co.unidad}"/></div>
      <div class="form-group"><label>Cantidad *</label>
        <input type="number" id="ec-cantidad" value="${co.cantidad}" step="0.001"/></div>
      <div class="form-group"><label>Precio unitario *</label>
        <input type="number" id="ec-precio" value="${co.precio_unitario}" step="0.01"/></div>
    </div>
    <div style="background:var(--bg2);border-radius:8px;padding:12px;margin-bottom:8px;">
      <span style="font-size:0.82rem;color:var(--text2);">Importe: </span>
      <span id="ec-importe-prev" style="font-weight:700;color:var(--blue);">${fmt(co.importe)}</span>
    </div>
    <div class="modal-footer" style="padding:0;border:none;margin-top:8px;">
      <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn-primary" onclick="presUpdateConcepto(${id_concepto},${co._partida})">Guardar cambios</button>
    </div>`;
  openModal('Editar concepto', html, true);
  ['ec-cantidad','ec-precio'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', () => {
      const c = parseFloat($('ec-cantidad').value)||0;
      const p = parseFloat($('ec-precio').value)||0;
      $('ec-importe-prev').textContent = fmt(c * p);
    });
  });
}

async function presUpdateConcepto(id_concepto, id_partida) {
  const clave         = $('ec-clave').value.trim();
  const descripcion   = $('ec-desc').value.trim();
  const unidad        = $('ec-unidad').value.trim();
  const cantidad      = parseFloat($('ec-cantidad').value);
  const precio_unitario = parseFloat($('ec-precio').value);
  if (!descripcion || !unidad || isNaN(cantidad) || isNaN(precio_unitario))
    return toast('Completa todos los campos obligatorios', 'error');
  try {
    await API.put(`/api/partidas/conceptos/${id_concepto}`, { clave, descripcion, unidad, cantidad, precio_unitario });
    toast('Concepto actualizado', 'success');
    closeModal();
    await cargarConceptos(id_partida);
    await cargarPresupuesto(_presProyectoActual);
  } catch (e) { toast(e.message, 'error'); }
}

/* ── P3: APU MANO DE OBRA CON FASAR AUTOMÁTICO ── */
async function apuAddMO(id_concepto) {
  let fasarOpts = '';
  try {
    const proyecto = _presProyectos.find(p => p.id_proyecto == _presProyectoActual);
    const zona = proyecto?.zona || 'Centro';
    const fasar = await API.get(`/api/catalogo/fasar?zona=${zona}`);
    fasarOpts = fasar.map(f =>
      `<option value="${f.id_fasar}" data-salario="${f.salario_real}" data-cat="${f.categoria.replace(/"/g,'&quot;')}">
        ${f.categoria} — ${fmt(f.salario_real)}/día (FASAR ${f.factor} · ${zona})
      </option>`).join('');
  } catch(_) {}
  const html = `
    <div class="form-group">
      <label>Categoría FASAR — zona del proyecto (auto-rellena salario real)</label>
      <select id="mo-fasar" onchange="apuAutoFillMO(this)">
        <option value="">— Ingreso manual —</option>${fasarOpts}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1;"><label>Categoría *</label>
        <input type="text" id="mo-cat" placeholder="Maestro de obras, Oficial, Peón..."/></div>
      <div class="form-group" style="flex:0 0 130px;"><label>Rendimiento (h/u) *</label>
        <input type="number" id="mo-rend" step="0.001" placeholder="0.000"/></div>
      <div class="form-group" style="flex:0 0 140px;"><label>Salario real ($/día) *</label>
        <input type="number" id="mo-sal" step="0.01" placeholder="0.00"/></div>
    </div>
    <div class="modal-footer" style="padding:0;border:none;margin-top:8px;">
      <button class="btn-ghost" onclick="presVerAPU(${id_concepto})">Cancelar</button>
      <button class="btn-primary" onclick="apuSaveMO(${id_concepto})">Agregar</button>
    </div>`;
  openModal('Agregar Mano de Obra al APU', html);
}

function apuAutoFillMO(sel) {
  const opt = sel.options[sel.selectedIndex];
  if (!opt.value) return;
  $('mo-cat').value = opt.dataset.cat || '';
  $('mo-sal').value = opt.dataset.salario || '';
}

async function apuSaveMO(id_concepto) {
  const id_fasar     = $('mo-fasar')?.value || null;
  const categoria    = $('mo-cat').value.trim();
  const rendimiento  = parseFloat($('mo-rend').value);
  const salario_real = parseFloat($('mo-sal').value);
  if (!categoria || isNaN(rendimiento) || isNaN(salario_real))
    return toast('Completa todos los campos', 'error');
  try {
    await API.post(`/api/partidas/conceptos/${id_concepto}/apu/mano-obra`,
      { id_fasar: id_fasar||null, categoria, rendimiento, salario_real });
    toast('Mano de obra agregada al APU', 'success');
    presVerAPU(id_concepto);
  } catch (e) { toast(e.message, 'error'); }
}

/* ── APU MAQUINARIA ── */
function apuAddMaq(id_concepto) {
  const html = `
    <div class="form-group"><label>Descripción del equipo *</label>
      <input type="text" id="maq-desc" placeholder="Retroexcavadora, Compactadora, Camión de volteo..."/></div>
    <div class="form-row">
      <div class="form-group"><label>Rendimiento (hr/unidad) *</label>
        <input type="number" id="maq-rend" step="0.001" placeholder="0.000"/></div>
      <div class="form-group"><label>Costo por hora ($/hr) *</label>
        <input type="number" id="maq-ch" step="0.01" placeholder="0.00"/></div>
    </div>
    <div class="modal-footer" style="padding:0;border:none;margin-top:8px;">
      <button class="btn-ghost" onclick="presVerAPU(${id_concepto})">Cancelar</button>
      <button class="btn-primary" onclick="apuSaveMaq(${id_concepto})">Agregar</button>
    </div>`;
  openModal('Agregar Maquinaria y Equipo al APU', html);
}

async function apuSaveMaq(id_concepto) {
  const descripcion = $('maq-desc').value.trim();
  const rendimiento = parseFloat($('maq-rend').value);
  const costo_hora  = parseFloat($('maq-ch').value);
  if (!descripcion || isNaN(rendimiento) || isNaN(costo_hora))
    return toast('Completa todos los campos', 'error');
  try {
    await API.post(`/api/partidas/conceptos/${id_concepto}/apu/maquinaria`,
      { descripcion, rendimiento, costo_hora });
    toast('Maquinaria agregada al APU', 'success');
    presVerAPU(id_concepto);
  } catch (e) { toast(e.message, 'error'); }
}
