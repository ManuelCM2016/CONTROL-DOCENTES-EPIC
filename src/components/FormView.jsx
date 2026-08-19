import { useState, useCallback, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  LogOut, Building2, GraduationCap, BookOpen, Lock,
  MapPin, BookMarked, Layers, Calendar, FileText,
  MonitorPlay, Users, MessageSquare, PlayCircle,
  StopCircle, ClipboardCheck, Hash, User, Send, Loader2, CheckCircle2,
  Bell, Timer, BellRing, Sun, Moon
} from 'lucide-react'
import DigitalClock from './DigitalClock'
import { registrarSesion } from '../services/api'
import { playAlertSound } from '../utils/alertSound'

// Opciones de recursos utilizados (del Excel)
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

// Estado inicial del formulario
const getInitialFormData = () => ({
  numero: '1',
  aulaLab: '',
  fecha: new Date().toISOString().split('T')[0],
  unidad: '',
  semanaAcademica: '',
  asignatura: '',
  seccion: '',
  temaProgramado: '',
  recursos: [],
  horaInicio: null,
  horaFinalizacion: null,
  numEstudiantes: '',
  observaciones: '',
})

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
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

  // ── Inicializar estado: primero intenta recuperar de localStorage ──
  const [formData, setFormData] = useState(() => {
    const saved = loadFormData()
    if (saved) {
      return { ...getInitialFormData(), ...saved }
    }
    return getInitialFormData()
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

  // ── Auto-guardado: cada vez que cambia formData, persistir en localStorage ──
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    saveFormData(formData)
  }, [formData, saveFormData])

  const updateField = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }, [])

  const toggleRecurso = useCallback((recursoId) => {
    setFormData((prev) => ({
      ...prev,
      recursos: prev.recursos.includes(recursoId)
        ? prev.recursos.filter((r) => r !== recursoId)
        : [...prev.recursos, recursoId],
    }))
  }, [])

  const handleRegistrarInicio = () => {
    // ── Validaciones ──
    const requiredFields = [
      { key: 'aulaLab', name: 'Aula / Laboratorio' },
      { key: 'fecha', name: 'Fecha' },
      { key: 'asignatura', name: 'Asignatura' },
      { key: 'seccion', name: 'Sección' },
      { key: 'unidad', name: 'Unidad' },
      { key: 'semanaAcademica', name: 'N° de Semana Académica' },
      { key: 'temaProgramado', name: 'Tema Programado en el Sílabo' },
      { key: 'numEstudiantes', name: 'N° de Estudiantes Asistentes' }
    ]

    const missingField = requiredFields.find(field => !formData[field.key])
    
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
    const totalMinutos = (parseInt(duracionHoras) || 0) * 60 + (parseInt(duracionMinutos) || 0)

    if (totalMinutos > 0 && notificationPermission === 'granted') {
      let tiempoEsperaMs

      if (totalMinutos <= 10) {
        // Sesión corta (≤10 min): notificar a los 10 segundos (modo prueba)
        tiempoEsperaMs = 10 * 1000
      } else {
        // Sesión normal: notificar 10 minutos antes del fin
        tiempoEsperaMs = (totalMinutos - 10) * 60 * 1000
      }

      // Limpiar timeout anterior si existe
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current)
      }

      notificationTimeoutRef.current = setTimeout(() => {
        // Reproducir sonido de alerta
        playAlertSound()

        // Mostrar notificación nativa del navegador
        new Notification('Control de Avance Silábico UPT', {
          body: 'Su sesión está por finalizar. Por favor, prepare el registro de su salida en el sistema.',
          icon: '/vite.svg',
          tag: 'epic-sesion-alert',
          requireInteraction: true,
        })
      }, tiempoEsperaMs)

      const minAlert = totalMinutos <= 10 ? '10 seg (modo prueba)' : `${totalMinutos - 10} min`
      showToast('info', `⏰ Notificación programada: sonará en ${minAlert}`)
    }
  }

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

    // ── Cancelar notificación pendiente ──
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
      // Construir payload completo con datos del docente + formulario
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
        // Limpiar localStorage después de envío exitoso
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
      className={`min-h-screen transition-colors duration-500`}
      style={{
        background: isDarkMode
          ? 'linear-gradient(135deg, #1a0a0a 0%, #2d1515 25%, #3B0D0D 50%, #2d1515 75%, #1a0a0a 100%)'
          : 'linear-gradient(to bottom right, #f8fafc, #ffffff, #fff1f2)'
      }}
    >
      {/* ═══════════════════ HEADER ═══════════════════ */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`sticky top-0 z-50 backdrop-blur-xl border-b transition-colors duration-500 ${
          isDarkMode 
            ? 'bg-[#1a0a0a]/80 border-white/10 shadow-lg shadow-black/20' 
            : 'bg-white/80 border-slate-200/60'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-[72px]">
            {/* Left: Logo + Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm overflow-hidden">
                <img src="/logo.png" alt="Logo UPT" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className={`text-sm font-bold tracking-wide leading-tight transition-colors duration-500 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  CONTROL DE AVANCE SILÁBICO
                </h1>
                <p className={`text-[11px] leading-tight transition-colors duration-500 ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>
                  Escuela Profesional de Ingeniería Civil — UPT
                </p>
              </div>
            </div>

            {/* Center: Docente info */}
            <div className="hidden md:flex items-center gap-2.5 px-4 py-2 rounded-xl bg-maroon-50/60 border border-maroon-100/50">
              <div className="w-8 h-8 rounded-lg bg-maroon-100 flex items-center justify-center">
                <User className="w-4 h-4 text-maroon-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-maroon-800 leading-tight">{docente.nombre}</p>
                <p className="text-[10px] text-maroon-500 leading-tight">DNI: {docente.dni}</p>
              </div>
            </div>

            {/* Right: Clock + Actions */}
            <div className="flex items-center gap-4">
              <DigitalClock isDarkMode={isDarkMode} />
              <div className="flex items-center gap-2 border-l border-slate-200/60 pl-4">
                <button
                  onClick={toggleTheme}
                  className={`p-2 rounded-xl transition-colors duration-300 ${
                    isDarkMode 
                      ? 'text-white/70 hover:text-white hover:bg-white/10' 
                      : 'text-slate-500 hover:text-maroon-700 hover:bg-maroon-50'
                  }`}
                  title="Cambiar tema"
                >
                  {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button
                  onClick={onLogout}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                    isDarkMode 
                      ? 'text-white/70 hover:text-white hover:bg-red-500/20' 
                      : 'text-slate-600 hover:text-red-600 hover:bg-red-50'
                  }`}
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Cerrar Sesión</span>
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
          {/* ─── BANNER TITLE ─── */}
          <motion.div variants={itemVariants} className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-maroon-50 border border-maroon-100 mb-2">
              <ClipboardCheck className="w-3.5 h-3.5 text-maroon-600" />
              <span className="text-xs font-semibold text-maroon-700 tracking-wider uppercase">
                Anexo C — Ficha de Seguimiento
              </span>
            </div>
          </motion.div>

          {/* ─── DATOS INSTITUCIONALES (READ-ONLY) ─── */}
          <motion.section variants={itemVariants}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 bg-maroon-600 rounded-full" />
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                Datos Institucionales
              </h2>
              <Lock className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <ReadOnlyCard
                icon={<Building2 className="w-4 h-4" />}
                label="Facultad"
                value={docente.facultad}
              />
              <ReadOnlyCard
                icon={<GraduationCap className="w-4 h-4" />}
                label="Escuela Profesional"
                value={docente.escuela}
              />
              <ReadOnlyCard
                icon={<BookOpen className="w-4 h-4" />}
                label="Carrera Profesional"
                value={docente.carrera}
              />
              <ReadOnlyCard
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
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                Datos de la Sesión
              </h2>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden">
              <div className="p-5 sm:p-6 space-y-5">
                {/* Row 1: N°, Aula, Fecha */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="label-institutional" htmlFor="campo-numero">
                      <Hash className="w-3.5 h-3.5 inline mr-1.5 text-maroon-500" />
                      N° de Registro
                    </label>
                    <input
                      type="text"
                      id="campo-numero"
                      value={formData.numero}
                      readOnly
                      className="input-institutional bg-slate-50 text-slate-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="label-institutional" htmlFor="campo-aula">
                      <MapPin className="w-3.5 h-3.5 inline mr-1.5 text-maroon-500" />
                      Aula / Laboratorio
                    </label>
                    <input
                      type="text"
                      id="campo-aula"
                      value={formData.aulaLab}
                      onChange={(e) => updateField('aulaLab', e.target.value)}
                      placeholder="Ej. Aula 301, Lab. Cómputo 2"
                      className="input-institutional"
                    />
                  </div>
                  <div>
                    <label className="label-institutional" htmlFor="campo-fecha">
                      <Calendar className="w-3.5 h-3.5 inline mr-1.5 text-maroon-500" />
                      Fecha
                    </label>
                    <input
                      type="date"
                      id="campo-fecha"
                      value={formData.fecha}
                      onChange={(e) => updateField('fecha', e.target.value)}
                      className="input-institutional"
                    />
                  </div>
                </div>

                {/* Row 2: Asignatura (dinámica), Sección */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label-institutional" htmlFor="campo-asignatura">
                      <BookMarked className="w-3.5 h-3.5 inline mr-1.5 text-maroon-500" />
                      Asignatura
                    </label>
                    <select
                      id="campo-asignatura"
                      value={formData.asignatura}
                      onChange={(e) => updateField('asignatura', e.target.value)}
                      className="select-institutional"
                    >
                      <option value="">Seleccione la asignatura</option>
                      {(docente.cursos || []).map((curso) => (
                        <option key={curso} value={curso}>{curso}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-institutional" htmlFor="campo-seccion">
                      <Layers className="w-3.5 h-3.5 inline mr-1.5 text-maroon-500" />
                      Sección
                    </label>
                    <input
                      type="text"
                      id="campo-seccion"
                      value={formData.seccion}
                      onChange={(e) => updateField('seccion', e.target.value)}
                      placeholder="Ej. A, B, C"
                      className="input-institutional"
                    />
                  </div>
                </div>

                {/* Row 3: Unidad, Semana Académica */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label-institutional" htmlFor="campo-unidad">
                      <Layers className="w-3.5 h-3.5 inline mr-1.5 text-maroon-500" />
                      Unidad
                    </label>
                    <select
                      id="campo-unidad"
                      value={formData.unidad}
                      onChange={(e) => updateField('unidad', e.target.value)}
                      className="select-institutional"
                    >
                      <option value="">Seleccione</option>
                      <option value="I">Unidad I</option>
                      <option value="II">Unidad II</option>
                      <option value="III">Unidad III</option>
                      <option value="IV">Unidad IV</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-institutional" htmlFor="campo-semana">
                      <Calendar className="w-3.5 h-3.5 inline mr-1.5 text-maroon-500" />
                      N° de Semana Académica
                    </label>
                    <select
                      id="campo-semana"
                      value={formData.semanaAcademica}
                      onChange={(e) => updateField('semanaAcademica', e.target.value)}
                      className="select-institutional"
                    >
                      <option value="">Seleccione</option>
                      {Array.from({ length: 17 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>Semana {i + 1}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 4: Tema Programado */}
                <div>
                  <label className="label-institutional" htmlFor="campo-tema">
                    <FileText className="w-3.5 h-3.5 inline mr-1.5 text-maroon-500" />
                    Tema Programado en el Sílabo
                  </label>
                  <textarea
                    id="campo-tema"
                    value={formData.temaProgramado}
                    onChange={(e) => updateField('temaProgramado', e.target.value)}
                    placeholder="Describa el tema a desarrollar según el sílabo..."
                    rows={3}
                    className="textarea-institutional"
                  />
                </div>

                {/* Row 5: Recursos Utilizados */}
                <div>
                  <label className="label-institutional">
                    <MonitorPlay className="w-3.5 h-3.5 inline mr-1.5 text-maroon-500" />
                    Recursos Utilizados
                  </label>
                  <p className="text-xs text-slate-400 mb-3 -mt-1">
                    Seleccione todos los recursos que utilizará en esta sesión
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {RECURSOS_OPTIONS.map((recurso) => {
                      const isSelected = formData.recursos.includes(recurso.id)
                      return (
                        <label
                          key={recurso.id}
                          htmlFor={`recurso-${recurso.id}`}
                          className={`
                            flex items-center gap-2.5 px-3.5 py-3 rounded-xl cursor-pointer
                            border-2 transition-all duration-200 select-none
                            ${isSelected
                              ? 'border-maroon-500 bg-maroon-50 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
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
                            w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0
                            transition-all duration-200
                            ${isSelected
                              ? 'bg-maroon-600 border-maroon-600'
                              : 'border-slate-300 bg-white'
                            }
                          `}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-xs leading-none">
                            <span className="mr-1">{recurso.icon}</span>
                            <span className={`font-medium ${isSelected ? 'text-maroon-800' : 'text-slate-600'}`}>
                              {recurso.label}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Row 6: N° Estudiantes + Validación */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label-institutional" htmlFor="campo-estudiantes">
                      <Users className="w-3.5 h-3.5 inline mr-1.5 text-maroon-500" />
                      N° de Estudiantes Asistentes
                    </label>
                    <input
                      type="number"
                      id="campo-estudiantes"
                      value={formData.numEstudiantes}
                      onChange={(e) => updateField('numEstudiantes', e.target.value)}
                      placeholder="Ej. 35"
                      min="0"
                      max="200"
                      className="input-institutional"
                    />
                  </div>
                  <div>
                    <label className="label-institutional">
                      <ClipboardCheck className="w-3.5 h-3.5 inline mr-1.5 text-maroon-500" />
                      Validación de la Sesión
                    </label>
                    <div className={`
                      flex items-center gap-2.5 px-4 py-3 rounded-xl border-2
                      ${sessionState === 'finished'
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-slate-50 border-slate-200'
                      }
                    `}>
                      <div className={`
                        w-3 h-3 rounded-full
                        ${sessionState === 'finished' ? 'bg-amber-400' : 'bg-slate-300'}
                      `} />
                      <span className={`
                        text-sm font-medium
                        ${sessionState === 'finished' ? 'text-amber-700' : 'text-slate-500'}
                      `}>
                        {sessionState === 'finished' ? 'Pendiente de Validación' : 'Sin registrar'}
                      </span>
                      <Lock className="w-3.5 h-3.5 text-slate-400 ml-auto" />
                    </div>
                  </div>
                </div>

                {/* Observaciones */}
                <div>
                  <label className="label-institutional" htmlFor="campo-observaciones">
                    <MessageSquare className="w-3.5 h-3.5 inline mr-1.5 text-maroon-500" />
                    Observaciones
                    <span className="text-slate-400 font-normal ml-1">(opcional)</span>
                  </label>
                  <textarea
                    id="campo-observaciones"
                    value={formData.observaciones}
                    onChange={(e) => updateField('observaciones', e.target.value)}
                    placeholder="Alguna observación adicional sobre la sesión..."
                    rows={2}
                    className="textarea-institutional"
                  />
                </div>
              </div>

              {/* ─── ACTION BUTTONS BAR ─── */}
              <div className="border-t border-slate-200/80 bg-slate-50/50 px-5 sm:px-6 py-4">

                {/* ── Duración de la sesión ── */}
                {sessionState === 'idle' && (
                  <div className="mb-4 p-4 rounded-xl bg-white border-2 border-dashed border-maroon-200/60">
                    <label className="label-institutional flex items-center gap-1.5 mb-3">
                      <Timer className="w-4 h-4 text-maroon-500" />
                      Duración de la Sesión
                      <span className="text-slate-400 font-normal text-[11px] ml-1">(para alerta 10 min antes del fin)</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            id="campo-duracion-horas"
                            value={duracionHoras}
                            onChange={(e) => setDuracionHoras(Math.max(0, parseInt(e.target.value) || 0))}
                            min="0"
                            max="12"
                            className="input-institutional text-center !py-2.5 w-20"
                          />
                          <span className="text-sm font-medium text-slate-500">hora(s)</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            id="campo-duracion-minutos"
                            value={duracionMinutos}
                            onChange={(e) => setDuracionMinutos(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                            min="0"
                            max="59"
                            className="input-institutional text-center !py-2.5 w-20"
                          />
                          <span className="text-sm font-medium text-slate-500">minuto(s)</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-maroon-50 border border-maroon-100">
                        {notificationPermission === 'granted' ? (
                          <>
                            <Bell className="w-4 h-4 text-maroon-600" />
                            <span className="text-xs font-medium text-maroon-700">Alertas activas</span>
                          </>
                        ) : notificationPermission === 'denied' ? (
                          <>
                            <Bell className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-medium text-slate-500">Alertas bloqueadas</span>
                          </>
                        ) : (
                          <button
                            onClick={() => Notification.requestPermission().then(p => setNotificationPermission(p))}
                            className="flex items-center gap-1.5 text-xs font-medium text-maroon-600 hover:text-maroon-800 transition-colors"
                          >
                            <BellRing className="w-4 h-4" />
                            Activar alertas
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Time Display Row */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <TimeDisplay
                    label="Hora de Inicio"
                    value={formData.horaInicio}
                    active={sessionState === 'started' || sessionState === 'finished'}
                    color="emerald"
                  />
                  <TimeDisplay
                    label="Hora de Finalización"
                    value={formData.horaFinalizacion}
                    active={sessionState === 'finished'}
                    color="rose"
                  />
                </div>

                {/* Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <motion.button
                    whileHover={sessionState === 'idle' ? { scale: 1.02 } : {}}
                    whileTap={sessionState === 'idle' ? { scale: 0.98 } : {}}
                    onClick={handleRegistrarInicio}
                    disabled={sessionState !== 'idle'}
                    className={`
                      flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl
                      font-semibold text-sm tracking-wide transition-all duration-300
                      ${sessionState === 'idle'
                        ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30'
                        : sessionState === 'started' || sessionState === 'finished'
                          ? 'bg-emerald-100 text-emerald-600 border border-emerald-200 cursor-not-allowed'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }
                    `}
                    id="btn-registro-inicio"
                  >
                    <PlayCircle className="w-5 h-5" />
                    <span>
                      {sessionState === 'idle' ? 'Registrar Inicio de Clase' : 
                       `Inicio Registrado — ${formData.horaInicio}`}
                    </span>
                  </motion.button>

                  <motion.button
                    whileHover={sessionState === 'started' ? { scale: 1.02 } : {}}
                    whileTap={sessionState === 'started' ? { scale: 0.98 } : {}}
                    onClick={handleRegistrarSalida}
                    disabled={sessionState !== 'started'}
                    className={`
                      flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl
                      font-semibold text-sm tracking-wide transition-all duration-300
                      ${sessionState === 'started'
                        ? 'bg-gradient-to-r from-maroon-700 to-maroon-800 text-white shadow-lg shadow-maroon-700/20 hover:shadow-xl hover:shadow-maroon-700/30 pulse-glow'
                        : sessionState === 'finished'
                          ? 'bg-maroon-100 text-maroon-600 border border-maroon-200 cursor-not-allowed'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      }
                    `}
                    id="btn-registro-salida"
                  >
                    <StopCircle className="w-5 h-5" />
                    <span>
                      {sessionState === 'finished' 
                        ? `Salida Registrada — ${formData.horaFinalizacion}`
                        : 'Registrar Salida'}
                    </span>
                  </motion.button>
                </div>

                {/* ── Botón Finalizar y Enviar (aparece cuando la sesión termina) ── */}
                {sessionState === 'finished' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    className="mt-4 pt-4 border-t border-slate-200/60"
                  >
                    <motion.button
                      whileHover={!isSending && !isSent ? { scale: 1.01 } : {}}
                      whileTap={!isSending && !isSent ? { scale: 0.99 } : {}}
                      onClick={handleFinalizarYEnviar}
                      disabled={isSending || isSent}
                      className={`
                        w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl
                        font-bold text-base tracking-wide transition-all duration-300
                        ${isSent
                          ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300 cursor-not-allowed'
                          : isSending
                            ? 'bg-slate-100 text-slate-500 border-2 border-slate-200 cursor-wait'
                            : 'bg-gradient-to-r from-maroon-700 via-maroon-800 to-maroon-900 text-white shadow-xl shadow-maroon-800/25 hover:shadow-2xl hover:shadow-maroon-800/35 hover:from-maroon-600 hover:via-maroon-700 hover:to-maroon-800'
                        }
                      `}
                      id="btn-finalizar-enviar"
                    >
                      {isSent ? (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          <span>Registro Enviado Exitosamente</span>
                        </>
                      ) : isSending ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Enviando datos...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          <span>Finalizar Sesión y Enviar Registro</span>
                        </>
                      )}
                    </motion.button>
                    {!isSent && !isSending && (
                      <p className="text-center text-[11px] text-slate-400 mt-2">
                        Se enviarán todos los datos de esta sesión a Google Sheets
                      </p>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.section>

          {/* Footer */}
          <motion.footer variants={itemVariants} className="text-center py-4">
            <p className={`text-xs transition-colors duration-500 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
              Universidad Privada de Tacna — Sistema de Control de Avance Silábico © {new Date().getFullYear()}
            </p>
            <p className={`text-[10px] mt-1 transition-colors duration-500 ${isDarkMode ? 'text-white/20' : 'text-slate-300'}`}>
              Escuela Profesional de Ingeniería Civil — Anexo C
            </p>
          </motion.footer>
        </motion.div>
      </main>
    </motion.div>
  )
}

// ═══════════ SUB-COMPONENTS ═══════════

const ReadOnlyCard = ({ icon, label, value }) => (
  <div className="group relative bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-sm hover:shadow-md transition-all duration-300 hover:border-maroon-200/50">
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-maroon-50 flex items-center justify-center text-maroon-600 flex-shrink-0 group-hover:bg-maroon-100 transition-colors duration-200">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
          {label}
          <Lock className="w-2.5 h-2.5 opacity-50" />
        </p>
        <p className="text-sm font-semibold text-slate-800 truncate">
          {value}
        </p>
      </div>
    </div>
  </div>
)

const TimeDisplay = ({ label, value, active, color }) => {
  const colors = {
    emerald: {
      bg: active ? 'bg-emerald-50' : 'bg-slate-50',
      border: active ? 'border-emerald-200' : 'border-slate-200',
      dot: active ? 'bg-emerald-400' : 'bg-slate-300',
      text: active ? 'text-emerald-700' : 'text-slate-400',
      value: active ? 'text-emerald-800' : 'text-slate-400',
    },
    rose: {
      bg: active ? 'bg-rose-50' : 'bg-slate-50',
      border: active ? 'border-rose-200' : 'border-slate-200',
      dot: active ? 'bg-rose-400' : 'bg-slate-300',
      text: active ? 'text-rose-700' : 'text-slate-400',
      value: active ? 'text-rose-800' : 'text-slate-400',
    },
  }
  const c = colors[color]

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${c.bg} ${c.border}`}>
      <div className={`w-2 h-2 rounded-full ${c.dot} ${active && color === 'emerald' ? 'animate-pulse' : ''}`} />
      <span className={`text-xs font-medium ${c.text}`}>{label}:</span>
      <span className={`text-xs font-bold font-mono-clock ${c.value}`}>
        {value || '--:--:--'}
      </span>
    </div>
  )
}

export default FormView
