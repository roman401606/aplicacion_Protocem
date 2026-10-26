'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const XLSX  = require('xlsx');
const mysql = require('mysql2/promise');
const path  = require('path');
const fs    = require('fs');

const BASE = process.env.OPUS_DATA_PATH ||
  'C:/Users/roman/OneDrive/Desktop/OPUS/matrices_temp/MATRICES PU';
const OBR  = BASE + '/OBRA CIVIL EDIFICACION 2025 EXCEL';

/* ── Sección → Especialidad (para catálogo BIMSA/OBRA CIVIL) ── */
const SEC_ESP = {
  PRELIMINARES:'Preliminares',
  CIMENTACION:'Edificación','ZAPATAS':'Edificación',
  'ZAPATAS CORRIDAS':'Edificación','ZAPATAS AISLADAS':'Edificación',
  DADOS:'Edificación',CONTRATRABES:'Edificación',
  'ESTRUCTURA DE CONCRETO':'Edificación',ALBAÑILERIA:'Edificación',
  MUROS:'Edificación','TABIQUE ROJO':'Edificación',BLOCK:'Edificación',
  TABICON:'Edificación',CASTILLOS:'Edificación',APLANADOS:'Edificación',
  'HUELLAS Y ESCALERAS':'Edificación',AZOTEAS:'Edificación',
  REGISTROS:'Edificación',FIRMES:'Edificación',VARIOS:'Edificación',
  DALAS:'Edificación',CADENAS:'Edificación',
  ALBERCAS:'Hidráulica','CISTERNA DE CONCRETO':'Hidráulica',CISTERNA:'Hidráulica',
};

/* ── Archivos combinados por especialidad ── */
const SPEC_FILES = [
  { file:'Matrices Instalaciones Hidraulicas 2025.xlsx', esp:'Hidráulica' },
  { file:'Matrices Instalaciones Electricas 2025.xlsx',  esp:'Eléctrico' },
  { file:'Matrices Infraestructura 2025.xlsx',           esp:'Infraestructura' },
  { file:'Matrices Industrial 2025.xlsx',                esp:'Industrial' },
  { file:'Matrices Aire Acondicionado 2025.xlsx',        esp:'Aire Acondicionado' },
  { file:'Matrices Obra Civil 2025.xlsx',                esp:'Obra Civil' },
];

/* ── INSERT en bloques ── */
async function batchInsert(conn, sql, rows, size = 300) {
  let n = 0;
  for (let i = 0; i < rows.length; i += size) {
    try {
      const [r] = await conn.query(sql, [rows.slice(i, i + size)]);
      n += r.affectedRows;
    } catch (_) {}
  }
  return n;
}

/* ── 1. FASAR desde CATEGORIAS, SALARIOS.xls ── */
function parseFasar() {
  const file = OBR + '/CATALOGOS/CATEGORIAS, SALARIOS.xls';
  if (!fs.existsSync(file)) { console.warn('  FASAR: archivo no encontrado'); return []; }
  const rows = XLSX.utils.sheet_to_json(
    XLSX.readFile(file).Sheets[XLSX.readFile(file).SheetNames[0]],
    { header:1, defval:'' }
  );
  return rows
    .filter(r => String(r[3]||'').startsWith('MO') && r[6] && r[11] && r[14])
    .map(r => [
      String(r[6]).trim().substring(0,100),         // categoria
      typeof r[11]==='number' ? r[11] : parseFloat(r[11])||0, // salario_base
      typeof r[14]==='number' ? r[14] : parseFloat(r[14])||0, // factor
      'Centro', 2025
    ]);
}

/* ── 2. Catálogo BIMSA (Obra Civil + Edificación) ── */
function parseCatalogoBIMSA() {
  const file = OBR + '/CATALOGOS/CATALOGO GENERAL.xlsx';
  if (!fs.existsSync(file)) { console.warn('  BIMSA: archivo no encontrado'); return []; }
  const rows = XLSX.utils.sheet_to_json(
    XLSX.readFile(file).Sheets[XLSX.readFile(file).SheetNames[0]],
    { header:1, defval:'' }
  );
  const data = [];
  let esp = 'Obra Civil';
  for (const r of rows) {
    const c0  = String(r[0]||'').trim();
    const c3  = String(r[3]||'').trim();
    const c7  = String(r[7]||'').trim();
    const c13 = typeof r[13]==='number' ? r[13] : parseFloat(r[13])||0;
    if (!c0 && c3 && c3===c3.toUpperCase() && !c7 && !c13 && !c3.startsWith('IMPORTE'))
      if (SEC_ESP[c3]) esp = SEC_ESP[c3];
    if (c0.match(/^\d{5}-\d{3}/) && c3 && c7)
      data.push([c0, c3.substring(0,250), c7.substring(0,30), c13||null, esp, 'BIMSA', 2025, 'Nacional']);
  }
  return data;
}

