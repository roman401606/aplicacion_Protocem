# PROTOCEM — Sistema de Gestión de Obras

**Proyectos Topográficos y Construcciones**<br>
Universidad Autónoma de Aguascalientes · Ingeniería de Requerimientos · 2025-B

Sistema web para la gestión integral de obras de construcción: proyectos, presupuesto, compras, salidas de almacén, inventario, cotizaciones, estimaciones y control de usuarios con roles diferenciados. Incluye un importador de presupuestos de Opus en Excel.

---

## Descripción del proyecto

PROTOCEM centraliza la operación diaria de una empresa constructora. La aplicación permite dar seguimiento al avance físico y financiero de cada obra, controlar el almacén, registrar compras y salidas de material, comparar cotizaciones de proveedores y administrar el presupuesto por partidas y conceptos.

El sistema está pensado para tres tipos de usuario:

| Rol | Alcance |
|---|---|
| `administrador` | Acceso completo: usuarios, catálogo, importación desde Opus y operación general. |
| `encargado` | Operación de proyectos, compras, salidas, inventario y estimaciones. |
| `solo_lectura` | Consulta de la información sin permisos de escritura. |

La interfaz es una SPA (aplicación de una sola página) servida por el mismo backend de Express. No requiere un servidor frontend separado.

---

## Características principales

- Autenticación con JWT y contraseñas protegidas con bcrypt.
- Dashboard con indicadores de proyectos, compras, salidas e inventario.
- Gestión de proyectos con estados `activo`, `pausado`, `finalizado` y `borrador`.
- Presupuesto por partidas, conceptos y análisis de precios unitarios (APU).
- Compras y salidas con detalle de productos y actualización de existencias.
- Inventario y catálogo de productos.
- Cotizaciones por proveedor y comparación de precios.
- Estimaciones por periodo, con detalle de conceptos y estados.
- Catálogo de conceptos de referencia (CMIC / BIMSA).
- Administración de usuarios y roles.
- Importación de presupuestos de Opus desde Excel, con vista previa y confirmación transaccional.
- Configuración por variables de entorno para MySQL local o en la nube.

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| Runtime | Node.js 20 LTS o superior |
| Backend | Express 4 |
| Base de datos | MySQL 8+ y `mysql2/promise` |
| Autenticación | JSON Web Tokens (`jsonwebtoken`) y `bcryptjs` |
| Carga de archivos | Multer en memoria y `xlsx` |
| Configuración | `dotenv` |
| Frontend | HTML, CSS y JavaScript vanilla |
| Pruebas | `node:test` |
| Capturas | Puppeteer (solo scripts locales, no se usa en el servidor) |

---

## Requisitos previos

- **Node.js 20 LTS** o superior.
- **npm 9** o superior.
- **MySQL 8** local o un servicio MySQL en la nube.
- **Git** para clonar el repositorio.
- Opcional: `nodemon` para desarrollo, incluido en `devDependencies`.

---

## Instalación local

1. Clonar el repositorio y entrar a la carpeta:

   ```bash
   git clone <url-del-repositorio>
   cd "Protocem - copia"
   ```

2. Instalar dependencias:

   ```bash
   npm install
   ```

3. Crear el archivo de configuración:

   ```bash
   cp .env.example .env
   ```

   En Windows:

   ```powershell
   copy .env.example .env
   ```

4. Editar `.env` con los datos de MySQL local:

   ```dotenv
   NODE_ENV=development
   PORT=3000
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=protocem_db
   DB_SSL=false
   JWT_SECRET=una-clave-aleatoria-de-al-menos-32-caracteres
   ```

5. Crear la base de datos si todavía no existe:

   ```sql
   CREATE DATABASE protocem_db
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci;
   ```

   La aplicación crea las tablas y los datos iniciales automáticamente al arrancar. El seed solo se ejecuta si la tabla `USUARIO` está vacía.

6. Iniciar el servidor:

   ```bash
   npm start
   ```

7. Abrir `http://localhost:3000`.

### Credenciales de prueba

| Correo | Contraseña | Rol |
|---|---|---|
| `admin@protocem.mx` | `admin123` | administrador |
| `encargado@protocem.mx` | `encargado123` | encargado |
| `velador@protocem.mx` | `lector123` | solo_lectura |

> Estas credenciales son datos de ejemplo del seed. Cámbialas antes de usar la aplicación en producción.

---

## Variables de entorno

