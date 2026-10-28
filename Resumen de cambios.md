# Resumen de cambios — PROTOCEM

> Documento acumulativo. Esta versión documenta las **Tareas 1, 2, 3 y 4**.

**Fecha:** 27 de octubre de 2026

**Rama:** `develop`

**Alcance de esta versión:** Tarea 1 — Refactorización a arquitectura MVC por capas; Tarea 2 — Importador de presupuestos Opus; Tarea 3 — Configuración de entorno local y nube; Tarea 4 — Archivos de despliegue y documentación final.

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

- **Tarea 2:** completada — importador Excel de Opus, `multer`, `xlsx`, `uploads/`, rutas `/api/importacion/*`, estado `borrador` y vista frontend.
- **Tarea 3:** completada — `.env.example`, conexión por `DATABASE_URL` y SSL para nube.
- **Tarea 4:** completada — `Procfile`, `render.yaml`, `railway.json` y README de despliegue.

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

---

## 11. Tarea 2 — Importador de presupuestos Opus

### 11.1 Objetivo

Permitir que un administrador suba un presupuesto exportado de Opus en Excel, revise y ajuste los datos detectados y lo conserve como proyecto en estado `borrador`, sin crear partidas ni conceptos.

### 11.2 Alcance implementado

- Opción **Importar desde Opus** en el sidebar, visible únicamente para administradores.
- Carga de archivos `.xlsx` y `.xls` con Multer en memoria y límite configurable (`UPLOADS_MAX_SIZE`, 10 MB por defecto).
- Parser tolerante a variantes de encabezados, metadatos, fechas y números mexicanos.
- Vista previa temporal en `uploads/importaciones/<uuid>.json` con TTL configurable (`IMPORT_PREVIEW_TTL_MS`, 1 hora por defecto).
- Confirmación transaccional: proyecto `borrador` → proveedor técnico → un `PRODUCTO` por material → una `COTIZACION` por producto.
- Descarte de la vista previa temporal o del proyecto borrador, con limpieza en orden `COTIZACION → PRODUCTO sin referencias → PROVEEDOR → PROYECTO`.
- UI con drag & drop, tabla de materiales, resumen de presupuesto y confianza, advertencias, edición de nombre/fecha/presupuesto/zona y acciones **Conservar proyecto** / **Descartar**.
- Estado `borrador` agregado al ENUM de `PROYECTO.estado` mediante una migración idempotente.
- Sin cambios en `PARTIDA`, `CONCEPTO` ni en la estructura de presupuestos.

### 11.3 Endpoints

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| `POST` | `/api/importacion/preview` | `multipart/form-data`, campo `archivo` | `201 { id, archivo, expira_en, ttl_ms, preview }` |
| `POST` | `/api/importacion/confirmar` | `{ id, nombre_obra?, fecha_inicio?, presupuesto_total?, zona? }` | `201 { id_proyecto, id_proveedor, estado: 'borrador', materiales_importados, total_importado }` |
| `DELETE` | `/api/importacion/:id` | UUID del preview o id numérico del proyecto borrador | `200 { message, ... }` |

Todas las rutas usan `auth` + `requireRol('administrador')`. Sin token responden `401`; con un rol distinto responden `403`.

### 11.4 Archivos creados

- `src/utils/opusParser.js`
- `src/middlewares/uploadExcel.js`
- `src/repositories/importacion.repository.js`
- `src/services/importacion.service.js`
- `src/controllers/importacion.controller.js`
- `src/routes/importacion.routes.js`
- `test/opusParser.test.js`
- `public/js/pages/importacion.js`
- `uploads/.gitkeep`
- `uploads/importaciones/.gitkeep`

### 11.5 Archivos modificados

- `config.js`: `importPreviewDir`, `importPreviewTtlMs` e `importMaxRows`.
- `package.json` y `package-lock.json`: dependencia `multer` y script `npm test`.
- `src/config/database.js`: ENUM `borrador` y migración idempotente.
- `src/middlewares/errorHandler.js`: traducción de errores de Multer.
- `src/routes/index.js`: registro de `/api/importacion`.
- `.gitignore`: exclusión de los temporales de importación y conservación de los `.gitkeep`.
- `public/index.html`: opción del sidebar y carga de `importacion.js`.
- `public/js/app.js`: registro de la vista, guard de administrador y visibilidad correcta de `.nav-admin`.
- `public/js/utils.js`: `estadoBadge` pinta `borrador`.
- `public/css/app.css`: estilos de drop zone, resumen, tabla, advertencias, acciones y badge `borrador`.
- `Resumen de cambios.md`: este documento.

