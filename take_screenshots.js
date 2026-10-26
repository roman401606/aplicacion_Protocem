const puppeteer = require('puppeteer');
const path = require('path');

const OUT = 'C:\\Users\\roman\\OneDrive\\Documentos\\Entregables protocem bd';
const BASE = 'http://localhost:3000';

async function shot(page, name) {
  await page.screenshot({
    path: path.join(OUT, name),
    fullPage: false,
  });
  console.log('Saved:', name);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  });
  const page = await browser.newPage();

  // 1. Login page
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await shot(page, 'cap01_login.png');

  // 2. Do login
  try {
    await page.type('input[type="email"], input[name="correo"], #correo', 'admin@protocem.mx');
    await page.type('input[type="password"], input[name="contrasena"], #contrasena', 'admin123');
    await page.click('button[type="submit"], .btn-login, form button');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await shot(page, 'cap02_dashboard.png');
  } catch(e) {
    console.log('Login step:', e.message);
    await shot(page, 'cap02_dashboard.png');
  }

  // Helper to click a nav link
  async function navTo(linkText, outFile) {
    try {
      const links = await page.$$('a, .nav-item, nav li, [data-page]');
      let clicked = false;
      for (const link of links) {
        const txt = await page.evaluate(el => el.textContent.trim().toLowerCase(), link);
        if (txt.includes(linkText.toLowerCase())) {
          await link.click();
          await new Promise(r => setTimeout(r, 1800));
          await shot(page, outFile);
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        // try hash navigation
        await page.evaluate(text => {
          const all = document.querySelectorAll('a,[data-page]');
          for (const el of all) {
            if ((el.textContent || '').toLowerCase().includes(text.toLowerCase())) {
              el.click(); return;
            }
          }
        }, linkText);
        await new Promise(r => setTimeout(r, 1800));
        await shot(page, outFile);
      }
    } catch(e) {
      console.log(`Nav to ${linkText}: ${e.message}`);
      await shot(page, outFile);
    }
  }

  await navTo('proyecto', 'cap03_proyectos.png');
  await navTo('proveedor', 'cap04_proveedores.png');
  await navTo('producto', 'cap05_productos.png');
  await navTo('compra', 'cap06_compras.png');
  await navTo('cotiz', 'cap07_cotizaciones.png');
  await navTo('salida', 'cap08_salidas.png');
  await navTo('usuario', 'cap09_usuarios.png');

  await browser.close();
  console.log('Done.');
})();
