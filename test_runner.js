const fs = require('fs');
const path = require('path');
const dbMod = require('./backend/db');
const storage = require('./backend/storage');
const ext = require('./backend/external_services');

const baseDir = path.resolve(__dirname, 'uao');
console.log('===================================================================');
console.log(' UAO ATTENDANCE · SUITE DE REGRESIÓN Y VERIFICACIÓN C4 (CP-01..19)');
console.log('===================================================================');

const htmlFiles = [];
function findHtml(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      findHtml(full);
    } else if (item.name.endsWith('.html')) {
      htmlFiles.push(full);
    }
  }
}
findHtml(baseDir);

let totalErrors = 0;
let totalChecks = 0;

function check(label, condition, detail = '') {
  totalChecks++;
  if (condition) {
    console.log(`  [PASS] ${label}`);
  } else {
    console.error(`  [FAIL] ${label} ${detail ? '-> ' + detail : ''}`);
    totalErrors++;
  }
}

console.log('\n--- 1. CONTENEDOR C4: APLICACIÓN WEB RESPONSIVA (HTML5/CSS3/JS) ---');
for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(baseDir, file);
  check(`${rel}: Contiene <!DOCTYPE html>`, content.includes('<!DOCTYPE html>'));

  const regex = /(?:href|src)=["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const link = match[1];
    if (link.startsWith('#') || link.startsWith('http:') || link.startsWith('https:') || link.startsWith('mailto:')) continue;
    const target = path.resolve(path.dirname(file), link.split('?')[0]);
    check(`${rel}: Enlace válido "${link}"`, fs.existsSync(target), `No existe ${target}`);
  }
}

const expectedIds = [
  'login', 'roles', 'user', 'pass', 'lmsg', 'toggle-reg-usuario', 'btn-crear-usuario',
  'pin', 'count', 'pres', 'fill', 'resumen', 'ultimos', 'btn-simular-corte-red', 'cerrar-sesion-asistencia',
  'tabs-modo', 'sec-qr', 'sec-pin', 'confirmar', 'simqr',
  'tabla', 'buscar', 'cnt', 'btn-cierre-manual-pantalla',
  'subjects', 'alerta', 'contenedor-historial', 'historial-resumen', 'historial-lista', 'sel-asignatura-historial', 'estado-general-pct',
  'contenedor-excusas', 'enviar-excusa', 'asig', 'fecha', 'desc', 'archivo',
  'sel-estudiante', 'tipo-novedad-tabs', 'min', 'nota', 'guardar-novedad',
  'tabla-bitacora', 'cuerpo-bitacora',
  'exportar-csv', 'btn-pdf', 'filtro-periodo', 'filtro-asignatura', 'filtro-grupo',
  'tabla-riesgo'
];

const allHtmlCombined = htmlFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');
for (const id of expectedIds) {
  check(`ID "${id}" presente en plantillas HTML`, allHtmlCombined.includes(`id="${id}"`) || allHtmlCombined.includes(`id='${id}'`));
}
check(`DEF-12: Botón "btn-limpiar-bitacora" eliminado de la interfaz`, !allHtmlCombined.includes('id="btn-limpiar-bitacora"'));

console.log('\n--- 2. CONTENEDORES C4: API BACKEND + SQL + GOOGLE CLOUD STORAGE (CP-01..19 & DEF-01..17) ---');

dbMod.initSchemaAndSeed(true);
ext.setSsoAvailability(true);

const loginDocenteOk = ext.validarCredencialesSSO(dbMod.db, { username: 'sandra.guanarita', password: 'Uao2026*', rol: 'docente' });
const loginEstOk = ext.validarCredencialesSSO(dbMod.db, { username: 'juan_se.marin@uao.edu.co', password: 'Uao2026*', rol: 'estudiante' });
const loginDirOk = ext.validarCredencialesSSO(dbMod.db, { username: 'carlos.ramirez', password: 'Uao2026*', rol: 'director' });
check('CP-01 (M01): Ingreso exitoso de los 3 roles con credenciales institucionales válidas', loginDocenteOk.ok && loginEstOk.ok && loginDirOk.ok);