### 11.6 Decisiones de diseño

- **Proveedor técnico por importación:** `empresa = 'IMPORTACION_OPUS:<id_proyecto>'` y `especialidad = 'importacion_opus'`. Así cada proyecto conserva sus propias cotizaciones y el descarte no toca datos de otros proyectos.
- **Vista previa temporal:** el Excel nunca se guarda en disco; solo se persiste el JSON parseado. El cliente recibe un UUID para confirmar o descartar.
- **Confirmación transaccional:** si falla cualquier inserción, no queda ningún registro parcial. El preview se conserva si la transacción falla para permitir reintentos.
- **Descarte seguro:** un proyecto solo se elimina si sigue en `borrador` y no tiene compras ni salidas. Los productos solo se eliminan si ya no tienen cotizaciones, compras, salidas ni referencias en APU.
- **Validaciones de confirmación:** nombre ≤ 200 caracteres, fecha real, presupuesto ≥ 0, zona válida (`Norte`, `Frontera`, `Turístico`, `Centro`, `Sur`) y recálculo de materiales.
- **Doble confirmación:** bloqueo en memoria por UUID para evitar solicitudes simultáneas.
- **Frontend:** se reutiliza el patrón de páginas globales (`renderX`) y los helpers existentes. El upload usa `fetch` manual porque `API.post` solo envía JSON; la confirmación y el descarte usan `API.post` / `API.delete`.
- **Acceso:** además de ocultar la opción del sidebar, `navigate('importacion')` valida el rol para impedir el acceso desde consola.

### 11.7 Verificación realizada

| Comprobación | Resultado |
|---|---|
| `node --check` de parser, repositorio, servicio, controlador, rutas y frontend | OK |
| `require('./src/app')` | OK |
| `npm test` | **25/25 pruebas del parser** |
| Integración HTTP + BD del backend | **48/48 comprobaciones** |
| `npm start` en puerto 3101 | Arrancó correctamente; puerto liberado al terminar |
| Flujo UI como administrador | Login, sidebar visible, drag & drop, preview, edición, confirmación y redirección a Proyectos |
| Persistencia del flujo UI | Proyecto `borrador`, proveedor técnico, 3 productos y 3 cotizaciones verificados en BD |
| Badge del proyecto importado | `badge-borrador` renderizado correctamente en Proyectos |
| Descarte desde la UI | Vista previa eliminada, drop zone restaurada y sin proyecto creado |
| Usuario sin permisos | Opción oculta y `navigate('importacion')` bloqueado con aviso |
| Archivo no permitido | Rechazado en el cliente sin abandonar la drop zone |
| Errores de consola del navegador | 0 |
| Limpieza posterior | Sin proyectos, proveedores, productos, cotizaciones ni temporales de prueba |

> No se dispone de un `.xlsx` real exportado por Opus. Las pruebas se hicieron con fixtures sintéticos que cubren metadatos, materiales, subtotales, advertencias, formatos numéricos y fechas.

### 11.8 Cómo usar la importación

1. Iniciar sesión con un usuario administrador.
2. Abrir **Importar desde Opus** en el sidebar.
3. Arrastrar el archivo `.xlsx`/`.xls` a la zona de carga o hacer clic para seleccionarlo.
4. Revisar materiales, presupuesto, confianza y advertencias.
5. Ajustar nombre de obra, fecha de inicio, presupuesto y zona si hace falta.
6. Pulsar **Conservar proyecto** para crear el proyecto `borrador` y volver a Proyectos.
7. Pulsar **Descartar** para eliminar la vista previa temporal y empezar de nuevo.

> La vista previa se mantiene en memoria del navegador. Si se recarga la página, hay que volver a subir el archivo; el temporal anterior expira automáticamente por TTL.

### 11.9 Notas y pendientes

- **Tarea 3:** completada — `.env.example`, conexión por `DATABASE_URL` y SSL para nube.
- **Tarea 4:** completada — `Procfile`, `render.yaml`, `railway.json` y README de despliegue.
- El importador no crea `PARTIDA` ni `CONCEPTO`; los materiales quedan como productos y cotizaciones del proveedor técnico.
- El límite de filas del parser es configurable con `IMPORT_MAX_ROWS` (5000 por defecto).

