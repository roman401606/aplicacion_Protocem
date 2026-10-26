/* ===== PÁGINA: ESTIMACIONES ===== */

let _estProyectoActual = null;

async function renderEstimaciones() {
  const content = $('page-content');
  const canEdit = ['administrador','encargado'].includes(API.user.rol);
  try {
    const proyectos = await API.get('/api/proyectos');

    content.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Estimaciones</div>
          <div class="page-subtitle">Documentos formales de cobro por período</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-body">
          <div class="form-row" style="align-items:flex-end;gap:12px;">
            <div class="form-group" style="flex:1;margin:0;">
              <label>Selecciona un proyecto</label>
              <select id="est-selector">
                <option value="">— Elige un proyecto —</option>
                ${proyectos.map(p=>`<option value="${p.id_proyecto}">${p.nombre_obra}</option>`).join('')}
              </select>
            </div>
            ${canEdit ? `<button class="btn-primary" id="btn-nueva-est" disabled onclick="estNuevaEstimacion()">+ Nueva estimación</button>` : ''}
          </div>
        </div>
      </div>

      <div id="est-content">${empty('Selecciona un proyecto')}</div>`;

    $('est-selector').addEventListener('change', async e => {
      const id = e.target.value;
      if (!id) { $('est-content').innerHTML = empty('Selecciona un proyecto'); return; }
      _estProyectoActual = parseInt(id);
      const btn = $('btn-nueva-est');
      if (btn) btn.disabled = false;
      await cargarEstimaciones(id);
    });

  } catch (e) {
    content.innerHTML = `<div class="alert alert-warn">${e.message}</div>`;
  }
}

async function cargarEstimaciones(id) {
  $('est-content').innerHTML = loading();
  try {
    const [estimaciones, acumulado] = await Promise.all([
      API.get(`/api/estimaciones/proyecto/${id}`),
      API.get(`/api/estimaciones/proyecto/${id}/acumulado`)
    ]);

    const pctCobrado = acumulado.presupuesto > 0
      ? ((acumulado.total_cobrado / acumulado.presupuesto) * 100).toFixed(1)
      : 0;

    const estadoColor = { borrador:'badge-gray', presentada:'badge-blue', aprobada:'badge-green', pagada:'badge-purple' };

    $('est-content').innerHTML = `
      <div class="kpi-grid" style="margin-bottom:20px;">
        <div class="kpi-card blue">
          <div class="kpi-label">Presupuesto total</div>
          <div class="kpi-value">${fmt(acumulado.presupuesto)}</div>
        </div>
        <div class="kpi-card green">
          <div class="kpi-label">Total cobrado</div>
          <div class="kpi-value">${fmt(acumulado.total_cobrado)}</div>
          <div class="kpi-sub">${pctCobrado}% del presupuesto</div>
        </div>
        <div class="kpi-card purple">
          <div class="kpi-label">Por cobrar</div>
          <div class="kpi-value">${fmt(acumulado.presupuesto - acumulado.total_cobrado)}</div>
        </div>
        <div class="kpi-card ${estimaciones.length > 0 ? 'accent' : 'gray'}">
          <div class="kpi-label">Estimaciones</div>
          <div class="kpi-value">${estimaciones.length}</div>
          <div class="kpi-sub">${estimaciones.filter(e=>e.estado==='aprobada').length} aprobadas</div>
        </div>
      </div>

      ${estimaciones.length === 0 ? empty('Sin estimaciones registradas para este proyecto') :
        `<div class="card">
          <div class="card-header"><span class="card-title">Estimaciones del proyecto</span></div>
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>No.</th><th>Período</th><th>Conceptos</th>
                <th style="text-align:right;">Total</th><th style="text-align:right;">Acumulado</th>
                <th>Estado</th><th>Acciones</th>
              </tr></thead>
              <tbody>
                ${acumulado.estimaciones.map(e=>`<tr>
                  <td style="font-weight:700;">Est. ${e.numero}</td>
                  <td style="font-size:0.82rem;">${fmtDate(e.periodo_inicio)} — ${fmtDate(e.periodo_fin)}</td>
                  <td>—</td>
                  <td style="text-align:right;font-weight:600;">${fmt(e.total_estimacion)}</td>
                  <td style="text-align:right;color:var(--blue);">${fmt(e.acumulado)}</td>
                  <td>${badge(estadoColor[e.estado]||'badge-gray', e.estado)}</td>
                  <td>
                    <button class="btn-ghost btn-sm" onclick="estVerDetalle(${e.id_estimacion||''})">Ver</button>
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div style="margin-top:16px;">
          <div style="font-weight:600;font-size:0.88rem;margin-bottom:8px;">Curva de avance financiero</div>
          <div class="card"><div class="card-body">
            ${acumulado.estimaciones.map(e=>{
              const pct = acumulado.presupuesto > 0 ? Math.min(100, (e.acumulado / acumulado.presupuesto) * 100) : 0;
              return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                <span style="min-width:60px;font-size:0.82rem;color:var(--text2);">Est. ${e.numero}</span>
                <div style="flex:1;">${progressBar(pct,'accent',false)}</div>
                <span style="min-width:80px;text-align:right;font-size:0.82rem;">${fmt(e.acumulado)}</span>
                <span style="min-width:50px;text-align:right;font-size:0.82rem;color:var(--accent);">${pct.toFixed(1)}%</span>
              </div>`;
            }).join('')}
          </div></div>
        </div>`
      }`;
  } catch (e) {
    $('est-content').innerHTML = `<div class="alert alert-warn">${e.message}</div>`;
  }
}

async function estNuevaEstimacion() {
  if (!_estProyectoActual) return toast('Selecciona un proyecto primero', 'error');
  openModal('Nueva estimación', loading(), true);
  try {
    const resumen = await API.get(`/api/partidas/proyecto/${_estProyectoActual}/resumen`);
    const { partidas } = resumen;

    /* obtener conceptos de todas las partidas */
    const allConceptos = [];
    for (const pa of partidas) {
      const concs = await API.get(`/api/partidas/${pa.id_partida}/conceptos`);
      concs.forEach(c => allConceptos.push({ ...c, partida_nombre: pa.nombre, partida_num: pa.numero }));
    }

    if (!allConceptos.length) {
      openModal('Sin conceptos', `<p>Este proyecto no tiene conceptos en su presupuesto. Primero define las partidas y conceptos en la sección Presupuesto.</p>`);
      return;
    }

    const conceptosHTML = allConceptos.map(co => `
      <tr>
        <td><input type="checkbox" class="est-check" value="${co.id_concepto}" onchange="estActualizarTotal()"/></td>
        <td style="font-size:0.75rem;color:var(--text2);">${co.partida_num} — ${co.partida_nombre}</td>
        <td style="font-size:0.82rem;">${co.clave||'—'}</td>
        <td style="font-size:0.82rem;max-width:200px;white-space:normal;">${co.descripcion}</td>
        <td>${co.unidad}</td>
        <td style="text-align:right;color:var(--text2);">${fmtN(co.cantidad_ejecutada,3)}</td>
        <td style="text-align:right;">${fmtN(co.cantidad,3)}</td>
        <td><input type="number" class="est-cant" id="cant-${co.id_concepto}" min="0" step="0.001" value="0"
          style="width:90px;padding:4px 6px;" data-precio="${co.precio_unitario}"
          onchange="estActualizarTotal()"/></td>
        <td style="text-align:right;font-size:0.82rem;">${fmt(co.precio_unitario)}</td>
      </tr>`).join('');

    const html = `
      <div class="form-row" style="margin-bottom:12px;">
        <div class="form-group"><label>Período inicio *</label><input type="date" id="est-ini" value="${today()}"/></div>
        <div class="form-group"><label>Período fin *</label><input type="date" id="est-fin"/></div>
        <div class="form-group"><label>Fecha presentación</label><input type="date" id="est-pres"/></div>
      </div>
      <div class="form-group" style="margin-bottom:12px;">
        <label>Observaciones</label>
        <input type="text" id="est-obs" placeholder="Notas de esta estimación..."/>
      </div>
      <div style="font-weight:600;font-size:0.88rem;margin-bottom:8px;">Conceptos a incluir</div>
      <div class="table-wrap" style="max-height:300px;overflow-y:auto;">
        <table>
          <thead><tr>
            <th></th><th>Partida</th><th>Clave</th><th>Descripción</th><th>Unidad</th>
            <th style="text-align:right;">Ejec.ant.</th><th style="text-align:right;">Contratada</th>
            <th>Cant.período</th><th style="text-align:right;">P.U.</th>
          </tr></thead>
          <tbody>${conceptosHTML}</tbody>
        </table>
      </div>
      <div style="margin-top:12px;padding:12px;background:var(--bg2);border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:600;">Total de la estimación:</span>
        <span id="est-total-preview" style="font-size:1.2rem;font-weight:700;color:var(--blue);">$0.00</span>
      </div>
      <div class="modal-footer" style="padding:0;border:none;margin-top:8px;">
        <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary" onclick="estSave()">Generar estimación</button>
      </div>`;

    openModal('Nueva estimación', html, true);
  } catch (e) { openModal('Error', `<p style="color:var(--red)">${e.message}</p>`); }
}

function estActualizarTotal() {
  const checks = document.querySelectorAll('.est-check:checked');
  let total = 0;
  checks.forEach(ch => {
    const cant  = parseFloat(document.getElementById(`cant-${ch.value}`)?.value || 0);
    const precio = parseFloat(document.getElementById(`cant-${ch.value}`)?.dataset.precio || 0);
    total += cant * precio;
  });
  const el = $('est-total-preview');
  if (el) el.textContent = fmt(total);
}

async function estSave() {
  const periodo_inicio    = $('est-ini').value;
  const periodo_fin       = $('est-fin').value;
  const fecha_presentacion = $('est-pres').value;
  const observaciones     = $('est-obs').value.trim();

  const items = [];
  document.querySelectorAll('.est-check:checked').forEach(ch => {
    const id_concepto     = parseInt(ch.value);
    const cantidad_periodo = parseFloat(document.getElementById(`cant-${id_concepto}`)?.value || 0);
    const precio_unitario  = parseFloat(document.getElementById(`cant-${id_concepto}`)?.dataset.precio || 0);
    if (cantidad_periodo > 0) items.push({ id_concepto, cantidad_periodo, precio_unitario });
  });

  if (!periodo_inicio || !periodo_fin) return toast('Define el período', 'error');
  if (!items.length) return toast('Selecciona al menos un concepto con cantidad > 0', 'error');

  try {
    const r = await API.post(`/api/estimaciones/proyecto/${_estProyectoActual}`,
      { periodo_inicio, periodo_fin, fecha_presentacion: fecha_presentacion||null, observaciones, items });
    toast(`Estimación ${r.numero} generada — Total: ${fmt(r.total)}`, 'success');
    closeModal();
    await cargarEstimaciones(_estProyectoActual);
  } catch (e) { toast(e.message, 'error'); }
}

async function estVerDetalle(id_estimacion) {
  if (!id_estimacion) return toast('Carga las estimaciones completas para ver el detalle', 'info');
  openModal('Detalle de estimación', loading(), true);
  try {
    const d = await API.get(`/api/estimaciones/${id_estimacion}`);
    const { estimacion: est, detalle, acumulado_anterior } = d;
    const estadoColor = { borrador:'badge-gray', presentada:'badge-blue', aprobada:'badge-green', pagada:'badge-purple' };
    const isAdmin = API.user.rol === 'administrador';

    const html = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
        <div>
          <div style="font-size:1.1rem;font-weight:700;">Estimación No. ${est.numero}</div>
          <div style="font-size:0.85rem;color:var(--text2);">${est.nombre_obra}</div>
          <div style="font-size:0.82rem;color:var(--text2);">Período: ${fmtDate(est.periodo_inicio)} — ${fmtDate(est.periodo_fin)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
          ${badge(estadoColor[est.estado]||'badge-gray', est.estado)}
          ${isAdmin ? `<select onchange="estCambiarEstado(${est.id_estimacion},this.value)" style="font-size:0.8rem;padding:4px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--text);">
            <option value="borrador" ${est.estado==='borrador'?'selected':''}>Borrador</option>
            <option value="presentada" ${est.estado==='presentada'?'selected':''}>Presentada</option>
            <option value="aprobada" ${est.estado==='aprobada'?'selected':''}>Aprobada</option>
            <option value="pagada" ${est.estado==='pagada'?'selected':''}>Pagada</option>
          </select>` : ''}
        </div>
      </div>

      <div class="table-wrap" style="margin-bottom:16px;">
        <table>
          <thead><tr>
            <th>Partida</th><th>Clave</th><th>Descripción</th><th>Unidad</th>
            <th style="text-align:right;">Cant.</th><th style="text-align:right;">P.U.</th>
            <th style="text-align:right;">Importe</th>
          </tr></thead>
          <tbody>${detalle.map(d=>`<tr>
            <td style="font-size:0.75rem;color:var(--text2);">${d.partida_num}</td>
            <td style="font-size:0.75rem;color:var(--accent);">${d.clave||'—'}</td>
            <td style="font-size:0.82rem;max-width:220px;white-space:normal;">${d.concepto_desc}</td>
            <td>${d.unidad}</td>
            <td style="text-align:right;">${fmtN(d.cantidad_periodo,3)}</td>
            <td style="text-align:right;">${fmt(d.precio_unitario)}</td>
            <td style="text-align:right;font-weight:600;">${fmt(d.importe)}</td>
          </tr>`).join('')}</tbody>
          <tfoot>
            <tr><td colspan="6" style="text-align:right;font-weight:700;">Acumulado anterior:</td>
              <td style="text-align:right;color:var(--text2);">${fmt(acumulado_anterior)}</td></tr>
            <tr><td colspan="6" style="text-align:right;font-weight:700;">Esta estimación:</td>
              <td style="text-align:right;font-weight:700;color:var(--blue);font-size:1.05rem;">${fmt(est.total_estimacion)}</td></tr>
            <tr><td colspan="6" style="text-align:right;font-weight:700;">Acumulado total:</td>
              <td style="text-align:right;font-weight:700;color:var(--accent);font-size:1.1rem;">${fmt(parseFloat(acumulado_anterior)+parseFloat(est.total_estimacion))}</td></tr>
          </tfoot>
        </table>
      </div>
      ${est.observaciones ? `<div style="font-size:0.82rem;color:var(--text2);padding:8px;background:var(--bg2);border-radius:6px;">Obs: ${est.observaciones}</div>` : ''}
      <div style="margin-top:16px;display:flex;justify-content:flex-end;">
        <button class="btn-ghost" onclick="estImprimir(${est.id_estimacion})">Imprimir / PDF</button>
      </div>`;

    openModal(`Estimación ${est.numero} — ${est.nombre_obra}`, html, true);
  } catch (e) { openModal('Error', `<p style="color:var(--red)">${e.message}</p>`); }
}

async function estCambiarEstado(id, estado) {
  try {
    await API.put(`/api/estimaciones/${id}/estado`, { estado });
    toast(`Estado cambiado a "${estado}"`, 'success');
  } catch (e) { toast(e.message, 'error'); }
}

/* ── P5: IMPRIMIR / PDF ── */
async function estImprimir(id_estimacion) {
  try {
    const d = await API.get(`/api/estimaciones/${id_estimacion}`);
    const { estimacion: est, detalle, acumulado_anterior } = d;
    const total = parseFloat(est.total_estimacion);
    const acum  = parseFloat(acumulado_anterior) + total;

    const filas = detalle.map(r =>
      `<tr>
        <td>${r.partida_num}</td>
        <td>${r.clave||'—'}</td>
        <td>${r.concepto_desc}</td>
        <td>${r.unidad}</td>
        <td class="num">${fmtN(r.cantidad_periodo,3)}</td>
        <td class="num">$${parseFloat(r.precio_unitario).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
        <td class="num">$${parseFloat(r.importe).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
      </tr>`).join('');

    const periodo_str = `${fmtDate(est.periodo_inicio)} — ${fmtDate(est.periodo_fin)}`;
    const pres_str    = est.fecha_presentacion ? `<div><strong>Presentada:</strong> ${fmtDate(est.fecha_presentacion)}</div>` : '';
    const obs_str     = est.observaciones ? `<div style="margin-top:12px;padding:8px;border:1px solid #ccc;font-size:11px;"><strong>Observaciones:</strong> ${est.observaciones}</div>` : '';

    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Estimación ${est.numero} — ${est.nombre_obra}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#000;}
  .header{border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:14px;}
  h1{font-size:15px;margin:0 0 3px;}
  h2{font-size:12px;margin:0 0 10px;font-weight:normal;color:#333;}
  .meta{display:flex;gap:32px;flex-wrap:wrap;font-size:11px;}
  .meta strong{display:block;font-size:9px;color:#666;text-transform:uppercase;margin-bottom:1px;}
  table{width:100%;border-collapse:collapse;margin-bottom:14px;}
  th{background:#efefef;border:1px solid #ccc;padding:5px 7px;text-align:left;font-size:10px;}
  td{border:1px solid #ccc;padding:4px 7px;vertical-align:top;}
  td.num{text-align:right;white-space:nowrap;}
  tfoot td{font-weight:700;background:#f9f9f9;}
  .totales{text-align:right;line-height:1.9;}
  .totales span{display:inline-block;width:220px;text-align:right;}
  .grand{font-size:13px;font-weight:700;}
  .firma{margin-top:56px;display:flex;justify-content:space-around;}
  .firma div{text-align:center;width:180px;}
  .linea{border-top:1px solid #000;padding-top:5px;font-size:10px;}
  @media print{body{margin:8mm;}button{display:none;}}
</style>
</head>
<body>
<div class="header">
  <h1>ESTIMACIÓN DE OBRA No. ${est.numero}</h1>
  <h2>${est.nombre_obra}</h2>
  <div class="meta">
    <div><strong>Período</strong>${periodo_str}</div>
    <div><strong>Estado</strong>${est.estado.toUpperCase()}</div>
    ${pres_str}
  </div>
</div>
<table>
  <thead>
    <tr><th>Part.</th><th>Clave</th><th>Descripción</th><th>Unidad</th>
    <th class="num">Cantidad</th><th class="num">P.U.</th><th class="num">Importe</th></tr>
  </thead>
  <tbody>${filas}</tbody>
</table>
${obs_str}
<div class="totales">
  <div>Acumulado anterior: <span>$${parseFloat(acumulado_anterior).toLocaleString('es-MX',{minimumFractionDigits:2})}</span></div>
  <div>Esta estimación: <span><strong>$${total.toLocaleString('es-MX',{minimumFractionDigits:2})}</strong></span></div>
  <div class="grand">Acumulado total: <span>$${acum.toLocaleString('es-MX',{minimumFractionDigits:2})}</span></div>
</div>
<div class="firma">
  <div><div class="linea">Elaboró</div></div>
  <div><div class="linea">Revisó</div></div>
  <div><div class="linea">Aprobó / Vo.Bo.</div></div>
</div>
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  } catch (e) { toast(e.message, 'error'); }
}
