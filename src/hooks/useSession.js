import { useState, useEffect, useCallback } from 'react'

const SESSION_KEY = 'epic_session'
const FORM_KEY = 'epic_form_data'

/**
 * Custom hook para manejar la sesión del docente y la persistencia
 * del formulario en localStorage.
 * 
 * - Al montar, recupera la sesión activa y datos del formulario si existen.
 * - Proporciona métodos para iniciar sesión, cerrar sesión,
 *   guardar/recuperar datos del formulario automáticamente.
 */
const useSession = () => {
  const [docente, setDocente] = useState(null)
  const [isSessionLoaded, setIsSessionLoaded] = useState(false)

  // ── Al montar: recuperar sesión activa de localStorage ──
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(SESSION_KEY)
      if (savedSession) {
        const parsed = JSON.parse(savedSession)
        // Verificar que la sesión tenga datos válidos
        if (parsed && parsed.dni && parsed.nombre) {
          setDocente(parsed)
        }
      }
    } catch (error) {
      console.warn('Error al recuperar sesión:', error)
      localStorage.removeItem(SESSION_KEY)
    }
    setIsSessionLoaded(true)
  }, [])

  // ── Iniciar sesión: guardar datos del docente ──
  const startSession = useCallback((docenteData) => {
    setDocente(docenteData)
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(docenteData))
    } catch (error) {
      console.warn('Error al guardar sesión:', error)
    }
  }, [])

  // ── Cerrar sesión: limpiar todo ──
  const endSession = useCallback(() => {
    setDocente(null)
    try {
      localStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(FORM_KEY)
    } catch (error) {
      console.warn('Error al limpiar sesión:', error)
    }
  }, [])

  // ── Guardar datos del formulario ──
  const saveFormData = useCallback((formData) => {
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify(formData))
    } catch (error) {
      console.warn('Error al guardar formulario:', error)
    }
  }, [])

  // ── Recuperar datos del formulario ──
  const loadFormData = useCallback(() => {
    try {
      const saved = localStorage.getItem(FORM_KEY)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      console.warn('Error al recuperar formulario:', error)
      localStorage.removeItem(FORM_KEY)
    }
    return null
  }, [])

  return {
    docente,
    isSessionLoaded,
    isLoggedIn: !!docente,
    startSession,
    endSession,
    saveFormData,
    loadFormData,
  }
}

export default useSession
