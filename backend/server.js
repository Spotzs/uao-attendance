const os = require('os');
const path = require('path');
const express = require('express');
const QRCode = require('qrcode');
const dbMod = require('./db');
const storage = require('./storage');
const ext = require('./external_services');

const app = express();
const PORT = process.env.PORT || 3000;

function obtenerIpLocal() {
  const ifaces = os.networkInterfaces();
  const candidatas = [];
  for (const [nombre, lista] of Object.entries(ifaces)) {
    for (const info of lista || []) {
      if (info.family !== 'IPv4' || info.internal) continue;
      if (info.address.startsWith('169.254.')) continue;
      const esVirtual = /vethernet|wsl|virtual|vmware|vbox|docker|hyper-v|loopback|tailscale/i.test(nombre);
      candidatas.push({ address: info.address, esVirtual });
    }
  }
  const fisica = candidatas.find(c => !c.esVirtual);
  return (fisica || candidatas[0] || {}).address || null;
}

function obtenerBaseUrlQr(req) {
  if (process.env.PUBLIC_URL) {
    return String(process.env.PUBLIC_URL).replace(/\/+$/, '');
  }
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`).split(',')[0].trim();
  const esLocalhost = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  if (esLocalhost) {
    const ipLocal = obtenerIpLocal();
    if (ipLocal) {
      return `http://${ipLocal}:${PORT}`;
    }
  }
  return `${proto}://${host}`;
}

async function enriquecerSesionConQr(req, sesion) {
  if (!sesion) return sesion;
  const baseUrl = obtenerBaseUrlQr(req);
  const qrUrl = `${baseUrl}/pages/estudiante/marcar-asistencia.html?qr=${encodeURIComponent(sesion.pin.token)}&pin=${encodeURIComponent(sesion.pin.code)}`;
  const qrSvg = sesion.sesionActiva
    ? await QRCode.toString(qrUrl, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 2,
        color: { dark: '#0D1B2A', light: '#FFFFFF' }
      })
    : null;
  const ipLocal = obtenerIpLocal();
  return {
    ...sesion,
    qrUrl,
    qrSvg,
    lanUrl: ipLocal ? `http://${ipLocal}:${PORT}` : null
  };
}

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

app.get('/api/sesion', async (req, res) => {
  try {
    const sesionRaw = dbMod.getSesionActual();
    const sesion = await enriquecerSesionConQr(req, sesionRaw);
    const roster = dbMod.getRoster();
    return res.json({ ok: true, sesion, roster });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: 'Error generando el código QR de la sesión.' });
  }
});

app.get('/api/sesion/qr.png', async (req, res) => {
  try {
    const sesion = dbMod.getSesionActual();
    if (!sesion || !sesion.sesionActiva) {
      return res.status(400).json({ ok: false, msg: 'La sesión no está activa.' });
    }
    const baseUrl = obtenerBaseUrlQr(req);
    const qrUrl = `${baseUrl}/pages/estudiante/marcar-asistencia.html?qr=${encodeURIComponent(sesion.pin.token)}&pin=${encodeURIComponent(sesion.pin.code)}`;
    const buf = await QRCode.toBuffer(qrUrl, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: { dark: '#0D1B2A', light: '#FFFFFF' }
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buf);
  } catch (err) {
    return res.status(500).json({ ok: false, msg: 'No se pudo generar la imagen QR.' });
  }
});

app.post('/api/sesion/red', async (req, res) => {
  const { redCaida, autor } = req.body || {};
  const sesionRaw = dbMod.toggleRedDocente('SES-ISW1-G01-ACTUAL', Boolean(redCaida), autor);
  const sesion = await enriquecerSesionConQr(req, sesionRaw);
  return res.json({ ok: true, sesion });
});

app.post('/api/sesion/cerrar', (req, res) => {
  const { autor } = req.body || {};
  const result = dbMod.cerrarSesionAsistencia({ autor });
  return res.json(result);
});

app.post('/api/asistencia/marcar', (req, res) => {
  const { estudianteCodigo, pin, tokenQr, modo, autor } = req.body || {};
  const result = dbMod.marcarAsistenciaEstudiante({
    estudianteCodigo: estudianteCodigo || '2248332',
    pinIngresado: pin,
    tokenQr,
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
  app.listen(PORT, '0.0.0.0', () => {
    const ipLocal = obtenerIpLocal();
    console.log(`=========================================================`);
    console.log(`UAO Attendance · Servidor Activo`);
    console.log(`- Acceso local:             http://localhost:${PORT}`);
    if (ipLocal) {
      console.log(`- Acceso celulares (Wi-Fi): http://${ipLocal}:${PORT}`);
    }
    console.log(`- API REST:                 http://localhost:${PORT}/api`);
    console.log(`- Base de Datos SQLite:     database/uao_attendance.db`);
    console.log(`- Almacenamiento Soportes:  gs://${storage.BUCKET_NAME}`);
    console.log(`=========================================================`);
  });
}

module.exports = app;
