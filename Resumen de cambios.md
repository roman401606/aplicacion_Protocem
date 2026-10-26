# Resumen de cambios — PROTOCEM

> Documento acumulativo. En esta primera versión se documenta únicamente la **Tarea 1**. Las Tareas 2, 3 y 4 se agregarán al finalizar cada una.

**Fecha:** 26 de octubre de 2026  
**Rama:** `develop`  
**Alcance de esta versión:** Tarea 1 — Refactorización a arquitectura MVC por capas.

---

## 1. Objetivo de la Tarea 1

Reorganizar el backend de la aplicación PROTOCEM en una arquitectura MVC por capas:

```text
routes → controllers → services → repositories → MySQL
```

Sin romper ninguna funcionalidad existente:

- Mismas rutas y métodos HTTP.
- Mismos códigos de estado.
- Mismos mensajes y estructura de JSON.
- Mismo frontend en `public/`.
- Misma base de datos.

---

## 2. Situación inicial encontrada

| Elemento | Estado inicial |
|---|---|
| Punto de entrada | `server.js` con configuración de Express y arranque mezclados |
| Acceso a BD | `db/database.js` con pool, DDL y seed |
| Autenticación | `middleware/auth.js` |
| Rutas | `routes/auth.js`, `dashboard.js`, `proyectos.js`, `partidas.js`, `estimaciones.js`, `catalogo.js`, `api.js` |
| Lógica de negocio | Mezclada dentro de las rutas |
| Endpoints reales | **46**, no solo los módulos básicos |
| Tablas reales | **20**, incluyendo `PARTIDA`, `CONCEPTO`, `APU_*`, `ESTIMACION`, `CATALOGO_CONCEPTO`, etc. |
| Frontend | `public/` completo y funcional |

### Hallazgos relevantes

1. El proyecto ya incluía módulos adicionales a los 9 originales. Para no romper el frontend fue necesario refactorizar también:
   - `partidas`
   - `estimaciones`
   - `catalogo`
   - `usuarios`
   - `dashboard`
2. La raíz del proyecto no tenía `node_modules` ni `.env`.
3. La base local acepta `root/admin`; no acepta `root/protocem123`.
4. Existe una carpeta duplicada `Protocem - copia/` registrada como submódulo. **No fue modificada.**

---

## 3. Arquitectura implementada

```text
protocem-app/
├── src/
│   ├── app.js
│   ├── config/
│   │   └── database.js
│   ├── middlewares/
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── repositories/
│   │   ├── base.repository.js
│   │   ├── usuario.repository.js
│   │   ├── proyecto.repository.js
│   │   ├── compra.repository.js
│   │   ├── producto.repository.js
│   │   ├── proveedor.repository.js
│   │   ├── cotizacion.repository.js
│   │   ├── salida.repository.js
│   │   ├── dashboard.repository.js
│   │   ├── catalogo.repository.js
│   │   ├── partida.repository.js
│   │   └── estimacion.repository.js
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── usuario.service.js
│   │   ├── dashboard.service.js
│   │   ├── proyecto.service.js
│   │   ├── compra.service.js
│   │   ├── producto.service.js
│   │   ├── proveedor.service.js
│   │   ├── cotizacion.service.js
│   │   ├── salida.service.js
│   │   ├── catalogo.service.js
│   │   ├── partida.service.js
│   │   └── estimacion.service.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── usuario.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── proyecto.controller.js
│   │   ├── compra.controller.js
│   │   ├── producto.controller.js
│   │   ├── proveedor.controller.js
│   │   ├── cotizacion.controller.js
│   │   ├── salida.controller.js
│   │   ├── catalogo.controller.js
│   │   ├── partida.controller.js
│   │   └── estimacion.controller.js
│   ├── routes/
│   │   ├── index.js
│   │   ├── auth.routes.js
│   │   ├── usuario.routes.js
│   │   ├── dashboard.routes.js
│   │   ├── proyecto.routes.js
│   │   ├── compra.routes.js
│   │   ├── producto.routes.js
│   │   ├── proveedor.routes.js
│   │   ├── cotizacion.routes.js
│   │   ├── salida.routes.js
│   │   ├── catalogo.routes.js
│   │   ├── partida.routes.js
│   │   └── estimacion.routes.js
│   └── utils/
│       └── http.js
├── public/                 (sin cambios)
├── config.js
├── server.js
└── package.json            (sin cambios en esta tarea)
```

### Regla aplicada por capa

