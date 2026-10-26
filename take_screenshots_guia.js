const puppeteer = require('puppeteer');
const path = require('path');

const OUT  = 'C:\\Users\\roman\\OneDrive\\Documentos\\Entregables protocem bd';
const BASE = 'http://localhost:3000';

async function shot(page, name) {
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT, name), fullPage: false });
  console.log('Saved:', name);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  });
  const page = await browser.newPage();

  // 1. Login
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await shot(page, 'g01_login.png');

  // 2. Do login
  await page.type('#l-correo', 'admin@protocem.mx');
  await page.type('#l-pass', 'admin123');
  await page.click('#btn-login');
  await new Promise(r => setTimeout(r, 3000));
  await shot(page, 'g02_dashboard.png');

  // helper: navigate via JS
  async function navTo(pageName, file) {
    await page.evaluate(p => window.navigate && navigate(p), pageName);
    await new Promise(r => setTimeout(r, 2500));
    await shot(page, file);
  }

  await navTo('proyectos',    'g03_proyectos.png');
  await navTo('inventario',   'g04_inventario.png');
  await navTo('cotizaciones', 'g05_cotizaciones.png');
  await navTo('compras',      'g06_compras.png');
  await navTo('salidas',      'g07_salidas.png');
  await navTo('presupuesto',  'g08_presupuesto.png');
  await navTo('estimaciones', 'g09_estimaciones.png');
  await navTo('catalogo',     'g10_catalogo.png');
  await navTo('usuarios',     'g11_usuarios.png');

  await browser.close();
  console.log('All screenshots saved.');
})();
