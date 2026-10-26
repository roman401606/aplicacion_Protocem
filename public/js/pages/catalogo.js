/* ===== PÁGINA: CATÁLOGO OPUS (CMIC / BIMSA) ===== */

async function renderCatalogo() {
  const content = $('page-content');
  const isAdmin = API.user.rol === 'administrador';
  try {
    const [especialidades, fasar] = await Promise.all([
      API.get('/api/catalogo/especialidades'),
      API.get('/api/catalogo/fasar?zona=Centro')
    ]);

    content.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Catálogo OPUS</div>
          <div class="page-subtitle">Conceptos de referencia CMIC 2024 y BIMSA 2025</div>
        </div>
        ${isAdmin ? `<button class="btn-primary" onclick="catNuevoConcepto()">+ Agregar concepto</button>` : ''}
      </div>

      <!-- Tabs -->
      <div style="display:flex;gap:8px;margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:0;">
        <button class="btn-ghost" id="tab-conceptos" onclick="catTab('conceptos')"
          style="border-bottom:2px solid var(--accent);border-radius:0;padding-bottom:12px;">Conceptos</button>
        <button class="btn-ghost" id="tab-fasar" onclick="catTab('fasar')"
          style="border-bottom:2px solid transparent;border-radius:0;padding-bottom:12px;">FASAR</button>
      </div>

      <!-- Panel conceptos -->
      <div id="cat-panel-conceptos">
        <!-- Filtros -->
        <div class="card" style="margin-bottom:16px;">
          <div class="card-body">
            <div class="form-row" style="gap:12px;align-items:flex-end;">
              <div class="form-group" style="flex:1;margin:0;">
                <label>Buscar</label>
                <input type="text" id="cat-q" placeholder="Clave o descripción..." oninput="catFiltrar()"/>
              </div>
              <div class="form-group" style="margin:0;">
                <label>Especialidad</label>
                <select id="cat-esp" onchange="catFiltrar()">
                  <option value="">Todas</option>
                  ${especialidades.map(e=>`<option value="${e.especialidad}">${e.especialidad} (${e.num_conceptos})</option>`).join('')}
                </select>
              </div>
              <div class="form-group" style="margin:0;">
                <label>Fuente</label>
                <select id="cat-fuente" onchange="catFiltrar()">
                  <option value="">Todas</option>
                  <option value="CMIC">CMIC</option>
                  <option value="BIMSA">BIMSA</option>
                  <option value="Libre">Libre</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div id="cat-tabla">${loading()}</div>
      </div>

      <!-- Panel FASAR -->
      <div id="cat-panel-fasar" style="display:none;">
        <div class="card" style="margin-bottom:16px;">
          <div class="card-body">
            <div class="form-group" style="max-width:200px;margin:0;">
              <label>Zona</label>
              <select id="fasar-zona" onchange="catCargarFasar(this.value)">
                <option value="Centro">Centro</option>
                <option value="Sur">Sur</option>
                <option value="Norte">Norte</option>
              </select>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Factores de Salario Real — BIMSA 2025</span></div>
          <div id="fasar-tabla">
            ${renderFasarTabla(fasar)}
          </div>
        </div>
        <div style="margin-top:16px;padding:16px;background:var(--bg2);border-radius:8px;font-size:0.82rem;color:var(--text2);">
          <strong>¿Qué es el FASAR?</strong> El Factor de Salario Real convierte el salario base tabulado al costo real para el contratista, incluyendo: IMSS patronal (~32%), INFONAVIT (5%), SAR/Afore (2%), vacaciones, prima vacacional, aguinaldo, días festivos y días de lluvia. Es el estándar del catálogo BIMSA para el cálculo de mano de obra en APUs.
        </div>
      </div>`;

    await catFiltrar();
  } catch (e) {
    content.innerHTML = `<div class="alert alert-warn">${e.message}</div>`;
  }
}

function catTab(tab) {
  ['conceptos','fasar'].forEach(t => {
    const panel = $(`cat-panel-${t}`);
    const btn   = $(`tab-${t}`);
    if (panel) panel.style.display = t === tab ? 'block' : 'none';
    if (btn) btn.style.borderBottomColor = t === tab ? 'var(--accent)' : 'transparent';
  });
}

const _CAT_LIMIT = 100;
let _catOffset = 0;
let _catTotal  = 0;

function _catRow(r) {
  return `<tr>
    <td><span style="font-size:0.75rem;font-weight:700;color:var(--accent);">${r.clave}</span></td>
    <td style="font-size:0.82rem;max-width:280px;white-space:normal;">${r.descripcion}</td>
    <td>${r.unidad}</td>
    <td style="text-align:right;font-weight:600;">${fmt(r.precio_ref)}</td>
    <td>${badge('badge-blue', r.especialidad)}</td>
    <td>${badge(r.fuente==='CMIC'?'badge-orange':'badge-green', r.fuente)}</td>
    <td style="font-size:0.78rem;color:var(--text2);">${r.año_catalogo}</td>
  </tr>`;
}

async function catFiltrar(reset = true) {
  if (reset) _catOffset = 0;
  const q      = $('cat-q')?.value || '';
  const esp    = $('cat-esp')?.value || '';
  const fuente = $('cat-fuente')?.value || '';
  const tabla  = $('cat-tabla');
  if (!tabla) return;

  if (reset) tabla.innerHTML = loading();

  try {
    let url = `/api/catalogo?limit=${_CAT_LIMIT}&offset=${_catOffset}`;
    if (q)      url += `&q=${encodeURIComponent(q)}`;
    if (esp)    url += `&especialidad=${encodeURIComponent(esp)}`;
    if (fuente) url += `&fuente=${encodeURIComponent(fuente)}`;

    const { rows, total } = await API.get(url);
    _catTotal = total;

    if (reset) {
      if (!rows.length) {
        tabla.innerHTML = empty(`Sin conceptos${esp ? ' en '+esp : ''}${q ? ' para "'+q+'"' : ''}`);
        return;
      }
      tabla.innerHTML = `
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Clave</th><th>Descripción</th><th>Unidad</th>
              <th style="text-align:right;">P.U. Ref.</th><th>Especialidad</th><th>Fuente</th><th>Año</th>
            </tr></thead>
            <tbody id="cat-tbody">${rows.map(_catRow).join('')}</tbody>
          </table>
        </div>
        <div id="cat-footer" style="padding:8px 16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
          <span style="font-size:0.78rem;color:var(--text2);" id="cat-count">${rows.length} de ${total} concepto(s)</span>
          ${rows.length < total ? `<button class="btn-ghost btn-sm" onclick="catCargarMas()" id="btn-cat-mas">Cargar más (${total - rows.length} restantes)</button>` : ''}
        </div>`;
    } else {
      const tbody = $('cat-tbody');
      if (tbody) tbody.insertAdjacentHTML('beforeend', rows.map(_catRow).join(''));
      const loaded = _catOffset + rows.length;
      const countEl = $('cat-count');
      if (countEl) countEl.textContent = `${loaded} de ${total} concepto(s)`;
      const btnMas = $('btn-cat-mas');
      if (btnMas) {
        if (loaded >= total) btnMas.remove();
        else btnMas.textContent = `Cargar más (${total - loaded} restantes)`;
      }
    }
    _catOffset += rows.length;
  } catch (e) {
    if (reset) tabla.innerHTML = `<div style="padding:16px;color:var(--red);">Error: ${e.message}</div>`;
  }
}

async function catCargarMas() {
  const btn = $('btn-cat-mas');
  if (btn) { btn.disabled = true; btn.textContent = 'Cargando…'; }
  await catFiltrar(false);
  const btnUpdated = $('btn-cat-mas');
  if (btnUpdated) btnUpdated.disabled = false;
}

async function catCargarFasar(zona) {
  const tabla = $('fasar-tabla');
  tabla.innerHTML = loading();
  try {
    const rows = await API.get(`/api/catalogo/fasar?zona=${zona}`);
    tabla.innerHTML = renderFasarTabla(rows);
  } catch (e) {
    tabla.innerHTML = `<div style="padding:16px;color:var(--red);">Error: ${e.message}</div>`;
  }
}

function renderFasarTabla(rows) {
  if (!rows.length) return `<div style="padding:20px;color:var(--text2);">Sin datos FASAR</div>`;
  return `<div class="table-wrap"><table>
    <thead><tr>
      <th>Categoría</th><th style="text-align:right;">Salario base ($/día)</th>
      <th style="text-align:right;">Factor FASAR</th><th style="text-align:right;">Salario real ($/día)</th>
      <th>Zona</th><th>Vigencia</th>
    </tr></thead>
    <tbody>${rows.map(f=>`<tr>
      <td style="font-weight:600;">${f.categoria}</td>
      <td style="text-align:right;">${fmt(f.salario_base)}</td>
      <td style="text-align:right;color:var(--accent);font-weight:600;">${f.factor}</td>
      <td style="text-align:right;font-weight:700;color:var(--green);">${fmt(f.salario_real)}</td>
      <td>${badge('badge-blue', f.zona)}</td>
      <td style="font-size:0.78rem;color:var(--text2);">${f.vigencia}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

async function catNuevoConcepto() {
  const html = `
    <div class="form-row">
      <div class="form-group" style="flex:0 0 120px;"><label>Clave *</label><input type="text" id="nc-clave" placeholder="PRE-01"/></div>
      <div class="form-group" style="flex:1;"><label>Descripción *</label><input type="text" id="nc-desc" placeholder="Descripción detallada"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Unidad *</label><input type="text" id="nc-unidad" placeholder="m2, m3, ml..."/></div>
      <div class="form-group"><label>Precio referencia</label><input type="number" id="nc-precio" step="0.01" placeholder="0.00"/></div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Especialidad *</label>
        <select id="nc-esp">
          <option value="Preliminares">Preliminares</option>
          <option value="Obra Civil">Obra Civil</option>
          <option value="Edificación">Edificación</option>
          <option value="Hidráulica">Hidráulica</option>
          <option value="Eléctrico">Eléctrico</option>
          <option value="Aire Acondicionado">Aire Acondicionado</option>
          <option value="Infraestructura">Infraestructura</option>
          <option value="Industrial">Industrial</option>
        </select>
      </div>
      <div class="form-group">
        <label>Fuente</label>
        <select id="nc-fuente"><option value="Libre">Libre</option><option value="CMIC">CMIC</option><option value="BIMSA">BIMSA</option></select>
      </div>
      <div class="form-group"><label>Año</label><input type="number" id="nc-año" value="2025" min="2020" max="2030"/></div>
    </div>
    <div class="modal-footer" style="padding:0;border:none;margin-top:8px;">
      <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn-primary" onclick="catSaveConcepto()">Agregar al catálogo</button>
    </div>`;
  openModal('Nuevo concepto al catálogo', html, true);
}

async function catSaveConcepto() {
  const clave       = $('nc-clave').value.trim();
  const descripcion = $('nc-desc').value.trim();
  const unidad      = $('nc-unidad').value.trim();
  const precio_ref  = parseFloat($('nc-precio').value) || null;
  const especialidad = $('nc-esp').value;
  const fuente      = $('nc-fuente').value;
  const año_catalogo = parseInt($('nc-año').value);
  if (!clave || !descripcion || !unidad) return toast('Completa los campos obligatorios', 'error');
  try {
    await API.post('/api/catalogo', { clave, descripcion, unidad, precio_ref, especialidad, fuente, año_catalogo, zona:'Nacional' });
    toast('Concepto agregado al catálogo', 'success');
    closeModal();
    catFiltrar();
  } catch (e) { toast(e.message, 'error'); }
}
