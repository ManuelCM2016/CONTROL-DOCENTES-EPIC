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

  // ── Función para generar estado inicial con automatizaciones ──
  const getAutomatedInitialFormData = useCallback(() => {
    const hoy = new Date().toISOString().split('T')[0]
    const { semana, unidad } = calcularSemanaYUnidad(hoy)
    const ultimoNumero = getSiguienteNumeroRegistro(docente?.dni)
    const ultimaAula = typeof localStorage !== 'undefined' ? localStorage.getItem('upt_last_aula') || '' : ''
    const cursoUnico = docente?.cursos && docente.cursos.length === 1 ? docente.cursos[0] : ''

    return {
      numero: ultimoNumero,
      aulaLab: ultimaAula,
      fecha: hoy,
      unidad: unidad,
      semanaAcademica: String(semana),
      asignatura: cursoUnico,
      seccion: '',
      temaProgramado: '',
      recursos: [...RECURSOS_HABITUALES], // Preseleccionados por defecto
      horaInicio: null,
      horaFinalizacion: null,
      numEstudiantes: '',
      observaciones: '',
    }
  }, [docente])

  // ── Inicializar estado (LocalStorage o Automatizado) ──
  const [formData, setFormData] = useState(() => {
    const saved = loadFormData()
    if (saved && (saved.horaInicio || saved.temaProgramado || saved.asignatura)) {
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

  // ── Auto-guardado en localStorage ──
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

      // Si cambia el aula, guardarla como preferencia en este dispositivo
      if (field === 'aulaLab' && typeof localStorage !== 'undefined') {
        localStorage.setItem('upt_last_aula', value)
      }

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
      Boolean(formData.seccion?.trim()),
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
      { key: 'asignatura', name: 'Asignatura' },
      { key: 'seccion', name: 'Sección' },
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
        seccion: formData.seccion,
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
          : 'linear-gradient(135deg, #fdfbfb 0%, #f7f1f1 50%, #f4e8e8 100%)',
      }}
    >
      {/* ═══════════════════ HEADER ═══════════════════ */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`sticky top-0 z-50 backdrop-blur-xl border-b transition-colors duration-500 ${
          isDarkMode
            ? 'bg-[#150707]/85 border-white/10 shadow-lg shadow-black/40'
            : 'bg-white/90 border-slate-200/80 shadow-sm'
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
                <h1 className={`text-sm font-bold tracking-wide leading-tight transition-colors duration-500 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  CONTROL DE AVANCE SILÁBICO
                </h1>
                <p className={`text-[11px] leading-tight transition-colors duration-500 ${isDarkMode ? 'text-maroon-300/80' : 'text-slate-500'}`}>
                  Escuela Profesional de Ingeniería Civil — UPT
                </p>
              </div>
            </div>

            {/* Center: Docente info */}
            <div className={`hidden md:flex items-center gap-2.5 px-4 py-2 rounded-xl border transition-colors duration-500 ${
              isDarkMode
                ? 'bg-white/5 border-white/10 text-white'
                : 'bg-maroon-50/70 border-maroon-100/60 text-maroon-900'
            }`}>
              <div className="w-8 h-8 rounded-lg bg-maroon-700/20 flex items-center justify-center text-maroon-600">
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{docente.nombre}</p>
                <p className={`text-[10px] leading-tight ${isDarkMode ? 'text-maroon-300' : 'text-maroon-600'}`}>
                  DNI / Cód: {docente.dni || docente.codigo}
                </p>
              </div>
            </div>

            {/* Right: Clock + Actions */}
            <div className="flex items-center gap-4">
              <DigitalClock isDarkMode={isDarkMode} />
              <div className="flex items-center gap-2 border-l border-slate-200/40 pl-3">
                <button
                  onClick={toggleTheme}
                  className={`p-2.5 rounded-xl border transition-all duration-300 ${
                    isDarkMode
                      ? 'bg-white/10 border-white/15 text-yellow-300 hover:bg-white/20'
                      : 'bg-maroon-50 border-maroon-100 text-maroon-800 hover:bg-maroon-100'
                  }`}
                  title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                >
                  {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button
                  onClick={onLogout}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isDarkMode
                      ? 'text-red-300 hover:text-white hover:bg-red-500/20'
                      : 'text-slate-600 hover:text-red-600 hover:bg-red-50'
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
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-maroon-700/10 border border-maroon-700/20 backdrop-blur-md">
              <ClipboardCheck className="w-3.5 h-3.5 text-maroon-600" />
              <span className={`text-xs font-bold tracking-wider uppercase ${isDarkMode ? 'text-maroon-300' : 'text-maroon-800'}`}>
                ANEXO C — SEMESTRE 2026-II
              </span>
            </div>

            {/* Badge de detección de calendario */}
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
              estadoCalendario.esJuegosFlorales
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-300 font-bold'
                : isDarkMode
                  ? 'bg-white/5 border-white/10 text-maroon-200'
                  : 'bg-white/80 border-slate-200 text-slate-700 shadow-sm'
            }`}>
              <Sparkles className="w-3.5 h-3.5 text-maroon-500" />
              <span>{estadoCalendario.detalle}</span>
            </div>

            {/* Tracker de progreso del formulario */}
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold ${
              progresoFormulario.porcentaje === 100
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : isDarkMode
                  ? 'bg-white/5 border-white/10 text-slate-300'
                  : 'bg-white/80 border-slate-200 text-slate-600 shadow-sm'
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
              <div className="w-1 h-5 bg-maroon-600 rounded-full" />
              <h2 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-maroon-300' : 'text-slate-700'}`}>
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
              <div className="w-1 h-5 bg-maroon-600 rounded-full" />
              <h2 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-maroon-300' : 'text-slate-700'}`}>
                Datos de la Sesión de Clase
              </h2>
            </div>

            <div className={`rounded-3xl border transition-all duration-500 overflow-hidden ${
              isDarkMode ? 'glass-card-dark' : 'glass-card-light'
            }`}>
              <div className="p-5 sm:p-7 space-y-6">
                
                {/* Row 1: N°, Aula, Fecha */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : ''}`} htmlFor="campo-numero">
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
                    <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : ''}`} htmlFor="campo-aula">
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
                    <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : ''}`} htmlFor="campo-fecha">
                      <span><Calendar className="w-3.5 h-3.5 inline mr-1 text-maroon-500" /> Fecha</span>
                      <span className="text-[10px] text-maroon-500">Auto-calcula semana</span>
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

                {/* Row 2: Asignatura (dinámica), Sección */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : ''}`} htmlFor="campo-asignatura">
                      <span><BookMarked className="w-3.5 h-3.5 inline mr-1 text-maroon-500" /> Asignatura</span>
                      {formData.asignatura && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                    </label>
                    <select
                      id="campo-asignatura"
                      value={formData.asignatura}
                      onChange={(e) => updateField('asignatura', e.target.value)}
                      className={isDarkMode ? 'select-institutional-dark' : 'select-institutional-light'}
                    >
                      <option value="">Seleccione la asignatura</option>
                      {(docente.cursos || []).map((curso) => (
                        <option key={curso} value={curso}>{curso}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : ''}`} htmlFor="campo-seccion">
                      <span><Layers className="w-3.5 h-3.5 inline mr-1 text-maroon-500" /> Sección</span>
                      {formData.seccion && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                    </label>
                    <input
                      type="text"
                      id="campo-seccion"
                      value={formData.seccion}
                      onChange={(e) => updateField('seccion', e.target.value)}
                      placeholder="Ej. A, B, C o Única"
                      className={isDarkMode ? 'input-institutional-dark' : 'input-institutional-light'}
                    />
                  </div>
                </div>

                {/* Row 3: Unidad, Semana Académica (Autocalculadas del Semestre 2026-II) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : ''}`} htmlFor="campo-unidad">
                      <span><Layers className="w-3.5 h-3.5 inline mr-1 text-maroon-500" /> Unidad Académica</span>
                      <span className="text-[10px] text-slate-400 font-normal">6 semanas c/u</span>
                    </label>
                    <select
                      id="campo-unidad"
                      value={formData.unidad}
                      onChange={(e) => updateField('unidad', e.target.value)}
                      className={isDarkMode ? 'select-institutional-dark' : 'select-institutional-light'}
                    >
                      <option value="">Seleccione Unidad</option>
                      <option value="I">Unidad I (Semanas 1 a 6)</option>
                      <option value="II">Unidad II (Semanas 7 a 12)</option>
                      <option value="III">Unidad III (Semanas 13 a 18)</option>
                    </select>
                  </div>

                  <div>
                    <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : ''}`} htmlFor="campo-semana">
                      <span><Calendar className="w-3.5 h-3.5 inline mr-1 text-maroon-500" /> N° de Semana Académica</span>
                      <span className="text-[10px] text-emerald-500 font-medium">18 semanas en total</span>
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
                  <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : ''}`} htmlFor="campo-tema">
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

                {/* Row 5: Recursos Utilizados con Chips y Presets */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <label className={`label-institutional !mb-0 ${isDarkMode ? '!text-slate-200' : ''}`}>
                      <MonitorPlay className="w-3.5 h-3.5 inline mr-1 text-maroon-500" />
                      Recursos Utilizados
                    </label>
                    
                    {/* Botones de acción rápida para recursos */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={aplicarRecursosHabituales}
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                          isDarkMode
                            ? 'bg-maroon-800/40 text-maroon-300 hover:bg-maroon-800/70 border border-maroon-700/50'
                            : 'bg-maroon-50 text-maroon-700 hover:bg-maroon-100 border border-maroon-200'
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

                  <p className="text-xs text-slate-400 mb-3">
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
                                ? 'border-maroon-500 bg-maroon-950/60 shadow-lg shadow-maroon-950/40 text-white'
                                : 'border-maroon-500 bg-maroon-50/80 shadow-md shadow-maroon-500/10 text-maroon-900'
                              : isDarkMode
                                ? 'border-slate-800 bg-slate-800/40 hover:border-slate-700 text-slate-300'
                                : 'border-slate-200 bg-white/70 hover:border-slate-300 text-slate-700'
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
                    <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : ''}`} htmlFor="campo-estudiantes">
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
                            className="p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                            title="Restar 1"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => ajustarAsistencia(1)}
                            className="p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                            title="Sumar 1"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Presets rápidos de asistencia */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 mr-1">Rápido:</span>
                        {PRESETS_ASISTENCIA.map((qty) => (
                          <button
                            key={qty}
                            type="button"
                            onClick={() => updateField('numEstudiantes', String(qty))}
                            className={`text-[11px] px-2 py-0.5 rounded-lg border font-mono transition-all ${
                              formData.numEstudiantes === String(qty)
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
                    <label className={`label-institutional ${isDarkMode ? '!text-slate-200' : ''}`}>
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

                {/* Observaciones */}
                <div>
                  <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : ''}`} htmlFor="campo-observaciones">
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
              <div className={`border-t px-5 sm:px-7 py-5 transition-colors duration-500 ${
                isDarkMode ? 'border-white/10 bg-black/20' : 'border-slate-200/80 bg-slate-50/70'
              }`}>

                {/* ── Duración de la sesión (Solo visible en IDLE) ── */}
                {sessionState === 'idle' && (
                  <div className={`mb-5 p-4 sm:p-5 rounded-2xl border-2 border-dashed transition-all ${
                    isDarkMode ? 'border-maroon-500/30 bg-maroon-950/20' : 'border-maroon-200 bg-white'
                  }`}>
                    <label className={`label-institutional flex items-center gap-1.5 mb-3 ${isDarkMode ? '!text-slate-200' : ''}`}>
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

                {/* ── Botón Finalizar y Enviar (aparece cuando la sesión termina) ── */}
                {sessionState === 'finished' && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    className="mt-5 pt-5 border-t border-slate-200/60 dark:border-white/10"
                  >
                    <motion.button
                      whileHover={!isSending && !isSent ? { scale: 1.01 } : {}}
                      whileTap={!isSending && !isSent ? { scale: 0.99 } : {}}
                      onClick={handleFinalizarYEnviar}
                      disabled={isSending || isSent}
                      className={`
                        w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl
                        font-bold text-base tracking-wide transition-all duration-300
                        ${isSent
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-400 cursor-not-allowed'
                          : isSending
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-wait'
                            : 'bg-gradient-to-r from-maroon-700 via-maroon-800 to-maroon-900 text-white shadow-2xl shadow-maroon-900/40 hover:from-maroon-600 hover:to-maroon-800 ring-2 ring-maroon-500/40'
                        }
                      `}
                      id="btn-finalizar-enviar"
                    >
                      {isSent ? (
                        <>
                          <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                          <span>Registro Enviado y Guardado en Google Sheets</span>
                        </>
                      ) : isSending ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span>Guardando datos en Google Sheets...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          <span>Finalizar Sesión y Enviar Registro</span>
                        </>
                      )}
                    </motion.button>
                    {!isSent && !isSending && (
                      <p className="text-center text-xs text-slate-400 mt-2.5">
                        Al enviar, se guardará en Google Sheets y el correlativo pasará automáticamente al siguiente número.
                      </p>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.section>

          {/* Footer */}
          <motion.footer variants={itemVariants} className="text-center py-6">
            <p className={`text-xs transition-colors duration-500 ${isDarkMode ? 'text-white/40' : 'text-slate-500'}`}>
              Universidad Privada de Tacna — Sistema de Control de Avance Silábico © {new Date().getFullYear()}
            </p>
            <p className={`text-[10px] mt-1 transition-colors duration-500 ${isDarkMode ? 'text-white/20' : 'text-slate-400'}`}>
              Escuela Profesional de Ingeniería Civil — Anexo C (Semestre 2026-II)
            </p>
          </motion.footer>
        </motion.div>
      </main>
    </motion.div>
  )
}

// ═══════════ SUB-COMPONENTS ═══════════

const ReadOnlyCard = ({ icon, label, value, isDarkMode }) => (
  <div className={`group relative rounded-2xl border p-4 transition-all duration-300 select-none ${
    isDarkMode
      ? 'bg-slate-900/60 border-white/10 hover:border-maroon-500/40 shadow-md shadow-black/20'
      : 'bg-white/90 border-slate-200/80 hover:border-maroon-200 shadow-sm hover:shadow-md'
  }`}>
    <div className="flex items-start gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${
        isDarkMode ? 'bg-maroon-700/20 text-maroon-300' : 'bg-maroon-50 text-maroon-700 group-hover:bg-maroon-100'
      }`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
          {label}
          <Lock className="w-2.5 h-2.5 opacity-40" />
        </p>
        <p className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
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
      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : isDarkMode
      ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
      : 'bg-rose-50 border-rose-200 text-rose-800'

  const idleStyles = isDarkMode
    ? 'bg-slate-800/40 border-slate-700 text-slate-400'
    : 'bg-slate-100 border-slate-200 text-slate-400'

  return (
    <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-medium transition-all ${active ? activeStyles : idleStyles}`}>
      <div className={`w-2.5 h-2.5 rounded-full ${
        active
          ? isEmerald
            ? 'bg-emerald-400 animate-pulse'
            : 'bg-rose-400'
          : 'bg-slate-400'
      }`} />
      <span>{label}:</span>
      <span className="font-mono-clock font-bold text-sm tracking-wider">
        {value || '--:--:--'}
      </span>
    </div>
  )
}

export default FormView
