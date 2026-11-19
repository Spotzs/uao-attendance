# UNIVERSIDAD AUTÓNOMA DE OCCIDENTE
## FACULTAD DE INGENIERÍA Y CIENCIAS BÁSICAS
### DEPARTAMENTO DE OPERACIONES Y SISTEMAS
### PROGRAMA DE INGENIERÍA DE SOFTWARE / INGENIERÍA INFORMÁTICA
### ASIGNATURA: INGENIERÍA DE SOFTWARE I

---

# SISTEMA DE CONTROL DE ASISTENCIA CON REGISTRO MÚLTIPLE Y PORTAL DOCENTE (UAO ATTENDANCE)

## INFORME DE PROYECTO — CAPÍTULO 4: VERIFICACIÓN DEL SOFTWARE
### 4.2 INFORME DE PRUEBAS DE VERIFICACIÓN FUNCIONAL (CICLO 2 · REGRESIÓN Y CIERRE)
**Versión 1.2.0**

---

### PRESENTADO POR:
- **Iván Agudelo del Río** — Código: 2248334
- **Nicolás Castaño Polanco** — Código: 2245043
- **Juan Pablo Domínguez Flores** — Código: 2247823
- **Juan Sebastián Marín Restrepo** — Código: 2248332
- **Juan Pablo Plaza Mazo** — Código: 2245746

### PRESENTADO A:
- **Docente:** Sandra Lucía Guañarita Fernández

**SANTIAGO DE CALI, COLOMBIA**  
**NOVIEMBRE DE 2026**

---

## 1. ARQUITECTURA DE CONTENEDORES IMPLEMENTADA (MODELO C4 · NIVEL 2)

En cumplimiento del **Diagrama de Contenedores (Modelo C4, Nivel 2)** definido en la Entrega 4, la solución se estructura en cuatro contenedores integrados más los adaptadores hacia los dos sistemas externos institucionales:

1. **Aplicación Web Responsiva (`uao/` · HTML5, CSS3, JavaScript):**  
   Interfaz única para docente, estudiante y director de programa, fiel a los mockups de alta fidelidad diseñados en **Figma** (Entrega 6), ejecutable en navegador de escritorio, proyector de aula y smartphones (Android/iOS, `390 px` sin desbordamiento horizontal).
2. **Aplicación API Backend (`backend/server.js` · Node.js / Express):**  
   Expone los servicios REST (`/api/auth/login`, `/api/sesion`, `/api/asistencia/marcar`, `/api/asistencia/manual`, `/api/novedades`, `/api/historial/:codigo`, `/api/excusas`, `/api/soportes`, `/api/bitacora`, `/api/reportes`).
3. **Base de Datos Relacional (`database/schema.sql` & `backend/db.js` · SQL / SQLite):**  
   Almacena usuarios, asignaturas, matrículas, sesiones, registros de asistencia, historial individual por estudiante, excusas y bitácora de auditoría protegida con un `TRIGGER` SQL de inmutabilidad (`trg_bitacora_no_update`).
4. **Almacenamiento de Soportes (`backend/storage.js` · Google Cloud Storage `gs://uao-attendance-soportes-2026`):**  
   Valida y conserva los archivos PDF, JPG y PNG de hasta 10 MB asociados a las excusas digitales (`storage/gcs-bucket-uao-soportes/`).
5. **Sistemas Externos (`backend/external_services.js`):**  
   - **SSO Institucional UAO:** Valida credenciales institucionales (`@uao.edu.co`) y gestiona contingencias HTTP 503.
   - **Portal UAO / Registro Académico:** Valida matrículas por asignatura y grupo (RF-11) y recibe el consolidado de asistencia.

---

## 2. MATRIZ DE EJECUCIÓN DE CASOS DE PRUEBA (CP-01 A CP-19 · CICLO 2)

Tras corregir los **10 casos rechazados** y los **17 defectos (DEF-01 a DEF-17)** reportados en el Ciclo 1 de la Entrega 8, se ejecutó la regresión completa sobre los **19 casos de prueba del plan**:

| Caso | Módulo / Requisito | Resultado Esperado | Resultado Obtenido en Regresión (Ciclo 2) | Estado | Defectos Cerrados |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **CP-01** | M01 · RF-01 | Cada rol accede a su portal con credenciales válidas. | Los 3 roles acceden a su portal en `< 120 ms`. | **Aprobado** | — |
| **CP-02** | M01 · RF-01 | El sistema rechaza credenciales inválidas y muestra error. | Con `usuario.invalido@externo.com` y `clave_falsa` el botón «Ingresar» rechaza el acceso y muestra el banner de error. | **Aprobado** | **DEF-01** |
| **CP-03** | M01 · RF-01 | Mensaje HTTP 503 de servicio no disponible con alternativa. | Se despliega el aviso HTTP 503 remitiendo al método alterno en aula. | **Aprobado** | — |
| **CP-04** | M02 · RF-02 | PIN de 4 dígitos y QR de 60 s; con corte de red se conserva vigente el último PIN. | PIN y QR renovados cada 60 s; durante falla de red el último PIN extiende su vigencia y permite el marcado del estudiante. | **Aprobado** | **DEF-02** |
| **CP-05** | M03 · RF-03, RF-04, RF-11 | Sólo el PIN/QR vigente registra «Presente» en `< 2 s`; rechaza los 4 casos inválidos. | Los 4 casos inválidos y el doble marcado son rechazados; el PIN/QR vigente confirma al instante y actualiza la pantalla docente. | **Aprobado** | — |
| **CP-06** | M04 · RF-05 | El docente busca al estudiante, lo marca «Presente» y queda en bitácora. | Manuela Quintero marcada «Presente» con medio `Manual contingencia (M04)` y auditada. | **Aprobado** | — |
| **CP-07** | M04 · RF-12 | Cierre de sesión pasa los «Sin registro» a «Ausente». | Los estudiantes sin registro pasan a «Ausente» y se sincroniza su historial. | **Aprobado** | — |
| **CP-08** | M04 · RF-12 | Intento de marcado después del cierre se rechaza y se detiene proyección del PIN. | Marcado rechazado con mensaje de sesión cerrada; pantalla docente detiene el contador del PIN. | **Aprobado** | — |
| **CP-09** | M05 · RF-06 | El estudiante consulta el historial de cada asignatura y su porcentaje general real (`89,3 %`). | Selector y pestañas permiten consultar `ISW1`, `BD II` y `Matemáticas Discretas`; el indicador general calcula `89,3 %`. | **Aprobado** | **DEF-03, DEF-04** |
| **CP-10** | M05 · RF-09 | Alerta preventiva al 15 % y cálculo exacto de faltas para superar el 20 %. | Con `3/19` (`15,8 %`) indica que alcanzó el tope permitido (`3`) y que **1 inasistencia más** (la 4.ª) supera el 20 %. | **Aprobado** | **DEF-05** |
| **CP-11** | M06 · RF-07 | Rechaza soportes inválidos, fechas futuras y fechas sin falla registrada. | Rechaza sin soporte, `.exe`, `> 10 MB`, fecha futura (`2027-01-15`) y fechas sin inasistencia; radica soporte válido en GCS. | **Aprobado** | **DEF-06** |
| **CP-12** | M06 · RF-08, RF-14 | Al aceptar recalcula sólo al dueño de la excusa; al rechazar revierte el recálculo. | Aprobar la excusa de A. F. Morales (`2245006`) reduce sólo sus fallas (`2 → 1`) sin tocar a J. S. Marín (`2248332`); al pasar a «No aprobada» revierte (`1 → 2`). | **Aprobado** | **DEF-07, DEF-08** |
| **CP-13** | M07 · RF-10 | Novedad de llegada tarde se guarda conservando estado «Presente». | Novedad guardada y visible como `Llegada tarde (12m)` manteniendo estado «Presente». | **Aprobado** | — |
| **CP-14** | M07 · RF-10 | Rechaza minutos fuera de `1..180` y novedades a estudiantes no presentes. | Rechaza `0`, `-5`, `2,5` y `500` minutos, y rechaza novedades sobre estudiantes «Sin registro» o «Ausente». | **Aprobado** | **DEF-09, DEF-10** |
| **CP-15** | M08 · RF-13, RF-14 | Pide confirmación al corregir sesión cerrada, recalcula historial y la bitácora es inmutable. | Solicita confirmación con valor anterior y nuevo, recalcula el historial del estudiante y elimina toda opción de borrar la bitácora. | **Aprobado** | **DEF-11, DEF-12, DEF-13** |
| **CP-16** | M09 · RF-15 | El CSV y la vista reflejan el periodo, asignatura y grupo filtrados. | Exporta datos reales por asignatura/grupo, informa «Sin datos» para `2025-3 / G02` y exporta etiqueta legible en columna Grupo. | **Aprobado** | **DEF-14, DEF-15, DEF-16** |
| **CP-17** | M09 · RF-15 | Generación de informe en PDF sin menú lateral y registro en bitácora. | Invoca impresión PDF con `@media print` limpio y audita el evento en bitácora. | **Aprobado** | — |
| **CP-18** | M10 · RNF-01..07 | Ninguna pantalla genera desbordamiento horizontal en smartphones (`390 px`). | Las 12 pantallas del estudiante, docente y director se adaptan a `390 px` sin desborde y con controles `≥ 44 px`. | **Aprobado** | **DEF-17** |
| **CP-19** | M10 · RNF-01..07 | Sin desbordamiento en escritorio y PIN/QR legibles en proyector. | Visualización nítida con Modo Proyector (`96 px` PIN y `240 px` QR SVG). | **Aprobado** | — |

---

## 3. RESUMEN DE CIERRE DE INCIDENCIAS (DEF-01 A DEF-17)

- **Casos incluidos / ejecutados:** 19 / 19 (100 %)
- **Casos aprobados:** 19 / 19 (100 %; meta del plan ≥ 90 %)
- **Casos de requisitos obligatorios aprobados (RF-01 a RF-06, RF-11, RF-12):** 9 / 9 (100 %)
- **Módulos aprobados:** 10 de 10 (M01 a M10)
- **Defectos críticos o mayores abiertos:** 0 (17 de 17 cerrados y verificados mediante `test_runner.js` con 216 aserciones exitosas)
- **Estado general:** **PROTOTIPO APROBADO**
