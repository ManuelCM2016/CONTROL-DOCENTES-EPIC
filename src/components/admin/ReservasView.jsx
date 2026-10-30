import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
  Users,
  BookOpen,
  RefreshCw,
  DoorOpen,
  PlusCircle,
  Check,
  XCircle,
  FileText,
  CalendarCheck,
  BookmarkCheck,
  Repeat,
  Trash2,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  Eye,
  ChevronDown
} from 'lucide-react'
import {
  obtenerReservas,
  crearReserva,
  actualizarEstadoReserva,
  eliminarReserva,
  verificarDisponibilidadAmbiente,
  AULAS_LABORATORIOS_MASTER,
  getDiaSemanaFromDate,
  getDateForDayOfWeek,
  normalizarReserva,
  normalizarDia,
  coincidenAulas,
  horaToMinutos,
  solapanHoras,
  formatHora,
  getLocalReservas
} from '../../services/reservasService'
import { obtenerListaDocentes, obtenerHorarios } from '../../services/adminApi'
import { MAESTRO_DOCENTES } from '../../utils/mockData'
import HORARIOS_DEFAULT from '../../data/horarios_procesados.json'
import { calcularSemanaYUnidad, SEMESTRE_CONFIG } from '../../utils/academicCalendar'

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DIAS_CORTOS = { 'Lunes': 'LUN', 'Martes': 'MAR', 'Miércoles': 'MIÉ', 'Jueves': 'JUE', 'Viernes': 'VIE', 'Sábado': 'SÁB', 'Sabado': 'SÁB' }

const ROW_HEIGHT = 44 // Altura de franja de 30 min en px

// Franjas de 30 min desde 07:00 a 22:00
const HORAS_FRANJAS = []
for (let h = 7; h <= 21; h++) {
  HORAS_FRANJAS.push(`${String(h).padStart(2, '0')}:00`)
  HORAS_FRANJAS.push(`${String(h).padStart(2, '0')}:30`)
}

