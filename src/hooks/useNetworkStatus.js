import { useState, useEffect, useCallback } from 'react'
import { getOfflineQueueCount, syncOfflineQueue } from '../utils/offlineManager'

/**
 * Custom hook para monitorear el estado de red y la cola de sincronización offline.
 * Sincroniza automáticamente en segundo plano cuando la conexión a internet regresa.
 */
export const useNetworkStatus = (onSyncComplete) => {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [pendingOfflineCount, setPendingOfflineCount] = useState(() => getOfflineQueueCount())
  const [isSyncing, setIsSyncing] = useState(false)

  // Función para ejecutar sincronización manual o automática
  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return
    setIsSyncing(true)

    try {
      const result = await syncOfflineQueue((syncedItem) => {
        if (typeof onSyncComplete === 'function') {
          onSyncComplete(syncedItem)
        }
      })
      setPendingOfflineCount(getOfflineQueueCount())
      return result
    } catch (e) {
      console.warn('Error en triggerSync:', e)
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing, onSyncComplete])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      // Cuando regresa la conexión, sincronizar inmediatamente
      setTimeout(() => {
        triggerSync()
      }, 1000)
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    const handleQueueChanged = (e) => {
      setPendingOfflineCount(e.detail?.count ?? getOfflineQueueCount())
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('upt-offline-queue-changed', handleQueueChanged)

    // Si ya estamos online y hay elementos pendientes, intentar sincronizar al montar
    if (navigator.onLine && getOfflineQueueCount() > 0) {
      triggerSync()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('upt-offline-queue-changed', handleQueueChanged)
    }
  }, [triggerSync])

  return {
    isOnline,
    pendingOfflineCount,
    isSyncing,
    triggerSync,
  }
}

export default useNetworkStatus
