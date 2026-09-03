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
      if (!row[0] && !row[1]) continue; // Fila vacía
      horarios.push({
        codigo: String(row[0] || '').trim(),
        curso: String(row[1] || '').trim(),
        docente: String(row[2] || '').trim(),
        seccion: String(row[3] || '').trim(),
        dia: String(row[4] || '').trim(),
        horaInicio: String(row[5] || '').trim(),
        horaFin: String(row[6] || '').trim(),
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
 * Busca por nombre completo en HORARIOS o resuelve DNI→nombre via MAESTRO_DOCENTES.
 */
function getHorarioDocente(nombreDocente, dniDocente) {
  try {
    // Si se proporciona DNI, resolver a nombre desde MAESTRO_DOCENTES
    let nombreBuscar = nombreDocente.toUpperCase();
    
    if (dniDocente && !nombreDocente) {
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

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(HOJA_HORARIOS);
    if (!sheet) return { horarios: [], mensaje: 'La pestaña HORARIOS no existe.' };

    const data = sheet.getDataRange().getValues();
    const horarios = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const docHorario = String(row[2] || '').trim().toUpperCase();
      
      // Coincidencia exacta o parcial (el nombre en HORARIOS puede tener formato ligeramente diferente)
      if (docHorario === nombreBuscar || 
          docHorario.indexOf(nombreBuscar) !== -1 || 
          nombreBuscar.indexOf(docHorario) !== -1) {
        horarios.push({
          codigo: String(row[0] || '').trim(),
          curso: String(row[1] || '').trim(),
          docente: String(row[2] || '').trim(),
          seccion: String(row[3] || '').trim(),
          dia: String(row[4] || '').trim(),
          horaInicio: String(row[5] || '').trim(),
          horaFin: String(row[6] || '').trim(),
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
          horaInicio: String(row[5] || '').trim(),
          horaFin: String(row[6] || '').trim(),
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