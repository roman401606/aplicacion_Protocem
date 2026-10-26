async function renderUsuarios() {
  const content = $('page-content');
  if (API.user.rol !== 'administrador') {
    content.innerHTML = `<div class="alert alert-warn">Acceso restringido a administradores.</div>`;
    return;
  }
  try {
    const usuarios = await API.get('/api/usuarios');
    content.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Usuarios</div>
          <div class="page-subtitle">${usuarios.length} usuario(s) registrados</div>
        </div>
        <button class="btn-primary" onclick="showNuevoUsuario()">+ Nuevo usuario</button>
      </div>
      <div class="card">
        <div class="table-wrap">
          ${usuarios.length === 0 ? empty('Sin usuarios') : `
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${usuarios.map(u => `<tr>
                <td class="td-small">${u.id_usuario}</td>
                <td style="font-weight:500">${u.nombre_usuario}</td>
                <td class="td-small">${u.correo}</td>
                <td>${rolBadge(u.rol)}</td>
                <td>${u.activo ? badge('badge-green','Activo') : badge('badge-gray','Inactivo')}</td>
              </tr>`).join('')}
            </tbody>
          </table>`}
        </div>
      </div>`;
  } catch (e) {
    content.innerHTML = `<div class="alert alert-warn">${e.message}</div>`;
  }
}

function showNuevoUsuario() {
  const html = `
    <div class="form-group">
      <label>Nombre completo *</label>
      <input type="text" id="u-nombre" placeholder="Ing. Juan Pérez" />
    </div>
    <div class="form-group">
      <label>Correo electrónico *</label>
      <input type="email" id="u-correo" placeholder="juan@protocem.mx" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Rol *</label>
        <select id="u-rol">
          <option value="administrador">Administrador</option>
          <option value="encargado" selected>Encargado</option>
          <option value="solo_lectura">Solo lectura</option>
        </select>
      </div>
      <div class="form-group">
        <label>Contraseña *</label>
        <input type="password" id="u-pass" placeholder="Mínimo 6 caracteres" autocomplete="new-password" />
      </div>
    </div>
    <div class="modal-footer" style="padding:0;border:none;margin-top:8px;">
      <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn-primary" onclick="saveUsuario()">Crear usuario</button>
    </div>`;
  openModal('Nuevo usuario', html);
}

async function saveUsuario() {
  const nombre_usuario = $('u-nombre').value.trim();
  const correo         = $('u-correo').value.trim();
  const rol            = $('u-rol').value;
  const contrasena     = $('u-pass').value;

  if (!nombre_usuario || !correo || !rol || !contrasena) {
    return toast('Todos los campos son obligatorios', 'error');
  }
  if (contrasena.length < 6) {
    return toast('La contraseña debe tener al menos 6 caracteres', 'error');
  }
  try {
    await API.post('/api/usuarios', { nombre_usuario, correo, rol, contrasena });
    toast('Usuario creado correctamente', 'success');
    closeModal();
    renderUsuarios();
  } catch (e) { toast(e.message, 'error'); }
}