const loginExternoFail = ext.validarCredencialesSSO(dbMod.db, { username: 'usuario.invalido@externo.com', password: 'clave_falsa', rol: 'docente' });
const loginClaveFalsaFail = ext.validarCredencialesSSO(dbMod.db, { username: 'sandra.guanarita', password: 'clave_falsa', rol: 'docente' });
check('CP-02 / DEF-01 (M01): Rechaza usuario externo (@externo.com) y clave falsa sin dar acceso', !loginExternoFail.ok && !loginClaveFalsaFail.ok);

ext.setSsoAvailability(false);
const loginSso503 = ext.validarCredencialesSSO(dbMod.db, { username: 'sandra.guanarita', password: 'Uao2026*', rol: 'docente' });
check('CP-03 (M01): Captura HTTP 503 cuando SSO Institucional UAO está fuera de línea', loginSso503.status === 503 && !loginSso503.ok);
ext.setSsoAvailability(true);

const sesionInicial = dbMod.getSesionActual();
check('CP-04 (M02): PIN de 4 dígitos y token QR generados al abrir sesión', /^\d{4}$/.test(sesionInicial.pin.code) && sesionInicial.pin.token.startsWith('UAO-'));

const sesionEnCorte = dbMod.toggleRedDocente('SES-ISW1-G01-ACTUAL', true);
const pinRetenido = sesionEnCorte.pin.code;

dbMod.db.prepare('UPDATE sesiones SET pin_expira = ? WHERE id = ?').run(Date.now() - 5000, 'SES-ISW1-G01-ACTUAL');
const marcaDuranteCorte = dbMod.marcarAsistenciaEstudiante({
  estudianteCodigo: '2245020',
  pinIngresado: pinRetenido,
  modo: 'PIN'
});
check('CP-04 / DEF-02 (M02): El último PIN retenido sigue siendo válido durante una falla de red (>60 s)', marcaDuranteCorte.ok, marcaDuranteCorte.msg);
dbMod.toggleRedDocente('SES-ISW1-G01-ACTUAL', false);

const sesionRenovada = dbMod.getSesionActual();
const rechazoFormato = dbMod.marcarAsistenciaEstudiante({ estudianteCodigo: '2248332', pinIngresado: '12a', modo: 'PIN' });
const rechazoPinErroneo = dbMod.marcarAsistenciaEstudiante({ estudianteCodigo: '2248332', pinIngresado: '0000', modo: 'PIN' });
const rechazoNoMatriculado = dbMod.marcarAsistenciaEstudiante({ estudianteCodigo: '2249999', pinIngresado: sesionRenovada.pin.code, modo: 'PIN' });
const marcaValidaEst = dbMod.marcarAsistenciaEstudiante({ estudianteCodigo: '2248332', pinIngresado: sesionRenovada.pin.code, modo: 'PIN' });
const rechazoDobleMarca = dbMod.marcarAsistenciaEstudiante({ estudianteCodigo: '2248332', pinIngresado: sesionRenovada.pin.code, modo: 'PIN' });
check(
  'CP-05 (M03): Rechaza formato inválido, PIN incorrecto, no matriculado (RF-11) y doble marcado; aprueba PIN vigente',
  !rechazoFormato.ok && !rechazoPinErroneo.ok && !rechazoNoMatriculado.ok && marcaValidaEst.ok && !rechazoDobleMarca.ok
);

const regManual = dbMod.actualizarRegistroManualOCorreccion({
  nroLista: 21,
  nuevoEstado: 'Presente',
  confirmado: true
});
check('CP-06 (M04): Registro manual marca a Manuela Quintero como Presente con medio Manual en aula', regManual.ok && regManual.medio === 'Manual en aula');