| Capa | Responsabilidad |
|---|---|
| `routes` | Declarar endpoints, aplicar `auth`/`requireRol` y conectar con controllers |
| `controllers` | Extraer `req`, llamar al service y responder con `res.json()` |
| `services` | Validaciones, reglas de negocio, cálculos y transacciones |
| `repositories` | Únicamente SQL y acceso a datos |
| `config` | Pool MySQL, `initDB`, variables de entorno |
| `middlewares` | JWT, roles y manejo global de errores |

---

## 4. Archivos creados

### Configuración e infraestructura

- `config.js`
- `src/app.js`
- `src/config/database.js`
- `src/middlewares/auth.js`
- `src/middlewares/errorHandler.js`
- `src/utils/http.js`

### Repositories

- `src/repositories/base.repository.js`
- `src/repositories/usuario.repository.js`
- `src/repositories/proyecto.repository.js`
- `src/repositories/compra.repository.js`
- `src/repositories/producto.repository.js`
- `src/repositories/proveedor.repository.js`
- `src/repositories/cotizacion.repository.js`
- `src/repositories/salida.repository.js`
- `src/repositories/dashboard.repository.js`
- `src/repositories/catalogo.repository.js`
- `src/repositories/partida.repository.js`
- `src/repositories/estimacion.repository.js`

### Services

- `src/services/auth.service.js`
- `src/services/usuario.service.js`
- `src/services/dashboard.service.js`
- `src/services/proyecto.service.js`
- `src/services/compra.service.js`
- `src/services/producto.service.js`
- `src/services/proveedor.service.js`
- `src/services/cotizacion.service.js`
- `src/services/salida.service.js`
- `src/services/catalogo.service.js`
- `src/services/partida.service.js`
- `src/services/estimacion.service.js`

### Controllers

- `src/controllers/auth.controller.js`
- `src/controllers/usuario.controller.js`
- `src/controllers/dashboard.controller.js`
- `src/controllers/proyecto.controller.js`
- `src/controllers/compra.controller.js`
- `src/controllers/producto.controller.js`
- `src/controllers/proveedor.controller.js`
- `src/controllers/cotizacion.controller.js`
- `src/controllers/salida.controller.js`
- `src/controllers/catalogo.controller.js`
- `src/controllers/partida.controller.js`
- `src/controllers/estimacion.controller.js`

### Routes

- `src/routes/index.js`
- `src/routes/auth.routes.js`
- `src/routes/usuario.routes.js`
- `src/routes/dashboard.routes.js`
- `src/routes/proyecto.routes.js`
- `src/routes/compra.routes.js`
- `src/routes/producto.routes.js`
- `src/routes/proveedor.routes.js`
- `src/routes/cotizacion.routes.js`
- `src/routes/salida.routes.js`
- `src/routes/catalogo.routes.js`
- `src/routes/partida.routes.js`
- `src/routes/estimacion.routes.js`

---

## 5. Archivos modificados

- `server.js`
  - Quedó reducido al arranque del servidor.
  - Carga `config.js`, `initDB()` y la app Express.
  - Lee el puerto desde `config.port`, que a su vez lee `process.env.PORT`.
  - Agregó logs para `unhandledRejection` y `uncaughtException`.

---

## 6. Archivos eliminados

Se eliminó la implementación legacy para evitar lógica duplicada:

- `db/database.js`
- `middleware/auth.js`
- `routes/auth.js`
- `routes/dashboard.js`
- `routes/proyectos.js`
- `routes/partidas.js`
- `routes/estimaciones.js`
- `routes/catalogo.js`
- `routes/api.js`

Toda esa funcionalidad fue migrada a `src/`.

> `public/`, `scripts/import-opus.js`, `take_screenshots.js`, `take_screenshots_guia.js` y la carpeta duplicada `Protocem - copia/` no fueron modificados.

---

## 7. Decisiones de diseño

### 7.1 Mantener los 46 endpoints

La lista original de la Tarea 1 mencionaba solo 7 módulos. El frontend consume también `partidas`, `estimaciones`, `catalogo` y `usuarios`. Por eso se crearon repositories, services, controllers y routes adicionales para esos módulos.

**Resultado:** el contrato HTTP se conserva completo.

### 7.2 Repositories sin lógica de negocio

Los repositories solo ejecutan SQL. Los cálculos de totales, validaciones, semáforos, transacciones y valores por defecto viven en los services.

### 7.3 Transacciones sin filtrar el pool a los services

`base.repository.js` expone `withTransaction(callback)`. Los services de compras, salidas y estimaciones lo usan y reciben una conexión que pasan a los métodos del repository.

