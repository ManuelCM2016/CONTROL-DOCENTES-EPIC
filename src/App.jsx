import { useState, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import LoginView from './components/LoginView'
import LoadingView from './components/LoadingView'
import FormView from './components/FormView'
import Toast from './components/Toast'
import useSession from './hooks/useSession'
import { buscarDocente } from './services/api'

function App() {
  const {
    docente,
    isSessionLoaded,
    isLoggedIn,
    startSession,
    endSession,
    saveFormData,
    loadFormData,
  } = useSession()

  // Vista: 'login' | 'loading' | 'form'
  const [currentView, setCurrentView] = useState(() => 'login')
  const [toast, setToast] = useState(null)
  
  // Tema visual (claro / oscuro)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const toggleTheme = useCallback(() => setIsDarkMode(prev => !prev), [])

  // Si hay sesión activa en localStorage, ir directo al formulario
  const resolvedView = isSessionLoaded
    ? isLoggedIn && currentView === 'login'
      ? 'form'
      : currentView
    : 'login'

  const handleLogin = useCallback(async (identifier) => {
    setCurrentView('loading')

    try {
      const result = await buscarDocente(identifier)

      if (result.success && result.data) {
        startSession(result.data)
        setCurrentView('form')
        setToast({
          type: 'success',
          message: `Bienvenido(a), ${result.data.nombre}`,
        })
      } else {
        setCurrentView('login')
        setToast({
          type: 'error',
          message: result.message || 'Docente no encontrado. Verifique su DNI o código.',
        })
      }
    } catch (error) {
      setCurrentView('login')
      setToast({
        type: 'error',
        message: 'Error de conexión. Intente nuevamente.',
      })
    }
  }, [startSession])

  const handleLogout = useCallback(() => {
    endSession()
    setCurrentView('login')
    setToast({
      type: 'info',
      message: 'Sesión cerrada correctamente',
    })
  }, [endSession])

  const showToast = useCallback((type, message) => {
    setToast({ type, message })
  }, [])

  const dismissToast = useCallback(() => {
    setToast(null)
  }, [])

  if (!isSessionLoaded) {
    return null
  }

  return (
    <div className="min-h-screen relative">
      <AnimatePresence mode="wait">
        {resolvedView === 'login' && (
          <LoginView
            key="login-view"
            onLogin={handleLogin}
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
          />
        )}
        {resolvedView === 'loading' && (
          <LoadingView key="loading-view" />
        )}
        {resolvedView === 'form' && docente && (
          <FormView
            key={`form-${docente.dni || docente.codigo || 'user'}`}
            docente={docente}
            onLogout={handleLogout}
            showToast={showToast}
            saveFormData={saveFormData}
            loadFormData={loadFormData}
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
          />
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <AnimatePresence>
        {toast && (
          <Toast
            key="app-toast"
            type={toast.type}
            message={toast.message}
            onDismiss={dismissToast}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
