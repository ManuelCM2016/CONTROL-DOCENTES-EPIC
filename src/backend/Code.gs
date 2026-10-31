/**
 * ══════════════════════════════════════════════════════════════
 * SISTEMA DE CONTROL DOCENTE EPIC - BACKEND (Google Apps Script)
 * Universidad Privada de Tacna — Escuela de Ingeniería Civil
 * ══════════════════════════════════════════════════════════════
 * 
 * INSTRUCCIONES DE CONFIGURACIÓN:
 * 
 * 1. Crear un Google Sheets con 2 pestañas (hojas):
 *    - "MAESTRO_DOCENTES" → Tabla de docentes registrados
 *    - "BASE_DE_DATOS"    → Tabla donde se registran las sesiones
 * 
 * 2. Estructura de la pestaña "MAESTRO_DOCENTES" (fila 1 = encabezados):
 *    | DNI      | CODIGO | NOMBRE                    | FACULTAD              | ESCUELA                            | CARRERA              | CURSOS                                     |
 *    |----------|--------|---------------------------|-----------------------|------------------------------------|----------------------|--------------------------------------------|
 *    | 70123456 | D001   | Ing. Carlos Mendoza Quispe| Facultad de Ingeniería| Escuela Prof. de Ingeniería Civil  | Ingeniería Civil     | Topografía I, Mecánica de Suelos, Geodesia |
 * 
 *    NOTA: Los cursos van separados por comas en una sola celda.
 * 
 * 3. Estructura de la pestaña "BASE_DE_DATOS" (fila 1 = encabezados):
 *    | TIMESTAMP | DNI | DOCENTE | FACULTAD | ESCUELA | CARRERA | N° | AULA/LAB | FECHA | ASIGNATURA | SECCION | UNIDAD | SEMANA | TEMA PROGRAMADO | RECURSOS UTILIZADOS | HORA INICIO | HORA FINALIZACION | N° ESTUDIANTES | VALIDACION | OBSERVACIONES |
 * 
 * 4. Reemplazar SPREADSHEET_ID con el ID real del Google Sheets.
 * 
 * 5. Desplegar como "Aplicación Web":
 *    - Ejecutar como: Yo (tu cuenta)
 *    - Acceso: Cualquier persona
 */

// ══════════════ CONFIGURACIÓN ══════════════
const SPREADSHEET_ID = '1gcHH0OVSXem5v9reEpwxehvRdtk5Y-ITy8RKdjQ109U'; // ← Reemplazar con tu ID real
const HOJA_DOCENTES = 'MAESTRO_DOCENTES';
const HOJA_DATOS = 'BASE_DE_DATOS';
const HOJA_HORARIOS = 'HORARIOS';
const HOJA_RESERVAS = 'RESERVAS';
const HOJA_INCIDENCIAS = 'INCIDENCIAS';

// ══════════════ UTILIDADES ══════════════

/**
 * Crea una respuesta JSON con headers CORS para el navegador
 */
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Obtiene la hoja de cálculo por nombre
 */
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error(`Hoja "${name}" no encontrada en el spreadsheet.`);
  }
  return sheet;
}

/**
 * Normaliza un DNI o código quitando ceros a la izquierda y espacios
 * para permitir coincidencias exactas aunque Google Sheets guarde 01338713 como 1338713
 */
function normalizeDni(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim().toUpperCase();
  const unpadded = str.replace(/^0+/, '');
  return unpadded !== '' ? unpadded : str;
}

/**
 * Normaliza cualquier formato de fecha a 'yyyy-MM-dd' en zona horaria de Perú
 */
function normalizeDateStr(val, tz) {
  if (!val) return '';
  const timezone = tz || 'America/Lima';
  if (val instanceof Date) {
    return Utilities.formatDate(val, timezone, 'yyyy-MM-dd');
  }
  const str = String(val).trim();
  if (str.indexOf('/') !== -1) {
    const parts = str.split(/[\/ ]/);
    if (parts.length >= 3 && parts[0].length <= 2 && parts[2].length === 4) {
      return parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
    }
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  return str;
}

// ══════════════ doGet — BUSCAR DOCENTE + ADMIN ENDPOINTS ══════════════

/**
 * Maneja peticiones GET.
 * 
 * Acciones disponibles:
 *   ?id=DNI               → Buscar docente (default)
 *   ?id=DNI&action=historial → Historial de un docente
 *   ?action=monitoreo     → Clases activas hoy (para panel admin)
 *   ?action=estadisticas  → KPIs y datos agregados (para dashboard admin)
 *   ?action=historial_global&semana=X&docente=Y → Todos los registros filtreables
 *   ?action=obtener_horarios → Todos los horarios del semestre
 *   ?action=horario_docente&docente=NOMBRE → Horarios de un docente específico
 */
function doGet(e) {
  try {
    const id = (e.parameter.id || '').trim().toUpperCase();
    const action = (e.parameter.action || '').trim().toLowerCase();
    const idNorm = normalizeDni(id);

    // ── Acciones ADMIN (no requieren id) ──
    
    if (action === 'monitoreo') {
      const fechaParam = (e.parameter.fecha || '').trim();
      return createJsonResponse({ success: true, data: getMonitoreoActivo(fechaParam) });
    }
    
    if (action === 'estadisticas') {
      const filtros = {
        semana: e.parameter.semana || '',
        docente: e.parameter.docente || '',
        curso: e.parameter.curso || '',
        unidad: e.parameter.unidad || '',
        tipo: e.parameter.tipo || '',
        fechaDesde: e.parameter.fechaDesde || '',
        fechaHasta: e.parameter.fechaHasta || '',
      };
      return createJsonResponse({ success: true, data: getEstadisticas(filtros) });
    }
    
    if (action === 'historial_global') {
      const filtros = {
        semana: e.parameter.semana || '',
        docente: e.parameter.docente || '',
        curso: e.parameter.curso || '',
      };
      return createJsonResponse({ success: true, data: getHistorialGlobal(filtros) });
    }

    if (action === 'lista_docentes') {
      return createJsonResponse({ success: true, data: getListaDocentes() });
    }

    if (action === 'obtener_reservas') {
      return createJsonResponse({ success: true, data: getReservasSheet() });
    }

    if (action === 'obtener_incidencias') {
      return createJsonResponse({ success: true, data: getIncidenciasSheet() });
    }

    if (action === 'obtener_horarios') {
      return createJsonResponse({ success: true, data: getHorariosSemestre() });
    }

    if (action === 'horario_docente') {
      const nombreDocente = (e.parameter.docente || '').trim();
      const dniDocente = (e.parameter.dni || '').trim();
      return createJsonResponse({ success: true, data: getHorarioDocente(nombreDocente, dniDocente) });
    }

    // ── Acciones DOCENTE (requieren id) ──

    if (!id) {
      return createJsonResponse({
        success: false,
        message: 'Parámetro "id" es requerido.',
      });
    }

    // Acción directa: solo obtener historial
    if (action === 'historial') {
      const historial = getHistorialPorDni(id, id);
      return createJsonResponse({
        success: true,
        data: historial,
      });
    }

    // Acción por defecto: buscar docente en MAESTRO_DOCENTES y cargar su historial
    const sheet = getSheet(HOJA_DOCENTES);
    const data = sheet.getDataRange().getValues();
    
    // Fila 0 = encabezados, iterar desde fila 1
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const dni = String(row[0]).trim().toUpperCase();
      const codigo = String(row[1]).trim().toUpperCase();
      const dniNorm = normalizeDni(dni);
      const codigoNorm = normalizeDni(codigo);

      if (
        dni === id || 
        codigo === id || 
        (idNorm !== '' && (dniNorm === idNorm || codigoNorm === idNorm))
      ) {
        // Parsear cursos: "Topografía I, Mecánica de Suelos" → ["Topografía I", "Mecánica de Suelos"]
        const cursosRaw = String(row[6] || '');
        const cursos = cursosRaw
          .split(',')
          .map(c => c.trim())
          .filter(c => c.length > 0);

        // Obtener historial previo registrado en BASE_DE_DATOS
        const historialDocente = getHistorialPorDni(dni, codigo);

        return createJsonResponse({
          success: true,
          data: {
            dni: String(row[0]).trim(),
            codigo: String(row[1]).trim(),
            nombre: String(row[2]).trim(),
            facultad: String(row[3]).trim(),
            escuela: String(row[4]).trim(),
            carrera: String(row[5]).trim(),
            cursos: cursos,
            historial: historialDocente,
          },
        });
      }
    }

    return createJsonResponse({
      success: false,
      message: 'Docente no encontrado. Verifique su DNI o código.',
    });

  } catch (error) {
    return createJsonResponse({
      success: false,
      message: 'Error interno del servidor: ' + error.message,
    });
  }
}

/**
 * Consulta todas las sesiones previas registradas en BASE_DE_DATOS para un docente
 */
