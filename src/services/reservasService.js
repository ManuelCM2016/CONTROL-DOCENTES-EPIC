import { GOOGLE_SCRIPT_URL, API_TIMEOUT } from '../config/api'
import HORARIOS_DEFAULT from '../data/horarios_procesados.json'
import { calcularSemanaYUnidad } from '../utils/academicCalendar'

const RESERVAS_STORAGE_KEY = 'epic_reservas_db'

/**
 * Lista maestra institucional completa de todos los Ambientes (Aulas y Laboratorios)
 */
export const AULAS_LABORATORIOS_MASTER = [
  'BLOQUE R-207',
  'LABORATORIO R-205',
  'LABORATORIO R-206',
  'BLOQUE R-303',
  'BLOQUE R-308',
  'BLOQUE R-315',
  'BLOQUE R-316',
  'BLOQUE R-317',
  'BLOQUE R-408',
  'BLOQUE R-415',
  'BLOQUE R-416',
  'BLOQUE R-417',
  'SUELOS S-206',
  'SUELOS S-301',
  'SUELOS S-303',
  'SUELOS S-305',
  'SUELOS S-306',
  'SUELOS S-307',
  'Laboratorio de Física',
  'Laboratorio de Química',
  'Laboratorio de Mecánica de Suelos',
  'Laboratorio de Concreto',
  'Laboratorio de Pavimentos',
  'Laboratorio de Estructuras',
  'Laboratorio de Hidráulica',
  'Gabinete de Topografía',
  'Laboratorio BIM',
]

/**
 * Normaliza nombres de días para comparación robusta (sin tildes, minúsculas)
 */
