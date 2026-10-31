import { GOOGLE_SCRIPT_URL, API_TIMEOUT } from '../config/api'
import { AULAS_LABORATORIOS_MASTER, coincidenAulas } from './reservasService'

export const INCIDENCIAS_STORAGE_KEY = 'epic_incidencias_cache'

export const TIPOS_INCIDENCIA = {
  URGENTE: 'URGENTE',     // Atención Inmediata en Aula (SOS)
  PREVENTIVO: 'PREVENTIVO' // Mantenimiento / No urgente
}

export const ESTADOS_INCIDENCIA = {
  NUEVO: 'NUEVO',           // Alerta disparada, esperando atención
  EN_CAMINO: 'EN_CAMINO',   // Técnico asignado / en camino
  RESUELTO: 'RESUELTO',     // Problema solucionado
  CANCELADO: 'CANCELADO'    // Cancelado por el docente
}

export const PRESETS_URGENTES = [
  { id: 'pc_docente', label: 'PC Docente no prende / Pantalla negra', icon: 'Monitor' },
  { id: 'proyector_ecran', label: 'Proyector / Ecran sin señal (HDMI)', icon: 'Tv' },
  { id: 'audio_mic', label: 'Sin audio / Micrófono no funciona', icon: 'VolumeX' },
  { id: 'red_internet', label: 'Sin Internet / Caída de red', icon: 'WifiOff' },
  { id: 'aula_cerrada', label: 'Ambiente cerrado / Falta de llave', icon: 'Key' },
  { id: 'falla_electrica', label: 'Falla eléctrica / Sin energía', icon: 'ZapOff' },
  { id: 'otro_urgente', label: 'Otro problema urgente en aula', icon: 'AlertTriangle' }
]

export const CATEGORIAS_PREVENTIVAS = [
  { id: 'pcs_alumnos', label: 'Equipos de Alumnos (PC lenta, virus, software)' },
  { id: 'mobiliario', label: 'Mobiliario (Sillas rotas, carpetas, estantes)' },
  { id: 'iluminacion_clima', label: 'Iluminación / Focos / Aire acondicionado' },
  { id: 'materiales', label: 'Materiales (Falta plumones, mota, tizas)' },
  { id: 'limpieza', label: 'Limpieza y aseo del ambiente' },
  { id: 'otro_preventivo', label: 'Otro requerimiento de mantenimiento' }
]

// Fetch con timeout para Google Apps Script
const fetchGAS = async (url, options = {}) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT || 15000)
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
 * Obtiene las incidencias guardadas localmente
 */
