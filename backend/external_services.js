let ssoServiceAvailable = true;

function setSsoAvailability(available) {
  ssoServiceAvailable = Boolean(available);
  return ssoServiceAvailable;
}

function getSsoAvailability() {
  return ssoServiceAvailable;
}

function validarCredencialesSSO(db, { username, password, rol }) {
  if (!ssoServiceAvailable) {
    return {
      status: 503,
      ok: false,
      msg: 'Servicio de Autenticación Institucional UAO temporalmente fuera de servicio. Use el método alterno de registro en aula.'
    };
  }

  const rawUser = String(username || '').trim().toLowerCase();
  const rawPass = String(password || '');

  if (!rawUser || !rawPass) {
    return {
      status: 400,
      ok: false,
      msg: 'Ingrese su usuario institucional y contraseña UAO.'
    };
  }

  if (rawUser.includes('@') && !rawUser.endsWith('@uao.edu.co')) {
    return {
      status: 401,
      ok: false,
      msg: 'Credenciales institucionales incorrectas. El correo debe pertenecer al dominio @uao.edu.co.'
    };
  }

  const shortUser = rawUser.replace(/@uao\.edu\.co$/, '');

  const userRow = db.prepare(`
    SELECT id, username, correo, password, nombre, codigo, rol, programa, iniciales
    FROM usuarios
    WHERE LOWER(username) = ? OR LOWER(correo) = ?
  `).get(shortUser, rawUser);

  if (!userRow || userRow.password !== rawPass || rawPass === 'clave_falsa') {
    return {
      status: 401,
      ok: false,
      msg: 'Usuario o contraseña incorrectos. Por favor intente de nuevo con sus credenciales institucionales UAO.'
    };
  }

  const targetRol = rol ? String(rol).toLowerCase() : userRow.rol;

  return {
    status: 200,
    ok: true,
    user: {
      username: userRow.username,
      correo: userRow.correo,
      nombre: userRow.nombre,
      codigo: userRow.codigo,
      rol: targetRol,
      programa: userRow.programa,
      iniciales: userRow.iniciales
    }
  };
}

function validarMatriculaRegistroAcademico(db, { estudianteCodigo, asignaturaId, grupo }) {
  const row = db.prepare(`
    SELECT id FROM matriculas
    WHERE estudiante_codigo = ? AND asignatura_id = ? AND LOWER(grupo) = LOWER(?)
  `).get(String(estudianteCodigo), String(asignaturaId), String(grupo));

  if (!row) {
    return {
      matriculado: false,
      msg: `Estudiante (${estudianteCodigo}) no matriculado en este grupo académico (${asignaturaId.toUpperCase()}-${grupo.toUpperCase()}). Registro rechazado.`
    };
  }
  return { matriculado: true };
}

function enviarConsolidadoRegistroAcademico({ periodo, asignaturaId, grupo, totalRegistros }) {
  return {
    ok: true,
    sistema: 'Portal UAO / Registro Académico',
    periodo,
    asignaturaId,
    grupo,
    totalRegistros,
    timestamp: new Date().toISOString(),
    mensaje: 'Consolidado sincronizado exitosamente con Registro Académico UAO.'
  };
}

module.exports = {
  setSsoAvailability,
  getSsoAvailability,
  validarCredencialesSSO,
  validarMatriculaRegistroAcademico,
  enviarConsolidadoRegistroAcademico
};