---

## 12. Tarea 3 — Configuración de entorno (local y nube)

### 12.1 Objetivo

Centralizar la configuración en variables de entorno, documentar todos los valores necesarios y permitir que la aplicación se conecte a MySQL de dos formas:

- **Local:** parámetros individuales (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).
- **Nube:** una URL unificada (`DATABASE_URL`), con soporte de SSL.

### 12.2 Archivo `.env.example`

Se creó `.env.example` en la raíz con valores de ejemplo seguros y comentarios para cada variable:

| Variable | Valor de ejemplo | Descripción |
|---|---|---|
| `NODE_ENV` | `development` | Entorno de ejecución (`development`, `production`, `test`). |
| `PORT` | `3000` | Puerto HTTP. |
| `DB_HOST` | `127.0.0.1` | Host de MySQL local. |
| `DB_PORT` | `3306` | Puerto de MySQL. |
| `DB_USER` | `root` | Usuario de MySQL. |
| `DB_PASSWORD` | *(vacío)* | Contraseña local; no se versiona. |
| `DB_NAME` | `protocem_db` | Base de datos. |
| `DB_POOL_SIZE` | `10` | Conexiones del pool. |
| `DATABASE_URL` | *(comentado)* | URL unificada; tiene prioridad sobre `DB_*`. |
| `DB_SSL` | `false` | Activa SSL (`true`, `required`, `verify-ca`, `verify-identity`). |
| `DB_SSL_REJECT_UNAUTHORIZED` | `true` | Valida el certificado del servidor. |
| `DB_SSL_CA` | *(comentado)* | Ruta al CA del proveedor. |
| `JWT_SECRET` | `dev-only-cambia-esta-clave-antes-de-produccion` | Clave de firma; en producción se rechaza el ejemplo o una clave menor a 32 caracteres. |
| `JWT_EXPIRES_IN` | `8h` | Vigencia del token. |
| `BCRYPT_ROUNDS` | `10` | Costo de bcrypt. |
| `CORS_ORIGIN` | `*` | Origen permitido; en producción, lista separada por comas. |
| `UPLOADS_MAX_SIZE` | `10485760` | Límite del Excel (10 MB). |
| `IMPORT_PREVIEW_TTL_MS` | `3600000` | TTL de la vista previa (1 hora). |
| `IMPORT_MAX_ROWS` | `5000` | Filas máximas del parser. |
| `OPUS_DATA_PATH` | *(comentado)* | Ruta opcional para `scripts/import-opus.js`. |

### 12.3 Conexión local vs. nube

**Local (parámetros individuales):**

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=protocem_db
DB_SSL=false
```

**Nube (URL unificada):**

```dotenv
DATABASE_URL=mysql://usuario:contrasena@host:3306/protocem_db?ssl=true
```

`DATABASE_URL` tiene prioridad sobre `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME`. El parser acepta `mysql://` y `mysql2://`, contraseñas codificadas y estos parámetros de SSL: `ssl`, `sslmode`, `ssl-mode` y `ssl_mode`.

### 12.4 Soporte SSL

- `DB_SSL=true` o `required`: activa TLS.
- `DB_SSL=verify-ca`: valida el CA sin verificar el nombre del host.
- `DB_SSL=verify-identity`: valida CA y nombre del host.
- `DB_SSL_REJECT_UNAUTHORIZED` controla la validación del certificado; por defecto es `true`.
- `DB_SSL_CA` acepta una ruta relativa/absoluta al PEM o el PEM directamente en la variable.
- La URL también acepta JSON, por ejemplo `?ssl={"rejectUnauthorized":false}`.

### 12.5 Archivos creados

- `.env.example`

### 12.6 Archivos modificados

- `config.js`: parseo de `DATABASE_URL`, SSL configurable, validación de `JWT_SECRET` en producción, lectura explícita del `.env` de la raíz y origen de configuración (`databaseSource`).
- `src/config/database.js`: mensaje de error de conexión con host, base de datos, origen y estado SSL.
- `.gitignore`: `.env`, `.env.*` ignorados y `.env.example` conservado.
- `Resumen de cambios.md`: este documento.

### 12.7 Verificación realizada

