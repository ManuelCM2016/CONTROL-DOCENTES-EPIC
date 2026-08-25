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
 */
function doGet(e) {
  try {
    const id = (e.parameter.id || '').trim().toUpperCase();
    const action = (e.parameter.action || '').trim().toLowerCase();
    const idNorm = normalizeDni(id);

    // ── Acciones ADMIN (no requieren id) ──
    
    if (action === 'monitoreo') {
      return createJsonResponse({ success: true, data: getMonitoreoActivo() });
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
  try {
    const payload = JSON.parse(e.postData.contents);
    const actionPost = (payload.action || '').trim().toLowerCase();
    const sheet = getSheet(HOJA_DATOS);

    // ══════════════════════════════════════════
    // FASE 1: INICIO DE CLASE (registro parcial)
    // ══════════════════════════════════════════
    if (actionPost === 'inicio') {
      const timestamp = new Date();
      const timestampStr = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');

      // Verificar que no exista ya una sesión ACTIVA para este DNI + fecha + horaInicio
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
            message: 'La sesión de inicio ya fue registrada previamente.',
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
        payload.fecha || '',                   // I: FECHA
        payload.asignatura || '',              // J: ASIGNATURA
        payload.seccion || '',                 // K: SECCIÓN
        payload.unidad || '',                  // L: UNIDAD
        payload.semanaAcademica || '',         // M: SEMANA
        '',                                    // N: TEMA (se llena al cierre)
        '',                                    // O: RECURSOS (se llena al cierre)
        payload.horaInicio || '',              // P: HORA INICIO
        '',                                    // Q: HORA FIN (se llena al cierre)
        '',                                    // R: N° ESTUDIANTES (se llena al cierre)
        'PENDIENTE',                           // S: VALIDACIÓN
        '',                                    // T: OBSERVACIONES
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

      let filaActiva = -1;

      // Buscar la fila ACTIVA que coincida con DNI + fecha + horaInicio
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

        if (
          (rowDni === targetDni || (rowDniNorm !== '' && rowDniNorm === targetDniNorm)) &&
          rowFecha === targetFecha &&
          rowHoraInicio === targetHoraInicio &&
          rowEstado === 'ACTIVO'
        ) {
          filaActiva = i + 1; // Convertir índice 0 a fila 1-indexed de Sheets
          break;
        }
      }

      // Construir recursos como texto
      const recursosText = Array.isArray(payload.recursos)
        ? payload.recursos.join(', ')
        : String(payload.recursos || '');

      if (filaActiva !== -1) {
        // Actualizar la fila existente con los datos completos
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
  }
}

// ══════════════ FUNCIONES ADMIN — MONITOREO Y ESTADÍSTICAS ══════════════

/**
 * Devuelve las clases activas y completadas de HOY para el Panel de Monitoreo
 * Incluye lista de docentes registrados como referencia
 */
function getMonitoreoActivo() {
  const sheetBD = getSheet(HOJA_DATOS);
  const dataBD = sheetBD.getDataRange().getValues();
  const sheetDoc = getSheet(HOJA_DOCENTES);
  const dataDoc = sheetDoc.getDataRange().getValues();
  
  const hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  
  const activas = [];
  const completadasHoy = [];
  
  for (let i = 1; i < dataBD.length; i++) {
    const row = dataBD[i];
    let fechaStr = row[8] instanceof Date
      ? Utilities.formatDate(row[8], Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : String(row[8] || '').trim();
    
    if (fechaStr !== hoy) continue;
    
    const estado = String(row[22] || '').trim().toUpperCase();
    const sesion = {
      fila: i + 1,
      dni: String(row[1] || ''),
      docente: String(row[2] || ''),
      aula: String(row[7] || ''),
      asignatura: String(row[9] || ''),
      horaInicio: row[15] instanceof Date
        ? Utilities.formatDate(row[15], Session.getScriptTimeZone(), 'HH:mm:ss')
        : String(row[15] || ''),
      horaFin: row[16] instanceof Date
        ? Utilities.formatDate(row[16], Session.getScriptTimeZone(), 'HH:mm:ss')
        : String(row[16] || ''),
      numEstudiantes: String(row[17] || ''),
      tema: String(row[13] || ''),
      estado: estado || 'COMPLETADO', // Registros antiguos sin columna W
    };
    
    if (estado === 'ACTIVO') {
      activas.push(sesion);
    } else {
      completadasHoy.push(sesion);
    }
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
  
  return {
    fecha: hoy,
    activas: activas,
    completadasHoy: completadasHoy,
    todosDocentes: todosDocentes,
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