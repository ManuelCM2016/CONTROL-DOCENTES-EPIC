/**
 * Utilidades de Calendario Académico Semestre 2026-II — Universidad Privada de Tacna
 * 
 * Parámetros oficiales:
 * - Inicio de clases: 17 de agosto de 2026 (Lunes)
 * - Fin de semestre: 18 de diciembre de 2026 (Viernes)
 * - Total: 18 semanas académicas
 * - Unidad I: Semanas 1 a 6 (Semana 6: Juegos Florales / Recuperación)
 * - Unidad II: Semanas 7 a 12
 * - Unidad III: Semanas 13 a 18
 */

export const SEMESTRE_CONFIG = {
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

/**
 * Calcula la semana académica y unidad según una fecha dada (YYYY-MM-DD o Date)
 * @param {string|Date} fecha
 * @returns {{ semana: number, unidad: string, esJuegosFlorales: boolean, detalle: string }}
 */
export const calcularSemanaYUnidad = (fecha) => {
  const fechaActual = fecha ? new Date(fecha + 'T12:00:00') : new Date()
  const fechaInicio = new Date(SEMESTRE_CONFIG.fechaInicio + 'T00:00:00')
  
  // Diferencia en días respecto al lunes de inicio
  const diffMs = fechaActual.getTime() - fechaInicio.getTime()
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  // Semana calculada (1 a 18)
  let semana = Math.floor(diffDias / 7) + 1
  
  if (semana < 1) semana = 1
  if (semana > SEMESTRE_CONFIG.totalSemanas) semana = SEMESTRE_CONFIG.totalSemanas

  // Determinar unidad (6 semanas por unidad)
  let unidad = 'I'
  if (semana >= 7 && semana <= 12) {
    unidad = 'II'
  } else if (semana >= 13) {
    unidad = 'III'
  }

  const esJuegosFlorales = semana === SEMESTRE_CONFIG.semanaJuegosFlorales

  return {
    semana,
    unidad,
    esJuegosFlorales,
    detalle: esJuegosFlorales
      ? '🎉 Semana 6 — Juegos Florales / Recuperación'
      : `Semana ${semana} — Unidad ${unidad}`,
  }
}

/**
 * Obtiene el siguiente número de registro para un docente
 * @param {string} dniDocente
 * @returns {string}
 */
export const getSiguienteNumeroRegistro = (dniDocente) => {
  try {
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
    localStorage.setItem(key, String(num))
  } catch (e) {
    console.warn('Error guardando correlativo de registro:', e)
  }
}