/* ── 3. Catálogos combinados por especialidad ── */
function parseCatalogoEsp(filename, esp) {
  const fpath = path.join(BASE, filename);
  if (!fs.existsSync(fpath)) return [];
  const wb = XLSX.readFile(fpath);
  const ws = wb.Sheets['Catalogo'];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
  return rows
    .filter(r => String(r[0]||'').match(/^[A-Z]\d+/) && r[1] && r[2])
    .map(r => [
      String(r[0]).trim().substring(0,30),
      String(r[1]).trim().substring(0,250),
      String(r[2]).trim().substring(0,30),
      typeof r[4]==='number' ? r[4] : parseFloat(r[4])||null,
      esp, 'BIMSA', 2025, 'Nacional'
    ]);
}

/* ── 4. APU desde matrices individuales .xls ── */
function parseAPU() {
  const matBase = OBR + '/MATRICES';
  if (!fs.existsSync(matBase)) { console.warn('  APU: carpeta MATRICES no encontrada'); return new Map(); }
  const apuMap = new Map();

  function walkDir(dir) {
    for (const f of fs.readdirSync(dir)) {
      const fp = path.join(dir, f);
      if (fs.statSync(fp).isDirectory()) { walkDir(fp); continue; }
      if (!f.endsWith('.xls') || f.endsWith('.xlsx')) continue;
      try {
        const wb   = XLSX.readFile(fp);
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1,defval:''});
        let cur = null, state = null;
        for (const r of rows) {
          const c0  = String(r[0]||'').trim();
          const c1  = String(r[1]||'').trim();
          const c4  = String(r[4]||'').trim();
          const c8  = String(r[8]||'').trim();
          const c11 = String(r[11]||'').trim();
          const c13 = typeof r[13]==='number' ? r[13] : parseFloat(r[13])||0;
          if (c1 === 'Clave:') {
            const cl = String(r[5]||'').trim();
            if (cl) { cur = cl; if (!apuMap.has(cl)) apuMap.set(cl,{mat:[],mo:[]}); state=null; }
            continue;
          }
          if (!cur) continue;
          if (c0==='Materiales') { state='mat'; continue; }
          if (c0==='Mano de Obra') { state='mo'; continue; }
          if (c0.startsWith('Total')||c0==='Equipo') { state=null; continue; }
          if (state==='mat' && c4 && c8 && c13>0)
            apuMap.get(cur).mat.push([c4.substring(0,30),c8.substring(0,250),c11.substring(0,30),c13]);
          if (state==='mo' && c4 && !c4.startsWith('%') && c8 && c13>0)
            apuMap.get(cur).mo.push([c4.substring(0,20),c8.substring(0,100),c13]);
        }
      } catch (_) {}
    }
  }
  walkDir(matBase);
  return apuMap;
}