| Comprobación | Resultado |
|---|---|
| `node --check config.js` | OK |
| `node --check src/config/database.js` | OK |
| `node --check server.js` | OK |
| `node --check src/app.js` | OK |
| Configuración con parámetros individuales | Host, puerto, usuario, contraseña, base y pool correctos |
| Configuración con `DATABASE_URL` | URL parseada y prioridad sobre `DB_*` verificada |
| `DATABASE_URL` con `?ssl=true` | SSL activado con `rejectUnauthorized: true` |
| `DATABASE_URL` con `?sslmode=require` | SSL activado |
| `DATABASE_URL` con `?ssl={"rejectUnauthorized":false}` | JSON respetado |
| `DATABASE_URL` con esquema `mysql2://` | Aceptado |
| `DB_SSL=true` + `DB_SSL_REJECT_UNAUTHORIZED=false` | SSL activado sin validación estricta |
| `DB_SSL=verify-ca` | Validación de CA y `checkServerIdentity` configurados |
| `DB_SSL_CA` con archivo PEM | Cargado correctamente |
| `DB_SSL_CA` inexistente | Error claro de configuración |
| `DATABASE_URL` inválida | Error claro de configuración |
| Esquema distinto de MySQL | Error claro de configuración |
| `DB_SSL` con valor desconocido | Error claro de configuración |
| `JWT_SECRET` de ejemplo o corto en producción | Rechazado |
| `.env.example` parseado por `dotenv` | 17 variables activas, sin `DATABASE_URL` activo |
| `.env.example` sin secretos reales | Confirmado |
| `.env` ignorado por Git | Confirmado |
| `.env.example` versionable | Confirmado con `git add -n` |
| Conexión real con `DB_*` | `SELECT 1` correcto |
| Conexión real con `DATABASE_URL` | `SELECT 1` correcto |
| Arranque con `DATABASE_URL` en puerto 3102 | `GET /` → 200 y login con token emitido; puerto liberado |
| `npm test` | **25/25** |

### 12.8 Cómo usar

1. Copiar `.env.example` a `.env`.
2. Para local, mantener `DB_*` y `DB_SSL=false`.
3. Para nube, definir `DATABASE_URL` y `DB_SSL=true` (o `required`).
4. Si el proveedor requiere CA, definir `DB_SSL_CA`.
5. Generar un `JWT_SECRET` real:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

6. Ejecutar `npm start`.

> `.env` está ignorado por Git. Nunca se versionan credenciales reales.

### 12.9 Notas y pendientes

- **Tarea 4:** completada — `Procfile`, `render.yaml`, `railway.json` y README de despliegue.
- En producción se recomienda `NODE_ENV=production`, `DB_SSL=true` y `CORS_ORIGIN` restringido.
- Si el proveedor de nube entrega la URL con parámetros adicionales, solo se interpretan los relacionados con SSL; el resto se ignora.

---

## 13. Tarea 4 — Archivos de despliegue y documentación final

### 13.1 Objetivo

Cerrar el proyecto con los artefactos necesarios para desplegar la aplicación en plataformas PaaS y con un README único que permita instalar, ejecutar, entender y publicar el sistema.

### 13.2 Archivos de despliegue creados

| Archivo | Contenido | Uso |
|---|---|---|
| `Procfile` | `web: node server.js` | Plataformas compatibles con Procfile (Heroku o similares). |
| `render.yaml` | Blueprint de Render con servicio web Node, build `npm ci`, start `npm start`, health check `/` y variables de producción. | Despliegue reproducible en Render. |
| `railway.json` | Configuración de build y deploy para Railway con `RAILPACK`, `npm ci`, `npm start`, health check `/` y reinicio `ON_FAILURE`. | Despliegue en Railway. |

**Render (`render.yaml`):**

- Servicio `web` con runtime `node`, plan `free` y región `oregon`.
- `buildCommand: npm ci` y `startCommand: npm start`.
- `healthCheckPath: /` y `autoDeployTrigger: commit`.
- `NODE_ENV=production`.
- `DATABASE_URL` y `CORS_ORIGIN` como secretos solicitados al sincronizar (`sync: false`).
- `JWT_SECRET` generado por Render (`generateValue: true`).
- `DB_SSL=true` y `DB_SSL_REJECT_UNAUTHORIZED=true`.
- Límites de importación y `BCRYPT_ROUNDS` explícitos.
- `PUPPETEER_SKIP_DOWNLOAD=true` para no descargar Chromium en el build.

