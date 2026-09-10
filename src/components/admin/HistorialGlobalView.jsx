import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Download,
  Filter,
  RefreshCw,
  Eye,
  Pencil,
  FileSpreadsheet,
  Layers,
  MapPin,
  Clock,
  User,
  BookOpen,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  Users,
  Check,
  Save,
  AlertCircle,
  Hash,
  FileText,
  PlusCircle,
  FilePlus,
  CheckCircle2
} from 'lucide-react'
import {
  obtenerHistorialGlobal,
  actualizarValidacionSesion,
  editarSesionAdmin,
  crearSesionManualAdmin,
  obtenerListaDocentes,
  obtenerHorarios
} from '../../services/adminApi'
import {
  calcularSemanaYUnidad,
  guardarNumeroRegistroCompletado
} from '../../utils/academicCalendar'
import { MAESTRO_DOCENTES } from '../../utils/mockData'
import HORARIOS_DEFAULT from '../../data/horarios_procesados.json'

const AULAS_OPTIONS = [
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
  'Laboratorio BIM'
]

const RECURSOS_CHIPS = [
  'Pizarra',
  'Proyector',
  'Software Especializado',
  'Laboratorio',
  'Aula Virtual',
  'Bibliografía',
  'Materiales',
  'Equipos'
]

// Función auxiliar para normalizar DNI
const normalizeDni = (val) => String(val || '').trim().replace(/^0+/, '').toUpperCase()

