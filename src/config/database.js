const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('../../config');

const pool = mysql.createPool(config.db);

/**
 * Describe el destino de conexion sin exponer credenciales.
 * Se usa en los errores para saber si se uso DATABASE_URL o las variables DB_*.
 */
function describeDatabaseTarget() {
  const ssl = config.db.ssl ? ' SSL' : '';
  return `${config.databaseSource}: ${config.db.host}:${config.db.port}/${config.db.database}${ssl}`;
}

/**
 * Agrega 'borrador' al ENUM de PROYECTO.estado solo si aun no existe.
 * Permite actualizar bases creadas antes de la Tarea 2 sin recrear tablas.
 */
async function ensureProyectoEstadoBorrador(conn) {
  const [rows] = await conn.query(
    `SELECT COLUMN_TYPE AS tipo
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'PROYECTO'
        AND COLUMN_NAME = 'estado'`
  );

  if (!rows.length) return;

  const tipo = String(rows[0].tipo || '').toLowerCase();
  if (tipo.includes("'borrador'")) return;

  await conn.query(
    `ALTER TABLE PROYECTO
       MODIFY estado ENUM('activo','pausado','finalizado','borrador')
       NOT NULL DEFAULT 'activo'`
  );
  console.log('PROYECTO.estado actualizado: se agrego el valor borrador.');
}