function getHistorialPorDni(dni, codigo) {
  const historial = [];
  try {
    const sheetBD = getSheet(HOJA_DATOS);
    const dataBD = sheetBD.getDataRange().getValues();
    const targetDniNorm = normalizeDni(dni);
    const targetCodNorm = normalizeDni(codigo);
    
    // Iterar en orden inverso (más recientes primero)
    for (let i = dataBD.length - 1; i >= 1; i--) {
      const rowBD = dataBD[i];
      const rowDni = String(rowBD[1]).trim().toUpperCase();
      const rowDniNorm = normalizeDni(rowDni);
      
      if (
        rowDni === dni || 
        (codigo && rowDni === codigo) ||
        (rowDniNorm !== '' && (rowDniNorm === targetDniNorm || rowDniNorm === targetCodNorm))
      ) {
        let fechaStr = '';
        if (rowBD[8] instanceof Date) {
          fechaStr = Utilities.formatDate(rowBD[8], Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else {
          fechaStr = String(rowBD[8] || '').trim();
        }

        let fechaRecuperarStr = '';
        if (rowBD[21] instanceof Date) {
          fechaRecuperarStr = Utilities.formatDate(rowBD[21], Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else {
          fechaRecuperarStr = String(rowBD[21] || '').trim();
        }

        historial.push({
          id: 'cloud_row_' + i + '_' + (rowBD[6] || i),
          numero: String(rowBD[6] || ''),
          aulaLab: String(rowBD[7] || ''),
          fecha: fechaStr,
          asignatura: String(rowBD[9] || ''),
          seccion: String(rowBD[10] || ''),
          unidad: String(rowBD[11] || 'I'),
          semanaAcademica: String(rowBD[12] || '1'),
          temaProgramado: String(rowBD[13] || ''),
          recursos: String(rowBD[14] || '').split(',').map(function(r) { return r.trim(); }).filter(Boolean),
          horaInicio: rowBD[15] instanceof Date ? Utilities.formatDate(rowBD[15], Session.getScriptTimeZone(), 'HH:mm:ss') : String(rowBD[15] || ''),
          horaFinalizacion: rowBD[16] instanceof Date ? Utilities.formatDate(rowBD[16], Session.getScriptTimeZone(), 'HH:mm:ss') : String(rowBD[16] || ''),
          numEstudiantes: String(rowBD[17] || ''),
          validacion: String(rowBD[18] || 'PENDIENTE'),
          observaciones: String(rowBD[19] || ''),
          tipo_sesion: String(rowBD[20] || 'Clase Regular'),
          fecha_recuperar: fechaRecuperarStr,
          syncStatus: 'synced'
        });
      }
    }
  } catch (err) {
    Logger.log('Error al consultar historial de BASE_DE_DATOS: ' + err.message);
  }
  return historial;
}

// ══════════════ doPost — REGISTRAR SESIÓN (2 FASES) ══════════════

/**
 * Maneja peticiones POST.
 * Soporta 3 modos:
 * 
 * 1. action="inicio" → Registro parcial: solo datos básicos + estado ACTIVO
 *    Payload: { action, dni, docente, facultad, escuela, carrera, numero, aulaLab, fecha, asignatura, horaInicio, unidad, semanaAcademica }
 * 
 * 2. action="cierre" → Busca fila ACTIVO del mismo DNI+fecha+horaInicio y la completa
 *    Payload: { action, dni, fecha, horaInicio, ...todos los datos restantes }
 * 
 * 3. Sin action (compatibilidad) → Registro completo directo con estado COMPLETADO
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // Esperar hasta 10s para evitar escrituras concurrentes
  } catch (lockErr) {
    Logger.log('Lock error: ' + lockErr.message);
  }

  try {
    const payload = JSON.parse(e.postData.contents);
    const actionPost = (payload.action || '').trim().toLowerCase();

    // ══════════════════════════════════════════
    // ACCIONES DE RESERVAS DE SALONES / LABS
    // ══════════════════════════════════════════
    if (actionPost === 'crear_reserva') {
      return createJsonResponse(crearReservaSheet(payload));
    }
    if (actionPost === 'actualizar_reserva' || actionPost === 'actualizar_estado_reserva') {
      return createJsonResponse(actualizarEstadoReservaSheet(payload));
    }
    if (actionPost === 'eliminar_reserva') {
      return createJsonResponse(eliminarReservaSheet(payload.id));
    }

    // ══════════════════════════════════════════
    // ACCIONES DE SOPORTE & INCIDENCIAS EN AULA
    // ══════════════════════════════════════════
    if (actionPost === 'reportar_incidencia' || actionPost === 'crear_incidencia') {
      return createJsonResponse(crearIncidenciaSheet(payload));
    }
    if (actionPost === 'actualizar_incidencia' || actionPost === 'actualizar_estado_incidencia') {
      return createJsonResponse(actualizarEstadoIncidenciaSheet(payload));
    }
    if (actionPost === 'eliminar_incidencia') {
      return createJsonResponse(eliminarIncidenciaSheet(payload.id));
    }
    const sheet = getSheet(HOJA_DATOS);

    // ══════════════════════════════════════════
    // ACCIÓN: ACTUALIZAR VALIDACIÓN (DIRECTORA)
    // ══════════════════════════════════════════
    if (actionPost === 'validar' || actionPost === 'actualizar_validacion') {
      const targetDni = String(payload.dni || '').trim().toUpperCase();
      const targetDniNorm = normalizeDni(targetDni);
      const targetFecha = String(payload.fecha || '').trim();
      const targetHoraInicio = String(payload.horaInicio || '').trim();
      const nuevaValidacion = String(payload.validacion || 'VÁLIDO').trim().toUpperCase();
      const rowId = payload.rowId;

      let filaEncontrada = -1;
      const dataExistente = sheet.getDataRange().getValues();

      if (rowId && String(rowId).startsWith('row_')) {
        const idx = parseInt(String(rowId).replace('row_', ''), 10);
        if (!isNaN(idx) && idx >= 1 && idx < dataExistente.length) {
          filaEncontrada = idx + 1; // 1-based row index in Sheets
        }
      }

      if (filaEncontrada === -1) {
        for (let i = dataExistente.length - 1; i >= 1; i--) {
          const row = dataExistente[i];
          const rowDni = String(row[1]).trim().toUpperCase();
          const rowDniNorm = normalizeDni(rowDni);
          let rowFecha = row[8] instanceof Date ? Utilities.formatDate(row[8], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(row[8] || '').trim();
          let rowHoraInicio = row[15] instanceof Date ? Utilities.formatDate(row[15], Session.getScriptTimeZone(), 'HH:mm:ss') : String(row[15] || '').trim();

          if (
            (rowDni === targetDni || (rowDniNorm !== '' && rowDniNorm === targetDniNorm)) &&
            rowFecha === targetFecha &&
            rowHoraInicio === targetHoraInicio
          ) {
            filaEncontrada = i + 1;
            break;
          }
        }
      }

      if (filaEncontrada !== -1) {
        sheet.getRange(filaEncontrada, 19).setValue(nuevaValidacion); // Columna S (19) es VALIDACIÓN
        return createJsonResponse({
          success: true,
          message: 'Validación actualizada a: ' + nuevaValidacion,
          data: { fila: filaEncontrada, validacion: nuevaValidacion }
        });
      } else {
        return createJsonResponse({
          success: false,
          message: 'No se encontró el registro para actualizar la validación.'
        });
      }
    }

    // ══════════════════════════════════════════
    // ACCIÓN: EDITAR SESIÓN COMPLETA (DIRECTORA)
    // ══════════════════════════════════════════
    if (actionPost === 'editar_sesion' || actionPost === 'actualizar_sesion') {
      const targetDni = String(payload.dniOriginal || payload.dni || '').trim().toUpperCase();
      const targetDniNorm = normalizeDni(targetDni);
      const targetFecha = String(payload.fechaOriginal || payload.fecha || '').trim();
      const targetHoraInicio = String(payload.horaInicioOriginal || payload.horaInicio || '').trim();
      const rowId = payload.rowId;

      let filaEncontrada = -1;
      const dataExistente = sheet.getDataRange().getValues();

      if (rowId && String(rowId).startsWith('row_')) {
        const idx = parseInt(String(rowId).replace('row_', ''), 10);
        if (!isNaN(idx) && idx >= 1 && idx < dataExistente.length) {
          filaEncontrada = idx + 1;
        }
      }

      if (filaEncontrada === -1) {
        for (let i = dataExistente.length - 1; i >= 1; i--) {
          const row = dataExistente[i];
          const rowDni = String(row[1]).trim().toUpperCase();
          const rowDniNorm = normalizeDni(rowDni);
          let rowFecha = row[8] instanceof Date ? Utilities.formatDate(row[8], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(row[8] || '').trim();
          let rowHoraInicio = row[15] instanceof Date ? Utilities.formatDate(row[15], Session.getScriptTimeZone(), 'HH:mm:ss') : String(row[15] || '').trim();

          if (
            (rowDni === targetDni || (rowDniNorm !== '' && rowDniNorm === targetDniNorm)) &&
            rowFecha === targetFecha &&
            rowHoraInicio === targetHoraInicio
          ) {
            filaEncontrada = i + 1;
            break;
          }
        }
      }

      if (filaEncontrada !== -1) {
        const recursosText = Array.isArray(payload.recursos)
          ? payload.recursos.join(', ')
          : String(payload.recursos || '');

        const timestamp = new Date();
        const timestampStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');

        const updatedRow = [
          timestampStr,                                    // A: TIMESTAMP
          payload.dni || '',                              // B: DNI
          payload.docente || '',                          // C: DOCENTE
          payload.facultad || '',                         // D: FACULTAD
          payload.escuela || '',                          // E: ESCUELA
          payload.carrera || '',                          // F: CARRERA
          payload.numero || '',                           // G: N°
          payload.aulaLab || payload.aula || '',          // H: AULA/LAB
          payload.fecha || '',                            // I: FECHA
          payload.asignatura || '',                       // J: ASIGNATURA
          payload.seccion || '',                          // K: SECCIÓN
          payload.unidad || '',                           // L: UNIDAD
          payload.semanaAcademica || payload.semana || '',// M: SEMANA
          payload.temaProgramado || payload.tema || '',   // N: TEMA PROGRAMADO
          recursosText,                                   // O: RECURSOS
          payload.horaInicio || '',                       // P: HORA INICIO
          payload.horaFinalizacion || payload.horaFin || '', // Q: HORA FIN
          payload.numEstudiantes || '',                   // R: N° ESTUDIANTES
          payload.validacion || 'PENDIENTE',              // S: VALIDACIÓN
          payload.observaciones || '',                    // T: OBSERVACIONES
          payload.tipo_sesion || payload.tipoSesion || 'Clase Regular', // U: TIPO
          payload.fecha_recuperar || payload.fechaRecuperar || '',      // V: FECHA RECUPERAR
          'COMPLETADO',                                   // W: ESTADO_SESION
        ];

        sheet.getRange(filaEncontrada, 1, 1, 23).setValues([updatedRow]);

        return createJsonResponse({
          success: true,
          message: 'Sesión actualizada exitosamente por Dirección.',
          data: { fila: filaEncontrada }
        });
      } else {
        return createJsonResponse({
          success: false,
          message: 'No se encontró la sesión a editar.'
        });
      }
    }

    // ══════════════════════════════════════════
    // ACCIÓN: REGISTRAR SESIÓN MANUAL (DIRECTORA - ANEXO C FÍSICO)
    // ══════════════════════════════════════════
    if (actionPost === 'crear_sesion_manual') {
      const sheet = getSheet(HOJA_DATOS);
      const recursosText = Array.isArray(payload.recursos)
        ? payload.recursos.join(', ')
        : String(payload.recursos || '');

      const timestamp = new Date();
      const timestampStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');

      const newRow = [
        timestampStr,                                                // A: TIMESTAMP
        payload.dni || '',                                          // B: DNI
        payload.docente || '',                                      // C: DOCENTE
        payload.facultad || '',                                     // D: FACULTAD
        payload.escuela || '',                                      // E: ESCUELA
        payload.carrera || '',                                      // F: CARRERA
        payload.numero || '',                                       // G: N°
        payload.aulaLab || payload.aula || '',                      // H: AULA/LAB
        payload.fecha || '',                                        // I: FECHA
        payload.asignatura || '',                                   // J: ASIGNATURA
        payload.seccion || '',                                      // K: SECCIÓN
        payload.unidad || '',                                       // L: UNIDAD
        payload.semanaAcademica || payload.semana || '',            // M: SEMANA
        payload.temaProgramado || payload.tema || '',               // N: TEMA PROGRAMADO
        recursosText,                                               // O: RECURSOS
        payload.horaInicio || '',                                   // P: HORA INICIO
        payload.horaFinalizacion || payload.horaFin || '',          // Q: HORA FIN
        payload.numEstudiantes || '',                               // R: N° ESTUDIANTES
        payload.validacion || 'VÁLIDO',                             // S: VALIDACIÓN
        payload.observaciones || '',                                // T: OBSERVACIONES
        payload.tipo_sesion || payload.tipoSesion || 'Clase Regular', // U: TIPO DE SESIÓN
        payload.fecha_recuperar || payload.fechaRecuperar || '',      // V: FECHA RECUPERAR
        'COMPLETADO',                                               // W: ESTADO_SESION
      ];

      // Control anti-duplicados estricto (mismo docente, fecha y hora de inicio)
      const dataExistente = sheet.getDataRange().getValues();
      const targetDni = String(payload.dni || '').trim().toUpperCase();
      const targetDniNorm = normalizeDni(targetDni);
      const targetFecha = String(payload.fecha || '').trim();
      const targetHoraInicio = String(payload.horaInicio || '').trim();

      for (let i = dataExistente.length - 1; i >= 1; i--) {
        const row = dataExistente[i];
        const rowDni = String(row[1]).trim().toUpperCase();
        const rowDniNorm = normalizeDni(rowDni);
        let rowFecha = row[8] instanceof Date
          ? Utilities.formatDate(row[8], Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : String(row[8] || '').trim();
        let rowHoraInicio = row[15] instanceof Date
          ? Utilities.formatDate(row[15], Session.getScriptTimeZone(), 'HH:mm:ss')
          : String(row[15] || '').trim();

        if (
          (rowDni === targetDni || (rowDniNorm !== '' && rowDniNorm === targetDniNorm)) &&
          rowFecha === targetFecha &&
          rowHoraInicio === targetHoraInicio
        ) {
          return createJsonResponse({
            success: false,
            message: 'Ya existe una sesión registrada para este docente en la fecha ' + targetFecha + ' a las ' + targetHoraInicio + '.',
          });
        }
      }

      sheet.appendRow(newRow);

      return createJsonResponse({
        success: true,
        message: 'Sesión física / manual registrada exitosamente.',
      });
    }

    // ══════════════════════════════════════════
    // ACCIÓN: EDITAR O AGREGAR DOCENTE (DIRECTORA)
    // ══════════════════════════════════════════
    if (actionPost === 'editar_docente' || actionPost === 'guardar_docente') {
      const sheetDoc = getSheet(HOJA_DOCENTES);
      const dataDoc = sheetDoc.getDataRange().getValues();
      const targetDni = String(payload.dniOriginal || payload.dni || '').trim().toUpperCase();
      const targetDniNorm = normalizeDni(targetDni);

      let filaDocente = -1;
      for (let i = 1; i < dataDoc.length; i++) {
        const row = dataDoc[i];
        const rowDni = String(row[0] || '').trim().toUpperCase();
        const rowCod = String(row[1] || '').trim().toUpperCase();
        const rowDniNorm = normalizeDni(rowDni);
        const rowCodNorm = normalizeDni(rowCod);

        if (
          rowDni === targetDni ||
          rowCod === targetDni ||
          (targetDniNorm !== '' && (rowDniNorm === targetDniNorm || rowCodNorm === targetDniNorm))
        ) {
          filaDocente = i + 1;
          break;
        }
      }

      const cursosStr = Array.isArray(payload.cursos)
        ? payload.cursos.join(', ')
        : String(payload.cursos || '').trim();

      const docenteRow = [
        String(payload.nuevoDni || payload.dni || '').trim(),
        String(payload.codigo || '').trim(),
        String(payload.nombre || '').trim(),
        String(payload.facultad || 'FAING').trim(),
        String(payload.escuela || 'EPIC').trim(),
        String(payload.carrera || 'Ingeniería Civil').trim(),
        cursosStr,
      ];

      if (filaDocente !== -1) {
        sheetDoc.getRange(filaDocente, 1, 1, 7).setValues([docenteRow]);
        return createJsonResponse({
          success: true,
          message: 'Datos del docente actualizados exitosamente en Maestro Docentes.',
          data: { fila: filaDocente }
        });
      } else {
        sheetDoc.appendRow(docenteRow);
        return createJsonResponse({
          success: true,
          message: 'Nuevo docente registrado exitosamente en Maestro Docentes.',
        });
      }
    }

    // ══════════════════════════════════════════
    // ACCIÓN: FORZAR CIERRE DE AULA (DIRECTORA)
    // Calcula hora de salida = horaInicio + duracionEstimadaMin
    // ══════════════════════════════════════════
    if (actionPost === 'forzar_cierre' || actionPost === 'cerrar_remoto') {
      const dataExistente = sheet.getDataRange().getValues();
      const targetDni = String(payload.dni || '').trim().toUpperCase();
      const targetDniNorm = normalizeDni(targetDni);
      const targetFecha = String(payload.fecha || '').trim();
      const targetHoraInicio = String(payload.horaInicio || '').trim();
      const duracionMin = parseInt(payload.duracionEstimadaMin || 90, 10);

      // Buscar la fila ACTIVA del docente
      let filaTarget = -1;
      for (let i = dataExistente.length - 1; i >= 1; i--) {
        const row = dataExistente[i];
        const rowDni = String(row[1]).trim().toUpperCase();
        const rowDniNorm = normalizeDni(rowDni);
        const rowEstado = String(row[22] || '').trim().toUpperCase();
        let rowFecha = row[8] instanceof Date
          ? Utilities.formatDate(row[8], Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : String(row[8] || '').trim();
        let rowHoraInicio = row[15] instanceof Date
          ? Utilities.formatDate(row[15], Session.getScriptTimeZone(), 'HH:mm:ss')
          : String(row[15] || '').trim();

        const mismoDocente = (rowDni === targetDni || (rowDniNorm !== '' && rowDniNorm === targetDniNorm));
        const mismaFecha = (targetFecha === '' || rowFecha === targetFecha);
        const mismaHora = (targetHoraInicio === '' || rowHoraInicio === targetHoraInicio);

        if (mismoDocente && mismaFecha && mismaHora && rowEstado === 'ACTIVO') {
          filaTarget = i + 1;
          break;
        }
      }

      if (filaTarget !== -1 && filaTarget <= sheet.getLastRow()) {
        // Calcular hora de salida = horaInicio + duracionEstimadaMin
        let horaFinCalculada = '';
        try {
          const hParts = targetHoraInicio.split(':');
          if (hParts.length >= 2) {
            const startDate = new Date();
            startDate.setHours(parseInt(hParts[0], 10), parseInt(hParts[1], 10), parseInt(hParts[2] || 0, 10));
            startDate.setMinutes(startDate.getMinutes() + duracionMin);
            horaFinCalculada = Utilities.formatDate(startDate, Session.getScriptTimeZone(), 'HH:mm:ss');
          } else {
            horaFinCalculada = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm:ss');
          }
        } catch (e) {
          horaFinCalculada = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm:ss');
        }

        const obsActual = String(sheet.getRange(filaTarget, 20).getValue() || '');
        const motivo = payload.motivo || 'Sesión cerrada remotamente por Dirección Académica';
        const nuevoObs = (obsActual ? obsActual + ' | ' : '') + motivo;
        
        sheet.getRange(filaTarget, 17).setValue(horaFinCalculada); // Col Q: HORA FIN (calculada)
        sheet.getRange(filaTarget, 20).setValue(nuevoObs);         // Col T: OBSERVACIONES
        sheet.getRange(filaTarget, 23).setValue('COMPLETADO');     // Col W: ESTADO_SESION

        return createJsonResponse({
          success: true,
          message: 'Aula liberada. Hora de salida calculada: ' + horaFinCalculada,
          data: { fila: filaTarget, horaFin: horaFinCalculada }
        });
      } else {
        return createJsonResponse({
          success: false,
          message: 'No se encontró la sesión activa a cerrar.'
        });
      }
    }

    // ══════════════════════════════════════════
    // ACCIÓN: ANULAR INICIO DE CLASE (DOCENTE o DIRECTORA)
    // Elimina físicamente la fila ACTIVA de Sheets
    // ══════════════════════════════════════════
    if (actionPost === 'anular_inicio' || actionPost === 'cancelar_inicio') {
      const dataExistente = sheet.getDataRange().getValues();
      const targetDni = String(payload.dni || '').trim().toUpperCase();
      const targetDniNorm = normalizeDni(targetDni);
      const targetFecha = String(payload.fecha || '').trim();
      const targetAsignatura = String(payload.asignatura || '').trim().toUpperCase();

      let filaAnular = -1;
      for (let i = dataExistente.length - 1; i >= 1; i--) {
        const row = dataExistente[i];
        const rowDni = String(row[1]).trim().toUpperCase();
        const rowDniNorm = normalizeDni(rowDni);
        const rowEstado = String(row[22] || '').trim().toUpperCase();
        let rowFecha = row[8] instanceof Date
          ? Utilities.formatDate(row[8], Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : String(row[8] || '').trim();
        const rowAsignatura = String(row[9] || '').trim().toUpperCase();

        const mismoDocente = (rowDni === targetDni || (rowDniNorm !== '' && rowDniNorm === targetDniNorm));
        const mismaFecha = (targetFecha === '' || rowFecha === targetFecha);
        const mismaAsignatura = (targetAsignatura === '' || rowAsignatura === '' || rowAsignatura === targetAsignatura);

        if (mismoDocente && mismaFecha && mismaAsignatura && rowEstado === 'ACTIVO') {
          filaAnular = i + 1;
          break;
        }
      }

      if (filaAnular !== -1) {
        try {
          sheet.deleteRow(filaAnular);
        } catch (e) {
          // Fallback: marcar como ANULADO si no se puede borrar
          sheet.getRange(filaAnular, 23).setValue('ANULADO');
        }
        return createJsonResponse({
          success: true,
          message: 'Inicio de clase anulado y registro eliminado de Sheets.'
        });
      } else {
        return createJsonResponse({
          success: true,
          message: 'No se encontró sesión activa que anular o ya fue cerrada.'
        });
      }
    }

    // ══════════════════════════════════════════
    // ACCIÓN: CARGAR HORARIOS DEL SEMESTRE (DIRECTORA)
    // Recibe array de registros y reemplaza toda la pestaña HORARIOS
    // ══════════════════════════════════════════
    if (actionPost === 'cargar_horarios') {
      const registros = payload.horarios || [];
      if (!Array.isArray(registros) || registros.length === 0) {
        return createJsonResponse({
          success: false,
          message: 'No se recibieron registros de horarios.'
        });
      }

      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      let sheetH = ss.getSheetByName(HOJA_HORARIOS);
      
      // Si la pestaña no existe, crearla
      if (!sheetH) {
        sheetH = ss.insertSheet(HOJA_HORARIOS);
      }
      
      // Limpiar todo el contenido existente
      sheetH.clearContents();
      
      // Escribir encabezados
      const headers = ['CODIGO', 'CURSO', 'DOCENTE', 'SECCION', 'DIA', 'HORA_INICIO', 'HORA_FIN', 'DURACION_HRS', 'AULA', 'CICLO'];
      sheetH.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Escribir datos en bloque (mucho más rápido que appendRow)
      if (registros.length > 0) {
        const rows = registros.map(function(r) {
          return [
            r.CODIGO || r.codigo || '',
            r.CURSO || r.curso || '',
            r.DOCENTE || r.docente || '',
            r.SECCION || r.seccion || '',
            r.DIA || r.dia || '',
            r.HORA_INICIO || r.horaInicio || '',
            r.HORA_FIN || r.horaFin || '',
            r.DURACION_HRS || r.duracionHrs || '',
            r.AULA || r.aula || '',
            r.CICLO || r.ciclo || ''
          ];
        });
        sheetH.getRange(2, 1, rows.length, headers.length).setValues(rows);
      }
      
      // Formatear encabezados
      const headerRange = sheetH.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#1a73e8');
      headerRange.setFontColor('#ffffff');
      sheetH.setFrozenRows(1);
      
      return createJsonResponse({
        success: true,
        message: 'Horarios cargados exitosamente: ' + registros.length + ' registros.',
        data: { totalRegistros: registros.length }
      });
    }

    // ══════════════════════════════════════════
    // FASE 1: INICIO DE CLASE (registro parcial)
    // ══════════════════════════════════════════
    if (actionPost === 'inicio') {
      const tz = 'America/Lima';
      const timestamp = new Date();
      const timestampStr = Utilities.formatDate(timestamp, tz, 'dd/MM/yyyy HH:mm:ss');

      const dataExistente = sheet.getDataRange().getValues();
      const targetDni = String(payload.dni || '').trim().toUpperCase();
      const targetDniNorm = normalizeDni(targetDni);
      const targetFecha = String(payload.fecha || normalizeDateStr(timestamp, tz)).trim();
      const targetAsignatura = String(payload.asignatura || '').trim().toUpperCase();
      const targetHoraInicio = String(payload.horaInicio || Utilities.formatDate(timestamp, tz, 'HH:mm:ss')).trim();
      const duracionMin = parseInt(payload.duracionEstimadaMin || 90, 10);
      const obsInicial = '[Duración: ' + duracionMin + ' min]';

      // ── ANTI-DUPLICADO: Si el docente YA tiene una sesión ACTIVA hoy, no crear duplicado ──
      for (let i = dataExistente.length - 1; i >= 1; i--) {
        const row = dataExistente[i];
        const rowDni = String(row[1]).trim().toUpperCase();
        const rowDniNorm = normalizeDni(rowDni);
        const rowEstado = String(row[22] || '').trim().toUpperCase();
        let rowFecha = normalizeDateStr(row[8], tz);
        let rowHoraInicio = row[15] instanceof Date
          ? Utilities.formatDate(row[15], tz, 'HH:mm:ss')
          : String(row[15] || '').trim();

        const mismoDocente = (rowDni === targetDni || (rowDniNorm !== '' && rowDniNorm === targetDniNorm));
        const mismaFecha = (rowFecha === targetFecha);

        if (mismoDocente && mismaFecha && rowEstado === 'ACTIVO') {
          // Ya hay una sesión activa registrada para este docente hoy: no duplicar
          return createJsonResponse({
            success: true,
            message: 'La sesión de inicio ya fue registrada previamente.',
            horaInicio: rowHoraInicio,
          });
        }
      }

      // Insertar fila parcial con estado ACTIVO
      const newRow = [
        timestampStr,                          // A: TIMESTAMP
        payload.dni || '',                     // B: DNI
        payload.docente || '',                 // C: DOCENTE
        payload.facultad || '',                // D: FACULTAD
        payload.escuela || '',                 // E: ESCUELA
        payload.carrera || '',                 // F: CARRERA
        payload.numero || '',                  // G: N°
        payload.aulaLab || '',                 // H: AULA/LAB
        targetFecha,                           // I: FECHA
        payload.asignatura || '',              // J: ASIGNATURA
        payload.seccion || '',                 // K: SECCIÓN
        payload.unidad || '',                  // L: UNIDAD
        payload.semanaAcademica || '',         // M: SEMANA
        '',                                    // N: TEMA (se llena al cierre)
        '',                                    // O: RECURSOS (se llena al cierre)
        targetHoraInicio,                      // P: HORA INICIO
        '',                                    // Q: HORA FIN (se llena al cierre)
        '',                                    // R: N° ESTUDIANTES (se llena al cierre)
        'PENDIENTE',                           // S: VALIDACIÓN
        obsInicial,                            // T: OBSERVACIONES (duración estimada)
        payload.tipo_sesion || 'Clase Regular',// U: TIPO DE SESIÓN
        payload.fecha_recuperar || '',         // V: FECHA A RECUPERAR
        'ACTIVO',                              // W: ESTADO_SESION ← ACTIVO
      ];

      sheet.appendRow(newRow);

      return createJsonResponse({
        success: true,
        message: 'Inicio de clase registrado. Estado: ACTIVO.',
      });
    }

    // ══════════════════════════════════════════
    // FASE 2: CIERRE DE CLASE (completar fila ACTIVO → COMPLETADO)
    // ══════════════════════════════════════════
    if (actionPost === 'cierre') {
      const dataExistente = sheet.getDataRange().getValues();
      const targetDni = String(payload.dni || '').trim().toUpperCase();
      const targetDniNorm = normalizeDni(targetDni);
      const targetFecha = String(payload.fecha || '').trim();
      const targetHoraInicio = String(payload.horaInicio || '').trim();
      const targetAsignatura = String(payload.asignatura || '').trim().toUpperCase();

      // Recopilar TODAS las filas ACTIVAS del docente+fecha+asignatura (puede haber duplicados por doble clic)
      let filasActivas = [];
      let filaActiva = -1;

      // Buscar filas ACTIVAS del mismo DNI + FECHA + ASIGNATURA
      // Se incluye ASIGNATURA en el filtro para NO afectar otros cursos del mismo docente en el mismo día
      for (let i = dataExistente.length - 1; i >= 1; i--) {
        const row = dataExistente[i];
        const rowDni = String(row[1]).trim().toUpperCase();
        const rowDniNorm = normalizeDni(rowDni);
        const rowEstado = String(row[22] || '').trim().toUpperCase(); // Columna W (índice 22)
        
        let rowFecha = row[8] instanceof Date
          ? Utilities.formatDate(row[8], Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : String(row[8] || '').trim();
        let rowHoraInicio = row[15] instanceof Date
          ? Utilities.formatDate(row[15], Session.getScriptTimeZone(), 'HH:mm:ss')
          : String(row[15] || '').trim();

        const mismoDocente = (rowDni === targetDni || (rowDniNorm !== '' && rowDniNorm === targetDniNorm));
        const mismaFecha = (rowFecha === targetFecha);
        // ← Incluir asignatura para no tocar otros cursos del mismo docente en el mismo día
        const rowAsignatura = String(row[9] || '').trim().toUpperCase();
        const mismaAsignatura = (targetAsignatura === '' || rowAsignatura === '' || rowAsignatura === targetAsignatura);

        if (mismoDocente && mismaFecha && mismaAsignatura && rowEstado === 'ACTIVO') {
          // Priorizar la fila que coincide exactamente con horaInicio del payload
          if (rowHoraInicio === targetHoraInicio && filaActiva === -1) {
            filaActiva = i + 1;
          } else if (filaActiva === -1) {
            // Si no hay coincidencia exacta de hora, usar la primera ACTIVA encontrada del mismo curso
            filaActiva = i + 1;
          } else {
            // Fila ACTIVA duplicada del mismo curso: limpiarla al cerrar
            filasActivas.push(i + 1);
          }
        }
      }

      // Construir recursos como texto
      const recursosText = Array.isArray(payload.recursos)
        ? payload.recursos.join(', ')
        : String(payload.recursos || '');

      if (filaActiva !== -1) {
        // Actualizar la fila principal con los datos completos del cierre
        const range = sheet.getRange(filaActiva, 1, 1, 23); // 23 columnas (A-W)
        const timestamp = new Date();
        const timestampStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');

        const updatedRow = [
          timestampStr,                          // A: TIMESTAMP (actualizado)
          payload.dni || '',                     // B: DNI
          payload.docente || '',                 // C: DOCENTE
          payload.facultad || '',                // D: FACULTAD
          payload.escuela || '',                 // E: ESCUELA
          payload.carrera || '',                 // F: CARRERA
          payload.numero || '',                  // G: N°
          payload.aulaLab || '',                 // H: AULA/LAB
          payload.fecha || '',                   // I: FECHA
          payload.asignatura || '',              // J: ASIGNATURA
          payload.seccion || '',                 // K: SECCIÓN
          payload.unidad || '',                  // L: UNIDAD
          payload.semanaAcademica || '',         // M: SEMANA
          payload.temaProgramado || '',          // N: TEMA PROGRAMADO
          recursosText,                          // O: RECURSOS
          payload.horaInicio || '',              // P: HORA INICIO
          payload.horaFinalizacion || '',        // Q: HORA FIN
          payload.numEstudiantes || '',          // R: N° ESTUDIANTES
          'PENDIENTE',                           // S: VALIDACIÓN
          payload.observaciones || '',           // T: OBSERVACIONES
          payload.tipo_sesion || 'Clase Regular',// U: TIPO DE SESIÓN
          payload.fecha_recuperar || '',         // V: FECHA A RECUPERAR
          'COMPLETADO',                          // W: ESTADO_SESION ← COMPLETADO
        ];

        range.setValues([updatedRow]);

        // Eliminar FÍSICAMENTE las filas duplicadas del Excel
        // Se ordenan de mayor a menor (b - a) para que al borrar una fila no cambie el índice de las superiores
        filasActivas.sort(function(a, b) { return b - a; }).forEach(function(filaIdx) {
          try {
            sheet.deleteRow(filaIdx);
          } catch (e) {
            // Fallback en caso de bloqueo de rango
            sheet.getRange(filaIdx, 23, 1, 1).setValue('COMPLETADO');
          }
        });

        return createJsonResponse({
          success: true,
          message: 'Sesión registrada exitosamente.',
        });

      } else {
        // No se encontró fila ACTIVA — hacer registro completo directo (fallback)
        const timestamp = new Date();
        const timestampStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');

        // Anti-duplicados: verificar si ya existe una fila COMPLETADA
        for (let i = dataExistente.length - 1; i >= 1; i--) {
          const row = dataExistente[i];
          const rowDni = String(row[1]).trim().toUpperCase();
          const rowDniNorm = normalizeDni(rowDni);
          let rowFecha = row[8] instanceof Date
            ? Utilities.formatDate(row[8], Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(row[8] || '').trim();
          let rowHoraInicio = row[15] instanceof Date
            ? Utilities.formatDate(row[15], Session.getScriptTimeZone(), 'HH:mm:ss')
            : String(row[15] || '').trim();

          if (
            (rowDni === targetDni || (rowDniNorm !== '' && rowDniNorm === targetDniNorm)) &&
            rowFecha === targetFecha &&
            rowHoraInicio === targetHoraInicio
          ) {
            return createJsonResponse({
              success: true,
              message: 'La sesión ya se encontraba registrada previamente.',
            });
          }
        }

        const newRow = [
          timestampStr,
          payload.dni || '',
          payload.docente || '',
          payload.facultad || '',
          payload.escuela || '',
          payload.carrera || '',
          payload.numero || '',
          payload.aulaLab || '',
          payload.fecha || '',
          payload.asignatura || '',
          payload.seccion || '',
          payload.unidad || '',
          payload.semanaAcademica || '',
          payload.temaProgramado || '',
          recursosText,
          payload.horaInicio || '',
          payload.horaFinalizacion || '',
          payload.numEstudiantes || '',
          'PENDIENTE',
          payload.observaciones || '',
          payload.tipo_sesion || 'Clase Regular',
          payload.fecha_recuperar || '',
          'COMPLETADO',
        ];

        sheet.appendRow(newRow);

        return createJsonResponse({
          success: true,
          message: 'Sesión registrada exitosamente.',
        });
      }
    }

    // ══════════════════════════════════════════
    // MODO LEGACY (sin action) — Registro completo directo
    // Compatibilidad con versiones anteriores
    // ══════════════════════════════════════════
    const recursosText = Array.isArray(payload.recursos)
      ? payload.recursos.join(', ')
      : String(payload.recursos || '');

    const timestamp = new Date();
    const timestampStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');

    const newRow = [
      timestampStr,                          // A: TIMESTAMP
      payload.dni || '',                     // B: DNI
      payload.docente || '',                 // C: DOCENTE
      payload.facultad || '',                // D: FACULTAD
      payload.escuela || '',                 // E: ESCUELA
      payload.carrera || '',                 // F: CARRERA
      payload.numero || '',                  // G: N°
      payload.aulaLab || '',                 // H: AULA/LAB
      payload.fecha || '',                   // I: FECHA
      payload.asignatura || '',              // J: ASIGNATURA
      payload.seccion || '',                 // K: SECCIÓN
      payload.unidad || '',                  // L: UNIDAD
      payload.semanaAcademica || '',         // M: SEMANA
      payload.temaProgramado || '',          // N: TEMA PROGRAMADO
      recursosText,                          // O: RECURSOS UTILIZADOS
      payload.horaInicio || '',              // P: HORA INICIO
      payload.horaFinalizacion || '',        // Q: HORA FINALIZACIÓN
      payload.numEstudiantes || '',          // R: N° ESTUDIANTES
      'PENDIENTE',                           // S: VALIDACIÓN
      payload.observaciones || '',           // T: OBSERVACIONES
      payload.tipo_sesion || 'Clase Regular',// U: TIPO DE SESIÓN
      payload.fecha_recuperar || '',         // V: FECHA A RECUPERAR
      'COMPLETADO',                          // W: ESTADO_SESION
    ];

    // Anti-duplicados
    const dataExistente = sheet.getDataRange().getValues();
    const targetDni = String(payload.dni || '').trim().toUpperCase();
    const targetDniNorm = normalizeDni(targetDni);
    const targetFecha = String(payload.fecha || '').trim();
    const targetHoraInicio = String(payload.horaInicio || '').trim();

    for (let i = dataExistente.length - 1; i >= 1; i--) {
      const row = dataExistente[i];
      const rowDni = String(row[1]).trim().toUpperCase();
      const rowDniNorm = normalizeDni(rowDni);
      let rowFecha = row[8] instanceof Date
        ? Utilities.formatDate(row[8], Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(row[8] || '').trim();
      let rowHoraInicio = row[15] instanceof Date
        ? Utilities.formatDate(row[15], Session.getScriptTimeZone(), 'HH:mm:ss')
        : String(row[15] || '').trim();

      if (
        (rowDni === targetDni || (rowDniNorm !== '' && rowDniNorm === targetDniNorm)) &&
        rowFecha === targetFecha &&
        rowHoraInicio === targetHoraInicio
      ) {
        return createJsonResponse({
          success: true,
          message: 'La sesión ya se encontraba registrada previamente.',
        });
      }
    }

    sheet.appendRow(newRow);

    return createJsonResponse({
      success: true,
      message: 'Sesión registrada exitosamente.',
    });

  } catch (error) {
    return createJsonResponse({
      success: false,
      message: 'Error al registrar la sesión: ' + error.message,
    });
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

// ══════════════ FUNCIONES ADMIN — MONITOREO Y ESTADÍSTICAS ══════════════

/**
 * Devuelve las clases activas y completadas de HOY para el Panel de Monitoreo
 * Incluye lista de docentes registrados como referencia
 */
function getMonitoreoActivo(fechaFiltro) {
  const sheetBD = getSheet(HOJA_DATOS);
  const dataBD = sheetBD.getDataRange().getValues();
  const sheetDoc = getSheet(HOJA_DOCENTES);
  const dataDoc = sheetDoc.getDataRange().getValues();
  
  const tz = 'America/Lima';
  const hoy = (fechaFiltro && String(fechaFiltro).trim() !== '')
    ? String(fechaFiltro).trim()
    : Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  
  const activas = [];
  const completadasHoy = [];
  const docentesActivosVistos = {};
  const filasDuplicadasBorrar = [];
  
  // Iterar de la fila más reciente a la más antigua para conservar la última
  for (let i = dataBD.length - 1; i >= 1; i--) {
    const row = dataBD[i];
    
    // Obtener fecha normalizada (yyyy-MM-dd)
    let fechaStr = normalizeDateStr(row[8], tz);
    
    // FALLBACK: Si la columna FECHA está vacía, usar el TIMESTAMP (columna A)
    if (!fechaStr && row[0]) {
      fechaStr = normalizeDateStr(row[0], tz);
    }
    
    const estado = String(row[22] || '').trim().toUpperCase();
    const horaInicioRaw = row[15] instanceof Date
      ? Utilities.formatDate(row[15], tz, 'HH:mm:ss')
      : String(row[15] || '').trim();
    const horaFinRaw = row[16] instanceof Date
      ? Utilities.formatDate(row[16], tz, 'HH:mm:ss')
      : String(row[16] || '').trim();
    
    // Determinar si la sesión está activa:
    // 1. Si ESTADO_SESION es explícitamente ACTIVO
    // 2. Si tiene horaInicio pero no tiene horaFin y no está ANULADO ni COMPLETADO
    const esActiva = (estado === 'ACTIVO') || (estado !== 'COMPLETADO' && estado !== 'ANULADO' && !horaFinRaw && horaInicioRaw !== '');
    
    // Si NO es activa Y la fecha no coincide con hoy, saltar
    if (!esActiva && fechaStr !== hoy) continue;

    // Extraer duración estimada de observaciones si existe
    const obsStr = String(row[19] || '');
    let duracionEstimadaMin = 90;
    const durMatch = obsStr.match(/\[Duración:\s*(\d+)\s*min\]/i) || obsStr.match(/(\d+)\s*min/i);
    if (durMatch) {
      duracionEstimadaMin = parseInt(durMatch[1], 10);
    }
    
    const sesion = {
      fila: i + 1,
      dni: String(row[1] || ''),
      docente: String(row[2] || ''),
      aula: String(row[7] || ''),
      asignatura: String(row[9] || ''),
      fecha: fechaStr || hoy,
      horaInicio: horaInicioRaw,
      horaFin: horaFinRaw,
      duracionEstimadaMin: duracionEstimadaMin,
      numEstudiantes: String(row[17] || ''),
      tema: String(row[13] || ''),
      estado: esActiva ? 'ACTIVO' : (estado || 'COMPLETADO'),
      observaciones: obsStr,
    };
    
    if (esActiva) {
      const keyDocente = normalizeDni(sesion.dni) || sesion.docente.trim().toUpperCase();
      if (keyDocente && docentesActivosVistos[keyDocente]) {
        // Duplicado encontrado: marcar para eliminar físicamente de Sheets
        filasDuplicadasBorrar.push(i + 1);
      } else {
        if (keyDocente) docentesActivosVistos[keyDocente] = true;
        activas.push(sesion);
      }
    } else {
      completadasHoy.push(sesion);
    }
  }

  // Eliminar físicamente filas duplicadas activas de Sheets (en orden descendente para no alterar índices)
  if (filasDuplicadasBorrar.length > 0) {
    filasDuplicadasBorrar.sort(function(a, b) { return b - a; }).forEach(function(rIdx) {
      try {
        sheetBD.deleteRow(rIdx);
      } catch (e) {
        try { sheetBD.getRange(rIdx, 23).setValue('COMPLETADO'); } catch (err) {}
      }
    });
  }
  
  // Lista de todos los docentes para detectar ausentes
  const todosDocentes = [];
  for (let j = 1; j < dataDoc.length; j++) {
    const row = dataDoc[j];
    if (!row[0] && !row[1]) continue; // Filas vacías
    todosDocentes.push({
      dni: String(row[0] || '').trim(),
      codigo: String(row[1] || '').trim(),
      nombre: String(row[2] || '').trim(),
    });
  }
  
  // Obtener clases programadas para hoy desde HORARIOS
  let clasesProgramadasHoy = [];
  try {
    clasesProgramadasHoy = getClasesProgramadasHoy();
  } catch (err) {
    Logger.log('No se pudieron obtener clases programadas: ' + err.message);
  }
  
  return {
    fecha: hoy,
    activas: activas,
    completadasHoy: completadasHoy,
    todosDocentes: todosDocentes,
    clasesProgramadas: clasesProgramadasHoy,
  };
}

/**
 * Devuelve KPIs y datos agregados para el Dashboard de Estadísticas
 */
function getEstadisticas(filtros) {
  const sheetBD = getSheet(HOJA_DATOS);
  const dataBD = sheetBD.getDataRange().getValues();
  const sheetDoc = getSheet(HOJA_DOCENTES);
  const dataDoc = sheetDoc.getDataRange().getValues();

  const totalDocentes = dataDoc.length - 1; // Sin encabezado
  let totalSesiones = 0;
  let sesionesRegulares = 0;
  let recuperaciones = 0;
  let docentesActivos = new Set();
  let cursoConteo = {};
  let docenteConteo = {};
  let semanaConteo = {};
  let fechaConteo = {};
  let sesionesValidadas = 0;
  let sesionesPendientes = 0;

  for (let i = 1; i < dataBD.length; i++) {
    const row = dataBD[i];
    const estado = String(row[22] || '').trim().toUpperCase();
    
    // Solo contar sesiones COMPLETADAS (o antiguas sin columna W)
    if (estado === 'ACTIVO') continue;

    const dni = String(row[1] || '').trim();
    const semana = String(row[12] || '').trim();
    const curso = String(row[9] || '').trim();
    const docente = String(row[2] || '').trim();
    const tipo = String(row[20] || 'Clase Regular').trim();
    const validacion = String(row[18] || '').trim().toUpperCase();
    let fechaStr = row[8] instanceof Date
      ? Utilities.formatDate(row[8], Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : String(row[8] || '').trim();
    
    // Aplicar filtros
    if (filtros.semana && semana !== filtros.semana) continue;
    if (filtros.docente && normalizeDni(dni) !== normalizeDni(filtros.docente) && docente.toUpperCase().indexOf(filtros.docente.toUpperCase()) === -1) continue;
    if (filtros.curso && curso.toUpperCase().indexOf(filtros.curso.toUpperCase()) === -1) continue;
    if (filtros.unidad && String(row[11] || '').trim() !== filtros.unidad) continue;
    if (filtros.tipo && tipo.toUpperCase().indexOf(filtros.tipo.toUpperCase()) === -1) continue;
    if (filtros.fechaDesde && fechaStr < filtros.fechaDesde) continue;
    if (filtros.fechaHasta && fechaStr > filtros.fechaHasta) continue;

    totalSesiones++;
    docentesActivos.add(normalizeDni(dni));
    
    if (tipo.indexOf('Recupera') !== -1) {
      recuperaciones++;
    } else {
      sesionesRegulares++;
    }

    if (validacion.indexOf('VÁLIDO') !== -1 || validacion.indexOf('VALIDO') !== -1) {
      sesionesValidadas++;
    } else {
      sesionesPendientes++;
    }

    // Conteos para gráficos
    cursoConteo[curso] = (cursoConteo[curso] || 0) + 1;
    docenteConteo[docente] = (docenteConteo[docente] || 0) + 1;
    semanaConteo[semana] = (semanaConteo[semana] || 0) + 1;
    fechaConteo[fechaStr] = (fechaConteo[fechaStr] || 0) + 1;
  }

  // Top 10 docentes más activos
  const topDocentes = Object.entries(docenteConteo)
    .sort(function(a, b) { return b[1] - a[1]; })
    .slice(0, 10)
    .map(function(entry) { return { nombre: entry[0], sesiones: entry[1] }; });

  // Distribución por curso
  const porCurso = Object.entries(cursoConteo)
    .sort(function(a, b) { return b[1] - a[1]; })
    .map(function(entry) { return { curso: entry[0], sesiones: entry[1] }; });

  // Tendencia por semana
  const porSemana = Object.entries(semanaConteo)
    .sort(function(a, b) { return Number(a[0]) - Number(b[0]); })
    .map(function(entry) { return { semana: entry[0], sesiones: entry[1] }; });

  // Tendencia por fecha
  const porFecha = Object.entries(fechaConteo)
    .sort(function(a, b) { return a[0].localeCompare(b[0]); })
    .map(function(entry) { return { fecha: entry[0], sesiones: entry[1] }; });

  return {
    kpis: {
      totalSesiones: totalSesiones,
      sesionesRegulares: sesionesRegulares,
      recuperaciones: recuperaciones,
      docentesActivos: docentesActivos.size,
      totalDocentes: totalDocentes,
      sesionesValidadas: sesionesValidadas,
      sesionesPendientes: sesionesPendientes,
      cumplimiento: totalDocentes > 0 ? Math.round((docentesActivos.size / totalDocentes) * 100) : 0,
    },
    graficos: {
      topDocentes: topDocentes,
      porCurso: porCurso,
      porSemana: porSemana,
      porFecha: porFecha,
    },
  };
}

/**
 * Devuelve el historial completo global con filtros opcionales
 */
function getHistorialGlobal(filtros) {
  const sheetBD = getSheet(HOJA_DATOS);
  const dataBD = sheetBD.getDataRange().getValues();
  const registros = [];

  for (let i = dataBD.length - 1; i >= 1; i--) {
    const row = dataBD[i];
    const estado = String(row[22] || '').trim().toUpperCase();
    if (estado === 'ACTIVO') continue; // No mostrar sesiones activas en historial

    const dni = String(row[1] || '').trim();
    const docente = String(row[2] || '').trim();
    const semana = String(row[12] || '').trim();
    const curso = String(row[9] || '').trim();

    // Filtros
    if (filtros.semana && semana !== filtros.semana) continue;
    if (filtros.docente && normalizeDni(dni) !== normalizeDni(filtros.docente) && docente.toUpperCase().indexOf(filtros.docente.toUpperCase()) === -1) continue;
    if (filtros.curso && curso.toUpperCase().indexOf(filtros.curso.toUpperCase()) === -1) continue;

    let fechaStr = row[8] instanceof Date
      ? Utilities.formatDate(row[8], Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : String(row[8] || '').trim();

    registros.push({
      id: 'row_' + i,
      timestamp: String(row[0] || ''),
      dni: dni,
      docente: docente,
      facultad: String(row[3] || ''),
      escuela: String(row[4] || ''),
      carrera: String(row[5] || ''),
      numero: String(row[6] || ''),
      aula: String(row[7] || ''),
      fecha: fechaStr,
      asignatura: curso,
      seccion: String(row[10] || ''),
      unidad: String(row[11] || ''),
      semana: semana,
      tema: String(row[13] || ''),
      recursos: String(row[14] || ''),
      horaInicio: row[15] instanceof Date ? Utilities.formatDate(row[15], Session.getScriptTimeZone(), 'HH:mm:ss') : String(row[15] || ''),
      horaFin: row[16] instanceof Date ? Utilities.formatDate(row[16], Session.getScriptTimeZone(), 'HH:mm:ss') : String(row[16] || ''),
      numEstudiantes: String(row[17] || ''),
      validacion: String(row[18] || 'PENDIENTE'),
      observaciones: String(row[19] || ''),
      tipoSesion: String(row[20] || 'Clase Regular'),
      estado: estado || 'COMPLETADO',
    });

    // Limitar a 500 registros para no exceder tiempo de ejecución
    if (registros.length >= 500) break;
  }

  return registros;
}

/**
 * Devuelve la lista de todos los docentes registrados en MAESTRO_DOCENTES
 */
function getListaDocentes() {
  const sheet = getSheet(HOJA_DOCENTES);
  const data = sheet.getDataRange().getValues();
  const docentes = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] && !row[1]) continue;
    
    const cursosRaw = String(row[6] || '');
    const cursos = cursosRaw.split(',').map(function(c) { return c.trim(); }).filter(Boolean);

    docentes.push({
      dni: String(row[0] || '').trim(),
      codigo: String(row[1] || '').trim(),
      nombre: String(row[2] || '').trim(),
      facultad: String(row[3] || '').trim(),
      escuela: String(row[4] || '').trim(),
      carrera: String(row[5] || '').trim(),
      cursos: cursos,
    });
  }

  return docentes;
}

// ══════════════ FUNCIONES HORARIOS ══════════════

/**
 * Formatea una celda de hora que puede ser Date o String → "HH:mm"
 */
function formatHoraCell(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'America/Lima', 'HH:mm');
  }
  var str = String(val).trim();
  var match = str.match(/(?:T|\s|^)(\d{1,2}):(\d{2})/i);
  if (match) {
    var h = match[1].length === 1 ? '0' + match[1] : match[1];
    return h + ':' + match[2];
  }
  var anyMatch = str.match(/(\d{1,2}):(\d{2})/);
  if (anyMatch) {
    var h2 = anyMatch[1].length === 1 ? '0' + anyMatch[1] : anyMatch[1];
    return h2 + ':' + anyMatch[2];
  }
  return str;
}

/**
 * Normaliza un nombre de docente para comparación flexible:
 * - Quita prefijos (MTRO., ING., DR., DRA., MG., MSC., etc.)
 * - Quita tildes/acentos
 * - Quita comas
 * - Convierte a mayúsculas
 */
function normalizeNombreDocente(nombre) {
  if (!nombre) return '';
  var n = String(nombre).trim().toUpperCase();
  // Quitar prefijos comunes
  n = n.replace(/^(MTRO\.|MTRA\.|ING\.|DR\.|DRA\.|MG\.|MGR\.|MSC\.|LIC\.|PROF\.|ARQ\.)\s*/gi, '');
  // Quitar tildes/acentos
  n = n.replace(/[ÁÀÂÄ]/g, 'A').replace(/[ÉÈÊË]/g, 'E').replace(/[ÍÌÎÏ]/g, 'I')
       .replace(/[ÓÒÔÖ]/g, 'O').replace(/[ÚÙÛÜ]/g, 'U').replace(/[Ñ]/g, 'N');
  // Quitar comas y puntos
  n = n.replace(/[,\.]/g, ' ');
  // Quitar espacios múltiples
  n = n.replace(/\s+/g, ' ').trim();
  return n;
}

/**
 * Devuelve todos los horarios del semestre cargados en la pestaña HORARIOS
 */
function getHorariosSemestre() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(HOJA_HORARIOS);
    if (!sheet) return { horarios: [], mensaje: 'La pestaña HORARIOS no existe. Cárgala desde el panel.' };

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { horarios: [], mensaje: 'No hay horarios cargados aún.' };

    const horarios = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0] && !row[1]) continue;
      horarios.push({
        codigo: String(row[0] || '').trim(),
        curso: String(row[1] || '').trim(),
        docente: String(row[2] || '').trim(),
        seccion: String(row[3] || '').trim(),
        dia: String(row[4] || '').trim(),
        horaInicio: formatHoraCell(row[5]),
        horaFin: formatHoraCell(row[6]),
        duracionHrs: Number(row[7]) || 0,
        aula: String(row[8] || '').trim(),
        ciclo: String(row[9] || '').trim()
      });
    }

    return {
      horarios: horarios,
      totalRegistros: horarios.length,
      mensaje: 'OK'
    };
  } catch (err) {
    return { horarios: [], mensaje: 'Error: ' + err.message };
  }
}

