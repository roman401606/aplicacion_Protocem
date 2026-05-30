async function renderDashboard() {
  const content = $('page-content');
  try {
    const d = await API.get('/api/dashboard/kpis');
    const p = d.proyectos;
    const g = d.gastos;
    const s = d.salidas;

    const pctGasto = p.presupuesto_activos > 0
      ? (g.gasto_total / p.presupuesto_activos * 100).toFixed(1)
      : 0;

    const tipKpiProyectos = `<strong>Proyectos activos</strong>
${p.activos || 0} obra(s) en curso actualmente.
${p.pausados || 0} pausado(s) · ${p.finalizados || 0} finalizado(s) no se incluyen en presupuesto ni gasto.`;

    const tipKpiPresupuesto = `<strong>Presupuesto comprometido</strong>
Suma del presupuesto total de las ${p.activos || 0} obra(s) activas.
Es el techo de inversión autorizado para los proyectos en curso.`;

    const tipKpiGasto = `<strong>Gasto acumulado</strong>
Total de compras registradas en obras activas.
Representa el <span class="tip-hi">${pctGasto}%</span> del presupuesto.
<span class="tip-red">⚠ Alerta roja: se activa cuando supera el 80%.</span>`;

    const tipKpiSalidas = `<strong>Salidas de inventario</strong>
Movimientos de material desde almacén hacia obra.
· Consumo: uso normal en construcción
· Merma: desperdicio o daño registrado
· Robo: incidente de pérdida
<span class="tip-red">${s.robos > 0 ? `⚠ ${s.robos} robo(s) detectado(s) — revisar urgente.` : 'Sin robos registrados.'}</span>`;

    content.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Dashboard</div>
          <div class="page-subtitle">Resumen ejecutivo — Protocem</div>
        </div>
      </div>

      <!-- KPIs -->
      <div class="kpi-grid">
        <div class="kpi-card green" data-tip="${escHtml(tipKpiProyectos)}">
          <div class="kpi-label">Proyectos activos</div>
          <div class="kpi-value">${p.activos || 0}</div>
          <div class="kpi-sub">${p.total || 0} total · ${p.finalizados || 0} finalizado(s)</div>
        </div>
        <div class="kpi-card blue" data-tip="${escHtml(tipKpiPresupuesto)}">
          <div class="kpi-label">Presupuesto activos</div>
          <div class="kpi-value">${fmt(p.presupuesto_activos)}</div>
          <div class="kpi-sub">Suma de obras en curso</div>
        </div>
        <div class="kpi-card ${pctGasto > 80 ? 'red' : 'purple'}" data-tip="${escHtml(tipKpiGasto)}">
          <div class="kpi-label">Gasto acumulado</div>
          <div class="kpi-value">${fmt(g.gasto_total)}</div>
          <div class="kpi-sub">${pctGasto}% del presupuesto usado</div>
        </div>
        <div class="kpi-card ${s.robos > 0 ? 'red' : 'green'}" data-tip="${escHtml(tipKpiSalidas)}">
          <div class="kpi-label">Salidas registradas</div>
          <div class="kpi-value">${s.total_salidas || 0}</div>
          <div class="kpi-sub">${s.mermas || 0} merma(s) · ${s.robos || 0} robo(s)</div>
        </div>
      </div>

      <div class="grid-2">
        <!-- Avance de proyectos -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Avance de proyectos</span>
            <span style="font-size:0.75rem;color:var(--text2);">Clic en nombre → ver presupuesto</span>
          </div>
          <div class="card-body">
            ${renderAvanceProyectos(d.avance_proyectos)}
          </div>
        </div>

        <!-- Panel derecho -->
        <div style="display:flex;flex-direction:column;gap:20px;">
          <!-- Alertas de precio -->
          <div class="card">
            <div class="card-header">
              <span class="card-title"
                data-tip="<strong>Alertas de precio</strong>&#10;Se activa cuando el precio real de compra supera en más del 5% el precio cotizado.&#10;Indica sobrecostos o necesidad de renegociar con proveedores.&#10;<span class=&#39;tip-nav&#39;>Clic en cada fila → ir a Cotizaciones</span>">
                Alertas de precio
              </span>
              <span class="badge badge-red">${d.alertas_precio.length}</span>
            </div>
            <div class="card-body" style="padding:0;">
              ${renderAlertasPrecio(d.alertas_precio)}
            </div>
          </div>

          <!-- Stock crítico -->
          <div class="card">
            <div class="card-header">
              <span class="card-title"
                data-tip="<strong>Stock crítico</strong>&#10;Productos con menos de 50 unidades en inventario.&#10;Rojo = agotado, amarillo = nivel bajo.&#10;<span class=&#39;tip-nav&#39;>Clic en cada fila → ir a Inventario</span>">
                Stock crítico
              </span>
              <span class="badge badge-yellow">${d.stock_critico.length}</span>
            </div>
            <div class="card-body" style="padding:0;">
              ${renderStockCritico(d.stock_critico)}
            </div>
          </div>
        </div>
      </div>

      <!-- Desviación por partida -->
      <div class="card" style="margin-top:20px;">
        <div class="card-header" style="flex-wrap:wrap;gap:10px;">
          <span class="card-title"
            data-tip="<strong>Desviación por partida</strong>&#10;Compara el presupuesto de cada partida contra el avance financiero (generadores) y el gasto real (compras).&#10;El semáforo indica el nivel de riesgo presupuestal por partida.">
            Desviación por partida
          </span>
          <select id="dash-proj-desviac" onchange="dashCargarDesviacion(this.value)"
            style="font-size:0.82rem;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--text);">
            <option value="">— Selecciona proyecto —</option>
            ${d.avance_proyectos.map(pr=>`<option value="${pr.id_proyecto}">${escHtml(pr.nombre_obra)}</option>`).join('')}
          </select>
        </div>
        <div id="dash-desviacion-body" style="padding:20px;color:var(--text2);font-size:0.85rem;text-align:center;">
          Selecciona un proyecto para ver el desglose por partidas.
        </div>
      </div>`;

    // Auto-cargar primer proyecto en desviación
    if (d.avance_proyectos.length > 0) {
      const firstId = d.avance_proyectos[0].id_proyecto;
      $('dash-proj-desviac').value = firstId;
      dashCargarDesviacion(firstId);
    }

  } catch (e) {
    content.innerHTML = `<div class="alert alert-warn">${e.message}</div>`;
  }
}

function semaforoIcon(s) {
  const colors = { verde: 'var(--green)', amarillo: '#f59e0b', rojo: 'var(--red)' };
  const labels = { verde: 'En presupuesto', amarillo: 'Atención', rojo: 'Alerta' };
  const tipTexto = escHtml(
    '<strong>Semáforo presupuestal</strong>\n' +
    '🟢 Verde: gasto < 70% del presupuesto\n' +
    '🟡 Amarillo: gasto entre 70–90%\n' +
    '🔴 Rojo: gasto > 90% — revisar urgente'
  );
  return `<span data-tip="${tipTexto}"
    style="display:inline-flex;align-items:center;gap:4px;font-size:0.75rem;font-weight:600;color:${colors[s]||'var(--text2)'};cursor:default;">
    <span style="width:9px;height:9px;border-radius:50%;background:${colors[s]||'gray'};display:inline-block;box-shadow:0 0 6px ${colors[s]||'gray'};"></span>
    ${labels[s]||s}
  </span>`;
}

function renderAvanceProyectos(proyectos) {
  if (!proyectos.length) return empty('Sin proyectos');
  return proyectos.map(p => {
    const pctUsado = p.pct_gastado || (p.presupuesto > 0
      ? Math.min(100, (p.gasto_acumulado / p.presupuesto) * 100).toFixed(1)
      : 0);
    const colorFisico = p.porcentaje_avance >= 100 ? 'green' : 'accent';
    const colorGasto  = pctUsado > 90 ? 'red' : pctUsado > 70 ? 'yellow' : 'blue';
    const tienePresupuesto = p.num_conceptos > 0;

    const tipFisico = escHtml(
      `Avance físico: ${fmtN(p.porcentaje_avance, 1)}% completado\n` +
      `Medido por generadores de cantidades ejecutadas.\n` +
      (p.porcentaje_avance >= 100 ? '✅ Obra completada.' :
       p.porcentaje_avance >= 70  ? '🔄 En etapa final.' : '🔧 En desarrollo.')
    );
    const tipGasto = escHtml(
      `Presupuesto usado: ${pctUsado}%\n` +
      `Gastado: ${fmt(p.gasto_acumulado)} de ${fmt(p.presupuesto)}\n` +
      (pctUsado > 90 ? '🔴 Crítico: casi sin margen presupuestal.' :
       pctUsado > 70 ? '🟡 Precaución: revisar gasto.' : '🟢 Dentro del presupuesto.')
    );
    const tipNombre = `Clic para ir a Presupuesto de esta obra →`;

    return `<div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span class="dash-link-name" data-tip="${escHtml(tipNombre)}"
          onclick="navigate('presupuesto')" style="font-size:0.9rem;">
          ${escHtml(p.nombre_obra)}
        </span>
        <div style="display:flex;gap:8px;align-items:center;">
          ${p.semaforo ? semaforoIcon(p.semaforo) : ''}
          ${estadoBadge(p.estado)}
        </div>
      </div>
      <div style="font-size:0.75rem;color:var(--text2);margin-bottom:8px;display:flex;gap:16px;flex-wrap:wrap;">
        <span>Zona: <strong>${escHtml(p.zona||'Centro')}</strong></span>
        <span>Inicio: <strong>${fmtDate(p.fecha_inicio)}</strong></span>
        <span>Fin est: <strong>${fmtDate(p.fecha_fin_estimada)}</strong></span>
        ${tienePresupuesto ? `<span>${p.num_partidas} partida(s) · ${p.num_conceptos} concepto(s)</span>` : ''}
      </div>
      <div style="font-size:0.78rem;color:var(--text2);margin-bottom:4px;" data-tip="${tipFisico}">
        Avance físico: <strong style="color:var(--text)">${fmtN(p.porcentaje_avance, 1)}%</strong>
      </div>
      <div data-tip="${tipFisico}">${progressBar(p.porcentaje_avance, colorFisico, false)}</div>
      <div style="font-size:0.78rem;color:var(--text2);margin-bottom:4px;margin-top:8px;" data-tip="${tipGasto}">
        Presupuesto usado: <strong style="color:var(--text)">${pctUsado}%</strong>
        · ${fmt(p.gasto_acumulado)} de ${fmt(p.presupuesto)}
        ${p.total_estimado > 0 ? `· Estimado: <strong style="color:var(--green)">${fmt(p.total_estimado)}</strong>` : ''}
      </div>
      <div data-tip="${tipGasto}">${progressBar(pctUsado, colorGasto, false)}</div>
    </div>`;
  }).join('');
}

function renderAlertasPrecio(alertas) {
  if (!alertas.length) return `<div style="padding:16px;color:var(--text2);font-size:0.85rem;">Sin alertas activas — precios dentro del rango cotizado.</div>`;
  return alertas.map(a => {
    const precioReal = a.precio_cotizado * (1 + (a.desviacion_pct || 0) / 100);
    const diff       = precioReal - a.precio_cotizado;
    const nivel      = a.desviacion_pct > 15
      ? "<span class='tip-red'>🔴 Desviación crítica — revisar urgente</span>"
      : "<span class='tip-hi'>🟡 Desviación moderada — monitorear</span>";
    const tipHtml = escHtml(
      `${a.descripcion}\n` +
      `Precio cotizado: ${fmt(a.precio_cotizado)}\n` +
      `Precio real:     ${fmt(precioReal)}\n` +
      `Diferencia:      +${fmt(diff)} (+${a.desviacion_pct}%)\n`
    ) + nivel + escHtml('\n') + `<span class='tip-nav'>Clic → ir a Cotizaciones</span>`;

    return `<div class="dash-row-link"
        style="display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-bottom:1px solid var(--border);"
        data-tip="${tipHtml}"
        onclick="navigate('cotizaciones')">
      <div>
        <div style="font-size:0.85rem;font-weight:500;">${escHtml(a.descripcion)}</div>
        <div style="font-size:0.73rem;color:var(--text2);margin-top:2px;">
          Cotizado: ${fmt(a.precio_cotizado)} · Real: ${fmt(precioReal)}
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
        ${desvBadge(a.desviacion_pct)}
      </div>
    </div>`;
  }).join('');
}

function renderStockCritico(items) {
  if (!items.length) return `<div style="padding:16px;color:var(--text2);font-size:0.85rem;">Sin productos en stock crítico.</div>`;
  return items.map(i => {
    const cls = i.stock === 0 ? 'stock-low' : 'stock-mid';
    const nivel = i.stock === 0
      ? "<span class='tip-red'>⛔ AGOTADO — compra urgente</span>"
      : "<span class='tip-hi'>⚠ Nivel bajo — revisar proveedor</span>";
    const tipHtml = escHtml(
      `${i.descripcion}\n` +
      `Stock actual: ${fmtN(i.stock)} ${i.unidades}\n` +
      `Umbral de alerta: menos de 50 unidades\n`
    ) + nivel + `<span class='tip-nav'>Clic → ir a Inventario</span>`;

    return `<div class="dash-row-link"
        style="display:flex;justify-content:space-between;align-items:center;padding:10px 20px;border-bottom:1px solid var(--border);"
        data-tip="${tipHtml}"
        onclick="navigate('inventario')">
      <span style="font-size:0.85rem;">${escHtml(i.descripcion)}</span>
      <span class="${cls}">${fmtN(i.stock)} ${escHtml(i.unidades)}</span>
    </div>`;
  }).join('');
}

/* ── DESVIACIÓN POR PARTIDA ── */
async function dashCargarDesviacion(id) {
  const body = $('dash-desviacion-body');
  if (!id) {
    body.innerHTML = '<div style="padding:20px;color:var(--text2);font-size:0.85rem;text-align:center;">Selecciona un proyecto.</div>';
    return;
  }
  body.innerHTML = loading();
  try {
    const { partidas } = await API.get(`/api/partidas/proyecto/${id}/resumen`);
    if (!partidas.length) {
      body.innerHTML = '<div style="padding:20px;color:var(--text2);font-size:0.85rem;">Este proyecto no tiene partidas definidas. Ve a <strong>Presupuesto</strong> para crearlas.</div>';
      return;
    }

    const tipSemaforo = escHtml(
      'Semáforo por partida:\n' +
      '🟢 Verde:    gasto < 70% del presupuesto de la partida\n' +
      '🟡 Amarillo: gasto entre 70–90%\n' +
      '🔴 Rojo:     gasto > 90% — sin margen disponible'
    );

    const filas = partidas.map(pa => {
      const gastado   = parseFloat(pa.gasto_real || 0);
      const presup    = parseFloat(pa.total_partida || 0);
      const desv      = presup > 0 ? ((gastado / presup) * 100).toFixed(1) : 0;
      const avance    = parseFloat(pa.avance_financiero || 0);
      const pctAvance = presup > 0 ? Math.min(100, (avance / presup) * 100).toFixed(1) : 0;
      const semaforo  = desv > 90 ? 'rojo' : desv > 70 ? 'amarillo' : 'verde';

      const tipPartida = escHtml(
        `Partida: ${pa.nombre}\n` +
        `Presupuesto: ${fmt(presup)}\n` +
        `Avance financiero: ${fmt(avance)} (${pctAvance}%)\n` +
        `Gasto real: ${fmt(gastado)} (${desv}% del presupuesto)\n` +
        `${pa.num_conceptos} concepto(s) en esta partida.`
      );

      return `<tr data-tip="${tipPartida}" style="cursor:default;">
        <td style="font-weight:600;color:var(--accent);">${escHtml(pa.numero)}</td>
        <td style="max-width:220px;white-space:normal;font-size:0.85rem;">${escHtml(pa.nombre)}</td>
        <td style="text-align:center;font-size:0.8rem;">${pa.num_conceptos}</td>
        <td style="text-align:right;font-weight:600;">${fmt(presup)}</td>
        <td style="text-align:right;color:var(--blue);">${fmt(avance)}</td>
        <td style="text-align:right;color:var(--green);">${fmt(gastado)}</td>
        <td>
          <div style="min-width:100px;">${progressBar(pctAvance,'auto',false)}</div>
          <span style="font-size:0.78rem;color:var(--text2);">${pctAvance}% avance</span>
        </td>
        <td data-tip="${tipSemaforo}">${semaforoIcon(semaforo)}</td>
      </tr>`;
    }).join('');

    const totalPresup  = partidas.reduce((s, pa) => s + parseFloat(pa.total_partida    || 0), 0);
    const totalAvance  = partidas.reduce((s, pa) => s + parseFloat(pa.avance_financiero || 0), 0);
    const totalGastado = partidas.reduce((s, pa) => s + parseFloat(pa.gasto_real        || 0), 0);
    const pctGlobalDesv = totalPresup > 0 ? (totalGastado / totalPresup * 100).toFixed(1) : 0;

    body.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr>
          <th>No.</th><th>Partida</th><th style="text-align:center;">Conceptos</th>
          <th style="text-align:right;">Presupuesto</th>
          <th style="text-align:right;">Avance fin.</th>
          <th style="text-align:right;">Gasto real</th>
          <th>Progreso</th><th>Semáforo</th>
        </tr></thead>
        <tbody>${filas}</tbody>
        <tfoot><tr>
          <td colspan="3" style="text-align:right;font-weight:700;">TOTAL:</td>
          <td style="text-align:right;font-weight:700;">${fmt(totalPresup)}</td>
          <td style="text-align:right;font-weight:700;color:var(--blue);">${fmt(totalAvance)}</td>
          <td style="text-align:right;font-weight:700;color:var(--green);">${fmt(totalGastado)}</td>
          <td colspan="2"></td>
        </tr></tfoot>
      </table></div>
      <div style="padding:10px 16px 6px;font-size:0.78rem;color:var(--text2);display:flex;gap:24px;flex-wrap:wrap;">
        <span>Avance fin. = generadores de cantidades ejecutadas</span>
        <span>Gasto real = compras vinculadas a conceptos</span>
        <span>Gasto global: <strong style="color:${pctGlobalDesv > 90 ? 'var(--red)' : pctGlobalDesv > 70 ? '#f59e0b' : 'var(--green)'}">${pctGlobalDesv}%</strong> del presupuesto total</span>
      </div>`;
  } catch (e) {
    body.innerHTML = `<div style="padding:16px;color:var(--red);">Error: ${e.message}</div>`;
  }
}