/* ════════════════════════════ MAIN ════════════════════════════ */
async function main() {
  console.log('Conectando a BD...');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT)||3306,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  /* Asegurar tablas APU catálogo */
  await conn.query(`CREATE TABLE IF NOT EXISTS APU_CAT_MATERIAL (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    id_catalogo INT NOT NULL,
    clave_material VARCHAR(30),
    descripcion VARCHAR(250) NOT NULL,
    unidad      VARCHAR(30)  NOT NULL,
    cantidad    DECIMAL(12,4) NOT NULL,
    FOREIGN KEY (id_catalogo) REFERENCES CATALOGO_CONCEPTO(id_catalogo) ON DELETE CASCADE,
    INDEX idx_cat (id_catalogo)
  ) ENGINE=InnoDB`);

  await conn.query(`CREATE TABLE IF NOT EXISTS APU_CAT_MANO_OBRA (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    id_catalogo INT NOT NULL,
    mo_clave    VARCHAR(20),
    categoria   VARCHAR(100) NOT NULL,
    rendimiento DECIMAL(10,4) NOT NULL,
    FOREIGN KEY (id_catalogo) REFERENCES CATALOGO_CONCEPTO(id_catalogo) ON DELETE CASCADE,
    INDEX idx_cat (id_catalogo)
  ) ENGINE=InnoDB`);

  console.log('Limpiando datos OPUS anteriores...');
  await conn.query('DELETE FROM APU_CAT_MANO_OBRA');
  await conn.query('DELETE FROM APU_CAT_MATERIAL');
  await conn.query('DELETE FROM CATALOGO_CONCEPTO');
  await conn.query('DELETE FROM FASAR');

  /* 1. FASAR */
  process.stdout.write('FASAR... ');
  const fasarRows = parseFasar();
  const nFasar = await batchInsert(conn,
    'INSERT INTO FASAR (categoria,salario_base,factor,zona,vigencia) VALUES ?', fasarRows);
  console.log(nFasar + ' categorías');

  /* 2. Catálogo BIMSA */
  process.stdout.write('Catálogo BIMSA (Obra Civil/Edificacion)... ');
  const bimsa = parseCatalogoBIMSA();
  const nBimsa = await batchInsert(conn,
    'INSERT IGNORE INTO CATALOGO_CONCEPTO (clave,descripcion,unidad,precio_ref,especialidad,fuente,año_catalogo,zona) VALUES ?', bimsa);
  console.log(nBimsa + '/' + bimsa.length);

  /* 3. Catálogos especialidad */
  console.log('Catálogos por especialidad:');
  let specTotal = 0;
  for (const { file, esp } of SPEC_FILES) {
    process.stdout.write('  ' + esp + '... ');
    const rows = parseCatalogoEsp(file, esp);
    const n    = await batchInsert(conn,
      'INSERT IGNORE INTO CATALOGO_CONCEPTO (clave,descripcion,unidad,precio_ref,especialidad,fuente,año_catalogo,zona) VALUES ?', rows);
    console.log(n + '/' + rows.length);
    specTotal += n;
  }

  /* 4. APU catálogo */
  process.stdout.write('APU desde matrices... ');
  const apuMap = parseAPU();
  const [catRows] = await conn.query('SELECT id_catalogo,clave FROM CATALOGO_CONCEPTO');
  const claveId = Object.fromEntries(catRows.map(r => [r.clave, r.id_catalogo]));

  const apuMat = [], apuMO = [];
  for (const [clave, { mat, mo }] of apuMap) {
    const idCat = claveId[clave];
    if (!idCat) continue;
    mat.forEach(m => apuMat.push([idCat, m[0], m[1], m[2], m[3]]));
    mo.forEach(m  => apuMO.push([idCat, m[0], m[1], m[2]]));
  }
  const nMat = apuMat.length ? await batchInsert(conn,
    'INSERT IGNORE INTO APU_CAT_MATERIAL (id_catalogo,clave_material,descripcion,unidad,cantidad) VALUES ?', apuMat) : 0;
  const nMO  = apuMO.length  ? await batchInsert(conn,
    'INSERT IGNORE INTO APU_CAT_MANO_OBRA (id_catalogo,mo_clave,categoria,rendimiento) VALUES ?', apuMO)  : 0;
  console.log('Mat=' + nMat + ' MO=' + nMO);

  /* Resumen */
  const [[{total}]] = await conn.query('SELECT COUNT(*) as total FROM CATALOGO_CONCEPTO');
  const [[{tFasar}]] = await conn.query('SELECT COUNT(*) as tFasar FROM FASAR');
  console.log('\n════════════════════════════════');
  console.log(' FASAR:             ' + tFasar + ' categorías');
  console.log(' Catálogo total:    ' + total  + ' conceptos');
  console.log(' APU Materiales:    ' + nMat);
  console.log(' APU Mano de Obra:  ' + nMO);
  console.log('════════════════════════════════\n');

  await conn.end();
}

main().catch(e => { console.error('\nERROR:', e.message); process.exit(1); });
