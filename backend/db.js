const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const storage = require('./storage');
const ext = require('./external_services');

const DB_DIR = path.resolve(__dirname, '..', 'database');
const DB_PATH = path.join(DB_DIR, 'uao_attendance.db');
const SCHEMA_PATH = path.join(DB_DIR, 'schema.sql');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');

const NOMBRES_ROSTER = [
  'Ivan Agudelo del Río', 'Nicolas Castaño Polanco', 'Juan Pablo Domínguez Flores',
  'Juan Pablo Plaza Mazo', 'Valentina Arias', 'Andrés Felipe Morales',
  'Camila Andrea Rojas', 'Mateo Castro', 'Sara Sofía Castillo',
  'Daniel Alejandro Cruz', 'Laura Sofía Pérez', 'Santiago Mejía',
  'Mariana López Ortiz', 'Carlos Eduardo Rivas', 'Gabriela Herrera',
  'David Esteban Pardo', 'Isabella Torres', 'Samuel José Vargas',
  'María Fernanda Ruiz', 'Felipe Barreneche', 'Manuela Quintero',
  'Alejandro Beltrán', 'Juan Sebastián Marín Restrepo', 'Juliana Restrepo',
  'Cristian Camilo Ortiz', 'Estefanía Salazar', 'Sebastián Ríos',
  'Valeria Cárdenas', 'Diego Fernando Ruiz', 'Paula Andrea Varela'
];

