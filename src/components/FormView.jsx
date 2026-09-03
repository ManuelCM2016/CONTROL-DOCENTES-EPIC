import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LogOut, Building2, GraduationCap, BookOpen, Lock,
  MapPin, BookMarked, Layers, Calendar, FileText,
  MonitorPlay, Users, MessageSquare, PlayCircle,
  StopCircle, ClipboardCheck, Hash, User, Send, Loader2, CheckCircle2,
  Bell, Timer, BellRing, Sun, Moon, Sparkles, Check, ChevronRight,
  Info, Plus, Minus, RotateCcw, RefreshCw, CalendarClock, ShieldCheck,
  History, Wifi, WifiOff, PlusCircle, AlertTriangle, XCircle, ArrowLeft
} from 'lucide-react'
import DigitalClock from './DigitalClock'
import StartSessionModal from './StartSessionModal'
import SuccessModal from './SuccessModal'
import OnboardingTour from './OnboardingTour'
import TeacherHistoryModal from './TeacherHistoryModal'
import { registrarSesion } from '../services/api'
import { registrarInicioClase, registrarCierreClase, anularInicioClase, obtenerHorarioDocente } from '../services/adminApi'
import { playAlertSound } from '../utils/alertSound'
import {
  calcularSemanaYUnidad,
  getSiguienteNumeroRegistro,
  guardarNumeroRegistroCompletado,
  SEMESTRE_CONFIG
} from '../utils/academicCalendar'
import { saveSessionToHistory } from '../utils/historyManager'
import { enqueueOfflineSession } from '../utils/offlineManager'
import useNetworkStatus from '../hooks/useNetworkStatus'

// Lista oficial de Aulas y Laboratorios (orden exacto institucional)
const AULAS_LABORATORIOS_OPTIONS = [
  'BLOQUE R-207',
  'LABORATORIO R-205',
  'LABORATORIO R-206',
  'BLOQUE R-303',
  'BLOQUE R-308',
  'BLOQUE R-315',
  'BLOQUE R-316',
  'BLOQUE R-317',
  'BLOQUE R-408',
  'BLOQUE R-415',
  'BLOQUE R-416',
  'BLOQUE R-417',
  'SUELOS S-206',
  'SUELOS S-301',
  'SUELOS S-303',
  'SUELOS S-305',
  'SUELOS S-306',
  'SUELOS S-307',
  'Laboratorio de Física',
  'Laboratorio de Química',
  'Laboratorio de Mecánica de Suelos',
  'Laboratorio de Concreto',
  'Laboratorio de Pavimentos',
  'Laboratorio de Estructuras',
  'Laboratorio de Hidráulica',
  'Gabinete de Topografía',
  'Laboratorio BIM',
]

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

/**
 * Busca en la lista oficial de cursos del docente (de MAESTRO_DOCENTES)
 * el curso que coincide con la clase del horario (por código, nombre y sección).
 */
