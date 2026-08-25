/**
 * Gestor de Historial de Sesiones Dictadas por Docente
 * Almacena y gestiona las clases dictadas de forma local y persistente por DNI.
 */

const HISTORY_PREFIX = 'upt_history_'

/**
 * Obtiene la clave de almacenamiento para el docente
 */
const getHistoryKey = (docenteDni) => `${HISTORY_PREFIX}${docenteDni || 'anon'}`

/**
 * Obtiene el historial completo de un docente
 * @param {string} docenteDni
 * @returns {Array<object>} Lista de sesiones ordenadas por fecha descendente
 */
export const getTeacherHistory = (docenteDni) => {
  if (!docenteDni) return []
  try {
    const raw = localStorage.getItem(getHistoryKey(docenteDni))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.warn('Error al leer historial del docente:', error)
    return []
  }
}

/**
 * Guarda una nueva sesión en el historial del docente
 * @param {string} docenteDni
 * @param {object} sessionData
 * @param {'synced' | 'pending'} [status='synced']
 * @returns {object} Sesión guardada con ID único y timestamp
 */
export const saveSessionToHistory = (docenteDni, sessionData, status = 'synced') => {
  if (!docenteDni || !sessionData) return null
  try {
    const history = getTeacherHistory(docenteDni)
    const newEntry = {
      id: sessionData.id || `ses_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      syncStatus: status, // 'synced' | 'pending'
      ...sessionData,
    }

    // Evitar duplicados por ID o número de registro en la misma fecha
    const filtered = history.filter(
      (item) => item.id !== newEntry.id && !(item.numero === newEntry.numero && item.fecha === newEntry.fecha && item.horaInicio === newEntry.horaInicio)
    )

    const updated = [newEntry, ...filtered]
    // Limitar a las últimas 100 sesiones por docente para optimizar memoria
    const trimmed = updated.slice(0, 100)
    localStorage.setItem(getHistoryKey(docenteDni), JSON.stringify(trimmed))
    return newEntry
  } catch (error) {
    console.warn('Error al guardar sesión en historial:', error)
    return null
  }
}

/**
 * Actualiza el estado de sincronización de una sesión en el historial
 * @param {string} docenteDni
 * @param {string} sessionId
 * @param {'synced' | 'pending' | 'error'} newStatus
 */
export const updateSessionStatusInHistory = (docenteDni, sessionId, newStatus = 'synced') => {
  if (!docenteDni || !sessionId) return
  try {
    const history = getTeacherHistory(docenteDni)
    const updated = history.map((item) => {
      if (item.id === sessionId || item.offlineId === sessionId) {
        return { ...item, syncStatus: newStatus, syncedAt: new Date().toISOString() }
      }
      return item
    })
    localStorage.setItem(getHistoryKey(docenteDni), JSON.stringify(updated))
  } catch (error) {
    console.warn('Error al actualizar estado en historial:', error)
  }
}

/**
 * Elimina una sesión del historial
 * @param {string} docenteDni
 * @param {string} sessionId
 */
export const deleteSessionFromHistory = (docenteDni, sessionId) => {
  if (!docenteDni || !sessionId) return
  try {
    const history = getTeacherHistory(docenteDni)
    const updated = history.filter((item) => item.id !== sessionId)
    localStorage.setItem(getHistoryKey(docenteDni), JSON.stringify(updated))
  } catch (error) {
    console.warn('Error al eliminar sesión del historial:', error)
  }
}

/**
 * Fusiona sesiones descargadas de Google Sheets con el historial local del docente
 * Preserva las sesiones pendientes locales que aún no estén en la nube
 * @param {string} docenteDni
 * @param {Array<object>} cloudSessions
 * @returns {Array<object>}
 */
export const mergeHistoryFromCloud = (docenteDni, cloudSessions = []) => {
  if (!docenteDni || !Array.isArray(cloudSessions)) return getTeacherHistory(docenteDni)
  try {
    const localHistory = getTeacherHistory(docenteDni)
    // Mantener las que estén pendientes en local
    const pendingLocal = localHistory.filter((item) => item.syncStatus === 'pending')

    const mergedMap = new Map()

    // 1. Agregar sesiones de la nube
    cloudSessions.forEach((ses) => {
      const key = `${ses.numero}_${ses.fecha}_${ses.horaInicio}`
      mergedMap.set(key, { ...ses, syncStatus: 'synced' })
    })

    // 2. Sobrescribir o añadir sesiones locales pendientes
    pendingLocal.forEach((ses) => {
      const key = `${ses.numero}_${ses.fecha}_${ses.horaInicio}`
      mergedMap.set(key, ses)
    })

    // Convertir a array y ordenar por fecha descendente
    const mergedList = Array.from(mergedMap.values()).slice(0, 100)
    localStorage.setItem(getHistoryKey(docenteDni), JSON.stringify(mergedList))
    return mergedList
  } catch (error) {
    console.warn('Error al fusionar historial de la nube:', error)
    return getTeacherHistory(docenteDni)
  }
}

/**
 * Limpia todo el historial de un docente
 * @param {string} docenteDni
 */
export const clearTeacherHistory = (docenteDni) => {
  if (!docenteDni) return
  try {
    localStorage.removeItem(getHistoryKey(docenteDni))
  } catch (error) {
    console.warn('Error al limpiar historial:', error)
  }
}

