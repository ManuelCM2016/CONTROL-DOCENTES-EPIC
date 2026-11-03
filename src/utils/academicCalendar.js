/**
 * Utilidades de Calendario Académico — Universidad Privada de Tacna
 * Configuración dinámica de Semestre y Detección Inteligente de Docentes
 */

export const SEMESTRE_CONFIG_DEFAULT = {
  nombre: '2026-II',
  fechaInicio: '2026-08-17',
  fechaFin: '2026-12-18',
  totalSemanas: 18,
  unidades: [
    { id: 'I', label: 'Unidad I', semanas: [1, 2, 3, 4, 5, 6] },
    { id: 'II', label: 'Unidad II', semanas: [7, 8, 9, 10, 11, 12] },
    { id: 'III', label: 'Unidad III', semanas: [13, 14, 15, 16, 17, 18] },
  ],
  semanaJuegosFlorales: 6,
}

// Compatibilidad hacia atrás
export const SEMESTRE_CONFIG = SEMESTRE_CONFIG_DEFAULT

/**
 * Obtiene la configuración actual del semestre desde localStorage o valor por defecto
 */
export const getSemestreConfig = () => {
  try {
    const saved = localStorage.getItem('upt_semestre_config')
    if (saved) {
      const parsed = JSON.parse(saved)
      return { ...SEMESTRE_CONFIG_DEFAULT, ...parsed }
    }
  } catch (e) {
    console.warn('Error al leer semestre_config de localStorage:', e)
  }
  return SEMESTRE_CONFIG_DEFAULT
}

/**
 * Guarda la configuración del semestre en localStorage
 * Si el nombre del semestre cambió (ej: 2026-II -> 2027-I), reinicia automáticamente los correlativos
 */
export const saveSemestreConfig = (cfg) => {
  try {
    const current = getSemestreConfig()
    const updated = { ...current, ...cfg }
    localStorage.setItem('upt_semestre_config', JSON.stringify(updated))
    
    // Si cambió el nombre del semestre, reiniciar correlativos locales para que docentes empiecen en N° 1
    if (cfg.nombre && cfg.nombre !== current.nombre) {
      localStorage.setItem('upt_current_semester', cfg.nombre)
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('upt_registro_num_')) {
          localStorage.removeItem(key)
        }
      })
    }
    return updated
  } catch (e) {
    console.warn('Error al guardar semestre_config:', e)
    return SEMESTRE_CONFIG_DEFAULT
  }
}

/**
 * Calcula la semana académica y unidad según una fecha dada (YYYY-MM-DD o Date)
 * @param {string|Date} fecha
 * @returns {{ semana: number, unidad: string, esJuegosFlorales: boolean, detalle: string }}
 */
export const calcularSemanaYUnidad = (fecha) => {
  const config = getSemestreConfig()
  const fechaActual = fecha ? new Date(fecha + 'T12:00:00') : new Date()
  const fechaInicio = new Date(config.fechaInicio + 'T00:00:00')
  
  // Diferencia en días respecto al lunes de inicio
  const diffMs = fechaActual.getTime() - fechaInicio.getTime()
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  // Semana calculada (1 a totalSemanas)
  let semana = Math.floor(diffDias / 7) + 1
  
  if (semana < 1) semana = 1
  if (semana > config.totalSemanas) semana = config.totalSemanas

  // Determinar unidad (6 semanas por unidad típicamente)
  let unidad = 'I'
  if (semana >= 7 && semana <= 12) {
    unidad = 'II'
  } else if (semana >= 13) {
    unidad = 'III'
  }

  const esJuegosFlorales = semana === config.semanaJuegosFlorales

  return {
    semana,
    unidad,
    esJuegosFlorales,
    detalle: esJuegosFlorales
      ? `🎉 Semana ${config.semanaJuegosFlorales} — Juegos Florales / Recuperación`
      : `Semana ${semana} — Unidad ${unidad}`,
  }
}

/**
 * Obtiene el siguiente número de registro para un docente
 * Si detecta que estamos en un semestre nuevo, reinicia el contador a 1 automáticamente
 * @param {string} dniDocente
 * @returns {string}
 */
export const getSiguienteNumeroRegistro = (dniDocente) => {
  try {
    const config = getSemestreConfig()
    const currentSem = config.nombre || '2026-II'
    const savedSem = localStorage.getItem('upt_current_semester')

    if (savedSem && savedSem !== currentSem) {
      localStorage.setItem('upt_current_semester', currentSem)
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('upt_registro_num_')) {
          localStorage.removeItem(key)
        }
      })
    } else if (!savedSem) {
      localStorage.setItem('upt_current_semester', currentSem)
    }

    const key = `upt_registro_num_${dniDocente || 'global'}`
    const lastNum = parseInt(localStorage.getItem(key), 10)
    if (!isNaN(lastNum) && lastNum >= 1) {
      return String(lastNum + 1)
    }
  } catch (e) {
    console.warn('Error leyendo correlativo de registro:', e)
  }
  return '1'
}

/**
 * Guarda el número de registro completado para incrementar el correlativo
 * @param {string} dniDocente
 * @param {string|number} numRegistrado
 */
export const guardarNumeroRegistroCompletado = (dniDocente, numRegistrado) => {
  try {
    const key = `upt_registro_num_${dniDocente || 'global'}`
    const num = parseInt(numRegistrado, 10) || 1
    const current = parseInt(localStorage.getItem(key), 10) || 0
    if (num >= current) {
      localStorage.setItem(key, String(num))
    }
  } catch (e) {
    console.warn('Error guardando correlativo de registro:', e)
  }
}

/**
 * Normaliza nombres de docentes para matching inteligente:
 * - Quita prefijos (DOCENTE:, MTRO., ING., DR., DRA., etc.)
 * - Quita tildes, comas, puntos y espacios extras
 */
export const normalizeNombreDocente = (nombre) => {
  if (!nombre) return ''
  let n = String(nombre).trim().toUpperCase()
  n = n.replace(/^(DOCENTE:|MTRO\.|MTRA\.|ING\.|DR\.|DRA\.|MG\.|MGR\.|MSC\.|LIC\.|PROF\.|ARQ\.)\s*/gi, '')
  n = n.replace(/[ÁÀÂÄ]/g, 'A').replace(/[ÉÈÊË]/g, 'E').replace(/[ÍÌÎÏ]/g, 'I')
       .replace(/[ÓÒÔÖ]/g, 'O').replace(/[ÚÙÛÜ]/g, 'U').replace(/[Ñ]/g, 'N')
  n = n.replace(/[,\.]/g, ' ')
  n = n.replace(/\s+/g, ' ').trim()
  return n
}

/**
 * Determina si dos cadenas de nombre corresponden al mismo docente
 * Soporta orden invertido (Apellidos, Nombres vs Nombres Apellidos) y prefijos
 */
export const coincideDocente = (nombreA, nombreB) => {
  const nA = normalizeNombreDocente(nombreA)
  const nB = normalizeNombreDocente(nombreB)
  if (!nA || !nB) return false
  if (nA === nB) return true
  if (nA.includes(nB) || nB.includes(nA)) return true

  // Comparación por tokens
  const tokensA = nA.split(' ').filter(t => t.length > 2)
  const tokensB = nB.split(' ').filter(t => t.length > 2)
  if (tokensA.length === 0 || tokensB.length === 0) return false

  const coincidencias = tokensA.filter(t => tokensB.includes(t))
  return coincidencias.length >= 2 && (coincidencias.length >= Math.min(tokensA.length, tokensB.length) - 1)
}