const encontrarCursoOficial = (claseHorario, cursosDocente = []) => {
  if (!claseHorario || !Array.isArray(cursosDocente) || cursosDocente.length === 0) {
    return claseHorario?.curso || ''
  }

  const cod = (claseHorario.codigo || '').trim().toUpperCase()
  const sec = (claseHorario.seccion || '').trim().toUpperCase()
  const cursoNorm = (claseHorario.curso || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()

  // 1. Coincidencia más precisa: CÓDIGO y SECCIÓN (ej: 'EG-362' y 'B' o 'CI-565' y 'A')
  if (cod && sec) {
    const match = cursosDocente.find(c => {
      const cUpper = c.toUpperCase()
      const tieneCod = cUpper.includes(cod)
      const tieneSec = cUpper.endsWith(sec) || cUpper.includes(`- ${sec}`) || cUpper.includes(` ${sec}`)
      return tieneCod && tieneSec
    })
    if (match) return match
  }

  // 2. Coincidencia por NOMBRE y SECCIÓN (ej: 'ÉTICA' y 'B')
  if (cursoNorm && sec) {
    const match = cursosDocente.find(c => {
      const cNorm = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      const tieneNombre = cNorm.includes(cursoNorm)
      const tieneSec = cNorm.endsWith(sec) || cNorm.includes(`- ${sec}`) || cNorm.includes(` ${sec}`)
      return tieneNombre && tieneSec
    })
    if (match) return match
  }

  // 3. Coincidencia por CÓDIGO solo (ej: 'EG-362')
  if (cod) {
    const match = cursosDocente.find(c => c.toUpperCase().includes(cod))
    if (match) return match
  }

  // 4. Coincidencia por NOMBRE solo (ej: 'ÉTICA')
  if (cursoNorm) {
    const match = cursosDocente.find(c => {
      const cNorm = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      return cNorm.includes(cursoNorm)
    })
    if (match) return match
  }

  // Fallback si no hay match
  return claseHorario.curso || ''
}

const FormView = ({ docente, onLogout, showToast, saveFormData, loadFormData, isDarkMode, toggleTheme }) => {
  const [isSending, setIsSending] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [showStartModal, setShowStartModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [submittedData, setSubmittedData] = useState(null)
  const [showLogoutWarning, setShowLogoutWarning] = useState(false)
  const [isAnulando, setIsAnulando] = useState(false)

  // ── Hook de Estado de Red y Sincronización Offline ──
  const { isOnline, pendingOfflineCount, isSyncing, triggerSync } = useNetworkStatus(
    (syncedItem) => {
      showToast?.('success', `✅ Sesión #${syncedItem.numero} sincronizada automáticamente con Google Sheets`)
    }
  )

  // ── Tour Guiado Onboarding ──
  const [isTourOpen, setIsTourOpen] = useState(() => {
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

  // ── Ref para el timeout de notificación y debounce de inicio ──
  const notificationTimeoutRef = useRef(null)
  const isStartingRef = useRef(false)
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

  // ── Inicializador de datos del formulario con automatizaciones ──
  const getAutomatedInitialFormData = useCallback(() => {
    const hoy = new Date().toISOString().split('T')[0]
    const infoSemestre = calcularSemanaYUnidad(hoy)
    const numeroRegistro = getSiguienteNumeroRegistro(docente.dni || docente.codigo)
    const savedAula = localStorage.getItem('upt_last_aula') || ''

    return {
      numero: numeroRegistro,
      aulaLab: savedAula,
      fecha: hoy,
      asignatura: '',
      unidad: infoSemestre.unidad || 'I',
      semanaAcademica: String(infoSemestre.semana || 1),
      temaProgramado: '',
      recursos: [],
      horaInicio: '',
      horaFinalizacion: '',
      numEstudiantes: '30',
      observaciones: '',
      tipoSesion: 'Clase Regular',
      fechaRecuperar: '',
    }
  }, [docente])

  // ── Estado del formulario ──
  const [formData, setFormData] = useState(() => {
    const saved = loadFormData()
    const hoy = new Date().toISOString().split('T')[0]
    if (saved && saved.horaInicio) {
      // Si la sesión guardada es de un día anterior y ya estaba finalizada, empezar con formulario limpio
      if (saved.fecha && saved.fecha !== hoy && saved.horaFinalizacion) {
        return getAutomatedInitialFormData()
      }
      return { ...getAutomatedInitialFormData(), ...saved }
    }
    return getAutomatedInitialFormData()
  })

  // Derivar sessionState
  const [sessionState, setSessionState] = useState(() => {
    const saved = loadFormData()
    const hoy = new Date().toISOString().split('T')[0]
    if (saved?.horaFinalizacion && saved?.fecha === hoy) return 'finished'
    if (saved?.horaInicio && saved?.fecha === hoy) return 'started'
    return 'idle'
  })

  // ── Al cambiar docente o montar: asegurar aislamiento de datos ──
  useEffect(() => {
    const saved = loadFormData()
    const hoy = new Date().toISOString().split('T')[0]
    if (saved && saved.horaInicio) {
      // Si la sesión guardada era de un día anterior y ya estaba terminada, iniciar limpio
      if (saved.fecha && saved.fecha !== hoy && saved.horaFinalizacion) {
        saveFormData(null)
        setFormData(getAutomatedInitialFormData())
        setSessionState('idle')
        setIsSent(false)
        return
      }
      setFormData({ ...getAutomatedInitialFormData(), ...saved })
      if (saved.horaFinalizacion) {
        setSessionState('finished')
      } else {
        setSessionState('started')
      }
    } else {
      setFormData(getAutomatedInitialFormData())
      setSessionState('idle')
      setIsSent(false)
    }
  }, [docente.dni, getAutomatedInitialFormData, loadFormData, saveFormData])

  // ── Autocompletado basado en HORARIOS del semestre ──
  const [sugerenciaHorario, setSugerenciaHorario] = useState(null)
  const [horariosDocente, setHorariosDocente] = useState([])

  useEffect(() => {
    if (!docente?.dni || sessionState !== 'idle') return

    const fetchHorario = async () => {
      try {
        const res = await obtenerHorarioDocente(docente.dni)
        if (res.success && res.data?.horarios?.length > 0) {
          setHorariosDocente(res.data.horarios)

          // Determinar día actual en español
          const diasMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sabado']
          const diaHoy = diasMap[new Date().getDay()]

          // Filtrar clases de hoy
          const clasesHoy = res.data.horarios.filter(h => {
            const diaNorm = h.dia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
            const hoyNorm = diaHoy.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
            return diaNorm === hoyNorm
          })

          if (clasesHoy.length > 0) {
            // Buscar la clase más cercana a la hora actual
            const ahora = new Date()
            const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes()

            let mejorClase = clasesHoy[0]
            let menorDiff = Infinity

            clasesHoy.forEach(clase => {
              const [h, m] = clase.horaInicio.split(':').map(Number)
              const minutosClase = h * 60 + m
              const diff = Math.abs(minutosClase - minutosAhora)
              // Preferir clases que aún no empezaron o empezaron hace poco (±30 min)
              if (diff < menorDiff && minutosClase >= minutosAhora - 30) {
                menorDiff = diff
                mejorClase = clase
              }
            })

            // Si no encontró una cercana, usar la primera del día que aún no pasó
            if (menorDiff === Infinity) {
              mejorClase = clasesHoy[0]
            }

            setSugerenciaHorario(mejorClase)

            // Auto-llenar con el curso oficial de MAESTRO_DOCENTES
            const cursosOficiales = docente.cursos || []
            const necesitaAutoLlenar = !formData.asignatura || (
              cursosOficiales.length > 0 && !cursosOficiales.includes(formData.asignatura)
            )

            if (necesitaAutoLlenar) {
              // Mapear aula del horario al formato del select de aulas
              let aulaMatch = ''
              const aulaHorario = (mejorClase.aula || '').toUpperCase()
              AULAS_LABORATORIOS_OPTIONS.forEach(opt => {
                if (opt.toUpperCase().includes(aulaHorario)) {
                  aulaMatch = opt
                }
              })

              const durH = mejorClase.duracionHrs || 2
              setDuracionHoras(durH)
              setDuracionMinutos(0)

              // Mapear al curso oficial registrado en MAESTRO_DOCENTES
              const cursoOficial = encontrarCursoOficial(mejorClase, cursosOficiales)

              setFormData(prev => ({
                ...prev,
                asignatura: cursoOficial || mejorClase.curso,
                aulaLab: aulaMatch || prev.aulaLab,
                seccion: mejorClase.seccion || prev.seccion,
              }))
            }
          }
        }
      } catch (err) {
        // Silencioso — no es crítico
        console.warn('No se pudo obtener horario del docente:', err)
      }
    }

    fetchHorario()
  }, [docente?.dni, sessionState])

  // ── Auto-sanitización: Corregir nombres cortos guardados en cache (ej: "ÉTICA") al formato oficial (ej: "EG-362 ÉTICA - B") ──
  useEffect(() => {
    if (formData.asignatura && docente?.cursos?.length > 0 && !docente.cursos.includes(formData.asignatura)) {
      const cursoCorregido = encontrarCursoOficial(
        { curso: formData.asignatura, seccion: formData.seccion || sugerenciaHorario?.seccion },
        docente.cursos
      )
      if (cursoCorregido && cursoCorregido !== formData.asignatura && docente.cursos.includes(cursoCorregido)) {
        setFormData(prev => ({ ...prev, asignatura: cursoCorregido }))
      }
    }
  }, [docente?.cursos, formData.asignatura, formData.seccion, sugerenciaHorario?.seccion])

  // ── Auto-guardar formulario en localStorage por docente ──
  const updateField = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value }

      // Si cambia la asignatura, extraer automáticamente la sección si viene en el texto oficial (ej: "EG-362 ÉTICA - B" -> "B")
      if (field === 'asignatura' && value) {
        const matchSec = value.match(/(?:[-–\s]+)([A-Z0-9])$/i)
        if (matchSec) {
          updated.seccion = matchSec[1].toUpperCase()
        }
      }

      // Si cambia la fecha Y es Clase Regular, autocalcular semana y unidad
      if (field === 'fecha' && value && updated.tipoSesion === 'Clase Regular') {
        const info = calcularSemanaYUnidad(value)
        if (info.unidad) updated.unidad = info.unidad
        if (info.semana) updated.semanaAcademica = String(info.semana)
      }

      // Si cambia el tipo de sesión
      if (field === 'tipoSesion') {
        if (value === 'Clase Regular') {
          const info = calcularSemanaYUnidad(updated.fecha)
          updated.unidad = info.unidad || 'I'
          updated.semanaAcademica = String(info.semana || 1)
          updated.fechaRecuperar = ''
        }
      }

      // Si cambia la fecha de recuperación, recalcular con esa fecha
      if (field === 'fechaRecuperar' && value && updated.tipoSesion !== 'Clase Regular') {
        const info = calcularSemanaYUnidad(value)
        if (info.unidad) updated.unidad = info.unidad
        if (info.semana) updated.semanaAcademica = String(info.semana)
      }

      // Si cambia el aula, recordar para la próxima
      if (field === 'aulaLab' && value) {
        localStorage.setItem('upt_last_aula', value)
      }

      saveFormData(updated)
      return updated
    })
  }

  // Toggle de recurso individual
  const toggleRecurso = (recursoId) => {
    setFormData((prev) => {
      const exists = prev.recursos.includes(recursoId)
      const newRecursos = exists
        ? prev.recursos.filter((r) => r !== recursoId)
        : [...prev.recursos, recursoId]
      const updated = { ...prev, recursos: newRecursos }
      saveFormData(updated)
      return updated
    })
  }

  // Aplicar preset habitual
  const aplicarRecursosHabituales = () => {
    setFormData((prev) => {
      const updated = { ...prev, recursos: [...RECURSOS_HABITUALES] }
      saveFormData(updated)
      return updated
    })
    showToast('info', 'Recursos habituales aplicados')
  }

  // Limpiar todos los recursos
  const limpiarRecursos = () => {
    setFormData((prev) => {
      const updated = { ...prev, recursos: [] }
      saveFormData(updated)
      return updated
    })
  }

  // Stepper de asistencia (+1 / -1)
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

  // ── Registrar Inicio de Clase (Inmediato al entrar al aula) ──
  const handleRegistrarInicio = () => {
    // ── GUARD: Bloquear doble registro si ya hay una sesión iniciada o en proceso ──
    if (sessionState === 'started' || sessionState === 'finished') {
      showToast('warning', 'La sesión ya fue iniciada. No se puede registrar dos veces.')
      return
    }
    if (isStartingRef.current) return
    isStartingRef.current = true

    const now = new Date().toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const today = new Date().toISOString().split('T')[0]
    const totalMinutos = (parseInt(duracionHoras, 10) || 0) * 60 + (parseInt(duracionMinutos, 10) || 0)

    const updated = { ...formData, horaInicio: now }
    setFormData(updated)
    saveFormData(updated)
    setSessionState('started')
    setShowStartModal(true)
    showToast('success', `¡Inicio de clase registrado a las ${now}!`)

    // POST al backend ejecutado UNA SOLA VEZ fuera del updater de React
    if (docente?.dni) {
      registrarInicioClase({
        dni: docente.dni,
        docente: docente.nombre,
        facultad: docente.facultad || '',
        escuela: docente.escuela || '',
        carrera: docente.carrera || '',
        numero: updated.numero || '',
        aulaLab: updated.aulaLab || '',
        fecha: updated.fecha || today,
        asignatura: updated.asignatura || '',
        seccion: updated.seccion || '',
        unidad: updated.unidad || '',
        semanaAcademica: updated.semanaAcademica || '',
        horaInicio: now,
        duracionEstimadaMin: totalMinutos || 90,
        tipo_sesion: updated.tipoSesion || 'Clase Regular',
        fecha_recuperar: updated.fechaRecuperar || '',
      })
      .catch((err) => console.warn('Error al registrar inicio (no crítico):', err))
      .finally(() => {
        setTimeout(() => { isStartingRef.current = false }, 1500)
      })
    } else {
      isStartingRef.current = false
    }

    // ── Programar notificación push ──
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

  // ── Registrar Salida (Requiere formulario completado antes de marcar salida) ──
  const handleRegistrarSalida = () => {
    const requiredFields = [
      { key: 'aulaLab', name: 'Aula / Laboratorio' },
      { key: 'fecha', name: 'Fecha' },
      { key: 'asignatura', name: 'Asignatura y Sección' },
      { key: 'unidad', name: 'Unidad Académica' },
      { key: 'semanaAcademica', name: 'N° de Semana Académica' },
      { key: 'temaProgramado', name: 'Tema Programado en el Sílabo' },
      { key: 'numEstudiantes', name: 'N° de Estudiantes Asistentes' },
    ]

    const missingField = requiredFields.find((field) => !formData[field.key]?.trim?.() && !formData[field.key])
    if (missingField) {
      showToast('error', `⚠️ Debe completar el campo "${missingField.name}" antes de registrar su salida.`)
      return
    }

    if (formData.recursos.length < 1) {
      showToast('error', '⚠️ Seleccione al menos un recurso utilizado antes de registrar su salida.')
      return
    }

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
    showToast('success', `Salida de clase registrada a las ${now}. Ahora puede enviar su registro.`)

    // Cancelar notificación pendiente
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current)
      notificationTimeoutRef.current = null
    }
  }

  // ── Finalizar sesión y enviar datos (Con Modo Offline Resiliente) ──
  const handleFinalizarYEnviar = async () => {
    setIsSending(true)
    showToast('info', 'Procesando registro de sesión...')

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
      seccion: formData.seccion || '',
      unidad: formData.unidad,
      semanaAcademica: formData.semanaAcademica,
      temaProgramado: formData.temaProgramado,
      recursos: formData.recursos,
      horaInicio: formData.horaInicio,
      horaFinalizacion: formData.horaFinalizacion,
      numEstudiantes: formData.numEstudiantes,
      observaciones: formData.observaciones,
      tipo_sesion: formData.tipoSesion || 'Clase Regular',
      fecha_recuperar: formData.fechaRecuperar || '',
    }

    // CASO A: Sin conexión a internet directa
    if (!navigator.onLine) {
      const offlineId = enqueueOfflineSession(payload)
      saveSessionToHistory(docente.dni, { ...payload, offlineId }, 'pending')
      setIsSent(true)
      setSubmittedData(payload)
      setShowSuccessModal(true)
      guardarNumeroRegistroCompletado(docente.dni, formData.numero)
      saveFormData(null)
      setIsSending(false)
      showToast('warning', '📡 Sin internet: Clase guardada en cola local. Se sincronizará automáticamente al volver la conexión.')
      return
    }

    // CASO B: Enviar a Google Apps Script (usando action=cierre para 2 fases)
    try {
      // Intentar primero con cierre (actualiza fila ACTIVO si existe)
      // Si falla, usa el endpoint legacy como fallback
      const result = await registrarCierreClase(payload)

      if (result.success) {
        saveSessionToHistory(docente.dni, payload, 'synced')
        setIsSent(true)
        setSubmittedData(payload)
        setShowSuccessModal(true)
        showToast('success', '✅ ¡Sesión guardada y registrada exitosamente en Google Sheets!')
        guardarNumeroRegistroCompletado(docente.dni, formData.numero)
        saveFormData(null)
      } else {
        // Servidor reportó error: respaldar en cola offline para seguridad
        const offlineId = enqueueOfflineSession(payload)
        saveSessionToHistory(docente.dni, { ...payload, offlineId }, 'pending')
        setIsSent(true)
        setSubmittedData(payload)
        setShowSuccessModal(true)
        guardarNumeroRegistroCompletado(docente.dni, formData.numero)
        saveFormData(null)
        showToast('warning', '⚠️ Servidor no disponible: Registro respaldado localmente en cola de sincronización.')
      }
    } catch (error) {
      // Corte de red inesperado durante el fetch: proteger datos localmente
      const offlineId = enqueueOfflineSession(payload)
      saveSessionToHistory(docente.dni, { ...payload, offlineId }, 'pending')
      setIsSent(true)
      setSubmittedData(payload)
      setShowSuccessModal(true)
      guardarNumeroRegistroCompletado(docente.dni, formData.numero)
      saveFormData(null)
      showToast('warning', '📡 Error de red: Registro protegido localmente. Se enviará cuando vuelva internet.')
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

  // ── Callback al seleccionar tema desde Historial para continuar ──
  const handleSelectTopicFromHistory = (topic, asignatura) => {
    if (topic) {
      updateField('temaProgramado', topic)
      if (asignatura && (!formData.asignatura || formData.asignatura === '')) {
        updateField('asignatura', asignatura)
      }
      showToast('info', 'Tema del historial cargado en el formulario')
    }
  }

  // ── Interceptar cierre de sesión con clase activa ──
  const handleLogoutAttempt = useCallback(() => {
    if (sessionState === 'started') {
      setShowLogoutWarning(true)
      return
    }
    onLogout()
  }, [sessionState, onLogout])

  // ── Opción A: Registrar salida → llevar al formulario ──
  const handleLogoutOptionA = useCallback(() => {
    setShowLogoutWarning(false)
    showToast('info', '📝 Complete el formulario y registre su salida antes de salir.')
    // Scroll al formulario de registro de salida
    const formSection = document.getElementById('tour-step-5')
    if (formSection) {
      formSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [showToast])

  // ── Opción B: Anular inicio de clase → borrar fila en Sheets ──
  const handleLogoutOptionB = useCallback(async () => {
    setIsAnulando(true)
    try {
      await anularInicioClase({
        dni: docente.dni,
        fecha: formData.fecha,
        asignatura: formData.asignatura,
      })
      showToast('success', '✅ Inicio de clase anulado. El registro fue eliminado.')
      saveFormData(null)
      setSessionState('idle')
      setShowLogoutWarning(false)
      onLogout()
    } catch (err) {
      showToast('error', '❌ Error al anular el inicio: ' + err.message)
    } finally {
      setIsAnulando(false)
    }
  }, [docente.dni, formData.fecha, formData.asignatura, saveFormData, showToast, onLogout])

  // ── Opción C: Mantener clase activa y salir ──
  const handleLogoutOptionC = useCallback(() => {
    // Guardar info de duración estimada para posible recuperación
    const duracionTotalMin = (parseInt(duracionHoras, 10) || 0) * 60 + (parseInt(duracionMinutos, 10) || 0)
    localStorage.setItem('epic_pending_session', JSON.stringify({
      dni: docente.dni,
      horaInicio: formData.horaInicio,
      fecha: formData.fecha,
      asignatura: formData.asignatura,
      duracionEstimadaMin: duracionTotalMin,
      savedAt: new Date().toISOString(),
    }))
    setShowLogoutWarning(false)
    showToast('warning', '⚠️ Clase activa mantenida. Puede retomar al reingresar.')
    onLogout()
  }, [docente.dni, formData.horaInicio, formData.fecha, formData.asignatura, duracionHoras, duracionMinutos, showToast, onLogout])

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
        className={`sticky top-0 z-40 border-b-2 transition-colors duration-500 ${isDarkMode
          ? 'bg-[#150707]/90 backdrop-blur-xl border-white/10 shadow-xl shadow-black/50'
          : 'bg-white border-slate-200 shadow-lg shadow-slate-300/40'
          }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-[72px] gap-2">
            {/* Left: Logo + Title */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md overflow-hidden ring-2 ring-maroon-700/20 shrink-0">
                <img src="/logo.png" alt="Logo UPT" className="w-full h-full object-contain" />
              </div>
              <div className="truncate">
                <h1 className={`text-xs sm:text-sm font-bold tracking-wide leading-tight transition-colors duration-500 truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  CONTROL DE AVANCE SILÁBICO
                </h1>
                <p className={`text-[10px] sm:text-[11px] font-semibold leading-tight transition-colors duration-500 truncate ${isDarkMode ? 'text-maroon-300/80' : 'text-slate-600'}`}>
                  Escuela Profesional de Ingeniería Civil — UPT
                </p>
              </div>
            </div>

            {/* Center: Docente info */}
            <div className={`hidden lg:flex items-center gap-2.5 px-4 py-2 rounded-xl border-2 transition-colors duration-500 ${isDarkMode
              ? 'bg-white/5 border-white/10 text-white'
              : 'bg-slate-50 border-slate-200 text-slate-900 shadow-sm'
              }`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-maroon-700/20 text-maroon-300' : 'bg-red-900/10 text-red-900'}`}>
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-bold leading-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{docente.nombre}</p>
                <p className={`text-[10px] font-semibold leading-tight ${isDarkMode ? 'text-maroon-300' : 'text-slate-500'}`}>
                  DNI / Cód: {docente.dni || docente.codigo}
                </p>
              </div>
            </div>

            {/* Right: Actions, Network Status, History, PWA, Theme & Logout */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Digital Clock */}
              <div className="hidden sm:block">
                <DigitalClock isDarkMode={isDarkMode} />
              </div>

              {/* Indicador de Estado de Red / Offline */}
              <div className="flex items-center">
                {isOnline ? (
                  pendingOfflineCount > 0 ? (
                    <button
                      type="button"
                      onClick={triggerSync}
                      disabled={isSyncing}
                      title="Hay sesiones guardadas sin conexión. Clic para sincronizar ahora."
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${isDarkMode
                        ? 'bg-amber-950/60 border-amber-500/40 text-amber-300 hover:bg-amber-900/60'
                        : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                        }`}
                    >
                      {isSyncing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                      )}
                      <span>{isSyncing ? 'Sincronizando...' : `Sincronizar (${pendingOfflineCount})`}</span>
                    </button>
                  ) : (
                    <span
                      title="Conexión a internet activa"
                      className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold border ${isDarkMode ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>En línea</span>
                    </span>
                  )
                ) : (
                  <span
                    title="Sin conexión a internet. Los registros se guardarán localmente."
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${isDarkMode ? 'bg-rose-950/60 border-rose-500/40 text-rose-300' : 'bg-rose-50 border-rose-300 text-rose-800'
                      }`}
                  >
                    <WifiOff className="w-3.5 h-3.5 text-rose-500" />
                    <span>{pendingOfflineCount > 0 ? `Offline (${pendingOfflineCount})` : 'Offline'}</span>
                  </span>
                )}
              </div>

              {/* Botón Mis Clases Anteriores (Historial) */}
              <button
                type="button"
                onClick={() => setShowHistoryModal(true)}
                title="Ver historial de clases anteriores dictadas"
                className={`p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${isDarkMode
                  ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs'
                  }`}
              >
                <History className="w-4 h-4 text-maroon-500" />
                <span className="hidden md:inline">Mis Clases</span>
              </button>

              {/* Botón Guía Rápida */}
              <button
                type="button"
                onClick={handleOpenTour}
                className={`p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${isDarkMode
                  ? 'bg-maroon-800/30 border-maroon-700/40 text-maroon-300 hover:bg-maroon-800/50'
                  : 'bg-red-900/10 border-red-900/20 text-red-900 hover:bg-red-900/15'
                  }`}
                title="Ver tutorial guiado del sistema"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Guía Rápida</span>
              </button>

              {/* Theme Toggle & Logout */}
              <div className={`flex items-center gap-1.5 border-l pl-2 ${isDarkMode ? 'border-white/15' : 'border-slate-300'}`}>
                <button
                  onClick={toggleTheme}
                  className={`p-2 rounded-xl border transition-all ${isDarkMode
                    ? 'bg-white/10 border-white/15 text-yellow-300 hover:bg-white/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs'
                    }`}
                  title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                >
                  {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleLogoutAttempt}
                  className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold transition-all ${isDarkMode
                    ? 'text-red-300 hover:text-white hover:bg-red-500/20'
                    : 'text-slate-600 hover:text-red-700 hover:bg-red-50'
                    }`}
                  title="Cerrar sesión"
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
              <span>{isOnline ? 'Registro en Línea' : 'Modo Offline Protegido'}</span>
              <span className="opacity-40">•</span>
              <span className={isDarkMode ? 'text-slate-300' : 'text-slate-500'}>18 Semanas Académicas</span>
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

          {/* ─── PASO 1: REGISTRAR INICIO DE CLASE INMEDIATO (ARRIBA) ─── */}
          <motion.section variants={itemVariants} id="tour-step-4">
            <div className={`rounded-3xl border-2 p-5 sm:p-6 transition-all duration-500 ${sessionState === 'idle'
              ? isDarkMode
                ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-slate-950 border-emerald-500/50 shadow-2xl shadow-emerald-950/50'
                : 'bg-gradient-to-br from-emerald-50 via-white to-slate-50 border-emerald-400 shadow-xl shadow-emerald-100'
              : isDarkMode
                ? 'bg-slate-900/60 border-slate-800'
                : 'bg-slate-50 border-slate-200'
              }`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-6 rounded-full ${sessionState === 'idle' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                  <div>
                    <h2 className={`text-xs font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      PASO 1: REGISTRAR INICIO DE CLASE
                    </h2>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      {sessionState === 'idle'
                        ? 'Al entrar al aula, pulse el botón para iniciar su sesión al instante'
                        : 'Hora de inicio grabada. Complete los datos durante el desarrollo de su clase'}
                    </p>
                  </div>
                </div>

                {sessionState === 'idle' && (
                  <span className="px-3 py-1 rounded-full text-xs font-black tracking-wide bg-emerald-500 text-white shadow-md animate-bounce">
                    ⚡ Iniciar Aquí
                  </span>
                )}
              </div>

              {sessionState === 'idle' ? (
                <div className="space-y-4">
                  {/* Selector de Duración */}
                  <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-black/40 border-white/10' : 'bg-white border-slate-200'}`}>
                    <label className={`label-institutional flex items-center gap-1.5 !mb-2.5 ${isDarkMode ? '!text-slate-200' : '!text-slate-800'}`}>
                      <Timer className="w-4 h-4 text-emerald-500" />
                      Duración estimada de su clase
                      <span className="text-slate-400 font-normal text-xs ml-1">(Le avisará con sonido 10 min antes del fin)</span>
                    </label>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={duracionHoras}
                          onChange={(e) => setDuracionHoras(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          min="0"
                          max="8"
                          className={`${isDarkMode ? 'input-institutional-dark' : 'input-institutional-light'} text-center !py-2 w-16 font-mono font-bold`}
                        />
                        <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>horas</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={duracionMinutos}
                          onChange={(e) => setDuracionMinutos(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                          min="0"
                          max="59"
                          className={`${isDarkMode ? 'input-institutional-dark' : 'input-institutional-light'} text-center !py-2 w-16 font-mono font-bold`}
                        />
                        <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>minutos</span>
                      </div>

                      <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <Bell className="w-3.5 h-3.5" />
                        <span>Alerta Sonora Activa</span>
                      </div>
                    </div>
                  </div>

                  {/* Botón Principal con Efecto Suave */}
                  <motion.button
                    animate={{
                      boxShadow: [
                        '0 10px 25px -5px rgba(16, 185, 129, 0.4)',
                        '0 15px 35px -5px rgba(16, 185, 129, 0.7)',
                        '0 10px 25px -5px rgba(16, 185, 129, 0.4)',
                      ],
                      borderColor: ['#10b981', '#34d399', '#10b981'],
                    }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={handleRegistrarInicio}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-black text-base sm:text-lg bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 text-white shadow-2xl transition-all cursor-pointer border-2"
                  >
                    <PlayCircle className="w-6 h-6 animate-pulse" />
                    <span>REGISTRAR INICIO DE CLASE</span>
                  </motion.button>
                </div>
              ) : sessionState === 'started' ? (
                <div className={`p-4 sm:p-5 rounded-2xl border-2 flex flex-col sm:flex-row items-center justify-between gap-3 ${isDarkMode
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-wider">
                        CLASE EN CURSO — INICIO REGISTRADO
                      </p>
                      <p className="text-sm font-mono font-black">
                        Hora de Inicio: {formData.horaInicio}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs px-3 py-1.5 rounded-full font-bold border ${isDarkMode ? 'bg-emerald-900/40 border-emerald-500/30 text-emerald-300' : 'bg-white border-emerald-200 text-emerald-800'
                    }`}>
                    📝 Complete los datos abajo durante su sesión
                  </span>
                </div>
              ) : (
                <div className={`p-4 sm:p-5 rounded-3xl border-2 flex flex-col sm:flex-row items-center justify-between gap-3 ${isDarkMode
                  ? 'bg-slate-900/90 border-slate-700 text-slate-200'
                  : 'bg-slate-100 border-slate-300 text-slate-800'
                  }`}>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-wider">
                        SESIÓN DE CLASE CONCLUIDA
                      </p>
                      <p className="text-xs font-mono font-bold">
                        Inicio: {formData.horaInicio} ➔ Salida: {formData.horaFinalizacion}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Listo para enviar a Google Sheets
                  </span>
                </div>
              )}
            </div>
          </motion.section>

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

          {/* ─── DATOS DE LA SESIÓN (PASO 2) ─── */}
          <motion.section variants={itemVariants}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-5 bg-maroon-700 rounded-full" />
                <h2 className={`text-xs font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-maroon-300' : 'text-red-900'}`}>
                  {sessionState === 'started'
                    ? 'PASO 2: DATOS DE LA SESIÓN DE CLASE'
                    : 'Datos de la Sesión de Clase'}
                </h2>
              </div>

              {/* Aviso pequeño estático (sin parpadeo) al iniciar la clase */}
              {sessionState === 'started' && (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${isDarkMode
                  ? 'bg-white/5 border-white/10 text-slate-300'
                  : 'bg-white border-slate-300 text-slate-700 shadow-xs'
                  }`}>
                  <FileText className="w-3.5 h-3.5 text-maroon-600 dark:text-maroon-400" />
                  <span>Complete estos campos durante su clase</span>
                </div>
              )}
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
                      <select
                        id="campo-aula"
                        value={formData.aulaLab}
                        onChange={(e) => updateField('aulaLab', e.target.value)}
                        className={isDarkMode ? 'select-institutional-dark' : 'select-institutional-light'}
                      >
                        <option value="">Seleccione Aula / Laboratorio</option>
                        {AULAS_LABORATORIOS_OPTIONS.map((aula) => (
                          <option key={aula} value={aula}>{aula}</option>
                        ))}
                      </select>
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

                    {/* Banner de sugerencia basada en horario */}
                    {sugerenciaHorario && sessionState === 'idle' && (
                      <div className={`mb-2 px-3 py-2 rounded-xl border text-[11px] flex items-center gap-2 ${
                        isDarkMode 
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-200' 
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}>
                        <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                          <strong>Según tu horario:</strong> {sugerenciaHorario.curso} • Sec. {sugerenciaHorario.seccion} • {sugerenciaHorario.horaInicio}–{sugerenciaHorario.horaFin} • Aula {sugerenciaHorario.aula}
                        </span>
                      </div>
                    )}

                    <select
                      id="campo-asignatura"
                      value={formData.asignatura}
                      onChange={(e) => updateField('asignatura', e.target.value)}
                      className={isDarkMode ? 'select-institutional-dark' : 'select-institutional-light'}
                    >
                      <option value="">Seleccione la asignatura y sección</option>
                      {(() => {
                        const cursosDocente = docente.cursos || []
                        // Si el docente tiene cursos en MAESTRO_DOCENTES, mostrar EXCLUSIVAMENTE esos (formato oficial)
                        if (cursosDocente.length > 0) {
                          const opciones = [...cursosDocente]
                          // Si hay una asignatura seleccionada válida pero por alguna razón no está en la lista, incluirla
                          if (formData.asignatura && !opciones.includes(formData.asignatura)) {
                            opciones.push(formData.asignatura)
                          }
                          return opciones.map((curso) => (
                            <option key={curso} value={curso}>{curso}</option>
                          ))
                        }

                        // Fallback: SOLO si MAESTRO_DOCENTES no tiene cursos asignados para este docente
                        if (horariosDocente.length > 0) {
                          const cursosDeHorario = [...new Set(horariosDocente.map(h => {
                            const cod = h.codigo ? `${h.codigo} ` : ''
                            const sec = h.seccion ? ` - ${h.seccion}` : ''
                            return `${cod}${h.curso}${sec}`
                          }))]
                          return cursosDeHorario.map((curso) => (
                            <option key={curso} value={curso}>{curso}</option>
                          ))
                        }

                        return null
                      })()}
                    </select>
                  </div>
                </div>

                {/* ─── TIPO DE SESIÓN (Regular / Recuperación) ─── */}
                <div className="space-y-3 p-2 rounded-2xl transition-all">
                  <label className={`label-institutional flex items-center gap-1 !mb-1 ${isDarkMode ? '!text-slate-200' : '!text-slate-800'}`}>
                    <ShieldCheck className="w-3.5 h-3.5 text-maroon-500" /> Tipo de Sesión
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { value: 'Clase Regular', icon: <BookOpen className="w-4 h-4" />, label: '🏫 Clase Regular' },
                      { value: 'Recuperación / Adelanto', icon: <RefreshCw className="w-4 h-4" />, label: '🔄 Recuperación / Adelanto' },
                    ].map((tipo) => (
                      <button
                        key={tipo.value}
                        type="button"
                        onClick={() => updateField('tipoSesion', tipo.value)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-xs font-bold transition-all duration-300 cursor-pointer ${formData.tipoSesion === tipo.value
                          ? tipo.value === 'Clase Regular'
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/20 scale-[1.02]'
                            : 'bg-amber-600 text-white border-amber-500 shadow-lg shadow-amber-500/20 scale-[1.02]'
                          : isDarkMode
                            ? 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-700/80 hover:border-slate-600'
                            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400'
                          }`}
                      >
                        {tipo.label}
                      </button>
                    ))}
                  </div>

                  {/* ── Fecha de la clase a recuperar (solo visible en modo Recuperación) ── */}
                  <AnimatePresence>
                    {formData.tipoSesion === 'Recuperación / Adelanto' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className={`mt-2 p-3.5 rounded-xl border-2 border-dashed ${isDarkMode
                          ? 'bg-amber-900/20 border-amber-600/40'
                          : 'bg-amber-50 border-amber-300'
                          }`}>
                          <label className={`label-institutional flex items-center gap-1.5 !mb-2 ${isDarkMode ? '!text-amber-300' : '!text-amber-800'}`} htmlFor="campo-fecha-recuperar">
                            <CalendarClock className="w-3.5 h-3.5" /> Fecha de la clase a recuperar
                          </label>
                          <input
                            type="date"
                            id="campo-fecha-recuperar"
                            value={formData.fechaRecuperar}
                            onChange={(e) => updateField('fechaRecuperar', e.target.value)}
                            className={isDarkMode ? 'input-institutional-dark' : 'input-institutional-light'}
                          />
                          <p className={`text-[10px] mt-1.5 font-medium ${isDarkMode ? 'text-amber-400/80' : 'text-amber-700'
                            }`}>
                            📌 Seleccione la fecha original de la clase que se está recuperando. La Unidad y Semana se ajustarán automáticamente.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Row 3 y 4: Unidad, Semana y Tema (tour-step-2) */}
                <div id="tour-step-2" className="space-y-4 p-2 rounded-2xl transition-all">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={`label-institutional flex items-center justify-between ${isDarkMode ? '!text-slate-200' : '!text-slate-800'}`} htmlFor="campo-unidad">
                        <span><Layers className="w-3.5 h-3.5 inline mr-1 text-maroon-500" /> Unidad Académica</span>
                        <span className={`text-[10px] font-semibold flex items-center gap-1 ${formData.tipoSesion === 'Clase Regular'
                          ? isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                          : isDarkMode ? 'text-amber-400' : 'text-amber-600'
                          }`}>
                          {formData.tipoSesion === 'Clase Regular' ? (
                            <><Lock className="w-3 h-3" /> Autocalculado</>
                          ) : (
                            <>🔓 Editable</>
                          )}
                        </span>
                      </label>
                      <select
                        id="campo-unidad"
                        value={formData.unidad}
                        onChange={(e) => updateField('unidad', e.target.value)}
                        disabled={formData.tipoSesion === 'Clase Regular'}
                        className={`${isDarkMode ? 'select-institutional-dark' : 'select-institutional-light'} ${formData.tipoSesion === 'Clase Regular' ? 'opacity-70 cursor-not-allowed' : ''
                          }`}
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
                        <span className={`text-[10px] font-bold flex items-center gap-1 ${formData.tipoSesion === 'Clase Regular'
                          ? isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                          : isDarkMode ? 'text-amber-400' : 'text-amber-600'
                          }`}>
                          {formData.tipoSesion === 'Clase Regular' ? (
                            <><Lock className="w-3 h-3" /> Autocalculado</>
                          ) : (
                            <>🔓 Editable</>
                          )}
                        </span>
                      </label>
                      <select
                        id="campo-semana"
                        value={formData.semanaAcademica}
                        onChange={(e) => updateField('semanaAcademica', e.target.value)}
                        disabled={formData.tipoSesion === 'Clase Regular'}
                        className={`${isDarkMode ? 'select-institutional-dark' : 'select-institutional-light'} ${formData.tipoSesion === 'Clase Regular' ? 'opacity-70 cursor-not-allowed' : ''
                          }`}
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
                          className={`text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${isDarkMode
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
                          className="text-xs px-2 py-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
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
                              className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-sm'}`}
                              title="Restar 1"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => ajustarAsistencia(1)}
                              className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-sm'}`}
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
                              className={`text-[11px] px-2 py-0.5 rounded-lg border font-mono transition-all cursor-pointer ${formData.numEstudiantes === String(qty)
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

                {/* ─── ACTION BUTTONS BAR (PASO 3: SALIDA Y ENVÍO) ─── */}
                <div id="tour-step-5" className={`border-t-2 px-5 sm:px-7 py-5 rounded-2xl transition-colors duration-500 ${isDarkMode ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-50'
                  }`}>

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
                    {/* Botón Salida */}
                    <motion.button
                      whileHover={sessionState === 'started' ? { scale: 1.015 } : {}}
                      whileTap={sessionState === 'started' ? { scale: 0.985 } : {}}
                      onClick={handleRegistrarSalida}
                      disabled={sessionState !== 'started'}
                      className={`
                        flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl
                        font-bold text-sm sm:text-base tracking-wide transition-all duration-300 cursor-pointer
                        ${sessionState === 'started'
                          ? 'bg-gradient-to-r from-red-700 via-red-800 to-red-900 text-white shadow-xl shadow-red-900/30 hover:shadow-2xl hover:shadow-red-900/40 hover:from-red-600 pulse-glow'
                          : sessionState === 'finished'
                            ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 cursor-not-allowed'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-transparent'
                        }
                      `}
                      id="btn-registro-salida"
                    >
                      <StopCircle className="w-5 h-5" />
                      <span>
                        {sessionState === 'finished'
                          ? `Salida Registrada — ${formData.horaFinalizacion}`
                          : sessionState === 'idle'
                            ? 'Paso 1 pendiente: Inicie su clase arriba'
                            : '⏹️ Registrar Salida de Clase'}
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
                          font-bold text-base tracking-wide transition-all duration-300 cursor-pointer
                          ${isSent
                            ? 'bg-emerald-600/20 text-emerald-600 dark:text-emerald-300 border-2 border-emerald-500/40 cursor-default'
                            : isSending
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-wait'
                              : 'bg-gradient-to-r from-red-800 via-red-700 to-red-900 text-white shadow-2xl shadow-red-950/50 hover:from-red-700 hover:to-red-800 ring-2 ring-red-500/40'
                          }
                        `}
                        id="btn-finalizar-enviar"
                      >
                        {isSent ? (
                          <>
                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                            <span>¡Sesión Registrada y Guardada con Éxito!</span>
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

                      {isSent ? (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 flex flex-col sm:flex-row gap-3"
                        >
                          <button
                            type="button"
                            onClick={handleNuevoRegistro}
                            className={`flex-1 py-3.5 px-5 rounded-2xl font-bold text-sm border-2 flex items-center justify-center gap-2 transition-all cursor-pointer ${isDarkMode
                              ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50'
                              : 'border-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              }`}
                          >
                            <PlusCircle className="w-4 h-4 text-emerald-500" />
                            <span>Registrar Siguiente Clase</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleLogoutAttempt}
                            className={`py-3.5 px-5 rounded-2xl font-bold text-sm border-2 flex items-center justify-center gap-2 transition-all cursor-pointer ${isDarkMode
                              ? 'border-red-500/30 bg-red-950/40 text-red-300 hover:bg-red-900/50'
                              : 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100'
                              }`}
                          >
                            <LogOut className="w-4 h-4 text-red-400" />
                            <span>Finalizar y Salir</span>
                          </button>
                        </motion.div>
                      ) : !isSending && (
                        <p className="text-center text-xs text-slate-400 mt-2.5">
                          Al hacer clic, su clase se guardará directamente en Google Sheets y avanzará al siguiente correlativo.
                        </p>
                      )}
                    </motion.div>
                  )}
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
              Escuela Profesional de Ingeniería Civil — Anexo C (Semestre 2026-II) - Desarrollado por Manuel Murguía
            </p>
          </motion.footer>
        </motion.div>
      </main>

      {/* ─── MODAL INICIO DE SESIÓN FLOTANTE (AUTO-CIERRE 20s) ─── */}
      <StartSessionModal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        horaInicio={formData.horaInicio}
        docente={docente}
        isDarkMode={isDarkMode}
      />

      {/* ─── MODAL HISTORIAL DE CLASES ANTERIORES ─── */}
      <TeacherHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        docente={docente}
        isDarkMode={isDarkMode}
        onSelectTopic={handleSelectTopicFromHistory}
        showToast={showToast}
      />

      {/* ─── MODAL ÉXITO Y AUTO-CIERRE EN 10 SEGUNDOS ─── */}
      <SuccessModal
        isOpen={showSuccessModal}
        docente={docente}
        sessionData={submittedData || formData}
        isDarkMode={isDarkMode}
        onLogout={onLogout}
        onNuevoRegistro={handleNuevoRegistro}
      />

      {/* ─── TOUR GUIADO ONBOARDING ─── */}
      <OnboardingTour
        isOpen={isTourOpen}
        onClose={handleCloseTour}
        currentStepIndex={tourStepIndex}
        setCurrentStepIndex={setTourStepIndex}
        isDarkMode={isDarkMode}
      />

      {/* ─── MODAL DE ADVERTENCIA AL CERRAR SESIÓN CON CLASE ACTIVA ─── */}
      <AnimatePresence>
        {showLogoutWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowLogoutWarning(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-lg rounded-3xl border-2 shadow-2xl overflow-hidden ${
                isDarkMode
                  ? 'bg-gradient-to-br from-slate-900 via-red-950/30 to-slate-950 border-red-500/40'
                  : 'bg-white border-red-300'
              }`}
            >
              {/* Header */}
              <div className={`p-5 border-b-2 ${isDarkMode ? 'border-red-500/20 bg-red-950/30' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'}`}>
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      ⚠️ Clase en Curso
                    </h3>
                    <p className={`text-xs font-medium ${isDarkMode ? 'text-red-300/70' : 'text-red-700'}`}>
                      Tiene una sesión activa sin finalizar
                    </p>
                  </div>
                </div>
              </div>

              {/* Info de la sesión activa */}
              <div className="p-5 space-y-2">
                <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                  <p className={`text-xs font-bold ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>Sesión activa:</p>
                  <p className={`text-sm font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {formData.asignatura || 'Asignatura no especificada'}
                  </p>
                  <p className={`text-xs font-mono mt-0.5 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
                    Inicio: {formData.horaInicio} — {formData.aulaLab || 'Aula no especificada'}
                  </p>
                </div>

                <p className={`text-xs font-medium ${isDarkMode ? 'text-white/50' : 'text-slate-600'}`}>
                  Seleccione qué desea hacer antes de salir:
                </p>
              </div>

              {/* 3 Opciones */}
              <div className="px-5 pb-5 space-y-2.5">
                {/* Opción A: Completar formulario */}
                <button
                  onClick={handleLogoutOptionA}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer group ${
                    isDarkMode
                      ? 'bg-emerald-950/30 border-emerald-500/30 hover:border-emerald-400/60 hover:bg-emerald-950/50'
                      : 'bg-emerald-50 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-100'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-200 text-emerald-700'}`}>
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-black ${isDarkMode ? 'text-emerald-200' : 'text-emerald-900'}`}>
                      Registrar Salida y Enviar Sesión
                    </p>
                    <p className={`text-[11px] font-medium mt-0.5 ${isDarkMode ? 'text-emerald-300/60' : 'text-emerald-700'}`}>
                      Complete tema, recursos y estudiantes antes de salir
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-emerald-400/40' : 'text-emerald-500'}`} />
                </button>

                {/* Opción B: Anular inicio */}
                <button
                  onClick={handleLogoutOptionB}
                  disabled={isAnulando}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer group ${
                    isDarkMode
                      ? 'bg-amber-950/20 border-amber-500/20 hover:border-amber-400/50 hover:bg-amber-950/40'
                      : 'bg-amber-50 border-amber-300 hover:border-amber-500 hover:bg-amber-100'
                  } disabled:opacity-50`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-200 text-amber-700'}`}>
                    {isAnulando ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-black ${isDarkMode ? 'text-amber-200' : 'text-amber-900'}`}>
                      {isAnulando ? 'Anulando...' : 'Anular Inicio de Clase'}
                    </p>
                    <p className={`text-[11px] font-medium mt-0.5 ${isDarkMode ? 'text-amber-300/60' : 'text-amber-700'}`}>
                      Elimina el registro de inicio como si nunca se registró
                    </p>
                  </div>
                </button>

                {/* Opción C: Mantener activa y salir */}
                <button
                  onClick={handleLogoutOptionC}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer group ${
                    isDarkMode
                      ? 'bg-white/[0.03] border-white/10 hover:border-white/25 hover:bg-white/[0.06]'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-white/10 text-white/60' : 'bg-slate-200 text-slate-600'}`}>
                    <ArrowLeft className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-black ${isDarkMode ? 'text-white/80' : 'text-slate-800'}`}>
                      Mantener Clase Activa y Salir
                    </p>
                    <p className={`text-[11px] font-medium mt-0.5 ${isDarkMode ? 'text-white/40' : 'text-slate-500'}`}>
                      Puede volver a ingresar y retomar la sesión
                    </p>
                  </div>
                </button>

                {/* Botón cancelar */}
                <button
                  onClick={() => setShowLogoutWarning(false)}
                  className={`w-full py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    isDarkMode ? 'text-white/40 hover:text-white/60' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Cancelar — Volver al formulario
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