/**
 * Devuelve los horarios de un docente específico.
 * Busca por nombre con matching flexible (quita prefijos, tildes, comas).
 */
function getHorarioDocente(nombreDocente, dniDocente) {
  try {
    // Si se proporciona DNI, resolver a nombre desde MAESTRO_DOCENTES
    let nombreBuscar = nombreDocente ? nombreDocente.toUpperCase() : '';
    
    if (dniDocente) {
      const sheetDoc = getSheet(HOJA_DOCENTES);
      const dataDoc = sheetDoc.getDataRange().getValues();
      const dniNorm = normalizeDni(dniDocente);
      
      for (let i = 1; i < dataDoc.length; i++) {
        const rowDni = normalizeDni(String(dataDoc[i][0] || ''));
        const rowCod = normalizeDni(String(dataDoc[i][1] || ''));
        if (rowDni === dniNorm || rowCod === dniNorm) {
          nombreBuscar = String(dataDoc[i][2] || '').trim().toUpperCase();
          break;
        }
      }
    }

    if (!nombreBuscar) {
      return { horarios: [], mensaje: 'Debe proporcionar nombre o DNI del docente.' };
    }

    // Normalizar el nombre del docente buscado (quitar MTRO., tildes, etc.)
    const nombreNorm = normalizeNombreDocente(nombreBuscar);
    // Extraer solo apellidos (primera y segunda palabra) para matching más flexible
    const palabrasNombre = nombreNorm.split(' ');
    const apellido1 = palabrasNombre[0] || '';
    const apellido2 = palabrasNombre[1] || '';

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(HOJA_HORARIOS);
    if (!sheet) return { horarios: [], mensaje: 'La pestaña HORARIOS no existe.' };

    const data = sheet.getDataRange().getValues();
    const horarios = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const docHorarioRaw = String(row[2] || '').trim();
      const docHorarioNorm = normalizeNombreDocente(docHorarioRaw);
      
      // Comparación flexible:
      // 1. Exacta normalizada
      // 2. Contiene el nombre normalizado completo
      // 3. Coinciden ambos apellidos (primera y segunda palabra)
      const match = (
        docHorarioNorm === nombreNorm ||
        docHorarioNorm.indexOf(nombreNorm) !== -1 ||
        nombreNorm.indexOf(docHorarioNorm) !== -1 ||
        (apellido1 && apellido2 && docHorarioNorm.indexOf(apellido1) !== -1 && docHorarioNorm.indexOf(apellido2) !== -1)
      );
      
      if (match) {
        horarios.push({
          codigo: String(row[0] || '').trim(),
          curso: String(row[1] || '').trim(),
          docente: docHorarioRaw,
          seccion: String(row[3] || '').trim(),
          dia: String(row[4] || '').trim(),
          horaInicio: formatHoraCell(row[5]),
          horaFin: formatHoraCell(row[6]),
          duracionHrs: Number(row[7]) || 0,
          aula: String(row[8] || '').trim(),
          ciclo: String(row[9] || '').trim()
        });
      }
    }

    return {
      horarios: horarios,
      docente: nombreBuscar,
      totalClasesSemana: horarios.length,
      mensaje: 'OK'
    };
  } catch (err) {
    return { horarios: [], mensaje: 'Error: ' + err.message };
  }
}