export const normalizarDia = (dia) => {
  return String(dia || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Obtiene el día de la semana en español a partir de una fecha YYYY-MM-DD
 */
export const getDiaSemanaFromDate = (fechaStr) => {
  if (!fechaStr) return ''
  const cleanFecha = String(fechaStr).trim().slice(0, 10)
  const d = new Date(cleanFecha + 'T12:00:00')
  if (isNaN(d.getTime())) return ''
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  return dias[d.getDay()]
}

/**
 * Calcula la fecha calendario correspondiente al día de la semana objetivo
 * Para evitar fechas en el pasado, si el día ya transcurrió en la semana actual avanza a la siguiente.
 */
export const getDateForDayOfWeek = (diaNombre, refDate = new Date()) => {
  if (!diaNombre) return new Date().toLocaleDateString('en-CA')
  const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  const targetNorm = normalizarDia(diaNombre)
  const targetDayIdx = dias.indexOf(targetNorm)
  if (targetDayIdx === -1) return new Date().toLocaleDateString('en-CA')

  const current = new Date(refDate)
  const currentDayIdx = current.getDay()
  let diff = targetDayIdx - currentDayIdx
  if (diff < 0) {
    diff += 7
  }
  current.setDate(current.getDate() + diff)
  return current.toLocaleDateString('en-CA')
}

/**
 * Valida si un valor es una hora válida en formato HH:mm
 */
export const isHoraValida = (val) => {
  if (!val) return false
  const str = String(val).trim()
  if (str.toLowerCase().startsWith('sat') || str.toLowerCase().startsWith('sun') || str.toLowerCase().startsWith('thu')) {
    return false
  }
  return /^\d{1,2}:\d{2}/.test(str)
}

/**
 * Extrae y formatea una hora en formato HH:mm garantizado.
 * NUNCA retorna "Sat D" o texto inválido.
 */
export const formatHora = (val, fallback = '') => {
  if (!val) return fallback
  if (val instanceof Date) {
    const h = String(val.getHours()).padStart(2, '0')
    const m = String(val.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }
  const str = String(val).trim()
  // Si contiene "Sat D" u otros días de objetos Date corrompidos
  if (str.toLowerCase().includes('sat') || str.toLowerCase().includes('thu') || str.toLowerCase().includes('sun')) {
    const timeInDate = str.match(/(\d{1,2}):(\d{2})(?::\d{2})?/)
    if (timeInDate && parseInt(timeInDate[1], 10) >= 6 && parseInt(timeInDate[1], 10) <= 23) {
      return `${timeInDate[1].padStart(2, '0')}:${timeInDate[2]}`
    }
    return fallback
  }

  const m1 = str.match(/(?:T|\s|^)(\d{1,2}):(\d{2})/i)
  if (m1) {
    return `${m1[1].padStart(2, '0')}:${m1[2]}`
  }
  const m2 = str.match(/(\d{1,2}):(\d{2})/)
  if (m2) {
    return `${m2[1].padStart(2, '0')}:${m2[2]}`
  }
  return fallback
}

/**
 * Convierte "HH:MM" a minutos desde las 00:00
 */
export const horaToMinutos = (horaStr) => {
  if (!horaStr) return 0
  const clean = formatHora(horaStr)
  if (!clean || !clean.includes(':')) return 0
  const [h, m] = clean.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * Convierte minutos a "HH:mm"
 */
export const minutosToHora = (minutos) => {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Verifica si dos intervalos de tiempo se solapan
 */
export const solapanHoras = (iniA, finA, iniB, finB) => {
  const a1 = horaToMinutos(iniA)
  const a2 = horaToMinutos(finA)
  const b1 = horaToMinutos(iniB)
  const b2 = horaToMinutos(finB)
  if (a1 === 0 && a2 === 0) return false
  if (b1 === 0 && b2 === 0) return false
  return Math.max(a1, b1) < Math.min(a2, b2)
}

/**
 * Normaliza nombre de aula para coincidencia tolerante
 * Ej: "R-205" vs "LABORATORIO R-205" vs "R205"
 */
export const normalizarAula = (aulaStr) => {
  if (!aulaStr) return ''
  const str = String(aulaStr).toUpperCase().trim()
  const codeMatch = str.match(/([RS]-\d{3})/i)
  if (codeMatch) return codeMatch[1].toUpperCase()
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Verifica si dos aulas coinciden
 */
export const coincidenAulas = (aulaA, aulaB) => {
  if (!aulaA || !aulaB) return false
  const normA = normalizarAula(aulaA)
  const normB = normalizarAula(aulaB)
  if (normA && normB && normA === normB) return true
  const cleanA = String(aulaA).toUpperCase().trim()
  const cleanB = String(aulaB).toUpperCase().trim()
  return cleanA.includes(cleanB) || cleanB.includes(cleanA)
}

/**
 * Devuelve el nombre institucional canónico de un aula o laboratorio
 * Ej: "R-205" -> "LABORATORIO R-205", "R-207" -> "BLOQUE R-207"
 */
export const getNombreEstandarAula = (aulaStr) => {
  if (!aulaStr) return ''
  const str = String(aulaStr).trim()
  const found = AULAS_LABORATORIOS_MASTER.find(m => coincidenAulas(m, str))
  return found || str
}

// Wrapper fetch GAS con timeout
const fetchGAS = async (url, options = {}) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT || 25000)
  try {
    const response = await fetch(url, { ...options, redirect: 'follow', signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Normaliza y sanea un registro de reserva
 * Incluye auto-recuperación de horarios si venían dañados ("Sat D")
 */
export const normalizarReserva = (r) => {
  if (!r) return r
  let hIni = formatHora(r.horaInicio)
  let hFin = formatHora(r.horaFin)

  // Auto-recuperación si venía con "Sat D" o dañado
  if (!hIni || !hFin) {
    const dur = Number(r.duracionHrs || 2)
    if (dur === 2.5) {
      hIni = hIni || '08:00'
      hFin = hFin || '10:30'
    } else if (dur === 2) {
      hIni = hIni || '08:30'
      hFin = hFin || '10:30'
    } else {
      hIni = hIni || '08:00'
      hFin = hFin || '10:00'
    }
  }

  const fStr = r.fecha ? String(r.fecha).slice(0, 10) : ''
  const fIni = r.fechaInicio ? String(r.fechaInicio).slice(0, 10) : fStr
  const fFin = r.fechaFin ? String(r.fechaFin).slice(0, 10) : fStr
  const diaCalc = r.diaSemana || getDiaSemanaFromDate(fStr) || 'Lunes'

  return {
    ...r,
    fecha: fStr,
    fechaInicio: fIni,
    fechaFin: fFin,
    diaSemana: diaCalc,
    horaInicio: hIni,
    horaFin: hFin,
    duracionHrs: Number(r.duracionHrs) || ((horaToMinutos(hFin) - horaToMinutos(hIni)) / 60) || 2
  }
}

/**
 * Obtiene todas las reservas guardadas localmente (saneadas)
 */
export const getLocalReservas = () => {
  try {
    const raw = localStorage.getItem(RESERVAS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizarReserva) : []
  } catch (e) {
    console.warn('Error leyendo reservas locales:', e)
    return []
  }
}

/**
 * Guarda todas las reservas localmente
 * @param {Array} reservas
 * @param {boolean} notify - Si es true, notifica a los demás componentes
 */
export const saveLocalReservas = (reservas, notify = true) => {
  try {
    const saneadas = Array.isArray(reservas) ? reservas.map(normalizarReserva) : []
    localStorage.setItem(RESERVAS_STORAGE_KEY, JSON.stringify(saneadas))
    if (notify && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('epic_reservas_updated', { detail: saneadas }))
    }
  } catch (e) {
    console.warn('Error guardando reservas locales:', e)
  }
}

/**
 * Obtener lista completa de reservas (Backend Sheets + Local Fallback)
 */
export const obtenerReservas = async () => {
  const localData = getLocalReservas()
  if (!GOOGLE_SCRIPT_URL) {
    return { success: true, data: localData }
  }

  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=obtener_reservas`
    const response = await fetchGAS(url)
    const text = await response.text()
    const result = JSON.parse(text)
    if (result.success && Array.isArray(result.data)) {
      const incoming = result.data.map(normalizarReserva)
      // Fusionar protegiendo datos locales válidos frente a datos corruptos de la nube
      const map = new Map()
      localData.forEach(r => map.set(r.id, r))
      incoming.forEach(inc => {
        const local = map.get(inc.id)
        if (local) {
          const finalHIni = isHoraValida(inc.horaInicio) ? inc.horaInicio : (isHoraValida(local.horaInicio) ? local.horaInicio : inc.horaInicio)
          const finalHFin = isHoraValida(inc.horaFin) ? inc.horaFin : (isHoraValida(local.horaFin) ? local.horaFin : inc.horaFin)
          map.set(inc.id, {
            ...local,
            ...inc,
            horaInicio: finalHIni,
            horaFin: finalHFin
          })
        } else {
          map.set(inc.id, inc)
        }
      })
      const merged = Array.from(map.values()).map(normalizarReserva)
      // Guardar en caché sin disparar evento recursivo de actualización
      saveLocalReservas(merged, false)
      return { success: true, data: merged }
    }
    return { success: true, data: localData }
  } catch (error) {
    console.warn('Error al obtener reservas de la nube, usando base local:', error)
    return { success: true, data: localData }
  }
}

/**
 * Verificar disponibilidad en tiempo real de un ambiente
 * Retorna { disponible: boolean, conflicto: { tipo, detalle } | null }
 */
export const verificarDisponibilidadAmbiente = ({
  aula,
  fecha,
  diaSemana,
  horaInicio,
  horaFin,
  tipoReserva = 'UNICA',
  fechaInicio = null,
  fechaFin = null,
  semanaInicio = 1,
  semanaFin = 18,
  excluirReservaId = null,
  horariosSemestre = HORARIOS_DEFAULT,
  reservasExistentes = []
}) => {
  if (!aula || !horaInicio || !horaFin) {
    return { disponible: true, conflicto: null }
  }

  const hIniTarget = formatHora(horaInicio)
  const hFinTarget = formatHora(horaFin)
  if (!hIniTarget || !hFinTarget) {
    return { disponible: true, conflicto: null }
  }

  const diaObjetivo = tipoReserva === 'UNICA'
    ? (diaSemana || getDiaSemanaFromDate(fecha))
    : (diaSemana || 'Lunes')

  if (!diaObjetivo) {
    return { disponible: true, conflicto: null }
  }

  const diaNorm = normalizarDia(diaObjetivo)
  const semObjetivo = tipoReserva === 'UNICA' ? (calcularSemanaYUnidad(fecha)?.semana || 1) : null
  const semIniCalc = fechaInicio ? (calcularSemanaYUnidad(fechaInicio)?.semana || 1) : Number(semanaInicio || 1)
  const semFinCalc = fechaFin ? (calcularSemanaYUnidad(fechaFin)?.semana || 18) : Number(semanaFin || 18)

  // 1. Verificar contra Horario Oficial del Semestre
  const clasesFuentes = Array.isArray(horariosSemestre) && horariosSemestre.length > 0
    ? horariosSemestre
    : HORARIOS_DEFAULT

  for (const h of clasesFuentes) {
    const hAula = h.AULA || h.aula || ''
    const hDia = normalizarDia(h.DIA || h.dia || '')
    const hIni = formatHora(h.HORA_INICIO || h.hora_inicio || h.horaInicio || '')
    const hFin = formatHora(h.HORA_FIN || h.hora_fin || h.horaFin || '')

    if (hDia === diaNorm && coincidenAulas(hAula, aula)) {
      if (solapanHoras(hIniTarget, hFinTarget, hIni, hFin)) {
        const hCurso = h.CURSO || h.curso || 'Clase Oficial'
        const hDocente = h.DOCENTE || h.docente || 'Docente'
        const hSec = h.SECCION || h.seccion ? ` (${h.SECCION || h.seccion})` : ''
        return {
          disponible: false,
          conflicto: {
            tipo: 'CLASE_OFICIAL',
            detalle: `Ocupado por clase regular del semestre: ${hCurso}${hSec} • ${hDocente} (${hIni} - ${hFin})`
          }
        }
      }
    }
  }

  // 2. Verificar contra Reservas Existentes (Aprobadas y Pendientes de cualquier docente)
  const reservasActuales = Array.isArray(reservasExistentes) && reservasExistentes.length > 0
    ? reservasExistentes
    : getLocalReservas()

  for (const rawR of reservasActuales) {
    const r = normalizarReserva(rawR)
    if (excluirReservaId && r.id === excluirReservaId) continue
    if (String(r.estado).toUpperCase() === 'RECHAZADA') continue // Las rechazadas liberan el espacio

    if (coincidenAulas(r.aula, aula)) {
      let coincidenDias = false
      const rDiaNorm = normalizarDia(r.diaSemana || getDiaSemanaFromDate(r.fecha))

      if (r.tipoReserva === 'UNICA' && tipoReserva === 'UNICA') {
        const fR = String(r.fecha || '').slice(0, 10)
        const fT = String(fecha || '').slice(0, 10)
        coincidenDias = (fR && fT && fR === fT) || (rDiaNorm === diaNorm && (!fR || !fT || fR === fT))
      } else if (r.tipoReserva === 'UNICA' && tipoReserva === 'RECURRENTE') {
        const fR = String(r.fecha || '').slice(0, 10)
        const enRangoFecha = (!fechaInicio || fR >= fechaInicio) && (!fechaFin || fR <= fechaFin)
        const semResUnica = calcularSemanaYUnidad(fR)?.semana || 1
        const enRangoSem = semResUnica >= semIniCalc && semResUnica <= semFinCalc
        coincidenDias = (rDiaNorm === diaNorm) && (fechaInicio ? enRangoFecha : enRangoSem)
      } else if (r.tipoReserva === 'RECURRENTE' && tipoReserva === 'UNICA') {
        const fT = String(fecha || '').slice(0, 10)
        const enRangoFecha = (!r.fechaInicio || fT >= r.fechaInicio) && (!r.fechaFin || fT <= r.fechaFin)
        const enRangoSem = semObjetivo >= Number(r.semanaInicio || 1) && semObjetivo <= Number(r.semanaFin || 18)
        coincidenDias = (rDiaNorm === diaNorm) && (r.fechaInicio ? enRangoFecha : enRangoSem)
      } else if (r.tipoReserva === 'RECURRENTE' && tipoReserva === 'RECURRENTE') {
        const overlapFecha = (!fechaInicio || !r.fechaFin || fechaInicio <= r.fechaFin) && (!fechaFin || !r.fechaInicio || fechaFin >= r.fechaInicio)
        const semanaSolapa = Math.max(semIniCalc, Number(r.semanaInicio || 1)) <= Math.min(semFinCalc, Number(r.semanaFin || 18))
        coincidenDias = (rDiaNorm === diaNorm) && (fechaInicio && r.fechaInicio ? overlapFecha : semanaSolapa)
      }

      const rIni = formatHora(r.horaInicio)
      const rFin = formatHora(r.horaFin)

      if (coincidenDias && solapanHoras(hIniTarget, hFinTarget, rIni, rFin)) {
        const estadoLabel = r.estado === 'APROBADA' ? 'Reserva confirmada' : 'Solicitud pendiente de aprobación'
        return {
          disponible: false,
          conflicto: {
            tipo: 'RESERVA',
            estado: r.estado,
            detalle: `${estadoLabel}: ${r.asignatura || 'Reserva'} solicitada por ${r.docente} (${rIni} - ${rFin})`
          }
        }
      }
    }
  }

  return { disponible: true, conflicto: null }
}

/**
 * Crear nueva reserva (Docente o Directora)
 */
export const crearReserva = async (payload) => {
  const hIni = formatHora(payload.horaInicio, '08:00')
  const hFin = formatHora(payload.horaFin, '10:00')
  const durCalc = ((horaToMinutos(hFin) - horaToMinutos(hIni)) / 60)

  const nuevaReserva = {
    id: payload.id || 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    dni: payload.dni || '',
    docente: payload.docente || '',
    aula: payload.aula || '',
    asignatura: payload.asignatura || 'Clase / Actividad Académica',
    motivo: payload.motivo || '',
    tipoReserva: payload.tipoReserva || 'UNICA',
    fecha: payload.fecha || new Date().toLocaleDateString('en-CA'),
    fechaInicio: payload.fechaInicio || payload.fecha || new Date().toLocaleDateString('en-CA'),
    fechaFin: payload.fechaFin || payload.fecha || new Date().toLocaleDateString('en-CA'),
    diaSemana: payload.diaSemana || getDiaSemanaFromDate(payload.fecha) || 'Lunes',
    semanaInicio: Number(payload.semanaInicio || 1),
    semanaFin: Number(payload.semanaFin || 17),
    horaInicio: hIni,
    horaFin: hFin,
    duracionHrs: payload.duracionHrs || durCalc || 2,
    estado: payload.estado || (payload.creadoPor === 'DIRECTORA' ? 'APROBADA' : 'PENDIENTE'),
    creadoPor: payload.creadoPor || 'DOCENTE',
    comentarioAdmin: payload.comentarioAdmin || '',
    fechaSolicitud: new Date().toISOString(),
    fechaRespuesta: payload.creadoPor === 'DIRECTORA' ? new Date().toISOString() : null
  }

  // 1. Guardar de inmediato localmente (optimista)
  const locales = getLocalReservas()
  const actualizadas = [nuevaReserva, ...locales.filter(r => r.id !== nuevaReserva.id)]
  saveLocalReservas(actualizadas)

  // 2. Enviar a Google Apps Script
  if (GOOGLE_SCRIPT_URL) {
    try {
      const response = await fetchGAS(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'crear_reserva',
          ...nuevaReserva,
          reserva: nuevaReserva
        })
      })
      const text = await response.text()
      try {
        const json = JSON.parse(text)
        if (json.success === false) {
          // Revertir del almacenamiento local si el backend rechazó la reserva
          const revertidas = getLocalReservas().filter(r => r.id !== nuevaReserva.id)
          saveLocalReservas(revertidas)
          return { success: false, message: json.message || 'Conflicto detectado en el servidor.' }
        }
        if (json.success && json.data?.id) {
          nuevaReserva.id = json.data.id
        }
      } catch (e) {}
    } catch (e) {
      console.warn('Error enviando reserva a la nube:', e)
    }
  }

  return { success: true, data: nuevaReserva }
}

/**
 * Actualizar estado de reserva (Aprobar o Rechazar por Directora)
 */
export const actualizarEstadoReserva = async ({ id, estado, comentarioAdmin = '' }) => {
  const locales = getLocalReservas()
  let encontrada = null

  const actualizadas = locales.map(r => {
    if (r.id === id) {
      encontrada = {
        ...r,
        estado,
        comentarioAdmin,
        fechaRespuesta: new Date().toISOString()
      }
      return encontrada
    }
    return r
  })

  saveLocalReservas(actualizadas)

  if (GOOGLE_SCRIPT_URL) {
    try {
      await fetchGAS(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'actualizar_reserva',
          id,
          estado,
          comentarioAdmin,
          fechaRespuesta: new Date().toISOString()
        })
      })
    } catch (e) {
      console.warn('Error enviando actualización de reserva:', e)
    }
  }

  return { success: true, data: encontrada }
}

/**
 * Eliminar o Cancelar reserva
 */
export const eliminarReserva = async (id) => {
  const locales = getLocalReservas()
  const actualizadas = locales.filter(r => r.id !== id)
  saveLocalReservas(actualizadas)

  if (GOOGLE_SCRIPT_URL) {
    try {
      await fetchGAS(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'eliminar_reserva', id })
      })
    } catch (e) {
      console.warn('Error eliminando reserva en la nube:', e)
    }
  }

  return { success: true }
}
