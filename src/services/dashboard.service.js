'use strict';

const dashboardRepository = require('../repositories/dashboard.repository');

async function obtenerKpis() {
  const [
    proyectos,
    gastos,
    salidas,
    stock_critico,
    alertas_precio,
    avance_proyectos
  ] = await Promise.all([
    dashboardRepository.kpisProyectos(),
    dashboardRepository.kpisGastos(),
    dashboardRepository.kpisSalidas(),
    dashboardRepository.stockCritico(),
    dashboardRepository.alertasPrecio(),
    dashboardRepository.avanceProyectos()
  ]);

  avance_proyectos.forEach(p => {
    const pct = p.presupuesto > 0 ? (p.gasto_acumulado / p.presupuesto) * 100 : 0;
    p.semaforo = pct > 90 ? 'rojo' : pct > 70 ? 'amarillo' : 'verde';
    p.pct_gastado = parseFloat(pct.toFixed(1));
  });

  return { proyectos, gastos, salidas, stock_critico, alertas_precio, avance_proyectos };
}

module.exports = { obtenerKpis };