/**
 * Obtiene las clases programadas para HOY de todos los docentes (para monitoreo).
 * Usado internamente por getMonitoreoActivo.
 */
function getClasesProgramadasHoy() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(HOJA_HORARIOS);
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    // Obtener día de la semana en español
    const tz = 'America/Lima';
    const ahora = new Date();
    const diasMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sabado'];
    const diaHoy = diasMap[parseInt(Utilities.formatDate(ahora, tz, 'u')) % 7];
    // Utilities.formatDate con 'u' da 1=Lunes...7=Domingo en ISO
    // Fallback: usar getDay del Date
    const diaJS = ahora.getDay(); // 0=Domingo, 1=Lunes...
    const diasMapJS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sabado'];
    const diaHoyFinal = diasMapJS[diaJS];

    const clasesHoy = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const dia = String(row[4] || '').trim();
      
      // Normalizar comparación de día (quitar tildes para Miércoles/Sábado)
      const diaNorm = dia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const hoyNorm = diaHoyFinal.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      
      if (diaNorm === hoyNorm) {
        clasesHoy.push({
          codigo: String(row[0] || '').trim(),
          curso: String(row[1] || '').trim(),
          docente: String(row[2] || '').trim(),
          seccion: String(row[3] || '').trim(),
          dia: dia,
          horaInicio: formatHoraCell(row[5]),
          horaFin: formatHoraCell(row[6]),
          duracionHrs: Number(row[7]) || 0,
          aula: String(row[8] || '').trim(),
          ciclo: String(row[9] || '').trim()
        });
      }
    }

    return clasesHoy;
  } catch (err) {
    Logger.log('Error al obtener clases programadas hoy: ' + err.message);
    return [];
  }
}