async function initDB() {
  let c;
  try {
    c = await pool.getConnection();
  } catch (error) {
    error.message = `No se pudo conectar a MySQL (${describeDatabaseTarget()}): ${error.message}`;
    throw error;
  }

  try {
    /* ─── TABLAS ORIGINALES ─── */
    await c.query(`CREATE TABLE IF NOT EXISTS USUARIO (
      id_usuario       INT NOT NULL AUTO_INCREMENT,
      nombre_usuario   VARCHAR(120) NOT NULL,
      correo           VARCHAR(120) NOT NULL UNIQUE,
      telefono         VARCHAR(20),
      RFC              VARCHAR(13),
      rol              ENUM('administrador','encargado','solo_lectura') NOT NULL DEFAULT 'encargado',
      contrasena_hash  VARCHAR(255) NOT NULL,
      activo           TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (id_usuario)
    ) ENGINE=InnoDB`);

    await c.query(`CREATE TABLE IF NOT EXISTS PROYECTO (
      id_proyecto         INT NOT NULL AUTO_INCREMENT,
      nombre_obra         VARCHAR(200) NOT NULL,
      descripcion         TEXT,
      fecha_inicio        DATE NOT NULL,
      fecha_fin_estimada  DATE,
      presupuesto         DECIMAL(14,2) NOT NULL DEFAULT 0,
      porcentaje_avance   DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      estado              ENUM('activo','pausado','finalizado','borrador') NOT NULL DEFAULT 'activo',
      zona                ENUM('Norte','Frontera','Turístico','Centro','Sur') NOT NULL DEFAULT 'Centro',
      id_usuario          INT NOT NULL,
      PRIMARY KEY (id_proyecto),
      FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
    ) ENGINE=InnoDB`);

    await c.query(`CREATE TABLE IF NOT EXISTS PROVEEDOR (
      id_proveedor  INT NOT NULL AUTO_INCREMENT,
      nombre        VARCHAR(150) NOT NULL,
      empresa       VARCHAR(150),
      telefono      VARCHAR(20),
      contacto      VARCHAR(120),
      especialidad  VARCHAR(100),
      PRIMARY KEY (id_proveedor)
    ) ENGINE=InnoDB`);

    /* tipo_producto ahora sigue la taxonomía de 5 tipos de OPUS */
    await c.query(`CREATE TABLE IF NOT EXISTS PRODUCTO (
      id_producto      INT NOT NULL AUTO_INCREMENT,
      descripcion      VARCHAR(200) NOT NULL,
      tipo_producto    ENUM('Material','Mano de Obra','Herramienta y Equipo','Maquinaria','Subcontrato') NOT NULL DEFAULT 'Material',
      unidades         VARCHAR(40) NOT NULL,
      precio_referencia DECIMAL(10,2),
      stock            DECIMAL(10,2) NOT NULL DEFAULT 0,
      PRIMARY KEY (id_producto)
    ) ENGINE=InnoDB`);

    await c.query(`CREATE TABLE IF NOT EXISTS COTIZACION (
      id_cotizacion     INT NOT NULL AUTO_INCREMENT,
      fecha_cotizacion  DATE NOT NULL,
      precio_cotizado   DECIMAL(10,2) NOT NULL,
      id_producto       INT NOT NULL,
      id_proveedor      INT NOT NULL,
      PRIMARY KEY (id_cotizacion),
      FOREIGN KEY (id_producto)  REFERENCES PRODUCTO(id_producto),
      FOREIGN KEY (id_proveedor) REFERENCES PROVEEDOR(id_proveedor)
    ) ENGINE=InnoDB`);

    await c.query(`CREATE TABLE IF NOT EXISTS COMPRA (
      id_compra    INT NOT NULL AUTO_INCREMENT,
      fecha_compra DATE NOT NULL,
      total_compra DECIMAL(12,2) NOT NULL,
      id_proyecto  INT NOT NULL,
      id_concepto  INT,
      PRIMARY KEY (id_compra),
      FOREIGN KEY (id_proyecto) REFERENCES PROYECTO(id_proyecto)
    ) ENGINE=InnoDB`);

    await c.query(`CREATE TABLE IF NOT EXISTS DETALLE_COMPRA (
      id_detalle           INT NOT NULL AUTO_INCREMENT,
      id_compra            INT NOT NULL,
      id_producto          INT NOT NULL,
      cantidad             DECIMAL(10,2) NOT NULL,
      precio_unitario_real DECIMAL(10,2) NOT NULL,
      PRIMARY KEY (id_detalle),
      FOREIGN KEY (id_compra)   REFERENCES COMPRA(id_compra) ON DELETE CASCADE,
      FOREIGN KEY (id_producto) REFERENCES PRODUCTO(id_producto)
    ) ENGINE=InnoDB`);

    await c.query(`CREATE TABLE IF NOT EXISTS SALIDA (
      id_salida    INT NOT NULL AUTO_INCREMENT,
      fecha_salida DATE NOT NULL,
      responsable  VARCHAR(120) NOT NULL,
      tipo_salida  ENUM('consumo','merma','robo','prestamo') NOT NULL DEFAULT 'consumo',
      total_salida DECIMAL(12,2),
      id_proyecto  INT NOT NULL,
      PRIMARY KEY (id_salida),
      FOREIGN KEY (id_proyecto) REFERENCES PROYECTO(id_proyecto)
    ) ENGINE=InnoDB`);

    await c.query(`CREATE TABLE IF NOT EXISTS DETALLE_SALIDA (
      id_detalle_salida INT NOT NULL AUTO_INCREMENT,
      id_salida         INT NOT NULL,
      id_producto       INT NOT NULL,
      cantidad          DECIMAL(10,2) NOT NULL,
      PRIMARY KEY (id_detalle_salida),
      FOREIGN KEY (id_salida)   REFERENCES SALIDA(id_salida) ON DELETE CASCADE,
      FOREIGN KEY (id_producto) REFERENCES PRODUCTO(id_producto)
    ) ENGINE=InnoDB`);

    /* ─── TABLAS NUEVAS — ECOSISTEMA OPUS ─── */

    /* Factores de Salario Real (FASAR) — basado en catálogos BIMSA 2025 */
    await c.query(`CREATE TABLE IF NOT EXISTS FASAR (
      id_fasar        INT NOT NULL AUTO_INCREMENT,
      categoria       VARCHAR(100) NOT NULL,
      salario_base    DECIMAL(10,2) NOT NULL COMMENT 'Salario tabulado MXN/día',
      factor          DECIMAL(6,4) NOT NULL COMMENT 'Factor que incluye IMSS, INFONAVIT, SAR, prestaciones',
      salario_real    DECIMAL(10,2) GENERATED ALWAYS AS (ROUND(salario_base * factor, 2)) STORED,
      zona            ENUM('Norte','Frontera','Turístico','Centro','Sur') NOT NULL DEFAULT 'Centro',
      vigencia        YEAR NOT NULL DEFAULT 2025,
      PRIMARY KEY (id_fasar)
    ) ENGINE=InnoDB`);

    /* Catálogo de conceptos de referencia (CMIC / BIMSA) */
    await c.query(`CREATE TABLE IF NOT EXISTS CATALOGO_CONCEPTO (
      id_catalogo   INT NOT NULL AUTO_INCREMENT,
      clave         VARCHAR(30) NOT NULL,
      descripcion   TEXT NOT NULL,
      unidad        VARCHAR(30) NOT NULL,
      precio_ref    DECIMAL(12,2),
      especialidad  ENUM('Obra Civil','Edificación','Hidráulica','Eléctrico',
                         'Aire Acondicionado','Infraestructura','Industrial','Preliminares') NOT NULL,
      fuente        ENUM('CMIC','BIMSA','Libre') NOT NULL DEFAULT 'BIMSA',
      año_catalogo  YEAR NOT NULL DEFAULT 2025,
      zona          ENUM('Norte','Frontera','Turístico','Centro','Sur','Nacional') NOT NULL DEFAULT 'Nacional',
      PRIMARY KEY (id_catalogo),
      INDEX idx_especialidad (especialidad),
      INDEX idx_zona (zona)
    ) ENGINE=InnoDB`);

    /* Partidas del presupuesto (secciones de obra) */
    await c.query(`CREATE TABLE IF NOT EXISTS PARTIDA (
      id_partida   INT NOT NULL AUTO_INCREMENT,
      id_proyecto  INT NOT NULL,
      numero       VARCHAR(10) NOT NULL COMMENT 'Ej: 01, 02, 02.01',
      nombre       VARCHAR(200) NOT NULL,
      descripcion  TEXT,
      orden        INT NOT NULL DEFAULT 0,
      PRIMARY KEY (id_partida),
      FOREIGN KEY (id_proyecto) REFERENCES PROYECTO(id_proyecto) ON DELETE CASCADE,
      INDEX idx_proyecto (id_proyecto)
    ) ENGINE=InnoDB`);

    /* Conceptos del presupuesto (líneas del catálogo aplicadas a una partida) */
    await c.query(`CREATE TABLE IF NOT EXISTS CONCEPTO (
      id_concepto     INT NOT NULL AUTO_INCREMENT,
      id_partida      INT NOT NULL,
      id_catalogo     INT COMMENT 'Referencia al catálogo CMIC/BIMSA, NULL si es concepto libre',
      clave           VARCHAR(30),
      descripcion     TEXT NOT NULL,
      unidad          VARCHAR(30) NOT NULL,
      cantidad        DECIMAL(12,3) NOT NULL DEFAULT 0,
      precio_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
      importe         DECIMAL(14,2) GENERATED ALWAYS AS (ROUND(cantidad * precio_unitario, 2)) STORED,
      orden           INT NOT NULL DEFAULT 0,
      PRIMARY KEY (id_concepto),
      FOREIGN KEY (id_partida)  REFERENCES PARTIDA(id_partida) ON DELETE CASCADE,
      FOREIGN KEY (id_catalogo) REFERENCES CATALOGO_CONCEPTO(id_catalogo) ON DELETE SET NULL,
      INDEX idx_partida (id_partida)
    ) ENGINE=InnoDB`);

    /* APU — Componentes de materiales por concepto */
    await c.query(`CREATE TABLE IF NOT EXISTS APU_MATERIAL (
      id_apu_mat    INT NOT NULL AUTO_INCREMENT,
      id_concepto   INT NOT NULL,
      id_producto   INT,
      descripcion   VARCHAR(200) NOT NULL,
      unidad        VARCHAR(30) NOT NULL,
      cantidad      DECIMAL(12,4) NOT NULL,
      precio_unit   DECIMAL(10,2) NOT NULL,
      importe       DECIMAL(12,2) GENERATED ALWAYS AS (ROUND(cantidad * precio_unit, 2)) STORED,
      PRIMARY KEY (id_apu_mat),
      FOREIGN KEY (id_concepto) REFERENCES CONCEPTO(id_concepto) ON DELETE CASCADE,
      FOREIGN KEY (id_producto) REFERENCES PRODUCTO(id_producto) ON DELETE SET NULL
    ) ENGINE=InnoDB`);

    /* APU — Componentes de mano de obra por concepto */
    await c.query(`CREATE TABLE IF NOT EXISTS APU_MANO_OBRA (
      id_apu_mo     INT NOT NULL AUTO_INCREMENT,
      id_concepto   INT NOT NULL,
      id_fasar      INT,
      categoria     VARCHAR(100) NOT NULL,
      rendimiento   DECIMAL(10,4) NOT NULL COMMENT 'Cantidad de esta categoría por unidad del concepto',
      salario_real  DECIMAL(10,2) NOT NULL,
      importe       DECIMAL(12,2) GENERATED ALWAYS AS (ROUND(rendimiento * salario_real, 2)) STORED,
      PRIMARY KEY (id_apu_mo),
      FOREIGN KEY (id_concepto) REFERENCES CONCEPTO(id_concepto) ON DELETE CASCADE,
      FOREIGN KEY (id_fasar)    REFERENCES FASAR(id_fasar) ON DELETE SET NULL
    ) ENGINE=InnoDB`);

    /* APU — Maquinaria y equipo por concepto */
    await c.query(`CREATE TABLE IF NOT EXISTS APU_MAQUINARIA (
      id_apu_maq   INT NOT NULL AUTO_INCREMENT,
      id_concepto  INT NOT NULL,
      descripcion  VARCHAR(200) NOT NULL,
      rendimiento  DECIMAL(10,4) NOT NULL COMMENT 'Horas máquina por unidad',
      costo_hora   DECIMAL(10,2) NOT NULL,
      importe      DECIMAL(12,2) GENERATED ALWAYS AS (ROUND(rendimiento * costo_hora, 2)) STORED,
      PRIMARY KEY (id_apu_maq),
      FOREIGN KEY (id_concepto) REFERENCES CONCEPTO(id_concepto) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    /* Generador de cantidades — seguimiento de ejecución física por concepto */
    await c.query(`CREATE TABLE IF NOT EXISTS GENERADOR (
      id_generador       INT NOT NULL AUTO_INCREMENT,
      id_concepto        INT NOT NULL,
      numero_estimacion  INT NOT NULL DEFAULT 1,
      descripcion        VARCHAR(200),
      cantidad_periodo   DECIMAL(12,3) NOT NULL DEFAULT 0,
      fecha_generador    DATE NOT NULL,
      PRIMARY KEY (id_generador),
      FOREIGN KEY (id_concepto) REFERENCES CONCEPTO(id_concepto) ON DELETE CASCADE,
      INDEX idx_concepto (id_concepto)
    ) ENGINE=InnoDB`);

    /* Estimaciones — documentos formales de cobro */
    await c.query(`CREATE TABLE IF NOT EXISTS ESTIMACION (
      id_estimacion     INT NOT NULL AUTO_INCREMENT,
      id_proyecto       INT NOT NULL,
      numero            INT NOT NULL,
      periodo_inicio    DATE NOT NULL,
      periodo_fin       DATE NOT NULL,
      fecha_presentacion DATE,
      total_estimacion  DECIMAL(14,2) NOT NULL DEFAULT 0,
      estado            ENUM('borrador','presentada','aprobada','pagada') NOT NULL DEFAULT 'borrador',
      observaciones     TEXT,
      PRIMARY KEY (id_estimacion),
      UNIQUE KEY uq_proy_num (id_proyecto, numero),
      FOREIGN KEY (id_proyecto) REFERENCES PROYECTO(id_proyecto) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    /* Detalle de estimación — conceptos y cantidades por estimación */
    await c.query(`CREATE TABLE IF NOT EXISTS DETALLE_ESTIMACION (
      id_det_est       INT NOT NULL AUTO_INCREMENT,
      id_estimacion    INT NOT NULL,
      id_concepto      INT NOT NULL,
      cantidad_periodo DECIMAL(12,3) NOT NULL,
      precio_unitario  DECIMAL(12,2) NOT NULL,
      importe          DECIMAL(14,2) GENERATED ALWAYS AS (ROUND(cantidad_periodo * precio_unitario, 2)) STORED,
      PRIMARY KEY (id_det_est),
      FOREIGN KEY (id_estimacion) REFERENCES ESTIMACION(id_estimacion) ON DELETE CASCADE,
      FOREIGN KEY (id_concepto)   REFERENCES CONCEPTO(id_concepto)
    ) ENGINE=InnoDB`);

    /* Migracion idempotente: habilita el estado 'borrador' para importaciones. */
    await ensureProyectoEstadoBorrador(c);

    /* ─── SEED DATA ─── */
    const [[{ cnt }]] = await c.query('SELECT COUNT(*) as cnt FROM USUARIO');
    if (cnt > 0) { console.log('BD ya tiene datos.'); return; }

    console.log('Insertando datos de prueba...');

    /* USUARIOS */
    const h1 = await bcrypt.hash('admin123', 10);
    const h2 = await bcrypt.hash('encargado123', 10);
    const h3 = await bcrypt.hash('lector123', 10);
    await c.query(`INSERT INTO USUARIO (nombre_usuario,correo,rol,contrasena_hash,RFC) VALUES
      ('Ing. Carlos Macias','admin@protocem.mx','administrador',?,'MACC800101ABC'),
      ('Juan Encargado','encargado@protocem.mx','encargado',?,NULL),
      ('Maria Velador','velador@protocem.mx','solo_lectura',?,NULL)`, [h1,h2,h3]);

    /* PROVEEDORES */
    await c.query(`INSERT INTO PROVEEDOR (nombre,empresa,telefono,contacto,especialidad) VALUES
      ('Cruz Azul Ags','Cementos Cruz Azul','4491234567','Pedro Ramirez','Cementantes y Agregados'),
      ('Home Depot Ags','The Home Depot Mexico','4497654321','Sucursal Ags','Materiales en General'),
      ('Apasco Ags','Holcim Apasco','4493216547','Carlos Vega','Cementantes'),
      ('Ferretero Norte','GFN SA de CV','4498765432','Ana Torres','Acero y Herrería'),
      ('Distribuidora Eléctrica AGS','DEAGS SA de CV','4492345678','Roberto Soto','Instalaciones Eléctricas'),
      ('Hidro Instalaciones','HI SA de CV','4495678901','Lupita Reyes','Instalaciones Hidráulicas')`);

    /* PRODUCTOS — con taxonomía OPUS de 5 tipos */
    await c.query(`INSERT INTO PRODUCTO (descripcion,tipo_producto,unidades,precio_referencia,stock) VALUES
      ('Cemento Portland gris 50kg','Material','bulto',260.00,200),
      ('Grava 3/4 pulgada','Material','m3',380.00,45),
      ('Arena fina lavada','Material','m3',290.00,80),
      ('Varilla corrugada 3/8','Material','kg',28.50,1200),
      ('Varilla corrugada 1/2','Material','kg',32.00,900),
      ('Agua potable','Material','m3',45.00,120),
      ('Block de concreto 15x20x40','Material','pieza',14.50,3500),
      ('Tabla de madera pino 2x4','Material','pieza',85.00,0),
      ('Clavo de acero 2.5 pulgada','Material','kg',38.00,0),
      ('Malla electrosoldada 6x6','Material','m2',95.00,0),
      ('Tabique rojo recocido','Material','millar',1850.00,0),
      ('Concreto premezclado f''c=150 kg/cm2','Material','m3',1950.00,0),
      ('Concreto premezclado f''c=200 kg/cm2','Material','m3',2250.00,0),
      ('Concreto premezclado f''c=250 kg/cm2','Material','m3',2650.00,0),
      ('Arena gruesa para mortero','Material','m3',310.00,30),
      ('Cal hidratada 20kg','Material','saco',95.00,0),
      ('Acero de refuerzo en varilla 3/8','Material','ton',22500.00,0),
      ('Acero de refuerzo en varilla 1/2','Material','ton',23800.00,0),
      ('Pintura vinílica blanca','Material','cubeta',580.00,0),
      ('Tubo de cobre 1/2 pulgada','Material','ml',85.00,0),
      ('Oficial albañil','Mano de Obra','jornal',404.70,0),
      ('Ayudante de albañil','Mano de Obra','jornal',305.30,0),
      ('Oficial electricista','Mano de Obra','jornal',475.00,0),
      ('Oficial plomero','Mano de Obra','jornal',450.00,0),
      ('Peón general','Mano de Obra','jornal',305.30,0),
      ('Oficial mayor','Mano de Obra','jornal',545.00,0),
      ('Herramienta menor (3% s/MO)','Herramienta y Equipo','%',3.00,0),
      ('Revolvedora de 1 saco','Maquinaria','hora',185.00,0),
      ('Vibrador de concreto','Maquinaria','hora',120.00,0),
      ('Retroexcavadora Case 580','Maquinaria','hora',850.00,0)`);

    /* PROYECTOS — 1 proyecto de ejemplo */
    const [[u]] = await c.query(`SELECT id_usuario FROM USUARIO WHERE correo='admin@protocem.mx'`);
    const uid = u.id_usuario;
    await c.query(`INSERT INTO PROYECTO (nombre_obra,descripcion,fecha_inicio,fecha_fin_estimada,presupuesto,porcentaje_avance,estado,zona,id_usuario) VALUES
      ('Carretera Ags-Calvillo Tramo 3','Construcción de 4.2 km de carretera de dos carriles con pavimento hidráulico, guarniciones y drenaje pluvial.','2025-01-15','2025-08-15',12442757.00,45.00,'activo','Centro',${uid})`);

    const [[pid]] = await c.query(`SELECT id_proyecto as id FROM PROYECTO ORDER BY id_proyecto LIMIT 1`);
    const p0 = pid.id;

    const [prods] = await c.query(`SELECT id_producto FROM PRODUCTO ORDER BY id_producto`);
    const [provs] = await c.query(`SELECT id_proveedor FROM PROVEEDOR ORDER BY id_proveedor`);
    const pr = prods.map(r=>r.id_producto);
    const pv = provs.map(r=>r.id_proveedor);

    /* COTIZACIONES */
    await c.query(`INSERT INTO COTIZACION (fecha_cotizacion,precio_cotizado,id_producto,id_proveedor) VALUES
      ('2025-01-10',260.00,${pr[0]},${pv[0]}),('2025-01-10',270.00,${pr[0]},${pv[1]}),
      ('2025-01-10',380.00,${pr[1]},${pv[2]}),('2025-01-10',290.00,${pr[2]},${pv[0]}),
      ('2025-02-01',28.50,${pr[3]},${pv[3]}),('2025-02-01',32.00,${pr[4]},${pv[3]}),
      ('2025-01-15',45.00,${pr[5]},${pv[2]}),('2025-03-01',14.50,${pr[6]},${pv[1]}),
      ('2025-01-20',1850.00,${pr[10]},${pv[0]}),('2025-02-15',2250.00,${pr[12]},${pv[2]})`);

    /* COMPRAS */
    await c.query(`INSERT INTO COMPRA (fecha_compra,total_compra,id_proyecto) VALUES
      ('2025-01-20',156000.00,${p0}),('2025-02-10',89500.00,${p0}),
      ('2025-03-05',210000.00,${p0}),('2025-03-15',78500.00,${p0})`);

    const [cs] = await c.query(`SELECT id_compra FROM COMPRA ORDER BY id_compra`);
    const cc   = cs.map(r=>r.id_compra);

    await c.query(`INSERT INTO DETALLE_COMPRA (id_compra,id_producto,cantidad,precio_unitario_real) VALUES
      (${cc[0]},${pr[0]},400,285.00),(${cc[0]},${pr[1]},80,400.00),
      (${cc[1]},${pr[2]},120,305.00),(${cc[1]},${pr[5]},500,48.00),
      (${cc[2]},${pr[3]},2000,29.50),(${cc[2]},${pr[4]},1500,33.50),
      (${cc[3]},${pr[0]},150,295.00),(${cc[3]},${pr[2]},80,310.00)`);

    /* SALIDAS */
    await c.query(`INSERT INTO SALIDA (fecha_salida,responsable,tipo_salida,total_salida,id_proyecto) VALUES
      ('2025-01-25','Juan Encargado','consumo',28500.00,${p0}),
      ('2025-02-12','Juan Encargado','consumo',15200.00,${p0}),
      ('2025-02-20','Maria Velador','merma',3800.00,${p0})`);

    const [ss] = await c.query(`SELECT id_salida FROM SALIDA ORDER BY id_salida`);
    const sl   = ss.map(r=>r.id_salida);

    await c.query(`INSERT INTO DETALLE_SALIDA (id_salida,id_producto,cantidad) VALUES
      (${sl[0]},${pr[0]},100),(${sl[0]},${pr[1]},35),
      (${sl[1]},${pr[2]},52),(${sl[1]},${pr[5]},200),
      (${sl[2]},${pr[0]},13)`);

    /* PARTIDAS Y CONCEPTOS — Carretera Ags-Calvillo (sin referencia a catálogo, funciona antes del import) */
    await c.query(`INSERT INTO PARTIDA (id_proyecto,numero,nombre,orden) VALUES
      (${p0},'01','Trabajos Preliminares',1),
      (${p0},'02','Terracerías',2),
      (${p0},'03','Pavimentación',3),
      (${p0},'04','Drenaje Pluvial',4)`);

    const [parts] = await c.query(`SELECT id_partida FROM PARTIDA WHERE id_proyecto=${p0} ORDER BY orden`);
    const pt = parts.map(r=>r.id_partida);

    await c.query(`INSERT INTO CONCEPTO (id_partida,id_catalogo,clave,descripcion,unidad,cantidad,precio_unitario,orden) VALUES
      (${pt[0]},NULL,'PRE-01','Trazo y nivelación de terreno con equipo topográfico','m2',8400,18.50,1),
      (${pt[0]},NULL,'PRE-02','Despalme de terreno natural hasta 30cm de profundidad','m2',8400,45.00,2),
      (${pt[0]},NULL,'PRE-06','Acarreo de material excedente hasta 5km','m3',2520,95.00,3),
      (${pt[1]},NULL,'PRE-03','Excavación a cielo abierto en material tipo I','m3',5800,180.00,1),
      (${pt[1]},NULL,'PRE-04','Excavación a cielo abierto en material tipo II','m3',3200,245.00,2),
      (${pt[2]},NULL,'INF-01','Pavimento de concreto hidráulico f''c=300 kg/cm2, e=20cm','m2',16800,950.00,1),
      (${pt[2]},NULL,'INF-03','Guarnición de concreto f''c=200 kg/cm2','ml',8400,285.00,2),
      (${pt[2]},NULL,'INF-04','Banqueta de concreto f''c=200 kg/cm2, e=10cm','m2',2520,380.00,3),
      (${pt[3]},NULL,'INF-05','Tubería de concreto simple de 30cm para drenaje','ml',4200,580.00,1),
      (${pt[3]},NULL,'INF-06','Pozo de visita de concreto armado h=1.50m','pza',28,18500.00,2)`);

    /* ESTIMACIONES de muestra — Carretera Ags-Calvillo */
    await c.query(`INSERT INTO ESTIMACION (id_proyecto,numero,periodo_inicio,periodo_fin,total_estimacion,estado,observaciones) VALUES
      (${p0},1,'2025-01-15','2025-02-15',1285200.00,'aprobada','Primera estimación, incluye trabajos de trazo, despalme y terracerías iniciales.'),
      (${p0},2,'2025-02-16','2025-03-15',2150000.00,'presentada','Segunda estimación: avance de terracerías y primeras unidades de pavimentación.')`);

    /* GENERADORES de cantidades */
    const [concs] = await c.query(`SELECT id_concepto FROM CONCEPTO ORDER BY id_concepto`);
    if (concs.length >= 4) {
      await c.query(`INSERT INTO GENERADOR (id_concepto,numero_estimacion,descripcion,cantidad_periodo,fecha_generador) VALUES
        (${concs[0].id_concepto},1,'Trazo de eje principal y ejes secundarios',6300,'2025-02-10'),
        (${concs[0].id_concepto},2,'Trazo de accesos y glorieta',2100,'2025-03-10'),
        (${concs[1].id_concepto},1,'Despalme zona norte del trazo',5000,'2025-02-12'),
        (${concs[1].id_concepto},2,'Despalme zona sur del trazo',3400,'2025-03-12'),
        (${concs[3].id_concepto},1,'Excavación km 0+000 a km 1+400',3200,'2025-02-20'),
        (${concs[3].id_concepto},2,'Excavación km 1+400 a km 2+800',2600,'2025-03-20')`);
    }

    console.log('Datos de prueba insertados — BD Protocem + OPUS lista.');
  } finally { c.release(); }
}

module.exports = { pool, initDB, describeDatabaseTarget };