La lista completa y comentada está en `.env.example`. Las variables principales son:

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `NODE_ENV` | `development` | Entorno de ejecución. |
| `PORT` | `3000` | Puerto HTTP; en la nube se usa el que asigne la plataforma. |
| `DB_HOST` | `127.0.0.1` | Host de MySQL cuando se usan parámetros individuales. |
| `DB_PORT` | `3306` | Puerto de MySQL. |
| `DB_USER` | `root` | Usuario de MySQL. |
| `DB_PASSWORD` | *(vacío)* | Contraseña de MySQL. |
| `DB_NAME` | `protocem_db` | Nombre de la base de datos. |
| `DB_POOL_SIZE` | `10` | Conexiones del pool. |
| `DATABASE_URL` | *(sin definir)* | URL unificada de MySQL; tiene prioridad sobre `DB_*`. |
| `DB_SSL` | `false` | Activa SSL (`true`, `required`, `verify-ca`, `verify-identity`). |
| `DB_SSL_REJECT_UNAUTHORIZED` | `true` | Valida el certificado del servidor. |
| `DB_SSL_CA` | *(sin definir)* | Ruta o contenido PEM del CA del proveedor. |
| `JWT_SECRET` | *(obligatorio)* | Clave de firma de los tokens; mínimo 32 caracteres en producción. |
| `JWT_EXPIRES_IN` | `8h` | Vigencia de los tokens. |
| `BCRYPT_ROUNDS` | `10` | Costo de bcrypt. |
| `CORS_ORIGIN` | `*` | Origen permitido; en producción usa una lista separada por comas. |
| `UPLOADS_MAX_SIZE` | `10485760` | Tamaño máximo del Excel (10 MB). |
| `IMPORT_PREVIEW_TTL_MS` | `3600000` | Vigencia de la vista previa de importación (1 hora). |
| `IMPORT_MAX_ROWS` | `5000` | Filas máximas que procesa el parser. |

### Conexión local con parámetros individuales

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=protocem_db
DB_SSL=false
```

### Conexión en la nube con `DATABASE_URL`

```dotenv
DATABASE_URL=mysql://usuario:contrasena@host:3306/protocem_db?ssl=true
DB_SSL=true
```

Si `DATABASE_URL` está definida, `config.js` ignora `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME`. Se aceptan los esquemas `mysql://` y `mysql2://`, contraseñas codificadas y los parámetros SSL `ssl`, `sslmode`, `ssl-mode` y `ssl_mode`.

Para generar un `JWT_SECRET` seguro:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Comandos de ejecución

| Comando | Descripción |
|---|---|
| `npm install` | Instala las dependencias del proyecto. |
| `npm start` | Inicia el servidor en el puerto configurado. |
| `npm run dev` | Inicia el servidor con `nodemon` y recarga automática. |
| `npm test` | Ejecuta las pruebas del parser de Opus con `node:test`. |

---

## Arquitectura MVC

El backend sigue una arquitectura por capas:

```text
HTTP
  │
  ▼
src/routes/*.routes.js
  │
  ▼
src/controllers/*.controller.js
  │
  ▼
src/services/*.service.js
  │
  ▼
src/repositories/*.repository.js
  │
  ▼
MySQL (mysql2/promise)
```

| Capa | Responsabilidad |
|---|---|
| `server.js` | Punto de entrada: inicializa la base de datos y levanta Express. |
| `config.js` | Lee y valida las variables de entorno; construye la configuración de MySQL y JWT. |
| `src/app.js` | Configura Express, CORS, archivos estáticos, rutas, fallback SPA y manejo de errores. |
| `src/routes/` | Define los endpoints y aplica middlewares de autenticación y roles. |
| `src/controllers/` | Recibe la petición HTTP, llama al servicio y devuelve la respuesta. |
| `src/services/` | Contiene reglas de negocio, validaciones y transacciones. |
| `src/repositories/` | Ejecuta las consultas SQL parametrizadas. |
| `src/config/database.js` | Crea el pool, las tablas, las migraciones idempotentes y el seed inicial. |
| `src/middlewares/` | Autenticación JWT, autorización por rol, carga de Excel y errores. |
| `src/utils/` | Utilidades HTTP y parser de presupuestos de Opus. |
| `public/` | SPA: HTML, CSS y módulos JavaScript por página. |

### Flujo de una petición