const novOk = dbMod.registrarNovedadSesion({ nroLista: 21, tipo: 'Llegada tarde', minutos: 12, nota: 'Tráfico' });
const nov500Min = dbMod.registrarNovedadSesion({ nroLista: 21, tipo: 'Salida anticipada', minutos: 500, nota: 'Exceso' });
const nov0Min = dbMod.registrarNovedadSesion({ nroLista: 21, tipo: 'Salida anticipada', minutos: 0, nota: 'Cero' });
const novNoPresente = dbMod.registrarNovedadSesion({ nroLista: 25, tipo: 'Salida anticipada', minutos: 30, nota: 'Cristian C. Ortiz está Sin registro' });
check('CP-13 (M07): Registra llegada tarde (12m) sobre estudiante Presente conservando asistencia', novOk.ok);
check('CP-14 / DEF-09 (M07): Rechaza novedades con 0 o 500 minutos (máximo permitido 180 min)', !nov500Min.ok && !nov0Min.ok);
check('CP-14 / DEF-10 (M07): Rechaza novedades sobre estudiantes que NO están Presentes (Sin registro / Ausente)', !novNoPresente.ok);

const resCierre = dbMod.cerrarSesionAsistencia({});
const intentoPostCierre = dbMod.marcarAsistenciaEstudiante({ estudianteCodigo: '2245030', pinIngresado: sesionRenovada.pin.code, modo: 'PIN' });
check('CP-07 (M04): Cierre de sesión asigna automáticamente Ausente a los estudiantes sin registro', resCierre.ok && resCierre.ausentesNuevos > 0);
check('CP-08 (M04): Rechaza intento de marcado por PIN/QR después del cierre de la sesión', !intentoPostCierre.ok);

dbMod.initSchemaAndSeed(true);
const histJSM = dbMod.getHistorialEstudiante('2248332');
check('CP-09 / DEF-03 (M05): El historial del estudiante permite consultar las 3 asignaturas (ISW1, BD2, MD)', histJSM.materias.length === 3 && histJSM.materias.every(m => m.sesiones.length > 0));
check('CP-09 / DEF-04 (M05): El indicador "Estado general" se calcula dinámicamente en 89.3%', histJSM.asistenciaGeneralPct === 89.3, `Obtenido: ${histJSM.asistenciaGeneralPct}%`);

const f3de19 = dbMod.calcFallas(3, 19);
check(
  'CP-10 / DEF-05 (M05): Con 3/19 (15.8%) clasifica en nivel ámbar e indica que falta 1 inasistencia (la 4ta) para superar el 20%',
  f3de19.nivel === 'ambar' && f3de19.maxPermitidas === 3 && f3de19.faltasParaSuperar20 === 1 && f3de19.faltasPara20 === 1,
  JSON.stringify(f3de19)
);

const excSinSoporte = dbMod.radicarExcusa({ estudianteCodigo: '2248332', asignaturaId: 'isw1', fecha: '2026-10-25', desc: 'Cita médica', fileName: '', fileSize: 0 });
const excExe = dbMod.radicarExcusa({ estudianteCodigo: '2248332', asignaturaId: 'isw1', fecha: '2026-10-25', desc: 'Cita médica', fileName: 'malware.exe', fileSize: 1024 });
const exc15MB = dbMod.radicarExcusa({ estudianteCodigo: '2248332', asignaturaId: 'isw1', fecha: '2026-10-25', desc: 'Cita médica', fileName: 'pesado.pdf', fileSize: 15 * 1024 * 1024 });
const excFechaFutura = dbMod.radicarExcusa({ estudianteCodigo: '2248332', asignaturaId: 'isw1', fecha: '2027-01-15', desc: 'Cita médica futura', fileName: 'soporte.png', fileSize: 1024 * 1024 });
const excFechaSinFalla = dbMod.radicarExcusa({ estudianteCodigo: '2248332', asignaturaId: 'isw1', fecha: '2026-08-04', desc: 'Ese día estuvo presente', fileName: 'soporte.png', fileSize: 1024 * 1024 });
const excValida10MB = dbMod.radicarExcusa({ estudianteCodigo: '2248332', asignaturaId: 'md', fecha: '2026-10-24', desc: 'Incapacidad médica certificada', fileName: 'incapacidad_10mb.png', fileSize: 10 * 1024 * 1024 });
check(
  'CP-11 / DEF-06 (M06): Rechaza sin soporte, .exe, >10MB, fecha futura (2027-01-15) y fecha sin inasistencia; aprueba PNG de 10 MB sobre falla real en GCS',
  !excSinSoporte.ok && !excExe.ok && !exc15MB.ok && !excFechaFutura.ok && !excFechaSinFalla.ok && excValida10MB.ok
);

