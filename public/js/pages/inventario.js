async function renderInventario() {
  const content = $('page-content');
  const isAdmin = API.user.rol === 'administrador';
  try {
    const productos = await API.get('/api/productos');
    const sinStock  = productos.filter(p => p.stock === 0).length;
    const criticos  = productos.filter(p => p.stock > 0 && p.stock < 10).length;

    content.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Inventario</div>
          <div class="page-subtitle">${productos.length} producto(s) · ${sinStock} sin stock · ${criticos} crítico(s)</div>
        </div>
        ${isAdmin ? `<button class="btn-primary" onclick="showNuevoProducto()">+ Nuevo producto</button>` : ''}
      </div>
      <div class="card">
        <div class="table-wrap">
          ${productos.length === 0 ? empty('Sin productos') : `
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Descripción</th>
                <th>Tipo</th>
                <th>Unidad</th>
                <th>Stock</th>
                <th>Precio ref.</th>
                <th>Último real</th>
                <th>Cotiz. ref.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${productos.map(p => {
                let stockClass = 'stock-ok';
                let stockBadge = '';
                if (p.stock === 0) { stockClass = 'stock-low'; stockBadge = badge('badge-red','agotado'); }
                else if (p.stock < 10)  { stockClass = 'stock-low';  stockBadge = badge('badge-red','crítico'); }
                else if (p.stock < 50)  { stockClass = 'stock-mid';  stockBadge = badge('badge-yellow','bajo'); }

                const esCritico = p.stock === 0 || p.stock < 10;
                return `<tr>
                  <td class="td-small">${p.id_producto}</td>
                  <td style="font-weight:500">${p.descripcion}</td>
                  <td class="td-small">${p.tipo_producto || '—'}</td>
                  <td class="td-small">${p.unidades}</td>
                  <td>
                    <span class="${stockClass}">${fmtN(p.stock, 2)}</span>
                    ${stockBadge ? ' ' + stockBadge : ''}
                  </td>
                  <td>${p.precio_referencia ? fmt(p.precio_referencia) : '—'}</td>
                  <td>${p.precio_ultimo_real ? fmt(p.precio_ultimo_real) : '—'}</td>
                  <td>${p.precio_cotizado_ref ? fmt(p.precio_cotizado_ref) : '—'}</td>
                  <td style="white-space:nowrap;">
                    ${esCritico ? `<button class="btn-ghost btn-sm" onclick="navigate('cotizaciones')" style="font-size:0.72rem;padding:3px 8px;border:1px solid var(--accent);color:var(--accent);">Cotizar ahora</button>` : ''}
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>`}
        </div>
      </div>`;
  } catch (e) {
    content.innerHTML = `<div class="alert alert-warn">${e.message}</div>`;
  }
}

function showNuevoProducto() {
  const html = `
    <div class="form-group">
      <label>Descripción *</label>
      <input type="text" id="prod-desc" placeholder="Cemento Portland gris 50kg" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Tipo de producto</label>
        <input type="text" id="prod-tipo" placeholder="Cemento, Acero, Agregado..." />
      </div>
      <div class="form-group">
        <label>Unidades *</label>
        <input type="text" id="prod-unidades" placeholder="bulto, kg, m3, pieza..." />
      </div>
    </div>
    <div class="form-group">
      <label>Precio de referencia (MXN)</label>
      <input type="number" id="prod-precio" min="0" step="0.01" placeholder="0.00" />
    </div>
    <div class="modal-footer" style="padding:0;border:none;margin-top:8px;">
      <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn-primary" onclick="saveProducto()">Crear producto</button>
    </div>`;
  openModal('Nuevo producto', html);
}

async function saveProducto() {
  const descripcion      = $('prod-desc').value.trim();
  const tipo_producto    = $('prod-tipo').value.trim();
  const unidades         = $('prod-unidades').value.trim();
  const precio_referencia = parseFloat($('prod-precio').value) || null;

  if (!descripcion || !unidades) return toast('Descripción y unidades son obligatorios', 'error');

  try {
    await API.post('/api/productos', { descripcion, tipo_producto, unidades, precio_referencia });
    toast('Producto creado', 'success');
    closeModal();
    renderInventario();
  } catch (e) { toast(e.message, 'error'); }
}
