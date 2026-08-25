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

// ══════════════ doGet — BUSCAR DOCENTE ══════════════

/**
 * Maneja peticiones GET.
 * Parámetro esperado: ?id=70123456 (DNI o Código del docente)
 * 
 * Respuesta exitosa:
 * {
 *   success: true,
 *   data: {
 *     dni: "70123456",
 *     codigo: "D001",
 *     nombre: "Ing. Carlos Mendoza Quispe",
 *     facultad: "Facultad de Ingeniería",
 *     escuela: "Escuela Prof. de Ingeniería Civil",
 *     carrera: "Ingeniería Civil",
 *     cursos: ["Topografía I", "Mecánica de Suelos", "Geodesia"]
 *   }
 * }
 * 
 * Respuesta de error:
 * { success: false, message: "Docente no encontrado" }
 */
function doGet(e) {
  try {
    const id = (e.parameter.id || '').trim().toUpperCase();
    const action = (e.parameter.action || '').trim().toLowerCase();

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

      if (dni === id || codigo === id) {
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
    
    // Iterar en orden inverso (más recientes primero)
    for (let i = dataBD.length - 1; i >= 1; i--) {
      const rowBD = dataBD[i];
      const rowDni = String(rowBD[1]).trim().toUpperCase();
      
      if (rowDni === dni || (codigo && rowDni === codigo)) {
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

// ══════════════ doPost — REGISTRAR SESIÓN ══════════════

/**
 * Maneja peticiones POST.
 * Recibe un JSON con todos los datos de la sesión.
 * Inserta una nueva fila en la pestaña BASE_DE_DATOS.
 * 
 * Payload esperado:
 * {
 *   dni, docente, facultad, escuela, carrera,
 *   numero, aulaLab, fecha, asignatura, seccion,
 *   unidad, semanaAcademica, temaProgramado,
 *   recursos, horaInicio, horaFinalizacion,
 *   numEstudiantes, observaciones
 * }
 */
function doPost(e) {
  try {
    // Parsear el body del POST
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

    // Construir fila en el orden exacto de las columnas de BASE_DE_DATOS
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
     'PENDIENTE',                            // S: VALIDACIÓN (lo llena la directora)
      payload.observaciones || '',           // T: OBSERVACIONES
      
      // --- NUEVAS VARIABLES AGREGADAS AQUÍ ---
      payload.tipo_sesion || 'Clase Regular',// U: TIPO DE SESIÓN 
      payload.fecha_recuperar || '',         // V: FECHA A RECUPERAR 
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