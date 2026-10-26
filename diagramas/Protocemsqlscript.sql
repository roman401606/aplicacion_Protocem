-- ============================================================
--  PROTOCEM – Sistema de Gestión de Obras
-- ============================================================

CREATE DATABASE IF NOT EXISTS protocem_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE protocem_db;

-- ─────────────────────────────────────────────────
-- 1. USUARIO
--    Personas con acceso al sistema.
--    'rol' controla niveles de acceso.
-- ─────────────────────────────────────────────────
CREATE TABLE USUARIO (
    id_usuario       INT            NOT NULL AUTO_INCREMENT,
    nombre_usuario   VARCHAR(120)   NOT NULL,
    correo           VARCHAR(120)   NOT NULL UNIQUE,
    telefono         VARCHAR(20),
    direccion        VARCHAR(255),
    RFC              VARCHAR(13),
    rol              ENUM('administrador','encargado','solo_lectura') NOT NULL DEFAULT 'encargado',
    contrasena_hash  VARCHAR(255)   NOT NULL,
    activo           TINYINT(1)     NOT NULL DEFAULT 1,
    CONSTRAINT PK_USUARIO PRIMARY KEY (id_usuario),
    CONSTRAINT CK_RFC CHECK (RFC REGEXP '^[A-Z]{3,4}[0-9]{6}[A-Z0-9]{3}$' OR RFC IS NULL)
);

