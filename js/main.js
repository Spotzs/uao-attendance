(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const isApiMode = () => typeof fetch === 'function' && location.protocol !== 'file:';

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('uao_' + k);
        return v !== null ? JSON.parse(v) : d;
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('uao_' + k, JSON.stringify(v));
      } catch (e) {}
    },
    clear() {
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith('uao_'))
          .forEach(k => localStorage.removeItem(k));
      } catch (e) {}
    }
  };

  async function apiRequest(path, method = 'GET', body = null) {
    if (!isApiMode()) return null;
    try {
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      };
      if (body !== null) opts.body = JSON.stringify(body);
      const res = await fetch(path, opts);
      const data = await res.json().catch(() => null);
      if (data && typeof data === 'object') data._httpStatus = res.status;
      return data;
    } catch (e) {
      return null;
    }
  }

  const DEFAULT_EST_CODIGO = '2248332';
  const MATERIA_ACTIVA = 'Ingeniería de Software I';
  const FECHA_CORTE_HOY = '2026-11-18';

  const horaActual = () => new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const fechaActual = () => new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });

  function obtenerIniciales(nombre) {
    const p = String(nombre || 'UA').trim().split(/\s+/);
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  }

  function msg(el, ok, t) {
    if (!el) return;
    el.hidden = false;
    el.className = 'banner ' + (ok ? 'ok' : 'bad');
    el.textContent = (ok ? '✓ ' : '✕ ') + t;
  }

  function getEstudianteActivoCodigo() {
    return store.get('estudiante_activo_codigo', DEFAULT_EST_CODIGO);
  }

  function setEstudianteActivoCodigo(cod) {
    store.set('estudiante_activo_codigo', String(cod));
  }

  const CUENTAS_SSO_UAO = [
    { user: 'sandra.guanarita', correo: 'sandra.guanarita@uao.edu.co', pass: 'Uao2026*', rol: 'docente', nombre: 'Sandra Lucía Guañarita Fernández', codigo: '1001001' },
    { user: 'juan_se.marin', correo: 'juan_se.marin@uao.edu.co', pass: 'Uao2026*', rol: 'estudiante', nombre: 'Juan Sebastián Marín Restrepo', codigo: '2248332' },
    { user: 'mariana.lopez', correo: 'mariana.lopez@uao.edu.co', pass: 'Uao2026*', rol: 'estudiante', nombre: 'Mariana López Ortiz', codigo: '2248910' },
    { user: 'andres.morales', correo: 'andres.morales@uao.edu.co', pass: 'Uao2026*', rol: 'estudiante', nombre: 'Andrés Felipe Morales', codigo: '2245006' },
    { user: 'sara.castillo', correo: 'sara.castillo@uao.edu.co', pass: 'Uao2026*', rol: 'estudiante', nombre: 'Sara Sofía Castillo', codigo: '2245009' },
    { user: 'carlos.ramirez', correo: 'carlos.ramirez@uao.edu.co', pass: 'Uao2026*', rol: 'director', nombre: 'Carlos Ramírez', codigo: '9001001' },
    { user: 'director.software', correo: 'director.software@uao.edu.co', pass: 'Uao2026*', rol: 'director', nombre: 'Carlos Ramírez', codigo: '9001002' }
  ];

  function validarCredencialesSSO(u, p, rolSeleccionado) {
    const rawUser = String(u || '').trim().toLowerCase();
    const rawPass = String(p || '');

    if (!rawUser || !rawPass) {
      return { ok: false, msg: 'Ingrese su usuario institucional y contraseña UAO.' };
    }
    if (rawUser.includes('@') && !rawUser.endsWith('@uao.edu.co')) {
      return { ok: false, msg: 'Credenciales institucionales incorrectas. El correo debe pertenecer al dominio @uao.edu.co.' };
    }
    if (rawPass === 'clave_falsa' || rawUser.includes('invalido') || rawUser.includes('falso')) {
      return { ok: false, msg: 'Usuario o contraseña incorrectos. Por favor intente de nuevo.' };
    }

    const shortUser = rawUser.replace(/@uao\.edu\.co$/, '');
    const cuenta = CUENTAS_SSO_UAO.find(c => c.user === shortUser || c.correo === rawUser);
    if (!cuenta || cuenta.pass !== rawPass) {
      return { ok: false, msg: 'Usuario o contraseña incorrectos. Verifique sus credenciales institucionales UAO.' };
    }

    return { ok: true, cuenta: { ...cuenta, rol: rolSeleccionado || cuenta.rol } };
  }

  function initRoster() {
    const nombres = [
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
    const horasBase = ['08:01', '08:02', '08:02', '08:03', '08:04', '08:05'];
    return nombres.map((nom, i) => {
      const n = i + 1;
      const cod = n === 23 ? '2248332' : (n === 13 ? '2248910' : String(2245000 + n));
      return {
        n,
        codigo: cod,
        nombre: nom,
        iniciales: obtenerIniciales(nom),
        estado: n < 20 ? 'Presente' : 'Sin registro',
        hora: n < 20 ? horasBase[i % horasBase.length] : null,
        medio: n < 20 ? 'QR / PIN' : null,
        novedad: null
      };
    });
  }

  const getRoster = () => store.get('roster', initRoster());
  const setRoster = (r) => store.set('roster', r);

  function getBitacora() {
    return store.get('bitacora', [
      {
        fecha: '2026-11-02 08:00:15',
        autor: 'Sandra Lucía Guañarita (Docente)',
        accion: 'Apertura de sesión (M02)',
        valorAnterior: 'INACTIVA',
        valorNuevo: 'ABIERTA',
        detalle: 'Sesión iniciada para ISW1-G01 (Salón Y3-04). PIN y QR de 60 s generados.'
      },
      {
        fecha: '2026-11-02 08:05:42',
        autor: 'Sandra Lucía Guañarita (Docente)',
        accion: 'Registro de contingencia (M04)',
        valorAnterior: 'Sin registro',
        valorNuevo: 'Presente',
        detalle: 'Estudiante Daniel Alejandro Cruz (2245010) marcado Presente vía manual.'
      }
    ]);
  }

  function registrarAuditoria(accion, detalle, valorAnterior = '—', valorNuevo = '—') {
    const bitacora = getBitacora();
    bitacora.unshift({
      fecha: new Date().toLocaleString('es-CO'),
      autor: store.get('usuario_actual', 'Sandra Lucía Guañarita (Docente)'),
      accion,
      valorAnterior,
      valorNuevo,
      detalle
    });
    store.set('bitacora', bitacora.slice(0, 150));
  }

  const generarPin = () => String(Math.floor(1000 + Math.random() * 9000));

  function nuevoPin() {
    const p = {
      code: generarPin(),
      exp: Date.now() + 60000,
      token: 'UAO-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      redCaida: store.get('red_docente_caida', false)
    };
    store.set('pin', p);
    return p;
  }

  function getPin() {
    let p = store.get('pin', null);
    const redCaida = store.get('red_docente_caida', false);
    if (!p) {
      p = nuevoPin();
    } else if (redCaida) {
      p.redCaida = true;
      if (p.exp - Date.now() < 45000) {
        p.exp = Date.now() + 60000;
        store.set('pin', p);
      }
    } else if (Date.now() >= p.exp) {
      p = nuevoPin();
    }
    return p;
  }

  function validarPin(x) {
    if (!/^\d{4}$/.test(String(x || ''))) {
      return { ok: false, msg: 'Ingresa los 4 dígitos numéricos del PIN institucional.' };
    }
    const sesionActiva = store.get('sesion_activa', true);
    if (!sesionActiva) {
      return { ok: false, msg: 'La sesión de asistencia ya fue cerrada por el docente (M04).' };
    }
    const p = store.get('pin', null);
    if (!p) {
      return { ok: false, msg: 'No hay una sesión activa. Solicite al docente iniciar la asistencia.' };
    }
    const redCaida = store.get('red_docente_caida', false);
    if (!redCaida && Date.now() >= p.exp) {
      return { ok: false, msg: 'Código PIN vencido o inválido. Verifique el tablero.' };
    }
    if (String(x) !== p.code) {
      return { ok: false, msg: 'Código PIN incorrecto. Verifique el código proyectado.' };
    }
    return { ok: true };
  }

  function renderSvgQR(seedText = 'UAO') {
    let hash = 0;
    for (let i = 0; i < seedText.length; i++) {
      hash = ((hash << 5) - hash) + seedText.charCodeAt(i);
      hash |= 0;
    }
    const cells = [];
    const size = 15;
    const isFinder = (r, c) =>
      (r < 4 && c < 4) || (r < 4 && c >= size - 4) || (r >= size - 4 && c < 4);

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (isFinder(r, c)) continue;
        const bit = ((hash >> ((r * size + c) % 24)) ^ (r * 7 + c * 13)) & 1;
        if (bit) {
          const x = 10 + c * 5.3;
          const y = 10 + r * 5.3;
          cells.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="4.4" height="4.4" rx="0.6" fill="#0D1B2A"/>`);
        }
      }
    }

    return `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Código QR de sesión activa">
      <rect width="100" height="100" rx="6" fill="#FFFFFF"/>
      <rect x="8" y="8" width="22" height="22" rx="2" fill="#0D1B2A"/>
      <rect x="11.5" y="11.5" width="15" height="15" rx="1" fill="#FFFFFF"/>
      <rect x="14.5" y="14.5" width="9" height="9" fill="#0D1B2A"/>
      <rect x="70" y="8" width="22" height="22" rx="2" fill="#0D1B2A"/>
      <rect x="73.5" y="11.5" width="15" height="15" rx="1" fill="#FFFFFF"/>
      <rect x="76.5" y="14.5" width="9" height="9" fill="#0D1B2A"/>
      <rect x="8" y="70" width="22" height="22" rx="2" fill="#0D1B2A"/>
      <rect x="11.5" y="73.5" width="15" height="15" rx="1" fill="#FFFFFF"/>
      <rect x="14.5" y="76.5" width="9" height="9" fill="#0D1B2A"/>
      ${cells.join('')}
    </svg>`;
  }

  function calcFallas(aus, tot) {
    if (!tot || tot <= 0) {
      return { pct: 0, asistPct: 100, nivel: 'ok', maxPermitidas: 0, faltasRestantesPermitidas: 0, faltasParaSuperar20: 0, faltasPara20: 0 };
    }
    const pct = (aus / tot) * 100;
    const maxPermitidas = Math.floor(tot * 0.20 + 1e-9);
    const faltasRestantesPermitidas = Math.max(0, maxPermitidas - aus);
    const faltasParaSuperar20 = Math.max(0, (maxPermitidas + 1) - aus);
    return {
      pct: Math.round(pct * 10) / 10,
      asistPct: Math.round((100 - pct) * 10) / 10,
      nivel: (pct >= 20 || aus > maxPermitidas) ? 'rojo' : pct >= 15 ? 'ambar' : 'ok',
      maxPermitidas,
      faltasRestantesPermitidas,
      faltasParaSuperar20,
      faltasPara20: faltasParaSuperar20
    };
  }

  function crearMateriasBaseEstudiante(cod) {
    if (cod === '2245006') {
      return [
        {
          id: 'isw1', codigoCorto: 'ISW', n: 'Ingeniería de Software I', grupo: 'G01', docente: 'Sandra Guañarita',
          aus: 2, just: 0, tot: 18, tardanzas: 0, fechasFallas: ['2026-10-20', '2026-10-12'],
          sesiones: [
            { fecha: '2026-11-02', labelFecha: '2 nov', det: 'Registro con QR', estado: 'Presente' },
            { fecha: '2026-10-28', labelFecha: '28 oct', det: 'Registro con PIN', estado: 'Presente' },
            { fecha: '2026-10-20', labelFecha: '20 oct', det: 'Inasistencia registrada', estado: 'Ausente' },
            { fecha: '2026-10-12', labelFecha: '12 oct', det: 'Inasistencia registrada', estado: 'Ausente' }
          ]
        },
        {
          id: 'bd2', codigoCorto: 'BDD', n: 'Bases de Datos II', grupo: 'G01', docente: 'Juan Carlos Ríos',
          aus: 1, just: 0, tot: 19, tardanzas: 0, fechasFallas: ['2026-10-18'],
          sesiones: [
            { fecha: '2026-10-29', labelFecha: '29 oct', det: 'Registro con QR', estado: 'Presente' },
            { fecha: '2026-10-18', labelFecha: '18 oct', det: 'Inasistencia sin excusa', estado: 'Ausente' }
          ]
        },
        {
          id: 'md', codigoCorto: 'MAT', n: 'Matemáticas Discretas', grupo: 'G01', docente: 'Ana María Vélez',
          aus: 1, just: 0, tot: 19, tardanzas: 0, fechasFallas: ['2026-10-10'],
          sesiones: [
            { fecha: '2026-10-30', labelFecha: '30 oct', det: 'Registro con PIN', estado: 'Presente' },
            { fecha: '2026-10-10', labelFecha: '10 oct', det: 'Inasistencia sin excusa', estado: 'Ausente' }
          ]
        }
      ];
    }

    if (cod === '2245009') {
      return [
        {
          id: 'isw1', codigoCorto: 'ISW', n: 'Ingeniería de Software I', grupo: 'G01', docente: 'Sandra Guañarita',
          aus: 1, just: 1, tot: 18, tardanzas: 0, fechasFallas: ['2026-10-21', '2026-10-14'],
          sesiones: [
            { fecha: '2026-10-21', labelFecha: '21 oct', det: 'Inasistencia registrada', estado: 'Ausente' },
            { fecha: '2026-10-14', labelFecha: '14 oct', det: 'Excusa médica aprobada', estado: 'Ausencia Justificada' }
          ]
        },
        {
          id: 'bd2', codigoCorto: 'BDD', n: 'Bases de Datos II', grupo: 'G01', docente: 'Juan Carlos Ríos',
          aus: 1, just: 0, tot: 19, tardanzas: 0, fechasFallas: ['2026-10-18'],
          sesiones: [{ fecha: '2026-10-18', labelFecha: '18 oct', det: 'Inasistencia registrada', estado: 'Ausente' }]
        },
        {
          id: 'md', codigoCorto: 'MAT', n: 'Matemáticas Discretas', grupo: 'G01', docente: 'Ana María Vélez',
          aus: 3, just: 0, tot: 19, tardanzas: 0, fechasFallas: ['2026-10-24', '2026-10-17', '2026-10-10'],
          sesiones: [
            { fecha: '2026-10-24', labelFecha: '24 oct', det: 'Inasistencia registrada', estado: 'Ausente' },
            { fecha: '2026-10-17', labelFecha: '17 oct', det: 'Inasistencia registrada', estado: 'Ausente' },
            { fecha: '2026-10-10', labelFecha: '10 oct', det: 'Inasistencia registrada', estado: 'Ausente' }
          ]
        }
      ];
    }

    return [
      {
        id: 'isw1', codigoCorto: 'ISW', n: 'Ingeniería de Software I', grupo: 'G01', docente: 'Sandra Guañarita',
        aus: 1, just: 1, tot: 18, tardanzas: 1, fechasFallas: ['2026-10-25', '2026-10-14'],
        sesiones: [
          { fecha: '2026-11-02', labelFecha: '2 nov (Hoy)', det: 'Sesión actual de aula', estado: 'Presente', esActual: true },
          { fecha: '2026-10-28', labelFecha: '28 oct', det: 'Registro con QR', estado: 'Presente' },
          { fecha: '2026-10-25', labelFecha: '25 oct', det: 'Inasistencia médica registrada', estado: 'Ausente' },
          { fecha: '2026-10-21', labelFecha: '21 oct', det: 'Registro con PIN · Llegada 8 min tarde', estado: 'Presente', novedad: 'Llegada tarde (8m)' },
          { fecha: '2026-10-14', labelFecha: '14 oct', det: 'Incapacidad médica justificada', estado: 'Ausencia Justificada' }
        ]
      },
      {
        id: 'bd2', codigoCorto: 'BDD', n: 'Bases de Datos II', grupo: 'G01', docente: 'Juan Carlos Ríos',
        aus: 2, just: 0, tot: 19, tardanzas: 0, fechasFallas: ['2026-10-22', '2026-10-18'],
        sesiones: [
          { fecha: '2026-10-29', labelFecha: '29 oct', det: 'Registro con QR', estado: 'Presente' },
          { fecha: '2026-10-22', labelFecha: '22 oct', det: 'Sin excusa registrada', estado: 'Ausente' },
          { fecha: '2026-10-18', labelFecha: '18 oct', det: 'Sin excusa registrada', estado: 'Ausente' },
          { fecha: '2026-10-11', labelFecha: '11 oct', det: 'Registro con PIN', estado: 'Presente' }
        ]
      },
      {
        id: 'md', codigoCorto: 'MAT', n: 'Matemáticas Discretas', grupo: 'G01', docente: 'Ana María Vélez',
        aus: 3, just: 0, tot: 19, tardanzas: 0, fechasFallas: ['2026-10-24', '2026-10-17', '2026-10-10'],
        sesiones: [
          { fecha: '2026-10-31', labelFecha: '31 oct', det: 'Registro con QR', estado: 'Presente' },
          { fecha: '2026-10-24', labelFecha: '24 oct', det: 'Sin excusa registrada', estado: 'Ausente' },
          { fecha: '2026-10-17', labelFecha: '17 oct', det: 'Sin excusa registrada', estado: 'Ausente' },
          { fecha: '2026-10-10', labelFecha: '10 oct', det: 'Sin excusa registrada', estado: 'Ausente' },
          { fecha: '2026-10-03', labelFecha: '3 oct', det: 'Registro con PIN', estado: 'Presente' }
        ]
      }
    ];
  }

  function getMapaMateriasPorEstudiante() {
    let mapa = store.get('materias_por_estudiante', null);
    if (!mapa) {
      mapa = {
        '2248332': crearMateriasBaseEstudiante('2248332'),
        '2248910': crearMateriasBaseEstudiante('2248910'),
        '2245006': crearMateriasBaseEstudiante('2245006'),
        '2245009': crearMateriasBaseEstudiante('2245009')
      };
      store.set('materias_por_estudiante', mapa);
    }
    return mapa;
  }

  function getMateriasEstudiante(cod = getEstudianteActivoCodigo()) {
    const mapa = getMapaMateriasPorEstudiante();
    if (!mapa[cod]) {
      mapa[cod] = crearMateriasBaseEstudiante(cod);
      store.set('materias_por_estudiante', mapa);
    }
    return mapa[cod];
  }

  function setMateriasEstudiante(cod, mats) {
    const mapa = getMapaMateriasPorEstudiante();
    mapa[cod] = mats;
    store.set('materias_por_estudiante', mapa);
  }

  function calcularAsistenciaGeneralEstudiante(cod = getEstudianteActivoCodigo()) {
    const mats = getMateriasEstudiante(cod);
    let totSes = 0;
    let totAus = 0;
    mats.forEach(m => {
      if (m.tot > 0) {
        totSes += m.tot;
        totAus += m.aus;
      }
    });
    if (totSes <= 0) return 100;
    return Math.round(((totSes - totAus) / totSes) * 1000) / 10;
  }

  async function syncSesionDesdeServidor() {
    const data = await apiRequest('/api/sesion', 'GET');
    if (data && data.ok && data.sesion) {
      store.set('sesion_activa', data.sesion.sesionActiva);
      store.set('red_docente_caida', Boolean(data.sesion.pin.redCaida));
      store.set('pin', data.sesion.pin);
      if (Array.isArray(data.roster)) {
        setRoster(data.roster);
      }
      return data;
    }
    return null;
  }

  async function syncHistorialDesdeServidor(cod = getEstudianteActivoCodigo()) {
    const data = await apiRequest(`/api/historial/${encodeURIComponent(cod)}`, 'GET');
    if (data && data.ok && Array.isArray(data.materias)) {
      const formatted = data.materias.map(m => ({
        ...m,
        sesiones: (m.sesiones || []).map(s => ({
          fecha: s.fecha,
          labelFecha: s.es_sesion_actual ? `${s.fecha} (Actual)` : s.fecha,
          det: s.novedad ? `${s.medio} · ${s.novedad}` : s.medio,
          estado: s.estado,
          esActual: s.es_sesion_actual === 1
        }))
      }));
      setMateriasEstudiante(cod, formatted);
      return data;
    }
    return null;
  }

  async function syncExcusasDesdeServidor() {
    const data = await apiRequest('/api/excusas', 'GET');
    if (data && data.ok && Array.isArray(data.excusas)) {
      store.set('excusas', data.excusas);
      return data.excusas;
    }
    return null;
  }

  function marcarAsistenciaEstudiante(metodo = 'QR / PIN', codigoEst = getEstudianteActivoCodigo()) {
    const r = getRoster();
    const est = r.find(x => x.codigo === String(codigoEst)) || r[22];
    if (!est) {
      return { ok: false, msg: 'Error RF-11: Estudiante no matriculado en este grupo académico.' };
    }
    if (est.estado === 'Presente') {
      return { ok: false, msg: 'Ya registraste tu asistencia para esta sesión de clase.' };
    }
    const estadoPrevio = est.estado;
    est.estado = 'Presente';
    est.hora = horaActual();
    est.medio = metodo;
    setRoster(r);

    const mats = getMateriasEstudiante(est.codigo);
    const isw1 = mats.find(m => m.id === 'isw1');
    if (isw1 && estadoPrevio === 'Ausente' && isw1.aus > 0) {
      isw1.aus--;
      setMateriasEstudiante(est.codigo, mats);
    }

    registrarAuditoria('Marcado autónomo (M03)', `${est.nombre} (${est.codigo}) marcó asistencia vía ${metodo}`, estadoPrevio, 'Presente');
    return { ok: true, msg: `¡Asistencia confirmada! · ${horaActual()} · ${MATERIA_ACTIVA} · Presente` };
  }

  function getExcusas() {
    return store.get('excusas', [
      {
        id: 1,
        estudiante: 'Juan Sebastián Marín Restrepo',
        codigo: '2248332',
        asigId: 'isw1',
        asig: 'Ingeniería de Software I',
        fecha: '2026-10-25',
        desc: 'Cita médica especialista con gastroenterólogo',
        archivo: 'certificado_eps.pdf',
        tamanoLabel: '1.8 MB',
        estado: 'Pendiente'
      },
      {
        id: 2,
        estudiante: 'Andrés Felipe Morales',
        codigo: '2245006',
        asigId: 'isw1',
        asig: 'Ingeniería de Software I',
        fecha: '2026-10-20',
        desc: 'Calamidad doméstica de primer grado comprobada',
        archivo: 'soporte_familiar.jpg',
        tamanoLabel: '1.6 MB',
        estado: 'Pendiente'
      },
      {
        id: 3,
        estudiante: 'Sara Sofía Castillo',
        codigo: '2245009',
        asigId: 'isw1',
        asig: 'Ingeniería de Software I',
        fecha: '2026-10-14',
        desc: 'Incapacidad médica por urgencias 48h',
        archivo: 'incapacidad_sura.pdf',
        tamanoLabel: '1.2 MB',
        estado: 'Aceptada'
      }
    ]);
  }

  function validarExcusa(d, estudianteCodigo = getEstudianteActivoCodigo()) {
    const e = [];
    if (!d.asig) e.push('Debe seleccionar la asignatura correspondiente.');
    if (!d.fecha) {
      e.push('Indique la fecha en la que se presentó la inasistencia.');
    } else if (String(d.fecha) > FECHA_CORTE_HOY) {
      e.push('La fecha de la ausencia no puede ser una fecha futura.');
    } else if (d.asig && d.validarFallaRegistrada !== false) {
      const mats = getMateriasEstudiante(estudianteCodigo);
      const mat = mats.find(m => m.n.toLowerCase() === String(d.asig).toLowerCase() || m.id.toLowerCase() === String(d.asig).toLowerCase());
      if (mat && Array.isArray(mat.fechasFallas) && !mat.fechasFallas.includes(String(d.fecha))) {
        e.push(`No existe una inasistencia registrada en la fecha ${d.fecha} para ${mat.n}. Seleccione una fecha con falla registrada.`);
      }
    }
    if (!d.desc || d.desc.trim().length < 5) {
      e.push('Escriba una justificación detallada (mínimo 5 caracteres).');
    }
    if (!d.file) {
      e.push('Debe adjuntar un soporte digital (PDF, JPG o PNG).');
    } else {
      if (!/\.(pdf|jpe?g|png)$/i.test(d.file.name)) {
        e.push('Formato no permitido: solo se admiten archivos .pdf, .jpg o .png.');
      }
      if (d.file.size > 10 * 1024 * 1024) {
        e.push('El archivo supera el tamaño máximo permitido de 10 MB.');
      }
    }
    return e;
  }

  function dictaminarExcusa(id, nuevoEstado) {
    const excusas = getExcusas();
    const exc = excusas.find(x => x.id === Number(id));
    if (!exc) return null;

    const estadoAnterior = exc.estado;
    if (estadoAnterior === nuevoEstado) return exc;

    exc.estado = nuevoEstado;
    store.set('excusas', excusas);

    const mats = getMateriasEstudiante(exc.codigo);
    const targetMat = mats.find(m => m.n.toLowerCase() === exc.asig.toLowerCase() || m.id === exc.asigId);
    if (targetMat) {
      if (estadoAnterior !== 'Aceptada' && nuevoEstado === 'Aceptada') {
        if (targetMat.aus > 0) targetMat.aus--;
        targetMat.just = (targetMat.just || 0) + 1;
      } else if (estadoAnterior === 'Aceptada' && nuevoEstado !== 'Aceptada') {
        targetMat.aus++;
        targetMat.just = Math.max(0, (targetMat.just || 1) - 1);
      }
      setMateriasEstudiante(exc.codigo, mats);
    }

    registrarAuditoria(
      'Evaluación de excusa (M06)',
      `Excusa #${exc.id} de ${exc.estudiante} (${exc.codigo}) dictaminada como [${nuevoEstado}]. Historial de ${exc.codigo} recalculado.`,
      estadoAnterior,
      nuevoEstado
    );
    return exc;
  }

  window.UAO = {
    generarPin,
    validarPin,
    validarCredencialesSSO,
    calcFallas,
    validarExcusa,
    dictaminarExcusa,
    getMateriasEstudiante,
    calcularAsistenciaGeneralEstudiante,
    marcarAsistenciaEstudiante,
    registrarAuditoria,
    reset: async () => {
      store.clear();
      await apiRequest('/api/test/reset', 'POST');
      location.reload();
    }
  };

  if ($('#switch-vista')) {
    $('#switch-vista').addEventListener('change', (e) => {
      const v = e.target.value;
      const inSubdir = location.pathname.includes('/pages/');
      const prefix = inSubdir ? '../' : 'pages/';
      if (v === 'docente') location.href = prefix + 'docente/inicio.html';
      if (v === 'estudiante') location.href = prefix + 'estudiante/inicio.html';
      if (v === 'director') location.href = prefix + 'director/resumen.html';
    });
  }

  function actualizarBadgesExcusasDocente() {
    const pendientes = getExcusas().filter(x => x.estado === 'Pendiente').length;
    if ($('#nav-exc-count')) $('#nav-exc-count').textContent = pendientes;
    if ($('#tab-exc-count')) $('#tab-exc-count').textContent = pendientes;
    if ($('#badge-por-revisar')) $('#badge-por-revisar').textContent = `${pendientes} por revisar`;
  }
  actualizarBadgesExcusasDocente();

  if ($('#login')) {
    let rol = 'docente';
    const rutas = {
      docente: 'pages/docente/inicio.html',
      estudiante: 'pages/estudiante/inicio.html',
      director: 'pages/director/resumen.html'
    };
    const defaultUsers = {
      docente: 'sandra.guanarita',
      estudiante: 'juan_se.marin',
      director: 'carlos.ramirez'
    };

    $$('#roles span').forEach((s, i) => {
      s.addEventListener('click', () => {
        rol = ['docente', 'estudiante', 'director'][i];
        $$('#roles span').forEach(x => x.classList.remove('on'));
        s.classList.add('on');
        $('#user').value = defaultUsers[rol];
        $('#pass').value = 'Uao2026*';
        if ($('#lmsg')) $('#lmsg').hidden = true;
      });
    });

    $('#login').addEventListener('click', async () => {
      const u = $('#user').value.trim();
      const p = $('#pass').value;

      if (isApiMode()) {
        const res = await apiRequest('/api/auth/login', 'POST', { username: u, password: p, rol });
        if (res) {
          if (!res.ok) {
            return msg($('#lmsg'), false, res.msg || 'Credenciales institucionales incorrectas.');
          }
          store.set('usuario_actual', `${res.user.nombre} (${res.user.rol})`);
          store.set('rol_actual', res.user.rol);
          if (res.user.rol === 'estudiante') {
            setEstudianteActivoCodigo(res.user.codigo);
            store.set('estudiante_activo_nombre', res.user.nombre);
          }
          location.href = rutas[res.user.rol] || rutas[rol];
          return;
        }
      }

      const validacion = validarCredencialesSSO(u, p, rol);
      if (!validacion.ok) {
        return msg($('#lmsg'), false, validacion.msg);
      }
      store.set('usuario_actual', `${validacion.cuenta.nombre} (${validacion.cuenta.rol})`);
      store.set('rol_actual', rol);
      if (validacion.cuenta.rol === 'estudiante') {
        setEstudianteActivoCodigo(validacion.cuenta.codigo);
      }
      location.href = rutas[rol];
    });

    if ($('#sim-bad-login')) {
      $('#sim-bad-login').addEventListener('click', () => {
        $('#user').value = 'usuario.invalido@externo.com';
        $('#pass').value = 'clave_falsa';
        const v = validarCredencialesSSO($('#user').value, $('#pass').value, rol);
        msg($('#lmsg'), false, v.msg);
      });
    }

    if ($('#sim-sso-down')) {
      $('#sim-sso-down').addEventListener('click', async () => {
        await apiRequest('/api/auth/sso-status', 'POST', { available: false });
        msg($('#lmsg'), false, 'HTTP 503: Servicio de Autenticación Institucional UAO fuera de línea. Use el método alterno de contingencia en aula (RF-01).');
        setTimeout(() => apiRequest('/api/auth/sso-status', 'POST', { available: true }), 4000);
      });
    }

    if ($('#toggle-reg-usuario') && $('#box-reg-usuario')) {
      $('#toggle-reg-usuario').addEventListener('click', () => {
        $('#box-reg-usuario').hidden = !$('#box-reg-usuario').hidden;
      });
    }

    if ($('#btn-crear-usuario')) {
      $('#btn-crear-usuario').addEventListener('click', async () => {
        const nombre = ($('#reg-nombre').value || '').trim();
        const codigo = ($('#reg-codigo').value || '').trim();
        const username = ($('#reg-user').value || '').trim();
        const regRol = $('#reg-rol').value;

        const res = await apiRequest('/api/usuarios', 'POST', {
          nombre, codigo, username, rol: regRol, password: 'Uao2026*'
        });
        if (!res) {
          return msg($('#reg-msg'), false, 'Inicie el servidor (`npm start`) para registrar usuarios nuevos en SQLite.');
        }
        if (!res.ok) {
          return msg($('#reg-msg'), false, res.msg);
        }
        msg($('#reg-msg'), true, `Usuario ${res.user.correo} (${res.user.codigo}) guardado en SQLite y matriculado. Ya puedes iniciar sesión con él.`);
        $('#user').value = res.user.username;
        $('#pass').value = 'Uao2026*';
      });
    }

    if ($('#link-soporte-uao')) {
      $('#link-soporte-uao').addEventListener('click', (e) => {
        e.preventDefault();
        msg($('#lmsg'), true, 'Mesa de Ayuda TI UAO (Ext. 1111): Use su usuario institucional sin @uao.edu.co o su correo @uao.edu.co.');
      });
    }

    if ($('#reset')) {
      $('#reset').addEventListener('click', (e) => {
        e.preventDefault();
        UAO.reset();
      });
    }
  }

  if ($('#pin') && $('#count')) {
    let p = getPin();
    let lastTokenRendered = '';
    const qrContainer = $('#qr-container') || $('.qr-box');

    const pintarM02 = () => {
      const sesionActiva = store.get('sesion_activa', true);
      const redDocenteCaida = store.get('red_docente_caida', false);
      p = getPin();

      if (qrContainer && p.token !== lastTokenRendered) {
        qrContainer.innerHTML = renderSvgQR(p.token);
        lastTokenRendered = p.token;
      }

      if (!sesionActiva) {
        $('#pin').textContent = '----';
        $('#count').textContent = '0';
        if ($('#token-status-title')) $('#token-status-title').textContent = 'Sesión cerrada (M04)';
        if ($('#token-status-sub')) $('#token-status-sub').textContent = 'El marcado por QR y PIN ha finalizado';
        if ($('#sub-estado-pin')) $('#sub-estado-pin').textContent = 'Registro autónomo cerrado';
      } else if (redDocenteCaida) {
        $('#pin').textContent = p.code;
        $('#count').textContent = '60';
        if ($('#token-status-title')) $('#token-status-title').textContent = 'PIN retenido (Contingencia)';
        if ($('#token-status-sub')) $('#token-status-sub').textContent = 'Vigencia extendida mientras dura la falla de red';
        if ($('#sub-estado-pin')) $('#sub-estado-pin').textContent = 'Retenido por corte de red (DEF-02)';
      } else {
        $('#pin').textContent = p.code;
        const segRestantes = Math.max(1, Math.ceil((p.exp - Date.now()) / 1000));
        $('#count').textContent = segRestantes;
        if ($('#token-status-title')) $('#token-status-title').textContent = 'Token activo';
        if ($('#token-status-sub')) $('#token-status-sub').textContent = 'Expira en menos de un minuto';
        if ($('#sub-estado-pin')) $('#sub-estado-pin').textContent = 'Se renueva automáticamente';
      }

      const r = getRoster();
      const pres = r.filter(x => x.estado === 'Presente');
      const aus = r.filter(x => x.estado === 'Ausente');
      const sin = r.filter(x => x.estado === 'Sin registro');
      const novs = r.filter(x => x.novedad).length;
      const pct = r.length ? Math.round((pres.length / r.length) * 100) : 0;

      if ($('#pres')) $('#pres').textContent = `${pres.length} de ${r.length} presentes`;
      if ($('#pres-pct')) $('#pres-pct').textContent = `${pct}%`;
      if ($('#fill')) $('#fill').style.width = `${pct}%`;

      if ($('#stat-pres')) $('#stat-pres').textContent = pres.length;
      if ($('#stat-nov')) $('#stat-nov').textContent = novs;
      if ($('#stat-sin')) $('#stat-sin').textContent = sesionActiva ? sin.length : aus.length;

      const badge = $('#badge-estado-sesion');
      if (badge) {
        badge.className = 'live-pill' + (sesionActiva ? '' : ' closed');
        badge.textContent = sesionActiva ? '● EN VIVO' : '■ CERRADA';
      }

      if ($('#resumen')) {
        $('#resumen').innerHTML = sesionActiva
          ? `Sesión en curso · ${aus.length} ausentes`
          : `<b>Sesión cerrada</b> · ${aus.length} ausentes fijados`;
      }

      const ultEl = $('#ultimos');
      if (ultEl) {
        const avatarColors = ['', 'amber', 'green', 'blue', 'purple'];
        ultEl.innerHTML = pres.slice(-4).reverse().map((x, idx) => `
          <div class="row" style="padding:9px 0">
            <div style="display:flex;align-items:center;gap:10px">
              <span class="avatar ${avatarColors[idx % avatarColors.length]}">${x.iniciales || obtenerIniciales(x.nombre)}</span>
              <div>
                <b style="font-size:13px;display:block">${x.nombre}</b>
                <small class="muted" style="font-size:11px">${x.codigo}${x.novedad ? ` · ${x.novedad.tipo} (${x.novedad.min}m)` : ''}</small>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="color:var(--ok);font-weight:700">✓</span>
              <small class="muted">${x.hora || '08:02'}</small>
            </div>
          </div>
        `).join('');
      }
    };

    const refrescarDesdeServidorM02 = async () => {
      await syncSesionDesdeServidor();
      await syncExcusasDesdeServidor();
      actualizarBadgesExcusasDocente();
      pintarM02();
    };

    refrescarDesdeServidorM02();

    setInterval(pintarM02, 1000);
    if (isApiMode()) {
      setInterval(refrescarDesdeServidorM02, 1500);
    }

    if ($('#btn-modo-proyector')) {
      $('#btn-modo-proyector').addEventListener('click', () => {
        document.body.classList.toggle('projector-mode');
        const on = document.body.classList.contains('projector-mode');
        $('#btn-modo-proyector').textContent = on ? 'Salir modo proyector' : 'Modo proyector ›';
      });
    }

    if ($('#btn-simular-corte-red')) {
      const actualizarUiRed = () => {
        const caida = store.get('red_docente_caida', false);
        const alerta = $('#alerta-red-docente');
        if (caida) {
          if (alerta) {
            alerta.hidden = false;
            alerta.textContent = '⚠ Falla de conexión detectada en el aula: el último PIN dinámico queda retenido con vigencia extendida para permitir el marcado de los estudiantes, o utilice la Lista Manual de contingencia (RF-02 / M04 / DEF-02).';
          }
          $('#btn-simular-corte-red').textContent = 'Restablecer conexión de red';
        } else {
          if (alerta) alerta.hidden = true;
          $('#btn-simular-corte-red').textContent = 'Simular corte de conexión de red local';
        }
      };
      actualizarUiRed();

      $('#btn-simular-corte-red').addEventListener('click', async () => {
        const nuevoEstadoCaida = !store.get('red_docente_caida', false);
        store.set('red_docente_caida', nuevoEstadoCaida);
        if (isApiMode()) {
          await apiRequest('/api/sesion/red', 'POST', { redCaida: nuevoEstadoCaida });
          await syncSesionDesdeServidor();
        } else {
          if (nuevoEstadoCaida) {
            p.redCaida = true;
            p.exp = Date.now() + 3600000;
            store.set('pin', p);
          } else {
            p = nuevoPin();
          }
        }
        actualizarUiRed();
        pintarM02();
      });
    }

    if ($('#cerrar-sesion-asistencia')) {
      $('#cerrar-sesion-asistencia').addEventListener('click', async () => {
        if (!store.get('sesion_activa', true)) {
          alert('La sesión ya se encuentra cerrada.');
          return;
        }
        if (!confirm('¿Desea cerrar formalmente la sesión de asistencia? Los estudiantes sin registro pasarán automáticamente al estado «Ausente».')) return;
        await ejecutarCierreFormalSesion();
        await refrescarDesdeServidorM02();
      });
    }
  }

  async function ejecutarCierreFormalSesion() {
    if (isApiMode()) {
      const res = await apiRequest('/api/sesion/cerrar', 'POST', {});
      await syncSesionDesdeServidor();
      if (res && res.ok) return res.ausentesNuevos || 0;
    }

    const r = getRoster();
    let ausentesNuevos = 0;
    r.forEach(est => {
      if (est.estado === 'Sin registro') {
        est.estado = 'Ausente';
        est.hora = horaActual();
        est.medio = 'Cierre formal M04';
        ausentesNuevos++;
      }
    });
    setRoster(r);
    store.set('sesion_activa', false);
    registrarAuditoria('Cierre de sesión de asistencia (M04)', `Sesión cerrada. ${ausentesNuevos} estudiantes pasaron a Ausente.`, 'ABIERTA', 'CERRADA');
    return ausentesNuevos;
  }

  if ($('#tabla') && !$('#tabla-riesgo') && !$('#tabla-bitacora')) {
    const badgeMap = { 'Presente': 'b-ok', 'Ausente': 'b-bad', 'Sin registro': 'b-warn' };

    const pintarM04 = () => {
      const q = ($('#buscar').value || '').trim().toLowerCase();
      const r = getRoster().filter(x =>
        !q || x.nombre.toLowerCase().includes(q) || x.codigo.toLowerCase().includes(q)
      );

      const sesionActiva = store.get('sesion_activa', true);
      const banner = $('#banner-estado-m04');
      if (banner) {
        banner.className = 'banner ' + (sesionActiva ? 'ok' : '');
        banner.textContent = sesionActiva
          ? '✓ Sesión activa: registrando asistencia manual de contingencia en aula (M04 / RF-05).'
          : '■ Sesión CERRADA: cualquier cambio solicitará confirmación (DEF-13), quedará registrado en la bitácora inmutable (M08) y recalculará el historial del estudiante (DEF-11).';
      }

      const badgeHeader = $('#badge-estado-sesion');
      if (badgeHeader) {
        badgeHeader.className = 'live-pill' + (sesionActiva ? '' : ' closed');
        badgeHeader.textContent = sesionActiva ? '● EN VIVO' : '■ CERRADA';
      }

      $('#tabla').innerHTML = `
        <thead>
          <tr>
            <th>ESTUDIANTE</th>
            <th>CÓDIGO</th>
            <th>ESTADO</th>
            <th>REGISTRO / NOVEDAD</th>
            <th>ACCIÓN</th>
          </tr>
        </thead>
        <tbody>
          ${r.length ? r.map(x => `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:10px">
                  <span class="avatar">${x.iniciales || obtenerIniciales(x.nombre)}</span>
                  <b>${x.nombre}</b>
                </div>
              </td>
              <td><code>${x.codigo}</code></td>
              <td><span class="badge ${badgeMap[x.estado]}">${x.estado}</span></td>
              <td>
                <small class="muted">${x.hora || '—'}</small>
                ${x.novedad ? `<br><span class="badge b-warn" style="margin-top:2px">${x.novedad.tipo} (${x.novedad.min}m)</span>` : ''}
              </td>
              <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  <button class="btn act ${x.estado === 'Presente' ? 'ok' : 'neutral'} sm" type="button" data-n="${x.n}" data-e="Presente">✓ Presente</button>
                  <button class="btn act ${x.estado === 'Ausente' ? 'danger' : 'neutral'} sm" type="button" data-n="${x.n}" data-e="Ausente">Ausente</button>
                </div>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="5" style="text-align:center;padding:16px">No se encontraron estudiantes coincidentes.</td></tr>'}
        </tbody>
      `;

      const all = getRoster();
      const presCount = all.filter(x => x.estado === 'Presente').length;
      const ausCount = all.filter(x => x.estado === 'Ausente').length;
      const sinCount = all.filter(x => x.estado === 'Sin registro').length;
      $('#cnt').textContent = `Total en lista: ${all.length} · Presentes: ${presCount} · Ausentes: ${ausCount} · Sin registro: ${sinCount}`;
    };

    const cargarM04 = async () => {
      await syncSesionDesdeServidor();
      await syncExcusasDesdeServidor();
      actualizarBadgesExcusasDocente();
      pintarM04();
    };

    $('#buscar').addEventListener('input', pintarM04);

    $('#tabla').addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-n]');
      if (!b) return;
      const n = Number(b.dataset.n);
      const nuevoEstado = b.dataset.e;
      const r = getRoster();
      const est = r.find(x => x.n === n) || r[n - 1];
      if (!est) return;
      const anterior = est.estado;
      if (anterior === nuevoEstado) return;

      const sesionActiva = store.get('sesion_activa', true);
      if (!sesionActiva) {
        const okConfirm = confirm(
          `Confirmación de corrección en sesión cerrada (M08 / RF-13):\n\n` +
          `Estudiante: ${est.nombre} (${est.codigo})\n` +
          `Valor anterior: ${anterior}\n` +
          `Nuevo valor: ${nuevoEstado}\n\n` +
          `¿Confirma aplicar esta corrección y recalcular el historial del estudiante?`
        );
        if (!okConfirm) return;
      }

      if (isApiMode()) {
        await apiRequest('/api/asistencia/manual', 'POST', {
          nroLista: est.n,
          estudianteCodigo: est.codigo,
          nuevoEstado,
          confirmado: true
        });
        await cargarM04();
        return;
      }

      est.estado = nuevoEstado;
      est.hora = horaActual();
      est.medio = sesionActiva ? 'Manual contingencia (M04)' : 'Corrección posterior (M08)';
      setRoster(r);
      registrarAuditoria(
        sesionActiva ? 'Registro manual (M04)' : 'Corrección de registro (M08)',
        `Estudiante ${est.nombre} (${est.codigo}): ${anterior} -> ${nuevoEstado}`,
        anterior,
        nuevoEstado
      );
      pintarM04();
    });

    if ($('#btn-cierre-manual-pantalla')) {
      $('#btn-cierre-manual-pantalla').addEventListener('click', async () => {
        if (!store.get('sesion_activa', true)) {
          alert('La sesión ya se encuentra formalmente cerrada.');
          return;
        }
        const ausentesNuevos = await ejecutarCierreFormalSesion();
        pintarM04();
        alert(`Sesión formalmente cerrada (M04).\n${ausentesNuevos} estudiantes pasaron a estado Ausente.`);
      });
    }

    cargarM04();
    if (isApiMode()) setInterval(cargarM04, 2500);
  }

  if ($('#guardar-novedad') || ($('#guardar') && $('#min'))) {
    const btnGuardar = $('#guardar-novedad') || $('#guardar');
    let tipoNovedad = 'Llegada tarde';
    const selEst = $('#sel-estudiante');

    const poblarSelectNovedad = async () => {
      await syncSesionDesdeServidor();
      await syncExcusasDesdeServidor();
      actualizarBadgesExcusasDocente();
      if (selEst) {
        const r = getRoster();
        selEst.innerHTML = r.map(x =>
          `<option value="${x.n}">${x.nombre} · ${x.codigo} [${x.estado}]</option>`
        ).join('');
      }
    };
    poblarSelectNovedad();

    $$('#tipo-novedad-tabs span').forEach((sp) => {
      sp.addEventListener('click', () => {
        $$('#tipo-novedad-tabs span').forEach(s => s.classList.remove('on'));
        sp.classList.add('on');
        tipoNovedad = sp.textContent.trim();
        if ($('#lbl-minutos-novedad')) {
          $('#lbl-minutos-novedad').textContent = tipoNovedad.includes('Salida')
            ? 'Minutos de retiro anticipado (1 a 180 min)'
            : 'Minutos de retraso (1 a 180 min)';
        }
      });
    });

    btnGuardar.addEventListener('click', async () => {
      const rawVal = $('#min').value;
      const m = Number(rawVal);

      if (!rawVal || !Number.isInteger(m) || m < 1 || m > 180) {
        return msg($('#msg'), false, 'Rechazado (RF-10): Los minutos deben ser un número entero entre 1 y 180 minutos.');
      }

      const estNum = selEst ? Number(selEst.value) : 1;
      const nota = $('#nota') ? $('#nota').value.trim() : '';
      const r = getRoster();
      const estudiante = r.find(x => x.n === estNum) || r[estNum - 1];

      if (isApiMode()) {
        const res = await apiRequest('/api/novedades', 'POST', {
          nroLista: estNum,
          estudianteCodigo: estudiante ? estudiante.codigo : undefined,
          tipo: tipoNovedad,
          minutos: m,
          nota
        });
        if (res) {
          msg($('#msg'), Boolean(res.ok), res.msg);
          if (res.ok) setTimeout(() => { location.href = 'inicio.html'; }, 1000);
          return;
        }
      }

      if (!estudiante || estudiante.estado !== 'Presente') {
        return msg(
          $('#msg'),
          false,
          `Rechazado (RF-10): No es posible registrar «${tipoNovedad}» a ${estudiante ? estudiante.nombre : 'este estudiante'} porque su estado actual es «${estudiante ? estudiante.estado : 'Sin registro'}».`
        );
      }

      estudiante.novedad = { tipo: tipoNovedad, min: m, nota: nota || 'Sin observación adicional', hora: horaActual() };
      setRoster(r);
      registrarAuditoria('Registro de novedad (M07)', `${tipoNovedad} (${m}m) para ${estudiante.nombre}`, 'Presente', `Presente · ${tipoNovedad} (${m}m)`);
      msg($('#msg'), true, `Novedad «${tipoNovedad} (${m}m)» guardada exitosamente.`);
      setTimeout(() => { location.href = 'inicio.html'; }, 1000);
    });
  }

  if ($('#contenedor-excusas')) {
    const pintarExcusas = () => {
      const excusas = getExcusas();
      const cont = $('#contenedor-excusas');
      actualizarBadgesExcusasDocente();

      if (!excusas.length) {
        cont.innerHTML = '<p class="muted" style="text-align:center;padding:20px">No hay excusas radicadas.</p>';
        return;
      }

      const avatarColors = ['', 'blue', 'green', 'amber'];
      cont.innerHTML = excusas.map((exc, idx) => {
        const badgeClass = exc.estado === 'Aceptada' ? 'b-ok' : exc.estado === 'No Aprobada' ? 'b-bad' : 'b-warn';
        return `
          <div class="row" data-id="${exc.id}" style="padding:16px 0">
            <div style="display:flex;align-items:center;gap:12px;flex:1.4;min-width:220px">
              <span class="avatar ${avatarColors[idx % avatarColors.length]}">${obtenerIniciales(exc.estudiante)}</span>
              <div>
                <b style="font-size:14px">${exc.estudiante}</b> <small class="muted">(${exc.codigo})</small><br>
                <small class="muted">${exc.desc} · ${exc.fecha} · ${exc.asig}</small>
              </div>
            </div>

            <div style="display:flex;align-items:center;gap:12px;flex:1.1;min-width:210px;flex-wrap:wrap">
              <span class="badge ${badgeClass}">${exc.estado}</span>
              <div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:6px 10px;font-size:12px">
                <b>📄 ${exc.archivo || 'soporte.pdf'}</b><br>
                <small class="muted" style="font-size:10px">GCS Verificado</small>
              </div>
              <button type="button" class="btn neutral sm" data-preview="${exc.id}" style="width:auto;min-height:36px;color:var(--red);font-weight:700">Vista previa</button>
            </div>

            <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
              <button class="btn neutral sm" type="button" data-act="No Aprobada" ${exc.estado === 'No Aprobada' ? 'disabled' : ''} style="width:auto">Rechazar</button>
              <button class="btn sm" type="button" data-act="Aceptada" ${exc.estado === 'Aceptada' ? 'disabled' : ''} style="width:auto">✓ Aprobar</button>
            </div>
          </div>
        `;
      }).join('');
    };

    const cargarExcusas = async () => {
      await syncExcusasDesdeServidor();
      pintarExcusas();
    };

    $('#contenedor-excusas').addEventListener('click', async (e) => {
      const btnPrev = e.target.closest('button[data-preview]');
      if (btnPrev) {
        const id = Number(btnPrev.dataset.preview);
        const exc = getExcusas().find(x => x.id === id);
        if (exc && $('#modal-soporte')) {
          $('#modal-soporte-titulo').textContent = `${exc.archivo} · ${exc.estudiante}`;
          $('#modal-soporte-body').innerHTML = `
            <p style="margin:0 0 8px"><b>Contenedor C4:</b> Google Cloud Storage (<code>gs://uao-attendance-soportes-2026/${exc.archivo}</code>)</p>
            <p style="margin:0 0 8px"><b>Estudiante Titular:</b> ${exc.estudiante} (Código: <code>${exc.codigo}</code>)</p>
            <p style="margin:0 0 8px"><b>Asignatura y Fecha de Ausencia:</b> ${exc.asig} · <code>${exc.fecha}</code></p>
            <p style="margin:0 0 8px"><b>Motivo Declarado:</b> "${exc.desc}"</p>
            <p style="margin:0;color:var(--ok);font-weight:600">✓ Documento digital íntegro y verificado (≤ 10 MB)</p>
          `;
          if ($('#modal-soporte-descargar')) {
            $('#modal-soporte-descargar').href = exc.archivoUrl || `/api/soportes/${encodeURIComponent(exc.archivo)}`;
          }
          $('#modal-soporte').hidden = false;
        }
        return;
      }

      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const fila = btn.closest('.row');
      const id = Number(fila.dataset.id);
      const nuevoEstado = btn.dataset.act;

      if (isApiMode()) {
        const res = await apiRequest(`/api/excusas/${id}/dictamen`, 'POST', { estado: nuevoEstado });
        if (res && res.ok) {
          const matEst = (res.historialEstudiante && res.historialEstudiante.materias || [])[0];
          if ($('#msg-excusas')) {
            msg(
              $('#msg-excusas'),
              true,
              `Dictamen «${nuevoEstado}» guardado en SQLite para ${res.estudianteNombre} (${res.estudianteCodigo}). Historial individual actualizado: ${matEst ? matEst.aus : 0} falla(s) no just. y ${matEst ? matEst.just : 0} justificada(s).`
            );
          }
          await cargarExcusas();
          return;
        }
      }

      const exc = dictaminarExcusa(id, nuevoEstado);
      if (exc) {
        if ($('#msg-excusas')) {
          msg($('#msg-excusas'), true, `Dictamen «${nuevoEstado}» aplicado a ${exc.estudiante} (${exc.codigo}).`);
        }
        pintarExcusas();
      }
    });

    const cerrarModal = () => { if ($('#modal-soporte')) $('#modal-soporte').hidden = true; };
    if ($('#cerrar-modal-soporte')) $('#cerrar-modal-soporte').addEventListener('click', cerrarModal);
    if ($('#ok-modal-soporte')) $('#ok-modal-soporte').addEventListener('click', cerrarModal);

    cargarExcusas();
    if (isApiMode()) setInterval(cargarExcusas, 2500);
  }

  if ($('#tabla-bitacora')) {
    const pintarBitacora = async () => {
      let bitacora = getBitacora();
      if (isApiMode()) {
        const res = await apiRequest('/api/bitacora', 'GET');
        if (res && res.ok && Array.isArray(res.bitacora)) {
          bitacora = res.bitacora;
          store.set('bitacora', bitacora);
        }
      }
      await syncExcusasDesdeServidor();
      actualizarBadgesExcusasDocente();

      const cuerpo = $('#cuerpo-bitacora');
      if (!cuerpo) return;

      cuerpo.innerHTML = bitacora.map(ev => `
        <tr>
          <td><small><code>${ev.fecha}</code></small></td>
          <td><b>${ev.autor}</b></td>
          <td><span class="badge b-ok">${ev.accion}</span></td>
          <td><small><code>${ev.valorAnterior || '—'} → ${ev.valorNuevo || '—'}</code></small></td>
          <td>${ev.detalle}</td>
        </tr>
      `).join('');
    };

    pintarBitacora();
    if (isApiMode()) setInterval(pintarBitacora, 2500);
  }

  if ($('#confirmar') || $('#simqr') || $('#sim-no-matriculado')) {
    const tabsModo = $$('#tabs-modo span');
    const secQr = $('#sec-qr');
    const secPin = $('#sec-pin');

    if (tabsModo.length && secQr && secPin) {
      tabsModo.forEach((t, i) => {
        t.addEventListener('click', () => {
          tabsModo.forEach(x => x.classList.remove('on'));
          t.classList.add('on');
          if (i === 0) {
            secQr.style.display = 'none';
            secPin.style.display = 'block';
          } else {
            secQr.style.display = 'block';
            secPin.style.display = 'none';
          }
        });
      });
    }

    const ds = $$('.pind');
    ds.forEach((d, i) => {
      d.addEventListener('input', () => {
        d.value = d.value.replace(/\D/g, '');
        if (d.value && ds[i + 1]) ds[i + 1].focus();
      });
      d.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !d.value && ds[i - 1]) ds[i - 1].focus();
      });
    });

    if ($('#btn-autollenar-pin')) {
      $('#btn-autollenar-pin').addEventListener('click', async () => {
        await syncSesionDesdeServidor();
        const p = getPin();
        p.code.split('').forEach((dig, i) => {
          if (ds[i]) ds[i].value = dig;
        });
      });
    }

    const procesarMarcado = async (modo, pinIngresado) => {
      const estCod = getEstudianteActivoCodigo();

      if (isApiMode()) {
        const res = await apiRequest('/api/asistencia/marcar', 'POST', {
          estudianteCodigo: estCod,
          pin: pinIngresado,
          modo: modo === 'QR' ? 'QR' : 'PIN'
        });
        if (res) {
          msg($('#msg'), Boolean(res.ok), res.msg);
          if (res.ok) {
            await syncSesionDesdeServidor();
            setTimeout(() => { location.href = 'inicio.html'; }, 1200);
          }
          return;
        }
      }

      const v = validarPin(pinIngresado);
      if (!v.ok) return msg($('#msg'), false, v.msg);
      const resRegistro = marcarAsistenciaEstudiante(modo === 'QR' ? 'Escaneo QR móvil (M03)' : 'PIN de aula (M03)', estCod);
      msg($('#msg'), resRegistro.ok, resRegistro.msg);
      if (resRegistro.ok) setTimeout(() => { location.href = 'inicio.html'; }, 1200);
    };

    if ($('#confirmar')) {
      $('#confirmar').addEventListener('click', () => {
        const pinIngresado = ds.map(d => d.value).join('');
        procesarMarcado('PIN', pinIngresado);
      });
    }

    if ($('#simqr')) {
      $('#simqr').addEventListener('click', async () => {
        await syncSesionDesdeServidor();
        const p = getPin();
        procesarMarcado('QR', p.code);
      });
    }

    if ($('#sim-no-matriculado')) {
      $('#sim-no-matriculado').addEventListener('click', async () => {
        if (isApiMode()) {
          await syncSesionDesdeServidor();
          const p = getPin();
          const res = await apiRequest('/api/asistencia/marcar', 'POST', {
            estudianteCodigo: '2249999',
            pin: p.code,
            modo: 'PIN'
          });
          if (res) return msg($('#msg'), false, res.msg);
        }
        msg($('#msg'), false, 'Error RF-11: Estudiante no matriculado en este grupo académico (ISW1-G01). Registro rechazado.');
      });
    }
  }

  let directorioEstudiantes = {
    '2248332': { nombre: 'Juan Sebastián Marín', saludo: 'Hola, Juan Sebastián', iniciales: 'JM' },
    '2245006': { nombre: 'Andrés Felipe Morales', saludo: 'Hola, Andrés Felipe', iniciales: 'AM' },
    '2248910': { nombre: 'Mariana López', saludo: 'Hola, Mariana', iniciales: 'ML' },
    '2245009': { nombre: 'Sara Sofía Castillo', saludo: 'Hola, Sara Sofía', iniciales: 'SC' }
  };

  async function poblarSelectorEstudiantesDesdeDB() {
    const sel = $('#switch-estudiante-activo');
    if (!sel || !isApiMode()) return;
    const res = await apiRequest('/api/usuarios?rol=estudiante', 'GET');
    if (res && res.ok && Array.isArray(res.usuarios)) {
      res.usuarios.forEach(u => {
        directorioEstudiantes[u.codigo] = {
          nombre: u.nombre,
          saludo: `Hola, ${u.nombre.split(' ')[0]}`,
          iniciales: u.iniciales || obtenerIniciales(u.nombre)
        };
      });
      const current = getEstudianteActivoCodigo();
      sel.innerHTML = res.usuarios.map(u =>
        `<option value="${u.codigo}" ${u.codigo === current ? 'selected' : ''}>${u.nombre} (${u.codigo})</option>`
      ).join('');
    }
  }

  function actualizarHeaderEstudiante(pctForzado = null) {
    const cod = getEstudianteActivoCodigo();
    const info = directorioEstudiantes[cod] || {
      nombre: store.get('estudiante_activo_nombre', `Estudiante ${cod}`),
      saludo: `Hola, ${(store.get('estudiante_activo_nombre', 'Estudiante')).split(' ')[0]}`,
      iniciales: obtenerIniciales(store.get('estudiante_activo_nombre', 'ES'))
    };
    const pctGlobal = pctForzado !== null ? pctForzado : calcularAsistenciaGeneralEstudiante(cod);

    if ($('#switch-estudiante-activo')) $('#switch-estudiante-activo').value = cod;
    if ($('#est-avatar-top')) $('#est-avatar-top').textContent = info.iniciales;
    if ($('#est-nombre-top')) $('#est-nombre-top').textContent = info.nombre;
    if ($('#est-cod-top')) $('#est-cod-top').textContent = `Estudiante · ${cod}`;
    if ($('#saludo-estudiante')) $('#saludo-estudiante').textContent = info.saludo;
    if ($('#estado-general-pct')) $('#estado-general-pct').textContent = `${pctGlobal}%`;
    if ($('#estado-general-texto')) $('#estado-general-texto').textContent = `${pctGlobal}%`;
  }

  if ($('#switch-estudiante-activo')) {
    $('#switch-estudiante-activo').addEventListener('change', (e) => {
      setEstudianteActivoCodigo(e.target.value);
      location.reload();
    });
  }
  poblarSelectorEstudiantesDesdeDB().then(() => actualizarHeaderEstudiante());

  if ($('#subjects')) {
    const pintarEstudianteInicio = (pctForzado = null) => {
      const cod = getEstudianteActivoCodigo();
      const s = getMateriasEstudiante(cod);
      actualizarHeaderEstudiante(pctForzado);

      const badgeColors = {
        isw1: 'background:var(--red-soft);color:var(--red)',
        bd2: 'background:var(--blue-bg);color:var(--blue)',
        md: 'background:var(--warnbg);color:var(--warn)'
      };

      $('#subjects').innerHTML = s.map((m, i) => {
        const f = calcFallas(m.aus, m.tot);
        const c = f.nivel === 'rojo' ? 'var(--bad)' : f.nivel === 'ambar' ? 'var(--warn-bright)' : 'var(--ok-bright)';
        const asistPct = (100 - f.pct).toFixed(1).replace(/\.0$/, '');

        return `
          <div class="card subj" style="display:flex;flex-direction:column;justify-content:space-between">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
                <div style="display:flex;align-items:center;gap:10px">
                  <span class="avatar" style="${badgeColors[m.id] || ''}">${m.codigoCorto || 'UAO'}</span>
                  <div>
                    <b style="font-size:14px;display:block">${m.n}</b>
                    <small class="muted" style="font-size:11px">${m.docente || 'Docente UAO'}</small>
                  </div>
                </div>
                <a href="historial.html?asig=${m.id}" class="muted" title="Ver historial de ${m.n}">›</a>
              </div>

              <div style="display:flex;align-items:center;gap:10px;margin-top:12px">
                <div class="bar" style="flex:1;margin:0"><i style="width:${asistPct}%;background:${c}"></i></div>
                <b style="font-size:12px;color:${c}">${asistPct}%</b>
              </div>

              <small class="muted" style="display:block;margin-top:8px;font-size:12px">
                ${m.aus} inasistencia(s) · ${m.tot} sesiones (${m.just || 0} justificada(s)) · ${f.pct}% fallas
              </small>
            </div>

            <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">
              <a class="btn neutral sm link" href="historial.html?asig=${m.id}" style="flex:1">Ver detalle</a>
              <button class="btn sec dem sm" type="button" data-i="${i}" style="flex:1">+ Simular falla</button>
            </div>
          </div>
        `;
      }).join('');

      const peor = s.map(m => ({ m, f: calcFallas(m.aus, m.tot) })).sort((a, b) => b.f.pct - a.f.pct)[0];
      const alertaEl = $('#alerta');
      if (alertaEl && peor) {
        if (peor.f.nivel === 'rojo') {
          alertaEl.innerHTML = `
            <div class="banner bad">
              ✕ <b>Riesgo crítico de pérdida en ${peor.m.n} (M05 · RF-09)</b><br>
              Tienes <b>${peor.f.pct}%</b> de inasistencias (${peor.m.aus} de ${peor.m.tot} sesiones). Has superado el límite máximo permitido del 20% (${peor.f.maxPermitidas} fallas). Conforme al Reglamento Estudiantil UAO, conlleva reprobación con nota 1,5.
              <div style="margin-top:6px"><a href="historial.html?asig=${peor.m.id}" style="font-weight:700;text-decoration:underline">Ver detalle ›</a></div>
            </div>`;
        } else if (peor.f.nivel === 'ambar') {
          const msgLimite = peor.f.faltasRestantesPermitidas === 0
            ? `Has alcanzado el tope máximo permitido (${peor.f.maxPermitidas} fallas ≤ 20%): estás a <b>${peor.f.faltasParaSuperar20} inasistencia(s)</b> de superar el límite de pérdida del 20% (la próxima falla supera el 20%).`
            : `Te queda(n) <b>${peor.f.faltasRestantesPermitidas} inasistencia(s)</b> dentro del límite permitido y estás a <b>${peor.f.faltasParaSuperar20} inasistencia(s)</b> de superar el 20%.`;

          alertaEl.innerHTML = `
            <div class="banner">
              ⚠️ <b>Atención a ${peor.m.n} (Alerta preventiva 15% · RF-09)</b><br>
              Tienes <b>${peor.f.pct}%</b> de inasistencias (${peor.m.aus} de ${peor.m.tot} sesiones). El límite de pérdida es 20%. ${msgLimite}
              <div style="margin-top:6px"><a href="historial.html?asig=${peor.m.id}" style="font-weight:700;color:var(--warn)">Ver detalle ›</a></div>
            </div>`;
        } else {
          alertaEl.innerHTML = `
            <div class="banner ok">
              ✓ <b>Estado académico al día.</b> Todas tus asignaturas se encuentran por debajo del umbral preventivo del 15% de inasistencias.
            </div>`;
        }
      }
    };

    const cargarEstudianteInicio = async () => {
      const cod = getEstudianteActivoCodigo();
      const apiHist = await syncHistorialDesdeServidor(cod);
      pintarEstudianteInicio(apiHist ? apiHist.asistenciaGeneralPct : null);
    };

    $('#subjects').addEventListener('click', (e) => {
      const b = e.target.closest('.dem');
      if (!b) return;
      const cod = getEstudianteActivoCodigo();
      const s = getMateriasEstudiante(cod);
      s[+b.dataset.i].aus++;
      s[+b.dataset.i].tot++;
      setMateriasEstudiante(cod, s);
      pintarEstudianteInicio();
    });

    cargarEstudianteInicio();
    if (isApiMode()) setInterval(cargarEstudianteInicio, 3000);
  }

  if ($('#contenedor-historial')) {
    const params = new URLSearchParams(location.search);
    let asigSeleccionada = params.get('asig') || store.get('historial_asig_activa', 'isw1');

    const pintarHistorial = (pctForzado = null) => {
      const cod = getEstudianteActivoCodigo();
      const mats = getMateriasEstudiante(cod);
      const mat = mats.find(m => m.id === asigSeleccionada) || mats[0];
      asigSeleccionada = mat.id;
      store.set('historial_asig_activa', asigSeleccionada);

      if ($('#sel-asignatura-historial')) $('#sel-asignatura-historial').value = asigSeleccionada;
      $$('#tabs-asignatura-historial span').forEach(sp => {
        sp.classList.toggle('on', sp.dataset.asig === asigSeleccionada);
      });

      actualizarHeaderEstudiante(pctForzado);

      const f = calcFallas(mat.aus, mat.tot);
      const asistPct = (100 - f.pct).toFixed(1).replace(/\.0$/, '');
      const presentesCount = Math.max(0, mat.tot - mat.aus - (mat.just || 0));

      const resumenEl = $('#historial-resumen');
      if (resumenEl) {
        resumenEl.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
            <div>
              <span class="date-eyebrow" style="margin-bottom:2px">DETALLE DE ASISTENCIA</span>
              <b style="font-size:20px;display:block">${mat.n}</b>
              <small class="muted">Grupo 01 · 2026-1 · Docente: ${mat.docente || 'Docente UAO'}</small>
            </div>
            <div style="text-align:right">
              <b style="font-size:26px;color:${f.nivel === 'rojo' ? 'var(--bad)' : f.nivel === 'ambar' ? 'var(--warn)' : 'var(--ok)'}">${asistPct}%</b>
              <small class="muted" style="display:block;font-size:11px">Asistencia (${f.pct}% fallas)</small>
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
            <span class="badge b-ok">${presentesCount} presentes</span>
            <span class="badge ${mat.aus > 0 ? 'b-bad' : 'b-ok'}">${mat.aus} ausencia(s) no just.</span>
            <span class="badge b-warn">${mat.just || 0} justificada(s)</span>
            <span class="badge" style="background:#F1F5F9;color:var(--text)">${mat.tot} sesiones totales</span>
          </div>
        `;
      }

      const listaEl = $('#historial-lista');
      if (listaEl) {
        const excusasEst = getExcusas().filter(x => x.codigo === cod && (x.asig.toLowerCase() === mat.n.toLowerCase() || x.asigId === mat.id));
        const sesiones = Array.isArray(mat.sesiones) ? mat.sesiones : [];

        listaEl.innerHTML = sesiones.map(ses => {
          const exc = excusasEst.find(e => e.fecha === ses.fecha);
          let estadoLabel = ses.estado;
          let badgeCls = ses.estado === 'Presente' ? 'b-ok' : ses.estado === 'Ausencia Justificada' ? 'b-ok' : 'b-bad';
          let detalle = ses.det;

          if (exc) {
            detalle = `Excusa radicada (${exc.estado}) · ${exc.archivo}`;
            if (exc.estado === 'Aceptada') {
              estadoLabel = 'Ausencia Justificada';
              badgeCls = 'b-ok';
            } else if (exc.estado === 'No Aprobada') {
              estadoLabel = 'Ausente (Excusa no aprobada)';
              badgeCls = 'b-bad';
            } else {
              estadoLabel = 'Ausente (Excusa pendiente)';
              badgeCls = 'b-warn';
            }
          }

          return `
            <div class="row">
              <div style="display:flex;align-items:center;gap:12px">
                <span class="stat-icon" style="background:${badgeCls === 'b-ok' ? 'var(--ok-bg);color:var(--ok)' : badgeCls === 'b-warn' ? 'var(--warnbg);color:var(--warn)' : 'var(--bad-bg);color:var(--bad)'}">
                  ${badgeCls === 'b-ok' ? '✓' : '✕'}
                </span>
                <div>
                  <b>${ses.labelFecha || ses.fecha}</b> <small class="muted">(${ses.fecha})</small><br>
                  <small class="muted">${detalle}</small>
                </div>
              </div>
              <span class="badge ${badgeCls}">${estadoLabel}</span>
            </div>
          `;
        }).join('');
      }
    };

    const cargarHistorial = async () => {
      const cod = getEstudianteActivoCodigo();
      const apiHist = await syncHistorialDesdeServidor(cod);
      await syncExcusasDesdeServidor();
      pintarHistorial(apiHist ? apiHist.asistenciaGeneralPct : null);
    };

    if ($('#sel-asignatura-historial')) {
      $('#sel-asignatura-historial').addEventListener('change', (e) => {
        asigSeleccionada = e.target.value;
        pintarHistorial();
      });
    }

    $$('#tabs-asignatura-historial span').forEach(sp => {
      sp.addEventListener('click', () => {
        asigSeleccionada = sp.dataset.asig;
        pintarHistorial();
      });
    });

    cargarHistorial();
    if (isApiMode()) setInterval(cargarHistorial, 3000);
  }

  if ($('#enviar-excusa') || ($('#enviar') && $('#archivo'))) {
    const btnEnviar = $('#enviar-excusa') || $('#enviar');

    const actualizarFechasValidasHint = () => {
      const cod = getEstudianteActivoCodigo();
      const mats = getMateriasEstudiante(cod);
      const asigVal = $('#asig') ? $('#asig').value : 'Ingeniería de Software I';
      const mat = mats.find(m => m.n.toLowerCase() === asigVal.toLowerCase()) || mats[0];
      const fechas = (mat && mat.fechasFallas && mat.fechasFallas.length) ? mat.fechasFallas : ['2026-10-25'];
      if ($('#lista-fechas-validas')) $('#lista-fechas-validas').textContent = fechas.join(', ');
      if ($('#fecha') && fechas[0]) $('#fecha').value = fechas[0];
    };

    syncHistorialDesdeServidor().then(actualizarFechasValidasHint);
    if ($('#asig')) $('#asig').addEventListener('change', actualizarFechasValidasHint);

    const leerBase64Archivo = (file) => new Promise((resolve) => {
      if (!file || typeof FileReader === 'undefined') return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });

    btnEnviar.addEventListener('click', async () => {
      const cod = getEstudianteActivoCodigo();
      const infoEst = directorioEstudiantes[cod] || { nombre: `Estudiante ${cod}` };
      const datos = {
        asig: $('#asig').value,
        fecha: $('#fecha').value,
        desc: $('#desc').value,
        file: $('#archivo').files[0]
      };

      const errores = validarExcusa(datos, cod);
      if (errores.length) {
        const m = $('#msg');
        m.hidden = false;
        m.className = 'banner bad';
        m.innerHTML = errores.map(x => '✕ ' + x).join('<br>');
        return;
      }

      const base64Data = await leerBase64Archivo(datos.file);

      if (isApiMode()) {
        const res = await apiRequest('/api/excusas', 'POST', {
          estudianteCodigo: cod,
          estudianteNombre: infoEst.nombre,
          asignaturaNombre: datos.asig,
          fecha: datos.fecha,
          desc: datos.desc.trim(),
          fileName: datos.file.name,
          fileSize: datos.file.size,
          base64Data
        });
        if (res) {
          if (!res.ok) {
            return msg($('#msg'), false, res.msg || 'Error al radicar la excusa.');
          }
          msg($('#msg'), true, 'Excusa radicada en SQLite y soporte almacenado en Google Cloud Storage.');
          setTimeout(() => { location.href = 'historial.html'; }, 1200);
          return;
        }
      }

      const lista = getExcusas();
      lista.unshift({
        id: Date.now(),
        estudiante: infoEst.nombre,
        codigo: cod,
        asigId: 'isw1',
        asig: datos.asig,
        fecha: datos.fecha,
        desc: datos.desc.trim(),
        archivo: datos.file.name,
        estado: 'Pendiente'
      });
      store.set('excusas', lista);
      msg($('#msg'), true, 'Excusa radicada exitosamente con estado PENDIENTE (M06).');
      setTimeout(() => { location.href = 'historial.html'; }, 1200);
    });
  }

  if ($('#exportar-csv') || $('#btn-pdf')) {
    let ultimoReporteActual = null;

    const pintarVistaDirectorM09 = async () => {
      const fac = $('#filtro-facultad') ? $('#filtro-facultad').value : 'todas';
      const perRaw = $('#filtro-periodo') ? $('#filtro-periodo').value : '2026-1';
      const per = perRaw.replace(/\s*\(Actual\)/i, '').trim();
      const asigKey = $('#filtro-asignatura') ? $('#filtro-asignatura').value : 'isw1';
      const asigText = $('#filtro-asignatura') ? $('#filtro-asignatura').options[$('#filtro-asignatura').selectedIndex].text : MATERIA_ACTIVA;
      const grpRaw = $('#filtro-grupo') ? $('#filtro-grupo').value : 'G01';
      const grpLabel = grpRaw.toLowerCase() === 'todos' ? 'Todos los grupos' : grpRaw.toUpperCase();

      let rep = null;
      if (isApiMode()) {
        rep = await apiRequest(
          `/api/reportes?periodo=${encodeURIComponent(per)}&facultad=${encodeURIComponent(fac)}&asignatura=${encodeURIComponent(asigKey)}&grupo=${encodeURIComponent(grpRaw)}`,
          'GET'
        );
      }

      if (!rep) {
        const sinDatos = per === '2025-3' || grpRaw.toUpperCase() === 'G02';
        const filas = sinDatos ? [] : getRoster().map(r => ({
          n: r.n, nombre: r.nombre, codigo: r.codigo, asignatura: asigText, grupo: 'G01',
          estado: r.estado, medio: r.medio || 'N/A', novedad: r.novedad ? `${r.novedad.tipo} (${r.novedad.min} min)` : 'Ninguna', hora: r.hora || ''
        }));
        rep = {
          sinDatos,
          periodo: per,
          asignatura: asigKey,
          grupoLabel: grpLabel,
          filas,
          kpis: {
            estudiantesActivos: sinDatos ? 0 : (asigKey === 'todas' ? 3606 : filas.length),
            ausentismoGeneral: sinDatos ? 0 : 8.9,
            estudiantesEnRiesgo: sinDatos ? 0 : 184,
            excusasPendientes: sinDatos ? 0 : 47
          }
        };
      }

      ultimoReporteActual = { ...rep, asigText, grpRaw };

      if ($('#kpi-activos')) $('#kpi-activos').textContent = String(rep.kpis.estudiantesActivos);
      if ($('#kpi-ausentismo')) $('#kpi-ausentismo').textContent = String(rep.kpis.ausentismoGeneral).replace('.', ',') + '%';
      if ($('#kpi-riesgo')) $('#kpi-riesgo').textContent = String(rep.kpis.estudiantesEnRiesgo);
      if ($('#kpi-excusas')) $('#kpi-excusas').textContent = String(rep.kpis.excusasPendientes);

      const msgEl = $('#msg-reporte');
      if (rep.sinDatos) {
        if (msgEl) msg(msgEl, false, `Sin datos para los filtros seleccionados (Periodo: ${per}, Asignatura: ${asigText}, Grupo: ${grpLabel}).`);
      } else if (msgEl) {
        msgEl.hidden = true;
      }

      if ($('#titulo-tabla-filtrada')) {
        $('#titulo-tabla-filtrada').textContent = `Registros filtrados: ${asigText} · ${grpLabel} (${per})`;
      }

      const tablaPrev = $('#tabla-reporte-preview');
      if (tablaPrev) {
        if (rep.sinDatos || !rep.filas.length) {
          tablaPrev.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--muted)">No existen registros de asistencia para el periodo ${per} y grupo ${grpLabel}.</td></tr>`;
        } else {
          tablaPrev.innerHTML = `
            <thead>
              <tr>
                <th>#</th>
                <th>ESTUDIANTE</th>
                <th>CÓDIGO</th>
                <th>ASIGNATURA</th>
                <th>GRUPO</th>
                <th>ESTADO</th>
              </tr>
            </thead>
            <tbody>
              ${rep.filas.slice(0, 10).map(f => `
                <tr>
                  <td>${f.n}</td>
                  <td><b>${f.nombre}</b></td>
                  <td><code>${f.codigo}</code></td>
                  <td>${f.asignatura}</td>
                  <td>${f.grupo}</td>
                  <td><span class="badge ${f.estado === 'Presente' ? 'b-ok' : f.estado === 'Ausente' ? 'b-bad' : 'b-warn'}">${f.estado}</span></td>
                </tr>
              `).join('')}
            </tbody>
          `;
        }
      }
    };

    ['#filtro-facultad', '#filtro-periodo', '#filtro-asignatura', '#filtro-grupo'].forEach(sel => {
      if ($(sel)) $(sel).addEventListener('change', pintarVistaDirectorM09);
    });
    pintarVistaDirectorM09();

    if ($('#exportar-csv')) {
      $('#exportar-csv').addEventListener('click', async (e) => {
        e.preventDefault();
        await pintarVistaDirectorM09();
        const rep = ultimoReporteActual;
        if (!rep || rep.sinDatos || !rep.filas.length) {
          msg($('#msg-reporte'), false, 'No hay datos para exportar con el filtro seleccionado.');
          return;
        }

        let csvContent = '\uFEFF';
        csvContent += `Reporte Oficial de Ausentismo UAO - Periodo: ${rep.periodo}\n`;
        csvContent += `Asignatura: ${rep.asigText} - Grupo: ${rep.grupoLabel}\n`;
        csvContent += `Fecha de Generacion: ${fechaActual()} ${horaActual()}\n\n`;
        csvContent += 'Nro,Estudiante,Codigo,Asignatura,Grupo,Estado,Medio,Novedad,FechaHora\n';

        rep.filas.forEach(x => {
          const colGrupo = rep.grpRaw.toLowerCase() === 'todos' ? 'Todos los grupos' : x.grupo;
          csvContent += `"${x.n}","${x.nombre}","${x.codigo}","${x.asignatura}","${colGrupo}","${x.estado}","${x.medio}","${x.novedad}","${fechaActual()} ${x.hora}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `UAO_Reporte_Ausentismo_${rep.periodo}_${rep.asignatura}_${rep.grpRaw.toUpperCase()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    if ($('#btn-pdf')) {
      $('#btn-pdf').addEventListener('click', (e) => {
        e.preventDefault();
        window.print();
      });
    }
  }

  if ($('#tabla-riesgo')) {
    const pintarRiesgo = async () => {
      let dataRiesgo = null;
      if (isApiMode()) {
        const res = await apiRequest('/api/riesgo', 'GET');
        if (res && res.ok && Array.isArray(res.estudiantes)) {
          const colors = ['blue', 'amber', 'purple', 'green', ''];
          dataRiesgo = res.estudiantes.map((e, i) => ({
            ini: e.iniciales || obtenerIniciales(e.nombre),
            color: colors[i % colors.length],
            nombre: e.nombre,
            cod: e.codigo,
            prog: e.programa,
            asig: e.asignatura,
            fallas: e.fallas,
            tot: e.tot,
            pct: e.pct,
            nivel: e.nivel,
            clase: e.clase
          }));
        }
      }

      if (!dataRiesgo || !dataRiesgo.length) {
        dataRiesgo = [
          { ini: 'JM', color: '', nombre: 'Juan Sebastián Marín Restrepo', cod: '2248332', prog: 'Ing. Software', asig: 'Matemáticas Discretas', fallas: 3, tot: 19, pct: 15.8, nivel: 'Preventivo', clase: 'b-warn' }
        ];
      }

      $('#tabla-riesgo').innerHTML = `
        <thead>
          <tr>
            <th>ESTUDIANTE</th>
            <th>PROGRAMA</th>
            <th>ASIGNATURA EN RIESGO</th>
            <th>AUSENCIAS</th>
            <th>NIVEL</th>
          </tr>
        </thead>
        <tbody>
          ${dataRiesgo.map(x => `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:10px">
                  <span class="avatar ${x.color}">${x.ini}</span>
                  <div>
                    <b>${x.nombre}</b><br>
                    <small class="muted"><code>${x.cod}</code></small>
                  </div>
                </div>
              </td>
              <td>${x.prog}</td>
              <td>${x.asig}</td>
              <td><b>${x.pct.toFixed(1)}%</b> <small class="muted">(${x.fallas}/${x.tot})</small></td>
              <td><span class="badge ${x.clase}">${x.nivel}</span></td>
            </tr>
          `).join('')}
        </tbody>
      `;
    };

    pintarRiesgo();
    if (isApiMode()) setInterval(pintarRiesgo, 3000);
  }

})();