// ══════════════ FUNCIÓN DE PRUEBA ══════════════

/**
 * Ejecutar manualmente para verificar la conexión con el Sheets
 */
function testConnection() {
  try {
    const sheet = getSheet(HOJA_DOCENTES);
    const rows = sheet.getDataRange().getNumRows();
    Logger.log('✅ Conexión exitosa. Filas en MAESTRO_DOCENTES: ' + rows);
    
    const sheetDB = getSheet(HOJA_DATOS);
    const rowsDB = sheetDB.getDataRange().getNumRows();
    Logger.log('✅ Conexión exitosa. Filas en BASE_DE_DATOS: ' + rowsDB);
  } catch (error) {
    Logger.log('❌ Error: ' + error.message);
  }
}

/**
 * Script de Control Remoto V3 (Inmune a formatos de hora AM/PM vs 24h)
 */
function onEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName();
  
  // --- CONFIGURACIÓN ---
  const HOJA_BUSCADOR = "BUSCADOR_RAPIDO";
  const HOJA_BD = "BASE_DE_DATOS";
  const COLUMNA_ACCION = 13; // 13 corresponde a la columna M
  const FILA_INICIO = 9;
  
  if (sheetName === HOJA_BUSCADOR && e.range.getColumn() === COLUMNA_ACCION && e.range.getRow() >= FILA_INICIO) {
    const nuevoEstado = e.value;
    const filaEditada = e.range.getRow();
    
    if (!nuevoEstado) return;
    
    // 1. Extraer valores CRUDOS (getValue en lugar de getDisplayValue)
    const aulaBuscada = sheet.getRange(filaEditada, 2).getValue().toString().trim(); 
    const horaCell = sheet.getRange(filaEditada, 8).getValue();
    
    if (!aulaBuscada || !horaCell) {
      e.source.toast("Faltan datos de Aula u Hora.", "Error");
      e.range.clearContent();
      return;
    }
    
    // Convertir la hora del buscador a milisegundos matemáticos
    const horaBuscadaMs = (horaCell instanceof Date) ? horaCell.getTime() : horaCell.toString().trim();
    
    e.source.toast("Buscando sesión en la Base de Datos...", "Procesando");
    
    // 2. Traer la Base de Datos cruda
    const bdSheet = e.source.getSheetByName(HOJA_BD);
    const data = bdSheet.getDataRange().getValues(); // getValues trae la data matemática
    
    let filaEncontrada = -1;
    const COL_AULA_BD = 7;   // Columna H en BD
    const COL_HORA_BD = 15;  // Columna P en BD
    const COL_VALIDACION_BD = 19; // Columna S en BD
    
    // 3. Buscar la coincidencia ignorando formatos visuales
    for (let i = 1; i < data.length; i++) {
      const aulaBD = data[i][COL_AULA_BD].toString().trim();
      const horaCellBD = data[i][COL_HORA_BD];
      
      // Convertir la hora de la BD a milisegundos matemáticos
      const horaBDMs = (horaCellBD instanceof Date) ? horaCellBD.getTime() : horaCellBD.toString().trim();
      
      if (aulaBD === aulaBuscada && horaBDMs === horaBuscadaMs) {
        filaEncontrada = i + 1; // Array es base 0, las filas son base 1
        break;
      }
    }
    
    // 4. Inyectar estado
    if (filaEncontrada !== -1) {
      bdSheet.getRange(filaEncontrada, COL_VALIDACION_BD).setValue(nuevoEstado);
      e.source.toast("¡Validación sincronizada con éxito!", "Completado");
    } else {
      e.source.toast("No se encontró la sesión exacta en la BD.", "Error del Sistema");
    }
    
    // 5. Limpiar control
    e.range.clearContent();
  }
}
/**
 * Script de Lectura Activa (Maestro-Detalle)
 * Se activa al hacer clic en cualquier celda del Buscador Rápido
 */
