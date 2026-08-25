/**
 * Gestor de Modo Offline Resiliente y Cola de Sincronización Automática
 * Garantiza que ninguna sesión se pierda si falla la conexión a internet.
 */

import { registrarSesion } from '../services/api'
import { updateSessionStatusInHistory } from './historyManager'

const OFFLINE_QUEUE_KEY = 'upt_offline_sync_queue'

/**
 * Obtiene la lista de sesiones pendientes de sincronización
 * @returns {Array<object>}
 */
export const getOfflineQueue = () => {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    console.warn('Error al leer cola offline:', e)
    return []
  }
}

/**
 * Guarda la cola offline en localStorage
 * @param {Array<object>} queue
 */
const saveOfflineQueue = (queue) => {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
    // Disparar evento personalizado para actualizar los contadores en la UI
    window.dispatchEvent(new CustomEvent('upt-offline-queue-changed', { detail: { count: queue.length } }))
  } catch (e) {
    console.warn('Error al guardar cola offline:', e)
  }
}

/**
 * Encola una sesión que no se pudo enviar
 * @param {object} sessionPayload
 * @returns {string} ID único de la sesión en cola
 */
export const enqueueOfflineSession = (sessionPayload) => {
  const queue = getOfflineQueue()
  const offlineId = sessionPayload.offlineId || `offline_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`

  const queueItem = {
    ...sessionPayload,
    offlineId,
    queuedAt: new Date().toISOString(),
    retries: 0,
  }

  // Evitar duplicados
  const existingIdx = queue.findIndex((item) => item.offlineId === offlineId || (item.numero === queueItem.numero && item.fecha === queueItem.fecha && item.horaInicio === queueItem.horaInicio))
  if (existingIdx >= 0) {
    queue[existingIdx] = queueItem
  } else {
    queue.push(queueItem)
  }

  saveOfflineQueue(queue)
  return offlineId
}

/**
 * Elimina una sesión de la cola tras haber sido sincronizada con éxito
 * @param {string} offlineId
 */
export const removeOfflineSession = (offlineId) => {
  const queue = getOfflineQueue()
  const filtered = queue.filter((item) => item.offlineId !== offlineId)
  saveOfflineQueue(filtered)
}

/**
 * Obtiene la cantidad de sesiones pendientes en cola
 * @returns {number}
 */
export const getOfflineQueueCount = () => {
  return getOfflineQueue().length
}

/**
 * Intenta sincronizar todas las sesiones pendientes en cola con Google Sheets
 * @param {function} [onItemSynced] Callback llamado por cada ítem exitoso
 * @returns {Promise<{ total: number, synced: number, failed: number }>}
 */
export const syncOfflineQueue = async (onItemSynced) => {
  const queue = getOfflineQueue()
  if (queue.length === 0) {
    return { total: 0, synced: 0, failed: 0 }
  }

  if (!navigator.onLine) {
    console.log('📡 [OFFLINE] No hay conexión a internet para sincronizar.')
    return { total: queue.length, synced: 0, failed: queue.length }
  }

  let syncedCount = 0
  let failedCount = 0

  // Clonar la cola para iterar
  const itemsToSync = [...queue]

  for (const item of itemsToSync) {
    try {
      // Extraer campos de control offline antes de enviar el payload limpio
      const { offlineId, queuedAt, retries, ...cleanPayload } = item
      const result = await registrarSesion(cleanPayload)

      if (result.success) {
        // Eliminar de la cola
        removeOfflineSession(offlineId)
        syncedCount++

        // Actualizar estado en el historial del docente
        if (cleanPayload.dni) {
          updateSessionStatusInHistory(cleanPayload.dni, offlineId, 'synced')
        }

        if (typeof onItemSynced === 'function') {
          onItemSynced(item)
        }
      } else {
        failedCount++
      }
    } catch (err) {
      console.warn('Error al sincronizar ítem offline:', err)
      failedCount++
    }
  }

  return {
    total: itemsToSync.length,
    synced: syncedCount,
    failed: failedCount,
  }
}
