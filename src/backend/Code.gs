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
 *    | 70123456 | D001   | Ing. Carlos Mendoza Quispe| Facultad de Ingeniería| Escuela Prof. de Ingeniería Civil  | Ingeniería Civil     | Topografía I - A, Mecánica de Suelos - B   |
 * 
 *    NOTA: Los cursos van separados por comas en una sola celda y ya incluyen la sección (ej. "FÍSICA II - A").
 * 
 * 3. Estructura de la pestaña "BASE_DE_DATOS" (fila 1 = encabezados):
 *    | A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q | R | S |
 *    | TIMESTAMP | DNI | DOCENTE | FACULTAD | ESCUELA | CARRERA | N° | AULA/LAB | FECHA | ASIGNATURA | UNIDAD | SEMANA | TEMA PROGRAMADO | RECURSOS UTILIZADOS | HORA INICIO | HORA FINALIZACION | N° ESTUDIANTES | VALIDACION | OBSERVACIONES |
 * 
 * 4. Reemplazar SPREADSHEET_ID con el ID real del Google Sheets.
 * 
 * 5. Desplegar como "Aplicación Web":
 *    - Ejecutar como: Yo (tu cuenta)
 *    - Acceso: Cualquier persona
 */

// ══════════════ CONFIGURACIÓN ══════════════
const SPREADSHEET_ID = 'TU_SPREADSHEET_ID_AQUI'; // ← Reemplazar con tu ID real
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

// ══════════════ doGet — BUSCAR DOCENTE ══════════════

/**
 * Maneja peticiones GET.
 * Parámetro esperado: ?id=70123456 (DNI o Código del docente)
 */
function doGet(e) {
  try {
    const id = (e.parameter.id || '').trim().toUpperCase();

    if (!id) {
      return createJsonResponse({
        success: false,
        message: 'Parámetro "id" es requerido.',
      });
    }

    const sheet = getSheet(HOJA_DOCENTES);
    const data = sheet.getDataRange().getValues();
    
    // Fila 0 = encabezados, iterar desde fila 1
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const dni = String(row[0]).trim().toUpperCase();
      const codigo = String(row[1]).trim().toUpperCase();

      if (dni === id || codigo === id) {
        // Parsear cursos: "Topografía I - A, Mecánica de Suelos - B"
        const cursosRaw = String(row[6] || '');
        const cursos = cursosRaw
          .split(',')
          .map(c => c.trim())
          .filter(c => c.length > 0);

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

// ══════════════ doPost — REGISTRAR SESIÓN ══════════════

/**
 * Maneja peticiones POST.
 * Recibe un JSON con todos los datos de la sesión.
 * Inserta una nueva fila en la pestaña BASE_DE_DATOS.
 * 
 * Payload esperado:
 * {
 *   dni, docente, facultad, escuela, carrera,
 *   numero, aulaLab, fecha, asignatura,
 *   unidad, semanaAcademica, temaProgramado,
 *   recursos, horaInicio, horaFinalizacion,
 *   numEstudiantes, observaciones
 * }
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const sheet = getSheet(HOJA_DATOS);

    // Construir los recursos como texto legible
    const recursosText = Array.isArray(payload.recursos)
      ? payload.recursos.join(', ')
      : String(payload.recursos || '');

    // Timestamp del servidor
    const timestamp = new Date();
    const timestampStr = Utilities.formatDate(
      timestamp, 
      Session.getScriptTimeZone(), 
      'dd/MM/yyyy HH:mm:ss'
    );

    // Construir fila en el orden exacto de las 19 columnas de BASE_DE_DATOS
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
      payload.asignatura || '',              // J: ASIGNATURA (incluye sección)
      payload.unidad || '',                  // K: UNIDAD
      payload.semanaAcademica || '',         // L: SEMANA
      payload.temaProgramado || '',          // M: TEMA PROGRAMADO
      recursosText,                          // N: RECURSOS UTILIZADOS
      payload.horaInicio || '',              // O: HORA INICIO
      payload.horaFinalizacion || '',        // P: HORA FINALIZACIÓN
      payload.numEstudiantes || '',          // Q: N° ESTUDIANTES
      '',                                    // R: VALIDACIÓN (lo llena la directora)
      payload.observaciones || '',           // S: OBSERVACIONES
    ];

    // Insertar al final de la hoja
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

// ══════════════ FUNCIÓN DE PRUEBA ══════════════

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