Así los services no importan `pool` directamente y se respeta la regla de capas.

### 7.4 Controladores delgados

Los controladores usan `asyncHandler` y tienen métodos de 3 a 5 líneas. No contienen validaciones ni cálculos.

### 7.5 Error handler global

- `AppError(status, message)` para errores de negocio.
- `asyncHandler` para capturar promesas rechazadas en Express 4.
- `errorHandler` responde siempre JSON estructurado `{ error: "..." }`.
- En producción oculta mensajes internos de errores 500.
- Conserva el fallback SPA actual para rutas no API.

### 7.6 Configuración centralizada

`config.js` centraliza:

- `NODE_ENV`
- `PORT`
- Conexión MySQL (`DATABASE_URL` o variables separadas)
- `DB_SSL` y tamaño del pool
- `JWT_SECRET` y expiración
- CORS
- Directorio y tamaño máximo de uploads (preparado para Tarea 2)
- Rondas de bcrypt

No quedaron contraseñas, IPs ni rutas absolutas hardcodeadas en el código de la aplicación.

### 7.7 `.env` local no versionado

Se creó un `.env` local para pruebas con la contraseña que realmente acepta MySQL (`admin`). El archivo ya estaba contemplado en `.gitignore` y **no se versionó**.

> La contraseña `protocem123` indicada en el requerimiento no funciona en la instalación local actual. Se usó `admin` para poder verificar.

---

## 8. Verificación realizada

### 8.1 Sintaxis

- `node --check` sobre **56 archivos JavaScript**.
- Resultado: **sin errores de sintaxis**.

### 8.2 Comparación con la versión anterior

Se capturó una línea base JSON antes de refactorizar y se comparó después:

- Login admin.
- 18 endpoints GET representativos.
- Errores 401, 403, 400 y 404.
- Login de encargado y restricción de rol.
- Fallback SPA.
- Total: **31 comprobaciones**.
- Resultado: **sin diferencias de status ni de cuerpo JSON**.

### 8.3 Pruebas CRUD completas

Se creó una base temporal `protocem_db_test_t1`, se ejecutó `initDB()` y se probó la API completa:

- Proyectos: crear, consultar, actualizar avance, borrar, validaciones.
- Productos y proveedores: crear, listar, validaciones.
- Cotizaciones: crear, listar.
- Compras: crear, total calculado y aumento de stock.
- Salidas: crear y disminución de stock.
- Partidas: crear, listar, editar.
- Conceptos: crear, listar, editar, validaciones.
- APU: material, mano de obra, maquinaria y totales.
- Generadores: crear, resumen y porcentaje de avance.
- Explosión de insumos y resumen de presupuesto.
- Estimaciones: crear, listar, detalle, cambio de estado y acumulado.
- Usuarios: crear, listar y correo duplicado.
- Catálogo: crear, editar y filtrar.
- Seguridad: sin token, token inválido y rol insuficiente.

Resultado: **74 PASS, 0 FAIL**.

Adicionalmente se probaron los borrados de partida/concepto y la restricción de rol:

- `DELETE /api/partidas/conceptos/:id` → 200.
- `DELETE /api/partidas/:id` → 200.
- `DELETE /api/partidas/:id` con rol encargado → 403.
- `DELETE /api/proyectos/:id` → 200.

Resultado adicional: **4 PASS, 0 FAIL**.

La base temporal fue eliminada al terminar.

### 8.4 Arranque

- `npm start` ejecutado correctamente en el puerto 3000.
- `npm start` ejecutado también en el puerto 3101 con `DB_NAME` de prueba, verificando que `process.env.PORT` se respeta.
- `initDB()` funcionó tanto con la BD existente como con una BD vacía.

### 8.5 Frontend

- `git status --short public/` sin cambios.
- El servidor sigue sirviendo `public/index.html` y los assets estáticos.

---

## 9. Pendientes para las siguientes tareas

- **Tarea 2:** importador Excel de Opus, `multer`, `xlsx`, `uploads/`, rutas `/api/importacion/*`, estado `borrador` y vista frontend.
- **Tarea 3:** `.env.example` documentado y modo local vs nube.
- **Tarea 4:** `Procfile`, `render.yaml`, `railway.json` y README de despliegue.

---

## 10. Cómo ejecutar localmente

```bash
npm install
npm start
```

Abrir:

```text
http://localhost:3000
```

Usuario administrador:

```text
admin@protocem.mx / admin123
```