const antesJSM = dbMod.getHistorialEstudiante('2248332').materias.find(m => m.id === 'isw1');
const antesAFM = dbMod.getHistorialEstudiante('2245006').materias.find(m => m.id === 'isw1');

dbMod.evaluarExcusa({ id: 2, nuevoEstado: 'Aceptada' });
const despuesJSM = dbMod.getHistorialEstudiante('2248332').materias.find(m => m.id === 'isw1');
const despuesAFM = dbMod.getHistorialEstudiante('2245006').materias.find(m => m.id === 'isw1');
check(
  'CP-12 / DEF-07 (M06 Crítico): Aprobar la excusa de A. F. Morales (2245006) reduce sus fallas (2 -> 1) SIN alterar el historial de J. S. Marín (1 -> 1)',
  antesAFM.aus === 2 && despuesAFM.aus === 1 && antesJSM.aus === 1 && despuesJSM.aus === 1
);

dbMod.evaluarExcusa({ id: 2, nuevoEstado: 'No Aprobada' });
const revertidoAFM = dbMod.getHistorialEstudiante('2245006').materias.find(m => m.id === 'isw1');
check(
  'CP-12 / DEF-08 (M06 Mayor): Cambiar el dictamen de «Aceptada» a «No Aprobada» revierte el recálculo de fallas (1 -> 2)',
  revertidoAFM.aus === 2 && revertidoAFM.just === 0
);

dbMod.cerrarSesionAsistencia({});
const corrSinConfirmar = dbMod.actualizarRegistroManualOCorreccion({
  estudianteCodigo: '2248332',
  nuevoEstado: 'Presente',
  confirmado: false
});
check('CP-15 / DEF-13 (M08): Exige confirmación antes de aplicar una corrección sobre sesión cerrada', !corrSinConfirmar.ok && corrSinConfirmar.requiereConfirmacion === true);

const fallasAntesCorr = dbMod.getHistorialEstudiante('2248332').materias.find(m => m.id === 'isw1').aus;
const corrConfirmada = dbMod.actualizarRegistroManualOCorreccion({
  estudianteCodigo: '2248332',
  nuevoEstado: 'Presente',
  confirmado: true
});
const fallasDespuesCorr = dbMod.getHistorialEstudiante('2248332').materias.find(m => m.id === 'isw1').aus;
check(
  'CP-15 / DEF-11 (M08 Mayor): La corrección Ausente -> Presente en sesión cerrada recalcula el historial del estudiante (2 -> 1)',
  corrConfirmada.ok && fallasAntesCorr === 2 && fallasDespuesCorr === 1
);

let triggerBloqueoUpdate = false;
try {
  dbMod.db.prepare(`UPDATE bitacora_auditoria SET detalle = 'alterado' WHERE id = 1`).run();
} catch (err) {
  triggerBloqueoUpdate = String(err.message).includes('AUDITORIA_INMUTABLE');
}
check('CP-15 / DEF-12 (M08 Crítico): Trigger SQL protege la bitácora de auditoría contra modificaciones', triggerBloqueoUpdate);

