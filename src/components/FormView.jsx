import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LogOut, Building2, GraduationCap, BookOpen, Lock,
  MapPin, BookMarked, Layers, Calendar, FileText,
  MonitorPlay, Users, MessageSquare, PlayCircle,
  StopCircle, ClipboardCheck, Hash, User, Send, Loader2, CheckCircle2,
  Bell, Timer, BellRing, Sun, Moon, Sparkles, Check, ChevronRight,
  Info, Plus, Minus, RotateCcw
} from 'lucide-react'
import DigitalClock from './DigitalClock'
import ConfirmationModal from './ConfirmationModal'
import OnboardingTour from './OnboardingTour'
import { registrarSesion } from '../services/api'
import { playAlertSound } from '../utils/alertSound'
import {
  calcularSemanaYUnidad,
  getSiguienteNumeroRegistro,
  guardarNumeroRegistroCompletado,
  SEMESTRE_CONFIG
} from '../utils/academicCalendar'

// Opciones de recursos utilizados
const RECURSOS_OPTIONS = [
  { id: 'aula_virtual', label: 'Aula Virtual', icon: '💻' },
  { id: 'proyector', label: 'Proyector', icon: '📽️' },
  { id: 'software', label: 'Software Especializado', icon: '🖥️' },
  { id: 'laboratorio', label: 'Laboratorio', icon: '🔬' },
  { id: 'bibliografia', label: 'Bibliografía', icon: '📚' },
  { id: 'materiales', label: 'Materiales', icon: '📐' },
  { id: 'equipos', label: 'Equipos', icon: '⚙️' },
  { id: 'pizarra', label: 'Pizarra', icon: '📝' },
]

// Preset habitual más común en aulas universitarias
const RECURSOS_HABITUALES = ['aula_virtual', 'proyector', 'pizarra']

// Presets rápidos de asistencia
const PRESETS_ASISTENCIA = [15, 20, 25, 30, 35, 40]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