1. Express recibe la petición en `src/app.js`.
2. La ruta correspondiente valida el token y el rol.
3. El controlador extrae los datos y llama al servicio.
4. El servicio aplica las reglas de negocio y usa uno o más repositorios.
5. El repositorio ejecuta SQL parametrizado contra MySQL.
6. La respuesta vuelve al controlador y se envía como JSON.

---

## Módulos principales

| Módulo | Rutas | Descripción |
|---|---|---|
| Autenticación | `/api/auth` | Login, emisión de JWT y datos del usuario. |
| Dashboard | `/api/dashboard` | Indicadores y resumen general. |
| Proyectos | `/api/proyectos` | Alta, edición, consulta, avance y estados de obra. |
| Presupuesto | `/api/partidas` | Partidas, conceptos, APU y generadores de cantidades. |
| Compras | `/api/compras` | Compras, detalle y actualización de inventario. |
| Salidas | `/api/salidas` | Salidas de almacén por consumo, merma, robo o préstamo. |
| Inventario | `/api/productos` | Productos, existencias y precios de referencia. |
| Cotizaciones | `/api/cotizaciones`, `/api/proveedores` | Cotizaciones por proveedor y comparación de precios. |
| Estimaciones | `/api/estimaciones` | Estimaciones por periodo, detalle y cambios de estado. |
| Catálogo | `/api/catalogo` | Conceptos de referencia CMIC / BIMSA. |
| Usuarios | `/api/usuarios` | Administración de usuarios y roles (solo administrador). |
| Importación Opus | `/api/importacion` | Carga, vista previa, confirmación y descarte de presupuestos Excel. |

---

## Importación desde Opus

La importación está disponible únicamente para usuarios con rol `administrador`.

### Flujo

1. El administrador abre **Importar desde Opus** en el menú lateral.
2. Arrastra o selecciona un archivo `.xlsx` o `.xls`.
3. El backend analiza el archivo en memoria y devuelve una vista previa con materiales, metadatos, confianza y advertencias.
4. El usuario revisa y ajusta nombre de obra, fecha de inicio, presupuesto y zona.
5. Al pulsar **Conservar proyecto**, se crea el proyecto en estado `borrador`.
6. Al pulsar **Descartar**, se elimina la vista previa temporal.

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/importacion/preview` | Sube un Excel (`multipart/form-data`, campo `archivo`) y devuelve la vista previa. |
| `POST` | `/api/importacion/confirmar` | Confirma la importación y crea el proyecto borrador. |
| `DELETE` | `/api/importacion/:id` | Descarta una vista previa por UUID o un proyecto borrador por id. |

### Qué crea la confirmación

En una sola transacción:

- Un `PROYECTO` con estado `borrador`.
- Un `PROVEEDOR` técnico con `empresa = 'IMPORTACION_OPUS:<id_proyecto>'` y `especialidad = 'importacion_opus'`.
- Un `PRODUCTO` por cada material detectado.
- Una `COTIZACION` por cada producto, asociada al proveedor técnico.

No se crean `PARTIDA` ni `CONCEPTO`: los materiales quedan como productos y cotizaciones del proveedor de importación.

### Reglas y límites

- Zonas válidas: `Norte`, `Frontera`, `Turístico`, `Centro`, `Sur`.
- La vista previa se guarda como JSON temporal en `uploads/importaciones` y expira según `IMPORT_PREVIEW_TTL_MS`.
- El Excel nunca se guarda en disco: se procesa en memoria.
- El tamaño máximo del archivo se controla con `UPLOADS_MAX_SIZE`.
- El número máximo de filas se controla con `IMPORT_MAX_ROWS`.
- La confirmación es transaccional: si falla una inserción, no quedan registros parciales.

---

## Pruebas

```bash
npm test
```

La suite actual contiene **25 pruebas** del parser de Opus. Cubre, entre otros casos:

- Metadatos, fechas y montos en formatos mexicanos.
- Encabezados alternativos y errores de escritura.
- Encabezados repartidos en dos filas.
- Cálculo y derivación de cantidades, precios y totales.
- Omisión de secciones, subtotales y filas inválidas.
- Selección de la hoja con más materiales.
- Límites de filas y de advertencias.
- Truncado de descripciones y unidades.
- Errores controlados para archivos inválidos o sin materiales.

Las pruebas no requieren una base de datos ni un archivo real de Opus.

---

## Despliegue

### Requisitos comunes

Antes de desplegar en cualquier plataforma:

1. Tener un MySQL accesible desde internet con SSL.
2. Definir `DATABASE_URL` con la URL de conexión.
3. Definir `JWT_SECRET` con una clave aleatoria de al menos 32 caracteres.
4. Definir `NODE_ENV=production`.
5. Definir `CORS_ORIGIN` con el dominio público de la aplicación.
6. Definir `PUPPETEER_SKIP_DOWNLOAD=true` para evitar descargar Chromium durante el build. Puppeteer solo se usa en los scripts locales de capturas.

> El sistema de archivos de Render y Railway es efímero. Las vistas previas de importación viven en `uploads/importaciones`; si el servicio se reinicia entre la carga y la confirmación, hay que volver a subir el archivo. Para varias instancias o persistencia entre reinicios, monta un disco persistente o mueve las vistas previas a un almacenamiento externo.

### Render

`render.yaml` define un servicio web Node con:

- Build: `npm ci`
- Start: `npm start`
- Health check: `/`
- `NODE_ENV=production`
- `JWT_SECRET` generado automáticamente por Render
- `DATABASE_URL` y `CORS_ORIGIN` solicitados como secretos al sincronizar
- `PUPPETEER_SKIP_DOWNLOAD=true`

Render no ofrece MySQL administrado; su base nativa es PostgreSQL. Por eso el Blueprint no crea una base de datos y debes usar un MySQL externo (PlanetScale, Aiven, Railway MySQL u otro proveedor).

Pasos:

1. Subir el repositorio a GitHub.
2. Crear una base MySQL en el proveedor elegido y obtener su URL con SSL.
3. En Render, entrar a **New → Blueprint** y conectar el repositorio.
4. Render detectará `render.yaml`. Al sincronizar, completar:
   - `DATABASE_URL`: URL de MySQL con SSL.
   - `CORS_ORIGIN`: URL pública de Render, por ejemplo `https://protocem-app.onrender.com`.
