let _comprasProductos  = [];
let _comprasProyectos  = [];
let _compraItems = [];

async function renderCompras() {
  const content = $('page-content');
  const canEdit = ['administrador', 'encargado'].includes(API.user.rol);
  try {
    const compras = await API.get('/api/compras');
    content.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Compras</div>
          <div class="page-subtitle">${compras.length} registro(s)</div>
        </div>
        ${canEdit ? `<button class="btn-primary" onclick="showNuevaCompra()">+ Nueva compra</button>` : ''}
      </div>
      <div class="card">
        <div class="table-wrap">
          ${compras.length === 0 ? empty('Sin compras registradas') : `
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>Proyecto</th>
                <th>Total</th>
                <th>Materiales</th>
              </tr>
            </thead>
            <tbody>
              ${compras.map(c => `<tr>
                <td class="td-small">${c.id_compra}</td>
                <td>${fmtDate(c.fecha_compra)}</td>
                <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.nombre_obra}</td>
                <td><strong style="color:var(--accent)">${fmt(c.total_compra)}</strong></td>
                <td class="td-detail">${c.detalle || '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>`}
        </div>
      </div>`;
  } catch (e) {
    content.innerHTML = `<div class="alert alert-warn">${e.message}</div>`;
  }
}

async function showNuevaCompra() {
  openModal('Nueva compra', loading(), true);
  try {
    const [productos, proyectos] = await Promise.all([
      API.get('/api/productos'),
      API.get('/api/proyectos')
    ]);
    _comprasProductos = productos;
    _comprasProyectos = proyectos.filter(p => p.estado === 'activo');
    _compraItems = [];

    const optsProyecto = _comprasProyectos.map(p => `<option value="${p.id_proyecto}">${p.nombre_obra}</option>`).join('');
    const html = `
      <div class="form-row">
        <div class="form-group">
          <label>Proyecto *</label>
          <select id="c-proyecto">
            <option value="">— seleccionar —</option>
            ${optsProyecto}
          </select>
        </div>
        <div class="form-group">
          <label>Fecha de compra *</label>
          <input type="date" id="c-fecha" value="${today()}" />
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-weight:600;font-size:0.9rem;">Materiales</span>
        <button class="btn-ghost btn-sm" onclick="addItemCompra()">+ Agregar material</button>
      </div>

      <div class="table-wrap">
        <table class="items-table">
          <thead>
            <tr>
              <th style="width:45%">Producto</th>
              <th style="width:20%">Cantidad</th>
              <th style="width:22%">Precio unit. real</th>
              <th style="width:13%"></th>
            </tr>
          </thead>
          <tbody id="compra-items-body"></tbody>
        </table>
      </div>
      <div class="total-row" id="compra-total">Total: ${fmt(0)}</div>
      <div class="modal-footer" style="padding:0;border:none;margin-top:12px;">
        <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary" onclick="saveCompra()">Registrar compra</button>
      </div>`;
    openModal('Nueva compra', html, true);
    addItemCompra();
  } catch (e) { openModal('Error', `<p style="color:var(--red)">${e.message}</p>`); }
}

function addItemCompra() {
  const idx = _compraItems.length;
  _compraItems.push({ id_producto: '', cantidad: 1, precio_unitario_real: 0 });

  const opts = _comprasProductos.map(p =>
    `<option value="${p.id_producto}" data-precio="${p.precio_referencia || 0}">${p.descripcion} (${p.unidades})</option>`
  ).join('');

  const row = document.createElement('tr');
  row.id = `item-row-${idx}`;
  row.innerHTML = `
    <td>
      <select onchange="onProductoChange(${idx},this)">
        <option value="">— producto —</option>
        ${opts}
      </select>
    </td>
    <td><input type="number" id="c-qty-${idx}" min="1" step="1" value="1" oninput="calcTotalCompra()" /></td>
    <td><input type="number" id="c-price-${idx}" min="0" step="0.01" value="0" oninput="calcTotalCompra()" /></td>
    <td><button class="btn-remove-item" onclick="removeItemCompra(${idx})">×</button></td>`;

  document.getElementById('compra-items-body').appendChild(row);
}

function onProductoChange(idx, sel) {
  const precio = parseFloat(sel.selectedOptions[0]?.dataset.precio) || 0;
  const priceEl = $(`c-price-${idx}`);
  if (priceEl && precio > 0) priceEl.value = precio;
  _compraItems[idx].id_producto = sel.value;
  calcTotalCompra();
}

function removeItemCompra(idx) {
  const row = $(`item-row-${idx}`);
  if (row) row.remove();
  _compraItems[idx] = null;
  calcTotalCompra();
}

function calcTotalCompra() {
  let total = 0;
  _compraItems.forEach((_, idx) => {
    const qty   = parseFloat($(`c-qty-${idx}`)?.value) || 0;
    const price = parseFloat($(`c-price-${idx}`)?.value) || 0;
    total += qty * price;
  });
  const el = $('compra-total');
  if (el) el.textContent = 'Total: ' + fmt(total);
}

async function saveCompra() {
  const id_proyecto  = $('c-proyecto').value;
  const fecha_compra = $('c-fecha').value;
  if (!id_proyecto || !fecha_compra) return toast('Selecciona proyecto y fecha', 'error');

  const items = [];
  _compraItems.forEach((it, idx) => {
    if (!it) return;
    const sel   = document.querySelector(`#item-row-${idx} select`);
    const qty   = parseFloat($(`c-qty-${idx}`)?.value) || 0;
    const price = parseFloat($(`c-price-${idx}`)?.value) || 0;
    if (sel && sel.value && qty > 0 && price > 0) {
      items.push({ id_producto: parseInt(sel.value), cantidad: qty, precio_unitario_real: price });
    }
  });

  if (!items.length) return toast('Agrega al menos un material con cantidad y precio', 'error');

  try {
    const res = await API.post('/api/compras', { id_proyecto: parseInt(id_proyecto), fecha_compra, items });
    toast(`Compra registrada. Total: ${fmt(res.total)}`, 'success');
    closeModal();
    renderCompras();
  } catch (e) { toast(e.message, 'error'); }
}