const FormView = ({ docente, onLogout, showToast, saveFormData, loadFormData, isDarkMode, toggleTheme }) => {
  const [isSending, setIsSending] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [submittedData, setSubmittedData] = useState(null)

  // ── Tour Guiado Onboarding ──
  const [isTourOpen, setIsTourOpen] = useState(() => {
    // Si el docente nunca ha visto el tour en este navegador, activarlo por defecto
    const tourVisto = localStorage.getItem('epic_tour_visto')
    return tourVisto !== 'true'
  })
  const [tourStepIndex, setTourStepIndex] = useState(0)

  const handleCloseTour = useCallback(() => {
    setIsTourOpen(false)
    localStorage.setItem('epic_tour_visto', 'true')
  }, [])

  const handleOpenTour = useCallback(() => {
    setTourStepIndex(0)
    setIsTourOpen(true)
  }, [])

  // ── Duración de la sesión ──
  const [duracionHoras, setDuracionHoras] = useState(1)
  const [duracionMinutos, setDuracionMinutos] = useState(30)

  // ── Ref para el timeout de notificación ──
  const notificationTimeoutRef = useRef(null)
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )

  // ── Solicitar permisos de notificación al montar ──
  useEffect(() => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        setNotificationPermission(perm)
      })
    }
  }, [])

  // ── Limpiar timeout al desmontar ──
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current)
      }
    }
  }, [])

  // ── Función para generar estado inicial limpio para cada docente ──
  const getAutomatedInitialFormData = useCallback(() => {
    const hoy = new Date().toISOString().split('T')[0]
    const { semana, unidad } = calcularSemanaYUnidad(hoy)
    const ultimoNumero = getSiguienteNumeroRegistro(docente?.dni || docente?.codigo)

    return {
      numero: ultimoNumero,
      aulaLab: '',
      fecha: hoy,
      unidad: unidad,
      semanaAcademica: String(semana),
      asignatura: '',
      temaProgramado: '',
      recursos: [],
      horaInicio: null,
      horaFinalizacion: null,
      numEstudiantes: '',
      observaciones: '',
    }
  }, [docente])

  // ── Inicializar estado: si hay sesión en curso para este docente se restaura, sino formulario limpio ──
  const [formData, setFormData] = useState(() => {
    const saved = loadFormData()
    if (saved && saved.horaInicio) {
      return { ...getAutomatedInitialFormData(), ...saved }
    }
    return getAutomatedInitialFormData()
  })

  // Derivar sessionState del formData recuperado
  const [sessionState, setSessionState] = useState(() => {
    const saved = loadFormData()
    if (saved?.horaFinalizacion) return 'finished'
    if (saved?.horaInicio) return 'started'
    return 'idle'
  })

  // Ref para evitar guardar en el primer render
  const isFirstRender = useRef(true)

  // ── Auto-guardado en localStorage exclusivo del docente activo ──
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    saveFormData(formData)
  }, [formData, saveFormData])

  // ── Actualizar campo genérico ──
  const updateField = useCallback((field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value }

      // Si cambia la fecha, recalcular automáticamente Semana y Unidad
      if (field === 'fecha' && value) {
        const { semana, unidad } = calcularSemanaYUnidad(value)
        updated.semanaAcademica = String(semana)
        updated.unidad = unidad
      }

      return updated
    })
  }, [])

  // ── Alternar recurso individual ──
  const toggleRecurso = useCallback((recursoId) => {
    setFormData((prev) => ({
      ...prev,
      recursos: prev.recursos.includes(recursoId)
        ? prev.recursos.filter((r) => r !== recursoId)
        : [...prev.recursos, recursoId],
    }))
  }, [])

  // ── Preset rápido de recursos habituales ──
  const aplicarRecursosHabituales = () => {
    setFormData((prev) => ({
      ...prev,
      recursos: [...new Set([...prev.recursos, ...RECURSOS_HABITUALES])],
    }))
    showToast('info', '✨ Recursos habituales seleccionados')
  }

  const limpiarRecursos = () => {
    setFormData((prev) => ({ ...prev, recursos: [] }))
  }

  // ── Ajustar asistencia con stepper ──
  const ajustarAsistencia = (delta) => {
    setFormData((prev) => {
      const actual = parseInt(prev.numEstudiantes, 10) || 0
      const nuevo = Math.max(0, actual + delta)
      return { ...prev, numEstudiantes: String(nuevo) }
    })
  }

  // ── Cálculo del estado del Calendario Académico según la fecha actual del form ──
  const estadoCalendario = useMemo(() => {
    return calcularSemanaYUnidad(formData.fecha)
  }, [formData.fecha])

  // ── Cálculo del progreso de llenado (% completado) ──
  const progresoFormulario = useMemo(() => {
    const camposObligatorios = [
      Boolean(formData.aulaLab?.trim()),
      Boolean(formData.fecha),
      Boolean(formData.asignatura),
      Boolean(formData.unidad),
      Boolean(formData.semanaAcademica),
      Boolean(formData.temaProgramado?.trim()),
      Boolean(formData.numEstudiantes),
      formData.recursos.length > 0,
    ]
    const completados = camposObligatorios.filter(Boolean).length
    const total = camposObligatorios.length
    const porcentaje = Math.round((completados / total) * 100)
    return { completados, total, porcentaje }
  }, [formData])

  // ── Registrar Inicio de Clase ──
  const handleRegistrarInicio = () => {
    // Validaciones
    const requiredFields = [
      { key: 'aulaLab', name: 'Aula / Laboratorio' },
      { key: 'fecha', name: 'Fecha' },
      { key: 'asignatura', name: 'Asignatura y Sección' },
      { key: 'unidad', name: 'Unidad' },
      { key: 'semanaAcademica', name: 'N° de Semana Académica' },
      { key: 'temaProgramado', name: 'Tema Programado en el Sílabo' },
      { key: 'numEstudiantes', name: 'N° de Estudiantes Asistentes' },
    ]

    const missingField = requiredFields.find((field) => !formData[field.key])
    if (missingField) {
      showToast('error', `El campo "${missingField.name}" es obligatorio.`)
      return
    }

    if (formData.recursos.length < 1) {
      showToast('error', 'Seleccione al menos un recurso utilizado.')
      return
    }

    const now = new Date().toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    setFormData((prev) => {
      const updated = { ...prev, horaInicio: now }
      saveFormData(updated)
      return updated
    })
    setSessionState('started')
    showToast('success', `Inicio de clase registrado a las ${now}`)

    // ── Programar notificación push ──
    const totalMinutos = (parseInt(duracionHoras, 10) || 0) * 60 + (parseInt(duracionMinutos, 10) || 0)

    if (totalMinutos > 0 && notificationPermission === 'granted') {
      let tiempoEsperaMs
      if (totalMinutos <= 10) {
        tiempoEsperaMs = 10 * 1000 // Modo prueba (10s)
      } else {
        tiempoEsperaMs = (totalMinutos - 10) * 60 * 1000 // 10 min antes del fin
      }

      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current)
      }

      notificationTimeoutRef.current = setTimeout(() => {
        playAlertSound()
        new Notification('Control de Avance Silábico UPT', {
          body: 'Su sesión está por finalizar. Por favor, prepare el registro de su salida en el sistema.',
          icon: '/logo.png',
          tag: 'epic-sesion-alert',
          requireInteraction: true,
        })
      }, tiempoEsperaMs)

      const minAlert = totalMinutos <= 10 ? '10 seg (modo prueba)' : `${totalMinutos - 10} min`
      showToast('info', `⏰ Notificación programada: sonará en ${minAlert}`)
    }
  }

  // ── Registrar Salida ──
  const handleRegistrarSalida = () => {
    const now = new Date().toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    setFormData((prev) => {
      const updated = { ...prev, horaFinalizacion: now }
      saveFormData(updated)
      return updated
    })
    setSessionState('finished')
    showToast('success', `Salida registrada a las ${now}`)

    // Cancelar notificación pendiente
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current)
      notificationTimeoutRef.current = null
    }
  }

  // ── Finalizar sesión y enviar datos a Google Sheets ──
  const handleFinalizarYEnviar = async () => {
    setIsSending(true)
    showToast('info', 'Enviando datos al servidor...')

    try {
      const payload = {
        dni: docente.dni,
        docente: docente.nombre,
        facultad: docente.facultad,
        escuela: docente.escuela,
        carrera: docente.carrera,
        numero: formData.numero,
        aulaLab: formData.aulaLab,
        fecha: formData.fecha,
        asignatura: formData.asignatura,
        unidad: formData.unidad,
        semanaAcademica: formData.semanaAcademica,
        temaProgramado: formData.temaProgramado,
        recursos: formData.recursos,
        horaInicio: formData.horaInicio,
        horaFinalizacion: formData.horaFinalizacion,
        numEstudiantes: formData.numEstudiantes,
        observaciones: formData.observaciones,
      }

      const result = await registrarSesion(payload)

      if (result.success) {
        setIsSent(true)
        setSubmittedData(payload)
        setShowSuccessModal(true)
        showToast('success', '✅ Registro enviado exitosamente a Google Sheets')

        // Incrementar el correlativo de registro automáticamente
        guardarNumeroRegistroCompletado(docente.dni, formData.numero)

        // Limpiar estado guardado en localStorage
        saveFormData(null)
      } else {
        showToast('error', result.message || 'Error al enviar los datos.')
      }
    } catch (error) {
      showToast('error', 'Error de conexión. Los datos se mantienen guardados localmente.')
    } finally {
      setIsSending(false)
    }
  }

  // ── Preparar formulario para un nuevo registro de clase ──
  const handleNuevoRegistro = useCallback(() => {
    setShowSuccessModal(false)
    setIsSent(false)
    setSessionState('idle')
    setFormData(getAutomatedInitialFormData())
    saveFormData(null)
    showToast('info', 'Formulario listo para un nuevo registro de clase')
  }, [getAutomatedInitialFormData, saveFormData, showToast])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen transition-colors duration-500 relative"
      style={{
        background: isDarkMode
          ? 'linear-gradient(135deg, #120606 0%, #200b0b 25%, #2b0c0c 50%, #1a0808 75%, #100505 100%)'
          : 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 30%, #e2e8f0 60%, #f1f5f9 100%)',
      }}
    >
      {/* ═══════════════════ HEADER ═══════════════════ */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`sticky top-0 z-50 border-b-2 transition-colors duration-500 ${isDarkMode
          ? 'bg-[#150707]/90 backdrop-blur-xl border-white/10 shadow-xl shadow-black/50'
          : 'bg-white border-slate-200 shadow-lg shadow-slate-300/40'
          }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-[72px]">
            {/* Left: Logo + Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md overflow-hidden ring-2 ring-maroon-700/20">
                <img src="/logo.png" alt="Logo UPT" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className={`text-sm font-bold tracking-wide leading-tight transition-colors duration-500 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  CONTROL DE AVANCE SILÁBICO
                </h1>
                <p className={`text-[11px] font-semibold leading-tight transition-colors duration-500 ${isDarkMode ? 'text-maroon-300/80' : 'text-slate-600'}`}>
                  Escuela Profesional de Ingeniería Civil — UPT
                </p>
              </div>
            </div>

            {/* Center: Docente info */}
            <div className={`hidden md:flex items-center gap-2.5 px-4 py-2 rounded-xl border-2 transition-colors duration-500 ${isDarkMode
              ? 'bg-white/5 border-white/10 text-white'
              : 'bg-slate-50 border-slate-200 text-slate-900 shadow-sm'
              }`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-maroon-700/20 text-maroon-300' : 'bg-red-900/10 text-red-900'}`}>
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className={`text-sm font-bold leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{docente.nombre}</p>
                <p className={`text-[10px] font-semibold leading-tight ${isDarkMode ? 'text-maroon-300' : 'text-slate-500'}`}>
                  DNI / Cód: {docente.dni || docente.codigo}
                </p>
              </div>
            </div>

            {/* Right: Clock + Actions */}
            <div className="flex items-center gap-4">
              <DigitalClock isDarkMode={isDarkMode} />
              <div className={`flex items-center gap-2 border-l pl-3 ${isDarkMode ? 'border-white/15' : 'border-slate-300'}`}>
                {/* Botón de Guía Interactiva */}
                <button
                  type="button"
                  onClick={handleOpenTour}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all duration-300 ${
                    isDarkMode
                      ? 'bg-red-950/60 border-red-800/40 text-red-300 hover:bg-red-900/60 hover:text-white shadow-md'
                      : 'bg-red-50 border-red-200 text-red-900 hover:bg-red-100 shadow-sm'
                  }`}
                  title="Ver Guía Instructiva del Sistema"
                >
                  <Sparkles className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                  <span className="hidden sm:inline">Guía Rápida</span>
                </button>

                <button
                  onClick={toggleTheme}
                  className={`p-2.5 rounded-xl border-2 transition-all duration-300 ${isDarkMode
                    ? 'bg-white/10 border-white/15 text-yellow-300 hover:bg-white/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
                    }`}
                  title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                >
                  {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button
                  onClick={onLogout}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${isDarkMode
                    ? 'text-red-300 hover:text-white hover:bg-red-500/20'
                    : 'text-slate-600 hover:text-red-700 hover:bg-red-50'
                    }`}
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* ═══════════════════ MAIN CONTENT ═══════════════════ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* ─── BANNER SUPERIOR CON AUTOMATIZACIÓN DE SEMESTRE ─── */}
          <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border-2 ${isDarkMode ? 'bg-maroon-700/10 border-maroon-700/20' : 'bg-white border-slate-200 shadow-sm'}`}>
              <ClipboardCheck className={`w-3.5 h-3.5 ${isDarkMode ? 'text-maroon-400' : 'text-red-900'}`} />
              <span className={`text-xs font-bold tracking-wider uppercase ${isDarkMode ? 'text-maroon-300' : 'text-red-900'}`}>
                ANEXO C — SEMESTRE 2026-II
              </span>
            </div>

            {/* Badge de estado del sistema y semestre */}
            <div className={`flex items-center gap-2.5 px-4 py-1.5 rounded-full border-2 text-xs font-bold transition-all ${isDarkMode
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 shadow-lg shadow-black/20'
              : 'bg-white border-emerald-300 text-emerald-800 shadow-sm'
              }`}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Registro de Actividades en Línea</span>
              <span className="opacity-40">•</span>
              <span className={isDarkMode ? 'text-slate-300' : 'text-slate-500'}>Semestre 2026-II</span>
            </div>

            {/* Tracker de progreso del formulario */}
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border-2 text-xs font-bold ${progresoFormulario.porcentaje === 100
              ? isDarkMode ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-400 text-emerald-700'
              : isDarkMode
                ? 'bg-white/5 border-white/10 text-slate-300'
                : 'bg-white border-slate-200 text-slate-700 shadow-sm'
              }`}>
              <span>Progreso: {progresoFormulario.completados}/{progresoFormulario.total}</span>
              <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-maroon-600 to-emerald-500 transition-all duration-300"
                  style={{ width: `${progresoFormulario.porcentaje}%` }}
                />
              </div>
            </div>
          </motion.div>

          {/* ─── DATOS INSTITUCIONALES (READ-ONLY) ─── */}
          <motion.section variants={itemVariants}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-5 bg-maroon-700 rounded-full" />
              <h2 className={`text-xs font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-maroon-300' : 'text-red-900'}`}>
                Datos Institucionales
              </h2>
              <Lock className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <ReadOnlyCard
                isDarkMode={isDarkMode}
                icon={<Building2 className="w-4 h-4" />}
                label="Facultad"
                value={docente.facultad}
              />
              <ReadOnlyCard
                isDarkMode={isDarkMode}
                icon={<GraduationCap className="w-4 h-4" />}
                label="Escuela Profesional"
                value={docente.escuela}
              />
              <ReadOnlyCard
                isDarkMode={isDarkMode}
                icon={<BookOpen className="w-4 h-4" />}
                label="Carrera Profesional"
                value={docente.carrera}
              />
              <ReadOnlyCard
                isDarkMode={isDarkMode}
                icon={<User className="w-4 h-4" />}
                label="Docente"
                value={docente.nombre}
              />
            </div>
          </motion.section>

          {/* ─── DATOS DE LA SESIÓN ─── */}
          <motion.section variants={itemVariants}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-5 bg-maroon-700 rounded-full" />
              <h2 className={`text-xs font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-maroon-300' : 'text-red-900'}`}>
                Datos de la Sesión de Clase
              </h2>
            </div>

            <div className={`rounded-3xl border transition-all duration-500 overflow-hidden ${isDarkMode ? 'glass-card-dark' : 'glass-card-light'
              }`}>
              <div className="p-5 sm:p-7 space-y-6">

                {/* Row 1: N°, Aula, Fecha (tour-step-1) */}
                <div id="tour-step-1" className="space-y-4 p-2 rounded-2xl transition-all">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : '!text-slate-800'}`} htmlFor="campo-numero">
                        <span><Hash className="w-3.5 h-3.5 inline mr-1 text-maroon-500" /> N° de Registro</span>
                        <span className="text-[10px] text-emerald-500 font-bold">Auto-correlativo</span>
                      </label>
                      <input
                        type="text"
                        id="campo-numero"
                        value={formData.numero}
                        readOnly
                        className={`${isDarkMode ? 'input-institutional-dark' : 'input-institutional-light'} font-mono font-bold !bg-slate-500/10 cursor-not-allowed`}
                      />
                    </div>

                    <div>
                      <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : '!text-slate-800'}`} htmlFor="campo-aula">
                        <span><MapPin className="w-3.5 h-3.5 inline mr-1 text-maroon-500" /> Aula / Laboratorio</span>
                        {formData.aulaLab && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                      </label>
                      <input
                        type="text"
                        id="campo-aula"
                        value={formData.aulaLab}
                        onChange={(e) => updateField('aulaLab', e.target.value)}
                        placeholder="Ej. Aula 301, Lab. Cómputo 2"
                        className={isDarkMode ? 'input-institutional-dark' : 'input-institutional-light'}
                      />
                    </div>

                    <div>
                      <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : '!text-slate-800'}`} htmlFor="campo-fecha">
                        <span><Calendar className="w-3.5 h-3.5 inline mr-1 text-maroon-500" /> Fecha</span>
                        <span className={`text-[10px] font-semibold ${isDarkMode ? 'text-maroon-400' : 'text-red-800'}`}>Auto-calcula semana</span>
                      </label>
                      <input
                        type="date"
                        id="campo-fecha"
                        value={formData.fecha}
                        onChange={(e) => updateField('fecha', e.target.value)}
                        className={isDarkMode ? 'input-institutional-dark' : 'input-institutional-light'}
                      />
                    </div>
                  </div>

                  {/* Row 2: Asignatura (incluye Código, Nombre y Sección) */}
                  <div>
                    <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : '!text-slate-800'}`} htmlFor="campo-asignatura">
                      <span><BookMarked className="w-3.5 h-3.5 inline mr-1 text-maroon-500" /> Asignatura y Sección</span>
                      {formData.asignatura && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                    </label>
                    <select
                      id="campo-asignatura"
                      value={formData.asignatura}
                      onChange={(e) => updateField('asignatura', e.target.value)}
                      className={isDarkMode ? 'select-institutional-dark' : 'select-institutional-light'}
                    >
                      <option value="">Seleccione la asignatura y sección</option>
                      {(docente.cursos || []).map((curso) => (
                        <option key={curso} value={curso}>{curso}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 3 y 4: Unidad, Semana y Tema (tour-step-2) */}
                <div id="tour-step-2" className="space-y-4 p-2 rounded-2xl transition-all">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : '!text-slate-800'}`} htmlFor="campo-unidad">
                        <span><Layers className="w-3.5 h-3.5 inline mr-1 text-maroon-500" /> Unidad Académica</span>
                        <span className={`text-[10px] font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>6 semanas c/u</span>
                      </label>
                      <select
                        id="campo-unidad"
                        value={formData.unidad}
                        onChange={(e) => updateField('unidad', e.target.value)}
                        className={isDarkMode ? 'select-institutional-dark' : 'select-institutional-light'}
                      >
                        <option value="">Seleccione Unidad</option>
                        <option value="I">Unidad I</option>
                        <option value="II">Unidad II</option>
                        <option value="III">Unidad III</option>
                      </select>
                    </div>

                    <div>
                      <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : '!text-slate-800'}`} htmlFor="campo-semana">
                        <span><Calendar className="w-3.5 h-3.5 inline mr-1 text-maroon-500" /> N° de Semana Académica</span>
                        <span className={`text-[10px] font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>18 semanas en total</span>
                      </label>
                      <select
                        id="campo-semana"
                        value={formData.semanaAcademica}
                        onChange={(e) => updateField('semanaAcademica', e.target.value)}
                        className={isDarkMode ? 'select-institutional-dark' : 'select-institutional-light'}
                      >
                        <option value="">Seleccione Semana</option>
                        {Array.from({ length: SEMESTRE_CONFIG.totalSemanas }, (_, i) => {
                          const semNum = i + 1
                          const esFlorales = semNum === SEMESTRE_CONFIG.semanaJuegosFlorales
                          return (
                            <option key={semNum} value={semNum}>
                              Semana {semNum} {esFlorales ? '— (Juegos Florales / Recup.)' : ''}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Row 4: Tema Programado */}
                  <div>
                    <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : '!text-slate-800'}`} htmlFor="campo-tema">
                      <span><FileText className="w-3.5 h-3.5 inline mr-1 text-maroon-500" /> Tema Programado en el Sílabo</span>
                      {formData.temaProgramado && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                    </label>
                    <textarea
                      id="campo-tema"
                      value={formData.temaProgramado}
                      onChange={(e) => updateField('temaProgramado', e.target.value)}
                      placeholder="Describa el tema o actividad a desarrollar según el sílabo..."
                      rows={3}
                      className={isDarkMode ? 'textarea-institutional-dark' : 'textarea-institutional-light'}
                    />
                  </div>
                </div>

                {/* Row 5 y 6: Recursos y Asistencia (tour-step-3) */}
                <div id="tour-step-3" className="space-y-6 p-2 rounded-2xl transition-all">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <label className={`label-institutional !mb-0 ${isDarkMode ? '!text-slate-200' : '!text-slate-800'}`}>
                        <MonitorPlay className="w-3.5 h-3.5 inline mr-1 text-maroon-500" />
                        Recursos Utilizados
                      </label>

                      {/* Botones de acción rápida para recursos */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={aplicarRecursosHabituales}
                          className={`text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${isDarkMode
                            ? 'bg-maroon-800/40 text-maroon-300 hover:bg-maroon-800/70 border border-maroon-700/50'
                            : 'bg-red-900/10 text-red-900 hover:bg-red-900/20 border-2 border-red-900/20'
                            }`}
                        >
                          <Sparkles className="w-3 h-3" />
                          Habituales
                        </button>
                        <button
                          type="button"
                          onClick={limpiarRecursos}
                          className="text-xs px-2 py-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          title="Limpiar selección"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <p className={`text-xs mb-3 font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Seleccione los recursos que utilizará en la clase
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {RECURSOS_OPTIONS.map((recurso) => {
                        const isSelected = formData.recursos.includes(recurso.id)
                        return (
                          <motion.label
                            key={recurso.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            htmlFor={`recurso-${recurso.id}`}
                            className={`
                              flex items-center gap-2.5 px-3.5 py-3 rounded-2xl cursor-pointer
                              border-2 transition-all duration-200 select-none
                              ${isSelected
                                ? isDarkMode
                                  ? 'border-maroon-500 bg-maroon-950/70 shadow-lg shadow-maroon-950/40 text-white'
                                  : 'border-maroon-600 bg-maroon-50 text-maroon-950 font-bold shadow-md shadow-maroon-700/10 ring-2 ring-maroon-600/15'
                                : isDarkMode
                                  ? 'border-slate-800 bg-slate-800/60 hover:border-slate-700 text-slate-300'
                                  : 'border-slate-300 bg-slate-50 hover:bg-white hover:border-slate-400 text-slate-800 font-semibold shadow-xs'
                              }
                            `}
                          >
                            <input
                              type="checkbox"
                              id={`recurso-${recurso.id}`}
                              checked={isSelected}
                              onChange={() => toggleRecurso(recurso.id)}
                              className="sr-only"
                            />
                            <div className={`
                              w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0
                              transition-all duration-200
                              ${isSelected
                                ? 'bg-maroon-600 border-maroon-600 text-white'
                                : 'border-slate-400/50 bg-transparent'
                              }
                            `}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className="text-xs leading-tight">
                              <span className="mr-1.5">{recurso.icon}</span>
                              <span className="font-semibold">{recurso.label}</span>
                            </span>
                          </motion.label>
                        )
                      })}
                    </div>
                  </div>

                  {/* Row 6: N° Estudiantes + Validación */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : '!text-slate-800'}`} htmlFor="campo-estudiantes">
                        <span><Users className="w-3.5 h-3.5 inline mr-1 text-maroon-500" /> N° de Estudiantes Asistentes</span>
                        {formData.numEstudiantes && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                      </label>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            id="campo-estudiantes"
                            value={formData.numEstudiantes}
                            onChange={(e) => updateField('numEstudiantes', e.target.value)}
                            placeholder="Ej. 35"
                            min="0"
                            max="200"
                            className={`${isDarkMode ? 'input-institutional-dark' : 'input-institutional-light'} font-mono font-semibold`}
                          />
                          {/* Stepper buttons */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => ajustarAsistencia(-1)}
                              className={`p-3 rounded-xl border-2 transition-all ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-sm'}`}
                              title="Restar 1"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => ajustarAsistencia(1)}
                              className={`p-3 rounded-xl border-2 transition-all ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-sm'}`}
                              title="Sumar 1"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Presets rápidos de asistencia */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`text-[10px] font-semibold mr-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Rápido:</span>
                          {PRESETS_ASISTENCIA.map((qty) => (
                            <button
                              key={qty}
                              type="button"
                              onClick={() => updateField('numEstudiantes', String(qty))}
                              className={`text-[11px] px-2 py-0.5 rounded-lg border font-mono transition-all ${formData.numEstudiantes === String(qty)
                                ? 'bg-maroon-700 text-white border-maroon-700'
                                : isDarkMode
                                  ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                              {qty}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className={`label-institutional ${isDarkMode ? '!text-slate-200' : '!text-slate-800'}`}>
                        <ClipboardCheck className="w-3.5 h-3.5 inline mr-1 text-maroon-500" />
                        Validación de la Sesión
                      </label>
                      <div className={`
                        flex items-center gap-2.5 px-4 py-3 rounded-xl border-2
                        ${sessionState === 'finished'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                          : isDarkMode
                            ? 'bg-slate-800/60 border-slate-700 text-slate-400'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }
                      `}>
                        <div className={`
                          w-3 h-3 rounded-full
                          ${sessionState === 'finished' ? 'bg-amber-400 animate-pulse' : 'bg-slate-400'}
                        `} />
                        <span className="text-sm font-semibold">
                          {sessionState === 'finished' ? 'Pendiente de Validación por Dirección' : 'Sin registrar'}
                        </span>
                        <Lock className="w-3.5 h-3.5 opacity-50 ml-auto" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Observaciones */}
                <div>
                  <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : '!text-slate-800'}`} htmlFor="campo-observaciones">
                    <span>
                      <MessageSquare className="w-3.5 h-3.5 inline mr-1 text-maroon-500" />
                      Observaciones
                      <span className="text-slate-400 font-normal ml-1.5 text-xs">(opcional)</span>
                    </span>
                  </label>
                  <textarea
                    id="campo-observaciones"
                    value={formData.observaciones}
                    onChange={(e) => updateField('observaciones', e.target.value)}
                    placeholder="Alguna observación sobre la sesión, recuperación de clase o eventualidades..."
                    rows={2}
                    className={isDarkMode ? 'textarea-institutional-dark' : 'textarea-institutional-light'}
                  />
                </div>
              </div>

              {/* ─── ACTION BUTTONS BAR ─── */}
              <div className={`border-t-2 px-5 sm:px-7 py-5 transition-colors duration-500 ${isDarkMode ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-50'
                }`}>

                {/* ── Duración de la sesión (tour-step-4) ── */}
                <div id="tour-step-4" className="space-y-4">
                  {sessionState === 'idle' && (
                    <div className={`mb-5 p-4 sm:p-5 rounded-2xl border-2 border-dashed transition-all ${isDarkMode ? 'border-maroon-500/30 bg-maroon-950/20' : 'border-red-800/30 bg-white shadow-sm'
                      }`}>
                      <label className={`label-institutional flex items-center gap-1.5 mb-3 ${isDarkMode ? '!text-slate-200' : '!text-slate-800'}`}>
                        <Timer className="w-4 h-4 text-maroon-500" />
                        Duración Estimada de la Clase
                        <span className="text-slate-400 font-normal text-[11px] ml-1">
                          (Recibirás una alerta 10 min antes del fin)
                        </span>
                      </label>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            id="campo-duracion-horas"
                            value={duracionHoras}
                            onChange={(e) => setDuracionHoras(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            min="0"
                            max="12"
                            className={`${isDarkMode ? 'input-institutional-dark' : 'input-institutional-light'} text-center !py-2.5 w-20 font-mono font-bold`}
                          />
                          <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>hora(s)</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            id="campo-duracion-minutos"
                            value={duracionMinutos}
                            onChange={(e) => setDuracionMinutos(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                            min="0"
                            max="59"
                            className={`${isDarkMode ? 'input-institutional-dark' : 'input-institutional-light'} text-center !py-2.5 w-20 font-mono font-bold`}
                          />
                          <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>minuto(s)</span>
                        </div>

                        <div className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-maroon-500/10 border border-maroon-500/20">
                          {notificationPermission === 'granted' ? (
                            <>
                              <Bell className="w-4 h-4 text-maroon-500" />
                              <span className={`text-xs font-semibold ${isDarkMode ? 'text-maroon-300' : 'text-maroon-700'}`}>
                                Alertas con sonido activas
                              </span>
                            </>
                          ) : notificationPermission === 'denied' ? (
                            <>
                              <Bell className="w-4 h-4 text-slate-400" />
                              <span className="text-xs font-medium text-slate-500">Alertas bloqueadas en navegador</span>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => Notification.requestPermission().then((p) => setNotificationPermission(p))}
                              className="flex items-center gap-1.5 text-xs font-bold text-maroon-600 hover:text-maroon-800 transition-colors"
                            >
                              <BellRing className="w-4 h-4 animate-bounce" />
                              Activar alertas de navegador
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Time Display Row */}
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <TimeDisplay
                      isDarkMode={isDarkMode}
                      label="Hora de Inicio"
                      value={formData.horaInicio}
                      active={sessionState === 'started' || sessionState === 'finished'}
                      color="emerald"
                    />
                    <TimeDisplay
                      isDarkMode={isDarkMode}
                      label="Hora de Finalización"
                      value={formData.horaFinalizacion}
                      active={sessionState === 'finished'}
                      color="rose"
                    />
                  </div>

                  {/* Main Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3.5">
                    <motion.button
                      whileHover={sessionState === 'idle' ? { scale: 1.015 } : {}}
                      whileTap={sessionState === 'idle' ? { scale: 0.985 } : {}}
                      onClick={handleRegistrarInicio}
                      disabled={sessionState !== 'idle'}
                      className={`
                        flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl
                        font-bold text-sm sm:text-base tracking-wide transition-all duration-300
                        ${sessionState === 'idle'
                          ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-xl shadow-emerald-600/25 hover:shadow-2xl hover:shadow-emerald-600/35 hover:from-emerald-500 hover:to-emerald-600'
                          : sessionState === 'started' || sessionState === 'finished'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 cursor-not-allowed'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                        }
                      `}
                      id="btn-registro-inicio"
                    >
                      <PlayCircle className="w-5 h-5" />
                      <span>
                        {sessionState === 'idle' ? 'Registrar Inicio de Clase' : `Inicio Registrado — ${formData.horaInicio}`}
                      </span>
                    </motion.button>

                    <motion.button
                      whileHover={sessionState === 'started' ? { scale: 1.015 } : {}}
                      whileTap={sessionState === 'started' ? { scale: 0.985 } : {}}
                      onClick={handleRegistrarSalida}
                      disabled={sessionState !== 'started'}
                      className={`
                        flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl
                        font-bold text-sm sm:text-base tracking-wide transition-all duration-300
                        ${sessionState === 'started'
                          ? 'bg-gradient-to-r from-maroon-700 via-maroon-800 to-maroon-900 text-white shadow-xl shadow-maroon-800/30 hover:shadow-2xl hover:shadow-maroon-800/40 hover:from-maroon-600 pulse-glow'
                          : sessionState === 'finished'
                            ? 'bg-maroon-500/15 text-maroon-600 dark:text-maroon-400 border border-maroon-500/30 cursor-not-allowed'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-transparent'
                        }
                      `}
                      id="btn-registro-salida"
                    >
                      <StopCircle className="w-5 h-5" />
                      <span>
                        {sessionState === 'finished'
                          ? `Salida Registrada — ${formData.horaFinalizacion}`
                          : 'Registrar Salida de Clase'}
                      </span>
                    </motion.button>
                  </div>
                </div>

                {/* ── Botón Finalizar y Enviar (tour-step-5) con Validación Inteligente (Opción 2) ── */}
                <div id="tour-step-5">
                  <div className="mt-5 pt-5 border-t border-slate-200/60 dark:border-white/10">
                    <motion.button
                      whileHover={!isSending ? { scale: 1.01 } : {}}
                      whileTap={!isSending ? { scale: 0.99 } : {}}
                      onClick={() => {
                        if (sessionState === 'idle') {
                          showToast('error', '⚠️ Debe registrar el Inicio de Clase antes de finalizar y enviar.')
                          return
                        }
                        if (sessionState === 'started') {
                          showToast('error', '⏳ La clase está en curso. Primero registre la Salida de Clase antes de enviar.')
                          return
                        }
                        setShowSuccessModal(true)
                      }}
                      disabled={isSending}
                      className={`
                        w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl
                        font-bold text-base tracking-wide transition-all duration-300 cursor-pointer
                        ${isSent
                          ? 'bg-emerald-600/20 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-500 hover:bg-emerald-600/30 shadow-lg shadow-emerald-500/10'
                          : sessionState === 'finished'
                            ? 'bg-gradient-to-r from-red-900 via-red-800 to-red-900 text-white shadow-2xl shadow-red-950/40 hover:from-red-800 hover:to-red-700 ring-2 ring-red-500/40'
                            : isDarkMode
                              ? 'bg-slate-800/80 text-slate-400 border-2 border-slate-700/80 hover:border-slate-600 hover:text-slate-300'
                              : 'bg-slate-100 text-slate-500 border-2 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                        }
                      `}
                      id="btn-finalizar-enviar"
                    >
                      {isSent ? (
                        <>
                          <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                          <span>Registro Enviado y Guardado en Google Sheets (Ver Ficha)</span>
                        </>
                      ) : isSending ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span>Guardando datos en Google Sheets...</span>
                        </>
                      ) : (
                        <>
                          <Send className={`w-5 h-5 ${sessionState === 'finished' ? 'text-white' : 'opacity-60'}`} />
                          <span>Finalizar Sesión y Enviar Registro</span>
                        </>
                      )}
                    </motion.button>
                    {!isSent && !isSending && (
                      <p className={`text-center text-xs mt-2.5 font-medium transition-colors ${
                        sessionState === 'finished'
                          ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                          : isDarkMode ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        {sessionState === 'idle' && 'ℹ️ Registre el inicio de clase para comenzar.'}
                        {sessionState === 'started' && '⏳ Clase en curso. Al terminar, presione "Registrar Salida de Clase".'}
                        {sessionState === 'finished' && '✅ Salida registrada. Presione para confirmar y enviar su ficha a Google Sheets.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Footer */}
          <motion.footer variants={itemVariants} className="text-center py-6">
            <p className={`text-xs font-medium transition-colors duration-500 ${isDarkMode ? 'text-white/40' : 'text-slate-600'}`}>
              Universidad Privada de Tacna — Sistema de Control de Avance Silábico © {new Date().getFullYear()}
            </p>
            <p className={`text-[10px] mt-1 font-medium transition-colors duration-500 ${isDarkMode ? 'text-white/20' : 'text-slate-500'}`}>
              Escuela Profesional de Ingeniería Civil — Anexo C (Semestre 2026-II)
            </p>
          </motion.footer>
        </motion.div>
      </main>

      {/* ═══════════ TOUR GUIADO ONBOARDING (NUBES INSTRUCTIVAS) ═══════════ */}
      <OnboardingTour
        isOpen={isTourOpen}
        onClose={handleCloseTour}
        isDarkMode={isDarkMode}
        currentStepIndex={tourStepIndex}
        setCurrentStepIndex={setTourStepIndex}
      />

      {/* ═══════════ MODAL FLOTANTE DE CONFIRMACIÓN ELEGANTE ═══════════ */}
      <ConfirmationModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        data={submittedData || formData}
        docente={docente}
        isDarkMode={isDarkMode}
        isSending={isSending}
        isSent={isSent}
        onConfirmAndSend={handleFinalizarYEnviar}
        onNuevoRegistro={handleNuevoRegistro}
        onLogout={onLogout}
      />
    </motion.div>
  )
}

// ═══════════ SUB-COMPONENTS ═══════════

const ReadOnlyCard = ({ icon, label, value, isDarkMode }) => (
  <div className={`group relative rounded-2xl border-2 p-4 transition-all duration-300 select-none ${isDarkMode
    ? 'bg-slate-900/80 border-white/10 hover:border-maroon-500/40 shadow-lg shadow-black/30'
    : 'bg-slate-50 border-slate-200 hover:border-red-800/40 shadow-md shadow-slate-200/60 hover:shadow-lg'
    }`}>
    <div className="flex items-start gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${isDarkMode ? 'bg-maroon-700/20 text-maroon-300 border border-maroon-700/30' : 'bg-red-900/10 border border-red-900/15 text-red-900 group-hover:bg-red-900/15'
        }`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[10px] font-extrabold uppercase tracking-wider mb-0.5 flex items-center gap-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          {label}
          <Lock className="w-2.5 h-2.5 opacity-60" />
        </p>
        <p className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          {value || '—'}
        </p>
      </div>
    </div>
  </div>
)

const TimeDisplay = ({ label, value, active, color, isDarkMode }) => {
  const isEmerald = color === 'emerald'

  const activeStyles = isEmerald
    ? isDarkMode
      ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-950/50'
      : 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-md shadow-emerald-100'
    : isDarkMode
      ? 'bg-rose-950/70 border-rose-500 text-rose-300 shadow-lg shadow-rose-950/50'
      : 'bg-rose-50 border-rose-500 text-rose-900 shadow-md shadow-rose-100'

  const idleStyles = isDarkMode
    ? 'bg-slate-800/90 border-slate-700 text-slate-300'
    : 'bg-white border-slate-300 text-slate-700 shadow-sm'

  return (
    <div className={`flex-1 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${active ? activeStyles : idleStyles}`}>
      <div className="flex items-center gap-2.5">
        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${active
          ? isEmerald
            ? 'bg-emerald-400 ring-4 ring-emerald-500/20 animate-pulse'
            : 'bg-rose-400 ring-4 ring-rose-500/20'
          : isDarkMode ? 'bg-slate-600' : 'bg-slate-400'
          }`} />
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
      </div>

      <div className={`font-mono-clock font-extrabold text-base sm:text-lg tracking-widest px-2.5 py-0.5 rounded-lg ${active
        ? isEmerald
          ? isDarkMode ? 'bg-emerald-900/60 text-emerald-200' : 'bg-emerald-200/60 text-emerald-900'
          : isDarkMode ? 'bg-rose-900/60 text-rose-200' : 'bg-rose-200/60 text-rose-900'
        : isDarkMode ? 'bg-slate-900/60 text-slate-400' : 'bg-slate-200/70 text-slate-500'
        }`}>
        {value || '--:--:--'}
      </div>
    </div>
  )
}

export default FormView
