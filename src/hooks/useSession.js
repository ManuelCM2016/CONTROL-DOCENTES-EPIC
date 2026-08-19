import { useState, useEffect, useCallback } from 'react'

const SESSION_KEY = 'epic_session'

/**
 * Custom hook para manejar la sesión del docente.
 * Cada docente y cada ingreso nuevo inicia con el formulario completamente limpio.
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
        if (parsed && (parsed.dni || parsed.codigo) && parsed.nombre) {
          setDocente(parsed)
        }
      }
    } catch (error) {
      console.warn('Error al recuperar sesión:', error)
      localStorage.removeItem(SESSION_KEY)
    }
    setIsSessionLoaded(true)
  }, [])

  // ── Iniciar sesión: guardar datos del docente y limpiar caché previo ──
  const startSession = useCallback((docenteData) => {
    setDocente(docenteData)
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(docenteData))
    } catch (error) {
      console.warn('Error al guardar sesión:', error)
    }
  }, [])

  // ── Cerrar sesión: limpiar sesión y formulario por completo ──
  const endSession = useCallback(() => {
    const currentDni = docente?.dni || docente?.codigo
    setDocente(null)
    try {
      localStorage.removeItem(SESSION_KEY)
      if (currentDni) {
        localStorage.removeItem(`epic_form_data_${currentDni}`)
      }
      localStorage.removeItem('epic_form_data')
      localStorage.removeItem('upt_last_aula')
    } catch (error) {
      console.warn('Error al limpiar sesión:', error)
    }
  }, [docente])

  // ── Guardar datos del formulario solo para este docente ──
  const saveFormData = useCallback((formData) => {
    if (!docente) return
    const key = `epic_form_data_${docente.dni || docente.codigo}`
    try {
      if (!formData) {
        localStorage.removeItem(key)
        localStorage.removeItem('epic_form_data')
      } else {
        localStorage.setItem(key, JSON.stringify(formData))
      }
    } catch (error) {
      console.warn('Error al guardar formulario:', error)
    }
  }, [docente])

  // ── Recuperar datos del formulario solo si pertenecen a este docente ──
  const loadFormData = useCallback(() => {
    if (!docente) return null
    const key = `epic_form_data_${docente.dni || docente.codigo}`
    try {
      const saved = localStorage.getItem(key)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      console.warn('Error al recuperar formulario:', error)
      localStorage.removeItem(key)
    }
    return null
  }, [docente])

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
