import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  Clock,
  MapPin,
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  DoorOpen,
  Send,
  BookmarkCheck,
  Repeat,
  Sparkles,
  Info,
  CalendarCheck,
  Trash2,
  Check,
  XCircle,
  HelpCircle,
  MessageSquare,
  ChevronRight,
  Plus,
  Minus
} from 'lucide-react'
import {
  AULAS_LABORATORIOS_MASTER,
  verificarDisponibilidadAmbiente,
  crearReserva,
  obtenerReservas,
  eliminarReserva,
  getLocalReservas,
  formatHora,
  getDiaSemanaFromDate,
  getDateForDayOfWeek,
  normalizarReserva,
  normalizarDia,
  horaToMinutos,
  coincidenAulas,
  solapanHoras
} from '../services/reservasService'
import { obtenerHorarios } from '../services/adminApi'
import HORARIOS_DEFAULT from '../data/horarios_procesados.json'
import { calcularSemanaYUnidad, SEMESTRE_CONFIG } from '../utils/academicCalendar'

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// Franja horaria de 30 minutos (07:00 a 21:30)
const FRANJAS_HORARIAS = []
for (let h = 7; h <= 21; h++) {
  FRANJAS_HORARIAS.push(`${String(h).padStart(2, '0')}:00`)
  FRANJAS_HORARIAS.push(`${String(h).padStart(2, '0')}:30`)
}