export const getLocalIncidencias = () => {
  try {
    const raw = localStorage.getItem(INCIDENCIAS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

/**
 * Guarda las incidencias localmente y opcionalmente notifica con evento global
 */
export const saveLocalIncidencias = (incidencias, notify = true) => {
  try {
    const safe = Array.isArray(incidencias) ? incidencias : []
    localStorage.setItem(INCIDENCIAS_STORAGE_KEY, JSON.stringify(safe))
    if (notify && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('epic_incidencias_updated', { detail: safe }))
    }
  } catch (e) {
    console.warn('Error guardando incidencias locales:', e)
  }
}

/**
 * Obtiene todas las incidencias (desde Apps Script con fallback a local)
 * Google Sheets es la fuente oficial de la verdad.
 */
export const obtenerIncidencias = async (forceServer = false) => {
  const localData = getLocalIncidencias()
  if (!GOOGLE_SCRIPT_URL) {
    return { success: true, data: localData }
  }

  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=obtener_incidencias`
    const res = await fetchGAS(url)
    const json = await res.json()

    if (json && json.success && Array.isArray(json.data)) {
      const serverData = json.data
      const serverIds = new Set(serverData.map(i => String(i.id).trim()))
      const now = Date.now()

      // Si Google Sheets respondió, la BD es la fuente de verdad.
      // Si se eliminaron filas de la BD, se deben eliminar localmente también.
      // ÚNICAMENTE conservamos elementos locales creados hace menos de 45 segundos
      // para evitar perder reportes que aún estén en tránsito de guardado por lag de red.
      const enTransito = forceServer ? [] : localData.filter(loc => {
        if (serverIds.has(String(loc.id).trim())) return false
        const t = new Date(loc.timestamp || loc.fechaHora).getTime()
        return !isNaN(t) && (now - t) < 45000
      })

      const finalIncidencias = [...enTransito, ...serverData]
      saveLocalIncidencias(finalIncidencias, true)
      return { success: true, data: finalIncidencias }
    }
    return { success: true, data: localData }
  } catch (e) {
    console.warn('Error al sincronizar incidencias con la nube, usando caché local:', e)
    return { success: true, data: localData }
  }
}

/**
 * Registra una nueva incidencia (Docente)
 */
export const crearIncidencia = async (payload) => {
  const now = new Date()
  const idGen = `INC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`

  const nuevaIncidencia = {
    id: idGen,
    tipo: payload.tipo || TIPOS_INCIDENCIA.URGENTE, // 'URGENTE' | 'PREVENTIVO'
    aula: payload.aula || 'Ambiente no especificado',
    docenteNombre: payload.docenteNombre || 'Docente',
    docenteDni: payload.docenteDni || '',
    asignatura: payload.asignatura || '',
    titulo: payload.titulo || 'Incidencia en Aula',
    descripcion: payload.descripcion || '',
    categoria: payload.categoria || '',
    estado: ESTADOS_INCIDENCIA.NUEVO,
    timestamp: now.toISOString(),
    fechaHora: now.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }),
    hora: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    atendidoPor: '',
    notaResolucion: '',
    tiempoRespuestaMin: null
  }

  // 1. Guardar localmente de inmediato (0 ms de espera)
  const current = getLocalIncidencias()
  const updated = [nuevaIncidencia, ...current.filter(i => i.id !== idGen)]
  saveLocalIncidencias(updated, true)

  // 2. Enviar a Google Apps Script en segundo plano
  if (GOOGLE_SCRIPT_URL) {
    try {
      fetchGAS(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'reportar_incidencia',
          ...nuevaIncidencia
        })
      }).then(res => res.json()).then(resJson => {
        if (!resJson?.success) {
          console.warn('Advertencia backend al reportar incidencia:', resJson?.message)
        }
      }).catch(err => console.warn('Error diferido al enviar incidencia:', err))
    } catch (e) {
      console.warn('Error al iniciar fetch de incidencia:', e)
    }
  }

  return { success: true, data: nuevaIncidencia }
}

/**
 * Actualiza el estado de una incidencia (Técnico / Admin o Docente)
 */
export const actualizarEstadoIncidencia = async ({ id, estado, atendidoPor = '', notaResolucion = '' }) => {
  const current = getLocalIncidencias()
  const index = current.findIndex(i => String(i.id) === String(id))

  if (index === -1) {
    return { success: false, message: 'Incidencia no encontrada' }
  }

  const inc = current[index]
  const now = new Date()

  // Calcular tiempo de respuesta si se resuelve
  let tiempoMin = inc.tiempoRespuestaMin
  if (estado === ESTADOS_INCIDENCIA.RESUELTO && inc.timestamp) {
    const diffMs = now.getTime() - new Date(inc.timestamp).getTime()
    tiempoMin = Math.max(1, Math.round(diffMs / 60000))
  }

  const updatedInc = {
    ...inc,
    estado,
    atendidoPor: atendidoPor || inc.atendidoPor,
    notaResolucion: notaResolucion || inc.notaResolucion,
    tiempoRespuestaMin: tiempoMin,
    fechaResolucion: estado === ESTADOS_INCIDENCIA.RESUELTO ? now.toISOString() : inc.fechaResolucion
  }

  current[index] = updatedInc
  saveLocalIncidencias(current, true)

  // Sincronizar con GAS
  if (GOOGLE_SCRIPT_URL) {
    try {
      fetchGAS(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'actualizar_incidencia',
          id,
          estado,
          atendidoPor: updatedInc.atendidoPor,
          notaResolucion: updatedInc.notaResolucion,
          tiempoRespuestaMin: tiempoMin
        })
      }).catch(err => console.warn('Error diferido actualizando incidencia:', err))
    } catch (e) {
      console.warn('Error al actualizar incidencia en nube:', e)
    }
  }

  return { success: true, data: updatedInc }
}

/**
 * Elimina una incidencia tanto localmente como en Google Sheets
 */
export const eliminarIncidencia = async (id) => {
  const current = getLocalIncidencias()
  const targetId = String(id).trim()
  const updated = current.filter(i => String(i.id).trim() !== targetId)
  saveLocalIncidencias(updated, true)

  if (GOOGLE_SCRIPT_URL) {
    try {
      fetchGAS(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'eliminar_incidencia',
          id: targetId
        })
      }).catch(err => console.warn('Error diferido al eliminar incidencia:', err))
    } catch (e) {
      console.warn('Error al enviar eliminación a Google Sheets:', e)
    }
  }

  return { success: true }
}

/**
 * Limpia todo el historial local inmediatamente
 */
export const purgarIncidenciasLocales = () => {
  saveLocalIncidencias([], true)
}


