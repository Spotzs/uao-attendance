const fs = require('fs');
const path = require('path');

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = /\.(pdf|jpe?g|png)$/i;
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'uao-attendance-soportes-2026';
const LOCAL_BUCKET_DIR = path.resolve(__dirname, '..', 'storage', 'gcs-bucket-uao-soportes');

function ensureBucketReady() {
  if (!fs.existsSync(LOCAL_BUCKET_DIR)) {
    fs.mkdirSync(LOCAL_BUCKET_DIR, { recursive: true });
  }
  const seedFiles = [
    { name: 'certificado_eps.pdf', title: 'Certificado Médico EPS Sura - Cita Especialista' },
    { name: 'certificado_medico.pdf', title: 'Certificado Médico EPS - María Fernanda Ruiz' },
    { name: 'soporte_familiar.jpg', title: 'Soporte Calamidad Doméstica - Andrés Felipe Morales' },
    { name: 'soporte_calamidad.jpg', title: 'Soporte Calamidad Doméstica Verificado' },
    { name: 'incapacidad_sura.pdf', title: 'Incapacidad Médica Urgencias 48h - Sara Sofía Castillo' },
    { name: 'incapacidad_eps.pdf', title: 'Incapacidad Médica EPS - Laura Sofía Pérez' }
  ];
  for (const f of seedFiles) {
    const filePath = path.join(LOCAL_BUCKET_DIR, f.name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(
        filePath,
        `%PDF-1.4\n% Soporte Digital UAO Attendance - Google Cloud Storage Bucket (${BUCKET_NAME})\n% Documento: ${f.title}\n% Archivo: ${f.name}\n`,
        'utf8'
      );
    }
  }
}

ensureBucketReady();

function validateSupportFile({ fileName, fileSize }) {
  const errors = [];
  if (!fileName) {
    errors.push('Debe adjuntar un soporte digital (PDF, JPG o PNG).');
    return { valid: false, errors };
  }
  if (!ALLOWED_EXTENSIONS.test(fileName)) {
    errors.push('Formato de archivo no permitido: solo se admiten archivos .pdf, .jpg o .png.');
  }
  if (typeof fileSize === 'number' && fileSize > MAX_SIZE_BYTES) {
    errors.push('El archivo supera el tamaño máximo permitido de 10 MB.');
  }
  if (typeof fileSize === 'number' && fileSize <= 0) {
    errors.push('El archivo adjunto está vacío o corrupto.');
  }
  return { valid: errors.length === 0, errors };
}

function saveSupportFile({ fileName, fileSize, base64Data, studentCode }) {
  const check = validateSupportFile({ fileName, fileSize });
  if (!check.valid) {
    return { ok: false, errors: check.errors };
  }

  const safeBase = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const storedName = `${Date.now()}_${studentCode || 'uao'}_${safeBase}`;
  const fullPath = path.join(LOCAL_BUCKET_DIR, storedName);

  const buffer = base64Data
    ? Buffer.from(base64Data.replace(/^data:[^;]+;base64,/, ''), 'base64')
    : Buffer.from(`Soporte Digital UAO Attendance (${safeBase}) - Estudiante ${studentCode || ''}`, 'utf8');

  if (buffer.length > MAX_SIZE_BYTES) {
    return { ok: false, errors: ['El archivo supera el tamaño máximo permitido de 10 MB.'] };
  }

  fs.writeFileSync(fullPath, buffer);

  const ext = path.extname(safeBase).toLowerCase();
  const mime = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg';

  return {
    ok: true,
    bucket: BUCKET_NAME,
    storedName,
    originalName: safeBase,
    size: fileSize || buffer.length,
    mime,
    gcsUri: `gs://${BUCKET_NAME}/${storedName}`,
    publicUrl: `/api/soportes/${encodeURIComponent(storedName)}`
  };
}

function getSupportFilePath(fileName) {
  const safeName = path.basename(fileName);
  const fullPath = path.join(LOCAL_BUCKET_DIR, safeName);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  return null;
}

function listBucketFiles() {
  ensureBucketReady();
  return fs.readdirSync(LOCAL_BUCKET_DIR).map(name => {
    const stat = fs.statSync(path.join(LOCAL_BUCKET_DIR, name));
    return {
      name,
      bucket: BUCKET_NAME,
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
      url: `/api/soportes/${encodeURIComponent(name)}`
    };
  });
}

module.exports = {
  BUCKET_NAME,
  MAX_SIZE_BYTES,
  validateSupportFile,
  saveSupportFile,
  getSupportFilePath,
  listBucketFiles
};
