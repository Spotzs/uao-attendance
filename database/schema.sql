PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    correo TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nombre TEXT NOT NULL,
    codigo TEXT NOT NULL UNIQUE,
    rol TEXT NOT NULL CHECK (rol IN ('docente', 'estudiante', 'director')),
    programa TEXT DEFAULT 'Ingeniería de Software',
    iniciales TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS asignaturas (
    id TEXT PRIMARY KEY,
    codigo_corto TEXT NOT NULL,
    nombre TEXT NOT NULL,
    grupo TEXT NOT NULL,
    periodo TEXT NOT NULL,
    docente_codigo TEXT NOT NULL,
    docente_nombre TEXT NOT NULL,
    salon TEXT NOT NULL,
    horario TEXT NOT NULL,
    facultad TEXT NOT NULL DEFAULT 'Ingeniería',
    total_sesiones INTEGER NOT NULL DEFAULT 18
);

CREATE TABLE IF NOT EXISTS matriculas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    estudiante_codigo TEXT NOT NULL,
    asignatura_id TEXT NOT NULL,
    grupo TEXT NOT NULL,
    periodo TEXT NOT NULL,
    UNIQUE(estudiante_codigo, asignatura_id, grupo, periodo)
);

CREATE TABLE IF NOT EXISTS sesiones (
    id TEXT PRIMARY KEY,
    asignatura_id TEXT NOT NULL,
    grupo TEXT NOT NULL,
    periodo TEXT NOT NULL,
    fecha TEXT NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fin TEXT NOT NULL,
    aula TEXT NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('ABIERTA', 'CERRADA', 'ARCHIVADA')),
    pin_actual TEXT NOT NULL,
    token_qr TEXT NOT NULL,
    pin_expira INTEGER NOT NULL,
    red_caida INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS registros_asistencia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sesion_id TEXT NOT NULL,
    asignatura_id TEXT NOT NULL,
    grupo TEXT NOT NULL,
    periodo TEXT NOT NULL,
    estudiante_codigo TEXT NOT NULL,
    estudiante_nombre TEXT NOT NULL,
    nro_lista INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('Presente', 'Ausente', 'Ausencia Justificada', 'Sin registro')),
    hora_registro TEXT,
    medio_registro TEXT,
    novedad_tipo TEXT,
    novedad_minutos INTEGER,
    novedad_nota TEXT,
    UNIQUE(sesion_id, estudiante_codigo)
);

CREATE TABLE IF NOT EXISTS historial_estudiante (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    estudiante_codigo TEXT NOT NULL,
    asignatura_id TEXT NOT NULL,
    grupo TEXT NOT NULL,
    periodo TEXT NOT NULL,
    fecha TEXT NOT NULL,
    sesion_numero INTEGER NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('Presente', 'Ausente', 'Ausencia Justificada')),
    medio TEXT NOT NULL,
    novedad TEXT,
    es_sesion_actual INTEGER NOT NULL DEFAULT 0,
    UNIQUE(estudiante_codigo, asignatura_id, fecha)
);

CREATE TABLE IF NOT EXISTS excusas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    estudiante_codigo TEXT NOT NULL,
    estudiante_nombre TEXT NOT NULL,
    asignatura_id TEXT NOT NULL,
    asignatura_nombre TEXT NOT NULL,
    fecha_falta TEXT NOT NULL,
    motivo TEXT NOT NULL,
    archivo_nombre TEXT NOT NULL,
    archivo_url TEXT NOT NULL,
    archivo_tamano INTEGER NOT NULL DEFAULT 1048576,
    archivo_mime TEXT NOT NULL DEFAULT 'application/pdf',
    estado TEXT NOT NULL CHECK (estado IN ('Pendiente', 'Aceptada', 'No Aprobada')),
    fecha_radicacion TEXT NOT NULL,
    evaluado_por TEXT
);

CREATE TABLE IF NOT EXISTS bitacora_auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_hora TEXT NOT NULL,
    autor TEXT NOT NULL,
    accion TEXT NOT NULL,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    detalle TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS trg_bitacora_no_update
BEFORE UPDATE ON bitacora_auditoria
BEGIN
    SELECT RAISE(ABORT, 'AUDITORIA_INMUTABLE: No se permite modificar registros de la bitácora de auditoría (RF-13).');
END;
