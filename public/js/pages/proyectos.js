async function renderProyectos() {
  const content = $('page-content');
  const isAdmin = API.user.rol === 'administrador';
  const canEdit = ['administrador', 'encargado'].includes(API.user.rol);
  try {
    const proyectos = await API.get('/api/proyectos');
    const activos    = proyectos.filter(p => p.estado === 'activo');
    const otros      = proyectos.filter(p => p.estado !== 'activo');

    content.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Proyectos</div>
          <div class="page-subtitle">${proyectos.length} obra(s) registradas</div>
        </div>
        ${isAdmin ? `<button class="btn-primary" onclick="showNuevoProyecto()">+ Nuevo proyecto</button>` : ''}
      </div>
      <div id="lista-proyectos">
        ${proyectos.length === 0 ? empty('Sin proyectos registrados') : ''}
        ${activos.map(p => renderProyectoCard(p, canEdit, isAdmin)).join('')}
        ${otros.map(p => renderProyectoCard(p, canEdit, isAdmin)).join('')}
      </div>`;
  } catch (e) {
    content.innerHTML = `<div class="alert alert-warn">${e.message}</div>`;
  }
}

function renderProyectoCard(p, canEdit, isAdmin) {
  const pctUsado = p.presupuesto > 0
    ? Math.min(100, (p.gasto_acumulado / p.presupuesto) * 100).toFixed(1)
    : 0;
  const colorFisico = p.porcentaje_avance >= 100 ? 'green' : 'accent';
  const colorGasto  = pctUsado > 90 ? 'red' : pctUsado > 70 ? 'yellow' : 'blue';

  return `<div class="proyecto-card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
      <div class="proyecto-title">${p.nombre_obra}</div>
      ${estadoBadge(p.estado)}
    </div>
    <div class="proyecto-meta">
      <div class="proyecto-meta-item">Responsable: <strong>${p.nombre_usuario || '—'}</strong></div>
      <div class="proyecto-meta-item">Inicio: <strong>${fmtDate(p.fecha_inicio)}</strong></div>
      <div class="proyecto-meta-item">Fin est.: <strong>${fmtDate(p.fecha_fin_estimada)}</strong></div>
    </div>
    <div class="stats-row">
      <div class="stat-box">
        <div class="stat-label">Presupuesto</div>
        <div class="stat-value" style="color:var(--blue)">${fmt(p.presupuesto)}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Gastado</div>
        <div class="stat-value" style="color:${pctUsado > 90 ? 'var(--red)' : 'var(--accent)'}">${fmt(p.gasto_acumulado)}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Saldo</div>
        <div class="stat-value" style="color:${p.saldo_restante < 0 ? 'var(--red)' : 'var(--green)'}">${fmt(p.saldo_restante)}</div>
      </div>
    </div>
    <div style="margin-bottom:6px;">
      <div style="font-size:0.75rem;color:var(--text2);margin-bottom:4px;">Avance físico: <strong style="color:var(--text)">${fmtN(p.porcentaje_avance,1)}%</strong></div>
      ${progressBar(p.porcentaje_avance, colorFisico, false)}
    </div>
    <div>
      <div style="font-size:0.75rem;color:var(--text2);margin-bottom:4px;">Presupuesto usado: <strong style="color:var(--text)">${pctUsado}%</strong></div>
      ${progressBar(pctUsado, colorGasto, false)}
    </div>
    <div class="proyecto-actions">
      <button class="btn-ghost btn-sm" onclick="showDetalleProyecto(${p.id_proyecto})">Ver detalle</button>
      ${canEdit ? `<button class="btn-primary btn-sm" onclick="showAvanceModal(${p.id_proyecto},'${p.nombre_obra.replace(/'/g,"\\'")}',${p.porcentaje_avance},'${p.estado}')">Actualizar avance</button>` : ''}
      ${isAdmin ? `<button class="btn-danger btn-sm" onclick="confirmarEliminarProyecto(${p.id_proyecto},'${p.nombre_obra.replace(/'/g,"\\'")}')">Eliminar</button>` : ''}
    </div>
  </div>`;
}

async function showDetalleProyecto(id) {
  openModal('Detalle de proyecto', loading());
  try {
    const d = await API.get('/api/proyectos/' + id);
    const p = d.proyecto;
    const html = `
      <div style="margin-bottom:16px;">
        <div style="font-size:1.05rem;font-weight:700;margin-bottom:4px;">${p.nombre_obra}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${estadoBadge(p.estado)}
          <span style="font-size:0.82rem;color:var(--text2);">Responsable: ${p.nombre_usuario}</span>
        </div>
      </div>
      <div class="stats-row" style="margin-bottom:16px;">
        <div class="stat-box">
          <div class="stat-label">Presupuesto</div>
          <div class="stat-value" style="color:var(--blue)">${fmt(p.presupuesto)}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Gasto acumulado</div>
          <div class="stat-value" style="color:var(--accent)">${fmt(p.gasto_acumulado)}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Saldo</div>
          <div class="stat-value" style="color:${p.saldo_restante < 0 ? 'var(--red)' : 'var(--green)'}">${fmt(p.saldo_restante)}</div>
        </div>
      </div>

      <div style="margin-bottom:20px;">
        <div style="font-size:0.8rem;color:var(--text2);margin-bottom:6px;">Avance físico: ${fmtN(p.porcentaje_avance,1)}%</div>
        ${progressBar(p.porcentaje_avance, 'accent', false)}
      </div>

      <div style="font-weight:600;margin-bottom:8px;font-size:0.9rem;">Últimas compras</div>
      ${d.compras.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Fecha</th><th>Total</th><th>Detalle</th></tr></thead>
        <tbody>${d.compras.map(c => `<tr>
          <td>${fmtDate(c.fecha_compra)}</td>
          <td><strong>${fmt(c.total_compra)}</strong></td>
          <td class="td-detail">${c.detalle || '—'}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : `<p style="color:var(--text2);font-size:0.85rem;">Sin compras registradas</p>`}

      <div style="font-weight:600;margin:16px 0 8px;font-size:0.9rem;">Últimas salidas</div>
      ${d.salidas.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Fecha</th><th>Responsable</th><th>Tipo</th><th>Detalle</th></tr></thead>
        <tbody>${d.salidas.map(s => `<tr>
          <td>${fmtDate(s.fecha_salida)}</td>
          <td>${s.responsable}</td>
          <td>${tipoSalidaBadge(s.tipo_salida)}</td>
          <td class="td-detail">${s.detalle || '—'}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : `<p style="color:var(--text2);font-size:0.85rem;">Sin salidas registradas</p>`}`;
    openModal('Detalle: ' + p.nombre_obra, html, true);
  } catch (e) {
    openModal('Error', `<p style="color:var(--red)">${e.message}</p>`);
  }
}

function showAvanceModal(id, nombre, avance, estado) {
  const html = `
    <div class="form-group">
      <label>Porcentaje de avance físico</label>
      <input type="number" id="f-avance" min="0" max="100" step="0.5" value="${avance}" />
    </div>
    <div class="form-group">
      <label>Estado</label>
      <select id="f-estado">
        <option value="activo"    ${estado==='activo' ? 'selected':''}>Activo</option>
        <option value="pausado"   ${estado==='pausado' ? 'selected':''}>Pausado</option>
        <option value="finalizado"${estado==='finalizado' ? 'selected':''}>Finalizado</option>
      </select>
    </div>
    <div class="modal-footer" style="padding:0;border:none;margin-top:8px;">
      <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn-primary" onclick="saveAvance(${id})">Guardar</button>
    </div>`;
  openModal('Actualizar avance: ' + nombre, html);
}

async function saveAvance(id) {
  const porcentaje_avance = parseFloat($('f-avance').value);
  const estado = $('f-estado').value;
  if (isNaN(porcentaje_avance) || porcentaje_avance < 0 || porcentaje_avance > 100) {
    return toast('El avance debe ser entre 0 y 100', 'error');
  }
  try {
    await API.put(`/api/proyectos/${id}/avance`, { porcentaje_avance, estado });
    toast('Avance actualizado', 'success');
    closeModal();
    renderProyectos();
  } catch (e) { toast(e.message, 'error'); }
}

function showNuevoProyecto() {
  const html = `
    <div class="form-group">
      <label>Nombre de la obra *</label>
      <input type="text" id="p-nombre" placeholder="Carretera Ags-Calvillo..." />
    </div>
    <div class="form-group">
      <label>Descripción</label>
      <input type="text" id="p-desc" placeholder="Descripción breve del proyecto..." />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Fecha de inicio *</label>
        <input type="date" id="p-inicio" value="${today()}" />
      </div>
      <div class="form-group">
        <label>Fecha fin estimada</label>
        <input type="date" id="p-fin" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1;">
        <label>Presupuesto (MXN) *</label>
        <input type="number" id="p-presupuesto" min="0" step="1000" placeholder="1000000" />
      </div>
      <div class="form-group" style="flex:0 0 160px;">
        <label>Zona geográfica</label>
        <select id="p-zona">
          <option value="Centro">Centro</option>
          <option value="Norte">Norte</option>
          <option value="Sur">Sur</option>
          <option value="Frontera">Frontera</option>
          <option value="Turístico">Turístico</option>
        </select>
      </div>
    </div>
    <div style="font-size:0.78rem;color:var(--text2);margin-bottom:8px;">
      La zona determina los precios del catálogo BIMSA (mano de obra y materiales varían por región).
    </div>
    <div class="modal-footer" style="padding:0;border:none;margin-top:8px;">
      <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn-primary" onclick="saveProyecto()">Crear proyecto</button>
    </div>`;
  openModal('Nuevo proyecto', html);
}

async function saveProyecto() {
  const nombre_obra        = $('p-nombre').value.trim();
  const descripcion        = $('p-desc').value.trim();
  const fecha_inicio       = $('p-inicio').value;
  const fecha_fin_estimada = $('p-fin').value;
  const presupuesto        = parseFloat($('p-presupuesto').value);
  const zona               = $('p-zona').value;

  if (!nombre_obra || !fecha_inicio || isNaN(presupuesto) || presupuesto <= 0) {
    return toast('Completa los campos obligatorios', 'error');
  }
  try {
    await API.post('/api/proyectos', { nombre_obra, descripcion, fecha_inicio, fecha_fin_estimada, presupuesto, zona });
    toast('Proyecto creado exitosamente', 'success');
    closeModal();
    renderProyectos();
  } catch (e) { toast(e.message, 'error'); }
}

function confirmarEliminarProyecto(id, nombre) {
  const html = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
      <span style="font-size:1.5rem;">⚠️</span>
      <span style="font-weight:700;font-size:1rem;">¿Eliminar "${nombre}"?</span>
    </div>
    <p style="color:var(--text2);font-size:0.88rem;margin-bottom:6px;">
      Se eliminarán permanentemente todos los datos del proyecto:
    </p>
    <ul style="color:var(--text2);font-size:0.85rem;margin:0 0 16px 18px;line-height:1.7;">
      <li>Partidas y conceptos del presupuesto</li>
      <li>APUs (materiales, mano de obra, maquinaria)</li>
      <li>Estimaciones y generadores de cantidades</li>
      <li>Compras y salidas vinculadas</li>
    </ul>
    <p style="font-size:0.82rem;color:var(--text2);margin-bottom:16px;">
      Tendrás <strong>10 segundos</strong> para deshacer con <kbd style="background:var(--bg3);padding:2px 6px;border-radius:4px;font-size:0.8rem;">Ctrl+Z</kbd> después de confirmar.
    </p>
    <div class="modal-footer" style="padding:0;border:none;margin-top:8px;">
      <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn-danger" onclick="eliminarProyecto(${id},'${nombre.replace(/'/g, "\\'")}')">Sí, eliminar</button>
    </div>`;
  openModal('Eliminar proyecto', html);
}

async function eliminarProyecto(id, nombre) {
  closeModal();
  let deleteTimer = null;
  let cancelled = false;

  pushUndo({
    descripcion: `Eliminar proyecto: ${nombre}`,
    undoFn: async () => {
      if (deleteTimer !== null) {
        clearTimeout(deleteTimer);
        deleteTimer = null;
        cancelled = true;
        toast(`Eliminación de "${nombre}" cancelada`, 'success');
      } else {
        toast('El proyecto ya fue eliminado — no se puede restaurar', 'warn');
      }
    }
  });

  deleteTimer = setTimeout(async () => {
    if (cancelled) return;
    deleteTimer = null;
    try {
      await API.delete('/api/proyectos/' + id);
      toast(`Proyecto "${nombre}" eliminado`, 'success');
      renderProyectos();
    } catch (e) { toast(e.message, 'error'); }
  }, 10000);
}