function obtenerIniciales(nombre) {
  const parts = String(nombre || 'UA').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function calcFallas(aus, tot) {
  if (!tot || tot <= 0) {
    return {
      pct: 0,
      asistPct: 100,
      nivel: 'ok',
      maxPermitidas: 0,
      faltasRestantesPermitidas: 0,
      faltasParaSuperar20: 0,
      faltasPara20: 0
    };
  }
  const pctRaw = (aus / tot) * 100;
  const pct = Math.round(pctRaw * 10) / 10;
  const asistPct = Math.round((100 - pctRaw) * 10) / 10;

  const maxPermitidas = Math.floor(tot * 0.20 + 1e-9);
  const faltasRestantesPermitidas = Math.max(0, maxPermitidas - aus);
  const faltasParaSuperar20 = Math.max(0, (maxPermitidas + 1) - aus);
  const nivel = pct > 20 || aus > maxPermitidas ? 'rojo' : pct >= 15 ? 'ambar' : 'ok';

  return {
    pct,
    asistPct,
    nivel,
    maxPermitidas,
    faltasRestantesPermitidas,
    faltasParaSuperar20,

    faltasPara20: faltasParaSuperar20
  };
}

function generarPin4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function generarTokenQr() {
  return 'UAO-' + Math.random().toString(36).slice(2, 11).toUpperCase();
}

function initSchemaAndSeed(forceReset = false) {
  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');

  if (forceReset) {
    db.exec(`
      DROP TRIGGER IF EXISTS trg_bitacora_no_update;
      DROP TABLE IF EXISTS bitacora_auditoria;
      DROP TABLE IF EXISTS excusas;
      DROP TABLE IF EXISTS historial_estudiante;
      DROP TABLE IF EXISTS registros_asistencia;
      DROP TABLE IF EXISTS sesiones;
      DROP TABLE IF EXISTS matriculas;
      DROP TABLE IF EXISTS asignaturas;
      DROP TABLE IF EXISTS usuarios;
    `);
  }

  db.exec(schemaSql);

  const countUsers = db.prepare('SELECT COUNT(*) AS c FROM usuarios').get().c;
  if (countUsers > 0 && !forceReset) {
    return;
  }

  db.exec('BEGIN TRANSACTION');
  try {
    const insertUser = db.prepare(`
    INSERT INTO usuarios (username, correo, password, nombre, codigo, rol, programa, iniciales)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('sandra.guanarita', 'sandra.guanarita@uao.edu.co', 'Uao2026*', 'Sandra Lucía Guañarita Fernández', '1001001', 'docente', 'Departamento de Operaciones y Sistemas', 'SG');
  insertUser.run('carlos.ramirez', 'carlos.ramirez@uao.edu.co', 'Uao2026*', 'Carlos Ramírez', '9001001', 'director', 'Dirección de Ingeniería de Software', 'CR');
  insertUser.run('director.software', 'director.software@uao.edu.co', 'Uao2026*', 'Carlos Ramírez', '9001002', 'director', 'Dirección de Ingeniería de Software', 'CR');

  function getRosterCode(n) {
    if (n === 23) return '2248332';
    if (n === 13) return '2248910';
    return String(2245000 + n);
  }

  NOMBRES_ROSTER.forEach((nom, idx) => {
    const n = idx + 1;
    const cod = getRosterCode(n);
    const uname = n === 23
      ? 'juan_se.marin'
      : n === 13
        ? 'mariana.lopez'
        : nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '.').slice(0, 24) + '.' + n;
    insertUser.run(uname, `${uname}@uao.edu.co`, 'Uao2026*', nom, cod, 'estudiante', 'Ingeniería de Software', obtenerIniciales(nom));
  });

  insertUser.run('estudiante.externo', 'estudiante.externo@uao.edu.co', 'Uao2026*', 'Camilo Andrés Soto (Otro Grupo)', '2249999', 'estudiante', 'Ingeniería Industrial', 'CS');

  const insertAsig = db.prepare(`
    INSERT INTO asignaturas (id, codigo_corto, nombre, grupo, periodo, docente_codigo, docente_nombre, salon, horario, facultad, total_sesiones)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertAsig.run('isw1', 'ISW', 'Ingeniería de Software I', 'G01', '2026-1', '1001001', 'Sandra Guañarita', 'Salón Y3-04', '8:00–10:00 a. m.', 'Ingeniería', 18);
  insertAsig.run('bd2', 'BDD', 'Bases de Datos II', 'G01', '2026-1', '1001002', 'Juan Carlos Ríos', 'Salón Y2-08', '10:00–12:00 m.', 'Ingeniería', 19);
  insertAsig.run('md', 'MAT', 'Matemáticas Discretas', 'G01', '2026-1', '1001003', 'Ana María Vélez', 'Salón A1-05', '2:00–4:00 p. m.', 'Ingeniería', 19);

  const insertMat = db.prepare(`
    INSERT INTO matriculas (estudiante_codigo, asignatura_id, grupo, periodo)
    VALUES (?, ?, ?, ?)
  `);

  NOMBRES_ROSTER.forEach((_, idx) => {
    const n = idx + 1;
    const cod = getRosterCode(n);
    insertMat.run(cod, 'isw1', 'G01', '2026-1');
    insertMat.run(cod, 'bd2', 'G01', '2026-1');
    insertMat.run(cod, 'md', 'G01', '2026-1');
  });

  insertMat.run('2249999', 'bd2', 'G02', '2026-1');

  db.prepare(`
    INSERT INTO sesiones (id, asignatura_id, grupo, periodo, fecha, hora_inicio, hora_fin, aula, estado, pin_actual, token_qr, pin_expira, red_caida)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'SES-ISW1-G01-ACTUAL',
    'isw1',
    'G01',
    '2026-1',
    '2026-11-02',
    '08:00 a. m.',
    '10:00 a. m.',
    'Salón Y3-04',
    'ABIERTA',
    generarPin4(),
    generarTokenQr(),
    Date.now() + 60000,
    0
  );

  const insertReg = db.prepare(`
    INSERT INTO registros_asistencia (
      sesion_id, asignatura_id, grupo, periodo, estudiante_codigo, estudiante_nombre, nro_lista,
      fecha, estado, hora_registro, medio_registro, novedad_tipo, novedad_minutos, novedad_nota
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const horasDemo = ['08:01 a.m.', '08:02 a.m.', '08:02 a.m.', '08:03 a.m.', '08:04 a.m.', '08:05 a.m.'];
  NOMBRES_ROSTER.forEach((nom, idx) => {
    const n = idx + 1;
    const cod = getRosterCode(n);
    const presente = n < 20;
    const hora = presente ? horasDemo[idx % horasDemo.length] : null;
    const medio = presente ? 'QR / PIN' : null;
    insertReg.run(
      'SES-ISW1-G01-ACTUAL',
      'isw1',
      'G01',
      '2026-1',
      cod,
      nom,
      n,
      '2026-11-02',
      presente ? 'Presente' : 'Sin registro',
      hora,
      medio,
      null,
      null,
      null
    );
  });

  const insertHist = db.prepare(`
    INSERT INTO historial_estudiante (
      estudiante_codigo, asignatura_id, grupo, periodo, fecha, sesion_numero, estado, medio, novedad, es_sesion_actual
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  function seedStudentSubjectHistory(cod, asigId, totalSesiones, fallasFechas, justificadasFechas, tardanzaFecha) {

    const baseDates = [
      '2026-08-04', '2026-08-06', '2026-08-11', '2026-08-13', '2026-08-18',
      '2026-08-20', '2026-08-25', '2026-08-27', '2026-09-01', '2026-09-03',
      '2026-09-08', '2026-09-10', '2026-09-15', '2026-09-17', '2026-09-22',
      '2026-09-24', '2026-09-29', '2026-10-01', '2026-10-06', '2026-10-08'
    ];

    for (let s = 1; s <= totalSesiones; s++) {
      let fecha = baseDates[s - 1] || `2026-08-${String(s).padStart(2, '0')}`;
      let estado = 'Presente';
      let medio = s % 2 === 0 ? 'Escaneo QR móvil' : 'PIN dinámico';
      let novedad = null;

      if (s <= fallasFechas.length) {
        fecha = fallasFechas[s - 1];
        estado = 'Ausente';
        medio = 'Cierre formal M04';
      } else if (s <= fallasFechas.length + justificadasFechas.length) {
        const jIdx = s - fallasFechas.length - 1;
        fecha = justificadasFechas[jIdx];
        estado = 'Ausencia Justificada';
        medio = 'Excusa aprobada M06';
      }

      if (tardanzaFecha && s === totalSesiones - 1 && estado === 'Presente') {
        novedad = 'Llegada tarde (8m)';
      }

      insertHist.run(cod, asigId, 'G01', '2026-1', fecha, s, estado, medio, novedad, s === totalSesiones ? 1 : 0);
    }
  }

  for (const codEst of ['2248332', '2248910']) {
    seedStudentSubjectHistory(codEst, 'isw1', 18, ['2026-10-25'], ['2026-10-14'], true);
    seedStudentSubjectHistory(codEst, 'bd2', 19, ['2026-10-18', '2026-10-22'], [], false);
    seedStudentSubjectHistory(codEst, 'md', 19, ['2026-10-10', '2026-10-17', '2026-10-24'], [], false);
  }

  seedStudentSubjectHistory('2245006', 'isw1', 18, ['2026-10-20', '2026-10-12'], [], false);
  seedStudentSubjectHistory('2245006', 'bd2', 19, ['2026-10-18'], [], false);
  seedStudentSubjectHistory('2245006', 'md', 19, ['2026-10-10'], [], false);

  seedStudentSubjectHistory('2245009', 'isw1', 18, ['2026-10-21'], ['2026-10-14'], false);
  seedStudentSubjectHistory('2245009', 'bd2', 19, ['2026-10-18'], [], false);
  seedStudentSubjectHistory('2245009', 'md', 19, ['2026-10-10', '2026-10-17', '2026-10-24'], [], false);

  NOMBRES_ROSTER.forEach((_, idx) => {
    const n = idx + 1;
    const cod = getRosterCode(n);
    if (['2248332', '2248910', '2245006', '2245009'].includes(cod)) return;
    const fallasIsw = n >= 28 ? ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-25'] : ['2026-10-25'];
    seedStudentSubjectHistory(cod, 'isw1', 18, fallasIsw, [], false);
    seedStudentSubjectHistory(cod, 'bd2', 19, ['2026-10-18'], [], false);
    seedStudentSubjectHistory(cod, 'md', 19, ['2026-10-10'], [], false);
  });

  const insertExcusa = db.prepare(`
    INSERT INTO excusas (
      estudiante_codigo, estudiante_nombre, asignatura_id, asignatura_nombre,
      fecha_falta, motivo, archivo_nombre, archivo_url, archivo_tamano, archivo_mime,
      estado, fecha_radicacion, evaluado_por
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertExcusa.run(
    '2248332',
    'Juan Sebastián Marín Restrepo',
    'isw1',
    'Ingeniería de Software I',
    '2026-10-25',
    'Cita médica especialista con gastroenterólogo',
    'certificado_eps.pdf',
    '/api/soportes/certificado_eps.pdf',
    1843200,
    'application/pdf',
    'Pendiente',
    '2026-10-26 09:15:00',
    null
  );

  insertExcusa.run(
    '2245006',
    'Andrés Felipe Morales',
    'isw1',
    'Ingeniería de Software I',
    '2026-10-20',
    'Calamidad doméstica de primer grado comprobada',
    'soporte_familiar.jpg',
    '/api/soportes/soporte_familiar.jpg',
    1638400,
    'image/jpeg',
    'Pendiente',
    '2026-10-21 14:30:00',
    null
  );

  insertExcusa.run(
    '2245009',
    'Sara Sofía Castillo',
    'isw1',
    'Ingeniería de Software I',
    '2026-10-14',
    'Incapacidad médica por urgencias 48h',
    'incapacidad_sura.pdf',
    '/api/soportes/incapacidad_sura.pdf',
    1228800,
    'application/pdf',
    'Aceptada',
    '2026-10-15 10:00:00',
    'Sandra Lucía Guañarita (Docente)'
  );

  const insertBit = db.prepare(`
    INSERT INTO bitacora_auditoria (fecha_hora, autor, accion, valor_anterior, valor_nuevo, detalle)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertBit.run(
    '2026-11-02 08:00:15',
    'Sandra Lucía Guañarita (Docente)',
    'Apertura de sesión (M02)',
    'INACTIVA',
    'ABIERTA',
    'Sesión iniciada para ISW1-G01 (Salón Y3-04). PIN de 60 s y QR generados.'
  );
  insertBit.run(
    '2026-11-02 08:05:42',
    'Sandra Lucía Guañarita (Docente)',
    'Registro de contingencia (M04)',
    'Sin registro',
    'Presente',
    'Estudiante Daniel Alejandro Cruz (2245010) marcado Presente vía manual.'
  );
  db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    throw err;
  }
}

initSchemaAndSeed(false);

function registrarAuditoria({ autor, accion, valorAnterior = null, valorNuevo = null, detalle }) {
  const fechaHora = new Date().toLocaleString('es-CO');
  db.prepare(`
    INSERT INTO bitacora_auditoria (fecha_hora, autor, accion, valor_anterior, valor_nuevo, detalle)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    fechaHora,
    autor || 'Sandra Lucía Guañarita (Docente)',
    accion,
    valorAnterior,
    valorNuevo,
    detalle
  );
}

function getBitacora() {
  return db.prepare(`
    SELECT id, fecha_hora AS fecha, autor, accion, valor_anterior AS valorAnterior, valor_nuevo AS valorNuevo, detalle
    FROM bitacora_auditoria
    ORDER BY id DESC
    LIMIT 150
  `).all();
}

function getSesionActual(sesionId = 'SES-ISW1-G01-ACTUAL') {
  let ses = db.prepare('SELECT * FROM sesiones WHERE id = ?').get(sesionId);
  if (!ses) return null;

  if (ses.estado === 'ABIERTA') {
    if (ses.red_caida === 1) {
      if (ses.pin_expira - Date.now() < 30000) {
        const nuevoExp = Date.now() + 60000;
        db.prepare('UPDATE sesiones SET pin_expira = ? WHERE id = ?').run(nuevoExp, sesionId);
        ses.pin_expira = nuevoExp;
      }
    } else if (Date.now() >= ses.pin_expira) {
      const nuevoPin = generarPin4();
      const nuevoQr = generarTokenQr();
      const nuevoExp = Date.now() + 60000;
      db.prepare('UPDATE sesiones SET pin_actual = ?, token_qr = ?, pin_expira = ? WHERE id = ?')
        .run(nuevoPin, nuevoQr, nuevoExp, sesionId);
      ses = db.prepare('SELECT * FROM sesiones WHERE id = ?').get(sesionId);
    }
  }

  return {
    id: ses.id,
    asignaturaId: ses.asignatura_id,
    grupo: ses.grupo,
    periodo: ses.periodo,
    fecha: ses.fecha,
    horaInicio: ses.hora_inicio,
    horaFin: ses.hora_fin,
    aula: ses.aula,
    estado: ses.estado,
    sesionActiva: ses.estado === 'ABIERTA',
    pin: {
      code: ses.pin_actual,
      token: ses.token_qr,
      exp: ses.pin_expira,
      redCaida: ses.red_caida === 1
    }
  };
}

function toggleRedDocente(sesionId = 'SES-ISW1-G01-ACTUAL', redCaida = true, autor = 'Sandra Lucía Guañarita (Docente)') {
  const flag = redCaida ? 1 : 0;
  const nuevoExp = Date.now() + 60000;
  if (flag === 1) {

    db.prepare('UPDATE sesiones SET red_caida = 1, pin_expira = ? WHERE id = ?').run(nuevoExp, sesionId);
    registrarAuditoria({
      autor,
      accion: 'Falla de red simulada (M02)',
      valorAnterior: 'Red activa',
      valorNuevo: 'PIN retenido por corte',
      detalle: 'Corte de red detectado: PIN retenido con vigencia extendida mientras dura la falla.'
    });
  } else {
    const nuevoPin = generarPin4();
    const nuevoQr = generarTokenQr();
    db.prepare('UPDATE sesiones SET red_caida = 0, pin_actual = ?, token_qr = ?, pin_expira = ? WHERE id = ?')
      .run(nuevoPin, nuevoQr, nuevoExp, sesionId);
    registrarAuditoria({
      autor,
      accion: 'Red restablecida (M02)',
      valorAnterior: 'PIN retenido',
      valorNuevo: 'Sincronización activa',
      detalle: 'Conexión restablecida y nuevo PIN de 60 s emitido.'
    });
  }
  return getSesionActual(sesionId);
}

function getRoster(sesionId = 'SES-ISW1-G01-ACTUAL') {
  const rows = db.prepare(`
    SELECT
      nro_lista AS n,
      estudiante_codigo AS codigo,
      estudiante_nombre AS nombre,
      estado,
      hora_registro AS hora,
      medio_registro AS medio,
      novedad_tipo,
      novedad_minutos,
      novedad_nota
    FROM registros_asistencia
    WHERE sesion_id = ?
    ORDER BY nro_lista ASC
  `).all(sesionId);

  return rows.map(r => ({
    n: r.n,
    codigo: r.codigo,
    nombre: r.nombre,
    iniciales: obtenerIniciales(r.nombre),
    estado: r.estado,
    hora: r.hora,
    medio: r.medio,
    novedad: r.novedad_tipo ? {
      tipo: r.novedad_tipo,
      min: r.novedad_minutos,
      nota: r.novedad_nota
    } : null
  }));
}

function sincronizarSesionConHistorial(estudianteCodigo, asignaturaId, estadoSesion, medio) {
  const lastRow = db.prepare(`
    SELECT id, estado FROM historial_estudiante
    WHERE estudiante_codigo = ? AND asignatura_id = ? AND es_sesion_actual = 1
  `).get(estudianteCodigo, asignaturaId);

  const estadoHist = estadoSesion === 'Presente' ? 'Presente' : 'Ausente';
  if (lastRow) {
    db.prepare(`
      UPDATE historial_estudiante
      SET estado = ?, medio = ?
      WHERE id = ?
    `).run(estadoHist, medio || 'Sesión de aula', lastRow.id);
  }
}

function marcarAsistenciaEstudiante({ sesionId = 'SES-ISW1-G01-ACTUAL', estudianteCodigo = '2248332', pinIngresado, modo = 'PIN', autor }) {
  const ses = getSesionActual(sesionId);
  if (!ses) {
    return { ok: false, msg: 'No hay una sesión activa. Solicite al docente iniciar la asistencia.' };
  }
  if (!ses.sesionActiva) {
    return { ok: false, msg: 'La sesión de asistencia ya fue cerrada por el docente (M04).' };
  }

  const valMat = ext.validarMatriculaRegistroAcademico(db, {
    estudianteCodigo,
    asignaturaId: ses.asignaturaId,
    grupo: ses.grupo
  });
  if (!valMat.matriculado) {
    return { ok: false, msg: valMat.msg };
  }

  if (modo === 'PIN') {
    if (!/^\d{4}$/.test(String(pinIngresado || ''))) {
      return { ok: false, msg: 'Ingresa los 4 dígitos numéricos del PIN institucional.' };
    }

    if (!ses.pin.redCaida && Date.now() >= ses.pin.exp) {
      return { ok: false, msg: 'Código PIN vencido o inválido. Verifique el tablero.' };
    }
    if (String(pinIngresado) !== ses.pin.code) {
      return { ok: false, msg: 'Código PIN incorrecto. Verifique el código proyectado.' };
    }
  }

  const reg = db.prepare(`
    SELECT * FROM registros_asistencia
    WHERE sesion_id = ? AND estudiante_codigo = ?
  `).get(sesionId, estudianteCodigo);

  if (!reg) {
    return { ok: false, msg: `Error RF-11: Estudiante (${estudianteCodigo}) no matriculado en este grupo académico.` };
  }
  if (reg.estado === 'Presente') {
    return { ok: false, msg: 'Ya registraste tu asistencia para esta sesión de clase.' };
  }

  const hora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const medioLabel = modo === 'QR' ? 'Escaneo QR móvil (M03)' : 'PIN de aula (M03)';

  db.prepare(`
    UPDATE registros_asistencia
    SET estado = 'Presente', hora_registro = ?, medio_registro = ?
    WHERE id = ?
  `).run(hora, medioLabel, reg.id);

  sincronizarSesionConHistorial(estudianteCodigo, ses.asignaturaId, 'Presente', medioLabel);

  registrarAuditoria({
    autor: autor || `${reg.estudiante_nombre} (Estudiante)`,
    accion: 'Marcado autónomo (M03)',
    valorAnterior: reg.estado,
    valorNuevo: 'Presente',
    detalle: `${reg.estudiante_nombre} (${reg.estudiante_codigo}) marcó asistencia vía ${medioLabel}.`
  });

  return {
    ok: true,
    msg: `¡Asistencia confirmada! · ${hora} · Ingeniería de Software I · Presente`,
    estudiante: reg.estudiante_nombre,
    codigo: reg.estudiante_codigo,
    hora,
    medio: medioLabel
  };
}

function cerrarSesionAsistencia({ sesionId = 'SES-ISW1-G01-ACTUAL', autor = 'Sandra Lucía Guañarita (Docente)' }) {
  const ses = db.prepare('SELECT * FROM sesiones WHERE id = ?').get(sesionId);
  if (!ses) return { ok: false, msg: 'Sesión no encontrada.' };

  const hora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const sinReg = db.prepare(`
    SELECT id, estudiante_codigo FROM registros_asistencia
    WHERE sesion_id = ? AND estado = 'Sin registro'
  `).all(sesionId);

  const updateReg = db.prepare(`
    UPDATE registros_asistencia
    SET estado = 'Ausente', hora_registro = ?, medio_registro = 'Cierre formal M04'
    WHERE id = ?
  `);

  for (const row of sinReg) {
    updateReg.run(hora, row.id);
    sincronizarSesionConHistorial(row.estudiante_codigo, ses.asignatura_id, 'Ausente', 'Cierre formal M04');
  }

  db.prepare(`UPDATE sesiones SET estado = 'CERRADA' WHERE id = ?`).run(sesionId);

  registrarAuditoria({
    autor,
    accion: 'Cierre de sesión de asistencia (M04)',
    valorAnterior: 'ABIERTA',
    valorNuevo: 'CERRADA',
    detalle: `Sesión finalizada. ${sinReg.length} estudiantes fijados como Ausentes.`
  });

  return {
    ok: true,
    ausentesNuevos: sinReg.length,
    msg: `Sesión cerrada exitosamente. Se asignó estado Ausente a ${sinReg.length} estudiantes.`
  };
}

function actualizarRegistroManualOCorreccion({
  sesionId = 'SES-ISW1-G01-ACTUAL',
  nroLista,
  estudianteCodigo,
  nuevoEstado,
  confirmado = false,
  periodoCerrado = false,
  autor = 'Sandra Lucía Guañarita (Docente)'
}) {
  if (periodoCerrado) {
    return {
      ok: false,
      msg: 'Error RF-09/RF-13: La sesión pertenece a un periodo cerrado por Registro Académico. Solicite trámite administrativo.'
    };
  }

  const ses = db.prepare('SELECT * FROM sesiones WHERE id = ?').get(sesionId);
  const reg = nroLista
    ? db.prepare('SELECT * FROM registros_asistencia WHERE sesion_id = ? AND nro_lista = ?').get(sesionId, Number(nroLista))
    : db.prepare('SELECT * FROM registros_asistencia WHERE sesion_id = ? AND estudiante_codigo = ?').get(sesionId, String(estudianteCodigo));

  if (!reg) {
    return { ok: false, msg: 'Estudiante no encontrado en la lista del grupo.' };
  }

  const anterior = reg.estado;
  if (anterior === nuevoEstado) {
    return { ok: true, sinCambio: true, msg: 'El estudiante ya tiene ese estado.' };
  }

  const sesionCerrada = ses.estado !== 'ABIERTA';

  if (sesionCerrada && !confirmado) {
    return {
      ok: false,
      requiereConfirmacion: true,
      estudiante: reg.estudiante_nombre,
      codigo: reg.estudiante_codigo,
      valorAnterior: anterior,
      valorNuevo: nuevoEstado,
      msg: `Confirmación requerida (M08): ¿Cambiar a ${reg.estudiante_nombre} de [${anterior}] a [${nuevoEstado}] en sesión cerrada?`
    };
  }

  const hora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const medio = sesionCerrada ? 'Corrección posterior (M08)' : 'Manual contingencia (M04)';

  db.prepare(`
    UPDATE registros_asistencia
    SET estado = ?, hora_registro = ?, medio_registro = ?
    WHERE id = ?
  `).run(nuevoEstado, hora, medio, reg.id);

  sincronizarSesionConHistorial(reg.estudiante_codigo, ses.asignatura_id, nuevoEstado, medio);

  if (sesionCerrada) {
    registrarAuditoria({
      autor,
      accion: 'Corrección de registro (M08)',
      valorAnterior: anterior,
      valorNuevo: nuevoEstado,
      detalle: `Estudiante ${reg.estudiante_nombre} (${reg.estudiante_codigo}): valor anterior [${anterior}] -> nuevo valor [${nuevoEstado}]. Recálculo de historial ejecutado.`
    });
  } else {
    registrarAuditoria({
      autor,
      accion: 'Registro manual (M04)',
      valorAnterior: anterior,
      valorNuevo: nuevoEstado,
      detalle: `Estudiante ${reg.estudiante_nombre} (${reg.estudiante_codigo}) marcado ${nuevoEstado} con medio Manual contingencia (M04).`
    });
  }

  return {
    ok: true,
    estudiante: reg.estudiante_nombre,
    codigo: reg.estudiante_codigo,
    valorAnterior: anterior,
    valorNuevo: nuevoEstado,
    medio
  };
}

function registrarNovedadSesion({
  sesionId = 'SES-ISW1-G01-ACTUAL',
  nroLista,
  estudianteCodigo,
  tipo,
  minutos,
  nota,
  autor = 'Sandra Lucía Guañarita (Docente)'
}) {

  const m = Number(minutos);
  if (!Number.isInteger(m) || m < 1 || m > 180) {
    return {
      ok: false,
      msg: 'Rechazado (RF-10): Los minutos deben ser un número entero entre 1 y 180 minutos.'
    };
  }

  const reg = nroLista
    ? db.prepare('SELECT * FROM registros_asistencia WHERE sesion_id = ? AND nro_lista = ?').get(sesionId, Number(nroLista))
    : db.prepare('SELECT * FROM registros_asistencia WHERE sesion_id = ? AND estudiante_codigo = ?').get(sesionId, String(estudianteCodigo));

  if (!reg) {
    return { ok: false, msg: 'Estudiante no encontrado en la sesión.' };
  }

  if (reg.estado !== 'Presente') {
    return {
      ok: false,
      msg: `Rechazado (RF-10): No se puede registrar «${tipo}» a ${reg.estudiante_nombre} porque su estado es «${reg.estado}». La novedad aplica únicamente a estudiantes con estado «Presente».`
    };
  }

  const cleanNota = String(nota || '').trim() || 'Sin observación adicional';
  db.prepare(`
    UPDATE registros_asistencia
    SET novedad_tipo = ?, novedad_minutos = ?, novedad_nota = ?
    WHERE id = ?
  `).run(tipo, m, cleanNota, reg.id);

  db.prepare(`
    UPDATE historial_estudiante
    SET novedad = ?
    WHERE estudiante_codigo = ? AND asignatura_id = ? AND es_sesion_actual = 1
  `).run(`${tipo} (${m}m)`, reg.estudiante_codigo, reg.asignatura_id);

  registrarAuditoria({
    autor,
    accion: 'Registro de novedad (M07)',
    valorAnterior: reg.novedad_tipo ? `${reg.novedad_tipo} (${reg.novedad_minutos}m)` : 'Sin novedad',
    valorNuevo: `${tipo} (${m}m)`,
    detalle: `${tipo} para ${reg.estudiante_nombre} (${reg.estudiante_codigo}): ${m} min. Estado Presente conservado.`
  });

  return {
    ok: true,
    msg: `Novedad «${tipo} (${m}m)» guardada exitosamente (M07). El estado «Presente» se conserva.`
  };
}

function getHistorialEstudiante(estudianteCodigo = '2248332') {
  const asigs = db.prepare('SELECT * FROM asignaturas ORDER BY id ASC').all();
  const materiasResumen = [];
  let totalSesionesGlobal = 0;
  let totalFallasNoJustGlobal = 0;

  for (const a of asigs) {
    const sesiones = db.prepare(`
      SELECT fecha, sesion_numero, estado, medio, novedad, es_sesion_actual
      FROM historial_estudiante
      WHERE estudiante_codigo = ? AND asignatura_id = ?
      ORDER BY sesion_numero DESC
    `).all(estudianteCodigo, a.id);

    const tot = sesiones.length || a.total_sesiones;
    const aus = sesiones.filter(s => s.estado === 'Ausente').length;
    const just = sesiones.filter(s => s.estado === 'Ausencia Justificada').length;
    const pres = sesiones.filter(s => s.estado === 'Presente').length;
    const tardanzas = sesiones.filter(s => s.novedad).length;
    const fechasFallas = sesiones.filter(s => s.estado === 'Ausente' || s.estado === 'Ausencia Justificada').map(s => s.fecha);
    const calculo = calcFallas(aus, tot);

    totalSesionesGlobal += tot;
    totalFallasNoJustGlobal += aus;

    materiasResumen.push({
      id: a.id,
      codigoCorto: a.codigo_corto,
      n: a.nombre,
      grupo: a.grupo,
      periodo: a.periodo,
      docente: a.docente_nombre,
      salon: a.salon,
      horario: a.horario,
      tot,
      pres,
      aus,
      just,
      tardanzas,
      fechasFallas,
      pctFallas: calculo.pct,
      asistPct: calculo.asistPct,
      nivel: calculo.nivel,
      maxPermitidas: calculo.maxPermitidas,
      faltasRestantesPermitidas: calculo.faltasRestantesPermitidas,
      faltasParaSuperar20: calculo.faltasParaSuperar20,
      sesiones
    });
  }

  const asistenciaGeneralPct = totalSesionesGlobal > 0
    ? Math.round(((totalSesionesGlobal - totalFallasNoJustGlobal) / totalSesionesGlobal) * 1000) / 10
    : 100;

  return {
    estudianteCodigo,
    asistenciaGeneralPct,
    totalSesionesGlobal,
    totalFallasNoJustGlobal,
    materias: materiasResumen
  };
}

function getExcusas() {
  return db.prepare(`
    SELECT
      id,
      estudiante_codigo AS codigo,
      estudiante_nombre AS estudiante,
      asignatura_id AS asigId,
      asignatura_nombre AS asig,
      fecha_falta AS fecha,
      motivo AS desc,
      archivo_nombre AS archivo,
      archivo_url AS archivoUrl,
      archivo_tamano AS archivoTamano,
      estado,
      fecha_radicacion AS fechaRadicacion,
      evaluado_por AS evaluadoPor
    FROM excusas
    ORDER BY id DESC
  `).all();
}

function radicarExcusa({
  estudianteCodigo = '2248332',
  estudianteNombre = 'Juan Sebastián Marín Restrepo',
  asignaturaNombre,
  asignaturaId,
  fecha,
  desc,
  fileName,
  fileSize,
  base64Data
}) {
  const errores = [];
  if (!asignaturaNombre && !asignaturaId) {
    errores.push('Debe seleccionar la asignatura correspondiente.');
  }
  if (!fecha) {
    errores.push('Indique la fecha en la que se presentó la inasistencia.');
  } else {

    const hoyIso = '2026-11-18';
    if (String(fecha) > hoyIso) {
      errores.push('La fecha de la ausencia no puede ser una fecha futura.');
    }
  }

  if (!desc || String(desc).trim().length < 5) {
    errores.push('Escriba una justificación detallada (mínimo 5 caracteres).');
  }

  const valFile = storage.validateSupportFile({ fileName, fileSize });
  if (!valFile.valid) {
    errores.push(...valFile.errors);
  }

  if (errores.length > 0) {
    return { ok: false, errors: errores, msg: errores.join(' ') };
  }

  const asigRow = asignaturaId
    ? db.prepare('SELECT * FROM asignaturas WHERE id = ?').get(asignaturaId)
    : db.prepare('SELECT * FROM asignaturas WHERE LOWER(nombre) = LOWER(?)').get(String(asignaturaNombre).trim());

  const resolvedAsigId = asigRow ? asigRow.id : 'isw1';
  const resolvedAsigNombre = asigRow ? asigRow.nombre : (asignaturaNombre || 'Ingeniería de Software I');

  const fallaRow = db.prepare(`
    SELECT id, estado FROM historial_estudiante
    WHERE estudiante_codigo = ? AND asignatura_id = ? AND fecha = ? AND estado IN ('Ausente', 'Ausencia Justificada')
  `).get(estudianteCodigo, resolvedAsigId, fecha);

  if (!fallaRow) {
    const errMsg = `No existe una inasistencia registrada en la fecha ${fecha} para ${resolvedAsigNombre}. La excusa debe corresponder a una falla registrada.`;
    return { ok: false, errors: [errMsg], msg: errMsg };
  }

  const saved = storage.saveSupportFile({
    fileName,
    fileSize,
    base64Data,
    studentCode: estudianteCodigo
  });

  if (!saved.ok) {
    return { ok: false, errors: saved.errors, msg: saved.errors.join(' ') };
  }

  const fechaRad = new Date().toLocaleString('es-CO');
  const info = db.prepare(`
    INSERT INTO excusas (
      estudiante_codigo, estudiante_nombre, asignatura_id, asignatura_nombre,
      fecha_falta, motivo, archivo_nombre, archivo_url, archivo_tamano, archivo_mime,
      estado, fecha_radicacion, evaluado_por
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?, NULL)
  `).run(
    estudianteCodigo,
    estudianteNombre,
    resolvedAsigId,
    resolvedAsigNombre,
    fecha,
    String(desc).trim(),
    saved.originalName,
    saved.publicUrl,
    saved.size,
    saved.mime,
    fechaRad
  );

  registrarAuditoria({
    autor: `${estudianteNombre} (Estudiante)`,
    accion: 'Radicación de excusa (M06)',
    valorAnterior: 'Sin excusa',
    valorNuevo: 'Pendiente',
    detalle: `Excusa para ${resolvedAsigNombre} (${fecha}) radicada con soporte ${saved.originalName} en GCS (${saved.bucket}).`
  });

  return {
    ok: true,
    id: info.lastInsertRowid,
    msg: 'Excusa radicada exitosamente con estado PENDIENTE (M06).'
  };
}

function evaluarExcusa({ id, nuevoEstado, autor = 'Sandra Lucía Guañarita (Docente)' }) {
  const exc = db.prepare('SELECT * FROM excusas WHERE id = ?').get(Number(id));
  if (!exc) {
    return { ok: false, msg: 'Excusa no encontrada.' };
  }

  const estadoAnterior = exc.estado;
  db.prepare(`
    UPDATE excusas
    SET estado = ?, evaluado_por = ?
    WHERE id = ?
  `).run(nuevoEstado, autor, exc.id);

  const nuevoEstadoSesion = nuevoEstado === 'Aceptada' ? 'Ausencia Justificada' : 'Ausente';
  const nuevoMedio = nuevoEstado === 'Aceptada' ? 'Excusa aprobada M06' : 'Cierre formal M04';

  const updated = db.prepare(`
    UPDATE historial_estudiante
    SET estado = ?, medio = ?
    WHERE estudiante_codigo = ? AND asignatura_id = ? AND fecha = ?
  `).run(nuevoEstadoSesion, nuevoMedio, exc.estudiante_codigo, exc.asignatura_id, exc.fecha_falta);

  if (updated.changes === 0) {
    if (nuevoEstado === 'Aceptada') {
      const targetRow = db.prepare(`
        SELECT id FROM historial_estudiante
        WHERE estudiante_codigo = ? AND asignatura_id = ? AND estado = 'Ausente'
        ORDER BY sesion_numero DESC LIMIT 1
      `).get(exc.estudiante_codigo, exc.asignatura_id);
      if (targetRow) {
        db.prepare(`UPDATE historial_estudiante SET estado = 'Ausencia Justificada', medio = 'Excusa aprobada M06' WHERE id = ?`).run(targetRow.id);
      }
    } else if (estadoAnterior === 'Aceptada' && nuevoEstado !== 'Aceptada') {
      const targetRow = db.prepare(`
        SELECT id FROM historial_estudiante
        WHERE estudiante_codigo = ? AND asignatura_id = ? AND estado = 'Ausencia Justificada'
        ORDER BY sesion_numero DESC LIMIT 1
      `).get(exc.estudiante_codigo, exc.asignatura_id);
      if (targetRow) {
        db.prepare(`UPDATE historial_estudiante SET estado = 'Ausente', medio = 'Cierre formal M04' WHERE id = ?`).run(targetRow.id);
      }
    }
  }

  registrarAuditoria({
    autor,
    accion: 'Evaluación de excusa (M06)',
    valorAnterior: estadoAnterior,
    valorNuevo: nuevoEstado,
    detalle: `Excusa #${exc.id} de ${exc.estudiante_nombre} (${exc.estudiante_codigo}) en ${exc.asignatura_nombre} (${exc.fecha_falta}) dictaminada como [${nuevoEstado}]. Historial individual recalculado.`
  });

  const histActualizado = getHistorialEstudiante(exc.estudiante_codigo);
  return {
    ok: true,
    excusaId: exc.id,
    estudianteCodigo: exc.estudiante_codigo,
    estudianteNombre: exc.estudiante_nombre,
    estadoAnterior,
    nuevoEstado,
    historialEstudiante: histActualizado
  };
}

function getReporteConsolidado({ periodo = '2026-1', facultad = 'todas', asignatura = 'isw1', grupo = 'G01' }) {
  const normPer = String(periodo || '2026-1').replace(/\s*\(Actual\)/i, '').trim();
  const normAsig = String(asignatura || 'isw1').toLowerCase();
  const normGrp = String(grupo || 'G01').toLowerCase();

  if (normPer === '2025-3' || normGrp === 'g02') {
    return {
      ok: true,
      sinDatos: true,
      periodo: normPer,
      asignatura: normAsig,
      grupoLabel: normGrp === 'todos' ? 'Todos los grupos' : normGrp.toUpperCase(),
      filas: [],
      kpis: {
        estudiantesActivos: 0,
        ausentismoGeneral: 0,
        estudiantesEnRiesgo: 0,
        excusasPendientes: 0
      },
      msg: `No existen registros de asistencia para los filtros seleccionados (Periodo: ${normPer}, Asignatura: ${normAsig.toUpperCase()}, Grupo: ${normGrp.toUpperCase()}).`
    };
  }

  const asigs = db.prepare('SELECT * FROM asignaturas').all().filter(a => {
    if (normAsig !== 'todas' && a.id.toLowerCase() !== normAsig && a.nombre.toLowerCase() !== normAsig) {
      return false;
    }
    if (facultad && facultad !== 'todas' && facultad !== 'Todas las facultades' && a.facultad.toLowerCase() !== facultad.toLowerCase()) {
      return false;
    }
    return true;
  });

  const filas = [];
  let nro = 1;

  for (const a of asigs) {

    const grupoReal = a.grupo || 'G01';
    if (a.id === 'isw1') {
      const roster = getRoster('SES-ISW1-G01-ACTUAL');
      for (const r of roster) {
        const hist = db.prepare(`
          SELECT estado FROM historial_estudiante
          WHERE estudiante_codigo = ? AND asignatura_id = ?
        `).all(r.codigo, a.id);
        const tot = hist.length || 18;
        const aus = hist.filter(h => h.estado === 'Ausente').length;
        const f = calcFallas(aus, tot);
        filas.push({
          n: nro++,
          nombre: r.nombre,
          codigo: r.codigo,
          asignatura: a.nombre,
          asignaturaId: a.id,
          grupo: grupoReal,
          periodo: normPer,
          estado: r.estado,
          medio: r.medio || 'N/A',
          novedad: r.novedad ? `${r.novedad.tipo} (${r.novedad.min} min)` : 'Ninguna',
          hora: r.hora || '',
          fallasAcumuladas: aus,
          totalSesiones: tot,
          pctAusentismo: f.pct,
          nivelRiesgo: f.nivel
        });
      }
    } else {

      const estRows = db.prepare(`
        SELECT DISTINCT h.estudiante_codigo AS codigo, u.nombre
        FROM historial_estudiante h
        JOIN usuarios u ON u.codigo = h.estudiante_codigo
        WHERE h.asignatura_id = ?
        ORDER BY u.codigo ASC
      `).all(a.id);

      for (const est of estRows) {
        const hist = db.prepare(`
          SELECT estado, medio, novedad, fecha FROM historial_estudiante
          WHERE estudiante_codigo = ? AND asignatura_id = ?
          ORDER BY sesion_numero DESC
        `).all(est.codigo, a.id);
        const ult = hist[0] || { estado: 'Presente', medio: 'QR / PIN', novedad: null };
        const tot = hist.length || a.total_sesiones;
        const aus = hist.filter(h => h.estado === 'Ausente').length;
        const f = calcFallas(aus, tot);
        filas.push({
          n: nro++,
          nombre: est.nombre,
          codigo: est.codigo,
          asignatura: a.nombre,
          asignaturaId: a.id,
          grupo: grupoReal,
          periodo: normPer,
          estado: ult.estado,
          medio: ult.medio,
          novedad: ult.novedad || 'Ninguna',
          hora: '10:05 a.m.',
          fallasAcumuladas: aus,
          totalSesiones: tot,
          pctAusentismo: f.pct,
          nivelRiesgo: f.nivel
        });
      }
    }
  }

  const enRiesgo = filas.filter(f => f.pctAusentismo >= 15).length;
  const promedioFallas = filas.length
    ? Math.round((filas.reduce((acc, x) => acc + x.pctAusentismo, 0) / filas.length) * 10) / 10
    : 0;
  const excPendientes = db.prepare(`SELECT COUNT(*) AS c FROM excusas WHERE estado = 'Pendiente'`).get().c;

  return {
    ok: true,
    sinDatos: filas.length === 0,
    periodo: normPer,
    asignatura: normAsig,
    grupoLabel: normGrp === 'todos' ? 'Todos los grupos' : normGrp.toUpperCase(),
    filas,
    kpis: {
      estudiantesActivos: normAsig === 'todas' ? 3606 : filas.length,
      ausentismoGeneral: normAsig === 'todas' ? 8.9 : promedioFallas,
      estudiantesEnRiesgo: normAsig === 'todas' ? 184 : enRiesgo,
      excusasPendientes: normAsig === 'todas' ? 47 : excPendientes
    }
  };
}

function listarUsuarios(rol = null) {
  if (rol) {
    return db.prepare(`
      SELECT id, username, correo, nombre, codigo, rol, programa, iniciales
      FROM usuarios
      WHERE rol = ?
      ORDER BY id ASC
    `).all(rol);
  }
  return db.prepare(`
    SELECT id, username, correo, nombre, codigo, rol, programa, iniciales
    FROM usuarios
    ORDER BY id ASC
  `).all();
}

function crearUsuarioYMatricular({
  nombre,
  codigo,
  username,
  password = 'Uao2026*',
  rol = 'estudiante',
  programa = 'Ingeniería de Software',
  autor = 'Sistema UAO Attendance'
}) {
  const cleanNombre = String(nombre || '').trim();
  const cleanCodigo = String(codigo || '').trim();
  const cleanUser = String(username || '').trim().toLowerCase().replace(/@uao\.edu\.co$/, '');

  if (!cleanNombre || !cleanCodigo || !cleanUser) {
    return { ok: false, msg: 'Nombre, código y usuario institucional son obligatorios.' };
  }

  const existe = db.prepare(`
    SELECT id FROM usuarios WHERE LOWER(username) = ? OR codigo = ?
  `).get(cleanUser, cleanCodigo);
  if (existe) {
    return { ok: false, msg: `Ya existe un usuario con código ${cleanCodigo} o usuario ${cleanUser}.` };
  }

  const correo = `${cleanUser}@uao.edu.co`;
  const iniciales = obtenerIniciales(cleanNombre);

  db.exec('BEGIN TRANSACTION');
  try {
    db.prepare(`
      INSERT INTO usuarios (username, correo, password, nombre, codigo, rol, programa, iniciales)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(cleanUser, correo, String(password || 'Uao2026*'), cleanNombre, cleanCodigo, rol, programa, iniciales);

    if (rol === 'estudiante') {
      const insertMat = db.prepare(`
        INSERT OR IGNORE INTO matriculas (estudiante_codigo, asignatura_id, grupo, periodo)
        VALUES (?, ?, 'G01', '2026-1')
      `);
      ['isw1', 'bd2', 'md'].forEach(aId => insertMat.run(cleanCodigo, aId));

      const maxRow = db.prepare(`SELECT COALESCE(MAX(nro_lista), 0) AS maxN FROM registros_asistencia WHERE sesion_id = 'SES-ISW1-G01-ACTUAL'`).get();
      const nextN = (maxRow ? maxRow.maxN : 30) + 1;
      const ses = db.prepare(`SELECT estado FROM sesiones WHERE id = 'SES-ISW1-G01-ACTUAL'`).get();
      const estadoInicial = ses && ses.estado === 'ABIERTA' ? 'Sin registro' : 'Ausente';

      db.prepare(`
        INSERT INTO registros_asistencia (
          sesion_id, asignatura_id, grupo, periodo, estudiante_codigo, estudiante_nombre, nro_lista,
          fecha, estado, hora_registro, medio_registro
        ) VALUES ('SES-ISW1-G01-ACTUAL', 'isw1', 'G01', '2026-1', ?, ?, ?, '2026-11-02', ?, NULL, NULL)
      `).run(cleanCodigo, cleanNombre, nextN, estadoInicial);

      const insertHist = db.prepare(`
        INSERT OR IGNORE INTO historial_estudiante (
          estudiante_codigo, asignatura_id, grupo, periodo, fecha, sesion_numero, estado, medio, novedad, es_sesion_actual
        ) VALUES (?, ?, 'G01', '2026-1', ?, ?, ?, ?, NULL, ?)
      `);
      const baseDates = [
        '2026-08-04', '2026-08-06', '2026-08-11', '2026-08-13', '2026-08-18',
        '2026-08-20', '2026-08-25', '2026-08-27', '2026-09-01', '2026-09-03',
        '2026-09-08', '2026-09-10', '2026-09-15', '2026-09-17', '2026-09-22',
        '2026-09-24', '2026-09-29', '2026-10-01', '2026-10-06'
      ];
      const asigs = [{ id: 'isw1', tot: 18 }, { id: 'bd2', tot: 19 }, { id: 'md', tot: 19 }];
      for (const a of asigs) {
        for (let s = 1; s <= a.tot; s++) {
          const fecha = s === 1 ? '2026-10-25' : (baseDates[s - 1] || `2026-08-${String(s).padStart(2, '0')}`);
          const st = s === 1 ? 'Ausente' : 'Presente';
          const med = s === 1 ? 'Cierre formal M04' : 'QR / PIN';
          insertHist.run(cleanCodigo, a.id, fecha, s, st, med, s === a.tot ? 1 : 0);
        }
      }
    }

    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    return { ok: false, msg: 'Error al registrar usuario en base de datos: ' + err.message };
  }

  registrarAuditoria({
    autor,
    accion: 'Registro de usuario en BD (M01/M12)',
    valorAnterior: 'No registrado',
    valorNuevo: `${cleanNombre} (${rol})`,
    detalle: `Usuario ${correo} (${cleanCodigo}) persistido en SQLite y matriculado en periodo 2026-1.`
  });

  return {
    ok: true,
    user: { username: cleanUser, correo, nombre: cleanNombre, codigo: cleanCodigo, rol, programa, iniciales }
  };
}

function getEstudiantesEnRiesgo() {
  const rows = db.prepare(`
    SELECT
      u.codigo,
      u.nombre,
      u.programa,
      u.iniciales,
      a.nombre AS asignatura,
      COUNT(h.id) AS total_sesiones,
      SUM(CASE WHEN h.estado = 'Ausente' THEN 1 ELSE 0 END) AS fallas
    FROM historial_estudiante h
    JOIN usuarios u ON u.codigo = h.estudiante_codigo
    JOIN asignaturas a ON a.id = h.asignatura_id
    GROUP BY u.codigo, a.id
    HAVING (CAST(fallas AS REAL) / total_sesiones) * 100 >= 15.0
    ORDER BY (CAST(fallas AS REAL) / total_sesiones) DESC, u.nombre ASC
  `).all();

  return rows.map(r => {
    const f = calcFallas(r.fallas, r.total_sesiones);
    return {
      codigo: r.codigo,
      nombre: r.nombre,
      programa: r.programa,
      iniciales: r.iniciales,
      asignatura: r.asignatura,
      fallas: r.fallas,
      tot: r.total_sesiones,
      pct: f.pct,
      nivel: f.nivel === 'rojo' ? 'Crítico' : f.pct >= 17 ? 'Alto' : 'Preventivo',
      clase: f.nivel === 'rojo' ? 'b-bad' : 'b-warn'
    };
  });
}

module.exports = {
  db,
  calcFallas,
  initSchemaAndSeed,
  registrarAuditoria,
  getBitacora,
  getSesionActual,
  toggleRedDocente,
  getRoster,
  marcarAsistenciaEstudiante,
  cerrarSesionAsistencia,
  actualizarRegistroManualOCorreccion,
  registrarNovedadSesion,
  getHistorialEstudiante,
  getExcusas,
  radicarExcusa,
  evaluarExcusa,
  getReporteConsolidado,
  listarUsuarios,
  crearUsuarioYMatricular,
  getEstudiantesEnRiesgo
};