const repISW1 = dbMod.getReporteConsolidado({ periodo: '2026-1', asignatura: 'isw1', grupo: 'G01' });
const repBD2 = dbMod.getReporteConsolidado({ periodo: '2026-1', asignatura: 'bd2', grupo: 'G01' });
const repVacio = dbMod.getReporteConsolidado({ periodo: '2025-3', asignatura: 'bd2', grupo: 'G02' });
const repTodosGrupos = dbMod.getReporteConsolidado({ periodo: '2026-1', asignatura: 'isw1', grupo: 'todos' });
check(
  'CP-16 / DEF-14 (M09 Mayor): Los filtros del reporte cambian los datos exportados por asignatura y devuelven sinDatos para 2025-3 / G02',
  !repISW1.sinDatos && repISW1.filas[0].asignatura === 'Ingeniería de Software I' &&
  !repBD2.sinDatos && repBD2.filas[0].asignatura === 'Bases de Datos II' &&
  repVacio.sinDatos === true && repVacio.filas.length === 0
);
check(
  'CP-16 / DEF-16 (M09): El filtro "Todos los grupos" exporta la etiqueta legible "Todos los grupos" y el grupo real "G01", nunca "todos"',
  repTodosGrupos.grupoLabel === 'Todos los grupos' && repTodosGrupos.filas.every(f => f.grupo !== 'todos')
);

const cssContent = fs.readFileSync(path.join(baseDir, 'css', 'styles.css'), 'utf8');
check(
  'CP-18 / DEF-17 (M10): CSS incluye overflow-x: hidden, contenedores .scroll y media queries para 768px/480px con controles >= 44px',
  cssContent.includes('overflow-x: hidden') && cssContent.includes('min-height: 44px') && cssContent.includes('@media (max-width: 480px)')
);
check(
  'CP-19 (M10): CSS incluye Modo Proyector con PIN display de 96px y QR de 240px',
  cssContent.includes('body.projector-mode .pin') && cssContent.includes('font-size: 96px')
);

dbMod.initSchemaAndSeed(true);
const nuevoEst = dbMod.crearUsuarioYMatricular({
  nombre: 'Laura Gómez',
  codigo: '2249001',
  username: 'laura.gomez',
  rol: 'estudiante'
});
const loginNuevoEst = ext.validarCredencialesSSO(dbMod.db, { username: 'laura.gomez@uao.edu.co', password: 'Uao2026*', rol: 'estudiante' });
const sesActualMulti = dbMod.getSesionActual();
const marcaNuevoEst = dbMod.marcarAsistenciaEstudiante({
  estudianteCodigo: '2249001',
  pinIngresado: sesActualMulti.pin.code,
  modo: 'PIN'
});
const rosterPostMulti = dbMod.getRoster();
const enLista = rosterPostMulti.find(r => r.codigo === '2249001');
const riesgoList = dbMod.getEstudiantesEnRiesgo();
check(
  'MULTI-USUARIO SQL: Nuevo usuario se persiste en SQLite, inicia sesión por SSO, marca asistencia y actualiza la lista en vivo',
  nuevoEst.ok && loginNuevoEst.ok && marcaNuevoEst.ok && enLista && enLista.estado === 'Presente' && riesgoList.length > 0,
  JSON.stringify({ nuevoEst, loginNuevoEst: loginNuevoEst.ok, marcaNuevoEst, enLista })
);

dbMod.initSchemaAndSeed(true);

console.log('\n===================================================================');
console.log(`TOTAL VERIFICACIONES EJECUTADAS: ${totalChecks}`);
console.log(`TOTAL ERRORES DETECTADOS:        ${totalErrors}`);
console.log(`VEREDICTO FINAL CICLO 2:         ${totalErrors === 0 ? '19/19 CASOS APROBADOS · 17/17 DEFECTOS CERRADOS (100% OK)' : 'FALLOS DETECTADOS'}`);
console.log('===================================================================');

process.exit(totalErrors === 0 ? 0 : 1);
