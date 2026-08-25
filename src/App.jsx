import { useState, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import LoginView from './components/LoginView'
import LoadingView from './components/LoadingView'
import FormView from './components/FormView'
import AdminLoginView from './components/admin/AdminLoginView'
import AdminDashboard from './components/admin/AdminDashboard'
import Toast from './components/Toast'
import useSession from './hooks/useSession'
import { buscarDocente } from './services/api'
import { mergeHistoryFromCloud } from './utils/historyManager'
import { ADMIN_LOGIN_CODE } from './config/adminConfig'

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

  // Vista: 'login' | 'loading' | 'form' | 'admin-login' | 'admin-dashboard'
  const [currentView, setCurrentView] = useState(() => 'login')
  const [toast, setToast] = useState(null)
  const [adminUser, setAdminUser] = useState(null)
  
  // Tema visual (oscuro por defecto, con persistencia opcional)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('epic_theme_mode')
    return saved !== null ? saved === 'dark' : true
  })
  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev
      localStorage.setItem('epic_theme_mode', next ? 'dark' : 'light')
      return next
    })
  }, [])

  // Si hay sesión activa en localStorage, ir directo al formulario
  const resolvedView = isSessionLoaded
    ? isLoggedIn && currentView === 'login'
      ? 'form'
      : currentView
    : 'login'

  const handleLogin = useCallback(async (identifier) => {
    // Detectar código de acceso admin por DNI
    if (identifier.trim().toUpperCase() === ADMIN_LOGIN_CODE.toUpperCase()) {
      setCurrentView('admin-login')
      return
    }

    setCurrentView('loading')

    try {
      const result = await buscarDocente(identifier)

      if (result.success && result.data) {
        // Si la base de datos devolvió historial previo de clases, sincronizarlo localmente
        if (Array.isArray(result.data.historial) && result.data.historial.length > 0) {
          mergeHistoryFromCloud(result.data.dni, result.data.historial)
        }

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

  // ── Admin handlers ──
  const handleAdminAccess = useCallback(() => {
    setCurrentView('admin-login')
  }, [])

  const handleAdminLogin = useCallback((user) => {
    setAdminUser(user)
    setCurrentView('admin-dashboard')
    setToast({
      type: 'success',
      message: `Bienvenida, ${user.nombre}`,
    })
  }, [])

  const handleAdminLogout = useCallback(() => {
    setAdminUser(null)
    setCurrentView('login')
    setToast({
      type: 'info',
      message: 'Sesión de administración cerrada',
    })
  }, [])

  const handleAdminBack = useCallback(() => {
    setCurrentView('login')
  }, [])

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
            onAdminAccess={handleAdminAccess}
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
        {resolvedView === 'admin-login' && (
          <AdminLoginView
            key="admin-login-view"
            onAdminLogin={handleAdminLogin}
            onBack={handleAdminBack}
            isDarkMode={isDarkMode}
          />
        )}
        {resolvedView === 'admin-dashboard' && adminUser && (
          <AdminDashboard
            key="admin-dashboard-view"
            adminUser={adminUser}
            onLogout={handleAdminLogout}
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