function onSelectionChange(e) {
  if (!e || !e.range) return;

  const sheet = e.source.getActiveSheet();
  
  // 1. Solo funcionar en la pestaña Buscador Rápido
  if (sheet.getName() !== "BUSCADOR_RAPIDO") return;

  const row = e.range.getRow();
  const col = e.range.getColumn();

  // 2. Si el usuario hace clic dentro de la tabla (Fila 9 hacia abajo, Columnas A hasta L)
  if (row >= 9 && col <= 12) {
    const aulaBuscada = sheet.getRange(row, 2).getValue().toString().trim(); // Columna B (Aula)
    const horaCell = sheet.getRange(row, 8).getValue();                       // Columna H (Hora Inicio)

    // Si hace clic en una fila vacía, limpiamos el panel
    if (!aulaBuscada || !horaCell) {
      sheet.getRange("C3").clearContent();
      sheet.getRange("C4").clearContent();
      sheet.getRange("C5").clearContent();
      sheet.getRange("C7").clearContent();
      return;
    }

    // Convertir la hora matemáticamente
    const horaBuscadaMs = (horaCell instanceof Date) ? horaCell.getTime() : horaCell.toString().trim();
    
    // 3. Buscar en la Base de Datos
    const bdSheet = e.source.getSheetByName("BASE_DE_DATOS");
    const data = bdSheet.getDataRange().getValues();
    
    let encontrado = false;
    let dFacultad = "", dEscuela = "", dCarrera = "", dDocente = "", dAsignatura = "";

    // Mapeo de columnas en BASE_DE_DATOS (A=0, B=1, C=2...)
    // Ajustado a tu estructura: C=Docente, D=Facultad, E=Escuela, F=Carrera, H=Aula, J=Asignatura, P=HoraInicio
    for (let i = 1; i < data.length; i++) {
      const aulaBD = data[i][7] ? data[i][7].toString().trim() : "";
      const horaCellBD = data[i][15];
      const horaBDMs = (horaCellBD instanceof Date) ? horaCellBD.getTime() : (horaCellBD ? horaCellBD.toString().trim() : "");

      if (aulaBD === aulaBuscada && horaBDMs === horaBuscadaMs) {
        dDocente = data[i][2];    // Columna C (Docente)
        dFacultad = data[i][3];   // Columna D (Facultad)
        dEscuela = data[i][4];    // Columna E (Escuela)
        dCarrera = data[i][5];    // Columna F (Carrera)
        dAsignatura = data[i][9]; // Columna J (Asignatura)
        encontrado = true;
        break;
      }
    }

    // 4. Inyectar los datos en el encabezado
    if (encontrado) {
      sheet.getRange("C3").setValue(dFacultad);
      sheet.getRange("C4").setValue(dEscuela);
      sheet.getRange("C5").setValue(dCarrera);
      // Unimos Docente y Asignatura en C7 para no romper el filtro C6
      sheet.getRange("C7").setValue("👤 " + dDocente + "   |   📚 " + dAsignatura);
    }
  }
}

