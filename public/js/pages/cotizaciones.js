async function renderCotizaciones() {
  const content = $('page-content');
  const canEdit = ['administrador', 'encargado'].includes(API.user.rol);
  try {
    const rows = await API.get('/api/cotizaciones');

    const conDesv   = rows.filter(r => r.desviacion_pct != null);
    const maxDesv   = conDesv.length ? conDesv.reduce((a, b) => b.desviacion_pct > a.desviacion_pct ? b : a) : null;
    const minDesv   = conDesv.length ? conDesv.reduce((a, b) => b.desviacion_pct < a.desviacion_pct ? b : a) : null;
    const avgDesv   = conDesv.length ? (conDesv.reduce((s, r) => s + r.desviacion_pct, 0) / conDesv.length).toFixed(1) : null;

    const maxColor  = maxDesv && maxDesv.desviacion_pct > 15 ? 'red' : maxDesv && maxDesv.desviacion_pct > 5 ? 'purple' : 'green';
    const minColor  = minDesv && minDesv.desviacion_pct <= 0 ? 'green' : 'blue';

    content.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Cotizaciones</div>
          <div class="page-subtitle">${rows.length} registro(s)</div>
        </div>
        ${canEdit ? `<button class="btn-primary" onclick="showNuevaCot()">+ Nueva cotización</button>` : ''}
      </div>

      <!-- Dashboard resumen -->
      <div class="kpi-grid" style="margin-bottom:20px;">
        <div class="kpi-card blue">
          <div class="kpi-label">Total cotizaciones</div>
          <div class="kpi-value">${rows.length}</div>
          <div class="kpi-sub">${conDesv.length} con datos de precio real</div>
        </div>
        <div class="kpi-card ${conDesv.filter(r => r.desviacion_pct > 5).length > 0 ? 'red' : 'green'}">
          <div class="kpi-label">Con sobrecosto</div>
          <div class="kpi-value">${conDesv.filter(r => r.desviacion_pct > 5).length}</div>
          <div class="kpi-sub">precio real &gt;5% sobre cotizado</div>
        </div>
        <div class="kpi-card ${maxColor}">
          <div class="kpi-label">Mayor alza de precio</div>
          <div class="kpi-value">${maxDesv ? (maxDesv.desviacion_pct > 0 ? '+' : '') + maxDesv.desviacion_pct + '%' : '—'}</div>
          <div class="kpi-sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;" title="${maxDesv ? maxDesv.producto : ''}">${maxDesv ? maxDesv.producto : 'Sin datos'}</div>
        </div>
        <div class="kpi-card ${minColor}">
          <div class="kpi-label">Menor desviación</div>
          <div class="kpi-value">${minDesv ? (minDesv.desviacion_pct > 0 ? '+' : '') + minDesv.desviacion_pct + '%' : '—'}</div>
          <div class="kpi-sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;" title="${minDesv ? minDesv.producto : ''}">${minDesv ? minDesv.producto : 'Sin datos'}</div>
        </div>
      </div>

      <!-- Tabla principal -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Registro de cotizaciones</span>
          ${avgDesv != null ? `<span style="font-size:0.8rem;color:var(--text2);">Desviación promedio: <strong style="color:${avgDesv > 10 ? 'var(--red)' : avgDesv > 5 ? '#f59e0b' : 'var(--green)'}">${avgDesv > 0 ? '+' : ''}${avgDesv}%</strong></span>` : ''}
        </div>
        <div class="table-wrap">
          ${rows.length === 0 ? empty('Sin cotizaciones registradas') : `
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Material</th>
                <th>Proveedor</th>
                <th>Precio cotizado</th>
                <th>Precio real prom.</th>
                <th>Desviación</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(c => `<tr>
                <td>${fmtDate(c.fecha_cotizacion)}</td>
                <td style="font-weight:500">${c.producto}</td>
                <td>${c.proveedor}${c.empresa ? ' — ' + c.empresa : ''}</td>
                <td>${fmt(c.precio_cotizado)}</td>
                <td>${c.precio_real_promedio ? fmt(c.precio_real_promedio) : '—'}</td>
                <td>${desvBadge(c.desviacion_pct)}</td>
              </tr>`).join('')}
            </tbody>
          </table>`}
        </div>
      </div>

      <!-- Precios de referencia OPUS -->
      <div class="card" style="margin-top:20px;">
        <div class="card-header">
          <span class="card-title">Precios de referencia OPUS</span>
          <span class="badge badge-blue">Catálogo BIMSA / CMIC</span>
        </div>
        <div id="opus-cot-body">${loading()}</div>
      </div>`;

    cotCargarOpus();
  } catch (e) {
    content.innerHTML = `<div class="alert alert-warn">${e.message}</div>`;
  }
}

async function cotCargarOpus() {
  const body = $('opus-cot-body');
  if (!body) return;
  try {
    const data = await API.get('/api/cotizaciones/catalogo');
    if (!data.rows || !data.rows.length) {
      body.innerHTML = `<div style="padding:16px;color:var(--text2);font-size:0.85rem;">Sin precios de referencia OPUS en la base de datos. Ejecuta el script <code>import-opus.js</code> para cargarlos.</div>`;
      return;
    }
    body.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Clave</th>
              <th>Descripción / Material</th>
              <th>Unidad</th>
              <th style="text-align:right;">P.U. Ref.</th>
              <th>Especialidad</th>
              <th>Fuente</th>
              <th>Año</th>
            </tr>
          </thead>
          <tbody>
            ${data.rows.map(r => `<tr>
              <td><span style="font-size:0.75rem;font-weight:700;color:var(--accent);">${r.clave}</span></td>
              <td style="font-size:0.82rem;max-width:280px;white-space:normal;">${r.descripcion}</td>
              <td class="td-small">${r.unidad}</td>
              <td style="text-align:right;font-weight:600;">${fmt(r.precio_ref)}</td>
              <td>${badge('badge-blue', r.especialidad)}</td>
              <td>${badge(r.fuente === 'CMIC' ? 'badge-orange' : 'badge-green', r.fuente)}</td>
              <td style="font-size:0.78rem;color:var(--text2);">${r.año_catalogo}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="padding:8px 16px;font-size:0.78rem;color:var(--text2);">${data.rows.length} referencia(s) del catálogo OPUS${data.total > data.rows.length ? ` · mostrando ${data.rows.length} de ${data.total}` : ''}</div>`;
  } catch (e) {
    body.innerHTML = `<div style="padding:16px;color:var(--text2);font-size:0.85rem;">No se pudo cargar datos OPUS: ${e.message}</div>`;
  }
}

async function showNuevaCot() {
  openModal('Nueva cotización', loading(), false);
  try {
    const [productos, proveedores] = await Promise.all([
      API.get('/api/productos'),
      API.get('/api/proveedores')
    ]);
    const html = `
      <div class="form-group">
        <label>Material *</label>
        <select id="cot-prod">
          <option value="">— seleccionar —</option>
          ${productos.map(p => `<option value="${p.id_producto}">${p.descripcion} (${p.unidades})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Proveedor *</label>
        <select id="cot-prov">
          <option value="">— seleccionar —</option>
          ${proveedores.map(p => `<option value="${p.id_proveedor}">${p.nombre}${p.empresa ? ' — ' + p.empresa : ''}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Fecha *</label>
          <input type="date" id="cot-fecha" value="${today()}" />
        </div>
        <div class="form-group">
          <label>Precio cotizado (MXN) *</label>
          <input type="number" id="cot-precio" min="0" step="0.01" placeholder="0.00" />
        </div>
      </div>
      <div class="modal-footer" style="padding:0;border:none;margin-top:8px;">
        <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary" onclick="saveCot()">Guardar</button>
      </div>`;
    openModal('Nueva cotización', html);
  } catch (e) {
    openModal('Error', `<p style="color:var(--red)">${e.message}</p>`);
  }
}

async function saveCot() {
  const id_producto      = $('cot-prod').value;
  const id_proveedor     = $('cot-prov').value;
  const fecha_cotizacion = $('cot-fecha').value;
  const precio_cotizado  = parseFloat($('cot-precio').value);

  if (!id_producto || !id_proveedor) return toast('Selecciona material y proveedor', 'error');
  if (!fecha_cotizacion) return toast('La fecha es obligatoria', 'error');
  if (!precio_cotizado)  return toast('El precio es obligatorio', 'error');

  try {
    await API.post('/api/cotizaciones', { id_producto, id_proveedor, fecha_cotizacion, precio_cotizado });
    closeModal();
    toast('Cotización registrada', 'success');
    renderCotizaciones();
  } catch (e) { toast(e.message, 'error'); }
}