5. Si el proveedor entrega un CA propio, agregar `DB_SSL_CA` en el dashboard con la ruta o el PEM.
6. Confirmar el despliegue y revisar los logs.
7. Abrir la URL pública, iniciar sesión con el usuario administrador del seed y cambiar la contraseña.

Notas:

- El plan gratuito de Render suspende el servicio por inactividad; el primer acceso puede tardar en responder.
- Si el health check falla, revisa la conexión a MySQL y los logs del servicio.
- El servicio usa el puerto que Render inyecta en `PORT`; no lo fijes manualmente en el dashboard.

### Railway

`railway.json` define:

- Builder: `RAILPACK`
- Build: `npm ci`
- Start: `npm start`
- Health check: `/`
- Reinicio: `ON_FAILURE`, hasta 10 intentos

Pasos:

1. Subir el repositorio a GitHub.
2. En Railway, crear un proyecto con **Deploy from GitHub repo**.
3. Agregar un servicio MySQL de Railway o usar un MySQL externo.
4. Configurar las variables del servicio web:
   - `DATABASE_URL`: URL de MySQL. Si usas el servicio MySQL de Railway, puedes referenciar su variable de conexión, por ejemplo `${{MySQL.MYSQL_URL}}` (ajusta el nombre del servicio).
   - `DB_SSL=true` si el proveedor lo requiere.
   - `JWT_SECRET`: clave aleatoria de al menos 32 caracteres.
   - `NODE_ENV=production`.
   - `CORS_ORIGIN`: dominio público de Railway.
   - `PUPPETEER_SKIP_DOWNLOAD=true`.
5. Desplegar. Railway leerá `railway.json` para el build y el start.
6. En **Settings → Networking**, generar un dominio público.
7. Abrir el dominio, iniciar sesión y cambiar la contraseña del administrador.

> Railway mantiene compatibilidad con `railway.json` para la configuración del deployment. Si el proyecto migra a la nueva infraestructura como código, replica estos valores (`npm ci`, `npm start`, health check `/` y reinicio `ON_FAILURE`) en la configuración correspondiente.

Notas:

- Railway también usa un sistema de archivos efímero.
- Si usas varias réplicas, las vistas previas de importación no se comparten; usa una sola instancia o almacenamiento externo.
- Revisa los logs del deploy si el health check no responde.

### Procfile

`Procfile` contiene:

```text
web: node server.js
```

Sirve para plataformas compatibles con Heroku o que aceptan un Procfile como comando de inicio.

---

## Estructura del repositorio