export default function ReservasView({ isDarkMode = true }) {
  // Carga inmediata síncrona desde caché local (0 ms de espera)
  const [reservas, setReservas] = useState(() => getLocalReservas())
  const [docentesList, setDocentesList] = useState(MAESTRO_DOCENTES || [])
  const [horariosList, setHorariosList] = useState(HORARIOS_DEFAULT || [])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Sub-tabs de la vista Admin: 'calendario' | 'pendientes' | 'historial'
  const [activeTab, setActiveTab] = useState('calendario')

  // Filtro de Aula / Ambiente en vista Calendario
  const [filtroAula, setFiltroAula] = useState('BLOQUE R-207')
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  // Modal de Crear Reserva Manual (Directora)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [savingManual, setSavingManual] = useState(false)
  const [modalSuccessMsg, setModalSuccessMsg] = useState('')
  const [modalErrorMsg, setModalErrorMsg] = useState('')

  // Modal de Rechazo con comentario
  const [reservaParaRechazar, setReservaParaRechazar] = useState(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')

  // Estado del formulario de reserva manual
  const hoyStr = useMemo(() => new Date().toLocaleDateString('en-CA'), [])
  const semanaActual = useMemo(() => calcularSemanaYUnidad(hoyStr)?.semana || 1, [hoyStr])

  const [manualForm, setManualForm] = useState({
    dni: '',
    docente: '',
    aula: 'BLOQUE R-207',
    asignatura: '',
    motivo: '',
    tipoReserva: 'RECURRENTE',
    fecha: hoyStr,
    fechaInicio: hoyStr,
    fechaFin: SEMESTRE_CONFIG.fechaFin || '2026-12-18',
    diaSemana: getDiaSemanaFromDate(hoyStr) || 'Lunes',
    semanaInicio: semanaActual,
    semanaFin: Math.min(semanaActual + 4, 18),
    horaInicio: '08:00',
    horaFin: '10:30'
  })

  // Cargar datos iniciales
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [resReservas, resDocentes, resHorarios] = await Promise.all([
        obtenerReservas(),
        obtenerListaDocentes().catch(() => ({ success: false, data: MAESTRO_DOCENTES })),
        obtenerHorarios().catch(() => ({ success: false, data: { horarios: HORARIOS_DEFAULT } }))
      ])

      if (resReservas.success && Array.isArray(resReservas.data)) {
        setReservas(resReservas.data)
      }

      if (resDocentes.success && Array.isArray(resDocentes.data) && resDocentes.data.length > 0) {
        setDocentesList(resDocentes.data)
      } else {
        setDocentesList(MAESTRO_DOCENTES)
      }

      if (resHorarios.success && Array.isArray(resHorarios.data?.horarios) && resHorarios.data.horarios.length > 0) {
        setHorariosList(resHorarios.data.horarios)
      } else {
        setHorariosList(HORARIOS_DEFAULT)
      }
    } catch (e) {
      console.error('Error cargando datos de reservas:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Escuchar evento de actualización
  useEffect(() => {
    const handleUpdate = () => fetchData(true)
    window.addEventListener('epic_reservas_updated', handleUpdate)
    return () => window.removeEventListener('epic_reservas_updated', handleUpdate)
  }, [fetchData])

  // Contadores y métricas
  const pendientes = useMemo(() => reservas.filter(r => r.estado === 'PENDIENTE'), [reservas])
  const aprobadas = useMemo(() => reservas.filter(r => r.estado === 'APROBADA'), [reservas])
  const rechazadas = useMemo(() => reservas.filter(r => r.estado === 'RECHAZADA'), [reservas])

  // Día de la semana actual
  const diaHoy = useMemo(() => {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    return dias[new Date().getDay()]
  }, [])

  // Verificar disponibilidad reactiva para el modal manual
  const disponibilidadManual = useMemo(() => {
    return verificarDisponibilidadAmbiente({
      aula: manualForm.aula,
      fecha: manualForm.fecha,
      diaSemana: manualForm.diaSemana,
      horaInicio: manualForm.horaInicio,
      horaFin: manualForm.horaFin,
      tipoReserva: manualForm.tipoReserva,
      fechaInicio: manualForm.fechaInicio,
      fechaFin: manualForm.fechaFin,
      semanaInicio: manualForm.semanaInicio,
      semanaFin: manualForm.semanaFin,
      horariosSemestre: horariosList,
      reservasExistentes: reservas
    })
  }, [manualForm, horariosList, reservas])

  // Manejar selección de docente en modal manual
  const handleDocenteManualChange = (dni) => {
    const doc = docentesList.find(d => String(d.dni).trim() === String(dni).trim())
    if (doc) {
      setManualForm(prev => ({
        ...prev,
        dni: doc.dni,
        docente: doc.nombre,
        asignatura: Array.isArray(doc.cursos) && doc.cursos.length > 0 ? doc.cursos[0] : prev.asignatura
      }))
    } else {
      setManualForm(prev => ({ ...prev, dni, docente: '' }))
    }
  }

  // Abrir modal de reserva manual pre-llenando espacio libre clicado
  const handleEspacioLibreClick = (dia, franjaHora) => {
    const [h, m] = franjaHora.split(':').map(Number)
    const finH = h + 2
    const horaFinCalc = `${String(finH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const fechaCalc = getDateForDayOfWeek(dia)

    setManualForm(prev => ({
      ...prev,
      aula: filtroAula,
      diaSemana: dia,
      tipoReserva: 'RECURRENTE',
      fecha: fechaCalc,
      fechaInicio: fechaCalc,
      fechaFin: SEMESTRE_CONFIG.fechaFin || '2026-12-18',
      horaInicio: franjaHora,
      horaFin: horaFinCalc > '22:00' ? '22:00' : horaFinCalc
    }))
    setModalErrorMsg('')
    setModalSuccessMsg('')
    setShowCreateModal(true)
  }

  // Guardar reserva manual (Directora)
  const handleSaveManualReserva = async (e) => {
    e.preventDefault()
    setModalErrorMsg('')
    setModalSuccessMsg('')

    if (!manualForm.docente.trim()) {
      setModalErrorMsg('Por favor seleccione o ingrese el docente.')
      return
    }

    if (!manualForm.motivo.trim()) {
      setModalErrorMsg('El motivo de la reserva o tema a tratar es obligatorio.')
      return
    }

    if (horaToMinutos(manualForm.horaFin) <= horaToMinutos(manualForm.horaInicio)) {
      setModalErrorMsg('La hora de fin debe ser mayor a la hora de inicio.')
      return
    }

    if (!disponibilidadManual.disponible) {
      setModalErrorMsg(disponibilidadManual.conflicto?.detalle || 'Conflicto: el ambiente no está disponible en ese horario.')
      return
    }

    setSavingManual(true)
    try {
      const duracionHrs = (horaToMinutos(manualForm.horaFin) - horaToMinutos(manualForm.horaInicio)) / 60
      const semIni = manualForm.tipoReserva === 'RECURRENTE'
        ? (calcularSemanaYUnidad(manualForm.fechaInicio)?.semana || 1)
        : (calcularSemanaYUnidad(manualForm.fecha)?.semana || 1)
      const semFin = manualForm.tipoReserva === 'RECURRENTE'
        ? (calcularSemanaYUnidad(manualForm.fechaFin)?.semana || 18)
        : semIni

      const payload = {
        dni: manualForm.dni || 'DIR-ADMIN',
        docente: manualForm.docente,
        aula: manualForm.aula,
        asignatura: manualForm.asignatura || 'Clase / Actividad Oficial',
        motivo: manualForm.motivo.trim(),
        tipoReserva: manualForm.tipoReserva,
        fecha: manualForm.fecha,
        fechaInicio: manualForm.tipoReserva === 'RECURRENTE' ? manualForm.fechaInicio : manualForm.fecha,
        fechaFin: manualForm.tipoReserva === 'RECURRENTE' ? manualForm.fechaFin : manualForm.fecha,
        diaSemana: manualForm.tipoReserva === 'UNICA' ? getDiaSemanaFromDate(manualForm.fecha) : manualForm.diaSemana,
        semanaInicio: Number(semIni),
        semanaFin: Number(semFin),
        horaInicio: manualForm.horaInicio,
        horaFin: manualForm.horaFin,
        duracionHrs: parseFloat(duracionHrs.toFixed(2)),
        estado: 'APROBADA', // Creada directamente por la Directora
        creadoPor: 'DIRECTORA',
        comentarioAdmin: 'Asignación directa por Dirección de Escuela'
      }

      const res = await crearReserva(payload)
      if (res && res.success === false) {
        setModalErrorMsg(res.message || 'Error al guardar la reserva.')
        return
      }

      setModalSuccessMsg('¡Reserva creada y confirmada exitosamente!')
      fetchData(true)
      setTimeout(() => {
        setShowCreateModal(false)
        setModalSuccessMsg('')
      }, 1500)
    } catch (err) {
      setModalErrorMsg('Error al guardar la reserva.')
    } finally {
      setSavingManual(false)
    }
  }

  // Aprobar solicitud de docente
  const handleAprobarReserva = async (reserva) => {
    const rNorm = normalizarReserva(reserva)
    // Validar disponibilidad antes de aprobar
    const disp = verificarDisponibilidadAmbiente({
      aula: rNorm.aula,
      fecha: rNorm.fecha,
      diaSemana: rNorm.diaSemana,
      horaInicio: rNorm.horaInicio,
      horaFin: rNorm.horaFin,
      tipoReserva: rNorm.tipoReserva,
      semanaInicio: rNorm.semanaInicio,
      semanaFin: rNorm.semanaFin,
      excluirReservaId: rNorm.id,
      horariosSemestre: horariosList,
      reservasExistentes: reservas
    })

    if (!disp.disponible) {
      alert(`⚠️ No se puede aprobar: Existe un conflicto con el horario:\n${disp.conflicto?.detalle}`)
      return
    }

    try {
      await actualizarEstadoReserva({
        id: reserva.id,
        estado: 'APROBADA',
        comentarioAdmin: 'Aprobado por Dirección de Escuela. Espacio reservado con éxito.'
      })
      fetchData(true)
    } catch (e) {
      alert('Error al aprobar reserva')
    }
  }

  // Confirmar rechazo con motivo
  const handleConfirmarRechazo = async () => {
    if (!reservaParaRechazar) return
    try {
      await actualizarEstadoReserva({
        id: reservaParaRechazar.id,
        estado: 'RECHAZADA',
        comentarioAdmin: motivoRechazo.trim() || 'No disponible por cruce o disposición institucional.'
      })
      setReservaParaRechazar(null)
      setMotivoRechazo('')
      fetchData(true)
    } catch (e) {
      alert('Error al rechazar reserva')
    }
  }

  // Eliminar reserva
  const handleEliminarReserva = async (id) => {
    if (!window.confirm('¿Desea eliminar permanentemente esta reserva?')) return
    await eliminarReserva(id)
    fetchData(true)
  }

  // Datos filtrados para el historial
  const historialFiltrado = useMemo(() => {
    return reservas.filter(r => {
      const matchSearch = !searchTerm ||
        r.docente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.asignatura?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.aula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.motivo?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchEstado = !filtroEstado || r.estado === filtroEstado

      return matchSearch && matchEstado
    })
  }, [reservas, searchTerm, filtroEstado])

  // ══════════════════════════════════════════════════════════
  // ESTRUCTURA DE LA GRILLA DE AMBIENTES (Clases + Reservas + Libres)
  // ══════════════════════════════════════════════════════════
  const gridAmbienteData = useMemo(() => {
    // 1. Clases regulares del horario para este aula
    const clasesAula = horariosList.filter(h => coincidenAulas(h.AULA || h.aula, filtroAula))

    // 2. Reservas aprobadas y pendientes para este aula
    const reservasAula = reservas
      .map(normalizarReserva)
      .filter(r => r.estado !== 'RECHAZADA' && coincidenAulas(r.aula, filtroAula))

    // Mapear elementos por día
    const porDia = {}
    DIAS_SEMANA.forEach(d => {
      porDia[d] = []
    })

    // Insertar clases regulares
    clasesAula.forEach(c => {
      const dia = c.DIA || c.dia || ''
      if (porDia[dia]) {
        porDia[dia].push({
          tipoItem: 'CLASE_REGULAR',
          id: `clase_${c.CODIGO}_${dia}_${c.HORA_INICIO}`,
          codigo: c.CODIGO || c.codigo || '',
          curso: c.CURSO || c.curso || '',
          docente: c.DOCENTE || c.docente || '',
          seccion: c.SECCION || c.seccion || '',
          ciclo: c.CICLO || c.ciclo || '1',
          horaInicio: (c.HORA_INICIO || c.hora_inicio || '').slice(0, 5),
          horaFin: (c.HORA_FIN || c.hora_fin || '').slice(0, 5),
          aula: c.AULA || c.aula || ''
        })
      }
    })

    // Insertar reservas (Aprobadas y Pendientes)
    reservasAula.forEach(r => {
      const dia = r.diaSemana || getDiaSemanaFromDate(r.fecha) || 'Lunes'
      if (porDia[dia]) {
        porDia[dia].push({
          tipoItem: 'RESERVA',
          id: r.id,
          codigo: r.estado === 'APROBADA' ? 'RES-CONF' : 'RES-PEND',
          curso: r.asignatura,
          docente: r.docente,
          motivo: r.motivo,
          tipoReserva: r.tipoReserva,
          fecha: r.fecha,
          estado: r.estado,
          horaInicio: formatHora(r.horaInicio),
          horaFin: formatHora(r.horaFin),
          aula: r.aula
        })
      }
    })

    const franjas = HORAS_FRANJAS.map(f => ({
      label: f,
      minutos: horaToMinutos(f)
    }))

    return { porDia, franjas, totalClases: clasesAula.length, totalReservas: reservasAula.length }
  }, [horariosList, reservas, filtroAula])

  return (
    <div className="space-y-5">
      {/* ── HEADER PRINCIPAL ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white flex items-center justify-center shadow-lg shadow-emerald-950/60 ring-1 ring-emerald-400/30 shrink-0">
            <DoorOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-black text-white tracking-tight">
                Módulo de Reserva de Salón o Laboratorio
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Dirección EPIC
              </span>
            </div>
            <p className="text-xs text-white/50 font-medium">
              Control integral de disponibilidad, separación manual y aprobación de solicitudes de docentes
            </p>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              setManualForm(prev => ({
                ...prev,
                aula: filtroAula,
                motivo: ''
              }))
              setModalErrorMsg('')
              setModalSuccessMsg('')
              setShowCreateModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition-all text-xs font-bold cursor-pointer shadow-lg shadow-emerald-950/60 ring-1 ring-emerald-400/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4 text-emerald-200" />
            <span>+ Crear Reserva Manual (Directora)</span>
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

      {/* ── KPI STATS CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-amber-300/80 uppercase">Solicitudes Pendientes</p>
            <p className="text-2xl font-black text-amber-300 mt-0.5">{pendientes.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
            ⏳
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-emerald-300/80 uppercase">Reservas Aprobadas</p>
            <p className="text-2xl font-black text-emerald-300 mt-0.5">{aprobadas.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
            ✅
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-red-300/80 uppercase">Rechazadas</p>
            <p className="text-2xl font-black text-red-300 mt-0.5">{rechazadas.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-300 flex items-center justify-center font-bold">
            ❌
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-blue-300/80 uppercase">Ambientes Disponibles</p>
            <p className="text-2xl font-black text-blue-300 mt-0.5">{AULAS_LABORATORIOS_MASTER.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold">
            🏛️
          </div>
        </div>
      </div>

      {/* ── NAVEGACIÓN POR SUB-PESTAÑAS ── */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('calendario')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'calendario'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Disponibilidad & Calendario de Ambientes</span>
          </button>

          <button
            onClick={() => setActiveTab('pendientes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
              activeTab === 'pendientes'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Solicitudes Pendientes</span>
            {pendientes.length > 0 && (
              <span className="px-2 py-0.2 rounded-full bg-amber-500 text-black font-black text-[10px] animate-pulse">
                {pendientes.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('historial')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'historial'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <BookmarkCheck className="w-4 h-4" />
            <span>Historial de Reservas ({reservas.length})</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* VISTA 1: DISPONIBILIDAD & CALENDARIO INTERACTIVO       */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === 'calendario' && (
        <div className="space-y-4">
          {/* Selector de Aula / Laboratorio (Franja de Ambientes) */}
          <div className="p-4 rounded-3xl bg-white/[0.02] border border-white/10 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-white/80 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>Seleccionar Ambiente para ver Ocupación y Espacios Libres:</span>
              </span>
              <span className="text-[11px] text-emerald-400/80 font-medium">
                💡 Haz clic en cualquier espacio &quot;Libre&quot; para reservar directamente
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
              {AULAS_LABORATORIOS_MASTER.map(aula => {
                const isSelected = filtroAula.toUpperCase() === aula.toUpperCase()
                const isLab = !aula.startsWith('BLOQUE')
                return (
                  <button
                    key={aula}
                    onClick={() => setFiltroAula(aula)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-300 scale-105'
                        : isLab
                          ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/20'
                          : 'bg-white/5 text-white/70 border border-white/10 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : isLab ? 'bg-cyan-400' : 'bg-emerald-400'}`} />
                    <span>{aula}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Subheader informativo del ambiente seleccionado */}
          <div className="px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-emerald-400" />
              <span className="text-white">
                Cronograma de: <strong className="text-emerald-300 font-black">{filtroAula}</strong>
              </span>
              <span className="text-white/40">•</span>
              <span className="text-white/60">
                {gridAmbienteData.totalClases} clases regulares + {gridAmbienteData.totalReservas} reservas
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500/40 border border-blue-400/60" />
                Clase Semestre
              </span>
              <span className="flex items-center gap-1 text-emerald-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 border border-emerald-300" />
                Reserva Aprobada
              </span>
              <span className="flex items-center gap-1 text-amber-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/40 border border-amber-400" />
                Pendiente
              </span>
              <span className="flex items-center gap-1 text-white/50">
                <span className="w-2.5 h-2.5 rounded-sm border border-dashed border-emerald-400/50 bg-emerald-950/20" />
                Espacio Libre
              </span>
            </div>
          </div>

          {/* GRILLA INTERACTIVA */}
          <div className="rounded-3xl border border-white/10 overflow-hidden bg-white/[0.02]">
            <div className="overflow-x-auto">
              <div className="min-w-[920px]">
                {/* Header de días */}
                <div className="grid grid-cols-[80px_repeat(6,1fr)] border-b border-white/10 bg-white/[0.04]">
                  <div className="p-3 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-white/30" />
                  </div>
                  {DIAS_SEMANA.map(dia => (
                    <div
                      key={dia}
                      className={`p-3 text-center border-l border-white/5 transition-colors ${dia === diaHoy ? 'bg-emerald-500/10' : ''}`}
                    >
                      <p className={`text-xs font-black uppercase tracking-widest ${dia === diaHoy ? 'text-emerald-300' : 'text-white/50'}`}>
                        {dia}
                      </p>
                      {dia === diaHoy && (
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mx-auto mt-1 animate-pulse" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Franjas Horarias */}
                <div className="relative">
                  {gridAmbienteData.franjas.map((franja, fIdx) => (
                    <div
                      key={franja.label}
                      className={`grid grid-cols-[80px_repeat(6,1fr)] ${fIdx % 2 === 0 ? 'border-t border-white/5' : ''}`}
                      style={{ height: `${ROW_HEIGHT}px` }}
                    >
                      {/* Columna Hora */}
                      <div className="flex items-start justify-end pr-3 pt-1 border-r border-white/5">
                        {franja.label.endsWith(':00') && (
                          <span className="text-[10px] font-mono font-bold text-white/30">{franja.label}</span>
                        )}
                      </div>

                      {/* Columnas Días */}
                      {DIAS_SEMANA.map(dia => {
                        const itemsDelDia = gridAmbienteData.porDia[dia] || []
                        const itemsEnFranja = itemsDelDia.filter(item => {
                          const iniMin = horaToMinutos(item.horaInicio)
                          return iniMin >= franja.minutos && iniMin < franja.minutos + 30
                        })
                        const totalEnFranja = itemsEnFranja.length

                        // Verificar si está totalmente libre esta celda
                        const celdaOcupada = itemsDelDia.some(item => {
                          const ini = horaToMinutos(item.horaInicio)
                          const fin = horaToMinutos(item.horaFin)
                          return franja.minutos >= ini && franja.minutos < fin
                        })

                        return (
                          <div
                            key={dia}
                            className={`relative border-l border-white/5 ${dia === diaHoy ? 'bg-emerald-500/[0.02]' : ''} group`}
                            style={{ height: `${ROW_HEIGHT}px` }}
                          >
                            {/* Botón interactivo de espacio libre si no hay clase que lo tape */}
                            {!celdaOcupada && (
                              <button
                                type="button"
                                onClick={() => handleEspacioLibreClick(dia, franja.label)}
                                className="absolute inset-0.5 rounded-lg border border-dashed border-emerald-500/20 hover:border-emerald-400 hover:bg-emerald-500/15 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-emerald-300 font-bold z-0 cursor-pointer"
                                title={`Clic para reservar ${filtroAula} el ${dia} a las ${franja.label}`}
                              >
                                + Reservar
                              </button>
                            )}

                            {/* Renderizado de Clases Regulares o Reservas */}
                            {itemsEnFranja.map((item, idx) => {
                              const iniMin = horaToMinutos(item.horaInicio)
                              const finMin = horaToMinutos(item.horaFin)
                              const duracion = finMin - iniMin
                              const offsetTop = ((iniMin - franja.minutos) / 30) * ROW_HEIGHT
                              const cellHeight = (duracion / 30) * ROW_HEIGHT - 2
                              const widthPercent = totalEnFranja > 1 ? 100 / totalEnFranja : 100
                              const leftPercent = totalEnFranja > 1 ? idx * widthPercent : 0

                              const isReserva = item.tipoItem === 'RESERVA'
                              const isAprobada = item.estado === 'APROBADA'

                              return (
                                <div
                                  key={item.id}
                                  className="absolute z-10 transition-all duration-200 hover:z-30 p-0.5"
                                  style={{
                                    top: `${offsetTop}px`,
                                    height: `${cellHeight}px`,
                                    left: `${leftPercent}%`,
                                    width: `${widthPercent}%`
                                  }}
                                >
                                  <div
                                    className={`w-full h-full rounded-xl p-2 flex flex-col justify-between overflow-hidden shadow-md text-left transition-all ${
                                      isReserva
                                        ? isAprobada
                                          ? 'bg-gradient-to-br from-emerald-600/90 to-teal-700/90 border-2 border-emerald-300 text-white shadow-emerald-950/60 ring-1 ring-emerald-400'
                                          : 'bg-gradient-to-br from-amber-600/80 to-amber-700/80 border-2 border-amber-300 text-white'
                                        : 'bg-gradient-to-br from-blue-900/40 to-indigo-950/60 border border-blue-500/30 text-slate-200 hover:border-blue-400'
                                    }`}
                                  >
                                    <div>
                                      <div className="flex items-center justify-between gap-1">
                                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider ${
                                          isReserva
                                            ? isAprobada
                                              ? 'bg-black/40 text-emerald-200 border border-emerald-300/40'
                                              : 'bg-black/40 text-amber-200 border border-amber-300/40'
                                            : 'bg-white/10 text-blue-200'
                                        }`}>
                                          {isReserva ? (isAprobada ? '🟢 RESERVA CONFIRMADA' : '🟡 RESERVA PENDIENTE') : `CLASE CICLO ${item.ciclo}`}
                                        </span>
                                        <span className="text-[10px] font-mono font-bold opacity-80">
                                          {item.horaInicio} - {item.horaFin}
                                        </span>
                                      </div>

                                      <p className="font-bold text-[11px] leading-tight mt-1 line-clamp-1">
                                        {item.curso}
                                      </p>
                                    </div>

                                    <div>
                                      <p className="text-[10px] opacity-90 truncate font-medium">
                                        👤 {item.docente}
                                      </p>
                                      {isReserva && item.motivo && (
                                        <p className="text-[9px] opacity-75 truncate italic mt-0.5">
                                          &ldquo;{item.motivo}&rdquo;
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* VISTA 2: BANDEJA DE SOLICITUDES PENDIENTES DE DOCENTES */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === 'pendientes' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>Solicitudes enviadas por docentes pendientes de validación:</span>
            <span className="font-mono text-amber-400 font-bold">{pendientes.length} pendientes</span>
          </div>

          {pendientes.length === 0 ? (
            <div className="py-16 text-center text-white/40 space-y-2 rounded-3xl bg-white/[0.02] border border-white/10">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 opacity-60" />
              <h3 className="text-sm font-bold text-white">¡No hay solicitudes pendientes!</h3>
              <p className="text-xs text-white/40">Todas las solicitudes de reserva de aulas y laboratorios han sido atendidas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendientes.map(r => {
                // Verificar si hay disponibilidad actual
                const disp = verificarDisponibilidadAmbiente({
                  aula: r.aula,
                  fecha: r.fecha,
                  diaSemana: r.diaSemana,
                  horaInicio: r.horaInicio,
                  horaFin: r.horaFin,
                  tipoReserva: r.tipoReserva,
                  semanaInicio: r.semanaInicio,
                  semanaFin: r.semanaFin,
                  excluirReservaId: r.id,
                  horariosSemestre: horariosList,
                  reservasExistentes: reservas
                })

                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-3xl bg-white/[0.03] border border-amber-500/40 hover:border-amber-400/60 shadow-xl space-y-3"
                  >
                    {/* Header de la tarjeta */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm text-white">{r.aula}</span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {r.tipoReserva === 'UNICA' ? 'Única Vez' : 'Recurrente'}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-300 font-bold mt-0.5">{r.asignatura}</p>
                      </div>

                      <span className="text-[10px] text-white/40 font-mono">
                        {r.fechaSolicitud ? new Date(r.fechaSolicitud).toLocaleDateString('es-PE') : 'Reciente'}
                      </span>
                    </div>

                    {/* Datos del docente y horario */}
                    <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="text-white font-bold">{r.docente}</span>
                        {r.dni && <span className="text-white/40 font-mono text-[10px]">({r.dni})</span>}
                      </div>

                      <div className="flex items-center gap-2 text-white/80">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>
                          {r.tipoReserva === 'UNICA'
                            ? `Fecha: ${r.fecha} (${r.diaSemana})`
                            : `Cada ${r.diaSemana}${r.fechaInicio ? ` (Del ${r.fechaInicio} al ${r.fechaFin})` : ` (Semanas ${r.semanaInicio} a ${r.semanaFin})`}`
                          }
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-white/80">
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="font-mono font-bold text-amber-300">
                          {formatHora(r.horaInicio)} - {formatHora(r.horaFin)} ({r.duracionHrs} hrs)
                        </span>
                      </div>
                    </div>

                    {/* Motivo o Tema */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1">
                        <FileText className="w-3 h-3 text-emerald-400" />
                        Motivo declarado por el docente:
                      </span>
                      <p className="text-xs text-white/80 p-2.5 rounded-xl bg-white/5 border border-white/5 italic">
                        &ldquo;{r.motivo}&rdquo;
                      </p>
                    </div>

                    {/* Indicador de Disponibilidad */}
                    <div>
                      {disp.disponible ? (
                        <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                          <span>Horario libre en el cronograma. Listo para validar.</span>
                        </div>
                      ) : (
                        <div className="p-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-[11px] flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                          <span>Conflicto detectado: {disp.conflicto?.detalle}</span>
                        </div>
                      )}
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleAprobarReserva(r)}
                        disabled={!disp.disponible}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md shadow-emerald-950/40 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Check className="w-4 h-4" />
                        <span>Validar y Aprobar</span>
                      </button>

                      <button
                        onClick={() => {
                          setReservaParaRechazar(r)
                          setMotivoRechazo('')
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-bold text-xs transition-all cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        <span>Rechazar</span>
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* VISTA 3: HISTORIAL COMPLETO DE RESERVAS                */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === 'historial' && (
        <div className="space-y-3">
          {/* Barra de Búsqueda y Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-3xl bg-white/[0.02] border border-white/10 text-xs">
            <div className="relative">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por docente, aula, curso..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-white/30 text-xs focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <select
                value={filtroEstado}
                onChange={e => setFiltroEstado(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 cursor-pointer"
              >
                <option value="">Todos los Estados</option>
                <option value="APROBADA">Aprobadas</option>
                <option value="PENDIENTE">Pendientes</option>
                <option value="RECHAZADA">Rechazadas</option>
              </select>
            </div>

            <div className="flex items-center justify-end text-white/50 text-[11px] font-mono">
              {historialFiltrado.length} de {reservas.length} reservas registradas
            </div>
          </div>

          {/* Tabla de Reservas */}
          <div className="rounded-3xl border border-white/10 overflow-hidden bg-white/[0.02]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-black/40 text-[11px] uppercase tracking-wider text-white/50 border-b border-white/10 font-black">
                  <tr>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Ambiente</th>
                    <th className="py-3 px-4">Docente</th>
                    <th className="py-3 px-4">Curso / Motivo</th>
                    <th className="py-3 px-4">Día / Fecha</th>
                    <th className="py-3 px-4">Horario</th>
                    <th className="py-3 px-4">Creado Por</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium">
                  {historialFiltrado.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-white/40">
                        No se encontraron registros de reservas con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    historialFiltrado.map(r => {
                      const isAprobada = r.estado === 'APROBADA'
                      const isPendiente = r.estado === 'PENDIENTE'
                      const isRechazada = r.estado === 'RECHAZADA'

                      return (
                        <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isAprobada
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : isRechazada
                                  ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}>
                              {isAprobada ? '✅ APROBADA' : isRechazada ? '❌ RECHAZADA' : '⏳ PENDIENTE'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-white">{r.aula}</td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-white">{r.docente}</div>
                            {r.dni && <div className="text-[10px] text-white/40 font-mono">DNI: {r.dni}</div>}
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <div className="text-emerald-300 font-semibold truncate">{r.asignatura}</div>
                            <div className="text-[11px] text-white/50 truncate italic">&ldquo;{r.motivo}&rdquo;</div>
                          </td>
                          <td className="py-3 px-4">
                            {r.tipoReserva === 'UNICA' ? (
                              <div>
                                <span className="font-bold text-white">{r.fecha}</span>
                                <span className="text-[10px] text-white/50 block">({r.diaSemana})</span>
                              </div>
                            ) : (
                              <div>
                                <span className="font-bold text-teal-300">{r.diaSemana}</span>
                                <span className="text-[10px] text-white/50 block">
                                  {r.fechaInicio ? `${r.fechaInicio} ~ ${r.fechaFin}` : `Sem. ${r.semanaInicio} - ${r.semanaFin}`}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-white">
                            {formatHora(r.horaInicio)} - {formatHora(r.horaFin)}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              r.creadoPor === 'DIRECTORA' ? 'bg-purple-500/20 text-purple-300' : 'bg-white/10 text-white/70'
                            }`}>
                              {r.creadoPor || 'DOCENTE'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {isPendiente && (
                                <button
                                  onClick={() => handleAprobarReserva(r)}
                                  className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                                  title="Aprobar reserva"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleEliminarReserva(r.id)}
                                className="p-1.5 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
                                title="Eliminar registro"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODAL: CREAR RESERVA MANUAL (DIRECTORA)                */}
      {/* ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !savingManual && setShowCreateModal(false)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-2xl rounded-3xl bg-[#090f1d] border border-emerald-500/40 p-5 sm:p-7 shadow-2xl text-white space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-start justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center font-bold">
                    <PlusCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Separación Manual de Ambiente</h3>
                    <p className="text-xs text-white/50">Asignar directamente un salón o laboratorio a un docente</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => !savingManual && setShowCreateModal(false)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {modalErrorMsg && (
                <div className="p-3 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{modalErrorMsg}</span>
                </div>
              )}

              {modalSuccessMsg && (
                <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{modalSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveManualReserva} className="space-y-3.5 text-xs">
                {/* Docente */}
                <div>
                  <label className="block text-[11px] font-bold text-white/80 mb-1">
                    Docente Asignado <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={manualForm.dni}
                    onChange={e => handleDocenteManualChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-medium focus:outline-none focus:border-emerald-400 text-xs cursor-pointer"
                    required
                  >
                    <option value="">-- Seleccionar Docente --</option>
                    {docentesList.map(d => (
                      <option key={d.dni} value={d.dni}>
                        {d.nombre} (DNI: {d.dni})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ambiente y Modalidad */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-white/80 mb-1">
                      Salón / Laboratorio <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={manualForm.aula}
                      onChange={e => setManualForm({ ...manualForm, aula: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-medium focus:outline-none focus:border-emerald-400 text-xs cursor-pointer"
                      required
                    >
                      {AULAS_LABORATORIOS_MASTER.map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-white/80 mb-1">
                      Modalidad
                    </label>
                    <select
                      value={manualForm.tipoReserva}
                      onChange={e => setManualForm({ ...manualForm, tipoReserva: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-medium focus:outline-none focus:border-emerald-400 text-xs cursor-pointer"
                    >
                      <option value="RECURRENTE">Recurrente (Rango de fechas)</option>
                      <option value="UNICA">Única Vez (Fecha específica)</option>
                    </select>
                  </div>
                </div>

                {/* Fechas / Días */}
                {manualForm.tipoReserva === 'UNICA' ? (
                  <div>
                    <label className="block text-[11px] font-bold text-white/80 mb-1">
                      Fecha de la Clase <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={manualForm.fecha}
                      onChange={e => setManualForm({
                        ...manualForm,
                        fecha: e.target.value,
                        diaSemana: getDiaSemanaFromDate(e.target.value) || 'Lunes'
                      })}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-mono text-xs focus:outline-none focus:border-emerald-400 cursor-pointer"
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-white/80 mb-1">
                          Día Semanal <span className="text-red-400">*</span>
                        </label>
                        <select
                          value={manualForm.diaSemana}
                          onChange={e => setManualForm({ ...manualForm, diaSemana: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white text-xs cursor-pointer focus:outline-none focus:border-emerald-400"
                        >
                          {DIAS_SEMANA.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-white/80 mb-1 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Desde (Fecha)</span>
                          <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="date"
                          value={manualForm.fechaInicio || hoyStr}
                          onChange={e => {
                            const val = e.target.value
                            const diaCalc = getDiaSemanaFromDate(val) || manualForm.diaSemana
                            setManualForm(prev => ({
                              ...prev,
                              fechaInicio: val,
                              diaSemana: diaCalc,
                              fechaFin: prev.fechaFin && prev.fechaFin < val ? val : prev.fechaFin
                            }))
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-mono text-xs focus:outline-none focus:border-emerald-400 cursor-pointer"
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
                          min={manualForm.fechaInicio || hoyStr}
                          value={manualForm.fechaFin || SEMESTRE_CONFIG.fechaFin}
                          onChange={e => setManualForm(prev => ({ ...prev, fechaFin: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-mono text-xs focus:outline-none focus:border-emerald-400 cursor-pointer"
                          required
                        />
                      </div>
                    </div>

                    {/* Resumen del rango seleccionado */}
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-[11px] text-white/70">
                      <span className="flex items-center gap-1.5">
                        <Repeat className="w-3 h-3 text-teal-400" />
                        <span>Frecuencia: Cada <strong>{manualForm.diaSemana}</strong></span>
                      </span>
                      <span className="text-teal-300 font-mono text-[10px]">
                        Semana {calcularSemanaYUnidad(manualForm.fechaInicio)?.semana || 1} a {calcularSemanaYUnidad(manualForm.fechaFin)?.semana || 18}
                      </span>
                    </div>
                  </div>
                )}

                {/* Horas */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-white/80 mb-1">Hora Inicio</label>
                    <input
                      type="time"
                      value={manualForm.horaInicio}
                      onChange={e => setManualForm({ ...manualForm, horaInicio: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-white/80 mb-1">Hora Fin</label>
                    <input
                      type="time"
                      value={manualForm.horaFin}
                      onChange={e => setManualForm({ ...manualForm, horaFin: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                      required
                    />
                  </div>
                </div>

                {/* Indicador de Disponibilidad */}
                <div>
                  {disponibilidadManual.disponible ? (
                    <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Espacio 100% disponible. La reserva se confirmará automáticamente.</span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-[11px] flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span>{disponibilidadManual.conflicto?.detalle}</span>
                    </div>
                  )}
                </div>

                {/* Asignatura y Motivo */}
                <div>
                  <label className="block text-[11px] font-bold text-white/80 mb-1">
                    Asignatura o Actividad
                  </label>
                  <input
                    type="text"
                    value={manualForm.asignatura}
                    onChange={e => setManualForm({ ...manualForm, asignatura: e.target.value })}
                    placeholder="Ej. Taller de Tesis, Clase de Recuperación..."
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-white/80 mb-1">
                    Motivo / Tema a Tratar <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={manualForm.motivo}
                    onChange={e => setManualForm({ ...manualForm, motivo: e.target.value })}
                    placeholder="Detalle de la asignación manual..."
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white text-xs resize-none focus:outline-none focus:border-emerald-400"
                    required
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/10 text-white/70 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingManual || !disponibilidadManual.disponible}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold disabled:opacity-50"
                  >
                    {savingManual ? 'Guardando...' : 'Confirmar Separación'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODAL: RECHAZAR SOLICITUD CON MOTIVO                   */}
      {/* ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {reservaParaRechazar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReservaParaRechazar(null)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-10 w-full max-w-md rounded-3xl bg-[#090f1d] border border-red-500/40 p-5 shadow-2xl text-white space-y-3"
            >
              <div className="flex items-center gap-2.5 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="font-bold text-sm text-white">Rechazar Solicitud de Reserva</h4>
              </div>

              <p className="text-xs text-white/70">
                Se notificará al docente <strong className="text-white">{reservaParaRechazar.docente}</strong> que su solicitud para el ambiente <strong className="text-white">{reservaParaRechazar.aula}</strong> ha sido rechazada.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-white/80 mb-1">
                  Motivo u Observación para el docente (opcional):
                </label>
                <textarea
                  rows={3}
                  value={motivoRechazo}
                  onChange={e => setMotivoRechazo(e.target.value)}
                  placeholder="Ej. Cruce de horario con evaluación institucional, mantenimiento de laboratorio programado..."
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white text-xs resize-none focus:outline-none focus:border-red-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReservaParaRechazar(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-white/10 text-white/70 hover:text-white text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarRechazo}
                  className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
                >
                  Confirmar Rechazo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

