/* ===== PAGES MAP ===== */
const PAGES = {
  dashboard:    renderDashboard,
  proyectos:    renderProyectos,
  compras:      renderCompras,
  salidas:      renderSalidas,
  inventario:   renderInventario,
  cotizaciones: renderCotizaciones,
  usuarios:     renderUsuarios,
  presupuesto:  renderPresupuesto,
  estimaciones: renderEstimaciones,
  catalogo:     renderCatalogo,
  importacion:  renderImportacion
};

let currentPage = 'dashboard';

/* ===== NAVIGATE ===== */
function navigate(page) {
  if (!PAGES[page]) return;

  if (page === 'importacion' && (!API.user || API.user.rol !== 'administrador')) {
    toast('Solo los administradores pueden importar desde Opus.', 'error');
    return;
  }

  currentPage = page;

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  const content = $('page-content');
  content.innerHTML = loading();
  PAGES[page]();
}

/* ===== INIT APP ===== */
function initApp() {
  const user = API.user;
  if (!user) return;

  $('user-name').textContent  = user.nombre;
  $('user-role').textContent  = user.rol.replace('_', ' ');
  $('user-avatar').textContent = (user.nombre || 'U')[0].toUpperCase();

  document.querySelectorAll('.nav-admin').forEach(el => {
    el.classList.toggle('hidden', user.rol !== 'administrador');
  });

  initTooltips();

  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigate(el.dataset.page);
    });
  });

  $('btn-logout').addEventListener('click', () => {
    API.logout();
    showLogin();
  });

  $('modal-close').addEventListener('click', closeModal);
  $('modal-overlay').addEventListener('click', e => {
    if (e.target === $('modal-overlay')) closeModal();
  });

  navigate('dashboard');
}

/* ===== SHOW LOGIN / SHOW APP ===== */
function showLogin() {
  $('login-screen').classList.remove('hidden');
  $('app').classList.add('hidden');
}

function showApp() {
  $('login-screen').classList.add('hidden');
  $('app').classList.remove('hidden');
  initApp();
}

/* ===== LOGIN FORM ===== */
$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const correo    = $('l-correo').value.trim();
  const contrasena = $('l-pass').value;
  const errEl     = $('login-error');
  const btn       = $('btn-login');

  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Ingresando...';

  try {
    const data = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, contrasena })
    });
    const json = await data.json();
    if (!data.ok) throw new Error(json.error || 'Error al iniciar sesión');
    API.login(json.token, { nombre: json.nombre, rol: json.rol, correo: json.correo });
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Iniciar sesión';
  }
});

/* ===== BOOT ===== */
if (API.init()) {
  showApp();
} else {
  showLogin();
}