```text
.
├── config.js                 # Configuración central y variables de entorno
├── server.js                 # Punto de entrada
├── src/
│   ├── app.js                # Aplicación Express
│   ├── config/
│   │   └── database.js       # Pool, tablas, migraciones y seed
│   ├── routes/               # Definición de endpoints
│   ├── controllers/          # Capa HTTP
│   ├── services/             # Reglas de negocio
│   ├── repositories/         # Acceso a MySQL
│   ├── middlewares/          # Auth, roles, upload y errores
│   └── utils/                # Utilidades y parser de Opus
├── public/
│   ├── index.html            # SPA
│   ├── css/app.css
│   └── js/
│       ├── app.js
│       ├── utils.js
│       └── pages/            # Vistas por módulo
├── test/
│   └── opusParser.test.js
├── uploads/importaciones/    # Vistas previas temporales
├── scripts/                  # Scripts auxiliares de importación/capturas
├── .env.example
├── Procfile
├── render.yaml
├── railway.json
├── package.json
└── README.md
```

---

## Seguridad

- El archivo `.env` está ignorado por Git; solo se versiona `.env.example`.
- En producción, `JWT_SECRET` debe ser aleatorio y tener al menos 32 caracteres. La aplicación rechaza el valor de ejemplo y las claves cortas.
- Las contraseñas se almacenan con bcrypt, nunca en texto plano.
- Las rutas sensibles validan el rol del usuario.
- Las consultas SQL usan parámetros para evitar inyección.
- La carga de Excel valida extensión y tamaño.
- En la nube se recomienda HTTPS, `DB_SSL=true` y un `CORS_ORIGIN` restringido.
- Cambia las contraseñas del seed antes de exponer la aplicación.

---

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `JWT_SECRET no esta definido` | No existe `.env` o falta la variable. | Copiar `.env.example` a `.env` y definir `JWT_SECRET`. |
| `No se pudo conectar a MySQL` | Credenciales, host, puerto o SSL incorrectos. | Revisar `DATABASE_URL` o `DB_*`, el firewall y `DB_SSL`. |
| `ECONNREFUSED` | MySQL no está corriendo o el puerto no es accesible. | Iniciar MySQL o revisar el host/puerto. |
| `ER_ACCESS_DENIED_ERROR` | Usuario o contraseña incorrectos. | Corregir las credenciales en `.env` o en el dashboard. |
| La vista previa de importación desapareció | El servicio se reinició y el almacenamiento es efímero. | Volver a subir el archivo o montar un disco persistente. |
| El health check falla en Render/Railway | La aplicación no pudo conectar a MySQL o no escucha en `PORT`. | Revisar logs y la configuración de la base. |
| El build tarda demasiado por Puppeteer | Puppeteer descarga Chromium. | Definir `PUPPETEER_SKIP_DOWNLOAD=true`. |

---

## Entregables académicos

| Entregable | Archivo | Carpeta |
|---|---|---|
| Especificación Final del Proyecto | `Especificacion_Final_Proyecto.docx` | `/documentacion` |
| Matriz de Requerimientos | `Matriz_Requerimientos.xlsx` | `/documentacion` |
| Matriz de Trazabilidad | `Matriz_Trazabilidad.xlsx` | `/documentacion` |
| Diagrama AS-IS | `Diagrama_AS-IS.pdf` | `/diagramas` |
| Diagrama TO-BE | `Diagrama_TO-BE.pdf` | `/diagramas` |
| Diagrama ER (imagen) | `Diagrama_ER.png` | `/diagramas` |
| Diagrama ER (MySQL Workbench) | `Diagrama_ER.mwb` | `/diagramas` |
| Script SQL | `Protocemsqlscript.sql` | `/diagramas` |
| Minuta de entrevistas iniciales | `Minutas_Entrevistas.docx` | `/minutas` |
| Minuta de validación del prototipo | `Minuta_Validacion_Prototipo.docx` | `/minutas` |
| Aplicación web PROTOCEM | `index.html` | `/public` |

---

## Créditos

**Cliente:** I.C. Carlos Eduardo Macías Cháirez — PROTOCEM<br>
**Asesor académico:** M.C. Jesús Héctor Ruiz Gallegos

**Equipo de desarrollo:**

- Román González Mata
- Rodrigo Hernández Hernández
- Alejandro Martínez Muñiz
- Isaac Alejandro Ruvalcaba Martínez

---

*UAA — Ingeniería de Requerimientos 2025-B*
