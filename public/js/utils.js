/* ===== API ===== */
const API = {
  token: null,
  user: null,

  init() {
    const stored = localStorage.getItem('protocem_token');
    const user   = localStorage.getItem('protocem_user');
    if (stored && user) {
      this.token = stored;
      this.user  = JSON.parse(user);
      return true;
    }
    return false;
  },

  login(token, userData) {
    this.token = token;
    this.user  = userData;
    localStorage.setItem('protocem_token', token);
    localStorage.setItem('protocem_user', JSON.stringify(userData));
  },

  logout() {
    this.token = null;
    this.user  = null;
    localStorage.removeItem('protocem_token');
    localStorage.removeItem('protocem_user');
  },

  async get(url) {
    const res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + this.token }
    });
    if (res.status === 401 || res.status === 403) {
      this.logout();
      location.reload();
      return;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error del servidor');
    return data;
  },

  async post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this.token
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error del servidor');
    return data;
  },

  async put(url, body) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this.token
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error del servidor');
    return data;
  },

  async delete(url) {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + this.token }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error del servidor');
    return data;
  }
};

/* ===== HELPERS ===== */
function $(id) { return document.getElementById(id); }

function fmt(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtN(n, dec = 2) {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: dec }).format(n);
}

function fmtDate(d) {
  if (!d) return '—';
  const str = String(d).slice(0, 10);
  const dt = new Date(str + 'T12:00:00');
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/* ===== BADGES ===== */
function badge(cls, text) {
  return `<span class="badge ${cls}">${text}</span>`;
}

function estadoBadge(estado) {
  const map = { activo: 'badge-green', pausado: 'badge-yellow', finalizado: 'badge-gray' };
  return badge(map[estado] || 'badge-gray', estado);
}

function rolBadge(rol) {
  const map = { administrador: 'badge-orange', encargado: 'badge-blue', solo_lectura: 'badge-gray' };
  const labels = { administrador: 'Admin', encargado: 'Encargado', solo_lectura: 'Lectura' };
  return badge(map[rol] || 'badge-gray', labels[rol] || rol);
}

function tipoSalidaBadge(tipo) {
  const map = { consumo: 'badge-blue', merma: 'badge-yellow', robo: 'badge-red', prestamo: 'badge-purple' };
  return badge(map[tipo] || 'badge-gray', tipo);
}

function desvBadge(pct) {
  if (pct == null) return badge('badge-gray', '—');
  const cls = pct > 15 ? 'badge-red' : pct > 5 ? 'badge-yellow' : 'badge-green';
  const sign = pct > 0 ? '+' : '';
  return badge(cls, `${sign}${pct}%`);
}

/* ===== PROGRESS BAR ===== */
function progressBar(pct, color = 'accent', showLabel = true) {
  const clamped = Math.min(100, Math.max(0, pct || 0));
  const colorClass = color === 'auto'
    ? (clamped >= 90 ? 'red' : clamped >= 70 ? 'yellow' : 'accent')
    : color;
  const label = showLabel ? `<div class="progress-labels"><span></span><span>${fmtN(clamped, 1)}%</span></div>` : '';
  return `<div class="progress-wrap">
    ${label}
    <div class="progress-bar-bg">
      <div class="progress-bar-fill ${colorClass}" style="width:${clamped}%"></div>
    </div>
  </div>`;
}

/* ===== LOADING / EMPTY ===== */
function loading() {
  return `<div class="loading-wrap"><div class="spinner"></div></div>`;
}

function empty(msg = 'Sin datos') {
  return `<div class="empty-state"><p>${msg}</p></div>`;
}

/* ===== MODAL ===== */
function openModal(title, bodyHtml, large = false) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = bodyHtml;
  const modal = $('modal');
  if (large) modal.classList.add('modal-lg');
  else modal.classList.remove('modal-lg');
  $('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  $('modal-overlay').classList.add('hidden');
  $('modal-body').innerHTML = '';
}

/* ===== TOAST ===== */
let toastTimer = null;
function toast(msg, type = 'info') {
  const el = $('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

/* ===== UNDO ===== */
window._undoStack = [];
let _undoBarTimer = null;
let _undoBarInterval = null;

function pushUndo(op) {
  _undoStack.push(op);
  if (_undoStack.length > 5) _undoStack.shift();
  _showUndoBar(op.descripcion);
}

function _showUndoBar(msg) {
  const bar = $('undo-bar');
  if (!bar) return;
  $('undo-msg').textContent = msg;
  bar.classList.remove('hidden');
  let secs = 10;
  $('undo-secs').textContent = secs;
  if (_undoBarInterval) clearInterval(_undoBarInterval);
  if (_undoBarTimer)    clearTimeout(_undoBarTimer);
  _undoBarInterval = setInterval(() => {
    secs--;
    const el = $('undo-secs');
    if (el) el.textContent = secs;
    if (secs <= 0) _hideUndoBar();
  }, 1000);
  _undoBarTimer = setTimeout(_hideUndoBar, 10500);
}

function _hideUndoBar() {
  if (_undoBarInterval) { clearInterval(_undoBarInterval); _undoBarInterval = null; }
  if (_undoBarTimer)    { clearTimeout(_undoBarTimer);    _undoBarTimer    = null; }
  const bar = $('undo-bar');
  if (bar) bar.classList.add('hidden');
}

async function executeUndo() {
  if (!_undoStack.length) return;
  const op = _undoStack.pop();
  _hideUndoBar();
  try {
    await op.undoFn();
    if (_undoStack.length) _showUndoBar(_undoStack[_undoStack.length - 1].descripcion);
  } catch (e) { toast('No se pudo deshacer: ' + e.message, 'error'); }
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    if (_undoStack.length) { e.preventDefault(); executeUndo(); }
  }
});

/* ===== ESCAPE HTML ===== */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ===== TOOLTIPS ===== */
function initTooltips() {
  const tip = document.createElement('div');
  tip.id = 'g-tip';
  document.body.appendChild(tip);

  function show(el) {
    const html = el.dataset.tip;
    if (!html) { tip.classList.remove('show'); return; }
    tip.innerHTML = html;
    tip.classList.remove('show');

    requestAnimationFrame(() => {
      const r  = el.getBoundingClientRect();
      const tw = tip.offsetWidth  || 220;
      const th = tip.offsetHeight || 40;
      let top  = r.top - th - 10;
      let left = r.left + r.width / 2 - tw / 2;
      if (top < 6) top = r.bottom + 10;
      if (left < 6) left = 6;
      if (left + tw > window.innerWidth - 6) left = window.innerWidth - tw - 6;
      tip.style.top  = top  + 'px';
      tip.style.left = left + 'px';
      tip.classList.add('show');
    });
  }

  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-tip]');
    if (el) show(el); else tip.classList.remove('show');
  });
  document.addEventListener('scroll', () => tip.classList.remove('show'), { passive: true });
}
