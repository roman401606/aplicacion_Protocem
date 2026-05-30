let _salidasProductos = [];
let _salidasProyectos = [];
let _salidaItems      = [];

async function renderSalidas() {
  const content = $('page-content');
  const canEdit = ['administrador', 'encargado'].includes(API.user.rol);
  try {
    const salidas = await API.get('/api/salidas');
    content.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Salidas de material</div>
          <div class="page-subtitle">${salidas.length} registro(s)</div>
        </div>
        ${canEdit ? `<button class="btn-primary" onclick="showNuevaSalida()">+ Nueva salida</button>` : ''}
      </div>
      <div class="card">
        <div class="table-wrap">
          ${salidas.length === 0 ? empty('Sin salidas registradas') : `
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>Proyecto</th>
                <th>Responsable</th>
                <th>Tipo</th>
                <th>Materiales</th>
              </tr>
            </thead>
            <tbody>
              ${salidas.map(s => `<tr>
                <td class="td-small">${s.id_salida}</td>
                <td>${fmtDate(s.fecha_salida)}</td>
                <td style="max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.nombre_obra}</td>
                <td>${s.responsable}</td>
                <td>${tipoSalidaBadge(s.tipo_salida)}</td>
                <td class="td-detail">${s.detalle || '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>`}
        </div>
      </div>`;
  } catch (e) {
    content.innerHTML = `<div class="alert alert-warn">${e.message}</div>`;
  }
}

async function showNuevaSalida() {
  openModal('Nueva salida de material', loading(), true);
  try {
    const [productos, proyectos] = await Promise.all([
      API.get('/api/productos'),
      API.get('/api/proyectos')
    ]);
    _salidasProductos = productos;
    _salidasProyectos = proyectos.filter(p => p.estado === 'activo');
    _salidaItems      = [];

    const optsProyecto = _salidasProyectos.map(p => `<option value="${p.id_proyecto}">${p.nombre_obra}</option>`).join('');
    const html = `
      <div class="form-row">
        <div class="form-group">
          <label>Proyecto *</label>
          <select id="s-proyecto">
            <option value="">— seleccionar —</option>
            ${optsProyecto}
          </select>
        </div>
        <div class="form-group">
          <label>Fecha *</label>
          <input type="date" id="s-fecha" value="${today()}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Responsable *</label>
          <input type="text" id="s-responsable" placeholder="Nombre del responsable" />
        </div>
        <div class="form-group">
          <label>Tipo de salida</label>
          <select id="s-tipo">
            <option value="consumo">Consumo</option>
            <option value="merma">Merma</option>
            <option value="robo">Robo</option>
            <option value="prestamo">Préstamo</option>
          </select>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-weight:600;font-size:0.9rem;">Materiales</span>
        <button class="btn-ghost btn-sm" onclick="addItemSalida()">+ Agregar material</button>
      </div>

      <div class="table-wrap">
        <table class="items-table">
          <thead>
            <tr>
              <th style="width:65%">Producto</th>
              <th style="width:25%">Cantidad</th>
              <th style="width:10%"></th>
            </tr>
          </thead>
          <tbody id="salida-items-body"></tbody>
        </table>
      </div>
      <div class="modal-footer" style="padding:0;border:none;margin-top:12px;">
        <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary" onclick="saveSalida()">Registrar salida</button>
      </div>`;
    openModal('Nueva salida de material', html, true);
    addItemSalida();
  } catch (e) { openModal('Error', `<p style="color:var(--red)">${e.message}</p>`); }
}

function addItemSalida() {
  const idx  = _salidaItems.length;
  _salidaItems.push({ id_producto: '', cantidad: 1 });

  const opts = _salidasProductos.map(p =>
    `<option value="${p.id_producto}">${p.descripcion} (stock: ${fmtN(p.stock,2)} ${p.unidades})</option>`
  ).join('');

  const row = document.createElement('tr');
  row.id = `salida-row-${idx}`;
  row.innerHTML = `
    <td>
      <select>
        <option value="">— producto —</option>
        ${opts}
      </select>
    </td>
    <td><input type="number" id="s-qty-${idx}" min="1" step="1" value="1" /></td>
    <td><button class="btn-remove-item" onclick="removeItemSalida(${idx})">×</button></td>`;

  document.getElementById('salida-items-body').appendChild(row);
}

function removeItemSalida(idx) {
  const row = $(`salida-row-${idx}`);
  if (row) row.remove();
  _salidaItems[idx] = null;
}

async function saveSalida() {
  const id_proyecto  = $('s-proyecto').value;
  const fecha_salida = $('s-fecha').value;
  const responsable  = $('s-responsable').value.trim();
  const tipo_salida  = $('s-tipo').value;

  if (!id_proyecto || !fecha_salida || !responsable) {
    return toast('Completa todos los campos obligatorios', 'error');
  }

  const items = [];
  _salidaItems.forEach((it, idx) => {
    if (!it) return;
    const sel = document.querySelector(`#salida-row-${idx} select`);
    const qty = parseFloat($(`s-qty-${idx}`)?.value) || 0;
    if (sel && sel.value && qty > 0) {
      items.push({ id_producto: parseInt(sel.value), cantidad: qty });
    }
  });

  if (!items.length) return toast('Agrega al menos un material con cantidad', 'error');

  try {
    await API.post('/api/salidas', {
      id_proyecto: parseInt(id_proyecto),
      fecha_salida,
      responsable,
      tipo_salida,
      items
    });
    toast('Salida registrada correctamente', 'success');
    closeModal();
    renderSalidas();
  } catch (e) { toast(e.message, 'error'); }
}