// ══════════════════════════════════════════════════════════════
// MÓDULO DE RESERVAS DE SALONES Y LABORATORIOS (EPIC)
// ══════════════════════════════════════════════════════════════

/**
 * Obtiene o crea automáticamente la hoja RESERVAS con sus encabezados oficiales
 */
function getSheetReservas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(HOJA_RESERVAS);
  
  if (!sheet) {
    sheet = ss.insertSheet(HOJA_RESERVAS);
    const headers = [
      'ID_RESERVA',          // Col 1 (A)
      'FECHA_SOLICITUD',     // Col 2 (B)
      'DNI',                 // Col 3 (C)
      'DOCENTE',             // Col 4 (D)
      'AULA',                // Col 5 (E)
      'ASIGNATURA',          // Col 6 (F)
      'MOTIVO',              // Col 7 (G)
      'TIPO_RESERVA',        // Col 8 (H) UNICA / RECURRENTE
      'FECHA',               // Col 9 (I) YYYY-MM-DD
      'FECHA_INICIO',        // Col 10 (J) YYYY-MM-DD
      'FECHA_FIN',           // Col 11 (K) YYYY-MM-DD
      'DIA_SEMANA',          // Col 12 (L) Lunes..Sábado
      'SEMANA_INICIO',       // Col 13 (M)
      'SEMANA_FIN',          // Col 14 (N)
      'HORA_INICIO',         // Col 15 (O) HH:mm
      'HORA_FIN',            // Col 16 (P) HH:mm
      'DURACION_HRS',        // Col 17 (Q)
      'ESTADO',              // Col 18 (R) PENDIENTE / APROBADA / RECHAZADA
      'CREADO_POR',          // Col 19 (S) DOCENTE / DIRECTORA
      'COMENTARIO_ADMIN'     // Col 20 (T) Motivo rechazo u observación
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#064e3b')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Helper: Convierte 'HH:mm' a minutos desde las 00:00 en Google Apps Script
 */
function horaToMinutosGAS(horaStr) {
  if (!horaStr) return 0;
  var str = String(horaStr).trim();
  var match = str.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/**
 * Helper: Verifica si dos intervalos horarios se solapan en Google Apps Script
 */
function solapanHorasGAS(iniA, finA, iniB, finB) {
  var a1 = horaToMinutosGAS(iniA);
  var a2 = horaToMinutosGAS(finA);
  var b1 = horaToMinutosGAS(iniB);
  var b2 = horaToMinutosGAS(finB);
  if (a1 === 0 && a2 === 0) return false;
  if (b1 === 0 && b2 === 0) return false;
  return Math.max(a1, b1) < Math.min(a2, b2);
}

/**
 * Helper: Normaliza código de aula (ej: 'LABORATORIO R-205' -> 'R-205')
 */
function normalizarAulaGAS(aulaStr) {
  if (!aulaStr) return '';
  var str = String(aulaStr).toUpperCase().trim();
  var match = str.match(/([RS]-\d{3})/i);
  if (match) return match[1].toUpperCase();
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Helper: Obtiene el día de la semana en español para una fecha YYYY-MM-DD
 */
function getDiaSemanaGAS(fechaStr) {
  if (!fechaStr) return '';
  try {
    var d = new Date(fechaStr + 'T12:00:00');
    if (isNaN(d.getTime())) return '';
    var dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    return dias[d.getDay()];
  } catch (e) {
    return '';
  }
}

/**
 * Consulta todas las reservas registradas
 * Utiliza getDisplayValues() para obtener el formato visual exacto de cada celda ('08:30', '10:30')
 * evitando conversiones no deseadas a objetos Date de 1899.
 */
function getReservasSheet() {
  const sheet = getSheetReservas();
  const range = sheet.getDataRange();
  const data = range.getValues();
  const displayData = range.getDisplayValues();
  const reservas = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dispRow = displayData[i] || [];
    if (!row[0]) continue;

    let fechaStr = dispRow[8] || (row[8] instanceof Date 
      ? Utilities.formatDate(row[8], Session.getScriptTimeZone(), 'yyyy-MM-dd') 
      : String(row[8] || '').trim());

    let fechaIniStr = dispRow[9] || (row[9] instanceof Date 
      ? Utilities.formatDate(row[9], Session.getScriptTimeZone(), 'yyyy-MM-dd') 
      : String(row[9] || '').trim());

    let fechaFinStr = dispRow[10] || (row[10] instanceof Date 
      ? Utilities.formatDate(row[10], Session.getScriptTimeZone(), 'yyyy-MM-dd') 
      : String(row[10] || '').trim());

    const hIniRaw = dispRow[14] || row[14];
    const hFinRaw = dispRow[15] || row[15];
    const horaIniFormateada = formatHoraCell(hIniRaw);
    const horaFinFormateada = formatHoraCell(hFinRaw);

    reservas.push({
      id: String(row[0]),
      fechaSolicitud: String(dispRow[1] || row[1] || ''),
      dni: String(dispRow[2] || row[2] || ''),
      docente: String(row[3] || ''),
      docenteDni: String(dispRow[2] || row[2] || ''),
      docenteNombre: String(row[3] || ''),
      aula: String(row[4] || ''),
      asignatura: String(row[5] || ''),
      motivo: String(row[6] || ''),
      tipoReserva: String(row[7] || 'UNICA'),
      fecha: normalizeDateStr(fechaStr, Session.getScriptTimeZone()),
      fechaInicio: normalizeDateStr(fechaIniStr || fechaStr, Session.getScriptTimeZone()),
      fechaFin: normalizeDateStr(fechaFinStr || fechaStr, Session.getScriptTimeZone()),
      diaSemana: String(row[11] || ''),
      semanaInicio: Number(row[12] || 1),
      semanaFin: Number(row[13] || 18),
      horaInicio: horaIniFormateada,
      horaFin: horaFinFormateada,
      duracionHrs: Number(row[16] || 2),
      estado: String(row[17] || 'PENDIENTE'),
      creadoPor: String(row[18] || 'DOCENTE'),
      comentarioAdmin: String(row[19] || '')
    });
  }

  return reservas.reverse();
}

/**
 * Registra una nueva reserva (docente o directora)
 * Incluye validación de concurrencia y conflicto en el servidor.
 */
function crearReservaSheet(p) {
  // Desempaquetar si viene anidado en 'reserva' o directamente
  const r = (p && typeof p.reserva === 'object' && p.reserva !== null) ? p.reserva : (p || {});
  const sheet = getSheetReservas();
  const idReserva = r.id || p.id || ('RES_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000));
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  const aulaNueva = String(r.aula || p.aula || '').trim();
  const hIniNueva = formatHoraCell(r.horaInicio || p.horaInicio || '');
  const hFinNueva = formatHoraCell(r.horaFin || p.horaFin || '');
  const tipoNueva = String(r.tipoReserva || p.tipoReserva || 'UNICA').trim().toUpperCase();
  const fechaNueva = normalizeDateStr(r.fecha || p.fecha || '', Session.getScriptTimeZone());
  const diaNueva = String(r.diaSemana || p.diaSemana || '').trim().toLowerCase();

  if (!aulaNueva || !hIniNueva || !hFinNueva) {
    return {
      success: false,
      message: 'Faltan datos obligatorios para la reserva (Aula, Hora Inicio o Fin).'
    };
  }

  // 1. VALIDACIÓN CONTRA RESERVAS EXISTENTES EN GOOGLE SHEETS
  const existentes = getReservasSheet();
  for (var k = 0; k < existentes.length; k++) {
    var ex = existentes[k];
    if (ex.id === idReserva) continue;
    if (String(ex.estado).toUpperCase() === 'RECHAZADA') continue;

    if (normalizarAulaGAS(ex.aula) === normalizarAulaGAS(aulaNueva)) {
      var coincideDia = false;
      var exTipo = String(ex.tipoReserva).toUpperCase();
      var exDia = String(ex.diaSemana).trim().toLowerCase();
      var exFecha = String(ex.fecha || '').trim().slice(0, 10);

      if (tipoNueva === 'UNICA' && exTipo === 'UNICA') {
        coincideDia = (fechaNueva && exFecha && fechaNueva === exFecha);
      } else if (tipoNueva === 'RECURRENTE' && exTipo === 'RECURRENTE') {
        coincideDia = (diaNueva && exDia && diaNueva === exDia);
      } else if (tipoNueva === 'UNICA' && exTipo === 'RECURRENTE') {
        var diaSemFecha = getDiaSemanaGAS(fechaNueva);
        coincideDia = (diaSemFecha === exDia || diaNueva === exDia);
      } else if (tipoNueva === 'RECURRENTE' && exTipo === 'UNICA') {
        var diaSemEx = getDiaSemanaGAS(exFecha);
        coincideDia = (diaNueva === diaSemEx || diaNueva === exDia);
      }

      if (coincideDia && solapanHorasGAS(hIniNueva, hFinNueva, ex.horaInicio, ex.horaFin)) {
        return {
          success: false,
          message: 'Conflicto: El ambiente ' + aulaNueva + ' ya tiene una reserva en ese horario (' + (ex.docente || 'Docente') + ' - ' + (ex.asignatura || 'Clase') + ' de ' + ex.horaInicio + ' a ' + ex.horaFin + ').'
        };
      }
    }
  }

  // 2. INSERTAR FILA EN LA HOJA
  const newRow = [
    idReserva,
    timestamp,
    String(r.dni || r.docenteDni || p.dni || '').trim(),
    String(r.docente || r.docenteNombre || p.docente || '').trim(),
    aulaNueva,
    String(r.asignatura || p.asignatura || '').trim(),
    String(r.motivo || p.motivo || '').trim(),
    tipoNueva,
    fechaNueva,
    String(r.fechaInicio || r.fecha || p.fechaInicio || p.fecha || '').trim(),
    String(r.fechaFin || r.fecha || p.fechaFin || p.fecha || '').trim(),
    String(r.diaSemana || p.diaSemana || '').trim(),
    Number(r.semanaInicio || p.semanaInicio || 1),
    Number(r.semanaFin || p.semanaFin || 18),
    hIniNueva,
    hFinNueva,
    Number(r.duracionHrs || p.duracionHrs || 2),
    String(r.estado || p.estado || 'PENDIENTE').toUpperCase().trim(),
    String(r.creadoPor || p.creadoPor || 'DOCENTE').trim(),
    String(r.comentarioAdmin || p.comentarioAdmin || '').trim()
  ];

  sheet.appendRow(newRow);
  return { 
    success: true, 
    message: 'Reserva registrada con éxito en Google Sheets.', 
    data: { id: idReserva } 
  };
}

/**
 * Actualiza el estado (APROBADA / RECHAZADA) y comentario de Dirección
 */
function actualizarEstadoReservaSheet(p) {
  const r = (p && typeof p.reserva === 'object' && p.reserva !== null) ? p.reserva : (p || {});
  const sheet = getSheetReservas();
  const data = sheet.getDataRange().getValues();
  const targetId = String(r.id || p.id || '').trim();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === targetId) {
      const rowNum = i + 1;
      const nuevoEstado = r.estado || p.estado;
      const nuevoComentario = r.comentarioAdmin !== undefined ? r.comentarioAdmin : p.comentarioAdmin;

      if (nuevoEstado) sheet.getRange(rowNum, 18).setValue(String(nuevoEstado).toUpperCase().trim());
      if (nuevoComentario !== undefined) sheet.getRange(rowNum, 20).setValue(String(nuevoComentario).trim());

      return { 
        success: true, 
        message: 'Estado de reserva actualizado a: ' + nuevoEstado 
      };
    }
  }

  return { success: false, message: 'No se encontró la reserva con ID: ' + targetId };
}

/**
 * Elimina una reserva de la hoja
 */
function eliminarReservaSheet(id) {
  const sheet = getSheetReservas();
  const data = sheet.getDataRange().getValues();
  const targetId = String(id || '').trim();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === targetId) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Reserva eliminada de Google Sheets.' };
    }
  }

  return { success: false, message: 'No se encontró la reserva para eliminar.' };
}

