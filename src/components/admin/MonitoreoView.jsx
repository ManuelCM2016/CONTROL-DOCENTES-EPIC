import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Radio,
  Clock,
  MapPin,
  BookOpen,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Sparkles,
  Calendar,
  Layers,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Building,
  School,
  AlertTriangle,
  XCircle,
  Loader2,
  Timer
} from 'lucide-react'
import { obtenerMonitoreo, forzarCierreSesionAdmin } from '../../services/adminApi'

const MonitoreoView = ({ isDarkMode }) => {
  const [data, setData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    activas: [],
    completadasHoy: [],
    todosDocentes: []
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [tab, setTab] = useState('activas') // 'activas' | 'completadas' | 'sin_registro'
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(30)
  const [cierreModal, setCierreModal] = useState(null) // sesion seleccionada para cerrar
  const [isCerrando, setIsCerrando] = useState(false)

  // Cargar datos del servidor
  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const res = await obtenerMonitoreo()
      if (res.success && res.data) {
        setData(res.data)
        setLastUpdated(new Date())
        setSecondsUntilRefresh(30)
      }
    } catch (err) {
      console.error('Error al cargar monitoreo:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Polling automático cada 30 segundos
  useEffect(() => {
    fetchData()
    const timer = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          fetchData()
          return 30
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [fetchData])

  // Calcular tiempo transcurrido desde la hora de inicio
  const getTiempoTranscurrido = (horaInicio) => {
    if (!horaInicio) return '--'
    try {
      const parts = horaInicio.split(':')
      if (parts.length < 2) return horaInicio
      const start = new Date()
      start.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2] || 0, 10))
      const now = new Date()
      const diffMs = now - start
      if (diffMs < 0) return 'Iniciando...'
      const diffMins = Math.floor(diffMs / (1000 * 60))
      const horas = Math.floor(diffMins / 60)
      const mins = diffMins % 60
      if (horas > 0) return `${horas}h ${mins}m en clase`
      return `${mins} min en clase`
    } catch {
      return horaInicio
    }
  }

  // Calcular si la sesión excedió su duración estimada
  const getExcesoInfo = (horaInicio, duracionEstimadaMin) => {
    if (!horaInicio) return null
    const durMin = parseInt(duracionEstimadaMin || 90, 10)
    try {
      const parts = horaInicio.split(':')
      if (parts.length < 2) return null
      const start = new Date()
      start.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2] || 0, 10))
      const finEstimado = new Date(start.getTime() + durMin * 60 * 1000)
      const now = new Date()
      if (now > finEstimado) {
        const excesoMs = now - finEstimado
        const excesoMin = Math.floor(excesoMs / (1000 * 60))
        const hFin = finEstimado.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
        return { excedida: true, excesoMin, horaFinEstimada: hFin }
      }
      const hFin = finEstimado.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      return { excedida: false, excesoMin: 0, horaFinEstimada: hFin }
    } catch {
      return null
    }
  }

  // Calcular hora de salida = horaInicio + duraciónEstimadaMin
  const calcularHoraFin = (horaInicio, duracionEstimadaMin) => {
    const durMin = parseInt(duracionEstimadaMin || 90, 10)
    try {
      const parts = horaInicio.split(':')
      if (parts.length < 2) return '--:--:--'
      const start = new Date()
      start.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2] || 0, 10))
      start.setMinutes(start.getMinutes() + durMin)
      return start.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    } catch {
      return '--:--:--'
    }
  }

  // Handler para forzar cierre de aula
  const handleForzarCierre = async () => {
    if (!cierreModal) return
    setIsCerrando(true)
    try {
      const durMin = parseInt(cierreModal.duracionEstimadaMin || 90, 10)
      const res = await forzarCierreSesionAdmin({
        dni: cierreModal.dni,
        fecha: cierreModal.fecha || new Date().toISOString().split('T')[0],
        horaInicio: cierreModal.horaInicio,
        duracionEstimadaMin: durMin,
        motivo: 'Sesión cerrada remotamente por Dirección Académica (Inconclusa)',
      })
      if (res.success) {
        setCierreModal(null)
        fetchData(true) // Refrescar datos
      }
    } catch (err) {
      console.error('Error al forzar cierre:', err)
    } finally {
      setIsCerrando(false)
    }
  }

  // Docentes únicos que asistieron / registraron clase hoy (activas o completadas)
  const docentesAsistieronHoyMap = new Map()
  ;[...(data.activas || []), ...(data.completadasHoy || [])].forEach((s) => {
    const key = String(s.dni || s.docente).trim().replace(/^0+/, '')
    if (!docentesAsistieronHoyMap.has(key)) {
      docentesAsistieronHoyMap.set(key, {
        dni: s.dni,
        nombre: s.docente,
        sesiones: [],
        enVivo: false
      })
    }
    const entry = docentesAsistieronHoyMap.get(key)
    entry.sesiones.push(s)
    if (s.estado === 'ACTIVO') entry.enVivo = true
  })
  const docentesAsistieronHoy = Array.from(docentesAsistieronHoyMap.values())

  // Filtros de búsqueda
  const filterSearch = (item, fields) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return fields.some((field) => String(item[field] || '').toLowerCase().includes(term))
  }

  const activasFiltradas = (data.activas || []).filter((s) =>
    filterSearch(s, ['docente', 'asignatura', 'aula', 'dni'])
  )
  const completadasFiltradas = (data.completadasHoy || []).filter((s) =>
    filterSearch(s, ['docente', 'asignatura', 'aula', 'tema', 'dni'])
  )
  const docentesAsistieronFiltrados = docentesAsistieronHoy.filter((d) =>
    filterSearch(d, ['nombre', 'dni'])
  )

  return (
    <div className="space-y-6">
      {/* Header con Estado en Vivo & Controles */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-10 w-10 rounded-full bg-emerald-400 opacity-40"></span>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white tracking-tight">
                Aulas Activas en Vivo
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Monitoreo en Tiempo Real
              </span>
            </div>
            <p className="text-xs text-white/50 font-medium">
              Supervisión de clases en curso en la Escuela Profesional de Ingeniería Civil
            </p>
          </div>
        </div>

        {/* Refresco y Contador */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="text-right">
            <p className="text-[11px] text-white/40 font-mono">
              Auto-actualiza en: <span className="text-emerald-400 font-bold">{secondsUntilRefresh}s</span>
            </p>
            <p className="text-[10px] text-white/30 font-medium">
              Última sincronización: {lastUpdated.toLocaleTimeString('es-PE')}
            </p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all text-xs font-bold cursor-pointer disabled:opacity-50"
            title="Refrescar datos ahora"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refrescar</span>
          </button>
        </div>
      </div>

      {/* Tarjetas Resumen de Estado Hoy */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Activas Ahora */}
        <motion.div
          whileHover={{ y: -3 }}
          onClick={() => setTab('activas')}
          className={`cursor-pointer p-5 rounded-3xl border transition-all duration-300 ${
            tab === 'activas'
              ? 'bg-gradient-to-br from-emerald-950/60 via-emerald-900/30 to-black/60 border-emerald-500/60 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/30'
              : 'bg-white/[0.02] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Activity className="w-5 h-5" />
            </div>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div className="text-3xl font-black text-white font-mono tracking-tight mb-1">
            {data.activas?.length || 0}
          </div>
          <div className="text-xs font-bold text-emerald-300">Clases en Curso Ahora</div>
          <div className="text-[11px] text-white/40 mt-1">Docentes dictando en aula</div>
        </motion.div>

        {/* Finalizadas Hoy */}
        <motion.div
          whileHover={{ y: -3 }}
          onClick={() => setTab('completadas')}
          className={`cursor-pointer p-5 rounded-3xl border transition-all duration-300 ${
            tab === 'completadas'
              ? 'bg-gradient-to-br from-blue-950/60 via-blue-900/30 to-black/60 border-blue-500/60 shadow-lg shadow-blue-950/50 ring-1 ring-blue-500/30'
              : 'bg-white/[0.02] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] uppercase font-mono font-bold text-blue-400 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
              Hoy
            </span>
          </div>
          <div className="text-3xl font-black text-white font-mono tracking-tight mb-1">
            {data.completadasHoy?.length || 0}
          </div>
          <div className="text-xs font-bold text-blue-300">Clases Finalizadas Hoy</div>
          <div className="text-[11px] text-white/40 mt-1">Registros de salida completados</div>
        </motion.div>

        {/* Docentes que Asistieron Hoy */}
        <motion.div
          whileHover={{ y: -3 }}
          onClick={() => setTab('docentes_asistencia')}
          className={`cursor-pointer p-5 rounded-3xl border transition-all duration-300 ${
            tab === 'docentes_asistencia'
              ? 'bg-gradient-to-br from-purple-950/60 via-purple-900/30 to-black/60 border-purple-500/60 shadow-lg shadow-purple-950/50 ring-1 ring-purple-500/30'
              : 'bg-white/[0.02] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <UserCheck className="w-5 h-5" />
            </div>
            <span className="text-[10px] uppercase font-mono font-bold text-purple-400 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
              ASISTENCIA HOY
            </span>
          </div>
          <div className="text-3xl font-black text-white font-mono tracking-tight mb-1">
            {docentesAsistieronHoy.length}
          </div>
          <div className="text-xs font-bold text-purple-300">Docentes Asistieron Hoy</div>
          <div className="text-[11px] text-white/40 mt-1">Docentes únicos con registro hoy</div>
        </motion.div>

        {/* Clases Programadas Hoy */}
        <motion.div
          whileHover={{ y: -3 }}
          onClick={() => setTab('programadas')}
          className={`cursor-pointer p-5 rounded-3xl border transition-all duration-300 ${
            tab === 'programadas'
              ? 'bg-gradient-to-br from-amber-950/60 via-amber-900/30 to-black/60 border-amber-500/60 shadow-lg shadow-amber-950/50 ring-1 ring-amber-500/30'
              : 'bg-white/[0.02] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-[10px] uppercase font-mono font-bold text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              HORARIO
            </span>
          </div>
          <div className="text-3xl font-black text-white font-mono tracking-tight mb-1">
            {data.clasesProgramadas?.length || 0}
          </div>
          <div className="text-xs font-bold text-amber-300">Clases Programadas Hoy</div>
          <div className="text-[11px] text-white/40 mt-1">Según horario del semestre</div>
        </motion.div>
      </div>

      {/* Barra de Filtros & Búsqueda */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/10">
        {/* Pestañas de Vista */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto p-1 bg-black/40 rounded-xl border border-white/10">
          <button
            onClick={() => setTab('activas')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === 'activas'
                ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-500/50 shadow-xs'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>En Vivo ({activasFiltradas.length})</span>
          </button>
          <button
            onClick={() => setTab('completadas')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === 'completadas'
                ? 'bg-blue-500/30 text-blue-200 border border-blue-500/50 shadow-xs'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Finalizadas ({completadasFiltradas.length})</span>
          </button>
          <button
            onClick={() => setTab('docentes_asistencia')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === 'docentes_asistencia'
                ? 'bg-purple-500/30 text-purple-200 border border-purple-500/50 shadow-xs'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>Asistieron Hoy ({docentesAsistieronFiltrados.length})</span>
          </button>
          <button
            onClick={() => setTab('programadas')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === 'programadas'
                ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50 shadow-xs'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span>Programadas ({data.clasesProgramadas?.length || 0})</span>
          </button>
        </div>

        {/* Campo de Búsqueda */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar docente, aula, curso..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-white placeholder:text-white/30 text-xs font-medium focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10"
          />
        </div>
      </div>

      {/* Contenido de la Pestaña Seleccionada */}
      <AnimatePresence mode="wait">
        {tab === 'activas' && (
          <motion.div
            key="tab-activas"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {activasFiltradas.length === 0 ? (
              <div className="text-center py-16 px-4 rounded-3xl bg-white/[0.02] border border-white/10">
                <div className="w-14 h-14 mx-auto rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                  <Activity className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  No hay clases en curso en este instante
                </h3>
                <p className="text-xs text-white/40 max-w-md mx-auto">
                  Cuando un docente presione <strong>"Registrar Inicio de Clase"</strong> en el sistema, aparecerá automáticamente aquí en tiempo real.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activasFiltradas.map((sesion, idx) => (
                  <motion.div
                    key={sesion.fila || idx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                    className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950/40 via-white/[0.03] to-black/60 border-2 border-emerald-500/40 p-5 shadow-xl shadow-emerald-950/30 hover:border-emerald-400/70 transition-all duration-300"
                  >
                    {/* Badge de Aula Flotante */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{sesion.aula || 'Aula sin especificar'}</span>
                      </div>
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        EN VIVO
                      </span>
                    </div>

                    {/* Docente */}
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-white/40 shrink-0" />
                        <h4 className="text-sm font-black text-white leading-tight">
                          {sesion.docente || 'Docente'}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 pl-6">
                        <p className="text-[11px] font-mono text-white/40">DNI: {sesion.dni}</p>
                      </div>
                    </div>

                    {/* Asignatura */}
                    <div className="p-3 rounded-2xl bg-black/40 border border-white/10 mb-3 space-y-1">
                      <div className="flex items-start gap-2">
                        <BookOpen className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <p className="text-xs font-bold text-slate-200 leading-snug">
                          {sesion.asignatura || 'Asignatura no especificada'}
                        </p>
                      </div>
                    </div>

                    {/* Footer con Horas & Tiempo transcurrido */}
                    <div className="pt-3 border-t border-white/10 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-white/60">
                          <Clock className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="font-mono font-bold text-white">
                            {sesion.horaInicio}
                          </span>
                        </div>
                        <div className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold font-mono">
                          ⏱️ {getTiempoTranscurrido(sesion.horaInicio)}
                        </div>
                      </div>

                      {/* ⚠️ Alerta visual de exceso de duración */}
                      {(() => {
                        const exceso = getExcesoInfo(sesion.horaInicio, sesion.duracionEstimadaMin)
                        if (!exceso) return null
                        return exceso.excedida ? (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-950/50 border border-red-500/40 text-red-300 animate-pulse">
                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                            <span className="text-[11px] font-bold">
                              ⚠️ +{exceso.excesoMin} min de exceso — Debía finalizar a las {exceso.horaFinEstimada}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-white/40">
                            <Timer className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[10px] font-medium">
                              Fin estimado: {exceso.horaFinEstimada}
                            </span>
                          </div>
                        )
                      })()}

                      {/* 🚨 Botón Forzar Cierre de Aula */}
                      <button
                        onClick={() => setCierreModal(sesion)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-[11px] font-bold hover:bg-red-500/20 hover:border-red-400/50 transition-all cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Forzar Cierre de Aula</span>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {tab === 'completadas' && (
          <motion.div
            key="tab-completadas"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {completadasFiltradas.length === 0 ? (
              <div className="text-center py-16 px-4 rounded-3xl bg-white/[0.02] border border-white/10">
                <div className="w-14 h-14 mx-auto rounded-3xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  Aún no hay clases finalizadas hoy
                </h3>
                <p className="text-xs text-white/40 max-w-md mx-auto">
                  A medida que los docentes concluyan sus clases y envíen su registro, se listarán aquí.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completadasFiltradas.map((sesion, idx) => (
                  <motion.div
                    key={sesion.fila || idx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                    className="rounded-3xl bg-white/[0.03] border border-white/10 p-5 shadow-lg hover:border-blue-500/40 transition-all duration-300"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-black">
                        <MapPin className="w-3.5 h-3.5 text-blue-400" />
                        <span>{sesion.aula || 'Aula'}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-wider border border-blue-500/30">
                        COMPLETADA
                      </span>
                    </div>

                    <div className="space-y-1 mb-3">
                      <h4 className="text-sm font-black text-white leading-tight">
                        {sesion.docente}
                      </h4>
                      <p className="text-[11px] font-mono text-white/40">DNI: {sesion.dni}</p>
                    </div>

                    <div className="p-3 rounded-2xl bg-black/40 border border-white/10 mb-3 space-y-1.5">
                      <p className="text-xs font-bold text-slate-200">
                        {sesion.asignatura}
                      </p>
                      {sesion.tema && (
                        <p className="text-[11px] text-white/60 line-clamp-2">
                          <strong className="text-white/40">Tema:</strong> {sesion.tema}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-400" />
                        <span className="font-mono text-[11px]">
                          {sesion.horaInicio} ➔ {sesion.horaFin || 'Fin'}
                        </span>
                      </div>
                      {sesion.numEstudiantes && (
                        <div className="flex items-center gap-1 text-white/50 text-[11px]">
                          <Users className="w-3.5 h-3.5" />
                          <span>{sesion.numEstudiantes} est.</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {tab === 'docentes_asistencia' && (
          <motion.div
            key="tab-docentes-asistencia"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div className="rounded-3xl bg-white/[0.02] border border-white/10 overflow-hidden shadow-xl">
              <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-black/20">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-purple-400" />
                    <span>Docentes que Asistieron y Registraron Clase Hoy ({docentesAsistieronFiltrados.length})</span>
                  </h3>
                  <p className="text-xs text-white/40">
                    Plana docente con sesiones activas o concluidas en la jornada de hoy
                  </p>
                </div>
                <span className="self-start sm:self-auto px-3 py-1 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold font-mono">
                  {docentesAsistieronHoy.length} Docentes Únicos
                </span>
              </div>

              <div className="divide-y divide-white/5 max-h-[520px] overflow-y-auto custom-scrollbar">
                {docentesAsistieronFiltrados.length === 0 ? (
                  <div className="text-center py-12 text-xs text-white/40">
                    No se encontraron docentes con asistencia registrada hoy.
                  </div>
                ) : (
                  docentesAsistieronFiltrados.map((doc, idx) => (
                    <div
                      key={doc.dni || idx}
                      className="p-4 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-start sm:items-center gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-600/30 border border-purple-500/30 text-purple-300 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                          {idx + 1}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-bold text-white leading-tight">
                              {doc.nombre}
                            </h4>
                            {doc.enVivo ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                En Clase Ahora
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                Turno Concluido
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-white/40">
                            DNI: {doc.dni} • {doc.sesiones.length} {doc.sesiones.length === 1 ? 'sesión hoy' : 'sesiones hoy'}
                          </p>
                        </div>
                      </div>

                      {/* Resumen de Aulas y Cursos dictados hoy */}
                      <div className="flex flex-wrap items-center gap-2 pl-12 sm:pl-0">
                        {doc.sesiones.map((ses, sIdx) => (
                          <div
                            key={sIdx}
                            className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-[11px] space-y-0.5"
                          >
                            <span className="font-mono font-bold text-emerald-400 mr-1.5">
                              {ses.aula || 'Aula'}
                            </span>
                            <span className="text-white/70 truncate max-w-[150px] inline-block align-bottom" title={ses.asignatura}>
                              {ses.asignatura}
                            </span>
                            <span className="text-white/40 ml-1.5 font-mono text-[10px]">
                              ({ses.horaInicio})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── MODAL DE CONFIRMACIÓN DE CIERRE FORZADO ─── */}
      <AnimatePresence>
        {cierreModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => !isCerrando && setCierreModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-gradient-to-br from-slate-900 via-red-950/20 to-slate-950 border-2 border-red-500/40 shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 border-b-2 border-red-500/20 bg-red-950/30">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">
                      Forzar Cierre de Aula
                    </h3>
                    <p className="text-xs font-medium text-red-300/70">
                      Esta acción cerrará la sesión como Inconclusa
                    </p>
                  </div>
                </div>
              </div>

              {/* Datos de la sesión */}
              <div className="p-5 space-y-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-white/40" />
                    <span className="text-sm font-bold text-white">{cierreModal.docente}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-medium text-slate-300">{cierreModal.asignatura}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-medium text-slate-300">{cierreModal.aula}</span>
                  </div>
                </div>

                {/* Hora calculada */}
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-1">
                  <p className="text-[11px] font-bold text-amber-300/70">Hora de salida calculada automáticamente:</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60">
                      {cierreModal.horaInicio} + {cierreModal.duracionEstimadaMin || 90} min
                    </span>
                    <span className="font-mono font-black text-lg text-amber-300">
                      {calcularHoraFin(cierreModal.horaInicio, cierreModal.duracionEstimadaMin)}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-white/40">
                  Se registrará la hora de salida calculada y la sesión pasará a estado COMPLETADO con observación de cierre forzado.
                </p>
              </div>

              {/* Botones */}
              <div className="px-5 pb-5 flex gap-3">
                <button
                  onClick={() => setCierreModal(null)}
                  disabled={isCerrando}
                  className="flex-1 py-3 rounded-2xl border-2 border-white/10 text-white/60 text-sm font-bold hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleForzarCierre}
                  disabled={isCerrando}
                  className="flex-1 py-3 rounded-2xl bg-red-600 hover:bg-red-500 border-2 border-red-500 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-red-900/40"
                >
                  {isCerrando ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Cerrando...</>
                  ) : (
                    <><XCircle className="w-4 h-4" /> Confirmar Cierre</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TAB: Clases Programadas Hoy */}
      {tab === 'programadas' && (
        <motion.div
          key="tab-programadas"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          {(!data.clasesProgramadas || data.clasesProgramadas.length === 0) ? (
            <div className="text-center py-16 px-4 rounded-3xl bg-white/[0.02] border border-white/10">
              <div className="w-14 h-14 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                <Calendar className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">No hay clases programadas para hoy</h3>
              <p className="text-xs text-white/40">Verifica que los horarios del semestre estén cargados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.clasesProgramadas
                .filter(cp => {
                  if (!searchTerm) return true
                  const q = searchTerm.toLowerCase()
                  return cp.docente?.toLowerCase().includes(q) || cp.curso?.toLowerCase().includes(q) || cp.aula?.toLowerCase().includes(q)
                })
                .sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''))
                .map((cp, idx) => {
                  // Verificar si ya tiene sesión activa o completada
                  const tieneActiva = data.activas?.some(a => {
                    const docNorm1 = (a.docente || '').toUpperCase().replace(/[ÁÉÍÓÚ]/g, m => ({Á:'A',É:'E',Í:'I',Ó:'O',Ú:'U'}[m]))
                    const docNorm2 = (cp.docente || '').toUpperCase().replace(/[ÁÉÍÓÚ]/g, m => ({Á:'A',É:'E',Í:'I',Ó:'O',Ú:'U'}[m]))
                    return docNorm1.includes(docNorm2) || docNorm2.includes(docNorm1)
                  })
                  const tieneCompletada = data.completadasHoy?.some(c => {
                    const docNorm1 = (c.docente || '').toUpperCase().replace(/[ÁÉÍÓÚ]/g, m => ({Á:'A',É:'E',Í:'I',Ó:'O',Ú:'U'}[m]))
                    const docNorm2 = (cp.docente || '').toUpperCase().replace(/[ÁÉÍÓÚ]/g, m => ({Á:'A',É:'E',Í:'I',Ó:'O',Ú:'U'}[m]))
                    return docNorm1.includes(docNorm2) || docNorm2.includes(docNorm1)
                  })
                  const estado = tieneActiva ? 'activa' : tieneCompletada ? 'completada' : 'pendiente'

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.5) }}
                      className={`p-4 rounded-2xl border transition-all ${
                        estado === 'activa' ? 'bg-emerald-500/5 border-emerald-500/30' :
                        estado === 'completada' ? 'bg-blue-500/5 border-blue-500/20' :
                        'bg-white/[0.02] border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          estado === 'activa' ? 'bg-emerald-500/20 text-emerald-300' :
                          estado === 'completada' ? 'bg-blue-500/20 text-blue-300' :
                          'bg-amber-500/20 text-amber-300'
                        }`}>
                          {estado === 'activa' ? '● EN CLASE' : estado === 'completada' ? '✓ COMPLETADA' : '○ PENDIENTE'}
                        </span>
                        <span className="text-[10px] text-white/30 font-mono">Ciclo {cp.ciclo}</span>
                      </div>
                      <p className="text-xs font-black text-white leading-tight">{cp.docente}</p>
                      <p className="text-[11px] text-white/50 mt-1">{cp.curso}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px]">
                        <span className="flex items-center gap-1 text-amber-300 font-mono font-bold">
                          <Clock className="w-3 h-3" /> {cp.horaInicio} – {cp.horaFin}
                        </span>
                        <span className="flex items-center gap-1 text-emerald-300 font-bold">
                          <MapPin className="w-3 h-3" /> {cp.aula}
                        </span>
                        {cp.seccion && (
                          <span className="text-white/30">Sec. {cp.seccion}</span>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

export default MonitoreoView
