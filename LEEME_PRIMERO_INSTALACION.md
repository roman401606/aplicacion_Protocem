# PROTOCEM — Guía de instalación y manual del sistema

> **Lee este documento primero.** Aquí se concentra la información necesaria para instalar, ejecutar y revisar el sistema PROTOCEM, así como las referencias del proyecto y su estado actual en producción.

**Última actualización:** 30 de octubre de 2026<br>
**Rama de trabajo:** `develop`<br>
**Repositorio:** [github.com/roman401606/aplicacion_Protocem](https://github.com/roman401606/aplicacion_Protocem)

---

## Contenido

1. [Introducción](#1-introducción)
2. [Estado actual en producción](#2-estado-actual-en-producción)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Requisitos previos](#4-requisitos-previos)
5. [Instalación local paso a paso](#5-instalación-local-paso-a-paso)
6. [Credenciales de acceso de prueba](#6-credenciales-de-acceso-de-prueba)
7. [Despliegue en producción](#7-despliegue-en-producción)
8. [Estructura del proyecto](#8-estructura-del-proyecto)
9. [Pruebas automatizadas](#9-pruebas-automatizadas)
10. [Solución de problemas](#10-solución-de-problemas)
11. [Referencias y contribuyentes](#11-referencias-y-contribuyentes)
12. [Seguridad y buenas prácticas](#12-seguridad-y-buenas-prácticas)
13. [Créditos](#13-créditos)

---

## 1. Introducción

**PROTOCEM** es un sistema web para la gestión integral de obras de construcción. Centraliza la operación diaria de la empresa: proyectos, presupuesto por partidas, compras de material, salidas de almacén, inventario, cotizaciones de proveedores, estimaciones y administración de usuarios con roles diferenciados.

El sistema también incluye un **importador de presupuestos de Opus** desde archivos Excel, con vista previa, validación y confirmación transaccional.

### Alcance funcional

- Autenticación con JWT y contraseñas protegidas con bcrypt.
- Dashboard con indicadores de proyectos, compras, salidas e inventario.
- Gestión de proyectos y control de avance.
- Presupuesto por partidas, conceptos y análisis de precios unitarios.
- Compras, salidas de almacén y actualización de existencias.
- Inventario y catálogo de productos.
- Cotizaciones por proveedor y comparación de precios.
- Estimaciones por periodo.
- Catálogo de conceptos de referencia CMIC / BIMSA.
- Administración de usuarios y roles.
- Importación de presupuestos de Opus desde Excel.

### Roles del sistema

| Rol | Alcance |
|---|---|
| `administrador` | Acceso completo: usuarios, catálogo, importación desde Opus y operación general. |
| `encargado` | Operación de proyectos, compras, salidas, inventario y estimaciones. |
| `solo_lectura` | Consulta de información sin permisos de escritura. |

---

## 2. Estado actual en producción

El sistema se encuentra desplegado en **Render** y publicado en la siguiente URL:

| Campo | Valor |
|---|---|
| **URL pública** | <https://aplicacion-protocem.onrender.com/> |
| **Plataforma de aplicación** | Render (servicio web Node.js) |
| **Base de datos** | Aiven MySQL |
| **DNS / proxy / HTTPS** | Cloudflare |
| **Rama desplegada** | `develop` |
| **Estado** | En producción |

> **Nota:** Render puede suspender temporalmente el servicio por inactividad en el plan gratuito. Si el primer acceso tarda, espera unos segundos y vuelve a intentar. Si el dominio no responde, revisa el estado del servicio y los logs en el panel de Render.

### Consideraciones de producción

- El servidor escucha en `0.0.0.0` y usa el puerto dinámico que Render inyecta en `process.env.PORT`.
- La conexión a Aiven MySQL se realiza mediante `DATABASE_URL` con SSL.
- Cloudflare gestiona el DNS, el certificado HTTPS y el proxy del dominio público.
- El almacenamiento de Render es efímero: las vistas previas de importación viven en `uploads/importaciones` y se pierden si el servicio se reinicia.
- Las credenciales de prueba del seed deben cambiarse antes de exponer el sistema a usuarios reales.

---

## 3. Stack tecnológico

| Capa | Tecnología |
|---|---|
| **Frontend** | HTML5, CSS3 y JavaScript vanilla. SPA servida por el backend. |
| **Backend** | Node.js 20 LTS o superior y Express 4. |
| **Base de datos** | MySQL 8+ local y **Aiven MySQL** en producción, mediante `mysql2/promise`. |
| **Autenticación** | JSON Web Tokens (`jsonwebtoken`) y `bcryptjs`. |
| **Carga de archivos** | Multer en memoria y `xlsx` para archivos Excel. |
| **Configuración** | `dotenv` y variables de entorno. |
| **Despliegue** | Render para el servicio web; `render.yaml` y `Procfile`. |
| **DNS / seguridad perimetral** | Cloudflare. |
| **Pruebas** | `node:test` (25 pruebas del parser de Opus). |
| **Capturas locales** | Puppeteer, solo para scripts de capturas; no se usa en el runtime de producción. |

### Arquitectura general

```text
Navegador
   │
   ▼
Cloudflare (DNS, HTTPS y proxy)
   │
   ▼
Render (servicio web Node.js + Express)
   │
   ▼
Aiven MySQL (MySQL administrado con SSL)
```

El backend sigue una arquitectura MVC por capas:

```text
routes → controllers → services → repositories → MySQL
```

---

## 4. Requisitos previos

Antes de instalar el proyecto, asegúrate de tener:

- **Node.js 20 LTS** o superior.
- **npm 9** o superior.
- **Git** para clonar el repositorio.
- **MySQL 8** local, o acceso a una instancia de **Aiven MySQL**.
- Un editor de código (VS Code, WebStorm o similar).
- Opcional: `nodemon`, incluido en `devDependencies`, para recarga automática en desarrollo.

Verifica las versiones instaladas:

```bash
node --version
npm --version
git --version
```

---

## 5. Instalación local paso a paso

### 5.1 Clonar el repositorio

```bash
git clone https://github.com/roman401606/aplicacion_Protocem.git
cd aplicacion_Protocem
```

Si descargaste el proyecto como ZIP, descomprímelo y abre una terminal dentro de la carpeta raíz.

### 5.2 Instalar dependencias

```bash
npm install
```

Para una instalación reproducible a partir del `package-lock.json`:

```bash
npm ci
```

### 5.3 Crear el archivo de entorno

Copia la plantilla incluida en el repositorio:

**Windows (PowerShell o CMD):**

```powershell
copy .env.example .env
```

**Linux o macOS:**

```bash
cp .env.example .env
```

El archivo `.env` contiene credenciales y **no debe subirse al repositorio**. Solo se versiona `.env.example`.

### 5.4 Configurar la base de datos local

Opción recomendada para desarrollo: MySQL local con parámetros individuales.

```dotenv
NODE_ENV=development
PORT=3000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_contrasena_local
DB_NAME=protocem_db
DB_POOL_SIZE=10
DB_SSL=false

JWT_SECRET=una-clave-aleatoria-de-al-menos-32-caracteres
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=10
CORS_ORIGIN=*

UPLOADS_MAX_SIZE=10485760
IMPORT_PREVIEW_TTL_MS=3600000
IMPORT_MAX_ROWS=5000
```

Crea la base de datos si todavía no existe:

```sql
CREATE DATABASE protocem_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

La aplicación crea las tablas y ejecuta el seed inicial automáticamente al arrancar. El seed solo se ejecuta si la tabla `USUARIO` está vacía.

### 5.5 Configurar una conexión a Aiven MySQL (opcional en local)

Si prefieres trabajar contra la base de datos administrada, usa una URL unificada:

```dotenv
DATABASE_URL=mysql://avnadmin:TU_CONTRASENA@HOST_AIVEN:PUERTO/defaultdb?ssl-mode=REQUIRED
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
```

Notas:

- `DATABASE_URL` tiene prioridad sobre `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME`.
- Se aceptan los esquemas `mysql://` y `mysql2://`.
- Si Aiven proporciona un certificado CA, puedes configurarlo con `DB_SSL_CA`, usando una ruta al archivo PEM o el PEM directamente en la variable.
- No publiques la URL de conexión ni la contraseña en el repositorio, en capturas o en issues.

### 5.6 Generar un `JWT_SECRET` seguro

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copia el resultado en `JWT_SECRET`. En producción debe tener al menos 32 caracteres y no puede ser el valor de ejemplo.

### 5.7 Ejecutar el servidor

```bash
npm start
```

También puedes usar el modo de desarrollo con recarga automática:

```bash
npm run dev
```

Abre el navegador en:

```text
http://localhost:3000
```

El log esperado es similar a:

```text
=========================================
Protocem App escuchando en el puerto 3000
=========================================
```

El puerto se resuelve con:

```js
const PORT = process.env.PORT || config.port || 3000;
```

y el servidor escucha en `0.0.0.0`, lo que permite recibir tráfico externo en Render.

### 5.8 Verificar la instalación

```bash
npm test
```

También puedes comprobar que el servidor responde:

```bash
curl http://localhost:3000/
```

En PowerShell:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/
```

---

## 6. Credenciales de acceso de prueba

El seed inicial crea los siguientes usuarios:

| Correo | Contraseña | Rol |
|---|---|---|
| `admin@protocem.mx` | `admin123` | administrador |
| `encargado@protocem.mx` | `encargado123` | encargado |
| `velador@protocem.mx` | `lector123` | solo_lectura |

> **Importante:** estas credenciales son datos de ejemplo. Cámbialas antes de usar el sistema en producción o con información real.

---

## 7. Despliegue en producción

### 7.1 Render

El repositorio incluye `render.yaml` con la configuración del servicio web:

- Runtime: Node.js.
- Build: `npm ci`.
- Start: `npm start`.
- Health check: `/`.
- Variables de entorno de producción.
- `JWT_SECRET` generado por Render.
- `PUPPETEER_SKIP_DOWNLOAD=true` para evitar descargar Chromium durante el build.

Pasos generales:

1. Sube el repositorio a GitHub y asegúrate de que la rama `develop` esté actualizada.
2. En Render, crea un **New → Blueprint** y conecta el repositorio.
3. Render detectará `render.yaml`.
4. Configura los secretos solicitados:
   - `DATABASE_URL`: URL de Aiven MySQL con SSL.
   - `CORS_ORIGIN`: `https://aplicacion-protocem.onrender.com` o el dominio público correspondiente.
5. Si Aiven entrega un CA propio, configura `DB_SSL_CA`.
6. Despliega y revisa los logs.
7. Abre la URL pública, inicia sesión con el administrador y cambia las contraseñas del seed.

**No definas `PORT` manualmente en Render.** Render inyecta el puerto dinámicamente y el servidor ya lo lee desde `process.env.PORT`.

### 7.2 Aiven MySQL

1. Crea una instancia de MySQL en Aiven.
2. Crea la base de datos `protocem_db` y un usuario con permisos sobre ella.
3. Copia la URL de conexión y activa SSL.
4. Configura `DATABASE_URL` en Render como variable secreta.
5. Si el proveedor requiere CA, descarga el certificado y configúralo con `DB_SSL_CA`.

Formato de referencia:

```dotenv
DATABASE_URL=mysql://avnadmin:TU_CONTRASENA@HOST_AIVEN:PUERTO/protocem_db?ssl-mode=REQUIRED
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
```

### 7.3 Cloudflare

Cloudflare se utiliza para el DNS, el certificado HTTPS y el proxy del dominio público.

Recomendaciones:

- Configura el dominio o subdominio con un registro `CNAME` hacia el hostname del servicio en Render.
- Activa el proxy de Cloudflare si deseas aprovechar su capa de seguridad y caché.
- Usa **SSL/TLS → Full (strict)** para que Cloudflare valide el certificado de Render.
- Mantén `CORS_ORIGIN` restringido al dominio público real.
- Si aparece un error 520 o 502, revisa primero los logs de Render y la conexión a Aiven MySQL.

### 7.4 Variables de producción recomendadas

| Variable | Valor recomendado |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | **No definir**; Render lo inyecta |
| `DATABASE_URL` | URL de Aiven MySQL con SSL |
| `DB_SSL` | `true` |
| `DB_SSL_REJECT_UNAUTHORIZED` | `true` |
| `DB_SSL_CA` | Ruta o PEM del CA de Aiven, si aplica |
| `JWT_SECRET` | Clave aleatoria de 32+ caracteres |
| `JWT_EXPIRES_IN` | `8h` |
| `CORS_ORIGIN` | `https://aplicacion-protocem.onrender.com` |
| `BCRYPT_ROUNDS` | `10` |
| `UPLOADS_MAX_SIZE` | `10485760` |
| `IMPORT_PREVIEW_TTL_MS` | `3600000` |
| `IMPORT_MAX_ROWS` | `5000` |
| `PUPPETEER_SKIP_DOWNLOAD` | `true` |

---

## 8. Estructura del proyecto

```text
.
├── config.js                 # Configuración central y variables de entorno
├── server.js                 # Punto de entrada; binding dinámico en 0.0.0.0
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
│   └── js/                   # Lógica del frontend por página
├── test/
│   └── opusParser.test.js    # 25 pruebas del parser
├── uploads/importaciones/    # Vistas previas temporales
├── scripts/                  # Scripts auxiliares
├── .env.example              # Plantilla de variables de entorno
├── Procfile                  # Comando de inicio para plataformas compatibles
├── render.yaml               # Blueprint de Render
├── railway.json              # Configuración opcional para Railway
└── README.md                 # Documentación general del proyecto
```

---

## 9. Pruebas automatizadas

```bash
npm test
```

La suite actual contiene **25 pruebas** del parser de Opus. Cubre, entre otros casos:

- Lectura de metadatos, fechas y montos en formatos mexicanos.
- Encabezados alternativos y errores de escritura.
- Encabezados repartidos en dos filas.
- Cálculo y derivación de cantidades, precios y totales.
- Omisión de secciones, subtotales y filas inválidas.
- Selección de la hoja con más materiales.
- Límites de filas y de advertencias.
- Errores controlados para archivos inválidos o sin materiales.

Las pruebas no requieren una base de datos ni un archivo real de Opus.

---

## 10. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `JWT_SECRET no esta definido` | Falta `.env` o la variable no está configurada. | Copiar `.env.example` a `.env` y definir `JWT_SECRET`. |
| `No se pudo conectar a MySQL` | Credenciales, host, puerto o SSL incorrectos. | Revisar `DATABASE_URL` o `DB_*`, el firewall y `DB_SSL`. |
| `ECONNREFUSED` | MySQL no está corriendo o el puerto no es accesible. | Iniciar MySQL o revisar host y puerto. |
| `ER_ACCESS_DENIED_ERROR` | Usuario o contraseña incorrectos. | Corregir las credenciales en `.env` o en el panel de Render. |
| Error 520 o 502 en Cloudflare/Render | La aplicación no escucha en el puerto asignado o no pudo conectar a MySQL. | Revisar logs de Render, no definir `PORT` manualmente y validar `DATABASE_URL` y SSL. |
| La vista previa de importación desapareció | El servicio se reinició y el almacenamiento es efímero. | Volver a subir el archivo o montar un disco persistente. |
| El build tarda demasiado | Puppeteer intenta descargar Chromium. | Definir `PUPPETEER_SKIP_DOWNLOAD=true`. |
| El primer acceso tarda | Arranque en frío del plan gratuito de Render. | Esperar y reintentar; considerar un plan con instancia siempre activa. |

---

## 11. Referencias y contribuyentes

### Repositorio

- **GitHub:** <https://github.com/roman401606/aplicacion_Protocem>
- **Rama principal de trabajo:** `develop`
- **Documentación general:** [`README.md`](./README.md)
- **Resumen de cambios:** [`Resumen de cambios.md`](./Resumen%20de%20cambios.md)

### Producción

- **URL pública:** <https://aplicacion-protocem.onrender.com/>

### Contribuyentes

La liga directa a la pestaña de contribuyentes es:

**<https://github.com/roman401606/aplicacion_Protocem/graphs/contributors>**

También puedes llegar desde GitHub:

1. Abre el repositorio: <https://github.com/roman401606/aplicacion_Protocem>
2. Entra a la pestaña **Insights**.
3. Selecciona **Contributors**.

> Si el repositorio es privado, necesitas tener acceso para consultar la pestaña de contribuyentes.

---

## 12. Seguridad y buenas prácticas

- No subir `.env` al repositorio. Solo se versiona `.env.example`.
- Usar un `JWT_SECRET` aleatorio de al menos 32 caracteres en producción.
- Cambiar las contraseñas del seed antes de usar el sistema con datos reales.
- Restringir `CORS_ORIGIN` al dominio público.
- Mantener SSL activo en la conexión a Aiven MySQL.
- Usar HTTPS en Cloudflare y Render.
- No compartir cadenas de conexión, contraseñas ni tokens en issues, capturas o documentación.
- Revisar los logs de Render ante cualquier error de arranque o de base de datos.
- Mantener actualizadas las dependencias y ejecutar `npm test` antes de desplegar cambios.

---

## 13. Créditos

**Cliente:** I.C. Carlos Eduardo Macías Cháirez — PROTOCEM<br>
**Asesor académico:** M.C. Jesús Héctor Ruiz Gallegos

**Equipo de desarrollo:**

- Román González Mata
- Rodrigo Hernández Hernández
- Alejandro Martínez Muñiz
- Isaac Alejandro Ruvalcaba Martínez

**Universidad Autónoma de Aguascalientes**<br>
Ingeniería de Requerimientos · 2025-B

---

*Documento de instalación y referencia del sistema PROTOCEM.*