// ══════════════════════════════════════════════════════════════
// MÓDULO DE SOPORTE E INCIDENCIAS EN AULA (TIEMPO REAL)
// ══════════════════════════════════════════════════════════════

/**
 * Obtiene la pestaña de incidencias o la crea automáticamente con encabezados si no existe
 */
function getSheetIncidencias() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(HOJA_INCIDENCIAS);
  if (!sheet) {
    sheet = ss.insertSheet(HOJA_INCIDENCIAS);
    sheet.appendRow([
      'ID',
      'TIMESTAMP',
      'FECHA_HORA',
      'TIPO',
      'AULA',
      'DOCENTE_DNI',
      'DOCENTE_NOMBRE',
      'ASIGNATURA',
      'TITULO',
      'DESCRIPCION',
      'CATEGORIA',
      'ESTADO',
      'ATENDIDO_POR',
      'NOTA_RESOLUCION',
      'TIEMPO_RESPUESTA_MIN'
    ]);
    sheet.getRange(1, 1, 1, 15).setFontWeight('bold').setBackground('#b91c1c').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Consulta todas las incidencias registradas en la hoja INCIDENCIAS
 */
function getIncidenciasSheet() {
  const sheet = getSheetIncidencias();
  const range = sheet.getDataRange();
  const data = range.getValues();
  const displayData = range.getDisplayValues();
  const incidencias = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dispRow = displayData[i] || [];
    if (!row[0]) continue;

    incidencias.push({
      id: String(row[0]),
      timestamp: String(dispRow[1] || row[1] || ''),
      fechaHora: String(dispRow[2] || row[2] || ''),
      tipo: String(row[3] || 'URGENTE').toUpperCase(),
      aula: String(row[4] || ''),
      docenteDni: String(dispRow[5] || row[5] || ''),
      docenteNombre: String(row[6] || ''),
      asignatura: String(row[7] || ''),
      titulo: String(row[8] || ''),
      descripcion: String(row[9] || ''),
      categoria: String(row[10] || ''),
      estado: String(row[11] || 'NUEVO').toUpperCase(),
      atendidoPor: String(row[12] || ''),
      notaResolucion: String(row[13] || ''),
      tiempoRespuestaMin: row[14] ? Number(row[14]) : null
    });
  }

  return incidencias.reverse();
}

/**
 * Registra una nueva incidencia reportada por un docente o soporte
 */
function crearIncidenciaSheet(payload) {
  const sheet = getSheetIncidencias();
  const now = new Date();
  const idGen = payload.id || ('INC-' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss'));
  const timestamp = payload.timestamp || Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  const fechaHora = payload.fechaHora || Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy, HH:mm');

  const newRow = [
    idGen,
    timestamp,
    fechaHora,
    String(payload.tipo || 'URGENTE').toUpperCase(),
    String(payload.aula || 'Ambiente no especificado'),
    String(payload.docenteDni || ''),
    String(payload.docenteNombre || 'Docente'),
    String(payload.asignatura || ''),
    String(payload.titulo || 'Incidencia'),
    String(payload.descripcion || ''),
    String(payload.categoria || ''),
    String(payload.estado || 'NUEVO').toUpperCase(),
    String(payload.atendidoPor || ''),
    String(payload.notaResolucion || ''),
    payload.tiempoRespuestaMin ? Number(payload.tiempoRespuestaMin) : ''
  ];

  sheet.appendRow(newRow);

  return {
    success: true,
    message: 'Incidencia registrada con éxito en Google Sheets.',
    data: { id: idGen }
  };
}

/**
 * Actualiza el estado (EN_CAMINO, RESUELTO, etc.) y notas de resolución de una incidencia
 */
function actualizarEstadoIncidenciaSheet(payload) {
  const sheet = getSheetIncidencias();
  const data = sheet.getDataRange().getValues();
  const targetId = String(payload.id || '').trim();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === targetId) {
      const rowNum = i + 1;
      if (payload.estado) {
        sheet.getRange(rowNum, 12).setValue(String(payload.estado).toUpperCase().trim());
      }
      if (payload.atendidoPor !== undefined) {
        sheet.getRange(rowNum, 13).setValue(String(payload.atendidoPor).trim());
      }
      if (payload.notaResolucion !== undefined) {
        sheet.getRange(rowNum, 14).setValue(String(payload.notaResolucion).trim());
      }
      if (payload.tiempoRespuestaMin !== undefined && payload.tiempoRespuestaMin !== null) {
        sheet.getRange(rowNum, 15).setValue(Number(payload.tiempoRespuestaMin));
      }

      return {
        success: true,
        message: 'Incidencia ' + targetId + ' actualizada con éxito.'
      };
    }
  }

  return {
    success: false,
    message: 'No se encontró la incidencia con ID: ' + targetId
  };
}

/**
 * Elimina una incidencia de la hoja INCIDENCIAS
 */
function eliminarIncidenciaSheet(id) {
  const sheet = getSheetIncidencias();
  const data = sheet.getDataRange().getValues();
  const targetId = String(id || '').trim();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === targetId) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Incidencia eliminada de Google Sheets.' };
    }
  }

  return { success: false, message: 'No se encontró la incidencia para eliminar.' };
}