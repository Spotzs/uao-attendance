const path = require('path');
const express = require('express');
const dbMod = require('./db');
const storage = require('./storage');
const ext = require('./external_services');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  next();
});

const FRONTEND_DIR = path.resolve(__dirname, '..', 'uao');
app.use(express.static(FRONTEND_DIR));

app.post('/api/auth/login', (req, res) => {
  const { username, password, rol } = req.body || {};
  const result = ext.validarCredencialesSSO(dbMod.db, { username, password, rol });
  if (!result.ok) {
    return res.status(result.status || 401).json(result);
  }
  dbMod.registrarAuditoria({
    autor: `${result.user.nombre} (${result.user.rol})`,
    accion: 'Autenticación SSO',
    valorAnterior: 'Anónimo',
    valorNuevo: 'Autenticado',
    detalle: `Ingreso exitoso al portal de ${result.user.rol} mediante SSO Institucional UAO.`
  });
  return res.json(result);
});

app.post('/api/auth/sso-status', (req, res) => {
  const { available } = req.body || {};
  const status = ext.setSsoAvailability(available);
  return res.json({ ok: true, available: status });
});

app.get('/api/usuarios', (req, res) => {
  const { rol } = req.query;
  return res.json({ ok: true, usuarios: dbMod.listarUsuarios(rol || null) });
});

app.post('/api/usuarios', (req, res) => {
  const result = dbMod.crearUsuarioYMatricular(req.body || {});
  return res.status(result.ok ? 201 : 400).json(result);
});

app.get('/api/sesion', (req, res) => {
  const sesion = dbMod.getSesionActual();
  const roster = dbMod.getRoster();
  return res.json({ ok: true, sesion, roster });
});

app.post('/api/sesion/red', (req, res) => {
  const { redCaida, autor } = req.body || {};
  const sesion = dbMod.toggleRedDocente('SES-ISW1-G01-ACTUAL', Boolean(redCaida), autor);
  return res.json({ ok: true, sesion });
});

app.post('/api/sesion/cerrar', (req, res) => {
  const { autor } = req.body || {};
  const result = dbMod.cerrarSesionAsistencia({ autor });
  return res.json(result);
});

app.post('/api/asistencia/marcar', (req, res) => {
  const { estudianteCodigo, pin, modo, autor } = req.body || {};
  const result = dbMod.marcarAsistenciaEstudiante({
    estudianteCodigo: estudianteCodigo || '2248332',
    pinIngresado: pin,
    modo: modo || 'PIN',
    autor
  });
  return res.status(result.ok ? 200 : 400).json(result);
});

app.post('/api/asistencia/manual', (req, res) => {
  const { nroLista, estudianteCodigo, nuevoEstado, confirmado, periodoCerrado, autor } = req.body || {};
  const result = dbMod.actualizarRegistroManualOCorreccion({
    nroLista,
    estudianteCodigo,
    nuevoEstado,
    confirmado: Boolean(confirmado),
    periodoCerrado: Boolean(periodoCerrado),
    autor
  });
  return res.status(result.ok ? 200 : 400).json(result);
});

app.post('/api/novedades', (req, res) => {
  const { nroLista, estudianteCodigo, tipo, minutos, nota, autor } = req.body || {};
  const result = dbMod.registrarNovedadSesion({
    nroLista,
    estudianteCodigo,
    tipo,
    minutos,
    nota,
    autor
  });
  return res.status(result.ok ? 200 : 400).json(result);
});

app.get('/api/historial/:codigo', (req, res) => {
  const codigo = req.params.codigo || '2248332';
  const data = dbMod.getHistorialEstudiante(codigo);
  return res.json({ ok: true, ...data });
});

app.get('/api/excusas', (req, res) => {
  return res.json({ ok: true, excusas: dbMod.getExcusas(), bucket: storage.BUCKET_NAME });
});

app.post('/api/excusas', (req, res) => {
  const result = dbMod.radicarExcusa(req.body || {});
  return res.status(result.ok ? 201 : 400).json(result);
});

app.post('/api/excusas/:id/dictamen', (req, res) => {
  const { estado, autor } = req.body || {};
  const result = dbMod.evaluarExcusa({
    id: Number(req.params.id),
    nuevoEstado: estado,
    autor
  });
  return res.status(result.ok ? 200 : 400).json(result);
});

app.get('/api/soportes', (req, res) => {
  return res.json({ ok: true, bucket: storage.BUCKET_NAME, files: storage.listBucketFiles() });
});

app.get('/api/soportes/:filename', (req, res) => {
  const filePath = storage.getSupportFilePath(req.params.filename);
  if (!filePath) {
    return res.status(404).json({ ok: false, msg: 'Soporte digital no encontrado en el contenedor de almacenamiento.' });
  }
  return res.sendFile(filePath);
});

app.get('/api/bitacora', (req, res) => {
  return res.json({ ok: true, inmutable: true, bitacora: dbMod.getBitacora() });
});

app.delete('/api/bitacora', (req, res) => {
  return res.status(403).json({
    ok: false,
    msg: 'PROHIBIDO: La bitácora de auditoría es estrictamente inmutable y no permite eliminación de eventos.'
  });
});

app.get('/api/reportes', (req, res) => {
  const { periodo, facultad, asignatura, grupo } = req.query;
  const rep = dbMod.getReporteConsolidado({ periodo, facultad, asignatura, grupo });
  return res.json(rep);
});

app.get('/api/riesgo', (req, res) => {
  return res.json({ ok: true, estudiantes: dbMod.getEstudiantesEnRiesgo() });
});

app.post('/api/test/reset', (req, res) => {
  ext.setSsoAvailability(true);
  dbMod.initSchemaAndSeed(true);
  return res.json({ ok: true, msg: 'Base de datos SQL y almacenamiento restablecidos a estado inicial de fábrica.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=========================================================`);
    console.log(`UAO Attendance · Modelo C4 Completo Activo`);
    console.log(`- Aplicación Web Responsiva: http://localhost:${PORT}`);
    console.log(`- Aplicación API (Express):  http://localhost:${PORT}/api`);
    console.log(`- Base de Datos Relacional:  database/uao_attendance.db`);
    console.log(`- Almacenamiento Soportes:   gs://${storage.BUCKET_NAME}`);
    console.log(`=========================================================`);
  });
}

module.exports = app;