-- ─────────────────────────────────────────────────
-- 2. PROYECTO
--    Obra licitada o contratada.
--    Un usuario (administrador) gestiona N proyectos.
-- ─────────────────────────────────────────────────
CREATE TABLE PROYECTO (
    id_proyecto         INT            NOT NULL AUTO_INCREMENT,
    nombre_obra         VARCHAR(200)   NOT NULL,
    fecha_inicio        DATE           NOT NULL,
    fecha_fin_estimada  DATE,
    presupuesto         DECIMAL(14,2)  NOT NULL CHECK (presupuesto > 0),
    porcentaje_avance   DECIMAL(5,2)   NOT NULL DEFAULT 0.00
                        CHECK (porcentaje_avance BETWEEN 0 AND 100),
    id_usuario          INT            NOT NULL,
    CONSTRAINT PK_PROYECTO PRIMARY KEY (id_proyecto),
    CONSTRAINT FK_PROYECTO_USUARIO FOREIGN KEY (id_usuario)
        REFERENCES USUARIO(id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT CK_FECHAS CHECK (fecha_fin_estimada IS NULL OR fecha_fin_estimada >= fecha_inicio)
);

-- ─────────────────────────────────────────────────
-- 3. PROVEEDOR
--    Empresa o persona que vende materiales.
-- ─────────────────────────────────────────────────
CREATE TABLE PROVEEDOR (
    id_proveedor  INT           NOT NULL AUTO_INCREMENT,
    nombre        VARCHAR(150)  NOT NULL,
    empresa       VARCHAR(150),
    telefono      VARCHAR(20),
    contacto      VARCHAR(120),
    CONSTRAINT PK_PROVEEDOR PRIMARY KEY (id_proveedor)
);

-- ─────────────────────────────────────────────────
-- 4. PRODUCTO
--    Material o insumo de construcción.
--    stock refleja inventario actual (puede actualizarse
--    por triggers al registrar compras y salidas).
-- ─────────────────────────────────────────────────
CREATE TABLE PRODUCTO (
    id_producto       INT            NOT NULL AUTO_INCREMENT,
    descripcion       VARCHAR(200)   NOT NULL,
    tipo_producto     VARCHAR(80),
    unidades          VARCHAR(40)    NOT NULL COMMENT 'ej: bulto, m3, kg, ml',
    precio_referencia DECIMAL(10,2)  CHECK (precio_referencia >= 0),
    stock             DECIMAL(10,2)  NOT NULL DEFAULT 0
                      CHECK (stock >= 0),
    CONSTRAINT PK_PRODUCTO PRIMARY KEY (id_producto)
);

-- ─────────────────────────────────────────────────
-- 5. COTIZACION
--    Precio de un producto con un proveedor en fecha dada.
--    Permite comparar cotizado vs precio real de compra.
-- ─────────────────────────────────────────────────
CREATE TABLE COTIZACION (
    id_cotizacion   INT            NOT NULL AUTO_INCREMENT,
    fecha_cotizacion DATE          NOT NULL,
    precio_cotizado  DECIMAL(10,2) NOT NULL CHECK (precio_cotizado > 0),
    id_producto      INT           NOT NULL,
    id_proveedor     INT           NOT NULL,
    CONSTRAINT PK_COTIZACION PRIMARY KEY (id_cotizacion),
    CONSTRAINT FK_COT_PRODUCTO  FOREIGN KEY (id_producto)  REFERENCES PRODUCTO(id_producto)  ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT FK_COT_PROVEEDOR FOREIGN KEY (id_proveedor) REFERENCES PROVEEDOR(id_proveedor) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ─────────────────────────────────────────────────
-- 6. COMPRA
--    Orden de compra asociada a un proyecto.
-- ─────────────────────────────────────────────────
CREATE TABLE COMPRA (
    id_compra      INT            NOT NULL AUTO_INCREMENT,
    fecha_compra   DATE           NOT NULL,
    total_compra   DECIMAL(12,2)  NOT NULL CHECK (total_compra > 0),
    id_proyecto    INT            NOT NULL,
    CONSTRAINT PK_COMPRA PRIMARY KEY (id_compra),
    CONSTRAINT FK_COMPRA_PROYECTO FOREIGN KEY (id_proyecto)
        REFERENCES PROYECTO(id_proyecto) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ─────────────────────────────────────────────────
-- 7. DETALLE_COMPRA
--    Líneas de una compra (M:N entre COMPRA y PRODUCTO).
--    Resuelve relación muchos-a-muchos.
-- ─────────────────────────────────────────────────
CREATE TABLE DETALLE_COMPRA (
    id_detalle         INT            NOT NULL AUTO_INCREMENT,
    id_compra          INT            NOT NULL,
    id_producto        INT            NOT NULL,
    cantidad           DECIMAL(10,2)  NOT NULL CHECK (cantidad > 0),
    precio_unitario_real DECIMAL(10,2) NOT NULL CHECK (precio_unitario_real >= 0),
    CONSTRAINT PK_DETALLE_COMPRA PRIMARY KEY (id_detalle),
    CONSTRAINT FK_DC_COMPRA   FOREIGN KEY (id_compra)   REFERENCES COMPRA(id_compra)     ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT FK_DC_PRODUCTO FOREIGN KEY (id_producto) REFERENCES PRODUCTO(id_producto) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ─────────────────────────────────────────────────
-- 8. SALIDA
--    Despacho de material a obra (salida de almacén).
--    tipo_salida: consumo normal, merma, robo, préstamo.
-- ─────────────────────────────────────────────────
CREATE TABLE SALIDA (
    id_salida    INT            NOT NULL AUTO_INCREMENT,
    fecha_salida DATE           NOT NULL,
    responsable  VARCHAR(120)   NOT NULL,
    tipo_salida  ENUM('consumo','merma','robo','prestamo') NOT NULL DEFAULT 'consumo',
    total_salida DECIMAL(12,2),
    id_proyecto  INT            NOT NULL,
    CONSTRAINT PK_SALIDA PRIMARY KEY (id_salida),
    CONSTRAINT FK_SALIDA_PROYECTO FOREIGN KEY (id_proyecto)
        REFERENCES PROYECTO(id_proyecto) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ─────────────────────────────────────────────────
-- 9. DETALLE_SALIDA
--    Líneas de una salida (M:N entre SALIDA y PRODUCTO).
-- ─────────────────────────────────────────────────
CREATE TABLE DETALLE_SALIDA (
    id_detalle_salida  INT            NOT NULL AUTO_INCREMENT,
    id_salida          INT            NOT NULL,
    id_producto        INT            NOT NULL,
    cantidad           DECIMAL(10,2)  NOT NULL CHECK (cantidad > 0),
    CONSTRAINT PK_DETALLE_SALIDA PRIMARY KEY (id_detalle_salida),
    CONSTRAINT FK_DS_SALIDA   FOREIGN KEY (id_salida)   REFERENCES SALIDA(id_salida)       ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT FK_DS_PRODUCTO FOREIGN KEY (id_producto) REFERENCES PRODUCTO(id_producto)   ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ─────────────────────────────────────────────────
--  VISTA útil: desviación precio cotizado vs comprado
-- ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW VW_DESVIACION_PRECIOS AS
SELECT
    p.id_producto,
    p.descripcion,
    c.fecha_cotizacion,
    c.precio_cotizado,
    dc.precio_unitario_real,
    ROUND(((dc.precio_unitario_real - c.precio_cotizado) / c.precio_cotizado) * 100, 2) AS desviacion_pct,
    pr.nombre AS proveedor
FROM COTIZACION c
JOIN PRODUCTO p    ON p.id_producto  = c.id_producto
JOIN PROVEEDOR pr  ON pr.id_proveedor = c.id_proveedor
JOIN DETALLE_COMPRA dc ON dc.id_producto = p.id_producto;

-- ─────────────────────────────────────────────────
--  VISTA: rentabilidad por proyecto
-- ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW VW_RENTABILIDAD_PROYECTO AS
SELECT
    proy.id_proyecto,
    proy.nombre_obra,
    proy.presupuesto,
    proy.porcentaje_avance,
    COALESCE(SUM(comp.total_compra), 0)     AS gasto_acumulado,
    proy.presupuesto - COALESCE(SUM(comp.total_compra), 0) AS saldo_restante,
    ROUND((COALESCE(SUM(comp.total_compra), 0) / proy.presupuesto) * 100, 2) AS pct_presupuesto_usado
FROM PROYECTO proy
LEFT JOIN COMPRA comp ON comp.id_proyecto = proy.id_proyecto
GROUP BY proy.id_proyecto;cotizacionsalida