function minutosToHora(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function DocenteReservaModal({
  isOpen,
  onClose,
  docente,
  isDarkMode = true,
  onReservaCreada = () => {}
}) {
  const [activeTab, setActiveTab] = useState('nueva') // 'nueva' | 'mis_reservas'

  // Función para filtrar reservas de este docente
  const filtrarReservasDocente = useCallback((lista) => {
    if (!Array.isArray(lista)) return []
    const dniDocente = String(docente?.dni || docente?.DNI || docente?.codigo || '').trim()
    return lista.filter(r => {
      const rDni = String(r.dni || r.docenteDni || '').trim()
      const rDocente = String(r.docente || r.docenteNombre || '').trim().toLowerCase()
      const dNombre = String(docente?.nombre || docente?.DOCENTE || '').trim().toLowerCase()

      if (dniDocente && rDni && (rDni === dniDocente || rDni.replace(/^0+/, '') === dniDocente.replace(/^0+/, ''))) {
        return true
      }
      if (dNombre && rDocente && (rDocente.includes(dNombre.slice(0, 8)) || dNombre.includes(rDocente.slice(0, 8)))) {
        return true
      }
      return false
    })
  }, [docente])

  // Carga instantánea desde almacenamiento local (0 milisegundos de espera)
  const [todasReservas, setTodasReservas] = useState(() => getLocalReservas())
  const [reservasDocente, setReservasDocente] = useState(() => filtrarReservasDocente(getLocalReservas()))
  const [horariosList, setHorariosList] = useState(HORARIOS_DEFAULT || [])
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Ambiente actualmente visualizado en la grilla
  const [selectedAula, setSelectedAula] = useState(AULAS_LABORATORIOS_MASTER[0])

  // Bloque(s) seleccionado(s) en la grilla por el docente
  const [selectedRange, setSelectedRange] = useState(null) // { dia, horaInicio, horaFin }

  // Fechas y calendario
  const hoyStr = useMemo(() => new Date().toLocaleDateString('en-CA'), [])
  const semanaActual = useMemo(() => calcularSemanaYUnidad(hoyStr)?.semana || 1, [hoyStr])

  // Formulario de reserva
  const [form, setForm] = useState({
    asignatura: '',
    tipoReserva: 'UNICA', // 'UNICA' | 'RECURRENTE'
    fecha: hoyStr,
    fechaInicio: hoyStr,
    fechaFin: SEMESTRE_CONFIG.fechaFin || '2026-12-18',
    diaSemana: 'Lunes',
    horaInicio: '08:00',
    horaFin: '10:30',
    motivo: ''
  })

  // Inicializar asignatura del docente
  useEffect(() => {
    if (docente?.cursos && Array.isArray(docente.cursos) && docente.cursos.length > 0) {
      setForm(prev => ({ ...prev, asignatura: docente.cursos[0] }))
    }
  }, [docente])

  // Cargar reservas con refresco instantáneo y sincronización en segundo plano
  const cargarDatos = useCallback(async () => {
    // 1. Mostrar de inmediato la base local sin esperar nada
    const locales = getLocalReservas()
    setTodasReservas(locales)
    setReservasDocente(filtrarReservasDocente(locales))

    // 2. Sincronizar en segundo plano con Google Apps Script
    try {
      obtenerReservas().then(resR => {
        if (resR?.success && Array.isArray(resR.data)) {
          setTodasReservas(resR.data)
          setReservasDocente(filtrarReservasDocente(resR.data))
        }
      }).catch(err => console.warn('Sync diferido de reservas:', err))
    } catch (e) {
      console.warn('Error sincronizando reservas:', e)
    }
  }, [filtrarReservasDocente])

  useEffect(() => {
    if (isOpen) {
      cargarDatos()
      setSuccessMsg('')
      setErrorMsg('')
    }
  }, [isOpen, cargarDatos])

  // Escuchar actualización externa de reservas
  useEffect(() => {
    const handleUpdate = () => cargarDatos()
    window.addEventListener('epic_reservas_updated', handleUpdate)
    return () => window.removeEventListener('epic_reservas_updated', handleUpdate)
  }, [cargarDatos])

  // ══════════════════════════════════════════════════════════
  // GRILLA SEMANAL DEL AMBIENTE SELECCIONADO
  // ══════════════════════════════════════════════════════════
  const gridData = useMemo(() => {
    // 1. Clases regulares del semestre para este aula (con fallback inmediato)
    const fuenteHorarios = (horariosList && horariosList.length > 0) ? horariosList : (HORARIOS_DEFAULT || [])
    const clasesAula = fuenteHorarios.filter(h => coincidenAulas(h.AULA || h.aula, selectedAula))

    // 2. Reservas vigentes (no rechazadas) para este aula
    const reservasAula = todasReservas
      .map(normalizarReserva)
      .filter(r => r.estado !== 'RECHAZADA' && coincidenAulas(r.aula, selectedAula))

    const porDia = {}
    DIAS_SEMANA.forEach(d => {
      porDia[d] = []
    })

    const mapDias = {
      'lunes': 'Lunes',
      'martes': 'Martes',
      'miercoles': 'Miércoles',
      'jueves': 'Jueves',
      'viernes': 'Viernes',
      'sabado': 'Sábado',
      'domingo': 'Domingo'
    }
    const getDiaCanonico = (d) => {
      if (!d) return ''
      const norm = normalizarDia(d)
      return mapDias[norm] || d
    }

    // Clases oficiales
    clasesAula.forEach(c => {
      const dia = getDiaCanonico(c.DIA || c.dia || '')
      const hIni = String(c.HORA_INICIO || c.hora_inicio || c.horaInicio || '').trim().slice(0, 5)
      const hFin = String(c.HORA_FIN || c.hora_fin || c.horaFin || '').trim().slice(0, 5)

      if (porDia[dia] && hIni && hFin) {
        porDia[dia].push({
          tipoItem: 'CLASE_REGULAR',
          id: `clase_${c.CODIGO || c.codigo || 'c'}_${dia}_${hIni}`,
          codigo: c.CODIGO || c.codigo || '',
          curso: c.CURSO || c.curso || 'Clase Semestre',
          docente: c.DOCENTE || c.docente || '',
          seccion: c.SECCION || c.seccion || 'A',
          ciclo: c.CICLO || c.ciclo || '1',
          horaInicio: hIni,
          horaFin: hFin
        })
      }
    })

    // Reservas existentes (Aprobadas y Pendientes)
    reservasAula.forEach(r => {
      const dia = getDiaCanonico(r.diaSemana || getDiaSemanaFromDate(r.fecha) || 'Lunes')
      const hIni = formatHora(r.horaInicio)
      const hFin = formatHora(r.horaFin)

      if (porDia[dia] && hIni && hFin) {
        porDia[dia].push({
          tipoItem: 'RESERVA',
          id: r.id,
          codigo: r.estado === 'APROBADA' ? 'RES-CONF' : 'RES-PEND',
          curso: `📌 [${r.estado === 'APROBADA' ? 'APROBADA' : 'PENDIENTE'}] ${r.asignatura || 'Separación'}`,
          docente: r.docente || r.docenteNombre || 'Docente',
          estado: r.estado,
          motivo: r.motivo,
          fecha: r.fecha,
          horaInicio: hIni,
          horaFin: hFin
        })
      }
    })

    return { porDia, totalClases: clasesAula.length, totalReservas: reservasAula.length }
  }, [horariosList, todasReservas, selectedAula])

  // Obtener items ocupados para un día
  const getItemsOcupadosDia = useCallback((dia) => {
    return gridData.porDia[dia] || []
  }, [gridData])

  // ══════════════════════════════════════════════════════════
  // SELECCIÓN Y EXTENSIÓN DE MÚLTIPLES BLOQUES LIBRES
  // ══════════════════════════════════════════════════════════
  const handleSlotClick = (dia, slotHora) => {
    const slotMin = horaToMinutos(slotHora)
    const itemsDia = getItemsOcupadosDia(dia)
    const fechaCalculada = getDateForDayOfWeek(dia)

    // Si no hay selección activa, o si se hace clic en otro día:
    if (!selectedRange || selectedRange.dia !== dia) {
      // Proponer por defecto hasta 2.5 horas (o hasta antes de la próxima clase)
      let maxFinMin = slotMin + 150 // 2h 30m
      const ocupadasDespues = itemsDia.filter(item => horaToMinutos(item.horaInicio) > slotMin)

      if (ocupadasDespues.length > 0) {
        const proxClaseMin = Math.min(...ocupadasDespues.map(o => horaToMinutos(o.horaInicio)))
        if (proxClaseMin < maxFinMin) {
          maxFinMin = proxClaseMin
        }
      }

      if (maxFinMin > 22 * 60) maxFinMin = 22 * 60

      const horaFinStr = minutosToHora(maxFinMin)
      setSelectedRange({ dia, horaInicio: slotHora, horaFin: horaFinStr })
      setForm(prev => ({
        ...prev,
        aula: selectedAula,
        diaSemana: dia,
        fecha: fechaCalculada,
        fechaInicio: fechaCalculada,
        horaInicio: slotHora,
        horaFin: horaFinStr
      }))
      setErrorMsg('')
      return
    }

    // Si ya hay un bloque seleccionado en el MISMO día:
    const currIni = horaToMinutos(selectedRange.horaInicio)
    const currFin = horaToMinutos(selectedRange.horaFin)

    if (slotMin >= currIni) {
      // Extender hacia adelante hasta cubrir este bloque (+30 min)
      const newFinMin = slotMin + 30
      const newFinStr = minutosToHora(newFinMin)

      // Verificar que ningún bloque entre currIni y newFinMin esté ocupado
      const hayCruce = itemsDia.some(item =>
        solapanHoras(selectedRange.horaInicio, newFinStr, item.horaInicio, item.horaFin)
      )

      if (hayCruce) {
        // En vez de bloquear, iniciar nueva selección en este bloque libre
        let maxFinMin = slotMin + 150
        const ocupadasDespues = itemsDia.filter(item => horaToMinutos(item.horaInicio) > slotMin)
        if (ocupadasDespues.length > 0) {
          const proxClaseMin = Math.min(...ocupadasDespues.map(o => horaToMinutos(o.horaInicio)))
          if (proxClaseMin < maxFinMin) maxFinMin = proxClaseMin
        }
        if (maxFinMin > 22 * 60) maxFinMin = 22 * 60
        const horaFinStr = minutosToHora(maxFinMin)
        setSelectedRange({ dia, horaInicio: slotHora, horaFin: horaFinStr })
        setForm(prev => ({
          ...prev,
          aula: selectedAula,
          diaSemana: dia,
          horaInicio: slotHora,
          horaFin: horaFinStr
        }))
        setErrorMsg('')
        return
      }

      setSelectedRange(prev => ({ ...prev, horaFin: newFinStr }))
      setForm(prev => ({ ...prev, horaFin: newFinStr }))
      setErrorMsg('')
    } else {
      // Extender hacia atrás (comenzar antes)
      const newIniStr = slotHora
      const hayCruce = itemsDia.some(item =>
        solapanHoras(newIniStr, selectedRange.horaFin, item.horaInicio, item.horaFin)
      )

      if (hayCruce) {
        // En vez de bloquear, iniciar nueva selección en este bloque libre
        let maxFinMin = slotMin + 150
        const ocupadasDespues = itemsDia.filter(item => horaToMinutos(item.horaInicio) > slotMin)
        if (ocupadasDespues.length > 0) {
          const proxClaseMin = Math.min(...ocupadasDespues.map(o => horaToMinutos(o.horaInicio)))
          if (proxClaseMin < maxFinMin) maxFinMin = proxClaseMin
        }
        if (maxFinMin > 22 * 60) maxFinMin = 22 * 60
        const horaFinStr = minutosToHora(maxFinMin)
        setSelectedRange({ dia, horaInicio: slotHora, horaFin: horaFinStr })
        setForm(prev => ({
          ...prev,
          aula: selectedAula,
          diaSemana: dia,
          horaInicio: slotHora,
          horaFin: horaFinStr
        }))
        setErrorMsg('')
        return
      }

      setSelectedRange(prev => ({ ...prev, horaInicio: newIniStr }))
      setForm(prev => ({ ...prev, horaInicio: newIniStr }))
      setErrorMsg('')
    }
  }

  // Ajustar duración con botones rápidos (+30m, -30m, presets)
  const ajustarDuracionMinutos = (deltaMin) => {
    if (!selectedRange) return
    const iniMin = horaToMinutos(selectedRange.horaInicio)
    const finMin = horaToMinutos(selectedRange.horaFin)
    const nuevoFinMin = finMin + deltaMin

    if (nuevoFinMin <= iniMin) return // Mínimo 30 min
    if (nuevoFinMin > 22 * 60) return

    const nuevoFinStr = minutosToHora(nuevoFinMin)
    const itemsDia = getItemsOcupadosDia(selectedRange.dia)

    const hayCruce = itemsDia.some(item =>
      solapanHoras(selectedRange.horaInicio, nuevoFinStr, item.horaInicio, item.horaFin)
    )

    if (hayCruce) {
      setErrorMsg('No se puede extender más: choca con una clase ocupada.')
      return
    }

    setSelectedRange(prev => ({ ...prev, horaFin: nuevoFinStr }))
    setForm(prev => ({ ...prev, horaFin: nuevoFinStr }))
    setErrorMsg('')
  }

  const setDuracionPreset = (horas) => {
    if (!selectedRange) return
    const iniMin = horaToMinutos(selectedRange.horaInicio)
    const nuevoFinMin = iniMin + Math.round(horas * 60)

    if (nuevoFinMin > 22 * 60) return

    const nuevoFinStr = minutosToHora(nuevoFinMin)
    const itemsDia = getItemsOcupadosDia(selectedRange.dia)

    const hayCruce = itemsDia.some(item =>
      solapanHoras(selectedRange.horaInicio, nuevoFinStr, item.horaInicio, item.horaFin)
    )

    if (hayCruce) {
      setErrorMsg(`No hay suficiente espacio continuo para ${horas} horas en este horario.`)
      return
    }

    setSelectedRange(prev => ({ ...prev, horaFin: nuevoFinStr }))
    setForm(prev => ({ ...prev, horaFin: nuevoFinStr }))
    setErrorMsg('')
  }

  // Verificar disponibilidad reactiva final
  const disponibilidad = useMemo(() => {
    if (!selectedRange) return { disponible: false, conflicto: null }
    return verificarDisponibilidadAmbiente({
      aula: selectedAula,
      fecha: form.fecha,
      diaSemana: selectedRange.dia,
      horaInicio: selectedRange.horaInicio,
      horaFin: selectedRange.horaFin,
      tipoReserva: form.tipoReserva,
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      horariosSemestre: horariosList,
      reservasExistentes: todasReservas
    })
  }, [selectedRange, selectedAula, form, horariosList, todasReservas])

  // Enviar solicitud de reserva
  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!selectedRange) {
      setErrorMsg('Por favor selecciona primero un bloque o franja libre en el cronograma.')
      return
    }

    if (!form.motivo.trim()) {
      setErrorMsg('El motivo de la reserva o tema a tratar es obligatorio.')
      return
    }

    if (!disponibilidad.disponible) {
      setErrorMsg(disponibilidad.conflicto?.detalle || 'Conflicto detectado: el ambiente no se encuentra disponible en este horario.')
      return
    }

    setLoading(true)
    try {
      const duracionHrs = (horaToMinutos(selectedRange.horaFin) - horaToMinutos(selectedRange.horaInicio)) / 60
      const semIni = form.tipoReserva === 'RECURRENTE'
        ? (calcularSemanaYUnidad(form.fechaInicio)?.semana || 1)
        : (calcularSemanaYUnidad(form.fecha)?.semana || 1)
      const semFin = form.tipoReserva === 'RECURRENTE'
        ? (calcularSemanaYUnidad(form.fechaFin)?.semana || 18)
        : semIni

      const payload = {
        dni: String(docente?.dni || docente?.DNI || docente?.codigo || '').trim(),
        docente: String(docente?.nombre || docente?.DOCENTE || 'Docente').trim(),
        aula: selectedAula,
        asignatura: form.asignatura || 'Clase / Actividad Académica',
        motivo: form.motivo.trim(),
        tipoReserva: form.tipoReserva,
        fecha: form.fecha,
        fechaInicio: form.tipoReserva === 'RECURRENTE' ? form.fechaInicio : form.fecha,
        fechaFin: form.tipoReserva === 'RECURRENTE' ? form.fechaFin : form.fecha,
        diaSemana: selectedRange.dia,
        semanaInicio: Number(semIni),
        semanaFin: Number(semFin),
        horaInicio: selectedRange.horaInicio,
        horaFin: selectedRange.horaFin,
        duracionHrs: parseFloat(duracionHrs.toFixed(2)),
        estado: 'PENDIENTE',
        creadoPor: 'DOCENTE'
      }

      const res = await crearReserva(payload)
      if (res.success) {
        setSuccessMsg('¡Solicitud de reserva enviada a la Directora exitosamente!')
        setSelectedRange(null)
        setForm(prev => ({ ...prev, motivo: '' }))
        await cargarDatos()
        onReservaCreada()
        setTimeout(() => {
          setActiveTab('mis_reservas')
          setSuccessMsg('')
        }, 1200)
      } else {
        setErrorMsg(res.message || 'No se pudo registrar la reserva.')
      }
    } catch (err) {
      console.error('Error al enviar reserva:', err)
      setErrorMsg('Ocurrió un error al enviar la reserva.')
    } finally {
      setLoading(false)
    }
  }

  // Cancelar reserva propia
  const handleCancelarReserva = async (id) => {
    if (!window.confirm('¿Estás seguro de cancelar esta solicitud de reserva?')) return
    await eliminarReserva(id)
    cargarDatos()
  }

  const ROW_HEIGHT = 42
  const diaHoy = DIAS_SEMANA[new Date().getDay() === 0 ? 5 : new Date().getDay() - 1] || 'Lunes'

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative z-10 w-full max-w-5xl rounded-3xl bg-[#090f1d] border border-emerald-500/40 p-4 sm:p-6 shadow-2xl text-white space-y-4 max-h-[94vh] overflow-y-auto custom-scrollbar"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 border border-emerald-400/30 shrink-0">
                <DoorOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                    Reserva de Salón o Laboratorio
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Panel Docente
                  </span>
                </div>
                <p className="text-xs text-white/50 font-medium">
                  Selecciona directamente los bloques libres en el cronograma semanal del ambiente
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Sub-tabs: Grilla Interactiva vs Mis Solicitudes */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('nueva')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'nueva'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Horario Semanal & Reservar</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('mis_reservas')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
                  activeTab === 'mis_reservas'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <BookmarkCheck className="w-3.5 h-3.5" />
                <span>Mis Solicitudes ({reservasDocente.length})</span>
                {reservasDocente.some(r => r.estado === 'APROBADA') && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
            </div>

            {/* Selector Rápido de Ambiente */}
            {activeTab === 'nueva' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60 font-bold hidden sm:inline">Ambiente:</span>
                <select
                  value={selectedAula}
                  onChange={e => {
                    setSelectedAula(e.target.value)
                    setSelectedRange(null)
                    setErrorMsg('')
                  }}
                  className="px-3 py-1.5 rounded-xl bg-black/60 border border-emerald-500/40 text-emerald-200 font-bold text-xs cursor-pointer focus:outline-none focus:border-emerald-300"
                >
                  <optgroup label="🔬 Laboratorios Especializados (Civil)">
                    {AULAS_LABORATORIOS_MASTER.filter(a => !a.startsWith('BLOQUE')).map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </optgroup>
                  <optgroup label="🏛️ Aulas Teóricas">
                    {AULAS_LABORATORIOS_MASTER.filter(a => a.startsWith('BLOQUE')).map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}
          </div>

          {/* Alertas */}
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: GRILLA SEMANAL VISUAL INTERACTIVA (PROPUESTA 1 CON SELECCIÓN MÚLTIPLE) */}
          {activeTab === 'nueva' && (
            <div className="space-y-3 text-xs">
              {/* Barra informativa y leyenda */}
              <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-white font-medium">
                    Horario de: <strong className="text-emerald-300 font-black">{selectedAula}</strong>
                  </span>
                  <span className="text-white/40">•</span>
                  <span className="text-white/60 text-[11px]">
                    {selectedRange ? (
                      <span className="text-emerald-300 font-bold">
                        Seleccionado: {selectedRange.dia} de {selectedRange.horaInicio} a {selectedRange.horaFin}
                      </span>
                    ) : (
                      '💡 Haz clic en los bloques verdes "+ LIBRE" para seleccionar las horas que necesites'
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[10px] shrink-0">
                  <span className="flex items-center gap-1 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-sm bg-blue-600/40 border border-blue-400/50" />
                    Ocupado (Clase)
                  </span>
                  <span className="flex items-center gap-1 text-amber-300">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/40 border border-amber-400" />
                    Reserva
                  </span>
                  <span className="flex items-center gap-1 text-emerald-300">
                    <span className="w-2.5 h-2.5 rounded-sm border border-dashed border-emerald-400 bg-emerald-500/20" />
                    Espacio Libre
                  </span>
                </div>
              </div>

              {/* CONTENEDOR DE LA GRILLA SEMANAL */}
              <div className="rounded-3xl border border-white/10 overflow-hidden bg-white/[0.02]">
                <div className="overflow-x-auto max-h-[46vh] custom-scrollbar">
                  <div className="min-w-[850px]">
                    {/* Header Días */}
                    <div className="grid grid-cols-[70px_repeat(6,1fr)] border-b border-white/10 bg-white/[0.04] sticky top-0 z-20 backdrop-blur-md">
                      <div className="p-2.5 flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5 text-white/40" />
                      </div>
                      {DIAS_SEMANA.map(dia => (
                        <div
                          key={dia}
                          className={`p-2.5 text-center border-l border-white/5 transition-colors ${
                            selectedRange?.dia === dia
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : dia === diaHoy
                                ? 'bg-white/5 text-white'
                                : 'text-white/60'
                          }`}
                        >
                          <p className="text-[11px] font-black uppercase tracking-wider">
                            {dia}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Franjas Horarias */}
                    <div className="relative">
                      {FRANJAS_HORARIAS.map((franja, fIdx) => {
                        const franjaMin = horaToMinutos(franja)

                        return (
                          <div
                            key={franja}
                            className={`grid grid-cols-[70px_repeat(6,1fr)] ${
                              fIdx % 2 === 0 ? 'border-t border-white/5' : ''
                            }`}
                            style={{ height: `${ROW_HEIGHT}px` }}
                          >
                            {/* Columna Hora */}
                            <div className="flex items-center justify-end pr-2.5 border-r border-white/5">
                              {franja.endsWith(':00') && (
                                <span className="text-[10px] font-mono font-bold text-white/40">
                                  {franja}
                                </span>
                              )}
                            </div>

                            {/* Columnas Días */}
                            {DIAS_SEMANA.map(dia => {
                              const itemsDia = getItemsOcupadosDia(dia)

                              // 1. Items que inician en este intervalo de 30 min [franjaMin, franjaMin + 30)
                              const itemsQueInicianAqui = itemsDia.filter(item => {
                                const ini = horaToMinutos(item.horaInicio)
                                return ini >= franjaMin && ini < franjaMin + 30
                              })

                              // 2. ¿Esta celda de 30 min se cruza con alguna clase o reserva?
                              const celdaOcupada = itemsDia.some(item => {
                                const ini = horaToMinutos(item.horaInicio)
                                const fin = horaToMinutos(item.horaFin)
                                return Math.max(franjaMin, ini) < Math.min(franjaMin + 30, fin)
                              })

                              // 3. ¿Esta franja es parte de la selección activa del docente?
                              const selIni = selectedRange && selectedRange.dia === dia ? horaToMinutos(selectedRange.horaInicio) : null
                              const selFin = selectedRange && selectedRange.dia === dia ? horaToMinutos(selectedRange.horaFin) : null
                              const isSelectedInSlot =
                                selIni !== null && selFin !== null &&
                                Math.max(franjaMin, selIni) < Math.min(franjaMin + 30, selFin)

                              const esInicioSeleccion =
                                selIni !== null && selFin !== null &&
                                selIni >= franjaMin && selIni < franjaMin + 30

                              return (
                                <div
                                  key={dia}
                                  className={`relative border-l border-white/5 transition-all ${
                                    selectedRange?.dia === dia ? 'bg-emerald-500/[0.03]' : ''
                                  }`}
                                  style={{ height: `${ROW_HEIGHT}px` }}
                                >
                                  {/* 1. Clases Regulares o Reservas que inician en este horario */}
                                  {itemsQueInicianAqui.map(item => {
                                    const iniMin = horaToMinutos(item.horaInicio)
                                    const finMin = horaToMinutos(item.horaFin)
                                    const duracion = finMin - iniMin
                                    const offsetTop = ((iniMin - franjaMin) / 30) * ROW_HEIGHT
                                    const height = Math.max((duracion / 30) * ROW_HEIGHT - 2, 28)

                                    const isClase = item.tipoItem === 'CLASE_REGULAR'
                                    const isAprobada = item.estado === 'APROBADA'

                                    return (
                                      <div
                                        key={item.id}
                                        className={`absolute inset-x-0.5 z-10 rounded-xl p-1.5 flex flex-col justify-between overflow-hidden shadow-md border ${
                                          isClase
                                            ? 'bg-blue-950/90 border-blue-500/50 text-blue-200'
                                            : isAprobada
                                              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                                              : 'bg-amber-950/90 border-amber-500/50 text-amber-200'
                                        }`}
                                        style={{
                                          top: `${offsetTop + 1}px`,
                                          height: `${height}px`
                                        }}
                                        title={`${item.curso}\nDocente: ${item.docente}\nHorario: ${item.horaInicio} - ${item.horaFin}`}
                                      >
                                        <div className="flex items-center justify-between text-[9px] font-mono font-bold opacity-80">
                                          <span>{item.horaInicio} - {item.horaFin}</span>
                                          <span className="px-1 py-0.2 rounded bg-black/40 text-[8px] uppercase">
                                            {isClase ? 'CLASE' : item.estado || 'RESERVA'}
                                          </span>
                                        </div>
                                        <p className="font-bold text-[10px] leading-tight line-clamp-2 mt-0.5">
                                          {item.curso}
                                        </p>
                                        <p className="text-[9px] opacity-60 truncate">
                                          {item.docente}
                                        </p>
                                      </div>
                                    )
                                  })}

                                  {/* 2. Celda Libre Seleccionada (Tu selección activa con multi-bloque) */}
                                  {esInicioSeleccion && (
                                    <div
                                      onClick={() => handleSlotClick(dia, franja)}
                                      className="absolute inset-x-0.5 z-20 rounded-xl p-2 flex flex-col justify-between overflow-hidden shadow-xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-600/95 to-teal-700/95 text-white cursor-pointer ring-2 ring-emerald-400/50 animate-pulse"
                                      style={{
                                        top: `${((selIni - franjaMin) / 30) * ROW_HEIGHT + 1}px`,
                                        height: `${((selFin - selIni) / 30) * ROW_HEIGHT - 2}px`
                                      }}
                                    >
                                      <div className="flex items-center justify-between text-[10px] font-black tracking-wide">
                                        <span>✨ TU SELECCIÓN</span>
                                        <span className="px-1.5 py-0.2 rounded bg-black/40 font-mono text-[9px]">
                                          {selectedRange.horaInicio} - {selectedRange.horaFin}
                                        </span>
                                      </div>
                                      <div className="mt-auto">
                                        <p className="text-[11px] font-black leading-tight line-clamp-1">
                                          {form.asignatura || 'Clase / Práctica'}
                                        </p>
                                        <p className="text-[9px] text-emerald-200 mt-0.5">
                                          {((selFin - selIni) / 60).toFixed(1)} hrs • Clic en otro bloque para ajustar
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {/* 3. Celda Libre No Seleccionada (Botón interactivo de espacio disponible) */}
                                  {!celdaOcupada && !isSelectedInSlot && (
                                    <button
                                      type="button"
                                      onClick={() => handleSlotClick(dia, franja)}
                                      className="w-full h-full p-1 rounded-lg border border-dashed border-emerald-500/25 hover:border-emerald-400 hover:bg-emerald-500/20 text-emerald-400/60 hover:text-emerald-300 text-[10px] font-bold transition-all flex items-center justify-center cursor-pointer group"
                                      title={`Clic para seleccionar desde las ${franja} el ${dia}`}
                                    >
                                      <span className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                                        <Plus className="w-3 h-3" />
                                        <span>{franja}</span>
                                      </span>
                                      <span className="group-hover:hidden text-[9px] opacity-40">+ Libre</span>
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* PANEL INFERIOR / CONFIRMACIÓN DE LA RESERVA SELECCIONADA */}
              {selectedRange ? (
                <motion.form
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleSubmit}
                  className="p-4 rounded-3xl bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 border-2 border-emerald-400/80 shadow-2xl space-y-3"
                >
                  {/* Resumen del bloque y controles de extensión de tiempo */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center font-black">
                        ✓
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-black text-sm">{selectedAula}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950">
                            {selectedRange.dia} {selectedRange.horaInicio} – {selectedRange.horaFin}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRange(null)
                              setErrorMsg('')
                            }}
                            className="text-[10px] text-white/50 hover:text-red-300 underline cursor-pointer"
                            title="Desmarcar selección actual"
                          >
                            Desmarcar
                          </button>
                        </div>
                        <p className="text-[11px] text-emerald-300/80 mt-0.5">
                          Duración seleccionada: <strong>{((horaToMinutos(selectedRange.horaFin) - horaToMinutos(selectedRange.horaInicio)) / 60).toFixed(1)} horas académicas</strong>
                        </p>
                      </div>
                    </div>

                    {/* Botones de ajuste de bloques contiguos */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-white/50 font-bold mr-1">Ajustar bloques:</span>
                      <button
                        type="button"
                        onClick={() => ajustarDuracionMinutos(-30)}
                        className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                        title="Reducir 30 minutos"
                      >
                        <Minus className="w-3 h-3" /> 30m
                      </button>
                      <button
                        type="button"
                        onClick={() => ajustarDuracionMinutos(30)}
                        className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                        title="Aumentar 30 minutos (si está libre)"
                      >
                        <Plus className="w-3 h-3" /> 30m
                      </button>
                      <button
                        type="button"
                        onClick={() => setDuracionPreset(2)}
                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 font-bold text-xs cursor-pointer"
                      >
                        2h
                      </button>
                      <button
                        type="button"
                        onClick={() => setDuracionPreset(2.5)}
                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 font-bold text-xs cursor-pointer"
                      >
                        2.5h
                      </button>
                      <button
                        type="button"
                        onClick={() => setDuracionPreset(3)}
                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 font-bold text-xs cursor-pointer"
                      >
                        3h
                      </button>
                    </div>
                  </div>

                  {/* Campos de Modalidad, Asignatura y Fechas */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Modalidad de Reserva */}
                    <div>
                      <label className="block text-[11px] font-bold text-white/80 mb-1">
                        Modalidad de Separación:
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, tipoReserva: 'UNICA' }))}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            form.tipoReserva === 'UNICA'
                              ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                              : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                          }`}
                        >
                          Única Vez
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, tipoReserva: 'RECURRENTE' }))}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            form.tipoReserva === 'RECURRENTE'
                              ? 'bg-teal-500/30 border-teal-400 text-teal-200'
                              : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                          }`}
                        >
                          Recurrente
                        </button>
                      </div>
                    </div>

                    {/* Fecha(s) con calendario interactivo */}
                    {form.tipoReserva === 'UNICA' ? (
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-white/80 mb-1 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Fecha Específica para este {selectedRange.dia}</span>
                          <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="date"
                          min={hoyStr}
                          value={form.fecha}
                          onChange={e => setForm(prev => ({ ...prev, fecha: e.target.value }))}
                          className="w-full px-3 py-1.5 rounded-xl bg-black/60 border border-white/20 text-white font-mono text-xs focus:outline-none focus:border-emerald-400 cursor-pointer"
                          required
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[11px] font-bold text-white/80 mb-1 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Desde (Fecha)</span>
                            <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="date"
                            value={form.fechaInicio || hoyStr}
                            onChange={e => setForm(prev => ({
                              ...prev,
                              fechaInicio: e.target.value,
                              fechaFin: prev.fechaFin < e.target.value ? e.target.value : prev.fechaFin
                            }))}
                            className="w-full px-3 py-1.5 rounded-xl bg-black/60 border border-white/20 text-white font-mono text-xs focus:outline-none focus:border-emerald-400 cursor-pointer"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-white/80 mb-1 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-teal-400" />
                            <span>Hasta (Fecha)</span>
                            <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="date"
                            min={form.fechaInicio || hoyStr}
                            value={form.fechaFin || SEMESTRE_CONFIG.fechaFin}
                            onChange={e => setForm(prev => ({ ...prev, fechaFin: e.target.value }))}
                            className="w-full px-3 py-1.5 rounded-xl bg-black/60 border border-white/20 text-white font-mono text-xs focus:outline-none focus:border-emerald-400 cursor-pointer"
                            required
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Asignatura y Motivo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-white/80 mb-1">
                        Asignatura / Actividad <span className="text-red-400">*</span>
                      </label>
                      {docente?.cursos && docente.cursos.length > 0 ? (
                        <select
                          value={form.asignatura}
                          onChange={e => setForm({ ...form, asignatura: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-xl bg-black/60 border border-white/20 text-white text-xs cursor-pointer focus:outline-none focus:border-emerald-400"
                          required
                        >
                          {docente.cursos.map((c, i) => (
                            <option key={i} value={c}>{c}</option>
                          ))}
                          <option value="Clase de Recuperación">Clase de Recuperación</option>
                          <option value="Práctica de Laboratorio Especial">Práctica de Laboratorio Especial</option>
                          <option value="Evaluación / Examen">Evaluación / Examen Parcial</option>
                          <option value="Sustentación de Tesis / Proyectos">Sustentación de Tesis / Proyectos</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={form.asignatura}
                          onChange={e => setForm({ ...form, asignatura: e.target.value })}
                          placeholder="Nombre del curso o actividad..."
                          className="w-full px-3 py-1.5 rounded-xl bg-black/60 border border-white/20 text-white text-xs focus:outline-none focus:border-emerald-400"
                          required
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-white/80 mb-1">
                        Motivo de la Reserva o Tema a Tratar <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.motivo}
                        onChange={e => setForm({ ...form, motivo: e.target.value })}
                        placeholder="Ej: Práctica de ensayo de probetas, Recuperación de clase del 22/10..."
                        className="w-full px-3 py-1.5 rounded-xl bg-black/60 border border-white/20 text-white text-xs focus:outline-none focus:border-emerald-400"
                        required
                      />
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedRange(null)}
                      className="px-3 py-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      ✕ Cancelar Selección
                    </button>

                    <button
                      type="submit"
                      disabled={loading || !disponibilidad.disponible}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-lg shadow-emerald-950/60 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Enviando Solicitud...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Enviar Solicitud a la Directora</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.form>
              ) : (
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-xs text-white/40">
                  👆 Haz clic en cualquier espacio verde <strong className="text-emerald-300 font-bold">+ Libre</strong> del cronograma para activar la reserva y seleccionar tus horas.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MIS SOLICITUDES Y ESTADO */}
          {activeTab === 'mis_reservas' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between text-white/60">
                <span>Historial de tus reservas solicitadas:</span>
                <span className="font-mono text-[11px]">{reservasDocente.length} registradas</span>
              </div>

              {reservasDocente.length === 0 ? (
                <div className="py-12 text-center text-white/40 space-y-2">
                  <DoorOpen className="w-10 h-10 mx-auto opacity-30 text-emerald-400" />
                  <p className="text-xs">No tienes ninguna reserva solicitada aún.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('nueva')}
                    className="text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
                  >
                    + Ir al cronograma y solicitar tu primera reserva
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[55vh] overflow-y-auto custom-scrollbar pr-1">
                  {reservasDocente.map(r => {
                    const isAprobada = r.estado === 'APROBADA'
                    const isRechazada = r.estado === 'RECHAZADA'
                    const isPendiente = r.estado === 'PENDIENTE'

                    return (
                      <div
                        key={r.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isAprobada
                            ? 'bg-emerald-500/10 border-emerald-500/40'
                            : isRechazada
                              ? 'bg-red-500/10 border-red-500/30'
                              : 'bg-amber-500/10 border-amber-500/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white text-xs">{r.aula}</span>
                              <span className="text-[10px] text-white/50">•</span>
                              <span className="text-xs text-emerald-300 font-semibold">{r.asignatura}</span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                  isAprobada
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                    : isRechazada
                                      ? 'bg-red-500/20 text-red-300 border border-red-400/40'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                                }`}
                              >
                                {isAprobada ? '✅ Aprobada por Directora' : isRechazada ? '❌ Rechazada' : '⏳ Pendiente de Aprobación'}
                              </span>
                            </div>

                            <p className="text-[11px] text-white/70 mt-1">
                              📅 {r.tipoReserva === 'UNICA'
                                ? `Fecha: ${r.fecha} (${r.diaSemana})`
                                : `Recurrente: Cada ${r.diaSemana}${r.fechaInicio ? ` (Del ${r.fechaInicio} al ${r.fechaFin})` : ` (Sem. ${r.semanaInicio} a ${r.semanaFin})`}`
                              }
                              <span className="mx-1.5">•</span>
                              🕒 {formatHora(r.horaInicio)} - {formatHora(r.horaFin)} ({r.duracionHrs}h)
                            </p>

                            <p className="text-[11px] text-white/50 mt-1 italic">
                              &ldquo;{r.motivo}&rdquo;
                            </p>

                            {/* Observación de la Directora */}
                            {r.comentarioAdmin && (
                              <div
                                className={`mt-2 p-2 rounded-xl text-[11px] flex items-start gap-1.5 ${
                                  isAprobada
                                    ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-200'
                                    : 'bg-red-950/40 border border-red-500/30 text-red-200'
                                }`}
                              >
                                <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold">Observación de Dirección:</span> {r.comentarioAdmin}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Botón de Cancelar si está pendiente */}
                          {isPendiente && (
                            <button
                              type="button"
                              onClick={() => handleCancelarReserva(r.id)}
                              className="p-1.5 rounded-lg text-white/40 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                              title="Cancelar solicitud de reserva"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