> Render no ofrece MySQL administrado: su base nativa es PostgreSQL. El Blueprint no crea base de datos; `DATABASE_URL` debe apuntar a un MySQL externo con SSL (PlanetScale, Aiven, Railway MySQL u otro).

**Railway (`railway.json`):**

- Builder `RAILPACK`.
- Build `npm ci` y start `npm start`.
- Health check `/` con timeout de 300 segundos.
- Reinicio automático `ON_FAILURE` hasta 10 intentos.

**Procfile:**

```text
web: node server.js
```

### 13.3 README final

Se reescribió `README.md` con:

- Descripción del proyecto, cliente, asesor y equipo.
- Características principales y roles.
- Tecnologías y requisitos previos.
- Instalación local paso a paso y creación de la base de datos.
- Credenciales de prueba del seed.
- Tabla completa de variables de entorno.
- Conexión local con `DB_*` y conexión en nube con `DATABASE_URL`.
- Comandos `npm install`, `npm start`, `npm run dev` y `npm test`.
- Arquitectura MVC por capas y flujo de una petición.
- Módulos principales y rutas de la API.
- Flujo de importación desde Opus, endpoints y reglas.
- Pruebas y cobertura funcional del parser.
- Despliegue en Render y Railway paso a paso.
- Estructura del repositorio, seguridad, solución de problemas, entregables y créditos.

### 13.4 Decisiones de despliegue

- **MySQL externo:** Render no ofrece MySQL administrado; la aplicación sigue usando MySQL mediante `DATABASE_URL`.
- **SSL en la nube:** `DB_SSL=true` y validación de certificado activa por defecto.
- **Secretos fuera del repositorio:** `DATABASE_URL`, `CORS_ORIGIN` y `JWT_SECRET` se configuran en el panel de cada plataforma; `.env` sigue ignorado.
- **Puppeteer solo local:** se omite la descarga de Chromium en producción porque las capturas no forman parte del runtime.
- **Almacenamiento efímero:** las vistas previas de importación viven en `uploads/importaciones`; se documenta que se pierden al reiniciar y que se requiere disco persistente o almacenamiento externo para conservarlas.
- **Un solo servicio:** el frontend se sirve desde Express, por lo que no se despliega un servicio estático separado.

### 13.5 Verificación final

| Comprobación | Resultado |
|---|---|
| `node --check config.js` | OK |
| `node --check src/config/database.js` | OK |
| `node --check server.js` | OK |
| `node --check src/app.js` | OK |
| `railway.json` parseado con `JSON.parse` | OK |
| Contenido exacto de `Procfile` | `web: node server.js` |
| `render.yaml` parseado con `js-yaml` | YAML válido: servicio web Node, build, start y health check presentes |
| `npm test` | **25/25** |
| Arranque real en el puerto 3103 | `GET /` → 200 |
| Login real con `admin@protocem.mx` | Token emitido, rol `administrador` |
| Puerto 3103 después de la prueba | Libre |
| `git diff --check` | Sin errores |

### 13.6 Estado final del proyecto

| Tarea | Estado | Commit |
|---|---|---|
| Tarea 1 — Arquitectura MVC por capas | Completada | `66e7fc9` |
| Tarea 2 — Importador de presupuestos Opus | Completada | `88a8a15` |
| Tarea 3 — Configuración de entorno local y nube | Completada | `f85cb39` |
| Tarea 4 — Despliegue y documentación final | Completada | Commit de cierre de esta tarea |

**Resultado:**

- Backend Express organizado en rutas, controladores, servicios, repositorios y configuración.
- Frontend SPA servido por el mismo proceso.
- MySQL local o en nube, con SSL y `DATABASE_URL`.
- Importación de presupuestos Opus con vista previa y confirmación transaccional.
- 25 pruebas automatizadas del parser.
- Archivos de despliegue para Render y Railway, más `Procfile` para plataformas compatibles.
- README y resumen de cambios actualizados.
- `.env` fuera del control de versiones; solo se versiona `.env.example`.

### 13.7 Cierre

Con la Tarea 4 se cierra el alcance solicitado. El repositorio queda en la rama `develop`, con las cuatro tareas completadas, un commit atómico por tarea y el árbol de trabajo limpio. Los pasos pendientes para una puesta en producción real son externos al código: crear el MySQL administrado, configurar los secretos en la plataforma, generar el dominio público, cambiar las contraseñas del seed y, si se requiere persistencia de vistas previas, montar un disco o almacenamiento externo.