// Normalizar nombres de docentes para comparación robusta (sin prefijos de grado, sin tildes, sin comas)
const normalizeTeacherName = (name) => {
  if (!name) return ''
  return String(name)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(MTRO\.|MTRA\.|ING\.|DR\.|DRA\.|MG\.|MGR\.|MSC\.|LIC\.|PROF\.|ARQ\.)\s*/gi, '')
    .replace(/[,\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Coincidencia flexible de docente entre MAESTRO_DOCENTES y HORARIOS
const matchTeacher = (name1, name2) => {
  const n1 = normalizeTeacherName(name1)
  const n2 = normalizeTeacherName(name2)
  if (!n1 || !n2) return false
  if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return true

  const words1 = n1.split(' ').filter((w) => w.length >= 3)
  const words2 = n2.split(' ').filter((w) => w.length >= 3)
  const matches = words1.filter((w) => words2.includes(w))
  return matches.length >= 2
}

// Extrae la sección automáticamente desde el nombre del curso (ej. "EG-362 ÉTICA - A" -> "A")
const extraerSeccion = (cursoStr) => {
  if (!cursoStr) return 'A'
  const matchFinal = String(cursoStr).match(/[-\s]+([A-Z])\s*$/i)
  if (matchFinal) return matchFinal[1].toUpperCase()
  const matchSec = String(cursoStr).match(/SEC(?:CI[OÓ]N)?\.?\s*([A-Z])/i)
  if (matchSec) return matchSec[1].toUpperCase()
  return 'A'
}

// Normalizar nombres de días para comparación robusta (sin tildes, en minúsculas)
const normalizarDia = (dia) => {
  return String(dia || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// Obtener nombre del día de la semana a partir de una fecha YYYY-MM-DD
const getDiaSemanaFromDate = (fechaStr) => {
  if (!fechaStr) return ''
  const d = new Date(fechaStr + 'T12:00:00')
  if (isNaN(d.getTime())) return ''
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  return dias[d.getDay()]
}

// Busca todos los bloques de horario del semestre para un docente y curso específico
const obtenerBloquesHorarioCurso = (docenteNombre, cursoNombre, fuentesHorarios = []) => {
  if (!docenteNombre || !cursoNombre || cursoNombre === '__OTRO__') return []

  const targetNorm = cursoNombre.trim().toUpperCase()
  const secCurso = extraerSeccion(cursoNombre)

  const bloques = fuentesHorarios.filter((item) => {
    const hDoc = item.DOCENTE || item.docente || ''
    if (!matchTeacher(docenteNombre, hDoc)) return false

    const hCodigo = (item.CODIGO || item.codigo || '').trim().toUpperCase()
    const hCurso = (item.CURSO || item.curso || '').trim().toUpperCase()
    const hSec = (item.SECCION || item.seccion || '').trim().toUpperCase()
    const hFormatted = `${hCodigo ? hCodigo + ' ' : ''}${hCurso}${hSec ? ' - ' + hSec : ''}`.trim().toUpperCase()

    if (hFormatted === targetNorm) return true
    if (hCodigo && targetNorm.includes(hCodigo) && (!hSec || hSec === secCurso)) return true
    if (hCurso && targetNorm.includes(hCurso) && (!hSec || hSec === secCurso)) return true
    return false
  })

  return bloques.map((b) => ({
    dia: b.DIA || b.dia || '',
    horaInicio: (b.HORA_INICIO || b.hora_inicio || b.horaInicio || '').slice(0, 5),
    horaFin: (b.HORA_FIN || b.hora_fin || b.horaFin || '').slice(0, 5),
    aula: b.AULA || b.aula || '',
    seccion: b.SECCION || b.seccion || '',
    ciclo: b.CICLO || b.ciclo || ''
  })).filter((b) => b.horaInicio && b.horaFin)
}

// Obtiene la lista completa de cursos de un docente cruzando MAESTRO_DOCENTES, HORARIOS y BASE_DE_DATOS
const obtenerCursosCompletosDocente = (doc, listaHorarios = [], historialData = []) => {
  if (!doc) return []
  const cursosSet = new Set()

  // 1. Cursos de MAESTRO_DOCENTES
  let cursosMaestro = []
  if (Array.isArray(doc.cursos)) {
    cursosMaestro = doc.cursos
  } else if (doc.cursos) {
    cursosMaestro = String(doc.cursos).split(',').map((c) => c.trim()).filter(Boolean)
  }
  cursosMaestro.forEach((c) => {
    if (c) cursosSet.add(c.trim())
  })

  // 2. Cursos de HORARIOS (Sheets + dataset institucional procesado)
  const fuentesHorarios = [...(listaHorarios || []), ...(HORARIOS_DEFAULT || [])]
  const docNombre = doc.nombre || ''
  const docDni = normalizeDni(doc.dni || '')

  fuentesHorarios.forEach((h) => {
    const hDoc = h.DOCENTE || h.docente || ''
    const hCurso = (h.CURSO || h.curso || '').trim()
    const hCodigo = (h.CODIGO || h.codigo || '').trim()
    const hSeccion = (h.SECCION || h.seccion || '').trim()

    if (hCurso && matchTeacher(docNombre, hDoc)) {
      const formatted = `${hCodigo ? hCodigo + ' ' : ''}${hCurso}${hSeccion ? ' - ' + hSeccion : ''}`.trim()
      cursosSet.add(formatted)
    }
  })

  // 3. Cursos de sesiones registradas en el historial (BASE_DE_DATOS)
  if (Array.isArray(historialData)) {
    historialData.forEach((s) => {
      if (normalizeDni(s.dni) === docDni && s.asignatura) {
        cursosSet.add(s.asignatura.trim())
      }
    })
  }

  // Deduplicación inteligente: si existe versión con sección (ej. "TALLER DE TESIS - A"), descartar la genérica sin sección
  const todosCursos = Array.from(cursosSet)
  const filtrados = todosCursos.filter((c) => {
    const tieneSec = /[-\s]+[A-Z]$/i.test(c)
    if (!tieneSec) {
      const existeConSec = todosCursos.some((otro) => otro !== c && otro.startsWith(c) && /[-\s]+[A-Z]$/i.test(otro))
      if (existeConSec) return false
    }
    return true
  })

  return filtrados.sort((a, b) => a.localeCompare(b))
}

// Función auxiliar para verificar si una sesión está validada
const isSesionValidada = (val) => {
  if (!val) return false
  const str = String(val).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return str.includes('VALID') || str === 'SI' || str === 'APROBADO'
}

const HistorialGlobalView = ({ isDarkMode }) => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSemana, setSelectedSemana] = useState('')
  const [selectedTipo, setSelectedTipo] = useState('')
  const [selectedValidacion, setSelectedValidacion] = useState('')

  // Modales existentes
  const [selectedSesion, setSelectedSesion] = useState(null) // Modal Detalle (Lectura)
  const [editingSesion, setEditingSesion] = useState(null)   // Modal Edición
  const [savingEdit, setSavingEdit] = useState(false)

  // ── Modal Registro Manual (Ficha Física Anexo C) ──
  const [docentesList, setDocentesList] = useState([])
  const [horariosList, setHorariosList] = useState(HORARIOS_DEFAULT || [])
  const [showManualModal, setShowManualModal] = useState(false)
  const [savingManual, setSavingManual] = useState(false)
  const [manualSuccessMsg, setManualSuccessMsg] = useState('')
  const [manualErrorMsg, setManualErrorMsg] = useState('')
  const [manualCursosDocente, setManualCursosDocente] = useState([])
  const [escribirCursoManual, setEscribirCursoManual] = useState(false)
  const [horariosDisponiblesCurso, setHorariosDisponiblesCurso] = useState([])

  // Búsqueda y Autocompletado de Docente en Modal Manual
  const [docenteSearchQuery, setDocenteSearchQuery] = useState('')
  const [isDocenteDropdownOpen, setIsDocenteDropdownOpen] = useState(false)
  const docenteDropdownRef = useRef(null)

  // Cerrar dropdown de docente al hacer clic fuera
  useEffect(() => {
    const handleClickOutsideDocente = (e) => {
      if (docenteDropdownRef.current && !docenteDropdownRef.current.contains(e.target)) {
        setIsDocenteDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutsideDocente)
    return () => document.removeEventListener('mousedown', handleClickOutsideDocente)
  }, [])

  const getInitialManualForm = () => {
    const hoy = new Date().toLocaleDateString('en-CA')
    const { semana, unidad } = calcularSemanaYUnidad(hoy)
    return {
      dni: '',
      docente: '',
      facultad: 'Facultad de Ingeniería',
      escuela: 'Escuela Profesional de Ingeniería Civil',
      carrera: 'Ingeniería Civil',
      asignatura: '',
      seccion: 'A',
      numero: '1',
      aula: 'BLOQUE R-207',
      fecha: hoy,
      unidad: unidad || 'I',
      semana: String(semana || '1'),
      horaInicio: '08:00',
      horaFin: '09:30',
      tema: '',
      recursos: ['Pizarra', 'Proyector'],
      recursosLibre: '',
      numEstudiantes: '25',
      tipoSesion: 'Clase Regular',
      validacion: 'VÁLIDO',
      observaciones: 'Registro manual según Ficha de Avance Silábico física (Anexo C).'
    }
  }

  const [manualForm, setManualForm] = useState(getInitialManualForm())

  // Paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)

  // Cargar lista de docentes y horarios completos para selector del modal manual
  useEffect(() => {
    const loadDocentesYHorarios = async () => {
      try {
        const resDoc = await obtenerListaDocentes()
        if (resDoc.success && Array.isArray(resDoc.data) && resDoc.data.length > 0) {
          setDocentesList(resDoc.data)
        } else {
          setDocentesList(MAESTRO_DOCENTES)
        }
      } catch (err) {
        console.warn('Error cargando docentes para modal manual, usando fallback:', err)
        setDocentesList(MAESTRO_DOCENTES)
      }

      try {
        const resHor = await obtenerHorarios()
        if (resHor.success && Array.isArray(resHor.data?.horarios) && resHor.data.horarios.length > 0) {
          setHorariosList(resHor.data.horarios)
        }
      } catch (err) {
        console.warn('Error cargando horarios de la nube, usando HORARIOS_DEFAULT:', err)
      }
    }
    loadDocentesYHorarios()
  }, [])

  // Cargar datos del historial global
  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const res = await obtenerHistorialGlobal({
        semana: selectedSemana
      })
      if (res.success && Array.isArray(res.data)) {
        setData(res.data)
      }
    } catch (err) {
      console.error('Error al cargar historial global:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedSemana])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Selección de docente en el Modal Manual: autollena datos, lista cursos completos y calcula N° Correlativo recomendado
  // Filtrado reactivo de docentes por Nombre, Apellidos o DNI para el buscador del modal manual
  const filteredDocentesParaModal = useMemo(() => {
    const trimmed = (docenteSearchQuery || '').trim()
    // Si no hay texto de búsqueda o si coincide exactamente con el docente ya seleccionado, mostrar todos para que pueda elegir libremente
    if (!trimmed || (manualForm.docente && trimmed.toLowerCase() === manualForm.docente.trim().toLowerCase())) {
      return docentesList
    }
    const q = trimmed.toLowerCase()
    const qNorm = normalizeTeacherName(trimmed).toLowerCase()

    return docentesList.filter((d) => {
      const nombre = String(d.nombre || '').toLowerCase()
      const nombreNorm = normalizeTeacherName(d.nombre).toLowerCase()
      const dni = String(d.dni || '').toLowerCase()
      const codigo = String(d.codigo || '').toLowerCase()

      return (
        nombre.includes(q) ||
        (qNorm && nombreNorm.includes(qNorm)) ||
        dni.includes(q) ||
        codigo.includes(q)
      )
    })
  }, [docentesList, docenteSearchQuery, manualForm.docente])

  // Selección de docente en el Modal Manual: autollena datos, lista cursos completos, aula, horarios y calcula N° Correlativo recomendado
  const handleSelectDocente = (selectedDni) => {
    const doc = docentesList.find(
      (d) => normalizeDni(d.dni) === normalizeDni(selectedDni) || String(d.dni).trim() === String(selectedDni).trim()
    )
    if (!doc) {
      setManualForm((prev) => ({ ...prev, dni: '', docente: '', asignatura: '', seccion: 'A' }))
      setManualCursosDocente([])
      setHorariosDisponiblesCurso([])
      setEscribirCursoManual(false)
      setDocenteSearchQuery('')
      return
    }

    setDocenteSearchQuery(doc.nombre)
    setIsDocenteDropdownOpen(false)

    // Extraer lista completa de cursos del docente cruzando todas las fuentes
    const cursosCompletos = obtenerCursosCompletosDocente(doc, horariosList, data)
    setManualCursosDocente(cursosCompletos)
    setEscribirCursoManual(false)

    // Calcular el N° correlativo recomendado (máximo registrado del docente + 1)
    const targetDniNorm = normalizeDni(doc.dni)
    let maxHistorial = 0
    data.forEach((s) => {
      if (normalizeDni(s.dni) === targetDniNorm) {
        const n = parseInt(s.numero, 10)
        if (!isNaN(n) && n > maxHistorial) maxHistorial = n
      }
    })

    let localStored = 0
    try {
      const val = parseInt(localStorage.getItem(`upt_registro_num_${doc.dni}`), 10)
      if (!isNaN(val)) localStored = val
    } catch (e) {}

    const sugerido = Math.max(maxHistorial, localStored) + 1

    const primerCurso = cursosCompletos.length > 0 ? cursosCompletos[0] : ''
    const secCalculada = extraerSeccion(primerCurso)

    // Reconocer automáticamente Horario Oficial (Inicio/Fin) y Aula asignada del semestre
    let aulaSugerida = 'BLOQUE R-207'
    let horaInicioSugerida = '08:00'
    let horaFinSugerida = '09:30'

    if (primerCurso) {
      const fuentesHorarios = [...(horariosList || []), ...(HORARIOS_DEFAULT || [])]
      const bloques = obtenerBloquesHorarioCurso(doc.nombre, primerCurso, fuentesHorarios)
      setHorariosDisponiblesCurso(bloques)

      if (bloques.length > 0) {
        // Priorizar el bloque que coincida con el día de la semana de la fecha dictada
        const diaFechaNorm = normalizarDia(getDiaSemanaFromDate(manualForm.fecha))
        const matchingBlock = bloques.find((b) => normalizarDia(b.dia) === diaFechaNorm) || bloques[0]
        horaInicioSugerida = matchingBlock.horaInicio
        horaFinSugerida = matchingBlock.horaFin
        if (matchingBlock.aula) {
          const rawAula = matchingBlock.aula.trim().toUpperCase()
          const matchedAula = AULAS_OPTIONS.find((a) => a.toUpperCase().includes(rawAula))
          aulaSugerida = matchedAula || matchingBlock.aula
        }
      } else {
        // Fallback: historial de sesiones previas del docente
        const targetNorm = primerCurso.trim().toUpperCase()
        const prevSesion = data.find(
          (s) =>
            normalizeDni(s.dni) === targetDniNorm &&
            s.asignatura &&
            targetNorm.includes(s.asignatura.trim().toUpperCase()) &&
            s.horaInicio &&
            s.horaFin
        )
        if (prevSesion) {
          horaInicioSugerida = prevSesion.horaInicio.slice(0, 5)
          horaFinSugerida = (prevSesion.horaFin || prevSesion.horaFinalizacion || '').slice(0, 5) || horaFinSugerida
          if (prevSesion.aula) aulaSugerida = prevSesion.aula
        }
      }
    } else {
      setHorariosDisponiblesCurso([])
    }

    setManualForm((prev) => ({
      ...prev,
      dni: doc.dni,
      docente: doc.nombre,
      facultad: doc.facultad || 'Facultad de Ingeniería',
      escuela: doc.escuela || 'Escuela Profesional de Ingeniería Civil',
      carrera: doc.carrera || 'Ingeniería Civil',
      asignatura: primerCurso,
      seccion: secCalculada,
      aula: aulaSugerida,
      horaInicio: horaInicioSugerida,
      horaFin: horaFinSugerida,
      numero: String(sugerido)
    }))
  }

  // Manejador al cambiar de curso en el modal manual: auto-sincroniza sección, aula y horarios oficiales
  const handleCursoManualChange = (cursoSeleccionado) => {
    if (cursoSeleccionado === '__OTRO__') {
      setEscribirCursoManual(true)
      setHorariosDisponiblesCurso([])
      setManualForm((prev) => ({
        ...prev,
        asignatura: '',
        seccion: 'A'
      }))
      return
    }

    setEscribirCursoManual(false)
    const secCalculada = extraerSeccion(cursoSeleccionado)
    let aulaSugerida = manualForm.aula
    let horaInicioSugerida = manualForm.horaInicio
    let horaFinSugerida = manualForm.horaFin

    const fuentesHorarios = [...(horariosList || []), ...(HORARIOS_DEFAULT || [])]
    const bloques = obtenerBloquesHorarioCurso(manualForm.docente, cursoSeleccionado, fuentesHorarios)
    setHorariosDisponiblesCurso(bloques)

    if (bloques.length > 0) {
      // Priorizar el bloque que coincida con el día de la semana de la fecha dictada
      const diaFechaNorm = normalizarDia(getDiaSemanaFromDate(manualForm.fecha))
      const matchingBlock = bloques.find((b) => normalizarDia(b.dia) === diaFechaNorm) || bloques[0]
      horaInicioSugerida = matchingBlock.horaInicio
      horaFinSugerida = matchingBlock.horaFin
      if (matchingBlock.aula) {
        const rawAula = matchingBlock.aula.trim().toUpperCase()
        const matchedAula = AULAS_OPTIONS.find((a) => a.toUpperCase().includes(rawAula))
        aulaSugerida = matchedAula || matchingBlock.aula
      }
    } else if (cursoSeleccionado) {
      // Fallback: historial de sesiones previas del docente
      const targetNorm = cursoSeleccionado.trim().toUpperCase()
      const docDniNorm = normalizeDni(manualForm.dni)
      const prevSesion = data.find(
        (s) =>
          normalizeDni(s.dni) === docDniNorm &&
          s.asignatura &&
          targetNorm.includes(s.asignatura.trim().toUpperCase()) &&
          s.horaInicio &&
          s.horaFin
      )
      if (prevSesion) {
        horaInicioSugerida = prevSesion.horaInicio.slice(0, 5)
        horaFinSugerida = (prevSesion.horaFin || prevSesion.horaFinalizacion || '').slice(0, 5) || horaFinSugerida
        if (prevSesion.aula) aulaSugerida = prevSesion.aula
      }
    }

    setManualForm((prev) => ({
      ...prev,
      asignatura: cursoSeleccionado,
      seccion: secCalculada,
      aula: aulaSugerida,
      horaInicio: horaInicioSugerida,
      horaFin: horaFinSugerida
    }))
  }

  // Cambio de fecha en Modal Manual: recalcula automáticamente Semana, Unidad y ajusta Horarios según el día de la semana
  const handleFechaManualChange = (newFecha) => {
    const calc = calcularSemanaYUnidad(newFecha)
    let extra = {}

    // Si ya hay docente y curso seleccionados, buscar si hay un bloque específico de horario para este nuevo día
    if (manualForm.docente && manualForm.asignatura) {
      const fuentesHorarios = [...(horariosList || []), ...(HORARIOS_DEFAULT || [])]
      const bloques = obtenerBloquesHorarioCurso(manualForm.docente, manualForm.asignatura, fuentesHorarios)
      if (bloques.length > 0) {
        const diaFechaNorm = normalizarDia(getDiaSemanaFromDate(newFecha))
        const matchingBlock = bloques.find((b) => normalizarDia(b.dia) === diaFechaNorm)
        if (matchingBlock) {
          extra.horaInicio = matchingBlock.horaInicio
          extra.horaFin = matchingBlock.horaFin
          if (matchingBlock.aula) {
            const rawAula = matchingBlock.aula.trim().toUpperCase()
            const matchedAula = AULAS_OPTIONS.find((a) => a.toUpperCase().includes(rawAula))
            extra.aula = matchedAula || matchingBlock.aula
          }
        }
      }
    }

    setManualForm((prev) => ({
      ...prev,
      fecha: newFecha,
      semana: String(calc.semana),
      unidad: calc.unidad,
      ...extra
    }))
  }

  // Toggle de recurso en Modal Manual
  const handleToggleRecursoManual = (item) => {
    setManualForm((prev) => {
      const current = Array.isArray(prev.recursos) ? prev.recursos : []
      if (current.includes(item)) {
        return { ...prev, recursos: current.filter((r) => r !== item) }
      } else {
        return { ...prev, recursos: [...current, item] }
      }
    })
  }

  // Guardar Sesión Manual (Anexo C)
  const handleSaveManual = async (e) => {
    e.preventDefault()
    if (!manualForm.dni || !manualForm.docente) {
      setManualErrorMsg('Por favor seleccione un docente de la lista.')
      return
    }
    if (!manualForm.asignatura) {
      setManualErrorMsg('Por favor indique o seleccione la asignatura.')
      return
    }
    if (!manualForm.fecha) {
      setManualErrorMsg('Por favor ingrese la fecha de la sesión.')
      return
    }

    setSavingManual(true)
    setManualErrorMsg('')
    setManualSuccessMsg('')

    const recursosTexto = [
      ...(Array.isArray(manualForm.recursos) ? manualForm.recursos : []),
      manualForm.recursosLibre ? manualForm.recursosLibre.trim() : ''
    ].filter(Boolean).join(', ')

    // Formatear hora a HH:mm:ss
    const formatTimeWithSeconds = (t) => {
      if (!t) return '08:00:00'
      const parts = String(t).trim().split(':')
      if (parts.length === 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`
      return t
    }

    const horaInicioFormatted = formatTimeWithSeconds(manualForm.horaInicio)
    const horaFinFormatted = formatTimeWithSeconds(manualForm.horaFin)
    const seccionFinal = extraerSeccion(manualForm.asignatura)

    const payload = {
      dni: manualForm.dni,
      docente: manualForm.docente,
      facultad: manualForm.facultad,
      escuela: manualForm.escuela,
      carrera: manualForm.carrera,
      numero: manualForm.numero,
      aula: manualForm.aula,
      aulaLab: manualForm.aula,
      fecha: manualForm.fecha,
      asignatura: manualForm.asignatura,
      seccion: seccionFinal,
      unidad: manualForm.unidad,
      semana: manualForm.semana,
      semanaAcademica: manualForm.semana,
      tema: manualForm.tema,
      temaProgramado: manualForm.tema,
      recursos: recursosTexto,
      horaInicio: horaInicioFormatted,
      horaFin: horaFinFormatted,
      horaFinalizacion: horaFinFormatted,
      numEstudiantes: manualForm.numEstudiantes,
      validacion: manualForm.validacion || 'VÁLIDO',
      observaciones: manualForm.observaciones,
      tipoSesion: manualForm.tipoSesion || 'Clase Regular',
      tipo_sesion: manualForm.tipoSesion || 'Clase Regular',
      estado: 'COMPLETADO'
    }

    try {
      const res = await crearSesionManualAdmin(payload)
      if (res.success) {
        // 1. Agregar de forma optimista a la tabla
        const nuevaSesion = {
          ...payload,
          id: 'manual_' + Date.now(),
          timestamp: new Date().toLocaleDateString('es-PE') + ' ' + new Date().toLocaleTimeString('es-PE')
        }
        setData((prev) => [nuevaSesion, ...prev])

        // 2. Actualizar el correlativo del docente para que su siguiente clase en vivo sugiera el siguiente N°
        guardarNumeroRegistroCompletado(manualForm.dni, manualForm.numero)

        setManualSuccessMsg('¡Sesión manual (Anexo C) registrada exitosamente en Base de Datos!')
        setTimeout(() => {
          setShowManualModal(false)
          setManualSuccessMsg('')
          setManualForm(getInitialManualForm())
          setDocenteSearchQuery('')
          setManualCursosDocente([])
          setHorariosDisponiblesCurso([])
          setIsDocenteDropdownOpen(false)
        }, 1500)
      } else {
        setManualErrorMsg(res.message || 'No se pudo registrar la sesión en Sheets.')
      }
    } catch (err) {
      console.error('Error al guardar sesión manual:', err)
      // Fallback optimista si hubo error de conexión
      const nuevaSesion = {
        ...payload,
        id: 'manual_' + Date.now(),
        timestamp: new Date().toLocaleDateString('es-PE') + ' ' + new Date().toLocaleTimeString('es-PE')
      }
      setData((prev) => [nuevaSesion, ...prev])
      guardarNumeroRegistroCompletado(manualForm.dni, manualForm.numero)
      setManualSuccessMsg('Sesión registrada en vista local. Se sincronizará con la nube al reconectar.')
      setTimeout(() => {
        setShowManualModal(false)
        setManualSuccessMsg('')
        setManualForm(getInitialManualForm())
        setDocenteSearchQuery('')
        setManualCursosDocente([])
        setHorariosDisponiblesCurso([])
        setIsDocenteDropdownOpen(false)
      }, 1600)
    } finally {
      setSavingManual(false)
    }
  }

  // Manejar el toggle manual de validación por la Directora (Switch)
  const handleToggleValidacion = async (row, e) => {
    if (e) e.stopPropagation()
    const currentlyValid = isSesionValidada(row.validacion)
    const nuevoEstado = currentlyValid ? 'PENDIENTE' : 'VÁLIDO'

    // Actualización optimista inmediata en el estado de la UI
    setData((prevData) =>
      prevData.map((item) =>
        item.id === row.id ||
        (item.dni === row.dni && item.fecha === row.fecha && item.horaInicio === row.horaInicio)
          ? { ...item, validacion: nuevoEstado }
          : item
      )
    )

    // Enviar cambio al backend de Google Sheets
    try {
      await actualizarValidacionSesion({
        rowId: row.id,
        dni: row.dni,
        fecha: row.fecha,
        horaInicio: row.horaInicio,
        validacion: nuevoEstado
      })
    } catch (err) {
      console.warn('Error al actualizar validación en Sheets:', err)
    }
  }

  // Abrir modal de edición
  const handleStartEdit = (row, e) => {
    if (e) e.stopPropagation()
    setEditingSesion({
      ...row,
      dniOriginal: row.dni,
      fechaOriginal: row.fecha,
      horaInicioOriginal: row.horaInicio
    })
  }

  // Guardar cambios de edición de sesión
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingSesion) return
    setSavingEdit(true)

    // Actualización optimista local
    setData((prevData) =>
      prevData.map((item) =>
        item.id === editingSesion.id ||
        (item.dni === editingSesion.dniOriginal &&
         item.fecha === editingSesion.fechaOriginal &&
         item.horaInicio === editingSesion.horaInicioOriginal)
          ? { ...editingSesion }
          : item
      )
    )

    try {
      await editarSesionAdmin(editingSesion)
    } catch (err) {
      console.warn('Error al persistir edición en Sheets:', err)
    } finally {
      setSavingEdit(false)
      setEditingSesion(null)
    }
  }

  // Normalización de fecha para ordenamiento cronológico
  const parseDateToComparable = (fechaStr) => {
    if (!fechaStr) return ''
    const str = String(fechaStr).trim()
    if (str.includes('/')) {
      const parts = str.split('/')
      if (parts.length === 3) {
        // DD/MM/YYYY -> YYYY-MM-DD
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
      }
    }
    return str
  }

  // Filtrado y Ordenamiento Cronológico en cliente
  // Se ordenan por Fecha (más recientes arriba) y Hora Inicio (más reciente arriba)
  // Preservando el número correlativo original del registro físico o digital
  const filteredData = useMemo(() => {
    const filtered = data.filter((item) => {
      // Búsqueda por texto
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const match =
          String(item.docente || '').toLowerCase().includes(term) ||
          String(item.dni || '').toLowerCase().includes(term) ||
          String(item.asignatura || '').toLowerCase().includes(term) ||
          String(item.aula || '').toLowerCase().includes(term) ||
          String(item.tema || '').toLowerCase().includes(term)
        if (!match) return false
      }

      // Filtro tipo
      if (selectedTipo && !String(item.tipoSesion || '').toLowerCase().includes(selectedTipo.toLowerCase())) {
        return false
      }

      // Filtro validación
      if (selectedValidacion) {
        const isValid = isSesionValidada(item.validacion)
        if (selectedValidacion === 'VALIDO' && !isValid) return false
        if (selectedValidacion === 'PENDIENTE' && isValid) return false
      }

      return true
    })

    // Ordenar cronológicamente (Fecha descendente, Hora descendente)
    return filtered.sort((a, b) => {
      const dateA = parseDateToComparable(a.fecha)
      const dateB = parseDateToComparable(b.fecha)
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA)
      }
      const timeA = String(a.horaInicio || '')
      const timeB = String(b.horaInicio || '')
      return timeB.localeCompare(timeA)
    })
  }, [data, searchTerm, selectedTipo, selectedValidacion])

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage))
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredData.slice(start, start + itemsPerPage)
  }, [filteredData, currentPage, itemsPerPage])

  // Exportar a CSV
  const handleExportCSV = () => {
    if (filteredData.length === 0) return
    const headers = [
      'N°',
      'DNI',
      'Docente',
      'Facultad',
      'Escuela',
      'Aula',
      'Fecha',
      'Asignatura',
      'Unidad',
      'Semana',
      'Tema',
      'Hora Inicio',
      'Hora Fin',
      'Estudiantes',
      'Tipo Sesion',
      'Validacion'
    ]

    const rows = filteredData.map((s) => [
      `"${s.numero || ''}"`,
      `"${s.dni || ''}"`,
      `"${s.docente || ''}"`,
      `"${s.facultad || ''}"`,
      `"${s.escuela || ''}"`,
      `"${s.aula || ''}"`,
      `"${s.fecha || ''}"`,
      `"${s.asignatura || ''}"`,
      `"${s.unidad || ''}"`,
      `"${s.semana || ''}"`,
      `"${(s.tema || '').replace(/"/g, '""')}"`,
      `"${s.horaInicio || ''}"`,
      `"${s.horaFin || ''}"`,
      `"${s.numEstudiantes || ''}"`,
      `"${s.tipoSesion || ''}"`,
      `"${s.validacion || ''}"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `historial_docente_epic_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Header & Controles */}
      <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">
                  Historial Global de Sesiones
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {filteredData.length} registros
                </span>
              </div>
              <p className="text-xs text-white/50 font-medium">
                Auditoría y edición completa de todas las sesiones registradas en la Base de Datos
              </p>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => {
                setShowManualModal(true)
                setManualErrorMsg('')
                setManualSuccessMsg('')
                if (manualForm.dni && manualForm.docente) {
                  setDocenteSearchQuery(manualForm.docente)
                } else {
                  setDocenteSearchQuery('')
                }
                setIsDocenteDropdownOpen(false)
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition-all text-xs font-bold cursor-pointer shadow-lg shadow-emerald-950/60 ring-1 ring-emerald-400/40 hover:scale-[1.02] active:scale-[0.98]"
              title="Registrar sesión física de papel (Anexo C) en la base de datos"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-200" />
              <span>+ Registrar Sesión Manual (Anexo C)</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={filteredData.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 transition-all text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel (CSV)</span>
            </button>

            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Refrescar</span>
            </button>
          </div>
        </div>

        {/* Barra de Búsqueda y Filtros Rápidos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/10 text-xs">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Buscar docente, curso, tema..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white placeholder:text-white/30 text-xs font-medium focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Filtro Semana */}
          <div>
            <select
              value={selectedSemana}
              onChange={(e) => {
                setSelectedSemana(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-medium focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">Todas las Semanas</option>
              {[...Array(18)].map((_, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  Semana {i + 1}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Tipo de Sesión */}
          <div>
            <select
              value={selectedTipo}
              onChange={(e) => {
                setSelectedTipo(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-medium focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">Todos los Tipos</option>
              <option value="Regular">Clase Regular</option>
              <option value="Recupera">Recuperación</option>
            </select>
          </div>

          {/* Filtro Validación */}
          <div>
            <select
              value={selectedValidacion}
              onChange={(e) => {
                setSelectedValidacion(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-medium focus:outline-none focus:border-emerald-500/50"
            >
              <option value="">Todas las Validaciones</option>
              <option value="VALIDO">Validadas</option>
              <option value="PENDIENTE">Pendientes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Registros */}
      <div className="rounded-3xl bg-white/[0.02] border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-black/40 text-[11px] uppercase tracking-wider text-white/50 border-b border-white/10 font-black">
              <tr>
                <th className="py-3.5 px-4">#</th>
                <th className="py-3.5 px-4">Docente</th>
                <th className="py-3.5 px-4">Aula</th>
                <th className="py-3.5 px-4">Fecha</th>
                <th className="py-3.5 px-4">Asignatura</th>
                <th className="py-3.5 px-4">Sem.</th>
                <th className="py-3.5 px-4">Horario</th>
                <th className="py-3.5 px-4">Est.</th>
                <th className="py-3.5 px-4">Estado Validación</th>
                <th className="py-3.5 px-4 text-center">Validar (Directora)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-white/40">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                    Cargando historial de sesiones...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-white/40">
                    No se encontraron registros que coincidan con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => {
                  const isValid = isSesionValidada(row.validacion)

                  return (
                    <tr
                      key={row.id || idx}
                      className="hover:bg-white/[0.04] transition-colors group cursor-pointer"
                      onClick={() => setSelectedSesion(row)}
                      title="Clic en la fila para ver detalle completo"
                    >
                      <td className="py-3 px-4 font-mono text-[11px] text-white/40">
                        {row.numero || (currentPage - 1) * itemsPerPage + idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white leading-tight group-hover:text-emerald-300 transition-colors">
                          {row.docente}
                        </div>
                        <div className="text-[10px] font-mono text-white/30">
                          {row.dni}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white font-mono text-[11px]">
                          {row.aula}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-white/70">
                        {row.fecha}
                      </td>
                      <td className="py-3 px-4 max-w-[200px] truncate text-slate-200" title={row.asignatura}>
                        {row.asignatura}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 font-mono font-bold text-[10px]">
                          S{row.semana}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-white/60">
                        {row.horaInicio} ➔ {row.horaFin}
                      </td>
                      <td className="py-3 px-4 font-mono text-center text-white/80">
                        {row.numEstudiantes || '--'}
                      </td>

                      {/* Badge de Validación */}
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <motion.span
                          key={isValid ? 'valido' : 'pendiente'}
                          initial={{ scale: 0.85, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.2 }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-xs ${
                            isValid
                              ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-emerald-950/60 ring-1 ring-emerald-500/20'
                              : 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-amber-950/60 ring-1 ring-amber-500/20'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isValid ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                            }`}
                          />
                          <span>{isValid ? 'VÁLIDO' : 'PENDIENTE'}</span>
                        </motion.span>
                      </td>

                      {/* Switch Button Interactivo + Botón Lápiz para Editar */}
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => handleToggleValidacion(row, e)}
                            className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                              isValid
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400/80 shadow-md shadow-emerald-900/50'
                                : 'bg-black/60 border-white/20 hover:border-amber-400/50 shadow-inner'
                            }`}
                            title={isValid ? 'Válido (Clic para marcar Pendiente)' : 'Pendiente (Clic para Validar)'}
                          >
                            <motion.span
                              layout
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              className={`pointer-events-none inline-flex h-4.5 w-4.5 transform items-center justify-center rounded-full shadow-md transition-transform duration-300 ${
                                isValid
                                  ? 'translate-x-6 bg-white text-emerald-600'
                                  : 'translate-x-0.5 bg-slate-400/80 text-black'
                              }`}
                            >
                              {isValid ? (
                                <Check className="w-3 h-3 stroke-[3]" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              )}
                            </motion.span>
                          </button>

                          {/* Botón LÁPIZ para Editar Sesión */}
                          <button
                            onClick={(e) => handleStartEdit(row, e)}
                            className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/25 text-blue-400 hover:text-blue-200 border border-blue-500/30 transition-all cursor-pointer shadow-xs"
                            title="Editar datos de la sesión"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="p-4 bg-black/40 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-white/40">
            Mostrando {filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} a{' '}
            {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length} registros
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-white/80 font-bold px-2">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── MODAL 1: DETALLE DE LA SESIÓN (LECTURA AL HACER CLIC EN LA FILA) ─── */}
      <AnimatePresence>
        {selectedSesion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSesion(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-lg rounded-3xl bg-[#111827] border border-white/20 p-6 shadow-2xl text-white space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Sesión N° {selectedSesion.numero}
                  </span>
                  <h3 className="text-base font-bold text-white mt-1">
                    {selectedSesion.docente}
                  </h3>
                  <p className="text-xs text-white/40 font-mono">DNI: {selectedSesion.dni}</p>
                </div>
                <button
                  onClick={() => setSelectedSesion(null)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                  <p className="text-white/40 text-[10px] uppercase font-bold tracking-wider">Asignatura</p>
                  <p className="font-bold text-slate-200">{selectedSesion.asignatura}</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                    <p className="text-white/40 text-[10px]">Aula</p>
                    <p className="font-bold">{selectedSesion.aula}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                    <p className="text-white/40 text-[10px]">Fecha</p>
                    <p className="font-bold font-mono">{selectedSesion.fecha}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                    <p className="text-white/40 text-[10px]">Semana / Unidad</p>
                    <p className="font-bold font-mono">S{selectedSesion.semana} • U{selectedSesion.unidad}</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                  <p className="text-white/40 text-[10px] uppercase font-bold tracking-wider">Tema Dictado</p>
                  <p className="text-slate-300 leading-relaxed">{selectedSesion.tema || 'Sin tema especificado'}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                    <p className="text-white/40 text-[10px]">Horario</p>
                    <p className="font-bold font-mono">{selectedSesion.horaInicio} ➔ {selectedSesion.horaFin}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                    <p className="text-white/40 text-[10px]">Estudiantes</p>
                    <p className="font-bold">{selectedSesion.numEstudiantes || '0'} asistentes</p>
                  </div>
                </div>

                {selectedSesion.observaciones && (
                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                    <p className="text-white/40 text-[10px] uppercase font-bold tracking-wider">Observaciones</p>
                    <p className="text-slate-300 italic">{selectedSesion.observaciones}</p>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                <button
                  onClick={() => {
                    const toEdit = selectedSesion
                    setSelectedSesion(null)
                    handleStartEdit(toEdit)
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Editar Sesión</span>
                </button>

                <button
                  onClick={() => setSelectedSesion(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL 2: EDICIÓN COMPLETA DE LA SESIÓN (LÁPIZ) ─── */}
      <AnimatePresence>
        {editingSesion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingSesion(null)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-2xl rounded-3xl bg-[#0f172a] border border-blue-500/40 p-6 shadow-2xl text-white space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar"
            >
              {/* Header Modal Edición */}
              <div className="flex items-start justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      Editar Registro de Sesión
                    </h3>
                    <p className="text-xs text-white/40">
                      Modificación directa por Dirección Académica
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingSesion(null)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Formulario de Edición */}
              <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
                {/* Docente & DNI */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Nombre del Docente</label>
                    <input
                      type="text"
                      value={editingSesion.docente || ''}
                      onChange={(e) => setEditingSesion({ ...editingSesion, docente: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">DNI del Docente</label>
                    <input
                      type="text"
                      value={editingSesion.dni || ''}
                      onChange={(e) => setEditingSesion({ ...editingSesion, dni: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono font-medium focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                {/* Asignatura */}
                <div>
                  <label className="block text-[11px] font-bold text-white/60 mb-1">Asignatura y Sección</label>
                  <input
                    type="text"
                    value={editingSesion.asignatura || ''}
                    onChange={(e) => setEditingSesion({ ...editingSesion, asignatura: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                {/* Aula, Fecha, Semana, Unidad */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Aula / Laboratorio</label>
                    <input
                      type="text"
                      list="aulas-list"
                      value={editingSesion.aula || ''}
                      onChange={(e) => setEditingSesion({ ...editingSesion, aula: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-blue-500"
                      required
                    />
                    <datalist id="aulas-list">
                      {AULAS_OPTIONS.map((a, i) => (
                        <option key={i} value={a} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Fecha</label>
                    <input
                      type="date"
                      value={editingSesion.fecha || ''}
                      onChange={(e) => setEditingSesion({ ...editingSesion, fecha: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono font-medium focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Semana</label>
                    <select
                      value={editingSesion.semana || ''}
                      onChange={(e) => setEditingSesion({ ...editingSesion, semana: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-blue-500"
                    >
                      {[...Array(18)].map((_, i) => (
                        <option key={i + 1} value={String(i + 1)}>
                          Semana {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Unidad</label>
                    <select
                      value={editingSesion.unidad || 'I'}
                      onChange={(e) => setEditingSesion({ ...editingSesion, unidad: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-blue-500"
                    >
                      <option value="I">Unidad I</option>
                      <option value="II">Unidad II</option>
                      <option value="III">Unidad III</option>
                    </select>
                  </div>
                </div>

                {/* Tema Programado */}
                <div>
                  <label className="block text-[11px] font-bold text-white/60 mb-1">Tema Programado en el Sílabo</label>
                  <textarea
                    rows={2}
                    value={editingSesion.tema || ''}
                    onChange={(e) => setEditingSesion({ ...editingSesion, tema: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-blue-500"
                    placeholder="Descripción del tema dictado..."
                  />
                </div>

                {/* Horarios, Estudiantes, Tipo */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Hora Inicio</label>
                    <input
                      type="text"
                      value={editingSesion.horaInicio || ''}
                      onChange={(e) => setEditingSesion({ ...editingSesion, horaInicio: e.target.value })}
                      placeholder="HH:mm:ss"
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono font-medium focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Hora Fin</label>
                    <input
                      type="text"
                      value={editingSesion.horaFin || ''}
                      onChange={(e) => setEditingSesion({ ...editingSesion, horaFin: e.target.value })}
                      placeholder="HH:mm:ss"
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono font-medium focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">N° Estudiantes</label>
                    <input
                      type="number"
                      value={editingSesion.numEstudiantes || ''}
                      onChange={(e) => setEditingSesion({ ...editingSesion, numEstudiantes: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono font-medium focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/60 mb-1">Tipo de Sesión</label>
                    <select
                      value={editingSesion.tipoSesion || 'Clase Regular'}
                      onChange={(e) => setEditingSesion({ ...editingSesion, tipoSesion: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-blue-500"
                    >
                      <option value="Clase Regular">Clase Regular</option>
                      <option value="Recuperación">Recuperación</option>
                    </select>
                  </div>
                </div>

                {/* Observaciones */}
                <div>
                  <label className="block text-[11px] font-bold text-white/60 mb-1">Observaciones</label>
                  <input
                    type="text"
                    value={editingSesion.observaciones || ''}
                    onChange={(e) => setEditingSesion({ ...editingSesion, observaciones: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:outline-none focus:border-blue-500"
                    placeholder="Observaciones de la clase..."
                  />
                </div>

                {/* Botones de Acción */}
                <div className="pt-3 border-t border-white/10 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingSesion(null)}
                    disabled={savingEdit}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-900/40 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {savingEdit ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Guardando en Sheets...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Guardar Cambios</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL 3: REGISTRO MANUAL DE SESIÓN (ANEXO C DE PAPEL) ─── */}
      <AnimatePresence>
        {showManualModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !savingManual && setShowManualModal(false)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-3xl rounded-3xl bg-[#090f1d] border border-emerald-500/40 p-5 sm:p-7 shadow-2xl text-white space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar"
            >
              {/* Header Modal */}
              <div className="flex items-start justify-between border-b border-white/10 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 border border-emerald-400/30 shrink-0">
                    <FilePlus className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                        Registrar Sesión Manual (Anexo C)
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Ficha Física
                      </span>
                    </div>
                    <p className="text-xs text-white/50 font-medium">
                      Ficha de Seguimiento de Avance Silábico • Regularización de clases de papel
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !savingManual && setShowManualModal(false)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Banner Informativo */}
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                  Permite incorporar a la Base de Datos oficial las sesiones dictadas en formato físico antes de la habilitación del sistema. La sesión se ordenará automáticamente por fecha y hora, y el contador correlativo del docente se sincronizará para su próxima clase en vivo.
                </p>
              </div>

              {/* Mensajes de Estado */}
              {manualErrorMsg && (
                <div className="p-3 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{manualErrorMsg}</span>
                </div>
              )}
              {manualSuccessMsg && (
                <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{manualSuccessMsg}</span>
                </div>
              )}

              {/* Formulario */}
              <form onSubmit={handleSaveManual} className="space-y-4 text-xs">
                {/* 1. Docente y Correlativo */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 relative" ref={docenteDropdownRef}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-white/80 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Docente Titular</span>
                        <span className="text-red-400">*</span>
                      </label>
                      {manualForm.dni && (
                        <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md font-semibold">
                          DNI: {manualForm.dni}
                        </span>
                      )}
                    </div>

                    {/* Input Buscador / Selector */}
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/40">
                        <Search className="w-3.5 h-3.5 text-emerald-400/80" />
                      </div>
                      <input
                        type="text"
                        value={docenteSearchQuery}
                        onChange={(e) => {
                          setDocenteSearchQuery(e.target.value)
                          if (!isDocenteDropdownOpen) setIsDocenteDropdownOpen(true)
                        }}
                        onFocus={(e) => {
                          setIsDocenteDropdownOpen(true)
                          e.target.select()
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (filteredDocentesParaModal.length > 0) {
                              handleSelectDocente(filteredDocentesParaModal[0].dni)
                            }
                          } else if (e.key === 'Escape') {
                            setIsDocenteDropdownOpen(false)
                          }
                        }}
                        placeholder="Escribe nombre o DNI (ej. Duarte, 43220113)..."
                        className="w-full pl-9 pr-16 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-medium focus:outline-none focus:border-emerald-400 text-xs transition-colors placeholder:text-white/30"
                      />
                      <input type="hidden" value={manualForm.dni} required />
                      <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
                        {docenteSearchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setDocenteSearchQuery('')
                              setManualForm((prev) => ({ ...prev, dni: '', docente: '', asignatura: '' }))
                              setManualCursosDocente([])
                              setIsDocenteDropdownOpen(true)
                            }}
                            className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            title="Limpiar búsqueda"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsDocenteDropdownOpen((prev) => !prev)}
                          className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                          title="Desplegar lista de docentes"
                        >
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${
                              isDocenteDropdownOpen ? 'rotate-180 text-emerald-400' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Menú Desplegable Flotante con Scroll Completo */}
                    {isDocenteDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl bg-[#0a1122]/98 border border-emerald-500/40 shadow-2xl shadow-black/90 backdrop-blur-2xl overflow-hidden animate-in fade-in duration-150">
                        {/* Cabecera del desplegable */}
                        <div className="px-3 py-1.5 bg-white/5 border-b border-white/10 flex items-center justify-between text-[10px] text-white/50">
                          <span>
                            {filteredDocentesParaModal.length} de {docentesList.length} docentes
                          </span>
                          <span className="text-emerald-400/80 font-medium">
                            {docenteSearchQuery && (!manualForm.docente || docenteSearchQuery.toLowerCase() !== manualForm.docente.toLowerCase()) ? 'Filtrado en tiempo real' : 'Todos los docentes'}
                          </span>
                        </div>

                        {/* Lista con scrollbar elegante y altura máxima (nunca se corta) */}
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                          {filteredDocentesParaModal.length === 0 ? (
                            <div className="py-6 px-3 text-center text-xs text-white/40">
                              <User className="w-6 h-6 mx-auto mb-1.5 opacity-30 text-emerald-400" />
                              <p>No se encontró ningún docente con &quot;{docenteSearchQuery}&quot;</p>
                              <p className="text-[10px] text-white/30 mt-1">Prueba con el DNI o apellido</p>
                            </div>
                          ) : (
                            filteredDocentesParaModal.map((d, i) => {
                              const isSelected = normalizeDni(d.dni) === normalizeDni(manualForm.dni)
                              return (
                                <button
                                  key={d.dni || i}
                                  type="button"
                                  onClick={() => handleSelectDocente(d.dni)}
                                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 font-bold shadow-sm'
                                      : 'hover:bg-white/10 text-white/90 font-medium'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-white tracking-wide truncate">
                                      {d.nombre}
                                    </div>
                                    <div className="text-[10px] text-emerald-400/80 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                                      <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                                        DNI: {d.dni}
                                      </span>
                                      {d.categoria && (
                                        <span className="text-white/40 font-sans">
                                          {d.categoria}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center shrink-0">
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    </div>
                                  )}
                                </button>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-white/80 mb-1 flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-emerald-400" />
                      <span>N° Sesión (Correlativo)</span>
                      <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={manualForm.numero}
                      onChange={(e) => setManualForm({ ...manualForm, numero: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-xs focus:outline-none focus:border-emerald-400"
                      required
                    />
                    <span className="text-[10px] text-emerald-400/80 font-medium block mt-1">
                      ✓ Sugerido automático. Editable.
                    </span>
                  </div>
                </div>

                {/* 2. Asignatura y Aula (Sección ya integrada en el curso) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-white/80 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Asignatura / Curso (incluye sección)</span>
                        <span className="text-red-400">*</span>
                      </span>
                      {manualCursosDocente.length > 0 && !escribirCursoManual && (
                        <span className="text-[10px] text-emerald-400 font-bold">
                          {manualCursosDocente.length} cursos oficiales encontrados
                        </span>
                      )}
                    </label>

                    {!escribirCursoManual ? (
                      <select
                        value={manualForm.asignatura}
                        onChange={(e) => handleCursoManualChange(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-medium focus:outline-none focus:border-emerald-400 text-xs cursor-pointer"
                        required
                      >
                        <option value="">-- Seleccionar Asignatura / Curso --</option>
                        {manualCursosDocente.map((c, i) => (
                          <option key={i} value={c}>
                            {c}
                          </option>
                        ))}
                        <option value="__OTRO__">✏️ Otro curso no listado (escribir manualmente)...</option>
                      </select>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={manualForm.asignatura}
                            onChange={(e) => {
                              const val = e.target.value
                              const sec = extraerSeccion(val)
                              const fuentesHorarios = [...(horariosList || []), ...(HORARIOS_DEFAULT || [])]
                              const bloques = obtenerBloquesHorarioCurso(manualForm.docente, val, fuentesHorarios)
                              setHorariosDisponiblesCurso(bloques)
                              let extraHoras = {}
                              if (bloques.length > 0) {
                                const diaFechaNorm = normalizarDia(getDiaSemanaFromDate(manualForm.fecha))
                                const matchingBlock = bloques.find((b) => normalizarDia(b.dia) === diaFechaNorm) || bloques[0]
                                extraHoras.horaInicio = matchingBlock.horaInicio
                                extraHoras.horaFin = matchingBlock.horaFin
                                if (matchingBlock.aula) {
                                  const rawAula = matchingBlock.aula.trim().toUpperCase()
                                  const matchedAula = AULAS_OPTIONS.find((a) => a.toUpperCase().includes(rawAula))
                                  extraHoras.aula = matchedAula || matchingBlock.aula
                                }
                              }
                              setManualForm((prev) => ({
                                ...prev,
                                asignatura: val,
                                seccion: sec,
                                ...extraHoras
                              }))
                            }}
                            placeholder="Nombre del curso y sección (ej. CI-541 MECÁNICA DE SUELOS - A)..."
                            className="w-full px-3 py-2 rounded-xl bg-black/60 border border-emerald-500/50 text-white font-medium focus:outline-none focus:border-emerald-400 text-xs"
                            required
                            autoFocus
                          />
                          {manualCursosDocente.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setEscribirCursoManual(false)
                                if (manualCursosDocente.length > 0) {
                                  handleCursoManualChange(manualCursosDocente[0])
                                }
                              }}
                              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 text-[11px] font-bold shrink-0 transition-colors cursor-pointer"
                              title="Volver a la lista desplegable de cursos"
                            >
                              Ver lista
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-white/80 mb-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Aula / Laboratorio</span>
                      <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      list="aulas-list-manual"
                      value={manualForm.aula}
                      onChange={(e) => setManualForm({ ...manualForm, aula: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-medium focus:outline-none focus:border-emerald-400 text-xs"
                      required
                    />
                    <datalist id="aulas-list-manual">
                      {AULAS_OPTIONS.map((a, i) => (
                        <option key={i} value={a} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* 3. Fecha, Semana Académica y Unidad (Sin campo Sección redundante) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-white/80 mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Fecha Dictada</span>
                      <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={manualForm.fecha}
                      onChange={(e) => handleFechaManualChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-mono font-medium focus:outline-none focus:border-emerald-400 text-xs cursor-pointer"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-white/80 mb-1">Semana Académica</label>
                    <select
                      value={manualForm.semana}
                      onChange={(e) => setManualForm({ ...manualForm, semana: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-medium focus:outline-none focus:border-emerald-400 text-xs cursor-pointer"
                    >
                      {[...Array(18)].map((_, i) => (
                        <option key={i + 1} value={String(i + 1)}>
                          Semana {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-white/80 mb-1">Unidad</label>
                    <select
                      value={manualForm.unidad}
                      onChange={(e) => setManualForm({ ...manualForm, unidad: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-medium focus:outline-none focus:border-emerald-400 text-xs cursor-pointer"
                    >
                      <option value="I">Unidad I</option>
                      <option value="II">Unidad II</option>
                      <option value="III">Unidad III</option>
                    </select>
                  </div>
                </div>

                {/* 4. Horarios, Asistencia y Tipo de Sesión */}
                <div className="space-y-2">
                  {/* Horario Oficial Reconocido del Semestre */}
                  {horariosDisponiblesCurso.length > 0 && (
                    <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-[11px] font-bold text-emerald-300">
                          Horario oficial reconocido del semestre:
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {horariosDisponiblesCurso.map((b, idx) => {
                          const esActivo = manualForm.horaInicio === b.horaInicio && manualForm.horaFin === b.horaFin
                          const esMismoDia = normalizarDia(getDiaSemanaFromDate(manualForm.fecha)) === normalizarDia(b.dia)
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                let aulaAplicar = manualForm.aula
                                if (b.aula) {
                                  const rawAula = b.aula.trim().toUpperCase()
                                  const matched = AULAS_OPTIONS.find((a) => a.toUpperCase().includes(rawAula))
                                  aulaAplicar = matched || b.aula
                                }
                                setManualForm((prev) => ({
                                  ...prev,
                                  horaInicio: b.horaInicio,
                                  horaFin: b.horaFin,
                                  aula: aulaAplicar
                                }))
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                esActivo
                                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-950/40 font-bold ring-1 ring-emerald-300'
                                  : 'bg-white/10 hover:bg-white/20 text-white/85'
                              }`}
                              title={`Click para aplicar: ${b.dia} de ${b.horaInicio} a ${b.horaFin} (${b.aula})`}
                            >
                              <span>{b.dia} {b.horaInicio} - {b.horaFin}</span>
                              {b.aula && <span className="opacity-75 text-[10px]">({b.aula})</span>}
                              {esMismoDia && (
                                <span className="text-[9px] bg-black/40 px-1.5 py-0.5 rounded text-emerald-200 border border-emerald-400/40 font-bold">
                                  Día de la fecha
                                </span>
                              )}
                              {esActivo && <Check className="w-3 h-3 text-white shrink-0 ml-0.5" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-white/80 mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-400" />
                        <span>Hora Inicio</span>
                        <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="time"
                        value={manualForm.horaInicio}
                        onChange={(e) => setManualForm({ ...manualForm, horaInicio: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-mono font-medium focus:outline-none focus:border-emerald-400 text-xs cursor-pointer"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-white/80 mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-400" />
                        <span>Hora Fin</span>
                        <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="time"
                        value={manualForm.horaFin}
                        onChange={(e) => setManualForm({ ...manualForm, horaFin: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-mono font-medium focus:outline-none focus:border-emerald-400 text-xs cursor-pointer"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-white/80 mb-1 flex items-center gap-1">
                        <Users className="w-3 h-3 text-emerald-400" />
                        <span>N° Estudiantes</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={manualForm.numEstudiantes}
                        onChange={(e) => setManualForm({ ...manualForm, numEstudiantes: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-mono font-medium focus:outline-none focus:border-emerald-400 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-white/80 mb-1">Tipo de Sesión</label>
                      <select
                        value={manualForm.tipoSesion}
                        onChange={(e) => setManualForm({ ...manualForm, tipoSesion: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-medium focus:outline-none focus:border-emerald-400 text-xs cursor-pointer"
                      >
                        <option value="Clase Regular">Clase Regular</option>
                        <option value="Recuperación">Recuperación</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 5. Tema Programado en Sílabo */}
                <div>
                  <label className="block text-[11px] font-bold text-white/80 mb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tema Programado en el Sílabo (Dictado en la clase física)</span>
                    <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={manualForm.tema}
                    onChange={(e) => setManualForm({ ...manualForm, tema: e.target.value })}
                    placeholder="Descripción del tema dictado según la ficha física..."
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-medium focus:outline-none focus:border-emerald-400 text-xs"
                    required
                  />
                </div>

                {/* 6. Recursos Utilizados */}
                <div>
                  <label className="block text-[11px] font-bold text-white/80 mb-1.5">
                    Recursos Utilizados
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {RECURSOS_CHIPS.map((chip) => {
                      const isSelected = Array.isArray(manualForm.recursos) && manualForm.recursos.includes(chip)
                      return (
                        <button
                          type="button"
                          key={chip}
                          onClick={() => handleToggleRecursoManual(chip)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 ring-1 ring-emerald-500/30'
                              : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {chip}
                        </button>
                      )
                    })}
                  </div>
                  <input
                    type="text"
                    value={manualForm.recursosLibre}
                    onChange={(e) => setManualForm({ ...manualForm, recursosLibre: e.target.value })}
                    placeholder="Otros recursos adicionales (ej. Separatas, Calculadora TI-89, Maquetas)..."
                    className="w-full px-3 py-1.5 rounded-xl bg-black/50 border border-white/20 text-white font-medium focus:outline-none focus:border-emerald-400 text-xs"
                  />
                </div>

                {/* 7. Validación y Observaciones */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-white/80 mb-1 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Validación (Directora)</span>
                    </label>
                    <select
                      value={manualForm.validacion}
                      onChange={(e) => setManualForm({ ...manualForm, validacion: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-emerald-500/30 text-emerald-300 font-bold focus:outline-none focus:border-emerald-400 text-xs cursor-pointer"
                    >
                      <option value="VÁLIDO">VÁLIDO (Firma física confirmada)</option>
                      <option value="PENDIENTE">PENDIENTE (Por verificar)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-white/80 mb-1">
                      Observaciones
                    </label>
                    <input
                      type="text"
                      value={manualForm.observaciones}
                      onChange={(e) => setManualForm({ ...manualForm, observaciones: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-medium focus:outline-none focus:border-emerald-400 text-xs"
                      placeholder="Notas adicionales de la ficha física..."
                    />
                  </div>
                </div>

                {/* Botones de Acción */}
                <div className="pt-3 border-t border-white/10 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowManualModal(false)}
                    disabled={savingManual}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingManual}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/60 cursor-pointer disabled:opacity-50 transition-all ring-1 ring-emerald-400/40"
                  >
                    {savingManual ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Guardando en Sheets...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Guardar Sesión en Base de Datos</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default HistorialGlobalView
